import { createEventListener } from "@solid-primitives/event-listener";
import { platform } from "@tauri-apps/plugin-os";
import { createEffect, createSignal, type JSX, Match, on, onCleanup, onMount, type Ref, Show, Switch } from "solid-js";
import { beatToMs } from "~/lib/ultrastar/bpm";
import { findSmartPreviewPosition } from "~/lib/ultrastar/preview";
import type { LocalSong } from "~/lib/ultrastar/song";
import { createRefContent } from "~/lib/utils/ref";

export interface SongPlayerRef {
  getCurrentTime: () => number;
  getDuration: () => number;
  setCurrentTime: (time: number) => void;
}

interface SongPlayerProps {
  ref?: Ref<SongPlayerRef>;
  song: LocalSong | null;
  volume?: number;
  playing?: boolean;
  class?: string;
  onCanPlayThrough?: () => void;
  onEnded?: () => void;
  onError?: () => void;
  mode?: "regular" | "medley" | "preview";
  preferInstrumental?: boolean;
}

const getMediaErrorMessage = (element: HTMLMediaElement): string => {
  const mediaError = element.error;

  if (!mediaError) {
    return "Unknown media error";
  }

  let errorMessage = "";
  switch (mediaError.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      errorMessage = "Media playback was aborted";
      break;
    case MediaError.MEDIA_ERR_NETWORK:
      errorMessage = "Network error occurred while loading media";
      break;
    case MediaError.MEDIA_ERR_DECODE:
      errorMessage = "Media decoding error occurred";
      break;
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      errorMessage = "Media format not supported";
      break;
    default:
      errorMessage = "Unknown media error";
  }

  if (mediaError.message) {
    errorMessage += ` (${mediaError.message})`;
  }

  return errorMessage;
};

const calculateReplayGainAdjustment = (gainDb: number | null, peak: number | null): number => {
  if (gainDb == null) return 1;

  const gainMultiplier = 10 ** (gainDb / 20);

  if (peak && peak > 0) {
    const maxAllowedGain = 1.0 / peak;
    return Math.min(gainMultiplier, maxAllowedGain);
  }

  return gainMultiplier;
};

let sharedAudioContext: AudioContext | null = null;
const getAudioContext = () => {
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContext();
  }
  if (sharedAudioContext.state === "suspended") {
    sharedAudioContext.resume().catch((err) => console.warn("Failed to resume AudioContext:", err));
  }
  return sharedAudioContext;
};

export default function SongPlayer(props: SongPlayerProps) {
  const [videoElement, setVideoElement] = createSignal<HTMLVideoElement | undefined>();
  const [audioReady, setAudioReady] = createSignal(false);
  const [videoReady, setVideoReady] = createSignal(false);
  const [videoError, setVideoError] = createSignal(false);
  const [hasInitialized, setHasInitialized] = createSignal(false);
  const [isCurrentlyPlaying, setIsCurrentlyPlaying] = createSignal(false);
  const [currentAudioUrl, setCurrentAudioUrl] = createSignal<string | undefined>();
  const [preservedTime, setPreservedTime] = createSignal<number | undefined>();

  let syncTimeout: ReturnType<typeof setTimeout> | undefined;
  let endCheckInterval: ReturnType<typeof setInterval> | undefined;
  let fadeOutTimeout: ReturnType<typeof setTimeout> | undefined;
  const audioContext = getAudioContext();
  let audioSource: MediaElementAudioSourceNode | undefined;
  let currentGainNode: GainNode | undefined;

  // Persistent audio element to avoid repeated createMediaElementSource calls (leaks on macOS/WebKit)
  let audioElementRef!: HTMLAudioElement;

  onMount(() => {
    const audio = audioElementRef;
    if (!audio) return;

    let localAudioSource: MediaElementAudioSourceNode | undefined;
    let localGainNode: GainNode | undefined;

    try {
      localAudioSource = audioContext.createMediaElementSource(audio);
      localGainNode = audioContext.createGain();
      localAudioSource.connect(localGainNode);
      localGainNode.connect(audioContext.destination);

      audioSource = localAudioSource;
      currentGainNode = localGainNode;

      const song = props.song;
      const replayGainAdjustment = calculateReplayGainAdjustment(
        song?.replayGainTrackGain ?? null,
        song?.replayGainTrackPeak ?? null,
      );
      localGainNode.gain.value = (props.volume ?? 1) * replayGainAdjustment;
    } catch (error) {
      console.warn("Failed to create audio source:", error);
      try {
        if (localGainNode) localGainNode.disconnect();
        if (localAudioSource) localAudioSource.disconnect();
      } catch {
        // Ignore cleanup errors
      }
      audioSource = undefined;
      currentGainNode = undefined;
    }
  });

  createEffect(() => {
    if (!currentGainNode) return;
    const volume = props.volume ?? 1;
    const song = props.song;
    const adjustment = calculateReplayGainAdjustment(
      song?.replayGainTrackGain ?? null,
      song?.replayGainTrackPeak ?? null,
    );
    currentGainNode.gain.setValueAtTime(volume * adjustment, audioContext.currentTime);
  });

  createEffect(() => {
    const song = props.song;
    const audioUrl = song?.audioUrl;
    const instrumentalUrl = song?.instrumentalUrl;
    const newUrl = (props.preferInstrumental && instrumentalUrl) || audioUrl || undefined;
    const currentUrl = currentAudioUrl();
    const audio = audioElementRef;

    if (newUrl === currentUrl) return;

    const wasPlaying = audio && !audio.paused;
    const currentTime = audio?.currentTime ?? 0;

    setCurrentAudioUrl(newUrl);

    if (newUrl) {
      audio.src = newUrl;
    } else {
      audio.removeAttribute("src");
      audio.load();
      setAudioReady(false);
      return;
    }

    if (currentUrl && newUrl) {
      setAudioReady(false);
      setPreservedTime(currentTime);

      const restorePlayback = () => {
        audio.currentTime = currentTime;
        if (wasPlaying) {
          audio.play().catch((error) => console.warn("Failed to resume playback after track switch:", error));
        }
        audio.removeEventListener("canplaythrough", restorePlayback);
        setAudioReady(true);
        setPreservedTime(undefined);
      };

      audio.addEventListener("canplaythrough", restorePlayback, { once: true });
    }
  });

  createEffect(
    on(videoElement, (video) => {
      if (!video) return;

      if (!currentAudioUrl()) {
        const updateVolume = () => {
          video.volume = props.volume ?? 1;
        };

        updateVolume();

        createEffect(() => {
          updateVolume();
        });
      }
    }),
  );

  const isReady = () => {
    if (!props.song) return false;

    const hasAudio = !!currentAudioUrl();
    const video = videoElement();

    if (!hasAudio && !video) return false;
    if (hasAudio && !audioReady()) return false;
    if (video && !videoError() && !videoReady()) return false;

    return true;
  };

  const setPreviewTime = () => {
    const song = props.song;
    if (!song) return;

    const audio = audioElementRef;
    const video = videoElement();
    const previewStart = getPreviewStartTime(song, song.videoGap ?? 0);

    if (audio && audio.currentTime === 0) {
      audio.currentTime = previewStart / 1000; // Convert milliseconds to seconds
    }
    if (video && video.currentTime === 0) {
      video.currentTime = previewStart / 1000; // Convert milliseconds to seconds
    }
  };

  const applyFadeIn = () => {
    const song = props.song;
    if (props.mode !== "medley" || !currentGainNode || !song) return;

    const volume = props.volume ?? 1;
    const adjustment = calculateReplayGainAdjustment(song.replayGainTrackGain, song.replayGainTrackPeak);
    const targetVolume = volume * adjustment;
    const fadeInDuration = 3;

    currentGainNode.gain.cancelScheduledValues(audioContext.currentTime);
    currentGainNode.gain.setValueAtTime(0, audioContext.currentTime);
    currentGainNode.gain.linearRampToValueAtTime(targetVolume, audioContext.currentTime + fadeInDuration);
  };

  const applyFadeOut = () => {
    if (props.mode !== "medley" || !currentGainNode) return;

    const fadeOutDuration = 3;
    const currentVolume = currentGainNode.gain.value;

    currentGainNode.gain.cancelScheduledValues(audioContext.currentTime);
    currentGainNode.gain.setValueAtTime(currentVolume, audioContext.currentTime);
    currentGainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + fadeOutDuration);
  };

  const scheduleFadeOut = () => {
    clearTimeout(fadeOutTimeout);

    const song = props.song;
    if (props.mode !== "medley" || !song?.end) return;

    const audio = audioElementRef;
    const video = videoElement();
    const mediaElement = audio || video;

    if (!mediaElement) return;

    const currentTime = mediaElement.currentTime * 1000;
    const endTime = song.end;
    const fadeOutDuration = 3000;
    const timeUntilFadeOut = endTime - currentTime - fadeOutDuration;

    if (timeUntilFadeOut > 0) {
      fadeOutTimeout = setTimeout(() => {
        applyFadeOut();
      }, timeUntilFadeOut);
    } else if (timeUntilFadeOut > -fadeOutDuration) {
      // We're already in the fade-out window, apply it immediately
      applyFadeOut();
    }
  };

  const play = async () => {
    const song = props.song;
    if (!song) return;

    const audio = currentAudioUrl() ? audioElementRef : undefined;
    const video = videoElement();

    if (!audio && !video) return;

    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch (error) {
        console.warn("Failed to resume audio context:", error);
      }
    }

    clearTimeout(syncTimeout);

    try {
      if (props.mode === "preview") {
        setPreviewTime();
      } else if (song.start) {
        if (audio && audio.currentTime === 0) {
          audio.currentTime = song.start / 1000;
        }
        if (video && video.currentTime === 0) {
          video.currentTime = song.start / 1000;
        }
      }

      applyFadeIn();

      if (audio && video) {
        await syncVideoToAudio(audio, video);
      } else if (audio) {
        await audio.play();
      } else if (video) {
        await video.play();
      }

      scheduleFadeOut();
    } catch (error) {
      console.warn("Failed to start playback:", error);
    }
  };

  const pause = () => {
    audioElementRef?.pause();
    videoElement()?.pause();
    clearTimeout(syncTimeout);
    clearTimeout(fadeOutTimeout);
    clearInterval(endCheckInterval);
  };

  const checkForSongEnd = () => {
    const song = props.song;
    if (!song?.end) return;

    const preserved = preservedTime();
    const rawCurrentTime = preserved ?? audioElementRef?.currentTime ?? videoElement()?.currentTime ?? 0;
    const endTimeInSeconds = song.end / 1000;

    if (rawCurrentTime >= endTimeInSeconds) {
      pause();
      queueMicrotask(() => {
        handleEnded();
      });
    }
  };

  const startEndTimeMonitoring = () => {
    clearInterval(endCheckInterval);
    const song = props.song;
    if (song?.end) {
      endCheckInterval = setInterval(checkForSongEnd, 100);
    }
  };

  const stopEndTimeMonitoring = () => {
    clearInterval(endCheckInterval);
  };

  createEffect(() => {
    const shouldPlay = props.playing && isReady();
    const currentlyPlaying = isCurrentlyPlaying();

    if (shouldPlay && !currentlyPlaying) {
      play();
      startEndTimeMonitoring();
      setIsCurrentlyPlaying(true);
    } else if (!props.playing && currentlyPlaying) {
      pause();
      stopEndTimeMonitoring();
      setIsCurrentlyPlaying(false);
    }
  });

  createEffect(
    on(
      () => props.song,
      (song) => {
        pause();
        stopEndTimeMonitoring();
        clearTimeout(syncTimeout);
        clearTimeout(fadeOutTimeout);

        setAudioReady(false);
        setVideoReady(false);
        setVideoError(false);
        setHasInitialized(false);
        setIsCurrentlyPlaying(false);
        setPreservedTime(undefined);

        const audio = audioElementRef;
        if (audio && !audio.paused) audio.pause();
        if (audio) audio.currentTime = 0;

        const video = videoElement();
        if (video && !video.paused) video.pause();
        if (video) video.currentTime = 0;

        if (currentGainNode && song) {
          const volume = props.volume ?? 1;
          const adjustment = calculateReplayGainAdjustment(song.replayGainTrackGain, song.replayGainTrackPeak);
          currentGainNode.gain.cancelScheduledValues(audioContext.currentTime);
          currentGainNode.gain.setValueAtTime(volume * adjustment, audioContext.currentTime);
        }
      },
    ),
  );

  createEffect(() => {
    if (isReady() && !hasInitialized()) {
      setHasInitialized(true);
      props.onCanPlayThrough?.();
    }
  });

  const syncVideoToAudio = async (audio: HTMLAudioElement, video: HTMLVideoElement) => {
    const song = props.song;
    if (!song) return;

    const videoGap = (song.videoGap ?? 0) / 1000;
    const expectedVideoTime = audio.currentTime + videoGap;
    const gap = video.currentTime - expectedVideoTime;

    if (Math.abs(gap) <= 0.01 || expectedVideoTime >= 0) {
      if (expectedVideoTime >= 0) {
        video.currentTime = expectedVideoTime;
      }
      await Promise.all([audio.play(), video.play()]);
      return;
    }

    await audio.play();
    const delaySeconds = -expectedVideoTime;

    syncTimeout = setTimeout(async () => {
      try {
        const currentAudioTime = audio.currentTime;
        const startVideoTime = Math.max(0, currentAudioTime + videoGap);
        if (!Number.isNaN(startVideoTime)) {
          video.currentTime = startVideoTime;
        }
        await video.play();
      } catch (error) {
        console.warn("Failed to start delayed video playback:", error);
      }
    }, delaySeconds * 1000);
  };

  const resyncOnFocus = () => {
    const song = props.song;
    if (!song) return;

    const audio = audioElementRef;
    const video = videoElement();

    if (!audio || !video || !isCurrentlyPlaying()) return;

    try {
      const videoGap = (song.videoGap ?? 0) / 1000;
      const expectedVideoTime = audio.currentTime + videoGap;
      const timeDifference = Math.abs(expectedVideoTime - video.currentTime);

      if (timeDifference > 0.01) {
        syncVideoToAudio(audio, video);
      }
    } catch (error) {
      console.warn("Failed to resync video on focus:", error);
    }
  };

  if (platform() === "macos") {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        resyncOnFocus();
      }
    };

    createEventListener(document, "visibilitychange", handleVisibilityChange);
  }

  const handleEnded = () => {
    console.log("ended song");
    props.onEnded?.();
  };

  const handleAudioCanPlayThrough = () => {
    setAudioReady(true);
  };

  const handleVideoCanPlayThrough = () => {
    setVideoReady(true);
  };

  const handleVideoError: JSX.EventHandler<HTMLVideoElement, Event> = (error) => {
    const videoEl = error.currentTarget;
    const errorMessage = getMediaErrorMessage(videoEl);

    setVideoError(true);
    setVideoElement(undefined);

    if (!currentAudioUrl()) {
      console.error("Failed to play video:", errorMessage);
      props.onError?.();
    } else {
      console.warn("Failed to play video:", errorMessage);
    }
  };

  const handleAudioError: JSX.EventHandler<HTMLAudioElement, Event> = (error) => {
    const audioEl = error.currentTarget;
    const errorMessage = getMediaErrorMessage(audioEl);

    if (!currentAudioUrl()) return;

    console.error("Failed to play audio:", errorMessage);
    props.onError?.();
  };

  createRefContent(
    () => props.ref,
    () => ({
      getCurrentTime: () => {
        const preserved = preservedTime();
        if (preserved !== undefined) return preserved;

        const audio = audioElementRef;
        const video = videoElement();

        return audio?.currentTime ?? video?.currentTime ?? 0;
      },
      getDuration: () => {
        const audio = audioElementRef;
        const video = videoElement();
        return audio?.duration ?? video?.duration ?? 0;
      },
      setCurrentTime: (time: number) => {
        const song = props.song;
        if (!song) return;

        if (preservedTime() !== undefined) {
          setPreservedTime(time);
        }

        const audio = audioElementRef;
        const video = videoElement();

        if (audio && video) {
          const videoGap = (song.videoGap ?? 0) / 1000;
          audio.currentTime = time;
          video.currentTime = time + videoGap;
        } else if (audio) {
          audio.currentTime = time;
        } else if (video) {
          video.currentTime = time;
        }
      },
    }),
  );

  onCleanup(() => {
    pause();
    stopEndTimeMonitoring();
    clearTimeout(fadeOutTimeout);

    try {
      if (audioSource) {
        audioSource.disconnect();
        audioSource = undefined;
      }
      if (currentGainNode) {
        currentGainNode.disconnect();
        currentGainNode = undefined;
      }
    } catch {
      // Ignore disconnection errors
    }
  });

  return (
    <div
      class="relative h-full w-full bg-black"
      classList={{
        [props.class || ""]: true,
      }}
    >
      <Show when={props.song}>
        {(song) => (
          <Switch>
            <Match when={!videoError() && song().videoUrl}>
              {(videoUrl) => (
                <video
                  muted={!!currentAudioUrl()}
                  class="h-full w-full object-cover"
                  ref={setVideoElement}
                  preload="auto"
                  crossorigin="anonymous"
                  onCanPlayThrough={handleVideoCanPlayThrough}
                  onEnded={() => {
                    if (!currentAudioUrl()) {
                      handleEnded();
                    }
                  }}
                  src={videoUrl()}
                  onError={handleVideoError}
                />
              )}
            </Match>
            <Match when={song().backgroundUrl}>
              {(backgroundUrl) => <img alt="" class="h-full w-full object-contain" src={backgroundUrl()} />}
            </Match>
            <Match when={song().coverUrl}>
              {(coverUrl) => (
                <div class="relative h-full w-full">
                  <img src={coverUrl()} alt="" class="absolute inset-0 h-full w-full object-cover blur-2xl" />
                  <img src={coverUrl()} alt="" class="relative h-full w-full object-contain" />
                </div>
              )}
            </Match>
          </Switch>
        )}
      </Show>

      <audio
        ref={audioElementRef}
        preload="auto"
        crossorigin="anonymous"
        onCanPlayThrough={handleAudioCanPlayThrough}
        onEnded={handleEnded}
        onError={handleAudioError}
      />
    </div>
  );
}

const getPreviewStartTime = (song: LocalSong, videoGap: number): number => {
  const videoGapSeconds = videoGap / 1000;

  if (song.previewStart !== null) {
    return Math.max(0, song.previewStart);
  }

  const smartPreviewTime = findSmartPreviewPosition(song);

  if (smartPreviewTime !== null) {
    const previewGap = videoGapSeconds < 0 ? videoGapSeconds : 0;
    return Math.max(0, (smartPreviewTime + previewGap) * 1000);
  }

  const firstNote = song.voices[0]?.phrases[0]?.notes[0];
  if (!firstNote) {
    return 0;
  }

  const previewGap = videoGapSeconds < 0 ? videoGapSeconds : 0;
  return Math.max(0, (beatToMs(song, firstNote.startBeat) / 1000 - 2 + previewGap) * 1000);
};

import { createEventListener } from "@solid-primitives/event-listener";
import { platform } from "@tauri-apps/plugin-os";
import { createEffect, createMemo, createSignal, type JSX, on, onCleanup, onMount, type Ref, Show } from "solid-js";
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
  const [audioReady, setAudioReady] = createSignal(false);
  const [videoReady, setVideoReady] = createSignal(false);
  const [videoError, setVideoError] = createSignal(false);
  const [hasInitialized, setHasInitialized] = createSignal(false);
  const [isCurrentlyPlaying, setIsCurrentlyPlaying] = createSignal(false);
  const [currentAudioUrl, setCurrentAudioUrl] = createSignal<string | undefined>();
  const [currentVideoUrl, setCurrentVideoUrl] = createSignal<string | undefined>();
  const [preservedTime, setPreservedTime] = createSignal<number | undefined>();

  let syncTimeout: ReturnType<typeof setTimeout> | undefined;
  let endCheckInterval: ReturnType<typeof setInterval> | undefined;
  let fadeOutTimeout: ReturnType<typeof setTimeout> | undefined;
  const audioContext = getAudioContext();
  let audioSource: MediaElementAudioSourceNode | undefined;
  let currentGainNode: GainNode | undefined;

  // Persistent media elements to avoid repeated decoder/createMediaElementSource setup (leaks on macOS/WebKit)
  let audioElementRef!: HTMLAudioElement;
  let videoElementRef!: HTMLVideoElement;

  const videoActive = () => !!currentVideoUrl() && !videoError();

  // Fallback visual: background image or cover art when video is not active
  const fallbackVisual = createMemo(() => {
    const song = props.song;
    if (!song || videoActive()) return null;
    if (song.backgroundUrl) return { type: "background" as const, url: song.backgroundUrl };
    if (song.coverUrl) return { type: "cover" as const, url: song.coverUrl };
    return null;
  });

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

  // Audio src management
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

  // Video src management
  createEffect(() => {
    const song = props.song;
    const newUrl = song?.videoUrl || undefined;
    const currentUrl = currentVideoUrl();
    const video = videoElementRef;

    if (newUrl === currentUrl) return;

    setCurrentVideoUrl(newUrl);
    setVideoReady(false);
    setVideoError(false);

    if (newUrl) {
      video.src = newUrl;
    } else {
      video.removeAttribute("src");
      video.load();
    }
  });

  // Video volume (only when there's no separate audio track)
  createEffect(() => {
    if (!currentVideoUrl()) return;
    videoElementRef.volume = currentAudioUrl() ? 0 : (props.volume ?? 1);
  });

  // Video muted state (mute when there's a separate audio track)
  createEffect(() => {
    videoElementRef.muted = !!currentAudioUrl();
  });

  const isReady = () => {
    if (!props.song) return false;

    const hasAudio = !!currentAudioUrl();
    const hasVideo = videoActive();

    if (!hasAudio && !hasVideo) return false;
    if (hasAudio && !audioReady()) return false;
    if (hasVideo && !videoReady()) return false;

    return true;
  };

  const setPreviewTime = () => {
    const song = props.song;
    if (!song) return;

    const previewStart = getPreviewStartTime(song, song.videoGap ?? 0);

    if (currentAudioUrl() && audioElementRef.currentTime === 0) {
      audioElementRef.currentTime = previewStart / 1000;
    }
    if (videoActive() && videoElementRef.currentTime === 0) {
      videoElementRef.currentTime = previewStart / 1000;
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

    const mediaElement = currentAudioUrl() ? audioElementRef : videoActive() ? videoElementRef : undefined;
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
      applyFadeOut();
    }
  };

  const play = async () => {
    const song = props.song;
    if (!song) return;

    const audio = currentAudioUrl() ? audioElementRef : undefined;
    const video = videoActive() ? videoElementRef : undefined;

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
    videoElementRef?.pause();
    clearTimeout(syncTimeout);
    clearTimeout(fadeOutTimeout);
    clearInterval(endCheckInterval);
  };

  const checkForSongEnd = () => {
    const song = props.song;
    if (!song?.end) return;

    const preserved = preservedTime();
    const rawCurrentTime = preserved ?? audioElementRef?.currentTime ?? videoElementRef?.currentTime ?? 0;
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

        if (audioElementRef) {
          if (!audioElementRef.paused) audioElementRef.pause();
          audioElementRef.currentTime = 0;
        }

        if (videoElementRef) {
          if (!videoElementRef.paused) videoElementRef.pause();
          videoElementRef.currentTime = 0;
        }

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
    const video = videoActive() ? videoElementRef : undefined;

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

        return audioElementRef?.currentTime ?? videoElementRef?.currentTime ?? 0;
      },
      getDuration: () => {
        return audioElementRef?.duration ?? videoElementRef?.duration ?? 0;
      },
      setCurrentTime: (time: number) => {
        const song = props.song;
        if (!song) return;

        if (preservedTime() !== undefined) {
          setPreservedTime(time);
        }

        const hasVideo = videoActive();

        if (currentAudioUrl() && hasVideo) {
          const videoGap = (song.videoGap ?? 0) / 1000;
          audioElementRef.currentTime = time;
          videoElementRef.currentTime = time + videoGap;
        } else if (currentAudioUrl()) {
          audioElementRef.currentTime = time;
        } else if (hasVideo) {
          videoElementRef.currentTime = time;
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
      <video
        ref={videoElementRef}
        class="h-full w-full object-cover"
        classList={{ hidden: !videoActive() }}
        preload="auto"
        crossorigin="anonymous"
        onCanPlayThrough={handleVideoCanPlayThrough}
        onEnded={() => {
          if (!currentAudioUrl()) {
            handleEnded();
          }
        }}
        onError={handleVideoError}
      />

      <Show when={fallbackVisual()}>
        {(visual) => (
          <Show
            when={visual().type === "cover" && visual()}
            fallback={<img alt="" class="h-full w-full object-contain" src={visual().url} />}
          >
            {(cover) => (
              <div class="relative h-full w-full">
                <img src={cover().url} alt="" class="absolute inset-0 h-full w-full object-cover blur-2xl" />
                <img src={cover().url} alt="" class="relative h-full w-full object-contain" />
              </div>
            )}
          </Show>
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

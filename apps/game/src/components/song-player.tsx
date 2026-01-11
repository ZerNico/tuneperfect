import { createEventListener } from "@solid-primitives/event-listener";
import { platform } from "@tauri-apps/plugin-os";
import { createEffect, createSignal, type JSX, Match, on, onCleanup, type Ref, Show, Switch } from "solid-js";
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
  song: LocalSong;
  volume?: number;
  playing?: boolean;
  class?: string;
  onCanPlayThrough?: () => void;
  onEnded?: () => void;
  onError?: () => void;
  mode?: "regular" | "medley" | "preview";
  preferInstrumental?: boolean;
}

// Utility function to get detailed media error message
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

  // Convert dB gain to linear multiplier
  const gainMultiplier = 10 ** (gainDb / 20);

  // If we have peak information, prevent clipping
  if (peak && peak > 0) {
    const maxAllowedGain = 1.0 / peak;
    return Math.min(gainMultiplier, maxAllowedGain);
  }

  return gainMultiplier;
};

export default function SongPlayer(props: SongPlayerProps) {
  const [audioElement, setAudioElement] = createSignal<HTMLAudioElement | undefined>();
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
  const audioContext = new AudioContext();
  let audioSource: MediaElementAudioSourceNode | undefined;
  let currentGainNode: GainNode | undefined;

  // Setup audio context for audio element
  createEffect(
    on(audioElement, (audio, prevAudio) => {
      // Clean up previous source if it exists
      if (audioSource && prevAudio) {
        try {
          audioSource.disconnect();
        } catch {
          // Ignore disconnection errors
        }
        audioSource = undefined;
      }

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

        const replayGainAdjustment = calculateReplayGainAdjustment(props.song.replayGainTrackGain, props.song.replayGainTrackPeak);
        localGainNode.gain.value = (props.volume ?? 1) * replayGainAdjustment;

        // Update volume when it changes
        createEffect(() => {
          if (localGainNode) {
            const volume = props.volume ?? 1;
            const adjustment = calculateReplayGainAdjustment(props.song.replayGainTrackGain, props.song.replayGainTrackPeak);
            localGainNode.gain.setValueAtTime(volume * adjustment, audioContext.currentTime);
          }
        });

        onCleanup(() => {
          try {
            if (localGainNode) {
              localGainNode.disconnect();
            }
            if (localAudioSource) {
              localAudioSource.disconnect();
            }
          } catch {
            // Ignore disconnection errors during cleanup
          }
          // Clear the global reference if it matches our current source
          if (audioSource === localAudioSource) {
            audioSource = undefined;
          }
          if (currentGainNode === localGainNode) {
            currentGainNode = undefined;
          }
        });
      } catch (error) {
        console.warn("Failed to create audio source:", error);
        // Clean up any partially created nodes if error occurred
        try {
          if (localGainNode) {
            localGainNode.disconnect();
          }
          if (localAudioSource) {
            localAudioSource.disconnect();
          }
        } catch {
          // Ignore cleanup errors
        }
        audioSource = undefined;
        currentGainNode = undefined;
      }
    })
  );

  // Handle track switching
  createEffect(() => {
    const { audioUrl, instrumentalUrl } = props.song;
    const newUrl = (props.preferInstrumental && instrumentalUrl) || audioUrl || undefined;
    const currentUrl = currentAudioUrl();
    const audio = audioElement();

    if (newUrl === currentUrl) return;

    // Store state before switching
    const wasPlaying = audio && !audio.paused;
    const currentTime = audio?.currentTime ?? 0;

    setCurrentAudioUrl(newUrl);

    if (audio && currentUrl && newUrl) {
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

  // Setup volume control for video element
  createEffect(
    on(videoElement, (video) => {
      if (!video) return;

      // Only control volume for video if there's no separate audio element
      if (!currentAudioUrl()) {
        const updateVolume = () => {
          video.volume = props.volume ?? 1;
        };

        updateVolume();

        createEffect(() => {
          updateVolume();
        });
      }
    })
  );

  // Check if all required media is ready
  const isReady = () => {
    const audio = audioElement();
    const video = videoElement();

    if (!audio && !video) return false;
    if (audio && !audioReady()) return false;
    if (video && !videoError() && !videoReady()) return false;

    return true;
  };

  // Set initial time for preview mode
  const setPreviewTime = () => {
    const audio = audioElement();
    const video = videoElement();
    const previewStart = getPreviewStartTime(props.song, props.song.videoGap ?? 0);

    if (audio && audio.currentTime === 0) {
      audio.currentTime = previewStart / 1000; // Convert milliseconds to seconds
    }
    if (video && video.currentTime === 0) {
      video.currentTime = previewStart / 1000; // Convert milliseconds to seconds
    }
  };

  // Apply fade-in effect for medley mode
  const applyFadeIn = () => {
    if (props.mode !== "medley" || !currentGainNode) return;

    const volume = props.volume ?? 1;
    const adjustment = calculateReplayGainAdjustment(props.song.replayGainTrackGain, props.song.replayGainTrackPeak);
    const targetVolume = volume * adjustment;
    const fadeInDuration = 3; // seconds

    // Start from 0 and fade to target volume over 3 seconds
    currentGainNode.gain.cancelScheduledValues(audioContext.currentTime);
    currentGainNode.gain.setValueAtTime(0, audioContext.currentTime);
    currentGainNode.gain.linearRampToValueAtTime(targetVolume, audioContext.currentTime + fadeInDuration);
  };

  // Apply fade-out effect for medley mode
  const applyFadeOut = () => {
    if (props.mode !== "medley" || !currentGainNode) return;

    const fadeOutDuration = 3; // seconds
    const currentVolume = currentGainNode.gain.value;

    // Fade from current volume to 0 over 3 seconds
    currentGainNode.gain.cancelScheduledValues(audioContext.currentTime);
    currentGainNode.gain.setValueAtTime(currentVolume, audioContext.currentTime);
    currentGainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + fadeOutDuration);
  };

  // Schedule fade-out for medley mode
  const scheduleFadeOut = () => {
    clearTimeout(fadeOutTimeout);
    
    if (props.mode !== "medley" || !props.song.end) return;

    const audio = audioElement();
    const video = videoElement();
    const mediaElement = audio || video;
    
    if (!mediaElement) return;

    const currentTime = mediaElement.currentTime * 1000; // Convert to milliseconds
    const endTime = props.song.end;
    const fadeOutDuration = 3000; // 3 seconds in milliseconds
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

  // Sync and start playback
  const play = async () => {
    const audio = audioElement();
    const video = videoElement();

    if (!audio && !video) return;

    // Ensure AudioContext is resumed if needed
    if (audioContext.state === "suspended") {
      try {
        await audioContext.resume();
      } catch (error) {
        console.warn("Failed to resume audio context:", error);
      }
    }

    // Clear any existing sync timeout
    clearTimeout(syncTimeout);

    try {
      // Set initial times
      if (props.mode === "preview") {
        setPreviewTime();
      } else if (props.song.start) {
        if (audio && audio.currentTime === 0) {
          audio.currentTime = props.song.start / 1000; // Convert milliseconds to seconds
        }
        if (video && video.currentTime === 0) {
          video.currentTime = props.song.start / 1000; // Convert milliseconds to seconds
        }
      }

      // Apply fade-in for medley mode
      applyFadeIn();

      if (audio && video) {
        // Sync both audio and video with proper videoGap handling
        await syncVideoToAudio(audio, video);
      } else if (audio) {
        await audio.play();
      } else if (video) {
        await video.play();
      }

      // Schedule fade-out for medley mode
      scheduleFadeOut();
    } catch (error) {
      console.warn("Failed to start playback:", error);
    }
  };

  // Stop playback
  const pause = () => {
    audioElement()?.pause();
    videoElement()?.pause();
    clearTimeout(syncTimeout);
    clearTimeout(fadeOutTimeout);
    clearInterval(endCheckInterval);
  };

  const checkForSongEnd = () => {
    if (!props.song.end) return;

    // Use preserved time during track switching to prevent premature end detection
    const preserved = preservedTime();
    const rawCurrentTime = preserved ?? audioElement()?.currentTime ?? videoElement()?.currentTime ?? 0;
    const endTimeInSeconds = props.song.end / 1000; // Convert milliseconds to seconds

    if (rawCurrentTime >= endTimeInSeconds) {
      pause();
      // Use queueMicrotask to defer callback
      queueMicrotask(() => {
        handleEnded();
      });
    }
  };

  const startEndTimeMonitoring = () => {
    clearInterval(endCheckInterval);
    if (props.song.end) {
      endCheckInterval = setInterval(checkForSongEnd, 100);
    }
  };

  const stopEndTimeMonitoring = () => {
    clearInterval(endCheckInterval);
  };

  // Main playback control effect
  createEffect(() => {
    const shouldPlay = props.playing && isReady();
    const currentlyPlaying = isCurrentlyPlaying();

    if (shouldPlay && !currentlyPlaying) {
      // Transition from not playing to playing
      play();
      startEndTimeMonitoring();
      setIsCurrentlyPlaying(true);
    } else if (!props.playing && currentlyPlaying) {
      // Transition from playing to not playing
      pause();
      stopEndTimeMonitoring();
      setIsCurrentlyPlaying(false);
    }
  });

  // Reset when song changes
  createEffect(
    on(
      () => props.song,
      () => {
        setAudioReady(false);
        setVideoReady(false);
        setVideoError(false);
        setHasInitialized(false);
        setIsCurrentlyPlaying(false);
        clearTimeout(fadeOutTimeout);
        
        // Reset gain node to normal volume
        if (currentGainNode) {
          const volume = props.volume ?? 1;
          const adjustment = calculateReplayGainAdjustment(props.song.replayGainTrackGain, props.song.replayGainTrackPeak);
          currentGainNode.gain.cancelScheduledValues(audioContext.currentTime);
          currentGainNode.gain.setValueAtTime(volume * adjustment, audioContext.currentTime);
        }
      }
    )
  );

  // Handle ready state notifications
  createEffect(() => {
    if (isReady() && !hasInitialized()) {
      setHasInitialized(true);
      props.onCanPlayThrough?.();
    }
  });

  const syncVideoToAudio = async (audio: HTMLAudioElement, video: HTMLVideoElement) => {
    const videoGap = (props.song.videoGap ?? 0) / 1000; // Convert milliseconds to seconds
    const expectedVideoTime = audio.currentTime + videoGap;
    const gap = video.currentTime - expectedVideoTime;

    // Check if we can start both elements immediately
    if (Math.abs(gap) <= 0.01 || expectedVideoTime >= 0) {
      // Either already in sync or video can start from a valid position
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

  // Resync video to audio when window regains focus
  const resyncOnFocus = () => {
    const audio = audioElement();
    const video = videoElement();

    // Only resync if we have both elements and are currently playing
    if (!audio || !video || !isCurrentlyPlaying()) return;

    try {
      const videoGap = (props.song.videoGap ?? 0) / 1000; // Convert milliseconds to seconds
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

    console.error("Failed to play audio:", errorMessage);
    props.onError?.();
  };

  createRefContent(
    () => props.ref,
    () => ({
      getCurrentTime: () => {
        // Return preserved time during track switching to prevent visual jumps
        const preserved = preservedTime();
        if (preserved !== undefined) return preserved;

        const audio = audioElement();
        const video = videoElement();

        return audio?.currentTime ?? video?.currentTime ?? 0;
      },
      getDuration: () => {
        const audio = audioElement();
        const video = videoElement();
        return audio?.duration ?? video?.duration ?? 0;
      },
      setCurrentTime: (time: number) => {
        // If we're switching tracks, update preserved time too
        if (preservedTime() !== undefined) {
          setPreservedTime(time);
        }

        const audio = audioElement();
        const video = videoElement();

        if (audio && video) {
          const videoGap = (props.song.videoGap ?? 0) / 1000; // Convert milliseconds to seconds
          audio.currentTime = time;
          video.currentTime = time + videoGap;
        } else if (audio) {
          audio.currentTime = time;
        } else if (video) {
          video.currentTime = time;
        }
      },
    })
  );

  onCleanup(() => {
    pause();
    stopEndTimeMonitoring();
    clearTimeout(fadeOutTimeout);
    audioContext.close();
  });

  return (
    <div
      class="relative h-full w-full bg-black"
      classList={{
        [props.class || ""]: true,
      }}
    >
      <Switch>
        <Match when={!videoError() && props.song.videoUrl}>
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
        <Match when={props.song.backgroundUrl}>
          {(backgroundUrl) => <img alt="" class="h-full w-full object-contain" src={backgroundUrl()} />}
        </Match>
        <Match when={props.song.coverUrl}>
          {(coverUrl) => (
            <div class="relative h-full w-full">
              <img src={coverUrl()} alt="" class="absolute inset-0 h-full w-full object-cover blur-2xl" />
              <img src={coverUrl()} alt="" class="relative h-full w-full object-contain" />
            </div>
          )}
        </Match>
      </Switch>

      <Show when={currentAudioUrl()}>
        {(audioUrl) => (
          <audio
            ref={setAudioElement}
            preload="auto"
            crossorigin="anonymous"
            onCanPlayThrough={handleAudioCanPlayThrough}
            onEnded={handleEnded}
            onError={handleAudioError}
            src={audioUrl()}
          />
        )}
      </Show>
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

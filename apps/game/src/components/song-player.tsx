import { createEffect, createSignal, type JSX, Match, on, onCleanup, type Ref, Show, Switch } from "solid-js";
import { beatToMs } from "~/lib/ultrastar/bpm";
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
  isPreview?: boolean;
}

export default function SongPlayer(props: SongPlayerProps) {
  const [audioElement, setAudioElement] = createSignal<HTMLAudioElement | undefined>();
  const [videoElement, setVideoElement] = createSignal<HTMLVideoElement | undefined>();
  const [audioReady, setAudioReady] = createSignal(false);
  const [videoReady, setVideoReady] = createSignal(false);
  const [videoError, setVideoError] = createSignal(false);
  const [hasInitialized, setHasInitialized] = createSignal(false);
  const [isCurrentlyPlaying, setIsCurrentlyPlaying] = createSignal(false);

  let syncTimeout: ReturnType<typeof setTimeout> | undefined;
  let endCheckInterval: ReturnType<typeof setInterval> | undefined;
  const audioContext = new AudioContext();
  let audioSource: MediaElementAudioSourceNode | undefined;

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

      let currentAudioSource: MediaElementAudioSourceNode | undefined;
      let currentGainNode: GainNode | undefined;

      try {
        currentAudioSource = audioContext.createMediaElementSource(audio);
        currentGainNode = audioContext.createGain();
        currentAudioSource.connect(currentGainNode);
        currentGainNode.connect(audioContext.destination);

        audioSource = currentAudioSource;

        const replayGainAdjustment = props.song.replayGainTrackGain ? 10 ** (props.song.replayGainTrackGain / 20) : 1;
        currentGainNode.gain.value = (props.volume ?? 1) * replayGainAdjustment;

        // Update volume when it changes
        createEffect(() => {
          if (currentGainNode) {
            const volume = props.volume ?? 1;
            currentGainNode.gain.setValueAtTime(volume * replayGainAdjustment, audioContext.currentTime);
          }
        });

        onCleanup(() => {
          try {
            if (currentGainNode) {
              currentGainNode.disconnect();
            }
            if (currentAudioSource) {
              currentAudioSource.disconnect();
            }
          } catch {
            // Ignore disconnection errors during cleanup
          }
          // Clear the global reference if it matches our current source
          if (audioSource === currentAudioSource) {
            audioSource = undefined;
          }
        });
      } catch (error) {
        console.warn("Failed to create audio source:", error);
        // Clean up any partially created nodes if error occurred
        try {
          if (currentGainNode) {
            currentGainNode.disconnect();
          }
          if (currentAudioSource) {
            currentAudioSource.disconnect();
          }
        } catch {
          // Ignore cleanup errors
        }
        audioSource = undefined;
      }
    })
  );

  // Setup volume control for video element
  createEffect(
    on(videoElement, (video) => {
      if (!video) return;

      // Only control volume for video if there's no separate audio element
      if (!props.song.audioUrl) {
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
      audio.currentTime = previewStart;
    }
    if (video && video.currentTime === 0) {
      video.currentTime = previewStart;
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
      if (props.isPreview) {
        setPreviewTime();
      } else if (props.song.start) {
        if (audio && audio.currentTime === 0) {
          audio.currentTime = props.song.start;
        }
        if (video && video.currentTime === 0) {
          video.currentTime = props.song.start;
        }
      }

      if (audio && video) {
        // Sync both audio and video with proper videoGap handling
        const videoGap = props.song.videoGap ?? 0;
        const gap = video.currentTime - audio.currentTime - videoGap;

        if (Math.abs(gap) > 0.01) {
          if (gap > 0) {
            // Video is ahead, try to advance audio
            const newAudioTime = audio.currentTime + gap;
            if (newAudioTime >= 0 && newAudioTime <= audio.duration) {
              audio.currentTime = newAudioTime;
              await Promise.all([audio.play(), video.play()]);
            } else {
              // Can't sync by adjusting audio time, use timeout
              await audio.play();
              syncTimeout = setTimeout(async () => {
                try {
                  await video.play();
                } catch (error) {
                  console.warn("Failed to start video playback:", error);
                }
              }, gap * 1000);
            }
          } else {
            // Audio is ahead, try to advance video
            const newVideoTime = video.currentTime + Math.abs(gap);
            if (newVideoTime >= 0 && newVideoTime <= video.duration) {
              video.currentTime = newVideoTime;
              await Promise.all([audio.play(), video.play()]);
            } else {
              // Can't sync by adjusting video time, use timeout
              await video.play();
              syncTimeout = setTimeout(
                async () => {
                  try {
                    await audio.play();
                  } catch (error) {
                    console.warn("Failed to start audio playback:", error);
                  }
                },
                Math.abs(gap) * 1000
              );
            }
          }
        } else {
          // Elements are already in sync
          await Promise.all([audio.play(), video.play()]);
        }
      } else if (audio) {
        await audio.play();
      } else if (video) {
        await video.play();
      }
    } catch (error) {
      console.warn("Failed to start playback:", error);
    }
  };

  // Stop playback
  const pause = () => {
    audioElement()?.pause();
    videoElement()?.pause();
    clearTimeout(syncTimeout);
    clearInterval(endCheckInterval);
  };

  const checkForSongEnd = () => {
    if (!props.song.end) return;

    const audio = audioElement();
    const video = videoElement();
    const rawCurrentTime = audio?.currentTime ?? video?.currentTime ?? 0;
    const endTimeInSeconds = props.song.end / 1000; // Convert milliseconds to seconds

    if (rawCurrentTime >= endTimeInSeconds) {
      pause();
      handleEnded();
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

  const handleEnded = () => {
    props.onEnded?.();
  };

  const handleAudioCanPlayThrough = () => {
    setAudioReady(true);
  };

  const handleVideoCanPlayThrough = () => {
    setVideoReady(true);
  };

  const handleVideoError: JSX.EventHandler<HTMLVideoElement, Event> = (error) => {
    setVideoError(true);
    setVideoElement(undefined);
    if (!props.song.audioUrl) {
      console.error("Failed to play video:", error);
      props.onError?.();
    } else {
      console.warn("Failed to play video:", error);
    }
  };

  const handleAudioError: JSX.EventHandler<HTMLAudioElement, Event> = (error) => {
    console.error("Failed to play audio:", error);
    props.onError?.();
  };

  createRefContent(
    () => props.ref,
    () => ({
      getCurrentTime: () => {
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
        const audio = audioElement();
        const video = videoElement();

        if (audio && video) {
          const videoGap = props.song.videoGap ?? 0;
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
              muted={!!props.song.audioUrl}
              class="h-full w-full object-cover"
              ref={setVideoElement}
              preload="auto"
              crossorigin="anonymous"
              onCanPlayThrough={handleVideoCanPlayThrough}
              onEnded={!props.song.audioUrl ? handleEnded : undefined}
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

      <Show when={props.song.audioUrl}>
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
  if (song.previewStart !== null) {
    return Math.max(0, song.previewStart);
  }

  const firstNote = song.voices[0]?.phrases[0]?.notes[0];
  if (!firstNote) {
    return 0;
  }

  const previewGap = videoGap < 0 ? videoGap : 0;
  return Math.max(0, beatToMs(song, firstNote.startBeat) / 1000 - 2 + previewGap);
};

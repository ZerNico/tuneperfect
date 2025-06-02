import { Match, type Ref, Show, Switch, createEffect, createSignal, on, onCleanup } from "solid-js";
import { beatToMs } from "~/lib/ultrastar/bpm";
import type { LocalSong } from "~/lib/ultrastar/parser/local";
import { createRefContent } from "~/lib/utils/ref";

export interface SongPlayerRef {
  getCurrentTime: () => number;
  getDuration: () => number;
}

interface SongPlayerProps {
  ref?: Ref<SongPlayerRef>;
  song: LocalSong;
  volume?: number;
  playing?: boolean;
  class?: string;
  onCanPlayThrough?: () => void;
  onEnded?: () => void;
  isPreview?: boolean;
}

export default function SongPlayer(props: SongPlayerProps) {
  const [audioElement, setAudioElement] = createSignal<HTMLAudioElement | undefined>();
  const [videoElement, setVideoElement] = createSignal<HTMLVideoElement | undefined>();
  const [audioReady, setAudioReady] = createSignal(false);
  const [videoReady, setVideoReady] = createSignal(false);
  const [videoError, setVideoError] = createSignal(false);
  const [hasInitialized, setHasInitialized] = createSignal(false);
  const [wasPaused, setWasPaused] = createSignal(false);
  const [isCurrentlyPlaying, setIsCurrentlyPlaying] = createSignal(false);

  let syncTimeout: ReturnType<typeof setTimeout> | undefined = undefined;
  let endCheckInterval: ReturnType<typeof setInterval> | undefined = undefined;
  const audioContext = new AudioContext();
  let audioSource: MediaElementAudioSourceNode | undefined = undefined;
  let videoSource: MediaElementAudioSourceNode | undefined = undefined;

  // Setup audio context for audio element
  createEffect(
    on(audioElement, (audio, prevAudio) => {
      // Clean up previous source if it exists
      if (audioSource && prevAudio) {
        try {
          audioSource.disconnect();
        } catch (e) {
          // Ignore disconnection errors
        }
        audioSource = undefined;
      }

      if (!audio) return;

      try {
        audioSource = audioContext.createMediaElementSource(audio);
        const gainNode = audioContext.createGain();
        audioSource.connect(gainNode);
        gainNode.connect(audioContext.destination);

        const replayGainAdjustment = props.song.replayGainTrackGain ? 10 ** (props.song.replayGainTrackGain / 20) : 1;
        gainNode.gain.value = (props.volume ?? 1) * replayGainAdjustment;

        // Update volume when it changes
        createEffect(() => {
          const volume = props.volume ?? 1;
          gainNode.gain.setValueAtTime(volume * replayGainAdjustment, audioContext.currentTime);
        });

        onCleanup(() => {
          try {
            gainNode.disconnect();
            if (audioSource) {
              audioSource.disconnect();
            }
          } catch (e) {
            // Ignore disconnection errors during cleanup
          }
        });
      } catch (error) {
        console.warn("Failed to create audio source:", error);
      }
    })
  );

  // Setup audio context for video element
  createEffect(
    on(videoElement, (video, prevVideo) => {
      // Clean up previous source if it exists
      if (videoSource && prevVideo) {
        try {
          videoSource.disconnect();
        } catch (e) {
          // Ignore disconnection errors
        }
        videoSource = undefined;
      }

      if (!video) return;

      try {
        videoSource = audioContext.createMediaElementSource(video);
        const gainNode = audioContext.createGain();
        videoSource.connect(gainNode);
        gainNode.connect(audioContext.destination);

        const replayGainAdjustment = props.song.replayGainTrackGain ? 10 ** (props.song.replayGainTrackGain / 20) : 1;
        gainNode.gain.value = (props.volume ?? 1) * replayGainAdjustment;

        // Update volume when it changes
        createEffect(() => {
          const volume = props.volume ?? 1;
          gainNode.gain.setValueAtTime(volume * replayGainAdjustment, audioContext.currentTime);
        });

        onCleanup(() => {
          try {
            gainNode.disconnect();
            if (videoSource) {
              videoSource.disconnect();
            }
          } catch (e) {
            // Ignore disconnection errors during cleanup
          }
        });
      } catch (error) {
        console.warn("Failed to create video source:", error);
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
      // Only set initial times if we're not resuming from a pause
      if (!wasPaused()) {
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
      }

      if (audio && video) {
        // Only perform sync logic if we're not resuming from a pause
        if (!wasPaused()) {
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
        } else {
          // When resuming from pause, just play both without sync adjustments
          await Promise.all([audio.play(), video.play()]);
        }
      } else if (audio) {
        await audio.play();
      } else if (video) {
        await video.play();
      }

      // Clear the paused state after successful play
      setWasPaused(false);
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
    setWasPaused(true); // Mark that we were paused
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
        setWasPaused(false); // Reset paused state for new song
        setIsCurrentlyPlaying(false); // Reset playing state tracking
        pause();
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

  const handleVideoError = () => {
    setVideoError(true);
    setVideoElement(undefined);
  };

  // Ref implementation
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
            src={audioUrl()}
          />
        )}
      </Show>
    </div>
  );
}

const getPreviewStartTime = (song: LocalSong, videoGap: number): number => {
  if (song.previewStart !== undefined) {
    return Math.max(0, song.previewStart);
  }

  const firstNote = song.voices[0]?.phrases[0]?.notes[0];
  if (!firstNote) {
    return 0;
  }

  const previewGap = videoGap < 0 ? videoGap : 0;
  return Math.max(0, beatToMs(song, firstNote.startBeat) / 1000 - 2 + previewGap);
};

import { createEffect, createSignal, on, onCleanup, onMount, type Ref } from "solid-js";

import type { SongPlayerRef } from "~/components/song-player";
import { createRefContent } from "~/lib/utils/ref";

declare global {
  interface Window {
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface OnlineSongPlayerProps {
  ref?: Ref<SongPlayerRef>;
  audioYoutubeId: string | null;
  videoYoutubeId?: string | null;
  playing?: boolean;
  volume?: number;
  class?: string;
  onCanPlayThrough?: () => void;
  onEnded?: () => void;
  onError?: () => void;
}

let ytApiLoaded = false;
let ytApiLoading = false;
const ytApiCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
  if (ytApiLoaded) return Promise.resolve();

  return new Promise((resolve) => {
    if (ytApiLoading) {
      ytApiCallbacks.push(resolve);
      return;
    }

    ytApiLoading = true;
    ytApiCallbacks.push(resolve);

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      ytApiLoaded = true;
      ytApiLoading = false;
      for (const cb of ytApiCallbacks) cb();
      ytApiCallbacks.length = 0;
    };
  });
}

function createYTPlayer(
  container: HTMLElement,
  videoId: string,
  opts?: { muted?: boolean },
): Promise<YT.Player> {
  return new Promise((resolve, reject) => {
    const div = document.createElement("div");
    container.appendChild(div);

    const timeout = setTimeout(() => reject(new Error("YouTube player timed out")), 15000);

    new window.YT.Player(div, {
      videoId,
      host: "https://www.youtube-nocookie.com",
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        iv_load_policy: 3,
        playsinline: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: (event: YT.PlayerEvent) => {
          clearTimeout(timeout);
          if (opts?.muted) {
            event.target.mute();
          }
          resolve(event.target);
        },
        onError: () => {
          clearTimeout(timeout);
          reject(new Error("YouTube player error"));
        },
      },
    });
  });
}

export default function OnlineSongPlayer(props: OnlineSongPlayerProps) {
  let containerRef!: HTMLDivElement;
  let audioPlayer: YT.Player | null = null;
  let videoPlayer: YT.Player | null = null;
  let hasSeparateVideo = false;

  // Time interpolation: YouTube's getCurrentTime() only updates ~4x/sec,
  // so we interpolate between updates using performance.now() for smooth timing.
  let lastYTTime = 0;
  let lastLocalTs = 0;
  let isPlaying = false;
  let pollInterval: ReturnType<typeof setInterval> | undefined;
  let duration = 0;

  const [ready, setReady] = createSignal(false);

  const startPolling = () => {
    stopPolling();
    pollInterval = setInterval(() => {
      if (!audioPlayer || !isPlaying) return;
      try {
        const t = audioPlayer.getCurrentTime();
        if (t !== lastYTTime) {
          lastYTTime = t;
          lastLocalTs = performance.now();
        }
      } catch {
        // Player may not be ready
      }
    }, 100);
  };

  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = undefined;
    }
  };

  const getInterpolatedTime = (): number => {
    if (!isPlaying) return lastYTTime;
    const elapsedSec = (performance.now() - lastLocalTs) / 1000;
    return lastYTTime + elapsedSec;
  };

  const syncVideoToAudio = () => {
    if (!audioPlayer || !videoPlayer || !hasSeparateVideo) return;
    try {
      const audioTime = audioPlayer.getCurrentTime();
      const videoTime = videoPlayer.getCurrentTime();
      if (Math.abs(audioTime - videoTime) > 1) {
        videoPlayer.seekTo(audioTime, true);
      }
    } catch {
      // Ignore
    }
  };

  onMount(async () => {
    await loadYouTubeAPI();

    const audioId = props.audioYoutubeId;
    const videoId = props.videoYoutubeId;

    if (!audioId && !videoId) {
      props.onError?.();
      return;
    }

    hasSeparateVideo = !!(audioId && videoId && audioId !== videoId);

    try {
      if (hasSeparateVideo) {
        // Two players: hidden audio (timing source) + visible muted video
        const audioContainer = document.createElement("div");
        audioContainer.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;opacity:0";
        containerRef.appendChild(audioContainer);

        const [audio, video] = await Promise.all([
          createYTPlayer(audioContainer, audioId!, { muted: false }),
          createYTPlayer(containerRef, videoId!, { muted: true }),
        ]);

        audioPlayer = audio;
        videoPlayer = video;
      } else {
        // Single player: audio-only or same ID for both
        const id = audioId || videoId;
        if (!id) {
          props.onError?.();
          return;
        }
        audioPlayer = await createYTPlayer(containerRef, id);
      }

      duration = audioPlayer?.getDuration() ?? 0;
      setReady(true);
      props.onCanPlayThrough?.();
    } catch (error) {
      console.error("Failed to initialize YouTube player:", error);
      props.onError?.();
    }
  });

  createEffect(
    on(
      () => [props.playing, ready()] as const,
      ([shouldPlay, isReady]) => {
        if (!audioPlayer || !isReady) return;
        try {
          if (shouldPlay) {
            audioPlayer.playVideo();
            videoPlayer?.playVideo();
            isPlaying = true;
            lastYTTime = audioPlayer.getCurrentTime();
            lastLocalTs = performance.now();
            startPolling();
          } else {
            audioPlayer.pauseVideo();
            videoPlayer?.pauseVideo();
            isPlaying = false;
            lastYTTime = audioPlayer.getCurrentTime();
            stopPolling();
          }
        } catch {
          // Ignore
        }
      },
    ),
  );

  // Periodically sync video to audio when both are playing
  createEffect(() => {
    if (!ready() || !hasSeparateVideo) return;

    const syncInterval = setInterval(syncVideoToAudio, 3000);
    onCleanup(() => clearInterval(syncInterval));
  });

  createEffect(() => {
    const volume = props.volume ?? 1;
    if (audioPlayer && ready()) {
      try {
        audioPlayer.setVolume(volume * 100);
      } catch {
        // Ignore
      }
    }
  });

  // Listen for audio ending
  createEffect(() => {
    if (!audioPlayer || !ready()) return;

    const checkEnded = setInterval(() => {
      try {
        if (audioPlayer?.getPlayerState() === window.YT.PlayerState.ENDED) {
          isPlaying = false;
          stopPolling();
          videoPlayer?.pauseVideo();
          props.onEnded?.();
          clearInterval(checkEnded);
        }
      } catch {
        // Ignore
      }
    }, 500);

    onCleanup(() => clearInterval(checkEnded));
  });

  createRefContent(
    () => props.ref,
    () => ({
      getCurrentTime: () => getInterpolatedTime(),
      getDuration: () => {
        if (audioPlayer && ready()) {
          try {
            return audioPlayer.getDuration();
          } catch {
            return duration;
          }
        }
        return duration;
      },
      setCurrentTime: (time: number) => {
        if (audioPlayer && ready()) {
          try {
            audioPlayer.seekTo(time, true);
            videoPlayer?.seekTo(time, true);
            lastYTTime = time;
            lastLocalTs = performance.now();
          } catch {
            // Ignore
          }
        }
      },
    }),
  );

  onCleanup(() => {
    stopPolling();
    try { audioPlayer?.destroy(); } catch { /* Ignore */ }
    try { videoPlayer?.destroy(); } catch { /* Ignore */ }
    audioPlayer = null;
    videoPlayer = null;
  });

  return (
    <div
      ref={containerRef}
      class="h-full w-full bg-black"
      classList={{
        [props.class || ""]: true,
      }}
    />
  );
}

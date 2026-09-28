import { createEffect, createSignal, on, onCleanup, onMount, type Ref } from "solid-js";

import type { SongPlayerRef } from "~/components/song-player";
import { native } from "~/lib/native/client";
import { createRefContent } from "~/lib/utils/ref";

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

interface HostMessage {
  type: string;
  [key: string]: unknown;
}

/** Beyond this the host page has likely stopped answering, so stop extrapolating. */
const MAX_INTERPOLATION_MS = 1000;

/**
 * Remote-controls a YouTube embed that lives inside an HTTP-hosted child frame.
 *
 * The app document is served from `tauri://localhost`. macOS WKWebView will not attach a
 * `Referer` to a cross-origin subframe whose parent uses a non-HTTP scheme, so YouTube
 * rejects the embed with error 153. Serving the embed from the media server gives it an
 * HTTP parent, at the cost of every command crossing a postMessage boundary.
 */
class RemoteYTPlayer {
  private frame: HTMLIFrameElement;
  private origin: string;
  private onMessage: (event: MessageEvent) => void;

  /** Latest values pushed by the host page. */
  time = 0;
  duration = 0;
  state: number | null = null;
  destroyed = false;
  playing = false;

  onEnded?: () => void;

  private failureHandler?: (code: number) => void;
  private pendingFailure: number | null = null;

  /**
   * Fired when the player fails after it was ready (removed, region-blocked, embed disabled).
   *
   * A failure can arrive in the same tick as `ready`, so one that lands before a handler is
   * attached is buffered and replayed on assignment.
   */
  set onFailure(handler: ((code: number) => void) | undefined) {
    this.failureHandler = handler;
    if (handler && this.pendingFailure !== null) {
      const code = this.pendingFailure;
      this.pendingFailure = null;
      handler(code);
    }
  }

  reportFailure(code: number) {
    this.playing = false;
    if (this.failureHandler) {
      this.failureHandler(code);
    } else {
      this.pendingFailure = code;
    }
  }

  /**
   * `performance.now()` when `time` arrived. The host only posts when YouTube's clock actually
   * advances, so pairing the two gives interpolation a correct anchor. Re-sampling this on a
   * separate interval would misattribute the timestamp and make playback drift, then snap back.
   */
  timeReceivedAt = 0;

  /** Interpolated playback position, smooth between the host's ~4Hz updates. */
  currentTime(): number {
    if (!this.playing) return this.time;
    const elapsedMs = performance.now() - this.timeReceivedAt;
    return this.time + Math.min(elapsedMs, MAX_INTERPOLATION_MS) / 1000;
  }

  applyUpdate(data: HostMessage) {
    if (typeof data.time === "number") {
      this.time = data.time;
      this.timeReceivedAt = performance.now();
    }
    if (typeof data.duration === "number" && data.duration > 0) {
      this.duration = data.duration;
    }
  }

  private constructor(frame: HTMLIFrameElement, origin: string, onMessage: (event: MessageEvent) => void) {
    this.frame = frame;
    this.origin = origin;
    this.onMessage = onMessage;
  }

  static create(
    container: HTMLElement,
    baseUrl: string,
    videoId: string,
    opts?: { muted?: boolean },
  ): Promise<RemoteYTPlayer> {
    return new Promise((resolve, reject) => {
      const origin = new URL(baseUrl).origin;
      const frame = document.createElement("iframe");
      frame.allow = "autoplay; encrypted-media";
      frame.style.cssText = "border:none;display:block;width:100%;height:100%";
      // The host page addresses its replies to this origin instead of broadcasting them.
      frame.src = `${baseUrl}/embed/youtube?parentOrigin=${encodeURIComponent(window.location.origin)}`;
      container.appendChild(frame);

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("YouTube player timed out"));
      }, 15000);

      let player: RemoteYTPlayer | null = null;

      const onMessage = (event: MessageEvent) => {
        if (event.source !== frame.contentWindow) return;
        if (event.origin !== origin) return;
        const data = event.data as HostMessage | null;
        if (!data || data.source !== "tp-yt") return;

        switch (data.type) {
          case "boot": {
            frame.contentWindow?.postMessage(
              { source: "tp-host", type: "init", videoId, muted: !!opts?.muted },
              origin,
            );
            break;
          }
          case "ready": {
            clearTimeout(timeout);
            player = new RemoteYTPlayer(frame, origin, onMessage);
            player.duration = (data.duration as number) ?? 0;
            resolve(player);
            break;
          }
          case "error": {
            clearTimeout(timeout);
            if (player) {
              // Already resolved, so the caller owns the player: report instead of rejecting.
              player.reportFailure(data.code as number);
            } else {
              cleanup();
              reject(new Error(`YouTube player error ${data.code} for video ${videoId}`));
            }
            break;
          }
          case "time": {
            if (player) {
              player.applyUpdate(data);
            }
            break;
          }
          case "state": {
            if (player) {
              player.applyUpdate(data);
              player.state = (data.state as number) ?? null;
              // YT.PlayerState.ENDED === 0
              if (player.state === 0) {
                player.playing = false;
                player.onEnded?.();
              }
            }
            break;
          }
        }
      };

      function cleanup() {
        window.removeEventListener("message", onMessage);
        frame.remove();
      }

      window.addEventListener("message", onMessage);
    });
  }

  private send(message: Record<string, unknown>) {
    if (this.destroyed) return;
    this.frame.contentWindow?.postMessage({ source: "tp-host", ...message }, this.origin);
  }

  play() {
    // Re-anchor so interpolation starts now, not from the last update before the pause.
    this.timeReceivedAt = performance.now();
    this.playing = true;
    this.send({ type: "play" });
  }

  pause() {
    // Freeze at the interpolated position; the last raw sample can be ~250ms stale.
    this.time = this.currentTime();
    this.timeReceivedAt = performance.now();
    this.playing = false;
    this.send({ type: "pause" });
  }

  seekTo(time: number) {
    this.time = time;
    this.timeReceivedAt = performance.now();
    this.send({ type: "seek", time });
  }

  setVolume(value: number) {
    this.send({ type: "volume", value });
  }

  destroy() {
    this.send({ type: "destroy" });
    this.destroyed = true;
    this.playing = false;
    window.removeEventListener("message", this.onMessage);
    this.frame.remove();
  }
}

export default function OnlineSongPlayer(props: OnlineSongPlayerProps) {
  let containerRef!: HTMLDivElement;
  let audioPlayer: RemoteYTPlayer | null = null;
  let videoPlayer: RemoteYTPlayer | null = null;
  let hasSeparateVideo = false;

  let duration = 0;

  const [ready, setReady] = createSignal(false);

  const syncVideoToAudio = () => {
    if (!audioPlayer || !videoPlayer || !hasSeparateVideo) return;
    const audioTime = audioPlayer.currentTime();
    if (Math.abs(audioTime - videoPlayer.currentTime()) > 1) {
      videoPlayer.seekTo(audioTime);
    }
  };

  onMount(async () => {
    const audioId = props.audioYoutubeId;
    const videoId = props.videoYoutubeId;

    if (!audioId && !videoId) {
      props.onError?.();
      return;
    }

    hasSeparateVideo = !!(audioId && videoId && audioId !== videoId);

    try {
      const baseUrl = await native.localServer.baseUrl();

      if (!baseUrl) {
        throw new Error("Local server unavailable for YouTube playback");
      }

      if (hasSeparateVideo) {
        // Two players: hidden audio (timing source) + visible muted video
        const audioContainer = document.createElement("div");
        audioContainer.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;opacity:0";
        containerRef.appendChild(audioContainer);

        const [audio, video] = await Promise.all([
          RemoteYTPlayer.create(audioContainer, baseUrl, audioId!, { muted: false }),
          RemoteYTPlayer.create(containerRef, baseUrl, videoId!, { muted: true }),
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
        audioPlayer = await RemoteYTPlayer.create(containerRef, baseUrl, id);
      }

      // Invoked from the message handler, i.e. an event context.
      // oxlint-disable-next-line solid/reactivity
      audioPlayer.onEnded = () => {
        videoPlayer?.pause();
        props.onEnded?.();
      };

      // Surface late failures the same way local songs surface media errors.
      // oxlint-disable-next-line solid/reactivity
      audioPlayer.onFailure = (code) => {
        console.error(`YouTube playback failed with error ${code}`);
        videoPlayer?.pause();
        props.onError?.();
      };

      // The muted video track failing shouldn't kill the round while audio still plays.
      if (videoPlayer) {
        videoPlayer.onFailure = (code) => {
          console.warn(`YouTube video track failed with error ${code}; continuing with audio`);
        };
      }

      duration = audioPlayer.duration;
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
        if (shouldPlay) {
          audioPlayer.play();
          videoPlayer?.play();
        } else {
          audioPlayer.pause();
          videoPlayer?.pause();
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
      audioPlayer.setVolume(volume);
    }
  });

  createRefContent(
    () => props.ref,
    () => ({
      getCurrentTime: () => audioPlayer?.currentTime() ?? 0,
      getDuration: () => {
        if (audioPlayer && ready()) {
          return audioPlayer.duration || duration;
        }
        return duration;
      },
      setCurrentTime: (time: number) => {
        if (audioPlayer && ready()) {
          audioPlayer.seekTo(time);
          videoPlayer?.seekTo(time);
        }
      },
    }),
  );

  onCleanup(() => {
    try {
      audioPlayer?.destroy();
    } catch {
      /* Ignore */
    }
    try {
      videoPlayer?.destroy();
    } catch {
      /* Ignore */
    }
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

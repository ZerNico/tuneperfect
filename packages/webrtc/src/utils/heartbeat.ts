// Detects zombie connections where RTCPeerConnection reports "connected"
// but the data channel is actually dead

import { WEBRTC_CONFIG } from "./config";
import type { HeartbeatOptions } from "./types";

export function createHeartbeat(pingFn: () => Promise<void>, options: HeartbeatOptions = {}) {
  const interval = options.interval ?? WEBRTC_CONFIG.heartbeat.interval;
  const timeout = options.timeout ?? WEBRTC_CONFIG.heartbeat.timeout;
  const onFailure = options.onFailure;

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let isRunning = false;
  let consecutiveFailures = 0;

  const performPing = async () => {
    if (!isRunning) return;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Heartbeat timeout")), timeout);
      });

      await Promise.race([pingFn(), timeoutPromise]);
      consecutiveFailures = 0;
    } catch {
      consecutiveFailures++;

      if (consecutiveFailures >= 1) {
        stop();
        onFailure?.();
      }
    }
  };

  const start = () => {
    if (isRunning) return;

    isRunning = true;
    consecutiveFailures = 0;
    intervalId = setInterval(performPing, interval);
  };

  const stop = () => {
    isRunning = false;

    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  const reset = () => {
    consecutiveFailures = 0;
  };

  return {
    start,
    stop,
    reset,
    get isRunning() {
      return isRunning;
    },
    get failures() {
      return consecutiveFailures;
    },
  };
}

export type Heartbeat = ReturnType<typeof createHeartbeat>;

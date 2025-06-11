import { createEventListener } from "@solid-primitives/event-listener";
import { createSignal, onCleanup } from "solid-js";

export function useWakeLock() {
  const [wakeLock, setWakeLock] = createSignal<WakeLockSentinel | null>(null);
  const [userHasInteracted, setUserHasInteracted] = createSignal(false);

  const requestWakeLock = async () => {
    if (!userHasInteracted()) {
      return;
    }

    try {
      if ("wakeLock" in navigator) {
        const lock = await navigator.wakeLock.request("screen");
        setWakeLock(lock);

        lock.addEventListener("release", () => {
          setWakeLock(null);
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "NotAllowedError") {
        // User interaction required
      } else {
        console.error("Failed to request wake lock:", err);
      }
    }
  };

  const releaseWakeLock = async () => {
    const lock = wakeLock();
    if (lock) {
      try {
        await lock.release();
        setWakeLock(null);
      } catch (err) {
        console.error("Failed to release wake lock:", err);
      }
    }
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      releaseWakeLock();
    } else {
      requestWakeLock();
    }
  };

  const handleUserInteraction = () => {
    if (!userHasInteracted()) {
      setUserHasInteracted(true);
      if (!document.hidden) {
        requestWakeLock();
      }
    }
  };

  onCleanup(() => {
    releaseWakeLock();
  });

  createEventListener(document, "visibilitychange", handleVisibilityChange);

  createEventListener(document, "click", handleUserInteraction, { once: true });
  createEventListener(document, "keydown", handleUserInteraction, { once: true });
  createEventListener(document, "touchstart", handleUserInteraction, { once: true });

  return {
    wakeLock,
    userHasInteracted,
    requestWakeLock,
    releaseWakeLock,
  };
}

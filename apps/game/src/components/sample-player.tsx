import { createEffect, on, onCleanup } from "solid-js";

/** Fade in when a sample starts, out when it's deselected. */
const FADE_MS = 300;

interface SamplePlayerProps {
  url: string | null;
  playing: boolean;
  /** 0–1, before the fade. */
  volume: number;
}

/**
 * Plays a short audio sample, fading it in and out, once through. Renders nothing: the
 * audio element doesn't need to be in the document.
 *
 * Volume goes straight to the element rather than through Web Audio, so the sample needs no
 * CORS and the element can be dropped without leaking a media source node.
 */
export default function SamplePlayer(props: SamplePlayerProps) {
  const audio = new Audio();
  audio.preload = "auto";
  // Dead links are routine in the catalog; the main process logs why a sample was refused.
  audio.addEventListener("error", () => console.debug("Sample failed to load:", audio.error?.message));

  let fade = 0;
  let frame: number | undefined;

  const applyVolume = () => {
    audio.volume = Math.min(1, Math.max(0, props.volume * fade));
  };

  const rampTo = (target: number, then?: () => void) => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    const from = fade;
    const start = performance.now();
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / FADE_MS);
      fade = from + (target - from) * progress;
      applyVolume();
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      } else {
        frame = undefined;
        then?.();
      }
    };
    frame = requestAnimationFrame(step);
  };

  const unload = () => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    fade = 0;
    audio.pause();
    // Clearing the source ends the request, which closes the upstream connection.
    audio.removeAttribute("src");
    audio.load();
  };

  createEffect(
    on(
      () => props.url,
      (url) => {
        unload();
        if (url) audio.src = url;
      },
    ),
  );

  createEffect(
    on(
      () => props.playing && !!props.url,
      (playing) => {
        if (playing) {
          fade = 0;
          applyVolume();
          // Resolves once audio is flowing, so the fade starts with the sound.
          audio.play().then(
            () => rampTo(1),
            // A newer source or a pause got in first.
            () => {},
          );
        } else if (!audio.paused) {
          rampTo(0, () => audio.pause());
        }
      },
    ),
  );

  createEffect(on(() => props.volume, applyVolume));

  onCleanup(unload);

  return null;
}

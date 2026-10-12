import { createEffect, on, onCleanup } from "solid-js";

import { getAudioContext } from "~/lib/audio/context";
import { normalizationGain } from "~/lib/audio/loudness";
import { createLoudnessMeter } from "~/lib/audio/loudness-meter";

/** Fade in when a sample starts, out when it's deselected. */
const FADE_S = 0.3;
/**
 * Where an unmeasured sample starts: the median ReplayGain of songs downloaded from USDB,
 * whose samples are mastered just as loud.
 */
const DEFAULT_GAIN = 10 ** (-8 / 20);
const BLOCK_MS = 100;
/** Measured long enough to correct the starting gain (2 s)… */
const FIRST_ESTIMATE_BLOCKS = 20;
/** …and to settle on it (6 s). */
const FINAL_BLOCKS = 60;
/** Glides to a new estimate instead of jumping, so the correction is hard to hear. */
const GLIDE_TIME_CONSTANT_S = 0.6;

/** Gains measured this session, by sample URL, so a revisited sample starts right away. */
const measuredGains = new Map<string, number>();

interface SamplePlayerProps {
  url: string | null;
  playing: boolean;
  /** 0–1. */
  volume: number;
}

/**
 * Plays a short audio sample once through, fading it in and out. Renders nothing: the audio
 * element doesn't need to be in the document.
 *
 * Samples are normalized like the local songs' ReplayGain, but measured while they stream:
 * the sample starts at a typical gain, and glides to its own once a few seconds are measured.
 */
export default function SamplePlayer(props: SamplePlayerProps) {
  const context = getAudioContext();
  const audio = new Audio();
  audio.preload = "auto";
  // Web Audio only hears cross-origin media loaded with CORS; `media://` allows the app.
  audio.crossOrigin = "anonymous";
  // Dead links are routine in the catalog; the main process logs why a sample was refused.
  audio.addEventListener("error", () => console.debug("Sample failed to load:", audio.error?.message));

  const source = context.createMediaElementSource(audio);
  const normalization = new GainNode(context, { gain: DEFAULT_GAIN });
  const fade = new GainNode(context, { gain: 0 });
  // Set by the volume effect below.
  const volume = new GainNode(context, { gain: 0 });
  source.connect(normalization).connect(fade).connect(volume).connect(context.destination);
  // Measures before any gain, so neither the fades nor the volume setting skew it.
  const meter = createLoudnessMeter(context, source);

  let measuring: ReturnType<typeof setInterval> | undefined;
  let fadeDone: ReturnType<typeof setTimeout> | undefined;

  const stopMeasuring = () => {
    clearInterval(measuring);
    measuring = undefined;
  };

  const measure = (url: string) => {
    stopMeasuring();
    if (measuredGains.has(url)) return;
    meter.reset();
    measuring = setInterval(() => {
      if (audio.paused) return;
      meter.sample();
      // Re-estimated every half second until it settles.
      if (meter.blocks < FIRST_ESTIMATE_BLOCKS || meter.blocks % 5 !== 0) return;
      const lufs = meter.loudness();
      if (lufs === null) return;

      const gain = normalizationGain(lufs);
      normalization.gain.setTargetAtTime(gain, context.currentTime, GLIDE_TIME_CONSTANT_S);
      if (meter.blocks >= FINAL_BLOCKS) {
        measuredGains.set(url, gain);
        stopMeasuring();
      }
    }, BLOCK_MS);
  };

  const fadeTo = (target: number, then?: () => void) => {
    const now = context.currentTime;
    fade.gain.cancelScheduledValues(now);
    fade.gain.setValueAtTime(fade.gain.value, now);
    fade.gain.linearRampToValueAtTime(target, now + FADE_S);
    clearTimeout(fadeDone);
    if (then) fadeDone = setTimeout(then, FADE_S * 1000);
  };

  const unload = () => {
    clearTimeout(fadeDone);
    stopMeasuring();
    fade.gain.cancelScheduledValues(context.currentTime);
    fade.gain.value = 0;
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
        if (!url) return;
        normalization.gain.cancelScheduledValues(context.currentTime);
        normalization.gain.value = measuredGains.get(url) ?? DEFAULT_GAIN;
        audio.src = url;
      },
    ),
  );

  createEffect(
    on(
      () => (props.playing ? props.url : null),
      (url) => {
        if (url) {
          // Resolves once audio is flowing, so the fade starts with the sound.
          audio.play().then(
            () => {
              fadeTo(1);
              measure(url);
            },
            // A newer source or a pause got in first.
            () => {},
          );
        } else if (!audio.paused) {
          fadeTo(0, () => audio.pause());
        }
      },
    ),
  );

  createEffect(
    on(
      () => props.volume,
      (value) => volume.gain.setTargetAtTime(value, context.currentTime, 0.02),
    ),
  );

  onCleanup(() => {
    unload();
    meter.dispose();
    for (const node of [source, normalization, fade, volume]) node.disconnect();
  });

  return null;
}

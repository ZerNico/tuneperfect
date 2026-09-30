import { debounce } from "@solid-primitives/scheduled";
import { createEffect, createSignal, on, onCleanup } from "solid-js";

import { t } from "~/lib/i18n";
import { native } from "~/lib/native/client";
import { timeCall } from "~/lib/perf";

interface MicLevelMeterProps {
  /** Stable device ID. Preferred over `name` for selecting the device. */
  deviceId: () => string | undefined;
  name: () => string | null;
  channel: () => number;
  gain: () => number;
  threshold: () => number;
}

export default function MicLevelMeter(props: MicLevelMeterProps) {
  const [level, setLevel] = createSignal(0);
  const [active, setActive] = createSignal(false);

  let restarting = false;
  // A device/channel/gain change while a start is in flight: run start once more afterwards so it isn't dropped.
  let pendingRestart = false;
  // Set on unmount: an in-flight start must not leave the microphone recording.
  let disposed = false;

  const startPreview = async () => {
    if (disposed) return;
    if (restarting) {
      pendingRestart = true;
      return;
    }
    restarting = true;

    try {
      const name = props.name();
      if (!name) return;

      // Prefer the stable device id; the backend falls back to name matching
      // when no id is set (and name is always sent for that fallback).
      const deviceId = props.deviceId();

      await native.recording.stop().catch(() => {});
      if (disposed) return;

      const started = await native.recording
        .start({
          microphones: [{ deviceId, name, channel: props.channel(), gain: props.gain(), threshold: 0, delay: 0 }],
          playbackEnabled: false,
          playbackVolume: 0,
        })
        .then(
          () => true,
          () => false,
        );

      if (disposed) {
        if (started) await native.recording.stop().catch(() => {});
        return;
      }

      if (started) {
        setActive(true);
      }
    } finally {
      restarting = false;
      if (pendingRestart && !disposed) {
        pendingRestart = false;
        void startPreview();
      }
    }
  };

  // oxlint-disable-next-line solid/reactivity
  const debouncedRestart = debounce(startPreview, 300);

  const stopPreview = async () => {
    debouncedRestart.clear();
    setActive(false);
    setLevel(0);
    await native.recording.stop().catch(() => {});
  };

  // Restart the recording stream when device or channel changes
  createEffect(
    on([() => props.deviceId(), () => props.name(), () => props.channel()], () => {
      debouncedRestart();
    }),
  );

  // Gain is baked into the audio processor, so we need to restart for it too
  createEffect(
    on(
      () => props.gain(),
      () => {
        if (active()) {
          debouncedRestart();
        }
      },
      { defer: true },
    ),
  );

  // dB scale so quiet sounds are still visible and loud ones don't just max out
  const ampToMeter = (amp: number): number => {
    if (amp <= 0) return 0;
    const db = 20 * Math.log10(amp);
    const minDb = -60;
    return Math.max(0, Math.min(1, (db - minDb) / -minDb));
  };

  // Smooth out the meter — jumps up instantly but falls off gradually
  let peakHold = 0;
  const decay = 0.85;

  createEffect(() => {
    if (!active()) return;

    const interval = setInterval(async () => {
      const levels = await timeCall("getAudioLevels", () => native.pitch.levels()).catch(() => []);
      const value = levels[0];
      if (value !== undefined) {
        const meter = ampToMeter(value);
        peakHold = meter >= peakHold ? meter : peakHold * decay;
        setLevel(peakHold);
      }
    }, 50);

    onCleanup(() => clearInterval(interval));
  });

  onCleanup(() => {
    disposed = true;
    pendingRestart = false;
    stopPreview();
  });

  const percentage = () => level() * 100;

  // Matches the peak check in Rust's above_noise_threshold exactly
  const thresholdPercentage = () => ampToMeter(props.threshold() / 100) * 100;

  return (
    <div class="grid h-16 items-center overflow-hidden rounded-[0.8cqw]">
      <div class="z-2 col-start-1 row-start-1 grid w-full grid-cols-[2fr_3fr] items-center gap-8 px-10">
        <div class="truncate text-xl font-bold">{t("settings.sections.microphones.level")}</div>
        <div class="flex items-center gap-8">
          <div class="relative grid h-3 grow items-center overflow-hidden rounded-full">
            <div class="col-start-1 row-start-1 h-full w-full rounded-full bg-black/20" />
            <div
              class="col-start-1 row-start-1 h-full w-full transition-[clip-path] duration-75"
              style={{
                background:
                  "linear-gradient(to right, #155e75 0%, #10b981 50%, #10b981 75%, #fbbf24 90%, #ef4444 100%)",
                "clip-path": `inset(0 ${100 - percentage()}% 0 0)`,
              }}
            />
            <div
              class="z-1 col-start-1 row-start-1 h-full w-0.5 bg-white/50"
              style={{ "margin-left": `${thresholdPercentage()}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

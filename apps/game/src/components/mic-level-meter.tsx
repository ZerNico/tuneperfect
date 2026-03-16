import { debounce } from "@solid-primitives/scheduled";
import { createEffect, createSignal, on, onCleanup } from "solid-js";
import { commands } from "~/bindings";
import { t } from "~/lib/i18n";

interface MicLevelMeterProps {
  name: () => string | null;
  channel: () => number;
  gain: () => number;
  threshold: () => number;
}

export default function MicLevelMeter(props: MicLevelMeterProps) {
  const [level, setLevel] = createSignal(0);
  const [active, setActive] = createSignal(false);

  let restarting = false;

  const startPreview = async () => {
    if (restarting) return;
    restarting = true;

    try {
      const name = props.name();
      if (!name) return;

      // Stop any existing recording first
      await commands.stopRecording().catch(() => {});

      const result = await commands.startRecording(
        [{ name, channel: props.channel(), gain: props.gain(), threshold: 0 }],
        2048,
        false,
        0,
      );

      if (result.status === "ok") {
        setActive(true);
      }
    } finally {
      restarting = false;
    }
  };

  const debouncedRestart = debounce(() => startPreview(), 300);

  const stopPreview = async () => {
    debouncedRestart.clear();
    setActive(false);
    setLevel(0);
    await commands.stopRecording().catch(() => {});
  };

  // Start/restart recording when mic name or channel changes (debounced)
  createEffect(
    on([() => props.name(), () => props.channel()], () => {
      debouncedRestart();
    }),
  );

  // Restart recording when gain changes so the processor uses the new gain (debounced)
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

  // Convert linear RMS (0–1) to a 0–1 meter value using a dB scale.
  // Maps -60 dB .. 0 dB  →  0 .. 1, which matches human loudness perception
  // and makes the meter responsive across quiet and loud signals.
  const rmsToMeter = (rms: number): number => {
    if (rms <= 0) return 0;
    const db = 20 * Math.log10(rms);
    const minDb = -60;
    return Math.max(0, Math.min(1, (db - minDb) / -minDb));
  };

  // Poll audio levels while active
  createEffect(() => {
    if (!active()) return;

    const interval = setInterval(async () => {
      const result = await commands.getAudioLevels();
      const value = result.status === "ok" ? result.data[0] : undefined;
      if (value !== undefined) {
        setLevel(rmsToMeter(value));
      }
    }, 50);

    onCleanup(() => clearInterval(interval));
  });

  // Clean up on unmount
  onCleanup(() => {
    stopPreview();
  });

  const percentage = () => level() * 100;
  const thresholdPercentage = () => {
    // The threshold is compared as threshold/100 against peak samples in Rust,
    // which is close to RMS for sustained sounds. Map it through the same dB scale.
    return rmsToMeter(props.threshold() / 100) * 100;
  };

  return (
    <div class="grid h-16 items-center overflow-hidden rounded-lg">
      <div class="z-2 col-start-1 row-start-1 mx-auto grid w-full max-w-320 grid-cols-[1fr_3fr] items-center">
        <div class="text-center font-bold text-xl">{t("settings.sections.microphones.level")}</div>
        <div class="flex items-center gap-8">
          <div class="relative grid h-5 grow items-center overflow-hidden rounded-md">
            <div class="col-start-1 row-start-1 h-full w-full rounded-md bg-black/20" />
            {/* Gradient bar clipped to current level */}
            <div
              class="col-start-1 row-start-1 h-full w-full transition-[clip-path] duration-75"
              style={{
                background: "linear-gradient(to right, #155e75 0%, #10b981 50%, #10b981 75%, #fbbf24 90%, #ef4444 100%)",
                "clip-path": `inset(0 ${100 - percentage()}% 0 0)`,
              }}
            />
            {/* Threshold marker */}
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

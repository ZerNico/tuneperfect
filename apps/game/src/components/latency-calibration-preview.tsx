import { createSignal, onCleanup, Show } from "solid-js";

import { useNavigation } from "~/hooks/navigation";
import { getAudioContext } from "~/lib/audio/context";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";

interface LatencyCalibrationPreviewProps {
  outputLatency: () => number;
  selected: () => boolean;
  gradient: () => string;
  layer?: number;
}

const TICK_INTERVAL_SEC = 1;
const TICK_FREQUENCY_HZ = 1000;
const TICK_DURATION_SEC = 0.05;
const PULSE_DECAY_MS = 120;
const SCHEDULE_LOOKAHEAD_SEC = 0.3;
const SCHEDULER_TICK_MS = 100;

export default function LatencyCalibrationPreview(props: LatencyCalibrationPreviewProps) {
  const [enabled, setEnabled] = createSignal(false);
  const [pulsing, setPulsing] = createSignal(false);
  const [pressed, setPressed] = createSignal(false);

  let schedulerInterval: ReturnType<typeof setInterval> | undefined;
  let nextTickTime = 0;
  const pendingVisualTimeouts = new Set<ReturnType<typeof setTimeout>>();
  const pendingPulseDecays = new Set<ReturnType<typeof setTimeout>>();
  const liveOscillators = new Set<OscillatorNode>();

  const scheduleVisualPulse = (delayMs: number) => {
    if (delayMs < 0) delayMs = 0;
    const timeout = setTimeout(() => {
      pendingVisualTimeouts.delete(timeout);
      setPulsing(true);
      const decayTimeout = setTimeout(() => {
        pendingPulseDecays.delete(decayTimeout);
        setPulsing(false);
      }, PULSE_DECAY_MS);
      pendingPulseDecays.add(decayTimeout);
    }, delayMs);
    pendingVisualTimeouts.add(timeout);
  };

  const scheduleTick = (audioCtx: AudioContext, when: number) => {
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = TICK_FREQUENCY_HZ;

    const envelope = audioCtx.createGain();
    envelope.gain.setValueAtTime(0, when);
    envelope.gain.linearRampToValueAtTime(0.4, when + 0.001);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + TICK_DURATION_SEC);

    osc.connect(envelope);
    envelope.connect(audioCtx.destination);
    osc.start(when);
    osc.stop(when + TICK_DURATION_SEC);

    liveOscillators.add(osc);
    osc.addEventListener("ended", () => {
      liveOscillators.delete(osc);
      try {
        osc.disconnect();
        envelope.disconnect();
      } catch {
        // Ignore — nodes may already be disconnected.
      }
    });

    const delayMs = (when - audioCtx.currentTime) * 1000 + props.outputLatency();
    scheduleVisualPulse(delayMs);
  };

  const stopMetronome = () => {
    if (schedulerInterval !== undefined) {
      clearInterval(schedulerInterval);
      schedulerInterval = undefined;
    }
    for (const timeout of pendingVisualTimeouts) clearTimeout(timeout);
    pendingVisualTimeouts.clear();
    for (const timeout of pendingPulseDecays) clearTimeout(timeout);
    pendingPulseDecays.clear();
    for (const osc of liveOscillators) {
      try {
        osc.stop();
      } catch {
        // Already stopped.
      }
    }
    liveOscillators.clear();
    setPulsing(false);
  };

  const startMetronome = () => {
    const audioCtx = getAudioContext();
    nextTickTime = audioCtx.currentTime + 0.1;

    const runScheduler = () => {
      while (nextTickTime < audioCtx.currentTime + SCHEDULE_LOOKAHEAD_SEC) {
        scheduleTick(audioCtx, nextTickTime);
        nextTickTime += TICK_INTERVAL_SEC;
      }
    };

    runScheduler();
    schedulerInterval = setInterval(runScheduler, SCHEDULER_TICK_MS);
  };

  const toggle = () => {
    if (enabled()) {
      stopMetronome();
      setEnabled(false);
    } else {
      setEnabled(true);
      startMetronome();
    }
    playSound("confirm");
  };

  useNavigation(() => ({
    layer: props.layer,
    enabled: props.selected(),
    onKeydown(event) {
      if (event.action === "confirm") {
        setPressed(true);
      }
    },
    onKeyup(event) {
      if (event.action === "confirm") {
        setPressed(false);
        if (props.selected()) {
          toggle();
        }
      }
    },
  }));

  onCleanup(() => {
    stopMetronome();
  });

  const active = () => pressed() && props.selected();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={
        enabled()
          ? t("settings.sections.general.outputLatencyPreviewStop")
          : t("settings.sections.general.outputLatencyPreviewStart")
      }
      class="grid h-16 w-full cursor-pointer items-center overflow-hidden rounded-lg transition-all ease-in-out active:scale-95"
      classList={{
        "scale-95": active(),
      }}
    >
      <div
        class="col-start-1 row-start-1 h-full w-full bg-linear-to-r transition-opacity"
        classList={{
          [props.gradient()]: true,
          "opacity-0": !props.selected(),
        }}
      />
      <div class="z-2 col-start-1 row-start-1 mx-auto grid w-full max-w-320 grid-cols-[1fr_3fr] items-center">
        <div class="text-center text-xl font-bold">
          <Show when={enabled()} fallback={t("settings.sections.general.outputLatencyPreviewStart")}>
            {t("settings.sections.general.outputLatencyPreviewStop")}
          </Show>
        </div>
        <div class="flex items-center justify-center gap-4">
          <div
            class="h-6 w-6 rounded-full bg-white transition-[opacity,transform] duration-100 ease-out"
            style={{
              opacity: pulsing() ? 1 : 0.2,
              transform: pulsing() ? "scale(1.4)" : "scale(1)",
            }}
          />
        </div>
      </div>
    </button>
  );
}

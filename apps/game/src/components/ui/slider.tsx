import { createSignal, type JSX, type Ref, Show } from "solid-js";
import IconCaretLeft from "~icons/ph/caret-left-fill";
import IconCaretRight from "~icons/ph/caret-right-fill";

import { useNavigation } from "~/hooks/navigation";
import { clamp } from "~/lib/utils/math";

import MenuRow from "./menu-row";

interface SliderProps {
  selected?: boolean;
  gradient?: string;
  class?: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onInput?: (value: number) => void;
  onMouseEnter?: () => void;
  layer?: number;
  ref?: Ref<HTMLDivElement>;
  renderValue?: (value: number) => JSX.Element;
}

export default function Slider(props: SliderProps) {
  const getDecimalPlaces = (step: number) => {
    const stepStr = step.toString();
    const decimal = stepStr.indexOf(".");
    return decimal === -1 ? 0 : stepStr.length - decimal - 1;
  };

  // Arrow-key steps glide; a mouse drag follows the cursor directly, or the handle trails behind it.
  const [dragging, setDragging] = createSignal(false);
  const startDrag = () => {
    setDragging(true);
    window.addEventListener("pointerup", () => setDragging(false), { once: true });
  };

  const toPercent = (value: number) => ((value - props.min) / (props.max - props.min)) * 100;
  const percentage = () => toPercent(props.value);
  /** Ranges around 0 (e.g. latency) fill out from 0, so 0 reads as empty rather than half full. */
  const bipolar = () => props.min < 0 && props.max > 0;
  const fill = () => {
    if (!bipolar()) return { left: 0, width: percentage() };
    const zero = toPercent(0);
    return { left: Math.min(zero, percentage()), width: Math.abs(percentage() - zero) };
  };

  const changeValue = (direction: "right" | "left", amount: number = props.step) => {
    const newValue = Number(
      (props.value + (direction === "right" ? amount : -amount)).toFixed(getDecimalPlaces(props.step)),
    );
    props.onInput?.(clamp(newValue, props.min, props.max));
  };

  const handleInput: JSX.EventHandlerUnion<HTMLInputElement, InputEvent> = (e) => {
    const value = e.currentTarget.valueAsNumber;
    props.onInput?.(value);
  };

  useNavigation(() => ({
    layer: props.layer,
    enabled: props.selected || false,
    actions: {
      left: { down: () => changeValue("left"), repeat: () => changeValue("left", props.step * 5) },
      right: { down: () => changeValue("right"), repeat: () => changeValue("right", props.step * 5) },
    },
  }));

  return (
    <MenuRow
      ref={props.ref as Ref<HTMLElement>}
      class={props.class}
      selected={props.selected}
      gradient={props.gradient}
      label={props.label}
      onMouseEnter={() => props.onMouseEnter?.()}
    >
      <div class="flex w-full items-center gap-6">
        <button class="cursor-pointer text-2xl" type="button" onClick={() => changeValue("left")}>
          <IconCaretLeft />
        </button>
        {/* Inset by about half a value tag, so the tag stays inside the row at either end. */}
        <div class="mx-[2.8cqw] grid h-[2.2cqw] grow items-center">
          {/* The visible track; the range input on top of it is only there for the mouse. */}
          <span class="relative col-start-1 row-start-1 h-[0.45cqw] rounded-full bg-black/25">
            <span
              class="absolute inset-y-0 rounded-full bg-white"
              classList={{ "transition-[left,width] duration-100": !dragging() }}
              style={{ left: `${fill().left}%`, width: `${fill().width}%` }}
            />
            <Show when={bipolar()}>
              <span
                class="absolute top-1/2 h-[1.1cqw] w-[0.15cqw] -translate-1/2 rounded-full bg-white/70"
                style={{ left: `${toPercent(0)}%` }}
              />
            </Show>
          </span>
          {/* The value is the handle and rides along the track. */}
          <span class="pointer-events-none relative col-start-1 row-start-1 h-0">
            <span
              class="absolute top-1/2 -translate-1/2 rounded-[0.4cqw] bg-white px-[0.6cqw] py-[0.45cqw] text-base font-black whitespace-nowrap text-slate-900 tabular-nums [text-box:trim-both_cap_alphabetic]"
              classList={{ "transition-[left] duration-100": !dragging() }}
              style={{ left: `${percentage()}%` }}
            >
              {props.renderValue ? props.renderValue(props.value) : props.value}
            </span>
          </span>
          <input
            type="range"
            aria-label={props.label}
            class="reset-range col-start-1 row-start-1 block h-full w-full cursor-pointer opacity-0"
            min={props.min}
            max={props.max}
            step={props.step}
            value={props.value}
            onPointerDown={startDrag}
            onInput={(e) => handleInput(e)}
            onKeyDown={(e) => e.preventDefault()}
          />
        </div>
        <button class="cursor-pointer text-2xl" type="button" onClick={() => changeValue("right")}>
          <IconCaretRight />
        </button>
      </div>
    </MenuRow>
  );
}

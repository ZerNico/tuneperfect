import type { JSX, Ref } from "solid-js";
import IconCaretLeft from "~icons/ph/caret-left-fill";
import IconCaretRight from "~icons/ph/caret-right-fill";

import { useNavigation } from "~/hooks/navigation";
import { clamp } from "~/lib/utils/math";

import MenuRow from "./menu-row";
import SlantPanel from "./slant-panel";

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

  const percentage = () => ((props.value - props.min) / (props.max - props.min)) * 100;

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
    onKeydown: (event) => {
      if (event.action === "left") {
        changeValue("left");
      } else if (event.action === "right") {
        changeValue("right");
      }
    },
    onRepeat: (event) => {
      if (event.action === "left") {
        changeValue("left", props.step * 5);
      } else if (event.action === "right") {
        changeValue("right", props.step * 5);
      }
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
        <SlantPanel
          skew={12}
          class="grid h-6 grow items-center"
          surface="overflow-hidden rounded-sm bg-black/25"
          surfaceContent={<span class="absolute inset-y-0 left-0 bg-white" style={{ width: `${percentage()}%` }} />}
        >
          <div
            class="col-start-1 row-start-1 text-center text-sm font-black text-white tabular-nums"
            style={{ "clip-path": `inset(0 0 0 ${percentage()}%)` }}
          >
            {props.renderValue ? props.renderValue(props.value) : props.value}
          </div>
          <div
            class="col-start-1 row-start-1 text-center text-sm font-black text-black tabular-nums"
            style={{ "clip-path": `inset(0 ${100 - percentage()}% 0 0)` }}
          >
            {props.renderValue ? props.renderValue(props.value) : props.value}
          </div>
          <input
            type="range"
            aria-label={props.label}
            class="reset-range col-start-1 row-start-1 block h-full w-full opacity-0"
            min={props.min}
            max={props.max}
            step={props.step}
            value={props.value}
            onInput={(e) => handleInput(e)}
            onKeyDown={(e) => e.preventDefault()}
          />
        </SlantPanel>
        <button class="cursor-pointer text-2xl" type="button" onClick={() => changeValue("right")}>
          <IconCaretRight />
        </button>
      </div>
    </MenuRow>
  );
}

import { createMemo, createSignal, type JSX, type Ref, Show } from "solid-js";
import IconCaretLeft from "~icons/ph/caret-left-fill";
import IconCaretRight from "~icons/ph/caret-right-fill";

import { useNavigation } from "~/hooks/navigation";
import { effectsEnabled } from "~/lib/fx";

import MenuRow from "./menu-row";

interface SelectProps<T extends string | number> {
  selected?: boolean;
  gradient?: string;
  class?: string;
  label: string;
  value: T | null;
  options?: ReadonlyArray<T>;
  onChange?: (value: T) => void;
  onMouseEnter?: () => void;
  renderValue?: (value: T | null) => JSX.Element;
  layer?: number;
  ref?: Ref<HTMLDivElement>;
}

export default function Select<T extends string | number>(props: SelectProps<T>) {
  // Which way the last change went, so the new value slides in from that side.
  const [direction, setDirection] = createSignal<"left" | "right" | null>(null);
  // A new object per value, so the keyed Show below remounts (and animates) on every change.
  const shown = createMemo(() => ({ value: props.value }));

  const changeOptions = (direction: "right" | "left") => {
    if (!props.options || props.options.length === 0) {
      return;
    }
    setDirection(direction);

    const optionsLength = props.options.length;
    const currentIndex = props.value !== null ? props.options.indexOf(props.value) : -1;

    let newIndex: number;
    if (direction === "right") {
      newIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % optionsLength;
    } else {
      newIndex = currentIndex === -1 ? optionsLength - 1 : (currentIndex - 1 + optionsLength) % optionsLength;
    }

    const newValue = props.options[newIndex];
    if (newValue === undefined) {
      return;
    }

    props.onChange?.(newValue);
  };

  useNavigation(() => ({
    layer: props.layer,
    enabled: props.selected || false,
    actions: {
      left: () => changeOptions("left"),
      right: () => changeOptions("right"),
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
        <button class="cursor-pointer text-2xl" type="button" onClick={() => changeOptions("left")}>
          <IconCaretLeft />
        </button>
        <div class="flex min-w-0 grow items-center justify-center truncate text-center text-xl font-bold">
          <Show when={shown()} keyed>
            {(current) => (
              <span
                class="truncate"
                classList={{
                  "animate-value-from-right": effectsEnabled() && direction() === "right",
                  "animate-value-from-left": effectsEnabled() && direction() === "left",
                }}
              >
                {props.renderValue ? props.renderValue(current.value) : current.value}
              </span>
            )}
          </Show>
        </div>
        <button class="cursor-pointer text-2xl" type="button" onClick={() => changeOptions("right")}>
          <IconCaretRight />
        </button>
      </div>
    </MenuRow>
  );
}

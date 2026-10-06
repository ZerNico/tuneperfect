import { createSignal, type JSX, type Ref, Show } from "solid-js";
import { twMerge } from "tailwind-merge";
import IconSpinner from "~icons/ph/spinner-gap-bold";

import { useNavigation } from "~/hooks/navigation";

import Plate from "./plate";

interface ButtonProps {
  selected?: boolean;
  gradient?: string;
  children?: JSX.Element;
  class?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  loading?: boolean;
  /** "sm": a shorter button with smaller text, e.g. in a footer next to key hints. */
  size?: "md" | "sm";
  layer?: number;
  ref?: Ref<HTMLButtonElement>;
}

export default function Button(props: ButtonProps) {
  const [pressed, setPressed] = createSignal(false);

  useNavigation(() => ({
    layer: props.layer,
    // Only the selected button takes confirm.
    actions: {
      confirm: props.selected
        ? {
            down: () => setPressed(true),
            up: () => {
              setPressed(false);
              if (props.selected && !props.loading) props.onClick?.();
            },
          }
        : null,
    },
  }));

  return (
    <Plate
      as="button"
      ref={props.ref as Ref<HTMLElement>}
      class={twMerge(props.size === "sm" && "h-12", props.class)}
      selected={props.selected}
      pressed={pressed() && props.selected}
      gradient={props.gradient}
      disabled={props.loading}
      onClick={() => props.onClick?.()}
      onMouseEnter={() => props.onMouseEnter?.()}
      contentClass={`flex items-center justify-center gap-3 text-center font-bold ${props.size === "sm" ? "text-base" : "text-xl"}`}
    >
      <Show when={!props.loading} fallback={<IconSpinner class="animate-spin text-2xl" />}>
        {props.children}
      </Show>
    </Plate>
  );
}

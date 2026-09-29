import { createSignal, type JSX, type Ref, Show } from "solid-js";
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
  layer?: number;
  ref?: Ref<HTMLButtonElement>;
}

export default function Button(props: ButtonProps) {
  const [pressed, setPressed] = createSignal(false);

  useNavigation(() => ({
    layer: props.layer,
    onKeydown(event) {
      if (event.action === "confirm") {
        setPressed(true);
      }
    },
    onKeyup(event) {
      if (event.action === "confirm") {
        setPressed(false);

        if (props.selected) {
          props.onClick?.();
        }
      }
    },
  }));

  return (
    <Plate
      as="button"
      ref={props.ref as Ref<HTMLElement>}
      class={props.class}
      selected={props.selected}
      pressed={pressed() && props.selected}
      gradient={props.gradient}
      disabled={props.loading}
      onClick={() => props.onClick?.()}
      onMouseEnter={() => props.onMouseEnter?.()}
      contentClass="flex items-center justify-center gap-3 text-center text-xl font-bold"
    >
      <Show when={!props.loading} fallback={<IconSpinner class="animate-spin text-2xl" />}>
        {props.children}
      </Show>
    </Plate>
  );
}

import type { JSX, Ref } from "solid-js";
import { useNavigation } from "~/hooks/navigation";
import IconTriangleLeft from "~icons/sing/triangle-left";
import IconTriangleRight from "~icons/sing/triangle-right";

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
  const changeOptions = (direction: "right" | "left") => {
    if (!props.options || props.options.length === 0) {
      return;
    }

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
    onKeydown: (event) => {
      if (event.action === "left") {
        changeOptions("left");
      } else if (event.action === "right") {
        changeOptions("right");
      }
    },
  }));

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: This is a select
    <div ref={props.ref} class="grid h-16 items-center overflow-hidden rounded-lg" onMouseEnter={props.onMouseEnter}>
      <div
        class="col-start-1 row-start-1 h-full w-full bg-gradient-to-r transition-opacity"
        classList={{
          [props.gradient || ""]: true,
          "opacity-0": !props.selected,
        }}
      />
      <div class="z-2 col-start-1 row-start-1 mx-auto grid w-full max-w-320 grid-cols-[1fr_3fr] items-center">
        <div class="text-center font-bold text-xl">{props.label}</div>
        <div class="flex items-center gap-8">
          <button class="cursor-pointer" type="button" onClick={() => changeOptions("left")}>
            <IconTriangleLeft />
          </button>
          <div class="flex flex-grow flex-col items-center justify-center text-center font-bold text-xl">
            {props.renderValue ? props.renderValue(props.value) : props.value}
          </div>
          <button class="cursor-pointer" type="button" onClick={() => changeOptions("right")}>
            <IconTriangleRight />
          </button>
        </div>
      </div>
    </div>
  );
}

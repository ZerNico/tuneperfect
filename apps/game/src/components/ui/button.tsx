import { type JSX, createSignal } from "solid-js";
import { useNavigation } from "~/hooks/navigation";
import IconLoaderCircle from "~icons/lucide/loader-circle";

interface ButtonProps {
  selected?: boolean;
  gradient?: string;
  children?: JSX.Element;
  class?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  loading?: boolean;
  layer?: number;
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

  const active = () => pressed() && props.selected;

  return (
    <button
      class="grid h-16 cursor-pointer items-center overflow-hidden rounded-lg transition-all ease-in-out active:scale-95"
      classList={{
        [props.class || ""]: true,
        "scale-95": active(),
      }}
      type="button"
      onClick={props.onClick}
      onMouseEnter={props.onMouseEnter}
      disabled={props.loading}
    >
      <div
        class="z-2 col-start-1 row-start-1 flex items-center justify-center gap-3 text-center font-bold text-xl transition-opacity"
        classList={{
          "pointer-events-none opacity-0": props.loading,
        }}
      >
        {props.children}
      </div>

      <div
        class="z-2 col-start-1 row-start-1 flex items-center justify-center transition-opacity"
        classList={{
          "pointer-events-none opacity-0": !props.loading,
        }}
      >
        <IconLoaderCircle class="animate-spin text-2xl" />
      </div>

      <div
        class="col-start-1 row-start-1 h-full w-full bg-gradient-to-r transition-all"
        classList={{
          [props.gradient || "gradient-settings"]: true,
          "opacity-0": !props.selected,
        }}
      />
    </button>
  );
}

import { mergeRefs } from "@solid-primitives/refs";
import { createEffect, createSignal, type JSX, type Ref } from "solid-js";
import { Motion, Presence } from "solid-motionone";
import { twMerge } from "tailwind-merge";
import { keyMode, useNavigation } from "~/hooks/navigation";
import { VirtualKeyboard } from "./virtual-keyboard";

interface InputProps {
  value?: string;
  placeholder?: string;
  onInput?: JSX.EventHandler<HTMLInputElement, InputEvent>;
  onFocus?: () => void;
  onBlur?: () => void;
  class?: string;
  ref?: Ref<HTMLInputElement>;
  selected?: boolean;
  layer?: number;
  label?: string;
  gradient?: string;
  onMouseEnter?: () => void;
  maxLength?: number;
}

export default function Input(props: InputProps) {
  const layer = () => props.layer || 0;

  const [focused, setFocused] = createSignal(false);
  const [keyboardPosition, setKeyboardPosition] = createSignal<{
    top: number;
    left: number;
    showAbove: boolean;
  } | null>(null);
  let inputRef!: HTMLInputElement;

  const handleFocus = () => {
    setFocused(true);
    props.onFocus?.();
  };

  const handleBlur = () => {
    setFocused(false);
    props.onBlur?.();
  };

  const showVirtualKeyboard = () => keyMode() === "gamepad" && focused();

  useNavigation(() => ({
    layer: layer(),
    enabled: props.selected,
    onKeyup(event) {
      if (event.action === "confirm") {
        inputRef.focus();
      }
    },
  }));

  createEffect(() => {
    if (!props.selected) {
      inputRef.blur();
    }
  });

  createEffect(() => {
    if (props.selected && keyMode() === "keyboard") {
      inputRef.focus();
    }
  });

  createEffect(() => {
    if (showVirtualKeyboard() && inputRef) {
      const rect = inputRef.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const keyboardHeight = 300;
      const gap = rect.height * 0.5;

      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      const showAbove = spaceBelow < keyboardHeight + gap && spaceAbove > keyboardHeight + gap;

      const top = showAbove ? rect.top - keyboardHeight - gap : rect.bottom + gap;

      const left = rect.left;

      setKeyboardPosition({ top, left, showAbove });
    } else {
      setKeyboardPosition(null);
    }
  });

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: This is a input */}
      <div
        class={twMerge("grid h-16 items-center overflow-hidden rounded-lg", props.class)}
        onMouseEnter={props.onMouseEnter}
      >
        <div
          class="col-start-1 row-start-1 h-full w-full bg-gradient-to-r transition-opacity"
          classList={{
            [props.gradient || "gradient-settings"]: true,
            "opacity-0": !props.selected,
          }}
        />
        <div class="z-2 col-start-1 row-start-1 mx-auto grid w-full max-w-320 grid-cols-[1fr_3fr] items-center">
          <div class="text-center font-bold text-xl">{props.label}</div>
          <div class="flex items-center justify-center">
            <div class="w-full">
              <input
                ref={mergeRefs(props.ref, (el) => {
                  inputRef = el;
                })}
                type="text"
                value={props.value || ""}
                placeholder={props.placeholder}
                maxLength={props.maxLength}
                onInput={props.onInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                class="w-full bg-transparent py-2 text-xl text-white focus:outline-none"
              />
              <div class="h-0.5 w-full rounded-full bg-white" />
            </div>
          </div>
        </div>
      </div>

      <Presence>
        {keyboardPosition() && (
          <Motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            class="fixed z-50"
            style={{
              top: `${keyboardPosition()?.top}px`,
              left: `${keyboardPosition()?.left}px`,
            }}
          >
            <VirtualKeyboard inputRef={inputRef} layer={layer() + 1} onClose={() => inputRef.blur()} />
          </Motion.div>
        )}
      </Presence>
    </>
  );
}

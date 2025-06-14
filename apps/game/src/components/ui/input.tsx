import { mergeRefs } from "@solid-primitives/refs";
import { createEffect, createSignal, type JSX, type Ref } from "solid-js";
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
}

export default function Input(props: InputProps) {
  const [focused, setFocused] = createSignal(false);
  const [keyboardPosition, setKeyboardPosition] = createSignal<{
    top: number;
    left: number;
    showAbove: boolean;
  } | null>(null);
  let inputRef!: HTMLInputElement;
  let containerRef!: HTMLDivElement;

  const handleFocus = () => {
    setFocused(true);
    props.onFocus?.();
  };

  const handleBlur = () => {
    setFocused(false);
    props.onBlur?.();
  };

  const showVirtualKeyboard = () => keyMode() === "gamepad" && focused();

  const moveCursor = (direction: "left" | "right") => {
    const start = inputRef.selectionStart ?? 0;
    inputRef.setSelectionRange(Math.max(0, start + (direction === "left" ? -1 : 1)), Math.max(0, start + (direction === "left" ? -1 : 1)));
  };

  const writeCharacter = (char: string) => {
    const start = inputRef.selectionStart ?? 0;
    const end = inputRef.selectionEnd ?? 0;
    const value = inputRef.value;
    inputRef.value = value.substring(0, start) + char + value.substring(end);
    inputRef.setSelectionRange(start + 1, start + 1);
  };

  useNavigation(() => ({
    layer: props.layer || 0,
    enabled: props.selected,
    onKeydown(event) {
      if (!focused()) return;

      if (event.action === "left") {
        moveCursor("left");
      } else if (event.action === "right") {
        moveCursor("right");
      } else if (event.origin === "keyboard") {
        if (event.originalKey === " ") {
          writeCharacter(" ");
        }

        if (event.originalKey === "s") {
          writeCharacter("s");
        }
      }
    },
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
    if (showVirtualKeyboard() && containerRef) {
      const rect = containerRef.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const keyboardHeight = 300;
      const gap = rect.height * 0.125;

      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;

      const showAbove = spaceBelow < keyboardHeight + gap && spaceAbove > keyboardHeight + gap;

      const top = showAbove ? rect.top - keyboardHeight - gap : rect.bottom + gap;

      const left = rect.left + rect.width / 2;

      setKeyboardPosition({ top, left, showAbove });
    } else {
      setKeyboardPosition(null);
    }
  });

  return (
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: This is a input */}
      <div ref={containerRef} class="grid h-16 items-center overflow-hidden rounded-lg" onMouseEnter={props.onMouseEnter}>
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
                onInput={props.onInput}
                onFocus={handleFocus}
                onBlur={handleBlur}
                class={`w-full bg-transparent py-2 text-white focus:outline-none ${props.class || ""}`}
              />
              <div class="h-0.5 w-full rounded-full bg-white" />
            </div>
          </div>
        </div>
      </div>

      {keyboardPosition() && (
        <div
          class="fixed z-50"
          style={{
            top: `${keyboardPosition()?.top}px`,
            left: `${keyboardPosition()?.left}px`,
            transform: "translateX(-50%)",
          }}
        >
          <VirtualKeyboard inputRef={inputRef} />
        </div>
      )}
    </>
  );
}

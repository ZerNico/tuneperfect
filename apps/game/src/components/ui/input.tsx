import { mergeRefs } from "@solid-primitives/refs";
import { createEffect, createSignal, type JSX, type Ref } from "solid-js";
import { Motion, Presence } from "solid-motionone";

import { keyMode, useNavigation } from "~/hooks/navigation";

import MenuRow from "./menu-row";
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
  type?: "text" | "password";
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
      <MenuRow
        class={props.class}
        selected={props.selected}
        gradient={props.gradient}
        label={props.label}
        onMouseEnter={() => props.onMouseEnter?.()}
      >
        <div class="w-full">
          <input
            ref={mergeRefs(props.ref, (el) => {
              inputRef = el;
            })}
            type={props.type || "text"}
            value={props.value || ""}
            placeholder={props.placeholder}
            aria-label={props.label || props.placeholder}
            maxLength={props.maxLength}
            onInput={(event) => props.onInput?.(event)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            class="w-full bg-transparent py-2 text-xl font-bold text-white placeholder:text-white/40 focus:outline-none"
          />
          <div class="h-1 w-full -skew-x-12 rounded-sm bg-white/80" />
        </div>
      </MenuRow>

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

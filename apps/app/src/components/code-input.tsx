import { createSignal, For } from "solid-js";

export const LOBBY_CODE_LENGTH = 8;

interface CodeInputProps {
  value: string;
  onInput: (value: string) => void;
  /** Called once all characters are entered. */
  onComplete?: (value: string) => void;
  label: string;
  invalid?: boolean;
  disabled?: boolean;
  autofocus?: boolean;
}

/**
 * The lobby code as one box per character. It is a single real input underneath (transparent, over the
 * boxes), so typing, pasting, deleting and autofill all work as in any text field.
 */
export default function CodeInput(props: CodeInputProps) {
  const [focused, setFocused] = createSignal(false);

  const handleInput = (raw: string) => {
    const value = raw
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, LOBBY_CODE_LENGTH);
    props.onInput(value);
    if (value.length === LOBBY_CODE_LENGTH) props.onComplete?.(value);
  };

  return (
    <div class="relative" classList={{ "opacity-50": props.disabled }}>
      <div class="grid grid-cols-8 gap-1.5" aria-hidden="true">
        <For each={Array.from({ length: LOBBY_CODE_LENGTH }, (_, index) => index)}>
          {(index) => {
            const char = () => props.value[index] ?? "";
            const active = () =>
              focused() &&
              (index === props.value.length ||
                (index === LOBBY_CODE_LENGTH - 1 && props.value.length === LOBBY_CODE_LENGTH));
            return (
              <span
                // One class string for the ring: in classList, two entries sharing `ring-2` would undo each other.
                class={`flex h-14 items-center justify-center rounded-[8px] text-2xl font-black transition-colors ${
                  char() ? "bg-white text-slate-900" : "bg-white/8"
                } ${active() && !char() ? "ring-2 ring-white/60 ring-inset" : props.invalid ? "ring-2 ring-red-400/80 ring-inset" : ""}`}
              >
                {char()}
              </span>
            );
          }}
        </For>
      </div>
      <input
        aria-label={props.label}
        aria-invalid={props.invalid ? "true" : "false"}
        value={props.value}
        disabled={props.disabled}
        autofocus={props.autofocus}
        maxLength={LOBBY_CODE_LENGTH}
        autocomplete="off"
        autocapitalize="characters"
        autocorrect="off"
        spellcheck={false}
        inputmode="text"
        enterkeyhint="go"
        class="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onInput={(event) => handleInput(event.currentTarget.value)}
      />
    </div>
  );
}

import { createSignal, type JSX, Show } from "solid-js";
import Eye from "~icons/lucide/eye";
import EyeOff from "~icons/lucide/eye-off";

interface InputProps {
  class?: string;
  inputClass?: string;
  label?: string;
  type?: string;
  onInput?: JSX.EventHandler<HTMLInputElement, InputEvent>;
  errorMessage?: string;
  maxLength?: number;
  autocomplete?: string;
  value?: string;
  disabled?: boolean;
  name?: string;
  autofocus?: boolean;
  ref?: (element: HTMLInputElement) => void;
  onChange?: JSX.EventHandler<HTMLInputElement, Event>;
  onBlur?: JSX.EventHandler<HTMLInputElement, FocusEvent>;
}

export default function Input(props: InputProps) {
  const [showPassword, setShowPassword] = createSignal(false);

  const type = () => (props.type === "password" ? (showPassword() ? "text" : "password") : props.type);

  return (
    <div class={props.class}>
      <Show when={props.label}>
        {(label) => (
          <label for={props.name} class="mb-1.5 block text-sm font-bold text-white/70">
            {label()}
          </label>
        )}
      </Show>
      <div
        class="flex h-12 items-center gap-1 rounded-[12px] bg-white/8 pr-1 pl-4 transition-shadow focus-within:ring-2 focus-within:ring-white/40"
        classList={{ "ring-2 ring-red-400/70": !!props.errorMessage, "opacity-50": props.disabled }}
      >
        <input
          id={props.name}
          value={props.value}
          disabled={props.disabled}
          name={props.name}
          autofocus={props.autofocus}
          ref={props.ref}
          onChange={(event) => props.onChange?.(event)}
          onBlur={(event) => props.onBlur?.(event)}
          autocomplete={props.autocomplete}
          maxLength={props.maxLength}
          type={type()}
          onInput={(event) => props.onInput?.(event)}
          aria-label={props.label}
          class="block h-full w-full grow bg-transparent text-white placeholder:text-white/35 focus:outline-none"
          classList={{
            [props.inputClass || ""]: true,
          }}
          aria-invalid={props.errorMessage ? "true" : "false"}
          aria-describedby={props.errorMessage ? `${props.name}-error` : undefined}
        />
        <Show when={props.type === "password"}>
          <button
            class="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            type="button"
            onClick={() => setShowPassword(!showPassword())}
            aria-label={showPassword() ? "Hide password" : "Show password"}
          >
            <Show when={showPassword()} fallback={<Eye />}>
              <EyeOff />
            </Show>
          </button>
        </Show>
      </div>
      <Show when={props.errorMessage}>
        <div id={`${props.name}-error`} class="mt-1.5 text-sm font-semibold text-red-300" role="alert">
          {props.errorMessage}
        </div>
      </Show>
    </div>
  );
}

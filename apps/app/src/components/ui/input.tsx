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
          <label 
            for={props.name} 
            class="block text-slate-800 text-sm"
          >
            {label()}
          </label>
        )}
      </Show>
      <div class="flex items-center gap-1 pb-1">
        <input
          id={props.name}
          value={props.value}
          disabled={props.disabled}
          name={props.name}
          autofocus={props.autofocus}
          ref={props.ref}
          onChange={props.onChange}
          onBlur={props.onBlur}
          autocomplete={props.autocomplete}
          maxLength={props.maxLength}
          type={type()}
          onInput={props.onInput}
          class="block w-full flex-grow rounded focus:outline-none"
          classList={{
            [props.inputClass || ""]: true,
          }}
          aria-invalid={props.errorMessage ? "true" : "false"}
          aria-describedby={props.errorMessage ? `${props.name}-error` : undefined}
        />
        <Show when={props.type === "password"}>
          <button
            class="cursor-pointer rounded-full p-1 transition-colors hover:bg-slate-200"
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
      <div class="h-0.5 rounded-full bg-slate-800" />
      <Show when={props.errorMessage}>
        <div 
          id={`${props.name}-error`}
          class="mt-1 text-red-600 text-sm"
          role="alert"
        >
          {props.errorMessage}
        </div>
      </Show>
    </div>
  );
}

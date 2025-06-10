import { TextField } from "@kobalte/core/text-field";
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
    <TextField validationState={props.errorMessage ? "invalid" : "valid"} class={props.class}>
      <Show when={props.label}>
        {(label) => <TextField.Label class="block text-slate-800 text-sm">{label()}</TextField.Label>}
      </Show>
      <div class="flex items-center gap-1 pb-1">
        <TextField.Input
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
        />
        <Show when={props.type === "password"}>
          <button
            class="cursor-pointer rounded-full p-1 transition-colors hover:bg-slate-200"
            type="button"
            onClick={() => setShowPassword(!showPassword())}
          >
            <Show when={showPassword()} fallback={<Eye />}>
              <EyeOff />
            </Show>
          </button>
        </Show>
      </div>
      <div class="h-0.5 rounded-full bg-slate-800" />
      <TextField.ErrorMessage class="mt-1 text-red-600 text-sm">{props.errorMessage}</TextField.ErrorMessage>
    </TextField>
  );
}

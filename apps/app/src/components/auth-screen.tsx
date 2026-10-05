import { type Component, type JSX, Show } from "solid-js";
import { Dynamic } from "solid-js/web";

interface AuthScreenProps {
  title: JSX.Element;
  subtitle?: JSX.Element;
  /** Shown in a badge in the section's colours above the title. */
  icon?: Component<{ class?: string }>;
  children: JSX.Element;
}

/** Layout for the account screens (sign in, sign up, passwords, profile setup): a single column on the background. */
export default function AuthScreen(props: AuthScreenProps) {
  return (
    <main class="mx-auto flex w-full max-w-sm grow flex-col px-6 pt-6 pb-8">
      <Show when={props.icon}>
        {(icon) => (
          <span class="gradient-accent mb-5 flex size-14 items-center justify-center rounded-[16px] text-3xl shadow-crisp">
            <Dynamic component={icon()} />
          </span>
        )}
      </Show>
      <h1 class="text-[32px] leading-tight font-bold">{props.title}</h1>
      <Show when={props.subtitle}>
        <p class="mt-2 text-white/60">{props.subtitle}</p>
      </Show>
      <div class="mt-6 flex flex-col gap-4">{props.children}</div>
    </main>
  );
}

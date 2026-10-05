import { useLocation } from "@tanstack/solid-router";
import { type JSX, Show, Suspense, untrack } from "solid-js";

import { effectsEnabled } from "~/lib/fx";
import { roundStore } from "~/stores/round";

interface LayoutProps {
  children?: JSX.Element;
  intent?: "primary" | "secondary" | "popup";
  header?: JSX.Element;
  footer?: JSX.Element;
  background?: JSX.Element;
  /** Tints the background. Derived from the route when omitted. */
  mode?: LayoutMode;
}

export type LayoutMode = "sing" | "party" | "lobby" | "settings" | "neutral";

// Two shades per mode for the aurora glows; the second also lights the stage.
const MODE_COLORS: Record<LayoutMode, [string, string]> = {
  sing: ["green-400", "teal-600"],
  party: ["pink-500", "purple-600"],
  lobby: ["yellow-400", "orange-500"],
  settings: ["cyan-400", "blue-500"],
  neutral: ["blue-600", "purple-800"],
};

function modeForPath(pathname: string): LayoutMode {
  if (pathname.startsWith("/sing")) return "sing";
  if (pathname.startsWith("/party")) return "party";
  if (pathname.startsWith("/lobby")) return "lobby";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/game")) return roundStore.settings()?.returnTo ? "party" : "sing";
  return "neutral";
}

export default function Layout(props: LayoutProps) {
  const location = useLocation();
  // Read the path once: during a navigation the outgoing screen must keep its
  // own tint instead of switching to the next route's before the transition.
  const initialMode = untrack(() => modeForPath(location().pathname));
  const mode = () => props.mode ?? initialMode;
  const backgroundClass = () => (props.intent === "secondary" ? "gradient-bg-secondary" : "gradient-bg-primary");

  return (
    <div>
      <div
        class="flex h-screen w-screen items-center justify-center"
        classList={{
          [backgroundClass()]: props.intent !== "popup",
        }}
      >
        <div class="layout flex">
          <div class="@container relative flex grow overflow-hidden">
            <Suspense fallback={<div />}>
              <Show when={props.intent !== "popup"}>
                <LayoutDecoration mode={mode()} />
              </Show>
              <div class="absolute inset-0 h-full w-full">{props.background}</div>
              <div class="relative z-1 grid max-w-full grow grid-rows-[min-content_1fr_min-content] gap-6 p-16">
                <div>{props.header}</div>
                <div class="flex min-h-0 w-full min-w-0 flex-col">{props.children}</div>
                <div>{props.footer}</div>
              </div>
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Two aurora glows in the mode colours, drifting slowly. */
function LayoutDecoration(props: { mode: LayoutMode }) {
  const animated = () => effectsEnabled();
  const glow = (index: 0 | 1, alpha: number) =>
    `radial-gradient(circle, color-mix(in oklch, var(--color-${MODE_COLORS[props.mode][index]}) ${alpha}%, transparent), transparent 65%)`;

  return (
    <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        class="absolute -top-[25%] -left-[10%] h-[70%] w-[55%] blur-[4cqw]"
        classList={{ "animate-aurora": animated() }}
        style={{ background: glow(0, 40) }}
      />
      <div
        class="absolute -top-[10%] -right-[15%] h-[75%] w-[60%] blur-[4cqw]"
        classList={{ "animate-aurora": animated() }}
        style={{
          background: glow(1, 40),
          "animation-delay": "-7s",
          "animation-direction": "reverse",
        }}
      />
    </div>
  );
}

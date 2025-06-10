import { createEventListener } from "@solid-primitives/event-listener";
import { debounce } from "@solid-primitives/scheduled";
import type { QueryClient } from "@tanstack/solid-query";
import { createRootRouteWithContext, Outlet, redirect } from "@tanstack/solid-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createSignal } from "solid-js";
import { useWakeLock } from "~/hooks/useWakeLock";

interface RouterContext {
  queryClient: QueryClient;
}

const [initialized, setInitialized] = createSignal(false);

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  beforeLoad: async () => {
    if (!initialized()) {
      setInitialized(true);
      throw redirect({ to: "/" });
    }
  },
});

function RootComponent() {
  useWakeLock();

  const toggleFullscreen = async () => {
    const window = getCurrentWindow();
    const isFullscreen = await window.isFullscreen();

    await window.setFullscreen(!isFullscreen);
  };

  createEventListener(
    document,
    "keydown",
    (event) => {
      if (event.key === "Enter" && (event.metaKey || event.altKey)) {
        toggleFullscreen();
        event.preventDefault();
        event.stopPropagation();
      }

      if (event.key === "F11") {
        toggleFullscreen();
        event.preventDefault();
        event.stopPropagation();
      }

      if (event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { capture: true },
  );

  createEventListener(
    document,
    "keyup",
    (event) => {
      if (event.key === "Enter" && (event.metaKey || event.altKey)) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (event.key === "F11") {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { capture: true },
  );

  const [mouseHidden, setMouseHidden] = createSignal(false);

  const hideMouse = debounce(() => {
    setMouseHidden(true);
  }, 3000);

  createEventListener(document, "mousemove", () => {
    setMouseHidden(false);
    hideMouse();
  });

  if (import.meta.env.MODE === "production") {
    createEventListener(
      document,
      "contextmenu",
      (event) => {
        const target = event.target as HTMLElement;

        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
          return;
        }

        event.preventDefault();
      },
      { capture: true },
    );
  }

  if (import.meta.env.MODE === "production") {
    createEventListener(
      document,
      "selectstart",
      (event) => {
        const target = event.target as HTMLElement;

        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
          return;
        }

        event.preventDefault();
      },
      { capture: true },
    );
  }

  return (
    <>
      <div
        class="font-primary text-base text-white"
        classList={{
          "cursor-none": mouseHidden(),
        }}
      >
        <Outlet />
      </div>
    </>
  );
}

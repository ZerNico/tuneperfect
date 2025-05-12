import { createEventListener } from "@solid-primitives/event-listener";
import { debounce } from "@solid-primitives/scheduled";
import type { QueryClient } from "@tanstack/solid-query";
import { Outlet, createRootRouteWithContext, redirect } from "@tanstack/solid-router";
import { TanStackRouterDevtools } from "@tanstack/solid-router-devtools";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createSignal } from "solid-js";

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
  const toggleFullscreen = async () => {
    const window = getCurrentWindow();
    const isFullscreen = await window.isFullscreen();

    await window.setFullscreen(!isFullscreen);
  };

  createEventListener(document, "keydown", (event) => {
    if (event.key === "F11") {
      toggleFullscreen();
      event.preventDefault();
      event.stopPropagation();
    }
  });

  const [mouseHidden, setMouseHidden] = createSignal(false);

  const hideMouse = debounce(() => {
    setMouseHidden(true);
  }, 3000);

  createEventListener(document, "mousemove", () => {
    setMouseHidden(false);
    hideMouse();
  });

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

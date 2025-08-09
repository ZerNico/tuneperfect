import { createEventListener } from "@solid-primitives/event-listener";
import { debounce } from "@solid-primitives/scheduled";
import type { QueryClient } from "@tanstack/solid-query";
import { createRootRouteWithContext, Outlet, redirect, useNavigate } from "@tanstack/solid-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { createSignal, Suspense } from "solid-js";
import { createMidiNoteListener, registerMidiInputs } from "~/hooks/midi";
import { useNavigation } from "~/hooks/navigation";
import { useWakeLock } from "~/hooks/useWakeLock";
import { initWebSocket } from "~/hooks/websocket";
import { songsStore } from "~/stores/songs";

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

  useNavigation({
    layer: false,
    onKeydown: (event) => {
      if (event.action === "fullscreen") {
        toggleFullscreen();
      }
    },
  });

  const navigate = useNavigate();

  // Register the song navigation (listening to MIDI channel 5)
  registerMidiInputs().then(() => {
    createMidiNoteListener(5, undefined, (event) => {
      if (event.data) {
        const songMidiNote = event.data[1];
        if(!songMidiNote) {
          return;
        }

        const matchingSong = songsStore.songs().find((song) => song.midiNote === songMidiNote);
        if (matchingSong) {
          navigate({ to: `/sing/${matchingSong.hash}` });
        } else {
          
          navigate({ to: '/sing' });
        }
      }
    });
  });

  initWebSocket();

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
    <div
      class="font-primary text-base text-white"
      classList={{
        "cursor-none": mouseHidden(),
      }}
    >
      <Suspense>
        <Outlet />
      </Suspense>
    </div>
  );
}

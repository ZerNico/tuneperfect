import { createEventListener } from "@solid-primitives/event-listener";
import { debounce } from "@solid-primitives/scheduled";
import { Outlet } from "@tanstack/solid-router";
import { createSignal, Suspense } from "solid-js";

import PopupContainer from "~/components/popup-container";
import { useNavigation } from "~/hooks/navigation";
import { useWakeLock } from "~/hooks/use-wake-lock";
import { native } from "~/lib/native/client";
import { useWebRTCAutoConnect } from "~/stores/webrtc";

export default function RootScreen() {
  useWakeLock();
  useWebRTCAutoConnect();

  const toggleFullscreen = async () => {
    await native.window.toggleFullscreen();
  };

  useNavigation({
    layer: false,
    onKeydown: (event) => {
      if (event.action === "fullscreen") {
        toggleFullscreen();
      }
    },
  });

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
      <PopupContainer />
    </div>
  );
}

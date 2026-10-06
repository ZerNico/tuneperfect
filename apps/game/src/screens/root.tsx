import { createEventListener } from "@solid-primitives/event-listener";
import { debounce } from "@solid-primitives/scheduled";
import { Outlet } from "@tanstack/solid-router";
import { createSignal, Suspense } from "solid-js";

import PopupContainer from "~/components/popup-container";
import { ToastRegion } from "~/components/ui/toast";
import { useNavigation } from "~/hooks/navigation";
import { useWakeLock } from "~/hooks/use-wake-lock";
import { native } from "~/lib/native/client";
import { useWebRTCAutoConnect } from "~/stores/webrtc";

export default function RootScreen() {
  useWakeLock();
  useWebRTCAutoConnect();

  const toggleFullscreen = async () => {
    await native.window.toggleFullscreen().catch((error) => console.error("Failed to toggle fullscreen:", error));
  };

  useNavigation({
    layer: false,
    actions: { fullscreen: toggleFullscreen },
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
      {/* Above everything, popups included, and sized like the layout so the toasts' cqw match the screens'. */}
      <div class="pointer-events-none fixed inset-0 z-100 flex items-center justify-center">
        <div class="layout flex">
          <div class="@container relative grow overflow-hidden">
            <ToastRegion />
          </div>
        </div>
      </div>
    </div>
  );
}

import { For } from "solid-js";
import { Motion, Presence } from "solid-motionone";

import { popup } from "~/lib/popup";

export default function PopupContainer() {
  return (
    <Presence>
      <For each={popup.stack}>
        {(popup, index) => {
          const handleBackdropClick = () => {
            if (!popup.config.modal) {
              popup.resolve(null);
            }
          };

          return (
            <Motion.div
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              class="fixed inset-0"
              style={{ "z-index": 50 + index() }}
            >
              {/* The blur animates via CSS: solid-motionone can't tween backdrop-filter, and
                  fading opacity instead makes Chromium skip the blur until the fade ends. */}
              <div class="absolute inset-0 animate-backdrop-in" onClick={handleBackdropClick} />

              <Motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                class="relative z-10 h-full w-full"
              >
                {popup.config.render(popup.resolve)}
              </Motion.div>
            </Motion.div>
          );
        }}
      </For>
    </Presence>
  );
}

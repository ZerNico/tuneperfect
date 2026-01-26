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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              class="fixed inset-0"
              style={{ "z-index": 50 + index() }}
            >
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop is not keyboard focusable */}
              <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleBackdropClick} />

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

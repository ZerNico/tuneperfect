import { makeEventListener } from "@solid-primitives/event-listener";

/** Calls `callback` when the mouse goes down outside the element (e.g. to close a popup). */
export function createClickOutside(ref: () => HTMLElement | undefined, callback: (event: MouseEvent) => void) {
  makeEventListener(document, "mousedown", (event) => {
    const element = ref();
    if (element && !element.contains(event.target as Node)) callback(event);
  });
}

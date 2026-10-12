export type SingingView = "classic" | "scrolling";

/**
 * Which singing view a round uses: the classic pages, or notes scrolling past a now-line.
 * Temporary: set `localStorage["tp.singingView"] = "scrolling"` until it's a setting.
 */
export function singingView(): SingingView {
  return globalThis.localStorage?.getItem("tp.singingView") === "scrolling" ? "scrolling" : "classic";
}

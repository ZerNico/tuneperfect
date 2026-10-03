import { createSignal } from "solid-js";

/** Height of the fixed header (h-16). */
export const HEADER_HEIGHT = 64;

/**
 * Height of a bar stuck right under the header (the song search), 0 when none is stuck. The header's
 * backdrop grows by this much, so header and bar share one blurred layer: no seam, one fade.
 */
export const [stuckBarHeight, setStuckBarHeight] = createSignal(0);

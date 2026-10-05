import { settingsStore } from "~/stores/settings";

/**
 * Whether decorative effects (particles, confetti, motion blur)
 * should render. Text feedback stays visible either way.
 */
export function effectsEnabled() {
  return settingsStore.general().visualEffects === "full";
}

export function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

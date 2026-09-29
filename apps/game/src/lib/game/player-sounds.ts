import { createEffect, on } from "solid-js";

import { playSound } from "~/lib/sound";

import type { PlayerContextValue } from "./player-context";

/** Combos below this length break silently. */
const AUDIBLE_COMBO_BREAK = 10;

/** Plays the in-game sound effects for one player's notes and phrases. */
export function createPlayerSounds(player: Pick<PlayerContextValue, "noteEvent" | "phraseRating">) {
  createEffect(
    on(
      player.noteEvent,
      (event) => {
        if (!event) return;

        if (event.milestone) {
          playSound("comboMilestone");
        } else if (event.hit && event.golden) {
          playSound("goldenHit");
        } else if (event.brokenCombo >= AUDIBLE_COMBO_BREAK) {
          playSound("comboBreak");
        }
      },
      { defer: true },
    ),
  );

  createEffect(
    on(
      player.phraseRating,
      (rating) => {
        if (rating?.rating === "perfect") {
          playSound("perfect");
        }
      },
      { defer: true },
    ),
  );
}

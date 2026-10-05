import { type JSX, Show } from "solid-js";

import { effectsEnabled } from "~/lib/fx";
import { MIN_VISIBLE_COMBO } from "~/lib/game/combo";
import { useGame } from "~/lib/game/game-context";
import { usePlayer } from "~/lib/game/player-context";
import { t } from "~/lib/i18n";

import Burst from "../fx/burst";

export default function ComboCounter() {
  const game = useGame();
  const player = usePlayer();
  const isCompact = () => game.playerCount() > 2;

  // Every finished note produces a new event object, so keying on it replays the pop.
  const activeCombo = () => {
    const event = player.noteEvent();
    return event?.hit && event.combo >= MIN_VISIBLE_COMBO ? event : undefined;
  };

  const brokenCombo = () => {
    const event = player.noteEvent();
    return event && !event.hit && event.brokenCombo >= MIN_VISIBLE_COMBO ? event : undefined;
  };

  return (
    <div
      class="relative flex items-center"
      classList={{
        "text-lg": !isCompact(),
        "text-sm": isCompact(),
      }}
    >
      <Show when={activeCombo()} keyed>
        {(event) => (
          <div class="relative">
            <Show when={event.milestone}>
              <Burst
                trigger={event.id}
                color="white"
                shape="star"
                count={12}
                spread={5}
                size={0.8}
                class="top-1/2 left-1/2"
              />
            </Show>
            <div
              classList={{
                "animate-score-pop": !event.milestone,
                "animate-slam": event.milestone && effectsEnabled(),
              }}
            >
              <ComboChip>
                <span class="font-black tabular-nums" style={{ color: player.micColor(500) }}>
                  {event.combo}
                </span>
              </ComboChip>
            </div>
          </div>
        )}
      </Show>
      <Show when={brokenCombo()} keyed>
        {(event) => (
          <div class="animate-[shake_0.4s_ease-in-out,hide_0.3s_ease-in_0.6s_forwards] opacity-60 grayscale">
            <ComboChip>
              <span class="font-black text-white/80 tabular-nums line-through">{event.brokenCombo}</span>
            </ComboChip>
          </div>
        )}
      </Show>
    </div>
  );
}

/** Quiet stat chip: "Combo" and the count on a dark translucent box. */
function ComboChip(props: { children: JSX.Element }) {
  return (
    <div class="flex items-center gap-[0.4em] rounded-[0.5cqw] bg-black/65 px-[0.6em] py-[0.2em] leading-tight">
      <span class="font-semibold text-white/70">{t("game.combo")}</span>
      {props.children}
    </div>
  );
}

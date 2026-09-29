import { Show } from "solid-js";

import { effectsEnabled } from "~/lib/fx";
import { MIN_VISIBLE_COMBO } from "~/lib/game/combo";
import { useGame } from "~/lib/game/game-context";
import { usePlayer } from "~/lib/game/player-context";
import { t } from "~/lib/i18n";

import Burst from "../fx/burst";
import TagChip from "../fx/tag-chip";

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
        "text-2xl": !isCompact(),
        "text-base": isCompact(),
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
              <TagChip
                label={t("game.combo")}
                accent={<span class="tabular-nums">{event.combo}</span>}
                accentColor={player.micColor(500)}
              />
            </div>
          </div>
        )}
      </Show>
      <Show when={brokenCombo()} keyed>
        {(event) => (
          <div class="animate-[shake_0.4s_ease-in-out,hide_0.3s_ease-in_0.6s_forwards] opacity-60 grayscale">
            <TagChip
              label={t("game.combo")}
              accent={<span class="tabular-nums line-through">{event.brokenCombo}</span>}
              accentColor="var(--color-slate-600)"
            />
          </div>
        )}
      </Show>
    </div>
  );
}

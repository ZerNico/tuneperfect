import { createEffect, createSignal, on, onCleanup, Show } from "solid-js";

import { useGame } from "~/lib/game/game-context";
import { usePlayer } from "~/lib/game/player-context";
import { t } from "~/lib/i18n";
import type { PhraseRating as PhraseRatingTier } from "~/lib/utils/score";

import Burst from "../fx/burst";
import TagChip from "../fx/tag-chip";

const VISIBLE_MS = 1200;

export default function PhraseRating() {
  const player = usePlayer();
  const game = useGame();

  const [current, setCurrent] = createSignal<{ id: number; tier: PhraseRatingTier; bonus: boolean } | null>(null);

  createEffect(
    on(
      () => player.phraseRating(),
      (rating) => {
        if (!rating) {
          return;
        }

        setCurrent({ id: rating.id, tier: rating.rating, bonus: rating.bonus });

        const timer = setTimeout(() => {
          setCurrent((value) => (value?.id === rating.id ? null : value));
        }, VISIBLE_MS);

        onCleanup(() => clearTimeout(timer));
      },
      { defer: true },
    ),
  );

  const micColor = () => `var(--color-${player.microphone().color}-500)`;
  const isCompact = () => game.playerCount() > 2;

  const backgroundColor = (tier: PhraseRatingTier) => {
    switch (tier) {
      case "perfect":
        return "var(--color-yellow-400)";
      case "boo":
        return "var(--color-slate-600)";
      default:
        return micColor();
    }
  };

  return (
    <Show when={current()} keyed>
      {(rating) => (
        <div class="relative flex animate-phrase-rating flex-col items-center gap-[0.5cqh]">
          <Show when={rating.tier === "perfect"}>
            <Burst
              trigger={rating.id}
              color="var(--color-yellow-200)"
              shape="star"
              count={12}
              spread={6}
              size={1}
              class="top-1/2 left-1/2"
            />
          </Show>
          <div
            class="relative -skew-x-12 overflow-hidden rounded-lg px-[1.4cqw] py-[0.5cqh] text-white shadow-md backdrop-blur-sm"
            classList={{
              "text-3xl": !isCompact(),
              "text-2xl": isCompact(),
              // Perfect is fully golden with a glow; Boo is muted.
              "scale-110 shadow-[0_0_2cqw_rgba(251,191,36,0.95)]": rating.tier === "perfect",
              "opacity-70": rating.tier === "boo",
            }}
            style={{
              "background-color": backgroundColor(rating.tier),
            }}
          >
            <Show when={rating.tier === "perfect"}>
              <div
                class="pointer-events-none absolute inset-0 animate-shimmer"
                style={{
                  "background-image":
                    "linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, 0.6) 50%, transparent 70%)",
                  "animation-delay": "0.2s",
                }}
                aria-hidden="true"
              />
            </Show>
            <span class="relative inline-block skew-x-12 text-display">{t(`game.phraseRating.${rating.tier}`)}</span>
          </div>
          <Show when={rating.bonus}>
            <TagChip
              class="relative"
              classList={{
                "text-base": !isCompact(),
                "text-sm": isCompact(),
              }}
              label={`+${t("score.bonus")}`}
            />
          </Show>
        </div>
      )}
    </Show>
  );
}

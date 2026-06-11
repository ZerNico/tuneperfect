import { createEffect, createSignal, on, onCleanup, Show } from "solid-js";

import { useGame } from "~/lib/game/game-context";
import { usePlayer } from "~/lib/game/player-context";
import { t } from "~/lib/i18n";
import type { PhraseRating as PhraseRatingTier } from "~/lib/utils/score";

const VISIBLE_MS = 1200;

export default function PhraseRating() {
  const player = usePlayer();
  const game = useGame();

  const [current, setCurrent] = createSignal<{ id: number; tier: PhraseRatingTier } | null>(null);

  createEffect(
    on(
      () => player.phraseRating(),
      (rating) => {
        if (!rating) {
          return;
        }

        setCurrent({ id: rating.id, tier: rating.rating });

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
        <div
          class="relative animate-phrase-rating overflow-hidden rounded-full px-[1.4cqw] py-[0.5cqh] font-bold text-white uppercase shadow-md backdrop-blur-sm"
          classList={{
            "text-3xl": !isCompact(),
            "text-2xl": isCompact(),
            // Perfect is fully golden with a glow; Boo is muted.
            "scale-110 shadow-[0_0_2cqw_rgba(251,191,36,0.95)]": rating.tier === "perfect",
            "opacity-70": rating.tier === "boo",
          }}
          style={{
            "background-color": backgroundColor(rating.tier),
            "text-shadow": "0 0.1cqh 0.2cqh rgba(0, 0, 0, 0.4)",
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
          <span class="relative">{t(`game.phraseRating.${rating.tier}`)}</span>
        </div>
      )}
    </Show>
  );
}

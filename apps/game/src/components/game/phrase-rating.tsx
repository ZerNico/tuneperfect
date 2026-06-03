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
          class="animate-phrase-rating rounded-full px-[1.4cqw] py-[0.5cqh] font-bold text-white uppercase shadow-md backdrop-blur-sm"
          classList={{
            "text-3xl": !isCompact(),
            "text-2xl": isCompact(),
            // Perfect is fully golden with a glow; Boo is muted.
            "scale-110 shadow-[0_0_1.5cqw_rgba(251,191,36,0.85)]": rating.tier === "perfect",
            "opacity-70": rating.tier === "boo",
          }}
          style={{
            "background-color": backgroundColor(rating.tier),
            "text-shadow": "0 0.1cqh 0.2cqh rgba(0, 0, 0, 0.4)",
          }}
        >
          {t(`game.phraseRating.${rating.tier}`)}
        </div>
      )}
    </Show>
  );
}

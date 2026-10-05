import { safe } from "@orpc/client";
import { createEffect, createSignal, on, onCleanup } from "solid-js";

import HighscoreList, { type Highscore } from "~/components/highscore-list";
import { client } from "~/lib/orpc";
import { lobbyStore } from "~/stores/lobby";
import { localStore } from "~/stores/local";
import { settingsStore } from "~/stores/settings";

interface DebouncedHighscoreListProps {
  songHash: string;
}

export function DebouncedHighscoreList(props: DebouncedHighscoreListProps) {
  const [highscores, setHighscores] = createSignal<Highscore[]>([]);

  createEffect(
    on(
      () => props.songHash,
      () => {
        setHighscores([]);
        // A newer song (or unmounting) makes a pending request's answer stale.
        let stale = false;
        const timeout = setTimeout(async () => {
          const hash = props.songHash;
          if (!hash) return;

          const difficulty = settingsStore.general().difficulty;

          let onlineScores: Highscore[] = [];

          if (lobbyStore.lobby()) {
            const [error, data] = await safe(
              client.highscore.getHighscores.call({
                hash,
                difficulty,
              }),
            );

            if (!error) {
              onlineScores = data;
            }
          }

          if (stale) return;
          const localScores = localStore.getScoresForSong(hash, difficulty);
          const highscores = [...onlineScores, ...localScores];

          setHighscores(highscores);
        }, 1000);

        onCleanup(() => {
          stale = true;
          clearTimeout(timeout);
        });
      },
    ),
  );

  return (
    <div class="h-full transition-opacity duration-250" classList={{ "opacity-0": highscores().length === 0 }}>
      <HighscoreList scores={highscores()} class="w-[21cqw]" />
    </div>
  );
}

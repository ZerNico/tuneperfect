import { createEffect, createSignal, Show } from "solid-js";
import { useGame } from "~/lib/game/game-context";
import { createPlayer } from "~/lib/game/player";
import { beatToMs } from "~/lib/ultrastar/bpm";
import Avatar from "../ui/avatar";
import Pitch from "./pitch";
import Score from "./score";

interface PlayerLaneProps {
  index: number;
  playerCount: number;
  position: "top" | "bottom";
}

export default function PlayerLane(props: PlayerLaneProps) {
  const { PlayerProvider, player, phrase } = createPlayer(() => ({
    index: props.index,
  }));
  const game = useGame();

  const [shouldHide, setShouldHide] = createSignal(false);

  createEffect(() => {
    const p = phrase();
    const song = game.song();
    if (!p || !song || !game.started()) {
      setShouldHide(false);
      return;
    }

    const phraseStartBeat = p.notes[0]?.startBeat;
    if (phraseStartBeat === undefined) {
      setShouldHide(false);
      return;
    }

    const currentTimeMs = game.ms();
    const phraseStartMs = beatToMs(song, phraseStartBeat);
    const timeUntilPhraseMs = phraseStartMs - currentTimeMs;

    if (timeUntilPhraseMs > 20000) {
      setShouldHide(true);
    } else if (timeUntilPhraseMs <= 10000) {
      setShouldHide(false);
    }
  });

  return (
    <PlayerProvider>
      <div class="relative flex-1">
        <div
          class="relative flex h-full w-full"
          classList={{
            "opacity-0": shouldHide(),
            "transition-opacity duration-2000": !shouldHide(),
          }}
        >
          <Pitch playerCount={props.playerCount} />
        </div>
        <div
          class="absolute right-0 left-0 flex items-center justify-between px-20 py-4"
          classList={{
            "top-0": props.position === "bottom",
            "bottom-0": props.position === "top",
          }}
        >
          <div class="flex items-center gap-4">
            <Show when={player()}>
              {(player) => (
                <>
                  <Avatar user={player()} />
                  <span>{player()?.username}</span>
                </>
              )}
            </Show>
          </div>
          <Score />
        </div>
      </div>
    </PlayerProvider>
  );
}

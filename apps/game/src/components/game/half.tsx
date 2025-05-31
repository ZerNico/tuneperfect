import { Show, createEffect, createSignal } from "solid-js";
import { useGame } from "~/lib/game/game-context";
import { createPlayer } from "~/lib/game/player";
import { beatToMs } from "~/lib/ultrastar/bpm";
import Avatar from "../ui/avatar";
import Lyrics from "./lyrics";
import Pitch from "./pitch";
import Score from "./score";

interface HalfProps {
  index: number;
}

export default function Half(props: HalfProps) {
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
      <div class="relative">
        <div
          class="relative flex h-full w-full flex-col"
          classList={{
            "flex-col": props.index === 0,
            "flex-col-reverse": props.index === 1,
            "opacity-0": shouldHide(),
            "transition-opacity duration-2000": !shouldHide(),
          }}
        >
          <Lyrics />
          <Pitch />
        </div>
        <div
          class="absolute right-0 left-0 flex items-center justify-between px-20 py-4"
          classList={{
            "top-0": props.index === 1,
            "bottom-0": props.index === 0,
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

import { createEffect, createSignal, Show } from "solid-js";

import { MIN_VISIBLE_COMBO } from "~/lib/game/combo";
import { useGame } from "~/lib/game/game-context";
import { createPlayer } from "~/lib/game/player";
import { beatToMs } from "~/lib/ultrastar/bpm";

import Avatar from "../ui/avatar";
import SlantPanel from "../ui/slant-panel";
import ComboCounter from "./combo-counter";
import PhraseRating from "./phrase-rating";
import Pitch from "./pitch";
import Score from "./score";

interface PlayerLaneProps {
  index: number;
  position: "top" | "bottom";
}

export default function PlayerLane(props: PlayerLaneProps) {
  const playerState = createPlayer(() => ({
    index: props.index,
  }));
  const { PlayerProvider, player, phrase, combo, microphone } = playerState;
  const game = useGame();
  const isCompact = () => game.playerCount() > 2;

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

  // The lane edge heats up as the combo grows.
  const heat = () => {
    const value = combo();
    if (value >= 50) return 0.45;
    if (value >= 25) return 0.3;
    if (value >= 10) return 0.18;
    if (value >= MIN_VISIBLE_COMBO) return 0.08;
    return 0;
  };

  return (
    <PlayerProvider>
      <div class="relative flex-1">
        <div
          class="pointer-events-none absolute right-0 left-0 h-1/3 transition-opacity duration-700"
          classList={{
            "bottom-0": props.position === "top",
            "top-0": props.position === "bottom",
          }}
          style={{
            opacity: heat(),
            background: `linear-gradient(to ${props.position === "top" ? "top" : "bottom"}, var(--color-${microphone().color}-500), transparent)`,
          }}
        />
        <div
          class="relative flex h-full w-full"
          classList={{
            "opacity-0": shouldHide(),
            "transition-opacity duration-2000": !shouldHide(),
          }}
        >
          <Pitch />
        </div>
        <div class="pointer-events-none absolute top-1/2 right-[3cqw] -translate-y-1/2">
          <PhraseRating />
        </div>
        <div
          class="absolute right-0 left-0 flex items-center justify-between px-[3cqw]"
          classList={{
            "top-[1.5cqh]": props.position === "bottom",
            "bottom-[1.5cqh]": props.position === "top",
          }}
        >
          <Show when={player()}>
            {(player) => (
              <SlantPanel
                class="flex items-center gap-3 py-1.5 pr-5 pl-4"
                surface="overflow-hidden rounded-lg bg-black/55 shadow-[0.3cqw_0.3cqw_0_rgb(0_0_0/0.35)] backdrop-blur-sm"
                surfaceContent={
                  <span
                    class="absolute inset-y-0 left-0 w-[0.5cqw]"
                    style={{ background: `var(--color-${microphone().color}-400)` }}
                  />
                }
              >
                <div classList={{ "size-[2.6cqw]": !isCompact(), "size-[1.9cqw]": isCompact() }}>
                  <Avatar
                    user={player()}
                    class="size-full ring-white"
                    classList={{ "ring-[0.18cqw]": !isCompact(), "ring-[0.14cqw]": isCompact() }}
                  />
                </div>
                <span class="font-bold" classList={{ "text-xl": !isCompact(), "text-base": isCompact() }}>
                  {player().username}
                </span>
              </SlantPanel>
            )}
          </Show>
          <div
            class="flex items-center"
            classList={{
              "gap-4": !isCompact(),
              "gap-3": isCompact(),
            }}
          >
            <ComboCounter />
            <Score />
          </div>
        </div>
      </div>
    </PlayerProvider>
  );
}

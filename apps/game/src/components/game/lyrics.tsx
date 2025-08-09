import { Key } from "@solid-primitives/keyed";
import { createMemo, For, Show } from "solid-js";
import { useGame } from "~/lib/game/game-context";
import { usePlayer } from "~/lib/game/player-context";
import { msToBeatWithoutGap } from "~/lib/ultrastar/bpm";
import type { Note } from "~/lib/ultrastar/note";
import { clamp } from "~/lib/utils/math";

export default function Lyrics() {
  const game = useGame();
  const player = usePlayer();

  const leadInPercentage = createMemo(() => {
    const phrase = player.phrase();
    const song = game.song();
    if (!phrase || !song || !game.started()) {
      return;
    }

    const beat = game.beat();
    const startBeat = phrase.notes[0]?.startBeat;

    if (startBeat === undefined) {
      return;
    }

    const percentage = ((beat - startBeat) * -100) / msToBeatWithoutGap(song, 3000);

    return {
      end: percentage,
      start: percentage + 30,
    };
  });

  const micColor = () => `var(--color-${player.microphone().color}-500)`;

  return (
    <div
      class="w-full bg-black/70 transition-opacity duration-500"
      classList={{
        "opacity-0": !player.phrase(),
        "rounded-b-xl pt-[1.2cqh] pb-[0.8cqh]": player.index() === 0,
        "rounded-t-xl pb-[1.8cqh]": player.index() === 1,
      }}
    >
      <div class="grid grid-cols-[1fr_max-content_1fr]">
        <div class="pt-3 pr-1 pb-2">
          <Show when={leadInPercentage()}>
            {(percentage) => (
              <div
                style={{
                  "background-image": `linear-gradient(270deg, transparent ${percentage().end}%, ${micColor()} ${
                    percentage().end
                  }%, transparent ${percentage().start}%`,
                }}
                class="h-[50%] w-full"
              />
            )}
          </Show>
        </div>
        <div>
          <Key
            fallback={<span class="text-4xl text-transparent leading-relaxed">{"\u00A0"}</span>}
            each={player.phrase()?.notes}
            by={(note) => note.startBeat}
          >
            {(note) => <LyricsNote note={note()} micColor={micColor()} />}
          </Key>
        </div>
        <div />
      </div>
      <div class="text-center text-[40px] text-white/50">
        <For fallback={<span class="text-transparent">{"\u00A0"}</span>} each={player.nextPhrase()?.notes}>
          {(note) => (
            <span
              class="whitespace-nowrap"
              classList={{
                italic: note.type === "Freestyle",
              }}
            >
              {note.text}
            </span>
          )}
        </For>
      </div>
    </div>
  );
}

interface LyricsNoteProps {
  note: Note;
  micColor: string;
}
function LyricsNote(props: LyricsNoteProps) {
  const game = useGame();

  const percentage = createMemo(() => {
    const beat = game.beat();

    if (beat < props.note.startBeat) {
      return 0;
    }

    return clamp(((beat - props.note.startBeat) * 100) / props.note.length, 0, 100);
  });

  return (
    <span
      style={{
        "background-image": `linear-gradient(to right, ${props.micColor} ${percentage()}%, white ${percentage()}%)`,
      }}
      class="inline-block whitespace-pre bg-clip-text text-[80px] text-transparent leading-relaxed"
      classList={{
        "m-[-0.15cqw] p-[0.15cqw] italic": props.note.type === "Freestyle",
      }}
    >
      {props.note.text}
    </span>
  );
}

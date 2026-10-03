import { createMemo, For, Show } from "solid-js";

import { effectsEnabled } from "~/lib/fx";
import { useGame } from "~/lib/game/game-context";
import { createVoiceTracker } from "~/lib/game/voice-tracker";
import { msToBeatWithoutGap } from "~/lib/ultrastar/bpm";
import type { Note } from "~/lib/ultrastar/note";
import { getColorVar } from "~/lib/utils/color";
import { clamp } from "~/lib/utils/math";

interface LyricsProps {
  voiceIndex: number;
  /** Mic colour of the player singing this voice; white without one. */
  color?: string;
  position: "top" | "bottom";
}

export default function Lyrics(props: LyricsProps) {
  const game = useGame();
  const voiceTracker = createVoiceTracker(() => ({ voiceIndex: props.voiceIndex }));

  const leadInPercentage = createMemo(() => {
    const phrase = voiceTracker.phrase();
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

  const lyricsColor = () => (props.color ? getColorVar(props.color, 500) : "var(--color-white)");

  const isCompact = () => game.playerCount() > 2;

  return (
    <div
      class="w-full overflow-hidden bg-black/65 backdrop-blur-md transition-opacity duration-500"
      classList={{
        "opacity-0": !voiceTracker.phrase(),
        "rounded-b-2xl pt-[1.2cqh] pb-[0.8cqh]": props.position === "top" && !isCompact(),
        "rounded-t-2xl pt-[1.4cqh] pb-[1.8cqh]": props.position === "bottom" && !isCompact(),
        "rounded-b-2xl pt-[0.5cqh] pb-[0.3cqh]": props.position === "top" && isCompact(),
        "rounded-t-2xl pt-[0.6cqh] pb-[0.8cqh]": props.position === "bottom" && isCompact(),
      }}
    >
      {/* Keyed per phrase: the whole line, lead-in bar included, fades in. */}
      <Show
        when={voiceTracker.phrase()}
        keyed
        fallback={
          <span
            class="block text-center leading-snug text-transparent"
            classList={{ "text-[2.4cqw]": !isCompact(), "text-[1.9cqw]": isCompact() }}
          >
            {"\u00A0"}
          </span>
        }
      >
        {(phrase) => (
          <div class="grid grid-cols-[1fr_max-content_1fr]" classList={{ "animate-lyric-fade": effectsEnabled() }}>
            {/* Same text size as the line, so the bar sits level with the words at any size. */}
            <div
              class="flex items-center pr-[0.4em] leading-snug"
              classList={{ "text-[2.4cqw]": !isCompact(), "text-[1.9cqw]": isCompact() }}
            >
              <Show when={leadInPercentage()}>
                {(percentage) => (
                  <div
                    style={{
                      "background-image": `linear-gradient(270deg, transparent ${percentage().end}%, ${lyricsColor()} ${
                        percentage().end
                      }%, transparent ${percentage().start}%`,
                    }}
                    class="h-[0.8em] w-full"
                  />
                )}
              </Show>
            </div>
            <div>
              <For each={phrase.notes}>
                {(note) => <LyricsNote note={note} color={lyricsColor()} compact={isCompact()} />}
              </For>
            </div>
            <div />
          </div>
        )}
      </Show>
      <div class="text-center font-bold text-white/45" classList={{ "text-3xl": !isCompact(), "text-xl": isCompact() }}>
        <Show when={voiceTracker.nextPhrase()} keyed fallback={<span class="text-transparent">{"\u00A0"}</span>}>
          {(phrase) => (
            <div classList={{ "animate-lyric-fade": effectsEnabled() }}>
              <For each={phrase.notes}>
                {(note) => (
                  <span class="whitespace-nowrap" classList={{ italic: note.type === "Freestyle" }}>
                    {note.text}
                  </span>
                )}
              </For>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}

interface LyricsNoteProps {
  note: Note;
  color: string;
  compact?: boolean;
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
        "background-image": `linear-gradient(to right, ${props.color} ${percentage()}%, white ${percentage()}%)`,
      }}
      class="inline-block bg-clip-text leading-snug font-bold whitespace-pre text-transparent"
      classList={{
        "m-[-0.15cqw] p-[0.15cqw] italic": props.note.type === "Freestyle",
        "text-[2.4cqw]": !props.compact,
        "text-[1.9cqw]": props.compact,
      }}
    >
      {props.note.text}
    </span>
  );
}

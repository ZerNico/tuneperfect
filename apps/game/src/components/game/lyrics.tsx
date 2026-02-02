import { Key } from "@solid-primitives/keyed";
import { createMemo, For, Show } from "solid-js";
import { useGame } from "~/lib/game/game-context";
import { createVoiceTracker } from "~/lib/game/voice-tracker";
import { msToBeatWithoutGap } from "~/lib/ultrastar/bpm";
import type { Note } from "~/lib/ultrastar/note";
import { clamp } from "~/lib/utils/math";
import { roundStore } from "~/stores/round";
import { settingsStore } from "~/stores/settings";

interface LyricsProps {
  voiceIndex: number;
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

  const lyricsColor = createMemo(() => {
    const voiceAssignments = roundStore.settings()?.songs[0]?.voice || [];
    const playerIndex = voiceAssignments.findIndex((v) => v === props.voiceIndex);
    if (playerIndex === -1) {
      return "var(--color-white)";
    }
    const microphone = settingsStore.microphones()[playerIndex];
    return microphone ? `var(--color-${microphone.color}-500)` : "var(--color-white)";
  });

  const isCompact = () => game.playerCount() > 2;

  return (
    <div
      class="w-full bg-black/70 transition-opacity duration-500"
      classList={{
        "opacity-0": !voiceTracker.phrase(),
        "rounded-b-xl pt-[1.2cqh] pb-[0.8cqh]": props.position === "top" && !isCompact(),
        "rounded-t-xl pb-[1.8cqh]": props.position === "bottom" && !isCompact(),
        "rounded-b-xl pt-[0.8cqh] pb-[0.4cqh]": props.position === "top" && isCompact(),
        "rounded-t-xl pb-[1.2cqh]": props.position === "bottom" && isCompact(),
      }}
    >
      <div class="grid grid-cols-[1fr_max-content_1fr]">
        <div class="pt-3 pr-1 pb-2">
          <Show when={leadInPercentage()}>
            {(percentage) => (
              <div
                style={{
                  "background-image": `linear-gradient(270deg, transparent ${percentage().end}%, ${lyricsColor()} ${
                    percentage().end
                  }%, transparent ${percentage().start}%`,
                }}
                class="h-full w-full"
              />
            )}
          </Show>
        </div>
        <div>
          <Key
            fallback={
              <span
                class="text-transparent leading-relaxed"
                classList={{ "text-4xl": !isCompact(), "text-3xl": isCompact() }}
              >
                {"\u00A0"}
              </span>
            }
            each={voiceTracker.phrase()?.notes}
            by={(note) => note.startBeat}
          >
            {(note) => <LyricsNote note={note()} color={lyricsColor()} compact={isCompact()} />}
          </Key>
        </div>
        <div />
      </div>
      <div class="text-center text-white/50" classList={{ "text-3xl": !isCompact(), "text-2xl": isCompact() }}>
        <For fallback={<span class="text-transparent">{"\u00A0"}</span>} each={voiceTracker.nextPhrase()?.notes}>
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
      class="inline-block whitespace-pre bg-clip-text text-transparent leading-relaxed"
      classList={{
        "m-[-0.15cqw] p-[0.15cqw] italic": props.note.type === "Freestyle",
        "text-4xl": !props.compact,
        "text-3xl": props.compact,
      }}
    >
      {props.note.text}
    </span>
  );
}

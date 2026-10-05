import { createMemo, For, Show } from "solid-js";

import { effectsEnabled } from "~/lib/fx";
import { useGame } from "~/lib/game/game-context";
import { createVoiceTracker } from "~/lib/game/voice-tracker";
import { msToBeatWithoutGap } from "~/lib/ultrastar/bpm";
import type { Note } from "~/lib/ultrastar/note";
import { getColorVar } from "~/lib/utils/color";
import { clamp } from "~/lib/utils/math";

/** Length of the lead-in bar's fading tail, in % of the space left of the words. */
const LEAD_IN_TAIL = 30;

interface LyricsProps {
  voiceIndex: number;
  /** Mic colour of the player singing this voice; white without one. */
  color?: string;
  position: "top" | "bottom";
}

export default function Lyrics(props: LyricsProps) {
  const game = useGame();
  const voiceTracker = createVoiceTracker(() => ({ voiceIndex: props.voiceIndex }));

  // How far (in % of the bar's width) the lead-in's head is from the words: 100 three seconds before
  // the line, 0 when it starts. Only while it can be seen, so the line doesn't restyle all song long.
  const leadIn = createMemo(() => {
    const phrase = voiceTracker.phrase();
    const song = game.song();
    if (!phrase || !song || !game.started()) {
      return;
    }

    const startBeat = phrase.notes[0]?.startBeat;
    if (startBeat === undefined) {
      return;
    }

    const distance = ((startBeat - game.beat()) * 100) / msToBeatWithoutGap(song, 3000);
    return distance > -LEAD_IN_TAIL && distance < 100 ? distance : undefined;
  });

  const lyricsColor = () => (props.color ? getColorVar(props.color, 500) : "var(--color-white)");

  const isCompact = () => game.playerCount() > 2;

  return (
    <div
      class="w-full overflow-hidden bg-black/70 transition-opacity duration-500"
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
              <Show when={leadIn() !== undefined}>
                {/* A fixed gradient tail that slides in with a transform, so each frame only composites. */}
                <div class="relative h-[0.8em] w-full overflow-hidden">
                  <div
                    class="absolute inset-y-0 right-0"
                    style={{
                      width: `${LEAD_IN_TAIL}%`,
                      "background-image": `linear-gradient(to left, ${lyricsColor()}, transparent)`,
                      transform: `translateX(${(-(leadIn() ?? 0) * 100) / LEAD_IN_TAIL}%)`,
                    }}
                  />
                </div>
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

  // White words with a coloured copy on top, revealed by a clip: a gradient behind clipped text
  // would have to be rebuilt and repainted on every frame of the sung note.
  return (
    <span
      class="relative inline-block leading-snug font-bold whitespace-pre"
      classList={{
        "m-[-0.15cqw] p-[0.15cqw] italic": props.note.type === "Freestyle",
        "text-[2.4cqw]": !props.compact,
        "text-[1.9cqw]": props.compact,
      }}
    >
      {props.note.text}
      <Show when={percentage() > 0}>
        <span
          aria-hidden="true"
          class="absolute inset-0"
          classList={{ "p-[0.15cqw]": props.note.type === "Freestyle" }}
          style={{ color: props.color, "clip-path": `inset(0 ${100 - percentage()}% 0 0)` }}
        >
          {props.note.text}
        </span>
      </Show>
    </span>
  );
}

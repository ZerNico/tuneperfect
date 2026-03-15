import { type Accessor, createEffect, createMemo, createSignal } from "solid-js";
import { roundStore } from "~/stores/round";
import { useGame } from "./game-context";

interface CreateVoiceTrackerOptions {
  voiceIndex: number;
}

export function createVoiceTracker(options: Accessor<CreateVoiceTrackerOptions>) {
  const game = useGame();
  const roundSong = () => roundStore.settings()?.songs[0];

  const voice = createMemo(() => {
    const voiceIdx = options().voiceIndex;
    return roundSong()?.song.voices[voiceIdx];
  });

  const [phraseIndex, setPhraseIndex] = createSignal(0);

  const phrase = createMemo(() => {
    return voice()?.phrases[phraseIndex()];
  });

  const nextPhrase = createMemo(() => {
    return voice()?.phrases[phraseIndex() + 1];
  });

  createEffect(() => {
    const p = phrase();
    if (!p) return;

    if (game.beat() >= p.disappearBeat) {
      setPhraseIndex((i) => i + 1);
    }
  });

  return {
    voice,
    phrase,
    nextPhrase,
    phraseIndex,
  };
}

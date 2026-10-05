import { type Accessor, createEffect, createMemo, createSignal, untrack } from "solid-js";

import { roundStore } from "~/stores/round";

import { useGame } from "./game-context";

interface CreateVoiceTrackerOptions {
  voiceIndex: number | undefined;
}

/** Follows one voice of the current song: the phrase being sung and the one after it. */
export function createVoiceTracker(options: Accessor<CreateVoiceTrackerOptions>) {
  const game = useGame();
  const roundSong = () => roundStore.settings()?.songs[0];

  const voice = createMemo(() => {
    const voiceIndex = options().voiceIndex;
    if (voiceIndex === undefined) {
      return undefined;
    }

    return roundSong()?.song.voices[voiceIndex];
  });

  const [phraseIndex, setPhraseIndex] = createSignal(0);

  const phrase = createMemo(() => {
    return voice()?.phrases[phraseIndex()];
  });

  const nextPhrase = createMemo(() => {
    return voice()?.phrases[phraseIndex() + 1];
  });

  // Runs every frame, but only notifies when the phrase is over.
  const phraseOver = createMemo(() => {
    const p = phrase();
    return !!p && game.beat() >= p.disappearBeat;
  });

  createEffect(() => {
    if (!phraseOver()) return;

    // Skip every phrase that is already over (e.g. after a seek), so the flag flips back.
    untrack(() => {
      const phrases = voice()?.phrases ?? [];
      const beat = game.beat();
      let index = phraseIndex();
      while ((phrases[index]?.disappearBeat ?? Infinity) <= beat) index++;
      setPhraseIndex(index);
    });
  });

  return {
    voice,
    phrase,
    nextPhrase,
  };
}

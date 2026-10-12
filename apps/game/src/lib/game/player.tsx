import { ReactiveMap } from "@solid-primitives/map";
import { type Accessor, createEffect, createMemo, createSignal, type JSX, on, untrack } from "solid-js";

import { roundStore } from "~/stores/round";
import { type Microphone, settingsStore } from "~/stores/settings";

import { msToBeatWithoutGap } from "../ultrastar/bpm";
import { type ColorShade, getColorVar } from "../utils/color";
import { getMaxScore, type PhraseRating } from "../utils/score";
import { useGame } from "./game";
import { type NoteEvent, PlayerContext, type PlayerContextValue, type ProcessedBeat } from "./player-context";
import { beatsToProcess, isMeasuredBeat, lastFinishedBeat } from "./score-loop";
import { ScoringSession } from "./scoring";
import { createVoiceTracker } from "./voice-tracker";

interface CreatePlayerOptions {
  index: number;
}

export { usePlayer } from "./player-context";

const FALLBACK_MICROPHONE: Microphone = { name: "", channel: 0, color: "sky", delay: 0, gain: 1, threshold: 1 };

export function createPlayer(options: Accessor<CreatePlayerOptions>) {
  const game = useGame();
  const roundSong = () => roundStore.settings()?.songs[0];

  const { voice, phrase } = createVoiceTracker(() => ({
    voiceIndex: roundSong()?.players[options().index]?.voice,
  }));

  const maxScore = createMemo(() => {
    const v = voice();
    if (!v) {
      return {
        normal: 0,
        golden: 0,
        bonus: 0,
      };
    }

    return getMaxScore(v);
  });

  // The round can be reset while the lanes are still mounted; fall back instead of throwing inside the memo.
  const microphone = createMemo(() => roundSong()?.players[options().index]?.microphone ?? FALLBACK_MICROPHONE);
  const micColor = (shade: ColorShade) => getColorVar(microphone().color, shade);

  const delayedBeat = createMemo(() => {
    const song = game.song();
    if (!song) {
      return 0;
    }
    const delayInBeats = msToBeatWithoutGap(song, microphone().delay);

    return game.beat() - delayInBeats;
  });

  const finishedBeat = createMemo(() => lastFinishedBeat(delayedBeat()));

  const processedBeats = new ReactiveMap<number, ProcessedBeat>();
  const [combo, setCombo] = createSignal(0);
  const [noteEvent, setNoteEvent] = createSignal<NoteEvent | null>(null);
  let noteEventId = 0;
  const [phraseRating, setPhraseRating] = createSignal<{ id: number; rating: PhraseRating; bonus: boolean } | null>(
    null,
  );
  let phraseRatingId = 0;

  const scoring = createMemo(() => {
    const session: ScoringSession = new ScoringSession(
      voice(),
      untrack(() => settingsStore.general().difficulty),
      {
        score: (type, value) => game.addScore(options().index, type, value),
        beat: (beat, processed) => processedBeats.set(beat, processed),
        note: (outcome) => {
          setCombo(outcome.combo);
          setNoteEvent({ id: noteEventId++, ...outcome });
          game.setPlayerStats(options().index, session.stats());
        },
        phrase: (rating, bonus) => {
          setPhraseRating({ id: phraseRatingId++, rating, bonus });
          game.setPlayerStats(options().index, session.stats());
        },
      },
    );
    return session;
  });
  const processBeat = (beat: number, hz: number) => untrack(scoring).scoreBeat(beat, hz);

  /** `null` until the first pitch update; beats can be negative, so no number works as "not started". */
  let lastProcessedBeat: number | null = null;

  createEffect(
    on(
      () => game.pitches(),
      (allPitches) => {
        // The sample describes the audio just before it was taken, shifted by this mic's delay:
        // score the beats that have finished in delayed time.
        // Once the song is over and its delay tail has been waited out, the beat in progress at
        // the end counts too.
        const ending = game.finishing?.() ?? false;
        const lastFinished = ending ? Math.floor(game.beat()) : finishedBeat();

        // First update: start at the current beat instead of back-filling from
        // the song start (e.g. when a player joins mid-song).
        const from = lastProcessedBeat ?? lastFinished - 1;
        if (lastFinished <= from) {
          return;
        }

        const pitch = allPitches[options().index] ?? -1;

        for (const beatNumber of beatsToProcess(from, lastFinished)) {
          processBeat(beatNumber, ending || isMeasuredBeat(beatNumber, lastFinished) ? pitch : -1);
        }

        lastProcessedBeat = lastFinished;
      },
    ),
  );

  const score = () => game.scores()[options().index] ?? { normal: 0, golden: 0, bonus: 0 };
  const player = () => roundSong()?.players[options().index]?.player ?? null;

  const values: PlayerContextValue = {
    index: () => options().index,
    voice,
    phrase,
    microphone,
    micColor,
    delayedBeat,
    processedBeats,
    maxScore,
    player,
    score,
    phraseRating,
    combo,
    noteEvent,
  };

  const Provider = (props: { children: JSX.Element }) => (
    <PlayerContext.Provider value={values}>{props.children}</PlayerContext.Provider>
  );

  return {
    ...values,
    PlayerProvider: Provider,
  };
}

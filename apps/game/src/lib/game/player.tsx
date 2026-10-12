import { ReactiveMap } from "@solid-primitives/map";
import { type Accessor, createEffect, createMemo, createSignal, type JSX, on, onCleanup, untrack } from "solid-js";

import { roundStore } from "~/stores/round";
import { type Microphone, settingsStore } from "~/stores/settings";

import { beatToMs, beatToMsWithoutGap, msToBeatWithoutGap } from "../ultrastar/bpm";
import { type ColorShade, getColorVar } from "../utils/color";
import { getMaxScore, type PhraseRating } from "../utils/score";
import { beatPitch } from "./beat-pitch";
import { useGame } from "./game";
import { type NoteEvent, PlayerContext, type PlayerContextValue, type ProcessedBeat } from "./player-context";
import { beatsToProcess, isBeatCovered, isMeasuredBeat, lastFinishedBeat } from "./score-loop";
import { ScoringSession } from "./scoring";
import { compareScoringEnabled, createScoringComparison } from "./scoring-comparison";
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

  const difficulty = untrack(() => settingsStore.general().difficulty);
  const comparison = compareScoringEnabled() ? createScoringComparison(untrack(options).index) : undefined;
  onCleanup(() => comparison?.report());

  const scoring = createMemo(() => {
    const session: ScoringSession = new ScoringSession(voice(), difficulty, {
      score: (type, value) => {
        game.addScore(options().index, type, value);
        comparison?.score("stream", value);
      },
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
    });
    return session;
  });
  const processBeat = (beat: number, hz: number) => {
    // Scored first: `comparison?.beat(…)` wouldn't evaluate its arguments without a comparison.
    const correct = untrack(scoring).scoreBeat(beat, hz);
    comparison?.beat("stream", beat, correct);
  };

  /** `null` until scoring starts; beats can be negative, so no number works as "not started". */
  let lastScoredBeat: number | null = null;
  const [scoredBeat, setScoredBeat] = createSignal<number | null>(null);

  // Each beat is scored with the pitch stream's frames from its end, once they've arrived: in this
  // mic's delayed time, the voice for a beat comes `delay` ms after it.
  createEffect(() => {
    const nowMs = game.ms();
    const song = game.song();
    if (!song || !game.started()) return;

    // Once the song is over and its delay tail has been waited out, the beat in progress at the
    // end counts too.
    const ending = game.finishing?.() ?? false;
    const target = ending ? Math.floor(game.beat()) : finishedBeat();
    // Start at the current beat instead of back-filling from the song start (e.g. a player
    // joining mid-song). Nothing is scored twice after a seek back.
    const from = lastScoredBeat ?? target - 1;
    if (target <= from) return;
    lastScoredBeat = from;

    untrack(() => {
      const timeline = game.pitchTimeline?.(options().index);
      const latest = timeline?.latest()?.time;
      const delay = microphone().delay;
      const beatMs = beatToMsWithoutGap(song, 1);
      for (let beat = from + 1; beat <= target; beat++) {
        const endMs = beatToMs(song, beat + 1) + delay;
        if (!ending && !isBeatCovered(endMs, latest, nowMs)) break;
        processBeat(beat, beatPitch(timeline, endMs, beatMs));
        lastScoredBeat = beat;
      }
      setScoredBeat(lastScoredBeat);
    });
  });

  if (comparison) {
    // The per-beat pitch requests scoring used before, on the side.
    const legacy = createMemo(
      () =>
        new ScoringSession(voice(), difficulty, {
          score: (_type, value) => comparison.score("legacy", value),
          beat: () => {},
          note: () => {},
          phrase: () => {},
        }),
    );
    let lastProcessedBeat: number | null = null;
    createEffect(
      on(
        () => game.pitches(),
        (allPitches) => {
          const ending = game.finishing?.() ?? false;
          const lastFinished = ending ? Math.floor(game.beat()) : finishedBeat();
          const from = lastProcessedBeat ?? lastFinished - 1;
          if (lastFinished <= from) return;

          const pitch = allPitches[options().index] ?? -1;
          for (const beat of beatsToProcess(from, lastFinished)) {
            const hz = ending || isMeasuredBeat(beat, lastFinished) ? pitch : -1;
            comparison.beat("legacy", beat, untrack(legacy).scoreBeat(beat, hz));
          }
          lastProcessedBeat = lastFinished;
        },
      ),
    );
  }

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
    scoredBeat,
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

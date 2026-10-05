import { ReactiveMap } from "@solid-primitives/map";
import { type Accessor, createEffect, createMemo, createSignal, type JSX, on } from "solid-js";

import { createEmptyStats, roundStore } from "~/stores/round";
import { type Microphone, settingsStore } from "~/stores/settings";

import { msToBeatWithoutGap } from "../ultrastar/bpm";
import { isGolden, isRap, type Note } from "../ultrastar/note";
import { type ColorShade, getColorVar } from "../utils/color";
import { getMaxScore, getNoteScore, getPhraseRating, type PhraseRating } from "../utils/score";
import { createComboTracker } from "./combo";
import { useGame } from "./game";
import { PitchProcessor } from "./pitch";
import { type NoteEvent, PlayerContext, type PlayerContextValue, type ProcessedBeat } from "./player-context";
import { beatsToProcess, isMeasuredBeat, lastFinishedBeat } from "./score-loop";
import { createVoiceTracker } from "./voice-tracker";

interface CreatePlayerOptions {
  index: number;
}

export { usePlayer } from "./player-context";

const FALLBACK_MICROPHONE: Microphone = { name: "", channel: 0, color: "sky", delay: 0, gain: 1, threshold: 1 };

export function createPlayer(options: Accessor<CreatePlayerOptions>) {
  const pitchProcessor = new PitchProcessor(settingsStore.general().difficulty);
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

  const beats = createMemo(() => {
    const beatMap = new Map<
      number,
      { note: Note; isLastInPhrase: boolean; isFirstInNote: boolean; isLastInNote: boolean }
    >();
    for (const phrase of voice()?.phrases || []) {
      for (const [noteIndex, note] of phrase.notes.entries()) {
        const isLastNoteInPhrase = noteIndex === phrase.notes.length - 1;

        for (let i = 0; i < note.length; i++) {
          const isLastBeatInNote = i === note.length - 1;

          beatMap.set(note.startBeat + i, {
            note,
            isLastInPhrase: isLastNoteInPhrase && isLastBeatInNote,
            isFirstInNote: i === 0,
            isLastInNote: isLastBeatInNote,
          });
        }
      }
    }

    return beatMap;
  });

  const processedBeats = new ReactiveMap<number, ProcessedBeat>();

  let correctBeats = 0;
  let totalBeats = 0;

  let noteCorrectBeats = 0;
  let noteTotalBeats = 0;

  const comboTracker = createComboTracker();
  const [combo, setCombo] = createSignal(0);
  const [noteEvent, setNoteEvent] = createSignal<NoteEvent | null>(null);
  let noteEventId = 0;

  const stats = createEmptyStats();
  const publishStats = () => {
    stats.maxCombo = comboTracker.maxCombo();
    game.setPlayerStats(options().index, { ...stats });
  };

  const finishNote = (note: Note) => {
    const outcome = comboTracker.noteFinished(noteCorrectBeats, noteTotalBeats);
    noteCorrectBeats = 0;
    noteTotalBeats = 0;

    if (!outcome) {
      return;
    }

    const golden = isGolden(note);
    stats.notesTotal++;
    if (golden) stats.goldenNotesTotal++;
    if (outcome.hit) {
      stats.notesHit++;
      if (golden) stats.goldenNotesHit++;
    }

    setCombo(outcome.combo);
    setNoteEvent({ id: noteEventId++, ...outcome });
    publishStats();
  };

  const [phraseRating, setPhraseRating] = createSignal<{ id: number; rating: PhraseRating; bonus: boolean } | null>(
    null,
  );
  let phraseRatingId = 0;

  const awardBonus = () => {
    const bonus = totalBeats > 0 && correctBeats / totalBeats > 0.9;
    if (bonus) {
      addScore("bonus", correctBeats);
    }

    const rating = getPhraseRating(correctBeats, totalBeats);
    if (rating) {
      setPhraseRating({ id: phraseRatingId++, rating, bonus });
      stats.phrasesTotal++;
      if (rating === "perfect") stats.perfectPhrases++;
      publishStats();
    }

    correctBeats = 0;
    totalBeats = 0;
  };

  const processBeat = (beatNumber: number, pitch: number) => {
    const beatInfo = beats().get(beatNumber);

    if (!beatInfo) {
      return;
    }

    const noteScore = getNoteScore(beatInfo.note);

    if (beatInfo.isFirstInNote) {
      // A seek can skip a note's last beat; never carry counts into the next note.
      noteCorrectBeats = 0;
      noteTotalBeats = 0;
    }

    if (noteScore > 0) {
      totalBeats++;
      noteTotalBeats++;

      const { midiNote, rawMidiNote } = pitchProcessor.process(pitch, beatInfo.note);

      const rap = isRap(beatInfo.note);

      const isCorrect = rap ? midiNote > 0 : midiNote === beatInfo.note.midiNote;

      if (isCorrect) {
        correctBeats++;
        noteCorrectBeats++;

        // noteScore > 0 rules out freestyle, so every other note is normal.
        addScore(isGolden(beatInfo.note) ? "golden" : "normal", noteScore);
      }

      if (midiNote > 0) {
        processedBeats.set(beatNumber, {
          note: beatInfo.note,
          midiNote: rap ? beatInfo.note.midiNote : midiNote,
          rawMidiNote: rap ? beatInfo.note.midiNote : rawMidiNote,
          isFirstInNote: beatInfo.isFirstInNote,
        });
      }
    }

    if (beatInfo.isLastInNote && noteScore > 0) {
      finishNote(beatInfo.note);
    }

    if (beatInfo.isLastInPhrase) {
      awardBonus();
    }
  };

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

  const addScore = (type: "normal" | "golden" | "bonus", value: number) => {
    game.addScore(options().index, type, value);
  };

  const score = () => game.scores()[options().index] ?? { normal: 0, golden: 0, bonus: 0 };
  const player = () => roundSong()?.players[options().index]?.player ?? null;

  const values: PlayerContextValue = {
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

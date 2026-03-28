import createRAF from "@solid-primitives/raf";
import { type Accessor, batch, createEffect, createSignal, type JSX } from "solid-js";

import { commands } from "~/bindings";
import type { SongPlayerRef } from "~/components/song-player";
import { beatToMs, beatToMsWithoutGap, msToBeat } from "~/lib/ultrastar/bpm";
import type { Song } from "~/lib/ultrastar/song";
import { roundStore, type Score } from "~/stores/round";
import { settingsStore } from "~/stores/settings";

import { type GameContextValue, GameProvider } from "./game-context";

export interface CreateGameOptions {
  songPlayerRef?: SongPlayerRef;
  song?: Song;
}

export { useGame } from "./game-context";

export function createGame(options: Accessor<CreateGameOptions>) {
  const [ms, setMs] = createSignal(0);
  const [beat, setBeat] = createSignal(0);
  const [started, setStarted] = createSignal(false);
  const [playing, setPlaying] = createSignal(false);
  const [currentTime, setCurrentTime] = createSignal(0);
  const [duration, setDuration] = createSignal(0);
  const [scores, setScores] = createSignal<Score[]>([]);
  const [preferInstrumental, setPreferInstrumental] = createSignal(
    settingsStore.general().audioMode === "preferInstrumental",
  );
  const [pitches, setPitches] = createSignal<number[]>([]);

  const start = async () => {
    const opts = options();

    if (!opts.song) {
      throw new Error("No song provided");
    }

    await commands.startRecording(
      roundStore.settings()?.songs[0]?.players.map((p) => p?.microphone) ?? [],
      settingsStore.general().micPlaybackEnabled,
      settingsStore.volume().micPlayback,
    );

    setStarted(true);
    setPlaying(true);

    return true;
  };

  const stop = async () => {
    await commands.stopRecording();
  };

  const pause = () => {
    setPlaying(false);
  };

  const resume = () => {
    setPlaying(true);
  };

  const skip = () => {
    const opts = options();
    const currentSong = opts.song;
    const playerRef = opts.songPlayerRef;

    if (!currentSong || !playerRef) {
      return;
    }

    const currentTimeMs = playerRef.getCurrentTime() * 1000;

    const usedVoices =
      roundStore
        .settings()
        ?.songs[0]?.players.filter(Boolean)
        .map((p) => p?.voice) ?? [];

    for (const voiceIndex of usedVoices) {
      if (voiceIndex === undefined) continue;

      const voice = currentSong.voices[voiceIndex];
      if (!voice) continue;

      for (const phrase of voice.phrases) {
        for (const note of phrase.notes) {
          if (note.type === "Freestyle") continue;

          const noteStartMs = beatToMs(currentSong, note.startBeat);
          const noteEndMs = beatToMs(currentSong, note.startBeat + note.length);

          if (currentTimeMs >= noteStartMs && currentTimeMs < noteEndMs) {
            // is currently singing
            return;
          }
        }
      }
    }

    let nextNoteTime: number | null = null;

    for (const voiceIndex of usedVoices) {
      if (voiceIndex === undefined) continue;
      const voice = currentSong.voices[voiceIndex];
      if (!voice) continue;

      for (const phrase of voice.phrases) {
        for (const note of phrase.notes) {
          if (note.type === "Freestyle") continue;

          const noteStartMs = beatToMs(currentSong, note.startBeat);

          if (noteStartMs > currentTimeMs) {
            if (nextNoteTime === null || noteStartMs < nextNoteTime) {
              nextNoteTime = noteStartMs;
            }
          }
        }
      }
    }

    if (nextNoteTime !== null && nextNoteTime - currentTimeMs > 5000) {
      const targetTime = Math.max(0, (nextNoteTime - 5000) / 1000);
      playerRef.setCurrentTime(targetTime);
    }
  };

  const [_, startLoop, stopLoop] = createRAF(() => {
    const opts = options();
    if (!opts.songPlayerRef || !opts.song) {
      return;
    }

    const currentTime = opts.songPlayerRef.getCurrentTime();
    const duration = opts.songPlayerRef.getDuration();
    const outputLatency = settingsStore.general().outputLatency;
    const ms = currentTime * 1000 + outputLatency;
    const beat = msToBeat(opts.song, ms);

    batch(() => {
      setMs(ms);
      setBeat(beat);
      setCurrentTime(currentTime);
      setDuration(duration);
    });
  });

  const flooredBeat = () => Math.floor(beat());

  createEffect(() => {
    flooredBeat();
    if (!started() || !playing()) return;

    const song = options().song;
    if (!song) return;

    // One beat as the analysis window; Rust converts to samples and clamps it.
    const windowMs = beatToMsWithoutGap(song, 1);

    void (async () => {
      const result = await commands.getPitches(windowMs);
      if (result.status === "ok") {
        setPitches(result.data);
      }
    })();
  });

  createEffect(() => {
    if (!started()) {
      return;
    }

    if (playing()) {
      startLoop();
    } else {
      stopLoop();
    }
  });

  const playerCount = () => roundStore.settings()?.songs[0]?.players.filter(Boolean).length ?? 0;

  const addScore = (index: number, type: "normal" | "golden" | "bonus", value: number) => {
    setScores((prev) => {
      const newScores = [...prev];
      for (let i = 0; i <= index; i++) {
        if (!newScores[i]) {
          newScores[i] = { normal: 0, golden: 0, bonus: 0 };
        }
      }
      if (newScores[index]) {
        newScores[index][type] += value;
      }
      return newScores;
    });
  };

  const values: GameContextValue = {
    start,
    stop,
    pause,
    resume,
    skip,
    started,
    playing,
    ms,
    beat,
    song: () => options().song,
    currentTime,
    duration,
    scores,
    addScore,
    resetScores: () => setScores([]),
    preferInstrumental,
    setPreferInstrumental,
    pitches,
    playerCount,
  };

  const Provider = (props: { children: JSX.Element }) => <GameProvider value={values}>{props.children}</GameProvider>;

  return {
    GameProvider: Provider,
    ...values,
  };
}

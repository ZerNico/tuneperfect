import createRAF from "@solid-primitives/raf";
import { type Accessor, batch, createEffect, createMemo, createSignal, type JSX, untrack } from "solid-js";

import type { SongPlayerRef } from "~/components/song-player";
import { native } from "~/lib/native/client";
import { logPerfReport, pauseFrames, recordFrame, timeCall } from "~/lib/perf";
import { beatToMs, beatToMsWithoutGap, msToBeat, msToBeatWithoutGap } from "~/lib/ultrastar/bpm";
import type { Song } from "~/lib/ultrastar/song";
import { createEmptyStats, type PlayerStats, roundStore, type Score } from "~/stores/round";
import { settingsStore } from "~/stores/settings";

import { GameContext, type GameContextValue } from "./game-context";

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
  const [stats, setStats] = createSignal<PlayerStats[]>([]);
  const [preferInstrumental, setPreferInstrumental] = createSignal(
    settingsStore.general().audioMode === "preferInstrumental",
  );
  const [pitches, setPitches] = createSignal<(number | null)[]>([]);

  // Recording is started and stopped across the Electron boundary, so the screen can leave while
  // `start` is still in flight. `stop` waits for it and only stops a recorder that actually came up.
  let recording: Promise<boolean> | undefined;
  let disposed = false;

  const stopRecording = () =>
    native.recording.stop().catch((error) => console.error("Failed to stop recording:", error));

  const start = async () => {
    const opts = options();

    if (!opts.song) {
      throw new Error("No song provided");
    }
    if (disposed) return false;

    recording = native.recording
      .start({
        microphones: roundStore.settings()?.songs[0]?.players.map((p) => p?.microphone) ?? [],
        playbackEnabled: settingsStore.general().micPlaybackEnabled,
        playbackVolume: settingsStore.volume().micPlayback,
      })
      .then(() => true);
    await recording;

    if (disposed) {
      await stopRecording();
      return false;
    }

    setStarted(true);
    setPlaying(true);

    return true;
  };

  const stop = async () => {
    disposed = true;
    const started = await recording?.catch(() => false);
    if (started) await stopRecording();
    logPerfReport();
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
    recordFrame();
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

  const song = createMemo(() => options().song);

  // Each player scores a beat once it has finished in their mic's delayed time, so a pitch is
  // requested whenever one of those delayed beats ticks over: once per beat when all mics share a
  // delay, instead of once per frame. Summing the floored beats changes whenever any of them does.
  const micDelays = createMemo(
    () => [...new Set(roundStore.settings()?.songs[0]?.players.map((p) => p?.microphone.delay ?? 0) ?? [0])],
    [],
    { equals: (a, b) => a.length === b.length && a.every((delay, i) => delay === b[i]) },
  );
  const pitchTick = createMemo(() => {
    const s = song();
    if (!s) return 0;
    const b = beat();
    let tick = 0;
    for (const delay of micDelays()) tick += Math.floor(b - msToBeatWithoutGap(s, delay));
    return tick;
  });

  // A slow response must not overwrite a newer one.
  let latestPitchRequest = 0;
  let appliedPitchRequest = 0;

  createEffect(() => {
    pitchTick();
    if (!started() || !playing()) return;

    const current = untrack(song);
    if (!current) return;

    // One beat as the analysis window; Rust converts to samples and clamps it.
    const windowMs = beatToMsWithoutGap(current, 1);

    const request = ++latestPitchRequest;
    void (async () => {
      try {
        const result = await timeCall("getPitches", () => native.pitch.get({ windowMs }));
        if (request < appliedPitchRequest) return;
        appliedPitchRequest = request;
        setPitches(result);
      } catch (error) {
        console.error("Failed to get pitches:", error);
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
      pauseFrames();
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
      const current = newScores[index];
      if (current) {
        // A new object: the previous array must not change under anyone still holding it.
        newScores[index] = { ...current, [type]: current[type] + value };
      }
      return newScores;
    });
  };

  const setPlayerStats = (index: number, playerStats: PlayerStats) => {
    setStats((prev) => {
      const newStats = [...prev];
      for (let i = 0; i < index; i++) {
        newStats[i] ??= createEmptyStats();
      }
      newStats[index] = playerStats;
      return newStats;
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
    song,
    currentTime,
    duration,
    scores,
    addScore,
    stats,
    setPlayerStats,
    preferInstrumental,
    setPreferInstrumental,
    pitches,
    playerCount,
  };

  const Provider = (props: { children: JSX.Element }) => (
    <GameContext.Provider value={values}>{props.children}</GameContext.Provider>
  );

  return {
    GameProvider: Provider,
    ...values,
  };
}

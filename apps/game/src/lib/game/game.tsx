import createRAF from "@solid-primitives/raf";
import { type Accessor, batch, createEffect, createSignal, type JSX } from "solid-js";
import { commands } from "~/bindings";
import type { SongPlayerRef } from "~/components/song-player";
import { beatToMsWithoutGap, msToBeat } from "~/lib/ultrastar/bpm";
import type { LocalSong } from "~/lib/ultrastar/parser/local";
import type { Score } from "~/stores/round";
import { settingsStore } from "~/stores/settings";
import { type GameContextValue, GameProvider } from "./game-context";

export interface CreateGameOptions {
  songPlayerRef?: SongPlayerRef;
  song?: LocalSong;
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

  const start = async () => {
    const opts = options();

    if (!opts.song) {
      throw new Error("No song provided");
    }

    const samplesPerBeat = Math.floor((48000 * beatToMsWithoutGap(opts.song, 1)) / 1000);
    await commands.startRecording(settingsStore.microphones(), samplesPerBeat);

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

  const [_, startLoop, stopLoop] = createRAF(() => {
    const opts = options();
    if (!opts.songPlayerRef || !opts.song) {
      return;
    }

    const currentTime = opts.songPlayerRef.getCurrentTime();
    const duration = opts.songPlayerRef.getDuration();
    const ms = currentTime * 1000;
    const beat = msToBeat(opts.song, ms);

    batch(() => {
      setMs(ms);
      setBeat(beat);
      setCurrentTime(currentTime);
      setDuration(duration);
    });
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
    started,
    playing,
    ms,
    beat,
    song: () => options().song,
    currentTime,
    duration,
    scores,
    addScore,
  };

  const Provider = (props: { children: JSX.Element }) => <GameProvider value={values}>{props.children}</GameProvider>;

  return {
    GameProvider: Provider,
    ...values,
  };
}

import { type Accessor, type JSX, createContext, createEffect, createMemo, createSignal, useContext } from "solid-js";
import type { Phrase } from "~/lib/ultrastar/phrase";
import { useGame } from "./game";

interface CreatePlayerOptions {
  index: number;
}

interface PlayerContextValue {
  index: Accessor<number>;
  phraseIndex: Accessor<number>;
  phrase: Accessor<Phrase | undefined>;
  nextPhrase: Accessor<Phrase | undefined>;
}

const PlayerContext = createContext<PlayerContextValue>();

export function createPlayer(options: Accessor<CreatePlayerOptions>) {
  const game = useGame();

  const voice = createMemo(() => {
    return game.song()?.voices[0];
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
    if (!p) {
      return;
    }

    if (game.beat() >= p.disappearBeat) {
      setPhraseIndex((i) => i + 1);
    }
  });

  const PlayerProvider = (props: { children: JSX.Element }) => (
    <PlayerContext.Provider
      value={{
        index: () => options().index,
        phraseIndex,
        phrase,
        nextPhrase,
      }}
    >
      {props.children}
    </PlayerContext.Provider>
  );

  return {
    index: () => options().index,
    PlayerProvider,
    phrase,
    nextPhrase,
    phraseIndex,
  };
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }

  return context;
}

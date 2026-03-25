import type { GameClient } from "@tuneperfect/webrtc/contracts/game";
import { createContext, createMemo, type JSX, useContext } from "solid-js";

interface GameClientContextType {
  client: GameClient;
}

const GameClientContext = createContext<GameClientContextType>();

export function GameClientProvider(props: { client: GameClient; children: JSX.Element }) {
  const value = createMemo(() => ({ client: props.client }));

  // oxlint-disable-next-line solid/reactivity
  return <GameClientContext.Provider value={value()}>{props.children}</GameClientContext.Provider>;
}

export function useGameClient() {
  const context = useContext(GameClientContext);
  if (!context) {
    throw new Error("useGameClient must be used within GameClientProvider");
  }
  return context.client;
}

import type { GameClient } from "@tuneperfect/webrtc/contracts/game";
import { type Accessor, createContext, createMemo, type JSX, useContext } from "solid-js";

/** The lobby's game connection: the client while connected, null otherwise. Provided by the lobby layout. */
const GameConnectionContext = createContext<Accessor<GameClient | null>>();

export function GameConnectionProvider(props: { client: Accessor<GameClient | null>; children: JSX.Element }) {
  // oxlint-disable-next-line solid/reactivity
  return <GameConnectionContext.Provider value={props.client}>{props.children}</GameConnectionContext.Provider>;
}

/** The game client, or null while not connected. For lobby screens that also work without a connection. */
export function useGameConnection() {
  const context = useContext(GameConnectionContext);
  if (!context) {
    throw new Error("useGameConnection must be used within GameConnectionProvider");
  }
  return context;
}

interface GameClientContextType {
  client: GameClient;
}

const GameClientContext = createContext<GameClientContextType>();

export function GameClientProvider(props: { client: GameClient; children: JSX.Element }) {
  const value = createMemo(() => ({ client: props.client }));

  // oxlint-disable-next-line solid/reactivity
  return <GameClientContext.Provider value={value()}>{props.children}</GameClientContext.Provider>;
}

/** The game client inside the connected layout, which only renders while connected. */
export function useGameClient() {
  const context = useContext(GameClientContext);
  if (!context) {
    throw new Error("useGameClient must be used within GameClientProvider");
  }
  return context.client;
}

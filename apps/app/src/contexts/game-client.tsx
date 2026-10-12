import type { JSX } from "@solidjs/web";
import type { GameClient } from "@tuneperfect/webrtc/contracts/game";
import { type Accessor, createContext, useContext } from "solid-js";

/** The lobby's game connection: the client while connected, null otherwise. Provided by the lobby layout. */
const GameConnectionContext = createContext<Accessor<GameClient | null>>();

export function GameConnectionProvider(props: { client: Accessor<GameClient | null>; children: JSX.Element }) {
  return <GameConnectionContext value={props.client}>{props.children}</GameConnectionContext>;
}

/** The game client, or null while not connected. For lobby screens that also work without a connection. */
export function useGameConnection() {
  return useContext(GameConnectionContext);
}

interface GameClientContextType {
  client: GameClient;
}

const GameClientContext = createContext<GameClientContextType>();

export function GameClientProvider(props: { client: GameClient; children: JSX.Element }) {
  const value = {
    get client() {
      return props.client;
    },
  };
  return <GameClientContext value={value}>{props.children}</GameClientContext>;
}

/** The game client inside the connected layout, which only renders while connected. */
export function useGameClient() {
  return useContext(GameClientContext).client;
}

/**
 * TanStack Query integration for the WebRTC game client.
 *
 * Used by routes under /_connected which guarantee the game client exists via context.
 * The game client is provided by the _connected layout, so queries can directly use it.
 */

import { queryOptions } from "@tanstack/solid-query";
import type { GameClient } from "@tuneperfect/webrtc/contracts/game";

/**
 * Query options for fetching the song list from the game client.
 *
 * @param client - Game client from useGameClient() context
 */
export function songsQueryOptions(client: GameClient) {
  return queryOptions({
    queryKey: ["game", "songs", "list"] as const,
    queryFn: () => client.songs.list(),
    staleTime: 30_000,
    retry: false,
    placeholderData: (previousData) => previousData,
  });
}

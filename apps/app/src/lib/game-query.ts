/**
 * TanStack Query integration for the WebRTC game client.
 *
 * Used by routes under /_connected which guarantee the game client exists via context.
 * The game client is provided by the _connected layout, so queries can directly use it.
 */

import { queryOptions } from "@tanstack/solid-query";
import type { GameClient } from "@tuneperfect/webrtc/contracts/game";

export const songsQueryKey = ["game", "songs", "list"] as const;

/** The game library version the cached song list came from (see the game's `ping`); undefined for older games. */
let songListVersion: string | undefined;

/**
 * Whether the cached song list still matches the game's library. Older games don't report a version,
 * so their list is fetched again once per connection (the phone may have switched games).
 */
export function isSongListCurrent(libraryVersion: string | undefined, newConnection: boolean) {
  if (libraryVersion === undefined) return !newConnection;
  return libraryVersion === songListVersion;
}

/**
 * Query options for fetching the song list from the game client. The list is the whole library, so
 * it's kept until the game reports a different library (the lobby's game connection checks).
 *
 * @param client - Game client from useGameClient() context
 */
export function songsQueryOptions(client: GameClient) {
  return queryOptions({
    queryKey: songsQueryKey,
    queryFn: async () => {
      const [{ libraryVersion }, songs] = await Promise.all([client.ping(), client.songs.list()]);
      songListVersion = libraryVersion;
      return songs;
    },
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    retry: false,
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Query options for a song's cover thumbnail. Covers never change for a song hash, so they're cached
 * for the session. Games from before covers were shared don't know the call; that's treated as no cover.
 */
export function songCoverQueryOptions(client: GameClient | null, hash: string) {
  return queryOptions({
    queryKey: ["game", "songs", "cover", hash] as const,
    queryFn: async () => {
      if (!client) return null;
      try {
        return (await client.songs.cover({ hash })).dataUrl;
      } catch {
        return null;
      }
    },
    enabled: !!client,
    staleTime: Number.POSITIVE_INFINITY,
    // Unused covers (rows scrolled away) are dropped after a while; the game caches them, so they come back fast.
    gcTime: 5 * 60_000,
    retry: false,
  });
}

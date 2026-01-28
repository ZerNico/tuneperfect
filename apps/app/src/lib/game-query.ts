/**
 * TanStack Query integration for the WebRTC game client.
 *
 * Used by routes under /_connected which guarantee the connection exists.
 * These queries handle temporary disconnections gracefully by:
 * - Keeping cached data visible during reconnection
 * - Disabling fetches when gameClient is unavailable
 * - Refetching in background once reconnected
 */

import { queryOptions } from "@tanstack/solid-query";
import { webrtcStore } from "~/stores/webrtc";

/**
 * Query options for fetching the song list from the game client.
 *
 * - Disabled when gameClient is null (during disconnection)
 * - Caches songs for 30 seconds (songs don't change often)
 * - No retry on failure (relies on WebRTC reconnection logic)
 * - Keeps previous data visible during reconnection (placeholderData)
 */
export function songsQueryOptions() {
  return queryOptions({
    queryKey: ["game", "songs", "list"] as const,
    queryFn: async () => {
      const client = webrtcStore.gameClient();
      if (!client) {
        throw new Error("Game client not connected");
      }
      return client.songs.list();
    },
    // Only enable query when game client is connected
    enabled: () => !!webrtcStore.gameClient(),
    // Songs don't change often, cache for 30 seconds
    staleTime: 30_000,
    // Don't retry - let WebRTC reconnection handle it
    retry: false,
    // Keep previous data while refetching (smooth UX during reconnection)
    placeholderData: (previousData) => previousData,
  });
}

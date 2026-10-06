import { implement } from "@orpc/server";
import { gameContract, REMOTE_FEATURE, type SongSummary } from "@tuneperfect/webrtc/contracts/game";

import { dispatchRemote, watchRemote } from "~/lib/remote";
import type { LocalSong } from "~/lib/ultrastar/song";

import { songsStore } from "../../stores/songs";
import { coverThumbnail } from "./cover-thumbnail";

export interface GameRouterContext {
  userId: string;
}

const os = implement(gameContract).$context<GameRouterContext>();

/**
 * The song list as phones see it, built once per library: it's the whole library, and phones
 * ask again after reconnecting. Each library gets its own version, so phones can tell whether
 * the list they have is still current (see `ping`).
 */
let library: { songs: LocalSong[]; version: string; summaries: SongSummary[] } | undefined;
const currentLibrary = () => {
  const songs = songsStore.songs();
  if (library?.songs !== songs) {
    library = {
      songs,
      version: crypto.randomUUID(),
      summaries: songs.map((song) => ({
        hash: song.hash,
        title: song.title,
        artist: song.artist,
        year: song.year,
        addedAt: song.createdAt,
      })),
    };
  }
  return library;
};

export const gameRouter = os.router({
  ping: os.ping.handler(async () => ({
    timestamp: Date.now(),
    libraryVersion: currentLibrary().version,
    features: [REMOTE_FEATURE],
  })),

  songs: {
    list: os.songs.list.handler(async () => currentLibrary().summaries),
    cover: os.songs.cover.handler(async ({ input }) => {
      const coverUrl = songsStore.songsByHash().get(input.hash)?.coverUrl;
      return { dataUrl: coverUrl ? await coverThumbnail(coverUrl) : null };
    }),
  },

  remote: {
    watch: os.remote.watch.handler(({ context, signal }) => watchRemote(context.userId, signal)),
    act: os.remote.act.handler(({ context, input }) => dispatchRemote(context.userId, input)),
  },
});

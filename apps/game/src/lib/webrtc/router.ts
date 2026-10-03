import { implement } from "@orpc/server";
import { gameContract } from "@tuneperfect/webrtc/contracts/game";

import { songsStore } from "../../stores/songs";
import { coverThumbnail } from "./cover-thumbnail";

export interface GameRouterContext {
  userId: string;
}

const os = implement(gameContract).$context<GameRouterContext>();

export const gameRouter = os.router({
  ping: os.ping.handler(async () => ({
    timestamp: Date.now(),
  })),

  songs: {
    list: os.songs.list.handler(async () =>
      songsStore.songs().map((song) => ({
        hash: song.hash,
        title: song.title,
        artist: song.artist,
        year: song.year,
        addedAt: song.createdAt,
      })),
    ),
    cover: os.songs.cover.handler(async ({ input }) => {
      const coverUrl = songsStore.songs().find((song) => song.hash === input.hash)?.coverUrl;
      return { dataUrl: coverUrl ? await coverThumbnail(coverUrl) : null };
    }),
  },
});

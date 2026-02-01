import { implement } from "@orpc/server";
import { gameContract } from "@tuneperfect/webrtc/contracts/game";
import { songsStore } from "../../stores/songs";

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
      })),
    ),
  },
});

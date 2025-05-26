import { os } from "@orpc/server";
import * as v from "valibot";
import { base } from "../base";
import { requireLobby } from "../lobby/middleware";
import { lobbyService } from "../lobby/service";
import { highscoreService } from "./service";

export const highscoreRouter = os.prefix("/highscores").router({
  setHighscore: base
    .use(requireLobby)
    .input(
      v.object({
        hash: v.string(),
        userId: v.string(),
        score: v.number(),
      }),
    )
    .errors({
      NOT_FOUND: {
        status: 404,
      },
      UNAUTHORIZED: {
        status: 401,
      },
    })
    .handler(async ({ context, input, errors }) => {
      const lobby = await lobbyService.getLobbyById(context.payload.sub);

      if (!lobby) {
        throw errors.NOT_FOUND({
          message: "Lobby not found",
        });
      }

      const user = lobby.users.find((user) => user.id === input.userId);

      if (!user) {
        throw errors.UNAUTHORIZED({
          message: "User not in lobby",
        });
      }

      await highscoreService.setHighscore(input.hash, user.id, input.score);
    }),

  getHighscores: base
    .use(requireLobby)
    .input(v.object({ hash: v.string() }))
    .handler(async ({ context, input }) => {
      return await highscoreService.getHighscoresForLobby(context.payload.sub, input.hash);
    }),
});

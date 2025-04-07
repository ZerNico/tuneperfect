import { TRPCError } from "@trpc/server";
import * as v from "valibot";
import { router } from "../../trpc";
import { protectedLobbyProcedure } from "../lobby/lobby.middleware";
import { lobbyService } from "../lobby/lobby.service";
import { highscoresService } from "./highscore.service";
export const highscoreRouter = router({
  createOrUpdate: protectedLobbyProcedure
    .input(
      v.object({
        hash: v.string(),
        score: v.number(),
        userId: v.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const lobby = await lobbyService.getByIdWithUsers(ctx.payload.sub);

      if (!lobby) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lobby not found" });
      }

      const user = lobby.users.find((user) => user.id === input.userId);

      if (!user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "User not in lobby" });
      }

      await highscoresService.createOrUpdateHighscore(input.hash, user.id, input.score);
    }),

  getHighscores: protectedLobbyProcedure.input(v.object({ hash: v.string() })).query(async ({ ctx, input }) => {
    return await highscoresService.getHighscores(ctx.payload.sub, input.hash);
  }),
});

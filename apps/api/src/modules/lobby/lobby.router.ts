import { TRPCError } from "@trpc/server";
import * as v from "valibot";
import { publicProcedure, router } from "../../trpc";
import { protectedUserProcedure } from "../user/user.middleware";
import { protectedLobbyProcedure, protectedUserOrLobbyProcedure } from "./lobby.middleware";
import { lobbyService } from "./lobby.service";

export const lobbyRouter = router({
  create: publicProcedure.mutation(async () => {
    const lobby = await lobbyService.createLobby();

    if (!lobby) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create lobby",
      });
    }

    const token = await lobbyService.createLobbyToken(lobby.id);

    return { lobby, token: token.token };
  }),

  current: protectedUserOrLobbyProcedure.query(async (opts) => {
    let lobbyId: string | undefined;

    if (opts.ctx.type === "lobby") {
      lobbyId = opts.ctx.payload.sub;
    } else {
      lobbyId = opts.ctx.user.lobbyId ?? undefined;
    }

    if (!lobbyId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Lobby not found" });
    }

    const lobby = await lobbyService.getByIdWithUsers(lobbyId);

    return lobby;
  }),

  join: protectedUserProcedure
    .input(
      v.object({
        lobbyId: v.pipe(
          v.string(),
          v.transform((input) => input.toUpperCase()),
        ),
      }),
    )
    .mutation(async (opts) => {
      const lobby = await lobbyService.getById(opts.input.lobbyId);

      if (!lobby) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lobby not found" });
      }

      await lobbyService.join(lobby.id, opts.ctx.user.id);
    }),

  leave: protectedUserProcedure.mutation(async ({ ctx }) => {
    await lobbyService.leave(ctx.user.id);
  }),

  kick: protectedLobbyProcedure
    .input(
      v.object({
        userId: v.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await lobbyService.kick(ctx.payload.sub, input.userId);
    }),
});

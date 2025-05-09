import { os } from "@orpc/server";
import * as v from "valibot";
import { requireUser } from "../auth/middleware";
import { base } from "../base";
import { userService } from "../user/service";
import { requireLobby, requireLobbyOrUser } from "./middleware";
import { lobbyService } from "./service";

export const lobbyRouter = os.prefix("/lobby").router({
  createLobby: base.handler(async ({ context, errors }) => {
    const lobby = await lobbyService.createLobby();

    if (!lobby) {
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to create lobby",
      });
    }

    const token = await lobbyService.generateLobbyToken(lobby.id);

    return {
      lobbyId: lobby.id,
      token,
    };
  }),

  currentLobby: base
    .use(requireLobbyOrUser)
    .errors({
      NOT_FOUND: {
        status: 404,
      },
    })
    .handler(async ({ context, errors }) => {
      if (context.payload.type === "lobby") {
        const lobby = await lobbyService.getLobbyById(context.payload.sub);

        if (!lobby) {
          throw errors.NOT_FOUND({
            message: "Lobby not found",
          });
        }

        return lobby;
      }

      const user = await userService.getUserById(context.payload.sub);
      if (!user || !user.lobbyId) {
        throw errors.NOT_FOUND({
          message: "Lobby not found",
        });
      }

      const lobby = await lobbyService.getLobbyById(user.lobbyId);
      if (!lobby) {
        throw errors.NOT_FOUND({
          message: "Lobby not found",
        });
      }

      return lobby;
    }),

  joinLobby: base
    .use(requireUser)
    .errors({
      NOT_FOUND: {
        status: 404,
      },
    })
    .input(
      v.object({
        lobbyId: v.string(),
      }),
    )
    .handler(async ({ context, errors, input }) => {
      const lobby = await lobbyService.getLobbyById(input.lobbyId);

      if (!lobby) {
        throw errors.NOT_FOUND({
          message: "Lobby not found",
        });
      }

      await lobbyService.joinLobby(lobby.id, context.payload.sub);
    }),

  leaveLobby: base.use(requireLobbyOrUser).handler(async ({ context }) => {
    await lobbyService.leaveLobby(context.payload.sub);
  }),

  kickUser: base
    .use(requireLobby)
    .input(v.object({ userId: v.string() }))
    .handler(async ({ context, input }) => {
      await lobbyService.kickUser(context.payload.sub, input.userId);
    }),

  deleteLobby: base.use(requireLobby).handler(async ({ context, errors }) => {
    await lobbyService.deleteLobby(context.payload.sub);
  }),
});

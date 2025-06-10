import type { AccessToken } from "../auth/models";
import { authService } from "../auth/service";
import { init } from "../lib/orpc";
import type { LobbyToken } from "./models";
import { lobbyService } from "./service";

export const requireLobby = init
  .errors({
    UNAUTHORIZED: {
      status: 401,
    },
  })
  .middleware(async ({ context, next, errors }) => {
    const lobbyToken = context.headers?.get("authorization")?.split(" ")[1];

    if (!lobbyToken) {
      throw errors.UNAUTHORIZED();
    }

    const payload = await lobbyService.verifyLobbyToken(lobbyToken);

    if (!payload) {
      throw errors.UNAUTHORIZED();
    }

    return next({
      context: {
        payload,
      },
    });
  });

type NextContext =
  | {
      payload: LobbyToken;
      type: "lobby";
    }
  | {
      payload: AccessToken;
      type: "access";
    };

export const requireLobbyOrUser = init
  .errors({
    UNAUTHORIZED: {
      status: 401,
    },
  })
  .middleware(async ({ context, next, errors }) => {
    try {
      const lobbyToken = context.headers?.get("authorization")?.split(" ")[1];

      if (!lobbyToken) {
        throw errors.UNAUTHORIZED();
      }

      const payload = await lobbyService.verifyLobbyToken(lobbyToken);

      if (payload) {
        return next<NextContext>({
          context: {
            payload,
            type: "lobby",
          },
        });
      }
    } catch {
      // Do nothing
    }

    try {
      const accessToken = context.cookies?.get("access_token");

      if (!accessToken) {
        throw errors.UNAUTHORIZED();
      }

      const payload = await authService.verifyAccessToken(accessToken);

      if (!payload) {
        throw errors.UNAUTHORIZED();
      }

      return next<NextContext>({
        context: {
          payload,
          type: "access",
        },
      });
    } catch {
      // Do nothing
    }

    throw errors.UNAUTHORIZED();
  });

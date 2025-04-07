import { TRPCError } from "@trpc/server";
import { auth } from "../../config/auth";
import { publicProcedure } from "../../trpc";
import type { LobbyToken } from "./lobby.models";
import { lobbyService } from "./lobby.service";

export const protectedLobbyProcedure = publicProcedure.use(async (opts) => {
  const token = opts.ctx.headers.get("authorization")?.split(" ")[1];

  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  const payload = await lobbyService.verifyLobbyToken(token);

  if (!payload) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return opts.next({
    ctx: {
      payload,
    },
  });
});

export const protectedUserOrLobbyProcedure = publicProcedure.use(async (opts) => {
  type NextContext = {
    session: typeof auth.$Infer.Session["session"];
    user: typeof auth.$Infer.Session["user"];
    type: "user";
  } | {
    payload: LobbyToken;
    type: "lobby";
  };

  try {
    const session = await auth.api.getSession({
      headers: opts.ctx.headers,
    });

    if (session) {
      return opts.next<NextContext>({
        ctx: {
          session: session.session,
          user: session.user,
          type: "user",
        },
      });
    }
  } catch (error) {}

  try {
    const token = opts.ctx.headers.get("authorization")?.split(" ")[1];

    if (token) {
      const payload = await lobbyService.verifyLobbyToken(token);

      if (payload) {
        return opts.next<NextContext>({
          ctx: {
            payload,
            type: "lobby",
          },
        });
      }
    }
  } catch (error) {}

  throw new TRPCError({ code: "UNAUTHORIZED" });
});

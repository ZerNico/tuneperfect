import { TRPCError } from "@trpc/server";
import { auth } from "../../config/auth";
import { publicProcedure } from "../../trpc";

export const protectedUserProcedure = publicProcedure.use(async (opts) => {
  const session = await auth.api.getSession({
    headers: opts.ctx.headers,
  });

  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return opts.next({ ctx: { session: session.session, user: session.user } });
});

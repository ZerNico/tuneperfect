import { initTRPC } from "@trpc/server";
import type { CreateBunContextOptions } from "trpc-bun-adapter";
import * as v from "valibot";

export const createContext = async (opts: CreateBunContextOptions) => {
  return {
    headers: opts.req.headers,
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  errorFormatter(opts) {
    const { shape, error } = opts;

    return {
      ...shape,
      data: {
        ...shape.data,
        valibotError: error.code === "BAD_REQUEST" ? error.cause instanceof v.ValiError ? v.flatten(error.cause.issues) : null : null,
      },
    } as const;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

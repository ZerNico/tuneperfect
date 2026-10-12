import { implement, ORPCError } from "@orpc/server";
import type { BrowserWindow } from "electron";

import { contract } from "../../src/lib/native/contract";
import { parseAppError } from "../native";

export interface RpcContext {
  window: BrowserWindow | null;
}

export const os = implement(contract).$context<RpcContext>();

/** Turns every failure into the typed `NATIVE_ERROR` the contract declares. */
export const nativeErrors = os.middleware(async ({ next, errors }) => {
  try {
    return await next();
  } catch (error) {
    if (error instanceof ORPCError) throw error;
    const appError = parseAppError(error);
    throw errors.NATIVE_ERROR({ message: appError.data, data: appError });
  }
});

/**
 * Turns a callback subscription into an async generator that yields every event in order until
 * the client stops listening (or `signal` aborts), then unsubscribes.
 */
export async function* subscription<E>(
  signal: AbortSignal | undefined,
  subscribe: (emit: (event: E) => void) => () => void,
) {
  const queue: E[] = [];
  let wake: (() => void) | undefined;
  const notify = () => {
    wake?.();
    wake = undefined;
  };

  const unsubscribe = subscribe((event) => {
    queue.push(event);
    notify();
  });
  // A generator waiting for its next event can't be stopped until one comes, and without a
  // recording none ever does: the abort wakes it so it ends.
  signal?.addEventListener("abort", notify, { once: true });

  try {
    for (;;) {
      if (signal?.aborted) return;
      while (queue.length > 0) yield queue.shift() as E;
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  } finally {
    signal?.removeEventListener("abort", notify);
    unsubscribe();
  }
}

/**
 * Turns a callback-driven call into an async generator: everything the callback receives
 * is yielded in order, followed by `done(result)` (if given) once the call resolves.
 */
export async function* stream<E, R>(run: (emit: (event: E) => void) => Promise<R>, done?: (result: R) => E) {
  const queue: E[] = [];
  let wake: (() => void) | undefined;
  let outcome: { ok: true; value: R } | { ok: false; error: unknown } | undefined;

  const notify = () => {
    wake?.();
    wake = undefined;
  };

  run((event) => {
    queue.push(event);
    notify();
  }).then(
    (value) => {
      outcome = { ok: true, value };
      notify();
    },
    (error: unknown) => {
      outcome = { ok: false, error };
      notify();
    },
  );

  while (true) {
    while (queue.length > 0) yield queue.shift() as E;
    if (outcome) break;
    await new Promise<void>((resolve) => {
      wake = resolve;
    });
  }

  if (!outcome.ok) throw outcome.error;
  if (done) yield done(outcome.value);
}

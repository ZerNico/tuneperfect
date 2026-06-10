/**
 * Shared helpers for router-level unit tests.
 *
 * oRPC procedures are called directly with `call(procedure, input, { context })`
 * — no HTTP server needed. The only middleware that needs real wiring is
 * `requireUser`, which reads the access token from the cookie map, so
 * `authedContext()` generates a real signed token for the given user.
 */
import { expect } from "bun:test";

import { ORPCError } from "@orpc/server";

import { authService } from "../src/auth/service";
import type { ORPCContext } from "../src/lib/orpc";
import { lobbyService } from "../src/lobby/service";
import type { User } from "../src/types";

let userCounter = 0;

/** Builds a complete User row with sensible defaults. */
export function makeUser(overrides: Partial<User> = {}): User {
  userCounter += 1;
  return {
    id: `00000000-0000-4000-8000-${userCounter.toString().padStart(12, "0")}`,
    username: `user${userCounter}`,
    email: `user${userCounter}@test.localhost`,
    emailVerified: true,
    image: null,
    lobbyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Builds an ORPCContext with a valid access token cookie for the given user. */
export async function authedContext(user: User, extraCookies: Record<string, string> = {}): Promise<ORPCContext> {
  const { token } = await authService.generateAccessToken(user);

  const cookies = new Bun.CookieMap();
  cookies.set("access_token", token);
  for (const [name, value] of Object.entries(extraCookies)) {
    cookies.set(name, value);
  }

  return {
    cookies,
    headers: new Headers(),
    resHeaders: new Headers(),
  };
}

/**
 * Builds an ORPCContext authenticated as a lobby host via a real lobby token in
 * the `authorization` header (matching `requireLobby` / `requireLobbyOrUser`).
 */
export async function lobbyContext(lobbyId: string): Promise<ORPCContext> {
  const token = await lobbyService.generateLobbyToken(lobbyId);

  return {
    cookies: new Bun.CookieMap(),
    headers: new Headers({ authorization: `Bearer ${token}` }),
    resHeaders: new Headers(),
  };
}

/** Asserts that a promise rejects with an ORPCError with the given code. */
export async function expectORPCError(promise: Promise<unknown>, code: string) {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(ORPCError);
  expect((caught as ORPCError<string, unknown>).code).toBe(code);
}

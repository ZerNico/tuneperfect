# Plan 001: Stop leaking password hashes and emails in lobby responses

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3bd2d38..HEAD -- apps/api/src/lobby/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `3bd2d38`, 2026-06-12

## Why this matters

`LobbyService.getLobbyById` loads the lobby's users with **all columns**, including the `password` bcrypt hash and `email`. The `currentLobby` route returns that object verbatim to the client. Anyone in a lobby — or anyone holding the lobby token (issued to whoever created the lobby, which requires no authentication) — receives the password hash and email address of every user in that lobby. This is a credential-exposure bug: password hashes must never leave the server.

The codebase already knows the right pattern: the same query excludes `password` for club members two lines below, and `src/club/service.ts` and `src/user/service.ts` exclude it everywhere. Only the lobby `users` relation was missed.

## Current state

- `apps/api/src/lobby/service.ts` — `getLobbyById` (lines 15–39) is the only place lobby users are loaded with full columns:

```ts
// apps/api/src/lobby/service.ts:15-39
async getLobbyById(id: string) {
  const lobby = await db.query.lobbies.findFirst({
    where: {
      id,
    },
    with: {
      users: true,                    // <-- BUG: loads password + email
      selectedClub: {
        with: {
          members: {
            with: {
              user: {
                columns: {
                  password: false,    // <-- club members do it correctly
                },
              },
            },
          },
        },
      },
    },
  });

  return lobby;
}
```

- `apps/api/src/lobby/router.ts` — `currentLobby` (lines 35–70) returns `lobby` from `getLobbyById` directly to the client. No output schema strips anything.
- Other callers of `getLobbyById` (`joinLobby` handler in the same router, `getAvailableClubsForLobby` in the service, `setHighscore` in `src/highscore/router.ts`) only read `lobby.id` and `lobby.users[].id`, so removing columns from the loaded users cannot break them.
- Repo convention: sensitive columns are excluded **at the query site** with `columns: { password: false }` — see `apps/api/src/club/service.ts:40-48` for the exemplar. Match it.
- Tests are colocated `*.test.ts` run by `bun:test`; `apps/api/test/setup.ts` (preloaded via `bunfig.toml`) replaces `src/lib/db` with a stub whose query methods are overridable mocks. See `apps/api/src/lobby/service.test.ts` for the existing lobby service test file to extend.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `cd apps/api && bun test` | all pass (137 before this plan, more after) |
| Tests (one file) | `cd apps/api && bun test src/lobby/service.test.ts` | all pass |
| Lint | `bun run lint apps/api` (from repo root) | exit 0 |
| Format | `bun run format:check apps/api` (from repo root) | exit 0 |
| Build | `cd apps/api && bun build.ts` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `apps/api/src/lobby/service.ts`
- `apps/api/src/lobby/service.test.ts`

**Out of scope** (do NOT touch, even though they look related):
- `apps/api/src/lobby/router.ts` — no router change is needed; the fix is at the query site.
- `apps/api/src/highscore/service.ts` — its leaderboard query has its own user-column issue handled by plan 002. Do not fix it here.
- Removing `email` from the lobby users payload — the clients may render emails for lobby members; trimming beyond `password` is a product decision deferred to maintenance notes.

## Git workflow

- Branch: `advisor/001-lobby-password-leak`
- Commit style: conventional commits, matching `git log` (e.g. `fix(api): stop returning password hashes in lobby responses`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Exclude the password column from lobby users

In `apps/api/src/lobby/service.ts`, change the `users: true` relation inside `getLobbyById` to:

```ts
users: {
  columns: {
    password: false,
  },
},
```

Everything else in the query stays identical.

**Verify**: `cd apps/api && bun test` → all tests pass. `grep -n "users: true" src/lobby/service.ts` → no matches.

### Step 2: Add a regression test pinning the column exclusion

In `apps/api/src/lobby/service.test.ts`, add a new `describe("getLobbyById")` block. The db stub from `test/setup.ts` records calls, so assert on the query arguments:

```ts
import { type Mock, describe, expect, it } from "bun:test";
import { db } from "../lib/db";
// ... existing imports stay

describe("getLobbyById", () => {
  it("never selects the password column for lobby users", async () => {
    await lobbyService.getLobbyById("LOBBY123");

    const findFirst = db.query.lobbies.findFirst as Mock<typeof db.query.lobbies.findFirst>;
    const args = findFirst.mock.calls.at(-1)?.[0] as Record<string, any>;

    expect(args.with.users).toEqual({ columns: { password: false } });
    expect(args.with.selectedClub.with.members.with.user.columns.password).toBe(false);
  });
});
```

Adjust the import style to match the top of the existing file (it already imports from `bun:test` and `./service`). If the db stub's `findFirst` is not a `Mock` with a `.mock.calls` array, see STOP conditions.

**Verify**: `cd apps/api && bun test src/lobby/service.test.ts` → all pass, including the new test.

### Step 3: Run the full pre-PR check

**Verify**: from repo root: `bun run lint apps/api && bun run format:check apps/api && cd apps/api && bun test && bun build.ts` → all exit 0.

## Test plan

- New test in `apps/api/src/lobby/service.test.ts`: `getLobbyById` query must exclude `password` for both `users` and `selectedClub.members.user` (regression guard so nobody flips it back to `users: true`).
- Pattern to follow: existing `describe` blocks in the same file; db-stub call assertions as documented in `apps/api/AGENTS.md` ("Override db behavior per-test").
- Verification: `cd apps/api && bun test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "users: true" apps/api/src/lobby/` returns no matches
- [ ] `cd apps/api && bun test` exits 0; the new regression test exists and passes
- [ ] `bun run lint apps/api` and `bun run format:check apps/api` exit 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `getLobbyById` in the live code no longer matches the excerpt (drift).
- The db stub in `test/setup.ts` does not expose `db.query.lobbies.findFirst` as a mock with `.mock.calls` — report the stub's actual shape instead of redesigning the test infrastructure.
- Any existing test fails after Step 1 in a way that suggests other code reads `lobby.users[].password` — that would mean the audit missed a consumer; report it.

## Maintenance notes

- `email`, `emailVerified`, and timestamps are still returned for lobby users. The game UI shows usernames; consider trimming to `{ id, username, image, lobbyId }` after confirming `apps/app` and `apps/game` don't render lobby-member emails (a grep during planning found no `.user.email` usage outside auth/me views, but this was not exhaustively verified for lobby views).
- Reviewer should scrutinize: that the column exclusion is on the `users` relation of `getLobbyById` specifically, and that no new endpoint returns raw `db.query` user rows. Any future relation load of `users` must repeat `columns: { password: false }` — there is no global guard. A longer-term fix (out of scope) is an oRPC output schema on `currentLobby`.

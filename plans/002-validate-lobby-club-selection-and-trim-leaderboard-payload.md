# Plan 002: Validate lobby club selection and trim the leaderboard user payload

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3bd2d38..HEAD -- apps/api/src/lobby/ apps/api/src/highscore/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (001 touches a neighboring file; rebase trivially if both run)
- **Category**: security
- **Planned at**: commit `3bd2d38`, 2026-06-12

## Why this matters

Two stacked authorization gaps let a lobby read data from clubs none of its users belong to:

1. `updateSelectedClub` accepts **any** `clubId` with no check that the club is related to the lobby. Creating a lobby requires no authentication (`createLobby` is rate-limited but public), so anyone holding a lobby token can point their lobby at any club UUID.
2. `getHighscoresForLobby` then includes the selected club's **members'** scores — joined with user rows that include `email` (only `password` is stripped). Combined: knowing a club's UUID is enough to enumerate that club's members' scores and email addresses.

The fix is (a) only allow selecting a club that at least one current lobby user is a member of — the service already computes exactly that set — and (b) return only `{ id, username, image }` for leaderboard users. The game UI renders only `username` for scores (verified: `apps/game/src/routes/game/score.tsx` uses `player.username`; no client reads `.user.email` from highscores).

## Current state

- `apps/api/src/lobby/router.ts:117-126` — the vulnerable route and its sibling:

```ts
updateSelectedClub: base
  .use(requireLobby)
  .input(v.object({ clubId: v.nullable(v.string()) }))
  .handler(async ({ context, input }) => {
    return await lobbyService.updateLobbySelectedClub(context.payload.sub, input.clubId);
  }),

getAvailableClubs: base.use(requireLobby).handler(async ({ context }) => {
  return await lobbyService.getAvailableClubsForLobby(context.payload.sub);
}),
```

- `apps/api/src/lobby/service.ts:145-153` — `updateLobbySelectedClub(lobbyId, clubId)` blindly updates `lobbies.clubId`.
- `apps/api/src/lobby/service.ts:155-185` — `getAvailableClubsForLobby(lobbyId)` already returns exactly the clubs that lobby users are members of (returns `[]` for unknown lobby or empty lobby).
- `apps/api/src/highscore/service.ts:62-73` — the leaderboard join strips only `password`:

```ts
// Exclude the password hash from the joined user to avoid leaking it in the response.
const { password: _password, ...userColumns } = getTableColumns(schema.users);

const scores = await db
  .select({
    ...getTableColumns(schema.highscores),
    user: userColumns,
  })
  .from(highscores)
  .innerJoin(schema.users, eq(highscores.userId, schema.users.id))
  .where(and(...whereConditions))
  .orderBy(desc(highscores.score));
```

- Error convention: routes declare typed errors via `.errors({ NAME: { status } })` and throw `errors.NAME({ message })` — see `joinLobby` in the same router (lines 72–100) as the exemplar.
- Router test convention: `call(router.proc, input, { context })` with `spyOn(service, "method")`, helpers from `apps/api/test/helpers.ts` (`expectORPCError`, `makeUser`, and lobby/auth context builders). Exemplar: `apps/api/src/club/router.test.ts` and `apps/api/src/auth/router.test.ts`. There is currently **no** `src/lobby/router.test.ts` — you will create it.

## Commands you will need

| Purpose          | Command                                                              | Expected on success |
| ---------------- | -------------------------------------------------------------------- | ------------------- |
| Tests            | `cd apps/api && bun test`                                            | all pass            |
| Tests (one file) | `cd apps/api && bun test src/lobby/router.test.ts`                   | all pass            |
| Lint + format    | `bun run lint apps/api && bun run format:check apps/api` (repo root) | exit 0              |
| Build            | `cd apps/api && bun build.ts`                                        | exit 0              |

## Scope

**In scope** (the only files you should modify):

- `apps/api/src/lobby/router.ts`
- `apps/api/src/lobby/router.test.ts` (create)
- `apps/api/src/highscore/service.ts`

**Out of scope** (do NOT touch, even though they look related):

- `apps/api/src/lobby/service.ts` — `updateLobbySelectedClub` stays a dumb write; the authorization check lives in the router like every other route in this repo. (Plan 001 edits this file's `getLobbyById`; avoid conflicts by not touching it here.)
- `apps/api/src/highscore/router.ts` — `setHighscore`'s lobby-membership check is correct as is.
- Client apps (`apps/app`, `apps/game`) — the payload change was verified compatible; do not "fix" clients.

## Git workflow

- Branch: `advisor/002-lobby-club-idor`
- Commit style: conventional commits (e.g. `fix(api): validate club membership before lobby club selection`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Validate club selection in `updateSelectedClub`

In `apps/api/src/lobby/router.ts`, change the route to reject clubs that are not in the lobby's available set. `null` (deselecting) stays allowed:

```ts
updateSelectedClub: base
  .use(requireLobby)
  .errors({
    FORBIDDEN: {
      status: 403,
    },
  })
  .input(v.object({ clubId: v.nullable(v.string()) }))
  .handler(async ({ context, errors, input }) => {
    if (input.clubId !== null) {
      const availableClubs = await lobbyService.getAvailableClubsForLobby(context.payload.sub);

      if (!availableClubs.some((club) => club.id === input.clubId)) {
        throw errors.FORBIDDEN({
          message: "Club is not available for this lobby",
        });
      }
    }

    return await lobbyService.updateLobbySelectedClub(context.payload.sub, input.clubId);
  }),
```

**Verify**: `cd apps/api && bun test` → all existing tests still pass.

### Step 2: Create `apps/api/src/lobby/router.test.ts`

Model the file structure on `apps/api/src/club/router.test.ts` (imports, `afterEach(() => mock.restore())`, context helpers). Cover, using `spyOn(lobbyService, ...)`:

1. `updateSelectedClub` with a clubId **not** in `getAvailableClubsForLobby`'s result → `expectORPCError(..., "FORBIDDEN")`, and `updateLobbySelectedClub` was **not** called.
2. `updateSelectedClub` with a clubId that **is** available → resolves, `updateLobbySelectedClub` called with `(lobbyId, clubId)`.
3. `updateSelectedClub` with `clubId: null` → resolves without calling `getAvailableClubsForLobby`, `updateLobbySelectedClub` called with `(lobbyId, null)`.

The lobby context needs an `authorization: Bearer <lobby token>` header (the `requireLobby` middleware reads it); check `apps/api/test/helpers.ts` for an existing lobby-context helper (the signaling router tests use one) and reuse it.

**Verify**: `cd apps/api && bun test src/lobby/router.test.ts` → 3+ tests pass.

### Step 3: Trim the leaderboard user payload

In `apps/api/src/highscore/service.ts`, replace the destructuring-based `userColumns` with an explicit safe subset:

```ts
const scores = await db
  .select({
    ...getTableColumns(schema.highscores),
    user: {
      id: schema.users.id,
      username: schema.users.username,
      image: schema.users.image,
    },
  })
  .from(highscores)
  ...
```

Delete the now-unused `const { password: _password, ...userColumns } = ...` line and its comment. Remove `getTableColumns` only if no longer used elsewhere in the file (it is still used for `schema.highscores` — keep it).

**Verify**: `cd apps/api && bun test` → all pass. `grep -n "userColumns" apps/api/src/highscore/service.ts` → no matches.

### Step 4: Full pre-PR check

**Verify**: from repo root: `bun run lint apps/api && bun run format:check apps/api && cd apps/api && bun test && bun build.ts` → all exit 0.

## Test plan

- New file `apps/api/src/lobby/router.test.ts` with the three `updateSelectedClub` cases listed in Step 2 (forbidden club, allowed club, null deselect).
- Pattern: `apps/api/src/club/router.test.ts`.
- Verification: `cd apps/api && bun test` → all pass, ≥3 new tests.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd apps/api && bun test` exits 0, including ≥3 new tests in `src/lobby/router.test.ts`
- [ ] `grep -n "FORBIDDEN" apps/api/src/lobby/router.ts` shows the new error on `updateSelectedClub`
- [ ] `grep -n "email" apps/api/src/highscore/service.ts` returns no matches
- [ ] `bun run lint apps/api && bun run format:check apps/api` exit 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The routes/service excerpts above don't match the live code (drift — especially if someone already added validation).
- `apps/api/test/helpers.ts` has no lobby-context helper and building the `authorization` header context from scratch fails twice — report what the helpers file actually exports.
- Trimming the user payload in Step 3 makes a **client** workspace fail to typecheck/build (e.g. `apps/game` references a removed field). Do not widen the payload again; report the exact usage site.
- You find other callers of `updateLobbySelectedClub` besides this route.

## Maintenance notes

- The validation reuses `getAvailableClubsForLobby`, which loads the full lobby; if lobbies grow large this is two queries per selection — fine at current scale, revisit if profiling says otherwise.
- If a "club selection" feature is ever added for **signed-in users** (not just lobby tokens), the same membership check must apply there.
- Reviewer should scrutinize: the `null` path stays allowed (deselect), and the leaderboard response now exposes exactly `id/username/image` — confirm the mobile app's leaderboard view doesn't expect more.
- Deferred: rate limit on `updateSelectedClub` (covered by the global default), and a `getHighscores` output schema as a structural guard.

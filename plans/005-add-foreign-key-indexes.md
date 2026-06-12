# Plan 005: Add indexes on queried foreign-key columns

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3bd2d38..HEAD -- apps/api/src/lib/db/schema.ts apps/api/drizzle/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `3bd2d38`, 2026-06-12

## Why this matters

Postgres does **not** auto-index foreign-key columns, and the schema defines no indexes beyond two unique email/username indexes. Five FK columns are filtered on by hot queries (every lobby load scans `users` by `lobby_id`; sign-out/password-change scans `refresh_tokens` by `user_id`; club and invite lookups scan by `user_id`/`invitee_id`), and `ON DELETE CASCADE` / `SET NULL` enforcement scans the referencing table on every parent delete. All are sequential scans today. Tables are small now, so this is cheap insurance bought at the moment it's cheapest — a five-line schema change and one generated migration.

## Current state

- `apps/api/src/lib/db/schema.ts` — all table definitions. Existing index style (the convention to match):

```ts
// apps/api/src/lib/db/schema.ts:17-36
export const users = p.pgTable(
  "users",
  {
    ...
    lobbyId: p.varchar("lobby_id").references(() => lobbies.id, { onDelete: "set null", onUpdate: "cascade" }),
    ...timestampColumns,
  },
  (table) => [
    uniqueIndex("email_unique_index").on(lower(table.email)),
    uniqueIndex("username_unique_index").on(lower(table.username)),
  ],
);
```

- `refreshTokens` (lines 38–50) and `verificationTokens` (52–64) have **no** extras callback at all; `clubMembers` (116–140) and `clubInvites` (142–169) have one returning only a composite `primaryKey`.
- Query evidence per index:
  - `users.lobbyId` — every `getLobbyById` relational load of lobby users (`apps/api/src/lobby/service.ts:15-39`), plus `kickUser`/`leaveLobby` updates filtered on `lobbyId`.
  - `refreshTokens.userId` — `deleteAllRefreshTokensForUser` (`apps/api/src/auth/service.ts:198-209`), runs on every password change/reset.
  - `verificationTokens.userId` — FK cascade on user delete; also keeps parity with refreshTokens.
  - `clubMembers.userId` — `getUserClubs` (`apps/api/src/club/service.ts:59-82`), `autoSelectClubForLobby` (`apps/api/src/lobby/service.ts:118-121`), `getAvailableClubsForLobby` `inArray` (`apps/api/src/lobby/service.ts:168-175`). The composite PK is `(clubId, userId)` — useless for userId-only filters.
  - `clubInvites.inviteeId` — `getUserInvites` (`apps/api/src/club/service.ts:134-148`). PK `(clubId, inviteeId)` doesn't cover inviteeId-only filters.
  - `lobbies.clubId` — `SET NULL` cascade when a club is deleted (`deleteClub`, `apps/api/src/club/service.ts:226-228`, plus the orphaned-club cron in `src/club/jobs.ts`).
- Migrations: generated into `apps/api/drizzle/` as timestamped directories (e.g. `20250813102708_public_speedball`) by drizzle-kit; applied at server startup via `runMigrations()` (`apps/api/src/lib/db/index.ts`). Generation is pure codegen — **no database connection needed**.
- Naming convention: existing indexes use snake_case with `_index` suffix (`email_unique_index`).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Generate migration | `cd apps/api && bunx drizzle-kit generate --name fk_indexes` | new dir under `drizzle/` |
| Tests | `cd apps/api && bun test` | all pass |
| Lint + format | `bun run lint apps/api && bun run format:check apps/api` (repo root) | exit 0 |
| Build | `cd apps/api && bun build.ts` | exit 0 |

## Scope

**In scope** (the only files you should modify/create):
- `apps/api/src/lib/db/schema.ts`
- `apps/api/drizzle/**` (generated — do not hand-edit beyond what drizzle-kit emits)

**Out of scope** (do NOT touch, even though they look related):
- `apps/api/src/lib/db/relations.ts` — relations are unaffected by indexes.
- Existing migration directories — never edit applied migrations.
- `highscores` — its composite PK `(hash, userId, difficulty)` already serves the leaderboard query (`WHERE hash = ? AND userId IN (...)`) via the leading column; `userId` cascade scans can reuse... they cannot, but score rows are only deleted with their user and the table is append-mostly. Deliberately skipped; revisit if user deletion ships (see plan index / direction findings).
- `clubInvites.inviterId` — only scanned on user-delete cascade; there is no user-deletion endpoint today. Deliberately skipped.

## Git workflow

- Branch: `advisor/005-fk-indexes`
- Commit style: conventional commits (e.g. `perf(api): index queried foreign-key columns`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the index declarations

In `apps/api/src/lib/db/schema.ts`, using the existing `p.index` (add nothing to imports — `p` is the wildcard import; use `p.index(...)`):

1. `users` — append to the existing extras array: `p.index("users_lobby_id_index").on(table.lobbyId),`
2. `refreshTokens` — add an extras callback: `(table) => [p.index("refresh_tokens_user_id_index").on(table.userId)]`
3. `verificationTokens` — add an extras callback: `(table) => [p.index("verification_tokens_user_id_index").on(table.userId)]`
4. `clubMembers` — append to the existing extras array: `p.index("club_members_user_id_index").on(table.userId),`
5. `clubInvites` — append to the existing extras array: `p.index("club_invites_invitee_id_index").on(table.inviteeId),`
6. `lobbies` — add an extras callback: `(table) => [p.index("lobbies_club_id_index").on(table.clubId)]`

For tables 2, 3, 6 this means changing `p.pgTable("name", { ...cols })` to `p.pgTable("name", { ...cols }, (table) => [ ... ])`.

**Verify**: `cd apps/api && bun test` → all pass (schema is type-checked by the test imports).

### Step 2: Generate the migration

`cd apps/api && bunx drizzle-kit generate --name fk_indexes`

**Verify**: a new directory `apps/api/drizzle/*_fk_indexes` exists and `grep -rn "CREATE INDEX" apps/api/drizzle/*fk_indexes*` shows **exactly six** `CREATE INDEX` statements matching the names in Step 1, and **nothing else** (no DROP/ALTER of unrelated objects — if drizzle-kit emits unrelated statements, see STOP conditions).

### Step 3: Apply locally if a database is available (optional but preferred)

If the local Postgres from `.env` is running: `cd apps/api && bun run db:up` (or start the dev server once, which runs migrations). If no local database is available, skip and note it in your report — the migration applies at next deploy via `runMigrations()`.

**Verify** (only if applied): `psql` or Drizzle Studio shows the six indexes; or server boot logs "Migrations completed successfully".

### Step 4: Full pre-PR check

**Verify**: from repo root: `bun run lint apps/api && bun run format:check apps/api && cd apps/api && bun test && bun build.ts` → all exit 0.

## Test plan

No new unit tests — index presence isn't unit-testable against the stubbed db. The machine check is the generated SQL (Step 2) plus the full suite staying green.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "p.index(" apps/api/src/lib/db/schema.ts` returns 6
- [ ] New migration dir exists; `grep -rc "CREATE INDEX" apps/api/drizzle/*fk_indexes*/` returns 6
- [ ] The new migration contains no statements other than the six CREATE INDEX
- [ ] `cd apps/api && bun test` exits 0
- [ ] `bun run lint apps/api && bun run format:check apps/api` exit 0
- [ ] `git status` shows nothing modified outside schema.ts + the new migration (+ drizzle journal/meta files drizzle-kit updates)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The generated migration contains anything besides the six `CREATE INDEX` statements (plus drizzle's journal/meta updates) — that means schema.ts had drifted from the applied migrations before your change; do not ship a migration with surprise DDL.
- `p.index` does not exist in this drizzle-orm version's `pg-core` export — report the available index API instead of guessing.
- `drizzle-kit generate` errors or prompts interactively in a way `--name` doesn't resolve.

## Maintenance notes

- These are plain `CREATE INDEX` (not `CONCURRENTLY`) applied during startup migration — fine at current table sizes; if tables grow large before this deploys, switch to a concurrent index migration run out-of-band.
- If user account deletion ships (see direction findings in `plans/README.md`), add `highscores_user_id_index` and `club_invites_inviter_id_index` then — their only beneficiary is the delete cascade.
- Reviewer should scrutinize: index names match the repo's `_index` suffix convention and the migration is append-only.

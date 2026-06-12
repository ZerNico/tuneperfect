# Plan 004: Gate CI on the API test suite and typecheck

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3bd2d38..HEAD -- .github/workflows/ci.yaml apps/api/package.json apps/api/src/utils/db.ts apps/api/src/lib/db/index.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `3bd2d38`, 2026-06-12

## Why this matters

The repo has a healthy 137-test suite in `apps/api` (`bun test`, all green at planning time), but CI runs **only lint and format** — broken tests merge to main undetected, which defeats the point of the recently added suite. There is also no typecheck script anywhere in `apps/api`, and `tsc --noEmit` currently reports **two pre-existing errors**, so type regressions are invisible too. This plan adds a CI test job (certain win) and a typecheck gate (after fixing the two errors, with an escape hatch if one proves unfixable).

## Current state

- `.github/workflows/ci.yaml` — the entire CI; a single `lint-and-format` job:

```yaml
# .github/workflows/ci.yaml (full file at planning time)
name: CI
on:
  pull_request:
  push:
    branches:
      - main
concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
jobs:
  lint-and-format:
    name: Lint and format
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout repository
        uses: actions/checkout@v5
      - name: Set up Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json
      - name: Install dependencies
        run: bun install --frozen-lockfile
      - name: Lint and format check
        run: bun run lint . && bun run format:check .
```

- `apps/api/package.json` scripts: `dev`, `build`, `test`, `db:generate`, `db:studio`, `db:up` — no `typecheck`. devDependencies do **not** include `typescript` (tsc resolves via the monorepo root/bunx).
- `apps/api` tests need **no** Postgres/Redis services: `apps/api/test/setup.ts` (preloaded via `bunfig.toml`) stubs `src/lib/db`, `src/lib/redis`, `src/lib/email`, `src/lib/posthog` and sets test env vars. `cd apps/api && bun test` runs standalone after `bun install`.
- The two pre-existing typecheck errors (`cd apps/api && bunx tsc --noEmit`):

  1. `src/utils/db.ts:23` — pino called with `(string, unknown)`; pino's signature is `(obj, msg)`:
     ```ts
     logger.warn(`Failed to release advisory lock ${lockId}:`, error);  // wrong arg order
     ```
     Fix: `logger.warn(error, \`Failed to release advisory lock ${lockId}\`);` — this matches the repo convention used everywhere else (e.g. `apps/api/src/auth/service.ts:70` `logger.error(error, "Failed to send verification email")`).

  2. `src/lib/db/index.ts:15` — `drizzle({ client, schema, relations })` doesn't match the drizzle-orm 1.0-rc overloads (the rc config type appears not to accept `schema` alongside `relations`):
     ```ts
     export const db = drizzle({ client, schema, relations });
     ```
     Candidate fix A: `drizzle({ client, relations })` — in the rc relational API v2, `relations` (built from the schema in `./relations.ts`) is what powers `db.query`; check that `src/lib/db/relations.ts` builds them from `schema` (it does: `defineRelations(schema, ...)` or similar) and that nothing references `db._.schema`.
     Candidate fix B (fallback): `drizzle({ client, relations, casing: undefined } as Parameters<typeof drizzle>[0])` — avoid; prefer a targeted `// @ts-expect-error drizzle 1.0-rc config type does not yet accept schema+relations` directly above the line if A changes runtime behavior.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `cd apps/api && bun test` | exit 0, 137+ pass |
| Typecheck | `cd apps/api && bunx tsc --noEmit` | exit 0 **after** Step 2 (2 errors before) |
| Lint + format | `bun run lint . && bun run format:check .` (repo root) | exit 0 |
| CI syntax check | `bunx yaml-lint .github/workflows/ci.yaml` or visually diff against the existing job | valid YAML |

## Scope

**In scope** (the only files you should modify):
- `.github/workflows/ci.yaml`
- `apps/api/package.json` (add `typecheck` script only)
- `apps/api/src/utils/db.ts` (pino arg order only)
- `apps/api/src/lib/db/index.ts` (drizzle config typing only)

**Out of scope** (do NOT touch, even though they look related):
- Other workspaces' test/typecheck wiring (`apps/app`, `apps/game`, `apps/web`, `packages/*`) — this plan gates `apps/api` only; a turbo-wide `test` pipeline is a separate decision.
- `turbo.json` / root `package.json` — not needed for a per-directory CI job.
- Upgrading or downgrading `drizzle-orm`/`drizzle-kit` versions.
- Pre-commit hooks.

## Git workflow

- Branch: `advisor/004-ci-test-gate`
- Commit style: conventional commits (e.g. `ci: run api tests and typecheck`, `fix(api): correct pino argument order in advisory lock helper`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a test job to CI

In `.github/workflows/ci.yaml`, add a job alongside `lint-and-format`, reusing its checkout/setup/install steps verbatim:

```yaml
  test-api:
    name: API tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout repository
        uses: actions/checkout@v5
      - name: Set up Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json
      - name: Install dependencies
        run: bun install --frozen-lockfile
      - name: Run API tests
        working-directory: apps/api
        run: bun test
```

**Verify**: `cd apps/api && bun test` → exit 0 (proves the command the job runs is green locally).

### Step 2: Fix the two pre-existing typecheck errors

1. `apps/api/src/utils/db.ts:23`: swap the pino arguments as shown in Current state.
2. `apps/api/src/lib/db/index.ts:15`: apply candidate fix A (`drizzle({ client, relations })`). Then run the full test suite — the db module is stubbed in unit tests, so **also** confirm the dev server still boots if a local Postgres is available; if not available, rely on the typecheck + test suite and note it in your report.

If fix A still fails typecheck, use the `@ts-expect-error` variant from Current state with the explanatory comment, and report that choice.

**Verify**: `cd apps/api && bunx tsc --noEmit` → exit 0. `cd apps/api && bun test` → all pass.

### Step 3: Add the typecheck script and CI step

In `apps/api/package.json` scripts, add: `"typecheck": "tsc --noEmit"`. Append to the `test-api` job in `ci.yaml`:

```yaml
      - name: Typecheck
        working-directory: apps/api
        run: bunx tsc --noEmit
```

**Verify**: `cd apps/api && bun run typecheck` → exit 0.

### Step 4: Full pre-PR check

**Verify**: from repo root: `bun run lint apps/api && bun run format:check apps/api && cd apps/api && bun test && bun build.ts` → all exit 0.

## Test plan

No new tests — this plan makes the existing suite enforceable. The verification is the suite itself plus a clean typecheck.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "bun test" .github/workflows/ci.yaml` shows the new job step
- [ ] `grep -n "typecheck" apps/api/package.json` shows the new script
- [ ] `cd apps/api && bun run typecheck` exits 0
- [ ] `cd apps/api && bun test` exits 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `bunx tsc --noEmit` reports errors **other than** the two documented ones (drift — new type errors landed since planning).
- Candidate fix A for `db/index.ts` changes runtime behavior (any test failure, or `db.query.*` becoming untyped/`any`) **and** the `@ts-expect-error` fallback feels wrong — escape hatch: drop Step 2.2 and Step 3 entirely, ship the test job only (still valuable), mark the typecheck half BLOCKED in `plans/README.md` with one line.
- CI YAML conventions in the repo differ from the excerpt (e.g. a composite setup action appears) — match what's there, don't invent.

## Maintenance notes

- When other workspaces gain test suites, either widen `test-api` into a matrix or move to `turbo run test` at the root — deliberately not done here to keep CI green and fast today.
- The drizzle config fix interacts with future drizzle 1.0 upgrades: when 1.0 goes stable (latest stable at planning time is 0.45.2; 1.0 is at beta/rc), the `@ts-expect-error` (if used) should be removed.
- Reviewer should scrutinize: the test job has no service containers — correct, because unit tests stub db/redis; if anyone later adds integration tests needing Postgres, the job needs `services:`.

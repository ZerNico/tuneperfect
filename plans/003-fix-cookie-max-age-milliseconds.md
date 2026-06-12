# Plan 003: Set cookie Max-Age in seconds instead of milliseconds

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 3bd2d38..HEAD -- apps/api/src/auth/ apps/api/src/utils/cookie.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `3bd2d38`, 2026-06-12

## Why this matters

The cookie `Max-Age` attribute is defined in **seconds** (RFC 6265), and `Bun.Cookie` serializes the `maxAge` option verbatim — verified empirically: `new Bun.Cookie("a","b",{maxAge: 300000}).serialize()` → `a=b; Path=/; Max-Age=300000; SameSite=Lax`. All six auth cookie call sites pass `expires.getTime() - Date.now()`, i.e. **milliseconds**. Result: the access-token cookie intended to live 5 minutes persists ~3.5 days, and the refresh-token cookie intended for 7 days persists ~19 years. Server-side token expiry contains the security damage, but stale credentials sit on client disks ~1000× longer than designed, and the refresh cookie effectively never expires client-side.

## Current state

- `apps/api/src/utils/cookie.ts` — central cookie helpers (`defaultCookieOptions`, `createCookie`, `deleteCookie`); the natural home for a conversion helper.
- The six buggy sites, all identical in shape:
  - `apps/api/src/auth/router.ts:94-101` (signIn: access + refresh)
  - `apps/api/src/auth/router.ts:257-264` (refreshToken: access + refresh)
  - `apps/api/src/auth/oauth/router.ts:127-134` (OAuth callback: access + refresh)

```ts
// apps/api/src/auth/router.ts:94-101 (signIn) — same pattern at all six sites
context.setCookie?.("access_token", accessToken.token, {
  ...defaultCookieOptions,
  maxAge: accessToken.expires.getTime() - Date.now(),   // <-- milliseconds
});
context.setCookie?.("refresh_token", refreshToken.token, {
  ...defaultCookieOptions,
  maxAge: refreshToken.expires.getTime() - Date.now(),  // <-- milliseconds
});
```

- The OAuth `state`/`codeVerifier`/`redirect` cookies in `apps/api/src/auth/oauth/router.ts:37-50` already use literal seconds (`maxAge: 60 * 10`) — they are **correct**, leave them.
- Token expiry sources: `generateAccessToken` returns `{ token, expires }` with `expires = addMinutes(new Date(), 5)`; `generateAndStoreRefreshToken` and `verifyAndRotateRefreshToken` return `expires` 7 days out (`apps/api/src/auth/service.ts`).
- Test convention: `apps/api/src/auth/router.test.ts` has a `cookieContext()` helper whose `setCookie` is a recording mock — assert on `setCookie.mock.calls[n][2].maxAge`. Existing tests assert cookie names/values but **not** `maxAge`, so nothing breaks.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `cd apps/api && bun test` | all pass |
| Tests (one file) | `cd apps/api && bun test src/auth/router.test.ts` | all pass |
| Lint + format | `bun run lint apps/api && bun run format:check apps/api` (repo root) | exit 0 |
| Build | `cd apps/api && bun build.ts` | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `apps/api/src/utils/cookie.ts`
- `apps/api/src/auth/router.ts`
- `apps/api/src/auth/oauth/router.ts`
- `apps/api/src/auth/router.test.ts`

**Out of scope** (do NOT touch, even though they look related):
- `apps/api/src/lib/orpc/cookies.ts` — the plugin passes options through to `Bun.Cookie` correctly; the bug is at the call sites.
- The literal-seconds cookies (`state`, `codeVerifier`, `redirect`) in the OAuth authorize route — already correct.
- JWT `expiresIn` values in `apps/api/src/auth/service.ts` / `src/lobby/service.ts` — those are seconds already (via `differenceInSeconds`) and unrelated.

## Git workflow

- Branch: `advisor/003-cookie-max-age-seconds`
- Commit style: conventional commits (e.g. `fix(api): set cookie Max-Age in seconds, not milliseconds`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a conversion helper

In `apps/api/src/utils/cookie.ts`, add:

```ts
/** Max-Age is specified in seconds (RFC 6265); Dates and getTime() are milliseconds. */
export function cookieMaxAge(expires: Date) {
  return Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000));
}
```

**Verify**: `cd apps/api && bun test` → all pass (helper unused so far).

### Step 2: Replace all six call sites

In `apps/api/src/auth/router.ts` (4 sites: signIn at ~94-101, refreshToken at ~257-264) and `apps/api/src/auth/oauth/router.ts` (2 sites: callback at ~127-134), replace each
`maxAge: X.expires.getTime() - Date.now()` with `maxAge: cookieMaxAge(X.expires)` and add `cookieMaxAge` to the existing `../utils/cookie` (resp. `../../utils/cookie`) import.

**Verify**: `grep -rn "getTime() - Date.now()" apps/api/src/` → no matches. `cd apps/api && bun test` → all pass.

### Step 3: Add regression tests on Max-Age units

In `apps/api/src/auth/router.test.ts`, extend the existing `describe("refreshToken")` success test ("rotates the refresh token and sets fresh cookies on success") or add a sibling test. The mock already returns `expires: new Date(Date.now() + 1000 * 60 * 60)` (1 hour). Assert seconds:

```ts
const refreshCall = setCookie.mock.calls.find((c) => c[0] === "refresh_token");
const maxAge = (refreshCall?.[2] as Bun.CookieInit).maxAge ?? 0;
expect(maxAge).toBeGreaterThan(3500);
expect(maxAge).toBeLessThanOrEqual(3600);

const accessCall = setCookie.mock.calls.find((c) => c[0] === "access_token");
const accessMaxAge = (accessCall?.[2] as Bun.CookieInit).maxAge ?? 0;
// access tokens live 5 minutes
expect(accessMaxAge).toBeGreaterThan(290);
expect(accessMaxAge).toBeLessThanOrEqual(300);
```

**Verify**: `cd apps/api && bun test src/auth/router.test.ts` → all pass, including the new assertions. As a sanity check, temporarily revert one call site to the old expression and confirm the test **fails**, then restore the fix.

### Step 4: Full pre-PR check

**Verify**: from repo root: `bun run lint apps/api && bun run format:check apps/api && cd apps/api && bun test && bun build.ts` → all exit 0.

## Test plan

- Extend `apps/api/src/auth/router.test.ts` (refreshToken success case) with Max-Age range assertions for both cookies, as in Step 3 — this is the regression guard for the unit bug.
- Pattern: the existing `cookieContext()` helper and `setCookie.mock.calls` assertions in the same file.
- Verification: `cd apps/api && bun test` → all pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "getTime() - Date.now()" apps/api/src/` returns no matches
- [ ] `grep -c "cookieMaxAge" apps/api/src/auth/router.ts` ≥ 4 and `grep -c "cookieMaxAge" apps/api/src/auth/oauth/router.ts` ≥ 2
- [ ] `cd apps/api && bun test` exits 0, including new Max-Age assertions
- [ ] `bun run lint apps/api && bun run format:check apps/api` exit 0
- [ ] `git status` shows no modified files outside the in-scope list
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The call sites don't match the excerpts (drift), or you find **more** than six `getTime() - Date.now()` cookie sites — fix only matches of this exact pattern and report any ambiguous ones.
- An existing test asserts a millisecond `maxAge` value (none did at planning time) — report rather than silently updating expectations.
- The sanity check in Step 3 (reverted code should fail the test) does not fail — the test isn't actually guarding the bug.

## Maintenance notes

- Anyone adding a new auth cookie must use `cookieMaxAge(expires)` (or literal seconds). Consider a follow-up lint rule or a `setAuthCookies(context, accessToken, refreshToken)` helper if a fourth call site appears — deferred because six sites collapse to three pairs and the helper keeps the diff minimal.
- Reviewer should scrutinize: no behavioral change beyond the unit fix — flag values, cookie names, and `deleteCookie` paths are untouched.
- User-visible effect after deploy: clients keep working (old over-long cookies are still valid tokens server-side and rotate to correctly-scoped cookies on next refresh).

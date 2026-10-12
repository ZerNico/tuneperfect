# App (Companion) — Agent Guide

## Package Identity

- **`@tuneperfect/app`** — Companion web app for the karaoke game (mobile-friendly SPA)
- **Stack**: Solid 2 (release candidate), TanStack Router, TanStack Query + oRPC, base-ui-solid, Tailwind CSS v4, Valibot
- The only app on Solid 2; the game and web stay on Solid 1. See "Solid 2" below before writing reactive code
- Connects to API via oRPC (HTTP) and to game client via WebRTC (guest side)
- Features: auth, lobby management, clubs, song browsing, profile editing

## Setup & Run

```bash
bun run --bun vite dev             # dev server (port 3001)
bun run --bun vite build           # production build
```

Requires `.env` (copy from `.env.example`): `VITE_API_URL`, `VITE_WEB_URL`

## Patterns & Conventions

### File organization

```
src/
├── components/           # Reusable UI components
│   ├── ui/               # Generic primitives (button, input, dialog, avatar, card)
│   └── *.tsx             # Feature components (header, footer, oauth logins)
├── contexts/             # SolidJS contexts (game-client WebRTC)
├── hooks/                # Custom hooks (use-song-search)
├── i18n/                 # Translation dictionaries (en.ts, de.ts)
├── lib/
│   ├── webrtc/           # WebRTC guest connection logic
│   └── utils/            # Utility functions (error, try-catch)
├── routes/               # TanStack file-based routes
└── stores/               # Reactive stores (connection)
```

### Route layout groups

Routes use TanStack Router layout prefixes:

- `_auth/` — requires authentication (profile, lobby, clubs)
- `_no-auth/` — public pages (sign-in, sign-up, forgot-password)
- `_auth/_lobby/` — requires active lobby connection
- `_auth/_lobby/_connected/` — requires active WebRTC connection to game
- `_auth/_no-lobby/` — auth pages without active lobby

### Component patterns

- ✅ **DO**: Use functional components with `cva` variants — see `src/components/ui/button.tsx`
- ✅ **DO**: Use base-ui-solid for accessible primitives — see `src/components/ui/dialog.tsx`, `sheet.tsx` (Drawer)
- ✅ **DO**: Use `~/` path alias for imports
- ✅ **DO**: Use TanStack Form for forms with Valibot validation, through the local adapter `~/lib/form` (same API as `@tanstack/solid-form`, which has no Solid 2 version yet)
- ✅ **DO**: Handle errors with `tryCatch` utility — see `src/lib/utils/try-catch.ts`

### Solid 2

Versions are pinned to the rc.13 set base-ui-solid is tested with (root `overrides` pin `@solidjs/signals` and the compiler). Upgrade them together with base-ui-solid.

- **Batching**: a setter's new value is only readable after the batch flushes. Code that writes and then reads back in the same handler needs a plain variable (see `createState` in `src/stores/connection.ts`)
- **Effects** are split: `createEffect(() => tracked, (value) => sideEffect)`. Return cleanups from the second function; writing signals in the first one throws
- **Async**: reading query data that's still loading suspends to the nearest `<Loading>`. Give lists their own `<Loading>` (see `routes/_auth/devices.tsx`) and set up code that reads the data under it (see `SongResults` in `songs.tsx`), or the whole page waits. Check `query.isError` before reading `data` of a query that can fail
- **Dev diagnostics**: Solid 2 logs `[CODE]` warnings with repair guides in the console. The router devtools and base-ui-solid cause a few on their own
- `onMount` → `onSettled`, `classList` → `class={[..., { cond }]}`, `<Context.Provider>` → `<Context>`, `<Dynamic>` → `dynamic()`, `Index` → `<For keyed={false}>`, HTML attributes are lowercase (`maxlength`, `tabindex`) and `aria-*` take strings
- `@tanstack/solid-virtual` has no Solid 2 version either: use `~/lib/virtual`

### oRPC client

- Client configured in `src/lib/orpc.ts` with auto-refresh on 401
- Use `client.<domain>.<method>.call()` for direct calls
- Use `client.<domain>.<method>.queryOptions()` with TanStack Query for reactive data
- Session managed via `src/lib/auth.ts` → `sessionQueryOptions()`

### i18n

- Dictionaries: `src/i18n/en.ts`, `src/i18n/de.ts`
- Type-safe flat keys via `@solid-primitives/i18n`
- Access via `t("section.key")` — setup in `src/lib/i18n.ts`
- Template interpolation: `t("key", { variable: value })`

### Auth

- Cookie-based JWT auth (httpOnly cookies set by API)
- Auto token refresh on 401 via `ClientRetryPlugin` in `src/lib/orpc.ts`
- Session expiry dispatches `session:expired` custom event
- Protected routes check session in layout route loaders

### WebRTC (guest side)

- App acts as **guest** in WebRTC connections (game is host)
- Connection store: `src/stores/connection.ts` (with auto-reconnect)
- Guest connection: `src/lib/webrtc/guest-connection.ts`
- Contracts from `@tuneperfect/webrtc` package

## Key Files

| File                           | Purpose                                           |
| ------------------------------ | ------------------------------------------------- |
| `src/main.tsx`                 | App entry — QueryClient, Router, DialogProvider   |
| `src/lib/orpc.ts`              | oRPC client with auto-refresh                     |
| `src/lib/auth.ts`              | Session query options                             |
| `src/lib/i18n.ts`              | i18n setup                                        |
| `src/lib/config.ts`            | Runtime config from env vars                      |
| `src/lib/toast.ts`             | Toast notification system (base-ui toast manager) |
| `src/lib/form.tsx`             | TanStack Form adapter for Solid 2                 |
| `src/lib/dialog.tsx`           | Confirmation dialog system                        |
| `src/stores/connection.ts`     | WebRTC connection store (guest)                   |
| `src/contexts/game-client.tsx` | Game client context (WebRTC)                      |
| `src/routes/_auth.tsx`         | Auth layout (session guard)                       |
| `src/routes/_no-auth.tsx`      | Public layout                                     |
| `src/i18n/en.ts`               | English dictionary (source of truth for keys)     |

## JIT Index Hints

```bash
rg -n "export default function\|export function" src/components/   # find components
rg -n "createFileRoute\|createRoute" src/routes/                   # find routes
rg -n "client\." src/routes/                                        # find API calls in routes
rg -n "t\(" src/                                                    # find i18n usage
rg -n "export const use" src/hooks/                                # find hooks
```

## Common Gotchas

- `src/routeTree.gen.ts` is **auto-generated** — never edit it
- Env vars must use `VITE_` prefix for client-side access
- The `fetch` wrapper in oRPC includes `credentials: "include"` for cookies — don't remove
- WebRTC reconnection has exponential backoff — config from `@tuneperfect/webrtc/utils`
- Toast/dialog systems are SolidJS-native (not DOM libraries) — see `src/lib/toast.ts`
- `tsconfig.json` maps `@tanstack/query-core` to Solid Query's own copy (the game's newer one sits at the root)

## Pre-PR Checks

```bash
bun run lint apps/app && bun run format:check apps/app && cd apps/app && bun run --bun vite build
```

# TunePerfect — Agent Guide

## Project Snapshot

- **Monorepo** (Bun workspaces + Turborepo) — karaoke/singing game platform
- **Stack**: TypeScript (SolidJS, Vite), Rust (Tauri), Bun runtime, PostgreSQL, Redis
- **Linter/Formatter**: Oxc (`.oxlintrc.json`, `.oxfmtrc.json`)
- Sub-packages have their own `AGENTS.md` — always check the nearest one first

## Setup

```bash
bun install                         # install all workspace deps
bun run dev                         # turbo dev (all apps in parallel)
bun run tuneperfect dev             # dev via CLI (starts Caddy + turbo)
bun run tuneperfect dev --filter game --filter api  # subset
bun run build                       # turbo build all
```

Local dev uses Caddy as reverse proxy with mkcert TLS:

- `tuneperfect.localhost` → web (:3000)
- `app.tuneperfect.localhost` → app (:3001)
- `api.tuneperfect.localhost` → api (:3002)

## Universal Conventions

- **Formatting**: Oxfmt — 2-space indent, 120 line width, LF endings
- **Validation**: Valibot everywhere (API, env, forms, stores)
- **RPC**: oRPC for API client/server and WebRTC peer-to-peer communication
- **Routing**: TanStack Router (SolidJS) with file-based routes in all frontends
- **Styling**: Tailwind CSS v4 with `cva` for component variants
- **UI primitives**: Kobalte (headless SolidJS components)
- **Icons**: `unplugin-icons` with Lucide + custom SVG collections
- **i18n**: `@solid-primitives/i18n` with flat dictionary pattern (app & game)
- **No tests** exist yet — no test framework is configured

## Security & Secrets

- **Never** commit `.env` files — use `.env.example` as template
- API secrets go in `apps/api/.env` (server-only, no `VITE_` prefix)
- Client env vars **must** use `VITE_` prefix (`VITE_API_URL`, etc.)
- Auth uses JWT access tokens (cookie) + refresh tokens; see `apps/api/src/auth/`

## JIT Index

### Apps

| App         | Purpose                             | Port | AGENTS.md                                  |
| ----------- | ----------------------------------- | ---- | ------------------------------------------ |
| `apps/api`  | Bun HTTP API (oRPC + OpenAPI)       | 3002 | [apps/api/AGENTS.md](apps/api/AGENTS.md)   |
| `apps/game` | Tauri desktop game (SolidJS + Rust) | 1420 | [apps/game/AGENTS.md](apps/game/AGENTS.md) |
| `apps/app`  | Companion web app (SolidJS SPA)     | 3001 | [apps/app/AGENTS.md](apps/app/AGENTS.md)   |
| `apps/web`  | Marketing website (SolidStart SSR)  | 3000 | [apps/web/AGENTS.md](apps/web/AGENTS.md)   |

### Packages

| Package           | Purpose                                      | AGENTS.md                                              |
| ----------------- | -------------------------------------------- | ------------------------------------------------------ |
| `packages/webrtc` | WebRTC connection utilities & oRPC contracts | [packages/webrtc/AGENTS.md](packages/webrtc/AGENTS.md) |
| `packages/email`  | React Email templates                        | [packages/email/AGENTS.md](packages/email/AGENTS.md)   |
| `packages/cli`    | Dev CLI (Clerc) — starts Caddy + turbo       | [packages/cli/AGENTS.md](packages/cli/AGENTS.md)       |

### Quick Find Commands

```bash
rg -n "functionName" apps/ packages/           # search across codebase
rg -n "export.*ComponentName" apps/*/src       # find a component
rg -n "os.prefix" apps/api/src                 # find API route groups
rg -n "createRootRouteWithContext\|createRoute\|createFileRoute" apps/*/src  # find routes
```

## Definition of Done

1. `bun run lint .` and `bun run format:check .` pass
2. TypeScript compiles without errors
3. Relevant app builds successfully: `bun run build --filter @tuneperfect/<app>`
4. `.env.example` updated if new env vars added

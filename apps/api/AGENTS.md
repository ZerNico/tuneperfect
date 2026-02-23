# API — Agent Guide

## Package Identity

- **`@tuneperfect/api`** — Backend HTTP API serving both oRPC (typed client) and OpenAPI (REST) endpoints
- **Runtime**: Bun, **ORM**: Drizzle (PostgreSQL), **Validation**: Valibot, **RPC**: oRPC
- Exports typed `Client` type consumed by `apps/app` and `apps/game`

## Setup & Run

```bash
bun --watch src/index.ts          # dev server (port 3002)
bun build.ts                       # production build
bun run db:generate                # generate Drizzle migrations
bun run db:studio                  # open Drizzle Studio GUI
bun run db:up                      # apply pending migrations
```

Requires: PostgreSQL, Redis, `.env` (copy from `.env.example`)

## Patterns & Conventions

### Domain module structure
Each domain lives in `src/<domain>/` with these files:
```
src/user/
├── router.ts      # oRPC route definitions (handlers)
├── service.ts     # business logic (class + singleton export)
├── models.ts      # Valibot schemas for this domain
├── middleware.ts   # domain-specific middleware (optional)
└── jobs.ts        # scheduled/background jobs (optional)
```

- ✅ **DO**: Follow the router/service/models pattern — see `src/user/` for a complete example
- ✅ **DO**: Define route handlers in `router.ts` using `base` from `src/base.ts`
- ✅ **DO**: Use Valibot for input validation in `.input()` chains
- ✅ **DO**: Export services as singletons: `export const userService = new UserService()`
- ✅ **DO**: Define typed errors per-route using `.errors({})` — see `src/user/router.ts`
- ❌ **DON'T**: Import `db` directly in routers — it's injected via middleware in `base.ts`
- ❌ **DON'T**: Use Express/Hono/etc. — this is a raw Bun.serve + oRPC setup

### oRPC chain pattern
```ts
export const myRouter = os.prefix("/things").router({
  getOne: base
    .errors({ NOT_FOUND: { status: 404 } })
    .input(v.object({ id: v.string() }))
    .use(requireUser)               // auth middleware
    .handler(async ({ context, errors, input }) => { ... }),
});
```

### Database
- **ORM**: Drizzle with PostgreSQL
- **Schema**: `src/lib/db/schema.ts` — all tables defined here
- **Relations**: `src/lib/db/relations.ts`
- **Migrations**: `drizzle/` directory, generated via `bun run db:generate`
- Always use `timestampColumns` helper for `createdAt`/`updatedAt`

### Auth flow
- JWT access tokens stored in HTTP-only cookies
- Refresh token rotation via `src/auth/service.ts`
- OAuth: Google + Discord (`src/auth/oauth/`)
- Protect routes with `requireUser` middleware from `src/auth/middleware.ts`

### Environment
- All env vars validated with Valibot in `src/config/env.ts`
- Add new vars to both `src/config/env.ts` schema AND `.env.example`

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Server entry, router composition, CORS, plugins |
| `src/base.ts` | Base oRPC chain (DB injection, rate limit, error handling) |
| `src/lib/orpc/index.tsx` | oRPC init with context/metadata types |
| `src/lib/db/schema.ts` | All Drizzle table definitions |
| `src/lib/db/relations.ts` | Drizzle relation declarations |
| `src/config/env.ts` | Validated env config |
| `src/auth/middleware.ts` | `requireUser` auth middleware |
| `src/auth/service.ts` | JWT signing/verification, password hashing |
| `src/lib/logger.ts` | Pino logger instance |
| `src/lib/redis.ts` | Redis client singleton |
| `src/types.ts` | Shared TypeScript types |

## JIT Index Hints

```bash
rg -n "os.prefix" src/                        # find all route groups
rg -n "\.handler" src/                         # find all route handlers
rg -n "export class.*Service" src/             # find all services
rg -n "pgTable" src/lib/db/schema.ts           # find all DB tables
rg -n "\.middleware" src/                       # find all middleware
rg -n "Cron\|setupJobs" src/                   # find scheduled jobs
```

## Common Gotchas

- The API exposes **two** handler paths: `/rpc` (typed oRPC) and `/v1.0` (OpenAPI REST)
- CORS is restricted to `APP_URL` + Tauri origins — update `allowedOrigins` in `src/index.ts` if adding new clients
- Rate limiting is configured per-route via `$meta` — see `src/lib/orpc/rate-limit.ts`
- File uploads (user images) are stored on disk at `UPLOADS_PATH`, resized to 256x256 webp via Sharp

## Pre-PR Checks

```bash
bunx biome check apps/api && cd apps/api && bun build.ts
```

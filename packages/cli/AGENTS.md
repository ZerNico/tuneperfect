# CLI Package — Agent Guide

## Package Identity

- **`@tuneperfect/cli`** — Developer CLI tool for local development
- Built with [Clerc](https://github.com/mrozio13pl/clerc) command framework
- Single entry point: `src/index.ts`

## Usage

```bash
bun run tuneperfect dev                          # start full dev environment
bun run tuneperfect dev --filter game --filter api  # start subset of apps
```

## What It Does

The `dev` command:
1. Generates local TLS certificates via `mkcert` (stored in `.tmp/certs/`)
2. Starts Caddy reverse proxy (reads `Caddyfile` in project root)
3. Starts Turborepo dev for all (or filtered) apps

## Patterns & Conventions

- ✅ **DO**: Add new CLI commands using Clerc's `.command()` + `.on()` pattern
- ✅ **DO**: Use `Bun.spawn` for child processes (not `child_process`)
- The CLI runs via `bun run ./node_modules/@tuneperfect/cli/src/index.ts` from root

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry — all commands defined here |

## Pre-PR Checks

```bash
bunx biome check packages/cli
```

# Game — Agent Guide

## Package Identity

- **`@tuneperfect/game`** — Tauri v2 desktop karaoke game (SolidJS frontend + Rust backend)
- **Frontend**: SolidJS, TanStack Router, TanStack Query, Tailwind CSS v4
- **Backend (native)**: Rust — audio I/O (cpal), pitch detection (dywapitchtrack), UltraStar song parsing
- Connects to API via oRPC, to companion app via WebRTC (host side)

## Setup & Run

```bash
bun run dev                        # tauri dev (Rust + Vite)
bun run build                      # tauri build (production)
bun run dev:vite                   # vite-only dev (no Tauri shell)
bun run build:vite                 # vite-only build
```

Requires: Rust toolchain, Tauri CLI, `.env` (copy from `.env.example`)

## Patterns & Conventions

### File organization

```
src/
├── assets/icons/         # Custom SVG icons (loaded via unplugin-icons)
├── components/           # Reusable UI components
│   ├── ui/               # Generic primitives (button, input, select, avatar)
│   ├── game/             # In-game components (pitch display, score, progress)
│   └── song-select/      # Song selection UI (scroller, grid, cards, search)
├── contexts/             # SolidJS contexts (game-client)
├── hooks/                # Custom hooks (navigation, text-input, wake-lock)
├── i18n/                 # Translation dictionaries (en.ts, de.ts)
├── lib/
│   ├── game/             # Core game logic (game, player, pitch rendering)
│   ├── ultrastar/        # UltraStar format parsing (notes, songs, medley)
│   ├── webrtc/           # WebRTC host connection logic
│   └── utils/            # Utility functions
├── routes/               # TanStack file-based routes
├── stores/               # SolidJS reactive stores (settings, songs, lobby, round)
src-tauri/
├── src/
│   ├── audio/            # Rust audio pipeline (device, input, output, recorder)
│   ├── commands/         # Tauri commands (songs, microphones, pitch)
│   ├── ultrastar/        # UltraStar parser + filesystem scanner (Rust)
│   └── media_server.rs   # Local media file server for songs
```

### SolidJS patterns

- ✅ **DO**: Use functional components — see `src/components/ui/button.tsx`
- ✅ **DO**: Use `cva` for component variants — see `src/components/ui/button.tsx`
- ✅ **DO**: Use store pattern for global state — see `src/stores/settings.tsx`
- ✅ **DO**: Validate store schemas with Valibot — see `src/stores/settings.tsx`
- ✅ **DO**: Use `~/` path alias for imports (maps to `src/`)
- ✅ **DO**: Create contexts with `createContext` + `useXyz` accessor — see `src/lib/game/game-context.tsx`
- ❌ **DON'T**: Use React patterns (useEffect, useState) — this is SolidJS

### Routing

- File-based routing via TanStack Router plugin
- Route tree auto-generated at `src/routeTree.gen.ts` — **never edit manually**
- Layout routes use underscore prefix: `_auth.tsx`, `_no-auth.tsx`
- Dynamic params use `$` prefix: `$id.tsx`, `$hash.tsx`, `$path.tsx`

### i18n

- Dictionaries in `src/i18n/en.ts` and `src/i18n/de.ts`
- Flat key structure: `{ "section.key": "value" }` via `@solid-primitives/i18n`
- Access via `t("section.key")` — see `src/lib/i18n.ts` (game) for setup

### Tauri / Rust

- Tauri commands in `src-tauri/src/commands/`
- TypeScript bindings auto-generated at `src/bindings.ts` via `tauri-specta` — **never edit manually**
- Audio pipeline: `src-tauri/src/audio/` (cpal device → resampler → processor → pitch)
- UltraStar song format parsed in both Rust (`src-tauri/src/ultrastar/`) and TS (`src/lib/ultrastar/`)

### WebRTC (host side)

- Game acts as **host** in WebRTC connections (companion app is guest)
- Connection logic: `src/lib/webrtc/host-connection.ts`
- oRPC-over-WebRTC router: `src/lib/webrtc/router.ts`
- Contracts defined in `@tuneperfect/webrtc` package

## Key Files

| File                                | Purpose                                        |
| ----------------------------------- | ---------------------------------------------- |
| `src/main.tsx`                      | App entry — QueryClient, Router setup          |
| `src/routes/__root.tsx`             | Root route — wake lock, navigation, fullscreen |
| `src/stores/settings.tsx`           | Persistent settings store (Valibot-validated)  |
| `src/stores/songs.tsx`              | Song library state                             |
| `src/stores/lobby.tsx`              | Lobby/multiplayer state                        |
| `src/stores/round.tsx`              | Current game round state (scores, players)     |
| `src/lib/game/game.tsx`             | Core game loop (audio sync, scoring)           |
| `src/lib/game/pitch.tsx`            | Pitch detection + rendering                    |
| `src/lib/orpc.ts`                   | oRPC client setup (API connection)             |
| `src/lib/webrtc/host-connection.ts` | WebRTC host connection                         |
| `src-tauri/src/lib.rs`              | Tauri plugin registration, command binding     |
| `src-tauri/src/commands/songs.rs`   | Song scanning/loading commands                 |
| `src-tauri/src/audio/recorder.rs`   | Microphone recording pipeline                  |

## JIT Index Hints

```bash
rg -n "export default function\|export function" src/components/   # find components
rg -n "createRoute\|createFileRoute" src/routes/                   # find routes
rg -n "createPersistentStore\|createSignal" src/stores/            # find stores
rg -n "#\[tauri::command\]" src-tauri/src/                         # find Tauri commands
rg -n "pub fn\|pub async fn" src-tauri/src/                        # find Rust public functions
rg -n "export const use" src/hooks/                                # find hooks
```

## Common Gotchas

- `src/routeTree.gen.ts` and `src/bindings.ts` are **auto-generated** — never edit them
- The game uses `VITE_API_URL` and `VITE_APP_URL` env vars (client-side, `VITE_` prefix required)
- Song files live on-disk and are served via a local Tauri media server, not fetched from the API
- Audio processing happens in Rust — TS only handles UI rendering of pitch/score data
- The `~/` import alias resolves to `src/` — always prefer it over relative paths

## Pre-PR Checks

```bash
bun run lint apps/game && bun run format:check apps/game && cd apps/game && bun run build:vite
```

For Rust changes:

```bash
cd apps/game/src-tauri && cargo check
```

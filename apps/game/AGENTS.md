# Game — Agent Guide

## Package Identity

- **`@tuneperfect/game`** — Electron desktop karaoke game (SolidJS renderer + Rust native addon)
- **Frontend**: SolidJS, TanStack Router, TanStack Query, Tailwind CSS v4
- **Main process**: Electron (`electron/`), talks to the renderer over a typed oRPC contract on a MessagePort
- **Native**: Rust addon via napi-rs (`native/`) — audio I/O (cpal), pitch detection (dywapitchtrack), UltraStar song parsing, USDB, loopback media server
- Connects to API via oRPC, to companion app via WebRTC (host side)

## Setup & Run

```bash
bun run dev                        # Vite + Electron; on Rust changes rebuilds the addon, regenerates types.gen.ts, restarts Electron
bun run dev -- --songpath <dir>    # pass app arguments after `--`
bun run build                      # vite build + main-process bundle + release native build
bun run package -- --arch x64      # build + installers for this OS (release/); same script CI runs
bun run package:dir                # build + unpacked app only
bun run native:build               # build the Rust addon once (`dev` does this itself)
bun run native:types               # regenerate src/lib/native/types.gen.ts outside the dev loop
bun run typecheck                  # main process + renderer (run `native:build` once first)
bun run dev:vite                   # vite-only dev (no Electron shell)
```

Requires: Rust toolchain, `.env` (copy from `.env.example`); on Linux `libasound2-dev`

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
src/lib/native/           # oRPC contract, typed client, types generated from Rust (types.gen.ts)
src/lib/platform/         # App/OS services (store, dialog, window, updater, …) over that client
electron/
├── main.ts               # App lifecycle, window, app:// protocol, CSP, permissions
├── rpc/                  # Contract implementation: native.ts (addon), platform.ts (OS services)
├── updater.ts            # Tauri-style updater: minisign-verified download, per-OS install
├── store.ts              # JSON stores in the same data dir the Tauri version used
├── window-state.ts       # Window size/position in Tauri's .window-state.json
├── logger.ts             # Log file in Tauri's location and format
├── menu.ts               # Application menu (Tauri's; no reload/devtools when packaged)
└── preload.ts            # Hands the renderer's MessagePort to main
native/
├── src/
│   ├── napi_api.rs       # JavaScript-facing exports of the addon
│   ├── audio/            # Rust audio pipeline (device, input, output, recorder)
│   ├── commands/         # Songs, microphones, pitch
│   ├── ultrastar/        # UltraStar parser + filesystem scanner (Rust)
│   ├── usdb/             # USDB client
│   └── local_server.rs   # Local HTTP server: /media/* song files, /embed/* static pages
scripts/                  # dev loop, main-process bundling, packaging
resources/icons/          # App icons for electron-builder
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

### Electron / Rust

- The renderer calls the main process only through `native` from `~/lib/native/client` (typed by `src/lib/native/contract.ts`); streams (song parsing, USDB sync, update install) are oRPC event iterators
- Adding a call: extend the contract, implement it in `electron/rpc/`, and if it needs Rust, export it from `native/src/napi_api.rs` (types in `native/index.d.ts` are generated by the napi build)
- `src/lib/native/types.gen.ts` is generated from the Rust types (`specta::Type` derives, registered in `native/src/typescript.rs`) — `bun run dev` keeps it current; without the dev loop run `bun run native:types`. CI fails if it's stale
- Rust `log` output and renderer `console.warn/error` go to the log file (`~/Library/Logs/<identifier>/Tune Perfect.log` on macOS)
- Audio pipeline: `native/src/audio/` (cpal device → resampler → processor → pitch)
- UltraStar song format parsed in both Rust (`native/src/ultrastar/`) and TS (`src/lib/ultrastar/`)
- Song folders must be granted (dialog pick, `--songpath`, or saved settings) before Rust parses or serves them — see `native/src/path_allowlist.rs`

### WebRTC (host side)

- Game acts as **host** in WebRTC connections (companion app is guest), using Chromium's `RTCPeerConnection`
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
| `src/lib/native/contract.ts`        | Renderer ↔ main process contract               |
| `electron/main.ts`                  | Electron entry — window, protocol, security    |
| `electron/rpc.ts`                   | Contract implementation                        |
| `native/src/napi_api.rs`            | Native addon exports                           |
| `native/src/commands/songs.rs`      | Song scanning/loading                          |
| `native/src/audio/recorder.rs`      | Microphone recording pipeline                  |

## JIT Index Hints

```bash
rg -n "export default function\|export function" src/components/   # find components
rg -n "createRoute\|createFileRoute" src/routes/                   # find routes
rg -n "createPersistentStore\|createSignal" src/stores/            # find stores
rg -n "#\[napi\]" native/src/                                     # find native exports
rg -n "\.handler\(" electron/rpc.ts                                # find contract implementations
rg -n "pub fn\|pub async fn" native/src/                           # find Rust public functions
rg -n "export const use" src/hooks/                                # find hooks
```

## Common Gotchas

- `src/routeTree.gen.ts` and `native/index.{cjs,d.ts}` are **auto-generated** — never edit them
- The game uses `VITE_API_URL` and `VITE_APP_URL` env vars (client-side, `VITE_` prefix required)
- Song files live on-disk, not fetched from the API — served to the renderer by the Rust local server (`http://localhost:240xx/media/...`)
- Settings/scores are JSON files in the data dir the Tauri version used (`localhost.tuneperfect.game` in dev, `org.tuneperfect.game` packaged); set `TUNEPERFECT_STORE_DIR` to use a copy
- Terminals inside Electron-based editors may export `ELECTRON_RUN_AS_NODE=1`; `scripts/dev.ts` strips it, but clear it when launching a packaged build by hand
- In-app updates only work in packaged builds with `TUNEPERFECT_UPDATE_ENDPOINT`/`TUNEPERFECT_UPDATE_PUBKEY` set at build time (CI does this)
- Audio processing happens in Rust — TS only handles UI rendering of pitch/score data
- The `~/` import alias resolves to `src/` — always prefer it over relative paths

## Pre-PR Checks

```bash
bun run lint apps/game && bun run format:check apps/game && cd apps/game && bun run build:vite
```

```bash
cd apps/game && bun run test && bunx tsc --noEmit -p electron/tsconfig.json
```

For Rust changes:

```bash
cd apps/game/native && cargo test
```

# WebRTC Package — Agent Guide

## Package Identity

- **`@tuneperfect/webrtc`** — Shared WebRTC utilities, oRPC-over-DataChannel transport, and peer contracts
- Used by `apps/game` (host) and `apps/app` (guest) for real-time peer-to-peer communication
- Pure TypeScript library — no framework dependency

## Exports

```ts
import { ... } from "@tuneperfect/webrtc/orpc";          // oRPC transport (link + handler)
import { ... } from "@tuneperfect/webrtc/orpc/client";    // RPC link for client side
import { ... } from "@tuneperfect/webrtc/orpc/server";    // RPC handler for server side
import { ... } from "@tuneperfect/webrtc/utils";          // Config, helpers, types
import { ... } from "@tuneperfect/webrtc/contracts";       // All contracts
import { ... } from "@tuneperfect/webrtc/contracts/game";  // Game-specific contracts
```

## Patterns & Conventions

### File organization

```
src/
├── contracts/            # oRPC contract definitions (type-only, no implementation)
│   ├── index.ts          # Re-exports
│   └── game.ts           # What the game serves to phones (songs, covers, ping)
├── orpc/                 # oRPC-over-WebRTC DataChannel transport
│   ├── index.ts          # Re-exports
│   ├── rpc-link.ts       # Client-side oRPC link (sends via DataChannel)
│   ├── rpc-handler.ts    # Server-side oRPC handler (receives via DataChannel)
│   ├── link-client.ts    # Low-level link client
│   ├── handler.ts        # Low-level handler
│   └── data-channel.ts   # DataChannel abstraction
└── utils/                # Shared WebRTC utilities
    ├── index.ts          # Re-exports
    ├── config.ts         # WebRTC config constants (ICE, reconnect, heartbeat)
    ├── types.ts          # Shared types
    ├── ice-buffer.ts     # ICE candidate buffering
    ├── ice-servers.ts    # STUN/TURN servers, refetched hourly (TURN credentials expire)
    ├── heartbeat.ts      # Connection heartbeat
    └── channel-helpers.ts # DataChannel helper functions
```

### Contract pattern

- ✅ **DO**: Define contracts with `oc` from `@orpc/contract` — see `src/contracts/game.ts`
- ✅ **DO**: Use Valibot schemas for contract I/O types
- ✅ **DO**: Export both the contract and inferred types (`GameContract`, `GameClient`, `GameOutputs`)
- ❌ **DON'T**: Put implementation logic here — only contracts and transport

### How it connects

1. **App** (guest, a phone) creates the `RTCPeerConnection` and two DataChannels, `game-rpc` and `game-control`, sends the offer and calls the game with `rpc-link`
2. **Game** (host) answers and serves `gameContract` on both channels with `rpc-handler`. Song lists and covers go over `game-rpc`; ping and remote control go over `game-control` (`apps/app/src/lib/webrtc/game-link.ts`), so they don't wait behind big replies. Phones only use `game-control` once `ping` lists `CONTROL_CHANNEL_FEATURE`: older games only serve `game-rpc`
3. Signaling (offer/answer/ICE) goes through the API's signaling endpoints. Every signal of a phone's connection attempt carries the same `session` id, which the game echoes: signals of an older attempt are ignored, and a second offer with the same session is an ICE restart on the existing connection
4. TURN credentials from the API expire after 24 h (for opening new relays). `createIceServerSource` refetches them after an hour, and both sides call `setIceServers` with fresh ones before an ICE restart
5. The phone reconnects by itself (`apps/app/src/stores/connection.ts`): an ICE restart first when the connection is `disconnected`, a new connection when it failed, the heartbeat stopped answering or an offer got no answer within `connectionTimeout`

## Key Files

| File                      | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `src/contracts/game.ts`   | Game contracts (songs list, ping)             |
| `src/orpc/rpc-link.ts`    | oRPC client link over DataChannel             |
| `src/orpc/rpc-handler.ts` | oRPC server handler over DataChannel          |
| `src/utils/config.ts`     | WebRTC constants (timeouts, reconnect policy) |
| `src/utils/heartbeat.ts`  | Heartbeat keep-alive mechanism                |

## JIT Index Hints

```bash
rg -n "export const.*Contract\|export type.*Contract" src/contracts/   # find contracts
rg -n "WEBRTC_CONFIG" src/utils/config.ts                               # find config constants
```

## Common Gotchas

- Released games and the deployed app talk to each other across versions: keep contract and signal changes backwards compatible (new fields optional, old channels ignored rather than required)
- `bun test` here covers chunking (`src/orpc/data-channel.test.ts`)

- This package has **no build step** — consumers import `.ts` files directly via workspace exports
- Contracts must stay framework-agnostic (no SolidJS/React imports)
- The `@orpc/standard-server-peer` dep provides the DataChannel transport primitives

## Pre-PR Checks

```bash
bun run lint packages/webrtc && bun run format:check packages/webrtc
```

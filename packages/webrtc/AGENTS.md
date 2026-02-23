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
import { ... } from "@tuneperfect/webrtc/contracts/app";   // App-specific contracts
```

## Patterns & Conventions

### File organization
```
src/
├── contracts/            # oRPC contract definitions (type-only, no implementation)
│   ├── index.ts          # Re-exports
│   ├── game.ts           # Contracts for game → app communication
│   └── app.ts            # Contracts for app → game communication
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
    ├── heartbeat.ts      # Connection heartbeat
    └── channel-helpers.ts # DataChannel helper functions
```

### Contract pattern
- ✅ **DO**: Define contracts with `oc` from `@orpc/contract` — see `src/contracts/game.ts`
- ✅ **DO**: Use Valibot schemas for contract I/O types
- ✅ **DO**: Export both the contract and inferred types (`GameContract`, `GameClient`, `GameOutputs`)
- ❌ **DON'T**: Put implementation logic here — only contracts and transport

### How it connects
1. **Game** (host) creates `RTCPeerConnection`, opens DataChannels, attaches `rpc-handler`
2. **App** (guest) connects as peer, uses `rpc-link` to call procedures over DataChannel
3. Signaling (offer/answer/ICE) goes through the API's signaling endpoints

## Key Files

| File | Purpose |
|------|---------|
| `src/contracts/game.ts` | Game contracts (songs list, ping) |
| `src/contracts/app.ts` | App contracts |
| `src/orpc/rpc-link.ts` | oRPC client link over DataChannel |
| `src/orpc/rpc-handler.ts` | oRPC server handler over DataChannel |
| `src/utils/config.ts` | WebRTC constants (timeouts, reconnect policy) |
| `src/utils/heartbeat.ts` | Heartbeat keep-alive mechanism |

## JIT Index Hints

```bash
rg -n "export const.*Contract\|export type.*Contract" src/contracts/   # find contracts
rg -n "WEBRTC_CONFIG" src/utils/config.ts                               # find config constants
```

## Common Gotchas

- This package has **no build step** — consumers import `.ts` files directly via workspace exports
- Contracts must stay framework-agnostic (no SolidJS/React imports)
- The `@orpc/standard-server-peer` dep provides the DataChannel transport primitives

## Pre-PR Checks

```bash
bunx biome check packages/webrtc
```

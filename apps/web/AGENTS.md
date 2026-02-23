# Web (Marketing Site) — Agent Guide

## Package Identity

- **`@tuneperfect/web`** — Marketing/landing website with SSR
- **Stack**: SolidStart (TanStack Start + Nitro + Vite), Tailwind CSS v4, PostHog analytics
- Lightweight site with download pages, legal pages, and product showcase

## Setup & Run

```bash
bun run --bun vite dev --port 3000   # dev server (port 3000, SSR)
vite build                            # production build
node .output/server/index.mjs         # production start
```

Requires `.env`: `VITE_APP_URL`, `SUPPORT_EMAIL`, `GITHUB_REPO`, `VERSION`, `VITE_POSTHOG_TOKEN`

## Patterns & Conventions

### File organization
```
src/
├── assets/icons/         # Platform SVG icons (windows, linux, apple)
├── components/           # Page sections and UI components
│   └── ui/               # Generic UI primitives (button)
├── lib/
│   ├── config.ts         # Runtime config
│   ├── posthog.ts        # PostHog analytics setup
│   └── utils/            # Utilities (cn, color)
├── routes/               # TanStack file-based routes (SSR)
│   ├── index.tsx          # Landing page
│   ├── download/          # Platform-specific download pages
│   ├── privacy-policy.tsx
│   └── terms-of-service.tsx
├── router.tsx            # Router factory
└── styles.css            # Global Tailwind CSS
```

### Component patterns
- ✅ **DO**: Use functional components — see `src/components/ui/button.tsx`
- ✅ **DO**: Use `cn()` utility for conditional class merging — see `src/lib/utils/cn.tsx`
- ✅ **DO**: Use TanStack Start SSR features where applicable
- ❌ **DON'T**: Add auth/API calls here — this is a static marketing site

### Styling
- Tailwind CSS v4 via `@tailwindcss/vite` plugin
- Kobalte for headless components
- Custom icons via `unplugin-icons` (Lucide + custom SVG collection)

## Key Files

| File | Purpose |
|------|---------|
| `src/router.tsx` | Router factory |
| `src/routes/__root.tsx` | Root layout |
| `src/routes/index.tsx` | Landing page |
| `src/components/header.tsx` | Site header/nav |
| `src/components/footer.tsx` | Site footer |
| `src/components/download-card.tsx` | Platform download cards |
| `src/lib/config.ts` | Runtime config from env vars |
| `src/lib/posthog.ts` | Analytics |
| `vite.config.ts` | Vite + SolidStart + Nitro config |

## JIT Index Hints

```bash
rg -n "export default function\|export function" src/components/   # find components
rg -n "createFileRoute" src/routes/                                 # find routes
```

## Common Gotchas

- `src/routeTree.gen.ts` is **auto-generated** — never edit it
- This uses **SolidStart** (SSR via Nitro) — not a plain SPA like the app/game
- Nitro preset is `"bun"` — builds for Bun runtime in production
- PostHog is loaded client-side only

## Pre-PR Checks

```bash
bunx biome check apps/web && cd apps/web && vite build
```

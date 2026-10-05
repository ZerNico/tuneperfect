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
├── components/           # Shared layout pieces (header, footer, glow, download button, 404)
│   ├── home/             # Landing page: hero, feature rows with self-playing game screens, phone join, download
│   ├── download/         # Download page frame, cards, copyable code blocks
│   └── ui/               # Generic UI primitives (button, tag)
├── lib/
│   ├── config.ts         # Runtime config
│   ├── motion.ts         # useFrame / useInView / easing for the animated sections
│   ├── platform.tsx      # Platform list + visitor OS detection
│   └── posthog.ts        # PostHog analytics setup
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
- ✅ **DO**: Animate with transform/opacity, pause off-screen work with `useInView`, and respect reduced motion
  (`prefersReducedMotion`, plus the global `prefers-reduced-motion` rule in `styles.css`)
- ✅ **DO**: Use TanStack Start SSR features where applicable
- ❌ **DON'T**: Add auth/API calls here — this is a static marketing site

### Styling

- Tailwind CSS v4 via `@tailwindcss/vite` plugin; same look as the game: white tags, `shadow-crisp`, mode
  gradients (`gradient-sing|party|lobby|settings`), `stripes`, soft `Glow` backgrounds — no pill buttons
- Icons via `unplugin-icons` with Phosphor (`~icons/ph/*`), like the game and app
- Screenshots live in `public/images/shots/` (captured from the game with demo data, usernames Nina, Steve, Rimuru
  and Max). Prefer a few real screenshots plus self-playing recreations of game screens (`components/home/*-screen.tsx`,
  sized in `cqw` inside `Screen`) that match the game's actual design. No device frames, no interactive toys
- Copy is short and plain: no marketing tone, no `;` or `—`. app.tuneperfect.org is a website, never call it an app

## Key Files

| File                        | Purpose                          |
| --------------------------- | -------------------------------- |
| `src/router.tsx`            | Router factory                   |
| `src/routes/__root.tsx`     | Root layout                      |
| `src/routes/index.tsx`      | Landing page                     |
| `src/components/header.tsx` | Site header/nav                  |
| `src/components/footer.tsx` | Site footer                      |
| `src/components/download/`  | Download page frame and cards    |
| `src/components/home/`      | Landing page sections            |
| `src/lib/config.ts`         | Runtime config from env vars     |
| `src/lib/posthog.ts`        | Analytics                        |
| `vite.config.ts`            | Vite + SolidStart + Nitro config |

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
bun run lint apps/web && bun run format:check apps/web && cd apps/web && vite build
```

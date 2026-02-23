# Email Package — Agent Guide

## Package Identity

- **`@tuneperfect/email`** — Email templates using React Email
- Consumed by `apps/api` for sending transactional emails (verification, password reset)
- Uses **React** (not SolidJS) — React Email requires it

## Setup & Run

```bash
bun run email dev --port 3003      # React Email preview UI
```

## Patterns & Conventions

### File organization
```
├── index.tsx              # Render functions (renderVerifyEmail, renderResetPassword)
├── emails/
│   ├── verify-email.tsx   # Email verification template
│   └── reset-password.tsx # Password reset template
```

- ✅ **DO**: Create new templates in `emails/` and export render functions from `index.tsx`
- ✅ **DO**: Use `@react-email/components` for email-safe HTML
- ✅ **DO**: Provide both HTML and plainText renders
- ❌ **DON'T**: Use SolidJS here — React Email requires React

### Adding a new email template
1. Create `emails/my-template.tsx` with React Email components
2. Export props type and component
3. Add `renderMyTemplate()` function in `index.tsx`
4. Call from API: `import { renderMyTemplate } from "@tuneperfect/email"`

## Key Files

| File | Purpose |
|------|---------|
| `index.tsx` | Render function exports (entry point) |
| `emails/verify-email.tsx` | Email verification template |
| `emails/reset-password.tsx` | Password reset template |

## Pre-PR Checks

```bash
bunx biome check packages/email
```

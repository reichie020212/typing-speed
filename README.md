# typing-speed

A typing speed game. Phases 1, 2a, 2b, and 4 (deploy automation) shipped. Phase 3 (realtime multiplayer) was built and then rolled back; the preserved implementation lives on the `feat/multiplayer` branch.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 (CSS-first `@theme`)
- NextAuth v5 (Google) + Prisma + Postgres (Neon)
- Zod for boundary validation
- Recharts for WPM progression charts
- Biome — lint + format
- Vitest + `@testing-library/react` — unit + smoke tests
- Playwright — e2e scaffold (no tests yet)
- pnpm

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | dev server |
| `pnpm build` | production build |
| `pnpm start` | production server (run after `pnpm build`) |
| `pnpm lint` | Biome check |
| `pnpm lint:fix` | Biome check + write |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest run |
| `pnpm test:watch` | Vitest watch |
| `pnpm e2e` | Playwright (scaffolded; no tests yet) |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate:dev` | Run migrations locally |
| `pnpm db:studio` | Open Prisma Studio |

All four must pass before committing: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Current Phase

**Phase 4 — Deploy Automation** (shipped): CI workflows (`.github/workflows/ci.yml`, `integration.yml`), composite setup action, PR template, and SETUP.md documentation for Neon test branch + branch protection rules.

- Design: `docs/superpowers/specs/2026-04-19-phase-4-deploy-automation-design.md`

**Phase 2b — Social/Competitive** (shipped): Four leaderboards (`/leaderboard`, `/leaderboard/today|weekly|monthly`) with mode-filter tabs, public profiles at `/profile/[username]`, WPM progression chart on dashboard + profile, mode + difficulty filters on `/history`.

- Design: `docs/superpowers/specs/2026-04-19-phase-2b-social-design.md`

**Phase 2a — Foundation** (shipped): Google sign-in + Prisma/Postgres persistence + `/dashboard` + `/profile/[username]` + `/history`. Anonymous single-player continues to work.

- Design: `docs/superpowers/specs/2026-04-19-phase-2a-foundation-design.md`
- Setup (required to enable auth locally): `docs/SETUP.md`

**Phase 1** — single-player typing test (shipped).

- Design: `docs/superpowers/specs/2026-04-19-phase-1-single-player-design.md`

## Running without auth configured

The app builds and runs without Neon / Google OAuth env vars. `/` and `/single-player` work anonymously. Protected pages and leaderboards show a "not configured yet" notice until you complete SETUP.md.

## Content

- 60 curated public-domain passages plus original prose and pangrams.
- Word lists derived from the Norvig top-frequency English list (public domain), filtered to length ≥ 2 and a small blocklist of profanity and sensitive terms.

## Rolled back

**Phase 3 — Multiplayer** was built and then rolled back from main. The complete implementation (Socket.io server, race lobby/countdown/racing/results UI, race persistence) is preserved on the `feat/multiplayer` branch. Historical design and plan docs remain in `docs/superpowers/`.

## Out of scope (coming later)

- AdSense, mobile polish, Playwright e2e test suite.

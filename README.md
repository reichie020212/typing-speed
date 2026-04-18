# typing-speed

A typing speed game. Phase 1 (current) ships single-player with three modes (fixed passage, time, word count). Later phases add realtime multiplayer, Google sign-in, leaderboards, and a stats dashboard.

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 (CSS-first `@theme`)
- Biome — lint + format
- Vitest + `@testing-library/react` — unit + smoke tests
- Playwright — e2e scaffold (no tests yet)
- pnpm

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | dev server (Turbopack) |
| `pnpm build` | production build |
| `pnpm start` | production server (run after `pnpm build`) |
| `pnpm lint` | Biome check |
| `pnpm lint:fix` | Biome check + write |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest run |
| `pnpm test:watch` | Vitest watch |
| `pnpm e2e` | Playwright (scaffolded; no tests yet) |

All four must pass before committing: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Phase 1 scope

- `/` — landing page with CTA.
- `/single-player` — the typing test itself.
- Three modes: `fixed` (one curated passage), `time` (15/30/60s), `words` (10/25/50/100).
- Difficulty tiers for time/words: easy (top 200 words), medium (top 1000), hard (top 3000 + occasional punctuation).
- Live WPM while typing; timer shown in time mode; progress shown in words mode.
- Results panel: WPM, accuracy, raw WPM, time, char breakdown, Next test / Restart / Change mode.
- `Tab`+`Enter` → next test (new content). `Esc` → restart (same content).
- Dark theme default; light toggle in header/footer; preference persists via localStorage.
- Paste is blocked; "Paste is disabled" toast appears.
- Framework-free typing engine in `src/lib/engine/` — reused verbatim in Phase 3 multiplayer.

Design spec: `docs/superpowers/specs/2026-04-19-phase-1-single-player-design.md`.
Implementation plan: `docs/superpowers/plans/2026-04-19-phase-1-single-player.md`.
Browser-verification report: `docs/superpowers/test-reports/2026-04-19-phase-1-browser-verification.md`.

## Content

- 60 curated public-domain passages (Aurelius, Seneca, Austen, Dickens, Lincoln, etc.) plus original prose and pangrams.
- Word lists derived from the Norvig top-frequency English list (public domain), filtered to length ≥ 2 and a small blocklist of profanity and sensitive terms.

## Out of scope for Phase 1

Multiplayer (Socket.io), authentication (NextAuth.js + Google), database (Prisma + Postgres), leaderboards, dashboard, charts, AdSense, mobile soft-keyboard optimization, actual Vercel deploy. All come in Phases 2–4.

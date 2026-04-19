# Phase 2b — Social / Competitive (Design Spec)

**Date:** 2026-04-19
**Scope:** Four leaderboards (all-time / monthly / weekly / today) with mode filters, public profile view, WPM-over-time chart on dashboard + profile, and mode/difficulty filters on `/history`.
**Builds on:** Phase 2a's schema (no migrations needed). Uses the `[createdAt, wpm]` and `[userId, createdAt]` indexes already in place.
**Defers to Phase 3+:** realtime multiplayer, follow/social-graph, profile privacy opt-out, AdSense, Vercel deploy automation.

## 1. Product Goals

Phase 2b turns accumulated personal stats (2a) into a competitive surface. Signed-in (and anonymous) visitors can browse global leaderboards across four time windows and inspect any user's public profile. Dashboards and profiles gain a WPM-over-time chart so progression is legible at a glance. History becomes filterable so users can drill into their own runs by mode and difficulty.

## 2. Feature Decisions

| Decision | Value | Rationale |
|---|---|---|
| Leaderboard row semantics | One row per user — their personal best WPM in the window | "Top typists" is what every major typing site does; prevents a hot-streaked single user from dominating multiple slots |
| Leaderboard segmentation | Four routes (`/leaderboard`, `/leaderboard/today`, `/leaderboard/weekly`, `/leaderboard/monthly`), each with a mode-filter tab `all | fixed | time | words` | One page component, four thin routes; mode as a searchParam filter keeps data shape consistent |
| Window boundaries | **Calendar + UTC**. today = since 00:00 UTC; weekly = since Monday 00:00 UTC; monthly = since the 1st 00:00 UTC | Global shared artifact; rolling boundaries feel too smooth for competitive framing |
| Window header | Show "Resets in Xh Ym" (live-ticking) on today/weekly/monthly | Legible boundary = motivating |
| Top N | 100 per page with "Show more" offset pagination | Classic high-score feel; "Show more" covers long tails without overwhelming |
| Tie-break | Higher accuracy wins; then earlier timestamp | Rewards clean typing; deterministic |
| Minimum-tests threshold | ≥ 3 tests in the window for today/weekly/monthly; none for all-time | Filters one-shot outliers on the noisy boards; preserves legendary single scores on all-time |
| Public profile visibility | Mirror of the owner dashboard (minus rename form); **noindex** meta | Social surface of the site is shallow without real content; noindex is a safe posture for user privacy |
| WPM chart window | Last 50 tests, per-user | Trajectory is the interesting story; calendar gaps are noise |
| WPM chart mode | All modes combined in one line; the page's mode filter re-queries to narrow | Simplest rendering; matches leaderboard semantics |
| WPM chart empty state | < 5 tests → placeholder "Take a few more tests to see your WPM progression." | Avoid noisy charts with 1–2 points |
| History filters | Mode + difficulty; no date range in 2b | Date-range adds UI weight disproportionate to value at this scope |
| Filter state | URL searchParams (`?mode=time&difficulty=hard`); no localStorage | Shareable, back-button-friendly, pairs cleanly with cursor pagination |
| Leaderboard caching | None | Queries are cheap with existing indexes; invalidation complexity not worth it at our traffic |

## 3. Tech Stack Additions

- **recharts** — runtime dependency added to `package.json`.
- Pure Prisma `$queryRaw` via `Prisma.sql\`…\`` template for the leaderboard query.

Everything else already in the project (NextAuth v5, Prisma 6, Zod, Next.js 16 App Router, Tailwind v4).

## 4. Data Layer

### 4.1 `src/lib/db/time-windows.ts` (pure, no DB)

```ts
export type Window = 'alltime' | 'today' | 'weekly' | 'monthly';

export function windowStart(window: Window, now: Date = new Date()): Date | null {
  if (window === 'alltime') return null;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (window === 'today') return d;
  if (window === 'weekly') {
    // Monday 00:00 UTC. UTC Sunday = 0; Monday = 1; Saturday = 6.
    const day = d.getUTCDay();
    const daysSinceMonday = (day + 6) % 7; // Mon=0, Tue=1, ... Sun=6
    const start = new Date(d);
    start.setUTCDate(d.getUTCDate() - daysSinceMonday);
    return start;
  }
  // monthly
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function windowDeadline(window: Window, now: Date = new Date()): Date | null {
  const start = windowStart(window, now);
  if (!start) return null;
  if (window === 'today') {
    return new Date(start.getTime() + 24 * 60 * 60 * 1000);
  }
  if (window === 'weekly') {
    return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  // monthly — next month start
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}
```

### 4.2 `src/lib/db/leaderboards.ts`

```ts
import { Prisma } from '@prisma/client';
import { prisma } from './client';
import { windowStart, type Window } from './time-windows';

export type ModeFilter = 'all' | 'fixed' | 'time' | 'words';

export interface LeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  image: string | null;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  mode: 'fixed' | 'time' | 'words';
  createdAt: Date;
}

export async function getLeaderboard(opts: {
  window: Window;
  mode: ModeFilter;
  limit?: number;
  offset?: number;
}): Promise<LeaderboardRow[]> {
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  const start = windowStart(opts.window);
  const minTests = opts.window === 'alltime' ? 0 : 3;
  const modeFilter = opts.mode === 'all' ? null : opts.mode;

  type Raw = {
    user_id: string;
    username: string;
    image: string | null;
    wpm: number;
    raw_wpm: number;
    accuracy: number;
    mode: 'fixed' | 'time' | 'words';
    created_at: Date;
  };

  const rows = await prisma.$queryRaw<Raw[]>`
    WITH user_counts AS (
      SELECT "userId" AS user_id, COUNT(*) AS c
      FROM "Result"
      WHERE (${start}::timestamp IS NULL OR "createdAt" >= ${start})
        AND (${modeFilter}::text IS NULL OR "mode" = ${modeFilter}::"Mode")
      GROUP BY "userId"
      HAVING COUNT(*) >= ${minTests}
    ),
    best_per_user AS (
      SELECT DISTINCT ON (r."userId")
        r."userId"  AS user_id,
        u.username  AS username,
        u.image     AS image,
        r.wpm       AS wpm,
        r."rawWpm"  AS raw_wpm,
        r.accuracy  AS accuracy,
        r.mode::text AS mode,
        r."createdAt" AS created_at
      FROM "Result" r
      JOIN "User" u ON u.id = r."userId"
      JOIN user_counts uc ON uc.user_id = r."userId"
      WHERE (${start}::timestamp IS NULL OR r."createdAt" >= ${start})
        AND (${modeFilter}::text IS NULL OR r.mode = ${modeFilter}::"Mode")
      ORDER BY r."userId", r.wpm DESC, r.accuracy DESC, r."createdAt" ASC
    )
    SELECT * FROM best_per_user
    ORDER BY wpm DESC, accuracy DESC, created_at ASC
    LIMIT ${limit} OFFSET ${offset};
  `;

  return rows.map((r, i) => ({
    rank: offset + i + 1,
    userId: r.user_id,
    username: r.username,
    image: r.image,
    wpm: r.wpm,
    rawWpm: r.raw_wpm,
    accuracy: r.accuracy,
    mode: r.mode,
    createdAt: r.created_at,
  }));
}

export async function getWpmProgression(
  userId: string,
  opts: { mode?: ModeFilter; limit?: number } = {},
): Promise<{ createdAt: Date; wpm: number; mode: 'fixed' | 'time' | 'words' }[]> {
  const limit = opts.limit ?? 50;
  const mode = opts.mode && opts.mode !== 'all' ? opts.mode : undefined;
  const items = await prisma.result.findMany({
    where: { userId, ...(mode ? { mode } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { createdAt: true, wpm: true, mode: true },
  });
  return items;
}
```

**Query notes:**
- `${start}::timestamp IS NULL OR "createdAt" >= ${start}` — when `start` is `null` (all-time), the predicate is vacuously true. Prisma passes `null` correctly through the template.
- `${modeFilter}::text IS NULL OR "mode" = ${modeFilter}::"Mode"` — same trick for the optional mode filter. The cast to the generated enum name `"Mode"` keeps Postgres happy.
- The outer `ORDER BY wpm DESC, accuracy DESC, created_at ASC` is required because `DISTINCT ON` forces its own `ORDER BY` on `userId` first; without a second sort the rank order is wrong.

### 4.3 `listResultsForUser` extension (in `src/lib/db/results.ts`)

```ts
export interface ListResultsOpts {
  cursor?: string;
  limit?: number;
  mode?: 'fixed' | 'time' | 'words';
  difficulty?: 'easy' | 'medium' | 'hard';
}

export async function listResultsForUser(
  userId: string,
  { cursor, limit = 25, mode, difficulty }: ListResultsOpts,
): Promise<{ items: Result[]; nextCursor: string | null }> {
  const items = await prisma.result.findMany({
    where: { userId, ...(mode ? { mode } : {}), ...(difficulty ? { difficulty } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;
  return { items: page, nextCursor };
}
```

The extension is back-compat: existing callers (`/dashboard`, `/profile/[username]`) pass `{ limit }` only and see no change.

## 5. Routes

```
src/app/
├─ leaderboard/
│  ├─ page.tsx              # all-time
│  ├─ today/page.tsx
│  ├─ weekly/page.tsx
│  └─ monthly/page.tsx
├─ profile/[username]/page.tsx   # modified — public view + owner view
├─ dashboard/page.tsx             # modified — add WpmProgressionChart
└─ history/page.tsx               # modified — add filters
```

### 5.1 Leaderboard pages

Each route is a thin wrapper around `<LeaderboardPage window={…} />`. The shared component:
- Reads `searchParams.mode` and `searchParams.offset`.
- Defaults missing/invalid `mode` to `'all'`; coerces `offset` to a non-negative integer.
- Calls `getLeaderboard({ window, mode, limit: 101, offset })`; uses the `hasMore` sentinel pattern (query for `limit + 1` to know whether a "Show more" link is warranted).
- Renders the header, `WindowNav`, `WindowCountdown` (only on non-alltime; the server passes `deadline={windowDeadline(window)!.toISOString()}` since the countdown is a client component and `Date` isn't serializable in the RSC payload), `ModeTabs`, `LeaderboardTable`, `ShowMoreLink` (or nothing when exhausted).
- Renders a "Leaderboards aren't configured yet" notice when `isAuthConfigured()` is false.

### 5.2 Public profile (`/profile/[username]`)

Structure for **both** owner and non-owner views:
1. Header: username, small "joined {date}" line, avatar if available.
2. Stats strip: best WPM, avg WPM, total tests (three cards).
3. Best-by-mode mini-table.
4. WPM progression chart (Recharts).
5. Recent tests (last 10 rows).

Additional **owner-only** section at the bottom: rename form (unchanged from 2a).

**Metadata:**
```ts
export const metadata = { robots: 'noindex, nofollow' };
```

The page no longer bails for non-owners; the "this profile isn't public yet" stub is removed.

### 5.3 Dashboard

Minor modification: insert `<WpmProgressionChart points={progression} />` between the "Best by mode" strip and "Recent tests".

### 5.4 History with filters

Reads `searchParams.mode`, `searchParams.difficulty` plus the existing `cursor`. Normalizes both filters (invalid → undefined). Passes through to `listResultsForUser`. Renders `HistoryFilterTabs` above the table.

## 6. Components

### 6.1 `src/components/leaderboard/LeaderboardPage.tsx`

Shared server component. Takes `{ window, searchParams }`. See Section 5.1.

### 6.2 `src/components/leaderboard/LeaderboardTable.tsx`

Presentational server component.

```tsx
interface Props {
  rows: LeaderboardRow[];
  startRank: number;  // 1 for first page, 101 for the second page
}
```

Columns: rank (right-aligned `#`), avatar + username link (`/profile/<username>`), mode pill (`fixed | time | words`), WPM (right, mono, accent), accuracy (right, mono, muted), date (`<LocalDate>`, muted).

### 6.3 `src/components/leaderboard/ModeTabs.tsx`

Uses the existing `Toggle` primitive. Four pills; clicking navigates to `?mode=<value>&offset=0`. Preserves other query params implicitly via `<Link>` hrefs built from current pathname.

### 6.4 `src/components/leaderboard/WindowNav.tsx`

Four pills as links to each window route. Active window highlighted.

### 6.5 `src/components/leaderboard/WindowCountdown.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';

interface Props {
  deadline: string;  // ISO string
}

export function WindowCountdown({ deadline }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const ms = Math.max(0, new Date(deadline).getTime() - now);
  const h = Math.floor(ms / (60 * 60 * 1000));
  const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  return (
    <p className="text-xs text-[color:var(--muted)]">
      Resets in {h > 0 ? `${h}h ` : ''}{m}m
    </p>
  );
}
```

### 6.6 `src/components/leaderboard/ShowMoreLink.tsx`

Server component. Renders a centered `<Link>` to `?offset=<nextOffset>&mode=<current>`.

### 6.7 `src/components/charts/WpmProgressionChart.tsx`

See Section 3 of the brainstorm write-up. Client component wrapping Recharts `AreaChart`. Empty state when `points.length < 5`.

### 6.8 `src/components/history/HistoryFilterTabs.tsx`

Server component. Takes `{ label, paramName, current, options, pathname, otherParams }`. Renders pills as links. Each link URL is built from `pathname?mode=<new>&difficulty=<current>` (preserving the other filter, dropping `cursor`).

### 6.9 `AuthMenu` addition

Add a "Leaderboards" menu item between "Dashboard" and "Profile".

## 7. Query Normalization

Shared normalization helpers live in `src/lib/params.ts` (new):

```ts
export function normalizeMode(raw: string | undefined): 'fixed' | 'time' | 'words' | undefined {
  if (raw === 'fixed' || raw === 'time' || raw === 'words') return raw;
  return undefined;
}

export function normalizeDifficulty(raw: string | undefined): 'easy' | 'medium' | 'hard' | undefined {
  if (raw === 'easy' || raw === 'medium' || raw === 'hard') return raw;
  return undefined;
}

export function normalizeModeFilter(raw: string | undefined): 'all' | 'fixed' | 'time' | 'words' {
  const v = normalizeMode(raw);
  return v ?? 'all';
}

export function parseOffset(raw: string | undefined, max = 10_000): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), max);
}
```

These keep invalid/malicious searchParams from reaching the DB.

## 8. Testing

### 8.1 Unit tests (always run)

**`tests/unit/lib/db/time-windows.test.ts`** — use `vi.setSystemTime` to pin "now":
- all-time → `null` for both start and deadline.
- today → midnight UTC; deadline exactly 24h later.
- weekly → previous Monday 00:00 UTC regardless of day-of-week; deadline 7 days later.
- monthly → 1st of current month 00:00 UTC; deadline = next month 00:00 UTC.
- Edge cases: Sunday 11 PM UTC resolves "weekly" to the previous Monday; cross-month boundary; DST is N/A (UTC only).

**`tests/unit/lib/params.test.ts`** — normalization helpers with valid + invalid inputs.

### 8.2 Integration tests (`DATABASE_URL` gated)

**`tests/integration/db/leaderboards.test.ts`:**
- Seed 5 users with varied tests.
- All-time: asserts ordering by WPM desc, one row per user, each user's single best.
- `window=today`: threshold enforcement — user with 2 tests in-window is excluded, user with 3 is included.
- `mode='fixed'`: filters to fixed-mode results only; a user whose best is a `time` result but second-best is `fixed` should appear with their best fixed.
- Tie-break: two users same WPM, different accuracy → higher accuracy first.
- `offset` + `limit`: asserting disjoint slices.
- `getWpmProgression`: newest-first order, limit honored, mode filter.

**`tests/integration/db/history-filters.test.ts`:**
- `listResultsForUser` with `mode` filter only; with `difficulty` only; with both.

### 8.3 Skipped in 2b

- Recharts SVG assertions — presentational; tooltip + color rely on Recharts' own tests.
- Playwright e2e — deferred to Phase 4 polish.

### 8.4 Quality gates

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` (unit; integration runs if `DATABASE_URL` set)
- `pnpm build`

## 9. Deploy Readiness

No schema changes → no migration. Recharts adds ~50 KB gzipped to the profile/dashboard bundle; acceptable. The new leaderboard pages are server-rendered with no client JS except the tiny `WindowCountdown`.

## 10. Out of Scope (Deferred)

- Follow / followers / social graph.
- Profile privacy opt-out (everyone public by default in 2b; opt-out later).
- Date-range filter on history.
- Combined-metric leaderboards (avg-of-top-N, rating systems).
- Materialized views / leaderboard caching.
- Search-indexable profiles (`noindex` for now).
- Per-mode separate leaderboard *routes* (we have one route per window with a mode *filter*; if the filter becomes the primary axis later, we revisit).
- Highlighting the current user's rank when outside the top 100 ("You are #312").

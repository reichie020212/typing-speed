# Phase 2b — Social / Competitive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four leaderboard pages (all-time / today / weekly / monthly with a mode filter each), open public profiles at `/profile/[username]`, a WPM progression chart on dashboard + profile, and mode/difficulty filters on `/history`.

**Architecture:** Pure Postgres `DISTINCT ON` query via `prisma.$queryRaw` for leaderboard rows; pure UTC time-window helpers testable without a DB; a thin Recharts client leaf for the chart; URL-searchParam state for mode/difficulty/offset filters. No schema changes, no caching layer, no new infra.

**Tech Stack:** Inherits Phase 2a (Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, NextAuth v5, Prisma 6 + Neon Postgres, Zod, Biome, Vitest, pnpm). Adds **recharts** as a runtime dependency.

**Spec:** `docs/superpowers/specs/2026-04-19-phase-2b-social-design.md`.

---

## File Structure

```
src/
├─ app/
│  ├─ leaderboard/
│  │  ├─ page.tsx              # new — all-time
│  │  ├─ today/page.tsx        # new
│  │  ├─ weekly/page.tsx       # new
│  │  └─ monthly/page.tsx      # new
│  ├─ profile/[username]/page.tsx   # modify — open to non-owners; chart; recent tests
│  ├─ dashboard/page.tsx             # modify — add WpmProgressionChart
│  └─ history/page.tsx               # modify — add filters
├─ components/
│  ├─ leaderboard/
│  │  ├─ LeaderboardPage.tsx         # new — shared server component
│  │  ├─ LeaderboardTable.tsx        # new
│  │  ├─ ModeTabs.tsx                # new
│  │  ├─ WindowNav.tsx               # new
│  │  ├─ WindowCountdown.tsx         # new (client)
│  │  └─ ShowMoreLink.tsx            # new
│  ├─ charts/
│  │  └─ WpmProgressionChart.tsx     # new (client)
│  ├─ history/
│  │  └─ HistoryFilterTabs.tsx       # new
│  └─ chrome/
│     └─ AuthMenu.tsx                # modify — add Leaderboards link
└─ lib/
   ├─ db/
   │  ├─ time-windows.ts             # new — pure helpers
   │  ├─ leaderboards.ts             # new — getLeaderboard, getWpmProgression
   │  └─ results.ts                  # modify — accept mode/difficulty filters
   └─ params.ts                      # new — normalizeMode, normalizeDifficulty, normalizeModeFilter, parseOffset

tests/
├─ unit/
│  ├─ lib/
│  │  ├─ db/
│  │  │  └─ time-windows.test.ts     # new
│  │  └─ params.test.ts              # new
└─ integration/db/
   ├─ leaderboards.test.ts           # new (DATABASE_URL-gated)
   └─ history-filters.test.ts        # new (DATABASE_URL-gated)
```

---

## Prerequisites

- Phase 2a already shipped; auth + Prisma client + data layer in place.
- Signed commits (`git commit -s -S`) per the project's CLAUDE.md. No AI attribution in commit messages.
- Quality gates at the end: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Integration tests require `DATABASE_URL`; they're `describe.skipIf(!hasDatabase)`-gated and skip otherwise.

---

## Task 1: Install recharts

**Files:** `package.json`, `pnpm-lock.yaml`.

- [ ] **Step 1: Install**

```bash
pnpm add recharts
```

Expected: `recharts` added as a runtime dep. No peer-warning blockers.

- [ ] **Step 2: Verify typecheck still passes**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -s -S -m "chore: add recharts for WPM progression chart"
```

---

## Task 2: Time-window pure helpers (TDD)

**Files:**
- Create: `src/lib/db/time-windows.ts`
- Create: `tests/unit/lib/db/time-windows.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { windowDeadline, windowStart } from '@/lib/db/time-windows';

const iso = (d: Date | null) => (d ? d.toISOString() : null);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('windowStart', () => {
  it('returns null for all-time', () => {
    vi.setSystemTime(new Date('2026-04-19T15:32:00Z'));
    expect(windowStart('alltime')).toBeNull();
  });

  it('today = 00:00 UTC of the current UTC date', () => {
    vi.setSystemTime(new Date('2026-04-19T23:59:59Z'));
    expect(iso(windowStart('today'))).toBe('2026-04-19T00:00:00.000Z');
  });

  it('today rolls over on UTC midnight', () => {
    vi.setSystemTime(new Date('2026-04-20T00:00:01Z'));
    expect(iso(windowStart('today'))).toBe('2026-04-20T00:00:00.000Z');
  });

  it('weekly = previous Monday 00:00 UTC when it is Wednesday', () => {
    vi.setSystemTime(new Date('2026-04-22T10:00:00Z')); // Wed 2026-04-22
    expect(iso(windowStart('weekly'))).toBe('2026-04-20T00:00:00.000Z'); // Mon 2026-04-20
  });

  it('weekly = same day when it is Monday', () => {
    vi.setSystemTime(new Date('2026-04-20T10:00:00Z')); // Mon
    expect(iso(windowStart('weekly'))).toBe('2026-04-20T00:00:00.000Z');
  });

  it('weekly = previous Monday when it is Sunday 23:59 UTC', () => {
    vi.setSystemTime(new Date('2026-04-26T23:59:00Z')); // Sun
    expect(iso(windowStart('weekly'))).toBe('2026-04-20T00:00:00.000Z');
  });

  it('monthly = 1st of current month 00:00 UTC', () => {
    vi.setSystemTime(new Date('2026-04-19T15:32:00Z'));
    expect(iso(windowStart('monthly'))).toBe('2026-04-01T00:00:00.000Z');
  });
});

describe('windowDeadline', () => {
  it('returns null for all-time', () => {
    vi.setSystemTime(new Date('2026-04-19T15:32:00Z'));
    expect(windowDeadline('alltime')).toBeNull();
  });

  it('today deadline = start + 24h', () => {
    vi.setSystemTime(new Date('2026-04-19T15:32:00Z'));
    expect(iso(windowDeadline('today'))).toBe('2026-04-20T00:00:00.000Z');
  });

  it('weekly deadline = start + 7 days', () => {
    vi.setSystemTime(new Date('2026-04-22T10:00:00Z')); // Wed in wk starting Mon 04-20
    expect(iso(windowDeadline('weekly'))).toBe('2026-04-27T00:00:00.000Z'); // next Mon
  });

  it('monthly deadline = 1st of next month', () => {
    vi.setSystemTime(new Date('2026-04-19T15:32:00Z'));
    expect(iso(windowDeadline('monthly'))).toBe('2026-05-01T00:00:00.000Z');
  });

  it('monthly deadline handles December → January', () => {
    vi.setSystemTime(new Date('2026-12-15T00:00:00Z'));
    expect(iso(windowDeadline('monthly'))).toBe('2027-01-01T00:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
pnpm test tests/unit/lib/db/time-windows.test.ts
```

- [ ] **Step 3: Implement**

```ts
export type Window = 'alltime' | 'today' | 'weekly' | 'monthly';

export function windowStart(window: Window, now: Date = new Date()): Date | null {
  if (window === 'alltime') return null;

  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  if (window === 'today') return midnight;

  if (window === 'weekly') {
    const day = midnight.getUTCDay(); // 0 Sun .. 6 Sat
    const daysSinceMonday = (day + 6) % 7; // Mon=0, Tue=1, ... Sun=6
    const start = new Date(midnight);
    start.setUTCDate(midnight.getUTCDate() - daysSinceMonday);
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
  // monthly — 1st of next month
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm test tests/unit/lib/db/time-windows.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -s -S -m "feat(db): add UTC time-window helpers with tests"
```

---

## Task 3: Params normalization helpers (TDD)

**Files:**
- Create: `src/lib/params.ts`
- Create: `tests/unit/lib/params.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  normalizeDifficulty,
  normalizeMode,
  normalizeModeFilter,
  parseOffset,
} from '@/lib/params';

describe('normalizeMode', () => {
  it('accepts the three valid modes', () => {
    expect(normalizeMode('fixed')).toBe('fixed');
    expect(normalizeMode('time')).toBe('time');
    expect(normalizeMode('words')).toBe('words');
  });
  it('returns undefined for invalid/missing', () => {
    expect(normalizeMode(undefined)).toBeUndefined();
    expect(normalizeMode('all')).toBeUndefined();
    expect(normalizeMode('bogus')).toBeUndefined();
    expect(normalizeMode('')).toBeUndefined();
  });
});

describe('normalizeDifficulty', () => {
  it('accepts the three valid tiers', () => {
    expect(normalizeDifficulty('easy')).toBe('easy');
    expect(normalizeDifficulty('medium')).toBe('medium');
    expect(normalizeDifficulty('hard')).toBe('hard');
  });
  it('returns undefined for invalid/missing', () => {
    expect(normalizeDifficulty(undefined)).toBeUndefined();
    expect(normalizeDifficulty('all')).toBeUndefined();
    expect(normalizeDifficulty('extreme')).toBeUndefined();
  });
});

describe('normalizeModeFilter', () => {
  it('returns "all" for missing/invalid', () => {
    expect(normalizeModeFilter(undefined)).toBe('all');
    expect(normalizeModeFilter('')).toBe('all');
    expect(normalizeModeFilter('bogus')).toBe('all');
  });
  it('preserves explicit modes', () => {
    expect(normalizeModeFilter('fixed')).toBe('fixed');
    expect(normalizeModeFilter('time')).toBe('time');
    expect(normalizeModeFilter('words')).toBe('words');
  });
  it('accepts the literal "all"', () => {
    expect(normalizeModeFilter('all')).toBe('all');
  });
});

describe('parseOffset', () => {
  it('returns 0 for missing or negative', () => {
    expect(parseOffset(undefined)).toBe(0);
    expect(parseOffset('-5')).toBe(0);
    expect(parseOffset('abc')).toBe(0);
  });
  it('floors non-integer values', () => {
    expect(parseOffset('12.9')).toBe(12);
  });
  it('caps at the default max', () => {
    expect(parseOffset('99999999')).toBe(10_000);
  });
  it('respects an explicit max', () => {
    expect(parseOffset('500', 100)).toBe(100);
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
pnpm test tests/unit/lib/params.test.ts
```

- [ ] **Step 3: Implement**

```ts
export function normalizeMode(
  raw: string | undefined,
): 'fixed' | 'time' | 'words' | undefined {
  if (raw === 'fixed' || raw === 'time' || raw === 'words') return raw;
  return undefined;
}

export function normalizeDifficulty(
  raw: string | undefined,
): 'easy' | 'medium' | 'hard' | undefined {
  if (raw === 'easy' || raw === 'medium' || raw === 'hard') return raw;
  return undefined;
}

export function normalizeModeFilter(
  raw: string | undefined,
): 'all' | 'fixed' | 'time' | 'words' {
  if (raw === 'all') return 'all';
  const v = normalizeMode(raw);
  return v ?? 'all';
}

export function parseOffset(raw: string | undefined, max = 10_000): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), max);
}
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm test tests/unit/lib/params.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -s -S -m "feat(lib): add searchParam normalization helpers with tests"
```

---

## Task 4: Extend `listResultsForUser` with filters

**Files:**
- Modify: `src/lib/db/results.ts`
- Create: `tests/integration/db/history-filters.test.ts`

- [ ] **Step 1: Update `listResultsForUser` to accept optional filters**

Replace the existing function body in `src/lib/db/results.ts`:

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
    where: {
      userId,
      ...(mode ? { mode } : {}),
      ...(difficulty ? { difficulty } : {}),
    },
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

- [ ] **Step 2: Write `tests/integration/db/history-filters.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { listResultsForUser, saveResult } from '@/lib/db/results';
import { hasDatabase, withDatabase } from './helpers';

describe.skipIf(!hasDatabase)('listResultsForUser filters', () => {
  withDatabase();

  async function seedUser() {
    return prisma.user.create({
      data: { username: `u-${Math.random().toString(36).slice(2, 8)}` },
    });
  }

  async function seedMixedResults(userId: string) {
    await saveResult(userId, {
      wpm: 70,
      rawWpm: 72,
      accuracy: 0.95,
      mode: 'fixed',
      durationMs: 30_000,
      difficulty: 'medium',
      fixedLength: 'medium',
    });
    await saveResult(userId, {
      wpm: 80,
      rawWpm: 82,
      accuracy: 0.95,
      mode: 'time',
      durationMs: 30_000,
      difficulty: 'hard',
      timeDuration: 30,
    });
    await saveResult(userId, {
      wpm: 60,
      rawWpm: 62,
      accuracy: 0.95,
      mode: 'words',
      durationMs: 30_000,
      difficulty: 'easy',
      wordCount: 25,
    });
  }

  it('returns all results when no filter', async () => {
    const u = await seedUser();
    await seedMixedResults(u.id);
    const { items } = await listResultsForUser(u.id, { limit: 25 });
    expect(items.length).toBe(3);
  });

  it('filters by mode', async () => {
    const u = await seedUser();
    await seedMixedResults(u.id);
    const { items } = await listResultsForUser(u.id, { limit: 25, mode: 'time' });
    expect(items.length).toBe(1);
    expect(items[0]?.mode).toBe('time');
  });

  it('filters by difficulty', async () => {
    const u = await seedUser();
    await seedMixedResults(u.id);
    const { items } = await listResultsForUser(u.id, { limit: 25, difficulty: 'hard' });
    expect(items.length).toBe(1);
    expect(items[0]?.difficulty).toBe('hard');
  });

  it('applies mode AND difficulty together', async () => {
    const u = await seedUser();
    await seedMixedResults(u.id);
    const { items } = await listResultsForUser(u.id, {
      limit: 25,
      mode: 'fixed',
      difficulty: 'medium',
    });
    expect(items.length).toBe(1);
    expect(items[0]?.mode).toBe('fixed');
    expect(items[0]?.difficulty).toBe('medium');
  });

  it('returns empty when filter matches nothing', async () => {
    const u = await seedUser();
    await seedMixedResults(u.id);
    const { items } = await listResultsForUser(u.id, { limit: 25, mode: 'fixed', difficulty: 'easy' });
    expect(items.length).toBe(0);
  });
});
```

- [ ] **Step 3: Typecheck + run (skipped without DB)**

```bash
pnpm typecheck
pnpm test tests/integration/db/history-filters.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -S -m "feat(db): extend listResultsForUser with mode/difficulty filters"
```

---

## Task 5: `getLeaderboard` + `getWpmProgression` (+ integration tests)

**Files:**
- Create: `src/lib/db/leaderboards.ts`
- Create: `tests/integration/db/leaderboards.test.ts`

- [ ] **Step 1: Write `tests/integration/db/leaderboards.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { getLeaderboard, getWpmProgression } from '@/lib/db/leaderboards';
import { saveResult, type SaveResultInput } from '@/lib/db/results';
import { hasDatabase, withDatabase } from './helpers';

describe.skipIf(!hasDatabase)('leaderboards', () => {
  withDatabase();

  async function seedUser(username: string) {
    return prisma.user.create({ data: { username } });
  }

  const fixed = (wpm: number, accuracy = 0.95): SaveResultInput => ({
    wpm,
    rawWpm: wpm + 2,
    accuracy,
    mode: 'fixed',
    durationMs: 30_000,
    difficulty: 'medium',
    fixedLength: 'medium',
  });

  const time = (wpm: number, accuracy = 0.95): SaveResultInput => ({
    wpm,
    rawWpm: wpm + 2,
    accuracy,
    mode: 'time',
    durationMs: 30_000,
    difficulty: 'hard',
    timeDuration: 30,
  });

  describe('getLeaderboard — all-time', () => {
    it('returns one row per user (their best), sorted by WPM desc', async () => {
      const alice = await seedUser('alice');
      const bob = await seedUser('bob');
      await saveResult(alice.id, fixed(60));
      await saveResult(alice.id, fixed(90));
      await saveResult(bob.id, fixed(80));

      const rows = await getLeaderboard({ window: 'alltime', mode: 'all' });
      expect(rows.length).toBe(2);
      expect(rows[0]?.username).toBe('alice');
      expect(rows[0]?.wpm).toBe(90);
      expect(rows[0]?.rank).toBe(1);
      expect(rows[1]?.username).toBe('bob');
      expect(rows[1]?.rank).toBe(2);
    });

    it('tie-break: higher accuracy first', async () => {
      const alice = await seedUser('alice');
      const bob = await seedUser('bob');
      await saveResult(alice.id, fixed(80, 0.9));
      await saveResult(bob.id, fixed(80, 0.95));

      const rows = await getLeaderboard({ window: 'alltime', mode: 'all' });
      expect(rows[0]?.username).toBe('bob');
      expect(rows[1]?.username).toBe('alice');
    });

    it('respects limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        const u = await seedUser(`u-${i}`);
        await saveResult(u.id, fixed(50 + i));
      }

      const p1 = await getLeaderboard({ window: 'alltime', mode: 'all', limit: 2, offset: 0 });
      const p2 = await getLeaderboard({ window: 'alltime', mode: 'all', limit: 2, offset: 2 });
      expect(p1.map((r) => r.wpm)).toEqual([54, 53]);
      expect(p2.map((r) => r.wpm)).toEqual([52, 51]);
      expect(p1[0]?.rank).toBe(1);
      expect(p2[0]?.rank).toBe(3);
    });

    it('mode filter narrows to that mode', async () => {
      const alice = await seedUser('alice');
      await saveResult(alice.id, fixed(70)); // fixed best
      await saveResult(alice.id, time(95));  // time best (overall best)
      const fixedBoard = await getLeaderboard({ window: 'alltime', mode: 'fixed' });
      expect(fixedBoard[0]?.wpm).toBe(70);
      const timeBoard = await getLeaderboard({ window: 'alltime', mode: 'time' });
      expect(timeBoard[0]?.wpm).toBe(95);
    });
  });

  describe('getLeaderboard — windowed with threshold', () => {
    it('excludes users with < 3 tests in the window', async () => {
      const alice = await seedUser('alice');
      const bob = await seedUser('bob');
      // Alice has 3, Bob has 2 — only Alice should appear.
      await saveResult(alice.id, fixed(80));
      await saveResult(alice.id, fixed(82));
      await saveResult(alice.id, fixed(85));
      await saveResult(bob.id, fixed(90));
      await saveResult(bob.id, fixed(92));

      const rows = await getLeaderboard({ window: 'today', mode: 'all' });
      expect(rows.map((r) => r.username)).toEqual(['alice']);
    });

    it('no threshold on all-time', async () => {
      const alice = await seedUser('alice');
      await saveResult(alice.id, fixed(100));
      const rows = await getLeaderboard({ window: 'alltime', mode: 'all' });
      expect(rows.length).toBe(1);
    });
  });

  describe('getWpmProgression', () => {
    it('returns newest-first, limit honored', async () => {
      const alice = await seedUser('alice');
      for (let i = 0; i < 8; i++) await saveResult(alice.id, fixed(60 + i));
      const points = await getWpmProgression(alice.id, { limit: 5 });
      expect(points.length).toBe(5);
      expect(points[0]?.wpm).toBe(67);
      expect(points[4]?.wpm).toBe(63);
    });

    it('mode filter applies', async () => {
      const alice = await seedUser('alice');
      await saveResult(alice.id, fixed(70));
      await saveResult(alice.id, time(90));
      const only = await getWpmProgression(alice.id, { mode: 'fixed' });
      expect(only.length).toBe(1);
      expect(only[0]?.mode).toBe('fixed');
    });
  });
});
```

- [ ] **Step 2: Implement `src/lib/db/leaderboards.ts`**

```ts
import { prisma } from './client';
import { type Window, windowStart } from './time-windows';

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

interface RawRow {
  user_id: string;
  username: string;
  image: string | null;
  wpm: number;
  raw_wpm: number;
  accuracy: number;
  mode: 'fixed' | 'time' | 'words';
  created_at: Date;
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
  const modeFilter: 'fixed' | 'time' | 'words' | null =
    opts.mode === 'all' ? null : opts.mode;

  const rows = await prisma.$queryRaw<RawRow[]>`
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
        r."userId"    AS user_id,
        u.username    AS username,
        u.image       AS image,
        r.wpm         AS wpm,
        r."rawWpm"    AS raw_wpm,
        r.accuracy    AS accuracy,
        r.mode::text  AS mode,
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

- [ ] **Step 3: Typecheck + run (skipped without DB)**

```bash
pnpm typecheck
pnpm test tests/integration/db/leaderboards.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -S -m "feat(db): add getLeaderboard and getWpmProgression"
```

---

## Task 6: `WpmProgressionChart` component

**Files:**
- Create: `src/components/charts/WpmProgressionChart.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface WpmPoint {
  createdAt: string;
  wpm: number;
  mode: 'fixed' | 'time' | 'words';
}

interface Props {
  points: WpmPoint[];
  emptyMessage?: string;
}

interface ChartDatum {
  index: number;
  date: Date;
  wpm: number;
  mode: 'fixed' | 'time' | 'words';
}

export function WpmProgressionChart({ points, emptyMessage }: Props) {
  if (points.length < 5) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] text-sm text-[color:var(--muted)]">
        {emptyMessage ?? 'Take a few more tests to see your WPM progression.'}
      </div>
    );
  }

  const data: ChartDatum[] = points
    .slice()
    .reverse()
    .map((p, i) => ({ index: i + 1, date: new Date(p.createdAt), wpm: p.wpm, mode: p.mode }));

  return (
    <div className="h-48">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="wpmFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: Date) =>
              d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
            }
            stroke="var(--muted)"
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
          />
          <YAxis
            stroke="var(--muted)"
            tick={{ fill: 'var(--muted)', fontSize: 12 }}
            width={36}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="wpm"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#wpmFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDatum }>;
}

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs shadow-lg">
      <div className="font-mono text-[color:var(--fg)]">{Math.round(p.wpm)} wpm</div>
      <div className="text-[color:var(--muted)]">
        {p.mode} ·{' '}
        {p.date.toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -s -S -m "feat(charts): add WpmProgressionChart (Recharts area)"
```

---

## Task 7: Dashboard — add chart

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Insert chart between "Best by mode" and "Recent tests"**

Replace the existing `src/app/dashboard/page.tsx`:

```tsx
import Link from 'next/link';
import { WpmProgressionChart } from '@/components/charts/WpmProgressionChart';
import { LocalDate } from '@/components/chrome/LocalDate';
import { requireSession } from '@/lib/auth/guards';
import { getWpmProgression } from '@/lib/db/leaderboards';
import { getUserStats, listResultsForUser } from '@/lib/db/results';

function fmtWpm(n: number | null): string {
  return n === null ? '—' : Math.round(n).toString();
}
function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
function fmtConfig(r: {
  mode: string;
  fixedLength: string | null;
  timeDuration: number | null;
  wordCount: number | null;
}): string {
  if (r.mode === 'fixed') return `fixed · ${r.fixedLength ?? '?'}`;
  if (r.mode === 'time') return `time · ${r.timeDuration ?? '?'}s`;
  if (r.mode === 'words') return `words · ${r.wordCount ?? '?'}`;
  return r.mode;
}

export default async function DashboardPage() {
  const session = await requireSession('/dashboard');
  const [stats, recent, progression] = await Promise.all([
    getUserStats(session.user.id),
    listResultsForUser(session.user.id, { limit: 5 }),
    getWpmProgression(session.user.id, { limit: 50 }),
  ]);

  const chartPoints = progression.map((p) => ({
    createdAt: p.createdAt.toISOString(),
    wpm: p.wpm,
    mode: p.mode,
  }));

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Signed in as <span className="font-mono">{session.user.username}</span>
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Best WPM" value={fmtWpm(stats.bestWpm)} accent />
        <Stat label="Avg WPM" value={fmtWpm(stats.avgWpm)} />
        <Stat label="Tests" value={stats.totalTests.toString()} />
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-[color:var(--muted)]">
          Best by mode
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <ModeBest label="fixed" value={fmtWpm(stats.bestByMode.fixed)} />
          <ModeBest label="time" value={fmtWpm(stats.bestByMode.time)} />
          <ModeBest label="words" value={fmtWpm(stats.bestByMode.words)} />
        </div>
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-[color:var(--muted)]">
          WPM progression
        </h2>
        <WpmProgressionChart points={chartPoints} />
      </div>

      <div className="mt-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm uppercase tracking-widest text-[color:var(--muted)]">
            Recent tests
          </h2>
          <Link href="/history" className="text-xs text-[color:var(--accent)] hover:underline">
            View all →
          </Link>
        </div>
        {recent.items.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">
            No tests yet.{' '}
            <Link className="underline" href="/single-player">
              Take your first test
            </Link>
            .
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
              <tr>
                <th className="py-2 text-left font-normal">Date</th>
                <th className="py-2 text-left font-normal">Mode</th>
                <th className="py-2 text-right font-normal">WPM</th>
                <th className="py-2 text-right font-normal">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {recent.items.map((r) => (
                <tr key={r.id} className="border-t border-[color:var(--border)]">
                  <td className="py-2">
                    <LocalDate iso={r.createdAt.toISOString()} />
                  </td>
                  <td className="py-2 text-[color:var(--muted)]">{fmtConfig(r)}</td>
                  <td className="py-2 text-right font-mono">{Math.round(r.wpm)}</td>
                  <td className="py-2 text-right font-mono">{fmtPct(r.accuracy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div
        className={`text-4xl font-semibold ${accent ? 'text-[color:var(--accent)]' : 'text-[color:var(--fg)]'}`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-widest text-[color:var(--muted)]">
        {label}
      </div>
    </div>
  );
}

function ModeBest({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div className="text-2xl font-semibold text-[color:var(--fg)]">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-widest text-[color:var(--muted)]">
        {label}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

```bash
pnpm typecheck
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -s -S -m "feat(dashboard): add WPM progression chart"
```

---

## Task 8: Profile — public view + chart + recent tests

**Files:**
- Modify: `src/app/profile/[username]/page.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { renameUsernameFormAction } from '@/app/actions/username';
import { auth } from '@/auth';
import { WpmProgressionChart } from '@/components/charts/WpmProgressionChart';
import { LocalDate } from '@/components/chrome/LocalDate';
import { Button } from '@/components/ui/Button';
import { isAuthConfigured } from '@/env';
import { getWpmProgression } from '@/lib/db/leaderboards';
import { getUserStats, listResultsForUser } from '@/lib/db/results';
import { getUserByUsername } from '@/lib/db/users';

export const metadata = { robots: 'noindex, nofollow' };

function fmtWpm(n: number | null): string {
  return n === null ? '—' : Math.round(n).toString();
}
function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
function fmtConfig(r: {
  mode: string;
  fixedLength: string | null;
  timeDuration: number | null;
  wordCount: number | null;
}): string {
  if (r.mode === 'fixed') return `fixed · ${r.fixedLength ?? '?'}`;
  if (r.mode === 'time') return `time · ${r.timeDuration ?? '?'}s`;
  if (r.mode === 'words') return `words · ${r.wordCount ?? '?'}`;
  return r.mode;
}

interface Props {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ rename?: string }>;
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const { rename } = await searchParams;

  if (!isAuthConfigured()) {
    return (
      <section className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Profiles aren&apos;t configured yet</h1>
        <p className="mt-3 text-sm text-[color:var(--muted)]">See SETUP.md.</p>
      </section>
    );
  }

  const user = await getUserByUsername(username);
  if (!user) notFound();

  const session = await auth();
  const isOwner = session?.user?.id === user.id;

  const [stats, recent, progression] = await Promise.all([
    getUserStats(user.id),
    listResultsForUser(user.id, { limit: 10 }),
    getWpmProgression(user.id, { limit: 50 }),
  ]);

  const chartPoints = progression.map((p) => ({
    createdAt: p.createdAt.toISOString(),
    wpm: p.wpm,
    mode: p.mode,
  }));

  const renameMessage =
    rename === 'invalid'
      ? 'That username is invalid (use 3-24 lowercase letters, numbers, or hyphens; no reserved names).'
      : rename === 'taken'
        ? 'That username is taken.'
        : rename === 'unauthenticated'
          ? 'You must be signed in.'
          : null;

  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 flex items-center gap-4">
        {user.image ? (
          // biome-ignore lint/performance/noImgElement: profile avatar, server component.
          <img
            src={user.image}
            alt=""
            width={48}
            height={48}
            className="rounded-full"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--faint)] text-lg text-[color:var(--fg)]">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="font-mono">{user.username}</span>
          </h1>
          <p className="text-xs text-[color:var(--muted)]">
            Joined <LocalDate iso={user.createdAt.toISOString()} />
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Best WPM" value={fmtWpm(stats.bestWpm)} accent />
        <Stat label="Avg WPM" value={fmtWpm(stats.avgWpm)} />
        <Stat label="Tests" value={stats.totalTests.toString()} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-[color:var(--muted)]">
          Best by mode
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <ModeBest label="fixed" value={fmtWpm(stats.bestByMode.fixed)} />
          <ModeBest label="time" value={fmtWpm(stats.bestByMode.time)} />
          <ModeBest label="words" value={fmtWpm(stats.bestByMode.words)} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-[color:var(--muted)]">
          WPM progression
        </h2>
        <WpmProgressionChart points={chartPoints} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-[color:var(--muted)]">
          Recent tests
        </h2>
        {recent.items.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No tests yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
              <tr>
                <th className="py-2 text-left font-normal">Date</th>
                <th className="py-2 text-left font-normal">Mode</th>
                <th className="py-2 text-right font-normal">WPM</th>
                <th className="py-2 text-right font-normal">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {recent.items.map((r) => (
                <tr key={r.id} className="border-t border-[color:var(--border)]">
                  <td className="py-2">
                    <LocalDate iso={r.createdAt.toISOString()} />
                  </td>
                  <td className="py-2 text-[color:var(--muted)]">{fmtConfig(r)}</td>
                  <td className="py-2 text-right font-mono">{Math.round(r.wpm)}</td>
                  <td className="py-2 text-right font-mono">{fmtPct(r.accuracy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isOwner ? (
        <div className="mt-10 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <h2 className="text-sm uppercase tracking-widest text-[color:var(--muted)]">
            Rename username
          </h2>
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            Warning: renaming will break any shared links to your old profile.
          </p>
          <form action={renameUsernameFormAction} className="mt-3 flex items-center gap-2">
            <input
              name="username"
              defaultValue={user.username}
              className="flex-1 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-1.5 font-mono text-sm text-[color:var(--fg)]"
              pattern="[a-z0-9][a-z0-9-]{2,23}"
              minLength={3}
              maxLength={24}
              required
            />
            <Button type="submit" variant="primary">
              Save
            </Button>
          </form>
          {renameMessage ? (
            <p className="mt-2 text-xs text-[color:var(--danger)]">{renameMessage}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8">
        <Link href="/" className="text-xs text-[color:var(--accent)] hover:underline">
          ← Back to home
        </Link>
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div
        className={`text-4xl font-semibold ${accent ? 'text-[color:var(--accent)]' : 'text-[color:var(--fg)]'}`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-widest text-[color:var(--muted)]">
        {label}
      </div>
    </div>
  );
}

function ModeBest({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div className="text-2xl font-semibold text-[color:var(--fg)]">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-widest text-[color:var(--muted)]">
        {label}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

```bash
pnpm typecheck
pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -s -S -m "feat(profile): open /profile/[username] to non-owners; add chart and recent tests"
```

---

## Task 9: Leaderboard shared components

**Files:**
- Create: `src/components/leaderboard/LeaderboardTable.tsx`
- Create: `src/components/leaderboard/ModeTabs.tsx`
- Create: `src/components/leaderboard/WindowNav.tsx`
- Create: `src/components/leaderboard/WindowCountdown.tsx`
- Create: `src/components/leaderboard/ShowMoreLink.tsx`

- [ ] **Step 1: `LeaderboardTable.tsx`**

```tsx
import Link from 'next/link';
import { LocalDate } from '@/components/chrome/LocalDate';
import type { LeaderboardRow } from '@/lib/db/leaderboards';

interface Props {
  rows: LeaderboardRow[];
}

export function LeaderboardTable({ rows }: Props) {
  return (
    <table className="w-full text-sm">
      <thead className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
        <tr>
          <th className="py-2 text-right font-normal">#</th>
          <th className="py-2 text-left font-normal">User</th>
          <th className="py-2 text-left font-normal">Mode</th>
          <th className="py-2 text-right font-normal">WPM</th>
          <th className="py-2 text-right font-normal">Acc</th>
          <th className="py-2 text-right font-normal">Date</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.userId} className="border-t border-[color:var(--border)]">
            <td className="py-2 text-right font-mono text-[color:var(--muted)]">{r.rank}</td>
            <td className="py-2">
              <Link
                href={`/profile/${r.username}`}
                className="flex items-center gap-2 hover:text-[color:var(--accent)]"
              >
                {r.image ? (
                  // biome-ignore lint/performance/noImgElement: small avatar in table row.
                  <img
                    src={r.image}
                    alt=""
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                ) : (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--faint)] text-[10px] text-[color:var(--fg)]">
                    {r.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="font-mono">{r.username}</span>
              </Link>
            </td>
            <td className="py-2 text-[color:var(--muted)]">{r.mode}</td>
            <td className="py-2 text-right font-mono text-[color:var(--accent)]">
              {Math.round(r.wpm)}
            </td>
            <td className="py-2 text-right font-mono text-[color:var(--muted)]">
              {Math.round(r.accuracy * 100)}%
            </td>
            <td className="py-2 text-right text-[color:var(--muted)]">
              <LocalDate iso={r.createdAt.toISOString()} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 2: `ModeTabs.tsx`**

```tsx
import Link from 'next/link';
import type { ModeFilter } from '@/lib/db/leaderboards';

interface Props {
  pathname: string;
  active: ModeFilter;
}

const OPTIONS: Array<{ value: ModeFilter; label: string }> = [
  { value: 'all', label: 'all' },
  { value: 'fixed', label: 'fixed' },
  { value: 'time', label: 'time' },
  { value: 'words', label: 'words' },
];

export function ModeTabs({ pathname, active }: Props) {
  return (
    <div
      className="mt-4 inline-flex rounded-md border border-[color:var(--border)] bg-[color:var(--surface)]"
      role="radiogroup"
      aria-label="mode"
    >
      {OPTIONS.map((opt) => {
        const href = opt.value === 'all' ? pathname : `${pathname}?mode=${opt.value}`;
        const selected = opt.value === active;
        return (
          <Link
            key={opt.value}
            href={href}
            role="radio"
            aria-checked={selected}
            className={`px-3 py-1.5 text-sm transition-colors ${
              selected
                ? 'bg-[color:var(--accent)] text-[color:var(--bg)]'
                : 'text-[color:var(--fg)] hover:bg-[color:var(--faint)]'
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: `WindowNav.tsx`**

```tsx
import Link from 'next/link';
import type { Window } from '@/lib/db/time-windows';

const ROUTES: Array<{ window: Window; href: string; label: string }> = [
  { window: 'alltime', href: '/leaderboard', label: 'All-time' },
  { window: 'today', href: '/leaderboard/today', label: 'Today' },
  { window: 'weekly', href: '/leaderboard/weekly', label: 'Weekly' },
  { window: 'monthly', href: '/leaderboard/monthly', label: 'Monthly' },
];

export function WindowNav({ active }: { active: Window }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {ROUTES.map((r) => {
        const selected = r.window === active;
        return (
          <Link
            key={r.window}
            href={r.href}
            className={`rounded-md border border-[color:var(--border)] px-3 py-1.5 text-xs uppercase tracking-widest transition-colors ${
              selected
                ? 'border-[color:var(--accent)] text-[color:var(--accent)]'
                : 'text-[color:var(--muted)] hover:text-[color:var(--fg)]'
            }`}
          >
            {r.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: `WindowCountdown.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';

interface Props {
  deadline: string;
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
      Resets in {h > 0 ? `${h}h ` : ''}
      {m}m
    </p>
  );
}
```

- [ ] **Step 5: `ShowMoreLink.tsx`**

```tsx
import Link from 'next/link';
import type { ModeFilter } from '@/lib/db/leaderboards';

interface Props {
  pathname: string;
  mode: ModeFilter;
  nextOffset: number;
}

export function ShowMoreLink({ pathname, mode, nextOffset }: Props) {
  const params = new URLSearchParams();
  if (mode !== 'all') params.set('mode', mode);
  params.set('offset', String(nextOffset));
  const href = `${pathname}?${params.toString()}`;
  return (
    <div className="mt-6 text-center">
      <Link
        href={href}
        className="inline-flex rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm text-[color:var(--fg)] hover:bg-[color:var(--faint)]"
      >
        Show more
      </Link>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm typecheck
git add -A
git commit -s -S -m "feat(leaderboard): add shared UI components"
```

---

## Task 10: `LeaderboardPage` shared component

**Files:**
- Create: `src/components/leaderboard/LeaderboardPage.tsx`

- [ ] **Step 1: Implement**

```tsx
import { LeaderboardTable } from './LeaderboardTable';
import { ModeTabs } from './ModeTabs';
import { ShowMoreLink } from './ShowMoreLink';
import { WindowCountdown } from './WindowCountdown';
import { WindowNav } from './WindowNav';
import { isAuthConfigured } from '@/env';
import { getLeaderboard } from '@/lib/db/leaderboards';
import { type Window, windowDeadline } from '@/lib/db/time-windows';
import { normalizeModeFilter, parseOffset } from '@/lib/params';

const LIMIT = 100;

function pathnameFor(window: Window): string {
  if (window === 'alltime') return '/leaderboard';
  return `/leaderboard/${window}`;
}

function headingFor(window: Window): string {
  switch (window) {
    case 'alltime':
      return 'All-time leaderboard';
    case 'today':
      return 'Today';
    case 'weekly':
      return 'This week';
    case 'monthly':
      return 'This month';
  }
}

interface Props {
  window: Window;
  searchParams: Promise<{ mode?: string; offset?: string }>;
}

export async function LeaderboardPage({ window, searchParams }: Props) {
  if (!isAuthConfigured()) {
    return (
      <section className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Leaderboards aren&apos;t configured yet</h1>
        <p className="mt-3 text-sm text-[color:var(--muted)]">See SETUP.md.</p>
      </section>
    );
  }

  const sp = await searchParams;
  const mode = normalizeModeFilter(sp.mode);
  const offset = parseOffset(sp.offset);
  const pathname = pathnameFor(window);

  const raw = await getLeaderboard({ window, mode, limit: LIMIT + 1, offset });
  const hasMore = raw.length > LIMIT;
  const rows = hasMore ? raw.slice(0, LIMIT) : raw;
  const deadline = windowDeadline(window);

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{headingFor(window)}</h1>
          {deadline ? <WindowCountdown deadline={deadline.toISOString()} /> : null}
        </div>
        <WindowNav active={window} />
      </header>

      <ModeTabs pathname={pathname} active={mode} />

      <div className="mt-6">
        {rows.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">
            No qualifying results yet.{' '}
            {window !== 'alltime'
              ? 'Users need at least 3 tests in this window to appear.'
              : 'Be the first!'}
          </p>
        ) : (
          <LeaderboardTable rows={rows} />
        )}
      </div>

      {hasMore ? (
        <ShowMoreLink pathname={pathname} mode={mode} nextOffset={offset + LIMIT} />
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add -A
git commit -s -S -m "feat(leaderboard): add shared LeaderboardPage component"
```

---

## Task 11: Four leaderboard routes

**Files:**
- Create: `src/app/leaderboard/page.tsx`
- Create: `src/app/leaderboard/today/page.tsx`
- Create: `src/app/leaderboard/weekly/page.tsx`
- Create: `src/app/leaderboard/monthly/page.tsx`

- [ ] **Step 1: `src/app/leaderboard/page.tsx` (all-time)**

```tsx
import { LeaderboardPage } from '@/components/leaderboard/LeaderboardPage';

interface Props {
  searchParams: Promise<{ mode?: string; offset?: string }>;
}

export default function Page(props: Props) {
  return <LeaderboardPage window="alltime" searchParams={props.searchParams} />;
}
```

- [ ] **Step 2: `src/app/leaderboard/today/page.tsx`**

```tsx
import { LeaderboardPage } from '@/components/leaderboard/LeaderboardPage';

interface Props {
  searchParams: Promise<{ mode?: string; offset?: string }>;
}

export default function Page(props: Props) {
  return <LeaderboardPage window="today" searchParams={props.searchParams} />;
}
```

- [ ] **Step 3: `src/app/leaderboard/weekly/page.tsx`**

```tsx
import { LeaderboardPage } from '@/components/leaderboard/LeaderboardPage';

interface Props {
  searchParams: Promise<{ mode?: string; offset?: string }>;
}

export default function Page(props: Props) {
  return <LeaderboardPage window="weekly" searchParams={props.searchParams} />;
}
```

- [ ] **Step 4: `src/app/leaderboard/monthly/page.tsx`**

```tsx
import { LeaderboardPage } from '@/components/leaderboard/LeaderboardPage';

interface Props {
  searchParams: Promise<{ mode?: string; offset?: string }>;
}

export default function Page(props: Props) {
  return <LeaderboardPage window="monthly" searchParams={props.searchParams} />;
}
```

- [ ] **Step 5: Typecheck + build**

```bash
pnpm typecheck
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -s -S -m "feat(leaderboard): add four routes (alltime/today/weekly/monthly)"
```

---

## Task 12: History filters UI

**Files:**
- Create: `src/components/history/HistoryFilterTabs.tsx`
- Modify: `src/app/history/page.tsx`

- [ ] **Step 1: `HistoryFilterTabs.tsx`**

```tsx
import Link from 'next/link';

interface Option<T extends string> {
  value: T | undefined;
  label: string;
}

interface Props<T extends string> {
  label: string;
  options: Option<T>[];
  current: T | undefined;
  buildHref: (value: T | undefined) => string;
}

export function HistoryFilterTabs<T extends string>({
  label,
  options,
  current,
  buildHref,
}: Props<T>) {
  return (
    <div className="inline-flex items-center gap-2" role="radiogroup" aria-label={label}>
      <span className="text-xs uppercase tracking-widest text-[color:var(--muted)]">{label}</span>
      <div className="inline-flex rounded-md border border-[color:var(--border)] bg-[color:var(--surface)]">
        {options.map((opt) => {
          const selected = opt.value === current;
          return (
            <Link
              key={opt.label}
              href={buildHref(opt.value)}
              role="radio"
              aria-checked={selected}
              className={`px-3 py-1.5 text-sm transition-colors ${
                selected
                  ? 'bg-[color:var(--accent)] text-[color:var(--bg)]'
                  : 'text-[color:var(--fg)] hover:bg-[color:var(--faint)]'
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/history/page.tsx`**

```tsx
import Link from 'next/link';
import { HistoryFilterTabs } from '@/components/history/HistoryFilterTabs';
import { LocalDate } from '@/components/chrome/LocalDate';
import { requireSession } from '@/lib/auth/guards';
import { listResultsForUser } from '@/lib/db/results';
import { normalizeDifficulty, normalizeMode } from '@/lib/params';

const MODE_OPTIONS = [
  { value: undefined, label: 'all' },
  { value: 'fixed' as const, label: 'fixed' },
  { value: 'time' as const, label: 'time' },
  { value: 'words' as const, label: 'words' },
];

const DIFFICULTY_OPTIONS = [
  { value: undefined, label: 'all' },
  { value: 'easy' as const, label: 'easy' },
  { value: 'medium' as const, label: 'medium' },
  { value: 'hard' as const, label: 'hard' },
];

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
function fmtConfig(r: {
  mode: string;
  fixedLength: string | null;
  timeDuration: number | null;
  wordCount: number | null;
}): string {
  if (r.mode === 'fixed') return `fixed · ${r.fixedLength ?? '?'}`;
  if (r.mode === 'time') return `time · ${r.timeDuration ?? '?'}s`;
  if (r.mode === 'words') return `words · ${r.wordCount ?? '?'}`;
  return r.mode;
}

function buildHref(mode: 'fixed' | 'time' | 'words' | undefined, difficulty: 'easy' | 'medium' | 'hard' | undefined): string {
  const params = new URLSearchParams();
  if (mode) params.set('mode', mode);
  if (difficulty) params.set('difficulty', difficulty);
  const qs = params.toString();
  return qs ? `/history?${qs}` : '/history';
}

interface Props {
  searchParams: Promise<{ cursor?: string; mode?: string; difficulty?: string }>;
}

export default async function HistoryPage({ searchParams }: Props) {
  const session = await requireSession('/history');
  const { cursor, mode: modeRaw, difficulty: diffRaw } = await searchParams;
  const mode = normalizeMode(modeRaw);
  const difficulty = normalizeDifficulty(diffRaw);

  const { items, nextCursor } = await listResultsForUser(session.user.id, {
    cursor,
    limit: 25,
    mode,
    difficulty,
  });

  const hasFilter = !!mode || !!difficulty;

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <Link href="/dashboard" className="text-xs text-[color:var(--accent)] hover:underline">
          ← Dashboard
        </Link>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <HistoryFilterTabs
          label="mode"
          options={MODE_OPTIONS}
          current={mode}
          buildHref={(v) => buildHref(v, difficulty)}
        />
        <HistoryFilterTabs
          label="difficulty"
          options={DIFFICULTY_OPTIONS}
          current={difficulty}
          buildHref={(v) => buildHref(mode, v)}
        />
      </div>

      {items.length === 0 ? (
        hasFilter ? (
          <p className="text-sm text-[color:var(--muted)]">No results match these filters.</p>
        ) : (
          <p className="text-sm text-[color:var(--muted)]">
            No tests yet.{' '}
            <Link className="underline" href="/single-player">
              Take your first test
            </Link>
            .
          </p>
        )
      ) : (
        <>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
              <tr>
                <th className="py-2 text-left font-normal">Date</th>
                <th className="py-2 text-left font-normal">Mode</th>
                <th className="py-2 text-right font-normal">WPM</th>
                <th className="py-2 text-right font-normal">Raw</th>
                <th className="py-2 text-right font-normal">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-[color:var(--border)]">
                  <td className="py-2">
                    <LocalDate iso={r.createdAt.toISOString()} />
                  </td>
                  <td className="py-2 text-[color:var(--muted)]">{fmtConfig(r)}</td>
                  <td className="py-2 text-right font-mono">{Math.round(r.wpm)}</td>
                  <td className="py-2 text-right font-mono text-[color:var(--muted)]">
                    {Math.round(r.rawWpm)}
                  </td>
                  <td className="py-2 text-right font-mono">{fmtPct(r.accuracy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {nextCursor ? (
            <div className="mt-6 text-center">
              <Link
                href={`${buildHref(mode, difficulty)}${buildHref(mode, difficulty).includes('?') ? '&' : '?'}cursor=${nextCursor}`}
                className="inline-flex rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm text-[color:var(--fg)] hover:bg-[color:var(--faint)]"
              >
                Load more
              </Link>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Typecheck + build**

```bash
pnpm typecheck
pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -S -m "feat(history): add mode and difficulty filters via URL searchParams"
```

---

## Task 13: Add "Leaderboards" link to AuthMenu

**Files:**
- Modify: `src/components/chrome/AuthMenu.tsx`

- [ ] **Step 1: Insert the link between Dashboard and Profile**

Open `src/components/chrome/AuthMenu.tsx` and replace the dropdown section with:

```tsx
      <div className="absolute right-0 z-10 mt-2 w-40 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] py-1 shadow-lg">
        <MenuLink href="/dashboard" label="Dashboard" />
        <MenuLink href="/leaderboard" label="Leaderboards" />
        <MenuLink href="/profile/me" label="Profile" />
        <MenuLink href="/history" label="History" />
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/' });
          }}
        >
          <button
            type="submit"
            className="block w-full px-3 py-1.5 text-left text-sm text-[color:var(--fg)] hover:bg-[color:var(--faint)]"
          >
            Sign out
          </button>
        </form>
      </div>
```

Only the added `<MenuLink href="/leaderboard" label="Leaderboards" />` is new; everything else is unchanged.

- [ ] **Step 2: Typecheck + commit**

```bash
pnpm typecheck
git add -A
git commit -s -S -m "feat(chrome): add Leaderboards link to AuthMenu"
```

---

## Task 14: Final gates + README update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run all gates**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all pass. Build should report 14 routes (existing + `/leaderboard`, `/leaderboard/today|weekly|monthly`).

Fix any Biome complaints with `pnpm lint:fix`; re-run.

- [ ] **Step 2: Update README**

Replace the "Current Phase" block in `README.md`:

```markdown
## Current Phase

**Phase 2b — Social/Competitive** (shipped): Leaderboards (all-time / today / weekly / monthly with mode filters), public profiles at `/profile/[username]`, WPM progression chart on dashboard + profiles, mode/difficulty filters on history.

- Design: `docs/superpowers/specs/2026-04-19-phase-2b-social-design.md`

**Phase 2a — Foundation** (shipped): Google sign-in + Prisma/Postgres persistence + `/dashboard` + `/profile/[username]` + `/history`.

- Design: `docs/superpowers/specs/2026-04-19-phase-2a-foundation-design.md`
- Setup (required to enable auth locally): `docs/SETUP.md`

**Phase 1** — single-player typing test (shipped).

- Design: `docs/superpowers/specs/2026-04-19-phase-1-single-player-design.md`
```

Also add "Phase 2b" mentions in the "Stack" and "Out of scope" sections as appropriate.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -s -S -m "docs: update README with Phase 2b status"
```

---

## Self-Review

- **Spec coverage:**
  - § 2 feature decisions:
    - Row semantics (1/user): Task 5 (DISTINCT ON query).
    - Four routes with mode filter: Tasks 10, 11.
    - Calendar + UTC windows: Task 2.
    - Window countdown: Task 9 (`WindowCountdown`).
    - Top 100 + Show more: Task 10 (`LIMIT + 1` pattern), Task 9 (`ShowMoreLink`).
    - Accuracy tie-break: Task 5 (SQL ORDER BY).
    - ≥ 3 tests threshold: Task 5 (CTE with `HAVING COUNT(*) >= minTests`).
    - Public profile mirror + noindex: Task 8.
    - WPM chart last 50, combined line, ≥ 5 empty state: Tasks 5, 6, 7, 8.
    - History filters mode + difficulty via URL: Tasks 3, 4, 12.
    - No caching: enforced by absence of cache code.
  - § 4 data layer: Tasks 2, 4, 5.
  - § 5 routes: Tasks 7, 8, 11, 12.
  - § 6 components: Tasks 6, 9, 10, 12, 13.
  - § 7 params: Task 3.
  - § 8 tests: Tasks 2, 3, 4, 5 (unit + integration).
  - § 9 deploy: no schema change; `pnpm build` in Task 14.

- **Placeholder scan:** None.

- **Type consistency:**
  - `Window` type exported from `src/lib/db/time-windows.ts`, consumed by `leaderboards.ts` and by leaderboard components.
  - `ModeFilter` exported from `leaderboards.ts`, used by `ModeTabs` and `ShowMoreLink`.
  - `LeaderboardRow` exported from `leaderboards.ts`, consumed by `LeaderboardTable`.
  - `WpmPoint` exported from `WpmProgressionChart.tsx` (inline `Point` interface is local; chart consumers pass serialized points).
  - `getUserStats`, `listResultsForUser`, `getUserByUsername` unchanged signatures (filters added are additive; existing callers unaffected).

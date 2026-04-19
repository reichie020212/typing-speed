# Phase 2a — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Google sign-in + Prisma/Postgres persistence + minimal `/dashboard`, `/profile/me`, `/profile/[username]`, and `/history` pages. Anonymous single-player continues to work unchanged. Logged-in single-player auto-saves results.

**Architecture:** NextAuth v5 (Auth.js) with Prisma adapter + Neon Postgres. JWT session strategy. Data mutations via Server Actions. Route protection via per-page `requireSession()` calls. Thin service layer in `src/lib/db/` so pages never touch Prisma directly. Env-var-less operation supported (protected routes render a "not configured" notice when secrets are absent) so the app still builds and Phase 1 anonymous flow still works.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4, Prisma ORM + `@prisma/client`, NextAuth v5 (`next-auth@5`) + `@auth/prisma-adapter`, Zod, Neon Postgres (provider), Biome, Vitest, pnpm. Inherits all Phase 1 tooling.

**Spec:** `docs/superpowers/specs/2026-04-19-phase-2a-foundation-design.md`.

---

## File Structure (new/modified)

```
prisma/
├─ schema.prisma               # new
└─ migrations/                 # generated; first migration committed

src/
├─ app/
│  ├─ api/auth/[...nextauth]/
│  │  └─ route.ts              # new — re-exports NextAuth handlers
│  ├─ auth/
│  │  ├─ signin/page.tsx       # new
│  │  └─ error/page.tsx        # new
│  ├─ dashboard/page.tsx       # new
│  ├─ history/page.tsx         # new
│  ├─ profile/
│  │  ├─ me/page.tsx           # new — redirects to /profile/<username>
│  │  └─ [username]/page.tsx   # new
│  ├─ actions/
│  │  ├─ results.ts            # new — saveResultAction
│  │  └─ username.ts           # new — renameUsernameAction
│  └─ single-player/page.tsx   # modify — call saveResultAction + anon nudge
├─ auth.config.ts              # new — edge-compatible base config
├─ auth.ts                     # new — NextAuth instance + wrapped adapter
├─ env.ts                      # new — Zod-validated process.env
├─ types/
│  └─ next-auth.d.ts           # new — Session + JWT augmentation
├─ components/
│  ├─ chrome/
│  │  ├─ Header.tsx            # modify — auth UI
│  │  ├─ AuthMenu.tsx          # new — client component for user dropdown + sign-in link
│  │  └─ LocalDate.tsx         # new — client component hydrating ISO dates to local tz
│  └─ ui/
│     └─ (no changes)
└─ lib/
   ├─ auth/
   │  ├─ guards.ts             # new — requireSession
   │  └─ username.ts           # new — pure: deriveBase, isValidUsername, randomSuffix
   └─ db/
      ├─ client.ts             # new — Prisma singleton
      ├─ results.ts            # new — saveResult, listResultsForUser, getUserStats
      └─ users.ts              # new — generateUsername, getUserByUsername, renameUsername

tests/
├─ unit/
│  ├─ auth/
│  │  └─ username.test.ts      # new
│  └─ actions/
│     └─ results-schema.test.ts  # new — SaveResultSchema validation tests
└─ integration/                # new — conditional on DATABASE_URL
   └─ db/
      ├─ helpers.ts            # fixture helpers + skip-if-no-db guard
      ├─ users.test.ts
      └─ results.test.ts

docs/
└─ SETUP.md                    # new — Neon + Google Cloud setup

Root:
- .env.example                 # modify — real placeholders
- package.json                 # modify — deps + scripts
- biome.json                   # modify — allow generated prisma client dir
```

---

## Prerequisites

- All tasks run from `/Users/red/typing-speed`.
- Node 20+ (already verified in Phase 1).
- `pnpm` available (already installed).
- All commits use `git commit -s -S -m "..."` (signed). No AI attribution.
- Quality gates at the end: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- **No actual database is required** to complete the plan. Schema is validated via `prisma validate`. Integration tests that touch a real DB are gated on `DATABASE_URL` being set in the env; they're expected to be skipped during autonomous execution and run by the user after Neon is configured.
- **No actual Google OAuth credentials are required** to complete the plan. The app must build cleanly and pages must render with "not configured yet — see SETUP.md" notices on protected routes.

---

## Task 1: Install dependencies

**Files:** `package.json`, `pnpm-lock.yaml`.

- [ ] **Step 1: Install runtime + dev deps**

```bash
pnpm add next-auth@beta @auth/prisma-adapter @prisma/client zod
pnpm add -D prisma
```

(NextAuth v5 is currently published as `next-auth@beta`. The beta is stable and is what Auth.js v5 ships as of 2026-04.)

Expected: all four runtime deps + prisma CLI installed. No peer warnings that block.

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -s -S -m "chore: add prisma, next-auth v5, and zod dependencies"
```

---

## Task 2: Env validation (`src/env.ts`)

**Files:**
- Create: `src/env.ts`

- [ ] **Step 1: Write `src/env.ts`**

```ts
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  AUTH_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = EnvSchema.parse(process.env);

export function isAuthConfigured(): boolean {
  return !!(env.DATABASE_URL && env.AUTH_SECRET && env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -s -S -m "feat(env): add Zod-validated env module with isAuthConfigured helper"
```

---

## Task 3: Prisma schema + generate

**Files:**
- Create: `prisma/schema.prisma`
- Modify: `package.json` (scripts + postinstall)
- Modify: `.gitignore` (confirm `.env*` already covers secrets; nothing new needed)
- Modify: `biome.json` (exclude `src/generated`)

- [ ] **Step 1: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Mode {
  fixed
  time
  words
}

enum Difficulty {
  easy
  medium
  hard
}

enum Length {
  short
  medium
  long
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  username      String    @unique
  createdAt     DateTime  @default(now())
  accounts      Account[]
  sessions      Session[]
  results       Result[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model Result {
  id           String     @id @default(cuid())
  userId       String
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  wpm          Float
  rawWpm       Float
  accuracy     Float
  mode         Mode
  durationMs   Int
  difficulty   Difficulty
  fixedLength  Length?
  timeDuration Int?
  wordCount    Int?
  createdAt    DateTime   @default(now())

  @@index([userId, createdAt(sort: Desc)])
  @@index([createdAt(sort: Desc), wpm(sort: Desc)])
  @@index([wpm(sort: Desc)])
}
```

- [ ] **Step 2: Add scripts to `package.json`**

Under `"scripts"`:
```json
"postinstall": "prisma generate",
"db:generate": "prisma generate",
"db:migrate:dev": "prisma migrate dev",
"db:migrate:deploy": "prisma migrate deploy",
"db:validate": "prisma validate",
"db:studio": "prisma studio"
```

Leave `"vercel-build": "prisma migrate deploy && next build"` for user to add when deploying (documented in SETUP.md) — we don't want `next build` to try to run migrations during autonomous execution.

- [ ] **Step 3: Generate Prisma client**

```bash
pnpm prisma generate
```

Expected: `✔ Generated Prisma Client` and `node_modules/.prisma/client` populated. No DB connection needed.

- [ ] **Step 4: Validate schema**

```bash
pnpm prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid 🚀`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma package.json pnpm-lock.yaml
git commit -s -S -m "feat(db): add Prisma schema with User/Account/Session/Result models and indexes"
```

---

## Task 4: Prisma client singleton

**Files:**
- Create: `src/lib/db/client.ts`

- [ ] **Step 1: Write `src/lib/db/client.ts`**

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/db/client.ts
git commit -s -S -m "feat(db): add Prisma client singleton"
```

---

## Task 5: Username pure helpers (TDD)

**Files:**
- Create: `src/lib/auth/username.ts`
- Create: `tests/unit/auth/username.test.ts`

- [ ] **Step 1: Write failing tests — `tests/unit/auth/username.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import {
  RESERVED_USERNAMES,
  deriveBase,
  isValidUsername,
  randomSuffix,
} from '@/lib/auth/username';

describe('deriveBase', () => {
  it('strips the email domain', () => {
    expect(deriveBase('jane.doe@gmail.com')).toBe('jane-doe');
  });

  it('lowercases everything', () => {
    expect(deriveBase('Jane.Doe@Example.com')).toBe('jane-doe');
  });

  it('replaces non-alphanumeric with single hyphen', () => {
    expect(deriveBase('a_b+c.d@x')).toBe('a-b-c-d');
  });

  it('trims leading/trailing hyphens', () => {
    expect(deriveBase('---jane---@x')).toBe('jane');
  });

  it('caps length at 20 chars', () => {
    expect(deriveBase('a'.repeat(100) + '@x').length).toBeLessThanOrEqual(20);
  });

  it('falls back to a user-<x> shape when result is too short', () => {
    expect(deriveBase('ab@x')).toMatch(/^user-/);
    expect(deriveBase('@x')).toBe('user');
  });

  it('handles null seed', () => {
    expect(deriveBase(null)).toBe('user');
  });
});

describe('isValidUsername', () => {
  it('accepts typical usernames', () => {
    expect(isValidUsername('jane-doe')).toBe(true);
    expect(isValidUsername('jane')).toBe(true);
    expect(isValidUsername('user123')).toBe(true);
  });

  it('rejects usernames that are too short', () => {
    expect(isValidUsername('ab')).toBe(false);
  });

  it('rejects usernames that are too long', () => {
    expect(isValidUsername('a'.repeat(25))).toBe(false);
  });

  it('rejects usernames starting with a hyphen', () => {
    expect(isValidUsername('-jane')).toBe(false);
  });

  it('rejects usernames with uppercase or punctuation other than hyphen', () => {
    expect(isValidUsername('Jane')).toBe(false);
    expect(isValidUsername('jane_doe')).toBe(false);
    expect(isValidUsername('jane.doe')).toBe(false);
  });

  it('rejects reserved names', () => {
    for (const r of RESERVED_USERNAMES) {
      expect(isValidUsername(r)).toBe(false);
    }
  });
});

describe('randomSuffix', () => {
  it('returns a 3-char lowercase base-36 string', () => {
    const s = randomSuffix();
    expect(s).toMatch(/^[a-z0-9]{3}$/);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
pnpm test tests/unit/auth/username.test.ts
```

Expected: all fail (module not found).

- [ ] **Step 3: Implement `src/lib/auth/username.ts`**

```ts
export const RESERVED_USERNAMES = new Set([
  'me',
  'admin',
  'api',
  'auth',
  'signin',
  'signout',
  'signup',
  'settings',
  'new',
  'edit',
  'null',
  'undefined',
  'profile',
  'dashboard',
  'history',
  'leaderboard',
  'single-player',
  'race',
]);

const USERNAME_RE = /^[a-z0-9][a-z0-9-]{2,23}$/;

export function deriveBase(seed: string | null | undefined): string {
  if (!seed) return 'user';
  const cleaned = seed
    .toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
  if (cleaned.length >= 3) return cleaned;
  return `user-${cleaned}`.slice(0, 20).replace(/-$/, '');
}

export function isValidUsername(u: string): boolean {
  if (!USERNAME_RE.test(u)) return false;
  if (RESERVED_USERNAMES.has(u)) return false;
  return true;
}

export function randomSuffix(): string {
  // 3 base-36 chars = ~15 bits of entropy; collision resistant for the small
  // retry loop we run during username generation.
  return Math.random().toString(36).slice(2, 5).padEnd(3, '0');
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm test tests/unit/auth/username.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -s -S -m "feat(auth): add username pure helpers with reserved list"
```

---

## Task 6: Users DB layer

**Files:**
- Create: `src/lib/db/users.ts`
- Create: `tests/integration/db/helpers.ts`
- Create: `tests/integration/db/users.test.ts`
- Modify: `vitest.config.ts` — add `integration` include

> **Note on integration tests:** these tests hit a real Postgres. They're guarded — if `DATABASE_URL` is not set, the whole suite is skipped with a clear message. During autonomous execution `DATABASE_URL` is not set, so these files compile and typecheck but don't run tests; once the user provisions Neon and runs `pnpm db:migrate:dev`, they run.

- [ ] **Step 1: Modify `vitest.config.ts` — include both unit and integration paths**

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/hooks/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

(already includes everything under `tests/**`; integration tests will be picked up automatically.)

- [ ] **Step 2: Create `tests/integration/db/helpers.ts`**

```ts
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/client';

export const hasDatabase = !!process.env.DATABASE_URL;

export function withDatabase(): void {
  beforeAll(() => {
    if (!hasDatabase) {
      console.warn('[integration] DATABASE_URL not set — skipping integration suite');
    }
  });
  beforeEach(async () => {
    if (!hasDatabase) return;
    // Clean slate in dependency order
    await prisma.result.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.account.deleteMany({});
    await prisma.user.deleteMany({});
  });
  afterAll(async () => {
    if (!hasDatabase) return;
    await prisma.$disconnect();
  });
}
```

- [ ] **Step 3: Write `tests/integration/db/users.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import {
  generateUsername,
  getUserByUsername,
  renameUsername,
} from '@/lib/db/users';
import { hasDatabase, withDatabase } from './helpers';

describe.skipIf(!hasDatabase)('users db', () => {
  withDatabase();

  async function makeUser(username: string, email = `${username}@example.com`) {
    return prisma.user.create({ data: { username, email } });
  }

  describe('generateUsername', () => {
    it('derives base from an email on first attempt', async () => {
      const u = await generateUsername('jane.doe@example.com');
      expect(u).toBe('jane-doe');
    });

    it('appends a suffix when the base is taken', async () => {
      await makeUser('jane-doe');
      const u = await generateUsername('jane.doe@other.com');
      expect(u).not.toBe('jane-doe');
      expect(u.startsWith('jane-doe-')).toBe(true);
    });

    it('handles null seed', async () => {
      const u = await generateUsername(null);
      expect(u).toMatch(/^user/);
    });
  });

  describe('getUserByUsername', () => {
    it('returns the user when present', async () => {
      await makeUser('alice');
      const u = await getUserByUsername('alice');
      expect(u?.username).toBe('alice');
    });
    it('returns null when absent', async () => {
      expect(await getUserByUsername('nobody')).toBeNull();
    });
  });

  describe('renameUsername', () => {
    it('renames when valid and not taken', async () => {
      const u = await makeUser('alice');
      const result = await renameUsername(u.id, 'alice-new');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.username).toBe('alice-new');
    });

    it('rejects reserved names', async () => {
      const u = await makeUser('alice');
      const r = await renameUsername(u.id, 'admin');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('invalid');
    });

    it('rejects names that are already taken', async () => {
      await makeUser('bob');
      const u = await makeUser('alice');
      const r = await renameUsername(u.id, 'bob');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('taken');
    });
  });
});
```

- [ ] **Step 4: Implement `src/lib/db/users.ts`**

```ts
import type { User } from '@prisma/client';
import { isValidUsername, deriveBase, randomSuffix } from '@/lib/auth/username';
import { prisma } from './client';

export async function generateUsername(seed: string | null): Promise<string> {
  const base = deriveBase(seed);
  const candidates: string[] = [base];
  for (let i = 0; i < 12; i++) candidates.push(`${base}-${randomSuffix()}`);

  for (const c of candidates) {
    if (!isValidUsername(c)) continue;
    const taken = await prisma.user.findUnique({ where: { username: c } });
    if (!taken) return c;
  }

  // Near-impossible fallback: two fresh suffixes.
  return `user-${randomSuffix()}${randomSuffix()}`.slice(0, 20);
}

export async function getUserByUsername(username: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { username } });
}

export type RenameOutcome =
  | { ok: true; username: string }
  | { ok: false; reason: 'invalid' | 'taken' };

export async function renameUsername(
  userId: string,
  newUsername: string,
): Promise<RenameOutcome> {
  if (!isValidUsername(newUsername)) return { ok: false, reason: 'invalid' };
  const existing = await prisma.user.findUnique({ where: { username: newUsername } });
  if (existing && existing.id !== userId) return { ok: false, reason: 'taken' };
  await prisma.user.update({ where: { id: userId }, data: { username: newUsername } });
  return { ok: true, username: newUsername };
}
```

- [ ] **Step 5: Typecheck + test (integration will skip when DB absent)**

```bash
pnpm typecheck
pnpm test tests/integration/db/users.test.ts
```

Expected: typecheck passes. Test output: either `skipped` notice (no DB) or full pass (DB present).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -s -S -m "feat(db): add users service with generate/get/rename"
```

---

## Task 7: Results DB layer

**Files:**
- Create: `src/lib/db/results.ts`
- Create: `tests/integration/db/results.test.ts`

- [ ] **Step 1: Write `tests/integration/db/results.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import {
  getUserStats,
  listResultsForUser,
  saveResult,
  type SaveResultInput,
} from '@/lib/db/results';
import { hasDatabase, withDatabase } from './helpers';

describe.skipIf(!hasDatabase)('results db', () => {
  withDatabase();

  async function seedUser() {
    return prisma.user.create({
      data: { username: `u-${Math.random().toString(36).slice(2, 8)}` },
    });
  }

  const fixedInput = (wpm: number): SaveResultInput => ({
    wpm,
    rawWpm: wpm + 2,
    accuracy: 0.95,
    mode: 'fixed',
    durationMs: 30_000,
    difficulty: 'medium',
    fixedLength: 'medium',
  });

  it('round-trips a fixed-mode result', async () => {
    const u = await seedUser();
    await saveResult(u.id, fixedInput(70));
    const r = await prisma.result.findFirst({ where: { userId: u.id } });
    expect(r?.wpm).toBe(70);
    expect(r?.mode).toBe('fixed');
    expect(r?.fixedLength).toBe('medium');
  });

  it('listResultsForUser returns newest first with cursor pagination', async () => {
    const u = await seedUser();
    for (let i = 0; i < 30; i++) await saveResult(u.id, fixedInput(50 + i));
    const page1 = await listResultsForUser(u.id, { limit: 10 });
    expect(page1.items.length).toBe(10);
    expect(page1.items[0]?.wpm).toBe(79); // last inserted
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await listResultsForUser(u.id, { limit: 10, cursor: page1.nextCursor! });
    expect(page2.items.length).toBe(10);
    expect(page2.items[0]?.wpm).toBe(69);
  });

  it('getUserStats computes best, avg, total, and per-mode best', async () => {
    const u = await seedUser();
    await saveResult(u.id, fixedInput(60));
    await saveResult(u.id, fixedInput(80));
    await saveResult(u.id, { ...fixedInput(70), mode: 'time', fixedLength: undefined, timeDuration: 30 });
    const s = await getUserStats(u.id);
    expect(s.totalTests).toBe(3);
    expect(s.bestWpm).toBe(80);
    expect(s.avgWpm).toBeCloseTo(70, 1);
    expect(s.bestByMode.fixed).toBe(80);
    expect(s.bestByMode.time).toBe(70);
    expect(s.bestByMode.words).toBeNull();
  });

  it('getUserStats returns zero state for a user with no results', async () => {
    const u = await seedUser();
    const s = await getUserStats(u.id);
    expect(s.totalTests).toBe(0);
    expect(s.bestWpm).toBeNull();
    expect(s.avgWpm).toBeNull();
    expect(s.bestByMode.fixed).toBeNull();
  });
});
```

- [ ] **Step 2: Implement `src/lib/db/results.ts`**

```ts
import type { Result } from '@prisma/client';
import { prisma } from './client';

export interface SaveResultInput {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  mode: 'fixed' | 'time' | 'words';
  durationMs: number;
  difficulty: 'easy' | 'medium' | 'hard';
  fixedLength?: 'short' | 'medium' | 'long';
  timeDuration?: number;
  wordCount?: number;
}

export interface UserStats {
  bestWpm: number | null;
  avgWpm: number | null;
  totalTests: number;
  bestByMode: Record<'fixed' | 'time' | 'words', number | null>;
}

export async function saveResult(userId: string, input: SaveResultInput): Promise<void> {
  await prisma.result.create({
    data: {
      userId,
      wpm: input.wpm,
      rawWpm: input.rawWpm,
      accuracy: input.accuracy,
      mode: input.mode,
      durationMs: input.durationMs,
      difficulty: input.difficulty,
      fixedLength: input.fixedLength,
      timeDuration: input.timeDuration,
      wordCount: input.wordCount,
    },
  });
}

export interface ListResultsOpts {
  cursor?: string;
  limit?: number;
}

export async function listResultsForUser(
  userId: string,
  { cursor, limit = 25 }: ListResultsOpts,
): Promise<{ items: Result[]; nextCursor: string | null }> {
  const items = await prisma.result.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;
  return { items: page, nextCursor };
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const [agg, byMode] = await Promise.all([
    prisma.result.aggregate({
      where: { userId },
      _max: { wpm: true },
      _avg: { wpm: true },
      _count: { _all: true },
    }),
    prisma.result.groupBy({
      by: ['mode'],
      where: { userId },
      _max: { wpm: true },
    }),
  ]);

  const bestByMode: UserStats['bestByMode'] = { fixed: null, time: null, words: null };
  for (const row of byMode) {
    bestByMode[row.mode] = row._max.wpm;
  }

  return {
    bestWpm: agg._max.wpm,
    avgWpm: agg._avg.wpm,
    totalTests: agg._count._all,
    bestByMode,
  };
}
```

- [ ] **Step 3: Typecheck + test (skipped without DB)**

```bash
pnpm typecheck
pnpm test tests/integration/db/results.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -S -m "feat(db): add results service with save/list/stats"
```

---

## Task 8: SaveResultSchema + Zod tests (TDD)

**Files:**
- Create: `src/app/actions/results.ts` (partial — schema + action stub)
- Create: `tests/unit/actions/results-schema.test.ts`

- [ ] **Step 1: Write `tests/unit/actions/results-schema.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { SaveResultSchema } from '@/app/actions/results';

const base = {
  wpm: 70,
  rawWpm: 73,
  accuracy: 0.95,
  mode: 'fixed' as const,
  durationMs: 30_000,
  difficulty: 'medium' as const,
  fixedLength: 'medium' as const,
};

describe('SaveResultSchema', () => {
  it('accepts a well-formed fixed result', () => {
    expect(SaveResultSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a well-formed time result', () => {
    const time = { ...base, mode: 'time' as const, fixedLength: undefined, timeDuration: 30 };
    expect(SaveResultSchema.safeParse(time).success).toBe(true);
  });

  it('accepts a well-formed words result', () => {
    const words = { ...base, mode: 'words' as const, fixedLength: undefined, wordCount: 25 };
    expect(SaveResultSchema.safeParse(words).success).toBe(true);
  });

  it('rejects wpm above the cap', () => {
    expect(SaveResultSchema.safeParse({ ...base, wpm: 401 }).success).toBe(false);
  });

  it('rejects accuracy above 1', () => {
    expect(SaveResultSchema.safeParse({ ...base, accuracy: 1.01 }).success).toBe(false);
  });

  it('rejects negative duration', () => {
    expect(SaveResultSchema.safeParse({ ...base, durationMs: -1 }).success).toBe(false);
  });

  it('rejects fixed mode without fixedLength', () => {
    expect(
      SaveResultSchema.safeParse({ ...base, fixedLength: undefined }).success,
    ).toBe(false);
  });

  it('rejects time mode without timeDuration', () => {
    expect(
      SaveResultSchema.safeParse({ ...base, mode: 'time', fixedLength: undefined }).success,
    ).toBe(false);
  });

  it('rejects words mode without wordCount', () => {
    expect(
      SaveResultSchema.safeParse({ ...base, mode: 'words', fixedLength: undefined }).success,
    ).toBe(false);
  });

  it('rejects unknown mode', () => {
    expect(SaveResultSchema.safeParse({ ...base, mode: 'bogus' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Write partial `src/app/actions/results.ts` (schema only — the full Server Action in Task 12)**

```ts
'use server';

import { z } from 'zod';

export const SaveResultSchema = z
  .object({
    wpm: z.number().min(0).max(400),
    rawWpm: z.number().min(0).max(500),
    accuracy: z.number().min(0).max(1),
    mode: z.enum(['fixed', 'time', 'words']),
    durationMs: z.number().int().min(0).max(10 * 60 * 1000),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    fixedLength: z.enum(['short', 'medium', 'long']).optional(),
    timeDuration: z.number().int().positive().optional(),
    wordCount: z.number().int().positive().optional(),
  })
  .refine((d) => (d.mode === 'fixed' ? !!d.fixedLength : true), {
    message: 'fixedLength required for fixed mode',
  })
  .refine((d) => (d.mode === 'time' ? !!d.timeDuration : true), {
    message: 'timeDuration required for time mode',
  })
  .refine((d) => (d.mode === 'words' ? !!d.wordCount : true), {
    message: 'wordCount required for words mode',
  });

export type SaveResultInput = z.infer<typeof SaveResultSchema>;

// Full saveResultAction implemented in Task 12.
```

- [ ] **Step 3: Run tests**

```bash
pnpm test tests/unit/actions/results-schema.test.ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -S -m "feat(actions): add SaveResultSchema with Zod validation and tests"
```

---

## Task 9: NextAuth config + session types

**Files:**
- Create: `src/auth.config.ts`
- Create: `src/auth.ts`
- Create: `src/types/next-auth.d.ts`
- Modify: `tsconfig.json` — ensure `src/types` is picked up (it already is via `**/*.ts`, but double-check)

- [ ] **Step 1: Create `src/types/next-auth.d.ts`**

```ts
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
  interface User {
    username?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    username?: string;
  }
}
```

- [ ] **Step 2: Create `src/auth.config.ts`**

```ts
import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

export const authConfig: NextAuthConfig = {
  providers: [Google],
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.username = (user as { username?: string }).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id;
        session.user.username = token.username ?? '';
      }
      return session;
    },
  },
};
```

- [ ] **Step 3: Create `src/auth.ts`**

```ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db/client';
import { authConfig } from './auth.config';
import { generateUsername } from '@/lib/db/users';

const baseAdapter = PrismaAdapter(prisma);

const adapter: typeof baseAdapter = {
  ...baseAdapter,
  async createUser(data) {
    const username = await generateUsername(data.email ?? data.name ?? null);
    const created = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        image: data.image,
        emailVerified: data.emailVerified ?? null,
        username,
      },
    });
    return created;
  },
};

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
});
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -s -S -m "feat(auth): add NextAuth v5 config with Google provider and wrapped adapter"
```

---

## Task 10: Auth route handler + signin/error pages

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/auth/signin/page.tsx`
- Create: `src/app/auth/error/page.tsx`

- [ ] **Step 1: Create `src/app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

- [ ] **Step 2: Create `src/app/auth/signin/page.tsx`**

```tsx
import { Button } from '@/components/ui/Button';
import { isAuthConfigured } from '@/env';
import { signIn } from '@/auth';

interface Props {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function SignInPage({ searchParams }: Props) {
  const { callbackUrl = '/dashboard' } = await searchParams;

  if (!isAuthConfigured()) {
    return (
      <section className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Sign in is not configured yet</h1>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          The app is running without Google OAuth credentials. See{' '}
          <code>SETUP.md</code> to configure.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to Typing Speed</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Sign in to save your tests, track your progress, and climb the leaderboards.
        </p>
      </div>
      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: callbackUrl });
        }}
      >
        <Button type="submit" variant="primary">
          Continue with Google
        </Button>
      </form>
      <p className="text-xs text-[color:var(--muted)]">
        By signing in you agree that your Google email and name are used for display.
      </p>
    </section>
  );
}
```

- [ ] **Step 3: Create `src/app/auth/error/page.tsx`**

```tsx
import Link from 'next/link';

export default function AuthErrorPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong signing in</h1>
      <p className="text-sm text-[color:var(--muted)]">
        Please try again in a moment.
      </p>
      <Link href="/" className="text-sm text-[color:var(--accent)] hover:underline">
        Back to home
      </Link>
    </section>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -s -S -m "feat(auth): add /api/auth handler, /auth/signin, /auth/error pages"
```

---

## Task 11: requireSession guard

**Files:**
- Create: `src/lib/auth/guards.ts`

- [ ] **Step 1: Write `src/lib/auth/guards.ts`**

```ts
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { isAuthConfigured } from '@/env';

export async function requireSession(callbackUrl: string) {
  if (!isAuthConfigured()) {
    // In "not configured" mode, there can be no session — bounce to signin which
    // will explain the situation instead of crashing NextAuth.
    redirect('/auth/signin');
  }
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  return session;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -s -S -m "feat(auth): add requireSession guard"
```

---

## Task 12: Server Actions (results + username)

**Files:**
- Modify: `src/app/actions/results.ts` — add `saveResultAction`
- Create: `src/app/actions/username.ts`

- [ ] **Step 1: Replace `src/app/actions/results.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '@/auth';
import { saveResult } from '@/lib/db/results';

export const SaveResultSchema = z
  .object({
    wpm: z.number().min(0).max(400),
    rawWpm: z.number().min(0).max(500),
    accuracy: z.number().min(0).max(1),
    mode: z.enum(['fixed', 'time', 'words']),
    durationMs: z.number().int().min(0).max(10 * 60 * 1000),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    fixedLength: z.enum(['short', 'medium', 'long']).optional(),
    timeDuration: z.number().int().positive().optional(),
    wordCount: z.number().int().positive().optional(),
  })
  .refine((d) => (d.mode === 'fixed' ? !!d.fixedLength : true), {
    message: 'fixedLength required for fixed mode',
  })
  .refine((d) => (d.mode === 'time' ? !!d.timeDuration : true), {
    message: 'timeDuration required for time mode',
  })
  .refine((d) => (d.mode === 'words' ? !!d.wordCount : true), {
    message: 'wordCount required for words mode',
  });

export type SaveResultInput = z.infer<typeof SaveResultSchema>;

export type SaveResultActionOutcome =
  | { ok: true }
  | { ok: false; reason: 'unauthenticated' | 'invalid' | 'error' };

export async function saveResultAction(input: unknown): Promise<SaveResultActionOutcome> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: 'unauthenticated' };

  const parsed = SaveResultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };

  try {
    await saveResult(session.user.id, parsed.data);
  } catch (err) {
    console.error('[saveResultAction] persistence error', err);
    return { ok: false, reason: 'error' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/history');
  return { ok: true };
}
```

- [ ] **Step 2: Create `src/app/actions/username.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { renameUsername } from '@/lib/db/users';

export type RenameUsernameOutcome =
  | { ok: true; username: string }
  | { ok: false; reason: 'unauthenticated' | 'invalid' | 'taken' };

export async function renameUsernameAction(
  newUsername: string,
): Promise<RenameUsernameOutcome> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: 'unauthenticated' };

  const result = await renameUsername(session.user.id, newUsername);
  if (!result.ok) return result;

  revalidatePath('/profile/me');
  revalidatePath(`/profile/${newUsername}`);
  return result;
}

/**
 * Form-action variant used by the rename form. Expects a FormData with a
 * `username` field. Redirects to the new profile URL on success.
 */
export async function renameUsernameFormAction(formData: FormData): Promise<void> {
  const input = formData.get('username');
  if (typeof input !== 'string') redirect('/profile/me?rename=invalid');
  const r = await renameUsernameAction(input);
  if (!r.ok) redirect(`/profile/me?rename=${r.reason}`);
  redirect(`/profile/${r.username}`);
}
```

- [ ] **Step 3: Re-run Zod schema tests to confirm no regression**

```bash
pnpm test tests/unit/actions/results-schema.test.ts
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -s -S -m "feat(actions): add saveResultAction and renameUsernameAction"
```

---

## Task 13: Header auth UI — AuthMenu + wiring

**Files:**
- Create: `src/components/chrome/AuthMenu.tsx`
- Modify: `src/components/chrome/Header.tsx`

- [ ] **Step 1: Create `src/components/chrome/AuthMenu.tsx`**

```tsx
import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { isAuthConfigured } from '@/env';

export async function AuthMenu() {
  if (!isAuthConfigured()) return null;

  const session = await auth();

  if (!session?.user) {
    return (
      <Link
        href="/auth/signin"
        className="text-xs uppercase tracking-widest text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors"
      >
        sign in
      </Link>
    );
  }

  const u = session.user;
  const label = u.username || u.name || 'account';

  return (
    <details className="relative">
      <summary className="flex cursor-pointer items-center gap-2 list-none text-xs uppercase tracking-widest text-[color:var(--muted)] hover:text-[color:var(--fg)]">
        {u.image ? (
          // biome-ignore lint/performance/noImgElement: tiny avatar, no layout-shift concerns, keeps this a server component.
          <img src={u.image} alt="" width={20} height={20} className="rounded-full" />
        ) : (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--faint)] text-[10px] text-[color:var(--fg)]">
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span>{label}</span>
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-40 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] py-1 shadow-lg">
        <MenuLink href="/dashboard" label="Dashboard" />
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
    </details>
  );
}

function MenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-3 py-1.5 text-sm text-[color:var(--fg)] hover:bg-[color:var(--faint)]"
    >
      {label}
    </Link>
  );
}
```

- [ ] **Step 2: Modify `src/components/chrome/Header.tsx`**

```tsx
import Link from 'next/link';
import { AuthMenu } from './AuthMenu';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header className="w-full border-b border-[color:var(--border)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-sm font-medium tracking-wide text-[color:var(--fg)] hover:text-[color:var(--accent)]"
        >
          typing speed
        </Link>
        <div className="flex items-center gap-4">
          <AuthMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -S -m "feat(chrome): add AuthMenu and wire into Header"
```

---

## Task 14: LocalDate component

**Files:**
- Create: `src/components/chrome/LocalDate.tsx`

- [ ] **Step 1: Write `src/components/chrome/LocalDate.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';

interface Props {
  iso: string;
  className?: string;
}

export function LocalDate({ iso, className }: Props) {
  const [text, setText] = useState<string>(() => iso.slice(0, 10)); // SSR-safe fallback
  useEffect(() => {
    const d = new Date(iso);
    setText(
      d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    );
  }, [iso]);
  return <time dateTime={iso} className={className}>{text}</time>;
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -s -S -m "feat(chrome): add LocalDate component with SSR-safe fallback"
```

---

## Task 15: `/dashboard` page

**Files:**
- Create: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Write `src/app/dashboard/page.tsx`**

```tsx
import Link from 'next/link';
import { LocalDate } from '@/components/chrome/LocalDate';
import { requireSession } from '@/lib/auth/guards';
import { listResultsForUser, getUserStats } from '@/lib/db/results';

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
  const [stats, recent] = await Promise.all([
    getUserStats(session.user.id),
    listResultsForUser(session.user.id, { limit: 5 }),
  ]);

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
            No tests yet. <Link className="underline" href="/single-player">Take your first test</Link>.
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

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -s -S -m "feat(dashboard): add /dashboard with stats + recent tests"
```

---

## Task 16: `/profile/me` + `/profile/[username]`

**Files:**
- Create: `src/app/profile/me/page.tsx`
- Create: `src/app/profile/[username]/page.tsx`

- [ ] **Step 1: Create `src/app/profile/me/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth/guards';

export default async function ProfileMePage() {
  const session = await requireSession('/profile/me');
  redirect(`/profile/${session.user.username}`);
}
```

- [ ] **Step 2: Create `src/app/profile/[username]/page.tsx`**

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { renameUsernameFormAction } from '@/app/actions/username';
import { Button } from '@/components/ui/Button';
import { auth } from '@/auth';
import { isAuthConfigured } from '@/env';
import { getUserByUsername } from '@/lib/db/users';
import { getUserStats } from '@/lib/db/results';

function fmtWpm(n: number | null): string {
  return n === null ? '—' : Math.round(n).toString();
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

  // Phase 2a: owner-only view. Public view ships in 2b.
  if (!isOwner) {
    return (
      <section className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">This profile isn&apos;t public yet</h1>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          Public profiles arrive in a later release.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-[color:var(--accent)] hover:underline"
        >
          Back to home
        </Link>
      </section>
    );
  }

  const stats = await getUserStats(user.id);

  const renameMessage =
    rename === 'invalid'
      ? 'That username is invalid (use 3-24 lowercase letters, numbers, or hyphens; no reserved names).'
      : rename === 'taken'
        ? 'That username is taken.'
        : rename === 'unauthenticated'
          ? 'You must be signed in.'
          : null;

  return (
    <section className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        <span className="font-mono">{user.username}</span>
      </h1>
      <p className="text-sm text-[color:var(--muted)]">Your profile</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Best WPM" value={fmtWpm(stats.bestWpm)} accent />
        <Stat label="Avg WPM" value={fmtWpm(stats.avgWpm)} />
        <Stat label="Tests" value={stats.totalTests.toString()} />
      </div>

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
          <Button type="submit" variant="primary">Save</Button>
        </form>
        {renameMessage ? (
          <p className="mt-2 text-xs text-[color:var(--danger)]">{renameMessage}</p>
        ) : null}
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
```

- [ ] **Step 3: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -S -m "feat(profile): add /profile/me redirect and /profile/[username] owner view"
```

---

## Task 17: `/history` page

**Files:**
- Create: `src/app/history/page.tsx`

- [ ] **Step 1: Write `src/app/history/page.tsx`**

```tsx
import Link from 'next/link';
import { LocalDate } from '@/components/chrome/LocalDate';
import { requireSession } from '@/lib/auth/guards';
import { listResultsForUser } from '@/lib/db/results';

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
  searchParams: Promise<{ cursor?: string }>;
}

export default async function HistoryPage({ searchParams }: Props) {
  const session = await requireSession('/history');
  const { cursor } = await searchParams;

  const { items, nextCursor } = await listResultsForUser(session.user.id, {
    cursor,
    limit: 25,
  });

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <Link href="/dashboard" className="text-xs text-[color:var(--accent)] hover:underline">
          ← Dashboard
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">
          No tests yet. <Link className="underline" href="/single-player">Take your first test</Link>.
        </p>
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
                href={`/history?cursor=${nextCursor}`}
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

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -s -S -m "feat(history): add /history page with cursor pagination"
```

---

## Task 18: Single-player save wiring + anonymous nudge

**Files:**
- Modify: `src/app/single-player/page.tsx`

This is the only Phase 1 file we're modifying. We add:
1. A session fetch at page level (server component prelude) to know whether to render logged-in or anonymous UX.
2. A `userId` prop threaded to the Runner.
3. A `SaveBadge` component and anonymous `Sign in to save` link.
4. A call to `saveResultAction` when the engine finishes and the user is logged in.

- [ ] **Step 1: Read the current file**

Before editing, re-read to preserve structure.

- [ ] **Step 2: Update `src/app/single-player/page.tsx`**

The key changes are:
- Remove `'use client'` from the top-level component; split into a server component (outer) + client component (Runner stays client).
- Add a props boundary: server component fetches session and passes `{ username | null }` to the client wrapper.

Actually — `SinglePlayerPage` currently uses `useState`, which means it's a client component. To keep changes minimal and avoid a refactor, we fetch session in a new server wrapper and pass the client component a `loggedIn` boolean + the `saveResultAction` reference.

Here is the full replacement (keep all existing logic; add new pieces marked):

```tsx
import { auth } from '@/auth';
import { isAuthConfigured } from '@/env';
import { saveResultAction } from '@/app/actions/results';
import { SinglePlayerClient } from './client';

export default async function SinglePlayerPage() {
  const session = isAuthConfigured() ? await auth() : null;
  const loggedIn = !!session?.user?.id;
  return (
    <SinglePlayerClient loggedIn={loggedIn} saveAction={saveResultAction} />
  );
}
```

Then move the existing client logic into `src/app/single-player/client.tsx`, adding:
- A `SaveBadge` shown briefly after a successful save.
- An anonymous "Sign in to save future results →" link in the results area when `!loggedIn`.
- A call to `saveAction(input)` inside a `useEffect` that fires when state transitions to `finished`.

- [ ] **Step 3: Create `src/app/single-player/client.tsx`** (previous Phase 1 logic + save/ nudge)

```tsx
'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LiveWpm } from '@/components/typing/LiveWpm';
import { ModeSelector, type TestConfig } from '@/components/typing/ModeSelector';
import { ResultsPanel } from '@/components/typing/ResultsPanel';
import { TypingSurface } from '@/components/typing/TypingSurface';
import { useTypingEngine } from '@/hooks/useTypingEngine';
import { pickPassage, pickWords } from '@/lib/content/select';
import type { EngineConfig, Result } from '@/lib/engine';
import { DEFAULT_CONFIG, loadConfig, saveConfig } from '@/lib/storage/config';
import type { SaveResultActionOutcome } from '@/app/actions/results';

const INITIAL_WORDS_COUNT = 80;

type SaveAction = (input: unknown) => Promise<SaveResultActionOutcome>;

function buildEngineConfig(config: TestConfig, regenKey: number): EngineConfig {
  const seed = `${regenKey}:${Date.now()}`;
  if (config.mode === 'fixed') {
    return {
      mode: 'fixed',
      source: pickPassage({ length: config.fixedLength, seed }).text,
    };
  }
  if (config.mode === 'time') {
    const words = pickWords({
      tier: config.difficulty,
      count: INITIAL_WORDS_COUNT,
      seed,
    });
    return {
      mode: 'time',
      source: words.join(' '),
      duration: config.timeDuration,
    };
  }
  const words = pickWords({
    tier: config.difficulty,
    count: config.wordsCount,
    seed,
  });
  return {
    mode: 'words',
    source: words.join(' '),
    wordCount: config.wordsCount,
  };
}

export function SinglePlayerClient({
  loggedIn,
  saveAction,
}: {
  loggedIn: boolean;
  saveAction: SaveAction;
}) {
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<TestConfig>(() => ({
    mode: DEFAULT_CONFIG.mode,
    fixedLength: DEFAULT_CONFIG.fixedLength,
    timeDuration: DEFAULT_CONFIG.timeDuration,
    wordsCount: DEFAULT_CONFIG.wordsCount,
    difficulty: DEFAULT_CONFIG.difficulty,
  }));
  const [regenKey, setRegenKey] = useState(0);

  useEffect(() => {
    const stored = loadConfig();
    setConfig({
      mode: stored.mode,
      fixedLength: stored.fixedLength,
      timeDuration: stored.timeDuration,
      wordsCount: stored.wordsCount,
      difficulty: stored.difficulty,
    });
    setMounted(true);
  }, []);

  const handleConfigChange = useCallback((next: TestConfig) => {
    setConfig(next);
    saveConfig(next);
    setRegenKey((k) => k + 1);
  }, []);

  const engineConfig = useMemo(
    () => (mounted ? buildEngineConfig(config, regenKey) : null),
    [mounted, config, regenKey],
  );

  return (
    <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col gap-8 px-6 py-10">
      <ModeSelector value={config} onChange={handleConfigChange} disabled={!mounted} />
      {mounted && engineConfig ? (
        <Runner
          key={`${regenKey}:${engineConfig.mode}`}
          engineConfig={engineConfig}
          modeConfig={config}
          onRegenerate={() => setRegenKey((k) => k + 1)}
          loggedIn={loggedIn}
          saveAction={saveAction}
        />
      ) : (
        <div
          className="flex items-center justify-center text-sm text-[color:var(--muted)]"
          style={{ minHeight: '12rem' }}
        >
          loading...
        </div>
      )}
    </section>
  );
}

interface RunnerProps {
  engineConfig: EngineConfig;
  modeConfig: TestConfig;
  onRegenerate: () => void;
  loggedIn: boolean;
  saveAction: SaveAction;
}

function buildSaveInput(
  engineConfig: EngineConfig,
  modeConfig: TestConfig,
  result: Result,
) {
  return {
    wpm: result.wpm,
    rawWpm: result.rawWpm,
    accuracy: result.accuracy,
    mode: engineConfig.mode,
    durationMs: result.durationMs,
    difficulty: modeConfig.difficulty,
    fixedLength:
      engineConfig.mode === 'fixed' ? modeConfig.fixedLength : undefined,
    timeDuration:
      engineConfig.mode === 'time' ? engineConfig.duration : undefined,
    wordCount:
      engineConfig.mode === 'words' ? engineConfig.wordCount : undefined,
  };
}

function Runner({
  engineConfig,
  modeConfig,
  onRegenerate,
  loggedIn,
  saveAction,
}: RunnerProps) {
  const { state, result, handlers, reset, extendSource, onPasteBlocked } =
    useTypingEngine(engineConfig);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const [pasteToast, setPasteToast] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );
  const savedRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — refocus invisible input on status transitions (idle/running/finished) so keyboard input stays captured.
  useEffect(() => {
    inputRef.current?.focus();
  }, [state.status]);

  const handleClick = useCallback(() => inputRef.current?.focus(), []);

  useEffect(() => {
    onPasteBlocked(() => {
      setPasteToast(true);
      setTimeout(() => setPasteToast(false), 1600);
    });
  }, [onPasteBlocked]);

  useEffect(() => {
    if (engineConfig.mode !== 'time') return;
    if (state.needMoreWords) {
      const more = pickWords({
        tier: modeConfig.difficulty,
        count: 25,
        seed: `extend:${Math.random()}`,
      });
      extendSource(` ${more.join(' ')}`);
    }
  }, [state.needMoreWords, extendSource, engineConfig.mode, modeConfig.difficulty]);

  useEffect(() => {
    if (state.status !== 'finished') return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault();
        onRegenerate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        reset();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.status, onRegenerate, reset]);

  // Save on finished for logged-in users. Fires once per result.
  useEffect(() => {
    if (state.status !== 'finished') return;
    if (!loggedIn) return;
    if (!result) return;
    if (savedRef.current) return;
    savedRef.current = true;
    setSaveState('saving');
    const input = buildSaveInput(engineConfig, modeConfig, result);
    (async () => {
      try {
        const out = await saveAction(input);
        setSaveState(out.ok ? 'saved' : 'error');
        if (out.ok) setTimeout(() => setSaveState('idle'), 1500);
      } catch {
        setSaveState('error');
      }
    })();
  }, [state.status, loggedIn, result, engineConfig, modeConfig, saveAction]);

  const showResults = state.status === 'finished' && result !== null;

  return (
    <div className="flex flex-col items-center gap-6" onClick={handleClick}>
      <div className="h-8">
        {state.status === 'running' ? (
          <LiveWpm
            state={state}
            mode={engineConfig.mode}
            source={engineConfig.source}
            duration={engineConfig.duration}
            wordCount={engineConfig.wordCount}
          />
        ) : null}
      </div>

      <input
        ref={inputRef}
        aria-label="typing input"
        onKeyDown={handlers.onKeyDown}
        onPaste={handlers.onPaste}
        onBlur={() => inputRef.current?.focus()}
        className="absolute opacity-0 pointer-events-none"
        tabIndex={-1}
      />

      <TypingSurface
        source={engineConfig.source}
        state={state}
        dimmed={state.status === 'finished'}
      />

      {state.status === 'idle' ? (
        <p className="text-sm text-[color:var(--muted)]">press any key to start</p>
      ) : null}

      {showResults ? (
        <>
          <ResultsPanel
            result={result}
            onNext={onRegenerate}
            onRestart={reset}
            onChangeMode={onRegenerate}
            nextButtonRef={nextBtnRef}
          />
          <div className="h-5 text-xs text-[color:var(--muted)]">
            {loggedIn && saveState === 'saving' ? 'saving…' : null}
            {loggedIn && saveState === 'saved' ? (
              <span className="text-[color:var(--success)]">saved ✓</span>
            ) : null}
            {loggedIn && saveState === 'error' ? (
              <span className="text-[color:var(--danger)]">couldn&apos;t save</span>
            ) : null}
            {!loggedIn ? (
              <Link
                href="/auth/signin?callbackUrl=/single-player"
                className="text-[color:var(--accent)] hover:underline"
              >
                Sign in to save future results →
              </Link>
            ) : null}
          </div>
        </>
      ) : null}

      {pasteToast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-md bg-[color:var(--surface)] px-4 py-2 text-sm text-[color:var(--muted)] shadow-lg"
        >
          Paste is disabled
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Replace `src/app/single-player/page.tsx` with a server component wrapper**

```tsx
import { auth } from '@/auth';
import { isAuthConfigured } from '@/env';
import { saveResultAction } from '@/app/actions/results';
import { SinglePlayerClient } from './client';

export default async function SinglePlayerPage() {
  const session = isAuthConfigured() ? await auth() : null;
  const loggedIn = !!session?.user?.id;
  return (
    <SinglePlayerClient loggedIn={loggedIn} saveAction={saveResultAction} />
  );
}
```

- [ ] **Step 4: Typecheck + test (should pass; hook tests unchanged)**

```bash
pnpm typecheck
pnpm test
```

- [ ] **Step 5: Dev smoke**

```bash
pnpm dev --port 3100 > /tmp/devlog.txt 2>&1 &
DEV_PID=$!
sleep 10
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3100/single-player
kill $DEV_PID 2>/dev/null
```

Expected: 200.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -s -S -m "feat(single-player): save for logged-in users; nudge for anonymous"
```

---

## Task 19: SETUP.md + .env.example

**Files:**
- Create: `docs/SETUP.md`
- Modify: `.env.example`

- [ ] **Step 1: Write `.env.example`**

```
# Neon Postgres (https://neon.tech) — create a project + a dev branch and paste the connection string.
DATABASE_URL=postgres://USER:PASSWORD@HOST/DB

# NextAuth.js — generate with: openssl rand -hex 32
AUTH_SECRET=

# Google OAuth credentials — https://console.cloud.google.com/apis/credentials
# Create an "OAuth client ID" (Web application) with redirect URIs:
#   http://localhost:3000/api/auth/callback/google
#   https://<your-vercel-domain>/api/auth/callback/google
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# Public URL of this app; NextAuth uses it for redirects.
AUTH_URL=http://localhost:3000
```

- [ ] **Step 2: Write `docs/SETUP.md`**

```markdown
# Setup — Neon Postgres + Google OAuth

Phase 2a requires two external services: a Postgres database and a Google OAuth client. This document walks through setting up both.

## 1. Neon Postgres

1. Sign up at https://neon.tech (free tier).
2. Create a new project; accept defaults.
3. In the dashboard, open **Connection Details**. Copy the "Pooled connection" string (starts with `postgres://`).
4. Add it to `.env.local`:
   ```
   DATABASE_URL=postgres://user:pass@host/db
   ```
5. Run the initial migration:
   ```bash
   pnpm db:migrate:dev --name init
   ```
   This creates all NextAuth + domain tables in Neon and generates `prisma/migrations/<timestamp>_init/`.

## 2. Google OAuth client

1. Open https://console.cloud.google.com/apis/credentials.
2. If you don't have a project, create one named "Typing Speed".
3. **OAuth consent screen** → choose "External", fill in app name + support email, skip scopes, add your email as a test user (so only you can sign in while in "Testing" mode).
4. **Credentials** → "Create Credentials" → "OAuth client ID" → Application type: "Web application".
5. **Authorized redirect URIs** — add both:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-vercel-domain>/api/auth/callback/google` (add later when deploying)
6. Copy the **Client ID** and **Client secret**; add to `.env.local`:
   ```
   AUTH_GOOGLE_ID=...
   AUTH_GOOGLE_SECRET=...
   ```

## 3. Auth secret

Generate a random secret:
```bash
openssl rand -hex 32
```
Add to `.env.local`:
```
AUTH_SECRET=<the output>
```

## 4. Sanity check

Start the dev server:
```bash
pnpm dev
```

- Navigate to `/auth/signin` — you should see the "Continue with Google" button.
- Click it — Google's consent screen opens; approve.
- You land on `/dashboard` with three "—" stats (no tests yet).

## 5. Deploy to Vercel (optional in Phase 2a)

1. Connect the repo to a new Vercel project.
2. In the Vercel project settings, add all five env vars from `.env.local` (with `AUTH_URL` pointing to the Vercel domain).
3. Add this to `package.json` scripts:
   ```json
   "vercel-build": "prisma migrate deploy && next build"
   ```
4. Update the Google OAuth redirect URI list to include the Vercel domain.
5. Deploy.

## Troubleshooting

- **"Sign in is not configured yet"** — one of the four env vars is missing. Check with `pnpm dlx @auth/cli` or just `echo $AUTH_SECRET`.
- **`P1001: Can't reach database server`** — `DATABASE_URL` is wrong or Neon is paused. Click "Resume" in the Neon dashboard.
- **OAuth error page** — usually a redirect URI mismatch. Double-check the URI list in Google Cloud Console.
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -s -S -m "docs: add SETUP.md for Neon + Google OAuth, update .env.example"
```

---

## Task 20: Final gates + README update

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run all gates**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all pass. Build warnings about "DATABASE_URL not set" are expected and OK — the app must build without env vars.

If any gate fails, fix inline and re-run. Don't commit failing gates.

- [ ] **Step 2: Update README**

Add a "Phase 2a status" line under the Phase section noting auth + persistence + dashboard + history are shipped. Add a pointer to SETUP.md.

Replace the "Current Phase" block:

```markdown
## Current Phase

**Phase 2a — Foundation**: Google sign-in + Prisma/Postgres persistence + dashboard + history. See:
- Design: `docs/superpowers/specs/2026-04-19-phase-2a-foundation-design.md`
- Setup: `docs/SETUP.md` (required to enable auth locally)

**Phase 1** — single-player typing test (shipped). See:
- Design: `docs/superpowers/specs/2026-04-19-phase-1-single-player-design.md`
```

Keep the rest.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -s -S -m "docs: update README with Phase 2a status"
```

---

## Self-Review

- **Spec coverage:**
  - § 2 feature decisions: all covered by Tasks 5–18.
  - § 4 Prisma schema: Task 3.
  - § 5 project structure: Tasks 3–18 create the listed files.
  - § 6 auth wiring: Tasks 9, 10, 11.
  - § 7 data access: Tasks 4, 6, 7.
  - § 8 Server Actions: Tasks 8 (schema only) + 12 (full actions).
  - § 9 UI surfaces: Tasks 10, 13, 14, 15, 16, 17, 18.
  - § 10 env vars + runtime: Tasks 2, 19.
  - § 11 migrations + build: Task 3 + SETUP.md (user runs migrate:dev with their DATABASE_URL).
  - § 12 testing: Tasks 5, 8 (unit always run); Tasks 6, 7 (integration gated on DATABASE_URL).
  - § 13 deploy readiness: Task 19 SETUP.md; quality gates in Task 20.

- **Placeholder scan:** None.

- **Type consistency:**
  - `SaveResultInput` is defined in `src/app/actions/results.ts` (Zod-inferred) and separately in `src/lib/db/results.ts` (interface). They have identical shapes intentionally — the action validates input then hands it to the DB layer. Both files can import from each other; I'll keep the duplication for explicitness since they live at different trust boundaries (one is the validated-client-input type, the other is the service-layer input type).
  - `RESERVED_USERNAMES` exported from `src/lib/auth/username.ts` and referenced in tests.
  - `SaveResultActionOutcome`, `RenameUsernameOutcome` consistent between action and consumer.

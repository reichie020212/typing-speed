# Phase 2a — Foundation (Design Spec)

**Date:** 2026-04-19
**Scope:** Accounts + persistence end-to-end. Google sign-in, Prisma/Postgres, save single-player results, minimal `/dashboard`, `/profile/me` + `/profile/[username]`, `/history`. Anonymous single-player continues to work.
**Defers to Phase 2b:** leaderboards (four time windows), WPM progression chart (Recharts), history filters, public discovery of other users' profiles.
**Defers to Phase 3+:** multiplayer, AdSense, deploy automation.

## 1. Product Goals

Phase 2a proves the whole auth + persistence stack end-to-end against real infrastructure (Neon Postgres, Google OAuth). By the end, a signed-in user can take a typing test, see their result saved automatically, and view their history and personal bests. The data model and access layer are designed so Phase 2b can add leaderboards and charts without schema changes.

## 2. Feature Decisions

| Decision | Value | Rationale |
|---|---|---|
| Postgres provider | Neon for dev and prod (separate branches) | Zero local infra, Vercel's recommended replacement for the deprecated "Vercel Postgres" |
| Auth providers | Google only | Spec scope; frictionless onboarding |
| Username strategy | Auto-derived from Google email on first sign-in; renameable later; URL-safe `[a-z0-9-]`, 3–24 chars; reserved list includes route names (`me`, `admin`, `api`, `auth`, etc.) | Zero-step onboarding while keeping human-readable URLs |
| Username rename | Allowed; old URL 404s (no redirect history) | Rare action; a confirmation dialog warns about link breakage |
| Save behavior — logged-in | Silent auto-save after each finished test; small "saved" badge for 1.5s | Minimal friction; expected behavior for an account |
| Save behavior — anonymous | Show "Sign in to save future results →" on results panel; current test's result is NOT retroactively saved | No redirect-round-trip plumbing; upgrade later if conversion funnel matters |
| Result schema | Summary only (wpm, rawWpm, accuracy, mode, config fields, createdAt); no timeline; no passage reference | ~200 byte rows; supports all dashboards + 2b leaderboards; can add timeline as nullable column later |
| Session strategy | JWT | No DB query per request; simpler; Google-only, revocation isn't a pressing concern |
| Auth framework | NextAuth v5 (`next-auth@5` / Auth.js) with Prisma adapter | Current stable; idiomatic for Next.js App Router |
| Data mutations | Server Actions (`'use server'` functions), not REST API routes | Less boilerplate for the two or three mutations we need |
| Route protection | Per-page `auth()` check via `requireSession()` helper | Cleaner than middleware for the small protected route set; top-of-file gate is obvious in each page |
| History pagination | Cursor-based, 25 per page, "Load more" (server-rendered with `?cursor=…`) | Simple; handles large histories cleanly; no client list state |

## 3. Tech Stack Additions

Built on top of Phase 1's stack (Next.js 16 App Router, React 19, TS strict, Tailwind v4, Biome, Vitest, pnpm).

- **NextAuth v5** (`next-auth@5`) with **@auth/prisma-adapter**.
- **Prisma ORM** (`prisma` CLI + `@prisma/client` runtime) against **PostgreSQL**.
- **Zod** for request-boundary validation.
- **Neon** as the Postgres provider (dev branch + prod branch).

## 4. Prisma Schema

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Mode       { fixed time words }
enum Difficulty { easy medium hard }
enum Length     { short medium long }

// NextAuth adapter standard tables
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
  user              User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

// Domain table
model Result {
  id           String     @id @default(cuid())
  userId       String
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  wpm          Float
  rawWpm       Float
  accuracy     Float      // 0..1
  mode         Mode
  durationMs   Int
  difficulty   Difficulty
  fixedLength  Length?    // only when mode = fixed
  timeDuration Int?       // seconds; only when mode = time
  wordCount    Int?       // only when mode = words
  createdAt    DateTime   @default(now())

  @@index([userId, createdAt(sort: Desc)])          // history pagination + personal bests
  @@index([createdAt(sort: Desc), wpm(sort: Desc)]) // leaderboards (Phase 2b)
  @@index([wpm(sort: Desc)])                        // all-time leaderboard (Phase 2b)
}
```

Notes:
- `Session` is kept even though JWT is used (adapter expects the table; it stays empty in JWT mode, and keeps upgrade paths open).
- `username` is non-null — the adapter's `createUser` is wrapped to inject a generated username (Section 6).
- Leaderboard-supporting indexes are added now to avoid a second migration in Phase 2b.

## 5. Project Structure (additions)

```
prisma/
├─ schema.prisma
└─ migrations/                   # generated

src/
├─ app/
│  ├─ api/auth/[...nextauth]/
│  │  └─ route.ts                # re-exports NextAuth handlers
│  ├─ auth/
│  │  ├─ signin/page.tsx
│  │  └─ error/page.tsx
│  ├─ dashboard/page.tsx
│  ├─ history/page.tsx
│  ├─ profile/
│  │  ├─ me/page.tsx             # redirects to /profile/<username>
│  │  └─ [username]/page.tsx     # 2a: owner-only; 2b: public
│  └─ actions/
│     ├─ results.ts              # saveResultAction
│     └─ username.ts             # renameUsernameAction
├─ auth.ts                       # NextAuth instance + wrapped adapter
├─ auth.config.ts                # edge-compatible base config
├─ env.ts                        # zod-validated process.env
├─ types/
│  └─ next-auth.d.ts             # session type augmentation
├─ lib/
│  ├─ db/
│  │  ├─ client.ts               # Prisma singleton
│  │  ├─ results.ts              # saveResult, listResultsForUser, getUserStats
│  │  └─ users.ts                # getUserByUsername, renameUsername, generateUsername
│  └─ auth/
│     ├─ guards.ts               # requireSession()
│     └─ username.ts             # pure helpers: deriveBase, isValidUsername

tests/
├─ unit/
│  ├─ auth/
│  │  └─ username.test.ts
│  └─ db/
│     └─ results-schema.test.ts  # Zod SaveResultSchema coverage
└─ integration/                  # runs only if DATABASE_URL is set
   └─ db/
      ├─ results.test.ts
      └─ users.test.ts

docs/
├─ superpowers/                  # (existing) specs + plans + reports
└─ SETUP.md                      # new: Neon + Google Cloud setup steps
```

## 6. Auth Wiring

### 6.1 Config files

**`src/auth.config.ts`** — edge-compatible subset (no Prisma import):

```ts
import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

export const authConfig: NextAuthConfig = {
  providers: [Google],
  pages: { signIn: '/auth/signin', error: '/auth/error' },
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
        session.user.id = token.id as string;
        session.user.username = token.username as string;
      }
      return session;
    },
  },
};
```

**`src/auth.ts`** — Node runtime, Prisma adapter:

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
    return prisma.user.create({ data: { ...data, username } });
  },
};

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
});
```

**`src/app/api/auth/[...nextauth]/route.ts`:**

```ts
import { handlers } from '@/auth';
export const { GET, POST } = handlers;
```

### 6.2 Session type augmentation

**`src/types/next-auth.d.ts`:**

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

### 6.3 Username generation

**`src/lib/auth/username.ts`** — pure helpers (no DB):

```ts
const RESERVED = new Set([
  'me', 'admin', 'api', 'settings', 'auth', 'signin', 'signout',
  'new', 'edit', 'null', 'undefined', 'profile', 'dashboard',
  'history', 'leaderboard',
]);
const USERNAME_RE = /^[a-z0-9][a-z0-9-]{2,23}$/;

export function deriveBase(seed: string | null): string {
  if (!seed) return 'user';
  const cleaned = seed.toLowerCase()
    .replace(/@.*$/, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20);
  if (cleaned.length >= 3) return cleaned;
  return `user-${cleaned}`.slice(0, 20);
}

export function isValidUsername(u: string): boolean {
  return USERNAME_RE.test(u) && !RESERVED.has(u);
}

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 5);
}
```

**`src/lib/db/users.ts`** — DB-coupled:

```ts
export async function generateUsername(seed: string | null): Promise<string> {
  const base = deriveBase(seed);
  // Try base; on collision or invalid, append random suffix; bound retries.
  const candidates = [base, ...Array.from({ length: 10 }, () => `${base}-${randomSuffix()}`)];
  for (const c of candidates) {
    if (!isValidUsername(c)) continue;
    const taken = await prisma.user.findUnique({ where: { username: c } });
    if (!taken) return c;
  }
  // Fallback: username with a fresh random tail — guaranteed unique.
  return `user-${randomSuffix()}${randomSuffix()}`.slice(0, 20);
}
```

### 6.4 Route protection

**`src/lib/auth/guards.ts`:**

```ts
import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export async function requireSession(callbackUrl: string) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  return session;
}
```

## 7. Data Access Layer

**`src/lib/db/client.ts`** — Prisma singleton (hot-reload safe):

```ts
import { PrismaClient } from '@prisma/client';
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**`src/lib/db/results.ts`:**

```ts
export interface SaveResultInput {
  wpm: number;
  rawWpm: number;
  accuracy: number;           // 0..1
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

export async function saveResult(userId: string, input: SaveResultInput): Promise<void>;
export async function listResultsForUser(
  userId: string,
  opts: { cursor?: string; limit?: number },
): Promise<{ items: Result[]; nextCursor: string | null }>;
export async function getUserStats(userId: string): Promise<UserStats>;
```

Implementations use Prisma aggregates (`aggregate({ _max, _avg, _count })` + `groupBy({ by: ['mode'], _max: { wpm: true } })`). One query per metric in 2a; optimize if needed later.

## 8. Server Actions

**`src/app/actions/results.ts`:**

```ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { saveResult } from '@/lib/db/results';

const SaveResultSchema = z.object({
  wpm: z.number().min(0).max(400),
  rawWpm: z.number().min(0).max(500),
  accuracy: z.number().min(0).max(1),
  mode: z.enum(['fixed', 'time', 'words']),
  durationMs: z.number().int().min(0).max(10 * 60 * 1000), // 10 min cap
  difficulty: z.enum(['easy', 'medium', 'hard']),
  fixedLength: z.enum(['short', 'medium', 'long']).optional(),
  timeDuration: z.number().int().positive().optional(),
  wordCount: z.number().int().positive().optional(),
}).refine((d) => (d.mode === 'fixed' ? !!d.fixedLength : true), 'fixedLength required for fixed mode')
  .refine((d) => (d.mode === 'time' ? !!d.timeDuration : true), 'timeDuration required for time mode')
  .refine((d) => (d.mode === 'words' ? !!d.wordCount : true), 'wordCount required for words mode');

export type SaveResultActionOutcome = { ok: true } | { ok: false; reason: string };

export async function saveResultAction(input: unknown): Promise<SaveResultActionOutcome> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: 'unauthenticated' };
  const parsed = SaveResultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  await saveResult(session.user.id, parsed.data);
  revalidatePath('/dashboard');
  revalidatePath('/history');
  return { ok: true };
}
```

**`src/app/actions/username.ts`:**

```ts
'use server';

export async function renameUsernameAction(newUsername: string): Promise<{ ok: true; username: string } | { ok: false; reason: 'invalid' | 'taken' | 'unauthenticated' }>;
```

## 9. UI Surfaces

### 9.1 Header auth UI (extended `Header.tsx`)
- Logged out: "Sign in" link next to the theme toggle → `/auth/signin`.
- Logged in: avatar (from `session.user.image` with a fallback) + username → `<details>`-based dropdown with `Dashboard`, `Profile`, `Sign out`. "Sign out" is a server-action form.

### 9.2 `/auth/signin`
- Server component. Reads `?callbackUrl=…` searchParam (defaults to `/dashboard`).
- Centered card with a form whose action is an inline server action:
  ```tsx
  <form action={async () => {
    'use server';
    await signIn('google', { redirectTo: callbackUrl });
  }}>
    <button type="submit">Continue with Google</button>
  </form>
  ```
  This is the idiomatic NextAuth v5 pattern — no client component required.
- Short footer about Google email/name being used for display.

### 9.3 `/auth/error`
- Single sentence, link back to `/`.

### 9.4 `/dashboard` (protected)
- Three-stat hero: best WPM, avg WPM, total tests.
- Per-mode best mini-table (fixed / time / words → WPM or "—").
- Recent 5 tests table with a "View all" link to `/history`.
- Server component; data fetched via `getUserStats()` + `listResultsForUser({ limit: 5 })`.

### 9.5 `/profile/me`
- One-liner: `redirect('/profile/' + session.user.username)`.

### 9.6 `/profile/[username]` (Phase 2a: owner-only)
- `getUserByUsername(username)` → 404 if not found.
- If `session.user.id !== user.id`, render a minimal "This profile isn't public yet" page in 2a (no stats). Public view ships in 2b.
- Owner view: same stats as dashboard plus a "rename username" form calling `renameUsernameAction`. On success, redirect to `/profile/<new>`.

### 9.7 `/history` (protected)
- Server component; `searchParams.cursor` drives pagination.
- Table: date (user local timezone — rendered via a tiny `<LocalDate>` client component that hydrates the ISO string into local format), mode summary, WPM, raw, accuracy.
- "Load more" link at the bottom when `nextCursor !== null`; points to `?cursor=<id>`.

### 9.8 `/single-player` changes
- `useSession()` from NextAuth on the client.
- When engine finishes AND user is logged in: fire `saveResultAction(input)`; show a `saved` badge on the results panel on `{ ok: true }`; on failure, subtle non-blocking toast "Couldn't save — try again?". `Next test` still works either way.
- When engine finishes AND user is anonymous: show a small "Sign in to save future results →" link below the stats.

## 10. Env Vars + Runtime Config

**`src/env.ts`** — Zod-validated env:

```ts
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = EnvSchema.parse(process.env);
export function isAuthConfigured(): boolean {
  return !!(env.DATABASE_URL && env.AUTH_SECRET && env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}
```

When `isAuthConfigured()` is false:
- Protected pages render a small "Not configured yet — see SETUP.md" notice instead of calling NextAuth (which would crash).
- `/single-player` continues to work anonymously (Phase 1 parity).

This keeps the app runnable for visual/UI tasks even without env vars (important for our local browser verification before the user provides creds).

**`.env.example`:**

```
DATABASE_URL=postgres://user:pass@host/db
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_URL=http://localhost:3000
```

**`SETUP.md`** (new) — end-user steps to configure Neon + Google Cloud.

## 11. Migrations + Build

- `prisma/schema.prisma` drives migrations.
- `package.json` adds:
  - `"postinstall": "prisma generate"` — ensures `@prisma/client` is always in sync for devs and Vercel.
  - `"db:migrate:dev": "prisma migrate dev"` — local devs run this after editing schema.
  - `"db:migrate:deploy": "prisma migrate deploy"` — prod.
  - `"vercel-build": "prisma migrate deploy && next build"` — makes deploys auto-migrate.
- First migration (`init`) generated during implementation and committed.

## 12. Testing

### 12.1 Unit tests (always run)
- `src/lib/auth/username.ts` — exhaustive coverage of `deriveBase`, `isValidUsername`, edge cases.
- `SaveResultSchema` — valid/invalid input matrix.
- Pure validation logic in `src/env.ts`.

### 12.2 Integration tests (conditional on `DATABASE_URL`)
Placed in `tests/integration/`. Guarded at setup:
```ts
beforeAll(() => {
  if (!process.env.DATABASE_URL) it.skip;
});
```
Cover:
- `saveResult` + `listResultsForUser` round-trip.
- `getUserStats` computes best/avg/total correctly across a small fixture.
- Wrapped adapter `createUser` injects a username.
- `renameUsername` rejects reserved/taken names; succeeds on valid rename.

These run locally when the user has filled in `DATABASE_URL`; they're skipped in CI-less setups.

### 12.3 Deferred to Phase 2b or later
- Full browser/Playwright e2e for the auth flow. Requires real Google OAuth which can't be tested without credentials.

### 12.4 Quality gates (all must pass)
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test` (unit; integration run only if DATABASE_URL set)
- `pnpm build`

## 13. Deploy Readiness

- Vercel reads `AUTH_*`, `DATABASE_URL` from its env vars UI.
- `vercel-build` runs migrations, then builds.
- First deploy: user creates the Neon project, adds `DATABASE_URL` to Vercel, creates the Google OAuth client with prod redirect URI (`https://<domain>/api/auth/callback/google`), adds `AUTH_*` vars to Vercel.
- **No actual deploy happens in Phase 2a execution.** Deploy readiness is met when `pnpm build` succeeds locally.

## 14. Out of Scope (Deferred to Phase 2b)

- Leaderboards (all-time, monthly, weekly, today).
- Public profile views for non-owners.
- Recharts WPM-over-time chart on dashboard/profile.
- History filters (by mode, by difficulty, by date range).
- "Discover other users" — no user list or search surface.
- User settings page beyond the tiny rename form on `/profile/me`.
- Account deletion / data export (GDPR considerations — defer to when there's a legal requirement).
- Rate limiting on `saveResultAction`.
- "Sign in to save THIS result" (option 4A) — the lossy 4B variant ships in 2a.

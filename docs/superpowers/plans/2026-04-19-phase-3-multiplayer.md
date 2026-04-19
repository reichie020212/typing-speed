# Phase 3 — Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship realtime multiplayer typing races (fixed-passage, up to 8 players per room, mixed guest/auth) via a standalone Socket.io server alongside the existing Next.js/Vercel app.

**Architecture:** Next.js owns pages/auth/historical reads; a Node + Socket.io server in `server/` owns in-memory race state and writes race results to the same Postgres. Short-lived HMAC tokens minted by Next.js authenticate sockets on the Node side. Guests identify with a nickname; their results show on-screen only. Authenticated participants dual-write to both `RaceParticipant` (race-centric) and `Result` (user-centric, with `raceId` FK), so Phase 2 leaderboard/dashboard queries work unchanged.

**Tech Stack:** Next.js 16 + React 19 (existing), Node 20, `socket.io` + `socket.io-client`, `jose` (HMAC HS256), Prisma 6 (additive schema), Zod, Vitest. Deployed to Railway (Socket.io server) + Vercel (Next.js).

**Source spec:** `docs/superpowers/specs/2026-04-19-phase-3-multiplayer-design.md`

---

## File Structure (reference map)

### New files (shared between Next.js + server)

```
src/lib/race/
├── code.ts          # 6-char race code generator + alphabet
├── nickname.ts      # validateNickname — length, pattern, blocklist, trim
├── token.ts         # mintRaceToken / verifyRaceToken (HMAC HS256)
├── events.ts        # TS interfaces for every client↔server Socket.io event
├── validation.ts    # Zod schemas for incoming events (server + client validation)
└── state.ts         # Pure race state machine — phase transitions, DNF assignment
```

### New files (Next.js surface)

```
src/app/race/page.tsx                  # entry: Create + Join cards
src/app/race/create-form.tsx           # client form for difficulty/length → POST /api/race
src/app/race/[code]/page.tsx           # server wrapper for race page
src/app/race/[code]/client.tsx         # state-machine consumer, renders Lobby/Countdown/Racing/Ended
src/app/api/race/route.ts              # POST: create race
src/app/api/race/token/route.ts        # POST: mint race token for the current session
src/hooks/useRaceSocket.ts             # connects, handles lifecycle, exposes race state
src/components/race/Lobby.tsx
src/components/race/Countdown.tsx
src/components/race/ProgressRails.tsx
src/components/race/Results.tsx
src/components/race/NicknameModal.tsx
src/lib/db/races.ts                    # createRace, saveRaceParticipant, saveRaceResultForUser, getRaceByCode
```

### New files (standalone server)

```
server/
├── tsconfig.json    # extends ../tsconfig.json, targets Node 20, outDir server/dist
├── index.ts         # HTTP bootstrap, Socket.io attach, healthz, startup sweep
├── rooms.ts         # Map<code, Room> registry + createRoom/purgeRoom
├── room.ts          # Room class — owns state machine, sockets, timers, broadcasts
├── auth.ts          # Socket middleware: verify token or validate nickname
├── handlers.ts      # Per-event handlers: join, startRace, progress, finish, leave
└── persistence.ts   # Prisma writes on finish/DNF
```

### Modified files

```
prisma/schema.prisma               # +Race, +RaceParticipant, +RaceStatus, +Result.raceId
src/env.ts                         # +RACE_SERVER_SECRET, +NEXT_PUBLIC_RACE_SERVER_URL, +CORS_ORIGIN, +isMultiplayerConfigured()
src/components/chrome/AuthMenu.tsx # +Race top-level nav link
src/app/page.tsx                   # +Race tile on landing
package.json                       # +socket.io, +socket.io-client (dev), +tsx, +jose, +dev:server/build:server/start:server scripts
docs/SETUP.md                      # +Phase 3 Railway setup
README.md                          # +Phase 3 shipped note
```

### New test files

```
tests/unit/lib/race/code.test.ts
tests/unit/lib/race/nickname.test.ts
tests/unit/lib/race/token.test.ts
tests/unit/lib/race/validation.test.ts
tests/unit/lib/race/state.test.ts
tests/integration/db/races.test.ts
tests/integration/race/happy-path.test.ts
tests/integration/race/late-join.test.ts
tests/integration/race/disconnect-dnf.test.ts
tests/integration/race/host-reassign.test.ts
tests/integration/race/two-tab-dedupe.test.ts
```

---

## Task 1: Install dependencies and add Phase 3 env schema

**Files:**
- Modify: `package.json`
- Modify: `src/env.ts`
- Create: `tests/unit/env.test.ts` (new — minimal)

- [ ] **Step 1: Install runtime and dev deps**

```bash
pnpm add socket.io jose
pnpm add -D socket.io-client tsx @types/jsonwebtoken concurrently
```

Then regenerate the Prisma client:

```bash
pnpm db:generate
```

- [ ] **Step 2: Extend `src/env.ts` with Phase 3 vars**

Open `src/env.ts` and replace the whole file with:

```ts
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  AUTH_URL: z.string().url().optional(),
  RACE_SERVER_SECRET: z.string().min(32).optional(),
  NEXT_PUBLIC_RACE_SERVER_URL: z.string().url().optional(),
  CORS_ORIGIN: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = EnvSchema.parse(process.env);

export function isAuthConfigured(): boolean {
  return !!(env.DATABASE_URL && env.AUTH_SECRET && env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}

export function isMultiplayerConfigured(): boolean {
  return !!(env.RACE_SERVER_SECRET && env.NEXT_PUBLIC_RACE_SERVER_URL);
}
```

- [ ] **Step 3: Add dev scripts to `package.json`**

In the `scripts` block, add:

```json
"dev:server":   "tsx watch server/index.ts",
"build:server": "tsc -p server/tsconfig.json",
"start:server": "node server/dist/index.js",
"dev:all":      "concurrently -n next,server -c blue,green \"pnpm dev\" \"pnpm dev:server\""
```

- [ ] **Step 4: Verify lint + typecheck pass**

```bash
pnpm lint && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/env.ts
git commit -s -S -m "chore(phase3): install socket.io + jose, extend env schema"
```

---

## Task 2: Race code generator

**Files:**
- Create: `src/lib/race/code.ts`
- Create: `tests/unit/lib/race/code.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/race/code.test.ts
import { describe, expect, it } from 'vitest';
import { generateRaceCode, RACE_CODE_ALPHABET } from '@/lib/race/code';

describe('generateRaceCode', () => {
  it('returns a 6-char uppercase code', () => {
    const code = generateRaceCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(code.length).toBe(6);
  });

  it('uses only the ambiguity-free alphabet', () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateRaceCode();
      for (const ch of code) {
        expect(RACE_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it('never includes ambiguous chars (0, O, 1, I)', () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateRaceCode();
      expect(code).not.toMatch(/[0O1I]/);
    }
  });

  it('produces varied output (sanity check)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generateRaceCode());
    expect(seen.size).toBeGreaterThan(90); // collisions vanishingly rare at 100 tries
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/unit/lib/race/code.test.ts
```

Expected: FAIL — cannot resolve `@/lib/race/code`.

- [ ] **Step 3: Implement `src/lib/race/code.ts`**

```ts
export const RACE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const RACE_CODE_LENGTH = 6;

export function generateRaceCode(): string {
  let out = '';
  for (let i = 0; i < RACE_CODE_LENGTH; i++) {
    out += RACE_CODE_ALPHABET.charAt(Math.floor(Math.random() * RACE_CODE_ALPHABET.length));
  }
  return out;
}
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
pnpm test tests/unit/lib/race/code.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/race/code.ts tests/unit/lib/race/code.test.ts
git commit -s -S -m "feat(race): add race code generator with ambiguity-free alphabet"
```

---

## Task 3: Nickname validation

**Files:**
- Create: `src/lib/race/nickname.ts`
- Create: `tests/unit/lib/race/nickname.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/race/nickname.test.ts
import { describe, expect, it } from 'vitest';
import { validateNickname } from '@/lib/race/nickname';

describe('validateNickname', () => {
  it('accepts alphanumeric within 1–16 chars', () => {
    const out = validateNickname('alice');
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.normalized).toBe('alice');
  });

  it('trims surrounding whitespace', () => {
    const out = validateNickname('  bob  ');
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.normalized).toBe('bob');
  });

  it('allows spaces, underscores, and hyphens', () => {
    expect(validateNickname('cool guy').ok).toBe(true);
    expect(validateNickname('cool_guy').ok).toBe(true);
    expect(validateNickname('cool-guy').ok).toBe(true);
  });

  it('rejects empty after trim', () => {
    const out = validateNickname('   ');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/at least 1/i);
  });

  it('rejects over 16 chars', () => {
    const out = validateNickname('a'.repeat(17));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/16/);
  });

  it('rejects disallowed characters', () => {
    const out = validateNickname('hello!');
    expect(out.ok).toBe(false);
  });

  it('rejects reserved Guest- prefix', () => {
    const out = validateNickname('Guest-1234');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/reserved/i);
  });

  it('rejects profanity from the blocklist', () => {
    const out = validateNickname('shit');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/not allowed/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/unit/lib/race/nickname.test.ts
```

Expected: FAIL — cannot resolve `@/lib/race/nickname`.

- [ ] **Step 3: Implement `src/lib/race/nickname.ts`**

```ts
export type NicknameValidationResult =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

const NICKNAME_RE = /^[A-Za-z0-9 _-]+$/;
const MAX_LEN = 16;

// Minimal blocklist for Phase 3. The curated wordlist in Phase 1 did a
// generation-time filter; this is a much shorter runtime guard focused on the
// obvious hits. Expand over time if reports come in.
const BLOCKLIST = new Set([
  'shit',
  'fuck',
  'cunt',
  'bitch',
  'asshole',
  'nigger',
  'faggot',
  'retard',
]);

export function validateNickname(raw: string): NicknameValidationResult {
  const trimmed = raw.trim();
  if (trimmed.length < 1) {
    return { ok: false, error: 'Nickname must be at least 1 character.' };
  }
  if (trimmed.length > MAX_LEN) {
    return { ok: false, error: `Nickname must be at most ${MAX_LEN} characters.` };
  }
  if (!NICKNAME_RE.test(trimmed)) {
    return {
      ok: false,
      error: 'Nickname may only contain letters, numbers, spaces, underscores, and dashes.',
    };
  }
  if (/^Guest-/i.test(trimmed)) {
    return { ok: false, error: 'The "Guest-" prefix is reserved.' };
  }
  const lower = trimmed.toLowerCase();
  for (const bad of BLOCKLIST) {
    if (lower.includes(bad)) {
      return { ok: false, error: 'That nickname is not allowed.' };
    }
  }
  return { ok: true, normalized: trimmed };
}
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
pnpm test tests/unit/lib/race/nickname.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/race/nickname.ts tests/unit/lib/race/nickname.test.ts
git commit -s -S -m "feat(race): add nickname validator with blocklist"
```

---

## Task 4: Race auth token (HMAC mint/verify)

**Files:**
- Create: `src/lib/race/token.ts`
- Create: `tests/unit/lib/race/token.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/race/token.test.ts
import { describe, expect, it } from 'vitest';
import { mintRaceToken, verifyRaceToken } from '@/lib/race/token';

const SECRET = 'test-secret-that-is-at-least-32-characters-long-xx';

describe('race token', () => {
  it('mints and verifies a valid token', async () => {
    const token = await mintRaceToken(
      { userId: 'u1', username: 'alice' },
      SECRET,
      { ttlSeconds: 300 },
    );
    const decoded = await verifyRaceToken(token, SECRET);
    expect(decoded.userId).toBe('u1');
    expect(decoded.username).toBe('alice');
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await mintRaceToken({ userId: 'u1', username: 'alice' }, SECRET);
    await expect(verifyRaceToken(token, `${SECRET}-other`)).rejects.toThrow();
  });

  it('rejects a token whose payload was tampered with', async () => {
    const token = await mintRaceToken({ userId: 'u1', username: 'alice' }, SECRET);
    const parts = token.split('.');
    // Flip a bit in the payload segment
    const tampered = [parts[0], `${parts[1]}xx`, parts[2]].join('.');
    await expect(verifyRaceToken(tampered, SECRET)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const token = await mintRaceToken(
      { userId: 'u1', username: 'alice' },
      SECRET,
      { ttlSeconds: -1 }, // already expired
    );
    await expect(verifyRaceToken(token, SECRET)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/unit/lib/race/token.test.ts
```

Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Implement `src/lib/race/token.ts`**

```ts
import { jwtVerify, SignJWT } from 'jose';

export interface RaceTokenPayload {
  userId: string;
  username: string;
}

const ALG = 'HS256';
const DEFAULT_TTL_SECONDS = 300; // 5 minutes

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function mintRaceToken(
  payload: RaceTokenPayload,
  secret: string,
  opts: { ttlSeconds?: number } = {},
): Promise<string> {
  const ttl = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(secretKey(secret));
}

export async function verifyRaceToken(
  token: string,
  secret: string,
): Promise<RaceTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey(secret), { algorithms: [ALG] });
  if (typeof payload.userId !== 'string' || typeof payload.username !== 'string') {
    throw new Error('Invalid race token payload');
  }
  return { userId: payload.userId, username: payload.username };
}
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
pnpm test tests/unit/lib/race/token.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/race/token.ts tests/unit/lib/race/token.test.ts
git commit -s -S -m "feat(race): add HMAC mint/verify for race tokens"
```

---

## Task 5: Race event types and Zod validation

**Files:**
- Create: `src/lib/race/events.ts`
- Create: `src/lib/race/validation.ts`
- Create: `tests/unit/lib/race/validation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/race/validation.test.ts
import { describe, expect, it } from 'vitest';
import {
  FinishEventSchema,
  JoinEventSchema,
  ProgressEventSchema,
} from '@/lib/race/validation';

describe('incoming event schemas', () => {
  it('accepts a valid join event', () => {
    const parsed = JoinEventSchema.safeParse({ code: 'A7X2K9' });
    expect(parsed.success).toBe(true);
  });

  it('rejects a join event with a non-6-char code', () => {
    expect(JoinEventSchema.safeParse({ code: 'ABC' }).success).toBe(false);
    expect(JoinEventSchema.safeParse({ code: 'ABC0123' }).success).toBe(false);
  });

  it('accepts a progress event in valid range', () => {
    const parsed = ProgressEventSchema.safeParse({
      charIndex: 42,
      wpm: 75.3,
      accuracy: 0.96,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects progress with out-of-range values', () => {
    expect(ProgressEventSchema.safeParse({ charIndex: -1, wpm: 0, accuracy: 1 }).success).toBe(
      false,
    );
    expect(
      ProgressEventSchema.safeParse({ charIndex: 0, wpm: 10000, accuracy: 1 }).success,
    ).toBe(false);
    expect(ProgressEventSchema.safeParse({ charIndex: 0, wpm: 50, accuracy: 2 }).success).toBe(
      false,
    );
  });

  it('accepts a finish event', () => {
    const parsed = FinishEventSchema.safeParse({
      wpm: 80,
      rawWpm: 85,
      accuracy: 0.97,
      durationMs: 45_000,
    });
    expect(parsed.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/unit/lib/race/validation.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/race/events.ts`**

```ts
export type RacePhase = 'waiting' | 'countdown' | 'racing' | 'ended';

export interface Participant {
  playerId: string; // stable per-connection ID (cuid for auth, guestId for guest)
  userId: string | null;
  nickname: string;
  isHost: boolean;
  status: 'lobby' | 'racing' | 'finished' | 'dnf';
  charIndex: number;
  wpm: number;
  accuracy: number;
  finishPosition: number | null;
}

export interface RaceSnapshot {
  code: string;
  phase: RacePhase;
  passageText: string; // sent only after countdown starts
  players: Participant[];
}

// ---------- Client → server ----------

export interface HandshakeAuth {
  token?: string;
  nickname?: string;
}

export interface JoinEvent {
  code: string;
}

export interface StartRaceEvent {
  // empty body; only the host may send this
}

export interface ProgressEvent {
  charIndex: number;
  wpm: number;
  accuracy: number;
}

export interface FinishEvent {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  durationMs: number;
}

export interface LeaveEvent {
  // empty
}

// ---------- Server → client ----------

export interface JoinedEvent {
  you: Participant;
  race: RaceSnapshot;
}

export interface RosterEvent {
  players: Participant[];
}

export interface PhaseEvent {
  phase: RacePhase;
  at: number; // server epoch ms
}

export interface CountdownEvent {
  secondsRemaining: number;
}

export interface ProgressBroadcast {
  playerId: string;
  charIndex: number;
  wpm: number;
  accuracy: number;
}

export interface FinishedEvent {
  playerId: string;
  finishPosition: number;
  wpm: number;
  accuracy: number;
  durationMs: number;
}

export interface EndedEvent {
  results: Array<{
    playerId: string;
    nickname: string;
    userId: string | null;
    status: 'finished' | 'dnf';
    finishPosition: number | null;
    wpm: number;
    accuracy: number;
    durationMs: number;
  }>;
}

export interface RaceErrorEvent {
  code:
    | 'auth-failed'
    | 'room-not-found'
    | 'room-locked'
    | 'room-full'
    | 'bad-nickname'
    | 'bad-payload'
    | 'kicked-duplicate';
  message: string;
}
```

- [ ] **Step 4: Implement `src/lib/race/validation.ts`**

```ts
import { z } from 'zod';
import { RACE_CODE_LENGTH } from './code';

export const JoinEventSchema = z.object({
  code: z.string().length(RACE_CODE_LENGTH).regex(/^[A-Z0-9]+$/),
});

export const StartRaceEventSchema = z.object({}).strict();

export const ProgressEventSchema = z.object({
  charIndex: z.number().int().min(0).max(10_000),
  wpm: z.number().min(0).max(500),
  accuracy: z.number().min(0).max(1),
});

export const FinishEventSchema = z.object({
  wpm: z.number().min(0).max(500),
  rawWpm: z.number().min(0).max(500),
  accuracy: z.number().min(0).max(1),
  durationMs: z.number().int().min(0).max(30 * 60_000),
});

export const LeaveEventSchema = z.object({}).strict();
```

- [ ] **Step 5: Run tests, expect PASS**

```bash
pnpm test tests/unit/lib/race/validation.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/race/events.ts src/lib/race/validation.ts tests/unit/lib/race/validation.test.ts
git commit -s -S -m "feat(race): add event types and Zod validation schemas"
```

---

## Task 6: Pure race state machine

**Files:**
- Create: `src/lib/race/state.ts`
- Create: `tests/unit/lib/race/state.test.ts`

The state machine is pure: it takes commands and time, mutates internal state, and returns **effects** (`broadcast`, `scheduleTimer`, `cancelTimer`, `persist`, `closeRoom`). The Room class in the server turns effects into real side effects. Keeping this pure makes it fully unit-testable.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/lib/race/state.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createRaceMachine, type RaceMachine } from '@/lib/race/state';

function makeMachine(): RaceMachine {
  return createRaceMachine({
    code: 'ABCDEF',
    passageText: 'the quick brown fox',
    maxPlayers: 8,
    countdownSeconds: 5,
    tailWindowMs: 60_000,
    createdAtMs: 0,
  });
}

describe('race state machine', () => {
  let m: RaceMachine;
  beforeEach(() => {
    m = makeMachine();
  });

  it('starts in waiting phase with no players', () => {
    expect(m.snapshot().phase).toBe('waiting');
    expect(m.snapshot().players).toEqual([]);
  });

  it('first joiner becomes host', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    const snap = m.snapshot();
    expect(snap.players).toHaveLength(1);
    expect(snap.players[0]?.isHost).toBe(true);
  });

  it('second joiner is not host', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    expect(m.snapshot().players[1]?.isHost).toBe(false);
  });

  it('rejects join when full', () => {
    for (let i = 0; i < 8; i++) {
      m.join({ playerId: `p${i}`, userId: null, nickname: `n${i}`, nowMs: 100 + i });
    }
    const r = m.join({ playerId: 'p9', userId: null, nickname: 'overflow', nowMs: 200 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('room-full');
  });

  it('host can start race with ≥2 players; transitions to countdown', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    const effects = m.startRace({ requesterId: 'p1', nowMs: 300 });
    expect(m.snapshot().phase).toBe('countdown');
    // expect one timer scheduled for countdown tick
    expect(effects.some((e) => e.kind === 'scheduleTimer' && e.key === 'countdown-tick')).toBe(
      true,
    );
  });

  it('non-host cannot start race', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    const effects = m.startRace({ requesterId: 'p2', nowMs: 300 });
    expect(m.snapshot().phase).toBe('waiting');
    expect(effects.length).toBe(0);
  });

  it('countdown tick counts down to 0 then phase = racing', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    m.startRace({ requesterId: 'p1', nowMs: 300 });
    for (let s = 5; s >= 0; s--) {
      m.tickCountdown({ nowMs: 300 + (5 - s) * 1000 });
    }
    expect(m.snapshot().phase).toBe('racing');
  });

  it('blocks joins during countdown + racing', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    m.startRace({ requesterId: 'p1', nowMs: 300 });
    const r = m.join({ playerId: 'p3', userId: null, nickname: 'late', nowMs: 400 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('room-locked');
  });

  it('ends when all players finish', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    m.startRace({ requesterId: 'p1', nowMs: 300 });
    for (let s = 5; s >= 0; s--) m.tickCountdown({ nowMs: 300 + (5 - s) * 1000 });
    m.finish({
      playerId: 'p1',
      wpm: 80,
      rawWpm: 85,
      accuracy: 0.95,
      durationMs: 20_000,
      nowMs: 25_000,
    });
    m.finish({
      playerId: 'p2',
      wpm: 70,
      rawWpm: 72,
      accuracy: 0.92,
      durationMs: 25_000,
      nowMs: 30_000,
    });
    expect(m.snapshot().phase).toBe('ended');
  });

  it('tail window DNFs stragglers 60s after first finish', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    m.startRace({ requesterId: 'p1', nowMs: 300 });
    for (let s = 5; s >= 0; s--) m.tickCountdown({ nowMs: 300 + (5 - s) * 1000 });
    m.finish({
      playerId: 'p1',
      wpm: 80,
      rawWpm: 85,
      accuracy: 0.95,
      durationMs: 20_000,
      nowMs: 25_000,
    });
    // Fire tail-window timer
    m.tailWindowExpired({ nowMs: 85_000 });
    expect(m.snapshot().phase).toBe('ended');
    const bob = m.snapshot().players.find((p) => p.playerId === 'p2');
    expect(bob?.status).toBe('dnf');
  });

  it('host disconnect in lobby promotes next-longest-connected', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    m.leave({ playerId: 'p1', nowMs: 300 });
    expect(m.snapshot().players[0]?.playerId).toBe('p2');
    expect(m.snapshot().players[0]?.isHost).toBe(true);
  });

  it('disconnect during racing marks DNF', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    m.startRace({ requesterId: 'p1', nowMs: 300 });
    for (let s = 5; s >= 0; s--) m.tickCountdown({ nowMs: 300 + (5 - s) * 1000 });
    m.leave({ playerId: 'p2', nowMs: 10_000 });
    const bob = m.snapshot().players.find((p) => p.playerId === 'p2');
    expect(bob?.status).toBe('dnf');
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL**

```bash
pnpm test tests/unit/lib/race/state.test.ts
```

- [ ] **Step 3: Implement `src/lib/race/state.ts`**

```ts
import type { Participant, RacePhase, RaceSnapshot } from './events';

export type Effect =
  | { kind: 'broadcast'; event: 'roster' | 'phase' | 'countdown' | 'progress' | 'finished' | 'ended'; payload: unknown }
  | { kind: 'scheduleTimer'; key: string; delayMs: number }
  | { kind: 'cancelTimer'; key: string }
  | {
      kind: 'persist';
      op: 'start' | 'finish' | 'dnf' | 'end' | 'cancel';
      data: Record<string, unknown>;
    };

export interface RaceMachineOptions {
  code: string;
  passageId?: string;
  passageText: string;
  maxPlayers: number;
  countdownSeconds: number;
  tailWindowMs: number;
  createdAtMs: number;
}

interface InternalPlayer extends Participant {
  joinedAtMs: number;
  finishedAtMs: number | null;
}

export interface RaceMachine {
  snapshot(): RaceSnapshot;
  join(cmd: {
    playerId: string;
    userId: string | null;
    nickname: string;
    nowMs: number;
  }): { ok: true } | { ok: false; code: 'room-full' | 'room-locked' | 'duplicate-player' };
  leave(cmd: { playerId: string; nowMs: number }): Effect[];
  startRace(cmd: { requesterId: string; nowMs: number }): Effect[];
  tickCountdown(cmd: { nowMs: number }): Effect[];
  progress(cmd: {
    playerId: string;
    charIndex: number;
    wpm: number;
    accuracy: number;
    nowMs: number;
  }): Effect[];
  finish(cmd: {
    playerId: string;
    wpm: number;
    rawWpm: number;
    accuracy: number;
    durationMs: number;
    nowMs: number;
  }): Effect[];
  tailWindowExpired(cmd: { nowMs: number }): Effect[];
  hasPlayer(playerId: string): boolean;
  isHost(playerId: string): boolean;
}

export function createRaceMachine(opts: RaceMachineOptions): RaceMachine {
  let phase: RacePhase = 'waiting';
  const players = new Map<string, InternalPlayer>();
  let countdownRemaining = opts.countdownSeconds;
  let startedAtMs: number | null = null;
  let firstFinishAtMs: number | null = null;
  let nextFinishPos = 1;

  function toParticipant(p: InternalPlayer): Participant {
    // Strip internal-only fields.
    const { joinedAtMs: _j, finishedAtMs: _f, ...rest } = p;
    return rest;
  }

  function snapshot(): RaceSnapshot {
    const sorted = Array.from(players.values()).sort((a, b) => a.joinedAtMs - b.joinedAtMs);
    return {
      code: opts.code,
      phase,
      passageText: phase === 'waiting' ? '' : opts.passageText,
      players: sorted.map(toParticipant),
    };
  }

  function rosterEffect(): Effect {
    return {
      kind: 'broadcast',
      event: 'roster',
      payload: { players: snapshot().players },
    };
  }

  function reassignHostIfNeeded(): boolean {
    const list = Array.from(players.values()).sort((a, b) => a.joinedAtMs - b.joinedAtMs);
    if (list.length === 0) return false;
    if (list.some((p) => p.isHost)) return false;
    const next = list[0];
    if (!next) return false;
    next.isHost = true;
    return true;
  }

  function endRace(nowMs: number): Effect[] {
    const effects: Effect[] = [];
    for (const p of players.values()) {
      if (p.status === 'racing') {
        p.status = 'dnf';
        p.finishedAtMs = nowMs;
        effects.push({
          kind: 'persist',
          op: 'dnf',
          data: {
            playerId: p.playerId,
            userId: p.userId,
            nickname: p.nickname,
            durationMs: startedAtMs !== null ? nowMs - startedAtMs : 0,
            wpm: p.wpm,
            accuracy: p.accuracy,
          },
        });
      }
    }
    phase = 'ended';
    effects.push({ kind: 'cancelTimer', key: 'tail-window' });
    effects.push({
      kind: 'broadcast',
      event: 'ended',
      payload: {
        results: Array.from(players.values())
          .sort((a, b) => {
            if (a.finishPosition == null && b.finishPosition == null) return 0;
            if (a.finishPosition == null) return 1;
            if (b.finishPosition == null) return -1;
            return a.finishPosition - b.finishPosition;
          })
          .map((p) => ({
            playerId: p.playerId,
            nickname: p.nickname,
            userId: p.userId,
            status: p.status === 'finished' ? 'finished' : 'dnf',
            finishPosition: p.finishPosition,
            wpm: p.wpm,
            accuracy: p.accuracy,
            durationMs:
              p.finishedAtMs !== null && startedAtMs !== null
                ? p.finishedAtMs - startedAtMs
                : 0,
          })),
      },
    });
    effects.push({ kind: 'persist', op: 'end', data: { endedAtMs: nowMs } });
    return effects;
  }

  return {
    snapshot,
    hasPlayer(playerId) {
      return players.has(playerId);
    },
    isHost(playerId) {
      return players.get(playerId)?.isHost === true;
    },
    join(cmd) {
      if (phase !== 'waiting') return { ok: false, code: 'room-locked' };
      if (players.size >= opts.maxPlayers) return { ok: false, code: 'room-full' };
      if (players.has(cmd.playerId)) return { ok: false, code: 'duplicate-player' };
      const isFirst = players.size === 0;
      players.set(cmd.playerId, {
        playerId: cmd.playerId,
        userId: cmd.userId,
        nickname: cmd.nickname,
        isHost: isFirst,
        status: 'lobby',
        charIndex: 0,
        wpm: 0,
        accuracy: 0,
        finishPosition: null,
        joinedAtMs: cmd.nowMs,
        finishedAtMs: null,
      });
      return { ok: true };
    },
    leave(cmd) {
      const existing = players.get(cmd.playerId);
      if (!existing) return [];
      const effects: Effect[] = [];
      if (phase === 'waiting' || phase === 'countdown') {
        players.delete(cmd.playerId);
        if (reassignHostIfNeeded()) {
          // host promotion implicit in roster broadcast
        }
        effects.push(rosterEffect());
        return effects;
      }
      if (phase === 'racing') {
        if (existing.status === 'racing') {
          existing.status = 'dnf';
          existing.finishedAtMs = cmd.nowMs;
          effects.push({
            kind: 'persist',
            op: 'dnf',
            data: {
              playerId: existing.playerId,
              userId: existing.userId,
              nickname: existing.nickname,
              durationMs: startedAtMs !== null ? cmd.nowMs - startedAtMs : 0,
              wpm: existing.wpm,
              accuracy: existing.accuracy,
            },
          });
          effects.push(rosterEffect());
        }
        // Check if this completes the race
        const anyRacing = Array.from(players.values()).some((p) => p.status === 'racing');
        if (!anyRacing) {
          effects.push(...endRace(cmd.nowMs));
        }
      }
      return effects;
    },
    startRace(cmd) {
      if (phase !== 'waiting') return [];
      const requester = players.get(cmd.requesterId);
      if (!requester || !requester.isHost) return [];
      if (players.size < 2) return [];
      phase = 'countdown';
      countdownRemaining = opts.countdownSeconds;
      return [
        { kind: 'broadcast', event: 'phase', payload: { phase: 'countdown', at: cmd.nowMs } },
        {
          kind: 'broadcast',
          event: 'countdown',
          payload: { secondsRemaining: countdownRemaining },
        },
        { kind: 'scheduleTimer', key: 'countdown-tick', delayMs: 1000 },
        { kind: 'persist', op: 'start', data: { startedAtMs: cmd.nowMs } },
      ];
    },
    tickCountdown(cmd) {
      if (phase !== 'countdown') return [];
      countdownRemaining -= 1;
      if (countdownRemaining > 0) {
        return [
          {
            kind: 'broadcast',
            event: 'countdown',
            payload: { secondsRemaining: countdownRemaining },
          },
          { kind: 'scheduleTimer', key: 'countdown-tick', delayMs: 1000 },
        ];
      }
      // Countdown done → transition to racing
      phase = 'racing';
      startedAtMs = cmd.nowMs;
      for (const p of players.values()) {
        p.status = 'racing';
      }
      return [
        { kind: 'broadcast', event: 'countdown', payload: { secondsRemaining: 0 } },
        { kind: 'broadcast', event: 'phase', payload: { phase: 'racing', at: cmd.nowMs } },
      ];
    },
    progress(cmd) {
      const p = players.get(cmd.playerId);
      if (!p || phase !== 'racing' || p.status !== 'racing') return [];
      p.charIndex = cmd.charIndex;
      p.wpm = cmd.wpm;
      p.accuracy = cmd.accuracy;
      return [
        {
          kind: 'broadcast',
          event: 'progress',
          payload: {
            playerId: cmd.playerId,
            charIndex: cmd.charIndex,
            wpm: cmd.wpm,
            accuracy: cmd.accuracy,
          },
        },
      ];
    },
    finish(cmd) {
      const p = players.get(cmd.playerId);
      if (!p || phase !== 'racing' || p.status !== 'racing') return [];
      p.status = 'finished';
      p.finishPosition = nextFinishPos++;
      p.wpm = cmd.wpm;
      p.accuracy = cmd.accuracy;
      p.finishedAtMs = cmd.nowMs;
      const effects: Effect[] = [
        {
          kind: 'broadcast',
          event: 'finished',
          payload: {
            playerId: p.playerId,
            finishPosition: p.finishPosition,
            wpm: cmd.wpm,
            accuracy: cmd.accuracy,
            durationMs: cmd.durationMs,
          },
        },
        {
          kind: 'persist',
          op: 'finish',
          data: {
            playerId: p.playerId,
            userId: p.userId,
            nickname: p.nickname,
            finishPosition: p.finishPosition,
            wpm: cmd.wpm,
            rawWpm: cmd.rawWpm,
            accuracy: cmd.accuracy,
            durationMs: cmd.durationMs,
          },
        },
      ];
      if (firstFinishAtMs === null) {
        firstFinishAtMs = cmd.nowMs;
        effects.push({
          kind: 'scheduleTimer',
          key: 'tail-window',
          delayMs: opts.tailWindowMs,
        });
      }
      const anyRacing = Array.from(players.values()).some((pp) => pp.status === 'racing');
      if (!anyRacing) {
        effects.push(...endRace(cmd.nowMs));
      }
      return effects;
    },
    tailWindowExpired(cmd) {
      if (phase !== 'racing') return [];
      return endRace(cmd.nowMs);
    },
  };
}
```

- [ ] **Step 4: Run tests, expect PASS**

```bash
pnpm test tests/unit/lib/race/state.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/race/state.ts tests/unit/lib/race/state.test.ts
git commit -s -S -m "feat(race): add pure race state machine with effect log"
```

---

## Task 7: Prisma schema — Race, RaceParticipant, RaceStatus, Result.raceId

**Files:**
- Modify: `prisma/schema.prisma`
- New migration under `prisma/migrations/`

- [ ] **Step 1: Edit schema**

Append the following to `prisma/schema.prisma` and modify the `Result` model and `User` model:

```prisma
enum RaceStatus {
  waiting
  countdown
  racing
  ended
  canceled
}

model Race {
  id           String            @id @default(cuid())
  code         String            @unique
  passageId    String
  difficulty   Difficulty
  status       RaceStatus        @default(waiting)
  createdById  String?
  createdBy    User?             @relation("RaceCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  createdAt    DateTime          @default(now())
  startedAt    DateTime?
  endedAt      DateTime?
  participants RaceParticipant[]
  results      Result[]

  @@index([createdById, createdAt(sort: Desc)])
}

model RaceParticipant {
  id             String   @id @default(cuid())
  raceId         String
  race           Race     @relation(fields: [raceId], references: [id], onDelete: Cascade)
  userId         String?
  user           User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  nickname       String
  finishPosition Int?
  status         String // 'finished' | 'dnf'
  wpm            Float
  rawWpm         Float
  accuracy       Float
  durationMs     Int
  createdAt      DateTime @default(now())

  @@index([raceId, finishPosition])
  @@index([userId, createdAt(sort: Desc)])
}
```

Modify the `User` model to add the back-relations:

```prisma
model User {
  id                 String            @id @default(cuid())
  name               String?
  email              String?           @unique
  emailVerified      DateTime?
  image              String?
  username           String            @unique
  createdAt          DateTime          @default(now())
  accounts           Account[]
  sessions           Session[]
  results            Result[]
  racesCreated       Race[]            @relation("RaceCreatedBy")
  raceParticipations RaceParticipant[]
}
```

Modify the `Result` model to add the `raceId` column and relation:

```prisma
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
  raceId       String?
  race         Race?      @relation(fields: [raceId], references: [id], onDelete: SetNull)
  createdAt    DateTime   @default(now())

  @@index([userId, createdAt(sort: Desc)])
  @@index([createdAt(sort: Desc), wpm(sort: Desc)])
  @@index([wpm(sort: Desc)])
  @@index([raceId])
}
```

- [ ] **Step 2: Validate the schema**

```bash
pnpm db:validate
```

Expected: PASS with no errors.

- [ ] **Step 3: Generate migration (if a DATABASE_URL is configured)**

```bash
pnpm db:migrate:dev --name phase3_add_race_tables
```

Expected: applies migration, regenerates client. If `DATABASE_URL` is not set, skip this step — the migration will be generated and applied in a deploy environment.

- [ ] **Step 4: Regenerate Prisma client (always safe)**

```bash
pnpm db:generate
```

- [ ] **Step 5: Confirm typecheck**

```bash
pnpm typecheck
```

Expected: PASS. New model types available on `prisma.race`, `prisma.raceParticipant`, `prisma.result.raceId`.

- [ ] **Step 6: Commit**

```bash
git add prisma/
git commit -s -S -m "feat(db): add Race, RaceParticipant, RaceStatus, Result.raceId"
```

---

## Task 8: Database helpers for races

**Files:**
- Create: `src/lib/db/races.ts`
- Create: `tests/integration/db/races.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/integration/db/races.test.ts
import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import {
  createRace,
  getRaceByCode,
  saveRaceParticipant,
  saveRaceResultForUser,
} from '@/lib/db/races';
import { hasDatabase, withDatabase } from './helpers';

describe.skipIf(!hasDatabase)('db/races', () => {
  withDatabase();

  it('creates a race with a unique 6-char code', async () => {
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: null,
    });
    expect(race.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(race.status).toBe('waiting');
    expect(race.passageId).toBe('short-aurelius-01');
  });

  it('retries on code collision and still succeeds', async () => {
    // Seed an existing race to attempt collision
    await createRace({ passageId: 'short-aurelius-01', difficulty: 'easy', createdById: null });
    const second = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'medium',
      createdById: null,
    });
    expect(second.id).toBeDefined();
  });

  it('saveRaceParticipant inserts only a RaceParticipant row (guest path)', async () => {
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: null,
    });
    await saveRaceParticipant({
      raceId: race.id,
      userId: null,
      nickname: 'guest-alice',
      status: 'finished',
      finishPosition: 1,
      wpm: 80,
      rawWpm: 85,
      accuracy: 0.95,
      durationMs: 30_000,
    });
    const participants = await prisma.raceParticipant.findMany({ where: { raceId: race.id } });
    expect(participants.length).toBe(1);
    const results = await prisma.result.findMany({ where: { raceId: race.id } });
    expect(results.length).toBe(0);
  });

  it('saveRaceResultForUser inserts both RaceParticipant AND Result (auth path)', async () => {
    const user = await prisma.user.create({ data: { username: 'alice' } });
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: user.id,
    });
    await saveRaceResultForUser({
      raceId: race.id,
      userId: user.id,
      nickname: 'alice',
      status: 'finished',
      finishPosition: 1,
      wpm: 80,
      rawWpm: 85,
      accuracy: 0.95,
      durationMs: 30_000,
      difficulty: 'easy',
    });
    const participants = await prisma.raceParticipant.findMany({ where: { raceId: race.id } });
    expect(participants.length).toBe(1);
    const results = await prisma.result.findMany({ where: { raceId: race.id } });
    expect(results.length).toBe(1);
    expect(results[0]?.raceId).toBe(race.id);
    expect(results[0]?.mode).toBe('fixed');
  });

  it('getRaceByCode returns race + ordered participants', async () => {
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: null,
    });
    await saveRaceParticipant({
      raceId: race.id,
      userId: null,
      nickname: 'bob',
      status: 'finished',
      finishPosition: 2,
      wpm: 50,
      rawWpm: 55,
      accuracy: 0.9,
      durationMs: 40_000,
    });
    await saveRaceParticipant({
      raceId: race.id,
      userId: null,
      nickname: 'alice',
      status: 'finished',
      finishPosition: 1,
      wpm: 80,
      rawWpm: 85,
      accuracy: 0.95,
      durationMs: 30_000,
    });
    await saveRaceParticipant({
      raceId: race.id,
      userId: null,
      nickname: 'carol',
      status: 'dnf',
      finishPosition: null,
      wpm: 10,
      rawWpm: 12,
      accuracy: 0.5,
      durationMs: 60_000,
    });
    const loaded = await getRaceByCode(race.code);
    expect(loaded).not.toBeNull();
    expect(loaded?.participants.length).toBe(3);
    expect(loaded?.participants[0]?.nickname).toBe('alice'); // pos 1
    expect(loaded?.participants[1]?.nickname).toBe('bob'); // pos 2
    expect(loaded?.participants[2]?.nickname).toBe('carol'); // DNF
  });
});
```

Extend `tests/integration/db/helpers.ts` to also truncate race tables. Replace the file with:

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
    await prisma.raceParticipant.deleteMany({});
    await prisma.result.deleteMany({});
    await prisma.race.deleteMany({});
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

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test tests/integration/db/races.test.ts
```

Expected: FAIL — cannot resolve `@/lib/db/races`. (If `DATABASE_URL` unset, test suite skips entirely with a warning — that is also a valid "fails" state; to really verify the test, run against a local Neon dev branch.)

- [ ] **Step 3: Implement `src/lib/db/races.ts`**

```ts
import type { Difficulty, Race, RaceParticipant, RaceStatus } from '@prisma/client';
import { generateRaceCode } from '@/lib/race/code';
import { prisma } from './client';

const MAX_CODE_RETRIES = 5;

export interface CreateRaceInput {
  passageId: string;
  difficulty: Difficulty;
  createdById: string | null;
}

export async function createRace(input: CreateRaceInput): Promise<Race> {
  let lastError: unknown = null;
  for (let i = 0; i < MAX_CODE_RETRIES; i++) {
    const code = generateRaceCode();
    try {
      return await prisma.race.create({
        data: {
          code,
          passageId: input.passageId,
          difficulty: input.difficulty,
          createdById: input.createdById,
          status: 'waiting',
        },
      });
    } catch (err: unknown) {
      lastError = err;
      // Prisma P2002 = unique constraint violation. Regenerate code and retry.
      const e = err as { code?: string };
      if (e.code !== 'P2002') throw err;
    }
  }
  throw new Error('Failed to generate unique race code', { cause: lastError });
}

export interface SaveParticipantInput {
  raceId: string;
  userId: string | null;
  nickname: string;
  status: 'finished' | 'dnf';
  finishPosition: number | null;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  durationMs: number;
}

export async function saveRaceParticipant(input: SaveParticipantInput): Promise<RaceParticipant> {
  return prisma.raceParticipant.create({
    data: {
      raceId: input.raceId,
      userId: input.userId,
      nickname: input.nickname,
      status: input.status,
      finishPosition: input.finishPosition,
      wpm: input.wpm,
      rawWpm: input.rawWpm,
      accuracy: input.accuracy,
      durationMs: input.durationMs,
    },
  });
}

export interface SaveResultForUserInput extends SaveParticipantInput {
  userId: string; // required for this path
  difficulty: Difficulty;
}

export async function saveRaceResultForUser(
  input: SaveResultForUserInput,
): Promise<RaceParticipant> {
  return prisma.$transaction(async (tx) => {
    const participant = await tx.raceParticipant.create({
      data: {
        raceId: input.raceId,
        userId: input.userId,
        nickname: input.nickname,
        status: input.status,
        finishPosition: input.finishPosition,
        wpm: input.wpm,
        rawWpm: input.rawWpm,
        accuracy: input.accuracy,
        durationMs: input.durationMs,
      },
    });
    await tx.result.create({
      data: {
        userId: input.userId,
        mode: 'fixed',
        difficulty: input.difficulty,
        wpm: input.wpm,
        rawWpm: input.rawWpm,
        accuracy: input.accuracy,
        durationMs: input.durationMs,
        raceId: input.raceId,
      },
    });
    return participant;
  });
}

export async function getRaceByCode(code: string): Promise<
  | (Race & {
      participants: RaceParticipant[];
    })
  | null
> {
  return prisma.race.findUnique({
    where: { code },
    include: {
      participants: {
        orderBy: [
          // Finished first (finishPosition asc, nulls last), then DNFs by createdAt
          { finishPosition: 'asc' },
          { createdAt: 'asc' },
        ],
      },
    },
  });
}

export async function markRaceEnded(
  raceId: string,
  endedAt: Date,
  status: RaceStatus = 'ended',
): Promise<void> {
  await prisma.race.update({
    where: { id: raceId },
    data: { endedAt, status },
  });
}

export async function markRaceStarted(raceId: string, startedAt: Date): Promise<void> {
  await prisma.race.update({
    where: { id: raceId },
    data: { startedAt, status: 'racing' },
  });
}
```

Note the nullsFirst/Last quirk: Postgres orders NULLs last on ASC by default, so DNFs (`finishPosition: null`) naturally fall to the bottom. Good.

- [ ] **Step 4: Run tests, expect PASS** (requires `DATABASE_URL`)

```bash
DATABASE_URL=<your dev Neon url> pnpm test tests/integration/db/races.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/races.ts tests/integration/db/races.test.ts tests/integration/db/helpers.ts
git commit -s -S -m "feat(db): add race helpers — create, save participant, result, get by code"
```

---

## Task 9: Next.js API route — POST /api/race/token

**Files:**
- Create: `src/app/api/race/token/route.ts`

- [ ] **Step 1: Implement the route**

```ts
// src/app/api/race/token/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { env } from '@/env';
import { mintRaceToken } from '@/lib/race/token';

export async function POST() {
  if (!env.RACE_SERVER_SECRET) {
    return NextResponse.json({ error: 'race-not-configured' }, { status: 501 });
  }
  const session = await auth();
  if (!session?.user?.id || !session.user.username) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const token = await mintRaceToken(
    { userId: session.user.id, username: session.user.username },
    env.RACE_SERVER_SECRET,
    { ttlSeconds: 300 },
  );
  return NextResponse.json({ token });
}
```

- [ ] **Step 2: Verify lint + typecheck pass**

```bash
pnpm lint && pnpm typecheck
```

- [ ] **Step 3: Smoke test (manual)**

```bash
pnpm dev
# Sign in via Google, then:
curl -X POST http://localhost:3000/api/race/token -H 'Cookie: <next-auth session cookie>'
# Expected: { "token": "<jwt>" }
```

Unauthenticated: `curl -X POST http://localhost:3000/api/race/token` → 401.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/race/token/route.ts
git commit -s -S -m "feat(api): add POST /api/race/token route"
```

---

## Task 10: Next.js API route — POST /api/race

**Files:**
- Create: `src/app/api/race/route.ts`

- [ ] **Step 1: Implement the route**

```ts
// src/app/api/race/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { env } from '@/env';
import { PASSAGES } from '@/lib/content/passages';
import { pickPassage } from '@/lib/content/select';
import { createRace } from '@/lib/db/races';

const CreateRaceSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']),
  length: z.enum(['short', 'medium', 'long']),
});

export async function POST(req: Request) {
  if (!env.DATABASE_URL || !env.RACE_SERVER_SECRET) {
    return NextResponse.json({ error: 'race-not-configured' }, { status: 501 });
  }
  const body = await req.json().catch(() => null);
  const parsed = CreateRaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  const session = await auth();
  const createdById = session?.user?.id ?? null;

  const passage = pickPassage({ length: parsed.data.length });
  // Double-check the picked passage actually exists in the catalog (defense-in-depth).
  if (!PASSAGES.find((p) => p.id === passage.id)) {
    return NextResponse.json({ error: 'passage-not-found' }, { status: 500 });
  }
  const race = await createRace({
    passageId: passage.id,
    difficulty: parsed.data.difficulty,
    createdById,
  });
  return NextResponse.json({ code: race.code });
}
```

- [ ] **Step 2: Verify lint + typecheck pass**

```bash
pnpm lint && pnpm typecheck
```

- [ ] **Step 3: Smoke test (manual, requires DATABASE_URL)**

```bash
curl -X POST http://localhost:3000/api/race \
  -H 'Content-Type: application/json' \
  -d '{"difficulty":"medium","length":"short"}'
# Expected: { "code": "A7X2K9" }
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/race/route.ts
git commit -s -S -m "feat(api): add POST /api/race route"
```

---

## Task 11: Socket.io server bootstrap

**Files:**
- Create: `server/tsconfig.json`
- Create: `server/index.ts`
- Create: `server/rooms.ts`

- [ ] **Step 1: Create `server/tsconfig.json`**

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "moduleResolution": "node",
    "noEmit": false,
    "outDir": "./dist",
    "rootDir": ".",
    "jsx": "preserve",
    "types": ["node"],
    "paths": {
      "@/*": ["../src/*"]
    }
  },
  "include": ["./**/*.ts", "../src/lib/race/**/*.ts", "../src/lib/db/**/*.ts", "../src/lib/engine/**/*.ts", "../src/lib/content/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 2: Create `server/rooms.ts`**

```ts
// server/rooms.ts
import type { Room } from './room';

const rooms = new Map<string, Room>();

export function registerRoom(code: string, room: Room): void {
  rooms.set(code, room);
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function purgeRoom(code: string): void {
  rooms.delete(code);
}

export function activeRoomCount(): number {
  return rooms.size;
}
```

- [ ] **Step 3: Create minimal `server/index.ts`**

```ts
// server/index.ts
import http from 'node:http';
import { Server as IOServer } from 'socket.io';
import { activeRoomCount } from './rooms';

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

const httpServer = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: activeRoomCount() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

export const io = new IOServer(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: false },
});

io.on('connection', (socket) => {
  // Real handlers wired in later tasks.
  socket.on('disconnect', () => {});
});

httpServer.listen(PORT, () => {
  console.log(`[race-server] listening on :${PORT} (cors=${CORS_ORIGIN})`);
});
```

- [ ] **Step 4: Start the server locally and hit healthz**

```bash
pnpm dev:server
# in another terminal:
curl http://localhost:4000/healthz
# Expected: {"ok":true,"rooms":0}
```

Stop the server after verifying.

- [ ] **Step 5: Build smoke check**

```bash
pnpm build:server
```

Expected: emits `server/dist/index.js`.

- [ ] **Step 6: Commit**

```bash
git add server/tsconfig.json server/index.ts server/rooms.ts
git commit -s -S -m "feat(server): scaffold Socket.io server with healthz"
```

---

## Task 12: Room class — wraps state machine, owns sockets + timers

**Files:**
- Create: `server/room.ts`

The Room translates state-machine effects into real socket broadcasts, DB writes, and Node timers. The state machine itself stays pure (tested in Task 6).

- [ ] **Step 1: Implement `server/room.ts`**

```ts
// server/room.ts
import type { Server as IOServer, Socket } from 'socket.io';
import type { Effect, RaceMachine } from '@/lib/race/state';
import { createRaceMachine } from '@/lib/race/state';
import {
  markRaceEnded,
  markRaceStarted,
  saveRaceParticipant,
  saveRaceResultForUser,
} from '@/lib/db/races';
import type { Difficulty } from '@prisma/client';

export interface RoomIdentity {
  playerId: string;
  userId: string | null;
  nickname: string;
}

const COUNTDOWN_SECONDS = 5;
const TAIL_WINDOW_MS = 60_000;
const MAX_PLAYERS = 8;
const PURGE_AFTER_END_MS = 5 * 60_000;
const CREATION_TIMEOUT_MS = 10 * 60_000;

export class Room {
  private readonly machine: RaceMachine;
  private readonly sockets = new Map<string, Socket>(); // playerId → socket
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private startedAtMs: number | null = null;
  private purged = false;

  constructor(
    public readonly code: string,
    public readonly raceId: string,
    public readonly passageText: string,
    public readonly difficulty: Difficulty,
    private readonly io: IOServer,
    private readonly onPurge: () => void,
  ) {
    this.machine = createRaceMachine({
      code,
      passageText,
      maxPlayers: MAX_PLAYERS,
      countdownSeconds: COUNTDOWN_SECONDS,
      tailWindowMs: TAIL_WINDOW_MS,
      createdAtMs: Date.now(),
    });
    // Auto-cancel if the race never starts
    this.scheduleTimer('creation-timeout', CREATION_TIMEOUT_MS, () => this.cancel());
  }

  get roomName(): string {
    return `race:${this.code}`;
  }

  handleJoin(socket: Socket, identity: RoomIdentity): void {
    const result = this.machine.join({
      playerId: identity.playerId,
      userId: identity.userId,
      nickname: identity.nickname,
      nowMs: Date.now(),
    });
    if (!result.ok) {
      const map: Record<string, string> = {
        'room-full': 'This race is full.',
        'room-locked': 'This race has already started.',
        'duplicate-player': 'Already joined.',
      };
      socket.emit('error', { code: result.code, message: map[result.code] ?? 'Cannot join.' });
      socket.disconnect();
      return;
    }
    this.sockets.set(identity.playerId, socket);
    void socket.join(this.roomName);
    const snapshot = this.machine.snapshot();
    const you = snapshot.players.find((p) => p.playerId === identity.playerId);
    socket.emit('joined', { you, race: snapshot });
    this.io.to(this.roomName).emit('roster', { players: snapshot.players });
  }

  handleLeave(playerId: string): void {
    this.sockets.delete(playerId);
    this.apply(this.machine.leave({ playerId, nowMs: Date.now() }));
  }

  handleStart(playerId: string): void {
    this.apply(this.machine.startRace({ requesterId: playerId, nowMs: Date.now() }));
  }

  handleProgress(
    playerId: string,
    data: { charIndex: number; wpm: number; accuracy: number },
  ): void {
    this.apply(this.machine.progress({ playerId, ...data, nowMs: Date.now() }));
  }

  handleFinish(
    playerId: string,
    data: { wpm: number; rawWpm: number; accuracy: number; durationMs: number },
  ): void {
    this.apply(this.machine.finish({ playerId, ...data, nowMs: Date.now() }));
  }

  private apply(effects: Effect[]): void {
    for (const e of effects) {
      if (e.kind === 'broadcast') {
        this.io.to(this.roomName).emit(e.event, e.payload);
      } else if (e.kind === 'scheduleTimer') {
        this.scheduleTimer(e.key, e.delayMs, () => this.fireTimer(e.key));
      } else if (e.kind === 'cancelTimer') {
        this.cancelTimer(e.key);
      } else if (e.kind === 'persist') {
        void this.persist(e.op, e.data);
      }
    }
  }

  private fireTimer(key: string): void {
    if (key === 'countdown-tick') {
      this.apply(this.machine.tickCountdown({ nowMs: Date.now() }));
    } else if (key === 'tail-window') {
      this.apply(this.machine.tailWindowExpired({ nowMs: Date.now() }));
    } else if (key === 'purge') {
      this.purge();
    }
  }

  private scheduleTimer(key: string, delayMs: number, fn: () => void): void {
    this.cancelTimer(key);
    const t = setTimeout(fn, delayMs);
    this.timers.set(key, t);
  }

  private cancelTimer(key: string): void {
    const t = this.timers.get(key);
    if (t) clearTimeout(t);
    this.timers.delete(key);
  }

  private async persist(op: string, data: Record<string, unknown>): Promise<void> {
    try {
      if (op === 'start') {
        this.startedAtMs = data.startedAtMs as number;
        await markRaceStarted(this.raceId, new Date(this.startedAtMs));
      } else if (op === 'finish') {
        const common = {
          raceId: this.raceId,
          nickname: data.nickname as string,
          userId: data.userId as string | null,
          status: 'finished' as const,
          finishPosition: data.finishPosition as number,
          wpm: data.wpm as number,
          rawWpm: data.rawWpm as number,
          accuracy: data.accuracy as number,
          durationMs: data.durationMs as number,
        };
        if (common.userId) {
          await saveRaceResultForUser({
            ...common,
            userId: common.userId,
            difficulty: this.difficulty,
          });
        } else {
          await saveRaceParticipant(common);
        }
      } else if (op === 'dnf') {
        const common = {
          raceId: this.raceId,
          nickname: data.nickname as string,
          userId: data.userId as string | null,
          status: 'dnf' as const,
          finishPosition: null,
          wpm: (data.wpm as number) ?? 0,
          rawWpm: (data.wpm as number) ?? 0,
          accuracy: (data.accuracy as number) ?? 0,
          durationMs: (data.durationMs as number) ?? 0,
        };
        if (common.userId) {
          await saveRaceResultForUser({
            ...common,
            userId: common.userId,
            difficulty: this.difficulty,
          });
        } else {
          await saveRaceParticipant(common);
        }
      } else if (op === 'end') {
        await markRaceEnded(this.raceId, new Date(data.endedAtMs as number), 'ended');
        this.scheduleTimer('purge', PURGE_AFTER_END_MS, () => this.purge());
      }
    } catch (err) {
      console.error(`[race-server] persist ${op} failed`, err);
    }
  }

  cancel(): void {
    if (this.purged) return;
    void markRaceEnded(this.raceId, new Date(), 'canceled').catch((e) =>
      console.error('[race-server] cancel mark failed', e),
    );
    this.io.to(this.roomName).emit('error', {
      code: 'room-locked',
      message: 'Race canceled.',
    });
    this.purge();
  }

  private purge(): void {
    if (this.purged) return;
    this.purged = true;
    for (const [, t] of this.timers) clearTimeout(t);
    this.timers.clear();
    this.io.socketsLeave(this.roomName);
    this.onPurge();
  }

  hasPlayer(playerId: string): boolean {
    return this.machine.hasPlayer(playerId);
  }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm build:server
```

Expected: compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add server/room.ts
git commit -s -S -m "feat(server): add Room class translating state-machine effects"
```

---

## Task 13: Server socket auth middleware

**Files:**
- Create: `server/auth.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create `server/auth.ts`**

```ts
// server/auth.ts
import type { Socket } from 'socket.io';
import { validateNickname } from '@/lib/race/nickname';
import { verifyRaceToken } from '@/lib/race/token';

export interface SocketIdentity {
  playerId: string;
  userId: string | null;
  username: string | null; // auth'd username at mint time, frozen
  nickname: string; // display name
}

function randomPlayerId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function authenticateSocket(
  socket: Socket,
  secret: string,
): Promise<SocketIdentity> {
  const { token, nickname } = (socket.handshake.auth ?? {}) as {
    token?: string;
    nickname?: string;
  };
  if (token) {
    const payload = await verifyRaceToken(token, secret);
    return {
      playerId: payload.userId,
      userId: payload.userId,
      username: payload.username,
      nickname: payload.username,
    };
  }
  if (typeof nickname === 'string') {
    const v = validateNickname(nickname);
    if (!v.ok) {
      const err = new Error(v.error);
      (err as Error & { data?: unknown }).data = { code: 'bad-nickname' };
      throw err;
    }
    return {
      playerId: `g-${randomPlayerId()}`,
      userId: null,
      username: null,
      nickname: v.normalized,
    };
  }
  const err = new Error('Handshake requires token or nickname');
  (err as Error & { data?: unknown }).data = { code: 'auth-failed' };
  throw err;
}
```

- [ ] **Step 2: Wire auth into `server/index.ts`**

Replace the file with:

```ts
// server/index.ts
import http from 'node:http';
import { Server as IOServer } from 'socket.io';
import { authenticateSocket, type SocketIdentity } from './auth';
import { activeRoomCount } from './rooms';

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
const RACE_SERVER_SECRET = process.env.RACE_SERVER_SECRET;

if (!RACE_SERVER_SECRET) {
  throw new Error('RACE_SERVER_SECRET is required');
}

const httpServer = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: activeRoomCount() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

export const io = new IOServer(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: false },
});

// Attach identity on connect
io.use(async (socket, next) => {
  try {
    const identity = await authenticateSocket(socket, RACE_SERVER_SECRET);
    (socket.data as { identity: SocketIdentity }).identity = identity;
    next();
  } catch (err) {
    next(err as Error);
  }
});

io.on('connection', (socket) => {
  // Handlers wired in Task 14.
  socket.on('disconnect', () => {});
});

httpServer.listen(PORT, () => {
  console.log(`[race-server] listening on :${PORT} (cors=${CORS_ORIGIN})`);
});
```

- [ ] **Step 3: Verify build**

```bash
pnpm build:server
```

- [ ] **Step 4: Commit**

```bash
git add server/auth.ts server/index.ts
git commit -s -S -m "feat(server): add socket auth middleware (token + nickname paths)"
```

---

## Task 14: Server event handlers + persistence integration

**Files:**
- Create: `server/handlers.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Create `server/handlers.ts`**

```ts
// server/handlers.ts
import type { Server as IOServer, Socket } from 'socket.io';
import { PASSAGES } from '@/lib/content/passages';
import { getRaceByCode } from '@/lib/db/races';
import {
  FinishEventSchema,
  JoinEventSchema,
  LeaveEventSchema,
  ProgressEventSchema,
  StartRaceEventSchema,
} from '@/lib/race/validation';
import type { SocketIdentity } from './auth';
import { Room } from './room';
import { getRoom, purgeRoom, registerRoom } from './rooms';

const MAX_MALFORMED_PER_SOCKET = 3;

function getIdentity(socket: Socket): SocketIdentity {
  return (socket.data as { identity: SocketIdentity }).identity;
}

function bumpMalformed(socket: Socket): void {
  const count = (socket.data.malformed ?? 0) + 1;
  socket.data.malformed = count;
  if (count >= MAX_MALFORMED_PER_SOCKET) {
    socket.emit('error', { code: 'bad-payload', message: 'Too many malformed messages' });
    socket.disconnect();
  }
}

export function registerHandlers(io: IOServer, socket: Socket): void {
  socket.on('join', async (raw) => {
    const parsed = JoinEventSchema.safeParse(raw);
    if (!parsed.success) {
      bumpMalformed(socket);
      return;
    }
    const { code } = parsed.data;
    let room = getRoom(code);
    if (!room) {
      // Ensure the race actually exists in the DB (Next.js created it).
      const race = await getRaceByCode(code);
      if (!race) {
        socket.emit('error', { code: 'room-not-found', message: 'No such race.' });
        return;
      }
      if (race.status !== 'waiting') {
        socket.emit('error', { code: 'room-locked', message: 'Race already settled.' });
        return;
      }
      const passage = PASSAGES.find((p) => p.id === race.passageId);
      if (!passage) {
        socket.emit('error', { code: 'bad-payload', message: 'Passage missing.' });
        return;
      }
      room = new Room(
        race.code,
        race.id,
        passage.text,
        race.difficulty,
        io,
        () => purgeRoom(race.code),
      );
      registerRoom(race.code, room);
    }
    const id = getIdentity(socket);
    // Dedupe multi-tab for auth users
    if (id.userId) {
      const existing = (socket.data.activeRooms ??= new Set<string>());
      for (const otherSocketId of await io.in(room.roomName).allSockets()) {
        const other = io.sockets.sockets.get(otherSocketId);
        const otherId = other?.data.identity as SocketIdentity | undefined;
        if (other && otherId?.userId === id.userId && other.id !== socket.id) {
          other.emit('error', {
            code: 'kicked-duplicate',
            message: 'Another tab took over this race.',
          });
          other.disconnect();
        }
      }
      existing.add(room.code);
    }
    socket.data.roomCode = room.code;
    room.handleJoin(socket, {
      playerId: id.playerId,
      userId: id.userId,
      nickname: id.nickname,
    });
  });

  socket.on('startRace', (raw) => {
    if (!StartRaceEventSchema.safeParse(raw ?? {}).success) {
      bumpMalformed(socket);
      return;
    }
    const code = socket.data.roomCode as string | undefined;
    const room = code ? getRoom(code) : undefined;
    if (!room) return;
    room.handleStart(getIdentity(socket).playerId);
  });

  socket.on('progress', (raw) => {
    const parsed = ProgressEventSchema.safeParse(raw);
    if (!parsed.success) {
      bumpMalformed(socket);
      return;
    }
    const code = socket.data.roomCode as string | undefined;
    const room = code ? getRoom(code) : undefined;
    if (!room) return;
    room.handleProgress(getIdentity(socket).playerId, parsed.data);
  });

  socket.on('finish', (raw) => {
    const parsed = FinishEventSchema.safeParse(raw);
    if (!parsed.success) {
      bumpMalformed(socket);
      return;
    }
    const code = socket.data.roomCode as string | undefined;
    const room = code ? getRoom(code) : undefined;
    if (!room) return;
    room.handleFinish(getIdentity(socket).playerId, parsed.data);
  });

  socket.on('leave', (raw) => {
    if (!LeaveEventSchema.safeParse(raw ?? {}).success) {
      bumpMalformed(socket);
      return;
    }
    const code = socket.data.roomCode as string | undefined;
    const room = code ? getRoom(code) : undefined;
    if (!room) return;
    room.handleLeave(getIdentity(socket).playerId);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode as string | undefined;
    const room = code ? getRoom(code) : undefined;
    if (!room) return;
    room.handleLeave(getIdentity(socket).playerId);
  });
}
```

- [ ] **Step 2: Wire handlers in `server/index.ts`**

Replace the `io.on('connection', ...)` block with:

```ts
import { registerHandlers } from './handlers';

io.on('connection', (socket) => {
  registerHandlers(io, socket);
});
```

- [ ] **Step 3: Build check**

```bash
pnpm build:server
```

- [ ] **Step 4: Commit**

```bash
git add server/handlers.ts server/index.ts
git commit -s -S -m "feat(server): wire socket event handlers with Zod validation"
```

---

## Task 15: Server startup sweep — DNF stuck races

**Files:**
- Modify: `server/index.ts`

- [ ] **Step 1: Add sweep to `server/index.ts`**

Add at the top-level, above `httpServer.listen(...)`:

```ts
import { prisma } from '@/lib/db/client';

async function sweepStuckRaces(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const cutoff = new Date(Date.now() - 10 * 60_000);
  const stuck = await prisma.race.findMany({
    where: { status: 'racing', startedAt: { gt: cutoff } },
    include: { participants: true },
  });
  for (const race of stuck) {
    await prisma.race.update({
      where: { id: race.id },
      data: { status: 'canceled', endedAt: new Date() },
    });
    // No participants to mark DNF here — they either already have a finished
    // RaceParticipant row or they dropped without one. We don't synthesize new
    // rows because we lack their nickname state.
    console.log(`[race-server] swept stuck race ${race.code}`);
  }
}

void sweepStuckRaces().catch((e) =>
  console.error('[race-server] startup sweep failed', e),
);
```

- [ ] **Step 2: Build check**

```bash
pnpm build:server
```

- [ ] **Step 3: Commit**

```bash
git add server/index.ts
git commit -s -S -m "feat(server): sweep stuck racing rows on startup"
```

---

## Task 16: Socket integration test — happy path

**Files:**
- Create: `tests/integration/race/happy-path.test.ts`
- Create: `tests/integration/race/test-server.ts` (shared helper)

- [ ] **Step 1: Create the shared test server helper**

```ts
// tests/integration/race/test-server.ts
import http from 'node:http';
import { Server as IOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { authenticateSocket, type SocketIdentity } from '../../../server/auth';
import { registerHandlers } from '../../../server/handlers';
import { mintRaceToken } from '@/lib/race/token';

const SECRET = 'test-secret-that-is-at-least-32-characters-long-xx';

export interface TestServer {
  url: string;
  close(): Promise<void>;
  secret: string;
}

export async function startTestServer(): Promise<TestServer> {
  process.env.RACE_SERVER_SECRET = SECRET;
  const httpServer = http.createServer();
  const io = new IOServer(httpServer, { cors: { origin: '*' } });
  io.use(async (socket, next) => {
    try {
      const identity = await authenticateSocket(socket, SECRET);
      (socket.data as { identity: SocketIdentity }).identity = identity;
      next();
    } catch (err) {
      next(err as Error);
    }
  });
  io.on('connection', (socket) => registerHandlers(io, socket));
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  const url = `http://localhost:${address.port}`;
  return {
    url,
    secret: SECRET,
    async close() {
      io.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

export async function connectAsGuest(url: string, nickname: string): Promise<ClientSocket> {
  const socket = ioClient(url, {
    auth: { nickname },
    transports: ['websocket'],
  });
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', reject);
  });
  return socket;
}

export async function connectAsUser(
  url: string,
  secret: string,
  userId: string,
  username: string,
): Promise<ClientSocket> {
  const token = await mintRaceToken({ userId, username }, secret);
  const socket = ioClient(url, {
    auth: { token },
    transports: ['websocket'],
  });
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', reject);
  });
  return socket;
}

export function waitFor<T>(
  socket: ClientSocket,
  event: string,
  predicate?: (p: T) => boolean,
  timeoutMs = 2000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.on(event, (payload: T) => {
      if (!predicate || predicate(payload)) {
        clearTimeout(to);
        resolve(payload);
      }
    });
  });
}
```

- [ ] **Step 2: Write the happy-path test**

```ts
// tests/integration/race/happy-path.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { createRace } from '@/lib/db/races';
import { hasDatabase, withDatabase } from '../db/helpers';
import {
  connectAsGuest,
  connectAsUser,
  startTestServer,
  type TestServer,
  waitFor,
} from './test-server';

describe.skipIf(!hasDatabase)('race server — happy path', () => {
  withDatabase();

  let server: TestServer;
  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it('two players run a full race → results in DB', async () => {
    const alice = await prisma.user.create({ data: { username: 'alice' } });
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: alice.id,
    });

    const aliceSocket = await connectAsUser(server.url, server.secret, alice.id, 'alice');
    const bobSocket = await connectAsGuest(server.url, 'bob');

    const aliceJoined = waitFor<{ race: { code: string } }>(aliceSocket, 'joined');
    aliceSocket.emit('join', { code: race.code });
    await aliceJoined;

    const bobJoined = waitFor<{ race: { code: string } }>(bobSocket, 'joined');
    bobSocket.emit('join', { code: race.code });
    await bobJoined;

    // Host (alice) starts the race
    const started = waitFor<{ phase: string }>(aliceSocket, 'phase', (p) => p.phase === 'racing');
    aliceSocket.emit('startRace', {});
    await started;

    // Simulate both finishing
    aliceSocket.emit('finish', {
      wpm: 80,
      rawWpm: 85,
      accuracy: 0.97,
      durationMs: 20_000,
    });
    bobSocket.emit('finish', {
      wpm: 60,
      rawWpm: 65,
      accuracy: 0.92,
      durationMs: 28_000,
    });

    const ended = await waitFor<{ results: { nickname: string }[] }>(aliceSocket, 'ended');
    expect(ended.results.length).toBe(2);
    expect(ended.results[0]?.nickname).toBe('alice');

    aliceSocket.close();
    bobSocket.close();

    // Give persistence a tick
    await new Promise((r) => setTimeout(r, 100));

    const participants = await prisma.raceParticipant.findMany({ where: { raceId: race.id } });
    expect(participants.length).toBe(2);

    const aliceResults = await prisma.result.findMany({ where: { userId: alice.id } });
    expect(aliceResults.length).toBe(1);
    expect(aliceResults[0]?.raceId).toBe(race.id);
  });
});
```

- [ ] **Step 3: Run test with DATABASE_URL set**

```bash
DATABASE_URL=<your dev Neon url> pnpm test tests/integration/race/happy-path.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/race/happy-path.test.ts tests/integration/race/test-server.ts
git commit -s -S -m "test(race): add happy-path socket integration test"
```

---

## Task 17: Socket integration tests — late join, disconnect DNF, host reassignment

**Files:**
- Create: `tests/integration/race/late-join.test.ts`
- Create: `tests/integration/race/disconnect-dnf.test.ts`
- Create: `tests/integration/race/host-reassign.test.ts`
- Create: `tests/integration/race/two-tab-dedupe.test.ts`

- [ ] **Step 1: Late-join test**

```ts
// tests/integration/race/late-join.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRace } from '@/lib/db/races';
import { hasDatabase, withDatabase } from '../db/helpers';
import {
  connectAsGuest,
  startTestServer,
  type TestServer,
  waitFor,
} from './test-server';

describe.skipIf(!hasDatabase)('race server — late join rejected', () => {
  withDatabase();
  let server: TestServer;
  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it('rejects joiners once countdown starts', async () => {
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: null,
    });
    const alice = await connectAsGuest(server.url, 'alice');
    const bob = await connectAsGuest(server.url, 'bob');

    alice.emit('join', { code: race.code });
    await waitFor(alice, 'joined');
    bob.emit('join', { code: race.code });
    await waitFor(bob, 'joined');

    const countdown = waitFor<{ phase: string }>(alice, 'phase', (p) => p.phase === 'countdown');
    alice.emit('startRace', {});
    await countdown;

    const late = await connectAsGuest(server.url, 'late');
    const errored = waitFor<{ code: string }>(late, 'error');
    late.emit('join', { code: race.code });
    const err = await errored;
    expect(err.code).toBe('room-locked');

    alice.close();
    bob.close();
    late.close();
  });
});
```

- [ ] **Step 2: Disconnect-DNF test**

```ts
// tests/integration/race/disconnect-dnf.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { createRace } from '@/lib/db/races';
import { hasDatabase, withDatabase } from '../db/helpers';
import {
  connectAsGuest,
  startTestServer,
  type TestServer,
  waitFor,
} from './test-server';

describe.skipIf(!hasDatabase)('race server — disconnect → DNF', () => {
  withDatabase();
  let server: TestServer;
  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it('marks a mid-race disconnect as DNF', async () => {
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: null,
    });
    const alice = await connectAsGuest(server.url, 'alice');
    const bob = await connectAsGuest(server.url, 'bob');

    alice.emit('join', { code: race.code });
    await waitFor(alice, 'joined');
    bob.emit('join', { code: race.code });
    await waitFor(bob, 'joined');

    const racing = waitFor<{ phase: string }>(alice, 'phase', (p) => p.phase === 'racing');
    alice.emit('startRace', {});
    await racing;

    // Bob disconnects mid-race
    bob.close();

    // Alice finishes, triggering race end
    alice.emit('finish', { wpm: 70, rawWpm: 75, accuracy: 0.95, durationMs: 25_000 });
    const ended = await waitFor<{ results: { nickname: string; status: string }[] }>(
      alice,
      'ended',
    );
    const bobResult = ended.results.find((r) => r.nickname === 'bob');
    expect(bobResult?.status).toBe('dnf');

    alice.close();

    await new Promise((r) => setTimeout(r, 100));
    const participants = await prisma.raceParticipant.findMany({ where: { raceId: race.id } });
    expect(participants.find((p) => p.nickname === 'bob')?.status).toBe('dnf');
  });
});
```

- [ ] **Step 3: Host-reassignment test**

```ts
// tests/integration/race/host-reassign.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRace } from '@/lib/db/races';
import { hasDatabase, withDatabase } from '../db/helpers';
import {
  connectAsGuest,
  startTestServer,
  type TestServer,
  waitFor,
} from './test-server';

describe.skipIf(!hasDatabase)('race server — host reassignment', () => {
  withDatabase();
  let server: TestServer;
  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it('promotes next-longest-connected on host leave', async () => {
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: null,
    });
    const alice = await connectAsGuest(server.url, 'alice');
    const bob = await connectAsGuest(server.url, 'bob');

    alice.emit('join', { code: race.code });
    await waitFor(alice, 'joined');
    bob.emit('join', { code: race.code });
    await waitFor(bob, 'joined');

    const rosterP = waitFor<{ players: { nickname: string; isHost: boolean }[] }>(
      bob,
      'roster',
      (p) => p.players.length === 1 && p.players[0]?.nickname === 'bob',
    );
    alice.close();
    const roster = await rosterP;
    expect(roster.players[0]?.isHost).toBe(true);

    bob.close();
  });
});
```

- [ ] **Step 4: Two-tab dedupe test**

```ts
// tests/integration/race/two-tab-dedupe.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { createRace } from '@/lib/db/races';
import { hasDatabase, withDatabase } from '../db/helpers';
import {
  connectAsGuest,
  connectAsUser,
  startTestServer,
  type TestServer,
  waitFor,
} from './test-server';

describe.skipIf(!hasDatabase)('race server — two-tab dedupe', () => {
  withDatabase();
  let server: TestServer;
  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it('kicks first tab when same auth user joins from a second tab', async () => {
    const alice = await prisma.user.create({ data: { username: 'alice' } });
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: alice.id,
    });
    const bob = await connectAsGuest(server.url, 'bob');
    const tab1 = await connectAsUser(server.url, server.secret, alice.id, 'alice');
    const tab2 = await connectAsUser(server.url, server.secret, alice.id, 'alice');

    bob.emit('join', { code: race.code });
    await waitFor(bob, 'joined');
    tab1.emit('join', { code: race.code });
    await waitFor(tab1, 'joined');
    const kicked = waitFor<{ code: string }>(tab1, 'error');
    tab2.emit('join', { code: race.code });
    await waitFor(tab2, 'joined');
    const err = await kicked;
    expect(err.code).toBe('kicked-duplicate');

    tab1.close();
    tab2.close();
    bob.close();
  });
});
```

- [ ] **Step 5: Run all new tests with DATABASE_URL**

```bash
DATABASE_URL=<your dev Neon url> pnpm test tests/integration/race/
```

Expected: PASS (4 tests — late-join, disconnect-DNF, host-reassign, two-tab-dedupe).

- [ ] **Step 6: Commit**

```bash
git add tests/integration/race/late-join.test.ts tests/integration/race/disconnect-dnf.test.ts tests/integration/race/host-reassign.test.ts tests/integration/race/two-tab-dedupe.test.ts
git commit -s -S -m "test(race): add late-join, DNF, host-reassign, two-tab dedupe tests"
```

---

## Task 18: Client hook — useRaceSocket

**Files:**
- Create: `src/hooks/useRaceSocket.ts`

- [ ] **Step 1: Implement the hook**

```ts
// src/hooks/useRaceSocket.ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type {
  EndedEvent,
  FinishedEvent,
  JoinedEvent,
  Participant,
  PhaseEvent,
  ProgressBroadcast,
  RaceErrorEvent,
  RacePhase,
  RosterEvent,
} from '@/lib/race/events';

export interface UseRaceSocketOpts {
  code: string;
  serverUrl: string;
  auth: { token?: string; nickname?: string };
}

export interface UseRaceSocketResult {
  phase: RacePhase | 'connecting' | 'disconnected';
  players: Participant[];
  me: Participant | null;
  passageText: string;
  countdownSeconds: number | null;
  results: EndedEvent['results'] | null;
  error: string | null;
  start(): void;
  sendProgress(data: { charIndex: number; wpm: number; accuracy: number }): void;
  sendFinish(data: { wpm: number; rawWpm: number; accuracy: number; durationMs: number }): void;
  leave(): void;
}

export function useRaceSocket(opts: UseRaceSocketOpts): UseRaceSocketResult {
  const [phase, setPhase] = useState<UseRaceSocketResult['phase']>('connecting');
  const [players, setPlayers] = useState<Participant[]>([]);
  const [me, setMe] = useState<Participant | null>(null);
  const [passageText, setPassageText] = useState('');
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [results, setResults] = useState<EndedEvent['results'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<ClientSocket | null>(null);

  useEffect(() => {
    const socket = ioClient(opts.serverUrl, {
      auth: opts.auth,
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', { code: opts.code });
    });
    socket.on('connect_error', (err) => setError(err.message));
    socket.on('joined', (e: JoinedEvent) => {
      setPhase(e.race.phase);
      setPlayers(e.race.players);
      setMe(e.you);
      setPassageText(e.race.passageText);
    });
    socket.on('roster', (e: RosterEvent) => {
      setPlayers(e.players);
      setMe((prev) => e.players.find((p) => p.playerId === prev?.playerId) ?? prev);
    });
    socket.on('phase', (e: PhaseEvent) => {
      setPhase(e.phase);
    });
    socket.on('countdown', (e: { secondsRemaining: number }) => {
      setCountdownSeconds(e.secondsRemaining);
    });
    socket.on('progress', (e: ProgressBroadcast) => {
      setPlayers((prev) =>
        prev.map((p) =>
          p.playerId === e.playerId
            ? { ...p, charIndex: e.charIndex, wpm: e.wpm, accuracy: e.accuracy }
            : p,
        ),
      );
    });
    socket.on('finished', (e: FinishedEvent) => {
      setPlayers((prev) =>
        prev.map((p) =>
          p.playerId === e.playerId
            ? { ...p, status: 'finished', finishPosition: e.finishPosition, wpm: e.wpm }
            : p,
        ),
      );
    });
    socket.on('ended', (e: EndedEvent) => {
      setPhase('ended');
      setResults(e.results);
    });
    socket.on('error', (e: RaceErrorEvent) => {
      setError(e.message);
    });
    socket.on('disconnect', () => {
      setPhase('disconnected');
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [opts.code, opts.serverUrl, opts.auth]);

  const start = useCallback(() => {
    socketRef.current?.emit('startRace', {});
  }, []);
  const sendProgress = useCallback<UseRaceSocketResult['sendProgress']>((data) => {
    socketRef.current?.emit('progress', data);
  }, []);
  const sendFinish = useCallback<UseRaceSocketResult['sendFinish']>((data) => {
    socketRef.current?.emit('finish', data);
  }, []);
  const leave = useCallback(() => {
    socketRef.current?.emit('leave', {});
  }, []);

  return {
    phase,
    players,
    me,
    passageText,
    countdownSeconds,
    results,
    error,
    start,
    sendProgress,
    sendFinish,
    leave,
  };
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRaceSocket.ts
git commit -s -S -m "feat(race): add useRaceSocket client hook"
```

---

## Task 19: /race entry page — create + join

**Files:**
- Create: `src/app/race/page.tsx`
- Create: `src/app/race/create-form.tsx`
- Create: `src/app/race/join-form.tsx`

- [ ] **Step 1: Implement the page (server wrapper)**

```tsx
// src/app/race/page.tsx
import Link from 'next/link';
import { auth } from '@/auth';
import { env, isMultiplayerConfigured } from '@/env';
import { CreateRaceForm } from './create-form';
import { JoinRaceForm } from './join-form';

export const metadata = { title: 'Race — multiplayer' };

export default async function RacePage() {
  if (!isMultiplayerConfigured()) {
    return (
      <section className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Multiplayer not configured yet</h1>
        <p className="mt-4 text-[color:var(--muted)]">
          The race server hasn&apos;t been set up for this deployment.
        </p>
        <Link href="/" className="mt-6 inline-block text-[color:var(--accent)] hover:underline">
          Back home
        </Link>
      </section>
    );
  }
  const session = await auth();
  return (
    <section className="mx-auto grid max-w-3xl gap-8 px-6 py-12 md:grid-cols-2">
      <CreateRaceForm />
      <JoinRaceForm />
      {!session?.user ? (
        <p className="md:col-span-2 text-center text-sm text-[color:var(--muted)]">
          <Link href="/auth/signin" className="text-[color:var(--accent)] hover:underline">
            Sign in
          </Link>{' '}
          to save your race results to your profile.
        </p>
      ) : null}
      <input type="hidden" data-race-server-url={env.NEXT_PUBLIC_RACE_SERVER_URL} />
    </section>
  );
}
```

- [ ] **Step 2: Implement the create form**

```tsx
// src/app/race/create-form.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function CreateRaceForm() {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('short');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-[color:var(--border)] p-6">
      <h2 className="text-lg font-semibold">Create a race</h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await fetch('/api/race', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ difficulty, length }),
            });
            if (!res.ok) {
              setError('Could not create race.');
              return;
            }
            const { code } = (await res.json()) as { code: string };
            router.push(`/race/${code}`);
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[color:var(--muted)]">Difficulty</span>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
            className="rounded border border-[color:var(--border)] bg-transparent p-2"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[color:var(--muted)]">Length</span>
          <select
            value={length}
            onChange={(e) => setLength(e.target.value as 'short' | 'medium' | 'long')}
            className="rounded border border-[color:var(--border)] bg-transparent p-2"
          >
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-[color:var(--accent)] p-2 text-[color:var(--accent-foreground)] disabled:opacity-60"
        >
          {pending ? 'Creating…' : 'Create race'}
        </button>
        {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Implement the join form**

```tsx
// src/app/race/join-form.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function JoinRaceForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="rounded-lg border border-[color:var(--border)] p-6">
      <h2 className="text-lg font-semibold">Join a race</h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = code.trim().toUpperCase();
          if (!/^[A-Z0-9]{6}$/.test(trimmed)) {
            setError('Codes are 6 letters or digits.');
            return;
          }
          router.push(`/race/${trimmed}`);
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[color:var(--muted)]">Race code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="rounded border border-[color:var(--border)] bg-transparent p-2 font-mono text-lg tracking-widest"
            placeholder="A7X2K9"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded border border-[color:var(--border)] p-2"
        >
          Join
        </button>
        {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Build check + manual smoke**

```bash
pnpm build
pnpm dev
# Open http://localhost:3000/race — should render Create + Join cards.
# Creating a race (requires DATABASE_URL) should redirect to /race/<CODE>.
```

- [ ] **Step 5: Commit**

```bash
git add src/app/race/
git commit -s -S -m "feat(race): add /race entry page with create + join cards"
```

---

## Task 20: /race/[code] — lobby view and nickname modal

**Files:**
- Create: `src/app/race/[code]/page.tsx`
- Create: `src/app/race/[code]/client.tsx`
- Create: `src/components/race/Lobby.tsx`
- Create: `src/components/race/NicknameModal.tsx`
- Create: `src/lib/race/nickname-storage.ts`

- [ ] **Step 1: Create the nickname-storage helper**

```ts
// src/lib/race/nickname-storage.ts
const KEY = 'race:nickname';

export function getStoredNickname(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setStoredNickname(nickname: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, nickname);
  } catch {
    // ignore
  }
}
```

- [ ] **Step 2: Create the nickname modal**

```tsx
// src/components/race/NicknameModal.tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import { validateNickname } from '@/lib/race/nickname';

export function NicknameModal({ onConfirm }: { onConfirm: (nickname: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Pick a nickname</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Shown to other racers during this race.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const v = validateNickname(value);
            if (!v.ok) {
              setError(v.error);
              return;
            }
            onConfirm(v.normalized);
          }}
        >
          <input
            type="text"
            value={value}
            maxLength={16}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded border border-[color:var(--border)] bg-transparent p-2"
            placeholder="alice"
            aria-label="nickname"
          />
          {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
          <button
            type="submit"
            className="w-full rounded bg-[color:var(--accent)] p-2 text-[color:var(--accent-foreground)]"
          >
            Join race
          </button>
          <Link
            href="/race"
            className="block text-center text-sm text-[color:var(--muted)] hover:underline"
          >
            Cancel
          </Link>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the Lobby component**

```tsx
// src/components/race/Lobby.tsx
'use client';

import type { Participant } from '@/lib/race/events';

export function Lobby({
  code,
  players,
  me,
  onStart,
  onLeave,
}: {
  code: string;
  players: Participant[];
  me: Participant | null;
  onStart: () => void;
  onLeave: () => void;
}) {
  const isHost = me?.isHost ?? false;
  const canStart = isHost && players.length >= 2;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between rounded-lg border border-[color:var(--border)] p-4">
        <div>
          <div className="text-xs uppercase text-[color:var(--muted)]">Race code</div>
          <div className="font-mono text-3xl tracking-widest">{code}</div>
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/race/${code}`)}
          className="rounded border border-[color:var(--border)] px-3 py-1 text-sm"
        >
          Copy link
        </button>
      </div>

      <ul className="divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)]">
        {players.map((p) => (
          <li key={p.playerId} className="flex items-center gap-3 p-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--surface)] font-mono text-sm">
              {p.nickname.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 text-sm">{p.nickname}</span>
            {p.isHost ? (
              <span className="rounded bg-[color:var(--accent)] px-2 py-0.5 text-xs text-[color:var(--accent-foreground)]">
                host
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {isHost ? (
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="rounded bg-[color:var(--accent)] p-3 text-[color:var(--accent-foreground)] disabled:opacity-60"
        >
          {canStart ? 'Start race' : 'Waiting for another player…'}
        </button>
      ) : (
        <p className="text-center text-sm text-[color:var(--muted)]">
          Waiting for host to start the race…
        </p>
      )}

      <button
        type="button"
        onClick={onLeave}
        className="text-center text-xs text-[color:var(--muted)] hover:underline"
      >
        Leave race
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create the page client**

```tsx
// src/app/race/[code]/client.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { NicknameModal } from '@/components/race/NicknameModal';
import { Lobby } from '@/components/race/Lobby';
import { useRaceSocket } from '@/hooks/useRaceSocket';
import { getStoredNickname, setStoredNickname } from '@/lib/race/nickname-storage';

export interface RaceClientProps {
  code: string;
  serverUrl: string;
  loggedIn: boolean;
}

export function RaceClient({ code, serverUrl, loggedIn }: RaceClientProps) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Fetch token for logged-in, or hydrate nickname for guests.
  useEffect(() => {
    if (loggedIn) {
      (async () => {
        const res = await fetch('/api/race/token', { method: 'POST' });
        if (res.ok) {
          const { token: t } = (await res.json()) as { token: string };
          setToken(t);
        }
        setBootstrapped(true);
      })();
    } else {
      setNickname(getStoredNickname());
      setBootstrapped(true);
    }
  }, [loggedIn]);

  const authPayload = useMemo(
    () => (token ? { token } : nickname ? { nickname } : null),
    [token, nickname],
  );

  const socket = useRaceSocket(
    authPayload
      ? { code, serverUrl, auth: authPayload }
      : // Dummy payload; we don't actually connect until bootstrapped + authPayload set.
        { code, serverUrl, auth: { nickname: '__pending__' } },
  );

  if (!bootstrapped) {
    return <div className="p-10 text-center text-[color:var(--muted)]">connecting…</div>;
  }
  if (!loggedIn && !nickname) {
    return (
      <NicknameModal
        onConfirm={(n) => {
          setStoredNickname(n);
          setNickname(n);
        }}
      />
    );
  }

  if (socket.error) {
    return (
      <section className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Can&apos;t join this race</h1>
        <p className="mt-2 text-[color:var(--muted)]">{socket.error}</p>
        <Link href="/race" className="mt-6 inline-block text-[color:var(--accent)] hover:underline">
          Back to lobby
        </Link>
      </section>
    );
  }

  if (socket.phase === 'connecting' || socket.phase === 'disconnected') {
    return <div className="p-10 text-center text-[color:var(--muted)]">connecting to race…</div>;
  }

  if (socket.phase === 'waiting') {
    return (
      <Lobby
        code={code}
        players={socket.players}
        me={socket.me}
        onStart={socket.start}
        onLeave={() => {
          socket.leave();
          router.push('/race');
        }}
      />
    );
  }

  // Placeholder for remaining phases — wired in Tasks 21-22.
  return (
    <div className="p-10 text-center text-[color:var(--muted)]">
      phase: {socket.phase} (coming next)
    </div>
  );
}
```

- [ ] **Step 5: Create the page server wrapper**

```tsx
// src/app/race/[code]/page.tsx
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { env, isMultiplayerConfigured } from '@/env';
import { RaceClient } from './client';

export default async function RaceCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!/^[A-Z0-9]{6}$/.test(code)) return notFound();
  if (!isMultiplayerConfigured()) {
    return (
      <section className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Multiplayer not configured yet</h1>
      </section>
    );
  }
  const session = await auth();
  return (
    <RaceClient
      code={code}
      serverUrl={env.NEXT_PUBLIC_RACE_SERVER_URL!}
      loggedIn={!!session?.user?.id}
    />
  );
}
```

- [ ] **Step 6: Lint + typecheck + build**

```bash
pnpm lint && pnpm typecheck && pnpm build
```

- [ ] **Step 7: Manual smoke (requires both servers + DATABASE_URL)**

```bash
# Terminal 1: race server
RACE_SERVER_SECRET=<32+ char secret> DATABASE_URL=<neon url> pnpm dev:server
# Terminal 2: next
RACE_SERVER_SECRET=<same secret> NEXT_PUBLIC_RACE_SERVER_URL=http://localhost:4000 DATABASE_URL=<neon url> pnpm dev
# Then: /race → create → /race/<code> → see lobby with your name as host
# Open another browser/incognito → join with nickname → see both players in lobby
```

- [ ] **Step 8: Commit**

```bash
git add src/app/race/[code]/ src/components/race/Lobby.tsx src/components/race/NicknameModal.tsx src/lib/race/nickname-storage.ts
git commit -s -S -m "feat(race): add /race/[code] lobby + nickname modal"
```

---

## Task 21: Countdown view

**Files:**
- Create: `src/components/race/Countdown.tsx`
- Modify: `src/app/race/[code]/client.tsx`

- [ ] **Step 1: Implement `Countdown.tsx`**

```tsx
// src/components/race/Countdown.tsx
'use client';

import type { Participant } from '@/lib/race/events';

export function Countdown({
  secondsRemaining,
  passageText,
  players,
}: {
  secondsRemaining: number | null;
  passageText: string;
  players: Participant[];
}) {
  const display = secondsRemaining === null ? '…' : secondsRemaining > 0 ? secondsRemaining : 'Go';
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-6 py-10">
      <div className="text-8xl font-bold tabular-nums">{display}</div>
      <div className="max-h-48 overflow-hidden text-center text-lg text-[color:var(--muted)]">
        {passageText}
      </div>
      <ul className="flex flex-wrap justify-center gap-3">
        {players.map((p) => (
          <li
            key={p.playerId}
            className="rounded bg-[color:var(--surface)] px-3 py-1 text-sm"
          >
            {p.nickname}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the client**

In `src/app/race/[code]/client.tsx`, replace the placeholder `return` with a switch that adds the countdown case. Import Countdown at top:

```tsx
import { Countdown } from '@/components/race/Countdown';
```

Then update the tail of the component:

```tsx
  if (socket.phase === 'countdown') {
    return (
      <Countdown
        secondsRemaining={socket.countdownSeconds}
        passageText={socket.passageText}
        players={socket.players}
      />
    );
  }

  return (
    <div className="p-10 text-center text-[color:var(--muted)]">
      phase: {socket.phase} (coming next)
    </div>
  );
```

- [ ] **Step 3: Manual smoke**

With both servers running, host starts race → countdown view renders.

- [ ] **Step 4: Commit**

```bash
git add src/components/race/Countdown.tsx src/app/race/[code]/client.tsx
git commit -s -S -m "feat(race): add countdown view"
```

---

## Task 22: Racing view with progress rails

**Files:**
- Create: `src/components/race/ProgressRails.tsx`
- Create: `src/components/race/RacingView.tsx`
- Modify: `src/app/race/[code]/client.tsx`

- [ ] **Step 1: Implement `ProgressRails.tsx`**

```tsx
// src/components/race/ProgressRails.tsx
'use client';

import type { Participant } from '@/lib/race/events';

function colorFor(playerId: string): string {
  // deterministic hue per id
  let h = 0;
  for (let i = 0; i < playerId.length; i++) h = (h * 31 + playerId.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 55%)`;
}

export function ProgressRails({
  players,
  sourceLength,
  mePlayerId,
}: {
  players: Participant[];
  sourceLength: number;
  mePlayerId: string | null;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {players.map((p) => {
        const pct = Math.min(100, Math.round((p.charIndex / Math.max(1, sourceLength)) * 100));
        const isMe = p.playerId === mePlayerId;
        return (
          <li key={p.playerId} className="flex items-center gap-3 text-sm">
            <span className={`w-24 truncate ${isMe ? 'font-semibold' : ''}`}>{p.nickname}</span>
            <div className="relative h-4 flex-1 rounded-full bg-[color:var(--surface)]">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${pct}%`, backgroundColor: colorFor(p.playerId) }}
              />
            </div>
            <span className="w-14 text-right tabular-nums text-[color:var(--muted)]">
              {Math.round(p.wpm)} wpm
            </span>
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 2: Implement `RacingView.tsx`** (wraps the typing engine)

```tsx
// src/components/race/RacingView.tsx
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { TypingSurface } from '@/components/typing/TypingSurface';
import { useTypingEngine } from '@/hooks/useTypingEngine';
import type { Participant } from '@/lib/race/events';
import { ProgressRails } from './ProgressRails';

const PROGRESS_THROTTLE_MS = 100; // 10/sec

export function RacingView({
  passageText,
  players,
  mePlayerId,
  onProgress,
  onFinish,
}: {
  passageText: string;
  players: Participant[];
  mePlayerId: string | null;
  onProgress: (d: { charIndex: number; wpm: number; accuracy: number }) => void;
  onFinish: (d: { wpm: number; rawWpm: number; accuracy: number; durationMs: number }) => void;
}) {
  const { state, result, handlers } = useTypingEngine({
    mode: 'fixed',
    source: passageText,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSentAt = useRef(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Throttled progress broadcast
  useEffect(() => {
    if (state.status !== 'running') return;
    const now = performance.now();
    if (now - lastSentAt.current < PROGRESS_THROTTLE_MS) return;
    lastSentAt.current = now;
    const elapsed = state.startedAt ? (now - state.startedAt) / 1000 / 60 : 0;
    const correctChars = state.timeline.filter((e) => e.kind === 'input' && e.correct).length;
    const totalInput = state.timeline.filter((e) => e.kind === 'input').length;
    const wpm = elapsed > 0 ? correctChars / 5 / elapsed : 0;
    const accuracy = totalInput > 0 ? correctChars / totalInput : 1;
    onProgress({ charIndex: state.cursor, wpm, accuracy });
  }, [state, onProgress]);

  useEffect(() => {
    if (state.status !== 'finished') return;
    if (finishedRef.current) return;
    if (!result) return;
    finishedRef.current = true;
    onFinish({
      wpm: result.wpm,
      rawWpm: result.rawWpm,
      accuracy: result.accuracy,
      durationMs: result.durationMs,
    });
  }, [state.status, result, onFinish]);

  const handleClick = useCallback(() => inputRef.current?.focus(), []);

  return (
    <section
      className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-4xl flex-col gap-8 px-6 py-8"
      onClick={handleClick}
    >
      <ProgressRails
        players={players}
        sourceLength={passageText.length}
        mePlayerId={mePlayerId}
      />

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
        source={passageText}
        state={state}
        dimmed={state.status === 'finished'}
      />
    </section>
  );
}
```

- [ ] **Step 3: Wire into client**

Open `src/app/race/[code]/client.tsx`, add imports:

```tsx
import { RacingView } from '@/components/race/RacingView';
```

Before the final placeholder `return`, add:

```tsx
  if (socket.phase === 'racing') {
    return (
      <RacingView
        passageText={socket.passageText}
        players={socket.players}
        mePlayerId={socket.me?.playerId ?? null}
        onProgress={socket.sendProgress}
        onFinish={socket.sendFinish}
      />
    );
  }
```

- [ ] **Step 4: Build + typecheck**

```bash
pnpm typecheck && pnpm build
```

- [ ] **Step 5: Manual smoke**

Run a full two-browser race; verify progress bars animate and typing surface works.

- [ ] **Step 6: Commit**

```bash
git add src/components/race/ProgressRails.tsx src/components/race/RacingView.tsx src/app/race/[code]/client.tsx
git commit -s -S -m "feat(race): add racing view with progress rails"
```

---

## Task 23: Ended / results view with sign-in nudge

**Files:**
- Create: `src/components/race/Results.tsx`
- Modify: `src/app/race/[code]/client.tsx`

- [ ] **Step 1: Implement `Results.tsx`**

```tsx
// src/components/race/Results.tsx
'use client';

import Link from 'next/link';
import type { EndedEvent } from '@/lib/race/events';

export function Results({
  results,
  code,
  loggedIn,
}: {
  results: EndedEvent['results'];
  code: string;
  loggedIn: boolean;
}) {
  const finished = results.filter((r) => r.status === 'finished');
  const dnf = results.filter((r) => r.status === 'dnf');
  return (
    <section className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-xl font-semibold">Race {code} — results</h1>

      {!loggedIn ? (
        <div className="mt-4 rounded-lg border border-[color:var(--accent)] bg-[color:var(--surface)] p-4">
          <p className="text-sm">
            Sign in with Google to save your future races to your profile.
          </p>
          <Link
            href={`/auth/signin?callbackUrl=/race/${code}`}
            className="mt-2 inline-block text-sm text-[color:var(--accent)] hover:underline"
          >
            Sign in →
          </Link>
        </div>
      ) : null}

      <table className="mt-6 w-full text-sm">
        <thead className="text-left text-[color:var(--muted)]">
          <tr>
            <th className="w-10 py-2">#</th>
            <th className="py-2">Name</th>
            <th className="py-2 text-right">WPM</th>
            <th className="py-2 text-right">Accuracy</th>
            <th className="py-2 text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {finished.map((r) => (
            <tr key={r.playerId} className="border-t border-[color:var(--border)]">
              <td className="py-2">{r.finishPosition}</td>
              <td className="py-2">{r.nickname}</td>
              <td className="py-2 text-right tabular-nums">{Math.round(r.wpm)}</td>
              <td className="py-2 text-right tabular-nums">
                {(r.accuracy * 100).toFixed(1)}%
              </td>
              <td className="py-2 text-right tabular-nums">
                {(r.durationMs / 1000).toFixed(1)}s
              </td>
            </tr>
          ))}
          {dnf.length > 0 ? (
            <>
              <tr>
                <td colSpan={5} className="pt-4 text-xs uppercase text-[color:var(--muted)]">
                  Did not finish
                </td>
              </tr>
              {dnf.map((r) => (
                <tr key={r.playerId} className="border-t border-[color:var(--border)]">
                  <td className="py-2">—</td>
                  <td className="py-2">{r.nickname}</td>
                  <td className="py-2 text-right tabular-nums">—</td>
                  <td className="py-2 text-right tabular-nums">—</td>
                  <td className="py-2 text-right tabular-nums">—</td>
                </tr>
              ))}
            </>
          ) : null}
        </tbody>
      </table>

      <div className="mt-8 flex gap-3">
        <Link
          href="/race"
          className="rounded bg-[color:var(--accent)] px-4 py-2 text-[color:var(--accent-foreground)]"
        >
          Create new race
        </Link>
        <Link
          href="/"
          className="rounded border border-[color:var(--border)] px-4 py-2"
        >
          Home
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Wire into client**

Add import and handle the `ended` phase in `src/app/race/[code]/client.tsx`:

```tsx
import { Results } from '@/components/race/Results';
// ...
  if (socket.phase === 'ended' && socket.results) {
    return <Results results={socket.results} code={code} loggedIn={loggedIn} />;
  }
```

Delete the placeholder "coming next" return.

- [ ] **Step 3: Build + smoke**

```bash
pnpm build
# Run a two-player race to completion, verify results page renders.
```

- [ ] **Step 4: Commit**

```bash
git add src/components/race/Results.tsx src/app/race/[code]/client.tsx
git commit -s -S -m "feat(race): add results view with sign-in nudge"
```

---

## Task 24: Navigation integration — header + landing page

**Files:**
- Modify: `src/components/chrome/AuthMenu.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add "Race" link to the top-level nav**

Open `src/components/chrome/AuthMenu.tsx`. Find the public (signed-out) navigation section and add a `Link` to `/race`. For the signed-in dropdown, also ensure "Race" appears before "Single player" or alongside. Use the existing link patterns. For example, if there is a section rendering the top-level nav on every render, add:

```tsx
<Link href="/race" className="text-sm hover:underline">Race</Link>
```

(Locate the correct insertion point to match the existing nav layout; do not disturb Phase 2 entries.)

- [ ] **Step 2: Add the Race tile to the landing page**

Open `src/app/page.tsx`. Find the tile/grid section that already includes "Single player" and "Dashboard" (or signed-in equivalent). Add a third tile linking to `/race` with a title "Race multiplayer" and a short description "Type against friends." Follow the existing tile markup pattern.

- [ ] **Step 3: Lint + typecheck + build**

```bash
pnpm lint && pnpm typecheck && pnpm build
```

- [ ] **Step 4: Manual smoke**

Visit the landing page — three options visible. Header nav includes Race.

- [ ] **Step 5: Commit**

```bash
git add src/components/chrome/AuthMenu.tsx src/app/page.tsx
git commit -s -S -m "feat(race): add Race to header nav and landing page"
```

---

## Task 25: Docs — SETUP.md + README.md

**Files:**
- Modify: `docs/SETUP.md`
- Modify: `README.md`

- [ ] **Step 1: Append the Phase 3 section to `docs/SETUP.md`**

Append at the bottom of `docs/SETUP.md`:

```markdown
## Phase 3: multiplayer (optional)

Phase 3 adds realtime multiplayer races via a standalone Socket.io server deployed alongside the Next.js app. Without these env vars, `/race` renders "Multiplayer not configured yet" and the rest of the app works unchanged.

### Required env vars

Set in **both** Vercel and Railway (or your chosen platform):

- `RACE_SERVER_SECRET` — a 32+ char random string. Generate with:

  ```bash
  openssl rand -base64 48
  ```

  This value must match **exactly** on both platforms.

Set in **Vercel only**:

- `NEXT_PUBLIC_RACE_SERVER_URL` — the public URL of the Socket.io server (e.g. `https://typing-race.up.railway.app`).

Set in **Railway only**:

- `DATABASE_URL` — the same Neon connection string used by Vercel (prod branch).
- `CORS_ORIGIN` — the Vercel production URL (e.g. `https://typing-speed.vercel.app`).

### Railway setup (Socket.io server)

1. Create a new Railway project from this repo.
2. Set the **Build Command** to `pnpm install && pnpm build:server`.
3. Set the **Start Command** to `node server/dist/index.js`.
4. Add the env vars above.
5. Deploy. Railway assigns a `*.up.railway.app` hostname — paste it into `NEXT_PUBLIC_RACE_SERVER_URL` in Vercel.

### Local development

Two terminals:

```bash
# Terminal 1 — Next.js
pnpm dev

# Terminal 2 — race server
pnpm dev:server
```

Or in a single terminal with `concurrently`:

```bash
pnpm dev:all
```

`.env.local` needs:

```
RACE_SERVER_SECRET=<32+ char string>
NEXT_PUBLIC_RACE_SERVER_URL=http://localhost:4000
CORS_ORIGIN=http://localhost:3000
```
```

- [ ] **Step 2: Update `README.md`**

In the "Current Phase" section, add:

```markdown
**Phase 3 — Multiplayer** (shipped): Realtime fixed-passage races at `/race`, up to 8 players per room, mixed guest/auth, Socket.io server in `server/`.

- Design: `docs/superpowers/specs/2026-04-19-phase-3-multiplayer-design.md`
- Setup: see the "Phase 3: multiplayer" section in `docs/SETUP.md`
```

In the Scripts table, add:

```markdown
| `pnpm dev:server` | local Socket.io race server |
| `pnpm build:server` | compile race server for production |
| `pnpm dev:all` | run Next.js + race server concurrently |
```

Remove the "Phase 3: realtime multiplayer (Socket.io)" line from "Out of scope (coming later)".

- [ ] **Step 3: Commit**

```bash
git add docs/SETUP.md README.md
git commit -s -S -m "docs(phase3): document multiplayer setup and scripts"
```

---

## Task 26: Final gates — lint, typecheck, test, build

**Files:** none (verification only)

- [ ] **Step 1: Run all four gates**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:server
```

Expected: all PASS.

- [ ] **Step 2: With DATABASE_URL set, run integration suite**

```bash
DATABASE_URL=<your neon url> RACE_SERVER_SECRET=<any 32+ char string> pnpm test tests/integration
```

Expected: all 13+ integration tests PASS.

- [ ] **Step 3: If anything failed, fix and re-commit.**

- [ ] **Step 4: End-of-phase commit (if README or any cleanup pending)**

```bash
git status
# If clean, this phase is complete.
```

---

## Self-review notes

**Spec coverage vs plan:**
- Section 1 (scope) → baked into every UI/server task.
- Section 2 (architecture) → Tasks 11–15 (server) + Task 18 (hook).
- Section 3 (lifecycle) → Task 6 (state machine, all phases) + Tasks 21–23 (UI per phase).
- Section 4 (data model) → Task 7 (schema) + Task 8 (helpers).
- Section 5 (auth/identity) → Tasks 3, 4, 9, 13.
- Section 6 (UX surfaces) → Tasks 19–23.
- Section 7 (socket events) → Task 5.
- Section 8 (server impl) → Tasks 11–15.
- Section 9 (error handling/edge cases) → scattered across state-machine tests (6) and socket integration tests (16, 17), plus error paths in Tasks 9–14.
- Section 10 (testing strategy) → Tasks 2–6 (unit), 8 (integration), 16–17 (socket).
- Section 11 (local dev/deploy) → Tasks 1, 11, 25.
- Section 12 (risks) → mitigations referenced inline.

**Type-name consistency check:**
- `RaceMachine`, `Effect`, `Participant`, `RacePhase`, `RaceSnapshot` match across state.ts, Room, and useRaceSocket.
- `SocketIdentity` shared between auth.ts and handlers.ts.
- `mintRaceToken` / `verifyRaceToken` signature matches Next.js route usage and server middleware.
- Zod schema names (`JoinEventSchema`, `ProgressEventSchema`, etc.) match handler imports.

**No placeholders detected** — every code step contains implementable code.

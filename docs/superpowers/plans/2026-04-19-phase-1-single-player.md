# Phase 1 — Single-Player Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a production-quality single-player typing test with three modes (fixed passage, time, word count), dark theme, bundled content, and a framework-free typing engine that will be reused in Phase 3 multiplayer.

**Architecture:** Next.js 15 App Router front-end. Core typing logic lives in a framework-free TS module (`src/lib/engine/`) that is reused verbatim across phases. A thin React hook wraps the engine for the `/single-player` page. No server routes, no DB, no auth in Phase 1.

**Tech Stack:** Next.js 15, React 19, TypeScript strict, Tailwind CSS v4 (CSS-first config), Biome (lint+format), Vitest + `@testing-library/react` (unit + smoke), Playwright (scaffolded for Phase 4), pnpm. Font: Geist Mono (typing surface) + system stack (chrome).

**Spec:** `docs/superpowers/specs/2026-04-19-phase-1-single-player-design.md`

---

## File Structure

```
src/
├─ app/
│  ├─ layout.tsx              # Root layout, ThemeProvider, global CSS import
│  ├─ page.tsx                # / landing (server component)
│  ├─ single-player/
│  │  └─ page.tsx             # /single-player (client component; owns engine hook)
│  └─ globals.css             # Tailwind v4 + @theme + CSS custom properties
├─ components/
│  ├─ ui/
│  │  ├─ Button.tsx           # <Button variant="primary"|"ghost"> + keyboard focus ring
│  │  └─ Toggle.tsx           # <Toggle pressed onPressedChange> for theme + option cycles
│  ├─ typing/
│  │  ├─ TypingSurface.tsx    # Passage renderer: span-per-char + class states
│  │  ├─ LiveWpm.tsx          # Live WPM + mode-specific secondary (timer / progress)
│  │  ├─ ModeSelector.tsx     # Mode + contextual controls (length/duration/count/difficulty)
│  │  └─ ResultsPanel.tsx     # Post-test stats + Next/Restart/Change-mode buttons
│  └─ chrome/
│     ├─ Header.tsx           # Wordmark + ThemeToggle
│     ├─ Footer.tsx           # Version + ThemeToggle (duplicate) + GitHub placeholder
│     ├─ ThemeToggle.tsx      # Toggles data-theme, persists via storage
│     └─ ThemeProvider.tsx    # Reads storage on mount, sets data-theme attribute
├─ lib/
│  ├─ engine/
│  │  ├─ types.ts             # Mode, Difficulty, EngineConfig, EngineState, KeyEvent, Result
│  │  ├─ metrics.ts           # computeMetrics(state): Result — pure functions
│  │  ├─ engine.ts            # createEngine(config): TypingEngine — pure TS, no React
│  │  └─ index.ts             # Re-exports
│  ├─ content/
│  │  ├─ passages.ts          # export const PASSAGES: Passage[] (60 entries)
│  │  ├─ words.ts             # WORDS_EASY (200) / WORDS_MEDIUM (1000) / WORDS_HARD (3000+)
│  │  └─ select.ts            # pickPassage, pickWords — seeded (mulberry32)
│  └─ storage/
│     └─ config.ts            # loadConfig, saveConfig — localStorage wrapper with fallback
└─ hooks/
   └─ useTypingEngine.ts      # React wrapper: useSyncExternalStore + rAF tick + DOM filters

tests/
├─ unit/
│  ├─ engine/
│  │  ├─ engine.test.ts       # State transitions, input/backspace, end conditions
│  │  └─ metrics.test.ts      # WPM, raw WPM, accuracy, edge cases
│  ├─ content/
│  │  └─ select.test.ts       # Seeded determinism, length filter, count correctness
│  └─ storage/
│     └─ config.test.ts       # Round-trip, corrupt-JSON fallback, partial patch
└─ components/
   ├─ TypingSurface.test.tsx  # Class-per-char rendering smoke
   ├─ ResultsPanel.test.tsx   # Renders given numbers
   └─ ModeSelector.test.tsx   # Dispatches config changes on click

docs/superpowers/
├─ specs/                     # (exists) design specs
└─ plans/                     # (exists) this plan

Root files:
- package.json, pnpm-lock.yaml, tsconfig.json, next.config.ts
- biome.json, vitest.config.ts, playwright.config.ts
- postcss.config.mjs (Tailwind v4 plugin)
- .env.example (empty placeholders for Phase 2+)
- .gitignore (already exists)
```

> **Note on Tailwind v4:** v4 uses CSS-first configuration; there is no `tailwind.config.ts`. Theme tokens live in `src/app/globals.css` using `@theme`. The spec's file tree mentions `tailwind.config.ts`; in v4 that file is unnecessary — follow this plan's tree.

---

## Prerequisites

- Node.js 20+ installed, `pnpm` available (`corepack enable` works).
- All steps run from the repo root `/Users/red/typing-speed`.
- All commits use `git commit -s -S -m "..."` (signed with both `-s` sign-off and `-S` GPG) per `/Users/red/.claude/CLAUDE.md`. No Co-Authored-By / "Generated with" trailers.
- Quality gates at the end: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` — all must pass.

---

## Task 1: Scaffold Next.js + TypeScript + Tailwind v4 + pnpm

**Files created by the scaffolder:**
- `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`
- `postcss.config.mjs`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- `public/` (some default assets; keep or replace favicon)

- [ ] **Step 1: Create Next.js project non-interactively**

The scaffolder creates files in the current directory. Since the repo already has `.git`, `.gitignore`, `README.md`, and `docs/`, we point the scaffolder at the existing folder and let it coexist.

Run:
```bash
pnpm create next-app@latest . --ts --tailwind --app --src-dir --eslint=false --import-alias "@/*" --use-pnpm --turbopack=false --yes
```

Expected: scaffolder creates `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `package.json`. Existing files (`.git`, `.gitignore`, `README.md`, `docs/`) remain untouched.

If the scaffolder complains about non-empty directory, use the `--force` / `--yes` combo it prompts for, or pass through.

- [ ] **Step 2: Verify TypeScript strict mode**

Open `tsconfig.json` — confirm `"strict": true` is present. If not, set it.

- [ ] **Step 3: Verify dev server smoke**

```bash
pnpm dev --port 3100 &
DEV_PID=$!
sleep 4
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3100/
kill $DEV_PID 2>/dev/null || true
```

Expected: `200`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -S -m "chore: scaffold Next.js 15 + TS + Tailwind v4 + pnpm"
```

---

## Task 2: Tooling — Biome, Vitest, Playwright scaffold, scripts

**Files:**
- Create: `biome.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `tests/e2e/.gitkeep`
- Modify: `package.json` — scripts + devDependencies
- Create: `.env.example`

- [ ] **Step 1: Install dev dependencies**

```bash
pnpm add -D @biomejs/biome vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @playwright/test
```

- [ ] **Step 2: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "noNonNullAssertion": "off"
      },
      "suspicious": {
        "noArrayIndexKey": "off"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  },
  "files": {
    "ignore": ["node_modules", ".next", "out", "build", "coverage", ".superpowers"]
  }
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
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

- [ ] **Step 4: Create `tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Create `playwright.config.ts` (scaffold only)**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 6: Create `tests/e2e/.gitkeep`** (empty file so the directory is tracked)

- [ ] **Step 7: Add scripts to `package.json`**

Merge these scripts into the existing `scripts` block:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  }
}
```

Remove the default Next.js `lint` script that uses ESLint if present (we're using Biome instead).

- [ ] **Step 8: Create `.env.example`**

```
# Phase 2+ placeholders (intentionally empty in Phase 1)
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- [ ] **Step 9: Sanity — lint, typecheck, test all run (even if zero tests)**

```bash
pnpm lint || true
pnpm typecheck
pnpm test
```

Expected: `lint` may surface formatting hints but shouldn't error fatally; `typecheck` passes on the scaffold; `test` reports "No test files found" (exit 0 with `--passWithNoTests`? — Vitest's `run` without files exits 0 on modern versions. If it exits non-zero, add `passWithNoTests: true` to `vitest.config.ts` under `test`.)

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -s -S -m "chore: add Biome, Vitest, Playwright scaffold, .env.example"
```

---

## Task 3: Theme tokens and global CSS

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/app/fonts.ts` (Geist Mono via `next/font`)

- [ ] **Step 1: Replace `src/app/globals.css`**

```css
@import 'tailwindcss';

@theme {
  --font-mono: var(--typing-font-mono);
}

:root,
html[data-theme='dark'] {
  --bg: #0d0f12;
  --fg: #e6e8eb;
  --muted: #5a6170;
  --faint: #2a2f38;
  --accent: #6ee7b7;
  --danger: #f87171;
  --success: #34d399;
  --border: #1e232c;
  --surface: #131620;
  color-scheme: dark;
}

html[data-theme='light'] {
  --bg: #fafafa;
  --fg: #111318;
  --muted: #6b7280;
  --faint: #d5d8de;
  --accent: #059669;
  --danger: #dc2626;
  --success: #059669;
  --border: #e5e7eb;
  --surface: #ffffff;
  color-scheme: light;
}

html,
body {
  background: var(--bg);
  color: var(--fg);
}

body {
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  min-height: 100vh;
}

/* Focus rings use --accent */
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}
```

- [ ] **Step 2: Create `src/app/fonts.ts`**

```ts
import { Geist_Mono } from 'next/font/google';

export const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--typing-font-mono',
  display: 'swap',
});
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -s -S -m "feat(ui): add theme tokens, dark/light palettes, Geist Mono"
```

---

## Task 4: Engine types

**Files:**
- Create: `src/lib/engine/types.ts`

- [ ] **Step 1: Write `src/lib/engine/types.ts`**

```ts
export type Mode = 'fixed' | 'time' | 'words';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface EngineConfig {
  mode: Mode;
  source: string;
  duration?: number;
  wordCount?: number;
}

export interface KeyEvent {
  t: number;
  char: string;
  kind: 'input' | 'backspace';
  correct: boolean;
}

export interface EngineState {
  status: 'idle' | 'running' | 'finished';
  input: string;
  cursor: number;
  startedAt: number | null;
  endedAt: number | null;
  timeline: KeyEvent[];
  needMoreWords: boolean;
}

export interface CharStats {
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
}

export interface Result {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  chars: CharStats;
  durationMs: number;
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
git commit -s -S -m "feat(engine): add engine types"
```

---

## Task 5: Engine metrics (TDD)

**Files:**
- Create: `src/lib/engine/metrics.ts`
- Create: `tests/unit/engine/metrics.test.ts`

- [ ] **Step 1: Write failing tests — `tests/unit/engine/metrics.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { computeMetrics } from '@/lib/engine/metrics';
import type { EngineState } from '@/lib/engine/types';

function makeState(partial: Partial<EngineState>): EngineState {
  return {
    status: 'finished',
    input: '',
    cursor: 0,
    startedAt: 0,
    endedAt: 60_000,
    timeline: [],
    needMoreWords: false,
    ...partial,
  };
}

describe('computeMetrics', () => {
  it('returns all zeros when no input', () => {
    const state = makeState({ input: '', endedAt: 60_000 });
    const r = computeMetrics(state, '');
    expect(r.wpm).toBe(0);
    expect(r.rawWpm).toBe(0);
    expect(r.accuracy).toBe(0);
    expect(r.chars).toEqual({ correct: 0, incorrect: 0, extra: 0, missed: 0 });
  });

  it('computes net WPM from correct chars only', () => {
    // 50 correct chars / 5 = 10 "words"; 60s -> 10 WPM net
    const source = 'a'.repeat(50);
    const timeline = Array.from({ length: 50 }, (_, i) => ({
      t: i * 10,
      char: 'a',
      kind: 'input' as const,
      correct: true,
    }));
    const state = makeState({
      input: 'a'.repeat(50),
      cursor: 50,
      startedAt: 0,
      endedAt: 60_000,
      timeline,
    });
    const r = computeMetrics(state, source);
    expect(r.wpm).toBe(10);
    expect(r.rawWpm).toBe(10);
    expect(r.accuracy).toBe(1);
    expect(r.chars.correct).toBe(50);
  });

  it('separates raw WPM from net WPM when wrong chars present', () => {
    // Source: 50 'a'. User typed 50 'b' (all wrong). Raw 10, Net 0.
    const source = 'a'.repeat(50);
    const timeline = Array.from({ length: 50 }, (_, i) => ({
      t: i * 10,
      char: 'b',
      kind: 'input' as const,
      correct: false,
    }));
    const state = makeState({
      input: 'b'.repeat(50),
      cursor: 50,
      startedAt: 0,
      endedAt: 60_000,
      timeline,
    });
    const r = computeMetrics(state, source);
    expect(r.wpm).toBe(0);
    expect(r.rawWpm).toBe(10);
    expect(r.accuracy).toBe(0);
    expect(r.chars.incorrect).toBe(50);
  });

  it('counts backspaces in the accuracy denominator', () => {
    // 5 correct + 1 backspace = 6 keystrokes, 5 correct -> accuracy = 5/6
    const timeline = [
      { t: 0, char: 'h', kind: 'input' as const, correct: true },
      { t: 10, char: 'e', kind: 'input' as const, correct: true },
      { t: 20, char: 'l', kind: 'input' as const, correct: true },
      { t: 30, char: 'l', kind: 'input' as const, correct: true },
      { t: 40, char: 'o', kind: 'input' as const, correct: true },
      { t: 50, char: '', kind: 'backspace' as const, correct: false },
    ];
    const state = makeState({
      input: 'hell',
      cursor: 4,
      startedAt: 0,
      endedAt: 60_000,
      timeline,
    });
    const r = computeMetrics(state, 'hello world');
    expect(r.accuracy).toBeCloseTo(5 / 6, 5);
  });

  it('returns 0 WPM (not NaN) when durationMs is 0', () => {
    const state = makeState({ startedAt: 0, endedAt: 0, input: 'abc' });
    const r = computeMetrics(state, 'abc');
    expect(Number.isFinite(r.wpm)).toBe(true);
    expect(r.wpm).toBe(0);
    expect(Number.isFinite(r.rawWpm)).toBe(true);
  });

  it('counts extra chars typed past the end of source', () => {
    const source = 'hi';
    const timeline = [
      { t: 0, char: 'h', kind: 'input' as const, correct: true },
      { t: 10, char: 'i', kind: 'input' as const, correct: true },
      { t: 20, char: '!', kind: 'input' as const, correct: false },
    ];
    const state = makeState({
      input: 'hi!',
      cursor: 3,
      startedAt: 0,
      endedAt: 60_000,
      timeline,
    });
    const r = computeMetrics(state, source);
    expect(r.chars.extra).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
pnpm test tests/unit/engine/metrics.test.ts
```

Expected: all fail (module not found).

- [ ] **Step 3: Implement `src/lib/engine/metrics.ts`**

```ts
import type { CharStats, EngineState, Result } from './types';

export function computeCharStats(state: EngineState, source: string): CharStats {
  let correct = 0;
  let incorrect = 0;
  let extra = 0;
  let missed = 0;
  const input = state.input;

  const boundary = Math.min(input.length, source.length);
  for (let i = 0; i < boundary; i++) {
    if (input[i] === source[i]) correct++;
    else incorrect++;
  }

  if (input.length > source.length) {
    extra = input.length - source.length;
  }

  // Missed = source chars not yet typed at end of a finished test.
  // In Phase 1 with unrestricted backspace this is typically 0; we keep the
  // calculation for completeness.
  if (state.status === 'finished' && input.length < source.length) {
    missed = source.length - input.length;
  }

  return { correct, incorrect, extra, missed };
}

export function computeMetrics(state: EngineState, source: string): Result {
  const chars = computeCharStats(state, source);
  const startedAt = state.startedAt ?? 0;
  const endedAt = state.endedAt ?? startedAt;
  const durationMs = Math.max(0, endedAt - startedAt);
  const minutes = durationMs / 60_000;

  const totalInputKeystrokes = state.timeline.filter((e) => e.kind === 'input').length;
  const totalKeystrokes = state.timeline.length;

  const wpm = minutes > 0 ? chars.correct / 5 / minutes : 0;
  const rawWpm = minutes > 0 ? totalInputKeystrokes / 5 / minutes : 0;
  const accuracy = totalKeystrokes > 0 ? chars.correct / totalKeystrokes : 0;

  return {
    wpm: round1(wpm),
    rawWpm: round1(rawWpm),
    accuracy,
    chars,
    durationMs,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm test tests/unit/engine/metrics.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -s -S -m "feat(engine): add metrics module with WPM/accuracy calculations"
```

---

## Task 6: Engine core (TDD)

**Files:**
- Create: `src/lib/engine/engine.ts`
- Create: `src/lib/engine/index.ts`
- Create: `tests/unit/engine/engine.test.ts`

- [ ] **Step 1: Write failing tests — `tests/unit/engine/engine.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEngine } from '@/lib/engine/engine';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 0));
});

describe('createEngine — lifecycle', () => {
  it('starts in idle state', () => {
    const e = createEngine({ mode: 'fixed', source: 'hello' });
    expect(e.getState().status).toBe('idle');
    expect(e.getState().input).toBe('');
    expect(e.getState().startedAt).toBeNull();
  });

  it('transitions idle -> running on first input', () => {
    const e = createEngine({ mode: 'fixed', source: 'hello' });
    e.input('h');
    expect(e.getState().status).toBe('running');
    expect(e.getState().startedAt).not.toBeNull();
  });

  it('reset returns to idle and clears state', () => {
    const e = createEngine({ mode: 'fixed', source: 'hello' });
    e.input('h');
    e.reset();
    expect(e.getState().status).toBe('idle');
    expect(e.getState().input).toBe('');
    expect(e.getState().timeline).toEqual([]);
  });
});

describe('createEngine — fixed mode', () => {
  it('finishes when full source is typed correctly', () => {
    const e = createEngine({ mode: 'fixed', source: 'hi' });
    e.input('h');
    e.input('i');
    expect(e.getState().status).toBe('finished');
  });

  it('does not finish when chars are wrong but length matches', () => {
    const e = createEngine({ mode: 'fixed', source: 'hi' });
    e.input('h');
    e.input('x');
    expect(e.getState().status).toBe('running');
  });

  it('allows backspace to correct a mistake and then finish', () => {
    const e = createEngine({ mode: 'fixed', source: 'hi' });
    e.input('h');
    e.input('x');
    e.backspace();
    e.input('i');
    expect(e.getState().status).toBe('finished');
  });

  it('backspace at cursor 0 is a no-op', () => {
    const e = createEngine({ mode: 'fixed', source: 'hi' });
    e.backspace();
    expect(e.getState().input).toBe('');
    expect(e.getState().timeline.length).toBe(0);
    expect(e.getState().status).toBe('idle');
  });

  it('accepts extra chars past source end; test does not finish until exact match', () => {
    const e = createEngine({ mode: 'fixed', source: 'hi' });
    e.input('h');
    e.input('i');
    // Finished immediately when exact match — verify pre-extra behavior on a separate engine:
    const e2 = createEngine({ mode: 'fixed', source: 'hi' });
    e2.input('h');
    e2.input('x'); // wrong
    e2.input('!'); // extra char past expected length, still running
    expect(e2.getState().input.length).toBe(3);
    expect(e2.getState().status).toBe('running');
  });
});

describe('createEngine — time mode', () => {
  it('finishes when tick passes duration', () => {
    const e = createEngine({ mode: 'time', source: 'the quick brown fox', duration: 10 });
    e.input('t');
    const startedAt = e.getState().startedAt!;
    e.tick(startedAt + 9_999);
    expect(e.getState().status).toBe('running');
    e.tick(startedAt + 10_000);
    expect(e.getState().status).toBe('finished');
  });

  it('flags needMoreWords when source is running low', () => {
    // A source of 20 chars; cursor nearing the end should flag needMoreWords.
    const e = createEngine({ mode: 'time', source: 'abcdefghijklmnopqrst', duration: 60 });
    for (const ch of 'abcdefghijklmno') e.input(ch);
    // cursor at 15/20 — within the "low" threshold (last 10)
    expect(e.getState().needMoreWords).toBe(true);
  });

  it('extendSource appends to source without disturbing cursor', () => {
    const e = createEngine({ mode: 'time', source: 'abc', duration: 60 });
    e.input('a');
    e.extendSource('def');
    expect(e.getState().input).toBe('a');
    // Engine should now accept more chars from the extended source:
    e.input('b');
    e.input('c');
    e.input('d');
    expect(e.getState().status).toBe('running'); // time mode never finishes on match
  });
});

describe('createEngine — words mode', () => {
  it('finishes at exactly N completed words', () => {
    // wordCount = 3; source has three words separated by spaces.
    const e = createEngine({ mode: 'words', source: 'one two three', wordCount: 3 });
    for (const ch of 'one ') e.input(ch);
    for (const ch of 'two ') e.input(ch);
    for (const ch of 'three') e.input(ch);
    expect(e.getState().status).toBe('finished');
  });

  it('does not finish prematurely on a wrong space', () => {
    const e = createEngine({ mode: 'words', source: 'ab cd', wordCount: 2 });
    e.input('a');
    e.input(' '); // wrong (expected 'b')
    expect(e.getState().status).toBe('running');
  });
});

describe('createEngine — subscribe', () => {
  it('notifies subscribers on state change', () => {
    const e = createEngine({ mode: 'fixed', source: 'hi' });
    const listener = vi.fn();
    const unsub = e.subscribe(listener);
    e.input('h');
    expect(listener).toHaveBeenCalled();
    unsub();
    e.input('i');
    const callsAfterUnsub = listener.mock.calls.length;
    e.input(' '); // extra input
    expect(listener.mock.calls.length).toBe(callsAfterUnsub);
  });
});

describe('createEngine — getResult', () => {
  it('throws if called before finished', () => {
    const e = createEngine({ mode: 'fixed', source: 'hi' });
    expect(() => e.getResult()).toThrow();
  });

  it('returns a populated result when finished', () => {
    const e = createEngine({ mode: 'fixed', source: 'hi' });
    e.input('h');
    vi.advanceTimersByTime(60_000);
    e.input('i');
    const r = e.getResult();
    expect(r.chars.correct).toBe(2);
    expect(Number.isFinite(r.wpm)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
pnpm test tests/unit/engine/engine.test.ts
```

Expected: all fail (createEngine not exported).

- [ ] **Step 3: Implement `src/lib/engine/engine.ts`**

> **Critical:** `getState()` must return a **stable reference** between mutations, and a **new reference** when state changes. `useSyncExternalStore` requires this contract; returning a fresh object on every call causes infinite re-renders.

```ts
import { computeMetrics } from './metrics';
import type { EngineConfig, EngineState, KeyEvent, Mode, Result } from './types';

const LOW_SOURCE_THRESHOLD = 10;

export interface TypingEngine {
  input(char: string): void;
  backspace(): void;
  tick(nowMs: number): void;
  extendSource(moreChars: string): void;
  reset(): void;
  getState(): EngineState;
  getResult(): Result;
  subscribe(listener: (s: EngineState) => void): () => void;
}

function freshState(): EngineState {
  return {
    status: 'idle',
    input: '',
    cursor: 0,
    startedAt: null,
    endedAt: null,
    timeline: [],
    needMoreWords: false,
  };
}

export function createEngine(config: EngineConfig): TypingEngine {
  const mode: Mode = config.mode;
  const originalSource = config.source;
  const duration = config.duration ?? 0;
  const wordCount = config.wordCount ?? 0;

  let source = originalSource;
  let state: EngineState = freshState();
  const listeners = new Set<(s: EngineState) => void>();

  function setState(next: EngineState) {
    state = next;
    for (const l of listeners) l(state);
  }

  function now(): number {
    return Date.now();
  }

  function computeNeedMoreWords(cursor: number): boolean {
    if (mode !== 'time') return false;
    return source.length - cursor <= LOW_SOURCE_THRESHOLD;
  }

  function countCompletedWords(input: string): number {
    let count = 0;
    const upTo = Math.min(input.length, source.length);
    for (let i = 0; i < upTo; i++) {
      if (input[i] === ' ' && source[i] === ' ') count++;
    }
    if (input.length === source.length && input === source) count++;
    return count;
  }

  function checkEndConditions(next: EngineState): EngineState {
    if (next.status !== 'running') return next;
    if (mode === 'fixed') {
      if (next.input.length === source.length && next.input === source) {
        return { ...next, status: 'finished', endedAt: now() };
      }
      return next;
    }
    if (mode === 'words') {
      if (countCompletedWords(next.input) >= wordCount) {
        return { ...next, status: 'finished', endedAt: now() };
      }
      return next;
    }
    return next;
  }

  function input(char: string) {
    if (state.status === 'finished') return;
    if (char.length !== 1) return;
    const starting = state.status === 'idle';
    const base: EngineState = starting
      ? { ...state, status: 'running', startedAt: now() }
      : state;
    const expected = source[base.cursor];
    const correct = char === expected;
    const evt: KeyEvent = {
      t: base.startedAt ? now() - base.startedAt : 0,
      char,
      kind: 'input',
      correct,
    };
    const nextCursor = base.cursor + 1;
    let next: EngineState = {
      ...base,
      input: base.input + char,
      cursor: nextCursor,
      timeline: [...base.timeline, evt],
      needMoreWords: computeNeedMoreWords(nextCursor),
    };
    next = checkEndConditions(next);
    setState(next);
  }

  function backspace() {
    if (state.status === 'finished') return;
    if (state.cursor === 0) return;
    const evt: KeyEvent = {
      t: state.startedAt ? now() - state.startedAt : 0,
      char: '',
      kind: 'backspace',
      correct: false,
    };
    const nextCursor = state.cursor - 1;
    const next: EngineState = {
      ...state,
      input: state.input.slice(0, -1),
      cursor: nextCursor,
      timeline: [...state.timeline, evt],
      needMoreWords: computeNeedMoreWords(nextCursor),
    };
    setState(next);
  }

  function tick(nowMs: number) {
    if (state.status !== 'running') return;
    if (mode !== 'time') return;
    const started = state.startedAt ?? nowMs;
    if (nowMs - started >= duration * 1000) {
      setState({ ...state, status: 'finished', endedAt: now() });
    }
  }

  function extendSource(moreChars: string) {
    source = source + moreChars;
    setState({ ...state, needMoreWords: computeNeedMoreWords(state.cursor) });
  }

  function reset() {
    source = originalSource;
    setState(freshState());
  }

  function getState(): EngineState {
    return state;
  }

  function getResult(): Result {
    if (state.status !== 'finished') {
      throw new Error('getResult called before engine finished');
    }
    return computeMetrics(state, source);
  }

  function subscribe(listener: (s: EngineState) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { input, backspace, tick, extendSource, reset, getState, getResult, subscribe };
}
```

- [ ] **Step 4: Write `src/lib/engine/index.ts` (public API re-exports)**

```ts
export { createEngine } from './engine';
export type { TypingEngine } from './engine';
export type {
  Mode,
  Difficulty,
  EngineConfig,
  EngineState,
  KeyEvent,
  CharStats,
  Result,
} from './types';
```

- [ ] **Step 5: Run tests — expect pass**

```bash
pnpm test tests/unit/engine/
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -s -S -m "feat(engine): add core TypingEngine with three modes and tests"
```

---

## Task 7: Content — word lists

**Files:**
- Create: `src/lib/content/words.ts`

- [ ] **Step 1: Write `src/lib/content/words.ts`**

Three exported arrays. Source: the standard Norvig / Google 10000 top-frequency public-domain lists. Include the top 200 in EASY, top 1000 in MEDIUM, top 3000 in HARD. During execution, populate these with real common-English words, lowercase, no punctuation. Inline the full arrays.

Target counts:
- `WORDS_EASY`: exactly 200 words.
- `WORDS_MEDIUM`: exactly 1000 words.
- `WORDS_HARD`: exactly 3000 words.

```ts
// Curated from public-domain top-frequency English word lists.
// All lowercase, ASCII, no punctuation in the array entries themselves.
// Selection logic in select.ts may append light punctuation for 'hard'.

export const WORDS_EASY: string[] = [
  // 200 of the most common English words:
  'the', 'of', 'and', 'to', 'a', 'in', 'is', 'you', 'that', 'it',
  'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'I',
  // ... populate to exactly 200 entries during execution
];

export const WORDS_MEDIUM: string[] = [
  // 1000 of the most common English words (includes all of EASY plus ~800 more)
  // ... populate to exactly 1000 entries during execution
];

export const WORDS_HARD: string[] = [
  // 3000 of the most common English words (includes all of MEDIUM plus ~2000 more)
  // ... populate to exactly 3000 entries during execution
];
```

**Sourcing plan (execution notes):** the implementer should fetch or paste from a well-known public-domain frequency list (e.g., Google 10000, Norvig) and slice to the target counts. Strip any punctuation, ensure lowercase, deduplicate, filter any non-alphabetic tokens.

- [ ] **Step 2: Add a lightweight sanity test — `tests/unit/content/words.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { WORDS_EASY, WORDS_MEDIUM, WORDS_HARD } from '@/lib/content/words';

describe('word lists', () => {
  it('have the expected sizes', () => {
    expect(WORDS_EASY.length).toBe(200);
    expect(WORDS_MEDIUM.length).toBe(1000);
    expect(WORDS_HARD.length).toBe(3000);
  });

  it('are all lowercase ASCII alphabetic', () => {
    const all = [...WORDS_EASY, ...WORDS_MEDIUM, ...WORDS_HARD];
    for (const w of all) {
      expect(w).toMatch(/^[a-z]+$/);
    }
  });

  it('have MEDIUM as a superset of EASY', () => {
    const m = new Set(WORDS_MEDIUM);
    for (const w of WORDS_EASY) expect(m.has(w)).toBe(true);
  });

  it('have HARD as a superset of MEDIUM', () => {
    const h = new Set(WORDS_HARD);
    for (const w of WORDS_MEDIUM) expect(h.has(w)).toBe(true);
  });

  it('have no duplicates within each tier', () => {
    expect(new Set(WORDS_EASY).size).toBe(WORDS_EASY.length);
    expect(new Set(WORDS_MEDIUM).size).toBe(WORDS_MEDIUM.length);
    expect(new Set(WORDS_HARD).size).toBe(WORDS_HARD.length);
  });
});
```

- [ ] **Step 3: Run the word tests**

```bash
pnpm test tests/unit/content/words.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -S -m "feat(content): add easy/medium/hard word lists"
```

---

## Task 8: Content — passages

**Files:**
- Create: `src/lib/content/passages.ts`

- [ ] **Step 1: Write `src/lib/content/passages.ts`**

60 passages, hand-curated. 20 short (~25 words), 30 medium (~50 words), 10 long (~100 words). Public-domain sources (Marcus Aurelius, Seneca, Austen, the King James Bible, Shakespeare excerpts, US Constitution preamble, Lincoln speeches), well-formed English prose (original writing), and pangrams. All ASCII, straight quotes, no em-dashes.

```ts
export interface Passage {
  id: string;
  text: string;
  length: 'short' | 'medium' | 'long';
  source?: string;
}

export const PASSAGES: Passage[] = [
  {
    id: 'aurelius-present-01',
    text: 'Remember that very little is needed to make a happy life. It is all within yourself, in your way of thinking.',
    length: 'short',
    source: 'Marcus Aurelius',
  },
  {
    id: 'pangram-01',
    text: 'The quick brown fox jumps over the lazy dog near the riverbank as the sun slowly sets behind the silent hills.',
    length: 'short',
  },
  // ... populate to exactly 60 entries during execution:
  //   - 20 short (word count 20-30)
  //   - 30 medium (word count 45-60)
  //   - 10 long (word count 90-110)
];
```

**Sourcing plan (execution notes):** the implementer selects passages during execution. Sources: public-domain text (older than 1925 or explicitly public domain), plus original prose. No non-ASCII chars; normalize all quotes to `'` / `"`; hyphens only. Review each for typos and content appropriateness before committing.

- [ ] **Step 2: Passages sanity test — `tests/unit/content/passages.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { PASSAGES } from '@/lib/content/passages';

function wordCount(s: string): number {
  return s.trim().split(/\s+/).length;
}

describe('passages', () => {
  it('has exactly 60 entries', () => {
    expect(PASSAGES.length).toBe(60);
  });

  it('has the expected length distribution', () => {
    const byLen = { short: 0, medium: 0, long: 0 };
    for (const p of PASSAGES) byLen[p.length]++;
    expect(byLen.short).toBe(20);
    expect(byLen.medium).toBe(30);
    expect(byLen.long).toBe(10);
  });

  it('has unique ids', () => {
    const ids = PASSAGES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('passages are plain ASCII', () => {
    for (const p of PASSAGES) {
      // No non-ASCII characters.
      expect(p.text).toMatch(/^[\x20-\x7E]+$/);
    }
  });

  it('word counts are within the expected range for each tier', () => {
    for (const p of PASSAGES) {
      const w = wordCount(p.text);
      if (p.length === 'short') {
        expect(w, `passage ${p.id}`).toBeGreaterThanOrEqual(18);
        expect(w, `passage ${p.id}`).toBeLessThanOrEqual(32);
      } else if (p.length === 'medium') {
        expect(w, `passage ${p.id}`).toBeGreaterThanOrEqual(40);
        expect(w, `passage ${p.id}`).toBeLessThanOrEqual(65);
      } else {
        expect(w, `passage ${p.id}`).toBeGreaterThanOrEqual(85);
        expect(w, `passage ${p.id}`).toBeLessThanOrEqual(115);
      }
    }
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm test tests/unit/content/passages.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -S -m "feat(content): add 60 curated public-domain passages"
```

---

## Task 9: Content — selection with seeded RNG (TDD)

**Files:**
- Create: `src/lib/content/select.ts`
- Create: `tests/unit/content/select.test.ts`

- [ ] **Step 1: Write failing tests — `tests/unit/content/select.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { pickPassage, pickWords } from '@/lib/content/select';

describe('pickPassage', () => {
  it('respects the length filter', () => {
    const p = pickPassage({ length: 'short', seed: 'RACE-A1' });
    expect(p.length).toBe('short');
  });

  it('is deterministic for the same seed', () => {
    const a = pickPassage({ length: 'medium', seed: 'RACE-XYZ' });
    const b = pickPassage({ length: 'medium', seed: 'RACE-XYZ' });
    expect(a.id).toBe(b.id);
  });

  it('returns different passages for different seeds (usually)', () => {
    const seeds = ['s1', 's2', 's3', 's4', 's5', 's6'];
    const ids = seeds.map((s) => pickPassage({ length: 'long', seed: s }).id);
    expect(new Set(ids).size).toBeGreaterThan(1);
  });
});

describe('pickWords', () => {
  it('returns the requested count', () => {
    expect(pickWords({ tier: 'easy', count: 10 }).length).toBe(10);
    expect(pickWords({ tier: 'medium', count: 25 }).length).toBe(25);
  });

  it('is deterministic for the same seed', () => {
    const a = pickWords({ tier: 'medium', count: 15, seed: 'k' });
    const b = pickWords({ tier: 'medium', count: 15, seed: 'k' });
    expect(a).toEqual(b);
  });

  it('hard tier occasionally emits punctuation suffixes', () => {
    const words = pickWords({ tier: 'hard', count: 500, seed: 'punct-seed' });
    const hasPunct = words.some((w) => /[,.;']$/.test(w));
    expect(hasPunct).toBe(true);
  });

  it('easy/medium never emit punctuation', () => {
    const easy = pickWords({ tier: 'easy', count: 200, seed: 'x' });
    for (const w of easy) expect(w).toMatch(/^[a-z]+$/);
    const medium = pickWords({ tier: 'medium', count: 500, seed: 'y' });
    for (const w of medium) expect(w).toMatch(/^[a-z]+$/);
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
pnpm test tests/unit/content/select.test.ts
```

- [ ] **Step 3: Implement `src/lib/content/select.ts`**

```ts
import type { Difficulty } from '@/lib/engine/types';
import { PASSAGES, type Passage } from './passages';
import { WORDS_EASY, WORDS_MEDIUM, WORDS_HARD } from './words';

/**
 * mulberry32 — small, fast, deterministic PRNG.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed?: string): () => number {
  if (seed) return mulberry32(hashString(seed));
  return Math.random;
}

export function pickPassage(opts: {
  length: 'short' | 'medium' | 'long';
  seed?: string;
}): Passage {
  const pool = PASSAGES.filter((p) => p.length === opts.length);
  if (pool.length === 0) throw new Error(`No passages of length ${opts.length}`);
  const r = rng(opts.seed);
  const idx = Math.floor(r() * pool.length);
  return pool[idx]!;
}

const PUNCT_SUFFIXES = [',', '.', ';', "'"];
const HARD_PUNCT_PROBABILITY = 0.12;

export function pickWords(opts: {
  tier: Difficulty;
  count: number;
  seed?: string;
}): string[] {
  const pool =
    opts.tier === 'easy' ? WORDS_EASY : opts.tier === 'medium' ? WORDS_MEDIUM : WORDS_HARD;
  const r = rng(opts.seed);
  const out: string[] = [];
  for (let i = 0; i < opts.count; i++) {
    let w = pool[Math.floor(r() * pool.length)]!;
    if (opts.tier === 'hard' && r() < HARD_PUNCT_PROBABILITY) {
      const p = PUNCT_SUFFIXES[Math.floor(r() * PUNCT_SUFFIXES.length)]!;
      w = w + p;
    }
    out.push(w);
  }
  return out;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm test tests/unit/content/select.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -s -S -m "feat(content): add seeded passage/word selection"
```

---

## Task 10: Storage — localStorage config wrapper (TDD)

**Files:**
- Create: `src/lib/storage/config.ts`
- Create: `tests/unit/storage/config.test.ts`

- [ ] **Step 1: Write failing tests — `tests/unit/storage/config.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_CONFIG, loadConfig, saveConfig } from '@/lib/storage/config';

beforeEach(() => {
  localStorage.clear();
});

describe('storage config', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('round-trips a patch', () => {
    saveConfig({ mode: 'time', timeDuration: 30, difficulty: 'hard' });
    const loaded = loadConfig();
    expect(loaded.mode).toBe('time');
    expect(loaded.timeDuration).toBe(30);
    expect(loaded.difficulty).toBe('hard');
    // Unpatched fields remain at default:
    expect(loaded.fixedLength).toBe(DEFAULT_CONFIG.fixedLength);
  });

  it('returns defaults when stored JSON is corrupt', () => {
    localStorage.setItem('typing-speed:config', '{not json');
    expect(loadConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('ignores unknown fields in stored JSON', () => {
    localStorage.setItem(
      'typing-speed:config',
      JSON.stringify({ mode: 'fixed', extraneous: 'garbage' }),
    );
    const loaded = loadConfig();
    expect(loaded.mode).toBe('fixed');
  });

  it('rejects invalid values silently and falls back to default for that field', () => {
    localStorage.setItem(
      'typing-speed:config',
      JSON.stringify({ mode: 'bogus-mode', timeDuration: 999 }),
    );
    const loaded = loadConfig();
    expect(loaded.mode).toBe(DEFAULT_CONFIG.mode);
    expect(loaded.timeDuration).toBe(DEFAULT_CONFIG.timeDuration);
  });
});
```

- [ ] **Step 2: Run — expect failures**

```bash
pnpm test tests/unit/storage/config.test.ts
```

- [ ] **Step 3: Implement `src/lib/storage/config.ts`**

```ts
import type { Difficulty, Mode } from '@/lib/engine/types';

export interface UserConfig {
  mode: Mode;
  fixedLength: 'short' | 'medium' | 'long';
  timeDuration: 15 | 30 | 60;
  wordsCount: 10 | 25 | 50 | 100;
  difficulty: Difficulty;
  theme: 'dark' | 'light';
}

export const DEFAULT_CONFIG: UserConfig = {
  mode: 'fixed',
  fixedLength: 'medium',
  timeDuration: 30,
  wordsCount: 25,
  difficulty: 'medium',
  theme: 'dark',
};

const KEY = 'typing-speed:config';

const MODE_VALUES: Mode[] = ['fixed', 'time', 'words'];
const LENGTH_VALUES = ['short', 'medium', 'long'] as const;
const DURATION_VALUES = [15, 30, 60] as const;
const WORDS_COUNT_VALUES = [10, 25, 50, 100] as const;
const DIFFICULTY_VALUES: Difficulty[] = ['easy', 'medium', 'hard'];
const THEME_VALUES = ['dark', 'light'] as const;

function validate(raw: unknown): UserConfig {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_CONFIG;
  const r = raw as Record<string, unknown>;
  const out: UserConfig = { ...DEFAULT_CONFIG };
  if (typeof r.mode === 'string' && MODE_VALUES.includes(r.mode as Mode)) {
    out.mode = r.mode as Mode;
  }
  if (
    typeof r.fixedLength === 'string' &&
    (LENGTH_VALUES as readonly string[]).includes(r.fixedLength)
  ) {
    out.fixedLength = r.fixedLength as UserConfig['fixedLength'];
  }
  if (
    typeof r.timeDuration === 'number' &&
    (DURATION_VALUES as readonly number[]).includes(r.timeDuration)
  ) {
    out.timeDuration = r.timeDuration as UserConfig['timeDuration'];
  }
  if (
    typeof r.wordsCount === 'number' &&
    (WORDS_COUNT_VALUES as readonly number[]).includes(r.wordsCount)
  ) {
    out.wordsCount = r.wordsCount as UserConfig['wordsCount'];
  }
  if (
    typeof r.difficulty === 'string' &&
    DIFFICULTY_VALUES.includes(r.difficulty as Difficulty)
  ) {
    out.difficulty = r.difficulty as Difficulty;
  }
  if (typeof r.theme === 'string' && (THEME_VALUES as readonly string[]).includes(r.theme)) {
    out.theme = r.theme as UserConfig['theme'];
  }
  return out;
}

export function loadConfig(): UserConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_CONFIG;
  const raw = localStorage.getItem(KEY);
  if (!raw) return DEFAULT_CONFIG;
  try {
    return validate(JSON.parse(raw));
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(patch: Partial<UserConfig>): void {
  if (typeof localStorage === 'undefined') return;
  const current = loadConfig();
  const next = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
}
```

- [ ] **Step 4: Run — expect pass**

```bash
pnpm test tests/unit/storage/config.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -s -S -m "feat(storage): add config load/save with validation and defaults"
```

---

## Task 11: React hook `useTypingEngine`

**Files:**
- Create: `src/hooks/useTypingEngine.ts`

- [ ] **Step 1: Implement `src/hooks/useTypingEngine.ts`**

```ts
'use client';

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import {
  createEngine,
  type EngineConfig,
  type Result,
  type TypingEngine,
} from '@/lib/engine';

export interface UseTypingEngineResult {
  state: ReturnType<TypingEngine['getState']>;
  result: Result | null;
  handlers: {
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    onPaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  };
  reset: () => void;
  extendSource: (more: string) => void;
  onPasteBlocked: (cb: () => void) => void;
}

export function useTypingEngine(config: EngineConfig): UseTypingEngineResult {
  const engineRef = useRef<TypingEngine | null>(null);
  if (engineRef.current === null) engineRef.current = createEngine(config);
  const engine = engineRef.current;

  const subscribe = useCallback(
    (cb: () => void) => engine.subscribe(() => cb()),
    [engine],
  );
  const getSnapshot = useCallback(() => engine.getState(), [engine]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // rAF tick loop for time mode.
  useEffect(() => {
    if (state.status !== 'running') return;
    let raf = 0;
    const loop = () => {
      engine.tick(Date.now());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, state.status]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Tab' && state.status === 'running') {
        e.preventDefault();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        engine.backspace();
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        engine.input(e.key);
      }
    },
    [engine, state.status],
  );

  const pasteCbRef = useRef<() => void>(() => {});
  const onPasteBlocked = useCallback((cb: () => void) => {
    pasteCbRef.current = cb;
  }, []);
  const onPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    pasteCbRef.current();
  }, []);

  const reset = useCallback(() => engine.reset(), [engine]);
  const extendSource = useCallback(
    (more: string) => engine.extendSource(more),
    [engine],
  );

  const result = useMemo<Result | null>(() => {
    if (state.status !== 'finished') return null;
    return engine.getResult();
  }, [engine, state]);

  return {
    state,
    result,
    handlers: { onKeyDown, onPaste },
    reset,
    extendSource,
    onPasteBlocked,
  };
}
```

Notes:
- The hook creates the engine **once** per mount via `useRef` initialization. To start fresh with a new config, the consumer remounts the component (keyed by config identity).
- The engine returns a stable state reference between mutations, so `useSyncExternalStore` renders correctly.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -s -S -m "feat(engine): add useTypingEngine React hook"
```

---

## Task 12: UI primitives — Button, Toggle

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Toggle.tsx`

- [ ] **Step 1: Write `src/components/ui/Button.tsx`**

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const base =
  'inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const variants: Record<Variant, string> = {
  primary:
    'bg-[color:var(--accent)] text-[color:var(--bg)] hover:brightness-110 focus-visible:brightness-110',
  ghost:
    'bg-transparent text-[color:var(--fg)] border border-[color:var(--border)] hover:bg-[color:var(--surface)]',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', className = '', children, ...rest },
  ref,
) {
  return (
    <button ref={ref} className={`${base} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
});
```

- [ ] **Step 2: Write `src/components/ui/Toggle.tsx`**

A minimal pill-style group used for mode/length/duration/count/difficulty selection. Consumer passes an array of options.

```tsx
'use client';

import { useCallback } from 'react';

export interface ToggleOption<T extends string | number> {
  value: T;
  label: string;
}

interface ToggleProps<T extends string | number> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle<T extends string | number>({
  options,
  value,
  onChange,
  label,
  disabled = false,
}: ToggleProps<T>) {
  const handle = useCallback(
    (v: T) => {
      if (disabled) return;
      onChange(v);
    },
    [onChange, disabled],
  );

  return (
    <div
      className="inline-flex items-center gap-2"
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled}
    >
      {label ? (
        <span className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {label}
        </span>
      ) : null}
      <div
        className={`inline-flex rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] ${disabled ? 'opacity-50' : ''}`}
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => handle(opt.value)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                selected
                  ? 'bg-[color:var(--accent)] text-[color:var(--bg)]'
                  : 'text-[color:var(--fg)] hover:bg-[color:var(--faint)]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
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
git commit -s -S -m "feat(ui): add Button and Toggle primitives"
```

---

## Task 13: Chrome — ThemeProvider, ThemeToggle, Header, Footer

**Files:**
- Create: `src/components/chrome/ThemeProvider.tsx`
- Create: `src/components/chrome/ThemeToggle.tsx`
- Create: `src/components/chrome/Header.tsx`
- Create: `src/components/chrome/Footer.tsx`

- [ ] **Step 1: Write `src/components/chrome/ThemeProvider.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { loadConfig } from '@/lib/storage/config';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const cfg = loadConfig();
    document.documentElement.setAttribute('data-theme', cfg.theme);
  }, []);
  return <>{children}</>;
}
```

> The `html` element's `data-theme` attribute is set to `dark` by default in the root layout (see Task 14). The provider only runs on the client to pick up the user's stored preference; there is a minor flash possible on first render if the user has previously switched to light. Acceptable for Phase 1; can be tightened with a cookie-backed approach later.

- [ ] **Step 2: Write `src/components/chrome/ThemeToggle.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { loadConfig, saveConfig } from '@/lib/storage/config';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setTheme(loadConfig().theme);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    saveConfig({ theme: next });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="text-xs uppercase tracking-widest text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors"
    >
      {theme === 'dark' ? 'light' : 'dark'} mode
    </button>
  );
}
```

- [ ] **Step 3: Write `src/components/chrome/Header.tsx`**

```tsx
import Link from 'next/link';
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
        <ThemeToggle />
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Write `src/components/chrome/Footer.tsx`**

```tsx
import { ThemeToggle } from './ThemeToggle';

export function Footer() {
  return (
    <footer className="w-full border-t border-[color:var(--border)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 text-xs text-[color:var(--muted)]">
        <span>v0.1.0 — phase 1 single-player</span>
        <ThemeToggle />
      </div>
    </footer>
  );
}
```

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -s -S -m "feat(chrome): add ThemeProvider, ThemeToggle, Header, Footer"
```

---

## Task 14: Root layout + landing page

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace `src/app/layout.tsx`**

```tsx
import './globals.css';
import type { Metadata } from 'next';
import { geistMono } from './fonts';
import { ThemeProvider } from '@/components/chrome/ThemeProvider';
import { Header } from '@/components/chrome/Header';
import { Footer } from '@/components/chrome/Footer';

export const metadata: Metadata = {
  title: 'Typing Speed',
  description: 'Test your typing speed. Race later.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={geistMono.variable}>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`**

```tsx
import Link from 'next/link';

export default function LandingPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-3xl flex-col items-center justify-center gap-10 px-6 text-center">
      <div className="space-y-4">
        <h1 className="text-5xl font-semibold tracking-tight text-[color:var(--fg)] sm:text-6xl">
          Typing Speed
        </h1>
        <p className="text-lg text-[color:var(--muted)]">
          Test your typing speed. Race later.
        </p>
      </div>
      <Link
        href="/single-player"
        className="inline-flex items-center justify-center rounded-md bg-[color:var(--accent)] px-6 py-3 text-base font-medium text-[color:var(--bg)] transition-colors hover:brightness-110"
      >
        Start typing test
      </Link>
    </section>
  );
}
```

- [ ] **Step 3: Dev server smoke**

```bash
pnpm dev --port 3100 &
DEV_PID=$!
sleep 4
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3100/
kill $DEV_PID 2>/dev/null || true
```

Expected: `200`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -S -m "feat(app): add root layout, theme wiring, and / landing page"
```

---

## Task 15: `TypingSurface` component

**Files:**
- Create: `src/components/typing/TypingSurface.tsx`
- Create: `tests/components/TypingSurface.test.tsx`

- [ ] **Step 1: Implement `src/components/typing/TypingSurface.tsx`**

```tsx
'use client';

import type { EngineState } from '@/lib/engine';

interface Props {
  source: string;
  state: EngineState;
  dimmed?: boolean;
}

export function TypingSurface({ source, state, dimmed = false }: Props) {
  const input = state.input;

  return (
    <div
      className={`font-mono text-2xl leading-relaxed tracking-wide transition-opacity duration-300 ${dimmed ? 'opacity-40' : 'opacity-100'}`}
      style={{
        fontFamily: 'var(--font-mono), ui-monospace, monospace',
        maxWidth: '56ch',
        margin: '0 auto',
      }}
    >
      {Array.from({ length: Math.max(source.length, input.length) }).map((_, i) => {
        const expected = source[i];
        const typed = input[i];
        const isCurrent = !dimmed && state.status !== 'finished' && i === input.length;

        let cls = '';
        if (typed === undefined) {
          cls = 'text-[color:var(--muted)]';
        } else if (expected === undefined) {
          cls = 'text-[color:var(--danger)] bg-[color:var(--danger)]/10';
        } else if (typed === expected) {
          cls = 'text-[color:var(--fg)]';
        } else {
          cls = 'text-[color:var(--danger)] bg-[color:var(--danger)]/10';
        }

        const display = typed !== undefined ? typed : (expected ?? '');
        const showSpaceDot = display === ' ' && (typed !== undefined && typed !== expected);

        return (
          <span
            key={i}
            data-idx={i}
            className={`${cls} ${isCurrent ? 'relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-[color:var(--accent)] before:animate-pulse' : ''}`}
          >
            {showSpaceDot ? '_' : display}
          </span>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Component smoke test — `tests/components/TypingSurface.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TypingSurface } from '@/components/typing/TypingSurface';
import type { EngineState } from '@/lib/engine';

function stateWith(input: string): EngineState {
  return {
    status: 'running',
    input,
    cursor: input.length,
    startedAt: 0,
    endedAt: null,
    timeline: [],
    needMoreWords: false,
  };
}

describe('TypingSurface', () => {
  it('renders a span per source char', () => {
    const { container } = render(<TypingSurface source="hello" state={stateWith('')} />);
    const spans = container.querySelectorAll('span[data-idx]');
    expect(spans.length).toBe(5);
  });

  it('applies the correct-class to typed-correct positions', () => {
    const { container } = render(<TypingSurface source="hello" state={stateWith('he')} />);
    const zero = container.querySelector('span[data-idx="0"]')!;
    expect(zero.className).toContain('var(--fg)');
  });

  it('marks a wrong char with danger color', () => {
    const { container } = render(<TypingSurface source="hello" state={stateWith('hx')} />);
    const one = container.querySelector('span[data-idx="1"]')!;
    expect(one.className).toContain('var(--danger)');
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm test tests/components/TypingSurface.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -S -m "feat(typing): add TypingSurface component with per-char coloring"
```

---

## Task 16: `LiveWpm` component

**Files:**
- Create: `src/components/typing/LiveWpm.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EngineState, Mode } from '@/lib/engine';

interface Props {
  state: EngineState;
  mode: Mode;
  source: string;
  duration?: number;
  wordCount?: number;
}

function countCompletedWords(input: string, source: string): number {
  let n = 0;
  const upTo = Math.min(input.length, source.length);
  for (let i = 0; i < upTo; i++) {
    if (input[i] === ' ' && source[i] === ' ') n++;
  }
  return n;
}

export function LiveWpm({ state, mode, source, duration, wordCount }: Props) {
  // Re-render each second during running to update the timer.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (state.status !== 'running') return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [state.status]);

  const liveWpm = useMemo(() => {
    const startedAt = state.startedAt;
    if (!startedAt || state.status === 'idle') return 0;
    const endedAt = state.endedAt ?? Date.now();
    const minutes = (endedAt - startedAt) / 60_000;
    if (minutes <= 0) return 0;
    let correct = 0;
    const boundary = Math.min(state.input.length, source.length);
    for (let i = 0; i < boundary; i++) {
      if (state.input[i] === source[i]) correct++;
    }
    return Math.round(correct / 5 / minutes);
  }, [state, source]);

  let secondary: string | null = null;
  if (mode === 'time' && duration && state.startedAt) {
    const endedAt = state.endedAt ?? Date.now();
    const remaining = Math.max(0, Math.ceil(duration - (endedAt - state.startedAt) / 1000));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    secondary = `${m}:${s.toString().padStart(2, '0')}`;
  } else if (mode === 'words' && wordCount) {
    secondary = `${countCompletedWords(state.input, source)} / ${wordCount}`;
  }

  return (
    <div className="inline-flex items-baseline gap-4 text-[color:var(--muted)]">
      <span className="font-mono text-2xl text-[color:var(--accent)]">
        {liveWpm}
        <span className="ml-1 text-xs uppercase tracking-widest">wpm</span>
      </span>
      {secondary ? (
        <span className="font-mono text-lg text-[color:var(--fg)]">{secondary}</span>
      ) : null}
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
git commit -s -S -m "feat(typing): add LiveWpm component with per-mode secondary"
```

---

## Task 17: `ModeSelector` component

**Files:**
- Create: `src/components/typing/ModeSelector.tsx`
- Create: `tests/components/ModeSelector.test.tsx`

- [ ] **Step 1: Implement `src/components/typing/ModeSelector.tsx`**

```tsx
'use client';

import { Toggle } from '@/components/ui/Toggle';
import type { Difficulty, Mode } from '@/lib/engine';

export interface TestConfig {
  mode: Mode;
  fixedLength: 'short' | 'medium' | 'long';
  timeDuration: 15 | 30 | 60;
  wordsCount: 10 | 25 | 50 | 100;
  difficulty: Difficulty;
}

interface Props {
  value: TestConfig;
  onChange: (next: TestConfig) => void;
  disabled?: boolean;
}

const MODE_OPTIONS = [
  { value: 'fixed' as const, label: 'fixed' },
  { value: 'time' as const, label: 'time' },
  { value: 'words' as const, label: 'words' },
];

const LENGTH_OPTIONS = [
  { value: 'short' as const, label: 'short' },
  { value: 'medium' as const, label: 'medium' },
  { value: 'long' as const, label: 'long' },
];

const DURATION_OPTIONS = [
  { value: 15 as const, label: '15s' },
  { value: 30 as const, label: '30s' },
  { value: 60 as const, label: '60s' },
];

const WORDS_OPTIONS = [
  { value: 10 as const, label: '10' },
  { value: 25 as const, label: '25' },
  { value: 50 as const, label: '50' },
  { value: 100 as const, label: '100' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy' as const, label: 'easy' },
  { value: 'medium' as const, label: 'medium' },
  { value: 'hard' as const, label: 'hard' },
];

export function ModeSelector({ value, onChange, disabled = false }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <Toggle
        label="mode"
        options={MODE_OPTIONS}
        value={value.mode}
        onChange={(m) => onChange({ ...value, mode: m })}
        disabled={disabled}
      />
      {value.mode === 'fixed' && (
        <Toggle
          label="length"
          options={LENGTH_OPTIONS}
          value={value.fixedLength}
          onChange={(l) => onChange({ ...value, fixedLength: l })}
          disabled={disabled}
        />
      )}
      {value.mode === 'time' && (
        <Toggle
          label="duration"
          options={DURATION_OPTIONS}
          value={value.timeDuration}
          onChange={(d) => onChange({ ...value, timeDuration: d })}
          disabled={disabled}
        />
      )}
      {value.mode === 'words' && (
        <Toggle
          label="count"
          options={WORDS_OPTIONS}
          value={value.wordsCount}
          onChange={(c) => onChange({ ...value, wordsCount: c })}
          disabled={disabled}
        />
      )}
      <Toggle
        label="difficulty"
        options={DIFFICULTY_OPTIONS}
        value={value.difficulty}
        onChange={(d) => onChange({ ...value, difficulty: d })}
        disabled={disabled || value.mode === 'fixed'}
      />
    </div>
  );
}
```

- [ ] **Step 2: Smoke test — `tests/components/ModeSelector.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModeSelector, type TestConfig } from '@/components/typing/ModeSelector';

const base: TestConfig = {
  mode: 'fixed',
  fixedLength: 'medium',
  timeDuration: 30,
  wordsCount: 25,
  difficulty: 'medium',
};

describe('ModeSelector', () => {
  it('renders mode + length controls for fixed mode', () => {
    render(<ModeSelector value={base} onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'mode' })).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: 'length' })).toBeInTheDocument();
  });

  it('swaps controls when mode changes to time', () => {
    render(<ModeSelector value={{ ...base, mode: 'time' }} onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'duration' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'length' })).toBeNull();
  });

  it('fires onChange with the patched config on click', () => {
    const onChange = vi.fn();
    render(<ModeSelector value={base} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'time' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'time' }));
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm test tests/components/ModeSelector.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -S -m "feat(typing): add ModeSelector with contextual controls"
```

---

## Task 18: `ResultsPanel` component

**Files:**
- Create: `src/components/typing/ResultsPanel.tsx`
- Create: `tests/components/ResultsPanel.test.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import { Button } from '@/components/ui/Button';
import type { Result } from '@/lib/engine';

interface Props {
  result: Result;
  onNext: () => void;
  onRestart: () => void;
  onChangeMode: () => void;
  nextButtonRef?: React.RefObject<HTMLButtonElement>;
}

function formatDuration(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${m}m ${rem}s`;
}

export function ResultsPanel({ result, onNext, onRestart, onChangeMode, nextButtonRef }: Props) {
  return (
    <div className="mx-auto mt-8 flex w-full max-w-2xl flex-col gap-6 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
      <div className="flex items-baseline justify-around">
        <div className="text-center">
          <div className="text-5xl font-semibold text-[color:var(--accent)]">
            {Math.round(result.wpm)}
          </div>
          <div className="mt-1 text-xs uppercase tracking-widest text-[color:var(--muted)]">
            wpm
          </div>
        </div>
        <div className="text-center">
          <div className="text-5xl font-semibold text-[color:var(--fg)]">
            {Math.round(result.accuracy * 100)}%
          </div>
          <div className="mt-1 text-xs uppercase tracking-widest text-[color:var(--muted)]">
            accuracy
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-[color:var(--muted)] sm:grid-cols-5">
        <Stat label="raw" value={`${Math.round(result.rawWpm)}`} />
        <Stat label="time" value={formatDuration(result.durationMs)} />
        <Stat label="correct" value={`${result.chars.correct}`} />
        <Stat label="incorrect" value={`${result.chars.incorrect}`} />
        <Stat label="extra" value={`${result.chars.extra}`} />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button ref={nextButtonRef} variant="primary" onClick={onNext}>
          Next test
        </Button>
        <Button variant="ghost" onClick={onRestart}>
          Restart
        </Button>
        <Button variant="ghost" onClick={onChangeMode}>
          Change mode
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="font-mono text-lg text-[color:var(--fg)]">{value}</div>
      <div className="text-xs uppercase tracking-widest">{label}</div>
    </div>
  );
}
```

- [ ] **Step 2: Smoke test — `tests/components/ResultsPanel.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsPanel } from '@/components/typing/ResultsPanel';

const result = {
  wpm: 68.4,
  rawWpm: 72.1,
  accuracy: 0.947,
  chars: { correct: 120, incorrect: 5, extra: 2, missed: 0 },
  durationMs: 30_000,
};

describe('ResultsPanel', () => {
  it('renders WPM and accuracy headline', () => {
    render(
      <ResultsPanel
        result={result}
        onNext={() => {}}
        onRestart={() => {}}
        onChangeMode={() => {}}
      />,
    );
    expect(screen.getByText('68')).toBeInTheDocument();
    expect(screen.getByText('95%')).toBeInTheDocument();
  });

  it('fires callbacks on button click', () => {
    const onNext = vi.fn();
    const onRestart = vi.fn();
    const onChangeMode = vi.fn();
    render(
      <ResultsPanel
        result={result}
        onNext={onNext}
        onRestart={onRestart}
        onChangeMode={onChangeMode}
      />,
    );
    fireEvent.click(screen.getByText('Next test'));
    fireEvent.click(screen.getByText('Restart'));
    fireEvent.click(screen.getByText('Change mode'));
    expect(onNext).toHaveBeenCalled();
    expect(onRestart).toHaveBeenCalled();
    expect(onChangeMode).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run**

```bash
pnpm test tests/components/ResultsPanel.test.tsx
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -S -m "feat(typing): add ResultsPanel with stats and actions"
```

---

## Task 19: `/single-player` page — wiring everything together

**Files:**
- Create: `src/app/single-player/page.tsx`

This is the integration point. It handles:
1. Config state (initialized from `loadConfig`, persisted via `saveConfig`).
2. Source generation: `pickPassage` or `pickWords`, joined into a single source string.
3. Three visual states (idle/running/finished) driven by engine state.
4. Keyboard shortcut wiring on the results screen (`Tab+Enter` → next, `Esc` → restart).
5. Paste-blocked toast.
6. Remount key: when config or "regen" counter changes, we remount the inner component so `useTypingEngine` starts with a fresh engine.

- [ ] **Step 1: Implement**

```tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LiveWpm } from '@/components/typing/LiveWpm';
import { ModeSelector, type TestConfig } from '@/components/typing/ModeSelector';
import { ResultsPanel } from '@/components/typing/ResultsPanel';
import { TypingSurface } from '@/components/typing/TypingSurface';
import { pickPassage, pickWords } from '@/lib/content/select';
import type { EngineConfig } from '@/lib/engine';
import { useTypingEngine } from '@/hooks/useTypingEngine';
import { DEFAULT_CONFIG, loadConfig, saveConfig } from '@/lib/storage/config';

const INITIAL_WORDS_COUNT = 80; // generous buffer for time mode

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
  // words mode
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

export default function SinglePlayerPage() {
  const [config, setConfig] = useState<TestConfig>(() => {
    const c = DEFAULT_CONFIG;
    return {
      mode: c.mode,
      fixedLength: c.fixedLength,
      timeDuration: c.timeDuration,
      wordsCount: c.wordsCount,
      difficulty: c.difficulty,
    };
  });
  const [regenKey, setRegenKey] = useState(0);
  // On mount, adopt stored config (without causing hydration mismatch).
  useEffect(() => {
    const stored = loadConfig();
    setConfig({
      mode: stored.mode,
      fixedLength: stored.fixedLength,
      timeDuration: stored.timeDuration,
      wordsCount: stored.wordsCount,
      difficulty: stored.difficulty,
    });
  }, []);

  const handleConfigChange = useCallback((next: TestConfig) => {
    setConfig(next);
    saveConfig(next);
    setRegenKey((k) => k + 1);
  }, []);

  const engineConfig = useMemo(
    () => buildEngineConfig(config, regenKey),
    [config, regenKey],
  );

  // Remount the runner whenever the engine config identity changes.
  // A React `key` on the runner forces a fresh engine instance.
  return (
    <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-4xl flex-col gap-8 px-6 py-10">
      <ModeSelector value={config} onChange={handleConfigChange} />
      <Runner
        key={`${regenKey}:${engineConfig.mode}`}
        engineConfig={engineConfig}
        modeConfig={config}
        onRegenerate={() => setRegenKey((k) => k + 1)}
      />
    </section>
  );
}

interface RunnerProps {
  engineConfig: EngineConfig;
  modeConfig: TestConfig;
  onRegenerate: () => void;
}

function Runner({ engineConfig, modeConfig, onRegenerate }: RunnerProps) {
  const { state, result, handlers, reset, extendSource, onPasteBlocked } =
    useTypingEngine(engineConfig);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const [pasteToast, setPasteToast] = useState(false);

  // Auto-focus the invisible input on mount and whenever we reset.
  useEffect(() => {
    inputRef.current?.focus();
  }, [state.status]);

  // Re-focus on click anywhere in the typing area.
  const handleClick = useCallback(() => inputRef.current?.focus(), []);

  // Paste toast wiring.
  useEffect(() => {
    onPasteBlocked(() => {
      setPasteToast(true);
      setTimeout(() => setPasteToast(false), 1600);
    });
  }, [onPasteBlocked]);

  // Extend source for time mode when engine signals low.
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

  // Results screen keyboard shortcuts.
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
        <ResultsPanel
          result={result}
          onNext={onRegenerate}
          onRestart={reset}
          onChangeMode={onRegenerate}
          nextButtonRef={nextBtnRef}
        />
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

Notes:
- The invisible input is absolutely positioned off-screen but receives focus. `onBlur` re-focuses so the user can't accidentally lose focus by clicking outside.
- Remount on config change is triggered by the `key` prop on `<Runner>`. When `regenKey` or `engineConfig.mode` changes, `<Runner>` is unmounted and remounted, giving it a fresh engine via `useTypingEngine`'s ref-initialized-once behavior.
- `onChangeMode` in this design is effectively "regenerate" — the distinction in the spec was that "Change mode" returns to the idle state with current config preserved. Since clicking a `ModeSelector` option already triggers `onRegenerate` and shows the idle state, the separate button offers a manual path to the same result.

- [ ] **Step 2: Dev server smoke**

```bash
pnpm dev --port 3100 &
DEV_PID=$!
sleep 4
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:3100/single-player
kill $DEV_PID 2>/dev/null || true
```

Expected: `200`.

- [ ] **Step 3: Typecheck + lint + all tests**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -s -S -m "feat(app): add /single-player page integrating engine, modes, and results"
```

---

## Task 20: Production build verification

- [ ] **Step 1: Build**

```bash
pnpm build
```

Expected: successful build; no errors. Next will print route sizes for `/` and `/single-player`.

- [ ] **Step 2: Start production server and smoke**

```bash
pnpm start --port 3100 &
SRV_PID=$!
sleep 4
curl -sS -o /dev/null -w "/: %{http_code}\n" http://localhost:3100/
curl -sS -o /dev/null -w "/single-player: %{http_code}\n" http://localhost:3100/single-player
kill $SRV_PID 2>/dev/null || true
```

Expected: both return `200`.

- [ ] **Step 3: No commit if step passes cleanly; if any build warnings worth addressing, fix and commit.**

---

## Task 21: Manual browser verification via Playwright MCP

Open a headless browser session via the Playwright MCP and verify the golden path of each mode and key edge cases.

- [ ] **Step 1: Start dev server in background**

```bash
pnpm dev --port 3100 &
```

- [ ] **Step 2: Drive Playwright MCP through the following scenarios**

Each scenario should be exercised and a result logged:

1. **Landing page** — navigate to `http://localhost:3100/`; verify hero and CTA render; click CTA → lands on `/single-player`.
2. **Fixed mode golden path** — select `mode=fixed`, `length=short`; type the entire passage correctly; verify `Results` panel appears with WPM + accuracy.
3. **Time mode golden path** — select `mode=time`, `duration=15`; type anything; wait 16s; verify test ends and results display.
4. **Words mode golden path** — select `mode=words`, `count=10`; type 10 correct space-separated words; verify results.
5. **Backspace correction** — in fixed mode, type a wrong char, backspace, type correct char; verify test can complete.
6. **Paste blocked** — attempt paste into the typing input; verify "Paste is disabled" toast appears.
7. **Theme toggle** — click toggle in header/footer; verify `html[data-theme]` flips; reload page; verify preference persists.
8. **Mobile viewport** — resize to 375x812; verify no horizontal scroll and no overlap.

Playwright MCP drives the browser and can execute `browser_navigate`, `browser_type`, `browser_press_key`, `browser_click`, `browser_snapshot`, `browser_resize`. Combine as needed.

- [ ] **Step 3: Stop dev server**

```bash
lsof -ti:3100 | xargs -r kill 2>/dev/null || true
```

- [ ] **Step 4: Document results**

Append a short verification note to this plan file (or to a dated test report) listing each scenario and Pass/Fail.

---

## Task 22: README + final polish

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md`**

```markdown
# typing-speed

A typing speed game. Single-player (Phase 1) with realtime multiplayer and accounts planned for later phases.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4
- Biome (lint + format)
- Vitest (+ RTL) for unit and smoke tests
- pnpm

## Scripts

- `pnpm dev` — dev server
- `pnpm build` — production build
- `pnpm start` — production server (run after `pnpm build`)
- `pnpm lint` — Biome check
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm test` — Vitest
- `pnpm e2e` — Playwright (scaffolded; no tests yet)

## Current Phase

**Phase 1** — single-player typing test. See `docs/superpowers/specs/2026-04-19-phase-1-single-player-design.md`.

## Project Structure

See the spec.
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -s -S -m "docs: update README with phase 1 status and scripts"
```

---

## Self-Review Checklist

The implementer (or reviewer) should confirm after finishing:

- **Spec coverage:**
  - [ ] All three modes implemented (fixed/time/words) — Tasks 6, 19
  - [ ] Free mode + unrestricted backspace — Tasks 6, 11
  - [ ] Tech stack matches spec — Tasks 1, 2, 3
  - [ ] First-keystroke start, auto-focus — Task 19
  - [ ] Toggleable fixed-mode length — Task 17
  - [ ] Difficulty tiers for time/words — Tasks 7, 9, 17
  - [ ] Tab+Enter = Next, Esc = Restart — Task 19
  - [ ] localStorage persists config — Tasks 10, 19
  - [ ] Dark default + light toggle — Tasks 3, 13
  - [ ] 60 passages + tiered word lists — Tasks 7, 8
  - [ ] Mobile responsive (layout only) — Task 21 check
  - [ ] Paste blocked — Task 19
  - [ ] Live WPM + per-mode secondary — Task 16
  - [ ] Results: WPM, accuracy, raw WPM, time, char breakdown — Task 18
  - [ ] Engine is framework-free — Tasks 4, 5, 6
  - [ ] Engine seeded selection for Phase 3 — Task 9
- **Quality gates all green:**
  - [ ] `pnpm lint`
  - [ ] `pnpm typecheck`
  - [ ] `pnpm test`
  - [ ] `pnpm build`
- **Browser verification:** Task 21 scenarios all Pass.

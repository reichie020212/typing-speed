# Phase 1 — Single-Player Core (Design Spec)

**Date:** 2026-04-19
**Scope:** Single-player typing test only. No accounts, no database, no realtime multiplayer, no leaderboards.
**Phases to follow (out of scope for this spec):**
Phase 2 = auth + persistence + dashboard/leaderboards/profiles;
Phase 3 = realtime multiplayer (Socket.io);
Phase 4 = polish (AdSense, mobile optimization, deploy).

## 1. Product Goals

Phase 1 ships a production-quality typing test with three modes (fixed passage, time, word count), in-app results, and bundled content. It is fully functional standalone — a user can land on `/`, take a test, and see their WPM and accuracy. Nothing is persisted server-side.

The typing engine built in Phase 1 is reused verbatim in Phase 3 (multiplayer), so its architecture is the central design concern.

## 2. Feature Decisions

| Decision | Value | Rationale |
|---|---|---|
| Test modes | `fixed`, `time`, `words` — all three, selectable at test setup | Covers the full competitive-typing convention set |
| Typing behavior | Free mode (wrong chars shown red, cursor advances); unrestricted backspace | Industry default (Monkeytype, Typeracer); forgiving; doesn't block flow |
| In-progress feedback | Live WPM always; timer only in `time` mode | Motivating without over-correcting; unused numbers are clutter |
| Test start | First keystroke on an auto-focused input; no Start button, no countdown | Zero-friction entry |
| Passage lengths | Short (~25 words), Medium (~50), Long (~100); user-selectable for `fixed` | Matches spec's `fixed mode` flavor |
| Word difficulty | Easy (top 200), Medium (top 1000), Hard (top 5000 + light punctuation) | Applies to `time` and `words` modes only; `fixed` uses curated passages |
| Keyboard shortcuts | `Tab`+`Enter` → Next test (new content, same config); `Esc` → Restart same (same content); `Tab` swallowed during typing to keep focus | Monkeytype convention |
| Persistence | `localStorage` for last-used mode/length/duration/difficulty/theme | Zero-cost UX win |
| Landing page | Phase-1-only: hero + single "Start typing test" CTA | Redesigning the landing when auth and multiplayer ship is planned — avoid advertising vapor now |
| Visual style | Monkeytype-minimal typing surface + Typeracer-practical chrome; dark default with light toggle | Hybrid: get out of the way during the test, friendly elsewhere |
| Mobile | Responsive layout, unoptimized soft-keyboard handling; revisit in Phase 4 | Typing on phones is inherently painful; Phase 1 is desktop-first |

## 3. Tech Stack

- **Framework:** Next.js 15+ (App Router), React 19+
- **Language:** TypeScript with `strict: true`
- **Styling:** Tailwind CSS v4 + CSS custom properties for theme tokens
- **Package manager:** pnpm
- **Lint/format:** Biome (single binary, replaces ESLint + Prettier)
- **Unit tests:** Vitest + `@testing-library/react` for light component smoke
- **E2E:** Playwright (scaffolded, zero tests in Phase 1)

No database, no auth, no server routes, no realtime infra in Phase 1.

## 4. Project Structure

```
typing-speed/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx            # root layout, theme provider, global CSS
│  │  ├─ page.tsx              # / landing
│  │  ├─ single-player/
│  │  │  └─ page.tsx           # /single-player — test + results inline
│  │  └─ globals.css           # Tailwind base + CSS vars
│  ├─ components/
│  │  ├─ ui/                   # primitives (Button, Select, Toggle)
│  │  ├─ typing/
│  │  │  ├─ TypingSurface.tsx
│  │  │  ├─ LiveWpm.tsx
│  │  │  ├─ ModeSelector.tsx
│  │  │  └─ ResultsPanel.tsx
│  │  └─ chrome/               # header, footer, theme toggle
│  ├─ lib/
│  │  ├─ engine/
│  │  │  ├─ index.ts           # public API
│  │  │  ├─ engine.ts          # TypingEngine (pure TS, no React)
│  │  │  ├─ metrics.ts         # WPM, accuracy, raw WPM
│  │  │  └─ types.ts           # EngineState, Mode, Config, Result
│  │  ├─ content/
│  │  │  ├─ passages.ts        # 60 curated passages
│  │  │  ├─ words.ts           # easy / medium / hard word arrays
│  │  │  └─ select.ts          # pickPassage, pickWords (seeded)
│  │  └─ storage/
│  │     └─ config.ts          # localStorage wrapper
│  └─ hooks/
│     └─ useTypingEngine.ts    # React wrapper around engine module
├─ tests/
│  ├─ unit/
│  └─ e2e/                     # scaffolded, empty in Phase 1
├─ docs/superpowers/specs/     # design specs
├─ public/
├─ package.json
├─ tsconfig.json
├─ biome.json
├─ tailwind.config.ts
├─ next.config.ts
├─ vitest.config.ts
├─ playwright.config.ts
└─ .env.example                # empty placeholders for Phase 2+
```

## 5. Typing Engine

The engine is the reusable core and is kept **framework-free** (no React imports). Phase 3 will drive the same engine from Socket.io events on both clients.

### 5.1 Public API

```ts
export type Mode = 'fixed' | 'time' | 'words';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface EngineConfig {
  mode: Mode;
  source: string;              // fixed: the passage; time/words: pre-rendered word stream
  duration?: number;           // time mode, seconds
  wordCount?: number;          // words mode, target count
}

export interface EngineState {
  status: 'idle' | 'running' | 'finished';
  input: string;               // chars typed so far
  cursor: number;              // index into input (== input.length except after backspace sequences)
  startedAt: number | null;    // epoch ms, set on first input call
  endedAt: number | null;
  timeline: KeyEvent[];        // per-keystroke log
  needMoreWords?: boolean;     // time mode: true when stream is running low
}

export interface KeyEvent {
  t: number;                   // ms since startedAt
  char: string;                // the char typed, or '' for backspace
  kind: 'input' | 'backspace';
  correct: boolean;            // was the char at this cursor position the expected one
}

export interface Result {
  wpm: number;                 // net
  rawWpm: number;
  accuracy: number;            // 0..1
  chars: {
    correct: number;
    incorrect: number;
    extra: number;
    missed: number;
  };
  durationMs: number;
}

export function createEngine(config: EngineConfig): TypingEngine;

export interface TypingEngine {
  input(char: string): void;
  backspace(): void;
  tick(nowMs: number): void;        // time mode end-check
  extendSource(moreChars: string): void;  // time mode: hook tops up word stream
  reset(): void;
  getState(): EngineState;
  getResult(): Result;              // throws if status !== 'finished'
  subscribe(listener: (s: EngineState) => void): () => void;
}
```

### 5.2 State Transitions

- `idle → running` on first `input(char)` call (sets `startedAt = Date.now()`).
- `running → finished`:
  - `fixed`: `input.length === source.length` AND every index matches.
  - `time`: `tick(now)` detects `now - startedAt >= duration * 1000`.
  - `words`: number of *completed* words in `input` equals `wordCount`. A word is completed when followed by a space that matches a space in `source`.
- `finished → idle` on `reset()`.

### 5.3 Input Rules

- Accepts any single printable character via `input(char)`. Non-printable keys are filtered at the hook layer, not the engine.
- **Correct char:** `char === source[cursor]` at current cursor. Advance cursor.
- **Incorrect char:** recorded as `incorrect`, cursor still advances.
- **Extra chars past a word boundary** (only meaningful in `fixed`/`words`): tracked as `extra`; do NOT end the test; user must backspace past them to complete.
- **Backspace** always permitted; decrements cursor; at `cursor === 0` it is a no-op. Recorded as a keystroke in the timeline.
- **Paste:** engine has no paste concept. Hook layer intercepts `paste` events on the input element and calls `preventDefault`; a tiny toast appears ("Paste is disabled").

### 5.4 Metrics

- **Net WPM** = `(correctChars / 5) / (durationMs / 60000)`, where `correctChars` = chars that matched `source` at the position they were typed.
- **Raw WPM** = `(totalKeystrokesAsInput / 5) / (durationMs / 60000)` — includes wrong chars; excludes backspaces.
- **Accuracy** = `correctChars / totalKeystrokes`. `totalKeystrokes` counts every `input()` and `backspace()` call (Monkeytype's definition).
- **Char breakdown:**
  - `correct`: chars typed correctly at position.
  - `incorrect`: chars typed that didn't match the expected char.
  - `extra`: chars typed beyond the end of a word (fixed/words only; always 0 in time mode).
  - `missed`: source chars the user passed over without correct input (produced when a wrong char consumes a position; with backspace-allowed this is rare but tracked for completeness).
- **Zero-duration guard:** if `durationMs === 0` (shouldn't happen but defensive), return `wpm = 0`, not `NaN`.

### 5.5 Hook Wrapper (`useTypingEngine`)

```ts
function useTypingEngine(config: EngineConfig): {
  state: EngineState;
  result: Result | null;
  handlers: {
    onKeyDown: (e: React.KeyboardEvent) => void;
    onBeforeInput: (e: React.FormEvent) => void;
    onPaste: (e: React.ClipboardEvent) => void;
  };
  reset(): void;
};
```

Responsibilities:
- Mirror engine state to React via `useSyncExternalStore`.
- Run a `requestAnimationFrame` loop while `status === 'running'` that calls `engine.tick(performance.now())`.
- Filter DOM key events: only printable chars reach `engine.input`; `Backspace` → `engine.backspace`; `Tab` swallowed during running; paste blocked.
- For `time` mode: when `state.needMoreWords === true`, call `engine.extendSource(nextWordsChunk)` with ~25 more words.

## 6. UI Surfaces

### 6.1 `/` Landing

- Server component. Full-viewport hero, centered.
- Heading (placeholder copy: "Typing Speed"), one-line subhead, primary CTA button → `/single-player`.
- Thin header (wordmark + theme toggle). Tiny footer (version, theme toggle).
- Dark default.

### 6.2 `/single-player` Test Page

Client component. Single route, three visual states driven by `EngineState.status`.

**Idle state:**
- Mode selector: `fixed | time | words`.
- Contextual secondary controls:
  - `fixed` → length (short / medium / long).
  - `time` → duration (15 / 30 / 60 s).
  - `words` → count (10 / 25 / 50 / 100).
- Difficulty tier (easy / medium / hard) visible for `time` and `words`; greyed out with label "passage" for `fixed`.
- A dimmed preview of the first few words of the content appears center-stage.
- Hint text below: "press any key to start".

**Running state:**
- Selector collapses to a breadcrumb-style line summarizing config ("30s · medium").
- `TypingSurface` center stage: passage/word stream rendered as individual `<span>` chars with position-based classes (`done-correct`, `done-incorrect`, `current`, `upcoming`, `extra`).
- Container width `max-w-[56ch]`, three visible lines at a time. Once the user finishes the first line, each subsequent line advance smoothly scrolls the surface up by one line-height, so the currently-typed line is always the middle of the three visible lines. The first line of the passage stays at the top until the user has progressed past it.
- `LiveWpm` in a corner:
  - `time` mode: "WPM: 68 · 0:18".
  - `words` mode: "WPM: 68 · 23 / 50".
  - `fixed` mode: "WPM: 68" only (no countdown).
- Invisible focused `<input>` receives all key events.

**Finished state:**
- `TypingSurface` fades/dims.
- `ResultsPanel` displayed:
  - Large: WPM (primary), Accuracy (primary).
  - Smaller row: Raw WPM, Time, correct / incorrect / extra / missed counts.
  - Buttons: **Next test** (focused by default; new content, same config — activated by `Tab`+`Enter`). **Restart** (same content; activated by `Esc`). **Change mode** (returns to idle with current config preserved).

### 6.3 Chrome

- Thin top header: wordmark (link to `/`), theme toggle right-aligned. No nav links in Phase 1.
- Tiny footer: version, theme toggle (duplicated for reach), GitHub link placeholder.

### 6.4 Theme

- CSS custom properties on `<html>`: `--bg`, `--fg`, `--muted`, `--accent`, `--danger`, `--success`, `--border`.
- `html[data-theme="dark"]` (default) and `html[data-theme="light"]`.
- Theme toggle writes `data-theme` attribute and persists to `localStorage`.
- Fonts: system stack for chrome; Geist Mono on the typing surface only (bundled via `next/font`).

## 7. Content

### 7.1 Passages (60 total)

`src/lib/content/passages.ts` exports a single `PASSAGES: Passage[]` array:

```ts
interface Passage {
  id: string;
  text: string;
  length: 'short' | 'medium' | 'long';
  source?: string;
}
```

- 20 short (~25 words), 30 medium (~50 words), 10 long (~100 words).
- Mix of public-domain quotes, ordinary English prose, and pangrams.
- All text normalized to plain ASCII (straight quotes, hyphens; no smart punctuation, no non-ASCII).
- Content review pass required before merge: typos, unintended slurs/politics, encoding. Noted in the spec/PR.

### 7.2 Word Lists

`src/lib/content/words.ts` exports three arrays:

- `WORDS_EASY` — top 200 English words, lowercase, no punctuation.
- `WORDS_MEDIUM` — top 1000, same format.
- `WORDS_HARD` — top 5000; selection logic occasionally appends `,`, `.`, `;`, `'` to simulate prose.

Sourced from a public-domain word-frequency list. Stored as plain TS arrays; no runtime fetch.

### 7.3 Selection

`src/lib/content/select.ts`:

```ts
export function pickPassage(opts: { length: 'short'|'medium'|'long'; seed?: string }): Passage;
export function pickWords(opts: { tier: Difficulty; count: number; seed?: string }): string[];
```

Seeded RNG (mulberry32 or similar) when `seed` is provided; `Math.random` otherwise. Seeded selection is used in Phase 3 so both racers get the same passage from the race code.

## 8. Storage

`src/lib/storage/config.ts` wraps `localStorage` with:

```ts
interface UserConfig {
  mode: Mode;
  fixedLength: 'short'|'medium'|'long';
  timeDuration: 15|30|60;
  wordsCount: 10|25|50|100;
  difficulty: Difficulty;
  theme: 'dark'|'light';
}

export function loadConfig(): UserConfig;      // returns defaults on missing/invalid JSON
export function saveConfig(patch: Partial<UserConfig>): void;
```

Corrupt JSON falls back to defaults silently — this is an internal boundary, not a user-facing error surface.

## 9. Testing

### 9.1 Unit Tests (Vitest)

Targets with coverage goals:
- `src/lib/engine/**` — 100% line + branch.
- `src/lib/engine/metrics.ts` — 100%.
- `src/lib/content/select.ts` — 100%.
- `src/lib/storage/config.ts` — 100%.

Required test cases:
- State transitions: `idle→running` on first char; `running→finished` for each mode's end condition; `finished→idle` after `reset`.
- Input: correct char, wrong char, extra char beyond word, backspace at cursor 0 is no-op, backspace across completed words.
- Metrics: WPM formula on known inputs, raw vs net differ when wrong chars present, accuracy denominator includes backspaces, zero-duration returns 0 not NaN.
- End conditions: fixed requires full match AND full length; time ends on tick past duration; words ends at exactly N completed words.
- Seeded selection: same seed → same pick, deterministic across runs.
- Storage: config round-trip; corrupt JSON falls back to defaults.

### 9.2 Component Smoke (Vitest + RTL)

Light — just wiring regressions:
- `TypingSurface` renders spans with correct classes for a given state.
- `ResultsPanel` renders given numbers.
- `ModeSelector` updates config on click.

### 9.3 E2E

Scaffold `playwright.config.ts`. Zero tests in Phase 1.

### 9.4 Manual Verification

Before declaring Phase 1 complete, run `pnpm dev` and exercise:
- Golden path for each mode.
- Paste blocked, toast appears.
- Tab handling in running state keeps focus; in results state `Tab`+`Enter` triggers Next test (new content); `Esc` triggers Restart (same content).
- Theme toggle persists across reload.
- Each mode's end condition behaves as specified.
- localStorage survives reload (last config restored).
- One mobile-viewport pass (layout doesn't break; soft-keyboard not solved but page is usable).

### 9.5 Quality Gates (all must pass before commit)

- `pnpm lint` (Biome).
- `pnpm typecheck` (`tsc --noEmit`).
- `pnpm test` (Vitest).
- `pnpm build` (Next.js production build).

## 10. Deploy Readiness

- `next.config.ts` with no custom server — works on Vercel out of the box.
- `.env.example` contains empty placeholders for Phase 2+ (`DATABASE_URL`, `NEXTAUTH_*`, `GOOGLE_*`).
- No server-runtime dependencies in Phase 1; the whole app is static + a small client bundle.
- **No actual deploy happens in Phase 1 execution** unless explicitly requested. The deploy-readiness bar is met when `pnpm build` succeeds and the app runs correctly locally.

## 11. Out of Scope (Explicitly Deferred)

- Auth, user accounts, database, Prisma (→ Phase 2).
- Leaderboards, dashboard, profiles, history, Recharts (→ Phase 2).
- Multiplayer, Socket.io, race codes, realtime progress (→ Phase 3).
- AdSense, mobile soft-keyboard handling, SEO metadata polish, actual Vercel deploy (→ Phase 4).
- WPM-over-time sparkline on results (→ Phase 2 when Recharts is in).
- Share-result button (→ Phase 2 or later).
- Product name and final branding (→ to be decided; "Typing Speed" is a placeholder throughout Phase 1).

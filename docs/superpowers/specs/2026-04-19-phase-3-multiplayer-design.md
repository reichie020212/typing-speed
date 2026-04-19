# Phase 3 — Realtime Multiplayer Design

**Status:** Approved 2026-04-19
**Depends on:** Phase 1 (engine, passages), Phase 2a (auth, users, `Result` table)
**Deliverables:** `/race` entry page, `/race/create`, `/race/[code]` lobby + race + results, standalone Socket.io server, race persistence.

---

## 1. Scope and Non-Goals

### In scope (v1)

- Realtime multiplayer races over WebSocket.
- Fixed-passage races only: one curated passage from the Phase 1 pool per race.
- Mixed rooms: authenticated users and anonymous guests race together.
- Host-controlled start with 5-second server-driven countdown.
- Up to 8 players per race.
- Tail-window end condition: race ends when all finish OR 60s after first finish.
- Authenticated participants' race results save to the database and appear in dashboard / leaderboard / history; guests see results on-screen only.
- "Sign in to save this result" nudge on the results screen for guest finishers.
- Graceful degradation when `NEXT_PUBLIC_RACE_SERVER_URL` is not configured.

### Out of scope (explicit non-goals)

- Time-mode and words-mode multiplayer races (fixed-passage only for v1).
- Spectator mode, rematch button, friends list, private rooms with passwords.
- Live cursors or per-character opponent progress (progress is tracked at coarse ~10/sec granularity).
- Anticheat / server-side metric verification (client-reported metrics trusted for v1; documented as a limitation).
- Race chat.
- Reconnect-to-active-race (a disconnect during `racing` is terminal → DNF).
- E2E Playwright tests (scaffold exists, writing the two-context race test deferred to Phase 4).

## 2. Architecture

### High-level

Two independently deployed services:

1. **Next.js app on Vercel** — page rendering, auth, historical reads, race *creation* (not race *orchestration*). Unchanged role from Phases 1–2.
2. **Standalone Node/Socket.io server on Railway** (same repo, `server/` directory) — authoritative in-memory race state, broadcasts, race-result writes.

Both services connect directly to the same Neon Postgres database. They communicate only indirectly: Next.js mints short-lived HMAC-signed tokens that the Socket.io server verifies on socket handshake.

### Why a separate server

Vercel's serverless runtime does not support long-lived WebSocket connections. Managed realtime services (Pusher, Ably) push authoritative race state into an awkward shape where Vercel routes would still mediate every state transition. Cloudflare Durable Objects are a second runtime with its own dev/deploy story, adding disproportionate surface area for a hobby-stage project.

A plain Node/Socket.io server gives full control over race state, reuses Phase 1's framework-agnostic engine directly, and keeps the mental model simple.

### Shared code between Next.js and the server

Both sides import from the same paths:

- `src/lib/engine/` — the Phase 1 typing engine (used client-side by racers; server does not rerun metrics per-keystroke).
- `src/lib/content/passages.ts` — curated passages; server picks one when creating a race.
- `src/lib/db/client.ts` — Prisma client singleton.
- `src/lib/race/` — *new* shared module (events, validation, state machine, code generator, nickname rules, token mint/verify).

The `server/` directory has its own `tsconfig.json` extending the root to get the same `@/*` path aliases.

### Graceful degradation

If `NEXT_PUBLIC_RACE_SERVER_URL` is unset, the `/race/*` pages render a "Multiplayer not configured yet" notice identical in spirit to Phase 2a's auth-missing notice. Single-player and Phase 2 routes keep working.

## 3. Race Lifecycle

Four server-authoritative phases. The server is the sole source of truth; clients render whatever phase/roster snapshot the server broadcasts.

```
waiting  →  countdown  →  racing  →  ended
   │
   └──→  canceled   (host aborts before start, all players leave, or creation-timeout)
```

### waiting

- Lobby. Players join; roster broadcasts on every join/leave.
- Host sees a "Start race" button, enabled only once ≥1 other player has joined.
- Non-hosts see "Waiting for host to start."
- If the host disconnects, the longest-connected remaining player is promoted to host (a toast notifies the room).
- If all players leave, the room is purged immediately.
- **Creation timeout:** if no start within 10 minutes of creation, race is marked `canceled` and purged.

### countdown

- 5-second server-driven countdown, ticked at 1s intervals to the room.
- Room is **locked** against new joins. Late arrivals hitting `/race/[code]` see "Race already started, try another."
- Passage is revealed to all clients when countdown starts (so racers can read ahead).
- Typing input is visible but disabled until countdown hits 0.
- Players who disconnect during countdown are dropped from the roster.

### racing

- Clients run the Phase 1 typing engine locally.
- Each client emits throttled `progress` events at **≤10/sec** with `{ charIndex, wpm, accuracy }`.
- Server rebroadcasts a deduped roster snapshot to the room at **≤10/sec** (events coalesce if multiple arrive in one frame).
- When a client's engine signals completion, it emits `finish` with final metrics. Server assigns `finishPosition` (1-based, in order received) and writes to the database.
- **Dual-write on finish for authenticated players:** one `RaceParticipant` row + one `Result` row (with `raceId` FK set). Guests get only the `RaceParticipant` row.
- Server broadcasts the participant's finish update to the room.

### ended

- Entered when either (a) every player has reported `finish`, or (b) 60 seconds have elapsed since the first finish (**tail window**).
- Any still-typing client receives `raceEnded` and is recorded as DNF (status `'dnf'`, `finishPosition: null`).
- The results screen renders from the broadcast `ended` payload.
- The `Race` row stays in the database indefinitely; the in-memory room is purged **5 minutes** after `ended` so stragglers can refresh the results page. After purge, visiting `/race/[code]` falls back to reading the settled `Race` + `RaceParticipant` rows from Postgres.

### Server restart during active race

- In-memory state is lost; there is no crash-resilient race state for v1.
- Startup sweep: on boot, the server queries races with `status = 'racing'` and `startedAt > now - 10 min` and marks their open participants DNF.
- Clients auto-reconnect to find no room and render "Race server restarted — race canceled."

## 4. Data Model

All additions are additive. No destructive changes to Phase 2 schema.

### New enum

```prisma
enum RaceStatus {
  waiting
  countdown
  racing
  ended
  canceled
}
```

### New table: `Race`

One row per created race. Lives forever.

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | pk |
| `code` | `String @unique` | 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I), uppercase; URL and display form |
| `passageId` | `String` | references the curated passage ID from `src/lib/content/passages.ts` |
| `difficulty` | `Difficulty` | passage difficulty chosen at creation |
| `status` | `RaceStatus` | final status when race settled; `canceled` if aborted |
| `createdById` | `String?` | fk → `User.id`; null if an anonymous user created the race |
| `createdAt` | `DateTime @default(now())` | |
| `startedAt` | `DateTime?` | set on `countdown → racing` transition |
| `endedAt` | `DateTime?` | set on transition to `ended` or `canceled` |

Indexes:
- `code` unique
- `[createdById, createdAt DESC]` (for a future "my races" list; cheap to add now)

### New table: `RaceParticipant`

One row per person who finished or DNF'd. Authoritative per-race record; holds both guests and authenticated users.

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | pk |
| `raceId` | `String` | fk → `Race.id`, `onDelete: Cascade` |
| `userId` | `String?` | fk → `User.id`; null for guests |
| `nickname` | `String` | always set. For logged-in users, their username *at race time* (frozen) |
| `finishPosition` | `Int?` | 1-based; null for DNF |
| `status` | `String` | `'finished'` or `'dnf'` (not an enum — two values only, no schema churn if we add `'abandoned'` later) |
| `wpm` | `Float` | |
| `rawWpm` | `Float` | |
| `accuracy` | `Float` | |
| `durationMs` | `Int` | time from race start to finish (or DNF time) |
| `createdAt` | `DateTime @default(now())` | |

Indexes:
- `[raceId, finishPosition]` (results ordering)
- `[userId, createdAt DESC]` (per-user race history)

### Existing table: `Result` — additive column

```prisma
raceId  String?  // nullable fk → Race.id
@@index([raceId])
```

Null for solo tests (every existing row). Set for tests that were part of a race.

### Why dual-write

When an authenticated player finishes or DNFs a race, the server writes to both `RaceParticipant` (race-centric view) and `Result` (user-centric view, with `raceId` set and `mode = 'fixed'`). Guests get only the `RaceParticipant` row.

Alternative considered: store race results *only* in `RaceParticipant` and `UNION` into Phase 2 leaderboard/dashboard queries. Rejected because Phase 2's tuned `$queryRaw` leaderboard logic already works and is tested; rewriting it to union a second table is a breaking refactor that adds no feature value. Double-writing one row per logged-in finisher is cheap, and each table keeps a single clean responsibility:

- `Result` = "this user's typing tests" (solo + race, leaderboard-eligible).
- `RaceParticipant` = "who was in this race" (includes guests).

History row rendering adds a small visual hint when `raceId` is set (e.g. a flag icon + "Raced vs N others").

## 5. Auth and Identity

### Problem

The Socket.io server runs on Railway; Next.js runs on Vercel. NextAuth's JWT session cookie is domain-scoped to Vercel and isn't trivially decodable by a separate Node server. The Socket.io server needs to know *who* is connecting without sharing NextAuth internals.

### Solution — short-lived HMAC tokens

A shared secret `RACE_SERVER_SECRET` lives in env vars on both Vercel and Railway.

**Mint (Next.js):** `POST /api/race/token` reads the NextAuth session and, if present, returns a JWT signed with `HS256` using the shared secret. Payload: `{ userId, username, exp }` where `exp = now + 5 minutes`. Implemented with `jose` (already a NextAuth transitive dep, no new dependency).

**Verify (Socket.io server):** Client passes the token in handshake: `io(url, { auth: { token } })`. Server verifies signature + `exp` against the shared secret; on success binds `{ userId, username }` to the socket. On failure, handshake is rejected.

**Anonymous path:** Client omits `token` and sends `{ nickname }` in handshake instead. Server validates the nickname (see below), assigns a short per-socket `guestId`, and treats the socket as a guest.

### Nickname validation

- Length: 1–16 chars after trim.
- Pattern: `/^[A-Za-z0-9 _-]+$/`.
- Profanity: filtered against the same blocklist used in Phase 1's word curation (`src/lib/content/blocklist.ts`).
- Reserved prefix: `Guest-` is reserved for server-auto-assigned names and rejected for user input.
- On invalid nickname, handshake is rejected with a specific error code the UI renders inline ("Nicknames must be 1–16 letters, numbers, spaces, dashes, or underscores").
- Client persists last-used nickname to `localStorage`, but server re-validates on every connect.

### Frozen username at race time

The token payload's `username` (for authenticated users) is stamped into `RaceParticipant.nickname` at finish time. If a user renames later via Phase 2a, old race rows keep the old name — matching how we already treat historical `Result` rows.

### Same user, multiple tabs

- **Authenticated:** deduped by `userId` per race. Opening a second tab kicks the first connection out of the room (second-wins).
- **Guest:** each `guestId` is independent. Opening two tabs joins twice as two distinct guests. Acceptable because guests are ephemeral.

### Secret rotation

Rotating `RACE_SERVER_SECRET` is a coordinated env-var swap on both Vercel and Railway. The 5-minute token TTL bounds the worst-case in-flight overlap.

## 6. UX Surfaces

Four pages plus one modal. All use the existing Tailwind v4 theme and match Phase 2 chrome.

### `/race` — entry

Two cards side-by-side:

- **"Create a race":** picks passage difficulty (easy / medium / hard) and length (short / medium / long) via the same selectors used on `/single-player`. Submit → `POST /api/race` (creates Race row + generates code) → redirects to `/race/[code]` as host.
- **"Join a race":** 6-char code input. On submit navigates to `/race/[CODE]`.

Below the cards: a one-line explainer ("Type against friends. Share a code. First to finish wins.") and, if signed out, a subtle link "Sign in to save your race results."

### `/race/[code]` — one-page state machine

Renders one of four sub-views based on the live phase broadcast. No client routing between phases — same URL throughout. Phase reflected by a component switch inside `src/app/race/[code]/client.tsx`.

**Lobby (`waiting`):**
- Roster list: avatar/initial + display name, host badge on one row.
- Race code shown large and monospace with a "Copy link" button (copies `{origin}/race/{code}`).
- Host sees primary "Start race" button (disabled until ≥1 other player joins).
- Non-hosts see "Waiting for host to start."
- Bottom-corner "Leave race" link.

**Countdown (`countdown`):**
- Roster stays visible.
- Passage preview fades in.
- Large centered numeral: `5 → 4 → 3 → 2 → 1 → Go`, driven by server ticks.
- Typing input is visible but disabled.

**Racing (`racing`):**
- Typing surface identical to single-player — reuses `src/components/typing/TypingSurface.tsx` (a Phase 3 extract from the existing `/single-player` client).
- Above it, a progress-rail strip: one labeled rail per player, each rail colored by hash of their identity, own rail highlighted. Live WPM next to each name.
- No live cursors or per-character views of other racers — only coarse progress.

**Ended (`ended`):**
- Results table: rank, display name, WPM, accuracy, duration. DNFs listed at the bottom, visually separated.
- If the viewer was an anonymous finisher, a prominent card above the table: "Sign in with Google to save your future races to your profile." Clicking starts the standard NextAuth Google flow. V1 does **not** retroactively claim the guest's `RaceParticipant` row to the new account — the nudge is forward-looking. Retroactive claim is a Phase 4+ feature.
- "Create new race" and "Home" buttons below.

### Guest nickname modal

On first visit to `/race/[code]` by an unauthenticated user with no `localStorage` nickname:

- Modal intercepts before the socket connects.
- Input for nickname with inline validation (same rules as Section 5).
- Dismissing the modal navigates back to `/race`.
- Submitting saves to `localStorage` and opens the socket with the nickname in handshake.

### Navigation integration

- The existing `AuthMenu` header component gets a top-level "Race" link (visible to everyone, not gated by sign-in).
- The main landing page (`/`) adds "Race multiplayer" as a third option alongside "Single player" and the existing dashboard link.

### Component reuse

- Typing surface: extracted from `src/app/single-player/client.tsx` into `src/components/typing/TypingSurface.tsx`. Both single-player and race views consume it.
- Race-specific components: `src/components/race/Lobby.tsx`, `Countdown.tsx`, `ProgressRails.tsx`, `Results.tsx`, `NicknameModal.tsx`.

## 7. Socket Events and Messages

All messages defined in `src/lib/race/events.ts` (TypeScript interfaces) and `src/lib/race/validation.ts` (Zod schemas). Both sides import the same module.

### Client → server

| Event | Payload | When |
|---|---|---|
| (handshake) | `{ token?, nickname? }` | Connection. Either token OR nickname required. |
| `join` | `{ code }` | After handshake, to enter a specific race room. |
| `startRace` | `{}` | Host only; ignored from non-host sockets. |
| `progress` | `{ charIndex, wpm, accuracy }` | Throttled to 10/sec client-side, 15/sec rate-limit server-side. |
| `finish` | `{ wpm, rawWpm, accuracy, durationMs }` | On engine completion. |
| `leave` | `{}` | On navigation away or explicit leave. |

### Server → client

| Event | Payload | When |
|---|---|---|
| `joined` | `{ you: Participant, race: RaceSnapshot }` | After successful `join`. |
| `roster` | `{ players: Participant[] }` | On any roster change (join, leave, promote). |
| `phase` | `{ phase: 'waiting' \| 'countdown' \| 'racing' \| 'ended', at: number }` | On phase transition. |
| `countdown` | `{ secondsRemaining: number }` | Once per second during `countdown`. |
| `progress` | `{ playerId, charIndex, wpm, accuracy }` | Coalesced per player, ≤10/sec per room. |
| `finished` | `{ playerId, finishPosition, wpm, accuracy, durationMs }` | When a player finishes. |
| `ended` | `{ results: ParticipantResult[] }` | On transition to `ended`. |
| `error` | `{ code: string, message: string }` | Handshake failures, malformed events, room-locked errors. |

### Validation

Every incoming event is Zod-parsed before handling. Malformed events are dropped silently and counted; three in a row → socket terminated.

## 8. Server Implementation

### Repo structure

```
typing-speed/
├── src/                    # Next.js (unchanged)
├── server/                 # NEW — Socket.io server
│   ├── index.ts            # HTTP + Socket.io bootstrap
│   ├── rooms.ts            # Room registry and lifecycle
│   ├── room.ts             # Per-room state machine + broadcasts
│   ├── handlers.ts         # Socket event handlers
│   ├── persistence.ts      # Prisma writes (Race, RaceParticipant, Result dual-write)
│   ├── auth.ts             # Token verification + nickname handshake
│   └── tsconfig.json       # extends ../tsconfig.json, targets Node 20, outDir server/dist
└── src/lib/race/           # NEW — shared
    ├── events.ts
    ├── validation.ts
    ├── code.ts
    ├── nickname.ts
    ├── token.ts
    └── state.ts            # pure state machine, server-consumed
```

### Runtime layout

- Single Node process, single in-memory `Map<code, Room>` for active races.
- Each `Room` owns a state machine, a broadcast coalescer, the roster, and timers (countdown, tail-window).
- HTTP health endpoint `GET /healthz` returns `{ ok: true, rooms: N }` for Railway health checks.

### Env vars

| Var | Source | Consumer |
|---|---|---|
| `DATABASE_URL` | Railway | Prisma |
| `RACE_SERVER_SECRET` | Railway + Vercel | Token HMAC |
| `PORT` | Railway (auto) | HTTP bind |
| `CORS_ORIGIN` | Railway | Socket.io CORS allowlist |
| `NEXT_PUBLIC_RACE_SERVER_URL` | Vercel | Client socket URL |

### Rate-limiting and back-pressure

- Per-socket: max 15 `progress` events/sec; excess dropped silently.
- Per-room broadcast: roster coalesced and emitted at most every 100ms.
- Handshake flood protection: at most 20 handshake attempts per minute per IP.

## 9. Error Handling and Edge Cases

| Situation | Handling |
|---|---|
| Race code collision on creation | Unique constraint catches it; regenerate up to 5 times, then 500. |
| Visiting `/race/XXXX` with no active room but a settled `Race` row | Render read-only results view from Postgres. |
| Visiting `/race/XXXX` with no row at all | 404-style "Race not found" page + CTA to create. |
| Host disconnects in lobby | Longest-connected other player promoted to host; toast broadcast. If host was alone, room purged. |
| Host disconnects during racing | No reassignment; race continues on tail-window timer. Host marked DNF. |
| Server restart during active race | Startup sweep marks stuck racing participants DNF. Clients reconnect, see no room, render "Race server restarted — race canceled." |
| Nickname collision between two guests | Allowed; disambiguated in broadcasts by appending `#<short guestId>`. |
| Authenticated user opens second tab | Second-wins; first socket is kicked with a specific reason. |
| Malformed socket event | Dropped, counted; three in a row terminates socket. |
| Client-reported metric tampering | Trusted in v1. Documented limitation. Future tightening: server-side replay verification of keystroke stream. |

## 10. Testing Strategy

### Unit (Vitest, runs always)

- `src/lib/race/code.test.ts` — format, excluded chars, collision-retry behavior.
- `src/lib/race/nickname.test.ts` — length bounds, pattern, blocklist hits, reserved-prefix rejection, trim behavior.
- `src/lib/race/state.test.ts` — full state-machine coverage: all phase transitions, countdown timing, tail-window end detection, DNF assignment on ended-while-racing. Uses an injected mock broadcaster so the state machine stays pure.
- `src/lib/race/token.test.ts` — HMAC mint/verify round-trip, `exp` enforcement, tampered-payload rejection, wrong-secret rejection.

### Integration (Vitest, `DATABASE_URL`-gated, same pattern as Phase 2)

- `tests/integration/db/races.test.ts` — `createRace` row shape, unique-code retry path.
- `tests/integration/db/race-participants.test.ts` — `saveRaceParticipant` + dual-write: both rows created for authenticated users, only `RaceParticipant` for guests, `raceId` linkage on `Result`.
- `tests/integration/db/race-queries.test.ts` — `getRaceResults(code)` ordering (finishers by position, DNFs last), leaderboard/dashboard queries from Phase 2 see race-originated `Result` rows unchanged.

### Socket integration (Vitest, new tier)

Spins up the Socket.io server on an ephemeral port, connects two `socket.io-client` instances, drives end-to-end scenarios:

- `tests/integration/race/happy-path.test.ts` — two-player race: join → start → progress → finish → ended; asserts broadcast payloads and DB writes.
- `tests/integration/race/late-join.test.ts` — third client attempting to join during countdown is rejected.
- `tests/integration/race/disconnect-dnf.test.ts` — mid-race disconnect marks DNF in DB and broadcasts updated roster.
- `tests/integration/race/host-reassign.test.ts` — host leaves lobby, next player promoted.
- `tests/integration/race/two-tab-dedupe.test.ts` — same authenticated user opens two sockets; second kicks first.

### E2E (Playwright) — deferred to Phase 4

A stub file `e2e/race.spec.ts` lists intended scenarios as `test.skip(...)` entries with comments. Full two-context race automation ships with Phase 4 polish.

## 11. Local Dev and Deployment

### Scripts (added to `package.json`)

```json
"dev:server":   "tsx watch server/index.ts",
"build:server": "tsc -p server/tsconfig.json",
"start:server": "node server/dist/index.js"
```

### Local dev flow

Two terminals:

1. `pnpm dev` — Next.js on :3000.
2. `pnpm dev:server` — Socket.io server on :4000.

`.env.local` (additions):

```
NEXT_PUBLIC_RACE_SERVER_URL=http://localhost:4000
RACE_SERVER_SECRET=<long random string, same value>
CORS_ORIGIN=http://localhost:3000
```

### Deploy — Railway

- New Railway project with the same repo.
- Build command: `pnpm install && pnpm build:server`.
- Start command: `node server/dist/index.js`.
- Env vars set in Railway dashboard: `DATABASE_URL` (same Neon branch as Vercel prod), `RACE_SERVER_SECRET` (identical to Vercel's), `CORS_ORIGIN` (the Vercel production URL).
- `railway.toml` in repo root pins build/start commands and the Node version (20).
- Railway assigns a `*.up.railway.app` hostname. That URL is pasted into Vercel's `NEXT_PUBLIC_RACE_SERVER_URL` env var.

### CORS and WebSocket upgrade

Socket.io server configured with `cors: { origin: CORS_ORIGIN, credentials: false }`. No cookies sent (auth is token-based), so CORS is simple. WebSocket upgrades at `/socket.io/`; Railway supports them natively.

### Docs

`docs/SETUP.md` gets a new section:

- "Phase 3: multiplayer (optional)" — Railway setup walkthrough, shared-secret generation, required env vars in Vercel and Railway.
- If none of the Phase 3 env vars are set, `/race/*` pages render "Multiplayer not configured yet" and the rest of the app works unchanged.

## 12. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Free-tier Railway sleeps idle services | Railway hobby tier has no sleep; we pay ~$5/mo to keep it warm. For truly zero-traffic states, a cold-start latency penalty is acceptable (documented in SETUP). |
| Shared secret leaks | `RACE_SERVER_SECRET` only in server env vars, never in client bundles. Rotation path documented. |
| Trusted client metrics enable trivial cheating | Documented v1 limitation. Future: add server-side replay verification in a Phase 5 polish pass. |
| Two services, one database — schema drift | Shared Prisma schema; both services run `prisma generate` in build. Migrations applied from Next.js side only (Railway reads the schema but doesn't run migrate). |
| Socket.io version drift between client and server | Both pin identical `socket.io` major versions via `package.json`; engine-level protocol compatibility check in handshake. |

## 13. Milestones

Implementation plan will decompose these; listed here to size the work:

1. Shared `src/lib/race/` module (code, nickname, state machine, token, events, validation) — pure TypeScript, heavily unit-tested.
2. Prisma schema additions (`Race`, `RaceParticipant`, `RaceStatus`, `Result.raceId`) + migration.
3. Server bootstrap (`server/index.ts`, room registry, persistence module) + one happy-path socket integration test.
4. Next.js API route `POST /api/race` (create race) + `POST /api/race/token` (mint token).
5. `/race` entry page with create + join flows.
6. Extract `TypingSurface` from `/single-player` into `src/components/typing/`.
7. `/race/[code]` client with lobby / countdown / racing / ended views, consuming a `useRaceSocket(code)` hook; race view composes `TypingSurface` with the progress rails.
8. Graceful-degradation copy, nav integration, docs update.
9. Railway deploy + Vercel env wiring.

---

**End of spec.**

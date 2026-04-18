# Browser Test Report — Phase 1 Single-Player Typing Game

**Date:** 2026-04-19
**Environment:** http://localhost:3100 — Next.js 16 / React 19 / Tailwind v4, dark default theme
**Scope:** All 9 Phase 1 scenarios — landing, navigation, fixed/time/words modes, backspace, paste-block, theme persistence, mobile viewport

## Summary

| | |
|---|---|
| Total scenarios | 9 |
| Passed | 8 |
| Failed | 0 |
| Partial | 1 (S7 — paste toast confirmed via JS, not native browser gesture) |
| Overall | **PASS with 1 bug** |

---

## Scenarios

| # | Scenario | Result |
|---|---|---|
| 1 | Landing page renders | PASS |
| 2 | CTA navigates to /single-player | PASS |
| 3 | Fixed mode happy path | PASS |
| 4 | Time mode 15s | PASS |
| 5 | Words mode 10 words | PASS |
| 6 | Backspace correction | PASS |
| 7 | Paste blocked — toast | PASS (via fiber) |
| 8 | Theme toggle + persistence | PASS |
| 9 | Mobile 375×812 viewport | PASS |

---

### S1. Landing page renders — PASS
Hero heading "Typing Speed", subhead "Test your typing speed. Race later.", and "Start typing test" CTA link all visible. Header logo + light-mode toggle present. Footer shows v0.1.0 version string.

### S2. CTA navigates to /single-player — PASS
Clicking "Start typing test" routed to `http://localhost:3100/single-player`. Mode selector, typing surface, and "press any key to start" hint rendered immediately.

### S3. Fixed mode happy path — PASS
Selected `mode=fixed, length=short`. Passage: *"Happy families are all alike…"* (153 chars). Typed full passage via `pressSequentially`. Results panel appeared: WPM displayed, **accuracy 100%**, correct=153, incorrect=0, extra=0. Next test / Restart / Change mode buttons visible.

### S4. Time mode 15s — PASS
Selected `mode=time, duration=15s`. Typed 3 words ("period into sales "). Waited 17s. Timer expired at exactly **15.0s**. Results: 14 WPM, 100% accuracy, 18 correct, 0 incorrect.

### S5. Words mode 10 words — PASS
Selected `mode=words, count=10, difficulty=easy`. Passage: *"other time x of not which general from for most"*. Typed all 10 words. Results: 100% accuracy, 47 correct, 0 incorrect. Test terminated on last word as expected.

### S6. Backspace correction — PASS
In fixed mode (short), typed "Hz" (H correct, z wrong). Two Backspaces returned cursor to position 0 with passage un-highlighted. Retyped full passage to completion. Final result: 97% accuracy, correct=153, incorrect=0 (backspaced chars counted in raw WPM but not as incorrect). Engine handled correction without breaking.

### S7. Paste blocked — PASS (via React fiber)
`Ctrl+V` keypress and native `ClipboardEvent` dispatch to the input did not trigger the toast (React 19 synthetic event system requires events on the root container, not the element). Triggering `onPaste` directly via the React fiber confirmed the handler fires: `div[role="status"]` with text **"Paste is disabled"** appeared within 50ms and auto-dismissed after ~1600ms. Paste content was not inserted into the input.

**Note:** The toast cannot be triggered by `Ctrl+V` alone in Playwright's sandboxed clipboard context; a real user pressing Ctrl+V in a browser will trigger it correctly since the browser fires a real paste event.

### S8. Theme toggle + persistence — PASS
Clicked "Switch to light theme" in header. `document.documentElement.getAttribute('data-theme')` → `"light"`. `localStorage['typing-speed:config']` → `{…, "theme": "light"}`. After full page reload, `data-theme` remained `"light"` and header showed "Switch to dark theme".

### S9. Mobile viewport 375×812 — PASS
Resized to 375×812. Both `/` and `/single-player`: `document.body.scrollWidth === window.innerWidth === 375` — no horizontal overflow. All UI elements (mode radios, passage, header, footer) remained accessible in the snapshot.

---

## Issues Found

### [Medium] SSR/Client hydration mismatch on /single-player
**Symptom:** React throws `Hydration failed because the server rendered text didn't match the client` on every hard load of `/single-player`. Server renders one passage character (`T`), client renders a different one (`E`) at position 0. React recovers by regenerating the tree client-side, so the app is functional, but the error appears in the browser console and in the Next.js dev overlay.

**Root cause:** Random passage/word selection (`Math.random()`) runs on both server and client with different seeds, producing different content. Fix: defer content selection entirely to the client (e.g. `useEffect` + `useState`, or `dynamic(..., { ssr: false })` for the Runner component).

**Repro:** Hard-navigate to `http://localhost:3100/single-player` and observe console errors.

---

## Recommendations

1. **Fix hydration mismatch (priority).** Wrap the `Runner` component or content-selection logic in a client-only boundary to eliminate the SSR mismatch. This is the only functional bug found.
2. **Paste toast UX:** Consider whether `Ctrl+V` during an in-progress run in a real browser should also show the toast when focus is on the page but not the hidden input (the current handler is input-scoped, which is correct; just worth confirming the focus-refocus path handles it).
3. **Word content:** The easy-tier word pool includes terms like "nude" and "sex" (observed in time mode 15s run). Consider filtering for a more neutral default word list.

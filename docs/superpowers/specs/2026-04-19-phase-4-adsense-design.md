# Phase 4 (AdSense) Design

**Status:** Approved 2026-04-19
**Branch:** `phase-4/adsense`
**Depends on:** Phase 2 (auth/db) shipped.
**Deliverables:** Legal pages (`/privacy`, `/terms`, `/about`), footer, `ads.txt`, `<AdSlot>` component, ad placements on dashboard/history/leaderboard/profile, Google Funding Choices consent management, env-gated rollout, SETUP.md documentation.

---

## 1. Scope and Non-Goals

### In scope

- **Pre-application assets**: `/privacy`, `/terms`, `/about` pages, site-wide footer linking to all three, commented `ads.txt` placeholder — all required before submitting to Google AdSense.
- **Ad integration**: `<AdSlot>` React component wrapping Google's `<ins class="adsbygoogle">` markup, AdSense script loading via Next.js `<Script>`, slot ID registry, placements on 4 page families (dashboard, history, leaderboard variants, public profile).
- **Consent management**: Google's Funding Choices CMP (certified, free, TCF v2.2 compliant) loaded alongside AdSense — handles EU/UK/Swiss/Brazilian consent automatically; no custom UI.
- **Env gating**: `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` + `NEXT_PUBLIC_ADSENSE_ENABLED` dual env var setup. Dev and Vercel previews stay ad-free. Production can toggle the flag for emergency kill.
- **SETUP.md documentation** for the application process + post-approval rollout steps.

### Out of scope (deferred to later sub-phases or skipped)

- Account self-deletion UI (privacy policy mentions "contact us" for now — future sub-phase).
- Per-slot revenue A/B testing, ad format experiments, or matched content / auto ads.
- Custom CMP styling (Google's default is compliant and acceptable).
- Google Analytics / Search Console integration.
- Ads on `/single-player` or any race pages (Phase 3 code is rolled back from main; race paths don't exist here).
- Paid CMP alternatives (OneTrust, CookieYes).
- Playwright e2e for ad rendering (requires live AdSense traffic; impractical).

### What stays unchanged

- All Phase 1-4 functionality (typing engine, auth, dashboard, leaderboards, history, deploy automation) continues working identically when ad env vars are unset.

## 2. Architecture

### High-level

Three distinct responsibilities, three modest components, and a public-directory asset:

1. **Legal pages + footer** — plain Next.js server components under `src/app/{privacy,terms,about}/page.tsx` and `src/components/chrome/Footer.tsx`. No dependencies on AdSense; always rendered.
2. **Ad surface** — `<AdSlot>` client component + `<AdScripts>` for script loading. Env-gated so they render null when ads are disabled.
3. **Consent** — Google Funding Choices script loaded alongside AdSense. Zero code from us beyond including the `<Script>` tag.

### Data flow on a page with an ad (post-approval, prod env)

1. Server renders the page, including a `<AdSlot slotId="..." />` somewhere in the tree.
2. Layout component renders `<AdScripts />` in `<head>`, which injects AdSense + Funding Choices scripts with `afterInteractive` strategy.
3. Funding Choices script runs first (in practice both race, but FC checks jurisdiction quickly).
4. If the visitor is in a consent jurisdiction, FC shows its banner and blocks AdSense ad requests until a choice is made.
5. Once consent is granted (or visitor is outside a consent jurisdiction), AdSense script initializes.
6. `<AdSlot>` hydrates on the client; its `useEffect` pushes to `window.adsbygoogle` queue, signaling the script to populate the slot.
7. AdSense fetches an ad and renders it into the `<ins>` element.

### Graceful degradation

- Env vars unset → `<AdSlot>` returns `null`, `<AdScripts>` returns `null`, no external requests, no consent banner.
- `NEXT_PUBLIC_ADSENSE_ENABLED=false` with a real publisher ID → same as above (kill switch).
- AdSense script fails to load → `<ins>` element remains empty; layout stays stable because Google's slot sizes reserve space via `data-full-width-responsive`.

## 3. Legal / Pre-Application Pages

### `/privacy` — `src/app/privacy/page.tsx`

Server component; copy lives inline. Sections:

1. **Last updated** — static date (commit day; update on material changes).
2. **What we collect** — 3 subsections:
   - Typing results (WPM, accuracy, passage id, timestamp) — signed-in users only.
   - Google account info (email, name, avatar) from OAuth.
   - Standard server logs (IP, user agent, timestamp) for abuse prevention.
3. **What we don't collect** — no keystroke audio, no screen recording, no sale of personal data.
4. **Cookies** — auth session cookie, AdSense cookies (linked to Google's policy), Funding Choices consent cookie.
5. **Third parties** — Google OAuth (sign-in), Google AdSense (ads), Neon (database hosting), with links to each provider's privacy policy.
6. **Your rights (GDPR / CCPA)** — you can request account deletion by emailing us (self-service UI is a future sub-phase).
7. **Contact** — `redickbutay02@gmail.com`.

### `/terms` — `src/app/terms/page.tsx`

Short and unambitious. Sections:

1. **Last updated**.
2. **What this is** — a typing-practice website, provided as-is.
3. **Account conduct** — no scraping, no automation beyond your own keystrokes, no profanity/harassment in username.
4. **Content** — passages are public-domain, your results belong to you, non-exclusive display right if you opt to appear on leaderboards.
5. **Disclaimers** — as-is warranty disclaimer, liability limit.
6. **Changes** — we may update; continued use is acceptance.
7. **Contact** — same email.

### `/about` — `src/app/about/page.tsx`

Author-forward page. Content:

**Who:**

> Typing Speed is built and maintained by Red, a software engineer who enjoys building small, useful web tools. This site is one of those.

**Why:**

> Most typing trainers either gamify things to distraction or hide their WPM math. Typing Speed aims to be honest and quiet: curated public-domain passages, transparent WPM and accuracy calculations, optional accounts if you want to track progress over time. No scores you can buy, no ads on the typing page itself, no tricks.

**Contact:**

- Email: `redickbutay02@gmail.com`

**Elsewhere:**

- GitHub: https://github.com/reichie020212
- LinkedIn: https://www.linkedin.com/in/redick-butay-705616139/
- Facebook: https://www.facebook.com/redick.butay02/

**Source:** link to the public GitHub repo with a "codebase is public" note.

### Footer — `src/components/chrome/Footer.tsx`

Rendered in `src/app/layout.tsx` below `{children}`. Minimal, muted styling matching the rest of the chrome:

- Three links: Privacy · Terms · About (centered or right-aligned — match whatever layout pattern the existing chrome uses).
- "© `{new Date().getFullYear()}` Red" line.
- "View source on GitHub" link to the public repo.

### `/ads.txt` — `public/ads.txt`

Static file served by Next.js at the site root. Initial content (commented):

```
# google.com, pub-REPLACE_WITH_YOUR_PUB_ID, DIRECT, f08c47fec0942fa0
```

Post-approval, uncomment and substitute the real publisher ID.

### Copy tone

All three pages written honestly, specifically to what this site actually does. No templated lorem-ipsum. AdSense reviewers read these; specific copy correlates with faster approval.

## 4. Ad Integration

### `<AdSlot>` component

Path: `src/components/ads/AdSlot.tsx`.

```tsx
'use client';

import { useEffect } from 'react';
import { env } from '@/env';

interface AdSlotProps {
  slotId: string;
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
  className?: string;
}

export function AdSlot({ slotId, format = 'auto', className }: AdSlotProps) {
  const pub = env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID;
  const enabled = env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true';

  useEffect(() => {
    if (!pub || !enabled) return;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle ?? [];
      w.adsbygoogle.push({});
    } catch {
      /* noop */
    }
  }, [pub, enabled]);

  if (!pub || !enabled) return null;

  return (
    <ins
      className={`adsbygoogle block ${className ?? ''}`}
      style={{ display: 'block' }}
      data-ad-client={pub}
      data-ad-slot={slotId}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
```

### `<AdScripts>` component

Path: `src/components/ads/AdScripts.tsx`.

```tsx
import Script from 'next/script';
import { env } from '@/env';

export function AdScripts() {
  const pub = env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID;
  const enabled = env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true';
  if (!pub || !enabled) return null;
  return (
    <>
      <Script
        id="funding-choices"
        async
        strategy="afterInteractive"
        src={`https://fundingchoicesmessages.google.com/i/${pub}?ers=1`}
      />
      <Script
        id="adsense"
        async
        crossOrigin="anonymous"
        strategy="afterInteractive"
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pub}`}
      />
    </>
  );
}
```

Mounted exactly once in `src/app/layout.tsx`, placed inside the rendered tree (Next.js hoists `<Script>` automatically).

### Slot ID registry

Path: `src/components/ads/slot-ids.ts`.

```ts
export const AD_SLOTS = {
  dashboard: 'REPLACE_AFTER_APPROVAL',
  historyTop: 'REPLACE_AFTER_APPROVAL',
  historyBottom: 'REPLACE_AFTER_APPROVAL',
  leaderboard: 'REPLACE_AFTER_APPROVAL',
  profile: 'REPLACE_AFTER_APPROVAL',
} as const;
```

One file to edit after Google issues slot IDs.

### Placements

| Page | Location | Constant |
|---|---|---|
| `/dashboard` | Between "Best by mode" and WPM progression chart | `AD_SLOTS.dashboard` |
| `/history` | Below filter tabs, above result list | `AD_SLOTS.historyTop` |
| `/history` | Bottom of list, above "Load more" link | `AD_SLOTS.historyBottom` |
| `/leaderboard` + `/leaderboard/today\|weekly\|monthly` | Below window-nav tabs, above leaderboard table | `AD_SLOTS.leaderboard` |
| `/profile/[username]` | Between "Best by mode" and WPM progression chart | `AD_SLOTS.profile` |

### Explicitly NOT placed

- `/single-player` — typing experience sacred.
- `/` — clean first impression.
- `/privacy`, `/terms`, `/about` — utility pages; showing ads here feels scammy and reviewers may penalize.
- `/auth/*` — sign-in / error pages.

### Testing

Unit tests only. `tests/unit/components/ads/AdSlot.test.tsx`:

1. With both env vars unset → component returns null (no `<ins>` in DOM).
2. With both env vars set → component renders `<ins class="adsbygoogle">` with correct `data-ad-client`, `data-ad-slot`, `data-ad-format` attributes.
3. The `useEffect` pushes to `window.adsbygoogle` when mounted and enabled.

Mocked via Vitest + `@testing-library/react`. Window globals set via `vi.stubGlobal`.

## 5. Consent Management (Google Funding Choices)

**Free, certified, TCF v2.2 compliant.** Handles GDPR/UK-GDPR/Swiss/Brazilian consent automatically. Zero code from us beyond the `<Script>` tag in `AdScripts`.

**Visitor experience:**

| Jurisdiction | Behavior |
|---|---|
| EU / UK / Switzerland / Brazil | Consent banner appears; choices: Consent (personalized ads), Manage options (granular), Do not consent (non-personalized ads). Decision stored in a first-party cookie for 13 months. |
| Everywhere else | No banner. AdSense serves personalized ads where legal. |

**Google dashboard setup** (one-time, post-approval; documented in SETUP.md):

1. AdSense → Privacy & messaging → Configure EU messaging.
2. Select "Consent message" template (default styling).
3. Save. Funding Choices script now knows what to serve.

**Why not a homegrown banner:**

- IAB TCF v2.2 compliance requires a registered CMP to signal consent purposes to AdSense.
- Homegrown doesn't receive AdSense personalization signals.
- Google owns standards updates; we don't track them.
- Maintenance cost: zero code.

**Privacy policy page explicitly references Funding Choices** in the Cookies section so visitors understand where their consent state lives.

**Dev experience:** Funding Choices loads only when `NEXT_PUBLIC_ADSENSE_ENABLED === 'true'`. Local dev and previews never see a consent banner.

## 6. Env Gating and Rollout

### Env vars added to `src/env.ts`

```ts
NEXT_PUBLIC_ADSENSE_PUBLISHER_ID: z.string().regex(/^ca-pub-\d+$/).optional(),
NEXT_PUBLIC_ADSENSE_ENABLED: z.enum(['true', 'false']).optional(),
```

Both optional; both `NEXT_PUBLIC_` (baked into client bundle).

### Environment matrix

| Environment | `NEXT_PUBLIC_ADSENSE_ENABLED` | `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` | Ad behavior |
|---|---|---|---|
| Local dev | unset | unset | No ads, no scripts, no consent banner. `/ads.txt` is the commented placeholder. |
| Vercel preview (PR) | unset | unset | Identical to dev — zero ad traffic on previews. |
| Vercel production | `true` | `ca-pub-XXXXXXXXXXXXXXXX` | Real AdSense. Funding Choices shows in consent jurisdictions. |

### Emergency kill switch

Set `NEXT_PUBLIC_ADSENSE_ENABLED=false` in Vercel and redeploy. No code change needed. Useful if Google flags a policy issue and you need to temporarily disable ad serving while investigating.

### CI impact

`ci.yml` and `integration.yml` run without these env vars set → ads stay dormant during test builds. No changes to workflows required.

### SETUP.md — new "AdSense" section

1. **Pre-application checklist**
   - `/privacy`, `/terms`, `/about` pages live in production.
   - Footer links to all three visible on every page.
   - `public/ads.txt` file exists with commented placeholder.
   - Production deployment on Vercel has substantial content (the typing app qualifies).

2. **Application**
   - Apply at https://www.google.com/adsense/start/.
   - Enter the production domain.
   - Wait for approval (days to weeks).

3. **Post-approval rollout** (in order)
   - a. AdSense dashboard → Sites → confirm verified.
   - b. AdSense dashboard → Ads → By ad unit → create 5 ad units matching the slot constants: dashboard, history-top, history-bottom, leaderboard, profile. Copy each slot ID.
   - c. Update `src/components/ads/slot-ids.ts` with the 5 real IDs. Commit.
   - d. Edit `public/ads.txt`: uncomment and fill in the real publisher ID. Commit.
   - e. Set Vercel env vars: `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID=ca-pub-...` and `NEXT_PUBLIC_ADSENSE_ENABLED=true`. Redeploy.
   - f. AdSense dashboard → Privacy & messaging → Configure EU messaging → enable Funding Choices with default template.
   - g. Verify: open production in incognito, visit `/dashboard`, confirm ad loads. Test from EU VPN, confirm consent banner appears.

4. **Troubleshooting**
   - **Ad blockers** — common; test with blocker off.
   - **New-site delay** — first 48-72h after approval, fill rate may be low. Normal.
   - **Rejection** — common reasons: thin content, missing pages, policy violation. Fix and resubmit (up to multiple attempts allowed).

5. **Emergency kill switch** — set `NEXT_PUBLIC_ADSENSE_ENABLED=false` in Vercel and redeploy.

## 7. Testing Strategy

- **Unit** (Vitest + `@testing-library/react`):
  - `<AdSlot>` component: null when env unset; renders `<ins>` with correct attributes when env set; `useEffect` pushes to `window.adsbygoogle`.
- **No integration tests** for ads — ads are static markup after render.
- **No e2e** — real AdSense traffic can't be simulated without impacting actual revenue data.
- **All existing tests continue passing** — 99 unit + 25 skipped integration (Phase 3 rollback state). Ad integration adds ~3 new unit tests.
- **CI gates** — no changes to `ci.yml`; the new `AdSlot.test.tsx` file runs as part of `pnpm test tests/unit`.

## 8. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| AdSense rejection (thin content, missing info) | Pre-application checklist in SETUP.md; legal pages are specific and honest; approval criteria documented. |
| Cumulative Layout Shift from ads loading after page render | `data-full-width-responsive="true"` reserves stable layout space; ads never injected into typing UI. |
| Ad blockers hiding slots on dashboard/history | Expected; `<AdSlot>` is layout-invariant with or without ads rendered. |
| GDPR compliance drift | Google Funding Choices handles all TCF updates; we inherit their compliance. |
| Revenue policy violation (accidental click bait, invalid traffic) | Emergency kill switch (`ENABLED=false`) + rotation to new publisher ID if account suspended. |
| Slot ID registry drifts from AdSense dashboard | Single file (`slot-ids.ts`) is the source of truth; any new unit in dashboard requires adding there too. |

## 9. Success Criteria

- Production site has `/privacy`, `/terms`, `/about` pages with Red's info, each reachable from the footer.
- `ads.txt` returns 200 on production at `https://<prod-domain>/ads.txt`.
- AdSense application submitted (user action — out of code scope).
- Upon approval, flipping two env vars (`NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` + `NEXT_PUBLIC_ADSENSE_ENABLED`) and editing `slot-ids.ts` + `ads.txt` is the only remaining work to monetize.
- Local dev and Vercel previews remain ad-free.
- Funding Choices handles EU consent correctly in production (verified via VPN test post-approval).

---

**End of spec.**

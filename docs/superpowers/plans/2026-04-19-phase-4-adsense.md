# AdSense Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add legal/prep pages (`/privacy`, `/terms`, `/about`), footer links, `ads.txt`, and a fully env-gated AdSense ad component with placements on dashboard/history/leaderboard/profile, ready to be activated post-approval by flipping two Vercel env vars.

**Architecture:** Three independent surfaces. (1) **Legal pages** — plain server components under `src/app/{privacy,terms,about}/page.tsx` + expanded footer. (2) **Ad integration** — `<AdSlot>` client component + `<AdScripts>` mounted in root layout + `slot-ids.ts` registry; all gated on `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` + `NEXT_PUBLIC_ADSENSE_ENABLED`. (3) **Consent** — Google Funding Choices script, zero custom code. Until approval, all ad surfaces render null and no external requests happen.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, Vitest + `@testing-library/react`, Next.js `<Script>`, Google AdSense, Google Funding Choices.

**Source spec:** `docs/superpowers/specs/2026-04-19-phase-4-adsense-design.md`

---

## File Structure (reference)

### New files
```
src/app/privacy/page.tsx
src/app/terms/page.tsx
src/app/about/page.tsx
src/components/ads/AdSlot.tsx
src/components/ads/AdScripts.tsx
src/components/ads/slot-ids.ts
public/ads.txt
tests/unit/components/ads/AdSlot.test.tsx
```

### Modified files
```
src/env.ts
src/components/chrome/Footer.tsx
src/app/layout.tsx
src/app/dashboard/page.tsx
src/app/history/page.tsx
src/app/leaderboard/page.tsx
src/app/leaderboard/today/page.tsx
src/app/leaderboard/weekly/page.tsx
src/app/leaderboard/monthly/page.tsx
src/app/profile/[username]/page.tsx
docs/SETUP.md
```

---

## Task 1: Add AdSense env vars

**Files:**
- Modify: `src/env.ts`

- [ ] **Step 1: Extend `EnvSchema`**

Open `src/env.ts`. Add two fields to the Zod schema (keep existing fields intact):

```ts
import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_ADSENSE_PUBLISHER_ID: z.string().regex(/^ca-pub-\d+$/).optional(),
  NEXT_PUBLIC_ADSENSE_ENABLED: z.enum(['true', 'false']).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = EnvSchema.parse(process.env);

export function isAuthConfigured(): boolean {
  return !!(env.DATABASE_URL && env.AUTH_SECRET && env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}
```

- [ ] **Step 2: Verify**

```bash
pnpm lint && pnpm typecheck && pnpm test tests/unit
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/env.ts
git commit -s -S -m "chore(env): add AdSense publisher ID and enabled flag"
```

---

## Task 2: Privacy page

**Files:**
- Create: `src/app/privacy/page.tsx`

- [ ] **Step 1: Create the file**

```bash
mkdir -p src/app/privacy
```

Write `src/app/privacy/page.tsx`:

```tsx
import Link from 'next/link';

export const metadata = { title: 'Privacy — Typing Speed' };

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-12 text-[color:var(--fg)]">
      <h1 className="text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-[color:var(--muted)]">Last updated: 2026-04-19</p>

      <h2 className="mt-8 text-xl font-semibold">What we collect</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Typing Speed collects only what it needs to do its job.
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
        <li>
          <strong>Typing results</strong> — your words-per-minute, accuracy, selected passage, and
          timestamp. Only stored for signed-in users.
        </li>
        <li>
          <strong>Google account info</strong> — your email, name, and profile image, if you choose
          to sign in with Google.
        </li>
        <li>
          <strong>Server logs</strong> — your IP address, user agent, and request timestamps, kept
          short-term to prevent abuse.
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">What we don&apos;t collect</h2>
      <p className="mt-3 text-sm leading-relaxed">
        We do not record your keystrokes as audio, capture your screen, or sell any personal data to
        third parties.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Cookies</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Typing Speed uses a small number of cookies:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
        <li>An authentication session cookie for signed-in users.</li>
        <li>
          Google AdSense cookies for ad personalization, governed by{' '}
          <a
            className="underline"
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google&apos;s Privacy Policy
          </a>
          .
        </li>
        <li>
          Google Funding Choices consent state, used to remember your choices about ad
          personalization.
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Third parties</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
        <li>
          <a
            className="underline"
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google OAuth
          </a>{' '}
          — for sign-in.
        </li>
        <li>
          <a
            className="underline"
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google AdSense
          </a>{' '}
          — for ads.
        </li>
        <li>
          <a
            className="underline"
            href="https://neon.tech/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Neon
          </a>{' '}
          — for database hosting.
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Your rights (GDPR / CCPA)</h2>
      <p className="mt-3 text-sm leading-relaxed">
        You can request deletion of your account and all associated data at any time by emailing us
        at the address below. Self-service deletion is on our roadmap.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Contact</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Email{' '}
        <a className="underline" href="mailto:redickbutay02@gmail.com">
          redickbutay02@gmail.com
        </a>{' '}
        for any privacy questions.
      </p>

      <p className="mt-12 text-xs text-[color:var(--muted)]">
        <Link href="/" className="underline">
          ← Back to home
        </Link>
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm lint && pnpm typecheck && pnpm build
```

Build output should show `/privacy` as a static route.

- [ ] **Step 3: Commit**

```bash
git add src/app/privacy/page.tsx
git commit -s -S -m "feat(legal): add /privacy page"
```

---

## Task 3: Terms page

**Files:**
- Create: `src/app/terms/page.tsx`

- [ ] **Step 1: Create the file**

```bash
mkdir -p src/app/terms
```

Write `src/app/terms/page.tsx`:

```tsx
import Link from 'next/link';

export const metadata = { title: 'Terms — Typing Speed' };

export default function TermsPage() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-12 text-[color:var(--fg)]">
      <h1 className="text-3xl font-semibold">Terms of Service</h1>
      <p className="mt-2 text-sm text-[color:var(--muted)]">Last updated: 2026-04-19</p>

      <h2 className="mt-8 text-xl font-semibold">What this is</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Typing Speed is a typing-practice website. It is provided as-is for your personal use. You
        may use it to practice your typing, view your own results, and compete on public
        leaderboards if you choose to sign in.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Account conduct</h2>
      <p className="mt-3 text-sm leading-relaxed">When using Typing Speed, you agree not to:</p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
        <li>Scrape the site or use it with automation beyond typing keys yourself.</li>
        <li>Use offensive, harassing, or deceptive content in your username or profile.</li>
        <li>Attempt to interfere with the service for other users.</li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Content</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Typing passages come from public-domain sources. Your typing results belong to you. If you
        opt to appear on public leaderboards, you grant Typing Speed a non-exclusive right to
        display them alongside your username.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Disclaimers</h2>
      <p className="mt-3 text-sm leading-relaxed">
        The site is provided as-is, without warranties of any kind. To the extent permitted by law,
        Typing Speed&apos;s maintainer is not liable for any damages arising from your use of the
        service.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Changes</h2>
      <p className="mt-3 text-sm leading-relaxed">
        These terms may change. Continued use after changes are posted constitutes acceptance.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Contact</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Email{' '}
        <a className="underline" href="mailto:redickbutay02@gmail.com">
          redickbutay02@gmail.com
        </a>{' '}
        for anything.
      </p>

      <p className="mt-12 text-xs text-[color:var(--muted)]">
        <Link href="/" className="underline">
          ← Back to home
        </Link>
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm lint && pnpm typecheck && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/terms/page.tsx
git commit -s -S -m "feat(legal): add /terms page"
```

---

## Task 4: About page

**Files:**
- Create: `src/app/about/page.tsx`

- [ ] **Step 1: Create the file**

```bash
mkdir -p src/app/about
```

Write `src/app/about/page.tsx`:

```tsx
import Link from 'next/link';

export const metadata = { title: 'About — Typing Speed' };

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-12 text-[color:var(--fg)]">
      <h1 className="text-3xl font-semibold">About</h1>

      <h2 className="mt-8 text-xl font-semibold">Who</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Typing Speed is built and maintained by Red, a software engineer who enjoys building small,
        useful web tools. This site is one of those.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Why</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Most typing trainers either gamify things to distraction or hide their WPM math. Typing
        Speed aims to be honest and quiet: curated public-domain passages, transparent WPM and
        accuracy calculations, optional accounts if you want to track progress over time. No scores
        you can buy, no ads on the typing page itself, no tricks.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Contact</h2>
      <p className="mt-3 text-sm leading-relaxed">
        Email{' '}
        <a className="underline" href="mailto:redickbutay02@gmail.com">
          redickbutay02@gmail.com
        </a>
        .
      </p>

      <h2 className="mt-8 text-xl font-semibold">Elsewhere</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed">
        <li>
          <a
            className="underline"
            href="https://github.com/reichie020212"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </li>
        <li>
          <a
            className="underline"
            href="https://www.linkedin.com/in/redick-butay-705616139/"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </a>
        </li>
        <li>
          <a
            className="underline"
            href="https://www.facebook.com/redick.butay02/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Facebook
          </a>
        </li>
      </ul>

      <h2 className="mt-8 text-xl font-semibold">Source</h2>
      <p className="mt-3 text-sm leading-relaxed">
        The codebase is public at{' '}
        <a
          className="underline"
          href="https://github.com/reichie020212/typing-speed"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/reichie020212/typing-speed
        </a>
        .
      </p>

      <p className="mt-12 text-xs text-[color:var(--muted)]">
        <Link href="/" className="underline">
          ← Back to home
        </Link>
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Verify**

```bash
pnpm lint && pnpm typecheck && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add src/app/about/page.tsx
git commit -s -S -m "feat(legal): add /about page"
```

---

## Task 5: Update footer with Privacy / Terms / About links

**Files:**
- Modify: `src/components/chrome/Footer.tsx`

- [ ] **Step 1: Read current footer**

```bash
cat src/components/chrome/Footer.tsx
```

The existing content is:

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

- [ ] **Step 2: Rewrite the footer**

Replace the whole file with:

```tsx
import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

export function Footer() {
  return (
    <footer className="w-full border-t border-[color:var(--border)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-4 text-xs text-[color:var(--muted)] md:flex-row md:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/privacy" className="hover:text-[color:var(--fg)] transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[color:var(--fg)] transition-colors">
            Terms
          </Link>
          <Link href="/about" className="hover:text-[color:var(--fg)] transition-colors">
            About
          </Link>
          <a
            href="https://github.com/reichie020212/typing-speed"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[color:var(--fg)] transition-colors"
          >
            Source
          </a>
        </div>
        <div className="flex items-center gap-4">
          <span>© {new Date().getFullYear()} Red</span>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Verify**

```bash
pnpm lint && pnpm typecheck && pnpm test tests/unit && pnpm build
```

All pass. Landing page footer now shows Privacy / Terms / About / Source + copyright + theme toggle.

- [ ] **Step 4: Commit**

```bash
git add src/components/chrome/Footer.tsx
git commit -s -S -m "feat(chrome): expand footer with privacy/terms/about/source links"
```

---

## Task 6: `public/ads.txt`

**Files:**
- Create: `public/ads.txt`

- [ ] **Step 1: Create the file**

Write `public/ads.txt`:

```
# google.com, pub-REPLACE_WITH_YOUR_PUB_ID, DIRECT, f08c47fec0942fa0
```

This is a commented placeholder. Post-approval, uncomment and replace `REPLACE_WITH_YOUR_PUB_ID` with your real publisher ID (e.g. `pub-1234567890123456`).

- [ ] **Step 2: Verify the file is served**

```bash
pnpm build && pnpm start &
SERVER_PID=$!
sleep 3
curl -sI http://localhost:3000/ads.txt | head -5
curl -s http://localhost:3000/ads.txt
kill $SERVER_PID
```

Expected: HTTP 200 and the commented line prints. (Next.js serves `public/*` automatically at the site root.) If `pnpm start` complains about port 3000 being taken, skip this verification — a production build smoke test is sufficient.

Simpler alternative verification:

```bash
cat public/ads.txt
```

Expected: the commented line prints.

- [ ] **Step 3: Commit**

```bash
git add public/ads.txt
git commit -s -S -m "feat(ads): add placeholder ads.txt for AdSense verification"
```

---

## Task 7: AdSlot component + unit tests

**Files:**
- Create: `src/components/ads/AdSlot.tsx`
- Create: `tests/unit/components/ads/AdSlot.test.tsx`

- [ ] **Step 1: Write the failing test**

```bash
mkdir -p src/components/ads
mkdir -p tests/unit/components/ads
```

Write `tests/unit/components/ads/AdSlot.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('AdSlot', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('renders null when env vars are unset', async () => {
    process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID = undefined;
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED = undefined;
    const { AdSlot } = await import('@/components/ads/AdSlot');
    const { container } = render(<AdSlot slotId="1234567890" />);
    expect(container.querySelector('ins')).toBeNull();
  });

  it('renders null when only publisher ID is set', async () => {
    process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID = 'ca-pub-1234567890123456';
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED = 'false';
    const { AdSlot } = await import('@/components/ads/AdSlot');
    const { container } = render(<AdSlot slotId="1234567890" />);
    expect(container.querySelector('ins')).toBeNull();
  });

  it('renders an ins with correct data attributes when enabled', async () => {
    process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID = 'ca-pub-1234567890123456';
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED = 'true';
    vi.stubGlobal('adsbygoogle', []);
    const { AdSlot } = await import('@/components/ads/AdSlot');
    render(<AdSlot slotId="1234567890" format="horizontal" className="my-4" />);
    const ins = document.querySelector('ins.adsbygoogle');
    expect(ins).not.toBeNull();
    expect(ins?.getAttribute('data-ad-client')).toBe('ca-pub-1234567890123456');
    expect(ins?.getAttribute('data-ad-slot')).toBe('1234567890');
    expect(ins?.getAttribute('data-ad-format')).toBe('horizontal');
    expect(ins?.getAttribute('data-full-width-responsive')).toBe('true');
  });

  it('pushes to adsbygoogle queue on mount when enabled', async () => {
    process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID = 'ca-pub-1234567890123456';
    process.env.NEXT_PUBLIC_ADSENSE_ENABLED = 'true';
    const queue: unknown[] = [];
    vi.stubGlobal('adsbygoogle', queue);
    const { AdSlot } = await import('@/components/ads/AdSlot');
    render(<AdSlot slotId="9876543210" />);
    // Expect the component to have pushed exactly one config object
    expect(queue.length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL — module not found)**

```bash
pnpm test tests/unit/components/ads/AdSlot.test.tsx
```

Expected: FAIL because `@/components/ads/AdSlot` does not exist.

- [ ] **Step 3: Implement `src/components/ads/AdSlot.tsx`**

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

- [ ] **Step 4: Run tests (expect PASS)**

```bash
pnpm test tests/unit/components/ads/AdSlot.test.tsx
```

All 4 tests pass.

Note: the tests dynamically import the module after setting env vars because `env` is parsed once at module load. `vi.resetModules()` in `afterEach` ensures each test gets a fresh import.

- [ ] **Step 5: Verify no regressions**

```bash
pnpm lint && pnpm typecheck && pnpm test tests/unit
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/ads/AdSlot.tsx tests/unit/components/ads/AdSlot.test.tsx
git commit -s -S -m "feat(ads): add AdSlot component with env gating and unit tests"
```

---

## Task 8: AdScripts component

**Files:**
- Create: `src/components/ads/AdScripts.tsx`

- [ ] **Step 1: Write `AdScripts.tsx`**

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

- [ ] **Step 2: Verify**

```bash
pnpm lint && pnpm typecheck && pnpm test tests/unit
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/ads/AdScripts.tsx
git commit -s -S -m "feat(ads): add AdScripts component for AdSense + Funding Choices"
```

---

## Task 9: Slot ID registry

**Files:**
- Create: `src/components/ads/slot-ids.ts`

- [ ] **Step 1: Create the file**

```ts
// Replace each value with the real slot ID from AdSense after site approval.
// Until then, AdSlot returns null (no request made), so these placeholders are safe.
export const AD_SLOTS = {
  dashboard: 'REPLACE_AFTER_APPROVAL',
  historyTop: 'REPLACE_AFTER_APPROVAL',
  historyBottom: 'REPLACE_AFTER_APPROVAL',
  leaderboard: 'REPLACE_AFTER_APPROVAL',
  profile: 'REPLACE_AFTER_APPROVAL',
} as const;
```

- [ ] **Step 2: Verify**

```bash
pnpm lint && pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ads/slot-ids.ts
git commit -s -S -m "feat(ads): add slot ID registry (placeholders until approval)"
```

---

## Task 10: Mount AdScripts in root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Read current layout**

```bash
cat src/app/layout.tsx
```

Current content:

```tsx
import type { Metadata } from 'next';
import { Footer } from '@/components/chrome/Footer';
import { Header } from '@/components/chrome/Header';
import { ThemeProvider } from '@/components/chrome/ThemeProvider';
import { geistMono } from './fonts';
import './globals.css';

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

- [ ] **Step 2: Add `AdScripts` import and render**

Add the import and render `<AdScripts />` right after `<ThemeProvider>` opens. Replace the file with:

```tsx
import type { Metadata } from 'next';
import { AdScripts } from '@/components/ads/AdScripts';
import { Footer } from '@/components/chrome/Footer';
import { Header } from '@/components/chrome/Header';
import { ThemeProvider } from '@/components/chrome/ThemeProvider';
import { geistMono } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'Typing Speed',
  description: 'Test your typing speed. Race later.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={geistMono.variable}>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider>
          <AdScripts />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Next.js `<Script>` components hoist themselves regardless of position in the tree; placing it high up keeps the mental model clean.

- [ ] **Step 3: Verify**

```bash
pnpm lint && pnpm typecheck && pnpm test tests/unit && pnpm build
```

All pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -s -S -m "feat(ads): mount AdScripts in root layout"
```

---

## Task 11: Place AdSlot on /dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Read current file**

```bash
cat src/app/dashboard/page.tsx
```

Locate the section where "Best by mode" ends and the WPM progression chart begins. The component likely has a section heading like `<h2>Best by mode</h2>` followed by the best-by-mode content, then the `<WpmProgressionChart ...>` component.

- [ ] **Step 2: Insert `<AdSlot>` between the two sections**

Add this import at the top (alongside existing imports):

```tsx
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/components/ads/slot-ids';
```

Between the "Best by mode" section's closing tag and the `<WpmProgressionChart>` component, insert:

```tsx
<AdSlot slotId={AD_SLOTS.dashboard} className="my-8" />
```

- [ ] **Step 3: Verify**

```bash
pnpm lint && pnpm typecheck && pnpm test tests/unit && pnpm build
```

Build passes. Since env vars are unset, `<AdSlot>` renders null in dev — layout is unchanged visually.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -s -S -m "feat(ads): place AdSlot on /dashboard between best-by-mode and chart"
```

---

## Task 12: Place AdSlot on /history (top + bottom)

**Files:**
- Modify: `src/app/history/page.tsx`

- [ ] **Step 1: Read current file**

```bash
cat src/app/history/page.tsx
```

Locate: the filter tabs component (likely `<HistoryFilterTabs>` or similar), the results list, and the "Load more" link.

- [ ] **Step 2: Add imports**

At the top of the imports block:

```tsx
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/components/ads/slot-ids';
```

- [ ] **Step 3: Insert top AdSlot below filter tabs, above the results list**

Right after the closing tag of the filter-tabs component and before the results list rendering:

```tsx
<AdSlot slotId={AD_SLOTS.historyTop} className="my-6" />
```

- [ ] **Step 4: Insert bottom AdSlot above "Load more"**

If the page has a "Load more" or cursor-pagination link at the bottom, insert an AdSlot right before it:

```tsx
<AdSlot slotId={AD_SLOTS.historyBottom} className="my-6" />
```

If the pagination link only appears conditionally (e.g. `{hasMore ? <Link...>Load more</Link> : null}`), keep the AdSlot unconditional (shows whenever the page has results).

- [ ] **Step 5: Verify**

```bash
pnpm lint && pnpm typecheck && pnpm test tests/unit && pnpm build
```

All pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/history/page.tsx
git commit -s -S -m "feat(ads): place AdSlots on /history above list and above pagination"
```

---

## Task 13: Place AdSlot on leaderboard pages

**Files:**
- Modify: `src/app/leaderboard/page.tsx`
- Modify: `src/app/leaderboard/today/page.tsx`
- Modify: `src/app/leaderboard/weekly/page.tsx`
- Modify: `src/app/leaderboard/monthly/page.tsx`

These four pages likely share a `<LeaderboardPage>` or similar component. If so, modify that component once. If they're independent, modify all four identically.

- [ ] **Step 1: Investigate the structure**

```bash
cat src/app/leaderboard/page.tsx
grep -l 'LeaderboardPage\|LeaderboardTable\|WindowNav' src/components/ src/app/ -r
```

If a shared component exists (e.g. `src/components/leaderboard/LeaderboardPage.tsx`), that's where to insert. Otherwise modify the four page files.

- [ ] **Step 2: Add AdSlot between window-nav tabs and the leaderboard table**

Pick the shared component path if one exists; otherwise the four page files. Add imports at the top:

```tsx
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/components/ads/slot-ids';
```

Between the `<WindowNav>` (or equivalent window-tab component) closing tag and the `<LeaderboardTable>` opening tag, insert:

```tsx
<AdSlot slotId={AD_SLOTS.leaderboard} className="my-6" />
```

- [ ] **Step 3: Verify**

```bash
pnpm lint && pnpm typecheck && pnpm test tests/unit && pnpm build
```

All pass. Build output shows all four leaderboard routes.

- [ ] **Step 4: Commit**

```bash
git add src/app/leaderboard src/components/leaderboard 2>/dev/null
git commit -s -S -m "feat(ads): place AdSlot on leaderboard pages below window tabs"
```

---

## Task 14: Place AdSlot on /profile/[username]

**Files:**
- Modify: `src/app/profile/[username]/page.tsx`

- [ ] **Step 1: Read current file**

```bash
cat src/app/profile/[username]/page.tsx
```

The profile page mirrors the dashboard — "Best by mode" section then WPM progression chart.

- [ ] **Step 2: Add imports**

At the top:

```tsx
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/components/ads/slot-ids';
```

- [ ] **Step 3: Insert `<AdSlot>` between "Best by mode" and the chart**

Between the end of the best-by-mode section and the `<WpmProgressionChart>`:

```tsx
<AdSlot slotId={AD_SLOTS.profile} className="my-8" />
```

- [ ] **Step 4: Verify**

```bash
pnpm lint && pnpm typecheck && pnpm test tests/unit && pnpm build
```

All pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/profile/[username]/page.tsx
git commit -s -S -m "feat(ads): place AdSlot on /profile/[username] between best-by-mode and chart"
```

---

## Task 15: SETUP.md — AdSense section

**Files:**
- Modify: `docs/SETUP.md`

- [ ] **Step 1: Check the current end of SETUP.md**

```bash
tail -20 docs/SETUP.md
```

Identify the append point (should be at the end of the file, after the "CI & Deploy Automation" section).

- [ ] **Step 2: Append the new section**

Append to the bottom of `docs/SETUP.md`:

````markdown
## AdSense

Typing Speed is wired to serve Google AdSense ads on dashboard, history, leaderboard, and profile pages. Until the site is approved by AdSense and the env vars below are set, `<AdSlot>` components render null and no AdSense script loads.

### Pre-application checklist

Before submitting the site to AdSense:

1. Production deployment is live on Vercel with substantial typing content.
2. `/privacy`, `/terms`, `/about` pages exist and are reachable from the footer.
3. `public/ads.txt` file exists (placeholder is fine; real value comes after approval).
4. No ads are displaying yet — this is correct behavior pre-approval.

### Application

1. Apply at <https://www.google.com/adsense/start/>.
2. Use your production domain.
3. Wait for review. Approvals typically take days to weeks.

### Post-approval rollout

In order:

1. **AdSense dashboard → Sites** — confirm site is verified.
2. **AdSense dashboard → Ads → By ad unit** — create 5 ad units matching the slot registry: `dashboard`, `history-top`, `history-bottom`, `leaderboard`, `profile`. Any ad unit type is fine (Display is the default). Copy each unit's slot ID.
3. **Update `src/components/ads/slot-ids.ts`** with the real IDs. Commit.
4. **Edit `public/ads.txt`** — uncomment the line and replace `REPLACE_WITH_YOUR_PUB_ID` with your real publisher ID (e.g. `pub-1234567890123456`). Commit.
5. **Set Vercel production env vars**:
   - `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID=ca-pub-1234567890123456`
   - `NEXT_PUBLIC_ADSENSE_ENABLED=true`
6. **Redeploy** production.
7. **AdSense dashboard → Privacy & messaging → Configure EU messaging** — enable Funding Choices with the default template.
8. **Verify live**:
   - Open production in an incognito window. Visit `/dashboard` or `/leaderboard`. An ad should eventually load.
   - Open production from an EU VPN. Funding Choices consent banner should appear.

### Emergency kill switch

Set `NEXT_PUBLIC_ADSENSE_ENABLED=false` in Vercel and redeploy. No code change required.

### Troubleshooting

- **Ads blocked by extensions** — test with ad blockers disabled.
- **New approval delay** — fill rate is often low for the first 48-72 hours. Normal.
- **Application rejection** — common causes include thin content, missing legal pages, or policy issues. Fix and resubmit (Google allows multiple attempts).
- **`ads.txt` errors in AdSense dashboard** — verify `https://<prod-domain>/ads.txt` returns 200 with the uncommented line containing your real publisher ID.
````

- [ ] **Step 3: Verify**

```bash
head -60 docs/SETUP.md
tail -60 docs/SETUP.md
```

Eyeball: consistent heading levels, no broken markdown.

- [ ] **Step 4: Commit**

```bash
git add docs/SETUP.md
git commit -s -S -m "docs: add AdSense section to SETUP.md"
```

---

## Task 16: Final verification

**Files:** none (verification only).

- [ ] **Step 1: File structure check**

```bash
ls src/app/privacy/ src/app/terms/ src/app/about/ src/components/ads/
test -f public/ads.txt && echo "ads.txt OK"
```

Expected:
```
src/app/privacy/page.tsx
src/app/terms/page.tsx
src/app/about/page.tsx
src/components/ads/AdScripts.tsx
src/components/ads/AdSlot.tsx
src/components/ads/slot-ids.ts
ads.txt OK
```

- [ ] **Step 2: All four gates green**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all pass. Test count includes the 4 new AdSlot tests (previously 99 passing → now 103).

- [ ] **Step 3: Footer renders links**

Temporarily start a dev server (optional — only if you want visual confirmation):

```bash
pnpm dev &
sleep 3
curl -s http://localhost:3000 | grep -oE 'Privacy|Terms|About' | sort -u
kill %1
```

Expected output: `About`, `Privacy`, `Terms`.

- [ ] **Step 4: Env vars unset → no AdSense script in HTML**

```bash
pnpm build && pnpm start &
sleep 3
curl -s http://localhost:3000/dashboard | grep -c adsbygoogle
kill %1
```

Expected: `0` (no ad script because env vars are unset). Running dev server on /dashboard requires sign-in; it's OK if this step errors with a redirect — the key signal is no AdSense script presence.

- [ ] **Step 5: Commit status clean**

```bash
git status
```

Expected: clean working tree.

- [ ] **Step 6: Branch commits**

```bash
git log --oneline phase-4/adsense ^main | head -20
```

Expected: ~16 implementation commits + 1 design spec + 1 plan (18 total).

---

## Post-implementation (user action, NOT part of this plan)

These steps are performed by the user after the PR lands:

1. Open a PR from `phase-4/adsense` → `main`. CI will run.
2. Merge after CI green.
3. Vercel auto-deploys main with footer + legal pages live.
4. Submit AdSense application at https://www.google.com/adsense/start/ with the Vercel production domain.
5. Wait for approval (days to weeks).
6. Follow `docs/SETUP.md` → "AdSense" → "Post-approval rollout" once approved.

---

## Self-review notes

**Spec coverage vs plan:**

- Spec §1 (scope): all deliverables covered.
- Spec §2 (architecture): legal pages (Tasks 2-5), ad surface (Tasks 7-10), consent (Task 8 — AdScripts includes Funding Choices tag). Tick.
- Spec §3 (legal pages): Tasks 2, 3, 4, 5, 6 each cover one deliverable.
- Spec §4 (ad integration): Task 7 (AdSlot), Task 8 (AdScripts), Task 9 (slot IDs), Tasks 11-14 (placements). Tick.
- Spec §5 (consent): Task 8 includes Funding Choices script. Dashboard setup documented in Task 15.
- Spec §6 (env gating + rollout): Task 1 (env vars), Task 15 (SETUP.md rollout).
- Spec §7 (testing): Task 7 covers AdSlot unit tests.
- Spec §8 (risks) / §9 (success criteria): informational; no tasks needed.

**Placeholder scan:** No "TBD" / "implement later" / unresolved placeholders. The `REPLACE_AFTER_APPROVAL` and `REPLACE_WITH_YOUR_PUB_ID` strings are *intentional* runtime placeholders (post-approval substitution), not plan placeholders. The `/ads.txt` file is correctly described as "commented placeholder" per the spec.

**Type consistency:**
- `AD_SLOTS` key names (`dashboard`, `historyTop`, `historyBottom`, `leaderboard`, `profile`) are consistent between Task 9 (registry) and Tasks 11-14 (placements).
- `NEXT_PUBLIC_ADSENSE_PUBLISHER_ID` / `NEXT_PUBLIC_ADSENSE_ENABLED` env var names are consistent between Task 1 (declaration), Task 7 (AdSlot consumption), Task 8 (AdScripts consumption), and Task 15 (documentation).
- `<AdSlot>` props signature (`slotId`, `format?`, `className?`) is consistent between definition (Task 7) and all placements (Tasks 11-14).

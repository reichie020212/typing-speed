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
      <p className="mt-3 text-sm leading-relaxed">Typing Speed uses a small number of cookies:</p>
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

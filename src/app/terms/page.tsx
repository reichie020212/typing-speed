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

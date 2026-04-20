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

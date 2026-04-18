import Link from 'next/link';

export default function LandingPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col items-center justify-center gap-10 px-6 text-center">
      <div className="space-y-4">
        <h1 className="text-5xl font-semibold tracking-tight text-[color:var(--fg)] sm:text-6xl">
          Typing Speed
        </h1>
        <p className="text-lg text-[color:var(--muted)]">Test your typing speed. Race later.</p>
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

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
      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/single-player"
          className="flex flex-col gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-5 text-left transition-colors hover:border-[color:var(--accent)]"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-[color:var(--accent)]">
            Single player
          </span>
          <span className="text-sm text-[color:var(--muted)]">
            Type a passage. See your WPM and accuracy.
          </span>
        </Link>
        <Link
          href="/race"
          className="flex flex-col gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-5 text-left transition-colors hover:border-[color:var(--accent)]"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-[color:var(--accent)]">
            Race multiplayer
          </span>
          <span className="text-sm text-[color:var(--muted)]">
            Type against friends. Share a code. First to finish wins.
          </span>
        </Link>
        <Link
          href="/leaderboard"
          className="flex flex-col gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-5 text-left transition-colors hover:border-[color:var(--accent)]"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-[color:var(--accent)]">
            Leaderboards
          </span>
          <span className="text-sm text-[color:var(--muted)]">
            See how you rank against the fastest typists.
          </span>
        </Link>
      </div>
    </section>
  );
}

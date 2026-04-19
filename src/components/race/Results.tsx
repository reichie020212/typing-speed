'use client';

import Link from 'next/link';
import type { EndedEvent } from '@/lib/race/events';

export function Results({
  results,
  code,
  loggedIn,
}: {
  results: EndedEvent['results'];
  code: string;
  loggedIn: boolean;
}) {
  const finished = results.filter((r) => r.status === 'finished');
  const dnf = results.filter((r) => r.status === 'dnf');
  return (
    <section className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-xl font-semibold">Race {code} — results</h1>

      {!loggedIn ? (
        <div className="mt-4 rounded-lg border border-[color:var(--accent)] bg-[color:var(--surface)] p-4">
          <p className="text-sm">Sign in with Google to save your future races to your profile.</p>
          <Link
            href={`/auth/signin?callbackUrl=/race/${code}`}
            className="mt-2 inline-block text-sm text-[color:var(--accent)] hover:underline"
          >
            Sign in →
          </Link>
        </div>
      ) : null}

      <table className="mt-6 w-full text-sm">
        <thead className="text-left text-[color:var(--muted)]">
          <tr>
            <th className="w-10 py-2">#</th>
            <th className="py-2">Name</th>
            <th className="py-2 text-right">WPM</th>
            <th className="py-2 text-right">Accuracy</th>
            <th className="py-2 text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {finished.map((r) => (
            <tr key={r.playerId} className="border-t border-[color:var(--border)]">
              <td className="py-2">{r.finishPosition}</td>
              <td className="py-2">{r.nickname}</td>
              <td className="py-2 text-right tabular-nums">{Math.round(r.wpm)}</td>
              <td className="py-2 text-right tabular-nums">{(r.accuracy * 100).toFixed(1)}%</td>
              <td className="py-2 text-right tabular-nums">{(r.durationMs / 1000).toFixed(1)}s</td>
            </tr>
          ))}
          {dnf.length > 0 ? (
            <>
              <tr>
                <td colSpan={5} className="pt-4 text-xs uppercase text-[color:var(--muted)]">
                  Did not finish
                </td>
              </tr>
              {dnf.map((r) => (
                <tr key={r.playerId} className="border-t border-[color:var(--border)]">
                  <td className="py-2">—</td>
                  <td className="py-2">{r.nickname}</td>
                  <td className="py-2 text-right tabular-nums">—</td>
                  <td className="py-2 text-right tabular-nums">—</td>
                  <td className="py-2 text-right tabular-nums">—</td>
                </tr>
              ))}
            </>
          ) : null}
        </tbody>
      </table>

      <div className="mt-8 flex gap-3">
        <Link
          href="/race"
          className="rounded bg-[color:var(--accent)] px-4 py-2 text-[color:var(--accent-foreground)]"
        >
          Create new race
        </Link>
        <Link href="/" className="rounded border border-[color:var(--border)] px-4 py-2">
          Home
        </Link>
      </div>
    </section>
  );
}

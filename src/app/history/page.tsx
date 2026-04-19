import Link from 'next/link';
import { LocalDate } from '@/components/chrome/LocalDate';
import { requireSession } from '@/lib/auth/guards';
import { listResultsForUser } from '@/lib/db/results';

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
function fmtConfig(r: {
  mode: string;
  fixedLength: string | null;
  timeDuration: number | null;
  wordCount: number | null;
}): string {
  if (r.mode === 'fixed') return `fixed · ${r.fixedLength ?? '?'}`;
  if (r.mode === 'time') return `time · ${r.timeDuration ?? '?'}s`;
  if (r.mode === 'words') return `words · ${r.wordCount ?? '?'}`;
  return r.mode;
}

interface Props {
  searchParams: Promise<{ cursor?: string }>;
}

export default async function HistoryPage({ searchParams }: Props) {
  const session = await requireSession('/history');
  const { cursor } = await searchParams;

  const { items, nextCursor } = await listResultsForUser(session.user.id, {
    cursor,
    limit: 25,
  });

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <Link href="/dashboard" className="text-xs text-[color:var(--accent)] hover:underline">
          ← Dashboard
        </Link>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-[color:var(--muted)]">
          No tests yet.{' '}
          <Link className="underline" href="/single-player">
            Take your first test
          </Link>
          .
        </p>
      ) : (
        <>
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
              <tr>
                <th className="py-2 text-left font-normal">Date</th>
                <th className="py-2 text-left font-normal">Mode</th>
                <th className="py-2 text-right font-normal">WPM</th>
                <th className="py-2 text-right font-normal">Raw</th>
                <th className="py-2 text-right font-normal">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-t border-[color:var(--border)]">
                  <td className="py-2">
                    <LocalDate iso={r.createdAt.toISOString()} />
                  </td>
                  <td className="py-2 text-[color:var(--muted)]">{fmtConfig(r)}</td>
                  <td className="py-2 text-right font-mono">{Math.round(r.wpm)}</td>
                  <td className="py-2 text-right font-mono text-[color:var(--muted)]">
                    {Math.round(r.rawWpm)}
                  </td>
                  <td className="py-2 text-right font-mono">{fmtPct(r.accuracy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {nextCursor ? (
            <div className="mt-6 text-center">
              <Link
                href={`/history?cursor=${nextCursor}`}
                className="inline-flex rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm text-[color:var(--fg)] hover:bg-[color:var(--faint)]"
              >
                Load more
              </Link>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

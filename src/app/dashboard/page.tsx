import Link from 'next/link';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/components/ads/slot-ids';
import { WpmProgressionChart } from '@/components/charts/WpmProgressionChart';
import { LocalDate } from '@/components/chrome/LocalDate';
import { requireSession } from '@/lib/auth/guards';
import { getWpmProgression } from '@/lib/db/leaderboards';
import { getUserStats, listResultsForUser } from '@/lib/db/results';

function fmtWpm(n: number | null): string {
  return n === null ? '—' : Math.round(n).toString();
}
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

export default async function DashboardPage() {
  const session = await requireSession('/dashboard');
  const [stats, recent, progression] = await Promise.all([
    getUserStats(session.user.id),
    listResultsForUser(session.user.id, { limit: 5 }),
    getWpmProgression(session.user.id, { limit: 50 }),
  ]);

  const chartPoints = progression.map((p) => ({
    createdAt: p.createdAt.toISOString(),
    wpm: p.wpm,
    mode: p.mode,
  }));

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Signed in as <span className="font-mono">{session.user.username}</span>
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Best WPM" value={fmtWpm(stats.bestWpm)} accent />
        <Stat label="Avg WPM" value={fmtWpm(stats.avgWpm)} />
        <Stat label="Tests" value={stats.totalTests.toString()} />
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-[color:var(--muted)]">
          Best by mode
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <ModeBest label="fixed" value={fmtWpm(stats.bestByMode.fixed)} />
          <ModeBest label="time" value={fmtWpm(stats.bestByMode.time)} />
          <ModeBest label="words" value={fmtWpm(stats.bestByMode.words)} />
        </div>
      </div>

      <AdSlot slotId={AD_SLOTS.dashboard} className="my-8" />

      <div className="mt-10">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-[color:var(--muted)]">
          WPM progression
        </h2>
        <WpmProgressionChart points={chartPoints} />
      </div>

      <div className="mt-10">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm uppercase tracking-widest text-[color:var(--muted)]">
            Recent tests
          </h2>
          <Link href="/history" className="text-xs text-[color:var(--accent)] hover:underline">
            View all →
          </Link>
        </div>
        {recent.items.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">
            No tests yet.{' '}
            <Link className="underline" href="/single-player">
              Take your first test
            </Link>
            .
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
              <tr>
                <th className="py-2 text-left font-normal">Date</th>
                <th className="py-2 text-left font-normal">Mode</th>
                <th className="py-2 text-right font-normal">WPM</th>
                <th className="py-2 text-right font-normal">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {recent.items.map((r) => (
                <tr key={r.id} className="border-t border-[color:var(--border)]">
                  <td className="py-2">
                    <LocalDate iso={r.createdAt.toISOString()} />
                  </td>
                  <td className="py-2 text-[color:var(--muted)]">{fmtConfig(r)}</td>
                  <td className="py-2 text-right font-mono">{Math.round(r.wpm)}</td>
                  <td className="py-2 text-right font-mono">{fmtPct(r.accuracy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div
        className={`text-4xl font-semibold ${accent ? 'text-[color:var(--accent)]' : 'text-[color:var(--fg)]'}`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-widest text-[color:var(--muted)]">
        {label}
      </div>
    </div>
  );
}

function ModeBest({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div className="text-2xl font-semibold text-[color:var(--fg)]">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-widest text-[color:var(--muted)]">
        {label}
      </div>
    </div>
  );
}

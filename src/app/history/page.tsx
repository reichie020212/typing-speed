import Link from 'next/link';
import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/components/ads/slot-ids';
import { LocalDate } from '@/components/chrome/LocalDate';
import { HistoryFilterTabs } from '@/components/history/HistoryFilterTabs';
import { requireSession } from '@/lib/auth/guards';
import { listResultsForUser } from '@/lib/db/results';
import { normalizeDifficulty, normalizeMode } from '@/lib/params';

const MODE_OPTIONS = [
  { value: undefined, label: 'all' },
  { value: 'fixed' as const, label: 'fixed' },
  { value: 'time' as const, label: 'time' },
  { value: 'words' as const, label: 'words' },
];

const DIFFICULTY_OPTIONS = [
  { value: undefined, label: 'all' },
  { value: 'easy' as const, label: 'easy' },
  { value: 'medium' as const, label: 'medium' },
  { value: 'hard' as const, label: 'hard' },
];

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

function buildHref(
  mode: 'fixed' | 'time' | 'words' | undefined,
  difficulty: 'easy' | 'medium' | 'hard' | undefined,
): string {
  const params = new URLSearchParams();
  if (mode) params.set('mode', mode);
  if (difficulty) params.set('difficulty', difficulty);
  const qs = params.toString();
  return qs ? `/history?${qs}` : '/history';
}

interface Props {
  searchParams: Promise<{ cursor?: string; mode?: string; difficulty?: string }>;
}

export default async function HistoryPage({ searchParams }: Props) {
  const session = await requireSession('/history');
  const { cursor, mode: modeRaw, difficulty: diffRaw } = await searchParams;
  const mode = normalizeMode(modeRaw);
  const difficulty = normalizeDifficulty(diffRaw);

  const { items, nextCursor } = await listResultsForUser(session.user.id, {
    cursor,
    limit: 25,
    mode,
    difficulty,
  });

  const hasFilter = !!mode || !!difficulty;
  const baseHref = buildHref(mode, difficulty);
  const loadMoreHref = nextCursor
    ? `${baseHref}${baseHref.includes('?') ? '&' : '?'}cursor=${nextCursor}`
    : null;

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <Link href="/dashboard" className="text-xs text-[color:var(--accent)] hover:underline">
          ← Dashboard
        </Link>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <HistoryFilterTabs
          label="mode"
          options={MODE_OPTIONS}
          current={mode}
          buildHref={(v) => buildHref(v, difficulty)}
        />
        <HistoryFilterTabs
          label="difficulty"
          options={DIFFICULTY_OPTIONS}
          current={difficulty}
          buildHref={(v) => buildHref(mode, v)}
        />
      </div>

      <AdSlot slotId={AD_SLOTS.historyTop} className="my-6" />

      {items.length === 0 ? (
        hasFilter ? (
          <p className="text-sm text-[color:var(--muted)]">No results match these filters.</p>
        ) : (
          <p className="text-sm text-[color:var(--muted)]">
            No tests yet.{' '}
            <Link className="underline" href="/single-player">
              Take your first test
            </Link>
            .
          </p>
        )
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
          <AdSlot slotId={AD_SLOTS.historyBottom} className="my-6" />
          {loadMoreHref ? (
            <div className="mt-6 text-center">
              <Link
                href={loadMoreHref}
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

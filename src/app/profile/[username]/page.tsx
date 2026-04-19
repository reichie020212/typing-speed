import Link from 'next/link';
import { notFound } from 'next/navigation';
import { renameUsernameFormAction } from '@/app/actions/username';
import { auth } from '@/auth';
import { WpmProgressionChart } from '@/components/charts/WpmProgressionChart';
import { LocalDate } from '@/components/chrome/LocalDate';
import { Button } from '@/components/ui/Button';
import { isAuthConfigured } from '@/env';
import { getWpmProgression } from '@/lib/db/leaderboards';
import { getUserStats, listResultsForUser } from '@/lib/db/results';
import { getUserByUsername } from '@/lib/db/users';

export const metadata = { robots: 'noindex, nofollow' };

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

interface Props {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ rename?: string }>;
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const { rename } = await searchParams;

  if (!isAuthConfigured()) {
    return (
      <section className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Profiles aren&apos;t configured yet</h1>
        <p className="mt-3 text-sm text-[color:var(--muted)]">See SETUP.md.</p>
      </section>
    );
  }

  const user = await getUserByUsername(username);
  if (!user) notFound();

  const session = await auth();
  const isOwner = session?.user?.id === user.id;

  const [stats, recent, progression] = await Promise.all([
    getUserStats(user.id),
    listResultsForUser(user.id, { limit: 10 }),
    getWpmProgression(user.id, { limit: 50 }),
  ]);

  const chartPoints = progression.map((p) => ({
    createdAt: p.createdAt.toISOString(),
    wpm: p.wpm,
    mode: p.mode,
  }));

  const renameMessage =
    rename === 'invalid'
      ? 'That username is invalid (use 3-24 lowercase letters, numbers, or hyphens; no reserved names).'
      : rename === 'taken'
        ? 'That username is taken.'
        : rename === 'unauthenticated'
          ? 'You must be signed in.'
          : null;

  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-6 flex items-center gap-4">
        {user.image ? (
          // biome-ignore lint/performance/noImgElement: profile avatar, server component.
          <img src={user.image} alt="" width={48} height={48} className="rounded-full" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--faint)] text-lg text-[color:var(--fg)]">
            {user.username.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            <span className="font-mono">{user.username}</span>
          </h1>
          <p className="text-xs text-[color:var(--muted)]">
            Joined <LocalDate iso={user.createdAt.toISOString()} />
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Best WPM" value={fmtWpm(stats.bestWpm)} accent />
        <Stat label="Avg WPM" value={fmtWpm(stats.avgWpm)} />
        <Stat label="Tests" value={stats.totalTests.toString()} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-[color:var(--muted)]">
          Best by mode
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <ModeBest label="fixed" value={fmtWpm(stats.bestByMode.fixed)} />
          <ModeBest label="time" value={fmtWpm(stats.bestByMode.time)} />
          <ModeBest label="words" value={fmtWpm(stats.bestByMode.words)} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-[color:var(--muted)]">
          WPM progression
        </h2>
        <WpmProgressionChart points={chartPoints} />
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm uppercase tracking-widest text-[color:var(--muted)]">
          Recent tests
        </h2>
        {recent.items.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">No tests yet.</p>
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

      {isOwner ? (
        <div className="mt-10 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
          <h2 className="text-sm uppercase tracking-widest text-[color:var(--muted)]">
            Rename username
          </h2>
          <p className="mt-2 text-xs text-[color:var(--muted)]">
            Warning: renaming will break any shared links to your old profile.
          </p>
          <form action={renameUsernameFormAction} className="mt-3 flex items-center gap-2">
            <input
              name="username"
              defaultValue={user.username}
              className="flex-1 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-1.5 font-mono text-sm text-[color:var(--fg)]"
              pattern="[a-z0-9][a-z0-9-]{2,23}"
              minLength={3}
              maxLength={24}
              required
            />
            <Button type="submit" variant="primary">
              Save
            </Button>
          </form>
          {renameMessage ? (
            <p className="mt-2 text-xs text-[color:var(--danger)]">{renameMessage}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8">
        <Link href="/" className="text-xs text-[color:var(--accent)] hover:underline">
          ← Back to home
        </Link>
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

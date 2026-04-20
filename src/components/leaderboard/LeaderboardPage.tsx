import { AdSlot } from '@/components/ads/AdSlot';
import { AD_SLOTS } from '@/components/ads/slot-ids';
import { isAuthConfigured } from '@/env';
import { getLeaderboard } from '@/lib/db/leaderboards';
import { type Window, windowDeadline } from '@/lib/db/time-windows';
import { normalizeModeFilter, parseOffset } from '@/lib/params';
import { LeaderboardTable } from './LeaderboardTable';
import { ModeTabs } from './ModeTabs';
import { ShowMoreLink } from './ShowMoreLink';
import { WindowCountdown } from './WindowCountdown';
import { WindowNav } from './WindowNav';

const LIMIT = 100;

function pathnameFor(window: Window): string {
  if (window === 'alltime') return '/leaderboard';
  return `/leaderboard/${window}`;
}

function headingFor(window: Window): string {
  switch (window) {
    case 'alltime':
      return 'All-time leaderboard';
    case 'today':
      return 'Today';
    case 'weekly':
      return 'This week';
    case 'monthly':
      return 'This month';
  }
}

interface Props {
  window: Window;
  searchParams: Promise<{ mode?: string; offset?: string }>;
}

export async function LeaderboardPage({ window, searchParams }: Props) {
  if (!isAuthConfigured()) {
    return (
      <section className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Leaderboards aren&apos;t configured yet</h1>
        <p className="mt-3 text-sm text-[color:var(--muted)]">See SETUP.md.</p>
      </section>
    );
  }

  const sp = await searchParams;
  const mode = normalizeModeFilter(sp.mode);
  const offset = parseOffset(sp.offset);
  const pathname = pathnameFor(window);

  const raw = await getLeaderboard({ window, mode, limit: LIMIT + 1, offset });
  const hasMore = raw.length > LIMIT;
  const rows = hasMore ? raw.slice(0, LIMIT) : raw;
  const deadline = windowDeadline(window);

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{headingFor(window)}</h1>
          {deadline ? <WindowCountdown deadline={deadline.toISOString()} /> : null}
        </div>
        <WindowNav active={window} />
      </header>

      <ModeTabs pathname={pathname} active={mode} />

      <AdSlot slotId={AD_SLOTS.leaderboard} className="my-6" />

      <div className="mt-6">
        {rows.length === 0 ? (
          <p className="text-sm text-[color:var(--muted)]">
            No qualifying results yet.{' '}
            {window !== 'alltime'
              ? 'Users need at least 3 tests in this window to appear.'
              : 'Be the first!'}
          </p>
        ) : (
          <LeaderboardTable rows={rows} />
        )}
      </div>

      {hasMore ? (
        <ShowMoreLink pathname={pathname} mode={mode} nextOffset={offset + LIMIT} />
      ) : null}
    </section>
  );
}

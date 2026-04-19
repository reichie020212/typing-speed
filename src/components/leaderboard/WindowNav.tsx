import Link from 'next/link';
import type { Window } from '@/lib/db/time-windows';

const ROUTES: Array<{ window: Window; href: string; label: string }> = [
  { window: 'alltime', href: '/leaderboard', label: 'All-time' },
  { window: 'today', href: '/leaderboard/today', label: 'Today' },
  { window: 'weekly', href: '/leaderboard/weekly', label: 'Weekly' },
  { window: 'monthly', href: '/leaderboard/monthly', label: 'Monthly' },
];

export function WindowNav({ active }: { active: Window }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {ROUTES.map((r) => {
        const selected = r.window === active;
        return (
          <Link
            key={r.window}
            href={r.href}
            className={`rounded-md border border-[color:var(--border)] px-3 py-1.5 text-xs uppercase tracking-widest transition-colors ${
              selected
                ? 'border-[color:var(--accent)] text-[color:var(--accent)]'
                : 'text-[color:var(--muted)] hover:text-[color:var(--fg)]'
            }`}
          >
            {r.label}
          </Link>
        );
      })}
    </nav>
  );
}

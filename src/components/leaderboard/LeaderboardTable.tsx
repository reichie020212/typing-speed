import Link from 'next/link';
import { LocalDate } from '@/components/chrome/LocalDate';
import type { LeaderboardRow } from '@/lib/db/leaderboards';

interface Props {
  rows: LeaderboardRow[];
}

export function LeaderboardTable({ rows }: Props) {
  return (
    <table className="w-full text-sm">
      <thead className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
        <tr>
          <th className="py-2 text-right font-normal">#</th>
          <th className="py-2 text-left font-normal">User</th>
          <th className="py-2 text-left font-normal">Mode</th>
          <th className="py-2 text-right font-normal">WPM</th>
          <th className="py-2 text-right font-normal">Acc</th>
          <th className="py-2 text-right font-normal">Date</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.userId} className="border-t border-[color:var(--border)]">
            <td className="py-2 text-right font-mono text-[color:var(--muted)]">{r.rank}</td>
            <td className="py-2">
              <Link
                href={`/profile/${r.username}`}
                className="flex items-center gap-2 hover:text-[color:var(--accent)]"
              >
                {r.image ? (
                  // biome-ignore lint/performance/noImgElement: small avatar in table row.
                  <img
                    src={r.image}
                    alt=""
                    width={20}
                    height={20}
                    className="rounded-full"
                  />
                ) : (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--faint)] text-[10px] text-[color:var(--fg)]">
                    {r.username.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="font-mono">{r.username}</span>
              </Link>
            </td>
            <td className="py-2 text-[color:var(--muted)]">{r.mode}</td>
            <td className="py-2 text-right font-mono text-[color:var(--accent)]">
              {Math.round(r.wpm)}
            </td>
            <td className="py-2 text-right font-mono text-[color:var(--muted)]">
              {Math.round(r.accuracy * 100)}%
            </td>
            <td className="py-2 text-right text-[color:var(--muted)]">
              <LocalDate iso={r.createdAt.toISOString()} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

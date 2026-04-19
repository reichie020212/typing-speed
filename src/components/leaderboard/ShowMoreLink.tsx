import Link from 'next/link';
import type { ModeFilter } from '@/lib/db/leaderboards';

interface Props {
  pathname: string;
  mode: ModeFilter;
  nextOffset: number;
}

export function ShowMoreLink({ pathname, mode, nextOffset }: Props) {
  const params = new URLSearchParams();
  if (mode !== 'all') params.set('mode', mode);
  params.set('offset', String(nextOffset));
  const href = `${pathname}?${params.toString()}`;
  return (
    <div className="mt-6 text-center">
      <Link
        href={href}
        className="inline-flex rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm text-[color:var(--fg)] hover:bg-[color:var(--faint)]"
      >
        Show more
      </Link>
    </div>
  );
}

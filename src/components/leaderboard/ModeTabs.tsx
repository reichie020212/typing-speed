import Link from 'next/link';
import type { ModeFilter } from '@/lib/db/leaderboards';

interface Props {
  pathname: string;
  active: ModeFilter;
}

const OPTIONS: Array<{ value: ModeFilter; label: string }> = [
  { value: 'all', label: 'all' },
  { value: 'fixed', label: 'fixed' },
  { value: 'time', label: 'time' },
  { value: 'words', label: 'words' },
];

export function ModeTabs({ pathname, active }: Props) {
  return (
    <div
      className="mt-4 inline-flex rounded-md border border-[color:var(--border)] bg-[color:var(--surface)]"
      role="radiogroup"
      aria-label="mode"
    >
      {OPTIONS.map((opt) => {
        const href = opt.value === 'all' ? pathname : `${pathname}?mode=${opt.value}`;
        const selected = opt.value === active;
        return (
          <Link
            key={opt.value}
            href={href}
            role="radio"
            aria-checked={selected}
            className={`px-3 py-1.5 text-sm transition-colors ${
              selected
                ? 'bg-[color:var(--accent)] text-[color:var(--bg)]'
                : 'text-[color:var(--fg)] hover:bg-[color:var(--faint)]'
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}

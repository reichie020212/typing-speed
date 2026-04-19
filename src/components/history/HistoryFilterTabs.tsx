import Link from 'next/link';

interface Option<T extends string> {
  value: T | undefined;
  label: string;
}

interface Props<T extends string> {
  label: string;
  options: Option<T>[];
  current: T | undefined;
  buildHref: (value: T | undefined) => string;
}

export function HistoryFilterTabs<T extends string>({
  label,
  options,
  current,
  buildHref,
}: Props<T>) {
  return (
    <div className="inline-flex items-center gap-2" role="radiogroup" aria-label={label}>
      <span className="text-xs uppercase tracking-widest text-[color:var(--muted)]">{label}</span>
      <div className="inline-flex rounded-md border border-[color:var(--border)] bg-[color:var(--surface)]">
        {options.map((opt) => {
          const selected = opt.value === current;
          return (
            <Link
              key={opt.label}
              href={buildHref(opt.value)}
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
    </div>
  );
}

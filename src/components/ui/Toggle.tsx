'use client';

import { useCallback } from 'react';

export interface ToggleOption<T extends string | number> {
  value: T;
  label: string;
}

interface ToggleProps<T extends string | number> {
  options: ToggleOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  disabled?: boolean;
}

export function Toggle<T extends string | number>({
  options,
  value,
  onChange,
  label,
  disabled = false,
}: ToggleProps<T>) {
  const handle = useCallback(
    (v: T) => {
      if (disabled) return;
      onChange(v);
    },
    [onChange, disabled],
  );

  return (
    <div
      className="inline-flex items-center gap-2"
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled}
    >
      {label ? (
        <span className="text-xs uppercase tracking-widest text-[color:var(--muted)]">
          {label}
        </span>
      ) : null}
      <div
        className={`inline-flex rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] ${disabled ? 'opacity-50' : ''}`}
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => handle(opt.value)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                selected
                  ? 'bg-[color:var(--accent)] text-[color:var(--bg)]'
                  : 'text-[color:var(--fg)] hover:bg-[color:var(--faint)]'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

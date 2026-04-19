'use client';

import Link from 'next/link';
import { useState } from 'react';
import { validateNickname } from '@/lib/race/nickname';

export function NicknameModal({ onConfirm }: { onConfirm: (nickname: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Pick a nickname</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Shown to other racers during this race.
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const v = validateNickname(value);
            if (!v.ok) {
              setError(v.error);
              return;
            }
            onConfirm(v.normalized);
          }}
        >
          <input
            type="text"
            value={value}
            maxLength={16}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded border border-[color:var(--border)] bg-transparent p-2"
            placeholder="alice"
            aria-label="nickname"
          />
          {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
          <button
            type="submit"
            className="w-full rounded bg-[color:var(--accent)] p-2 text-[color:var(--accent-foreground)]"
          >
            Join race
          </button>
          <Link
            href="/race"
            className="block text-center text-sm text-[color:var(--muted)] hover:underline"
          >
            Cancel
          </Link>
        </form>
      </div>
    </div>
  );
}

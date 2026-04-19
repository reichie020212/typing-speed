'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function JoinRaceForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="rounded-lg border border-[color:var(--border)] p-6">
      <h2 className="text-lg font-semibold">Join a race</h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = code.trim().toUpperCase();
          if (!/^[A-Z0-9]{6}$/.test(trimmed)) {
            setError('Codes are 6 letters or digits.');
            return;
          }
          router.push(`/race/${trimmed}`);
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[color:var(--muted)]">Race code</span>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="rounded border border-[color:var(--border)] bg-transparent p-2 font-mono text-lg tracking-widest"
            placeholder="A7X2K9"
          />
        </label>
        <button type="submit" className="w-full rounded border border-[color:var(--border)] p-2">
          Join
        </button>
        {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
      </form>
    </div>
  );
}

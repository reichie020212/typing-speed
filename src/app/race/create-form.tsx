'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function CreateRaceForm() {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('short');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-[color:var(--border)] p-6">
      <h2 className="text-lg font-semibold">Create a race</h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const res = await fetch('/api/race', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ difficulty, length }),
            });
            if (!res.ok) {
              setError('Could not create race.');
              return;
            }
            const { code } = (await res.json()) as { code: string };
            router.push(`/race/${code}`);
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[color:var(--muted)]">Difficulty</span>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
            className="rounded border border-[color:var(--border)] bg-transparent p-2"
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[color:var(--muted)]">Length</span>
          <select
            value={length}
            onChange={(e) => setLength(e.target.value as 'short' | 'medium' | 'long')}
            className="rounded border border-[color:var(--border)] bg-transparent p-2"
          >
            <option value="short">Short</option>
            <option value="medium">Medium</option>
            <option value="long">Long</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded bg-[color:var(--accent)] p-2 text-[color:var(--accent-foreground)] disabled:opacity-60"
        >
          {pending ? 'Creating…' : 'Create race'}
        </button>
        {error ? <p className="text-sm text-[color:var(--danger)]">{error}</p> : null}
      </form>
    </div>
  );
}

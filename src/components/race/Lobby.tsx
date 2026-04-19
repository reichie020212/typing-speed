'use client';

import type { Participant } from '@/lib/race/events';

export function Lobby({
  code,
  players,
  me,
  onStart,
  onLeave,
}: {
  code: string;
  players: Participant[];
  me: Participant | null;
  onStart: () => void;
  onLeave: () => void;
}) {
  const isHost = me?.isHost ?? false;
  const canStart = isHost && players.length >= 2;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between rounded-lg border border-[color:var(--border)] p-4">
        <div>
          <div className="text-xs uppercase text-[color:var(--muted)]">Race code</div>
          <div className="font-mono text-3xl tracking-widest">{code}</div>
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(`${window.location.origin}/race/${code}`)}
          className="rounded border border-[color:var(--border)] px-3 py-1 text-sm"
        >
          Copy link
        </button>
      </div>

      <ul className="divide-y divide-[color:var(--border)] rounded-lg border border-[color:var(--border)]">
        {players.map((p) => (
          <li key={p.playerId} className="flex items-center gap-3 p-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-[color:var(--surface)] font-mono text-sm">
              {p.nickname.charAt(0).toUpperCase()}
            </div>
            <span className="flex-1 text-sm">{p.nickname}</span>
            {p.isHost ? (
              <span className="rounded bg-[color:var(--accent)] px-2 py-0.5 text-xs text-[color:var(--accent-foreground)]">
                host
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {isHost ? (
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="rounded bg-[color:var(--accent)] p-3 text-[color:var(--accent-foreground)] disabled:opacity-60"
        >
          {canStart ? 'Start race' : 'Waiting for another player\u2026'}
        </button>
      ) : (
        <p className="text-center text-sm text-[color:var(--muted)]">
          Waiting for host to start the race\u2026
        </p>
      )}

      <button
        type="button"
        onClick={onLeave}
        className="text-center text-xs text-[color:var(--muted)] hover:underline"
      >
        Leave race
      </button>
    </div>
  );
}

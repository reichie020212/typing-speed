'use client';

import type { Participant } from '@/lib/race/events';

export function Countdown({
  secondsRemaining,
  passageText,
  players,
}: {
  secondsRemaining: number | null;
  passageText: string;
  players: Participant[];
}) {
  const display = secondsRemaining === null ? '…' : secondsRemaining > 0 ? secondsRemaining : 'Go';
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-6 py-10">
      <div className="text-8xl font-bold tabular-nums">{display}</div>
      <div className="max-h-48 overflow-hidden text-center text-lg text-[color:var(--muted)]">
        {passageText}
      </div>
      <ul className="flex flex-wrap justify-center gap-3">
        {players.map((p) => (
          <li key={p.playerId} className="rounded bg-[color:var(--surface)] px-3 py-1 text-sm">
            {p.nickname}
          </li>
        ))}
      </ul>
    </div>
  );
}

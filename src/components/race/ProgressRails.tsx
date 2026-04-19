'use client';

import type { Participant } from '@/lib/race/events';

function colorFor(playerId: string): string {
  // deterministic hue per id
  let h = 0;
  for (let i = 0; i < playerId.length; i++) h = (h * 31 + playerId.charCodeAt(i)) % 360;
  return `hsl(${h} 70% 55%)`;
}

export function ProgressRails({
  players,
  sourceLength,
  mePlayerId,
}: {
  players: Participant[];
  sourceLength: number;
  mePlayerId: string | null;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {players.map((p) => {
        const pct = Math.min(100, Math.round((p.charIndex / Math.max(1, sourceLength)) * 100));
        const isMe = p.playerId === mePlayerId;
        return (
          <li key={p.playerId} className="flex items-center gap-3 text-sm">
            <span className={`w-24 truncate ${isMe ? 'font-semibold' : ''}`}>{p.nickname}</span>
            <div className="relative h-4 flex-1 rounded-full bg-[color:var(--surface)]">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${pct}%`, backgroundColor: colorFor(p.playerId) }}
              />
            </div>
            <span className="w-14 text-right tabular-nums text-[color:var(--muted)]">
              {Math.round(p.wpm)} wpm
            </span>
          </li>
        );
      })}
    </ul>
  );
}

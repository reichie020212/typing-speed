'use client';

import { useEffect, useMemo, useState } from 'react';
import type { EngineState, Mode } from '@/lib/engine';

interface Props {
  state: EngineState;
  mode: Mode;
  source: string;
  duration?: number;
  wordCount?: number;
}

function countCompletedWords(input: string, source: string): number {
  let n = 0;
  const upTo = Math.min(input.length, source.length);
  for (let i = 0; i < upTo; i++) {
    if (input[i] === ' ' && source[i] === ' ') n++;
  }
  return n;
}

export function LiveWpm({ state, mode, source, duration, wordCount }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (state.status !== 'running') return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [state.status]);

  const liveWpm = useMemo(() => {
    const startedAt = state.startedAt;
    if (!startedAt || state.status === 'idle') return 0;
    const endedAt = state.endedAt ?? Date.now();
    const minutes = (endedAt - startedAt) / 60_000;
    if (minutes <= 0) return 0;
    let correct = 0;
    const boundary = Math.min(state.input.length, source.length);
    for (let i = 0; i < boundary; i++) {
      if (state.input[i] === source[i]) correct++;
    }
    return Math.round(correct / 5 / minutes);
  }, [state, source]);

  let secondary: string | null = null;
  if (mode === 'time' && duration && state.startedAt) {
    const endedAt = state.endedAt ?? Date.now();
    const remaining = Math.max(0, Math.ceil(duration - (endedAt - state.startedAt) / 1000));
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    secondary = `${m}:${s.toString().padStart(2, '0')}`;
  } else if (mode === 'words' && wordCount) {
    secondary = `${countCompletedWords(state.input, source)} / ${wordCount}`;
  }

  return (
    <div className="inline-flex items-baseline gap-4 text-[color:var(--muted)]">
      <span className="font-mono text-2xl text-[color:var(--accent)]">
        {liveWpm}
        <span className="ml-1 text-xs uppercase tracking-widest">wpm</span>
      </span>
      {secondary ? (
        <span className="font-mono text-lg text-[color:var(--fg)]">{secondary}</span>
      ) : null}
    </div>
  );
}

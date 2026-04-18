'use client';

import type { RefObject } from 'react';
import { Button } from '@/components/ui/Button';
import type { Result } from '@/lib/engine';

interface Props {
  result: Result;
  onNext: () => void;
  onRestart: () => void;
  onChangeMode: () => void;
  nextButtonRef?: RefObject<HTMLButtonElement | null>;
}

function formatDuration(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${m}m ${rem}s`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="font-mono text-lg text-[color:var(--fg)]">{value}</div>
      <div className="text-xs uppercase tracking-widest">{label}</div>
    </div>
  );
}

export function ResultsPanel({ result, onNext, onRestart, onChangeMode, nextButtonRef }: Props) {
  return (
    <div className="mx-auto mt-8 flex w-full max-w-2xl flex-col gap-6 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
      <div className="flex items-baseline justify-around">
        <div className="text-center">
          <div className="text-5xl font-semibold text-[color:var(--accent)]">
            {Math.round(result.wpm)}
          </div>
          <div className="mt-1 text-xs uppercase tracking-widest text-[color:var(--muted)]">
            wpm
          </div>
        </div>
        <div className="text-center">
          <div className="text-5xl font-semibold text-[color:var(--fg)]">
            {Math.round(result.accuracy * 100)}%
          </div>
          <div className="mt-1 text-xs uppercase tracking-widest text-[color:var(--muted)]">
            accuracy
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm text-[color:var(--muted)] sm:grid-cols-5">
        <Stat label="raw" value={`${Math.round(result.rawWpm)}`} />
        <Stat label="time" value={formatDuration(result.durationMs)} />
        <Stat label="correct" value={`${result.chars.correct}`} />
        <Stat label="incorrect" value={`${result.chars.incorrect}`} />
        <Stat label="extra" value={`${result.chars.extra}`} />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button ref={nextButtonRef} variant="primary" onClick={onNext}>
          Next test
        </Button>
        <Button variant="ghost" onClick={onRestart}>
          Restart
        </Button>
        <Button variant="ghost" onClick={onChangeMode}>
          Change mode
        </Button>
      </div>
    </div>
  );
}

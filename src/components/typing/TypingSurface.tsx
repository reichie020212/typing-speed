'use client';

import type { EngineState } from '@/lib/engine';

interface Props {
  source: string;
  state: EngineState;
  dimmed?: boolean;
}

export function TypingSurface({ source, state, dimmed = false }: Props) {
  const input = state.input;
  const total = Math.max(source.length, input.length);

  return (
    <div
      className={`font-mono text-2xl leading-relaxed tracking-wide transition-opacity duration-300 ${dimmed ? 'opacity-40' : 'opacity-100'}`}
      style={{
        fontFamily: 'var(--font-mono), ui-monospace, monospace',
        maxWidth: '56ch',
        margin: '0 auto',
      }}
    >
      {Array.from({ length: total }).map((_, i) => {
        const expected = source[i];
        const typed = input[i];
        const isCurrent = !dimmed && state.status !== 'finished' && i === input.length;

        let cls = '';
        if (typed === undefined) {
          cls = 'text-[color:var(--muted)]';
        } else if (expected === undefined) {
          cls = 'text-[color:var(--danger)] bg-[color:var(--danger)]/10';
        } else if (typed === expected) {
          cls = 'text-[color:var(--fg)]';
        } else {
          cls = 'text-[color:var(--danger)] bg-[color:var(--danger)]/10';
        }

        const display = typed !== undefined ? typed : (expected ?? '');
        const showSpaceDot = display === ' ' && typed !== undefined && typed !== expected;

        return (
          <span
            key={i}
            data-idx={i}
            className={`${cls} ${isCurrent ? 'relative before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-[color:var(--accent)] before:animate-pulse' : ''}`}
          >
            {showSpaceDot ? '_' : display}
          </span>
        );
      })}
    </div>
  );
}

import type { CharStats, EngineState, Result } from './types';

export function computeCharStats(state: EngineState, source: string): CharStats {
  let correct = 0;
  let incorrect = 0;
  let extra = 0;
  let missed = 0;
  const input = state.input;

  const boundary = Math.min(input.length, source.length);
  for (let i = 0; i < boundary; i++) {
    if (input[i] === source[i]) correct++;
    else incorrect++;
  }

  if (input.length > source.length) {
    extra = input.length - source.length;
  }

  if (state.status === 'finished' && input.length < source.length) {
    missed = source.length - input.length;
  }

  return { correct, incorrect, extra, missed };
}

export function computeMetrics(state: EngineState, source: string): Result {
  const chars = computeCharStats(state, source);
  const startedAt = state.startedAt ?? 0;
  const endedAt = state.endedAt ?? startedAt;
  const durationMs = Math.max(0, endedAt - startedAt);
  const minutes = durationMs / 60_000;

  const totalInputKeystrokes = state.timeline.filter((e) => e.kind === 'input').length;
  const totalKeystrokes = state.timeline.length;

  const wpm = minutes > 0 ? chars.correct / 5 / minutes : 0;
  const rawWpm = minutes > 0 ? totalInputKeystrokes / 5 / minutes : 0;
  const accuracy = totalKeystrokes > 0 ? chars.correct / totalKeystrokes : 0;

  return {
    wpm: round1(wpm),
    rawWpm: round1(rawWpm),
    accuracy,
    chars,
    durationMs,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

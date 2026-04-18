import { describe, expect, it } from 'vitest';
import { computeMetrics } from '@/lib/engine/metrics';
import type { EngineState } from '@/lib/engine/types';

function makeState(partial: Partial<EngineState>): EngineState {
  return {
    status: 'finished',
    input: '',
    cursor: 0,
    startedAt: 0,
    endedAt: 60_000,
    timeline: [],
    needMoreWords: false,
    ...partial,
  };
}

describe('computeMetrics', () => {
  it('returns all zeros when no input', () => {
    const state = makeState({ input: '', endedAt: 60_000 });
    const r = computeMetrics(state, '');
    expect(r.wpm).toBe(0);
    expect(r.rawWpm).toBe(0);
    expect(r.accuracy).toBe(0);
    expect(r.chars).toEqual({ correct: 0, incorrect: 0, extra: 0, missed: 0 });
  });

  it('computes net WPM from correct chars only', () => {
    const source = 'a'.repeat(50);
    const timeline = Array.from({ length: 50 }, (_, i) => ({
      t: i * 10,
      char: 'a',
      kind: 'input' as const,
      correct: true,
    }));
    const state = makeState({
      input: 'a'.repeat(50),
      cursor: 50,
      startedAt: 0,
      endedAt: 60_000,
      timeline,
    });
    const r = computeMetrics(state, source);
    expect(r.wpm).toBe(10);
    expect(r.rawWpm).toBe(10);
    expect(r.accuracy).toBe(1);
    expect(r.chars.correct).toBe(50);
  });

  it('separates raw WPM from net WPM when wrong chars present', () => {
    const source = 'a'.repeat(50);
    const timeline = Array.from({ length: 50 }, (_, i) => ({
      t: i * 10,
      char: 'b',
      kind: 'input' as const,
      correct: false,
    }));
    const state = makeState({
      input: 'b'.repeat(50),
      cursor: 50,
      startedAt: 0,
      endedAt: 60_000,
      timeline,
    });
    const r = computeMetrics(state, source);
    expect(r.wpm).toBe(0);
    expect(r.rawWpm).toBe(10);
    expect(r.accuracy).toBe(0);
    expect(r.chars.incorrect).toBe(50);
  });

  it('counts backspaces in the accuracy denominator', () => {
    const timeline = [
      { t: 0, char: 'h', kind: 'input' as const, correct: true },
      { t: 10, char: 'e', kind: 'input' as const, correct: true },
      { t: 20, char: 'l', kind: 'input' as const, correct: true },
      { t: 30, char: 'l', kind: 'input' as const, correct: true },
      { t: 40, char: 'o', kind: 'input' as const, correct: true },
      { t: 50, char: '', kind: 'backspace' as const, correct: false },
    ];
    const state = makeState({
      input: 'hell',
      cursor: 4,
      startedAt: 0,
      endedAt: 60_000,
      timeline,
    });
    const r = computeMetrics(state, 'hello world');
    expect(r.accuracy).toBeCloseTo(4 / 6, 5);
  });

  it('returns 0 WPM (not NaN) when durationMs is 0', () => {
    const state = makeState({ startedAt: 0, endedAt: 0, input: 'abc' });
    const r = computeMetrics(state, 'abc');
    expect(Number.isFinite(r.wpm)).toBe(true);
    expect(r.wpm).toBe(0);
    expect(Number.isFinite(r.rawWpm)).toBe(true);
  });

  it('counts extra chars typed past the end of source', () => {
    const source = 'hi';
    const timeline = [
      { t: 0, char: 'h', kind: 'input' as const, correct: true },
      { t: 10, char: 'i', kind: 'input' as const, correct: true },
      { t: 20, char: '!', kind: 'input' as const, correct: false },
    ];
    const state = makeState({
      input: 'hi!',
      cursor: 3,
      startedAt: 0,
      endedAt: 60_000,
      timeline,
    });
    const r = computeMetrics(state, source);
    expect(r.chars.extra).toBe(1);
  });
});

import { computeMetrics } from './metrics';
import type { EngineConfig, EngineState, KeyEvent, Mode, Result } from './types';

const LOW_SOURCE_THRESHOLD = 10;

export interface TypingEngine {
  input(char: string): void;
  backspace(): void;
  tick(nowMs: number): void;
  extendSource(moreChars: string): void;
  reset(): void;
  getState(): EngineState;
  getResult(): Result;
  subscribe(listener: (s: EngineState) => void): () => void;
}

function freshState(): EngineState {
  return {
    status: 'idle',
    input: '',
    cursor: 0,
    startedAt: null,
    endedAt: null,
    timeline: [],
    needMoreWords: false,
  };
}

export function createEngine(config: EngineConfig): TypingEngine {
  const mode: Mode = config.mode;
  const originalSource = config.source;
  const duration = config.duration ?? 0;
  const wordCount = config.wordCount ?? 0;

  let source = originalSource;
  let state: EngineState = freshState();
  const listeners = new Set<(s: EngineState) => void>();

  function setState(next: EngineState) {
    state = next;
    for (const l of listeners) l(state);
  }

  function now(): number {
    return Date.now();
  }

  function computeNeedMoreWords(cursor: number): boolean {
    if (mode !== 'time') return false;
    return source.length - cursor <= LOW_SOURCE_THRESHOLD;
  }

  function countCompletedWords(input: string): number {
    let count = 0;
    const upTo = Math.min(input.length, source.length);
    for (let i = 0; i < upTo; i++) {
      if (input[i] === ' ' && source[i] === ' ') count++;
    }
    if (input.length === source.length && input === source) count++;
    return count;
  }

  function checkEndConditions(next: EngineState): EngineState {
    if (next.status !== 'running') return next;
    if (mode === 'fixed') {
      if (next.input.length === source.length && next.input === source) {
        return { ...next, status: 'finished', endedAt: now() };
      }
      return next;
    }
    if (mode === 'words') {
      if (countCompletedWords(next.input) >= wordCount) {
        return { ...next, status: 'finished', endedAt: now() };
      }
      return next;
    }
    return next;
  }

  function input(char: string) {
    if (state.status === 'finished') return;
    if (char.length !== 1) return;
    const starting = state.status === 'idle';
    const base: EngineState = starting
      ? { ...state, status: 'running', startedAt: now() }
      : state;
    const expected = source[base.cursor];
    const correct = char === expected;
    const evt: KeyEvent = {
      t: base.startedAt ? now() - base.startedAt : 0,
      char,
      kind: 'input',
      correct,
    };
    const nextCursor = base.cursor + 1;
    let next: EngineState = {
      ...base,
      input: base.input + char,
      cursor: nextCursor,
      timeline: [...base.timeline, evt],
      needMoreWords: computeNeedMoreWords(nextCursor),
    };
    next = checkEndConditions(next);
    setState(next);
  }

  function backspace() {
    if (state.status === 'finished') return;
    if (state.cursor === 0) return;
    const evt: KeyEvent = {
      t: state.startedAt ? now() - state.startedAt : 0,
      char: '',
      kind: 'backspace',
      correct: false,
    };
    const nextCursor = state.cursor - 1;
    const next: EngineState = {
      ...state,
      input: state.input.slice(0, -1),
      cursor: nextCursor,
      timeline: [...state.timeline, evt],
      needMoreWords: computeNeedMoreWords(nextCursor),
    };
    setState(next);
  }

  function tick(nowMs: number) {
    if (state.status !== 'running') return;
    if (mode !== 'time') return;
    const started = state.startedAt ?? nowMs;
    if (nowMs - started >= duration * 1000) {
      setState({ ...state, status: 'finished', endedAt: now() });
    }
  }

  function extendSource(moreChars: string) {
    source = source + moreChars;
    setState({ ...state, needMoreWords: computeNeedMoreWords(state.cursor) });
  }

  function reset() {
    source = originalSource;
    setState(freshState());
  }

  function getState(): EngineState {
    return state;
  }

  function getResult(): Result {
    if (state.status !== 'finished') {
      throw new Error('getResult called before engine finished');
    }
    return computeMetrics(state, source);
  }

  function subscribe(listener: (s: EngineState) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  return { input, backspace, tick, extendSource, reset, getState, getResult, subscribe };
}

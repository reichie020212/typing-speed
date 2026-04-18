import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEngine } from '@/lib/engine/engine';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 0));
});

describe('createEngine — lifecycle', () => {
  it('starts in idle state', () => {
    const e = createEngine({ mode: 'fixed', source: 'hello' });
    expect(e.getState().status).toBe('idle');
    expect(e.getState().input).toBe('');
    expect(e.getState().startedAt).toBeNull();
  });

  it('transitions idle -> running on first input', () => {
    const e = createEngine({ mode: 'fixed', source: 'hello' });
    e.input('h');
    expect(e.getState().status).toBe('running');
    expect(e.getState().startedAt).not.toBeNull();
  });

  it('reset returns to idle and clears state', () => {
    const e = createEngine({ mode: 'fixed', source: 'hello' });
    e.input('h');
    e.reset();
    expect(e.getState().status).toBe('idle');
    expect(e.getState().input).toBe('');
    expect(e.getState().timeline).toEqual([]);
  });
});

describe('createEngine — fixed mode', () => {
  it('finishes when full source is typed correctly', () => {
    const e = createEngine({ mode: 'fixed', source: 'hi' });
    e.input('h');
    e.input('i');
    expect(e.getState().status).toBe('finished');
  });

  it('does not finish when chars are wrong but length matches', () => {
    const e = createEngine({ mode: 'fixed', source: 'hi' });
    e.input('h');
    e.input('x');
    expect(e.getState().status).toBe('running');
  });

  it('allows backspace to correct a mistake and then finish', () => {
    const e = createEngine({ mode: 'fixed', source: 'hi' });
    e.input('h');
    e.input('x');
    e.backspace();
    e.input('i');
    expect(e.getState().status).toBe('finished');
  });

  it('backspace at cursor 0 is a no-op', () => {
    const e = createEngine({ mode: 'fixed', source: 'hi' });
    e.backspace();
    expect(e.getState().input).toBe('');
    expect(e.getState().timeline.length).toBe(0);
    expect(e.getState().status).toBe('idle');
  });

  it('accepts extra chars past source end; test does not finish until exact match', () => {
    const e2 = createEngine({ mode: 'fixed', source: 'hi' });
    e2.input('h');
    e2.input('x');
    e2.input('!');
    expect(e2.getState().input.length).toBe(3);
    expect(e2.getState().status).toBe('running');
  });
});

describe('createEngine — time mode', () => {
  it('finishes when tick passes duration', () => {
    const e = createEngine({ mode: 'time', source: 'the quick brown fox', duration: 10 });
    e.input('t');
    const startedAt = e.getState().startedAt;
    if (startedAt === null) throw new Error('startedAt is null');
    e.tick(startedAt + 9_999);
    expect(e.getState().status).toBe('running');
    e.tick(startedAt + 10_000);
    expect(e.getState().status).toBe('finished');
  });

  it('flags needMoreWords when source is running low', () => {
    const e = createEngine({ mode: 'time', source: 'abcdefghijklmnopqrst', duration: 60 });
    for (const ch of 'abcdefghijklmno') e.input(ch);
    expect(e.getState().needMoreWords).toBe(true);
  });

  it('extendSource appends to source without disturbing cursor', () => {
    const e = createEngine({ mode: 'time', source: 'abc', duration: 60 });
    e.input('a');
    e.extendSource('def');
    expect(e.getState().input).toBe('a');
    e.input('b');
    e.input('c');
    e.input('d');
    expect(e.getState().status).toBe('running');
  });
});

describe('createEngine — words mode', () => {
  it('finishes at exactly N completed words', () => {
    const e = createEngine({ mode: 'words', source: 'one two three', wordCount: 3 });
    for (const ch of 'one ') e.input(ch);
    for (const ch of 'two ') e.input(ch);
    for (const ch of 'three') e.input(ch);
    expect(e.getState().status).toBe('finished');
  });

  it('does not finish prematurely on a wrong space', () => {
    const e = createEngine({ mode: 'words', source: 'ab cd', wordCount: 2 });
    e.input('a');
    e.input(' ');
    expect(e.getState().status).toBe('running');
  });
});

describe('createEngine — subscribe', () => {
  it('notifies subscribers on state change', () => {
    const e = createEngine({ mode: 'fixed', source: 'hi' });
    const listener = vi.fn();
    const unsub = e.subscribe(listener);
    e.input('h');
    expect(listener).toHaveBeenCalled();
    unsub();
    e.input('i');
    const callsAfterUnsub = listener.mock.calls.length;
    e.input(' ');
    expect(listener.mock.calls.length).toBe(callsAfterUnsub);
  });
});

describe('createEngine — getResult', () => {
  it('throws if called before finished', () => {
    const e = createEngine({ mode: 'fixed', source: 'hi' });
    expect(() => e.getResult()).toThrow();
  });

  it('returns a populated result when finished', () => {
    const e = createEngine({ mode: 'fixed', source: 'hi' });
    e.input('h');
    vi.advanceTimersByTime(60_000);
    e.input('i');
    const r = e.getResult();
    expect(r.chars.correct).toBe(2);
    expect(Number.isFinite(r.wpm)).toBe(true);
  });
});

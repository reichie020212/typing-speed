import { describe, expect, it } from 'vitest';
import { pickPassage, pickWords } from '@/lib/content/select';

describe('pickPassage', () => {
  it('respects the length filter', () => {
    const p = pickPassage({ length: 'short', seed: 'RACE-A1' });
    expect(p.length).toBe('short');
  });

  it('is deterministic for the same seed', () => {
    const a = pickPassage({ length: 'medium', seed: 'RACE-XYZ' });
    const b = pickPassage({ length: 'medium', seed: 'RACE-XYZ' });
    expect(a.id).toBe(b.id);
  });

  it('returns different passages for different seeds (usually)', () => {
    const seeds = ['s1', 's2', 's3', 's4', 's5', 's6'];
    const ids = seeds.map((s) => pickPassage({ length: 'long', seed: s }).id);
    expect(new Set(ids).size).toBeGreaterThan(1);
  });
});

describe('pickWords', () => {
  it('returns the requested count', () => {
    expect(pickWords({ tier: 'easy', count: 10 }).length).toBe(10);
    expect(pickWords({ tier: 'medium', count: 25 }).length).toBe(25);
  });

  it('is deterministic for the same seed', () => {
    const a = pickWords({ tier: 'medium', count: 15, seed: 'k' });
    const b = pickWords({ tier: 'medium', count: 15, seed: 'k' });
    expect(a).toEqual(b);
  });

  it('hard tier occasionally emits punctuation suffixes', () => {
    const words = pickWords({ tier: 'hard', count: 500, seed: 'punct-seed' });
    const hasPunct = words.some((w) => /[,.;']$/.test(w));
    expect(hasPunct).toBe(true);
  });

  it('easy/medium never emit punctuation', () => {
    const easy = pickWords({ tier: 'easy', count: 200, seed: 'x' });
    for (const w of easy) expect(w).toMatch(/^[a-z]+$/);
    const medium = pickWords({ tier: 'medium', count: 500, seed: 'y' });
    for (const w of medium) expect(w).toMatch(/^[a-z]+$/);
  });
});

import { describe, expect, it } from 'vitest';
import { WORDS_EASY, WORDS_HARD, WORDS_MEDIUM } from '@/lib/content/words';

describe('word lists', () => {
  it('have the expected sizes', () => {
    expect(WORDS_EASY.length).toBe(200);
    expect(WORDS_MEDIUM.length).toBe(1000);
    expect(WORDS_HARD.length).toBe(3000);
  });

  it('are all lowercase ASCII alphabetic', () => {
    const all = [...WORDS_EASY, ...WORDS_MEDIUM, ...WORDS_HARD];
    for (const w of all) {
      expect(w).toMatch(/^[a-z]+$/);
    }
  });

  it('have MEDIUM as a superset of EASY', () => {
    const m = new Set(WORDS_MEDIUM);
    for (const w of WORDS_EASY) expect(m.has(w)).toBe(true);
  });

  it('have HARD as a superset of MEDIUM', () => {
    const h = new Set(WORDS_HARD);
    for (const w of WORDS_MEDIUM) expect(h.has(w)).toBe(true);
  });

  it('have no duplicates within each tier', () => {
    expect(new Set(WORDS_EASY).size).toBe(WORDS_EASY.length);
    expect(new Set(WORDS_MEDIUM).size).toBe(WORDS_MEDIUM.length);
    expect(new Set(WORDS_HARD).size).toBe(WORDS_HARD.length);
  });
});

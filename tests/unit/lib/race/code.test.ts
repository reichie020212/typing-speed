import { describe, expect, it } from 'vitest';
import { generateRaceCode, RACE_CODE_ALPHABET } from '@/lib/race/code';

describe('generateRaceCode', () => {
  it('returns a 6-char uppercase code', () => {
    const code = generateRaceCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
    expect(code.length).toBe(6);
  });

  it('uses only the ambiguity-free alphabet', () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateRaceCode();
      for (const ch of code) {
        expect(RACE_CODE_ALPHABET).toContain(ch);
      }
    }
  });

  it('never includes ambiguous chars (0, O, 1, I)', () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateRaceCode();
      expect(code).not.toMatch(/[0O1I]/);
    }
  });

  it('produces varied output (sanity check)', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generateRaceCode());
    expect(seen.size).toBeGreaterThan(90); // collisions vanishingly rare at 100 tries
  });
});

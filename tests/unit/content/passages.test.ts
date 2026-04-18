import { describe, expect, it } from 'vitest';
import { PASSAGES } from '@/lib/content/passages';

function wordCount(s: string): number {
  return s.trim().split(/\s+/).length;
}

describe('passages', () => {
  it('has exactly 60 entries', () => {
    expect(PASSAGES.length).toBe(60);
  });

  it('has the expected length distribution', () => {
    const byLen = { short: 0, medium: 0, long: 0 };
    for (const p of PASSAGES) byLen[p.length]++;
    expect(byLen.short).toBe(20);
    expect(byLen.medium).toBe(30);
    expect(byLen.long).toBe(10);
  });

  it('has unique ids', () => {
    const ids = PASSAGES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('passages are plain ASCII', () => {
    for (const p of PASSAGES) {
      expect(p.text, `passage ${p.id} must be ASCII`).toMatch(/^[\x20-\x7E]+$/);
    }
  });

  it('word counts are within the expected range for each tier', () => {
    for (const p of PASSAGES) {
      const w = wordCount(p.text);
      if (p.length === 'short') {
        expect(w, `passage ${p.id}: ${w} words`).toBeGreaterThanOrEqual(18);
        expect(w, `passage ${p.id}: ${w} words`).toBeLessThanOrEqual(34);
      } else if (p.length === 'medium') {
        expect(w, `passage ${p.id}: ${w} words`).toBeGreaterThanOrEqual(40);
        expect(w, `passage ${p.id}: ${w} words`).toBeLessThanOrEqual(68);
      } else {
        expect(w, `passage ${p.id}: ${w} words`).toBeGreaterThanOrEqual(85);
        expect(w, `passage ${p.id}: ${w} words`).toBeLessThanOrEqual(115);
      }
    }
  });
});

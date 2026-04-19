import { describe, expect, it } from 'vitest';
import { SaveResultSchema } from '@/app/actions/results-schema';

const base = {
  wpm: 70,
  rawWpm: 73,
  accuracy: 0.95,
  mode: 'fixed' as const,
  durationMs: 30_000,
  difficulty: 'medium' as const,
  fixedLength: 'medium' as const,
};

describe('SaveResultSchema', () => {
  it('accepts a well-formed fixed result', () => {
    expect(SaveResultSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a well-formed time result', () => {
    const time = { ...base, mode: 'time' as const, fixedLength: undefined, timeDuration: 30 };
    expect(SaveResultSchema.safeParse(time).success).toBe(true);
  });

  it('accepts a well-formed words result', () => {
    const words = { ...base, mode: 'words' as const, fixedLength: undefined, wordCount: 25 };
    expect(SaveResultSchema.safeParse(words).success).toBe(true);
  });

  it('rejects wpm above the cap', () => {
    expect(SaveResultSchema.safeParse({ ...base, wpm: 401 }).success).toBe(false);
  });

  it('rejects accuracy above 1', () => {
    expect(SaveResultSchema.safeParse({ ...base, accuracy: 1.01 }).success).toBe(false);
  });

  it('rejects negative duration', () => {
    expect(SaveResultSchema.safeParse({ ...base, durationMs: -1 }).success).toBe(false);
  });

  it('rejects fixed mode without fixedLength', () => {
    expect(SaveResultSchema.safeParse({ ...base, fixedLength: undefined }).success).toBe(false);
  });

  it('rejects time mode without timeDuration', () => {
    expect(
      SaveResultSchema.safeParse({ ...base, mode: 'time', fixedLength: undefined }).success,
    ).toBe(false);
  });

  it('rejects words mode without wordCount', () => {
    expect(
      SaveResultSchema.safeParse({ ...base, mode: 'words', fixedLength: undefined }).success,
    ).toBe(false);
  });

  it('rejects unknown mode', () => {
    expect(SaveResultSchema.safeParse({ ...base, mode: 'bogus' }).success).toBe(false);
  });
});

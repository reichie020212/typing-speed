import { describe, expect, it } from 'vitest';
import { FinishEventSchema, JoinEventSchema, ProgressEventSchema } from '@/lib/race/validation';

describe('incoming event schemas', () => {
  it('accepts a valid join event', () => {
    const parsed = JoinEventSchema.safeParse({ code: 'A7X2K9' });
    expect(parsed.success).toBe(true);
  });

  it('rejects a join event with a non-6-char code', () => {
    expect(JoinEventSchema.safeParse({ code: 'ABC' }).success).toBe(false);
    expect(JoinEventSchema.safeParse({ code: 'ABC0123' }).success).toBe(false);
  });

  it('accepts a progress event in valid range', () => {
    const parsed = ProgressEventSchema.safeParse({
      charIndex: 42,
      wpm: 75.3,
      accuracy: 0.96,
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects progress with out-of-range values', () => {
    expect(ProgressEventSchema.safeParse({ charIndex: -1, wpm: 0, accuracy: 1 }).success).toBe(
      false,
    );
    expect(ProgressEventSchema.safeParse({ charIndex: 0, wpm: 10000, accuracy: 1 }).success).toBe(
      false,
    );
    expect(ProgressEventSchema.safeParse({ charIndex: 0, wpm: 50, accuracy: 2 }).success).toBe(
      false,
    );
  });

  it('accepts a finish event', () => {
    const parsed = FinishEventSchema.safeParse({
      wpm: 80,
      rawWpm: 85,
      accuracy: 0.97,
      durationMs: 45_000,
    });
    expect(parsed.success).toBe(true);
  });
});

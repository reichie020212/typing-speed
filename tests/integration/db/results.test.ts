import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import {
  getUserStats,
  listResultsForUser,
  type SaveResultInput,
  saveResult,
} from '@/lib/db/results';
import { hasDatabase, withDatabase } from './helpers';

describe.skipIf(!hasDatabase)('results db', () => {
  withDatabase();

  async function seedUser() {
    return prisma.user.create({
      data: { username: `u-${Math.random().toString(36).slice(2, 8)}` },
    });
  }

  const fixedInput = (wpm: number): SaveResultInput => ({
    wpm,
    rawWpm: wpm + 2,
    accuracy: 0.95,
    mode: 'fixed',
    durationMs: 30_000,
    difficulty: 'medium',
    fixedLength: 'medium',
  });

  it('round-trips a fixed-mode result', async () => {
    const u = await seedUser();
    await saveResult(u.id, fixedInput(70));
    const r = await prisma.result.findFirst({ where: { userId: u.id } });
    expect(r?.wpm).toBe(70);
    expect(r?.mode).toBe('fixed');
    expect(r?.fixedLength).toBe('medium');
  });

  it('listResultsForUser returns newest first with cursor pagination', async () => {
    const u = await seedUser();
    for (let i = 0; i < 30; i++) await saveResult(u.id, fixedInput(50 + i));
    const page1 = await listResultsForUser(u.id, { limit: 10 });
    expect(page1.items.length).toBe(10);
    expect(page1.items[0]?.wpm).toBe(79); // last inserted
    expect(page1.nextCursor).not.toBeNull();

    const cursor = page1.nextCursor;
    if (!cursor) throw new Error('expected cursor');
    const page2 = await listResultsForUser(u.id, { limit: 10, cursor });
    expect(page2.items.length).toBe(10);
    expect(page2.items[0]?.wpm).toBe(69);
  });

  it('getUserStats computes best, avg, total, and per-mode best', async () => {
    const u = await seedUser();
    await saveResult(u.id, fixedInput(60));
    await saveResult(u.id, fixedInput(80));
    await saveResult(u.id, {
      ...fixedInput(70),
      mode: 'time',
      fixedLength: undefined,
      timeDuration: 30,
    });
    const s = await getUserStats(u.id);
    expect(s.totalTests).toBe(3);
    expect(s.bestWpm).toBe(80);
    expect(s.avgWpm).toBeCloseTo(70, 1);
    expect(s.bestByMode.fixed).toBe(80);
    expect(s.bestByMode.time).toBe(70);
    expect(s.bestByMode.words).toBeNull();
  });

  it('getUserStats returns zero state for a user with no results', async () => {
    const u = await seedUser();
    const s = await getUserStats(u.id);
    expect(s.totalTests).toBe(0);
    expect(s.bestWpm).toBeNull();
    expect(s.avgWpm).toBeNull();
    expect(s.bestByMode.fixed).toBeNull();
  });
});

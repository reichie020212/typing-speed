import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { listResultsForUser, saveResult } from '@/lib/db/results';
import { hasDatabase, withDatabase } from './helpers';

describe.skipIf(!hasDatabase)('listResultsForUser filters', () => {
  withDatabase();

  async function seedUser() {
    return prisma.user.create({
      data: { username: `u-${Math.random().toString(36).slice(2, 8)}` },
    });
  }

  async function seedMixedResults(userId: string) {
    await saveResult(userId, {
      wpm: 70,
      rawWpm: 72,
      accuracy: 0.95,
      mode: 'fixed',
      durationMs: 30_000,
      difficulty: 'medium',
      fixedLength: 'medium',
    });
    await saveResult(userId, {
      wpm: 80,
      rawWpm: 82,
      accuracy: 0.95,
      mode: 'time',
      durationMs: 30_000,
      difficulty: 'hard',
      timeDuration: 30,
    });
    await saveResult(userId, {
      wpm: 60,
      rawWpm: 62,
      accuracy: 0.95,
      mode: 'words',
      durationMs: 30_000,
      difficulty: 'easy',
      wordCount: 25,
    });
  }

  it('returns all results when no filter', async () => {
    const u = await seedUser();
    await seedMixedResults(u.id);
    const { items } = await listResultsForUser(u.id, { limit: 25 });
    expect(items.length).toBe(3);
  });

  it('filters by mode', async () => {
    const u = await seedUser();
    await seedMixedResults(u.id);
    const { items } = await listResultsForUser(u.id, { limit: 25, mode: 'time' });
    expect(items.length).toBe(1);
    expect(items[0]?.mode).toBe('time');
  });

  it('filters by difficulty', async () => {
    const u = await seedUser();
    await seedMixedResults(u.id);
    const { items } = await listResultsForUser(u.id, { limit: 25, difficulty: 'hard' });
    expect(items.length).toBe(1);
    expect(items[0]?.difficulty).toBe('hard');
  });

  it('applies mode AND difficulty together', async () => {
    const u = await seedUser();
    await seedMixedResults(u.id);
    const { items } = await listResultsForUser(u.id, {
      limit: 25,
      mode: 'fixed',
      difficulty: 'medium',
    });
    expect(items.length).toBe(1);
    expect(items[0]?.mode).toBe('fixed');
    expect(items[0]?.difficulty).toBe('medium');
  });

  it('returns empty when filter matches nothing', async () => {
    const u = await seedUser();
    await seedMixedResults(u.id);
    const { items } = await listResultsForUser(u.id, {
      limit: 25,
      mode: 'fixed',
      difficulty: 'easy',
    });
    expect(items.length).toBe(0);
  });
});

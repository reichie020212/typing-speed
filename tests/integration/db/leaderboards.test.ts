import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { getLeaderboard, getWpmProgression } from '@/lib/db/leaderboards';
import { saveResult, type SaveResultInput } from '@/lib/db/results';
import { hasDatabase, withDatabase } from './helpers';

describe.skipIf(!hasDatabase)('leaderboards', () => {
  withDatabase();

  async function seedUser(username: string) {
    return prisma.user.create({ data: { username } });
  }

  const fixed = (wpm: number, accuracy = 0.95): SaveResultInput => ({
    wpm,
    rawWpm: wpm + 2,
    accuracy,
    mode: 'fixed',
    durationMs: 30_000,
    difficulty: 'medium',
    fixedLength: 'medium',
  });

  const time = (wpm: number, accuracy = 0.95): SaveResultInput => ({
    wpm,
    rawWpm: wpm + 2,
    accuracy,
    mode: 'time',
    durationMs: 30_000,
    difficulty: 'hard',
    timeDuration: 30,
  });

  describe('getLeaderboard — all-time', () => {
    it('returns one row per user (their best), sorted by WPM desc', async () => {
      const alice = await seedUser('alice');
      const bob = await seedUser('bob');
      await saveResult(alice.id, fixed(60));
      await saveResult(alice.id, fixed(90));
      await saveResult(bob.id, fixed(80));

      const rows = await getLeaderboard({ window: 'alltime', mode: 'all' });
      expect(rows.length).toBe(2);
      expect(rows[0]?.username).toBe('alice');
      expect(rows[0]?.wpm).toBe(90);
      expect(rows[0]?.rank).toBe(1);
      expect(rows[1]?.username).toBe('bob');
      expect(rows[1]?.rank).toBe(2);
    });

    it('tie-break: higher accuracy first', async () => {
      const alice = await seedUser('alice');
      const bob = await seedUser('bob');
      await saveResult(alice.id, fixed(80, 0.9));
      await saveResult(bob.id, fixed(80, 0.95));

      const rows = await getLeaderboard({ window: 'alltime', mode: 'all' });
      expect(rows[0]?.username).toBe('bob');
      expect(rows[1]?.username).toBe('alice');
    });

    it('respects limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        const u = await seedUser(`u-${i}`);
        await saveResult(u.id, fixed(50 + i));
      }

      const p1 = await getLeaderboard({ window: 'alltime', mode: 'all', limit: 2, offset: 0 });
      const p2 = await getLeaderboard({ window: 'alltime', mode: 'all', limit: 2, offset: 2 });
      expect(p1.map((r) => r.wpm)).toEqual([54, 53]);
      expect(p2.map((r) => r.wpm)).toEqual([52, 51]);
      expect(p1[0]?.rank).toBe(1);
      expect(p2[0]?.rank).toBe(3);
    });

    it('mode filter narrows to that mode', async () => {
      const alice = await seedUser('alice');
      await saveResult(alice.id, fixed(70));
      await saveResult(alice.id, time(95));
      const fixedBoard = await getLeaderboard({ window: 'alltime', mode: 'fixed' });
      expect(fixedBoard[0]?.wpm).toBe(70);
      const timeBoard = await getLeaderboard({ window: 'alltime', mode: 'time' });
      expect(timeBoard[0]?.wpm).toBe(95);
    });
  });

  describe('getLeaderboard — windowed with threshold', () => {
    it('excludes users with < 3 tests in the window', async () => {
      const alice = await seedUser('alice');
      const bob = await seedUser('bob');
      await saveResult(alice.id, fixed(80));
      await saveResult(alice.id, fixed(82));
      await saveResult(alice.id, fixed(85));
      await saveResult(bob.id, fixed(90));
      await saveResult(bob.id, fixed(92));

      const rows = await getLeaderboard({ window: 'today', mode: 'all' });
      expect(rows.map((r) => r.username)).toEqual(['alice']);
    });

    it('no threshold on all-time', async () => {
      const alice = await seedUser('alice');
      await saveResult(alice.id, fixed(100));
      const rows = await getLeaderboard({ window: 'alltime', mode: 'all' });
      expect(rows.length).toBe(1);
    });
  });

  describe('getWpmProgression', () => {
    it('returns newest-first, limit honored', async () => {
      const alice = await seedUser('alice');
      for (let i = 0; i < 8; i++) await saveResult(alice.id, fixed(60 + i));
      const points = await getWpmProgression(alice.id, { limit: 5 });
      expect(points.length).toBe(5);
      expect(points[0]?.wpm).toBe(67);
      expect(points[4]?.wpm).toBe(63);
    });

    it('mode filter applies', async () => {
      const alice = await seedUser('alice');
      await saveResult(alice.id, fixed(70));
      await saveResult(alice.id, time(90));
      const only = await getWpmProgression(alice.id, { mode: 'fixed' });
      expect(only.length).toBe(1);
      expect(only[0]?.mode).toBe('fixed');
    });
  });
});

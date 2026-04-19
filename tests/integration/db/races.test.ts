import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import {
  createRace,
  getRaceByCode,
  saveRaceParticipant,
  saveRaceResultForUser,
} from '@/lib/db/races';
import { hasDatabase, withDatabase } from './helpers';

describe.skipIf(!hasDatabase)('db/races', () => {
  withDatabase();

  it('creates a race with a unique 6-char code', async () => {
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: null,
    });
    expect(race.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(race.status).toBe('waiting');
    expect(race.passageId).toBe('short-aurelius-01');
  });

  it('retries on code collision and still succeeds', async () => {
    // Seed an existing race to attempt collision
    await createRace({ passageId: 'short-aurelius-01', difficulty: 'easy', createdById: null });
    const second = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'medium',
      createdById: null,
    });
    expect(second.id).toBeDefined();
  });

  it('saveRaceParticipant inserts only a RaceParticipant row (guest path)', async () => {
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: null,
    });
    await saveRaceParticipant({
      raceId: race.id,
      userId: null,
      nickname: 'guest-alice',
      status: 'finished',
      finishPosition: 1,
      wpm: 80,
      rawWpm: 85,
      accuracy: 0.95,
      durationMs: 30_000,
    });
    const participants = await prisma.raceParticipant.findMany({ where: { raceId: race.id } });
    expect(participants.length).toBe(1);
    const results = await prisma.result.findMany({ where: { raceId: race.id } });
    expect(results.length).toBe(0);
  });

  it('saveRaceResultForUser inserts both RaceParticipant AND Result (auth path)', async () => {
    const user = await prisma.user.create({ data: { username: 'alice' } });
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: user.id,
    });
    await saveRaceResultForUser({
      raceId: race.id,
      userId: user.id,
      nickname: 'alice',
      status: 'finished',
      finishPosition: 1,
      wpm: 80,
      rawWpm: 85,
      accuracy: 0.95,
      durationMs: 30_000,
      difficulty: 'easy',
    });
    const participants = await prisma.raceParticipant.findMany({ where: { raceId: race.id } });
    expect(participants.length).toBe(1);
    const results = await prisma.result.findMany({ where: { raceId: race.id } });
    expect(results.length).toBe(1);
    expect(results[0]?.raceId).toBe(race.id);
    expect(results[0]?.mode).toBe('fixed');
  });

  it('getRaceByCode returns race + ordered participants', async () => {
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: null,
    });
    await saveRaceParticipant({
      raceId: race.id,
      userId: null,
      nickname: 'bob',
      status: 'finished',
      finishPosition: 2,
      wpm: 50,
      rawWpm: 55,
      accuracy: 0.9,
      durationMs: 40_000,
    });
    await saveRaceParticipant({
      raceId: race.id,
      userId: null,
      nickname: 'alice',
      status: 'finished',
      finishPosition: 1,
      wpm: 80,
      rawWpm: 85,
      accuracy: 0.95,
      durationMs: 30_000,
    });
    await saveRaceParticipant({
      raceId: race.id,
      userId: null,
      nickname: 'carol',
      status: 'dnf',
      finishPosition: null,
      wpm: 10,
      rawWpm: 12,
      accuracy: 0.5,
      durationMs: 60_000,
    });
    const loaded = await getRaceByCode(race.code);
    expect(loaded).not.toBeNull();
    expect(loaded?.participants.length).toBe(3);
    expect(loaded?.participants[0]?.nickname).toBe('alice'); // pos 1
    expect(loaded?.participants[1]?.nickname).toBe('bob'); // pos 2
    expect(loaded?.participants[2]?.nickname).toBe('carol'); // DNF
  });
});

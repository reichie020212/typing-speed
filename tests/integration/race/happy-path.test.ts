// tests/integration/race/happy-path.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { createRace } from '@/lib/db/races';
import { hasDatabase, withDatabase } from '../db/helpers';
import {
  connectAsGuest,
  connectAsUser,
  startTestServer,
  type TestServer,
  waitFor,
} from './test-server';

describe.skipIf(!hasDatabase)('race server — happy path', () => {
  withDatabase();

  let server: TestServer;
  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it('two players run a full race → results in DB', async () => {
    const alice = await prisma.user.create({ data: { username: 'alice' } });
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: alice.id,
    });

    const aliceSocket = await connectAsUser(server.url, server.secret, alice.id, 'alice');
    const bobSocket = await connectAsGuest(server.url, 'bob');

    const aliceJoined = waitFor<{ race: { code: string } }>(aliceSocket, 'joined');
    aliceSocket.emit('join', { code: race.code });
    await aliceJoined;

    const bobJoined = waitFor<{ race: { code: string } }>(bobSocket, 'joined');
    bobSocket.emit('join', { code: race.code });
    await bobJoined;

    // Host (alice) starts the race
    const started = waitFor<{ phase: string }>(aliceSocket, 'phase', (p) => p.phase === 'racing');
    aliceSocket.emit('startRace', {});
    await started;

    // Simulate both finishing
    aliceSocket.emit('finish', {
      wpm: 80,
      rawWpm: 85,
      accuracy: 0.97,
      durationMs: 20_000,
    });
    bobSocket.emit('finish', {
      wpm: 60,
      rawWpm: 65,
      accuracy: 0.92,
      durationMs: 28_000,
    });

    const ended = await waitFor<{ results: { nickname: string }[] }>(aliceSocket, 'ended');
    expect(ended.results.length).toBe(2);
    expect(ended.results[0]?.nickname).toBe('alice');

    aliceSocket.close();
    bobSocket.close();

    // Give persistence a tick
    await new Promise((r) => setTimeout(r, 100));

    const participants = await prisma.raceParticipant.findMany({ where: { raceId: race.id } });
    expect(participants.length).toBe(2);

    const aliceResults = await prisma.result.findMany({ where: { userId: alice.id } });
    expect(aliceResults.length).toBe(1);
    expect(aliceResults[0]?.raceId).toBe(race.id);
  });
});

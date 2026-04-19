// tests/integration/race/disconnect-dnf.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { createRace } from '@/lib/db/races';
import { hasDatabase, withDatabase } from '../db/helpers';
import { connectAsGuest, startTestServer, type TestServer, waitFor } from './test-server';

describe.skipIf(!hasDatabase)('race server — disconnect → DNF', () => {
  withDatabase();
  let server: TestServer;
  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it('marks a mid-race disconnect as DNF', async () => {
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: null,
    });
    const alice = await connectAsGuest(server.url, 'alice');
    const bob = await connectAsGuest(server.url, 'bob');

    alice.emit('join', { code: race.code });
    await waitFor(alice, 'joined');
    bob.emit('join', { code: race.code });
    await waitFor(bob, 'joined');

    const racing = waitFor<{ phase: string }>(alice, 'phase', (p) => p.phase === 'racing');
    alice.emit('startRace', {});
    await racing;

    // Bob disconnects mid-race
    bob.close();

    // Alice finishes, triggering race end
    alice.emit('finish', { wpm: 70, rawWpm: 75, accuracy: 0.95, durationMs: 25_000 });
    const ended = await waitFor<{ results: { nickname: string; status: string }[] }>(
      alice,
      'ended',
    );
    const bobResult = ended.results.find((r) => r.nickname === 'bob');
    expect(bobResult?.status).toBe('dnf');

    alice.close();

    await new Promise((r) => setTimeout(r, 100));
    const participants = await prisma.raceParticipant.findMany({ where: { raceId: race.id } });
    expect(participants.find((p) => p.nickname === 'bob')?.status).toBe('dnf');
  });
});

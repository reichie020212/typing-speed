// tests/integration/race/host-reassign.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRace } from '@/lib/db/races';
import { hasDatabase, withDatabase } from '../db/helpers';
import { connectAsGuest, startTestServer, type TestServer, waitFor } from './test-server';

describe.skipIf(!hasDatabase)('race server — host reassignment', () => {
  withDatabase();
  let server: TestServer;
  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it('promotes next-longest-connected on host leave', async () => {
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

    const rosterP = waitFor<{ players: { nickname: string; isHost: boolean }[] }>(
      bob,
      'roster',
      (p) => p.players.length === 1 && p.players[0]?.nickname === 'bob',
    );
    alice.close();
    const roster = await rosterP;
    expect(roster.players[0]?.isHost).toBe(true);

    bob.close();
  });
});

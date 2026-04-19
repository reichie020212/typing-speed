// tests/integration/race/late-join.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRace } from '@/lib/db/races';
import { hasDatabase, withDatabase } from '../db/helpers';
import { connectAsGuest, startTestServer, type TestServer, waitFor } from './test-server';

describe.skipIf(!hasDatabase)('race server — late join rejected', () => {
  withDatabase();
  let server: TestServer;
  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it('rejects joiners once countdown starts', async () => {
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

    const countdown = waitFor<{ phase: string }>(alice, 'phase', (p) => p.phase === 'countdown');
    alice.emit('startRace', {});
    await countdown;

    const late = await connectAsGuest(server.url, 'late');
    const errored = waitFor<{ code: string }>(late, 'error');
    late.emit('join', { code: race.code });
    const err = await errored;
    expect(err.code).toBe('room-locked');

    alice.close();
    bob.close();
    late.close();
  });
});

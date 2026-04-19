// tests/integration/race/two-tab-dedupe.test.ts
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

describe.skipIf(!hasDatabase)('race server — two-tab dedupe', () => {
  withDatabase();
  let server: TestServer;
  beforeEach(async () => {
    server = await startTestServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it('kicks first tab when same auth user joins from a second tab', async () => {
    const alice = await prisma.user.create({ data: { username: 'alice' } });
    const race = await createRace({
      passageId: 'short-aurelius-01',
      difficulty: 'easy',
      createdById: alice.id,
    });
    const bob = await connectAsGuest(server.url, 'bob');
    const tab1 = await connectAsUser(server.url, server.secret, alice.id, 'alice');
    const tab2 = await connectAsUser(server.url, server.secret, alice.id, 'alice');

    bob.emit('join', { code: race.code });
    await waitFor(bob, 'joined');
    tab1.emit('join', { code: race.code });
    await waitFor(tab1, 'joined');
    const kicked = waitFor<{ code: string }>(tab1, 'error');
    tab2.emit('join', { code: race.code });
    await waitFor(tab2, 'joined');
    const err = await kicked;
    expect(err.code).toBe('kicked-duplicate');

    tab1.close();
    tab2.close();
    bob.close();
  });
});

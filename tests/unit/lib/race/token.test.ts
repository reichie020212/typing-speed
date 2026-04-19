import { describe, expect, it } from 'vitest';
import { mintRaceToken, verifyRaceToken } from '@/lib/race/token';

/**
 * @vitest-environment node
 */

const SECRET = 'test-secret-that-is-at-least-32-characters-long-xx';

describe('race token', () => {
  it('mints and verifies a valid token', async () => {
    const token = await mintRaceToken(
      { userId: 'u1', username: 'alice' },
      SECRET,
      { ttlSeconds: 300 },
    );
    const decoded = await verifyRaceToken(token, SECRET);
    expect(decoded.userId).toBe('u1');
    expect(decoded.username).toBe('alice');
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await mintRaceToken({ userId: 'u1', username: 'alice' }, SECRET);
    await expect(verifyRaceToken(token, `${SECRET}-other`)).rejects.toThrow();
  });

  it('rejects a token whose payload was tampered with', async () => {
    const token = await mintRaceToken({ userId: 'u1', username: 'alice' }, SECRET);
    const parts = token.split('.');
    // Flip a bit in the payload segment
    const tampered = [parts[0], `${parts[1]}xx`, parts[2]].join('.');
    await expect(verifyRaceToken(tampered, SECRET)).rejects.toThrow();
  });

  it('rejects an expired token', async () => {
    const token = await mintRaceToken(
      { userId: 'u1', username: 'alice' },
      SECRET,
      { ttlSeconds: -1 }, // already expired
    );
    await expect(verifyRaceToken(token, SECRET)).rejects.toThrow();
  });
});

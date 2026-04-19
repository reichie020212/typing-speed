import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db/client';
import { generateUsername, getUserByUsername, renameUsername } from '@/lib/db/users';
import { hasDatabase, withDatabase } from './helpers';

describe.skipIf(!hasDatabase)('users db', () => {
  withDatabase();

  async function makeUser(username: string, email = `${username}@example.com`) {
    return prisma.user.create({ data: { username, email } });
  }

  describe('generateUsername', () => {
    it('derives base from an email on first attempt', async () => {
      const u = await generateUsername('jane.doe@example.com');
      expect(u).toBe('jane-doe');
    });

    it('appends a suffix when the base is taken', async () => {
      await makeUser('jane-doe');
      const u = await generateUsername('jane.doe@other.com');
      expect(u).not.toBe('jane-doe');
      expect(u.startsWith('jane-doe-')).toBe(true);
    });

    it('handles null seed', async () => {
      const u = await generateUsername(null);
      expect(u).toMatch(/^user/);
    });
  });

  describe('getUserByUsername', () => {
    it('returns the user when present', async () => {
      await makeUser('alice');
      const u = await getUserByUsername('alice');
      expect(u?.username).toBe('alice');
    });
    it('returns null when absent', async () => {
      expect(await getUserByUsername('nobody')).toBeNull();
    });
  });

  describe('renameUsername', () => {
    it('renames when valid and not taken', async () => {
      const u = await makeUser('alice');
      const result = await renameUsername(u.id, 'alice-new');
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.username).toBe('alice-new');
    });

    it('rejects reserved names', async () => {
      const u = await makeUser('alice');
      const r = await renameUsername(u.id, 'admin');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('invalid');
    });

    it('rejects names that are already taken', async () => {
      await makeUser('bob');
      const u = await makeUser('alice');
      const r = await renameUsername(u.id, 'bob');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('taken');
    });
  });
});

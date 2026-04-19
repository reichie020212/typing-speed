import type { User } from '@prisma/client';
import { deriveBase, isValidUsername, randomSuffix } from '@/lib/auth/username';
import { prisma } from './client';

export async function generateUsername(seed: string | null): Promise<string> {
  const base = deriveBase(seed);
  const candidates: string[] = [base];
  for (let i = 0; i < 12; i++) candidates.push(`${base}-${randomSuffix()}`);

  for (const c of candidates) {
    if (!isValidUsername(c)) continue;
    const taken = await prisma.user.findUnique({ where: { username: c } });
    if (!taken) return c;
  }

  // Near-impossible fallback: two fresh suffixes.
  return `user-${randomSuffix()}${randomSuffix()}`.slice(0, 20);
}

export async function getUserByUsername(username: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { username } });
}

export type RenameOutcome =
  | { ok: true; username: string }
  | { ok: false; reason: 'invalid' | 'taken' };

export async function renameUsername(userId: string, newUsername: string): Promise<RenameOutcome> {
  if (!isValidUsername(newUsername)) return { ok: false, reason: 'invalid' };
  const existing = await prisma.user.findUnique({ where: { username: newUsername } });
  if (existing && existing.id !== userId) return { ok: false, reason: 'taken' };
  await prisma.user.update({ where: { id: userId }, data: { username: newUsername } });
  return { ok: true, username: newUsername };
}

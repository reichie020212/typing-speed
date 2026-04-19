import { afterAll, beforeAll, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/client';

export const hasDatabase = !!process.env.DATABASE_URL;

export function withDatabase(): void {
  beforeAll(() => {
    if (!hasDatabase) {
      console.warn('[integration] DATABASE_URL not set — skipping integration suite');
    }
  });
  beforeEach(async () => {
    if (!hasDatabase) return;
    await prisma.result.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.account.deleteMany({});
    await prisma.user.deleteMany({});
  });
  afterAll(async () => {
    if (!hasDatabase) return;
    await prisma.$disconnect();
  });
}

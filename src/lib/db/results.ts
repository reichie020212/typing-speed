import type { Result } from '@prisma/client';
import { prisma } from './client';

export interface SaveResultInput {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  mode: 'fixed' | 'time' | 'words';
  durationMs: number;
  difficulty: 'easy' | 'medium' | 'hard';
  fixedLength?: 'short' | 'medium' | 'long';
  timeDuration?: number;
  wordCount?: number;
}

export interface UserStats {
  bestWpm: number | null;
  avgWpm: number | null;
  totalTests: number;
  bestByMode: Record<'fixed' | 'time' | 'words', number | null>;
}

export async function saveResult(userId: string, input: SaveResultInput): Promise<void> {
  await prisma.result.create({
    data: {
      userId,
      wpm: input.wpm,
      rawWpm: input.rawWpm,
      accuracy: input.accuracy,
      mode: input.mode,
      durationMs: input.durationMs,
      difficulty: input.difficulty,
      fixedLength: input.fixedLength,
      timeDuration: input.timeDuration,
      wordCount: input.wordCount,
    },
  });
}

export interface ListResultsOpts {
  cursor?: string;
  limit?: number;
}

export async function listResultsForUser(
  userId: string,
  { cursor, limit = 25 }: ListResultsOpts,
): Promise<{ items: Result[]; nextCursor: string | null }> {
  const items = await prisma.result.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;
  return { items: page, nextCursor };
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const [agg, byMode] = await Promise.all([
    prisma.result.aggregate({
      where: { userId },
      _max: { wpm: true },
      _avg: { wpm: true },
      _count: { _all: true },
    }),
    prisma.result.groupBy({
      by: ['mode'],
      where: { userId },
      _max: { wpm: true },
    }),
  ]);

  const bestByMode: UserStats['bestByMode'] = { fixed: null, time: null, words: null };
  for (const row of byMode) {
    bestByMode[row.mode] = row._max.wpm;
  }

  return {
    bestWpm: agg._max.wpm,
    avgWpm: agg._avg.wpm,
    totalTests: agg._count._all,
    bestByMode,
  };
}

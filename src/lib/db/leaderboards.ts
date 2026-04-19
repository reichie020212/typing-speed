import { prisma } from './client';
import { type Window, windowStart } from './time-windows';

export type ModeFilter = 'all' | 'fixed' | 'time' | 'words';

export interface LeaderboardRow {
  rank: number;
  userId: string;
  username: string;
  image: string | null;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  mode: 'fixed' | 'time' | 'words';
  createdAt: Date;
}

interface RawRow {
  user_id: string;
  username: string;
  image: string | null;
  wpm: number;
  raw_wpm: number;
  accuracy: number;
  mode: 'fixed' | 'time' | 'words';
  created_at: Date;
}

export async function getLeaderboard(opts: {
  window: Window;
  mode: ModeFilter;
  limit?: number;
  offset?: number;
}): Promise<LeaderboardRow[]> {
  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;
  const start = windowStart(opts.window);
  const minTests = opts.window === 'alltime' ? 0 : 3;
  const modeFilter: 'fixed' | 'time' | 'words' | null =
    opts.mode === 'all' ? null : opts.mode;

  const rows = await prisma.$queryRaw<RawRow[]>`
    WITH user_counts AS (
      SELECT "userId" AS user_id, COUNT(*) AS c
      FROM "Result"
      WHERE (${start}::timestamp IS NULL OR "createdAt" >= ${start})
        AND (${modeFilter}::text IS NULL OR "mode" = ${modeFilter}::"Mode")
      GROUP BY "userId"
      HAVING COUNT(*) >= ${minTests}
    ),
    best_per_user AS (
      SELECT DISTINCT ON (r."userId")
        r."userId"    AS user_id,
        u.username    AS username,
        u.image       AS image,
        r.wpm         AS wpm,
        r."rawWpm"    AS raw_wpm,
        r.accuracy    AS accuracy,
        r.mode::text  AS mode,
        r."createdAt" AS created_at
      FROM "Result" r
      JOIN "User" u ON u.id = r."userId"
      JOIN user_counts uc ON uc.user_id = r."userId"
      WHERE (${start}::timestamp IS NULL OR r."createdAt" >= ${start})
        AND (${modeFilter}::text IS NULL OR r.mode = ${modeFilter}::"Mode")
      ORDER BY r."userId", r.wpm DESC, r.accuracy DESC, r."createdAt" ASC
    )
    SELECT * FROM best_per_user
    ORDER BY wpm DESC, accuracy DESC, created_at ASC
    LIMIT ${limit} OFFSET ${offset};
  `;

  return rows.map((r, i) => ({
    rank: offset + i + 1,
    userId: r.user_id,
    username: r.username,
    image: r.image,
    wpm: r.wpm,
    rawWpm: r.raw_wpm,
    accuracy: r.accuracy,
    mode: r.mode,
    createdAt: r.created_at,
  }));
}

export async function getWpmProgression(
  userId: string,
  opts: { mode?: ModeFilter; limit?: number } = {},
): Promise<{ createdAt: Date; wpm: number; mode: 'fixed' | 'time' | 'words' }[]> {
  const limit = opts.limit ?? 50;
  const mode = opts.mode && opts.mode !== 'all' ? opts.mode : undefined;
  const items = await prisma.result.findMany({
    where: { userId, ...(mode ? { mode } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { createdAt: true, wpm: true, mode: true },
  });
  return items;
}

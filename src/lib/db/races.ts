import type { Difficulty, Race, RaceParticipant, RaceStatus } from '@prisma/client';
import { generateRaceCode } from '@/lib/race/code';
import { prisma } from './client';

const MAX_CODE_RETRIES = 5;

export interface CreateRaceInput {
  passageId: string;
  difficulty: Difficulty;
  createdById: string | null;
}

export async function createRace(input: CreateRaceInput): Promise<Race> {
  let lastError: unknown = null;
  for (let i = 0; i < MAX_CODE_RETRIES; i++) {
    const code = generateRaceCode();
    try {
      return await prisma.race.create({
        data: {
          code,
          passageId: input.passageId,
          difficulty: input.difficulty,
          createdById: input.createdById,
          status: 'waiting',
        },
      });
    } catch (err: unknown) {
      lastError = err;
      // Prisma P2002 = unique constraint violation. Regenerate code and retry.
      const e = err as { code?: string };
      if (e.code !== 'P2002') throw err;
    }
  }
  throw new Error('Failed to generate unique race code', { cause: lastError });
}

export interface SaveParticipantInput {
  raceId: string;
  userId: string | null;
  nickname: string;
  status: 'finished' | 'dnf';
  finishPosition: number | null;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  durationMs: number;
}

export async function saveRaceParticipant(input: SaveParticipantInput): Promise<RaceParticipant> {
  return prisma.raceParticipant.create({
    data: {
      raceId: input.raceId,
      userId: input.userId,
      nickname: input.nickname,
      status: input.status,
      finishPosition: input.finishPosition,
      wpm: input.wpm,
      rawWpm: input.rawWpm,
      accuracy: input.accuracy,
      durationMs: input.durationMs,
    },
  });
}

export interface SaveResultForUserInput extends SaveParticipantInput {
  userId: string; // required for this path
  difficulty: Difficulty;
}

export async function saveRaceResultForUser(
  input: SaveResultForUserInput,
): Promise<RaceParticipant> {
  return prisma.$transaction(async (tx) => {
    const participant = await tx.raceParticipant.create({
      data: {
        raceId: input.raceId,
        userId: input.userId,
        nickname: input.nickname,
        status: input.status,
        finishPosition: input.finishPosition,
        wpm: input.wpm,
        rawWpm: input.rawWpm,
        accuracy: input.accuracy,
        durationMs: input.durationMs,
      },
    });
    await tx.result.create({
      data: {
        userId: input.userId,
        mode: 'fixed',
        difficulty: input.difficulty,
        wpm: input.wpm,
        rawWpm: input.rawWpm,
        accuracy: input.accuracy,
        durationMs: input.durationMs,
        raceId: input.raceId,
      },
    });
    return participant;
  });
}

export async function getRaceByCode(code: string): Promise<
  | (Race & {
      participants: RaceParticipant[];
    })
  | null
> {
  return prisma.race.findUnique({
    where: { code },
    include: {
      participants: {
        orderBy: [
          // Finished first (finishPosition asc, nulls last by Postgres default),
          // then DNFs by createdAt.
          { finishPosition: 'asc' },
          { createdAt: 'asc' },
        ],
      },
    },
  });
}

export async function markRaceEnded(
  raceId: string,
  endedAt: Date,
  status: RaceStatus = 'ended',
): Promise<void> {
  await prisma.race.update({
    where: { id: raceId },
    data: { endedAt, status },
  });
}

export async function markRaceStarted(raceId: string, startedAt: Date): Promise<void> {
  await prisma.race.update({
    where: { id: raceId },
    data: { startedAt, status: 'racing' },
  });
}

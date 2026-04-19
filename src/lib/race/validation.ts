import { z } from 'zod';
import { RACE_CODE_LENGTH } from './code';

export const JoinEventSchema = z.object({
  code: z
    .string()
    .length(RACE_CODE_LENGTH)
    .regex(/^[A-Z0-9]+$/),
});

export const StartRaceEventSchema = z.object({}).strict();

export const ProgressEventSchema = z.object({
  charIndex: z.number().int().min(0).max(10_000),
  wpm: z.number().min(0).max(500),
  accuracy: z.number().min(0).max(1),
});

export const FinishEventSchema = z.object({
  wpm: z.number().min(0).max(500),
  rawWpm: z.number().min(0).max(500),
  accuracy: z.number().min(0).max(1),
  durationMs: z
    .number()
    .int()
    .min(0)
    .max(30 * 60_000),
});

export const LeaveEventSchema = z.object({}).strict();

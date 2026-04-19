import { z } from 'zod';

export const SaveResultSchema = z
  .object({
    wpm: z.number().min(0).max(400),
    rawWpm: z.number().min(0).max(500),
    accuracy: z.number().min(0).max(1),
    mode: z.enum(['fixed', 'time', 'words']),
    durationMs: z
      .number()
      .int()
      .min(0)
      .max(10 * 60 * 1000),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    fixedLength: z.enum(['short', 'medium', 'long']).optional(),
    timeDuration: z.number().int().positive().optional(),
    wordCount: z.number().int().positive().optional(),
  })
  .refine((d) => (d.mode === 'fixed' ? !!d.fixedLength : true), {
    message: 'fixedLength required for fixed mode',
  })
  .refine((d) => (d.mode === 'time' ? !!d.timeDuration : true), {
    message: 'timeDuration required for time mode',
  })
  .refine((d) => (d.mode === 'words' ? !!d.wordCount : true), {
    message: 'wordCount required for words mode',
  });

export type SaveResultInput = z.infer<typeof SaveResultSchema>;

export type SaveResultActionOutcome =
  | { ok: true }
  | { ok: false; reason: 'unauthenticated' | 'invalid' | 'error' };

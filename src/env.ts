import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  AUTH_URL: z.string().url().optional(),
  NEXT_PUBLIC_ADSENSE_PUBLISHER_ID: z
    .string()
    .regex(/^ca-pub-\d+$/)
    .optional(),
  NEXT_PUBLIC_ADSENSE_ENABLED: z.enum(['true', 'false']).optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

// Strip entries whose value is the literal string "undefined" (Node coerces
// `process.env.X = undefined` to "undefined"; we want those treated as absent).
const rawEnv = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== 'undefined'));

export const env = EnvSchema.parse(rawEnv);

export function isAuthConfigured(): boolean {
  return !!(env.DATABASE_URL && env.AUTH_SECRET && env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}

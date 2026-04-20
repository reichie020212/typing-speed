import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  AUTH_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const env = EnvSchema.parse(process.env);

export function isAuthConfigured(): boolean {
  return !!(env.DATABASE_URL && env.AUTH_SECRET && env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
}

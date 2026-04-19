'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { saveResult } from '@/lib/db/results';
import { type SaveResultActionOutcome, SaveResultSchema } from './results-schema';

export async function saveResultAction(input: unknown): Promise<SaveResultActionOutcome> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: 'unauthenticated' };

  const parsed = SaveResultSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: 'invalid' };

  try {
    await saveResult(session.user.id, parsed.data);
  } catch (err) {
    console.error('[saveResultAction] persistence error', err);
    return { ok: false, reason: 'error' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/history');
  return { ok: true };
}

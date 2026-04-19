'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { renameUsername } from '@/lib/db/users';

export type RenameUsernameOutcome =
  | { ok: true; username: string }
  | { ok: false; reason: 'unauthenticated' | 'invalid' | 'taken' };

export async function renameUsernameAction(
  newUsername: string,
): Promise<RenameUsernameOutcome> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, reason: 'unauthenticated' };

  const result = await renameUsername(session.user.id, newUsername);
  if (!result.ok) return result;

  revalidatePath('/profile/me');
  revalidatePath(`/profile/${newUsername}`);
  return result;
}

/**
 * Form-action variant used by the rename form. Expects a FormData with a
 * `username` field. Redirects to the new profile URL on success.
 */
export async function renameUsernameFormAction(formData: FormData): Promise<void> {
  const input = formData.get('username');
  if (typeof input !== 'string') redirect('/profile/me?rename=invalid');
  const r = await renameUsernameAction(input as string);
  if (!r.ok) redirect(`/profile/me?rename=${r.reason}`);
  redirect(`/profile/${r.username}`);
}

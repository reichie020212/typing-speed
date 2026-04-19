import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { isAuthConfigured } from '@/env';

export async function requireSession(callbackUrl: string) {
  if (!isAuthConfigured()) {
    redirect('/auth/signin');
  }
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  return session;
}

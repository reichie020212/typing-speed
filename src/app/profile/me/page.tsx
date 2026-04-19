import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth/guards';

export default async function ProfileMePage() {
  const session = await requireSession('/profile/me');
  redirect(`/profile/${session.user.username}`);
}

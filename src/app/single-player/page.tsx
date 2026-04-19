import { saveResultAction } from '@/app/actions/results';
import { auth } from '@/auth';
import { isAuthConfigured } from '@/env';
import { SinglePlayerClient } from './client';

export default async function SinglePlayerPage() {
  const session = isAuthConfigured() ? await auth() : null;
  const loggedIn = !!session?.user?.id;
  return <SinglePlayerClient loggedIn={loggedIn} saveAction={saveResultAction} />;
}

import Link from 'next/link';
import { auth } from '@/auth';
import { env, isMultiplayerConfigured } from '@/env';
import { CreateRaceForm } from './create-form';
import { JoinRaceForm } from './join-form';

export const metadata = { title: 'Race — multiplayer' };

export default async function RacePage() {
  if (!isMultiplayerConfigured()) {
    return (
      <section className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Multiplayer not configured yet</h1>
        <p className="mt-4 text-[color:var(--muted)]">
          The race server hasn&apos;t been set up for this deployment.
        </p>
        <Link href="/" className="mt-6 inline-block text-[color:var(--accent)] hover:underline">
          Back home
        </Link>
      </section>
    );
  }
  const session = await auth();
  return (
    <section className="mx-auto grid max-w-3xl gap-8 px-6 py-12 md:grid-cols-2">
      <CreateRaceForm />
      <JoinRaceForm />
      {!session?.user ? (
        <p className="md:col-span-2 text-center text-sm text-[color:var(--muted)]">
          <Link href="/auth/signin" className="text-[color:var(--accent)] hover:underline">
            Sign in
          </Link>{' '}
          to save your race results to your profile.
        </p>
      ) : null}
      <input type="hidden" data-race-server-url={env.NEXT_PUBLIC_RACE_SERVER_URL} />
    </section>
  );
}

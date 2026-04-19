import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { env, isMultiplayerConfigured } from '@/env';
import { RaceClient } from './client';

export default async function RaceCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Z0-9]{6}$/.test(code)) return notFound();
  if (!isMultiplayerConfigured()) {
    return (
      <section className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Multiplayer not configured yet</h1>
      </section>
    );
  }
  const session = await auth();
  return (
    <RaceClient
      code={code}
      serverUrl={env.NEXT_PUBLIC_RACE_SERVER_URL!}
      loggedIn={!!session?.user?.id}
    />
  );
}

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { env } from '@/env';
import { mintRaceToken } from '@/lib/race/token';

export async function POST() {
  if (!env.RACE_SERVER_SECRET) {
    return NextResponse.json({ error: 'race-not-configured' }, { status: 501 });
  }
  const session = await auth();
  if (!session?.user?.id || !session.user.username) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const token = await mintRaceToken(
    { userId: session.user.id, username: session.user.username },
    env.RACE_SERVER_SECRET,
    { ttlSeconds: 300 },
  );
  return NextResponse.json({ token });
}

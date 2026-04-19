import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { env } from '@/env';
import { PASSAGES } from '@/lib/content/passages';
import { pickPassage } from '@/lib/content/select';
import { createRace } from '@/lib/db/races';

const CreateRaceSchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']),
  length: z.enum(['short', 'medium', 'long']),
});

export async function POST(req: Request) {
  if (!env.DATABASE_URL || !env.RACE_SERVER_SECRET) {
    return NextResponse.json({ error: 'race-not-configured' }, { status: 501 });
  }
  const body = await req.json().catch(() => null);
  const parsed = CreateRaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad-request' }, { status: 400 });
  }
  const session = await auth();
  const createdById = session?.user?.id ?? null;

  const passage = pickPassage({ length: parsed.data.length });
  // Double-check the picked passage actually exists in the catalog (defense-in-depth).
  if (!PASSAGES.find((p) => p.id === passage.id)) {
    return NextResponse.json({ error: 'passage-not-found' }, { status: 500 });
  }
  const race = await createRace({
    passageId: passage.id,
    difficulty: parsed.data.difficulty,
    createdById,
  });
  return NextResponse.json({ code: race.code });
}

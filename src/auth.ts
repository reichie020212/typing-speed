import { PrismaAdapter } from '@auth/prisma-adapter';
import NextAuth from 'next-auth';
import type { AdapterUser } from 'next-auth/adapters';
import { prisma } from '@/lib/db/client';
import { generateUsername } from '@/lib/db/users';
import { authConfig } from './auth.config';

const baseAdapter = PrismaAdapter(prisma);

const adapter: typeof baseAdapter = {
  ...baseAdapter,
  async createUser(data: AdapterUser): Promise<AdapterUser> {
    const username = await generateUsername(data.email ?? data.name ?? null);
    const created = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        image: data.image,
        emailVerified: data.emailVerified ?? null,
        username,
      },
    });
    // AdapterUser expects `email: string`; our schema allows null. Coerce for the
    // adapter contract; NextAuth only uses this for session routing.
    return {
      id: created.id,
      email: created.email ?? '',
      emailVerified: created.emailVerified,
      name: created.name,
      image: created.image,
    };
  },
};

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
});

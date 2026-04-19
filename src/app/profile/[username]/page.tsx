import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { renameUsernameFormAction } from '@/app/actions/username';
import { Button } from '@/components/ui/Button';
import { isAuthConfigured } from '@/env';
import { getUserStats } from '@/lib/db/results';
import { getUserByUsername } from '@/lib/db/users';

function fmtWpm(n: number | null): string {
  return n === null ? '—' : Math.round(n).toString();
}

interface Props {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ rename?: string }>;
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const { rename } = await searchParams;

  if (!isAuthConfigured()) {
    return (
      <section className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Profiles aren&apos;t configured yet</h1>
        <p className="mt-3 text-sm text-[color:var(--muted)]">See SETUP.md.</p>
      </section>
    );
  }

  const user = await getUserByUsername(username);
  if (!user) notFound();

  const session = await auth();
  const isOwner = session?.user?.id === user.id;

  if (!isOwner) {
    return (
      <section className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">This profile isn&apos;t public yet</h1>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          Public profiles arrive in a later release.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-[color:var(--accent)] hover:underline"
        >
          Back to home
        </Link>
      </section>
    );
  }

  const stats = await getUserStats(user.id);

  const renameMessage =
    rename === 'invalid'
      ? 'That username is invalid (use 3-24 lowercase letters, numbers, or hyphens; no reserved names).'
      : rename === 'taken'
        ? 'That username is taken.'
        : rename === 'unauthenticated'
          ? 'You must be signed in.'
          : null;

  return (
    <section className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        <span className="font-mono">{user.username}</span>
      </h1>
      <p className="text-sm text-[color:var(--muted)]">Your profile</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Best WPM" value={fmtWpm(stats.bestWpm)} accent />
        <Stat label="Avg WPM" value={fmtWpm(stats.avgWpm)} />
        <Stat label="Tests" value={stats.totalTests.toString()} />
      </div>

      <div className="mt-10 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
        <h2 className="text-sm uppercase tracking-widest text-[color:var(--muted)]">
          Rename username
        </h2>
        <p className="mt-2 text-xs text-[color:var(--muted)]">
          Warning: renaming will break any shared links to your old profile.
        </p>
        <form action={renameUsernameFormAction} className="mt-3 flex items-center gap-2">
          <input
            name="username"
            defaultValue={user.username}
            className="flex-1 rounded-md border border-[color:var(--border)] bg-[color:var(--bg)] px-3 py-1.5 font-mono text-sm text-[color:var(--fg)]"
            pattern="[a-z0-9][a-z0-9-]{2,23}"
            minLength={3}
            maxLength={24}
            required
          />
          <Button type="submit" variant="primary">
            Save
          </Button>
        </form>
        {renameMessage ? (
          <p className="mt-2 text-xs text-[color:var(--danger)]">{renameMessage}</p>
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div
        className={`text-4xl font-semibold ${accent ? 'text-[color:var(--accent)]' : 'text-[color:var(--fg)]'}`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-widest text-[color:var(--muted)]">
        {label}
      </div>
    </div>
  );
}

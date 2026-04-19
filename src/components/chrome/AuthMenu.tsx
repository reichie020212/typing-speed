import Link from 'next/link';
import { auth, signOut } from '@/auth';
import { isAuthConfigured } from '@/env';

export async function AuthMenu() {
  if (!isAuthConfigured()) return null;

  const session = await auth();

  if (!session?.user) {
    return (
      <div className="flex items-center gap-4">
        <Link
          href="/race"
          className="text-xs uppercase tracking-widest text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors"
        >
          race
        </Link>
        <Link
          href="/auth/signin"
          className="text-xs uppercase tracking-widest text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors"
        >
          sign in
        </Link>
      </div>
    );
  }

  const u = session.user;
  const label = u.username || u.name || 'account';

  return (
    <details className="relative">
      <summary className="flex cursor-pointer items-center gap-2 list-none text-xs uppercase tracking-widest text-[color:var(--muted)] hover:text-[color:var(--fg)]">
        {u.image ? (
          // biome-ignore lint/performance/noImgElement: tiny avatar; server component avoids extra bundle for next/image.
          <img src={u.image} alt="" width={20} height={20} className="rounded-full" />
        ) : (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--faint)] text-[10px] text-[color:var(--fg)]">
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span>{label}</span>
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-40 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] py-1 shadow-lg">
        <MenuLink href="/dashboard" label="Dashboard" />
        <MenuLink href="/race" label="Race" />
        <MenuLink href="/leaderboard" label="Leaderboards" />
        <MenuLink href="/profile/me" label="Profile" />
        <MenuLink href="/history" label="History" />
        <form
          action={async () => {
            'use server';
            await signOut({ redirectTo: '/' });
          }}
        >
          <button
            type="submit"
            className="block w-full px-3 py-1.5 text-left text-sm text-[color:var(--fg)] hover:bg-[color:var(--faint)]"
          >
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

function MenuLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-3 py-1.5 text-sm text-[color:var(--fg)] hover:bg-[color:var(--faint)]"
    >
      {label}
    </Link>
  );
}

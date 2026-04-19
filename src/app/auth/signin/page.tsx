import { signIn } from '@/auth';
import { Button } from '@/components/ui/Button';
import { isAuthConfigured } from '@/env';

interface Props {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function SignInPage({ searchParams }: Props) {
  const { callbackUrl = '/dashboard' } = await searchParams;

  if (!isAuthConfigured()) {
    return (
      <section className="mx-auto max-w-md px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">Sign in is not configured yet</h1>
        <p className="mt-3 text-sm text-[color:var(--muted)]">
          The app is running without Google OAuth credentials. See <code>SETUP.md</code> to
          configure.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to Typing Speed</h1>
        <p className="text-sm text-[color:var(--muted)]">
          Sign in to save your tests, track your progress, and climb the leaderboards.
        </p>
      </div>
      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: callbackUrl });
        }}
      >
        <Button type="submit" variant="primary">
          Continue with Google
        </Button>
      </form>
      <p className="text-xs text-[color:var(--muted)]">
        By signing in you agree that your Google email and name are used for display.
      </p>
    </section>
  );
}

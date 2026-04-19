import Link from 'next/link';

export default function AuthErrorPage() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong signing in</h1>
      <p className="text-sm text-[color:var(--muted)]">Please try again in a moment.</p>
      <Link href="/" className="text-sm text-[color:var(--accent)] hover:underline">
        Back to home
      </Link>
    </section>
  );
}

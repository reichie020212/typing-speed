import Link from 'next/link';
import { AuthMenu } from './AuthMenu';
import { ThemeToggle } from './ThemeToggle';

export function Header() {
  return (
    <header className="w-full border-b border-[color:var(--border)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="text-sm font-medium tracking-wide text-[color:var(--fg)] hover:text-[color:var(--accent)]"
        >
          typing speed
        </Link>
        <div className="flex items-center gap-4">
          <AuthMenu />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

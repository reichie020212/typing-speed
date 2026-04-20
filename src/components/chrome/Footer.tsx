import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';

export function Footer() {
  return (
    <footer className="w-full border-t border-[color:var(--border)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-6 py-4 text-xs text-[color:var(--muted)] md:flex-row md:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/privacy" className="hover:text-[color:var(--fg)] transition-colors">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[color:var(--fg)] transition-colors">
            Terms
          </Link>
          <Link href="/about" className="hover:text-[color:var(--fg)] transition-colors">
            About
          </Link>
          <a
            href="https://github.com/reichie020212/typing-speed"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[color:var(--fg)] transition-colors"
          >
            Source
          </a>
        </div>
        <div className="flex items-center gap-4">
          <span>© {new Date().getFullYear()} Red</span>
          <ThemeToggle />
        </div>
      </div>
    </footer>
  );
}

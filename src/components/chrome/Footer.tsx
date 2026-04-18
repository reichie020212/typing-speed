import { ThemeToggle } from './ThemeToggle';

export function Footer() {
  return (
    <footer className="w-full border-t border-[color:var(--border)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 text-xs text-[color:var(--muted)]">
        <span>v0.1.0 — phase 1 single-player</span>
        <ThemeToggle />
      </div>
    </footer>
  );
}

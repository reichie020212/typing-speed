'use client';

import { useEffect, useState } from 'react';
import { loadConfig, saveConfig } from '@/lib/storage/config';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setTheme(loadConfig().theme);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    saveConfig({ theme: next });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="text-xs uppercase tracking-widest text-[color:var(--muted)] hover:text-[color:var(--fg)] transition-colors"
    >
      {theme === 'dark' ? 'light' : 'dark'} mode
    </button>
  );
}

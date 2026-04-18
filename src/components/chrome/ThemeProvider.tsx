'use client';

import { useEffect } from 'react';
import { loadConfig } from '@/lib/storage/config';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const cfg = loadConfig();
    document.documentElement.setAttribute('data-theme', cfg.theme);
  }, []);
  return <>{children}</>;
}

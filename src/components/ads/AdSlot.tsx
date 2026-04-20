'use client';

import { useEffect } from 'react';
import { env } from '@/env';

interface AdSlotProps {
  slotId: string;
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
  className?: string;
}

export function AdSlot({ slotId, format = 'auto', className }: AdSlotProps) {
  const pub = env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID;
  const enabled = env.NEXT_PUBLIC_ADSENSE_ENABLED === 'true';

  useEffect(() => {
    if (!pub || !enabled) return;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle ?? [];
      w.adsbygoogle.push({});
    } catch {
      /* noop */
    }
  }, [enabled]);

  if (!pub || !enabled) return null;

  return (
    <ins
      className={`adsbygoogle block ${className ?? ''}`}
      style={{ display: 'block' }}
      data-ad-client={pub}
      data-ad-slot={slotId}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}

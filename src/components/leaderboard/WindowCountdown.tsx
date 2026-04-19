'use client';

import { useEffect, useState } from 'react';

interface Props {
  deadline: string;
}

export function WindowCountdown({ deadline }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const ms = Math.max(0, new Date(deadline).getTime() - now);
  const h = Math.floor(ms / (60 * 60 * 1000));
  const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));

  return (
    <p className="text-xs text-[color:var(--muted)]">
      Resets in {h > 0 ? `${h}h ` : ''}
      {m}m
    </p>
  );
}

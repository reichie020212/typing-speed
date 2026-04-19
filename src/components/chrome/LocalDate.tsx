'use client';

import { useEffect, useState } from 'react';

interface Props {
  iso: string;
  className?: string;
}

export function LocalDate({ iso, className }: Props) {
  const [text, setText] = useState<string>(() => iso.slice(0, 10));
  useEffect(() => {
    const d = new Date(iso);
    setText(
      d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    );
  }, [iso]);
  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}

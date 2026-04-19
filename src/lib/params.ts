export function normalizeMode(raw: string | undefined): 'fixed' | 'time' | 'words' | undefined {
  if (raw === 'fixed' || raw === 'time' || raw === 'words') return raw;
  return undefined;
}

export function normalizeDifficulty(
  raw: string | undefined,
): 'easy' | 'medium' | 'hard' | undefined {
  if (raw === 'easy' || raw === 'medium' || raw === 'hard') return raw;
  return undefined;
}

export function normalizeModeFilter(raw: string | undefined): 'all' | 'fixed' | 'time' | 'words' {
  if (raw === 'all') return 'all';
  const v = normalizeMode(raw);
  return v ?? 'all';
}

export function parseOffset(raw: string | undefined, max = 10_000): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.floor(n), max);
}

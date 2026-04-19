export type Window = 'alltime' | 'today' | 'weekly' | 'monthly';

export function windowStart(window: Window, now: Date = new Date()): Date | null {
  if (window === 'alltime') return null;

  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (window === 'today') return midnight;

  if (window === 'weekly') {
    const day = midnight.getUTCDay();
    const daysSinceMonday = (day + 6) % 7;
    const start = new Date(midnight);
    start.setUTCDate(midnight.getUTCDate() - daysSinceMonday);
    return start;
  }

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export function windowDeadline(window: Window, now: Date = new Date()): Date | null {
  const start = windowStart(window, now);
  if (!start) return null;

  if (window === 'today') {
    return new Date(start.getTime() + 24 * 60 * 60 * 1000);
  }
  if (window === 'weekly') {
    return new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  }
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}

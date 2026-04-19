import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { windowDeadline, windowStart } from '@/lib/db/time-windows';

const iso = (d: Date | null) => (d ? d.toISOString() : null);

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('windowStart', () => {
  it('returns null for all-time', () => {
    vi.setSystemTime(new Date('2026-04-19T15:32:00Z'));
    expect(windowStart('alltime')).toBeNull();
  });

  it('today = 00:00 UTC of the current UTC date', () => {
    vi.setSystemTime(new Date('2026-04-19T23:59:59Z'));
    expect(iso(windowStart('today'))).toBe('2026-04-19T00:00:00.000Z');
  });

  it('today rolls over on UTC midnight', () => {
    vi.setSystemTime(new Date('2026-04-20T00:00:01Z'));
    expect(iso(windowStart('today'))).toBe('2026-04-20T00:00:00.000Z');
  });

  it('weekly = previous Monday 00:00 UTC when it is Wednesday', () => {
    vi.setSystemTime(new Date('2026-04-22T10:00:00Z'));
    expect(iso(windowStart('weekly'))).toBe('2026-04-20T00:00:00.000Z');
  });

  it('weekly = same day when it is Monday', () => {
    vi.setSystemTime(new Date('2026-04-20T10:00:00Z'));
    expect(iso(windowStart('weekly'))).toBe('2026-04-20T00:00:00.000Z');
  });

  it('weekly = previous Monday when it is Sunday 23:59 UTC', () => {
    vi.setSystemTime(new Date('2026-04-26T23:59:00Z'));
    expect(iso(windowStart('weekly'))).toBe('2026-04-20T00:00:00.000Z');
  });

  it('monthly = 1st of current month 00:00 UTC', () => {
    vi.setSystemTime(new Date('2026-04-19T15:32:00Z'));
    expect(iso(windowStart('monthly'))).toBe('2026-04-01T00:00:00.000Z');
  });
});

describe('windowDeadline', () => {
  it('returns null for all-time', () => {
    vi.setSystemTime(new Date('2026-04-19T15:32:00Z'));
    expect(windowDeadline('alltime')).toBeNull();
  });

  it('today deadline = start + 24h', () => {
    vi.setSystemTime(new Date('2026-04-19T15:32:00Z'));
    expect(iso(windowDeadline('today'))).toBe('2026-04-20T00:00:00.000Z');
  });

  it('weekly deadline = start + 7 days', () => {
    vi.setSystemTime(new Date('2026-04-22T10:00:00Z'));
    expect(iso(windowDeadline('weekly'))).toBe('2026-04-27T00:00:00.000Z');
  });

  it('monthly deadline = 1st of next month', () => {
    vi.setSystemTime(new Date('2026-04-19T15:32:00Z'));
    expect(iso(windowDeadline('monthly'))).toBe('2026-05-01T00:00:00.000Z');
  });

  it('monthly deadline handles December → January', () => {
    vi.setSystemTime(new Date('2026-12-15T00:00:00Z'));
    expect(iso(windowDeadline('monthly'))).toBe('2027-01-01T00:00:00.000Z');
  });
});

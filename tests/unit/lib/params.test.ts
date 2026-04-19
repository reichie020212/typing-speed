import { describe, expect, it } from 'vitest';
import { normalizeDifficulty, normalizeMode, normalizeModeFilter, parseOffset } from '@/lib/params';

describe('normalizeMode', () => {
  it('accepts the three valid modes', () => {
    expect(normalizeMode('fixed')).toBe('fixed');
    expect(normalizeMode('time')).toBe('time');
    expect(normalizeMode('words')).toBe('words');
  });
  it('returns undefined for invalid/missing', () => {
    expect(normalizeMode(undefined)).toBeUndefined();
    expect(normalizeMode('all')).toBeUndefined();
    expect(normalizeMode('bogus')).toBeUndefined();
    expect(normalizeMode('')).toBeUndefined();
  });
});

describe('normalizeDifficulty', () => {
  it('accepts the three valid tiers', () => {
    expect(normalizeDifficulty('easy')).toBe('easy');
    expect(normalizeDifficulty('medium')).toBe('medium');
    expect(normalizeDifficulty('hard')).toBe('hard');
  });
  it('returns undefined for invalid/missing', () => {
    expect(normalizeDifficulty(undefined)).toBeUndefined();
    expect(normalizeDifficulty('all')).toBeUndefined();
    expect(normalizeDifficulty('extreme')).toBeUndefined();
  });
});

describe('normalizeModeFilter', () => {
  it('returns "all" for missing/invalid', () => {
    expect(normalizeModeFilter(undefined)).toBe('all');
    expect(normalizeModeFilter('')).toBe('all');
    expect(normalizeModeFilter('bogus')).toBe('all');
  });
  it('preserves explicit modes', () => {
    expect(normalizeModeFilter('fixed')).toBe('fixed');
    expect(normalizeModeFilter('time')).toBe('time');
    expect(normalizeModeFilter('words')).toBe('words');
  });
  it('accepts the literal "all"', () => {
    expect(normalizeModeFilter('all')).toBe('all');
  });
});

describe('parseOffset', () => {
  it('returns 0 for missing or negative', () => {
    expect(parseOffset(undefined)).toBe(0);
    expect(parseOffset('-5')).toBe(0);
    expect(parseOffset('abc')).toBe(0);
  });
  it('floors non-integer values', () => {
    expect(parseOffset('12.9')).toBe(12);
  });
  it('caps at the default max', () => {
    expect(parseOffset('99999999')).toBe(10_000);
  });
  it('respects an explicit max', () => {
    expect(parseOffset('500', 100)).toBe(100);
  });
});

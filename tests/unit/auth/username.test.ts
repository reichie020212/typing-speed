import { describe, expect, it } from 'vitest';
import {
  RESERVED_USERNAMES,
  deriveBase,
  isValidUsername,
  randomSuffix,
} from '@/lib/auth/username';

describe('deriveBase', () => {
  it('strips the email domain', () => {
    expect(deriveBase('jane.doe@gmail.com')).toBe('jane-doe');
  });

  it('lowercases everything', () => {
    expect(deriveBase('Jane.Doe@Example.com')).toBe('jane-doe');
  });

  it('replaces non-alphanumeric with single hyphen', () => {
    expect(deriveBase('a_b+c.d@x')).toBe('a-b-c-d');
  });

  it('trims leading/trailing hyphens', () => {
    expect(deriveBase('---jane---@x')).toBe('jane');
  });

  it('caps length at 20 chars', () => {
    expect(deriveBase(`${'a'.repeat(100)}@x`).length).toBeLessThanOrEqual(20);
  });

  it('falls back to a user-<x> shape when result is too short', () => {
    expect(deriveBase('ab@x')).toMatch(/^user-/);
    expect(deriveBase('@x')).toBe('user');
  });

  it('handles null seed', () => {
    expect(deriveBase(null)).toBe('user');
  });
});

describe('isValidUsername', () => {
  it('accepts typical usernames', () => {
    expect(isValidUsername('jane-doe')).toBe(true);
    expect(isValidUsername('jane')).toBe(true);
    expect(isValidUsername('user123')).toBe(true);
  });

  it('rejects usernames that are too short', () => {
    expect(isValidUsername('ab')).toBe(false);
  });

  it('rejects usernames that are too long', () => {
    expect(isValidUsername('a'.repeat(25))).toBe(false);
  });

  it('rejects usernames starting with a hyphen', () => {
    expect(isValidUsername('-jane')).toBe(false);
  });

  it('rejects usernames with uppercase or punctuation other than hyphen', () => {
    expect(isValidUsername('Jane')).toBe(false);
    expect(isValidUsername('jane_doe')).toBe(false);
    expect(isValidUsername('jane.doe')).toBe(false);
  });

  it('rejects reserved names', () => {
    for (const r of RESERVED_USERNAMES) {
      expect(isValidUsername(r)).toBe(false);
    }
  });
});

describe('randomSuffix', () => {
  it('returns a 3-char lowercase base-36 string', () => {
    const s = randomSuffix();
    expect(s).toMatch(/^[a-z0-9]{3}$/);
  });
});

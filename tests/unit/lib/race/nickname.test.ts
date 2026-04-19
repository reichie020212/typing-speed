import { describe, expect, it } from 'vitest';
import { validateNickname } from '@/lib/race/nickname';

describe('validateNickname', () => {
  it('accepts alphanumeric within 1–16 chars', () => {
    const out = validateNickname('alice');
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.normalized).toBe('alice');
  });

  it('trims surrounding whitespace', () => {
    const out = validateNickname('  bob  ');
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.normalized).toBe('bob');
  });

  it('allows spaces, underscores, and hyphens', () => {
    expect(validateNickname('cool guy').ok).toBe(true);
    expect(validateNickname('cool_guy').ok).toBe(true);
    expect(validateNickname('cool-guy').ok).toBe(true);
  });

  it('rejects empty after trim', () => {
    const out = validateNickname('   ');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/at least 1/i);
  });

  it('rejects over 16 chars', () => {
    const out = validateNickname('a'.repeat(17));
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/16/);
  });

  it('rejects disallowed characters', () => {
    const out = validateNickname('hello!');
    expect(out.ok).toBe(false);
  });

  it('rejects reserved Guest- prefix', () => {
    const out = validateNickname('Guest-1234');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/reserved/i);
  });

  it('rejects profanity from the blocklist', () => {
    const out = validateNickname('shit');
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/not allowed/i);
  });
});

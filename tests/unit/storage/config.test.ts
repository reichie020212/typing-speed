import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, loadConfig, saveConfig } from '@/lib/storage/config';

beforeEach(() => {
  localStorage.clear();
});

describe('storage config', () => {
  it('returns defaults when nothing is stored', () => {
    expect(loadConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('round-trips a patch', () => {
    saveConfig({ mode: 'time', timeDuration: 30, difficulty: 'hard' });
    const loaded = loadConfig();
    expect(loaded.mode).toBe('time');
    expect(loaded.timeDuration).toBe(30);
    expect(loaded.difficulty).toBe('hard');
    expect(loaded.fixedLength).toBe(DEFAULT_CONFIG.fixedLength);
  });

  it('returns defaults when stored JSON is corrupt', () => {
    localStorage.setItem('typing-speed:config', '{not json');
    expect(loadConfig()).toEqual(DEFAULT_CONFIG);
  });

  it('ignores unknown fields in stored JSON', () => {
    localStorage.setItem(
      'typing-speed:config',
      JSON.stringify({ mode: 'fixed', extraneous: 'garbage' }),
    );
    const loaded = loadConfig();
    expect(loaded.mode).toBe('fixed');
  });

  it('rejects invalid values silently and falls back to default for that field', () => {
    localStorage.setItem(
      'typing-speed:config',
      JSON.stringify({ mode: 'bogus-mode', timeDuration: 999 }),
    );
    const loaded = loadConfig();
    expect(loaded.mode).toBe(DEFAULT_CONFIG.mode);
    expect(loaded.timeDuration).toBe(DEFAULT_CONFIG.timeDuration);
  });
});

import type { Difficulty, Mode } from '@/lib/engine/types';

export interface UserConfig {
  mode: Mode;
  fixedLength: 'short' | 'medium' | 'long';
  timeDuration: 15 | 30 | 60;
  wordsCount: 10 | 25 | 50 | 100;
  difficulty: Difficulty;
  theme: 'dark' | 'light';
}

export const DEFAULT_CONFIG: UserConfig = {
  mode: 'fixed',
  fixedLength: 'medium',
  timeDuration: 30,
  wordsCount: 25,
  difficulty: 'medium',
  theme: 'dark',
};

const KEY = 'typing-speed:config';

const MODE_VALUES: readonly Mode[] = ['fixed', 'time', 'words'];
const LENGTH_VALUES: readonly string[] = ['short', 'medium', 'long'];
const DURATION_VALUES: readonly number[] = [15, 30, 60];
const WORDS_COUNT_VALUES: readonly number[] = [10, 25, 50, 100];
const DIFFICULTY_VALUES: readonly Difficulty[] = ['easy', 'medium', 'hard'];
const THEME_VALUES: readonly string[] = ['dark', 'light'];

function validate(raw: unknown): UserConfig {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_CONFIG;
  const r = raw as Record<string, unknown>;
  const out: UserConfig = { ...DEFAULT_CONFIG };
  if (typeof r.mode === 'string' && MODE_VALUES.includes(r.mode as Mode)) {
    out.mode = r.mode as Mode;
  }
  if (typeof r.fixedLength === 'string' && LENGTH_VALUES.includes(r.fixedLength)) {
    out.fixedLength = r.fixedLength as UserConfig['fixedLength'];
  }
  if (typeof r.timeDuration === 'number' && DURATION_VALUES.includes(r.timeDuration)) {
    out.timeDuration = r.timeDuration as UserConfig['timeDuration'];
  }
  if (typeof r.wordsCount === 'number' && WORDS_COUNT_VALUES.includes(r.wordsCount)) {
    out.wordsCount = r.wordsCount as UserConfig['wordsCount'];
  }
  if (typeof r.difficulty === 'string' && DIFFICULTY_VALUES.includes(r.difficulty as Difficulty)) {
    out.difficulty = r.difficulty as Difficulty;
  }
  if (typeof r.theme === 'string' && THEME_VALUES.includes(r.theme)) {
    out.theme = r.theme as UserConfig['theme'];
  }
  return out;
}

export function loadConfig(): UserConfig {
  if (typeof localStorage === 'undefined') return DEFAULT_CONFIG;
  const raw = localStorage.getItem(KEY);
  if (!raw) return DEFAULT_CONFIG;
  try {
    return validate(JSON.parse(raw));
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(patch: Partial<UserConfig>): void {
  if (typeof localStorage === 'undefined') return;
  const current = loadConfig();
  const next = { ...current, ...patch };
  localStorage.setItem(KEY, JSON.stringify(next));
}

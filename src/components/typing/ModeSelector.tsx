'use client';

import { Toggle } from '@/components/ui/Toggle';
import type { Difficulty, Mode } from '@/lib/engine';

export interface TestConfig {
  mode: Mode;
  fixedLength: 'short' | 'medium' | 'long';
  timeDuration: 15 | 30 | 60;
  wordsCount: 10 | 25 | 50 | 100;
  difficulty: Difficulty;
}

interface Props {
  value: TestConfig;
  onChange: (next: TestConfig) => void;
  disabled?: boolean;
}

const MODE_OPTIONS = [
  { value: 'fixed' as const, label: 'fixed' },
  { value: 'time' as const, label: 'time' },
  { value: 'words' as const, label: 'words' },
];

const LENGTH_OPTIONS = [
  { value: 'short' as const, label: 'short' },
  { value: 'medium' as const, label: 'medium' },
  { value: 'long' as const, label: 'long' },
];

const DURATION_OPTIONS = [
  { value: 15 as const, label: '15s' },
  { value: 30 as const, label: '30s' },
  { value: 60 as const, label: '60s' },
];

const WORDS_OPTIONS = [
  { value: 10 as const, label: '10' },
  { value: 25 as const, label: '25' },
  { value: 50 as const, label: '50' },
  { value: 100 as const, label: '100' },
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy' as const, label: 'easy' },
  { value: 'medium' as const, label: 'medium' },
  { value: 'hard' as const, label: 'hard' },
];

export function ModeSelector({ value, onChange, disabled = false }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <Toggle
        label="mode"
        options={MODE_OPTIONS}
        value={value.mode}
        onChange={(m) => onChange({ ...value, mode: m })}
        disabled={disabled}
      />
      {value.mode === 'fixed' && (
        <Toggle
          label="length"
          options={LENGTH_OPTIONS}
          value={value.fixedLength}
          onChange={(l) => onChange({ ...value, fixedLength: l })}
          disabled={disabled}
        />
      )}
      {value.mode === 'time' && (
        <Toggle
          label="duration"
          options={DURATION_OPTIONS}
          value={value.timeDuration}
          onChange={(d) => onChange({ ...value, timeDuration: d })}
          disabled={disabled}
        />
      )}
      {value.mode === 'words' && (
        <Toggle
          label="count"
          options={WORDS_OPTIONS}
          value={value.wordsCount}
          onChange={(c) => onChange({ ...value, wordsCount: c })}
          disabled={disabled}
        />
      )}
      <Toggle
        label="difficulty"
        options={DIFFICULTY_OPTIONS}
        value={value.difficulty}
        onChange={(d) => onChange({ ...value, difficulty: d })}
        disabled={disabled || value.mode === 'fixed'}
      />
    </div>
  );
}

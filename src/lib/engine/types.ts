export type Mode = 'fixed' | 'time' | 'words';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface EngineConfig {
  mode: Mode;
  source: string;
  duration?: number;
  wordCount?: number;
}

export interface KeyEvent {
  t: number;
  char: string;
  kind: 'input' | 'backspace';
  correct: boolean;
}

export interface EngineState {
  status: 'idle' | 'running' | 'finished';
  input: string;
  cursor: number;
  startedAt: number | null;
  endedAt: number | null;
  timeline: KeyEvent[];
  needMoreWords: boolean;
}

export interface CharStats {
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
}

export interface Result {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  chars: CharStats;
  durationMs: number;
}

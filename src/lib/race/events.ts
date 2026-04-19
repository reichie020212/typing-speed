export type RacePhase = 'waiting' | 'countdown' | 'racing' | 'ended';

export interface Participant {
  playerId: string; // stable per-connection ID (cuid for auth, guestId for guest)
  userId: string | null;
  nickname: string;
  isHost: boolean;
  status: 'lobby' | 'racing' | 'finished' | 'dnf';
  charIndex: number;
  wpm: number;
  accuracy: number;
  finishPosition: number | null;
}

export interface RaceSnapshot {
  code: string;
  phase: RacePhase;
  passageText: string; // sent only after countdown starts
  players: Participant[];
}

// ---------- Client → server ----------

export type StartRaceEvent = Record<string, never>;

export interface HandshakeAuth {
  token?: string;
  nickname?: string;
}

export interface JoinEvent {
  code: string;
}

export interface ProgressEvent {
  charIndex: number;
  wpm: number;
  accuracy: number;
}

export interface FinishEvent {
  wpm: number;
  rawWpm: number;
  accuracy: number;
  durationMs: number;
}

export type LeaveEvent = Record<string, never>;

// ---------- Server → client ----------

export interface JoinedEvent {
  you: Participant;
  race: RaceSnapshot;
}

export interface RosterEvent {
  players: Participant[];
}

export interface PhaseEvent {
  phase: RacePhase;
  at: number; // server epoch ms
}

export interface CountdownEvent {
  secondsRemaining: number;
}

export interface ProgressBroadcast {
  playerId: string;
  charIndex: number;
  wpm: number;
  accuracy: number;
}

export interface FinishedEvent {
  playerId: string;
  finishPosition: number;
  wpm: number;
  accuracy: number;
  durationMs: number;
}

export interface EndedEvent {
  results: Array<{
    playerId: string;
    nickname: string;
    userId: string | null;
    status: 'finished' | 'dnf';
    finishPosition: number | null;
    wpm: number;
    accuracy: number;
    durationMs: number;
  }>;
}

export interface RaceErrorEvent {
  code:
    | 'auth-failed'
    | 'room-not-found'
    | 'room-locked'
    | 'room-full'
    | 'bad-nickname'
    | 'bad-payload'
    | 'kicked-duplicate';
  message: string;
}

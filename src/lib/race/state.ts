import type { Participant, RacePhase, RaceSnapshot } from './events';

export type Effect =
  | {
      kind: 'broadcast';
      event: 'roster' | 'phase' | 'countdown' | 'progress' | 'finished' | 'ended';
      payload: unknown;
    }
  | { kind: 'scheduleTimer'; key: string; delayMs: number }
  | { kind: 'cancelTimer'; key: string }
  | {
      kind: 'persist';
      op: 'start' | 'finish' | 'dnf' | 'end' | 'cancel';
      data: Record<string, unknown>;
    };

export interface RaceMachineOptions {
  code: string;
  passageId?: string;
  passageText: string;
  maxPlayers: number;
  countdownSeconds: number;
  tailWindowMs: number;
  createdAtMs: number;
}

interface InternalPlayer extends Participant {
  joinedAtMs: number;
  finishedAtMs: number | null;
}

export interface RaceMachine {
  snapshot(): RaceSnapshot;
  join(cmd: {
    playerId: string;
    userId: string | null;
    nickname: string;
    nowMs: number;
  }): { ok: true } | { ok: false; code: 'room-full' | 'room-locked' | 'duplicate-player' };
  leave(cmd: { playerId: string; nowMs: number }): Effect[];
  startRace(cmd: { requesterId: string; nowMs: number }): Effect[];
  tickCountdown(cmd: { nowMs: number }): Effect[];
  progress(cmd: {
    playerId: string;
    charIndex: number;
    wpm: number;
    accuracy: number;
    nowMs: number;
  }): Effect[];
  finish(cmd: {
    playerId: string;
    wpm: number;
    rawWpm: number;
    accuracy: number;
    durationMs: number;
    nowMs: number;
  }): Effect[];
  tailWindowExpired(cmd: { nowMs: number }): Effect[];
  hasPlayer(playerId: string): boolean;
  isHost(playerId: string): boolean;
}

export function createRaceMachine(opts: RaceMachineOptions): RaceMachine {
  let phase: RacePhase = 'waiting';
  const players = new Map<string, InternalPlayer>();
  let countdownRemaining = opts.countdownSeconds;
  let startedAtMs: number | null = null;
  let firstFinishAtMs: number | null = null;
  let nextFinishPos = 1;

  function toParticipant(p: InternalPlayer): Participant {
    // Strip internal-only fields; _ prefix suppresses unused-var lint.
    const { joinedAtMs: _j, finishedAtMs: _f, ...rest } = p;
    return rest;
  }

  function snapshot(): RaceSnapshot {
    const sorted = Array.from(players.values()).sort((a, b) => a.joinedAtMs - b.joinedAtMs);
    return {
      code: opts.code,
      phase,
      passageText: phase === 'waiting' ? '' : opts.passageText,
      players: sorted.map(toParticipant),
    };
  }

  function rosterEffect(): Effect {
    return {
      kind: 'broadcast',
      event: 'roster',
      payload: { players: snapshot().players },
    };
  }

  function reassignHostIfNeeded(): boolean {
    const list = Array.from(players.values()).sort((a, b) => a.joinedAtMs - b.joinedAtMs);
    if (list.length === 0) return false;
    if (list.some((p) => p.isHost)) return false;
    const next = list[0];
    if (!next) return false;
    next.isHost = true;
    return true;
  }

  function endRace(nowMs: number): Effect[] {
    const effects: Effect[] = [];
    for (const p of players.values()) {
      if (p.status === 'racing') {
        p.status = 'dnf';
        p.finishedAtMs = nowMs;
        effects.push({
          kind: 'persist',
          op: 'dnf',
          data: {
            playerId: p.playerId,
            userId: p.userId,
            nickname: p.nickname,
            durationMs: startedAtMs !== null ? nowMs - startedAtMs : 0,
            wpm: p.wpm,
            accuracy: p.accuracy,
          },
        });
      }
    }
    phase = 'ended';
    effects.push({ kind: 'cancelTimer', key: 'tail-window' });
    effects.push({
      kind: 'broadcast',
      event: 'ended',
      payload: {
        results: Array.from(players.values())
          .sort((a, b) => {
            if (a.finishPosition == null && b.finishPosition == null) return 0;
            if (a.finishPosition == null) return 1;
            if (b.finishPosition == null) return -1;
            return a.finishPosition - b.finishPosition;
          })
          .map((p) => ({
            playerId: p.playerId,
            nickname: p.nickname,
            userId: p.userId,
            status: p.status === 'finished' ? 'finished' : 'dnf',
            finishPosition: p.finishPosition,
            wpm: p.wpm,
            accuracy: p.accuracy,
            durationMs:
              p.finishedAtMs !== null && startedAtMs !== null ? p.finishedAtMs - startedAtMs : 0,
          })),
      },
    });
    effects.push({ kind: 'persist', op: 'end', data: { endedAtMs: nowMs } });
    return effects;
  }

  return {
    snapshot,
    hasPlayer(playerId) {
      return players.has(playerId);
    },
    isHost(playerId) {
      return players.get(playerId)?.isHost === true;
    },
    join(cmd) {
      if (phase !== 'waiting') return { ok: false, code: 'room-locked' };
      if (players.size >= opts.maxPlayers) return { ok: false, code: 'room-full' };
      if (players.has(cmd.playerId)) return { ok: false, code: 'duplicate-player' };
      const isFirst = players.size === 0;
      players.set(cmd.playerId, {
        playerId: cmd.playerId,
        userId: cmd.userId,
        nickname: cmd.nickname,
        isHost: isFirst,
        status: 'lobby',
        charIndex: 0,
        wpm: 0,
        accuracy: 0,
        finishPosition: null,
        joinedAtMs: cmd.nowMs,
        finishedAtMs: null,
      });
      return { ok: true };
    },
    leave(cmd) {
      const existing = players.get(cmd.playerId);
      if (!existing) return [];
      const effects: Effect[] = [];
      if (phase === 'waiting' || phase === 'countdown') {
        players.delete(cmd.playerId);
        if (reassignHostIfNeeded()) {
          // host promotion implicit in roster broadcast
        }
        effects.push(rosterEffect());
        return effects;
      }
      if (phase === 'racing') {
        if (existing.status === 'racing') {
          existing.status = 'dnf';
          existing.finishedAtMs = cmd.nowMs;
          effects.push({
            kind: 'persist',
            op: 'dnf',
            data: {
              playerId: existing.playerId,
              userId: existing.userId,
              nickname: existing.nickname,
              durationMs: startedAtMs !== null ? cmd.nowMs - startedAtMs : 0,
              wpm: existing.wpm,
              accuracy: existing.accuracy,
            },
          });
          effects.push(rosterEffect());
        }
        // Check if this completes the race
        const anyRacing = Array.from(players.values()).some((p) => p.status === 'racing');
        if (!anyRacing) {
          effects.push(...endRace(cmd.nowMs));
        }
      }
      return effects;
    },
    startRace(cmd) {
      if (phase !== 'waiting') return [];
      const requester = players.get(cmd.requesterId);
      if (!requester?.isHost) return [];
      if (players.size < 2) return [];
      phase = 'countdown';
      countdownRemaining = opts.countdownSeconds;
      return [
        { kind: 'broadcast', event: 'phase', payload: { phase: 'countdown', at: cmd.nowMs } },
        {
          kind: 'broadcast',
          event: 'countdown',
          payload: { secondsRemaining: countdownRemaining },
        },
        { kind: 'scheduleTimer', key: 'countdown-tick', delayMs: 1000 },
        { kind: 'persist', op: 'start', data: { startedAtMs: cmd.nowMs } },
      ];
    },
    tickCountdown(cmd) {
      if (phase !== 'countdown') return [];
      countdownRemaining -= 1;
      if (countdownRemaining > 0) {
        return [
          {
            kind: 'broadcast',
            event: 'countdown',
            payload: { secondsRemaining: countdownRemaining },
          },
          { kind: 'scheduleTimer', key: 'countdown-tick', delayMs: 1000 },
        ];
      }
      // Countdown done → transition to racing
      phase = 'racing';
      startedAtMs = cmd.nowMs;
      for (const p of players.values()) {
        p.status = 'racing';
      }
      return [
        { kind: 'broadcast', event: 'countdown', payload: { secondsRemaining: 0 } },
        { kind: 'broadcast', event: 'phase', payload: { phase: 'racing', at: cmd.nowMs } },
      ];
    },
    progress(cmd) {
      const p = players.get(cmd.playerId);
      if (!p || phase !== 'racing' || p.status !== 'racing') return [];
      p.charIndex = cmd.charIndex;
      p.wpm = cmd.wpm;
      p.accuracy = cmd.accuracy;
      return [
        {
          kind: 'broadcast',
          event: 'progress',
          payload: {
            playerId: cmd.playerId,
            charIndex: cmd.charIndex,
            wpm: cmd.wpm,
            accuracy: cmd.accuracy,
          },
        },
      ];
    },
    finish(cmd) {
      const p = players.get(cmd.playerId);
      if (!p || phase !== 'racing' || p.status !== 'racing') return [];
      p.status = 'finished';
      p.finishPosition = nextFinishPos++;
      p.wpm = cmd.wpm;
      p.accuracy = cmd.accuracy;
      p.finishedAtMs = cmd.nowMs;
      const effects: Effect[] = [
        {
          kind: 'broadcast',
          event: 'finished',
          payload: {
            playerId: p.playerId,
            finishPosition: p.finishPosition,
            wpm: cmd.wpm,
            accuracy: cmd.accuracy,
            durationMs: cmd.durationMs,
          },
        },
        {
          kind: 'persist',
          op: 'finish',
          data: {
            playerId: p.playerId,
            userId: p.userId,
            nickname: p.nickname,
            finishPosition: p.finishPosition,
            wpm: cmd.wpm,
            rawWpm: cmd.rawWpm,
            accuracy: cmd.accuracy,
            durationMs: cmd.durationMs,
          },
        },
      ];
      if (firstFinishAtMs === null) {
        firstFinishAtMs = cmd.nowMs;
        effects.push({
          kind: 'scheduleTimer',
          key: 'tail-window',
          delayMs: opts.tailWindowMs,
        });
      }
      const anyRacing = Array.from(players.values()).some((pp) => pp.status === 'racing');
      if (!anyRacing) {
        effects.push(...endRace(cmd.nowMs));
      }
      return effects;
    },
    tailWindowExpired(cmd) {
      if (phase !== 'racing') return [];
      return endRace(cmd.nowMs);
    },
  };
}

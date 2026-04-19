import { beforeEach, describe, expect, it } from 'vitest';
import { createRaceMachine, type RaceMachine } from '@/lib/race/state';

function makeMachine(): RaceMachine {
  return createRaceMachine({
    code: 'ABCDEF',
    passageText: 'the quick brown fox',
    maxPlayers: 8,
    countdownSeconds: 5,
    tailWindowMs: 60_000,
    createdAtMs: 0,
  });
}

describe('race state machine', () => {
  let m: RaceMachine;
  beforeEach(() => {
    m = makeMachine();
  });

  it('starts in waiting phase with no players', () => {
    expect(m.snapshot().phase).toBe('waiting');
    expect(m.snapshot().players).toEqual([]);
  });

  it('first joiner becomes host', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    const snap = m.snapshot();
    expect(snap.players).toHaveLength(1);
    expect(snap.players[0]?.isHost).toBe(true);
  });

  it('second joiner is not host', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    expect(m.snapshot().players[1]?.isHost).toBe(false);
  });

  it('rejects join when full', () => {
    for (let i = 0; i < 8; i++) {
      m.join({ playerId: `p${i}`, userId: null, nickname: `n${i}`, nowMs: 100 + i });
    }
    const r = m.join({ playerId: 'p9', userId: null, nickname: 'overflow', nowMs: 200 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('room-full');
  });

  it('host can start race with ≥2 players; transitions to countdown', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    const effects = m.startRace({ requesterId: 'p1', nowMs: 300 });
    expect(m.snapshot().phase).toBe('countdown');
    // expect one timer scheduled for countdown tick
    expect(effects.some((e) => e.kind === 'scheduleTimer' && e.key === 'countdown-tick')).toBe(
      true,
    );
  });

  it('non-host cannot start race', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    const effects = m.startRace({ requesterId: 'p2', nowMs: 300 });
    expect(m.snapshot().phase).toBe('waiting');
    expect(effects.length).toBe(0);
  });

  it('countdown tick counts down to 0 then phase = racing', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    m.startRace({ requesterId: 'p1', nowMs: 300 });
    for (let s = 5; s >= 0; s--) {
      m.tickCountdown({ nowMs: 300 + (5 - s) * 1000 });
    }
    expect(m.snapshot().phase).toBe('racing');
  });

  it('blocks joins during countdown + racing', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    m.startRace({ requesterId: 'p1', nowMs: 300 });
    const r = m.join({ playerId: 'p3', userId: null, nickname: 'late', nowMs: 400 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('room-locked');
  });

  it('ends when all players finish', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    m.startRace({ requesterId: 'p1', nowMs: 300 });
    for (let s = 5; s >= 0; s--) m.tickCountdown({ nowMs: 300 + (5 - s) * 1000 });
    m.finish({
      playerId: 'p1',
      wpm: 80,
      rawWpm: 85,
      accuracy: 0.95,
      durationMs: 20_000,
      nowMs: 25_000,
    });
    m.finish({
      playerId: 'p2',
      wpm: 70,
      rawWpm: 72,
      accuracy: 0.92,
      durationMs: 25_000,
      nowMs: 30_000,
    });
    expect(m.snapshot().phase).toBe('ended');
  });

  it('tail window DNFs stragglers 60s after first finish', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    m.startRace({ requesterId: 'p1', nowMs: 300 });
    for (let s = 5; s >= 0; s--) m.tickCountdown({ nowMs: 300 + (5 - s) * 1000 });
    m.finish({
      playerId: 'p1',
      wpm: 80,
      rawWpm: 85,
      accuracy: 0.95,
      durationMs: 20_000,
      nowMs: 25_000,
    });
    // Fire tail-window timer
    m.tailWindowExpired({ nowMs: 85_000 });
    expect(m.snapshot().phase).toBe('ended');
    const bob = m.snapshot().players.find((p) => p.playerId === 'p2');
    expect(bob?.status).toBe('dnf');
  });

  it('host disconnect in lobby promotes next-longest-connected', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    m.leave({ playerId: 'p1', nowMs: 300 });
    expect(m.snapshot().players[0]?.playerId).toBe('p2');
    expect(m.snapshot().players[0]?.isHost).toBe(true);
  });

  it('disconnect during racing marks DNF', () => {
    m.join({ playerId: 'p1', userId: null, nickname: 'alice', nowMs: 100 });
    m.join({ playerId: 'p2', userId: null, nickname: 'bob', nowMs: 200 });
    m.startRace({ requesterId: 'p1', nowMs: 300 });
    for (let s = 5; s >= 0; s--) m.tickCountdown({ nowMs: 300 + (5 - s) * 1000 });
    m.leave({ playerId: 'p2', nowMs: 10_000 });
    const bob = m.snapshot().players.find((p) => p.playerId === 'p2');
    expect(bob?.status).toBe('dnf');
  });
});

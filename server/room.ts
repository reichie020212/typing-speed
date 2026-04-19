// server/room.ts
import type { Difficulty } from '@prisma/client';
import type { Server as IOServer, Socket } from 'socket.io';
import {
  markRaceEnded,
  markRaceStarted,
  saveRaceParticipant,
  saveRaceResultForUser,
} from '@/lib/db/races';
import { createRaceMachine, type Effect, type RaceMachine } from '@/lib/race/state';

export interface RoomIdentity {
  playerId: string;
  userId: string | null;
  nickname: string;
}

const COUNTDOWN_SECONDS = 5;
const TAIL_WINDOW_MS = 60_000;
const MAX_PLAYERS = 8;
const PURGE_AFTER_END_MS = 5 * 60_000;
const CREATION_TIMEOUT_MS = 10 * 60_000;

export class Room {
  private readonly machine: RaceMachine;
  private readonly sockets = new Map<string, Socket>(); // playerId → socket
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private startedAtMs: number | null = null;
  private purged = false;

  constructor(
    public readonly code: string,
    public readonly raceId: string,
    public readonly passageText: string,
    public readonly difficulty: Difficulty,
    private readonly io: IOServer,
    private readonly onPurge: () => void,
  ) {
    this.machine = createRaceMachine({
      code,
      passageText,
      maxPlayers: MAX_PLAYERS,
      countdownSeconds: COUNTDOWN_SECONDS,
      tailWindowMs: TAIL_WINDOW_MS,
      createdAtMs: Date.now(),
    });
    // Auto-cancel if the race never starts
    this.scheduleTimer('creation-timeout', CREATION_TIMEOUT_MS, () => this.cancel());
  }

  get roomName(): string {
    return `race:${this.code}`;
  }

  handleJoin(socket: Socket, identity: RoomIdentity): void {
    const result = this.machine.join({
      playerId: identity.playerId,
      userId: identity.userId,
      nickname: identity.nickname,
      nowMs: Date.now(),
    });
    if (!result.ok) {
      const map: Record<string, string> = {
        'room-full': 'This race is full.',
        'room-locked': 'This race has already started.',
        'duplicate-player': 'Already joined.',
      };
      socket.emit('error', { code: result.code, message: map[result.code] ?? 'Cannot join.' });
      socket.disconnect();
      return;
    }
    this.sockets.set(identity.playerId, socket);
    void socket.join(this.roomName);
    const snapshot = this.machine.snapshot();
    const you = snapshot.players.find((p) => p.playerId === identity.playerId);
    socket.emit('joined', { you, race: snapshot });
    this.io.to(this.roomName).emit('roster', { players: snapshot.players });
  }

  handleLeave(playerId: string): void {
    this.sockets.delete(playerId);
    this.apply(this.machine.leave({ playerId, nowMs: Date.now() }));
  }

  handleStart(playerId: string): void {
    this.apply(this.machine.startRace({ requesterId: playerId, nowMs: Date.now() }));
  }

  handleProgress(
    playerId: string,
    data: { charIndex: number; wpm: number; accuracy: number },
  ): void {
    this.apply(this.machine.progress({ playerId, ...data, nowMs: Date.now() }));
  }

  handleFinish(
    playerId: string,
    data: { wpm: number; rawWpm: number; accuracy: number; durationMs: number },
  ): void {
    this.apply(this.machine.finish({ playerId, ...data, nowMs: Date.now() }));
  }

  private apply(effects: Effect[]): void {
    for (const e of effects) {
      if (e.kind === 'broadcast') {
        this.io.to(this.roomName).emit(e.event, e.payload);
      } else if (e.kind === 'scheduleTimer') {
        this.scheduleTimer(e.key, e.delayMs, () => this.fireTimer(e.key));
      } else if (e.kind === 'cancelTimer') {
        this.cancelTimer(e.key);
      } else if (e.kind === 'persist') {
        void this.persist(e.op, e.data);
      }
    }
  }

  private fireTimer(key: string): void {
    if (key === 'countdown-tick') {
      this.apply(this.machine.tickCountdown({ nowMs: Date.now() }));
    } else if (key === 'tail-window') {
      this.apply(this.machine.tailWindowExpired({ nowMs: Date.now() }));
    } else if (key === 'purge') {
      this.purge();
    }
  }

  private scheduleTimer(key: string, delayMs: number, fn: () => void): void {
    this.cancelTimer(key);
    const t = setTimeout(fn, delayMs);
    this.timers.set(key, t);
  }

  private cancelTimer(key: string): void {
    const t = this.timers.get(key);
    if (t) clearTimeout(t);
    this.timers.delete(key);
  }

  private async persist(op: string, data: Record<string, unknown>): Promise<void> {
    try {
      if (op === 'start') {
        this.startedAtMs = data.startedAtMs as number;
        await markRaceStarted(this.raceId, new Date(this.startedAtMs));
      } else if (op === 'finish') {
        const common = {
          raceId: this.raceId,
          nickname: data.nickname as string,
          userId: data.userId as string | null,
          status: 'finished' as const,
          finishPosition: data.finishPosition as number,
          wpm: data.wpm as number,
          rawWpm: data.rawWpm as number,
          accuracy: data.accuracy as number,
          durationMs: data.durationMs as number,
        };
        if (common.userId) {
          await saveRaceResultForUser({
            ...common,
            userId: common.userId,
            difficulty: this.difficulty,
          });
        } else {
          await saveRaceParticipant(common);
        }
      } else if (op === 'dnf') {
        const common = {
          raceId: this.raceId,
          nickname: data.nickname as string,
          userId: data.userId as string | null,
          status: 'dnf' as const,
          finishPosition: null,
          wpm: (data.wpm as number) ?? 0,
          rawWpm: (data.wpm as number) ?? 0,
          accuracy: (data.accuracy as number) ?? 0,
          durationMs: (data.durationMs as number) ?? 0,
        };
        if (common.userId) {
          await saveRaceResultForUser({
            ...common,
            userId: common.userId,
            difficulty: this.difficulty,
          });
        } else {
          await saveRaceParticipant(common);
        }
      } else if (op === 'end') {
        await markRaceEnded(this.raceId, new Date(data.endedAtMs as number), 'ended');
        this.scheduleTimer('purge', PURGE_AFTER_END_MS, () => this.purge());
      }
    } catch (err) {
      console.error(`[race-server] persist ${op} failed`, err);
    }
  }

  cancel(): void {
    if (this.purged) return;
    void markRaceEnded(this.raceId, new Date(), 'canceled').catch((e) =>
      console.error('[race-server] cancel mark failed', e),
    );
    this.io.to(this.roomName).emit('error', {
      code: 'room-locked',
      message: 'Race canceled.',
    });
    this.purge();
  }

  private purge(): void {
    if (this.purged) return;
    this.purged = true;
    for (const [, t] of this.timers) clearTimeout(t);
    this.timers.clear();
    this.io.socketsLeave(this.roomName);
    this.onPurge();
  }

  hasPlayer(playerId: string): boolean {
    return this.machine.hasPlayer(playerId);
  }
}

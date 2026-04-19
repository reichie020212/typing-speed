// server/handlers.ts
import type { Server as IOServer, Socket } from 'socket.io';
import { PASSAGES } from '@/lib/content/passages';
import { getRaceByCode } from '@/lib/db/races';
import {
  FinishEventSchema,
  JoinEventSchema,
  LeaveEventSchema,
  ProgressEventSchema,
  StartRaceEventSchema,
} from '@/lib/race/validation';
import type { SocketIdentity } from './auth';
import { Room } from './room';
import { getRoom, purgeRoom, registerRoom } from './rooms';

const MAX_MALFORMED_PER_SOCKET = 3;

function getIdentity(socket: Socket): SocketIdentity {
  return (socket.data as { identity: SocketIdentity }).identity;
}

function bumpMalformed(socket: Socket): void {
  const count = (socket.data.malformed ?? 0) + 1;
  socket.data.malformed = count;
  if (count >= MAX_MALFORMED_PER_SOCKET) {
    socket.emit('error', { code: 'bad-payload', message: 'Too many malformed messages' });
    socket.disconnect();
  }
}

export function registerHandlers(io: IOServer, socket: Socket): void {
  socket.on('join', async (raw) => {
    const parsed = JoinEventSchema.safeParse(raw);
    if (!parsed.success) {
      bumpMalformed(socket);
      return;
    }
    const { code } = parsed.data;
    let room = getRoom(code);
    if (!room) {
      // Ensure the race actually exists in the DB (Next.js created it).
      const race = await getRaceByCode(code);
      if (!race) {
        socket.emit('error', { code: 'room-not-found', message: 'No such race.' });
        return;
      }
      if (race.status !== 'waiting') {
        socket.emit('error', { code: 'room-locked', message: 'Race already settled.' });
        return;
      }
      const passage = PASSAGES.find((p) => p.id === race.passageId);
      if (!passage) {
        socket.emit('error', { code: 'bad-payload', message: 'Passage missing.' });
        return;
      }
      room = new Room(race.code, race.id, passage.text, race.difficulty, io, () =>
        purgeRoom(race.code),
      );
      registerRoom(race.code, room);
    }
    const id = getIdentity(socket);
    // Dedupe multi-tab for auth users
    if (id.userId) {
      if (!socket.data.activeRooms) socket.data.activeRooms = new Set<string>();
      const existing = socket.data.activeRooms as Set<string>;
      for (const otherSocketId of await io.in(room.roomName).allSockets()) {
        const other = io.sockets.sockets.get(otherSocketId);
        const otherId = other?.data.identity as SocketIdentity | undefined;
        if (other && otherId?.userId === id.userId && other.id !== socket.id) {
          other.emit('error', {
            code: 'kicked-duplicate',
            message: 'Another tab took over this race.',
          });
          other.disconnect();
        }
      }
      existing.add(room.code);
    }
    socket.data.roomCode = room.code;
    room.handleJoin(socket, {
      playerId: id.playerId,
      userId: id.userId,
      nickname: id.nickname,
    });
  });

  socket.on('startRace', (raw) => {
    if (!StartRaceEventSchema.safeParse(raw ?? {}).success) {
      bumpMalformed(socket);
      return;
    }
    const code = socket.data.roomCode as string | undefined;
    const room = code ? getRoom(code) : undefined;
    if (!room) return;
    room.handleStart(getIdentity(socket).playerId);
  });

  socket.on('progress', (raw) => {
    const parsed = ProgressEventSchema.safeParse(raw);
    if (!parsed.success) {
      bumpMalformed(socket);
      return;
    }
    const code = socket.data.roomCode as string | undefined;
    const room = code ? getRoom(code) : undefined;
    if (!room) return;
    room.handleProgress(getIdentity(socket).playerId, parsed.data);
  });

  socket.on('finish', (raw) => {
    const parsed = FinishEventSchema.safeParse(raw);
    if (!parsed.success) {
      bumpMalformed(socket);
      return;
    }
    const code = socket.data.roomCode as string | undefined;
    const room = code ? getRoom(code) : undefined;
    if (!room) return;
    room.handleFinish(getIdentity(socket).playerId, parsed.data);
  });

  socket.on('leave', (raw) => {
    if (!LeaveEventSchema.safeParse(raw ?? {}).success) {
      bumpMalformed(socket);
      return;
    }
    const code = socket.data.roomCode as string | undefined;
    const room = code ? getRoom(code) : undefined;
    if (!room) return;
    room.handleLeave(getIdentity(socket).playerId);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode as string | undefined;
    const room = code ? getRoom(code) : undefined;
    if (!room) return;
    room.handleLeave(getIdentity(socket).playerId);
  });
}

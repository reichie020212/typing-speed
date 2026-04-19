// server/auth.ts
import type { Socket } from 'socket.io';
import { validateNickname } from '@/lib/race/nickname';
import { verifyRaceToken } from '@/lib/race/token';

export interface SocketIdentity {
  playerId: string;
  userId: string | null;
  username: string | null; // auth'd username at mint time, frozen
  nickname: string; // display name
}

function randomPlayerId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function authenticateSocket(socket: Socket, secret: string): Promise<SocketIdentity> {
  const { token, nickname } = (socket.handshake.auth ?? {}) as {
    token?: string;
    nickname?: string;
  };
  if (token) {
    const payload = await verifyRaceToken(token, secret);
    return {
      playerId: payload.userId,
      userId: payload.userId,
      username: payload.username,
      nickname: payload.username,
    };
  }
  if (typeof nickname === 'string') {
    const v = validateNickname(nickname);
    if (!v.ok) {
      const err = new Error(v.error);
      (err as Error & { data?: unknown }).data = { code: 'bad-nickname' };
      throw err;
    }
    return {
      playerId: `g-${randomPlayerId()}`,
      userId: null,
      username: null,
      nickname: v.normalized,
    };
  }
  const err = new Error('Handshake requires token or nickname');
  (err as Error & { data?: unknown }).data = { code: 'auth-failed' };
  throw err;
}

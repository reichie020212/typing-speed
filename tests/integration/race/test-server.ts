// tests/integration/race/test-server.ts
import http from 'node:http';
import { Server as IOServer } from 'socket.io';
import { type Socket as ClientSocket, io as ioClient } from 'socket.io-client';
import { mintRaceToken } from '@/lib/race/token';
import { authenticateSocket, type SocketIdentity } from '../../../server/auth';
import { registerHandlers } from '../../../server/handlers';

const SECRET = 'test-secret-that-is-at-least-32-characters-long-xx';

export interface TestServer {
  url: string;
  close(): Promise<void>;
  secret: string;
}

export async function startTestServer(): Promise<TestServer> {
  process.env.RACE_SERVER_SECRET = SECRET;
  const httpServer = http.createServer();
  const io = new IOServer(httpServer, { cors: { origin: '*' } });
  io.use(async (socket, next) => {
    try {
      const identity = await authenticateSocket(socket, SECRET);
      (socket.data as { identity: SocketIdentity }).identity = identity;
      next();
    } catch (err) {
      next(err as Error);
    }
  });
  io.on('connection', (socket) => registerHandlers(io, socket));
  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const address = httpServer.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  const url = `http://localhost:${address.port}`;
  return {
    url,
    secret: SECRET,
    async close() {
      io.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

export async function connectAsGuest(url: string, nickname: string): Promise<ClientSocket> {
  const socket = ioClient(url, {
    auth: { nickname },
    transports: ['websocket'],
  });
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', reject);
  });
  return socket;
}

export async function connectAsUser(
  url: string,
  secret: string,
  userId: string,
  username: string,
): Promise<ClientSocket> {
  const token = await mintRaceToken({ userId, username }, secret);
  const socket = ioClient(url, {
    auth: { token },
    transports: ['websocket'],
  });
  await new Promise<void>((resolve, reject) => {
    socket.on('connect', () => resolve());
    socket.on('connect_error', reject);
  });
  return socket;
}

export function waitFor<T>(
  socket: ClientSocket,
  event: string,
  predicate?: (p: T) => boolean,
  timeoutMs = 2000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    socket.on(event, (payload: T) => {
      if (!predicate || predicate(payload)) {
        clearTimeout(to);
        resolve(payload);
      }
    });
  });
}

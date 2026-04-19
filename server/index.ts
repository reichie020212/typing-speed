// server/index.ts
import http from 'node:http';
import { Server as IOServer } from 'socket.io';
import { prisma } from '@/lib/db/client';
import { authenticateSocket, type SocketIdentity } from './auth';
import { registerHandlers } from './handlers';
import { activeRoomCount } from './rooms';

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
const RACE_SERVER_SECRET = process.env.RACE_SERVER_SECRET;

if (!RACE_SERVER_SECRET) {
  throw new Error('RACE_SERVER_SECRET is required');
}

async function sweepStuckRaces(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const cutoff = new Date(Date.now() - 10 * 60_000);
  const stuck = await prisma.race.findMany({
    where: { status: 'racing', startedAt: { gt: cutoff } },
    include: { participants: true },
  });
  for (const race of stuck) {
    await prisma.race.update({
      where: { id: race.id },
      data: { status: 'canceled', endedAt: new Date() },
    });
    // No participants to mark DNF here — they either already have a finished
    // RaceParticipant row or they dropped without one. We don't synthesize new
    // rows because we lack their nickname state.
    console.log(`[race-server] swept stuck race ${race.code}`);
  }
}

void sweepStuckRaces().catch((e) => console.error('[race-server] startup sweep failed', e));

const httpServer = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, rooms: activeRoomCount() }));
    return;
  }
  res.writeHead(404);
  res.end();
});

export const io = new IOServer(httpServer, {
  cors: { origin: CORS_ORIGIN, credentials: false },
});

// Attach identity on connect
io.use(async (socket, next) => {
  try {
    const identity = await authenticateSocket(socket, RACE_SERVER_SECRET);
    (socket.data as { identity: SocketIdentity }).identity = identity;
    next();
  } catch (err) {
    next(err as Error);
  }
});

io.on('connection', (socket) => {
  registerHandlers(io, socket);
});

httpServer.listen(PORT, () => {
  console.log(`[race-server] listening on :${PORT} (cors=${CORS_ORIGIN})`);
});

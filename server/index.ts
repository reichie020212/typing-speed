// server/index.ts
import http from 'node:http';
import { Server as IOServer } from 'socket.io';
import { activeRoomCount } from './rooms';

const PORT = Number(process.env.PORT ?? 4000);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3000';

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

io.on('connection', (socket) => {
  // Real handlers wired in later tasks.
  socket.on('disconnect', () => {});
});

httpServer.listen(PORT, () => {
  console.log(`[race-server] listening on :${PORT} (cors=${CORS_ORIGIN})`);
});

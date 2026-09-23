// Minimal shared-pointer relay for the optional multi-user trails.
// Usage: npm run realtime  (then open the site with ?realtime=ws://localhost:8787)
import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT || 8787);
const MAX_ROOM = 24; // visitors per room; clients also cap visible remote trails
const MIN_INTERVAL = 40; // ms — drop messages faster than ~25 Hz per client

const wss = new WebSocketServer({ port: PORT, maxPayload: 256 });
const rooms = new Map(); // room -> Set<ws>

function roomFor() {
  for (const [id, set] of rooms) if (set.size < MAX_ROOM) return id;
  const id = randomUUID().slice(0, 8);
  rooms.set(id, new Set());
  return id;
}

function broadcast(room, data, except) {
  for (const client of rooms.get(room) ?? []) if (client !== except && client.readyState === 1) client.send(data);
}

wss.on('connection', (ws) => {
  ws.id = randomUUID().slice(0, 8);
  ws.room = roomFor();
  ws.last = 0;
  rooms.get(ws.room).add(ws);
  const count = () => broadcast(ws.room, JSON.stringify({ t: 'count', n: rooms.get(ws.room)?.size ?? 0 }));
  count();

  ws.on('message', (raw) => {
    const now = Date.now();
    if (now - ws.last < MIN_INTERVAL) return;
    ws.last = now;
    let m;
    try {
      m = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (m.t !== 'p' || typeof m.x !== 'number' || typeof m.y !== 'number') return;
    const x = Math.max(-1, Math.min(1, m.x)), y = Math.max(-1, Math.min(1, m.y));
    const v = Math.max(0, Math.min(20, Number(m.v) || 0));
    broadcast(ws.room, JSON.stringify({ t: 'p', id: ws.id, x, y, v }), ws);
  });

  ws.on('close', () => {
    const set = rooms.get(ws.room);
    set?.delete(ws);
    broadcast(ws.room, JSON.stringify({ t: 'leave', id: ws.id }));
    if (set && set.size === 0) rooms.delete(ws.room);
    else count();
  });

  // drop dead connections
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) ws.terminate();
    else {
      ws.isAlive = false;
      ws.ping();
    }
  }
}, 15000);

console.log(`realtime relay on ws://localhost:${PORT}`);

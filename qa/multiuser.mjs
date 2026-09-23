// Two clients through server/realtime.mjs: connect, see each other, interpolate, clean up on leave.
import { chromium } from 'playwright';
const BASE = process.env.RECREATION_URL || 'http://localhost:4173/';
const WS = process.env.REALTIME || 'ws://localhost:8787';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const open = async () => {
  const p = await (await b.newContext({ viewport: { width: 900, height: 600 } })).newPage();
  p.setDefaultTimeout(300000);
  await p.goto(`${BASE}?qa=1&tier=low&realtime=${encodeURIComponent(WS)}`);
  await p.waitForFunction(() => window.__state && __state.reveal >= 1);
  return p;
};
const a = await open(), c = await open();
await a.waitForTimeout(1000);
for (let i = 0; i < 30; i++) { const t = (i / 30) * Math.PI * 2; await a.mouse.move(450 + Math.cos(t) * 250, 300 + Math.sin(t) * 160); await a.waitForTimeout(40); }
await c.waitForTimeout(800);
const seen = await c.evaluate(() => ({ peers: __exp.multi.peers.size, remoteTrails: __exp.trails.remote.size, sample: [...__exp.multi.peers.values()].map((p) => ({ x: +p.x.toFixed(3), tx: +p.tx.toFixed(3) }))[0] }));
await a.close();
await c.waitForTimeout(2500);
const after = await c.evaluate(() => ({ peers: __exp.multi.peers.size, remoteTrails: __exp.trails.remote.size }));
console.log(JSON.stringify({ seen, afterDisconnect: after }));
await b.close();

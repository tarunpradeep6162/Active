// Work scroll determinism: SceneState must be f(scrollProgress).
// Reaches the same work progress forward, backward and after rapid jitter, lets the damped
// scroll + rig settle, and compares the camera with the pure path sample (and each other).
// Also reports the largest velocity-only offset seen while moving, which must decay to 0.
// Usage: RECREATION_URL=http://localhost:4173/ node qa/workreverse.mjs [w h]
import fs from 'node:fs';
import path from 'node:path';
import { openSite } from './browser.mjs';

const W = +process.argv[2] || 1440, H = +process.argv[3] || 900;
const { browser, page } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low' });
await page.waitForFunction(() => window.__state && __state.reveal >= 1, null, { timeout: 600000 });
const range = await page.evaluate(() => { const el = document.querySelector('.scroll-spacer [data-section="work"]'); return { start: el.offsetTop, len: el.offsetHeight }; });
const res = await page.evaluate((range) => {
  const s = __state.scroll, rig = __exp.rig, eng = __exp.scroll;
  // stop the realtime loop so only this harness advances the scroll + rig
  __exp.qaStep(0);
  const toPx = (p) => Math.round(range.start + p * range.len);
  const dt = 1 / 60;
  const step = (y, secs, track) => {
    const n = Math.round(secs / dt);
    let maxDev = 0;
    for (let i = 0; i < n; i++) {
      window.scrollTo(0, y);
      __state.time = 0; // freeze idle micro-motion so arrivals are comparable
      eng.update(dt); rig.update(dt);
      if (track) maxDev = Math.max(maxDev, rig.camera.position.distanceTo(rig.basePos));
    }
    return maxDev;
  };
  const glide = (from, to, secs) => { const n = Math.round(secs / dt); let m = 0; for (let i = 1; i <= n; i++) m = Math.max(m, step(from + (to - from) * (i / n), dt, true)); return m; };
  const read = () => ({ pos: rig.camera.position.toArray(), base: rig.basePos.toArray(), fov: rig.camera.fov, prog: s.progress, vel: s.velocity });
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const out = [];
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const p of [0, 0.1377, 0.25, 0.4346, 0.5, 0.6988, 0.85, 0.95]) {
    const y = toPx(p);
    // forward: from before work
    step(toPx(-0.1), 3, false);
    const fMove = glide(toPx(-0.1), y, 1.5); step(y, 3, false); const f = read();
    // backward: from after work
    step(toPx(1.0), 3, false);
    const bMove = glide(toPx(1.0), y, 1.5); step(y, 3, false); const b = read();
    // rapid jitter around, then land
    for (let i = 0; i < 25; i++) step(toPx(-0.1 + rnd() * 1.1), 0.08, false);
    step(y, 3, false); const j = read();
    out.push({ p, fwdVsPath: +d(f.pos, f.base).toFixed(4), backVsPath: +d(b.pos, b.base).toFixed(4), jitterVsPath: +d(j.pos, j.base).toFixed(4),
      fwdVsBack: +d(f.pos, b.pos).toFixed(4), fwdVsJitter: +d(f.pos, j.pos).toFixed(4), fovSpread: +Math.abs(f.fov - b.fov).toFixed(3),
      residualVel: [f.vel, b.vel, j.vel].map((v) => +v.toFixed(4)), maxMovingOffset: +Math.max(fMove, bMove).toFixed(3) });
  }
  return out;
}, range);
await browser.close();
const worst = Math.max(...res.flatMap((r) => [r.fwdVsBack, r.fwdVsJitter]));
const out = path.resolve('qa/out'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, `workreverse_${W}x${H}.json`), JSON.stringify({ worst, rows: res }, null, 1));
console.table(res.map(({ residualVel, ...r }) => r));
console.log('worst fwd/back/jitter spread (world units):', worst, worst < 0.005 ? 'PASS' : 'FAIL');

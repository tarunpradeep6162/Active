// Records the Work journey frame by frame (every 1 % of the work section, finer where asked).
// Usage: node qa/workmap.mjs <reference|ours> [width height mobile] [step=0.01]
// Output: qa/out/workmap_<site>_<w>x<h>/work-<site>-NNN.png + map.json
// For the reference it reads the rendered scene through its public renderer (no code is copied):
// camera world position/forward/FOV, the camera pivot, card world centres and the spine axis,
// all projected to screen pixels. For ours it reads the same quantities from our scene graph.
import fs from 'node:fs';
import path from 'node:path';
import { openSite } from './browser.mjs';

const site = process.argv[2] || 'reference';
const W = +process.argv[3] || 1440, H = +process.argv[4] || 900, mobile = process.argv[5] === 'mobile';
const step = +(process.env.STEP || 0.01);
const from = +(process.env.FROM ?? -0.02), to = +(process.env.TO ?? 1.02);
const isRef = site === 'reference';
const out = path.resolve(`qa/out/workmap_${site}_${W}x${H}${process.env.OUTTAG ? '_' + process.env.OUTTAG : ''}`);
fs.mkdirSync(out, { recursive: true });

const { browser, page, logs } = await openSite(isRef ? 'reference' : 'recreation', { width: W, height: H, mobile, query: isRef ? '' : 'qa=1&tier=' + (process.env.TIER || 'medium') });

// section range in scroll px, measured from each site's own spacer layout
const range = await page.evaluate((isRef) => {
  if (isRef) { const els = [...document.querySelectorAll('.FXScroll .scrollElement')]; return { start: els[2].offsetTop, len: els[2].offsetHeight }; }
  const el = document.querySelector('.scroll-spacer [data-section="work"]'); return { start: el.offsetTop, len: el.offsetHeight };
}, isRef);

if (isRef) {
  // capture the work scene + camera from the renderer once
  await page.evaluate(() => { const s = document.querySelector('.FXScroll'); s.scrollTo(0, 6200); });
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    const R = World.RENDERER; const orig = R.render; let found = null;
    R.render = function (scene, camera, ...rest) { if (!found && camera && camera.fov) { let n = 0; scene.traverse(() => n++); if (n > 40) found = { scene, camera }; } return orig.call(this, scene, camera, ...rest); };
    while (!found) await new Promise((r) => setTimeout(r, 500));
    // keep a rendered‑frame counter so "settled" means: several NEW frames with no camera motion
    window.__rf = 0;
    R.render = function (scene, camera, ...rest) { if (scene === window.__ws?.scene) window.__rf++; return orig.call(this, scene, camera, ...rest); };
    window.__ws = found;
  });
}

const measure = () => page.evaluate(({ isRef, W, H }) => {
  const toScreen = (m, pe, x, y, z) => {
    // world → clip with view (inverse world) and projection matrices (column‑major arrays)
    const v = [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
    const c = [pe[0] * v[0] + pe[4] * v[1] + pe[8] * v[2] + pe[12], pe[1] * v[0] + pe[5] * v[1] + pe[9] * v[2] + pe[13], pe[3] * v[0] + pe[7] * v[1] + pe[11] * v[2] + pe[15]];
    return { x: +(((c[0] / c[2]) * 0.5 + 0.5) * W).toFixed(1), y: +((1 - ((c[1] / c[2]) * 0.5 + 0.5)) * H).toFixed(1), depth: +(-v[2]).toFixed(2) };
  };
  let cam, cards = [], axis = [];
  if (isRef) {
    const { scene, camera } = window.__ws;
    scene.updateMatrixWorld?.(true);
    camera.updateMatrixWorld?.(true);
    const mw = camera.matrixWorld.elements;
    const inv = camera.matrixWorldInverse?.elements;
    const view = inv && inv.some((v) => v !== 0) ? inv : (() => { const t = camera.matrixWorld.clone ? camera.matrixWorld.clone().invert?.() || camera.matrixWorld.clone().getInverse(camera.matrixWorld) : null; return t.elements; })();
    cam = { pos: [mw[12], mw[13], mw[14]], fwd: [-mw[8], -mw[9], -mw[10]], fov: camera.fov };
    const pivot = camera._parent?._parent; if (pivot) cam.pivot = [pivot.position.x, pivot.position.y, pivot.position.z, pivot.rotation.y];
    scene.traverse((o) => {
      if (o.shader?.vsName === 'WorkItemShader' && o.visible && o._parent?.visible !== false) {
        const e = o.matrixWorld.elements; if (e[12] === 0 && e[13] === 0 && e[14] === 0) return;
        cards.push({ world: [e[12], e[13], e[14]].map((n) => +n.toFixed(2)), ...toScreen(view, camera.projectionMatrix.elements, e[12], e[13], e[14]),
          corners: [[-0.38, -0.38], [0.38, -0.38], [0.38, 0.38], [-0.38, 0.38]].map(([a, b]) => { const x = e[0] * a + e[4] * b + e[12], y = e[1] * a + e[5] * b + e[13], z = e[2] * a + e[6] * b + e[14]; const s = toScreen(view, camera.projectionMatrix.elements, x, y, z); return [s.x, s.y]; }) });
      }
    });
    for (let y = 8; y >= -18; y -= 1) axis.push({ wy: y, ...toScreen(view, camera.projectionMatrix.elements, 0, y, 0) });
  } else {
    // during the exit wipe the work view is the overlay camera (the main camera is on the lab)
    const c = __exp.rig.overlayEdge != null ? __exp.rig.overlayCamera : __exp.rig.camera; c.updateMatrixWorld(); const mw = c.matrixWorld.elements;
    cam = { pos: [mw[12], mw[13], mw[14]], fwd: [-mw[8], -mw[9], -mw[10]], fov: c.fov };
    const view = c.matrixWorldInverse.elements, pe = c.projectionMatrix.elements;
    for (const k of __exp.world.cards.cards) { const m = k.mesh; m.updateMatrixWorld(); const e = m.matrixWorld.elements;
      cards.push({ world: [e[12], e[13], e[14]].map((n) => +n.toFixed(2)), ...toScreen(view, pe, e[12], e[13], e[14]),
        corners: [[-1.52, -0.99], [1.52, -0.99], [1.52, 0.99], [-1.52, 0.99]].map(([a, b]) => { const x = e[0] * a + e[4] * b + e[12], y = e[1] * a + e[5] * b + e[13], z = e[2] * a + e[6] * b + e[14]; const s = toScreen(view, pe, x, y, z); return [s.x, s.y]; }) }); }
    const sg = __exp.world.garden.group; sg.updateMatrixWorld(); const se = sg.matrixWorld.elements;
    for (let y = __exp.world.garden.axisTop ?? -40; y >= (__exp.world.garden.axisBottom ?? -130); y -= 3) axis.push({ wy: y, ...toScreen(view, pe, se[12], y, se[14]) });
  }
  const onScreen = cards.filter((k) => k.depth > 0 && k.x > -W * 0.3 && k.x < W * 1.3 && k.y > -H * 0.3 && k.y < H * 1.3);
  const vis = axis.filter((a) => a.depth > 0 && a.y >= 0 && a.y <= H);
  const r = (v) => v.map((n) => +(+n).toFixed(3));
  return { cam: { pos: r(cam.pos), fwd: r(cam.fwd), fov: +cam.fov.toFixed(2), pivot: cam.pivot && r(cam.pivot) }, cards: onScreen, spineOnScreen: vis.length ? { xTop: vis[0].x, xBottom: vis[vis.length - 1].x, depthMid: vis[vis.length >> 1].depth, count: vis.length } : null };
}, { isRef, W, H });

const settle = async () => {
  // settled = at least 3 newly rendered frames since the last read AND < 0.002 units of motion
  let prev = null;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(isRef ? 700 : 250);
    const m = await page.evaluate((isRef) => { if (isRef) { const c = window.__ws.camera; c.updateMatrixWorld?.(true); const e = c.matrixWorld.elements; return [e[12], e[13], e[14], window.__rf]; } const p = __exp.rig.camera.position; return [p.x, p.y, p.z, __state.frame]; }, isRef);
    if (prev) {
      if (m[3] - prev[3] < 3) continue; // not enough new frames yet: keep the older sample as reference
      if (Math.hypot(m[0] - prev[0], m[1] - prev[1], m[2] - prev[2]) < 0.002) return i;
    }
    prev = m;
  }
  return -1;
};

const map = { site, viewport: [W, H], range, frames: [] };
let idx = 0;
for (let p = from; p <= to + 1e-9; p += step, idx++) {
  const px = Math.round(range.start + p * range.len);
  if (isRef) await page.evaluate((y) => document.querySelector('.FXScroll').scrollTo(0, y), px);
  else await page.evaluate((y) => { scrollTo(0, y); const s = __state.scroll; s.position = s.target = y; s.velocity = 0; __exp.scroll.update(0); __exp.rig.snap(); __exp.rig.update(0.016); }, px);
  const settledAfter = isRef ? await settle() : (await page.waitForTimeout(400), 0);
  const m = await measure();
  const name = `work-${site}-${String(Math.round(p * 1000)).padStart(4, '0')}`;
  await page.screenshot({ path: path.join(out, name + '.png') });
  map.frames.push({ p: +p.toFixed(4), px, settledAfter, cornerExtent: true, ...m });
  if (idx % 10 === 0) fs.writeFileSync(path.join(out, 'map.json'), JSON.stringify(map));
}

// step response: jump one card spacing forward and sample the camera over time
const t0px = Math.round(range.start + 0.3 * range.len);
if (isRef) await page.evaluate((y) => document.querySelector('.FXScroll').scrollTo(0, y), t0px); else await page.evaluate((y) => scrollTo(0, y), t0px);
await settle();
map.stepResponse = await page.evaluate(async ({ isRef, dy }) => {
  const read = () => { if (isRef) { const c = window.__ws.camera; c.updateMatrixWorld?.(true); const e = c.matrixWorld.elements; return [e[12], e[13], e[14]]; } const p = __exp.rig.camera.position; return [p.x, p.y, p.z]; };
  const samples = []; const t0 = performance.now();
  if (isRef) { const s = document.querySelector('.FXScroll'); s.scrollTo(0, s.scrollTop + dy); } else scrollTo(0, scrollY + dy);
  await new Promise((res) => { const f = () => { samples.push([+(performance.now() - t0).toFixed(0), ...read().map((v) => +v.toFixed(3))]); if (performance.now() - t0 < 6000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  return samples;
}, { isRef, dy: Math.round(range.len * 0.05) });
map.logs = logs.slice(0, 10);
fs.writeFileSync(path.join(out, 'map.json'), JSON.stringify(map, null, 1));
console.log('frames', map.frames.length, 'range', JSON.stringify(range));
await browser.close();

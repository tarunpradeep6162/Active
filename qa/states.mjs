// Semantic‑state capture for both sites: nav geometry, Work landing, project open
// timeline, detail, close, contact, end‑of‑scroll loop check.
// Usage: node qa/states.mjs <reference|ours> <width> <height> [mobile]
import fs from 'node:fs';
import path from 'node:path';
import { openSite, metrics } from './browser.mjs';

const site = process.argv[2];
const [W, H] = [+process.argv[3] || 1440, +process.argv[4] || 900];
const mobile = process.argv[5] === 'mobile';
const isRef = site === 'reference';
const out = path.resolve(`qa/out/states_${W}x${H}`);
fs.mkdirSync(out, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(out, `${site}_${name}.png`) });
const res = { site, viewport: [W, H] };

const { browser, page, logs } = await openSite(isRef ? 'reference' : 'recreation', { width: W, height: H, mobile, query: isRef ? '' : 'qa=1&tier=medium' });
const settle = async (ms = 2500) => {
  if (isRef) return page.waitForTimeout(ms);
  await page.waitForFunction(() => __state.transition.phase === 'IDLE' && !__exp.transition.busy, null, { timeout: 600000 });
  await page.evaluate(() => { const s = __state.scroll; s.position = s.target = scrollY; s.velocity = 0; __exp.rig.snap(); });
  await page.waitForTimeout(1200);
};

// 1 · nav pill geometry from pixels: the pill's top/bottom borders are the rows with the
// longest run of light pixels in the top‑right corner; the caps add one pill height.
await shot(page, 'home');
const CX = Math.max(0, W - 460), CW = W - CX;
const png = await page.screenshot({ clip: { x: CX, y: 0, width: CW, height: 140 } });
res.navPixels = await page.evaluate(async ({ b64, ox }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const L = (px, py) => { const i = (py * c.width + px) * 4; return d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; };
  const rows = [];
  for (let y = 0; y < c.height; y++) {
    let run = 0, best = 0, end = 0;
    for (let xx = 0; xx < c.width; xx++) { if (L(xx, y) > 55) { run++; if (run > best) { best = run; end = xx; } } else run = 0; }
    rows.push({ y, best, start: end - best + 1, end });
  }
  const lines = rows.filter((r) => r.best > 110 && r.best < 360);
  if (lines.length < 2) return null;
  const top = lines[0], bot = lines[lines.length - 1];
  const h = bot.y - top.y + 1;
  return { top: top.y, bottom: bot.y, height: h, left: top.start - Math.round(h / 2) + ox, right: top.end + Math.round(h / 2) + ox, width: top.best + h, straightTop: top.best };
}, { b64: png.toString('base64'), ox: CX });
if (!isRef) res.navDom = await page.evaluate(() => document.querySelector('.nav').getBoundingClientRect().toJSON());

// 2 · Work landing via the nav
const workXY = res.navPixels ? [res.navPixels.left + 45, (res.navPixels.top + res.navPixels.bottom) / 2] : [W - 190, 63];
if (isRef) await page.mouse.click(workXY[0], workXY[1]);
else await page.evaluate(() => document.querySelector('.nav__link[aria-label="WORK"]').click());
await settle(5000);
res.workLanding = { ...(await metrics(isRef ? 'reference' : 'recreation', page)), url: page.url() };
res.workLanding.progress = +(res.workLanding.scrollTop / res.workLanding.max).toFixed(4);
await shot(page, 'work_entry');

// 3 · open the framed card (click the biggest card area near centre-left)
const t0 = Date.now();
const openAt = [Math.round(W * 0.38), Math.round(H * 0.42)];
let opened = false;
if (isRef) { await page.mouse.move(openAt[0], openAt[1], { steps: 4 }); await page.waitForTimeout(800); await page.mouse.click(openAt[0], openAt[1]); opened = true; }
else {
  for (const [fx, fy] of [[0.38, 0.42], [0.3, 0.35], [0.6, 0.45], [0.7, 0.4], [0.25, 0.5]]) {
    await page.mouse.move(W * fx, H * fy, { steps: 3 }); await page.waitForTimeout(700);
    if (await page.evaluate(() => __exp.world.hovered)) { await page.evaluate(() => __exp.qaStep(0)); await page.mouse.click(W * fx, H * fy); opened = true; break; }
  }
}
res.projectOpen = { opened, frames: [], clock: isRef ? 'wall (software renderer: frames land late)' : 'simulated (exact)' };
if (!isRef) {
  // ours: the click was dispatched while paused → step simulated time exactly
  let t = 0;
  for (const ms of [0, 100, 200, 300, 500, 750, 1000, 1500]) {
    await page.evaluate((d) => __exp.qaStep(d), ms - t);
    t = ms;
    await shot(page, `open_${String(ms).padStart(4, '0')}`);
    res.projectOpen.frames.push({ target: ms, actual: ms, focus: await page.evaluate(() => __state.focus), phase: await page.evaluate(() => __state.transition.phase) });
  }
  await page.evaluate(() => __exp.qaResume());
} else {
  for (const ms of [0, 100, 200, 300, 500, 750, 1000, 1500]) {
    const wait = t0 + ms - Date.now();
    if (wait > 0) await page.waitForTimeout(wait);
    await shot(page, `open_${String(ms).padStart(4, '0')}`);
    res.projectOpen.frames.push({ target: ms, actual: Date.now() - t0 });
  }
}
await settle(3000);
res.projectOpen.url = page.url();
await shot(page, 'project_detail');

// 4 · close with Escape (ours) / the CLOSE control (reference: Escape is tried first)
await page.keyboard.press('Escape');
await settle(3000);
res.afterClose = page.url();
await shot(page, 'project_close');

// 5 · contact
if (isRef) await page.mouse.click(res.navPixels ? res.navPixels.right - 55 : W - 90, workXY[1]);
else await page.evaluate(() => document.querySelector('.nav__link[aria-label="CONTACT"]').click());
await settle(3000);
res.contactUrl = page.url();
await shot(page, 'contact');
await page.goBack();
await settle(3000);
res.backFromContact = page.url();

// 6 · end of scroll: does it loop?
const m = await metrics(isRef ? 'reference' : 'recreation', page);
if (isRef) await page.evaluate(() => { const s = document.querySelector('.FXScroll'); s.scrollTo(0, s.scrollHeight); });
else await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(2500);
await page.mouse.move(W / 2, H / 2);
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(150); }
await page.waitForTimeout(2500);
res.endOfScroll = { max: m.max, afterWheel: (await metrics(isRef ? 'reference' : 'recreation', page)).scrollTop };
await shot(page, 'end');
res.logs = logs.slice(0, 20);
fs.writeFileSync(path.join(out, `${site}.json`), JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 1));
await browser.close();

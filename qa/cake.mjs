// QA: the lab cage — locked, mid‑unlock, open. Usage: RECREATION_URL=… node qa/cake.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/cake', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=medium' });
// the microphone must never be requested unless she taps "use the microphone"
await page.evaluate(() => { const g = navigator.mediaDevices?.getUserMedia; if (g) navigator.mediaDevices.getUserMedia = (...a) => { window.__micAsked = true; return g.apply(navigator.mediaDevices, a); }; });
await page.evaluate(() => {
  const el = document.querySelector('.scroll-spacer [data-section="lab"]');
  const y = Math.round(el.offsetTop + 0.6 * el.offsetHeight);
  scrollTo(0, y); const s = __state.scroll; s.position = s.target = y; s.velocity = 0; __exp.scroll.update(0); __exp.rig.snap();
});
await page.waitForTimeout(4000);
await page.screenshot({ path: `qa/out/cake/${W}-0-locked.png` });
// tap the cake through the real click path (centre of the frame, lower half)
await page.mouse.click(W * 0.5, H * 0.62);
await page.waitForTimeout(800);
console.log('tap opened the cage:', await page.evaluate(() => __exp.world.lab.isOpen));
// software GL runs the animation clock slowly (dt is capped per frame), so pin the unlock clock
// to each moment of the sequence instead of waiting in wall time
for (const [sec, name] of [[0.4, '1-lock'], [1.6, '2-bars'], [2.8, '3-rise'], [8, '4-open']]) {
  await page.evaluate((sec) => { const lab = __exp.world.lab; lab.opened = true; lab.openedAt = __state.time - sec; }, sec);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `qa/out/cake/${W}-${name}.png` });
}
// the candles: the label must offer "Hold to blow"; hold it, then pin the blow‑out clock
await page.waitForSelector('.lab-label__blow', { timeout: 60000 });
await page.screenshot({ path: `qa/out/cake/${W}-5-candles.png` });
const b = await page.locator('.lab-label__blow').boundingBox();
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
await page.mouse.down();
await page.waitForTimeout(900);
await page.screenshot({ path: `qa/out/cake/${W}-6-blowing.png` });
const at = [b.x + b.width / 2, b.y + b.height / 2];
console.log('during hold', await page.evaluate((at) => JSON.stringify({ blow: __state.cakeBlow, ready: __state.cakeReady, open: __state.cageOpen, stage: document.querySelector('.lab-label').dataset.stage, hit: ((e) => e && e.parentElement.outerHTML.slice(0, 200))(document.elementFromPoint(...at)), at, vis: getComputedStyle(document.querySelector('.lab-label')).opacity }), at));
await page.waitForFunction(() => document.querySelector('.lab-label')?.dataset.stage === 'wished', null, { timeout: 60000 });
await page.mouse.up();
console.log('mic requested without a tap:', await page.evaluate(() => !!window.__micAsked));
for (const [sec, name] of [[1, '7-dark'], [3.2, '8-burst'], [6, '9-after']]) {
  await page.evaluate((sec) => { __exp.world.lab.blownAt = __state.time - sec; }, sec);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `qa/out/cake/${W}-${name}.png` });
}
console.log('opened:', await page.evaluate(() => __exp.world.lab.isOpen), 'console errors:', logs.filter((l) => /error/i.test(l)).length);
await browser.close();

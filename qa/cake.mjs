// QA: the lab cage — locked, mid‑unlock, open. Usage: RECREATION_URL=… node qa/cake.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/cake', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=medium' });
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
console.log('opened:', await page.evaluate(() => __exp.world.lab.isOpen), 'console errors:', logs.filter((l) => /error/i.test(l)).length);
await browser.close();

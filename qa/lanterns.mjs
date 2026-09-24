// QA: the lantern sky — frame it, tap a wish lantern through the real click path, see its words,
// then pin the release clock to watch it become a star. Usage: RECREATION_URL=… node qa/lanterns.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/lanterns', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=medium' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.evaluate(() => localStorage.removeItem('bday-lanterns-v1'));
await page.evaluate(() => {
  const el = document.querySelector('.scroll-spacer [data-section="portal"]');
  const y = Math.round(el.offsetTop + 0.5 * el.offsetHeight);
  scrollTo(0, y); const s = __state.scroll; s.position = s.target = y; s.velocity = 0; __exp.scroll.update(0); __exp.rig.snap();
});
await page.waitForTimeout(4000);
await page.screenshot({ path: `qa/out/lanterns/${W}-1-sky.png` });
// find a wish lantern on screen and tap it
const at = await page.evaluate(() => {
  const cam = __exp.rig.camera; const v = new cam.position.constructor();
  for (let i = 0; i < 12; i++) {
    __exp.world.portal.wishPosition(i, v).project(cam);
    const x = (v.x * 0.5 + 0.5) * innerWidth, y = (-v.y * 0.5 + 0.5) * innerHeight;
    if (x > 60 && x < innerWidth - 60 && y > 120 && y < innerHeight * 0.6) return [x, y, i];
  }
  return null;
});
console.log('lantern on screen:', at);
await page.mouse.click(at[0], at[1]);
await page.waitForTimeout(1200);
const words = await page.evaluate(() => document.querySelector('.sky-wish')?.textContent ?? null);
console.log('wish words shown:', words);
await page.screenshot({ path: `qa/out/lanterns/${W}-2-wish.png` });
await page.evaluate((i) => { const p = __exp.world.portal; p.released[i] = __state.time - 3.5; }, at[2]);
await page.waitForTimeout(1500);
await page.screenshot({ path: `qa/out/lanterns/${W}-3-rising.png` });
await page.evaluate((i) => { const p = __exp.world.portal; if (!Number.isNaN(p.released[i])) p.released[i] = __state.time - 7; }, at[2]);
// the button path lets the next one go too
await page.click('.sky-label .lab-label__open');
await page.waitForTimeout(2500);
await page.screenshot({ path: `qa/out/lanterns/${W}-4-star.png` });
console.log(JSON.stringify({ starsLit: await page.evaluate(() => __state.starsLit), saved: await page.evaluate(() => localStorage.getItem('bday-lanterns-v1')), errors: logs.filter((l) => /error|INVALID/i.test(l)).slice(0, 5) }));
await browser.close();

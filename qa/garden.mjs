// QA: frames through the tulip garden at chosen work progress values.
// Usage: RECREATION_URL=… node qa/garden.mjs [w h] [p1,p2,…]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
const ps = (process.argv[4] || '-0.05,0,0.1,0.3,0.5,0.7,0.85,0.94').split(',').map(Number);
fs.mkdirSync('qa/out/garden', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=medium' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
const files = [];
for (const p of ps) {
  await page.evaluate((p) => {
    const el = document.querySelector('.scroll-spacer [data-section="work"]');
    const y = Math.round(el.offsetTop + p * el.offsetHeight);
    scrollTo(0, y); const s = __state.scroll; s.position = s.target = y; s.velocity = 0; __exp.scroll.update(0); __exp.rig.snap(); __exp.rig.update(0.016);
  }, p);
  await page.waitForTimeout(3500);
  const f = `qa/out/garden/${W}-${String(Math.round(p * 1000)).padStart(4, '0')}.png`;
  await page.screenshot({ path: f });
  files.push(f);
}
console.log(files.join(' '));
console.log('errors ' + logs.filter((l) => /error|INVALID/i.test(l)).length);
await browser.close();

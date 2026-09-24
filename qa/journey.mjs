// QA: frames of one journey section at chosen progress values.
// Usage: RECREATION_URL=… node qa/journey.mjs <section> [w h] [l1,l2,…]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const sec = process.argv[2] || 'intro';
const W = +process.argv[3] || 1280, H = +process.argv[4] || 800;
const ls = (process.argv[5] || '0,0.25,0.5,0.75,0.95').split(',').map(Number);
fs.mkdirSync('qa/out/journey', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=medium' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
for (const l of ls) {
  await page.evaluate(([sec, l]) => {
    const el = document.querySelector(`.scroll-spacer [data-section="${sec}"]`);
    const y = Math.min(document.documentElement.scrollHeight - innerHeight, Math.round(el.offsetTop + l * el.offsetHeight));
    scrollTo(0, y); const s = __state.scroll; s.position = s.target = y; s.velocity = 0; __exp.scroll.update(0); __exp.rig.snap();
  }, [sec, l]);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `qa/out/journey/${sec}-${W}-${String(Math.round(l * 100)).padStart(3, '0')}.png` });
}
console.log(JSON.stringify({ sec, W, errors: logs.filter((l) => /error/i.test(l)).slice(0, 5) }));
await browser.close();

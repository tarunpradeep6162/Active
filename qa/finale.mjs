// QA: the finale sky — stars → 25 · 11 → her name → HAPPY BIRTHDAY, fireworks, sunrise, final
// words, ONE LAST THING. Usage: RECREATION_URL=… node qa/finale.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/finale', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=medium' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
const go = async (l) => {
  await page.evaluate((l) => {
    const el = document.querySelector('.scroll-spacer [data-section="outro"]');
    const y = Math.min(document.documentElement.scrollHeight - innerHeight, Math.round(el.offsetTop + l * el.offsetHeight));
    scrollTo(0, y); const s = __state.scroll; s.position = s.target = y; s.velocity = 0; __exp.scroll.update(0); __exp.rig.snap();
  }, l);
  await page.waitForTimeout(3000);
};
for (const [l, name] of [[0.1, '1-stars'], [0.4, '2-date'], [0.64, '3-name'], [0.82, '4-happy']]) {
  await go(l);
  await page.screenshot({ path: `qa/out/finale/${W}-${name}.png` });
}
await go(0.99);
await page.waitForSelector('.finale-sky__last', { timeout: 120000 });
await page.screenshot({ path: `qa/out/finale/${W}-5-words.png` });
const words = await page.evaluate(() => [...document.querySelectorAll('.finale-sky__words p')].map((p) => p.textContent));
await page.click('.finale-sky__last');
await page.waitForSelector('.lastthing', { timeout: 10000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `qa/out/finale/${W}-6-lastthing.png` });
console.log(JSON.stringify({ words, happy: await page.evaluate(() => getComputedStyle(document.querySelector('.finale-sky__happy')).opacity), errors: logs.filter((l) => /error|INVALID/i.test(l)).slice(0, 5) }));
await browser.close();

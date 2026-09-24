// QA: chapter 2 — polaroids in orbit; a real click on one opens it; close glides back.
// Usage: RECREATION_URL=… node qa/memories.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/memories', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.evaluate(() => { history.pushState({}, '', '/garden/memory-universe'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForFunction(() => document.querySelector('.bd-chapter.is-open .bd-chapter__title')?.textContent === 'Memory Universe', null, { timeout: 240000 });
await page.waitForSelector('.bd-orbit__hint', { timeout: 60000 });
await page.waitForTimeout(4000);
await page.screenshot({ path: `qa/out/memories/${W}-1-orbit.png` });
// try a grid of real clicks until a polaroid opens
let opened = false;
for (const [fx, fy] of [[0.5, 0.45], [0.3, 0.5], [0.7, 0.5], [0.2, 0.4], [0.8, 0.4], [0.4, 0.6], [0.6, 0.6], [0.5, 0.35]]) {
  await page.mouse.click(W * fx, H * fy);
  await page.waitForTimeout(700);
  if (await page.locator('.bd-lightbox').count()) { opened = true; break; }
}
await page.waitForTimeout(1800);
await page.screenshot({ path: `qa/out/memories/${W}-2-open.png` });
if (opened) await page.click('.bd-lightbox .bd-btn');
await page.waitForTimeout(1500);
console.log(JSON.stringify({ openedByClick: opened, errors: logs.filter((l) => /error|INVALID/i.test(l)).slice(0, 5) }));
await browser.close();

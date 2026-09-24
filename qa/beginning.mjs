// QA: chapter 1 — the star, first touch, the burst into a galaxy, the date in stars, the line.
// Usage: RECREATION_URL=… node qa/beginning.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/beginning', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.evaluate(() => { history.pushState({}, '', '/garden/the-beginning'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForFunction(() => document.querySelector('.bd-chapter.is-open .bd-chapter__title')?.textContent === '25 · 11', null, { timeout: 240000 });
await page.waitForSelector('.bd-beginning[data-live="true"]', { timeout: 60000 });
await page.waitForTimeout(3000);
const shot = (n) => page.screenshot({ path: `qa/out/beginning/${W}-${n}.png` });
await shot('1-star');
await page.click('.bd-star');
await page.waitForTimeout(1600);
await shot('2-ignite');
await page.click('.bd-star');
await page.waitForTimeout(1200);
await shot('3-burst');
await page.waitForTimeout(1800);
await shot('4-galaxy');
await page.waitForFunction(() => (document.querySelector('.bd-line')?.textContent || '').length > 40, null, { timeout: 60000 });
await page.waitForTimeout(1500);
await shot('5-date');
console.log(JSON.stringify({ line: await page.evaluate(() => document.querySelector('.bd-line')?.textContent), errors: logs.filter((l) => /error|INVALID/i.test(l)).slice(0, 5) }));
await browser.close();

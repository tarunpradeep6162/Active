// QA: chapter 4 — the reason stars, threads as she finds them, her name in stars at the end.
// Usage: RECREATION_URL=… node qa/reasons.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/reasons', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.evaluate(() => { history.pushState({}, '', '/garden/fourteen-things'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForFunction(() => document.querySelector('.bd-chapter.is-open .bd-chapter__title')?.textContent === '14 Things', null, { timeout: 240000 });
await page.waitForSelector('.bd-reasons[data-live="true"]', { timeout: 60000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `qa/out/reasons/${W}-1-sky.png` });
const stars = page.locator('.bd-reason-star');
const n = await stars.count();
for (let k = 0; k < 5; k++) { await stars.nth(k).click(); await page.waitForTimeout(400); }
await page.waitForTimeout(1200);
await page.screenshot({ path: `qa/out/reasons/${W}-2-threads.png` });
for (let k = 5; k < n; k++) { await stars.nth(k).click(); await page.waitForTimeout(150); }
await page.waitForTimeout(4500);
await page.screenshot({ path: `qa/out/reasons/${W}-3-name.png` });
await page.locator('.bd-reasons__name button').first().click();
await page.waitForTimeout(600);
console.log(JSON.stringify({ stars: n, text: await page.evaluate(() => document.querySelector('.bd-reasons__text')?.textContent), errors: logs.filter((l) => /error|INVALID/i.test(l)).slice(0, 5) }));
await browser.close();

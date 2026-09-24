// QA: chapter 3 — the sealed envelope, the seal breaking, the letter rising, the paper.
// Usage: RECREATION_URL=… node qa/letter.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/letter', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.evaluate(() => { history.pushState({}, '', '/garden/the-letter'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForFunction(() => document.querySelector('.bd-chapter.is-open .bd-chapter__title')?.textContent === 'The Letter', null, { timeout: 240000 });
await page.waitForSelector('.bd-letter[data-live="true"]', { timeout: 60000 });
await page.waitForTimeout(3500);
await page.screenshot({ path: `qa/out/letter/${W}-1-sealed.png` });
// a real click on the envelope itself (centre of the scene)
await page.mouse.click(W / 2, H * 0.5);
await page.waitForTimeout(1300);
await page.screenshot({ path: `qa/out/letter/${W}-2-seal.png` });
await page.waitForTimeout(1500);
await page.screenshot({ path: `qa/out/letter/${W}-3-rising.png` });
await page.waitForSelector('.bd-paper', { timeout: 60000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `qa/out/letter/${W}-4-paper.png` });
console.log(JSON.stringify({ paper: await page.locator('.bd-paper').count(), errors: logs.filter((l) => /error|INVALID/i.test(l)).slice(0, 5) }));
await browser.close();

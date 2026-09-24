// QA: a chapter unfolding out of its tulip, the petal game, the staged finale text.
// Usage: RECREATION_URL=… node qa/unfold.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/unfold', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=medium' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
const go = async (slug) => page.evaluate((s) => { history.pushState({}, '', `/work/${s}`); dispatchEvent(new PopStateEvent('popstate')); }, slug);
await go('the-letter');
await page.waitForSelector('.bd-chapter.is-open', { timeout: 240000 });
await page.waitForTimeout(700);
await page.screenshot({ path: `qa/out/unfold/${W}-1-unfolding.png` });
await page.waitForTimeout(2000);
await page.screenshot({ path: `qa/out/unfold/${W}-2-letter.png` });
await go('catch-my-heart');
await page.waitForFunction(() => document.querySelector('.bd-chapter__title')?.textContent === 'Catch My Heart', null, { timeout: 240000 });
await page.waitForTimeout(1800);
await page.click('.bd-game__overlay .bd-btn');
await page.waitForTimeout(6000);
await page.screenshot({ path: `qa/out/unfold/${W}-3-game.png` });
console.log('errors', logs.filter((l) => /error|INVALID/i.test(l)).length);
await browser.close();

// QA: Choose a Gift — the 3D stage, hover, a real click on a box, the opening, the card.
// Usage: RECREATION_URL=… node qa/gift.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/gift', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.evaluate(() => localStorage.setItem('bday-progress-v1', JSON.stringify({ done: ['gift-boxes'], hearts: [], gift: 1, thisOrThat: {} })));
await page.evaluate(() => { history.pushState({}, '', '/garden/gift-boxes'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForFunction(() => document.querySelector('.bd-chapter.is-open .bd-chapter__title')?.textContent === 'Choose a Gift', null, { timeout: 240000 });
await page.waitForTimeout(6000);
await page.screenshot({ path: `qa/out/gift/${W}-1-boxes.png` });
const autoOpened = await page.evaluate(() => !!document.querySelector('.bd-giftcard') || document.querySelector('.bd-gifts__hint')?.textContent !== 'Three boxes. You may open only one.');
const r = await page.locator('.bd-giftstage__canvas').boundingBox();
// the first box sits left of centre on wide screens
const x = r.x + r.width * (W < 600 ? 0.2 : 0.33), y = r.y + r.height * (W < 600 ? 0.52 : 0.62);
await page.mouse.move(x, y);
await page.waitForTimeout(1500);
await page.screenshot({ path: `qa/out/gift/${W}-2-hover.png` });
console.log('stage', JSON.stringify(r), 'tap at', Math.round(x), Math.round(y));
if (W < 600) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
await page.waitForTimeout(2200);
await page.screenshot({ path: `qa/out/gift/${W}-3-opening.png` });
const ok = await page.waitForSelector('.bd-giftcard', { timeout: 120000 }).then(() => true, () => false);
await page.waitForTimeout(2500);
await page.screenshot({ path: `qa/out/gift/${W}-4-card.png` });
const text = await page.evaluate(() => document.querySelector('.bd-giftcard__text')?.textContent ?? null);
await page.click('.bd-giftcard__again');
await page.waitForTimeout(2500);
const closedAgain = await page.evaluate(() => !document.querySelector('.bd-giftcard') && document.querySelector('.bd-gifts__hint')?.textContent === 'Three boxes. You may open only one.');
console.log(JSON.stringify({ autoOpened, closedAgain, card: ok, text, errors: logs.filter((l) => /error|INVALID/i.test(l)).slice(0, 5) }));
await browser.close();

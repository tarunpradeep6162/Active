import { openSite } from './browser.mjs';
const { browser, page } = await openSite('recreation', { width: 1280, height: 800, query: 'qa=1&tier=low' });
await page.evaluate(() => { history.pushState({}, '', `/garden/little-movie`); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForSelector('.bd-chapter.is-open', { timeout: 240000 });
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => ['.bd-movie__screen', '.bd-movie', '.bd-chapter__stage', '.bd-cosmos canvas'].map((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return s + ' ' + (r ? [r.left, r.top, r.width, r.height].map(Math.round).join(',') : '-'); })));
await browser.close();

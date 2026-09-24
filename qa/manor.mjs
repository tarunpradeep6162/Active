// QA: the manor in the Future Universe chapter. Usage: RECREATION_URL=… node qa/manor.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/manor', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
page.on('response', (r) => r.status() >= 400 && logs.push(`http ${r.status()} ${r.url()}`));
await page.evaluate(() => { history.pushState({}, '', '/garden/future-universe'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForFunction(() => document.querySelector('.bd-chapter.is-open .bd-chapter__title')?.textContent === 'Future Universe', null, { timeout: 240000 });
await page.waitForSelector('.bd-manorbg', { timeout: 30000 });
await page.waitForTimeout(+process.env.MANOR_WAIT || 25000);
await page.screenshot({ path: `qa/out/manor/${W}-chapter.png` });
await page.waitForSelector('.bd-manorbg.is-live', { timeout: 120000 }).catch(() => logs.push('manor never went live'));
console.log(JSON.stringify({ errors: logs.filter((l) => /error|INVALID/i.test(l)).slice(0, 6), http: logs.filter((l) => l.startsWith('http ')).slice(0, 8) }));
await browser.close();

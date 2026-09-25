// QA: the loader, then the For you page (desktop or phone).
// Usage: RECREATION_URL=… node qa/foryou.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/foryou', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low', wait: false });
await page.waitForTimeout(600);
await page.screenshot({ path: `qa/out/foryou/${W}-1-loader.png` });
await page.waitForFunction(() => window.__state && __state.reveal >= 1, null, { timeout: 600000 });
await page.evaluate(() => [...document.querySelectorAll('.nav__link')].find((a) => /FOR YOU/.test(a.getAttribute('aria-label')))?.click());
await page.waitForSelector('.foryou.is-open', { timeout: 60000 });
await page.waitForFunction(() => __state.overlay >= 0.999, null, { timeout: 120000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `qa/out/foryou/${W}-2-foryou.png` });
console.log(JSON.stringify({ W, errors: logs.filter((l) => /error/i.test(l)).slice(0, 5) }));
await browser.close();

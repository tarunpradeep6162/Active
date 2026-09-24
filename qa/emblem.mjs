// QA: the intro emblem (heart + D) at the top of the page. Usage: RECREATION_URL=… node qa/emblem.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 390, H = +process.argv[3] || 844;
fs.mkdirSync('qa/out/emblem', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=medium' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.waitForTimeout(6000);
await page.screenshot({ path: `qa/out/emblem/${W}-intro.png` });
console.log('errors', logs.filter((l) => /error|INVALID/i.test(l)).length);
await browser.close();

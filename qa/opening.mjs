// QA: the loader bud, the opening under the stars, the threshold and the 404, at one viewport.
// Usage: RECREATION_URL=… node qa/opening.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/opening', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low', wait: false });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.waitForTimeout(400);
await page.screenshot({ path: `qa/out/opening/${W}x${H}-loader.png` });
await page.waitForFunction(() => window.__state && __state.reveal >= 1, null, { timeout: 600000 });
await page.waitForTimeout(6500);
await page.screenshot({ path: `qa/out/opening/${W}x${H}-opening.png` });
const title = await page.title();
const text = await page.evaluate(() => document.body.innerText);
await page.click('.opening__enter', { force: true });
await page.waitForFunction(() => __state.section === 'manifesto', null, { timeout: 120000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `qa/out/opening/${W}x${H}-threshold.png` });
const banned = /meridian|studio|osl\b|hello@|contact us|our work|featured work/i;
const all = text + (await page.evaluate(() => document.body.innerText));
console.log(JSON.stringify({ title, remnants: all.match(banned)?.[0] ?? null, errors: logs.filter((l) => /error/i.test(l)).slice(0, 5) }, null, 1));
await browser.close();

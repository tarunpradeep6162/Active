// QA: the garden's two big moments — the wish's light climbing the plant, and the finale's
// pull‑back reveal of the whole garden. Usage: RECREATION_URL=… node qa/moments.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/moments', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=medium' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
const go = async (slug, title) => {
  await page.evaluate((s) => { history.pushState({}, '', `/work/${s}`); dispatchEvent(new PopStateEvent('popstate')); }, slug);
  await page.waitForFunction((t) => document.querySelector('.bd-chapter.is-open .bd-chapter__title')?.textContent === t, title, { timeout: 240000 });
  await page.waitForTimeout(1500);
};
// 1 · the wish
if (!fs.existsSync(`qa/out/moments/${W}-wish.png`) || process.env.WISH) {
await go('make-a-wish', 'Make a Wish');
const b = await page.locator('.bd-wish .bd-btn').boundingBox();
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(2600); await page.mouse.up();
await page.waitForSelector('.bd-wish[data-stage="out"]', { timeout: 30000 });
await page.waitForFunction(() => __state.veilThin > 0.8, null, { timeout: 120000 });
await page.screenshot({ path: `qa/out/moments/${W}-wish.png` });
}
// 2 · the finale (other chapters marked done so Door 25 opens)
await page.evaluate(() => {
  const all = [...document.querySelectorAll('.work-panel .sr-only a')].map((a) => a.getAttribute('href').split('/').pop());
  localStorage.setItem('bday-progress-v1', JSON.stringify({ done: all.filter((s) => s !== 'for-dheepika'), hearts: [], gift: null, thisOrThat: {} }));
});
// reload straight into the finale, keeping the QA flags (pushState navigation drops the query)
await page.goto(new URL('work/for-dheepika?qa=1&tier=medium', process.env.RECREATION_URL).href);
await page.waitForFunction(() => window.__state && __state.reveal >= 1, null, { timeout: 600000 });
await page.waitForFunction(() => document.querySelector('.bd-chapter.is-open .bd-chapter__title')?.textContent === 'For Dheepika', null, { timeout: 240000 });
await page.waitForTimeout(1500);
await page.click('.bd-finale .bd-btn');
await page.waitForSelector('.bd-finale__end', { timeout: 90000 });
await page.screenshot({ path: `qa/out/moments/${W}-finale-name.png` });
// wait for the sequence to trigger the reveal, then jump the (slow, software‑GL) ease to its end
await page.waitForFunction(() => __state.veilThin > 0.05, null, { timeout: 120000 });
await page.evaluate(() => { __exp.world.gardenReveal = 0.999; });
await page.waitForTimeout(5000);
await page.screenshot({ path: `qa/out/moments/${W}-finale-reveal.png` });
const errors = logs.filter((l) => /error|INVALID/i.test(l));
console.log('errors', errors.length, errors.slice(0, 5).join('\n'));
await browser.close();

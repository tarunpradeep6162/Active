// QA (local only): unlock a test vault and capture the letter and the timeline.
// Usage: RECREATION_URL=http://localhost:4174/ node qa/privatepeek.mjs "<pass>" [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const [pass, w, h] = process.argv.slice(2);
const W = +w || 1280, H = +h || 800;
fs.mkdirSync('qa/out/private', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.emulateMedia({ reducedMotion: 'reduce' });
const open = async (slug, title) => {
  await page.evaluate((s) => { history.pushState({}, '', `/garden/${s}`); dispatchEvent(new PopStateEvent('popstate')); }, slug);
  await page.waitForFunction((t) => document.querySelector('.bd-chapter.is-open .bd-chapter__title')?.textContent === t, title, { timeout: 240000 });
  await page.waitForTimeout(1800);
};
await open('the-letter', 'The Letter');
if (await page.locator('#bd-pass').count()) {
  await page.fill('#bd-pass', pass);
  await page.click('.bd-gate button[type=submit]');
  await page.waitForFunction(() => !document.querySelector('.bd-gate'), null, { timeout: 120000 });
}
await page.click('.bd-envelope', { force: true });
await page.waitForTimeout(6000);
await page.screenshot({ path: `qa/out/private/${W}-letter.png` });
const letter = await page.evaluate(() => document.querySelector('.bd-paper')?.innerText.length ?? 0);
await open('our-timeline', 'Our Timeline');
await page.screenshot({ path: `qa/out/private/${W}-timeline-1.png` });
for (let i = 0; i < 7; i++) await page.click('.bd-timeline .bd-btn:has-text("Forward")');
await page.waitForTimeout(800);
await page.screenshot({ path: `qa/out/private/${W}-timeline-8.png` });
await page.click('.bd-timeline .bd-btn:has-text("Forward")');
await page.waitForTimeout(800);
await page.screenshot({ path: `qa/out/private/${W}-timeline-end.png` });
console.log(JSON.stringify({ letterChars: letter, stops: await page.locator('.bd-timeline__track li').count(), errors: logs.filter((l) => /error/i.test(l)).slice(0, 5) }));
await browser.close();

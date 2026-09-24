// QA: each chapter with a mood sky opens with its sky live and no errors; one screenshot each.
// Usage: RECREATION_URL=… node qa/moods.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/moods', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
const out = [];
for (const slug of ['catch-my-heart', 'know-us', 'our-secret', 'music-room', 'our-timeline', 'make-a-wish', 'little-movie', 'for-dheepika']) {
  await page.evaluate((s) => { history.pushState({}, '', `/garden/${s}`); dispatchEvent(new PopStateEvent('popstate')); }, slug);
  await page.waitForFunction((s) => location.pathname.endsWith(s) && document.querySelector('.bd-chapter.is-open .bd-moodsky canvas') && document.querySelector('.bd-chapter.is-open')?.getAttribute('aria-label')?.length, slug, { timeout: 240000 });
  await page.waitForTimeout(2500);
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `qa/out/moods/${W}-${slug}.png` });
  out.push(slug);
}
console.log(JSON.stringify({ chapters: out.length, errors: logs.filter((l) => /error|INVALID/i.test(l)).slice(0, 5) }));
await browser.close();

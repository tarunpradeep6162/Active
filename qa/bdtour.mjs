// QA: screenshot every birthday chapter (placeholder mode) at a viewport, plus a contact sheet input list.
// Usage: RECREATION_URL=http://localhost:4173/ node qa/bdtour.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
const out = `qa/out/bdtour_${W}x${H}`;
fs.mkdirSync(out, { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low' });
const chapters = await page.evaluate(() => [...document.querySelectorAll('.work-panel .sr-only a')].map((a) => ({ slug: a.getAttribute('href').split('/').pop(), title: a.textContent.split(': ').slice(1).join(': ') })));
const slugs = chapters.map((c) => c.slug);
for (const [i, slug] of slugs.entries()) {
  await page.evaluate((s) => { history.pushState({}, '', `/work/${s}`); dispatchEvent(new PopStateEvent('popstate')); }, slug);
  // wait for the chapter itself (the card‑to‑card transition takes seconds under software GL)
  await page.waitForFunction((t) => document.querySelector('.bd-chapter.is-open .bd-chapter__title')?.textContent === t, chapters[i].title, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/${String(i + 1).padStart(2, '0')}-${slug}.png` });
}
fs.writeFileSync(`${out}/logs.json`, JSON.stringify(logs.filter((l) => /error|warn/i.test(l)), null, 1));
console.log('chapters', slugs.length, 'console issues', logs.filter((l) => /error/i.test(l)).length);
await browser.close();

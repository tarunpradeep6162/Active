// QA: "Play the film" — press play and let it run to the end: every section is visited, the
// cage opens, the candles go out, two lanterns are let go, it ends at the sunrise and closes.
// Usage: RECREATION_URL=… node qa/film.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/film', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low' });
await page.evaluate(() => { try { localStorage.removeItem('bday-lanterns-v1'); } catch {} });
await page.evaluate(() => document.querySelector('.opening__film').click());
const seen = new Set(), t0 = Date.now();
let n = 0, lastShot = 0, cage = false, blown = false, stars0 = null, stars = 0;
while (Date.now() - t0 < 30 * 60000) {
  await page.waitForTimeout(2000);
  const s = await page.evaluate(() => ({ film: !!document.querySelector('.film-controls'), sec: __state.section, p: __state.scroll.progress, cage: __state.cageOpen, dark: __state.cakeDark, stars: __state.starsLit, box: __exp.renderer?.info ? 0 : 0 }));
  if (stars0 === null) stars0 = s.stars;
  seen.add(s.sec); cage ||= s.cage; blown ||= s.dark > 0.05; stars = Math.max(stars, s.stars);
  if (Date.now() - lastShot > 12000) { lastShot = Date.now(); await page.screenshot({ path: `qa/out/film/${W}-${String(++n).padStart(2, '0')}-${s.sec}.png` }); }
  if (!s.film) break;
}
const end = await page.evaluate(() => ({ p: __state.scroll.progress, film: !!document.querySelector('.film-controls'), letterboxOff: true }));
console.log(JSON.stringify({ W, secs: Math.round((Date.now() - t0) / 1000), sections: [...seen], cageOpened: cage, candlesOut: blown, lanternsLetGo: stars - (stars0 ?? 0), endProgress: +end.p.toFixed(3), closed: !end.film, errors: logs.filter((l) => /error/i.test(l)).slice(0, 3) }));
await browser.close();

// QA: "Play the film" — press play and let it run to the end: every section is visited, the
// cage opens, the candles go out, two lanterns are let go, it ends at the sunrise, closes and
// rolls the credits. CUT=directors plays the director's cut (it also steps into three chapters).
// Usage: RECREATION_URL=… [CUT=directors] node qa/film.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/film', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low' });
await page.evaluate(() => { try { localStorage.removeItem('bday-lanterns-v1'); } catch {} });
const cut = process.env.CUT === 'directors';
await page.evaluate((cut) => document.querySelector(cut ? '.opening__film--cut' : '.opening__film').click(), cut);
const chapters = new Set();
const seen = new Set(), t0 = Date.now();
const words = new Set();
page.on('console', () => {});
let n = 0, lastShot = 0, cage = false, blown = false, stars0 = null, stars = 0;
while (Date.now() - t0 < 30 * 60000) {
  await page.waitForTimeout(2000);
  const s = await page.evaluate(() => ({ film: !!document.querySelector('.film-controls'), sec: __state.section, p: __state.scroll.progress, cage: __state.cageOpen, dark: __state.cakeDark, wished: document.querySelector('.lab-label')?.dataset.stage === 'wished', stars: __state.starsLit, path: location.pathname }));
  if (s.path.startsWith('/garden/')) chapters.add(s.path.slice(8));
  if (stars0 === null) stars0 = s.stars;
  seen.add(s.sec); cage ||= s.cage; blown ||= s.dark > 0.05 || s.wished; stars = Math.max(stars, s.stars);
  if (Date.now() - lastShot > 12000) { lastShot = Date.now(); await page.screenshot({ path: `qa/out/film/${W}-${String(++n).padStart(2, '0')}-${s.sec}.png` }); }
  for (const w of await page.evaluate(() => [...document.querySelectorAll('.sky-wish')].map((e) => e.textContent))) words.add(w);
  if (!s.film) break;
}
await page.waitForTimeout(3000);
const end = await page.evaluate(() => ({ p: __state.scroll.progress, film: !!document.querySelector('.film-controls'), credits: !!document.querySelector('.endcredits') }));
await page.screenshot({ path: `qa/out/film/${W}-${String(++n).padStart(2, '0')}-credits.png` });
console.log(JSON.stringify({ W, cut: cut ? 'directors' : 'film', chapters: [...chapters], credits: end.credits, secs: Math.round((Date.now() - t0) / 1000), sections: [...seen], cageOpened: cage, candlesOut: blown, lanternsLetGo: Math.max(stars - (stars0 ?? 0), words.size), endProgress: +end.p.toFixed(3), closed: !end.film, errors: logs.filter((l) => /error/i.test(l)).slice(0, 3) }));
await browser.close();

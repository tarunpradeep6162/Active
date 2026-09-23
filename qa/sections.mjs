// QA helper: per-section scroll spacer heights (vh) for either site at a viewport.
// Usage: node qa/sections.mjs reference|recreation w h [mobile]
import { openSite } from './browser.mjs';
const [site, w, h, m] = process.argv.slice(2);
const { browser, page } = await openSite(site, { width: +w, height: +h, mobile: m === 'mobile', query: site === 'reference' ? '' : 'qa=1&tier=low' });
const r = await page.evaluate((isRef) => {
  const els = isRef ? [...document.querySelectorAll('.FXScroll .scrollElement')] : [...document.querySelectorAll('.scroll-spacer [data-section]')];
  return els.map((e) => ({ id: e.dataset?.section || e.className, top: e.offsetTop, h: e.offsetHeight, vh: +(e.offsetHeight / innerHeight * 100).toFixed(1) }));
}, site === 'reference');
console.log(JSON.stringify(r));
await browser.close();

// QA: visit every chapter in turn (via the film-strip reel) and check that chapter scenes free
// their WebGL contexts — the browser caps live contexts, so a leak would blank later chapters.
// Usage: RECREATION_URL=… node qa/contexts.mjs [w h]
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low', wait: false });
await page.addInitScript(() => {});
await page.evaluate(() => {
  window.__ctx = { made: 0, lost: 0 };
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) {
    const had = this.__gl;
    const c = orig.call(this, type, ...a);
    if (/webgl/.test(type) && c && !had) { this.__gl = true; __ctx.made++; this.addEventListener('webglcontextlost', () => __ctx.lost++); }
    return c;
  };
});
await page.waitForFunction(() => window.__state && __state.reveal >= 1, null, { timeout: 600000 });
await page.evaluate(() => { history.pushState({}, '', '/garden/the-beginning'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForSelector('.bd-chapter.is-open', { timeout: 120000 });
const rounds = +(process.env.ROUNDS || 2);
const seen = [];
for (let r = 0; r < rounds; r++)
  for (let k = 0; k < 14; k++) {
    await page.evaluate((k) => document.querySelectorAll('.bd-reel__frame')[k]?.click(), k);
    await page.waitForFunction((k) => document.querySelector('.bd-reel__frame[aria-current="true"]') === document.querySelectorAll('.bd-reel__frame')[k], k, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    seen.push(await page.evaluate(() => document.querySelector('.bd-chapter__title')?.textContent));
  }
const res = await page.evaluate(() => ({ ...__ctx, canvases: document.querySelectorAll('.bd-cosmos canvas, .bd-giftstage canvas').length }));
const warn = logs.filter((l) => /too many active webgl|context lost|CONTEXT_LOST/i.test(l));
console.log(JSON.stringify({ W, visited: new Set(seen).size, ...res, alive: res.made - res.lost, warnings: warn.slice(0, 3), errors: logs.filter((l) => /error/i.test(l)).slice(0, 3) }));
await browser.close();

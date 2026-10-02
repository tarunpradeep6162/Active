// QA: phone behaviour that needs no real GPU — (1) the browser toolbar sliding (window height
// ±56 px) must not resize the render targets or move the journey; (2) slow frames trim the drawing
// resolution step by step before any tier drop, and smooth frames give it back.
// Usage: RECREATION_URL=… node qa/phonelogic.mjs
import { chromium } from 'playwright';
const URL = (process.env.RECREATION_URL || 'http://localhost:4173/') + '?qa=1';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 15; V2511) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(URL);
await page.waitForFunction(() => window.__state && __state.reveal >= 1, null, { timeout: 600000 });
const snap = () => page.evaluate(() => ({ buf: [__exp.renderer.domElement.width, __exp.renderer.domElement.height], max: __state.scroll.max, y: Math.round(scrollY), progress: +__state.scroll.progress.toFixed(4), vh: __state.viewport.height }));
await page.evaluate(() => { const el = document.querySelector('.scroll-spacer [data-section="work"]'); scrollTo(0, el.offsetTop + 300); });
await page.waitForTimeout(6000);
const a = await snap();
await page.setViewportSize({ width: 412, height: 916 }); // toolbar hides
await page.waitForTimeout(6000);
const b = await snap();
await page.setViewportSize({ width: 412, height: 860 }); // toolbar shows again
await page.waitForTimeout(6000);
const c = await snap();
console.log('toolbar', JSON.stringify({ a, b, c }));
// governor: 6 s of 25 ms frames, then 12 s of 16.7 ms frames
const gov = await page.evaluate(() => {
  const g = __exp.governor; g.enabled = true;
  const trace = [];
  for (let i = 0; i < 1200; i++) { g.sample(25); if (i % 240 === 239) trace.push(`slow ${((i + 1) / 40)}s: res ${g.resScale} tier ${__state.performanceTier} dpr ${__state.viewport.dpr.toFixed(2)}`); }
  for (let i = 0; i < 2400; i++) { g.sample(16.7); if (i % 300 === 299) trace.push(`smooth ${((i + 1) / 60).toFixed(0)}s: res ${g.resScale} tier ${__state.performanceTier}`); }
  return { trace, history: g.history };
});
console.log(gov.trace.join('\n'));
console.log('history', JSON.stringify(gov.history));
console.log(JSON.stringify({ errors }));
await browser.close();

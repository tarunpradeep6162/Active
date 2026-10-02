// QA: main-thread time per second (script, style recalc, layout) while a section scrolls slowly,
// with the CPU throttled toward a phone's. The GPU (software here) runs in its own process, so
// this isolates what the page itself costs the phone's main thread.
// Usage: RECREATION_URL=… node qa/mainthread.mjs [sec] [from] [to] [throttle]
import { chromium } from 'playwright';
const SEC = process.argv[2] || 'work', FROM = +(process.argv[3] || 0.6), TO = +(process.argv[4] || 0.8), THR = +(process.argv[5] || 4);
const URL = (process.env.RECREATION_URL || 'http://localhost:4173/') + '?qa=1&tier=low';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 15; CPH2487) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' });
const page = await ctx.newPage();
await page.goto(URL);
await page.waitForFunction(() => window.__state && __state.reveal >= 1, null, { timeout: 600000 });
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const pos = (l) => page.evaluate(([sec, l]) => { const el = document.querySelector(`.scroll-spacer [data-section="${sec}"]`); return Math.round(el.offsetTop + l * el.offsetHeight); }, [SEC, l]);
const y0 = await pos(FROM), y1 = await pos(TO);
await page.evaluate((y) => { scrollTo(0, y); const s = __state.scroll; s.position = s.target = y; __exp.scroll.update(0); __exp.rig.snap(); }, y0);
await page.waitForTimeout(3000);
// make the page draw nothing on the GPU side so frames come quickly and main-thread cost dominates
await page.evaluate((mode) => { __exp.post.render = () => {}; if (mode === "noui") __exp.ui.update = () => {}; }, process.env.MODE || "");
await cdp.send('Emulation.setCPUThrottlingRate', { rate: THR });
const frames0 = await page.evaluate(() => __state.frame);
const a = await metrics();
const T = 6000, t0 = Date.now();
while (Date.now() - t0 < T) {
  const k = (Date.now() - t0) / T;
  await page.evaluate((y) => scrollTo(0, y), Math.round(y0 + (y1 - y0) * k));
  await page.waitForTimeout(50);
}
const b = await metrics();
const frames = (await page.evaluate(() => __state.frame)) - frames0;
const per = (k) => +(((b[k] - a[k]) * 1000) / frames).toFixed(2);
console.log(JSON.stringify({ section: SEC, throttle: THR, frames, msPerFrame: { task: per('TaskDuration'), script: per('ScriptDuration'), style: per('RecalcStyleDuration'), layout: per('LayoutDuration') }, styleRecalcsPerFrame: +((b.RecalcStyleCount - a.RecalcStyleCount) / frames).toFixed(2), layoutsPerFrame: +((b.LayoutCount - a.LayoutCount) / frames).toFixed(2), nodes: b.Nodes }));
await browser.close();

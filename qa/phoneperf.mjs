// QA: per-frame CPU cost and garbage on a phone-shaped page (OnePlus 11R / vivo V70 class:
// ~412×915 CSS px at DPR 3, Android Chrome). The GPU here is software, so the GPU side can't be
// measured; this isolates the main-thread work (scene updates, UI, audio) that must stay well under
// the 16.7 ms a 60 fps frame allows, and the heap churn that turns into GC stutter.
// Usage: RECREATION_URL=… node qa/phoneperf.mjs [w h] [cpuThrottle]
import { chromium } from 'playwright';
const W = +process.argv[2] || 412, H = +process.argv[3] || 915, THROTTLE = +process.argv[4] || 1;
const URL = (process.env.RECREATION_URL || 'http://localhost:4173/') + '?qa=1&tier=medium';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] });
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 15; CPH2487) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(URL);
await page.waitForFunction(() => window.__state && __state.reveal >= 1, null, { timeout: 600000 });
if (THROTTLE > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE }); }
const rows = [];
for (const [sec, l] of [['intro', 0.3], ['manifesto', 0.4], ['work', 0.2], ['work', 0.6], ['lab', 0.6], ['portal', 0.5], ['outro', 0.7], ['outro', 0.95]]) {
  rows.push(await page.evaluate(([sec, l]) => {
    const el = document.querySelector(`.scroll-spacer [data-section="${sec}"]`);
    const y = Math.min(document.documentElement.scrollHeight - innerHeight, Math.round(el.offsetTop + l * el.offsetHeight));
    scrollTo(0, y); const s = __state.scroll; s.position = s.target = y; s.velocity = 0; __exp.scroll.update(0); __exp.rig.snap();
    const exp = __exp, post = exp.post, real = post.render;
    exp.qaStep(1000, 1000 / 60); // settle (with rendering)
    // CPU only: the frame without the GPU work
    post.render = () => {};
    gc?.();
    const h0 = performance.memory.usedJSHeapSize;
    const N = 240, t = [];
    for (let i = 0; i < N; i++) { const a = performance.now(); exp.qaStep(1000 / 60, 1000 / 60); t.push(performance.now() - a); }
    const h1 = performance.memory.usedJSHeapSize;
    post.render = real;
    exp.qaResume();
    t.sort((a, b) => a - b);
    const info = exp.renderer.info.render;
    return { at: `${sec} ${l}`, cpuMedMs: +t[N >> 1].toFixed(2), cpuP95Ms: +t[Math.floor(N * 0.95)].toFixed(2), garbageKBperFrame: +((h1 - h0) / N / 1024).toFixed(1), calls: info.calls, tris: info.triangles, pts: info.points, dpr: __state.viewport.dpr };
  }, [sec, l]));
}
console.table(rows);
console.log(JSON.stringify({ errors: errors.slice(0, 5) }));
await browser.close();

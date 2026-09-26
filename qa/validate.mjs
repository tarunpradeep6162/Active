// Functional validation against a running build. Usage: RECREATION_URL=… node qa/validate.mjs
import { chromium } from 'playwright';
const BASE = process.env.RECREATION_URL || 'http://localhost:4173/';
const local = /localhost|127\.0\.0\.1/.test(BASE);
const browser = await chromium.launch({
  proxy: process.env.HTTPS_PROXY && !local ? { server: process.env.HTTPS_PROXY } : undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const report = {};
async function open(path = '', opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 700 }, ignoreHTTPSErrors: true, ...opts });
  // count live event listeners so leaks show up
  await ctx.addInitScript(() => {
    let n = 0;
    const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
    EventTarget.prototype.addEventListener = function (...a) { n++; return add.apply(this, a); };
    EventTarget.prototype.removeEventListener = function (...a) { n--; return rem.apply(this, a); };
    Object.defineProperty(window, '__listeners', { get: () => n });
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(600000);
  const logs = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && !/parallel_shader/.test(m.text()) && logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await page.goto(BASE.replace(/\/$/, '') + path, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__state && __state.reveal >= 1);
  return { ctx, page, logs };
}
const idle = (page) => page.waitForFunction(() => __state.transition.phase === 'IDLE' && !__exp.transition.busy && !__exp.transition.pending);
const go = async (page, r) => { await page.evaluate((r) => __exp.transition.request(r, true), r); await page.waitForTimeout(100); await idle(page); };

// 1 · context loss / restore with scene + scroll state preserved
{
  const { ctx, page, logs } = await open('/?qa=1&tier=low');
  await page.evaluate(() => { scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.4); });
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => ({ y: scrollY, section: __state.section, geo: __exp.renderer.info.memory.geometries }));
  await page.evaluate(() => { window.__lc = __exp.renderer.getContext().getExtension('WEBGL_lose_context'); __lc.loseContext(); });
  await page.waitForTimeout(800);
  const lostShown = await page.evaluate(() => !!document.querySelector('.fallback'));
  await page.evaluate(() => __lc.restoreContext());
  await page.waitForTimeout(3000);
  const after = await page.evaluate(async () => { const f = __state.frame; await new Promise((r) => setTimeout(r, 2000)); return { y: scrollY, section: __state.section, framesAdvanced: __state.frame - f, fallback: !!document.querySelector('.fallback'), calls: __exp.renderer.info.render.calls }; });
  report.contextLoss = { before, lostShown, after, warnings: logs.slice(0, 5) };
  await ctx.close();
}

// 2 · chapter open/close cycles (CYCLES, default 12): GPU resources, listeners, heap
{
  const { ctx, page, logs } = await open('/?qa=1&tier=low');
  await go(page, { name: 'work' });
  const snap = () => page.evaluate(() => ({ ...__exp.renderer.info.memory, programs: __exp.renderer.info.programs.length, listeners: window.__listeners, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1e6).toFixed(1) : null }));
  // real chapters (a mix of light ones and ones with their own 3D scenes)
  const slugs = ['fourteen-things', 'the-letter', 'know-us', 'gift-boxes', 'our-timeline'];
  const cycles = +(process.env.CYCLES || 12);
  await go(page, { name: 'project', slug: slugs[0] }); await go(page, { name: 'work' });
  const s0 = await snap();
  for (let i = 0; i < cycles; i++) { await go(page, { name: 'project', slug: slugs[i % slugs.length] }); await go(page, { name: 'work' }); }
  const s1 = await snap();
  report.memoryCycles = { cycles, before: s0, after: s1, warnings: logs.slice(0, 5) };
  await ctx.close();
}

// 3 · tiers: layout must be identical, only rendering cost differs
{
  const out = {};
  for (const tier of ['low', 'medium', 'high']) {
    const { ctx, page } = await open(`/?qa=1&tier=${tier}`);
    await page.evaluate(() => { const m = document.documentElement.scrollHeight - innerHeight; scrollTo(0, m * 0.3); const s = __state.scroll; s.position = s.target = scrollY; __exp.scroll.update(0); __exp.rig.snap(); __exp.rig.update(0); });
    out[tier] = await page.evaluate(() => ({ scrollHeight: document.documentElement.scrollHeight, nav: JSON.stringify(document.querySelector('.nav').getBoundingClientRect()), cam: __exp.rig.camera.position.toArray().map((v) => +v.toFixed(3)).join(','), dpr: __state.viewport.dpr, canvas: [document.querySelector('#experience').width, document.querySelector('#experience').height].join('x') }));
    await ctx.close();
  }
  report.tiers = { ...out, layoutIdentical: new Set(Object.values(out).map((o) => o.scrollHeight + o.nav + o.cam)).size === 1 };
}

// 4 · automatic tiering: feed slow frames → HIGH→MEDIUM→LOW with cooldown, never flapping
{
  const { ctx, page } = await open('/?qa=1');
  report.autoTier = await page.evaluate(() => {
    const g = __exp.governor, log = [];
    __state.performanceTier = 'high'; g.enabled = true;
    for (let s = 0; s < 14; s++) { for (let f = 0; f < 20; f++) g.sample(55); log.push(__state.performanceTier); }
    for (let s = 0; s < 14; s++) { for (let f = 0; f < 120; f++) g.sample(6); log.push(__state.performanceTier); }
    return { sequence: log.join(' '), history: g.history.slice() };
  });
  await ctx.close();
}

// 5 · history / direct routes / refresh / rapid switching
{
  const { ctx, page, logs } = await open('/garden/know-us?qa=1&tier=low');
  await idle(page);
  const direct = await page.evaluate(() => ({ url: location.pathname, route: __state.route, focus: __state.focus, locked: document.documentElement.classList.contains('scroll-locked') }));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__state && __state.reveal >= 1); await idle(page);
  const refreshed = await page.evaluate(() => ({ url: location.pathname, route: __state.route.name, focus: __state.focus }));
  for (const slug of ['fourteen-things', 'music-room', 'our-timeline']) await page.evaluate((s) => __exp.transition.request({ name: 'project', slug: s }, true), slug);
  await page.waitForTimeout(200); await idle(page);
  const rapid = await page.evaluate(() => ({ url: location.pathname, route: __state.route, focus: __state.focus }));
  await page.goBack(); await page.waitForTimeout(200); await idle(page);
  const back = await page.evaluate(() => ({ url: location.pathname, route: __state.route }));
  await page.goForward(); await page.waitForTimeout(200); await idle(page);
  const forward = await page.evaluate(() => ({ url: location.pathname, route: __state.route }));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200); await idle(page);
  const esc = await page.evaluate(() => ({ url: location.pathname, focus: __state.focus, locked: document.documentElement.classList.contains('scroll-locked'), active: document.activeElement?.tagName }));
  report.history = { direct, refreshed, rapid, back, forward, esc, warnings: logs.slice(0, 5) };
  await ctx.close();
}

// 6 · reduced motion + keyboard
{
  const { ctx, page } = await open('/?qa=1&tier=low', { reducedMotion: 'reduce' });
  await page.mouse.move(200, 200); for (let i = 0; i < 12; i++) await page.mouse.move(200 + i * 40, 200 + i * 15);
  await page.waitForTimeout(500);
  const tabs = [];
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); tabs.push(await page.evaluate(() => (document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent || '').trim().slice(0, 30))); }
  report.reducedMotion = await page.evaluate(() => ({ reduced: __state.reducedMotion, trailPoints: __exp.trails.local.strands[0].count }));
  report.keyboardTabOrder = tabs;
  await ctx.close();
}

// 7 · debug overlay only when requested
{
  const a = await open('/?qa=1&tier=low');
  const plain = await a.page.evaluate(() => [...document.querySelectorAll('pre')].some((p) => p.textContent.includes('progress')));
  await a.ctx.close();
  const b = await open('/?debug=1&tier=low');
  await b.page.waitForTimeout(1500);
  const dbg = await b.page.evaluate(() => [...document.querySelectorAll('pre')].map((p) => p.textContent).join('').slice(0, 900));
  await b.ctx.close();
  report.debugOverlay = { visibleWithoutFlag: plain, overlaySample: dbg };
}
console.log(JSON.stringify(report, null, 1));
await browser.close();

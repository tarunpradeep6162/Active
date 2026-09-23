// Shared Playwright setup for the comparison harness.
// NOTE: the environment only has software WebGL (SwiftShader). The reference redirects
// that renderer to /unsupported, so for the reference only we report a common desktop GPU
// string. Nothing else about the page is altered. Large responses are fetched via curl
// because the sandbox proxy intermittently drops them.
import { chromium } from 'playwright';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import path from 'node:path';

const CACHE = path.resolve('qa/cache');
fs.mkdirSync(CACHE, { recursive: true });
const MIME = { js: 'application/javascript', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2', woff: 'font/woff', css: 'text/css', svg: 'image/svg+xml', html: 'text/html', mp4: 'video/mp4', wasm: 'application/wasm' };
const mime = (u) => MIME[(u.split('?')[0].split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
const curl = (url, file) => new Promise((res) => execFile('curl', ['-sS', '-L', '-o', file, '-w', '%{http_code} %{content_type}', url], { maxBuffer: 1e8 }, (_e, out) => res(out || '0 ')));

export const REFERENCE = 'https://activetheory.net/';
export const RECREATION = process.env.RECREATION_URL || 'https://meridian-field-nine.vercel.app/';

export async function openSite(site, { width, height, mobile = false, dpr = 1, query = '' } = {}) {
  const base = site === 'reference' ? REFERENCE : RECREATION;
  const local = /localhost|127\.0\.0\.1/.test(base);
  const browser = await chromium.launch({
    // a local build must not go through the sandbox proxy (it answers 405 for loopback)
    proxy: process.env.HTTPS_PROXY && !local ? { server: process.env.HTTPS_PROXY } : undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, ignoreHTTPSErrors: true,
    userAgent: mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
      : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  });
  if (site === 'reference') {
    await ctx.addInitScript(() => {
      for (const C of [WebGLRenderingContext, WebGL2RenderingContext]) {
        const g = C.prototype.getParameter;
        C.prototype.getParameter = function (p) {
          if (p === 37446) return 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)';
          if (p === 37445) return 'Google Inc. (Apple)';
          return g.call(this, p);
        };
      }
    });
  }
  if (!local) await ctx.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (/google-analytics|googletagmanager/.test(url)) return route.abort();
    if (/cloudfunctions\.net\/geo/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"country":"US"}' });
    if (req.method() !== 'GET' || /localhost|127\.0\.0\.1/.test(url)) return route.continue();
    const f = path.join(CACHE, crypto.createHash('md5').update(url).digest('hex'));
    let status = 200, ct = mime(url);
    // only content‑hashed build assets are safe to cache forever; pages, JSON and anything else
    // must be fetched fresh or a redeploy is tested against a stale document
    const immutable = /\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.[a-z0-9]+(\?|$)/.test(url) || !/vercel\.app/.test(url);
    if (!immutable) fs.rmSync(f, { force: true });
    if (!fs.existsSync(f)) {
      const [s, c] = (await curl(url, f)).split(' ');
      status = +s || 500; if (c) ct = c;
      fs.writeFileSync(f + '.meta', JSON.stringify({ status, ct }));
    } else { try { ({ status, ct } = JSON.parse(fs.readFileSync(f + '.meta'))); } catch {} }
    return route.fulfill({ status, contentType: ct, body: fs.existsSync(f) ? fs.readFileSync(f) : '' });
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  const logs = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await page.goto(base + (query ? (base.includes('?') ? '&' : '?') + query : ''), { waitUntil: 'domcontentloaded', timeout: 120000 });
  // wait for each site's "ready" signal
  if (site === 'reference') { await page.waitForSelector('.FXScroll', { state: 'attached' }); await page.waitForTimeout(16000); }
  else { await page.waitForFunction(() => window.__state && window.__state.reveal >= 1, null, { timeout: 600000 }); await page.waitForTimeout(500); }
  return { browser, page, logs };
}

/** Normalised scroll for either site; snaps our smoothing so the frame is settled. */
export async function scrollTo(site, page, f) {
  if (site === 'reference') {
    await page.evaluate((f) => { const s = document.querySelector('.FXScroll'); s.scrollTo(0, (s.scrollHeight - s.clientHeight) * f); }, f);
    await page.waitForTimeout(2800);
  } else {
    await page.evaluate((f) => {
      const max = document.documentElement.scrollHeight - innerHeight;
      scrollTo(0, max * f);
      const s = __state.scroll; s.position = s.target = scrollY; s.velocity = 0; __exp.scroll.update(0); __exp.rig.snap();
    }, f);
    await page.waitForTimeout(1600);
  }
}

export async function metrics(site, page) {
  return page.evaluate((site) => {
    if (site === 'reference') { const s = document.querySelector('.FXScroll'); return { scrollHeight: s.scrollHeight, max: s.scrollHeight - s.clientHeight, scrollTop: s.scrollTop }; }
    return { scrollHeight: document.documentElement.scrollHeight, max: document.documentElement.scrollHeight - innerHeight, scrollTop: scrollY };
  }, site);
}

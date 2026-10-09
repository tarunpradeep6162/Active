// QA: a real visit to the LIVE site, exactly as she would open it on her phone: no test flags,
// real time (no stepping), an Android phone, first visit. Records every console error/warning,
// page error, failed request and HTTP error, and walks: intro → gate → peek → opening → scroll
// through the whole journey → For you → each keepsake → reload (service worker) → offline reload.
// Usage: node qa/live.mjs [url]
import { chromium } from 'playwright';
import fs from 'node:fs';
const URL = process.argv[2] || 'https://meridian-field-nine.vercel.app/';
fs.mkdirSync('qa/out/live', { recursive: true });
const browser = await chromium.launch({
  proxy: process.env.HTTPS_PROXY && !/localhost|127\.0\.0\.1/.test(URL) ? { server: process.env.HTTPS_PROXY } : undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({
  viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 15; CPH2487) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
});
const page = await ctx.newPage();
const log = { console: [], pageErrors: [], failed: [], http: [], steps: [] };
const t0 = Date.now();
const step = (s, extra = {}) => { const e = { t: ((Date.now() - t0) / 1000).toFixed(1), s, ...extra }; log.steps.push(e); console.log(JSON.stringify(e)); };
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && log.console.push(`${m.type()}: ${m.text()}`.slice(0, 300)));
page.on('pageerror', (e) => log.pageErrors.push(e.message.slice(0, 300)));
page.on('requestfailed', (r) => log.failed.push(`${r.failure()?.errorText} ${r.url()}`.slice(0, 200)));
page.on('response', (r) => r.status() >= 400 && log.http.push(`${r.status()} ${r.url()}`.slice(0, 200)));
const shot = (n) => page.screenshot({ path: `qa/out/live/${n}.png` }).catch(() => {});
const has = (sel) => page.$(sel).then((x) => !!x);

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
step('loaded html');
await page.waitForSelector('.intro', { timeout: 60000 }).then(() => step('intro shown')).catch(() => step('NO intro'));
await page.waitForTimeout(2500);
await shot('01-intro');
// let the intro finish on its own (real time)
await page.waitForSelector('.intro', { state: 'detached', timeout: 120000 }).then(() => step('intro finished')).catch(() => step('intro STUCK'));
await page.waitForSelector('.gate', { timeout: 240000 }).then(() => step('gate shown')).catch(() => step('NO gate'));
await page.waitForTimeout(1500);
await shot('02-gate');
if (await has('.gate')) {
  const b = await page.locator('.gate__seal').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2300);
  await page.mouse.up();
  await page.waitForSelector('.gate', { state: 'detached', timeout: 20000 }).then(() => step('peeked through the gate')).catch(() => step('gate did NOT open'));
}
// the opening (real time; the software GPU is slow, so give it time)
await page.waitForFunction(() => document.querySelector('.opening__enter') || document.querySelector('.opening'), null, { timeout: 300000 }).catch(() => {});
await page.waitForTimeout(8000);
await shot('03-opening');
step('opening', { swController: await page.evaluate(() => !!navigator.serviceWorker?.controller), swReg: await page.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration())) });
// scroll through the whole journey like a thumb would (wheel steps, real time)
const H = await page.evaluate(() => document.documentElement.scrollHeight);
const stops = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1];
for (const k of stops) {
  const y = Math.round(k * (H - 915));
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, (y - (await page.evaluate(() => scrollY))) / (6 - i)); await page.waitForTimeout(250); }
  await page.waitForTimeout(4000);
  const sec = await page.evaluate(() => document.title + ' | ' + location.pathname);
  step(`scrolled ${Math.round(k * 100)}%`, { where: sec });
  await shot(`04-scroll-${Math.round(k * 100)}`);
}
// For you, through the nav
await page.evaluate(() => scrollTo(0, 0));
await page.waitForTimeout(1500);
const forYou = page.locator('a, button', { hasText: /for you/i }).first();
await forYou.click({ timeout: 20000 }).then(() => step('clicked For you')).catch((e) => step('For you click FAILED ' + e.message.slice(0, 80)));
await page.waitForSelector('.foryou.is-open', { timeout: 30000 }).then(() => step('For you open')).catch(() => step('For you NOT open'));
await page.waitForTimeout(2500);
await shot('05-foryou');
for (const cta of ['Open the letters', 'Play the film', 'Count them', 'Draw the stars', 'Open the map', 'Visit your tulip', 'Open the jar', 'Take a photo']) {
  const b = page.locator(`.foryou__card--new button:text-is("${cta}")`);
  if (!(await b.count())) { step(`no card: ${cta}`); continue; }
  await b.scrollIntoViewIfNeeded();
  await b.click();
  const ok = await page.waitForSelector('.sheet__panel', { timeout: 30000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(1500);
  step(`sheet ${cta}`, { ok });
  await shot(`06-sheet-${cta.split(' ').pop()}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}
// a reload: now served by the service worker
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
step('reloaded', { swController: await page.evaluate(() => !!navigator.serviceWorker?.controller), introAgain: await has('.intro') });
// offline: does it still open?
await page.waitForTimeout(16000); // let the cache warm (15 s after start)
await ctx.setOffline(true);
const offline = await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }).then(() => true).catch((e) => e.message.slice(0, 80));
await page.waitForTimeout(8000);
step('offline reload', { ok: offline, hasCanvas: await has('#experience'), body: (await page.evaluate(() => document.body.innerText)).slice(0, 80) });
await shot('07-offline');
await ctx.setOffline(false);
fs.writeFileSync('qa/out/live/log.json', JSON.stringify(log, null, 1));
console.log(JSON.stringify({ consoleErrors: log.console.filter((c) => c.startsWith('error')), warnings: log.console.filter((c) => c.startsWith('warning')).slice(0, 10), pageErrors: log.pageErrors, failed: log.failed.slice(0, 15), http: log.http.slice(0, 15) }, null, 1));
await browser.close();

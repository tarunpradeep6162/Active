// QA: round 4 extras on a phone (412×915): the For you cards and every sheet, the voice tulip,
// the birthday gate (?gate), the birthday morning (?now=…), and the manifest/service worker files.
// Usage: RECREATION_URL=… node qa/round4.mjs [part]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const part = process.argv[2] || 'all';
fs.mkdirSync('qa/out/round4', { recursive: true });
const shot = (page, n) => page.screenshot({ path: `qa/out/round4/${n}.png` });
const out = {};
const go = async (query, wait = true) => {
  const s = await openSite('recreation', { width: 412, height: 915, mobile: true, query: `qa=1&tier=low${query}`, wait });
  s.page.on('pageerror', (e) => s.logs.push(`pageerror: ${e.message}`));
  return s;
};
const toRoute = (page, path) => page.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')); }, path);

if (part === 'all' || part === 'foryou') {
  const { browser, page, logs } = await go('');
  await toRoute(page, '/for-you');
  await page.waitForSelector('.foryou.is-open .foryou__card--new', { timeout: 120000 });
  await page.waitForTimeout(2500);
  out.cards = await page.$$eval('.foryou__card h3', (h) => h.map((x) => x.textContent));
  await page.evaluate(() => document.querySelector('.foryou__card--new')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(800);
  await shot(page, 'foryou-cards');
  for (const [cta, name] of [['Open the letters', 'openwhen'], ['Count them', 'numbers'], ['Draw the stars', 'twostars'], ['Open the map', 'map'], ['Visit your tulip', 'plant'], ['Open the jar', 'jar'], ['Play the film', 'reel']]) {
    await page.click(`.foryou__card--new button:text-is("${cta}")`);
    await page.waitForSelector('.sheet__panel', { timeout: 30000 });
    await page.waitForTimeout(1800);
    if (name === 'openwhen') {
      await page.click('.ow__env');
      await page.waitForTimeout(2500);
    }
    if (name === 'plant') {
      await page.fill('.plant__form input', 'Tulip');
      await page.click('.plant__form .sheet__btn');
      await page.waitForTimeout(1200);
    }
    if (name === 'jar') {
      await page.fill('.jar__form textarea', 'A year full of sunshine');
      await page.click('.jar__form .sheet__btn');
      await page.waitForTimeout(1600);
    }
    if (name === 'reel') {
      await page.click('.reel__actions .sheet__btn--ghost, .reel__actions .sheet__btn:text-is("Just watch it")');
      await page.waitForTimeout(6000);
    }
    await shot(page, `sheet-${name}`);
    if (name === 'openwhen') await page.click('.ow__paper .sheet__btn');
    await page.click('.sheet__close');
    await page.waitForTimeout(500);
  }
  // the birthday card PDF
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('.foryou__card--new button:text-is("Save the card (PDF)")')]);
  const pdf = await dl.path();
  out.card = { name: dl.suggestedFilename(), bytes: fs.statSync(pdf).size, head: fs.readFileSync(pdf).subarray(0, 8).toString() };
  fs.copyFileSync(pdf, 'qa/out/round4/card.pdf');
  out.foryouErrors = logs.filter((l) => /error/i.test(l)).slice(0, 5);
  await browser.close();
}

if (part === 'all' || part === 'garden') {
  const { browser, page, logs } = await go('&now=2026-11-25T08:30:00');
  await page.evaluate(() => {
    const el = document.querySelector('.scroll-spacer [data-section="work"]');
    const y = Math.round(el.offsetTop + 0.3 * el.offsetHeight);
    scrollTo(0, y); const s = __state.scroll; s.position = s.target = y; s.velocity = 0; __exp.scroll.update(0); __exp.rig.snap();
    __exp.qaStep(2500, 50);
  });
  await page.waitForTimeout(300);
  await page.evaluate(() => { __exp.qaStep(1500, 50); __exp.qaResume(); });
  await page.waitForSelector('.vtulip', { timeout: 60000 });
  out.festive = await page.evaluate(() => __state.festive);
  out.morningBanner = !!(await page.$('.morning'));
  await shot(page, 'garden-birthday-morning');
  await page.click('.vtulip');
  await page.waitForTimeout(800);
  await shot(page, 'garden-voice-tulip');
  out.gardenErrors = logs.filter((l) => /error/i.test(l)).slice(0, 5);
  await browser.close();
}

if (part === 'all' || part === 'gate') {
  // (the garden pauses behind the gate, so its fade‑in only finishes once she peeks)
  const { browser, page, logs } = await go('&gate=1&now=2026-11-20T21:15:00', false);
  await page.waitForSelector('.gate', { timeout: 300000 });
  await page.waitForTimeout(1500);
  out.gateHold = await page.evaluate(() => __state.hold);
  await shot(page, 'gate');
  // press and hold the seal to peek
  const b = await page.locator('.gate__seal').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(2200);
  await page.mouse.up();
  await page.waitForTimeout(2600);
  out.gateGone = !(await page.$('.gate'));
  await page.waitForFunction(() => window.__state && __state.reveal >= 1, null, { timeout: 600000 });
  out.revealedAfterPeek = true;
  out.holdAfter = await page.evaluate(() => __state.hold);
  out.gateErrors = logs.filter((l) => /error/i.test(l)).slice(0, 5);
  await browser.close();
}

if (part === 'all' || part === 'files') {
  const base = process.env.RECREATION_URL || 'http://localhost:4173/';
  const r = async (p) => { const x = await fetch(base + p); return { status: x.status, type: x.headers.get('content-type') }; };
  out.files = { manifest: await r('manifest.webmanifest'), sw: await r('sw.js'), icon: await r('icons/icon-512.png') };
}
console.log(JSON.stringify(out, null, 1));

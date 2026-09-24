// QA: one chapter's cinematic scene — open it, run its steps, screenshot each.
// Usage: RECREATION_URL=… node qa/chapter.mjs <slug> [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const slug = process.argv[2];
const W = +process.argv[3] || 1280, H = +process.argv[4] || 800;
const dir = `qa/out/ch/${slug}`;
fs.mkdirSync(dir, { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low', wait: false });
if (process.env.STILL) await page.emulateMedia({ reducedMotion: 'reduce' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
const ALL = ['the-beginning', 'memory-universe', 'the-letter', 'fourteen-things', 'catch-my-heart', 'know-us', 'our-secret', 'music-room', 'our-timeline', 'gift-boxes', 'make-a-wish', 'future-universe', 'little-movie'];
const done = process.env.DONE === 'all' ? ALL : (process.env.DONE ?? '').split(',').filter(Boolean);
await page.evaluate((done) => localStorage.setItem('bday-progress-v1', JSON.stringify({ done, hearts: [], thisOrThat: {} })), done);
await page.reload({ waitUntil: 'domcontentloaded' });
logs.length = 0; // the first load is cut short by the reload
await page.waitForFunction(() => window.__state && window.__state.reveal >= 1, null, { timeout: 600000 });
await page.evaluate((slug) => { history.pushState({}, '', `/garden/${slug}`); dispatchEvent(new PopStateEvent('popstate')); }, slug);
await page.waitForSelector('.bd-chapter.is-open', { timeout: 240000 });
await page.waitForTimeout(5000);
let n = 0;
const shot = async (name) => page.screenshot({ path: `${dir}/${W}-${++n}-${name}.png` });
const click = (sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel);
const info = {};
await shot('open');
const steps = {
  'make-a-wish': async () => {
    const b = page.locator('.bd-wish .bd-btn');
    const r = await b.boundingBox();
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1000);
    await shot('holding');
    await page.waitForTimeout(1200);
    await page.mouse.up();
    await page.waitForTimeout(1500);
    await shot('smoke');
    await page.waitForTimeout(4000);
    await shot('wish');
    info.stage = await page.evaluate(() => document.querySelector('.bd-wish')?.dataset.stage);
  },
  'music-room': async () => {
    await page.click('.bd-songs li:nth-child(1) button');
    await page.waitForTimeout(1200);
    await shot('arm');
    await page.waitForTimeout(3000);
    await shot('playing');
    await page.click('.bd-songs li:nth-child(3) button');
    await page.waitForTimeout(3000);
    await shot('second');
  },
  'little-movie': async () => {
    await click('.bd-movie__play');
    await page.waitForTimeout(900);
    await shot('parting');
    await page.waitForTimeout(2500);
    await shot('clip1');
    await page.waitForTimeout(3600);
    await shot('clip2');
    await page.waitForSelector('.bd-movie.is-end', { timeout: 60000 });
    await page.waitForTimeout(3500);
    await shot('end');
  },
  'our-timeline': async () => {
    for (const k of [1, 3, 8]) {
      await click(`.bd-timeline__track li:nth-child(${k + 1}) button`);
      await page.waitForTimeout(7000);
      await shot(`stop${k}`);
    }
  },
  'our-secret': async () => {
    const answer = async (a) => { await page.fill('#bd-clue-input', a); await page.press('#bd-clue-input', 'Enter'); await page.waitForTimeout(1600); };
    await answer('wrong');
    await shot('wrong');
    await answer('2');
    await answer('5');
    await shot('two');
    await answer('heart');
    await answer('11');
    await answer('1');
    await page.waitForTimeout(2500);
    await shot('open');
    await page.waitForTimeout(3000);
    await shot('opened');
  },
  'for-dheepika': async () => {
    info.locked = await page.evaluate(() => !!document.querySelector('.bd-door'));
    if (info.locked) return;
    await click('.bd-finale .bd-btn--big');
    for (const [ms, name] of [[1500, 'swing'], [2000, 'light'], [2500, 'through'], [5000, 'memories'], [6000, 'date'], [6000, 'end'], [5000, 'garden']]) {
      await page.waitForTimeout(ms);
      await shot(name);
    }
    info.stage = await page.evaluate(() => document.querySelector('.bd-finale')?.dataset.stage);
  },
};
await steps[slug]?.();
info.live = await page.evaluate(() => [...document.querySelectorAll('[data-live]')].map((e) => e.dataset.live).join(','));
console.log(JSON.stringify({ slug, W, ...info, errors: logs.filter((l) => /error|INVALID/i.test(l)).slice(0, 5) }));
await browser.close();

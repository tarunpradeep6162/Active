// QA: play every birthday chapter end to end (placeholder mode) through the real UI, find every
// hidden heart, then open Door 25 and run the finale. Fails on any console error or on a
// chapter that doesn't register as opened.
// Usage: RECREATION_URL=http://localhost:4173/ node qa/bdplay.mjs [w h]
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.evaluate(() => { try { localStorage.clear(); } catch {} });

const T = 180000;
const chapters = await page.evaluate(() => [...document.querySelectorAll('.work-panel .sr-only a')].map((a) => ({ slug: a.getAttribute('href').split('/').pop(), title: a.textContent.split(': ').slice(1).join(': ') })));
const open = async (i) => {
  await page.evaluate((s) => { history.pushState({}, '', `/work/${s}`); dispatchEvent(new PopStateEvent('popstate')); }, chapters[i].slug);
  await page.waitForFunction((t) => document.querySelector('.bd-chapter.is-open .bd-chapter__title')?.textContent === t, chapters[i].title, { timeout: T });
  await page.waitForSelector('.bd-chapter__stage > *', { timeout: T });
  await page.waitForTimeout(1700); // the chapter unfolds out of its tulip first
};
const done = () => page.evaluate(() => JSON.parse(localStorage.getItem('bday-progress-v1') || '{"done":[],"hearts":[]}'));
const heart = async () => { const h = page.locator('.bd-heart').first(); if (await h.count()) await h.click({ force: true }); };
const results = [];
const step = async (i, fn) => {
  const t0 = Date.now();
  await open(i);
  await heart();
  await fn();
  await page.waitForFunction((s) => (JSON.parse(localStorage.getItem('bday-progress-v1') || '{"done":[]}').done || []).includes(s), chapters[i].slug, { timeout: 60000 }).catch(() => {});
  const d = await done();
  results.push({ chapter: chapters[i].title, done: d.done.includes(chapters[i].slug), heart: d.hearts.includes(chapters[i].slug), secs: Math.round((Date.now() - t0) / 1000) });
  console.log(JSON.stringify(results.at(-1)));
  if (!results.at(-1).heart) console.log('   heart not registered in', chapters[i].title);
};

// on a fresh start Door 25 must be locked
await open(13);
const lockedAtStart = (await page.locator('.bd-door').count()) > 0;
console.log(JSON.stringify({ door25LockedAtStart: lockedAtStart }));
if (!lockedAtStart) logs.push('error: Door 25 was not locked on a fresh start');
await step(0, async () => { await page.click('.bd-star'); await page.click('.bd-star'); });
await step(1, async () => {
  for (let k = 0; k < 3; k++) { await page.locator('.bd-float__item').nth(k).click({ force: true }); await page.click('.bd-lightbox .bd-btn'); }
  await page.click('.bd-tabs button:nth-child(2)'); await page.click('.bd-camera'); await page.waitForSelector('.bd-polaroid__print');
  await page.click('.bd-tabs button:nth-child(3)'); await page.locator('.bd-puzzle__tile').nth(0).click(); await page.locator('.bd-puzzle__tile').nth(1).click();
});
await step(2, async () => { await page.click('.bd-envelope', { force: true }); });
await step(3, async () => { const n = await page.locator('.bd-reason-star').count(); for (let k = 0; k < n; k++) await page.locator('.bd-reason-star').nth(k).click({ force: true }); await page.waitForSelector('.bd-reasons__name button'); await page.locator('.bd-reasons__name button').first().click(); });
// game: start it (exercise the canvas loop), leave mid‑game, come back and skip
await open(4); await page.click('.bd-game__overlay .bd-btn'); await page.waitForTimeout(3000);
await open(5); // leaving mid‑game must stop the loop and listeners cleanly
await step(4, async () => { await page.click('.bd-game__overlay .bd-link'); });
await step(5, async () => {
  for (let q = 0; q < 10; q++) {
    if (!(await page.locator('.bd-quiz').count())) break;
    await page.locator('.bd-quiz__options .bd-choice').first().click(); await page.click('.bd-quiz__reaction .bd-btn');
  }
  for (let q = 0; q < 10; q++) { if (!(await page.locator('.bd-tot').count())) break; await page.locator('.bd-tot .bd-choice').first().click(); }
  await page.waitForSelector('.bd-datecard');
});
await step(6, async () => {
  for (let q = 0; q < 10; q++) {
    if (!(await page.locator('#bd-clue-input').count())) break;
    await page.fill('#bd-clue-input', 'wrong'); await page.click('.bd-clue .bd-btn'); await page.waitForSelector('.bd-soft');
    // the shipped clues are answered from the garden itself (see src/content/dheepika.ts)
    await page.fill('#bd-clue-input', [' 2 ', 'Five', 'a heart', 'November', '1'][q] ?? 'answer'); await page.click('.bd-clue .bd-btn');
  }
  const box = await page.locator('.bd-scratch__cover').boundingBox();
  await page.mouse.move(box.x + 20, box.y + 20); await page.mouse.down();
  for (let k = 0; k < 30; k++) await page.mouse.move(box.x + 20 + (k % 6) * box.width / 6, box.y + 20 + Math.floor(k / 6) * box.height / 5);
  await page.mouse.up();
  if (await page.locator('.bd-scratch .bd-link').count()) await page.click('.bd-scratch .bd-link');
});
await step(7, async () => { await page.locator('.bd-songs button').nth(0).click(); await page.locator('.bd-songs button').nth(1).click(); });
await step(8, async () => { for (let k = 0; k < 12; k++) { const b = page.locator('.bd-timeline .bd-row .bd-btn').nth(1); if (await b.isDisabled()) break; await b.click(); } await page.waitForSelector('.bd-emptyframe'); });
await step(9, async () => {
  // the 3D stage (keyboard path), or the flat fallback boxes when WebGL is unavailable
  if (await page.locator('.bd-giftstage .sr-only button').count()) await page.locator('.bd-giftstage .sr-only button').first().evaluate((b) => b.click()); // (visually hidden: activate it like a keyboard user would)
  else await page.locator('.bd-gift').first().click({ force: true });
  await page.waitForSelector('.bd-giftcard', { timeout: 120000 });
});
await step(10, async () => {
  const b = await page.locator('.bd-wish .bd-btn').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(2600); await page.mouse.up();
  await page.waitForSelector('.bd-wish[data-stage="out"]', { timeout: 20000 });
});
await step(11, async () => { for (let k = 0; k < 3; k++) await page.locator('.bd-orb').nth(k).click({ force: true }); await page.click('.bd-sphere'); await page.waitForFunction(() => !/touch it/.test(document.querySelector('.bd-future__wish').textContent)); });
await step(12, async () => { await page.click('.bd-movie .bd-btn'); await page.waitForSelector('.bd-movie.is-end', { timeout: 60000 }); });
// finale: every other door is open now
await open(13);
await heart();
const locked = await page.locator('.bd-door').count();
await page.click('.bd-finale .bd-btn');
await page.waitForSelector('.bd-finale__end', { timeout: 60000 });
await page.click('.bd-finale__end .bd-btn');
await page.waitForSelector('.bd-lastthing');
const secret = await page.locator('.bd-secret-ending').count();
const d = await done();
results.push({ chapter: chapters[13].title, done: d.done.includes(chapters[13].slug), heart: d.hearts.includes(chapters[13].slug), doorWasLocked: !!locked, secretEnding: !!secret });
console.log(JSON.stringify(results.at(-1)));
// back to the stars, and the WebGL page is still healthy
await page.click('.bd-chapter__foot .bd-btn:has-text("Back")');
await page.waitForFunction(() => /^\/(garden|work)$/.test(location.pathname), null, { timeout: T });
const errors = logs.filter((l) => /error|pageerror/i.test(l));
console.log('chapters done', d.done.length, '/ 14 · hearts', d.hearts.length, '/ 14 · console errors', errors.length);
if (errors.length) console.log(errors.slice(0, 10).join('\n'));
await browser.close();
process.exit(errors.length || d.done.length < 14 || !secret ? 1 : 0);

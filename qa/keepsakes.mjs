// QA: the For You keepsakes download real files (PNG cards, the letter PDF), and the music
// toggles on and off without errors. Usage: RECREATION_URL=… node qa/keepsakes.mjs
import fs from 'node:fs';
import { openSite } from './browser.mjs';
fs.mkdirSync('qa/out/keepsakes', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: 1280, height: 800, query: 'qa=1&tier=low' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.evaluate(() => { history.pushState({}, '', '/for-you'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForFunction(() => __state.route.name === 'contact' && __state.transition.phase === 'IDLE', null, { timeout: 180000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'qa/out/keepsakes/for-you.png' });
await page.fill('.foryou textarea', 'A test message to future us.');
const grab = async (sel) => {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click(sel)]);
  const f = `qa/out/keepsakes/${d.suggestedFilename()}`;
  await d.saveAs(f);
  const b = fs.readFileSync(f);
  return { name: d.suggestedFilename(), bytes: b.length, head: b.subarray(0, 8).toString('latin1').replace(/[^\x20-\x7e]/g, '.'), tail: b.subarray(-6).toString('latin1') };
};
const out = {};
out.future = await grab('.foryou__card:nth-of-type(1) button:has-text("Keep as a card")');
out.letter = await grab('.foryou__card button:has-text("Keep this letter")');
out.stored = await page.evaluate(() => localStorage.getItem('bday-future-us'));
// music: on, a few seconds, off
await page.click('.audio-toggle');
await page.waitForTimeout(3000);
out.audioOn = await page.evaluate(() => ({ level: __state.audioLevel, pref: sessionStorage.getItem('bday-sound') }));
await page.click('.audio-toggle');
out.errors = logs.filter((l) => /error/i.test(l)).slice(0, 5);
console.log(JSON.stringify(out, null, 1));
await browser.close();

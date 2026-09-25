// QA: turn the sound on, travel through every world, and fire every sound effect; nothing
// may throw, and the output must actually carry sound. Usage: RECREATION_URL=… node qa/sound.mjs
import { openSite } from './browser.mjs';
const { browser, page, logs } = await openSite('recreation', { width: 1280, height: 800, query: 'qa=1&tier=low' });
await page.evaluate(() => __events.emit('toggleAudio'));
const levels = {};
for (const sec of ['intro', 'manifesto', 'work', 'lab', 'portal', 'outro']) {
  await page.evaluate((sec) => { const el = document.querySelector(`.scroll-spacer [data-section="${sec}"]`); const y = Math.round(el.offsetTop + 0.8 * el.offsetHeight); scrollTo(0, y); const s = __state.scroll; s.position = s.target = y; __exp.scroll.update(0); __exp.rig.snap(); }, sec);
  await page.waitForTimeout(2500);
  levels[sec] = +(await page.evaluate(() => __state.audioLevel)).toFixed(3);
}
for (const k of ['open', 'seal', 'gift', 'snuff', 'lantern', 'door', 'star', 'wrong', 'leak', 'firework']) {
  await page.evaluate((k) => __events.emit('sfx', k), k);
  await page.waitForTimeout(500);
}
await page.evaluate(() => __events.emit('birthdayMidnight'));
await page.waitForTimeout(3000);
console.log(JSON.stringify({ audioOn: await page.evaluate(() => document.querySelector('.ticker button, .audio-toggle')?.textContent), levels, errors: logs.filter((l) => /error/i.test(l)).slice(0, 5) }));
await browser.close();

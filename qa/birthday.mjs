// QA: the birthday countdown and the midnight surprise, with a pretend clock (?now=…).
// Usage: RECREATION_URL=… node qa/birthday.mjs [w h]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800;
fs.mkdirSync('qa/out/birthday', { recursive: true });
const out = {};
const run = async (name, now, fn) => {
  const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: `qa=1&tier=low&now=${now}` });
  await page.evaluate(() => { try { localStorage.removeItem('bday-midnight-seen'); } catch {} });
  out[name] = await fn(page);
  out[name].errors = logs.filter((l) => /error/i.test(l)).slice(0, 3);
  await browser.close();
};
const shot = (page, n) => page.screenshot({ path: `qa/out/birthday/${W}-${n}.png` });
await run('before', '2026-11-10T09:30:00', async (page) => {
  await page.waitForTimeout(3500);
  await shot(page, '1-countdown');
  return { countdown: await page.evaluate(() => document.querySelector('.countdown')?.textContent), surprise: await page.evaluate(() => !!document.querySelector('.midnight')) };
});
await run('midnight', '2026-11-24T23:59:54', async (page) => {
  const before = await page.evaluate(() => document.querySelector('.countdown')?.textContent);
  const ok = await page.waitForSelector('.midnight', { timeout: 30000 }).then(() => true, () => false);
  await page.waitForTimeout(6500);
  await shot(page, '2-midnight');
  const today = await page.evaluate(() => document.querySelector('.countdown')?.textContent);
  await page.click('.midnight__go');
  await page.waitForTimeout(800);
  return { before, surprise: ok, closed: await page.evaluate(() => !document.querySelector('.midnight')), today };
});
await run('onTheDay', '2026-11-25T10:00:00', async (page) => {
  const first = await page.waitForSelector('.midnight', { timeout: 30000 }).then(() => true, () => false);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => window.__state && __state.reveal >= 1, null, { timeout: 600000 });
  await page.waitForTimeout(4000);
  return { first, againAfterReload: await page.evaluate(() => !!document.querySelector('.midnight')) };
});
await run('after', '2026-11-27T10:00:00', async (page) => {
  await page.waitForTimeout(3500);
  return { countdown: await page.evaluate(() => document.querySelector('.countdown')?.textContent), surprise: await page.evaluate(() => !!document.querySelector('.midnight')) };
});
console.log(JSON.stringify(out, null, 1));

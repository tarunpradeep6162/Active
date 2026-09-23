// QA: with a vault deployed, the gate rejects a wrong passcode and the right one decrypts.
// Usage: RECREATION_URL=… node qa/vaultcheck.mjs "<passcode>" "<expected beginning line>"
import { openSite } from './browser.mjs';
const [pass, expected] = process.argv.slice(2);
const { browser, page, logs } = await openSite('recreation', { width: 1280, height: 800, query: 'qa=1&tier=low' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.evaluate(() => { history.pushState({}, '', '/work/the-beginning'); dispatchEvent(new PopStateEvent('popstate')); });
await page.waitForSelector('.bd-gate', { timeout: 240000 });
await page.fill('#bd-pass', 'definitely wrong');
await page.click('.bd-gate button[type=submit]');
await page.waitForSelector('.bd-gate .bd-soft', { timeout: 60000 });
await page.fill('#bd-pass', pass);
await page.click('.bd-gate button[type=submit]');
await page.waitForSelector('.bd-beginning', { timeout: 60000 });
await page.click('.bd-star'); await page.click('.bd-star');
const ok = await page.waitForFunction((t) => document.querySelector('.bd-line')?.textContent === t, expected, { timeout: 30000 }).then(() => true, () => false);
const errors = logs.filter((l) => /error/i.test(l));
console.log(JSON.stringify({ wrongRejected: true, decrypted: ok, errors }));
await browser.close();
process.exit(ok && !errors.length ? 0 : 1);

// QA: scroll the whole journey top → bottom → top in 2.5 % steps, then walk the routes and
// history; report every console error / page error and the sections reached.
// Usage: RECREATION_URL=… node qa/sweep.mjs [w h]
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1440, H = +process.argv[3] || 900;
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low' });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
const seen = new Set();
const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
for (const dir of [1, -1]) {
  for (let k = 0; k <= 40; k++) {
    const p = dir > 0 ? k / 40 : 1 - k / 40;
    await page.evaluate((y) => scrollTo(0, y), Math.round(p * max));
    await page.waitForTimeout(350);
    seen.add(await page.evaluate(() => __state.section));
  }
}
const nav = [];
// each navigation must actually arrive (transitions run on the capped animation clock, so wait for
// the route + an idle transition rather than a fixed time)
const expect = { '/work': 'work', '/contact': 'contact', '/': 'home' };
const arrive = async (want) => {
  const t0 = Date.now();
  const ok = await page.waitForFunction((w) => __state.route.name === w && __state.transition.phase === 'IDLE', want, { timeout: 180000 }).then(() => true, () => false);
  return `${want}: ${ok ? 'arrived' : 'NEVER ARRIVED'} in ${Math.round((Date.now() - t0) / 1000)}s`;
};
for (const path of ['/work', '/work/music-room', '/contact', '/', '/work/for-dheepika', '/work']) {
  await page.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')); }, path);
  nav.push(`${path} → ${await arrive(expect[path] ?? 'project')}`);
}
await page.goBack(); nav.push('back → ' + (await arrive('project')));
await page.goForward(); nav.push('forward → ' + (await arrive('work')));
const errors = logs.filter((l) => /error/i.test(l));
console.log(JSON.stringify({ viewport: [W, H], sections: [...seen], nav, errors }, null, 1));
await browser.close();
process.exit(errors.length ? 1 : 0);

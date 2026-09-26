// QA: one frame per journey moment, in a single page load (after the cage opens where asked).
// Usage: RECREATION_URL=… node qa/shots.mjs [w h] [tag] [sec:l[:open],…]
import fs from 'node:fs';
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800, tag = process.argv[4] || 'a';
const list = (process.argv[5] || 'intro:0.02,intro:0.5,manifesto:0.5,work:0.3,work:0.8,lab:0.6,lab:0.6:open,portal:0.5,outro:0.6,outro:0.97').split(',');
fs.mkdirSync('qa/out/shots', { recursive: true });
const { browser, page, logs } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: `qa=1&tier=${process.env.TIER || 'medium'}` });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
const files = [];
for (const item of list) {
  const [sec, l, act] = item.split(':');
  await page.evaluate(([sec, l]) => {
    const el = document.querySelector(`.scroll-spacer [data-section="${sec}"]`);
    const y = Math.min(document.documentElement.scrollHeight - innerHeight, Math.round(el.offsetTop + l * el.offsetHeight));
    scrollTo(0, y); const s = __state.scroll; s.position = s.target = y; s.velocity = 0; __exp.scroll.update(0); __exp.rig.snap();
  }, [sec, +l]);
  if (act === 'open') await page.evaluate(() => __events.emit('openCage'));
  // advance the world's own clock (the software renderer is far slower than real time), so
  // focus pulls, fades and the cage have really finished
  await page.evaluate((ms) => { __exp.qaStep(ms, 50); __exp.qaResume(); }, act === 'open' ? 7000 : 2500);
  await page.waitForTimeout(800);
  const f = `qa/out/shots/${tag}-${W}-${sec}-${Math.round(+l * 100)}${act ? '-' + act : ''}.png`;
  await page.screenshot({ path: f });
  files.push(f);
}
console.log(JSON.stringify({ W, files, errors: logs.filter((l) => /error/i.test(l)).slice(0, 5) }));
await browser.close();

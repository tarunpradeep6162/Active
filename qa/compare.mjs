// Usage: node qa/compare.mjs <width> <height> [mobile] [samples=all|quick]
// Captures both sites at identical normalised scroll positions, then writes
// reference / ours / side-by-side / diff frames and a JSON summary to qa/out/<w>x<h>/.
import fs from 'node:fs';
import path from 'node:path';
import { openSite, scrollTo, metrics } from './browser.mjs';
import { compose } from './diff.mjs';

const [W, H] = [+process.argv[2] || 1440, +process.argv[3] || 900];
const mobile = process.argv[4] === 'mobile';
const set = process.argv[5] || 'all';
const ALL = [0, 0.03, 0.06, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1];
const QUICK = [0, 0.1, 0.2, 0.3, 0.5, 0.75, 0.8, 1];
const samples = process.env.SAMPLES ? process.env.SAMPLES.split(',').map(Number) : set === 'quick' ? QUICK : ALL;
const only = process.env.ONLY; // 'reference' | 'ours'
const out = path.resolve(`qa/out/${W}x${H}`);
fs.mkdirSync(out, { recursive: true });
const summary = { viewport: [W, H], mobile, samples, sites: {} };

for (const site of ['reference', 'ours']) {
  if (only && only !== site) continue;
  const { browser, page, logs } = await openSite(site === 'ours' ? 'recreation' : 'reference', { width: W, height: H, mobile, query: site === 'ours' ? 'qa=1&tier=high' : '' });
  summary.sites[site] = { metrics: await metrics(site === 'ours' ? 'recreation' : 'reference', page) };
  for (const f of samples) {
    await scrollTo(site === 'ours' ? 'recreation' : 'reference', page, f);
    await page.screenshot({ path: path.join(out, `${site}_${f.toFixed(2)}.png`) });
  }
  summary.sites[site].logs = logs.slice(0, 20);
  await browser.close();
}
const pairs = samples.filter((f) => fs.existsSync(path.join(out, `reference_${f.toFixed(2)}.png`)) && fs.existsSync(path.join(out, `ours_${f.toFixed(2)}.png`)))
  .map((f) => ({ name: f.toFixed(2), ref: path.join(out, `reference_${f.toFixed(2)}.png`), ours: path.join(out, `ours_${f.toFixed(2)}.png`) }));
summary.diff = await compose(pairs, out);
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 1));

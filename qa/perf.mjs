// QA: draw calls, triangles, points and frame time in each world (software GL: compare, don't trust ms).
// Usage: RECREATION_URL=… node qa/perf.mjs [w h] [tier]
import { openSite } from './browser.mjs';
const W = +process.argv[2] || 1280, H = +process.argv[3] || 800, tier = process.argv[4] || 'medium';
const { browser, page } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: `qa=1&tier=${tier}` });
const rows = [];
for (const [sec, l] of [['intro', 0.3], ['manifesto', 0.4], ['work', 0.2], ['work', 0.6], ['lab', 0.6], ['portal', 0.5], ['outro', 0.7]]) {
  await page.evaluate(([sec, l]) => {
    const el = document.querySelector(`.scroll-spacer [data-section="${sec}"]`);
    const y = Math.min(document.documentElement.scrollHeight - innerHeight, Math.round(el.offsetTop + l * el.offsetHeight));
    scrollTo(0, y); const s = __state.scroll; s.position = s.target = y; s.velocity = 0; __exp.scroll.update(0); __exp.rig.snap();
  }, [sec, l]);
  await page.waitForTimeout(2500);
  rows.push(await page.evaluate((name) => new Promise((res) => {
    const t0 = performance.now(); let n = 0;
    const f = () => { n++; if (n < 20) requestAnimationFrame(f); else {
      const i = __exp.renderer.info.render;
      let vis = 0; __exp.world.scene.traverseVisible(() => vis++);
      res({ at: name, calls: i.calls, tris: i.triangles, pts: i.points, visibleObjects: vis, msPerFrame: +((performance.now() - t0) / n).toFixed(1) });
    } };
    requestAnimationFrame(f);
  }), `${sec} ${l}`));
}
console.table(rows);
await browser.close();

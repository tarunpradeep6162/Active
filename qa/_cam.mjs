import { openSite } from './browser.mjs';
const W = +process.argv[2], H = +process.argv[3];
const { browser, page } = await openSite('recreation', { width: W, height: H, mobile: W < 600, query: 'qa=1&tier=low' });
const out = [];
for (const [sec, l] of [['work', 0.86], ['work', 0.9], ['work', 0.95], ['work', 0.99], ['lab', 0.0], ['lab', 0.05], ['lab', 0.15], ['lab', 0.3]]) {
  out.push(await page.evaluate(([sec, l]) => {
    const el = document.querySelector(`.scroll-spacer [data-section="${sec}"]`);
    const y = Math.round(el.offsetTop + l * el.offsetHeight);
    scrollTo(0, y); const s = __state.scroll; s.position = s.target = y; s.velocity = 0; __exp.scroll.update(0); __exp.rig.snap();
    __exp.qaStep(300, 50);
    const r = __exp.rig, c = r.camera, f = (v) => v.toArray().map((x) => x.toFixed(1)).join(',');
    const d = new c.position.constructor(); c.getWorldDirection(d);
    return `${sec}${l} p=${__state.scroll.progress.toFixed(3)} cam=${f(c.position)} dir=${f(d)} edge=${r.overlayEdge?.toFixed?.(2)} ocam=${f(r.overlayCamera.position)} labVis=${__exp.world.lab.group.visible} gardenVis=${__exp.world.garden.group.visible}`;
  }, [sec, l]));
}
console.log(out.join('\n'));
await browser.close();

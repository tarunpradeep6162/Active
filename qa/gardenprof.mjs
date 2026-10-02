// QA: what each layer of a scene costs to draw (software GL, so read the numbers relative to
// each other): the full frame, then the frame with each top-level object hidden in turn.
// Usage: RECREATION_URL=… node qa/gardenprof.mjs [sec] [l] [dpr]
import { chromium } from 'playwright';
const SEC = process.argv[2] || 'work', L = +(process.argv[3] || 0.4), DPR = +(process.argv[4] || 2);
const URL = (process.env.RECREATION_URL || 'http://localhost:4173/') + '?qa=1&tier=medium';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 15; CPH2487) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36' });
const page = await ctx.newPage();
await page.goto(URL);
await page.waitForFunction(() => window.__state && __state.reveal >= 1, null, { timeout: 600000 });
const out = await page.evaluate(([sec, l, dpr]) => {
  const el = document.querySelector(`.scroll-spacer [data-section="${sec}"]`);
  const y = Math.min(document.documentElement.scrollHeight - innerHeight, Math.round(el.offsetTop + l * el.offsetHeight));
  scrollTo(0, y); const s = __state.scroll; s.position = s.target = y; s.velocity = 0; __exp.scroll.update(0); __exp.rig.snap();
  const exp = __exp;
  exp.settings.dpr = dpr; exp.sized = ''; exp.resize();
  exp.qaStep(800, 50);
  const r = exp.renderer, gl = r.getContext(), cam = exp.rig.camera, scene = exp.world.scene, post = exp.post;
  const px = new Uint8Array(4); const sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const time = (fn, n = 3) => { fn(); sync(); const a = performance.now(); for (let i = 0; i < n; i++) { fn(); sync(); } return (performance.now() - a) / n; };
  const sceneOnly = () => { r.setRenderTarget(post.sceneRT); r.render(scene, cam); };
  const full = () => { post.render(scene, cam); r.setRenderTarget(null); };
  const rows = [];
  time(sceneOnly, 2); time(full, 1);
  const base = time(sceneOnly), fullT = time(full);
  rows.push({ what: 'scene again', ms: +time(sceneOnly).toFixed(1) });
  rows.push({ what: 'scene only', ms: +base.toFixed(1) }, { what: 'scene + post', ms: +fullT.toFixed(1) });
  const items = [];
  scene.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine) && o.visible) { let p = o, vis = true; while (p) { if (!p.visible) vis = false; p = p.parent; } if (vis) items.push(o); } });
  for (const o of items) {
    o.visible = false; const t = time(sceneOnly, 2); o.visible = true;
    const g = o.geometry; const n = g.index ? g.index.count / 3 : g.attributes.position.count;
    rows.push({ what: `${o.type} ${o.name || o.material?.name || ''} ${o.isPoints ? 'pts' : 'tris'}=${Math.round(n * (o.count || 1))}`.slice(0, 70), ms: +(base - t).toFixed(1), parent: o.parent?.type });
  }
  return { dpr, buf: [r.domElement.width, r.domElement.height], rows: rows.sort((a, b) => b.ms - a.ms).slice(0, 25) };
}, [SEC, L, DPR]);
console.log(JSON.stringify({ dpr: out.dpr, buf: out.buf }));
console.table(out.rows);
await browser.close();

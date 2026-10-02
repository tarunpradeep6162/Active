// QA: where a frame's draw time goes (software GL: compare rows, don't trust absolute ms).
// Usage: RECREATION_URL=… node qa/postprof.mjs [sec] [l] [dpr]
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
  const r = exp.renderer, gl = r.getContext(), cam = exp.rig.camera, scene = exp.world.scene, post = exp.post, cu = post.composite.uniforms;
  const px = new Uint8Array(4);
  const frame = () => { post.render(scene, cam); r.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  const time = (n = 3) => { frame(); const a = performance.now(); for (let i = 0; i < n; i++) frame(); return +((performance.now() - a) / n).toFixed(0); };
  const rows = { uniforms: { rays: cu.uRays.value, streak: cu.uStreak.value, season: cu.uSeason.value.y, rain: cu.uRain.value, blur: cu.uBlur.value } };
  rows.full = time();
  const keep = { rays: cu.uRays.value, streak: cu.uStreak.value, season: cu.uSeason.value.y };
  cu.uRays.value = 0; rows.noRays = time(); cu.uRays.value = keep.rays;
  cu.uStreak.value = 0; rows.noStreak = time(); cu.uStreak.value = keep.streak;
  cu.uSeason.value.y = 0; rows.noSeason = time(); cu.uSeason.value.y = keep.season;
  const b = post.settings.bloom; post.settings.bloom = false; cu.uHasBloom.value = 0; rows.noBloom = time(); post.settings.bloom = b; cu.uHasBloom.value = 1;
  exp.world.root.visible = false; rows.emptyScene = time(); exp.world.root.visible = true;
  // the scene by layer groups (top-level children of the world root)
  const kids = exp.world.root.children.filter((o) => o.visible);
  rows.layers = kids.map((o) => { o.visible = false; const t = time(2); o.visible = true; let n = 0; o.traverse(() => n++); return { name: o.name || o.type, objects: n, savedMs: rows.full - t }; }).sort((a, b) => b.savedMs - a.savedMs);
  const sceneKids = scene.children.filter((o) => o.visible && o !== exp.world.root);
  rows.sceneLevel = sceneKids.map((o) => { o.visible = false; const t = time(2); o.visible = true; return { name: o.name || o.type, mat: o.material?.type, savedMs: rows.full - t }; }).sort((a, b) => b.savedMs - a.savedMs);
  return rows;
}, [SEC, L, DPR]);
console.log(JSON.stringify(out, null, 1));
await browser.close();

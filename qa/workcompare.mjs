// Frame-by-frame Work comparison: REFERENCE | OURS | 50/50 OVERLAY | DIFFERENCE,
// plus geometric error metrics from both work maps. Usage: node qa/workcompare.mjs [w h]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const W = +process.argv[2] || 1440, H = +process.argv[3] || 900;
const refDir = path.resolve(`qa/out/workmap_reference_${W}x${H}`), ourDir = path.resolve(`qa/out/workmap_ours_${W}x${H}`);
const outDir = path.resolve(`qa/out/workcompare_${W}x${H}`);
fs.mkdirSync(outDir, { recursive: true });
const load = (dir) => {
  // main map plus any tagged extra captures (e.g. _seam) in sibling folders
  const frames = [];
  // later dirs win on duplicate p keys: main, then tagged dirs sorted (…_seam < …_v2), so a re-measure overrides
  const tagged = fs.readdirSync(path.dirname(dir)).filter((n) => n.startsWith(path.basename(dir) + '_')).sort();
  for (const d of [dir, ...tagged.map((n) => path.join(path.dirname(dir), n))]) {
    const f = path.join(d, 'map.json');
    if (fs.existsSync(f)) for (const fr of JSON.parse(fs.readFileSync(f)).frames) frames.push({ ...fr, dir: d, site: path.basename(dir).includes('reference') ? 'reference' : 'ours' });
  }
  return new Map(frames.map((f) => [f.p.toFixed(3), f]));
};
const R = load(refDir), O = load(ourDir);

const orbit = (f) => { const [x, y, z] = f.cam.pos; return { ang: (Math.atan2(z, x) * 180) / Math.PI, y, r: Math.hypot(x, z) }; };
const focus = (f) => {
  // the card nearest the camera that is on screen = the "current" project
  const k = [...f.cards].filter((c) => c.depth > 0).sort((a, b) => a.depth - b.depth)[0];
  if (!k) return null;
  const xs = k.corners.map((c) => c[0]), ys = k.corners.map((c) => c[1]);
  // older reference captures measured the ±0.5 transform box; the visible geometry spans ±0.38 of it
  const s = f.cornerExtent ? 1 : f.site === 'reference' ? 0.76 : 1;
  return { x: k.x, y: k.y, w: (Math.max(...xs) - Math.min(...xs)) * s, h: (Math.max(...ys) - Math.min(...ys)) * s, depth: k.depth };
};
const wrap = (d) => ((d + 540) % 360) - 180;

const rows = [];
for (const [key, rf] of [...R].sort((a, b) => +a[0] - +b[0])) {
  const of = O.get(key);
  if (!of) continue;
  const ro = orbit(rf), oo = orbit(of), rc = focus(rf), oc = focus(of);
  rows.push({
    p: +key,
    // camera: our world has the work scene at WORK_ORIGIN.y = −60
    camAngErr: +wrap(oo.ang - ro.ang).toFixed(1), camYErr: +(oo.y + 60 - ro.y).toFixed(2), camRErr: +(oo.r - ro.r).toFixed(2), fovErr: +(of.cam.fov - rf.cam.fov).toFixed(1),
    ref: rc && { x: rc.x, y: rc.y, w: +rc.w.toFixed(0), h: +rc.h.toFixed(0) }, ours: oc && { x: oc.x, y: oc.y, w: +oc.w.toFixed(0), h: +oc.h.toFixed(0) },
    cardXErr: rc && oc ? +(oc.x - rc.x).toFixed(0) : null, cardYErr: rc && oc ? +(oc.y - rc.y).toFixed(0) : null, cardWErr: rc && oc ? +(oc.w - rc.w).toFixed(0) : null,
    spineXErr: rf.spineOnScreen && of.spineOnScreen ? +(((of.spineOnScreen.xTop + of.spineOnScreen.xBottom) - (rf.spineOnScreen.xTop + rf.spineOnScreen.xBottom)) / 2).toFixed(0) : null,
  });
}
const abs = (k) => { const v = rows.map((r) => r[k]).filter((x) => x != null).map(Math.abs); return v.length ? { mean: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2), max: +Math.max(...v).toFixed(2) } : null; };
const summary = { frames: rows.length, camAngErr: abs('camAngErr'), camYErr: abs('camYErr'), camRErr: abs('camRErr'), cardXErr: abs('cardXErr'), cardYErr: abs('cardYErr'), cardWErr: abs('cardWErr'), spineXErr: abs('spineXErr') };
fs.writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify({ summary, rows }, null, 1));

// four-panel images
const b = await chromium.launch();
const pg = await b.newPage();
for (const r of rows) {
  const name = `work-reference-${String(Math.round(r.p * 1000)).padStart(4, '0')}`;
  const on = name.replace('reference', 'ours');
  const a = path.join(R.get(r.p.toFixed(3)).dir, name + '.png'), o = path.join(O.get(r.p.toFixed(3)).dir, on + '.png');
  if (!fs.existsSync(a) || !fs.existsSync(o)) continue;
  const data = await pg.evaluate(async ({ a, o, label }) => {
    const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = s; });
    const [A, O] = await Promise.all([load(a), load(o)]);
    const w = 720, h = Math.round((A.height / A.width) * 720);
    const c = document.createElement('canvas'); c.width = w * 2 + 6; c.height = h * 2 + 6;
    const x = c.getContext('2d'); x.fillStyle = '#222'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(A, 0, 0, w, h); x.drawImage(O, w + 6, 0, w, h);
    x.drawImage(A, 0, h + 6, w, h); x.globalAlpha = 0.5; x.drawImage(O, 0, h + 6, w, h); x.globalAlpha = 1;
    // difference
    const t1 = document.createElement('canvas'); t1.width = w; t1.height = h; const y1 = t1.getContext('2d'); y1.drawImage(A, 0, 0, w, h);
    const t2 = document.createElement('canvas'); t2.width = w; t2.height = h; const y2 = t2.getContext('2d'); y2.drawImage(O, 0, 0, w, h);
    const d1 = y1.getImageData(0, 0, w, h), d2 = y2.getImageData(0, 0, w, h);
    for (let i = 0; i < d1.data.length; i += 4) { const d = (Math.abs(d1.data[i] - d2.data[i]) + Math.abs(d1.data[i + 1] - d2.data[i + 1]) + Math.abs(d1.data[i + 2] - d2.data[i + 2])) / 3; d1.data[i] = Math.min(255, d * 3); d1.data[i + 1] = d * 1.2; d1.data[i + 2] = 255 - Math.min(255, d * 3); }
    y1.putImageData(d1, 0, 0); x.drawImage(t1, w + 6, h + 6);
    x.fillStyle = '#ff0'; x.font = '15px monospace';
    x.fillText('REFERENCE', 8, 20); x.fillText('OURS', w + 14, 20); x.fillText('50/50 OVERLAY', 8, h + 26); x.fillText('DIFFERENCE', w + 14, h + 26); x.fillText(label, 8, h - 8);
    return c.toDataURL('image/png');
  }, { a: 'data:image/png;base64,' + fs.readFileSync(a).toString('base64'), o: 'data:image/png;base64,' + fs.readFileSync(o).toString('base64'), label: `work p=${r.p.toFixed(2)}  camAng ${r.camAngErr}°  camY ${r.camYErr}  card dx ${r.cardXErr} dy ${r.cardYErr} dw ${r.cardWErr}` });
  fs.writeFileSync(path.join(outDir, `work-compare-${String(Math.round(r.p * 1000)).padStart(4, '0')}.png`), Buffer.from(data.split(',')[1], 'base64'));
}
await b.close();
console.log(JSON.stringify(summary, null, 1));

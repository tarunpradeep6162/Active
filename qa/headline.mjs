// QA helper: vertical extent of the big headline in captured frames (the reference renders it
// in WebGL, so it has no DOM box). Counts near‑white pixels per row inside the headline column.
// Usage: node qa/headline.mjs x0 x1 frame.png ...   → JSON rows { file, top, bottom } in px
import fs from 'node:fs';
import { chromium } from 'playwright';

const [x0, x1, ...files] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage();
const out = [];
for (const f of files) {
  const r = await p.evaluate(async ({ src, x0, x1 }) => {
    const im = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = src; });
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0);
    const d = g.getImageData(x0, 0, x1 - x0, im.height).data, w = x1 - x0;
    const rows = [];
    for (let y = 0; y < im.height; y++) {
      let n = 0;
      for (let x = 0; x < w; x++) { const k = (y * w + x) * 4; if (d[k] > 215 && d[k + 1] > 215 && d[k + 2] > 215) n++; }
      rows.push(n);
    }
    // headline rows: long runs of white text strokes; ignore isolated specular pixels
    const hit = rows.map((n) => n >= 14);
    let top = -1, bottom = -1;
    for (let y = 0; y < hit.length; y++) if (hit[y]) { if (top < 0) top = y; bottom = y; }
    return { top, bottom, h: im.height };
  }, { src: 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'), x0: +x0, x1: +x1 });
  out.push({ file: f.split('/').pop(), ...r });
}
await b.close();
console.log(JSON.stringify(out));

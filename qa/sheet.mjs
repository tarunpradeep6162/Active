// QA helper: contact sheet of local frames (output stays in git-ignored qa/out).
// contact sheet: node sheet.mjs out.png cols img1 img2 ...
import fs from 'node:fs';
import { chromium } from 'playwright';
const [out, cols, ...imgs] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage();
const data = await p.evaluate(async ({ srcs, cols }) => {
  const ims = await Promise.all(srcs.map(([s, l]) => new Promise((r) => { const i = new Image(); i.onload = () => r([i, l]); i.src = s; })));
  const w = 480, h = Math.round(w * ims[0][0].height / ims[0][0].width), c = document.createElement('canvas');
  c.width = cols * w; c.height = Math.ceil(ims.length / cols) * h; const x = c.getContext('2d');
  ims.forEach(([im, l], k) => { x.drawImage(im, (k % cols) * w, Math.floor(k / cols) * h, w, h); x.fillStyle = '#ff0'; x.font = '16px monospace'; x.fillText(l, (k % cols) * w + 6, Math.floor(k / cols) * h + 18); });
  return c.toDataURL('image/png');
}, { srcs: imgs.map((f) => ['data:image/png;base64,' + fs.readFileSync(f).toString('base64'), f.split('/').pop()]), cols: +cols });
fs.writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'));
await b.close();

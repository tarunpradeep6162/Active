// Side-by-side + per-pixel difference images rendered in a headless page (no native deps).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

export async function compose(pairs, outDir) {
  const b = await chromium.launch();
  const p = await b.newPage();
  const results = [];
  for (const { name, ref, ours } of pairs) {
    const a = 'data:image/png;base64,' + fs.readFileSync(ref).toString('base64');
    const c = 'data:image/png;base64,' + fs.readFileSync(ours).toString('base64');
    const r = await p.evaluate(async ({ a, c }) => {
      const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = s; });
      const [A, C] = await Promise.all([load(a), load(c)]);
      const w = A.width, h = A.height;
      const cv = (W, H) => { const k = document.createElement('canvas'); k.width = W; k.height = H; return k; };
      const ca = cv(w, h), cc = cv(w, h), cd = cv(w, h), cs = cv(w * 2 + 8, h);
      const xa = ca.getContext('2d'), xc = cc.getContext('2d'), xd = cd.getContext('2d'), xs = cs.getContext('2d');
      xa.drawImage(A, 0, 0); xc.drawImage(C, 0, 0, w, h);
      const da = xa.getImageData(0, 0, w, h), dc = xc.getImageData(0, 0, w, h), dd = xd.createImageData(w, h);
      let sum = 0, la = 0, lc = 0;
      for (let i = 0; i < da.data.length; i += 4) {
        const d = (Math.abs(da.data[i] - dc.data[i]) + Math.abs(da.data[i + 1] - dc.data[i + 1]) + Math.abs(da.data[i + 2] - dc.data[i + 2])) / 3;
        sum += d;
        la += (da.data[i] * 0.2126 + da.data[i + 1] * 0.7152 + da.data[i + 2] * 0.0722);
        lc += (dc.data[i] * 0.2126 + dc.data[i + 1] * 0.7152 + dc.data[i + 2] * 0.0722);
        const v = Math.min(255, d * 3);
        dd.data[i] = v; dd.data[i + 1] = v * 0.4; dd.data[i + 2] = 255 - v; dd.data[i + 3] = 255;
      }
      xd.putImageData(dd, 0, 0);
      xs.fillStyle = '#222'; xs.fillRect(0, 0, cs.width, h); xs.drawImage(A, 0, 0, w, h); xs.drawImage(C, w + 8, 0, w, h);
      xs.fillStyle = '#ff0'; xs.font = '16px monospace'; xs.fillText('REFERENCE', 8, 20); xs.fillText('OURS', w + 16, 20);
      const n = da.data.length / 4;
      return { side: cs.toDataURL('image/png'), diff: cd.toDataURL('image/png'), meanDiff: sum / n, lumaRef: la / n, lumaOurs: lc / n };
    }, { a, c });
    fs.writeFileSync(path.join(outDir, `${name}_side.png`), Buffer.from(r.side.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(outDir, `${name}_diff.png`), Buffer.from(r.diff.split(',')[1], 'base64'));
    results.push({ name, meanDiff: +r.meanDiff.toFixed(1), lumaRef: +r.lumaRef.toFixed(1), lumaOurs: +r.lumaOurs.toFixed(1) });
  }
  await b.close();
  return results;
}

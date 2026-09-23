// Regenerates the measured Work camera table in src/work/workCameraData.ts from reference
// work maps (qa/workmap.mjs output). Rows: [p, orbit angle (deg, unwrapped), height, radius,
// heading offset (deg: how far the camera's aim is turned away from the axis)].
// Card centres are where the unwrapped orbit angle crosses stepDeg · i.
// Usage: node qa/worktable.mjs desktop|phone <mapDir> [<mapDir> …]   (later dirs win per p)
import fs from 'node:fs';
import path from 'node:path';

const [device, ...dirs] = process.argv.slice(2);
const phone = device === 'phone';
const stepDeg = phone ? -35 : -50;
const frames = new Map();
for (const d of dirs) for (const f of JSON.parse(fs.readFileSync(path.join(d, 'map.json'))).frames) frames.set(f.p.toFixed(3), f);
const sorted = [...frames.values()].sort((a, b) => a.p - b.p);

let prev = null, acc = 0;
const rows = sorted.map((f) => {
  const [x, y, z] = f.cam.pos, [fx, , fz] = f.cam.fwd;
  let ang = (Math.atan2(z, x) * 180) / Math.PI;
  if (prev !== null) { let d = ang - prev; d = ((d + 540) % 360) - 180; acc += d; } else acc = ang;
  prev = ang;
  const yaw = ((((Math.atan2(fz, fx) - Math.atan2(-z, -x)) * 180) / Math.PI + 540) % 360) - 180;
  return [+f.p.toFixed(3), +acc.toFixed(2), +y.toFixed(3), +Math.hypot(x, z).toFixed(3), +yaw.toFixed(2), f.settledAfter];
});
// the table must be uniformly spaced for the sampler
const step = +(rows[1][0] - rows[0][0]).toFixed(3);
rows.forEach((r, i) => { if (Math.abs(r[0] - (rows[0][0] + i * step)) > 1e-6) throw new Error(`gap at ${r[0]}`); });

const centres = [0.002];
for (let i = 1; i < 14; i++) {
  const target = stepDeg * i;
  let found = null;
  for (let k = 1; k < rows.length && found === null; k++) {
    const [p0, a0] = rows[k - 1], [p1, a1] = rows[k];
    if ((a0 - target) * (a1 - target) <= 0 && a0 !== a1) found = p0 + ((target - a0) / (a1 - a0)) * (p1 - p0);
  }
  centres.push(found === null ? rows[rows.length - 1][0] : +found.toFixed(4));
}

const name = phone ? 'PHONE' : 'DESKTOP';
const body = rows.map((r) => `  [${r.slice(0, 5).join(', ')}],${r[5] < 0 ? ' // first frame after the jump (not settled by frame count)' : ''}`).join('\n');
const file = path.resolve('src/work/workCameraData.ts');
let src = fs.readFileSync(file, 'utf8');
const tableRe = new RegExp(`(export const WORK_CAMERA_${name}: [^=]+= \\[\\n)[\\s\\S]*?(\\n\\];)`);
if (!tableRe.test(src)) throw new Error('table not found');
src = src.replace(tableRe, `$1${body}$2`);
src = src.replace(new RegExp(`export const CARD_CENTRES_${name} = \\[[^\\]]*\\];`), `export const CARD_CENTRES_${name} = [${centres.join(', ')}];`);
fs.writeFileSync(file, src);
console.log(`${name}: ${rows.length} rows ${rows[0][0]}…${rows[rows.length - 1][0]}, total orbit ${rows[rows.length - 1][1]}°`);
console.log('card centres', centres.join(', '));

/// <reference lib="webworker" />
/**
 * Generates particle attribute buffers off the main thread.
 * position: xyz, seed: 4 random values (w used as size factor), both transferred.
 */
import { rng } from '../utils/math';

export type ParticleKind = 'embers' | 'storm' | 'glitter' | 'blob' | 'dust' | 'specks';
export interface ParticleRequest {
  id: string;
  kind: ParticleKind;
  count: number;
  seed: number;
  /** y range */
  y0: number;
  y1: number;
}
export interface ParticleResult {
  id: string;
  position: Float32Array;
  seed: Float32Array;
}

function gauss(r: () => number) {
  return (r() + r() + r() + r() - 2) / 2;
}

function build(req: ParticleRequest): ParticleResult {
  const r = rng(req.seed);
  const n = req.count;
  const position = new Float32Array(n * 3);
  const seed = new Float32Array(n * 4);
  const { y0, y1 } = req;
  // cluster centres for clumpy distributions
  const clusters: number[][] = [];
  for (let c = 0; c < 48; c++) clusters.push([gauss(r) * 5, y0 + (y1 - y0) * r(), gauss(r) * 3 - 1, 0.6 + r() * 2.4]);
  // storms hug the emblem: denser low and toward the centre
  if (req.kind === 'storm') clusters.forEach((c) => ((c[0] *= 2), (c[1] = y0 + (y1 - y0) * Math.pow(r(), 1.4)), (c[3] *= 0.9)));

  // coral clusters beside the spine (alternating sides, irregular sizes)
  const coral: { lobes: number[][] }[] = [];
  if (req.kind === 'glitter') {
    for (let yy = y1; yy > y0; yy -= 2.2 + r() * 2.8) {
      const side = r() < 0.5 ? -1 : 1;
      const cx = side * (0.9 + r() * 1.5), cz = -0.6 + r() * 1.4, size = 0.45 + r() * 0.9;
      const lobes: number[][] = [];
      const nl = 4 + ((r() * 6) | 0);
      for (let l = 0; l < nl; l++) lobes.push([cx + gauss(r) * size, yy + gauss(r) * size * 1.3, cz + gauss(r) * size * 0.7, size * (0.3 + r() * 0.45)]);
      coral.push({ lobes });
    }
  }
  const blobLobes: number[][] = [];
  if (req.kind === 'blob') {
    // hanging crescent cocoon: lobes along a half‑ring, thickest at the bottom
    const cy = (y0 + y1) / 2 + 0.4;
    for (let l = 0; l < 34; l++) {
      const a = -Math.PI * 0.95 + r() * Math.PI * 1.1; // from upper‑left, round the bottom, to the right
      const R = 1.0 + gauss(r) * 0.08;
      const thick = 0.18 + 0.32 * Math.max(0, -Math.sin(a));
      blobLobes.push([Math.cos(a) * R * 0.9 + 0.1, cy + Math.sin(a) * R * 1.05, gauss(r) * 0.25, thick * (0.7 + r() * 0.6)]);
    }
  }
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0, z = 0;
    switch (req.kind) {
      case 'embers': {
        // loose field around the emblem, denser low in frame
        x = gauss(r) * 7;
        y = y0 + (y1 - y0) * Math.pow(r(), 1.6);
        z = gauss(r) * 4 - 1;
        break;
      }
      case 'storm': {
        const c = clusters[(r() * clusters.length) | 0];
        const rad = c[3] * Math.pow(r(), 0.6);
        const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
        x = c[0] * 0.9 + Math.sin(ph) * Math.cos(th) * rad * 1.8;
        y = c[1] + Math.cos(ph) * rad * 0.6;
        z = c[2] * 0.8 + Math.sin(ph) * Math.sin(th) * rad;
        break;
      }
      case 'glitter': {
        // cauliflower clusters hugging the spine: each cluster is a handful of lobes,
        // points biased toward lobe surfaces so clumps read as solid coral‑like masses
        const c = coral[(r() * coral.length) | 0];
        const lobe = c.lobes[(r() * c.lobes.length) | 0];
        const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
        const rad = lobe[3] * Math.pow(r(), 0.28);
        x = lobe[0] + Math.sin(ph) * Math.cos(th) * rad;
        y = lobe[1] + Math.cos(ph) * rad;
        z = lobe[2] + Math.sin(ph) * Math.sin(th) * rad;
        break;
      }
      case 'blob': {
        // dense red coral mass: many small lobes packed into an organic volume
        const lobe = blobLobes[(r() * blobLobes.length) | 0];
        const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
        const rad = lobe[3] * Math.pow(r(), 0.3);
        x = lobe[0] + Math.sin(ph) * Math.cos(th) * rad;
        y = lobe[1] + Math.cos(ph) * rad;
        z = lobe[2] + Math.sin(ph) * Math.sin(th) * rad;
        break;
      }
      case 'specks': {
        // bright energy specks close to the camera plane (foreground layer of the storms)
        x = gauss(r) * 10;
        y = y0 + (y1 - y0) * r();
        z = -2 + r() * 8;
        break;
      }
      case 'dust': {
        x = (r() * 2 - 1) * 12;
        y = y0 + (y1 - y0) * r();
        z = -10 + r() * 16;
        break;
      }
    }
    position[i * 3] = x;
    position[i * 3 + 1] = y;
    position[i * 3 + 2] = z;
    seed[i * 4] = r();
    seed[i * 4 + 1] = r();
    seed[i * 4 + 2] = r();
    seed[i * 4 + 3] = 0.35 + Math.pow(r(), 3) * 1.8;
  }
  return { id: req.id, position, seed };
}

self.onmessage = (e: MessageEvent<ParticleRequest[]>) => {
  const results = e.data.map(build);
  const transfer: Transferable[] = [];
  results.forEach((res) => transfer.push(res.position.buffer, res.seed.buffer));
  (self as unknown as Worker).postMessage(results, transfer);
};

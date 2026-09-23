/// <reference lib="webworker" />
/**
 * Generates particle attribute buffers off the main thread.
 * position: xyz, seed: 4 random values (w used as size factor), both transferred.
 */
import { rng } from '../utils/math';

export type ParticleKind = 'embers' | 'storm' | 'glitter' | 'blob' | 'dust';
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
        // clumps hugging the spine
        const c = clusters[(r() * clusters.length) | 0];
        const ang = r() * Math.PI * 2;
        const rad = 0.5 + Math.abs(gauss(r)) * 2.2;
        x = Math.cos(ang) * rad + c[0] * 0.18;
        z = Math.sin(ang) * rad * 0.8 + 0.4;
        y = c[1] + gauss(r) * c[3] * 1.4;
        break;
      }
      case 'blob': {
        // organic mass: noisy sphere with lobes
        const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
        const lobe = 1 + 0.35 * Math.sin(th * 3) * Math.sin(ph * 2) + 0.2 * Math.sin(th * 5 + ph * 3);
        const rad = 1.4 * lobe * Math.pow(r(), 0.35);
        x = Math.sin(ph) * Math.cos(th) * rad;
        y = (y0 + y1) / 2 + Math.cos(ph) * rad * 0.9;
        z = Math.sin(ph) * Math.sin(th) * rad;
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

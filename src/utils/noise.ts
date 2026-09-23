/** Small deterministic 3D value noise + fbm for CPU‑side geometry displacement. */
import { rng } from './math';

const PERM = (() => {
  const r = rng(1337);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  return new Uint8Array([...p, ...p]);
})();
const VALS = (() => {
  const r = rng(4242);
  return Float32Array.from({ length: 256 }, () => r() * 2 - 1);
})();
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const v = (x: number, y: number, z: number) => VALS[PERM[PERM[PERM[x & 255] + (y & 255)] + (z & 255)]];

export function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = fade(xf), w = fade(yf), s = fade(zf);
  return lerp(
    lerp(lerp(v(xi, yi, zi), v(xi + 1, yi, zi), u), lerp(v(xi, yi + 1, zi), v(xi + 1, yi + 1, zi), u), w),
    lerp(lerp(v(xi, yi, zi + 1), v(xi + 1, yi, zi + 1), u), lerp(v(xi, yi + 1, zi + 1), v(xi + 1, yi + 1, zi + 1), u), w),
    s,
  );
}

export function fbm3(x: number, y: number, z: number, oct = 3) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x * f, y * f, z * f);
    f *= 2.07;
    a *= 0.5;
  }
  return s;
}

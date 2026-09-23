import * as THREE from 'three';
import { rangeOf, ANCHOR } from '../world/journey';
import type { SectionId } from '../core/state';

interface Key {
  t: number;
  pos: THREE.Vector3;
  tgt: THREE.Vector3;
}

const k = (section: SectionId, local: number, pos: [number, number, number], tgt: [number, number, number]): Key => {
  const r = rangeOf(section);
  return { t: r.start + (r.end - r.start) * local, pos: new THREE.Vector3(...pos), tgt: new THREE.Vector3(...tgt) };
};

function buildKeys(): Key[] {
  const keys: Key[] = [
    k('intro', 0, [0, 0, 12.4], [0, 0, 0]),
    k('intro', 0.2, [0, -2.2, 9.6], [0, 0.35, 0]),
    k('intro', 0.45, [0.5, -4.8, 5.2], [0, -6.5, -2]),
    k('intro', 0.72, [-0.6, -14, 6.5], [0, -17.5, -1]),
    k('manifesto', 0, [0, ANCHOR.manifesto + 3.5, 10.5], [0, ANCHOR.manifesto + 0.8, 0]),
    k('manifesto', 0.5, [0, ANCHOR.manifesto, 10], [0, ANCHOR.manifesto, 0]),
    k('manifesto', 1, [0, ANCHOR.manifesto - 8, 9.5], [0, ANCHOR.manifesto - 10, 0]),
  ];
  // Descent along the spine with a gentle alternating sway toward each card.
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const y = ANCHOR.workTop - 3 + (ANCHOR.workBottom - ANCHOR.workTop + 3) * u;
    const sway = i === 0 || i === steps ? 0 : (i % 2 ? -0.55 : 0.55);
    keys.push(k('work', 0.02 + u * 0.96, [sway, y, 8.6], [sway * 0.3, y - 0.45, 0]));
  }
  keys.push(
    k('lab', 0, [0, ANCHOR.lab + 5, 13], [0, ANCHOR.lab + 1.8, 0]),
    k('lab', 0.45, [1.2, ANCHOR.lab + 0.6, 9], [0, ANCHOR.lab - 0.3, 0]),
    k('lab', 1, [0, ANCHOR.lab - 7, 7], [0, ANCHOR.lab - 10, -2]),
    k('portal', 0, [0, ANCHOR.portal + 2.8, 6], [0, ANCHOR.portal + 1, -6]),
    k('portal', 0.55, [0, ANCHOR.portal + 0.2, 3.6], [0, ANCHOR.portal - 0.5, -6]),
    k('portal', 1, [0, ANCHOR.portal - 4, 4], [0, ANCHOR.portal - 8, -2]),
    k('outro', 0.25, [0.5, ANCHOR.outro + 15, 5.5], [0, ANCHOR.outro + 12, 0]),
    k('outro', 0.62, [0, ANCHOR.outro + 4.5, 9.5], [0, ANCHOR.outro + 1.2, 0]),
    k('outro', 1, [0, ANCHOR.outro, 12.4], [0, ANCHOR.outro, 0]),
  );
  return keys.sort((a, b) => a.t - b.t);
}

const KEYS = buildKeys();

// time‑aware tangents for a cubic Hermite spline (Catmull‑Rom style, non‑uniform keys)
const tangentsPos = KEYS.map(() => new THREE.Vector3());
const tangentsTgt = KEYS.map(() => new THREE.Vector3());
for (let i = 0; i < KEYS.length; i++) {
  const a = KEYS[Math.max(0, i - 1)];
  const b = KEYS[Math.min(KEYS.length - 1, i + 1)];
  const dt = b.t - a.t || 1;
  tangentsPos[i].subVectors(b.pos, a.pos).divideScalar(dt);
  tangentsTgt[i].subVectors(b.tgt, a.tgt).divideScalar(dt);
  if (i === 0 || i === KEYS.length - 1) {
    tangentsPos[i].set(0, 0, 0);
    tangentsTgt[i].set(0, 0, 0);
  }
}

const tmp = new THREE.Vector3();
function hermite(out: THREE.Vector3, p0: THREE.Vector3, m0: THREE.Vector3, p1: THREE.Vector3, m1: THREE.Vector3, u: number, h: number) {
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  out.copy(p0).multiplyScalar(h00);
  out.addScaledVector(m0, h10 * h);
  out.addScaledVector(tmp.copy(p1), h01);
  out.addScaledVector(m1, h11 * h);
  return out;
}

/** Sample the journey camera at progress p (no allocations). */
export function sampleCameraPath(p: number, outPos: THREE.Vector3, outTgt: THREE.Vector3) {
  if (p <= KEYS[0].t) {
    outPos.copy(KEYS[0].pos);
    outTgt.copy(KEYS[0].tgt);
    return;
  }
  const last = KEYS.length - 1;
  if (p >= KEYS[last].t) {
    outPos.copy(KEYS[last].pos);
    outTgt.copy(KEYS[last].tgt);
    return;
  }
  let i = 0;
  while (i < last - 1 && p > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const h = b.t - a.t;
  const u = (p - a.t) / h;
  hermite(outPos, a.pos, tangentsPos[i], b.pos, tangentsPos[i + 1], u, h);
  hermite(outTgt, a.tgt, tangentsTgt[i], b.tgt, tangentsTgt[i + 1], u, h);
}

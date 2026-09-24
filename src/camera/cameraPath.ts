import * as THREE from 'three';
import { rangeOf, ANCHOR } from '../world/journey';
import { workTimeline, WorkTimeline } from '../work/WorkTimeline';

/** Heading (deg, atan2(z,x)) of the reference camera when the work section ends. */
const EXIT_HEADING_DEG = 70;
import type { SectionId } from '../core/state';

/**
 * Explicit camera timeline. Every key: journey time (section + local progress),
 * eye position, look target and vertical FOV (desktop framing; portrait adds a
 * fixed offset in CameraRig). Interpolation is a time‑aware cubic Hermite for
 * position/target and smoothstep for FOV, so motion is continuous in both directions.
 */
interface Key {
  t: number;
  pos: THREE.Vector3;
  tgt: THREE.Vector3;
  fov: number;
}

const SECTION_FOV: Record<SectionId, number> = { intro: 40, manifesto: 40, work: 42, lab: 38, portal: 44, outro: 40 };

const k = (section: SectionId, local: number, pos: [number, number, number], tgt: [number, number, number], fov = SECTION_FOV[section]): Key => {
  const r = rangeOf(section);
  return { t: r.start + (r.end - r.start) * local, pos: new THREE.Vector3(...pos), tgt: new THREE.Vector3(...tgt), fov };
};

function buildKeys(): Key[] {
  const keys: Key[] = [
    // reference: emblem stays centred and recedes (ring ≈200→170→140→110 px) while the storm grows
    k('intro', 0, [0, 0, 12.4], [0, 0, 0]),
    k('intro', 0.17, [0, -0.15, 14.6], [0, -0.1, 0]),
    k('intro', 0.33, [0, -0.25, 16], [0, -0.2, 0]),
    k('intro', 0.55, [0.2, -0.35, 17.7], [0, -0.3, 0]),
    k('intro', 0.83, [0, -0.6, 22.5], [0, -0.6, 0]),
    k('intro', 0.96, [0, -12, 13], [0, -16, 0]),
  ];
  // The work section itself is driven by the measured WorkTimeline (see sampleCameraPath).
  // Seam keys: the manifesto ends exactly on the timeline's first frame, the lab starts from its last.
  // The headline section is part of it (measured: the reference camera is already on the work
  // orbit there, with the headline layered on top).
  const wp = new THREE.Vector3(), wt = new THREE.Vector3();
  workTimeline.sample(workTimeline.start, wp, wt);
  keys.push(k('work', workTimeline.start, [wp.x, wp.y, wp.z], [wt.x, wt.y, wt.z], workTimeline.config.fov));
  workTimeline.sample(WorkTimeline.END, wp, wt);
  keys.push(k('work', WorkTimeline.END, [wp.x, wp.y, wp.z], [wt.x, wt.y, wt.z], workTimeline.config.fov));
  // lab framing continues along the heading the work camera exits on (70°, measured)
  const H = THREE.MathUtils.degToRad(EXIT_HEADING_DEG);
  const polar = (r: number, y: number): [number, number, number] => [Math.cos(H) * r, y, Math.sin(H) * r];
  keys.push(
    k('lab', 0.5, polar(13, ANCHOR.lab + 0.6), [0, ANCHOR.lab + 1, 0]),
    k('lab', 0.86, polar(12.5, ANCHOR.lab - 0.2), [0, ANCHOR.lab + 0.9, 0]),
    // the lantern sky: looking up into a night full of rising lanterns
    // (the sky is SKY_Y = portal − 6; the camera stays level so the lab above stays out of frame)
    k('portal', 0.15, [0, ANCHOR.portal - 5.5, 12], [0, ANCHOR.portal - 4.4, -6], 50),
    k('portal', 0.6, [0.4, ANCHOR.portal - 6, 10.5], [0, ANCHOR.portal - 4, -6], 48),
    k('portal', 0.9, [0, ANCHOR.portal - 7, 9], [0, ANCHOR.portal - 5.5, -6], 46),
    k('portal', 1, [0, ANCHOR.portal - 6, 6], [0, ANCHOR.portal - 9, -2]),
    k('outro', 0.22, [0, ANCHOR.outro + 0.9, 11.2], [0, ANCHOR.outro + 0.9, 0]),
    k('outro', 0.6, [0.3, ANCHOR.outro + 0.8, 13.2], [0, ANCHOR.outro + 0.5, 0]),
    k('outro', 1, [0, ANCHOR.outro, 12.4], [0, ANCHOR.outro, 0]),
  );
  return keys.sort((a, b) => a.t - b.t);
}

let KEYS: Key[] = [];
// time‑aware tangents for a cubic Hermite spline (Catmull‑Rom style, non‑uniform keys)
let tangentsPos: THREE.Vector3[] = [];
let tangentsTgt: THREE.Vector3[] = [];

/** (Re)build the timeline — call after the section ranges change (e.g. mobile journey length). */
export function rebuildCameraPath() {
  KEYS = buildKeys();
  tangentsPos = KEYS.map(() => new THREE.Vector3());
  tangentsTgt = KEYS.map(() => new THREE.Vector3());
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
}
rebuildCameraPath();

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

/** True where the measured Work timeline drives the camera (its framing is already per‑device). */
export function inWorkTimeline(p: number) {
  const w = rangeOf('work'), len = w.end - w.start;
  return p >= w.start + workTimeline.start * len && p <= w.start + WorkTimeline.END * len;
}

/**
 * Exit wipe (measured): returns the edge (screen y from the top, 0…1) and writes the parked
 * work view into outPos/outTgt while the lab is being revealed; null otherwise.
 */
export function workOverlay(p: number, outPos: THREE.Vector3, outTgt: THREE.Vector3): number | null {
  const w = rangeOf('work');
  const t = (p - w.start) / (w.end - w.start);
  const edge = workTimeline.exitWipe(t);
  if (edge === null) return null;
  workTimeline.sampleParked(t, outPos, outTgt);
  return edge;
}

/** Discrete view segment: the main camera cuts (no damped sweep) when this changes. */
export function viewSegment(p: number) {
  const w = rangeOf('work');
  const t = (p - w.start) / (w.end - w.start);
  return workTimeline.inWipe(t) ? 1 : 0;
}

/** Read‑only view of the timeline (debug / docs). */
export const cameraKeys = (): readonly Readonly<Key>[] => KEYS;

/** Sample the journey camera at progress p (no allocations). Returns the FOV. */
export function sampleCameraPath(p: number, outPos: THREE.Vector3, outTgt: THREE.Vector3): number {
  const w = rangeOf('work'), len = w.end - w.start;
  if (p >= w.start + workTimeline.start * len && p <= w.start + WorkTimeline.END * len) return workTimeline.sample((p - w.start) / len, outPos, outTgt);
  if (p <= KEYS[0].t) {
    outPos.copy(KEYS[0].pos);
    outTgt.copy(KEYS[0].tgt);
    return KEYS[0].fov;
  }
  const last = KEYS.length - 1;
  if (p >= KEYS[last].t) {
    outPos.copy(KEYS[last].pos);
    outTgt.copy(KEYS[last].tgt);
    return KEYS[last].fov;
  }
  let i = 0;
  while (i < last - 1 && p > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const h = b.t - a.t;
  const u = (p - a.t) / h;
  hermite(outPos, a.pos, tangentsPos[i], b.pos, tangentsPos[i + 1], u, h);
  hermite(outTgt, a.tgt, tangentsTgt[i], b.tgt, tangentsTgt[i + 1], u, h);
  const su = u * u * (3 - 2 * u);
  return a.fov + (b.fov - a.fov) * su;
}

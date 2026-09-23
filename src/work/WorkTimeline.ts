import * as THREE from 'three';
import { WORK_CAMERA_DESKTOP, CARD_CENTRES_DESKTOP, WORK_CAMERA_PHONE, CARD_CENTRES_PHONE } from './workCameraData';
import { WORK_ORIGIN, setHelix, HELIX_DESKTOP, HELIX_PHONE } from './WorkLayout';
import { ANCHOR } from '../world/journey';

/**
 * Entry seam (measured at 1440×900 with a frame‑counted settle): the camera is parked on card 0
 * and does NOT move. Card 0 alone rises into its slot from below the frame — offset 0.28 / 0.12 /
 * 0.02 / 0 screen heights at p −0.07 / −0.06 / −0.05 / −0.04, fully hidden at −0.08 — with an
 * edge dissolve, while its neighbours are already in place. The column then assembles bottom‑up
 * from the card toward the top of the frame between −0.045 and −0.01.
 */
const CARD0_RISE = 2.75; // world units (≈0.75 screen heights at the card's depth of 5.8)
/** Column reveal: local y of the reveal front against work p (measured from the same frames). */
const SPINE_FRONT: readonly (readonly [number, number])[] = [[-0.05, -20], [-0.045, 0.5], [-0.04, 1.7], [-0.03, 2.2], [-0.02, 4], [-0.01, 8.5]];
/** Lab framing distance from the axis (reached at the end of the exit wipe). */
const LAB_DISTANCE = 12.5;
/** Exit wipe: work p where the lab starts to show under the rising edge, and the edge table. */
const WIPE_START = 0.93;
const WIPE_EDGE: readonly (readonly [number, number])[] = [[0.93, 1.1], [0.94, 0.62], [0.95, 0.53], [0.96, 0.45], [0.97, 0.3], [0.98, 0.2], [0.99, 0.05], [1, -0.12]];

function piecewise(f: readonly (readonly [number, number])[], t: number) {
  if (t <= f[0][0]) return f[0][1];
  if (t >= f[f.length - 1][0]) return f[f.length - 1][1];
  let i = 0;
  while (t > f[i + 1][0]) i++;
  return f[i][1] + ((f[i + 1][1] - f[i][1]) * (t - f[i][0])) / (f[i + 1][0] - f[i][0]);
}

/** [p, orbit angle deg, height, radius, heading offset deg (optional)] */
type Row = readonly number[];

/** Uniform Catmull‑Rom through one channel of the measured rows. */
function cr(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export interface WorkCameraConfig {
  rows: readonly Row[];
  fov: number;
  cardCentres: readonly number[];
}

export const WORK_DESKTOP: WorkCameraConfig = { rows: WORK_CAMERA_DESKTOP, fov: 35, cardCentres: CARD_CENTRES_DESKTOP };
export const WORK_PHONE: WorkCameraConfig = { rows: WORK_CAMERA_PHONE, fov: 55, cardCentres: CARD_CENTRES_PHONE };

/**
 * SceneState = f(workProgress): the camera orbits the static spine, descending, always
 * looking horizontally at the axis. Deterministic in both scroll directions — no
 * internal state, so reversing, jumping or stopping always lands on the same frame.
 */
export class WorkTimeline {
  constructor(public config: WorkCameraConfig) {}

  /** Domain covered by the timeline: the whole headline section (−0.10) through the work exit. */
  static readonly START = -0.1;
  static readonly END = 1;

  /**
   * t = work‑section progress; the MAIN camera. Returns FOV.
   * Entry seam: the camera is parked on card 0 (see CARD0_RISE).
   * Exit seam (measured, clean settle): the camera stays parked on the last card while the column
   * crumbles (0.915 → 0.94); a static lab view is then revealed under a slanted edge rising from
   * the bottom of the frame (see exitWipe). During the wipe the main camera is already on the lab
   * framing (slowly pushing in, as measured), and the parked orbit view is drawn over it above the
   * edge by `sampleParked` — so by t = 1 the image is entirely the lab and the path continues.
   */
  sample(t: number, outPos: THREE.Vector3, outTgt: THREE.Vector3) {
    if (t < WIPE_START) return this.sampleOrbit(t, outPos, outTgt);
    return this.sampleLab(THREE.MathUtils.clamp((t - WIPE_START) / (1 - WIPE_START), 0, 1), outPos, outTgt);
  }

  /** The parked orbit view (what sits above the wipe edge). */
  sampleParked(t: number, outPos: THREE.Vector3, outTgt: THREE.Vector3) {
    return this.sampleOrbit(t, outPos, outTgt);
  }

  /** Lab framing along the exit heading; u = 0 … 1 across the wipe (slight push‑in). */
  private sampleLab(u: number, outPos: THREE.Vector3, outTgt: THREE.Vector3) {
    this.sampleOrbit(1, outPos, outTgt);
    const dx = outPos.x - WORK_ORIGIN.x, dz = outPos.z - WORK_ORIGIN.z;
    const r = Math.hypot(dx, dz), k = (LAB_DISTANCE + (1 - u) * 0.7) / r;
    const drop = this.exitDrop();
    outPos.set(WORK_ORIGIN.x + dx * k, outPos.y - drop, WORK_ORIGIN.z + dz * k);
    outTgt.set(WORK_ORIGIN.x, outTgt.y - drop + 0.3, WORK_ORIGIN.z);
    return this.config.fov;
  }

  /**
   * Exit wipe edge (screen y from the top at the frame centre, 0…1) or null outside the wipe.
   * Measured from the clean‑settle reference frames at 1440×900; the edge rises to the right.
   */
  static exitWipe(t: number): number | null {
    if (t < WIPE_START || t >= 1) return null;
    return piecewise(WIPE_EDGE, t);
  }
  static readonly WIPE_SLANT = 0.18;

  /** Column crumble before the wipe, 0 = intact … 1 = gone. */
  static spineDissolve(t: number) {
    return THREE.MathUtils.smoothstep(t, 0.915, 0.94);
  }

  /** Card 0 entry, 1 = fully below its slot and dissolved, 0 = in place (fit to measured offsets). */
  static card0Entry(t: number) {
    return Math.pow(THREE.MathUtils.clamp((-0.045 - t) / 0.04, 0, 1), 2);
  }
  static readonly CARD0_RISE = CARD0_RISE;
  /** Column reveal front (local y; everything below it is shown), or null when fully shown. */
  static spineFront(t: number): number | null {
    if (t >= SPINE_FRONT[SPINE_FRONT.length - 1][0]) return null;
    return piecewise(SPINE_FRONT, t);
  }

  /** Vertical distance from the last work frame to the lab framing. */
  exitDrop() {
    const y = cr1(this.config.rows, 1);
    return WORK_ORIGIN.y + y - (ANCHOR.lab + 0.6);
  }

  private sampleOrbit(t: number, outPos: THREE.Vector3, outTgt: THREE.Vector3) {
    const rows = this.config.rows;
    const p0 = rows[0][0], step = rows[1][0] - rows[0][0];
    const f = Math.min(rows.length - 1.0001, Math.max(0, (t - p0) / step));
    const i = Math.floor(f), u = f - i;
    const a = rows[Math.max(0, i - 1)], b = rows[i], c = rows[Math.min(rows.length - 1, i + 1)], d = rows[Math.min(rows.length - 1, i + 2)];
    const ang = THREE.MathUtils.degToRad(cr(a[1], b[1], c[1], d[1], u));
    const y = cr(a[2], b[2], c[2], d[2], u);
    const r = cr(a[3], b[3], c[3], d[3], u);
    // measured: the camera rides a pivot whose heading leads/lags the axis by up to ±0.5°
    // (it is what puts the column ±12 px off centre between cards)
    const yaw = THREE.MathUtils.degToRad(cr(a[4] ?? 0, b[4] ?? 0, c[4] ?? 0, d[4] ?? 0, u));
    outPos.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
    const cy = Math.cos(yaw), sy = Math.sin(yaw), dx = -outPos.x, dz = -outPos.z;
    outTgt.set(outPos.x + dx * cy - dz * sy, y, outPos.z + dx * sy + dz * cy).add(WORK_ORIGIN);
    outPos.add(WORK_ORIGIN);
    return this.config.fov;
  }

  cardCentre(i: number) {
    const c = this.config.cardCentres;
    return c[Math.max(0, Math.min(c.length - 1, i))];
  }
}

export const workTimeline = new WorkTimeline(WORK_DESKTOP);

/** Select the measured desktop or phone work configuration (helix + camera table + FOV). */
export function setWorkDevice(phone: boolean) {
  const cfg = phone ? WORK_PHONE : WORK_DESKTOP;
  if (workTimeline.config === cfg) return false;
  workTimeline.config = cfg;
  setHelix(phone ? HELIX_PHONE : HELIX_DESKTOP);
  return true;
}

/** Camera height channel at t (no seams) — used for the exit drop. */
function cr1(rows: readonly Row[], t: number) {
  const p0 = rows[0][0], step = rows[1][0] - rows[0][0];
  const f = Math.min(rows.length - 1.0001, Math.max(0, (t - p0) / step));
  const i = Math.floor(f), u = f - i;
  const a = rows[Math.max(0, i - 1)], b = rows[i], c = rows[Math.min(rows.length - 1, i + 1)], d = rows[Math.min(rows.length - 1, i + 2)];
  return cr(a[2], b[2], c[2], d[2], u);
}

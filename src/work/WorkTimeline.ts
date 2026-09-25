import * as THREE from 'three';
import { WORK_CAMERA_DESKTOP, CARD_CENTRES_DESKTOP, WORK_CAMERA_PHONE, CARD_CENTRES_PHONE } from './workCameraData';
import { WORK_ORIGIN, setHelix, HELIX, HELIX_DESKTOP, HELIX_PHONE } from './WorkLayout';
import { ANCHOR } from '../world/journey';

/**
 * Entry seam (measured at 1440×900 with a frame‑counted settle): the camera is parked on card 0
 * and does NOT move. Card 0 alone rises into its slot from below the frame — offset 0.28 / 0.12 /
 * 0.02 / 0 screen heights at p −0.07 / −0.06 / −0.05 / −0.04, fully hidden at −0.08 — with an
 * edge dissolve, while its neighbours are already in place. The column then assembles bottom‑up
 * from the card toward the top of the frame between −0.045 and −0.01.
 */
const CARD0_RISE = 2.75; // world units (≈0.75 screen heights at the card's depth of 5.8)
/** Lab framing distance from the axis (reached at the end of the exit wipe). */
const LAB_DISTANCE = 12.5;

type Table = readonly (readonly [number, number])[];
/** Per‑device seam timings (work p), all measured from clean‑settle captures. */
export interface SeamConfig {
  /** card 0 rise: fully in place at `card0End`, fully below after a further `card0Span` backwards */
  card0End: number;
  card0Span: number;
  /** rise curve exponent and depth below the slot (world units) */
  card0Pow: number;
  card0Rise: number;
  /** how much of card 0 the entry dissolve eats at its start (0 … 1) */
  card0Dissolve: number;
  /** column reveal front (height above card 0) or null = column visible throughout */
  spineFront: Table | null;
  /** column crumble [start, end] before the exit wipe */
  crumble: readonly [number, number];
  /** exit wipe start and edge table (screen y from the top at the frame centre) */
  wipeStart: number;
  wipeEdge: Table;
  /** how much higher the edge sits at the right than at the left (fraction of the height) */
  wipeSlant: number;
}
const SEAM_DESKTOP: SeamConfig = {
  card0End: -0.045,
  card0Span: 0.04,
  card0Pow: 2,
  card0Rise: CARD0_RISE,
  card0Dissolve: 0.85,
  spineFront: [[-0.05, -20], [-0.045, 0.5], [-0.04, 1.7], [-0.03, 2.2], [-0.02, 4], [-0.01, 8.5]],
  crumble: [0.915, 0.94],
  wipeStart: 0.93,
  wipeEdge: [[0.93, 1.1], [0.94, 0.62], [0.95, 0.53], [0.96, 0.45], [0.97, 0.3], [0.98, 0.2], [0.99, 0.05], [1, -0.12]],
  wipeSlant: 0.18,
};
/**
 * Phone (390×844): card 0 rises later and more linearly, and the column is visible from the start of
 * the headline section; the last card centres at 0.88, so the crumble and wipe start earlier
 * (edge ≈ 0.65 / 0.45 / 0.30 / 0.12 of the height at 0.88 / 0.91 / 0.94 / 0.97).
 */
const SEAM_PHONE: SeamConfig = {
  // offsets ≈ 0.22 / 0.14 / 0.06 screen heights at −0.09 / −0.07 / −0.05 (linear), in place by −0.035
  card0End: -0.035,
  card0Span: 0.07,
  card0Pow: 1,
  card0Rise: 1.7,
  card0Dissolve: 0.3, // the phone card arrives nearly solid, only its edges break up
  spineFront: null,
  crumble: [0.85, 0.885],
  wipeStart: 0.86,
  wipeEdge: [[0.86, 1.1], [0.88, 0.65], [0.91, 0.45], [0.94, 0.3], [0.97, 0.12], [0.99, 0.0], [1, -0.12]],
  wipeSlant: 0.04,
};

function piecewise(f: Table, t: number) {
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
  seam: SeamConfig;
}

const WORK_DESKTOP: WorkCameraConfig = { rows: WORK_CAMERA_DESKTOP, fov: 35, cardCentres: CARD_CENTRES_DESKTOP, seam: SEAM_DESKTOP };
const WORK_PHONE: WorkCameraConfig = { rows: WORK_CAMERA_PHONE, fov: 55, cardCentres: CARD_CENTRES_PHONE, seam: SEAM_PHONE };

/**
 * SceneState = f(workProgress): the camera orbits the static spine, descending, always
 * looking horizontally at the axis. Deterministic in both scroll directions — no
 * internal state, so reversing, jumping or stopping always lands on the same frame.
 */
export class WorkTimeline {
  constructor(public config: WorkCameraConfig) {}

  /** Domain covered by the timeline: the whole headline section (−0.10) through the work exit. */
  /** First measured row: desktop −0.10, phone −0.20 (its headline section is 105 of 525 vh). */
  get start() {
    return this.config.rows[0][0];
  }
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
    const w0 = this.config.seam.wipeStart;
    if (t < w0) return this.sampleOrbit(t, outPos, outTgt);
    return this.sampleLab(THREE.MathUtils.clamp((t - w0) / (1 - w0), 0, 1), outPos, outTgt);
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
  exitWipe(t: number): number | null {
    const sc = this.config.seam;
    if (t < sc.wipeStart || t >= 1) return null;
    return piecewise(sc.wipeEdge, t);
  }
  /** True while the exit wipe (two‑view cut) is active. */
  inWipe(t: number) {
    return t >= this.config.seam.wipeStart && t < 1;
  }

  /** Column crumble before the wipe, 0 = intact … 1 = gone. */
  spineDissolve(t: number) {
    const [a, b] = this.config.seam.crumble;
    return THREE.MathUtils.smoothstep(t, a, b);
  }

  /** Card 0 entry, 1 = fully below its slot and dissolved, 0 = in place (fit to measured offsets). */
  card0Entry(t: number) {
    const sc = this.config.seam;
    return Math.pow(THREE.MathUtils.clamp((sc.card0End - t) / sc.card0Span, 0, 1), sc.card0Pow);
  }
  get card0Rise() {
    return this.config.seam.card0Rise;
  }
  get card0Dissolve() {
    return this.config.seam.card0Dissolve;
  }
  /** Column reveal front (local y; everything below it is shown), or null when fully shown. */
  spineFront(t: number): number | null {
    const f = this.config.seam.spineFront;
    if (!f || t >= f[f.length - 1][0]) return null;
    return HELIX.startY + piecewise(f, t);
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

  /** Work progress at which the camera has descended to local height y (+ a little lead). */
  progressAtHeight(y: number) {
    const rows = this.config.rows;
    for (const r of rows) if (r[0] >= 0 && r[2] <= y + 0.6) return r[0];
    return rows[rows.length - 1][0];
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

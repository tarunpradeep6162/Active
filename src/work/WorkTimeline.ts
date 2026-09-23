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
/** Lab framing distance from the axis (reached at the end of the exit slide). */
const LAB_DISTANCE = 12.5;

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
   * t = work‑section progress. Returns FOV.
   * Seams (measured): on entry the camera is parked on card 0 (see CARD0_RISE); on exit the last card and
   * the column slide up and the lab rises from below (0.935 → 1.0). In our single world both are
   * the same image motion produced by a vertical camera move — so the lab is placed directly
   * beneath the column and the camera sinks into it, keeping the reference's final heading.
   */
  sample(t: number, outPos: THREE.Vector3, outTgt: THREE.Vector3) {
    const fov = this.sampleOrbit(t, outPos, outTgt);
    const e = THREE.MathUtils.smoothstep(t, 0.935, 1);
    if (e > 0) {
      // sink into the lab; pull back to the lab's framing distance along the same heading
      const drop = e * this.exitDrop();
      outPos.y -= drop;
      outTgt.y -= drop - e * 0.3;
      const dx = outPos.x - WORK_ORIGIN.x, dz = outPos.z - WORK_ORIGIN.z;
      const r = Math.hypot(dx, dz), k = (r + e * (LAB_DISTANCE - r)) / r;
      outPos.x = WORK_ORIGIN.x + dx * k;
      outPos.z = WORK_ORIGIN.z + dz * k;
    }
    return fov;
  }

  /** Card 0 entry, 1 = fully below its slot and dissolved, 0 = in place (fit to measured offsets). */
  static card0Entry(t: number) {
    return Math.pow(THREE.MathUtils.clamp((-0.045 - t) / 0.04, 0, 1), 2);
  }
  static readonly CARD0_RISE = CARD0_RISE;
  /** Column reveal front (local y; everything below it is shown), or null when fully shown. */
  static spineFront(t: number): number | null {
    const f = SPINE_FRONT;
    if (t >= f[f.length - 1][0]) return null;
    if (t <= f[0][0]) return f[0][1];
    let i = 0;
    while (t > f[i + 1][0]) i++;
    const u = (t - f[i][0]) / (f[i + 1][0] - f[i][0]);
    return f[i][1] + (f[i + 1][1] - f[i][1]) * u;
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

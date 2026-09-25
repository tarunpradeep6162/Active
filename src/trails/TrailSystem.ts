import * as THREE from 'three';
import { Ribbon } from './Ribbon';
import { Sparks } from '../particles/Sparks';
import { state } from '../core/state';
import { damp } from '../utils/math';

const DEPTH = 5.5;

interface TrailSet {
  strands: Ribbon[];
  sx: number;
  sy: number;
  lastPush: THREE.Vector3;
  started: boolean;
}

/** Pointer/touch → smoothed samples → world points → multi‑strand ribbons + sparks. */
export class TrailSystem {
  readonly group = new THREE.Group();
  readonly sparks = new Sparks();
  private local: TrailSet;
  private ndc = new THREE.Vector3();
  private world = new THREE.Vector3();
  private dir = new THREE.Vector3();
  readonly pointerWorld = new THREE.Vector3(0, 0, -999);

  constructor(strands: number) {
    this.local = this.makeSet(strands);
    this.group.add(this.sparks.points);
  }

  private makeSet(n: number): TrailSet {
    const strands: Ribbon[] = [];
    for (let i = 0; i < n; i++) {
      const r = new Ribbon(i, i === 0 ? 0 : i % 2 ? 1 : -1);
      r.width = i === 0 ? 0.075 : 0.05;
      strands.push(r);
      this.group.add(r.mesh);
    }
    return { strands, sx: 0, sy: 0, lastPush: new THREE.Vector3(), started: false };
  }

  setStrands(n: number) {
    this.local.strands.forEach((s, i) => (s.mesh.visible = i < n));
  }

  private toWorld(x: number, y: number, camera: THREE.PerspectiveCamera, out: THREE.Vector3) {
    this.ndc.set(x, y, 0.5).unproject(camera);
    this.dir.subVectors(this.ndc, camera.position).normalize();
    return out.copy(camera.position).addScaledVector(this.dir, DEPTH);
  }

  private feed(set: TrailSet, x: number, y: number, speed: number, dt: number, camera: THREE.PerspectiveCamera, emit: boolean) {
    if (!set.started) {
      set.sx = x;
      set.sy = y;
      set.started = true;
    }
    set.sx = damp(set.sx, x, 24, dt);
    set.sy = damp(set.sy, y, 24, dt);
    this.toWorld(set.sx, set.sy, camera, this.world);
    const t = state.time;
    const minStep = 0.045;
    const dist = this.world.distanceTo(set.lastPush);
    if (dist > minStep) {
      for (const s of set.strands) {
        s.life = 1.1 + Math.min(speed, 4) * 0.35;
        s.push(this.world.x, this.world.y, this.world.z, t, speed);
      }
      set.lastPush.copy(this.world);
      if (emit && speed > 0.6) this.sparks.emit(this.world.x, this.world.y, this.world.z, Math.min(4, 1 + (speed * 0.8) | 0), speed);
    } else {
      for (const s of set.strands) s.moveHead(this.world.x, this.world.y, this.world.z);
    }
  }

  update(dt: number, camera: THREE.PerspectiveCamera) {
    const p = state.pointer;
    const reduced = state.reducedMotion;
    const now = performance.now();
    const drawing = !reduced && p.active && now - p.lastMove < (p.isTouch ? 120 : 90) && state.focus < 0.5 && state.overlay < 0.5;
    if (drawing) this.feed(this.local, p.x, p.y, p.speed, dt, camera, true);
    else this.local.started = false;
    // pointer world position for particle repulsion
    this.toWorld(p.x, p.y, camera, this.pointerWorld);
    for (const s of this.local.strands) s.update(state.time, camera);

    this.sparks.update(dt);
  }
}

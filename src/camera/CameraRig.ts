import * as THREE from 'three';
import { state } from '../core/state';
import { sampleCameraPath } from './cameraPath';
import { dampFactor, clamp, lerp, easeInOutCubic } from '../utils/math';

/**
 * The only place the camera is mutated.
 * final = path(scroll) + pointer parallax + velocity push + transition focus + micro motion,
 * then damped toward that target so everything carries inertia.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private basePos = new THREE.Vector3();
  private baseTgt = new THREE.Vector3();
  private desiredPos = new THREE.Vector3();
  private desiredTgt = new THREE.Vector3();
  private curPos = new THREE.Vector3();
  private curTgt = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private roll = 0;
  private fov = 40;
  private initialised = false;
  /** Set by the TransitionController when a project is opened. */
  readonly focusPos = new THREE.Vector3();
  readonly focusTgt = new THREE.Vector3();
  /** A warp kick used by route jumps (0..1). */
  warp = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  }

  /** Portrait framing: wider lens and pulled‑back camera so key content stays composed. */
  private frame() {
    const a = state.viewport.aspect;
    if (a >= 1.2) return { fov: 40, dist: 1 };
    if (a >= 0.8) return { fov: 46, dist: 1.08 };
    return { fov: 52, dist: 1.12 };
  }

  update(dt: number) {
    const s = state.scroll;
    const p = state.pointer;
    const reduced = state.reducedMotion;
    sampleCameraPath(s.progress, this.basePos, this.baseTgt);

    const { fov, dist } = this.frame();
    // pull back relative to target for portrait screens
    this.desiredPos.subVectors(this.basePos, this.baseTgt).multiplyScalar(dist).add(this.baseTgt);
    this.desiredTgt.copy(this.baseTgt);

    if (!reduced) {
      // pointer parallax — subtle; the target moves less than the eye → slight rotation
      const par = state.viewport.mobile ? 0.18 : 0.42;
      this.desiredPos.x += p.targetX * par;
      this.desiredPos.y += p.targetY * par * 0.55;
      this.desiredTgt.x += p.targetX * par * 0.25;
      this.desiredTgt.y += p.targetY * par * 0.15;
      // scroll velocity pushes the camera back a touch and tilts in the travel direction
      const v = clamp(s.velocity, -4, 4);
      this.desiredPos.z += Math.abs(v) * 0.22;
      this.desiredTgt.y -= v * 0.12;
      // procedural micro motion
      const t = state.time;
      this.desiredPos.x += Math.sin(t * 0.31) * 0.05 + Math.sin(t * 0.83) * 0.02;
      this.desiredPos.y += Math.sin(t * 0.27 + 1.3) * 0.04;
    }

    // project focus
    const f = easeInOutCubic(clamp(state.focus));
    if (f > 0) {
      this.desiredPos.lerp(this.focusPos, f);
      this.desiredTgt.lerp(this.focusTgt, f);
    }

    const lambda = reduced ? 30 : 5.5;
    const k = this.initialised ? dampFactor(lambda, dt) : 1;
    this.initialised = true;
    this.curPos.lerp(this.desiredPos, k);
    this.curTgt.lerp(this.desiredTgt, k);

    const cam = this.camera;
    cam.position.copy(this.curPos);
    // warp kicks the camera forward briefly during route jumps
    if (this.warp > 0) {
      this.tmp.subVectors(this.curTgt, this.curPos).normalize();
      cam.position.addScaledVector(this.tmp, -this.warp * 1.5);
    }
    cam.lookAt(this.curTgt);
    const targetRoll = reduced ? 0 : clamp(-p.vx * 0.004 - s.velocity * 0.006, -0.05, 0.05) + p.targetX * -0.012;
    this.roll = lerp(this.roll, targetRoll, dampFactor(3, dt));
    cam.rotateZ(this.roll);

    const targetFov = fov + (reduced ? 0 : Math.min(Math.abs(s.velocity) * 1.6, 7)) + this.warp * 18;
    this.fov = lerp(this.fov, targetFov, dampFactor(6, dt));
    if (Math.abs(cam.fov - this.fov) > 0.01 || cam.aspect !== state.viewport.aspect) {
      cam.fov = this.fov;
      cam.aspect = state.viewport.aspect;
      cam.updateProjectionMatrix();
    }
  }

  /** Snap after a hard route switch so the camera doesn't sweep across the whole world. */
  snap() {
    sampleCameraPath(state.scroll.progress, this.basePos, this.baseTgt);
    const { dist } = this.frame();
    this.curPos.subVectors(this.basePos, this.baseTgt).multiplyScalar(dist).add(this.baseTgt);
    this.curTgt.copy(this.baseTgt);
  }
}

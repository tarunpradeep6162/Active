import * as THREE from 'three';
import { state } from '../core/state';
import { sampleCameraPath, inWorkTimeline, workOverlay, viewSegment } from './cameraPath';
import { dampFactor, clamp, lerp, easeInOutCubic } from '../utils/math';

/**
 * The only place the camera is mutated.
 * final = path(scroll) + pointer parallax + velocity push + transition focus + micro motion,
 * then damped toward that target so everything carries inertia.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  /** Second view drawn above the exit‑wipe edge (pure function of progress, no damping). */
  readonly overlayCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 400);
  /** Current exit‑wipe edge (screen y from the top) or null when no overlay is drawn. */
  overlayEdge: number | null = null;
  private segment = 0;
  private oPos = new THREE.Vector3();
  private oTgt = new THREE.Vector3();
  private basePos = new THREE.Vector3();
  private baseTgt = new THREE.Vector3();
  private desiredPos = new THREE.Vector3();
  private desiredTgt = new THREE.Vector3();
  private curPos = new THREE.Vector3();
  private curTgt = new THREE.Vector3();
  private tmp = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private right = new THREE.Vector3();
  private up = new THREE.Vector3();
  private worldUp = new THREE.Vector3(0, 1, 0);
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

  /** Portrait framing: FOV offset added to the timeline FOV, and a pull‑back factor. */
  private frame() {
    const a = state.viewport.aspect;
    if (a >= 1.2) return { fovAdd: 0, dist: 1 };
    if (a >= 0.8) return { fovAdd: 6, dist: 1.08 };
    return { fovAdd: 12, dist: 1.12 };
  }
  /** Exposed for the debug overlay. */
  readonly debugTarget = new THREE.Vector3();
  baseFov = 40;

  update(dt: number) {
    const s = state.scroll;
    const p = state.pointer;
    const reduced = state.reducedMotion;
    this.baseFov = sampleCameraPath(s.progress, this.basePos, this.baseTgt);

    // the measured work timeline already carries phone/desktop framing — don't adjust it twice
    const { fovAdd, dist } = inWorkTimeline(s.progress) ? { fovAdd: 0, dist: 1 } : this.frame();
    const fov = this.baseFov + fovAdd;
    // pull back relative to target for portrait screens
    this.desiredPos.subVectors(this.basePos, this.baseTgt).multiplyScalar(dist).add(this.baseTgt);
    this.desiredTgt.copy(this.baseTgt);

    if (!reduced) {
      // All secondary motion is applied in *camera space* (right / up / back), so it stays
      // correct while the camera orbits the spine. Velocity never changes *where* in the
      // sequence we are — only a small temporary push that settles to zero when scrolling stops.
      this.fwd.subVectors(this.desiredTgt, this.desiredPos).normalize();
      this.right.crossVectors(this.fwd, this.worldUp).normalize();
      this.up.crossVectors(this.right, this.fwd).normalize();
      const par = state.viewport.mobile ? 0.18 : 0.42;
      this.desiredPos.addScaledVector(this.right, p.targetX * par).addScaledVector(this.up, p.targetY * par * 0.55);
      this.desiredTgt.addScaledVector(this.right, p.targetX * par * 0.25).addScaledVector(this.up, p.targetY * par * 0.15);
      const v = clamp(s.velocity, -4, 4);
      this.desiredPos.addScaledVector(this.fwd, -Math.abs(v) * 0.18);
      this.desiredTgt.addScaledVector(this.up, -v * 0.1);
      const t = state.time;
      this.desiredPos.addScaledVector(this.right, Math.sin(t * 0.31) * 0.04 + Math.sin(t * 0.83) * 0.015).addScaledVector(this.up, Math.sin(t * 0.27 + 1.3) * 0.03);
    }

    // project focus
    const f = easeInOutCubic(clamp(state.focus));
    if (f > 0) {
      this.desiredPos.lerp(this.focusPos, f);
      this.desiredTgt.lerp(this.focusTgt, f);
    }

    // scroll position is already smoothed (λ 6.5); the rig only adds a light follow so the
    // combined response settles well inside the reference's < 0.9 s (measured) and never floats
    const lambda = reduced ? 30 : 10;
    // a view cut (exit wipe) must not be smoothed into a visible sweep: snap across it
    const seg = viewSegment(s.progress);
    const cut = seg !== this.segment;
    this.segment = seg;
    const k = this.initialised && !cut ? dampFactor(lambda, dt) : 1;
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
    this.debugTarget.copy(this.curTgt);
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
    this.updateOverlay();
  }

  private updateOverlay() {
    this.overlayEdge = state.focus > 0.001 ? null : workOverlay(state.scroll.progress, this.oPos, this.oTgt);
    if (this.overlayEdge === null) return;
    const c = this.overlayCamera;
    c.position.copy(this.oPos);
    c.lookAt(this.oTgt);
    if (c.aspect !== state.viewport.aspect || c.fov !== this.baseFov) {
      c.aspect = state.viewport.aspect;
      c.fov = this.baseFov;
      c.updateProjectionMatrix();
    }
  }

  /** Snap after a hard route switch so the camera doesn't sweep across the whole world. */
  snap() {
    this.baseFov = sampleCameraPath(state.scroll.progress, this.basePos, this.baseTgt);
    const { fovAdd, dist } = inWorkTimeline(state.scroll.progress) ? { fovAdd: 0, dist: 1 } : this.frame();
    this.curPos.subVectors(this.basePos, this.baseTgt).multiplyScalar(dist).add(this.baseTgt);
    this.curTgt.copy(this.baseTgt);
    this.fov = this.baseFov + fovAdd;
    this.camera.fov = this.fov;
    this.camera.aspect = state.viewport.aspect;
    this.camera.updateProjectionMatrix();
    this.segment = viewSegment(state.scroll.progress);
    this.updateOverlay();
  }
}

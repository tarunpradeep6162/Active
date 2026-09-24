import * as THREE from 'three';
import { iridescentMaterial } from './materials';

/**
 * The mark: a glass heart holding a "D" (for Dheepika), trailed by two tube ribbons that
 * flow out of the heart's point.
 */
function glyphGeometry() {
  // D: straight spine on the left, round bowl on the right, with a matching counter
  const d = new THREE.Shape();
  d.moveTo(-0.4, -0.5);
  d.lineTo(0.0, -0.5);
  d.absarc(0.0, 0.0, 0.5, -Math.PI / 2, Math.PI / 2, false);
  d.lineTo(-0.4, 0.5);
  d.closePath();
  const counter = new THREE.Path();
  counter.moveTo(-0.2, -0.3);
  counter.lineTo(0.0, -0.3);
  counter.absarc(0.0, 0.0, 0.3, -Math.PI / 2, Math.PI / 2, false);
  counter.lineTo(-0.2, 0.3);
  counter.closePath();
  d.holes.push(counter);
  const g = new THREE.ExtrudeGeometry(d, {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.035,
    bevelSegments: 4,
    curveSegments: 28,
  });
  g.center();
  return g;
}

/** Closed heart outline (the classic parametric heart), ~2.1 wide, centred on the glyph. */
function heartCurve() {
  const pts: THREE.Vector3[] = [];
  const N = 96;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push(new THREE.Vector3(x / 15, y / 15 + 0.12, 0));
  }
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal');
}

function strand(sign: number) {
  const pts = [
    [-0.02, -1.0, 0.02],
    [-0.3, -1.38, 0.08],
    [-0.62, -1.9, 0.14],
    [-0.12, -3.0, 0.06],
    [0.35, -3.9, -0.08],
    [0.95, -5.4, -0.2],
    [1.45, -7.5, -0.25],
    [1.8, -10.5, -0.3],
  ].map(([x, y, z]) => new THREE.Vector3(x * sign, y, z * sign));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}

export class Emblem {
  readonly group = new THREE.Group();
  readonly core = new THREE.Group();
  private ring: THREE.Mesh;
  private glyph: THREE.Mesh;
  readonly materials: THREE.ShaderMaterial[] = [];

  constructor(flip = false) {
    const ringMat = iridescentMaterial({ base: '#3a0a1c', envTop: '#e87a98', envBottom: '#12040a', film: 0.7, glow: 0.75 });
    const glyphMat = iridescentMaterial({ base: '#5a1230', envTop: '#ffc2d4', envBottom: '#2b0818', film: 0.8, glow: 1.3 });
    const ribbonMat = iridescentMaterial({
      useUvGradient: true,
      gradientA: '#ff2748',
      gradientB: '#ff8aa6',
      envTop: '#ffd1dc',
      envBottom: '#2a0710',
      film: 0.6,
      glow: 0.9,
    });
    this.materials.push(ringMat, glyphMat, ribbonMat);

    this.ring = new THREE.Mesh(new THREE.TubeGeometry(heartCurve(), 360, 0.068, 20, true), ringMat);
    this.glyph = new THREE.Mesh(glyphGeometry(), glyphMat);
    this.glyph.scale.setScalar(0.95);
    this.glyph.position.y = 0.08;
    this.core.add(this.ring, this.glyph);
    this.group.add(this.core);

    const ribbons = new THREE.Group();
    for (const sgn of [1, -1]) {
      const tube = new THREE.Mesh(new THREE.TubeGeometry(strand(sgn), 220, 0.042, 12, false), ribbonMat);
      ribbons.add(tube);
    }
    if (flip) ribbons.rotation.z = Math.PI;
    this.group.add(ribbons);
  }

  /** reveal: 0 → edge‑on, 1 → facing camera. */
  update(time: number, reveal: number, pointerX: number, pointerY: number, spin = 0) {
    const e = 1 - Math.pow(1 - reveal, 3);
    this.core.rotation.y = (1 - e) * Math.PI * 0.5 + pointerX * 0.18 + Math.sin(time * 0.4) * 0.05 + spin;
    this.core.rotation.x = -pointerY * 0.12 + Math.sin(time * 0.33) * 0.03;
    this.glyph.rotation.y = Math.sin(time * 0.5) * 0.15;
    this.core.position.y = Math.sin(time * 0.6) * 0.04;
  }
}

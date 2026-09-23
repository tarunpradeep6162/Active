import * as THREE from 'three';
import { iridescentMaterial } from './materials';

/** Original studio mark: a glass ring holding a notched chevron glyph, trailed by two tube ribbons. */
function glyphGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.52, -0.46);
  s.lineTo(-0.06, 0.5);
  s.lineTo(0.06, 0.5);
  s.lineTo(0.52, -0.46);
  s.lineTo(0.27, -0.46);
  s.lineTo(0.0, 0.1);
  s.lineTo(-0.27, -0.46);
  s.closePath();
  const bar = new THREE.Shape();
  bar.moveTo(-0.16, -0.2);
  bar.lineTo(0.16, -0.2);
  bar.lineTo(0.11, -0.3);
  bar.lineTo(-0.11, -0.3);
  bar.closePath();
  const g = new THREE.ExtrudeGeometry([s, bar], {
    depth: 0.16,
    bevelEnabled: true,
    bevelThickness: 0.05,
    bevelSize: 0.035,
    bevelSegments: 4,
    curveSegments: 4,
  });
  g.center();
  return g;
}

function strand(sign: number) {
  const pts = [
    [-0.99, -0.12, 0.02],
    [-0.93, -0.75, 0.08],
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

    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.068, 36, 180), ringMat);
    this.glyph = new THREE.Mesh(glyphGeometry(), glyphMat);
    this.glyph.scale.setScalar(1.05);
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

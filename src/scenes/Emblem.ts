import * as THREE from 'three';
import { roseGoldMaterial } from './materials';
import { globalUniforms } from '../world/uniforms';

/**
 * The mark: a rose‑gold heart holding a champagne "D" (for Dheepika), a warm light inside it
 * and gold dust turning around it, with the first tulip's stem and leaves flowing down from
 * the heart's point.
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

/** The stem of the first tulip: a gentle S from the heart's point down through the frame. */
function stemCurve() {
  const pts = [
    [0, -1.0, 0.02],
    [-0.12, -1.8, 0.06],
    [0.1, -3.0, 0.04],
    [0.28, -4.6, -0.04],
    [0.12, -6.4, -0.1],
    [-0.1, -8.4, -0.16],
    [0.05, -10.5, -0.2],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}

/** A slender tulip leaf, base at the origin, growing along +Y. */
function leafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.34, 0.5, 0.3, 1.2, 0.02, 1.9);
  s.bezierCurveTo(-0.12, 1.2, -0.14, 0.5, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.015, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.018, bevelSegments: 3, curveSegments: 24 });
  g.translate(0, 0, -0.008);
  return g;
}

export class Emblem {
  readonly group = new THREE.Group();
  readonly core = new THREE.Group();
  private ring: THREE.Mesh;
  private glyph: THREE.Mesh;
  private glow: THREE.Mesh;
  private dust: THREE.Points;
  readonly materials: THREE.ShaderMaterial[] = [];

  constructor(flip = false) {
    // polished rose gold for the heart, warm champagne for her initial, gold for the stem
    const ringMat = roseGoldMaterial('#f2b8a0', 0.12);
    const glyphMat = roseGoldMaterial('#ffe0b0', 0.3);
    const stemMat = roseGoldMaterial('#d8b27a', 0.05);
    this.materials.push(ringMat, glyphMat, stemMat);

    this.ring = new THREE.Mesh(new THREE.TubeGeometry(heartCurve(), 360, 0.072, 24, true), ringMat);
    this.glyph = new THREE.Mesh(glyphGeometry(), glyphMat);
    this.glyph.scale.setScalar(0.95);
    this.glyph.position.y = 0.08;
    // a soft warm light held inside the heart, and gold dust turning slowly around it
    this.glow = new THREE.Mesh(
      new THREE.PlaneGeometry(4.4, 4.4),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: globalUniforms.uTime },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv - .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
        fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ float r = length(vUv); float a = exp(-r * 7.) * (.32 + .06 * sin(uTime * 1.3)); gl_FragColor = vec4(vec3(1., .62, .5) * a, a); }`,
      }),
    );
    this.glow.position.z = -0.25;
    this.materials.push(this.glow.material as THREE.ShaderMaterial);
    const n = 260;
    const dp = new Float32Array(n * 3), ds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 1.45 + Math.random() * 0.9;
      dp.set([Math.cos(a) * r, Math.sin(a) * r * 0.9 + 0.1, (Math.random() - 0.5) * 0.8], i * 3);
      ds[i] = Math.random();
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    dg.setAttribute('aSeed', new THREE.BufferAttribute(ds, 1));
    this.dust = new THREE.Points(
      dg,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: globalUniforms.uTime, uPx: globalUniforms.uDPR },
        vertexShader: /* glsl */ `attribute float aSeed; uniform float uTime, uPx; varying float vA;
          void main(){ float a = uTime * (.05 + aSeed * .06); vec3 p = position; p.xy = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xy;
            vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
            vA = .3 + .7 * pow(.5 + .5 * sin(uTime * (1. + aSeed * 2.) + aSeed * 50.), 3.);
            gl_PointSize = uPx * 60. * (.25 + aSeed * .4) / -mv.z; }`,
        fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = (smoothstep(.5, 0., d) * .4 + smoothstep(.12, 0., d)) * vA; gl_FragColor = vec4(vec3(1., .85, .6) * a, a); }`,
      }),
    );
    this.dust.frustumCulled = false;
    this.materials.push(this.dust.material as THREE.ShaderMaterial);
    this.core.add(this.glow, this.ring, this.glyph, this.dust);
    this.group.add(this.core);

    // the first tulip's stem, with two leaves, flowing down out of the heart's point
    const stem = new THREE.Group();
    stem.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve(), 260, 0.045, 12, false), stemMat));
    const leaf = leafGeometry();
    for (const [y, side, lean, s] of [[-2.9, -1, 0.75, 1.15], [-4.9, 1, -0.7, 1.35]] as const) {
      const l = new THREE.Mesh(leaf, stemMat);
      const p = stemCurve().getPoint((-y - 1) / 9.5);
      l.position.copy(p);
      l.rotation.set(0.15, side * 0.35, lean);
      l.scale.setScalar(s);
      stem.add(l);
    }
    if (flip) stem.rotation.z = Math.PI;
    this.group.add(stem);
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

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { globalUniforms } from '../world/uniforms';
import { noise, math, fog } from '../shaders/chunks';
import { standardVert } from './materials';
import { rng } from '../utils/math';

/**
 * A procedural three‑tier birthday cake (original design): gold stand, rose fondant tiers with
 * glossy berry glaze drips, pearl piping, berries, sprinkles, spiral candles with flickering
 * flames and a gold heart topper. Local origin = centre of the stand's foot on the floor.
 *
 * `setLit(0…1)` lights the candles (one after another); the cake's own shading picks up the
 * warm candle light as they ignite.
 */
const TIERS = [
  { y: 0.58, h: 0.78, r: 1.28 },
  { y: 1.36, h: 0.64, r: 0.94 },
  { y: 2.0, h: 0.54, r: 0.62 },
] as const;
const TOP = TIERS[2].y + TIERS[2].h;
const CANDLES = 9;

/** Shared lighting for every cake surface: candle glow from above + the room's rose light + rim. */
function cakeMaterial(color: string, o: { gloss?: number; sheen?: number; bump?: number; emissive?: number } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: standardVert,
    fragmentShader: /* glsl */ `
      ${math}
      ${noise}
      ${fog}
      uniform vec3 uColor; uniform float uGloss, uSheen, uBump, uEmissive, uLit, uTime;
      uniform vec3 uCandle, uRose;
      varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vUv; varying vec3 vLocal;
      void main(){
        vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
        // soft creamy surface: low‑frequency lumps, never plastic‑smooth
        vec3 q = vWorldPos * 9.;
        N = normalize(N + uBump * vec3(snoise(q), snoise(q + 7.1), snoise(q + 13.7)));
        vec3 V = normalize(cameraPosition - vWorldPos);
        float flick = .88 + .12 * sin(uTime * 11.) * sin(uTime * 4.3 + vWorldPos.x);
        // candle light (warm, from above the top tier)
        vec3 Lc = uCandle - vWorldPos; float dc = length(Lc); Lc /= dc;
        float candle = uLit * flick / (1. + dc * dc * .35);
        // rose room light from the front‑left, low
        vec3 Lr = normalize(uRose - vWorldPos);
        float diffC = max(dot(N, Lc), 0.) * candle;
        float diffR = max(dot(N, Lr), 0.) * .55;
        vec3 H = normalize(Lc + V);
        float spec = pow(max(dot(N, H), 0.), mix(12., 90., uGloss)) * uGloss * (candle * 2.2 + .25);
        vec3 Hr = normalize(Lr + V);
        spec += pow(max(dot(N, Hr), 0.), mix(12., 90., uGloss)) * uGloss * .6;
        float rim = pow(1. - max(dot(N, V), 0.), 3.) * uSheen;
        vec3 col = uColor * (.16 + diffR * vec3(1., .55, .62) + diffC * vec3(1.9, 1.3, .8));
        col += spec * vec3(1., .92, .85) + rim * vec3(.95, .45, .6) * .5 + uColor * uEmissive;
        gl_FragColor = vec4(applyFog(col, vDepth), 1.);
      }`,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uGloss: { value: o.gloss ?? 0.3 },
      uSheen: { value: o.sheen ?? 0.4 },
      uBump: { value: o.bump ?? 0.05 },
      uEmissive: { value: o.emissive ?? 0 },
      uLit: litUniform,
      uCandle: candleUniform,
      uRose: roseUniform,
      uTime: globalUniforms.uTime,
      uFogColor: globalUniforms.uFogColor,
      uFogDensity: globalUniforms.uFogDensity,
    },
  });
}
const litUniform = { value: 0 };
/** 0…1: how hard the candles are being blown (flames lean and shrink) */
const blowUniform = { value: 0 };
const candleUniform = { value: new THREE.Vector3() };
const roseUniform = { value: new THREE.Vector3() };

/** Glaze skirt hanging over a tier's top edge: ragged drips of different lengths. */
function dripGeometry(r: number, top: number, h: number, seed: number) {
  const rr = rng(seed);
  const drips = Array.from({ length: 14 + Math.round(r * 8) }, () => ({ a: rr() * Math.PI * 2, w: 0.05 + rr() * 0.07, len: (0.25 + rr() * 0.55) * h }));
  const segs = 180, rows = 14, pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    let L = 0.07 + 0.02 * Math.sin(a * 7 + seed);
    for (const d of drips) {
      const da = Math.atan2(Math.sin(a - d.a), Math.cos(a - d.a)) / d.w;
      L = Math.max(L, d.len * Math.exp(-da * da));
    }
    for (let j = 0; j <= rows; j++) {
      const t = j / rows;
      // glaze thickens toward the rounded drip tips
      const rad = r + 0.03 + 0.018 * Math.sin(Math.PI * Math.min(1, t * 1.15));
      pos.push(Math.cos(a) * rad, top + 0.02 - t * L, Math.sin(a) * rad);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < rows; j++) {
    const a = i * (rows + 1) + j, b = a + rows + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the glaze pooled on top of the tier
  const cap = new THREE.CylinderGeometry(r + 0.045, r + 0.045, 0.05, 72).translate(0, top + 0.02, 0);
  cap.deleteAttribute('uv');
  return mergeGeometries([g.toNonIndexed(), cap.toNonIndexed()])!;
}

function heartShape(s: number) {
  const h = new THREE.Shape();
  h.moveTo(0, -0.9 * s);
  h.bezierCurveTo(-1.2 * s, -0.1 * s, -0.9 * s, 0.9 * s, 0, 0.45 * s);
  h.bezierCurveTo(0.9 * s, 0.9 * s, 1.2 * s, -0.1 * s, 0, -0.9 * s);
  return h;
}

export class BirthdayCake {
  readonly group = new THREE.Group();
  readonly materials: THREE.ShaderMaterial[] = [];
  /** meshes that respond to a tap */
  readonly pickables: THREE.Object3D[] = [];
  private flames: THREE.InstancedMesh;
  private flameMat: THREE.ShaderMaterial;
  private topper: THREE.Mesh;
  private sparkles: THREE.Points;
  private sparkleMat: THREE.ShaderMaterial;

  constructor() {
    const g = this.group;
    const add = (m: THREE.Object3D) => (g.add(m), m);
    const gold = cakeMaterial('#d9a441', { gloss: 0.85, sheen: 0.6, bump: 0.005 });
    const fondant = cakeMaterial('#f2c9d3', { gloss: 0.18, sheen: 0.55, bump: 0.035 });
    const glaze = cakeMaterial('#6e1430', { gloss: 0.95, sheen: 0.8, bump: 0.01 });
    const pearl = cakeMaterial('#fff4e6', { gloss: 0.9, sheen: 0.9, bump: 0 });
    const berry = cakeMaterial('#b0112e', { gloss: 0.8, sheen: 0.7, bump: 0.02 });
    const candleMat = new THREE.ShaderMaterial({
      vertexShader: standardVert,
      fragmentShader: /* glsl */ `
        ${fog}
        uniform float uLit;
        varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vUv; varying vec3 vLocal;
        void main(){
          // spiral stripes, cream and rose
          float s = step(.5, fract((vLocal.y * 9.) + atan(vLocal.z, vLocal.x) / 6.2832 * 2.));
          vec3 col = mix(vec3(1., .95, .88), vec3(.95, .38, .55), s);
          vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vWorldPos);
          col *= .35 + .5 * max(dot(N, V), 0.) + uLit * .5;
          gl_FragColor = vec4(applyFog(col, vDepth), 1.);
        }`,
      uniforms: { uLit: litUniform, uFogColor: globalUniforms.uFogColor, uFogDensity: globalUniforms.uFogDensity },
    });
    this.materials.push(gold, fondant, glaze, pearl, berry, candleMat);

    // stand: foot, stem and plate as one lathe profile
    const prof = [[0, 0], [0.82, 0], [0.86, 0.04], [0.6, 0.1], [0.2, 0.16], [0.16, 0.34], [0.22, 0.44], [1.5, 0.5], [1.56, 0.54], [1.5, 0.57], [0, 0.57]].map(([x, y]) => new THREE.Vector2(x, y));
    add(new THREE.Mesh(new THREE.LatheGeometry(prof, 96), gold));

    const pearls: THREE.Matrix4[] = [];
    const berries: THREE.Matrix4[] = [];
    const m4 = () => new THREE.Matrix4();
    const rr = rng(311);
    TIERS.forEach((t, k) => {
      const body = add(new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r, t.h, 96, 1), fondant));
      body.position.y = t.y + t.h / 2;
      this.pickables.push(body);
      add(new THREE.Mesh(dripGeometry(t.r, t.y + t.h, t.h, 17 + k * 11), glaze));
      // pearl piping around the foot of each tier
      const n = Math.round((Math.PI * 2 * (t.r + 0.03)) / 0.085);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        pearls.push(m4().compose(new THREE.Vector3(Math.cos(a) * (t.r + 0.03), t.y + 0.04, Math.sin(a) * (t.r + 0.03)), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
      }
      // berries on the ledge above this tier (the next tier sits inside them)
      if (k < 2) {
        const inner = TIERS[k + 1].r, ring = (t.r + inner) / 2 + 0.02;
        const nb = 10 + k * -2;
        for (let i = 0; i < nb; i++) {
          const a = (i / nb) * Math.PI * 2 + rr() * 0.2;
          const s = 0.8 + rr() * 0.4;
          berries.push(m4().compose(new THREE.Vector3(Math.cos(a) * ring, t.y + t.h + 0.1, Math.sin(a) * ring), new THREE.Quaternion(), new THREE.Vector3(s, s * 1.15, s)));
        }
      }
    });
    const pearlMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.042, 12, 8), pearl, pearls.length);
    pearls.forEach((m, i) => pearlMesh.setMatrixAt(i, m));
    add(pearlMesh);
    const berryMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 16, 12), berry, berries.length);
    berries.forEach((m, i) => berryMesh.setMatrixAt(i, m));
    add(berryMesh);

    // sprinkles on the top tier
    const sprinkleCols = ['#ffd89a', '#ff7aa2', '#fff4e6', '#c77dff'];
    sprinkleCols.forEach((col, ci) => {
      const mat = cakeMaterial(col, { gloss: 0.6, emissive: 0.25 });
      this.materials.push(mat);
      const sp = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.012, 0.05, 2, 6), mat, 22);
      const q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < 22; i++) {
        const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * (TIERS[2].r - 0.08);
        e.set(Math.PI / 2, 0, rr() * Math.PI);
        sp.setMatrixAt(i, m4().compose(new THREE.Vector3(Math.cos(a) * d, TOP + 0.06, Math.sin(a) * d), q.setFromEuler(e), new THREE.Vector3(1, 1, 1)));
      }
      add(sp).userData.ci = ci;
    });

    // spiral candles in a ring on the top tier
    const candleGeo = new THREE.CylinderGeometry(0.03, 0.034, 0.34, 16, 6).translate(0, 0.17, 0);
    const candles = new THREE.InstancedMesh(candleGeo, candleMat, CANDLES);
    const flameGeo = new THREE.PlaneGeometry(0.24, 0.44).translate(0, 0.16, 0);
    this.flameMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aIndex;
        uniform float uTime; uniform float uLit; uniform float uBlow;
        varying vec2 vUv; varying float vOn;
        void main(){
          // billboard: keep the instance's position, face the camera
          vec4 base = modelViewMatrix * instanceMatrix * vec4(0., 0., 0., 1.);
          float flick = 1. + .12 * sin(uTime * 13. + aIndex * 2.3) + .06 * sin(uTime * 29. + aIndex);
          vOn = clamp(uLit * ${CANDLES.toFixed(1)} - aIndex, 0., 1.);
          float gust = uBlow * (.8 + .2 * sin(uTime * 21. + aIndex * 3.));
          vec2 p = position.xy * vec2(1. + gust * .3, flick * (1. - gust * .45)) * vOn;
          p.x += sin(uTime * 3. + aIndex) * .015 * position.y * 4. + gust * max(position.y, 0.) * .9;
          gl_Position = projectionMatrix * (base + vec4(p, 0., 0.));
          vUv = uv;
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying float vOn;
        void main(){
          vec2 c = vUv - vec2(.5, .32);
          c.y *= c.y > 0. ? .55 : 1.2;
          float d = length(c * vec2(2.2, 2.));
          float core = smoothstep(.34, .0, d);
          float halo = smoothstep(1., .0, d) * .35;
          vec3 col = mix(vec3(1., .45, .12), vec3(1., .95, .75), core) * (core * 1.6 + halo);
          gl_FragColor = vec4(col * vOn, 1.);
        }`,
      uniforms: { uTime: globalUniforms.uTime, uLit: litUniform, uBlow: blowUniform },
    });
    this.flames = new THREE.InstancedMesh(flameGeo, this.flameMat, CANDLES);
    const aIndex = new Float32Array(CANDLES);
    for (let i = 0; i < CANDLES; i++) {
      const a = (i / CANDLES) * Math.PI * 2;
      const r = TIERS[2].r - 0.16;
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)), 0.05);
      candles.setMatrixAt(i, m4().compose(new THREE.Vector3(Math.cos(a) * r, TOP + 0.04, Math.sin(a) * r), tilt, new THREE.Vector3(1, 1, 1)));
      this.flames.setMatrixAt(i, m4().makeTranslation(Math.cos(a) * r, TOP + 0.4, Math.sin(a) * r));
      aIndex[i] = i;
    }
    this.flames.geometry.setAttribute('aIndex', new THREE.InstancedBufferAttribute(aIndex, 1));
    this.flames.frustumCulled = false;
    add(candles);
    add(this.flames);
    this.materials.push(this.flameMat);

    // gold heart topper on a thin pick
    const heart = new THREE.ExtrudeGeometry(heartShape(0.16), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 4, curveSegments: 24 });
    heart.center();
    this.topper = new THREE.Mesh(heart, cakeMaterial('#e8b04e', { gloss: 0.95, sheen: 0.8, bump: 0, emissive: 0.15 }));
    this.materials.push(this.topper.material as THREE.ShaderMaterial);
    this.topper.position.set(0, TOP + 0.58, 0);
    add(this.topper);
    const pick = add(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 6), gold));
    pick.position.set(0, TOP + 0.26, 0);

    // celebration sparkles (burst when the cage opens, then drift upward)
    const N = 380;
    const seeds = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) seeds.set([rr() * Math.PI * 2, rr(), rr(), rr()], i * 4);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
    sg.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 4));
    this.sparkleMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uBurst, uTime, uPx;
        varying float vA; varying float vHue;
        void main(){
          float t = fract(aSeed.y + uTime * (.05 + aSeed.z * .06));
          float r = (.4 + aSeed.w * 2.2) * (.3 + .7 * uBurst);
          if (aSeed.z > .62) { t = fract(aSeed.y + uTime * (.03 + aSeed.w * .03)); r *= 1.3; }
          vec3 p = vec3(cos(aSeed.x + t * 2.) * r, ${TOP.toFixed(2)} * (.4 + t * 1.4), sin(aSeed.x + t * 2.) * r);
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_Position = projectionMatrix * mv;
          vA = min(uBurst, 1.) * sin(3.1416 * t) * (.5 + .5 * sin(uTime * 6. + aSeed.x * 20.));
          vHue = aSeed.z;
          gl_PointSize = uPx * (2. + aSeed.w * 3.) * (aSeed.z > .62 ? 2.2 : 1.) / -mv.z;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying float vHue;
        void main(){
          vec2 c = gl_PointCoord - .5;
          if (vHue > .62) {
            // a petal: a soft rotated ellipse, rose with a paler base
            float an = vHue * 40.;
            c = mat2(cos(an), -sin(an), sin(an), cos(an)) * c;
            float d = length(c * vec2(1., 2.1));
            float a = smoothstep(.42, .3, d) * vA * .8;
            gl_FragColor = vec4(mix(vec3(.95, .55, .62), vec3(1., .85, .85), c.y + .5) * a, 1.);
            return;
          }
          float d = length(c);
          float a = smoothstep(.5, 0., d) * vA;
          gl_FragColor = vec4(mix(vec3(1., .85, .5), vec3(.95, .76, .45), vHue) * a, 1.);
        }`,
      uniforms: { uBurst: { value: 0 }, uTime: globalUniforms.uTime, uPx: { value: 22 } },
    });
    this.sparkles = new THREE.Points(sg, this.sparkleMat);
    this.sparkles.frustumCulled = false;
    add(this.sparkles);
    this.materials.push(this.sparkleMat);
  }

  /** World positions that light the cake (call after placing the group). */
  syncLights(rose: THREE.Vector3) {
    this.group.updateMatrixWorld();
    candleUniform.value.set(0, TOP + 0.9, 0).applyMatrix4(this.group.matrixWorld);
    roseUniform.value.copy(rose);
  }

  /** lit: candles igniting 0…1 · burst: sparkles (0…1, more is a bigger cloud) · blow: flames leaning */
  update(time: number, lit: number, burst: number, dpr: number, blow = 0) {
    litUniform.value = lit;
    blowUniform.value = blow;
    this.sparkleMat.uniforms.uBurst.value = burst;
    this.sparkleMat.uniforms.uPx.value = 22 * dpr;
    this.topper.rotation.y = time * 0.8;
    this.topper.position.y = TOP + 0.58 + Math.sin(time * 1.6) * 0.03;
  }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { globalUniforms } from '../world/uniforms';
import { noise, math, fog } from '../shaders/chunks';
import { standardVert } from './materials';
import { SPINE, WORK_ORIGIN, spineBottom } from '../work/WorkLayout';
import { rng, clamp, smoothstep } from '../utils/math';

/**
 * The living tulip garden that replaces the old central column in the Work world.
 *
 * Same spatial role and the same hooks as before — the measured camera still orbits and
 * descends around the axis, the entry seam still grows the structure bottom‑up (`setReveal`)
 * and the exit seam still dissolves it (`setCrumble`) — so the scroll choreography is untouched.
 *
 * Structure (all procedural, instanced):
 *  - one weaving central stem through the full height of the Work world
 *  - 25 significant blooms: the 14 chapter tulips (standing where the chapter anchors are,
 *    see `syncChapter`) + 11 blooms along the central stem; the last chapter tulip is the
 *    largest and stays closed until the end
 *  - closed buds, arching branch stems out to every chapter tulip, dark leaves
 *  - petals hinge open individually in the vertex shader (no whole‑flower scaling)
 *  - a translucent silk ribbon spiralling round it, drifting petals, warm cores that glow
 *    as each flower opens
 * Scroll → bloom is a pure function of work progress (reverse scroll closes them again).
 */

const PETALS = 6;
const AXIS_BLOOMS = 11;
const CHAPTER_BLOOMS = 14;
const BUDS = 20;
const TOP = SPINE.top + 0.6;
const BOTTOM = spineBottom() - 0.4;

// shared uniforms (one garden)
const U = {
  uTime: globalUniforms.uTime,
  uFogColor: globalUniforms.uFogColor,
  uFogDensity: globalUniforms.uFogDensity,
  uRevealY: { value: 1e5 },
  uCrumble: { value: 0 },
  /** light progression through the journey: 0 = midnight blue … 1 = sunset gold */
  uWarm: { value: 0 },
  /** wish pulse: world y of the travelling light front (below the garden = idle) */
  uPulseY: { value: -1e5 },
  uPulseAmt: { value: 0 },
  uReveal: { value: 0 },
  uFocus: globalUniforms.uFocus,
};

const commonGlsl = /* glsl */ `
  uniform float uRevealY, uCrumble, uWarm, uPulseY, uPulseAmt, uReveal, uTime, uFocus;
  // entry: grows bottom‑up behind a ragged front · exit: dissolves into motes
  float gardenMask(vec3 wp){
    float edge = uRevealY - wp.y + snoise(wp * 2.3) * .35;
    float crumble = snoise(wp * 1.7) * .35 + .7 - uCrumble * 1.4;
    return min(edge, crumble);
  }
  vec3 keyLight(){ return mix(vec3(.42, .48, .78), vec3(1., .72, .46), uWarm); }
  // the wish's light travelling up the plant
  float pulse(vec3 wp){ return uPulseAmt * exp(-pow((wp.y - uPulseY) * 1.3, 2.)); }
`;

/* ------------------------------------------------------------------ petals */

/** One tulip petal: hinge at the origin, grows along +Y, cupped, faces +Z (outward). */
function petalGeometry(len: number, wid: number, su = 10, sv = 14) {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= sv; j++) {
    const v = j / sv;
    const w = wid * 0.5 * Math.pow(Math.sin(Math.PI * Math.min(0.999, v * 0.97 + 0.02)), 0.55) * (1 - 0.12 * v) + 0.07 * wid * (1 - v);
    for (let i = 0; i <= su; i++) {
      const u = (i / su) * 2 - 1;
      const x = u * w;
      const y = v * len;
      const z = -0.46 * wid * u * u * Math.sqrt(Math.sin(Math.PI * Math.max(0.02, v))) + 0.16 * len * Math.sin(Math.PI * v * 0.85);
      pos.push(x, y, z);
      uv.push(i / su, v);
    }
  }
  for (let j = 0; j < sv; j++) for (let i = 0; i < su; i++) {
    const a = j * (su + 1) + i, b = a + su + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const petalVert = /* glsl */ `
  attribute float aBloom;
  attribute vec3 aInfo; // x: inner petal, y: flower index, z: seed
  uniform float uTime;
  uniform float uKeep;
  varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vUv; varying float vBloom; varying float vInner; varying float vSeed; varying float vKeep;
  mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  void main(){
    vec3 p = position; vec3 n = normal;
    float b = aBloom;
    // tips curl outward as the flower opens
    p.z += b * .16 * p.y * p.y;
    // hinge: closed cup (tips lean in) → open (outer petals further than inner)
    float open = mix(.62, .34, aInfo.x); // a tulip opens into a goblet, not flat
    float th = mix(-.2, open, b) + sin(uTime * .8 + aInfo.y * 1.7 + aInfo.z * 6.) * .025 * b;
    p.yz = rot(-th) * p.yz; n.yz = rot(-th) * n.yz;
    p.z += .05 + .04 * b; // hinge ring
    p *= mix(.92, 1.06, b) * mix(1., .88, aInfo.x);
    vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.);
    vWorldPos = wp.xyz;
    vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
    vec4 mv = viewMatrix * wp; vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
    vUv = uv; vBloom = b; vInner = aInfo.x; vSeed = aInfo.z; vKeep = step(abs(aInfo.y - uKeep), .5);
  }`;

const petalFrag = /* glsl */ `
  ${math}
  ${noise}
  ${fog}
  ${commonGlsl}
  varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vUv; varying float vBloom; varying float vInner; varying float vSeed; varying float vKeep;
  void main(){
    // the final tulip stays while everything around it dissolves at the end of the garden
    if (vKeep < .5 && gardenMask(vWorldPos) < 0.) discard;
    if (vKeep > .5 && uRevealY - vWorldPos.y + snoise(vWorldPos * 2.3) * .35 < 0.) discard;
    vec3 N = normalize(vN);
    bool inside = !gl_FrontFacing; if (inside) N = -N;
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(vec3(.55, .35, .75));
    float v = vUv.y;
    // tulip colour: champagne base → rose body → blush tips, fine veins
    vec3 base = vec3(.95, .78, .52), rose = vec3(.78, .2, .36), blush = vec3(.98, .58, .68);
    vec3 col = mix(base, rose, smoothstep(.05, .38, v));
    col = mix(col, blush, smoothstep(.6, 1., v) * .6);
    col *= .9 + .1 * sin(vUv.x * 48. + vSeed * 20.);
    float ndl = max(dot(N, L), 0.), ndv = max(dot(N, V), 0.);
    vec3 light = keyLight();
    // petals are thin: light comes through them from behind
    float trans = pow(max(dot(-N, L), 0.), 1.5) * .42 + pow(1. - ndv, 2.) * .22;
    vec3 c = col * (.08 + ndl * .62 * light + trans * light * vec3(1., .62, .58));
    // warm glow from inside the opening flower
    c += inside ? base * vBloom * (.18 + .3 * (1. - v)) * mix(.45, 1., uWarm) : vec3(0.);
    // dew: tiny sparkling droplets that catch the light
    vec2 cell = floor(vUv * vec2(16., 22.) + vSeed * 13.);
    float dew = step(.965, hash12(cell)) * pow(max(dot(reflect(-L, N), V), 0.), 24.) * 2.4;
    c += dew * light;
    c += pulse(vWorldPos) * vec3(1., .78, .4) * 1.4 + uReveal * col * .25;
    c *= 1. - uFocus * .55;
    gl_FragColor = vec4(applyFog(c, vDepth), 1.);
  }`;

/* ------------------------------------------------------------------ stems / leaves */

const greenFrag = /* glsl */ `
  ${math}
  ${noise}
  ${fog}
  ${commonGlsl}
  uniform vec3 uColor;
  varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vUv; varying vec3 vLocal;
  void main(){
    if (gardenMask(vWorldPos) < 0.) discard;
    vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(vec3(.55, .35, .75));
    float ndl = max(dot(N, L), 0.);
    float rim = pow(1. - max(dot(N, V), 0.), 3.);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.), 40.) * .35;
    vec3 light = keyLight();
    vec3 c = uColor * (.12 + ndl * .8 * light) + rim * light * .22 + spec * light;
    c += pulse(vWorldPos) * vec3(1., .8, .45) * 1.2;
    c *= 1. - uFocus * .55;
    gl_FragColor = vec4(applyFog(c, vDepth), 1.);
  }`;

function greenMaterial(color: string) {
  return new THREE.ShaderMaterial({ vertexShader: standardVert, fragmentShader: greenFrag, uniforms: { ...U, uColor: { value: new THREE.Color(color) } }, side: THREE.DoubleSide });
}

/** A long, slightly curved leaf blade (base at origin, along +Y). */
function leafGeometry() {
  const segs = 12, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= segs; j++) {
    const v = j / segs, w = 0.09 * Math.sin(Math.PI * Math.min(1, v * 1.1 + 0.05)) + 0.01;
    const bend = 0.35 * v * v;
    for (const s of [-1, 0, 1]) {
      pos.push(s * w, v * 1.25, bend + Math.abs(s) * 0.03);
      uv.push((s + 1) / 2, v);
    }
  }
  for (let j = 0; j < segs; j++) for (let i = 0; i < 2; i++) {
    const a = j * 3 + i, b = a + 3;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ garden */

interface Bloom {
  /** head centre in garden‑local space (chapter blooms follow their anchor each frame) */
  pos: THREE.Vector3;
  /** flower axis (unit) */
  up: THREE.Vector3;
  scale: number;
  /** work progress at which it has fully opened (axis blooms) */
  openAt: number;
  chapter: number; // −1 for axis blooms
}

export class TulipGarden {
  readonly group = new THREE.Group();
  readonly materials: THREE.ShaderMaterial[] = [];
  private blooms: Bloom[] = [];
  private petals: THREE.InstancedMesh;
  private bloomAttr: THREE.InstancedBufferAttribute;
  private cores: THREE.InstancedMesh;
  private coreAttr: THREE.InstancedBufferAttribute;
  private labels: THREE.Mesh[] = [];
  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private tmpS = new THREE.Vector3();
  private yAxis = new THREE.Vector3(0, 1, 0);
  private zAxis = new THREE.Vector3(0, 0, 1);
  private facing = new THREE.Vector3();
  private qBase = new THREE.Quaternion();
  private qPetal = new THREE.Quaternion();
  private qAz = new THREE.Quaternion();
  private hinge = new THREE.Vector3();
  /** 0…1 per bloom, written each frame */
  private bloomNow: Float32Array;
  private mainCurve: THREE.CatmullRomCurve3;

  constructor(titles: Map<string, THREE.Texture>, chapterSlugs: string[], lowTier: boolean) {
    const g = this.group;
    g.position.copy(WORK_ORIGIN);
    const rr = rng(2511);

    // ── central stem, weaving left → centre → right → centre through depth
    const pts: THREE.Vector3[] = [];
    for (let y = TOP; y >= BOTTOM; y -= 0.9) {
      const k = (TOP - y) * 0.42;
      pts.push(new THREE.Vector3(Math.sin(k) * 0.45, y, Math.sin(k * 0.7 + 1.3) * 0.35));
    }
    this.mainCurve = new THREE.CatmullRomCurve3(pts);
    const stemMat = greenMaterial('#1f3a1c');
    const leafMat = greenMaterial('#274a22');
    this.materials.push(stemMat, leafMat);
    const stems: THREE.BufferGeometry[] = [new THREE.TubeGeometry(this.mainCurve, lowTier ? 200 : 420, 0.075, lowTier ? 6 : 8, false)];

    // ── the 11 axis blooms, alternating around the stem, larger toward the middle
    for (let i = 0; i < AXIS_BLOOMS; i++) {
      const t = (i + 0.5) / AXIS_BLOOMS;
      const y = TOP - 0.8 - t * (TOP - BOTTOM - 1.6);
      const onStem = this.stemAt(y);
      const a = i * 2.39 + 0.6;
      const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const head = onStem.clone().addScaledVector(out, 0.55 + rr() * 0.45).add(new THREE.Vector3(0, 0.55, 0));
      const up = out.clone().multiplyScalar(0.55).add(new THREE.Vector3(0, 1, 0)).normalize();
      stems.push(this.branch(onStem, head, up, 0.035));
      this.blooms.push({ pos: head, up, scale: 0.75 + 0.35 * Math.sin(Math.PI * t) + rr() * 0.15, openAt: 0, chapter: -1 });
    }
    // ── the 14 chapter blooms (positions are synced from the chapter anchors every frame)
    for (let c = 0; c < CHAPTER_BLOOMS; c++) this.blooms.push({ pos: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), scale: c === CHAPTER_BLOOMS - 1 ? 2.1 : 1.25, openAt: 0, chapter: c });
    this.bloomNow = new Float32Array(this.blooms.length);

    // ── buds on short twigs (closed, compositional)
    const budHeads: { pos: THREE.Vector3; up: THREE.Vector3; s: number }[] = [];
    for (let i = 0; i < BUDS; i++) {
      const y = TOP - 0.3 - rr() * (TOP - BOTTOM - 0.6);
      const onStem = this.stemAt(y);
      const a = rr() * Math.PI * 2;
      const out = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const head = onStem.clone().addScaledVector(out, 0.3 + rr() * 0.35).add(new THREE.Vector3(0, 0.35, 0));
      const up = out.clone().multiplyScalar(0.4).add(new THREE.Vector3(0, 1, 0)).normalize();
      stems.push(this.branch(onStem, head, up, 0.022));
      budHeads.push({ pos: head, up, s: 0.35 + rr() * 0.2 });
    }
    const stemMesh = new THREE.Mesh(mergeGeometries(stems.map((s) => { s.deleteAttribute('uv'); return s.index ? s.toNonIndexed() : s; }))!, stemMat);
    g.add(stemMesh);
    this.chapterStems = new THREE.Mesh(new THREE.BufferGeometry(), stemMat);
    g.add(this.chapterStems);

    // ── leaves along the stem
    const leafCount = lowTier ? 36 : 64;
    const leaves = new THREE.InstancedMesh(leafGeometry(), leafMat, leafCount);
    for (let i = 0; i < leafCount; i++) {
      const y = TOP - 0.2 - (i / leafCount) * (TOP - BOTTOM - 0.4);
      const p = this.stemAt(y);
      const a = i * 2.2 + rr() * 0.6;
      this.tmpQ.setFromEuler(new THREE.Euler(0.45 + rr() * 0.4, a, 0, 'YXZ'));
      const s = 0.7 + rr() * 0.6;
      leaves.setMatrixAt(i, this.tmpM.compose(p, this.tmpQ, this.tmpS.set(s, s, s)));
    }
    g.add(leaves);

    // ── petals: one instanced mesh for every petal of every bloom and bud
    // lighter petals, leaves, stem and ribbon on low‑tier devices (same silhouette, fewer triangles)
    const petalGeo = lowTier ? petalGeometry(0.66, 0.54, 6, 9) : petalGeometry(0.66, 0.54);
    const nPetals = (this.blooms.length + BUDS) * PETALS;
    const petalMat = new THREE.ShaderMaterial({ vertexShader: petalVert, fragmentShader: petalFrag, uniforms: { ...U, uKeep: { value: AXIS_BLOOMS + CHAPTER_BLOOMS - 1 } }, side: THREE.DoubleSide });
    this.materials.push(petalMat);
    this.petals = new THREE.InstancedMesh(petalGeo, petalMat, nPetals);
    this.petals.frustumCulled = false;
    this.bloomAttr = new THREE.InstancedBufferAttribute(new Float32Array(nPetals), 1);
    this.bloomAttr.setUsage(THREE.DynamicDrawUsage);
    const info = new Float32Array(nPetals * 3);
    for (let f = 0; f < this.blooms.length + BUDS; f++) for (let k = 0; k < PETALS; k++) info.set([k % 2, f, rr()], (f * PETALS + k) * 3);
    petalGeo.setAttribute('aBloom', this.bloomAttr);
    petalGeo.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 3));
    g.add(this.petals);
    // buds are static: write them once
    budHeads.forEach((b, i) => this.writeFlower(this.blooms.length + i, b.pos, b.up, b.s, 0.04));

    // ── glowing cores: the warm light that escapes as each significant bloom opens
    const coreMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aGlow;
        varying vec2 vUv; varying float vGlow;
        void main(){
          vec4 base = modelViewMatrix * instanceMatrix * vec4(0., 0., 0., 1.);
          float s = length(instanceMatrix[0].xyz);
          gl_Position = projectionMatrix * (base + vec4(position.xy * s * (.6 + aGlow), 0., 0.));
          vUv = uv; vGlow = aGlow;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uRevealY, uCrumble;
        varying vec2 vUv; varying float vGlow;
        void main(){
          float d = length(vUv - .5) * 2.;
          float a = smoothstep(1., 0., d); a *= a;
          gl_FragColor = vec4(vec3(1., .78, .45) * a * vGlow * .7 * (1. - uCrumble), 1.);
        }`,
      uniforms: { uRevealY: U.uRevealY, uCrumble: U.uCrumble },
    });
    this.materials.push(coreMat);
    this.cores = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.5, 0.5), coreMat, this.blooms.length);
    this.cores.frustumCulled = false;
    this.coreAttr = new THREE.InstancedBufferAttribute(new Float32Array(this.blooms.length), 1);
    this.coreAttr.setUsage(THREE.DynamicDrawUsage);
    this.cores.geometry.setAttribute('aGlow', this.coreAttr);
    g.add(this.cores);

    // ── chapter name, glowing softly beneath each chapter tulip
    const labelMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: /* glsl */ `uniform sampler2D uTex; uniform float uAlpha; varying vec2 vUv;
        void main(){ float a = texture2D(uTex, vUv).a; gl_FragColor = vec4(vec3(1., .93, .84) * a, a * uAlpha); }`,
      uniforms: { uTex: { value: tex }, uAlpha: { value: 0 } },
    });
    for (const slug of chapterSlugs) {
      const t = titles.get(slug);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.5), labelMat(t ?? new THREE.Texture()));
      this.labels.push(m);
      this.materials.push(m.material as THREE.ShaderMaterial);
      g.add(m);
    }

    // ── the silk ribbon spiralling round the structure
    g.add(this.ribbon(lowTier ? 450 : 900));
    // ── drifting petals
    g.add(this.drift(lowTier ? 50 : 130, petalGeo));
    g.add(this.fireflies(lowTier ? 40 : 90));
    g.add(this.butterflies(lowTier ? 3 : 5));
    if (!lowTier) g.add(this.shafts(6));
  }

  private chapterStems: THREE.Mesh;
  private layoutSig = '';

  /** Point on the central stem at height y (garden‑local). */
  private stemAt(y: number) {
    const t = clamp((TOP - y) / (TOP - BOTTOM));
    return this.mainCurve.getPoint(t);
  }

  /** An arching stem from the central stem to a flower's base. */
  private branch(from: THREE.Vector3, head: THREE.Vector3, up: THREE.Vector3, r: number) {
    const base = head.clone().addScaledVector(up, -0.12);
    const mid = from.clone().lerp(base, 0.5);
    mid.y = Math.max(from.y, base.y) + 0.35;
    const out = new THREE.Vector3(base.x - from.x, 0, base.z - from.z).multiplyScalar(0.15);
    mid.add(out);
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, base), 24, r, 6, false);
  }

  /** Writes flower f's petal instances (head position, axis, scale) with bloom b. */
  private writeFlower(f: number, pos: THREE.Vector3, up: THREE.Vector3, scale: number, b: number) {
    this.qBase.setFromUnitVectors(this.yAxis, up);
    const hinge = this.hinge.copy(up).multiplyScalar(-0.28 * scale).add(pos); // petals hinge below the head centre
    for (let k = 0; k < PETALS; k++) {
      this.qAz.setFromAxisAngle(this.yAxis, (k * Math.PI * 2) / PETALS + (f % 3) * 0.4);
      this.qPetal.copy(this.qBase).multiply(this.qAz);
      this.petals.setMatrixAt(f * PETALS + k, this.tmpM.compose(hinge, this.qPetal, this.tmpS.set(scale, scale, scale)));
      this.bloomAttr.setX(f * PETALS + k, b);
    }
    this.petals.instanceMatrix.needsUpdate = true;
    this.bloomAttr.needsUpdate = true;
  }

  /** The translucent silk ribbon. */
  private ribbon(N: number) {
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const turns = 5.5, W = 0.3;
    const up = new THREE.Vector3(), radial = new THREE.Vector3(), c = new THREE.Vector3(), off = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const a = t * turns * Math.PI * 2;
      const y = TOP + 0.4 - t * (TOP - BOTTOM + 0.2);
      const R = 1.5 + 0.35 * Math.sin(t * 17) + 0.2 * Math.sin(t * 5.3);
      const stem = this.stemAt(y);
      radial.set(Math.cos(a), 0, Math.sin(a));
      c.copy(stem).addScaledVector(radial, R);
      // the band twists slowly between vertical and radial as it winds
      up.set(0, 1, 0).lerp(radial, 0.5 + 0.5 * Math.sin(t * 23)).normalize();
      for (const s of [-1, 1]) {
        off.copy(c).addScaledVector(up, s * W * 0.5);
        pos.push(off.x, off.y, off.z);
        uv.push(t, (s + 1) / 2);
      }
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: standardVert,
      fragmentShader: /* glsl */ `
        ${math}
        ${noise}
        ${fog}
        ${commonGlsl}
        uniform float uStrength;
        varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vUv; varying vec3 vLocal;
        void main(){
          if (gardenMask(vWorldPos) < 0.) discard;
          vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vWorldPos);
          float fres = pow(1. - abs(dot(N, V)), 2.);
          float edge = smoothstep(0., .18, vUv.y) * smoothstep(1., .82, vUv.y);
          float sheen = .5 + .5 * sin(vUv.x * 160. - uTime * 1.4 + vUv.y * 3.);
          float motes = step(.992, hash12(floor(vec2(vUv.x * 900. - uTime * 6., vUv.y * 6.)))) * 2.;
          vec3 col = mix(vec3(1., .82, .74), vec3(1., .9, .7), vUv.y) * mix(.6, 1.1, uWarm);
          float a = edge * (.1 + fres * .45 + sheen * .08) + motes * edge;
          a += pulse(vWorldPos) * .6;
          a *= uStrength * (1. - uFocus * .6);
          gl_FragColor = vec4(applyFog(col * a, vDepth) * a, 1.);
        }`,
      uniforms: { ...U, uStrength: this.ribbonStrength },
    });
    this.materials.push(mat);
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    return m;
  }
  private ribbonStrength = { value: 0.4 };

  /** Petals drifting down through the garden (some pass close to the camera's orbit). */
  private drift(count: number, petalGeo: THREE.BufferGeometry) {
    const geo = petalGeo.clone();
    geo.deleteAttribute('aBloom');
    geo.deleteAttribute('aInfo');
    geo.scale(0.26, 0.26, 0.26);
    const seeds = new Float32Array(count * 4);
    const rr = rng(77);
    for (let i = 0; i < count; i++) seeds.set([rr(), rr(), rr(), rr()], i * 4);
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime, uDensity;
        varying vec3 vWorldPos; varying float vDepth; varying vec2 vUv; varying float vOn;
        mat3 rotAxis(vec3 ax, float a){ float c = cos(a), s = sin(a); vec3 t = (1. - c) * ax;
          return mat3(t.x*ax.x + c, t.x*ax.y + s*ax.z, t.x*ax.z - s*ax.y, t.y*ax.x - s*ax.z, t.y*ax.y + c, t.y*ax.z + s*ax.x, t.z*ax.x + s*ax.y, t.z*ax.y - s*ax.x, t.z*ax.z + c); }
        void main(){
          float h = ${(TOP - BOTTOM + 4).toFixed(2)};
          float fall = fract(aSeed.y + uTime * (.008 + aSeed.z * .01));
          float a = aSeed.x * 6.2832 + uTime * (.05 + aSeed.w * .05);
          float r = 1.2 + aSeed.w * aSeed.w * 8.4;
          vec3 c = vec3(cos(a) * r, ${(TOP + 2).toFixed(2)} - fall * h, sin(a) * r);
          c.x += sin(uTime * .7 + aSeed.z * 30.) * .4;
          vec3 ax = normalize(vec3(aSeed.z - .5, 1., aSeed.w - .5));
          vec3 p = rotAxis(ax, uTime * (.6 + aSeed.x) + aSeed.y * 9.) * position;
          vOn = step(aSeed.z, uDensity);
          vec4 wp = modelMatrix * vec4(c + p * vOn, 1.);
          vWorldPos = wp.xyz; vUv = uv;
          vec4 mv = viewMatrix * wp; vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        ${math}
        ${noise}
        ${fog}
        ${commonGlsl}
        varying vec3 vWorldPos; varying float vDepth; varying vec2 vUv; varying float vOn;
        void main(){
          if (vOn < .5 || uCrumble > .95) discard;
          vec3 col = mix(vec3(1., .86, .66), vec3(.95, .45, .58), smoothstep(.05, .5, vUv.y));
          col *= mix(.35, 1., uWarm) * (1. - uFocus * .5);
          gl_FragColor = vec4(applyFog(col, vDepth), 1.);
        }`,
      uniforms: { ...U, uDensity: this.driftDensity },
    });
    this.materials.push(mat);
    const m = new THREE.InstancedMesh(geo, mat, count);
    for (let i = 0; i < count; i++) m.setMatrixAt(i, this.tmpM.identity());
    m.frustumCulled = false;
    return m;
  }
  private driftDensity = { value: 0.3 };

  /** Fireflies: slow wandering points of warm light that blink, more of them as the dusk deepens. */
  private fireflies(count: number) {
    const rr = rng(1125);
    const seeds = new Float32Array(count * 4);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = rr() * Math.PI * 2, r = 1.4 + rr() * 5.5;
      pos.set([Math.cos(a) * r, BOTTOM + rr() * (TOP - BOTTOM + 1), Math.sin(a) * r], i * 3);
      seeds.set([rr(), rr(), rr(), rr()], i * 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 4));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime, uPx, uRevealY, uCrumble, uReveal;
        varying float vA;
        void main(){
          vec3 p = position;
          float t = uTime * (.12 + aSeed.x * .1) + aSeed.y * 40.;
          p += vec3(sin(t * 1.3) * .6 + sin(t * .37) * .9, sin(t * .9 + aSeed.z * 6.) * .5, cos(t * 1.1) * .6 + cos(t * .29) * .9);
          vec4 wp = modelMatrix * vec4(p, 1.);
          vec4 mv = viewMatrix * wp;
          gl_Position = projectionMatrix * mv;
          // a slow breath of light with the occasional brighter blink
          float blink = pow(.5 + .5 * sin(uTime * (1.2 + aSeed.z * 1.6) + aSeed.w * 30.), 3.);
          vA = blink * step(wp.y, uRevealY) * (1. - uCrumble) * (.6 + uReveal * .4);
          gl_PointSize = uPx * (1. + aSeed.w) / max(-mv.z, .5);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){
          float d = length(gl_PointCoord - .5);
          float a = (smoothstep(.5, .0, d) * .5 + smoothstep(.12, .0, d)) * vA;
          gl_FragColor = vec4(vec3(1., .86, .5) * a, 1.);
        }`,
      uniforms: { uTime: U.uTime, uRevealY: U.uRevealY, uCrumble: U.uCrumble, uReveal: U.uReveal, uPx: this.fireflyPx },
    });
    this.materials.push(mat);
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }
  /**
   * Light shafts: tall soft beams slanting down through the garden, like moonlight through
   * leaves, warming toward sunset as the journey goes on. Cylindrical billboards, additive.
   */
  private shafts(count: number) {
    const rr = rng(4242);
    const H = TOP - BOTTOM + 6;
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
    const inst = new THREE.InstancedBufferGeometry().copy(geo as unknown as THREE.InstancedBufferGeometry);
    const data = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rr() * 0.6;
      data.set([Math.cos(a) * (4 + rr() * 3), Math.sin(a) * (4 + rr() * 3) - 2, 1.2 + rr() * 1.6, rr()], i * 4);
    }
    inst.setAttribute('aShaft', new THREE.InstancedBufferAttribute(data, 4));
    inst.instanceCount = count;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec4 aShaft;
        varying vec2 vUv; varying float vSeed; varying float vY;
        void main(){
          vec3 base = (modelMatrix * vec4(aShaft.x, ${((TOP + BOTTOM) / 2).toFixed(2)}, aShaft.y, 1.)).xyz;
          // face the camera around the vertical axis, lean a little like light through a canopy
          vec3 toCam = cameraPosition - base; toCam.y = 0.;
          vec3 right = normalize(cross(vec3(0., 1., 0.), normalize(toCam + vec3(1e-4, 0., 0.))));
          vec3 up = normalize(vec3(.28 * (aShaft.w - .5), 1., 0.));
          vec3 p = base + right * position.x * aShaft.z + up * position.y * ${H.toFixed(2)};
          vY = p.y;
          vUv = uv; vSeed = aShaft.w;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uWarm, uRevealY, uCrumble, uFocus;
        varying vec2 vUv; varying float vSeed; varying float vY;
        void main(){
          float across = smoothstep(0., .5, vUv.x) * smoothstep(1., .5, vUv.x);
          across *= across;
          float along = smoothstep(0., .35, vUv.y) * smoothstep(1., .7, vUv.y);
          float drift = .65 + .35 * sin(uTime * .25 + vSeed * 20. + vUv.y * 5.);
          vec3 col = mix(vec3(.55, .6, .95), vec3(1., .78, .55), uWarm);
          float a = across * along * drift * .07 * step(vY, uRevealY) * (1. - uCrumble) * (1. - uFocus * .6);
          gl_FragColor = vec4(col * a, 1.);
        }`,
      uniforms: { uTime: U.uTime, uWarm: U.uWarm, uRevealY: U.uRevealY, uCrumble: U.uCrumble, uFocus: U.uFocus },
    });
    this.materials.push(mat);
    const m = new THREE.Mesh(inst, mat);
    m.frustumCulled = false;
    m.renderOrder = 2;
    return m;
  }

  /** point size scale (× device pixel ratio), set from the viewport */
  readonly fireflyPx = { value: 60 };

  /**
   * A few butterflies: two soft wings hinged on the body, flapping, each on its own loose loop
   * around the stem at a different height, so one is usually somewhere near the camera.
   */
  private butterflies(count: number) {
    // one wing = a quad from the hinge (x = 0) outward; two wings mirrored by aSide
    const wing = new THREE.PlaneGeometry(0.34, 0.3).translate(0.17, 0, 0);
    const geo = mergeGeometries([wing.clone(), wing.clone().scale(-1, 1, 1)])!;
    const side = new Float32Array(geo.attributes.position.count);
    for (let i = 0; i < side.length; i++) side[i] = i < side.length / 2 ? 1 : -1;
    geo.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    const inst = new THREE.InstancedBufferGeometry().copy(geo as unknown as THREE.InstancedBufferGeometry);
    const rr = rng(2511 + 11);
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) seeds.set([rr(), (i + 0.5) / count, rr(), rr()], i * 4);
    inst.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    inst.instanceCount = count;
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute float aSide; attribute vec4 aSeed;
        uniform float uTime, uRevealY, uCrumble;
        varying vec2 vUv; varying float vDepth; varying float vOn; varying float vHue;
        void main(){
          float t = uTime * (.16 + aSeed.x * .08) + aSeed.z * 20.;
          float y = ${BOTTOM.toFixed(2)} + aSeed.y * ${(TOP - BOTTOM).toFixed(2)} + sin(t * 1.7) * .6;
          float r = 2.2 + aSeed.w * 2.4 + sin(t * .8) * .6;
          vec3 c = vec3(cos(t) * r, y, sin(t) * r);
          // heading along the loop, banking a little
          vec3 fwd = normalize(vec3(-sin(t), cos(t * 1.7) * .25, cos(t)));
          vec3 up = vec3(0., 1., 0.);
          vec3 right = normalize(cross(fwd, up));
          up = cross(right, fwd);
          // flap: the wing rotates about the body axis (fwd)
          float flap = sin(uTime * (11. + aSeed.x * 5.) + aSeed.z * 9.) * .95 + .25;
          vec3 lp = position;
          float ang = flap * aSide;
          float x = lp.x * cos(ang), z = abs(lp.x) * sin(ang);
          vec3 p = c + right * x + up * z + fwd * lp.y;
          vec4 wp = modelMatrix * vec4(p, 1.);
          vOn = step(wp.y, uRevealY) * (1. - uCrumble);
          vec4 mv = viewMatrix * wp; vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
          vUv = vec2(abs(lp.x) / .34, uv.y);
          vHue = aSeed.w;
        }`,
      fragmentShader: /* glsl */ `
        ${fog}
        varying vec2 vUv; varying float vDepth; varying float vOn; varying float vHue;
        void main(){
          // two lobes: a larger fore wing and a smaller hind wing
          vec2 u = vUv;
          float fore = length((u - vec2(.52, .66)) * vec2(1., 1.25));
          float hind = length((u - vec2(.42, .28)) * vec2(1.2, 1.4));
          float shape = min(fore - .42, hind - .3);
          float a = smoothstep(.02, -.03, shape) * vOn;
          if (a < .01) discard;
          // deep wine at the body → rose (or champagne) → a dark edge with pale spots; faint veins
          vec3 wine = vec3(.32, .07, .16);
          vec3 tint = mix(vec3(.85, .42, .55), vec3(.86, .66, .32), step(.6, vHue));
          vec3 col = mix(wine, tint, smoothstep(.0, .45, u.x));
          float veins = smoothstep(.035, .0, abs(fract(atan(u.y - .45, u.x) * 2.2) - .5) * .12 + (1. - u.x) * .02);
          col = mix(col, wine, veins * .45 * smoothstep(.1, .4, u.x));
          float edge = smoothstep(-.1, -.015, shape);
          col = mix(col, vec3(.1, .03, .07), edge * .85);
          col += edge * smoothstep(.05, .0, abs(fract(u.y * 7.) - .5) - .2) * vec3(.95, .85, .7) * .5 * step(.5, u.x);
          if (u.x < .06) col = vec3(.08, .04, .05);
          col = pow(col, vec3(2.2)) * .85; // authored in sRGB; the scene is lit in linear
          gl_FragColor = vec4(applyFog(col, vDepth), a * .92);
        }`,
      uniforms: { uTime: U.uTime, uRevealY: U.uRevealY, uCrumble: U.uCrumble, uFogColor: U.uFogColor, uFogDensity: U.uFogDensity },
    });
    this.materials.push(mat);
    const m = new THREE.Mesh(inst, mat);
    m.frustumCulled = false;
    return m;
  }

  /** Height (garden‑local) the camera reaches at work progress p — for timing axis blooms. */
  setHeightMap(heightToP: (y: number) => number) {
    for (const b of this.blooms) if (b.chapter < 0) b.openAt = heightToP(b.pos.y);
  }

  /** Keeps a chapter tulip standing where its (invisible) chapter anchor is. */
  syncChapter(i: number, world: THREE.Matrix4) {
    const b = this.blooms[AXIS_BLOOMS + i];
    // anchor → garden local
    this.tmpM.copy(this.group.matrixWorld).invert().multiply(world);
    this.tmpM.decompose(this.tmpV, this.tmpQ, this.tmpS);
    const facing = this.facing.copy(this.zAxis).applyQuaternion(this.tmpQ);
    b.pos.copy(this.tmpV).addScaledVector(this.yAxis, 0.15 * b.scale);
    // lean the flower toward the viewer so the camera can see into it
    b.up.copy(facing).multiplyScalar(0.5).add(this.yAxis).normalize();
    const label = this.labels[i];
    if (label) {
      label.position.copy(this.tmpV).addScaledVector(this.yAxis, -0.95 - 0.25 * (b.scale - 1)).addScaledVector(facing, 0.35);
      label.quaternion.copy(this.tmpQ);
    }
  }

  /**
   * Chapter anchors at rest (no hover / entry offsets): places the chapter tulips and grows
   * the arching branches out to them. Call after every chapter layout (device switch).
   */
  layoutChapters(rest: THREE.Matrix4[]) {
    this.group.updateMatrixWorld();
    rest.forEach((m, i) => this.syncChapter(i, m));
    // only regrow the branches when the anchors actually moved (device switch) — a plain resize,
    // or the resize after a WebGL context restore, must not dispose live geometry
    const sig = rest.map((m) => m.elements.slice(12, 15).map((v) => v.toFixed(3)).join(',')).join(';');
    if (sig === this.layoutSig) return;
    this.layoutSig = sig;
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < CHAPTER_BLOOMS; i++) {
      const b = this.blooms[AXIS_BLOOMS + i];
      const from = this.stemAt(b.pos.y + 0.9);
      const g = this.branch(from, b.pos.clone().addScaledVector(b.up, -0.28 * b.scale), b.up, 0.045);
      g.deleteAttribute('uv');
      geos.push(g.toNonIndexed());
    }
    this.chapterStems.geometry.dispose();
    this.chapterStems.geometry = mergeGeometries(geos)!;
  }

  // ------------------------------------------------------------ seams (same hooks as before)
  /** Entry reveal front in local y (null = fully grown). */
  setReveal(front: number | null) {
    U.uRevealY.value = front === null ? 1e5 : WORK_ORIGIN.y + front;
  }
  /** Exit dissolve 0…1. */
  setCrumble(c: number) {
    U.uCrumble.value = c;
  }
  get axisTop() {
    return WORK_ORIGIN.y + SPINE.top;
  }
  get axisBottom() {
    return WORK_ORIGIN.y + spineBottom();
  }

  /** World position of chapter i's tulip head. */
  chapterHead(i: number, out: THREE.Vector3) {
    return out.copy(this.blooms[AXIS_BLOOMS + i].pos).applyMatrix4(this.group.matrixWorld);
  }
  /** 0…1: the wish tulip gathering light while the button is held */
  hold = 0;

  /** The wish: a light that travels up through the whole plant. */
  private pulseStart = -1;
  pulse(time: number) {
    this.pulseStart = time;
  }

  /**
   * p: work progress · chapterOpen[i]: 1 while that chapter is open · visited[i]: chapter done
   * reveal: 0…1 final pull‑back (every flower in full bloom, softly glowing)
   */
  update(time: number, p: number, cardCentres: (i: number) => number, activeChapter: number, visited: boolean[], reveal: number) {
    U.uWarm.value = clamp(0.1 + p * 0.95) * (1 - reveal) + reveal;
    U.uReveal.value = reveal;
    this.ribbonStrength.value = 0.25 + clamp(p) * 0.75 + reveal * 0.4;
    this.driftDensity.value = 0.25 + clamp((p - 0.35) * 1.6) * 0.6 + reveal * 0.15;
    // wish pulse climbs the plant bottom → top over ~4 s
    const pt = this.pulseStart < 0 ? -1 : (time - this.pulseStart) / 4;
    U.uPulseAmt.value = pt >= 0 && pt <= 1.2 ? Math.sin(Math.min(1, pt) * Math.PI) * 1.2 + 0.001 : 0;
    U.uPulseY.value = WORK_ORIGIN.y + BOTTOM + clamp(pt) * (TOP - BOTTOM);

    this.blooms.forEach((b, f) => {
      let open: number;
      let glow: number;
      if (b.chapter >= 0) {
        const c = cardCentres(b.chapter);
        const last = b.chapter === CHAPTER_BLOOMS - 1;
        // chapter tulips open as the camera arrives; the last, largest one waits for the end
        open = last ? smoothstep(c - 0.08, c + 0.005, p) : smoothstep(c - 0.08, c - 0.005, p);
        if (activeChapter === b.chapter) open = 1;
        glow = open * 0.55 + (activeChapter === b.chapter ? 0.6 + this.hold * 1.6 : 0) + (visited[b.chapter] ? 0.25 : 0);
        const label = this.labels[b.chapter];
        if (label) (label.material as THREE.ShaderMaterial).uniforms.uAlpha.value = (0.25 + 0.75 * open) * (1 - reveal) * (activeChapter >= 0 ? 0 : 1);
      } else {
        open = smoothstep(b.openAt - 0.08, b.openAt, p);
        glow = open * 0.4;
      }
      open = Math.max(open, reveal);
      glow = Math.max(glow, reveal * 0.7) + (pt >= 0 && pt <= 1.2 ? Math.exp(-Math.pow((b.pos.y - (BOTTOM + clamp(pt) * (TOP - BOTTOM))) * 1.3, 2)) * 1.2 : 0);
      this.bloomNow[f] = open;
      this.writeFlower(f, b.pos, b.up, b.scale, open);
      // core sits in the cup
      this.tmpV.copy(b.up).multiplyScalar(0.05 * b.scale).add(b.pos);
      this.cores.setMatrixAt(f, this.tmpM.compose(this.tmpV, this.tmpQ.identity(), this.tmpS.set(b.scale, b.scale, b.scale)));
      this.coreAttr.setX(f, glow);
    });
    this.cores.instanceMatrix.needsUpdate = true;
    this.coreAttr.needsUpdate = true;
  }

  triangles() {
    return this.petals.count * ((this.petals.geometry.index?.count ?? 0) / 3) + 4000;
  }
}

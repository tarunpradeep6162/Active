import * as THREE from 'three';
import { math, iridescence } from '../shaders/chunks';
import { globalUniforms } from '../world/uniforms';

const MAX = 96;

let sharedMaterial: THREE.ShaderMaterial | null = null;
function ribbonMaterial() {
  if (sharedMaterial) return sharedMaterial;
  sharedMaterial = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      attribute vec4 aData; // s (0 head → 1 tail), side (-1|1), arc length, strand
      uniform vec3 uTint;
      varying vec4 vData;
      varying float vDepth;
      void main(){
        vData = aData;
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${math}
      ${iridescence}
      uniform float uTime; uniform float uOpacity;
      varying vec4 vData;
      varying float vDepth;
      uniform vec3 uTintA;
      void main(){
        float s = vData.x;
        float side = vData.y;
        float L = vData.z;
        float strand = vData.w;
        // crescent slivers: short dashes whose centre line bends across the ribbon
        float u = fract(L * 6.5 + strand * .37);
        float c = (u - .5);
        float curve = c * 1.6 - c * c * 2.2 + .15;
        float across = abs(side - curve);
        float body = smoothstep(.55, .08, across) * smoothstep(.5, .12, abs(c));
        // chrome shading: bright core with a thin‑film tint toward the edges
        float core = smoothstep(.25, .0, across);
        vec3 film = thinFilm(.4 + .6 * abs(side), 1.2 + L * .2 + strand);
        vec3 col = mix(film * .7, vec3(1.), .55 + core * .45);
        col *= .85 + .6 * pow(max(0., sin(u * PI)), 6.);
        float fade = pow(1. - s, 1.35) * smoothstep(.0, .04, s + .02);
        float a = body * fade * uOpacity;
        if (a < .004) discard;
        gl_FragColor = vec4(col * a * 1.25, a);
      }`,
    uniforms: {
      uTime: globalUniforms.uTime,
      uOpacity: { value: 1 },
      uTint: { value: new THREE.Color('#ffffff') },
      uTintA: { value: new THREE.Color('#ffffff') },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  return sharedMaterial;
}

/**
 * Fixed‑capacity world‑space trail. Points are pushed at the head and expire by age;
 * the camera‑facing strip is rebuilt in preallocated buffers every frame (no GC).
 */
export class Ribbon {
  readonly mesh: THREE.Mesh;
  private pts = new Float32Array(MAX * 3);
  private birth = new Float32Array(MAX);
  private speed = new Float32Array(MAX);
  private count = 0;
  private pos: Float32Array;
  private data: Float32Array;
  private posAttr: THREE.BufferAttribute;
  private dataAttr: THREE.BufferAttribute;
  private t = new THREE.Vector3();
  private side = new THREE.Vector3();
  private view = new THREE.Vector3();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  life = 1.2;
  width = 0.08;

  constructor(private strand = 0, private strandOffset = 0) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 2 * 3);
    this.data = new Float32Array(MAX * 2 * 4);
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.dataAttr = new THREE.BufferAttribute(this.data, 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('aData', this.dataAttr);
    const idx: number[] = [];
    for (let i = 0; i < MAX - 1; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    g.setIndex(idx);
    g.setDrawRange(0, 0);
    this.mesh = new THREE.Mesh(g, ribbonMaterial());
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  get head() {
    return this.count;
  }

  push(x: number, y: number, z: number, time: number, speed: number) {
    // shift toward the tail (MAX is small; copyWithin does not allocate)
    this.pts.copyWithin(3, 0, (MAX - 1) * 3);
    this.birth.copyWithin(1, 0, MAX - 1);
    this.speed.copyWithin(1, 0, MAX - 1);
    this.pts[0] = x;
    this.pts[1] = y;
    this.pts[2] = z;
    this.birth[0] = time;
    this.speed[0] = speed;
    this.count = Math.min(MAX, this.count + 1);
  }

  /** Move the head point without adding a new sample (keeps the tip glued to the pointer). */
  moveHead(x: number, y: number, z: number) {
    if (!this.count) return;
    this.pts[0] = x;
    this.pts[1] = y;
    this.pts[2] = z;
  }

  clear() {
    this.count = 0;
    this.mesh.geometry.setDrawRange(0, 0);
  }

  update(time: number, camera: THREE.Camera) {
    // expire by age
    while (this.count > 0 && time - this.birth[this.count - 1] > this.life * (0.8 + this.speed[this.count - 1] * 0.25)) this.count--;
    const n = this.count;
    if (n < 2) {
      this.mesh.geometry.setDrawRange(0, 0);
      return;
    }
    const P = this.pts;
    let L = 0;
    for (let i = 0; i < n; i++) {
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
      this.t.set(P[i1 * 3] - P[i0 * 3], P[i1 * 3 + 1] - P[i0 * 3 + 1], P[i1 * 3 + 2] - P[i0 * 3 + 2]);
      if (this.t.lengthSq() < 1e-10) this.t.set(1, 0, 0);
      this.t.normalize();
      this.a.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
      if (i > 0) {
        this.b.set(P[(i - 1) * 3], P[(i - 1) * 3 + 1], P[(i - 1) * 3 + 2]);
        L += this.a.distanceTo(this.b);
      }
      this.view.subVectors(camera.position, this.a).normalize();
      this.side.crossVectors(this.t, this.view).normalize();
      const s = i / (n - 1);
      const sp = this.speed[i];
      // taper at both ends; faster samples are wider
      const w = this.width * (0.55 + Math.min(sp, 3) * 0.35) * Math.sin(Math.min(1, s * 1.15 + 0.04) * Math.PI) ** 0.6;
      // strands drift laterally with a slow wave → fibrous look
      const off = this.strandOffset * Math.sin(L * 2.3 + this.strand * 2.1 + time * 0.8) * this.width * 1.4;
      const ax = this.a.x + this.side.x * off, ay = this.a.y + this.side.y * off, az = this.a.z + this.side.z * off;
      const o = i * 6;
      this.pos[o] = ax + this.side.x * w;
      this.pos[o + 1] = ay + this.side.y * w;
      this.pos[o + 2] = az + this.side.z * w;
      this.pos[o + 3] = ax - this.side.x * w;
      this.pos[o + 4] = ay - this.side.y * w;
      this.pos[o + 5] = az - this.side.z * w;
      const d = i * 8;
      this.data[d] = s;
      this.data[d + 1] = 1;
      this.data[d + 2] = L;
      this.data[d + 3] = this.strand;
      this.data[d + 4] = s;
      this.data[d + 5] = -1;
      this.data[d + 6] = L;
      this.data[d + 7] = this.strand;
    }
    this.posAttr.clearUpdateRanges();
    this.posAttr.addUpdateRange(0, n * 6);
    this.posAttr.needsUpdate = true;
    this.dataAttr.clearUpdateRanges();
    this.dataAttr.addUpdateRange(0, n * 8);
    this.dataAttr.needsUpdate = true;
    this.mesh.geometry.setDrawRange(0, (n - 1) * 6);
  }
}

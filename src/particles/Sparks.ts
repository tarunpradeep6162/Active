import * as THREE from 'three';
import { globalUniforms } from '../world/uniforms';

const MAX = 600;

/** Pooled CPU sparks shed by the pointer (orange / red / pink embers). */
export class Sparks {
  readonly points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private age = new Float32Array(MAX);
  private attr = new Float32Array(MAX * 2); // age01, hue seed
  private cursor = 0;
  private posAttr: THREE.BufferAttribute;
  private dataAttr: THREE.BufferAttribute;

  constructor() {
    const g = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.dataAttr = new THREE.BufferAttribute(this.attr, 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.posAttr);
    g.setAttribute('aData', this.dataAttr);
    for (let i = 0; i < MAX; i++) this.attr[i * 2] = 1;
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec2 aData; uniform float uDPR; uniform vec2 uResolution;
        varying vec2 vData;
        void main(){
          vData = aData;
          vec4 mv = modelViewMatrix * vec4(position, 1.);
          gl_Position = projectionMatrix * mv;
          float alive = step(aData.x, .999);
          gl_PointSize = alive * (1. - aData.x * .6) * (3. + fract(aData.y * 91.) * 5.) * uDPR * uResolution.y / 900. * (6. / max(-mv.z, .5));
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vData;
        void main(){
          float d = length(gl_PointCoord - .5);
          float a = smoothstep(.5, 0., d);
          a = a * a * (1. - vData.x);
          vec3 col = vData.y < .4 ? vec3(1., .45, .12) : vData.y < .75 ? vec3(1., .12, .22) : vec3(1., .35, .7);
          gl_FragColor = vec4(col * a * 2.2, a);
        }`,
      uniforms: { uDPR: globalUniforms.uDPR, uResolution: globalUniforms.uResolution },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 11;
  }

  emit(x: number, y: number, z: number, n: number, energy: number) {
    for (let k = 0; k < n; k++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % MAX;
      this.pos[i * 3] = x + (Math.random() - 0.5) * 0.15;
      this.pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.15;
      this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.15;
      const e = 0.3 + energy * 0.6;
      this.vel[i * 3] = (Math.random() - 0.5) * e;
      this.vel[i * 3 + 1] = (Math.random() - 0.3) * e;
      this.vel[i * 3 + 2] = (Math.random() - 0.5) * e;
      this.life[i] = 0.7 + Math.random() * 1.1;
      this.age[i] = 0;
      this.attr[i * 2 + 1] = Math.random();
    }
  }

  update(dt: number) {
    for (let i = 0; i < MAX; i++) {
      if (this.attr[i * 2] >= 1) continue;
      this.age[i] += dt;
      const a = this.age[i] / this.life[i];
      this.attr[i * 2] = Math.min(1, a);
      const drag = Math.exp(-1.8 * dt);
      this.vel[i * 3] *= drag;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag - 0.35 * dt;
      this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.posAttr.needsUpdate = true;
    this.dataAttr.needsUpdate = true;
  }
}

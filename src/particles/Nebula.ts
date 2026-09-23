import * as THREE from 'three';
import { globalUniforms } from '../world/uniforms';
import { noise, math } from '../shaders/chunks';
import { rng } from '../utils/math';

export interface NebulaOptions {
  count: number;
  seed: number;
  center: THREE.Vector3;
  spread: THREE.Vector3;
  size: [number, number];
  colors: string[];
  intensity?: number;
}

/**
 * Volumetric‑looking glow: camera‑facing instanced quads with animated fbm
 * density, soft‑faded near the camera. Used for storms, the lab mass and the
 * glitter clouds around the spine.
 */
export class Nebula {
  readonly mesh: THREE.InstancedMesh;
  readonly uniforms: Record<string, THREE.IUniform>;

  constructor(o: NebulaOptions) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const n = o.count;
    const offsets = new Float32Array(n * 4);
    const colors = new Float32Array(n * 3);
    const shape = new Float32Array(n * 4); // rotation, stretch, opacity, spin
    const r = rng(o.seed);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const g = () => (r() + r() + r() - 1.5) / 1.5;
      offsets[i * 4] = o.center.x + g() * o.spread.x;
      offsets[i * 4 + 1] = o.center.y + g() * o.spread.y;
      offsets[i * 4 + 2] = o.center.z + g() * o.spread.z;
      offsets[i * 4 + 3] = o.size[0] + r() * (o.size[1] - o.size[0]);
      shape[i * 4] = r() * Math.PI * 2;
      shape[i * 4 + 1] = 0.55 + r() * 1.1;
      shape[i * 4 + 2] = 0.25 + Math.pow(r(), 2) * 0.9;
      shape[i * 4 + 3] = (r() - 0.5) * 0.12;
      c.set(o.colors[i % o.colors.length]);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 4));
    geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(colors, 3));
    geo.setAttribute('aShape', new THREE.InstancedBufferAttribute(shape, 4));
    this.uniforms = {
      uTime: globalUniforms.uTime,
      uScrollVelocity: globalUniforms.uScrollVelocity,
      uFocus: globalUniforms.uFocus,
      uIntensity: { value: o.intensity ?? 1 },
      uBurst: { value: 0 },
      uBurstCenter: { value: o.center.clone() },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec4 aOffset; attribute vec3 aColor; attribute vec4 aShape;
        uniform float uTime, uBurst; uniform vec3 uBurstCenter;
        varying vec2 vUv; varying vec3 vColor; varying float vDepth; varying float vSeed; varying float vOpacity;
        void main(){
          // rotate + stretch the quad in its own plane, slowly spinning → no two cards alike
          float a = aShape.x + uTime * aShape.w;
          mat2 R = mat2(cos(a), -sin(a), sin(a), cos(a));
          vUv = R * ((uv - .5) * vec2(aShape.y, 1.)) + .5;
          vOpacity = aShape.z;
          vColor = aColor;
          vSeed = fract(aOffset.x * 3.17 + aOffset.y * 1.31);
          vec3 c = aOffset.xyz;
          c += vec3(sin(uTime * .11 + vSeed * 30.), cos(uTime * .09 + vSeed * 20.), 0.) * .35;
          c += normalize(c - uBurstCenter + 1e-4) * uBurst * (1. + vSeed * 2.);
          vec4 mv = viewMatrix * vec4(c, 1.);
          float s = aOffset.w * (1. + uBurst * .15);
          mv.xy += position.xy * s * vec2(1., 1.); // billboard in view space
          // pull slightly toward camera‑depth variation so layers interpenetrate
          mv.z += sin(vSeed * 40.) * .6;
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        ${math}
        ${noise}
        uniform float uTime, uIntensity, uScrollVelocity, uFocus;
        varying vec2 vUv; varying vec3 vColor; varying float vDepth; varying float vSeed; varying float vOpacity;
        void main(){
          vec2 p = vUv - .5;
          float r = length(p) * 2.;
          if (r > 1.) discard; // skip noise work outside the soft disc
          float fall = smoothstep(1., .0, r);
          float d = fbm2(p * 2.6 + vSeed * 17. + vec2(uTime * .03, -uTime * .02));
          d = smoothstep(.42, .9, d + fall * .2);
          // erode the silhouette with noise so the quad edge never reads
          float erode = vnoise(p * 5. + vSeed * 9. - uTime * .02) * .65 + vnoise(p * 11. + vSeed * 3.) * .35;
          float a = fall * fall * d * smoothstep(.2, .6, erode + fall * .5) * vOpacity;
          // fade when the camera flies through
          a *= smoothstep(.6, 3.5, vDepth) * (1. - smoothstep(26., 40., vDepth));
          a *= uIntensity * (1. + min(abs(uScrollVelocity), 3.) * .35) * (1. - uFocus * .9);
          if (a < .002) discard;
          gl_FragColor = vec4(vColor * a, a);
        }`,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }
}

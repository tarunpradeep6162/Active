import * as THREE from 'three';
import { globalUniforms } from '../world/uniforms';
import { noise, math } from '../shaders/chunks';
import { rng } from '../utils/math';

/** Additive horizontal light streaks that live inside the particle storms. */
export class Streaks {
  readonly mesh: THREE.InstancedMesh;
  readonly uniforms: Record<string, THREE.IUniform>;

  constructor(count: number, y0: number, y1: number, seed: number, colors: string[]) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.uniforms = {
      uTime: globalUniforms.uTime,
      uScrollVelocity: globalUniforms.uScrollVelocity,
      uIntensity: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv; varying vec3 vColor; varying float vDepth; varying float vSeed;
        void main(){
          vUv = uv;
          vColor = instanceColor;
          vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.);
          vSeed = fract(instanceMatrix[3].x * 12.9898 + instanceMatrix[3].y * 78.233);
          vec4 mv = viewMatrix * wp;
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        ${math}
        ${noise}
        uniform float uTime, uScrollVelocity, uIntensity;
        varying vec2 vUv; varying vec3 vColor; varying float vDepth; varying float vSeed;
        void main(){
          float y = (vUv.y - .5) * 2.;
          float band = exp(-y * y * 9.);
          float n = fbm2(vec2(vUv.x * 4. - uTime * (.2 + vSeed * .3), vSeed * 10.));
          float ends = smoothstep(0., .25, vUv.x) * smoothstep(1., .6, vUv.x);
          float ripples = .8 + .2 * sin(vUv.x * 9. + y * 3. - uTime * 2.);
          float a = band * ends * smoothstep(.25, .7, n) * ripples;
          a *= smoothstep(.8, 3., vDepth) * (1. - smoothstep(18., 32., vDepth));
          a *= uIntensity * (1. + min(abs(uScrollVelocity), 4.) * .5);
          gl_FragColor = vec4(vColor * a * 1.6, a);
        }`,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    const r = rng(seed);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      p.set((r() - 0.5) * 12, y0 + (y1 - y0) * r(), (r() - 0.5) * 8 - 1);
      q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (r() - 0.5) * 0.25);
      s.set(4 + r() * 7, 0.25 + r() * 0.6, 1);
      this.mesh.setMatrixAt(i, m.compose(p, q, s));
      this.mesh.setColorAt(i, c.set(colors[i % colors.length]));
    }
    this.mesh.frustumCulled = false;
  }
}

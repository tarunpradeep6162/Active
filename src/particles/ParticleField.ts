import * as THREE from 'three';
import { globalUniforms } from '../world/uniforms';
import { noise, math } from '../shaders/chunks';

export interface FieldOptions {
  colors: [string, string, string];
  size: number;
  turbulence: number;
  speed: number;
  opacity?: number;
  /** particles stream downward (embers drift up, storm swirls) */
  drift?: [number, number, number];
  twinkle?: number;
  /** fraction of particles drawn as large soft volumetric puffs */
  puff?: number;
}

/**
 * Stateless GPU particles: the vertex shader animates each point from its seed
 * (curl‑like noise + pointer force + scroll turbulence + burst). One draw call per field.
 */
export class ParticleField {
  readonly points: THREE.Points;
  readonly uniforms: Record<string, THREE.IUniform>;

  constructor(position: Float32Array, seed: Float32Array, o: FieldOptions) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(position, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.computeBoundingSphere();
    this.uniforms = {
      uTime: globalUniforms.uTime,
      uDPR: globalUniforms.uDPR,
      uResolution: globalUniforms.uResolution,
      uScrollVelocity: globalUniforms.uScrollVelocity,
      uAudio: globalUniforms.uAudio,
      uPointerWorld: { value: new THREE.Vector3(0, 0, -999) },
      uPointerStrength: { value: 0 },
      uColorA: { value: new THREE.Color(o.colors[0]) },
      uColorB: { value: new THREE.Color(o.colors[1]) },
      uColorC: { value: new THREE.Color(o.colors[2]) },
      uSize: { value: o.size },
      uTurb: { value: o.turbulence },
      uSpeed: { value: o.speed },
      uBurst: { value: 0 },
      uBurstCenter: { value: new THREE.Vector3() },
      uOpacity: { value: o.opacity ?? 1 },
      uDrift: { value: new THREE.Vector3(...(o.drift ?? [0, 0, 0])) },
      uTwinkle: { value: o.twinkle ?? 0.5 },
      uPuff: { value: o.puff ?? 0 },
      uFocusDim: globalUniforms.uFocus,
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        ${math}
        ${noise}
        attribute vec4 aSeed;
        uniform float uTime, uDPR, uScrollVelocity, uSize, uTurb, uSpeed, uBurst, uPointerStrength, uAudio, uTwinkle, uPuff;
        uniform vec3 uPointerWorld, uBurstCenter, uDrift;
        uniform vec2 uResolution;
        varying vec4 vSeed;
        varying float vFade;
        varying float vPuff;
        void main(){
          vec3 p = position;
          vPuff = step(1. - uPuff, fract(aSeed.x * 7.13));
          float t = uTime * uSpeed + aSeed.x * 100.;
          // drift loops inside a 6‑unit band so the field never empties
          p += uDrift * mod(uTime * .1 + aSeed.y * 6., 6.) - uDrift * 3.;
          float turb = uTurb * (1. + min(abs(uScrollVelocity), 5.) * .9 + uAudio * .8);
          p += curlish(p * .22 + vec3(0., 0., t * .05)) * turb;
          // burst: push away from centre
          vec3 bd = p - uBurstCenter;
          p += normalize(bd + 1e-4) * uBurst * (1.5 + aSeed.z * 5.) + vec3(0., -uBurst * aSeed.y * 2., 0.);
          // pointer repulsion
          vec3 pd = p - uPointerWorld;
          float pl = length(pd);
          p += pd / max(pl, 1e-3) * uPointerStrength * smoothstep(2.2, 0., pl) * (.6 + aSeed.w * .5);
          vec4 mv = modelViewMatrix * vec4(p, 1.);
          gl_Position = projectionMatrix * mv;
          float dist = -mv.z;
          float tw = mix(1., .4 + .6 * sin(uTime * (2. + aSeed.z * 4.) + aSeed.x * 40.), uTwinkle);
          gl_PointSize = min(uSize * aSeed.w * tw * mix(1., 9., vPuff) * uDPR * uResolution.y / 900. * (10. / max(dist, .4)), 220.);
          vFade = smoothstep(.3, 1.4, dist) * (1. - smoothstep(30., 55., dist));
          vSeed = aSeed;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColorA, uColorB, uColorC;
        uniform float uOpacity, uFocusDim;
        varying vec4 vSeed;
        varying float vFade;
        varying float vPuff;
        void main(){
          vec2 c = gl_PointCoord - .5;
          float d = length(c);
          float a = smoothstep(.5, .0, d);
          a = mix(a * a, a, .5) + smoothstep(.12, .0, d) * .6 * (1. - vPuff);
          vec3 col = vSeed.y < .45 ? uColorA : vSeed.y < .8 ? uColorB : uColorC;
          col *= 1. + step(.965, vSeed.z) * 3. * (1. - vPuff); // occasional hot sparks feed the bloom
          a *= mix(1., .16, vPuff);
          float alpha = a * vFade * uOpacity * (1. - uFocusDim * .85);
          if (alpha < .003) discard;
          gl_FragColor = vec4(col * alpha, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
  }

  dispose() {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

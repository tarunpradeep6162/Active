import * as THREE from 'three';
import { globalUniforms } from '../world/uniforms';
import { noise, math } from '../shaders/chunks';

/** Fullscreen gradient sky drawn behind everything; colours are driven per section. */
export class Backdrop {
  readonly mesh: THREE.Mesh;
  readonly uniforms = {
    uTop: { value: new THREE.Color('#0b1116') },
    uBottom: { value: new THREE.Color('#06080b') },
    uAccent: { value: new THREE.Color('#123c40') },
    uStreaks: { value: 0 },
    uTime: globalUniforms.uTime,
    uScrollVelocity: globalUniforms.uScrollVelocity,
    uResolution: globalUniforms.uResolution,
    uFocus: globalUniforms.uFocus,
  };

  constructor() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, .9999, 1.); }`,
      fragmentShader: /* glsl */ `
        ${math}
        ${noise}
        uniform vec3 uTop, uBottom, uAccent; uniform float uStreaks, uTime, uScrollVelocity, uFocus; uniform vec2 uResolution;
        varying vec2 vUv;
        void main(){
          vec2 uv = vUv;
          vec3 col = mix(uBottom, uTop, smoothstep(0., 1., uv.y));
          float aspect = uResolution.x / uResolution.y;
          vec2 p = (uv - .5) * vec2(aspect, 1.);
          col += uAccent * .22 * exp(-2.5 * length(p - vec2(.55 * aspect, -.6)));
          col += uAccent * .1 * exp(-3. * length(p - vec2(-.5 * aspect, .5)));
          // horizontal motion streaks (manifesto / warp)
          float y = uv.y * 26.;
          float s = fbm2(vec2(uv.x * 1.2 - uTime * .08 * (1. + abs(uScrollVelocity)), y));
          float streak = smoothstep(.55, .85, s) * smoothstep(.0, .5, fract(y)) * smoothstep(1., .5, fract(y));
          col += uAccent * streak * uStreaks * .55;
          // project focus: the world sinks into a dark teal void (reference detail view)
          col = mix(col, vec3(.012, .03, .032) * (1.1 - uv.y * .3), smoothstep(.2, .9, uFocus));
          gl_FragColor = vec4(col, 1.);
        }`,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
  }
}

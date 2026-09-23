import * as THREE from 'three';
import { globalUniforms } from '../world/uniforms';
import { noise, math } from '../shaders/chunks';

/**
 * Loading visual drawn by the same renderer as the world: an ASCII hatch disc,
 * a thin glowing ring and radial crescent tendrils that grow with real progress.
 * Everything is one SDF quad parented to the camera.
 */
export class PreloaderPortal {
  readonly mesh: THREE.Mesh;
  readonly uniforms = {
    uProgress: { value: 0 },
    uIn: { value: 0 },
    uOut: { value: 0 },
    uTime: globalUniforms.uTime,
  };

  constructor() {
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: /* glsl */ `
        ${math}
        ${noise}
        uniform float uProgress, uIn, uOut, uTime;
        varying vec2 vP;
        float glyph(vec2 c, float id){
          // tiny procedural glyphs: '/', '0', '1'
          vec2 q = c - .5;
          if (id < .6) return smoothstep(.09, .02, abs(q.x - q.y * .7));
          if (id < .8) return smoothstep(.06, .0, abs(length(q * vec2(1.4, 1.)) - .28));
          return smoothstep(.06, .0, abs(q.x)) * step(abs(q.y), .32);
        }
        float crescent(vec2 p, float r, float off){
          float a = length(p) - r;
          float b = length(p - vec2(off, 0.)) - r * .92;
          return max(a, -b);
        }
        void main(){
          vec2 p = vP * (1. + uOut * .6);
          float r = length(p);
          float ang = atan(p.y, p.x);
          vec3 col = vec3(0.);
          float alpha = 0.;
          // ascii disc
          float cell = .052;
          vec2 g = floor(p / cell);
          vec2 f = fract(p / cell);
          float h = hash12(g + 3.);
          float shown = step(h, uProgress * 1.15 + .05) * step(r, .46);
          float id = hash12(g + floor(uTime * 2. + h * 4.));
          float gl = glyph(f, id) * shown;
          col += vec3(.18, .55, .6) * gl * .8;
          // centre chevrons >>>
          vec2 cp = p * vec2(1., 1.) / .06;
          float chev = 0.;
          for (int i = -1; i <= 1; i++){
            vec2 q = cp - vec2(float(i) * 1.2 + mod(uTime * 2., 1.2) - .6, 0.);
            chev += smoothstep(.16, .05, abs(abs(q.y) * .9 + q.x * .9 - .1)) * step(abs(q.y), .45) * step(abs(q.x), .5);
          }
          col += vec3(.8, .95, 1.) * chev * .9 * step(abs(cp.y), 1.);
          // ring
          float ringR = .5;
          float ring = exp(-abs(r - ringR) * 90.) * smoothstep(.1, .5, uProgress + .15);
          col += mix(vec3(.25, .5, 1.), vec3(.4, 1., .95), .5 + .5 * sin(ang * 2. + uTime)) * ring * 1.8;
          col += vec3(.1, .3, .5) * exp(-abs(r - ringR) * 14.) * .25;
          // tendrils
          float n = 16.;
          float sector = floor((ang + PI) / TAU * n);
          float la = (ang + PI) - (sector + .5) * TAU / n;
          vec2 lp = vec2(cos(la), sin(la)) * r;
          float k = sector / n;
          float show = smoothstep(k * .9, k * .9 + .15, uProgress);
          float breathe = .5 + .5 * sin(uTime * 1.6 + sector * .7);
          float rad = mix(1.02, 1.32, mod(sector, 2.)) + breathe * .05;
          float d = crescent((lp - vec2(rad, 0.)) * rot2(.2 * sin(uTime + sector)), .22 + .03 * breathe, -.07);
          float cres = smoothstep(.012, .0, d) * show;
          col += vec3(.1, .55, .55) * cres * (.5 + .7 * smoothstep(.0, -.04, d));
          alpha = max(max(gl, ring), max(cres, chev));
          col *= uIn * (1. - uOut);
          gl_FragColor = vec4(col, 1.);
        }`,
      uniforms: this.uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), mat);
    this.mesh.position.set(0, 0, -5.5);
    this.mesh.renderOrder = 100;
    this.mesh.frustumCulled = false;
  }
}

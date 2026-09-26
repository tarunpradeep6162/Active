import * as THREE from 'three';
import { globalUniforms } from '../world/uniforms';
import { noise, math, iridescence, fog } from '../shaders/chunks';

export const standardVert = /* glsl */ `
varying vec3 vN;
varying vec3 vWorldPos;
varying float vDepth;
varying vec2 vUv;
varying vec3 vLocal;
void main(){
  vec4 lp = vec4(position, 1.);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    lp = instanceMatrix * lp;
    n = mat3(instanceMatrix) * n;
  #endif
  vLocal = position;
  vUv = uv;
  vec4 wp = modelMatrix * lp;
  vWorldPos = wp.xyz;
  vN = normalize(mat3(modelMatrix) * n);
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export interface IridescentOptions {
  base?: string;
  envTop?: string;
  envBottom?: string;
  film?: number;
  glow?: number;
  opacity?: number;
  /** gradient along local Y (for ribbons: along the tube via uv.x) */
  gradientA?: string;
  gradientB?: string;
  useUvGradient?: boolean;
  transparent?: boolean;
}

/** Glass / chrome thin‑film surface used by the emblem, ribbons, spine and rig. */
export function iridescentMaterial(o: IridescentOptions = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: standardVert,
    fragmentShader: /* glsl */ `
      ${math}
      ${noise}
      ${iridescence}
      ${fog}
      uniform vec3 uBase; uniform vec3 uEnvTop; uniform vec3 uEnvBottom;
      uniform vec3 uGradA; uniform vec3 uGradB; uniform float uUseUv;
      uniform float uFilm; uniform float uGlow; uniform float uOpacity; uniform float uTime; uniform float uAudio; uniform float uFocus; uniform float uDimOnFocus;
      varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vUv; varying vec3 vLocal;
      void main(){
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vN);
        if (!gl_FrontFacing) N = -N;
        float ndv = clamp(dot(N, V), 0., 1.);
        float fres = pow(1. - ndv, 3.);
        vec3 R = reflect(-V, N);
        float wob = snoise(vWorldPos * .6 + uTime * .08) * .35;
        vec3 film = thinFilm(ndv, uFilm + wob);
        vec3 env = fakeEnv(R, uEnvTop, uEnvBottom);
        vec3 base = uBase;
        if (uUseUv > .5) base = mix(uGradA, uGradB, smoothstep(.1, .9, fract(vUv.x * 1.0)));
        vec3 col = base * (.18 + .55 * ndv);
        col += env * mix(vec3(1.), film, .75) * (.22 + fres * 1.35);
        col += film * fres * uGlow * (1. + uAudio * .6);
        // sharp caustic highlight sweep
        float sweep = smoothstep(.985, 1., sin(dot(vWorldPos, vec3(.9, .6, .2)) * 1.3 - uTime * .7) * .5 + .5);
        col += sweep * film * .9;
        col *= 1. - uFocus * uDimOnFocus * .85;
        col = applyFog(col, vDepth);
        float a = uOpacity * mix(.75, 1., fres);
        gl_FragColor = vec4(col, a);
      }
    `,
    uniforms: {
      uBase: { value: new THREE.Color(o.base ?? '#2a0d18') },
      uEnvTop: { value: new THREE.Color(o.envTop ?? '#6fd6e8') },
      uEnvBottom: { value: new THREE.Color(o.envBottom ?? '#1a0710') },
      uGradA: { value: new THREE.Color(o.gradientA ?? '#ff3b5c') },
      uGradB: { value: new THREE.Color(o.gradientB ?? '#ff9fb6') },
      uUseUv: { value: o.useUvGradient ? 1 : 0 },
      uFilm: { value: o.film ?? 1.2 },
      uGlow: { value: o.glow ?? 0.8 },
      uOpacity: { value: o.opacity ?? 1 },
      uTime: globalUniforms.uTime,
      uAudio: globalUniforms.uAudio,
      uFocus: globalUniforms.uFocus,
      uDimOnFocus: { value: 1 },
      uFogColor: globalUniforms.uFogColor,
      uFogDensity: globalUniforms.uFogDensity,
    },
    transparent: o.transparent ?? false,
  });
}

/** Matte dark surface with a coloured key light and rim — for room geometry. */
export function darkLitMaterial(color = '#0d1216', light = '#ff2d55', lightPos = new THREE.Vector3(), rim = '#2a7f86') {
  return new THREE.ShaderMaterial({
    vertexShader: standardVert,
    fragmentShader: /* glsl */ `
      ${fog}
      uniform vec3 uColor; uniform vec3 uLight; uniform vec3 uLightPos; uniform vec3 uRim; uniform float uTime;
      varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vUv; varying vec3 vLocal;
      void main(){
        vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 L = uLightPos - vWorldPos; float d = length(L); L /= d;
        float diff = max(dot(N, L), 0.) / (1. + d * d * .02);
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N, H), 0.), 48.) * 3. / (1. + d * .08);
        float rim = pow(1. - max(dot(N, V), 0.), 4.);
        float flicker = .85 + .15 * sin(uTime * 7.3) * sin(uTime * 3.1);
        vec3 col = uColor * .6 + uLight * (diff * 1.6 + spec) * flicker + uRim * rim * .6;
        gl_FragColor = vec4(applyFog(col, vDepth), 1.);
      }
    `,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uLight: { value: new THREE.Color(light) },
      uLightPos: { value: lightPos },
      uRim: { value: new THREE.Color(rim) },
      uTime: globalUniforms.uTime,
      uFogColor: globalUniforms.uFogColor,
      uFogDensity: globalUniforms.uFogDensity,
    },
  });
}

/** Polished rose gold: a warm studio reflection, candle highlights, and a slow glint sweeping across. */
export type EnvUniforms = { tEnv: { value: THREE.Texture | null }; uEnvAmt: { value: number } };
export function roseGoldMaterial(tone = '#e8b48c', glow = 0, env?: EnvUniforms) {
  return new THREE.ShaderMaterial({
    vertexShader: standardVert,
    fragmentShader: /* glsl */ `
      ${fog}
      uniform vec3 uTone; uniform float uTime, uGlow, uEnvAmt;
      uniform samplerCube tEnv;
      varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vUv; varying vec3 vLocal;
      void main(){
        vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 R = reflect(-V, N);
        float ndv = clamp(dot(N, V), 0., 1.);
        // a soft warm room reflected in the metal: bright above, velvet‑dark below
        vec3 env = mix(vec3(.12, .03, .05), vec3(1., .82, .66), smoothstep(-.2, .8, R.y));
        env += vec3(1., .75, .5) * pow(max(R.y, 0.), 12.) * 1.5;
        // the real room, when it has been captured: the drape, the fairy lights, the flames
        if (uEnvAmt > .001) env = mix(env, min(textureCube(tEnv, R, 2.).rgb, vec3(1.4)) * .75 + vec3(.05, .02, .02), uEnvAmt * .85);
        float fres = .35 + .65 * pow(1. - ndv, 3.);
        vec3 col = uTone * env * fres;
        float sweep = smoothstep(.985, 1., sin(dot(vWorldPos, vec3(.9, .6, .2)) * 1.3 - uTime * .7) * .5 + .5);
        col += uTone * sweep * .8 + uTone * uGlow * (.4 + .6 * pow(1. - ndv, 2.));
        gl_FragColor = vec4(applyFog(col, vDepth), 1.);
      }`,
    uniforms: { uTone: { value: new THREE.Color(tone) }, uGlow: { value: glow }, uOpacity: { value: 1 }, uTime: globalUniforms.uTime, uFogColor: globalUniforms.uFogColor, uFogDensity: globalUniforms.uFogDensity, ...(env ?? { tEnv: { value: null }, uEnvAmt: { value: 0 } }) },
  });
}

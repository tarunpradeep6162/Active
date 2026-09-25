import * as THREE from 'three';
import { globalUniforms } from '../world/uniforms';
import { noise, math } from '../shaders/chunks';

/**
 * Dark environmental water seen from above (lab floor). Normals come from two
 * scrolling noise octaves; the reflection samples a synthetic environment that
 * contains the rig's red glow, so ripples carry red streaks like the reference.
 */
export function createWaterFloor(center: THREE.Vector3, size = 40, detail = 1) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos; varying float vDepth;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.);
        vWorldPos = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${math}
      ${noise}
      uniform float uTime, uDetail; uniform vec3 uCenter, uFogColor; uniform float uFogDensity;
      varying vec3 vWorldPos; varying float vDepth;
      float h(vec2 p){
        float a = vnoise(p * 1.3 + vec2(uTime * .12, uTime * .07));
        float b = vnoise(p * 3.7 - vec2(uTime * .2, -uTime * .1)) * .45;
        return a + b * uDetail;
      }
      void main(){
        vec2 p = vWorldPos.xz;
        // ring ripples spreading from the rig + wind noise
        float r = length(p - uCenter.xz);
        float ring = sin(r * 5. - uTime * 1.4) * .5 * exp(-r * .15);
        vec2 e = vec2(.05, 0.);
        float hc = h(p) + ring * .3;
        vec3 n = normalize(vec3(hc - (h(p + e.xy) + ring * .3), .35, hc - (h(p + e.yx) + ring * .3)));
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 R = reflect(-V, n);
        float fres = .02 + .98 * pow(1. - max(dot(n, V), 0.), 5.);
        // synthetic environment: dark room, the red glow of the rig on the horizon
        vec3 toRig = normalize(vec3(uCenter.x, uCenter.y + .5, uCenter.z) - vWorldPos);
        float glow = pow(max(dot(R, toRig), 0.), 18.) * 2.2 + pow(max(dot(R, toRig), 0.), 3.) * .25;
        vec3 env = vec3(1., .12, .25) * glow + vec3(.02, .05, .06) * smoothstep(-.1, .6, R.y);
        // grazing views (portrait phones) push fresnel to 1 — keep the reflection dark
        vec3 col = vec3(.004, .006, .008) + env * fres * mix(1.4, .45, smoothstep(.3, .9, fres));
        // light pooled on the surface right under the rig
        col += vec3(.9, .08, .2) * exp(-r * .9) * .12;
        float f = 1. - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
        gl_FragColor = vec4(mix(col, uFogColor, clamp(f, 0., 1.)), 1.);
      }`,
    uniforms: {
      uTime: globalUniforms.uTime,
      uCenter: { value: center.clone() },
      uDetail: { value: detail },
      uFogColor: globalUniforms.uFogColor,
      uFogDensity: globalUniforms.uFogDensity,
    },
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), mat);
  return mesh;
}

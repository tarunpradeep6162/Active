import * as THREE from 'three';
import { globalUniforms } from '../world/uniforms';
import { noise, math } from '../shaders/chunks';

/** Water surface seen from below: animated caustic network with a magenta band. */
export function createWaterSurface(size = 60) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vWorldPos; varying float vDepth;
      uniform float uTime;
      void main(){
        vUv = uv;
        vec3 p = position;
        p.z += sin(p.x * .6 + uTime) * .08 + cos(p.y * .5 - uTime * .8) * .08;
        vec4 wp = modelMatrix * vec4(p, 1.);
        vWorldPos = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      ${math}
      ${noise}
      uniform float uTime;
      varying vec2 vUv; varying vec3 vWorldPos; varying float vDepth;
      float voronoiEdge(vec2 p){
        vec2 i = floor(p), f = fract(p);
        float d1 = 8., d2 = 8.;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
          vec2 g = vec2(x, y);
          vec2 o = hash22(i + g);
          o = .5 + .45 * sin(uTime * .6 + TAU * o);
          float d = length(g + o - f);
          if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        return d2 - d1;
      }
      void main(){
        vec2 p = vWorldPos.xz * .55;
        p += vec2(fbm2(p * .5 + uTime * .05), fbm2(p * .5 - uTime * .04)) * 1.2;
        float e = voronoiEdge(p);
        float lines = smoothstep(.09, .0, e);
        float e2 = voronoiEdge(p * 1.9 + 3.1);
        lines += smoothstep(.06, .0, e2) * .5;
        vec3 col = vec3(.55, .75, .78) * lines * .7;
        float band = smoothstep(.0, .6, sin(vWorldPos.z * .35 + vWorldPos.x * .1 + 1.2)) * smoothstep(12., 3., abs(vWorldPos.z + 4.));
        col = mix(col, vec3(1., .2, .55) * lines * 1.6, band * .8);
        col += vec3(.02, .05, .06);
        float fade = smoothstep(26., 6., vDepth) * smoothstep(.2, 1.2, cameraPosition.y < vWorldPos.y ? 1. : 0.);
        gl_FragColor = vec4(col * fade * .6, 1.);
      }`,
    uniforms: { uTime: globalUniforms.uTime },
    side: THREE.FrontSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size, 60, 60), mat);
  mesh.rotation.x = Math.PI / 2; // face downward
  return mesh;
}

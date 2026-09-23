import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { standardVert } from './materials';
import { globalUniforms } from '../world/uniforms';
import { noise, math, iridescence, fog } from '../shaders/chunks';
import { ANCHOR } from '../world/journey';
import { rng } from '../utils/math';
import { fbm3 } from '../utils/noise';

/**
 * One organic vertebra: a squat, lumpy body, two drooping transverse "fins",
 * a spinous process and a pair of knuckles, all melted together by 3D noise.
 * Several seeded variants are instanced along the column to avoid visible repetition.
 */
function vertebra(seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  // body: squashed sphere → drum
  const body = new THREE.SphereGeometry(0.5, 18, 10);
  body.scale(1.05, 0.46, 0.92);
  parts.push(body);
  // drooping lateral processes (bent capsules)
  for (const side of [-1, 1]) {
    const len = 0.8 + r() * 0.35;
    const fin = new THREE.CapsuleGeometry(0.12 + r() * 0.04, len, 3, 7);
    fin.rotateZ(side * (Math.PI / 2 + 0.6 + r() * 0.3)); // angle outward and downward
    fin.translate(side * (0.55 + len * 0.38), -0.22 - r() * 0.1, -0.12);
    parts.push(fin);
  }
  // spinous process sweeping back and down
  const spine = new THREE.CapsuleGeometry(0.085, 0.42 + r() * 0.2, 3, 7);
  spine.rotateX(-Math.PI / 2 - 0.75);
  spine.translate(0, -0.2, -0.62);
  parts.push(spine);
  for (const side of [-1, 1]) {
    const k = new THREE.SphereGeometry(0.12 + r() * 0.03, 8, 6);
    k.translate(side * 0.3, 0.08, -0.4);
    parts.push(k);
  }
  const merged = mergeGeometries(
    parts.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      n.deleteAttribute('uv');
      return n;
    }),
    false,
  )!;
  // melt: displace along the normal with multi‑octave noise, droop the underside
  const pos = merged.getAttribute('position') as THREE.BufferAttribute;
  const nor = merged.getAttribute('normal') as THREE.BufferAttribute;
  const o = seed * 7.31;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const d = fbm3(x * 2.4 + o, y * 2.4, z * 2.4) * 0.09 + fbm3(x * 9 + o, y * 9, z * 9, 2) * 0.018;
    const droop = y < 0 ? y * 0.12 * Math.abs(x) : 0;
    pos.setXYZ(i, x + nor.getX(i) * d, y + nor.getY(i) * d + droop, z + nor.getZ(i) * d);
  }
  merged.computeVertexNormals();
  return merged;
}

/** Dark, dense, oily glass: thin‑film only on grazing/specular, not a neon body colour. */
export function spineMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: standardVert,
    fragmentShader: /* glsl */ `
      ${math}
      ${noise}
      ${iridescence}
      ${fog}
      uniform float uTime, uFocus;
      varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vUv; varying vec3 vLocal;
      void main(){
        vec3 V = normalize(cameraPosition - vWorldPos);
        vec3 N = normalize(vN);
        if (!gl_FrontFacing) N = -N;
        // micro surface: perturb the normal with fine noise (bumpy, slightly granular)
        vec3 q = vWorldPos * 7.;
        vec3 bump = vec3(snoise(q), snoise(q + 17.3), snoise(q + 41.7));
        N = normalize(N + bump * .22);
        float ndv = clamp(dot(N, V), 0., 1.);
        float fres = pow(1. - ndv, 3.);
        vec3 R = reflect(-V, N);
        // oily film varies across the surface, not with a single sweep
        float film = 1.1 + snoise(vWorldPos * .8 + uTime * .03) * .6;
        vec3 tf = thinFilm(ndv, film);
        vec3 env = fakeEnv(R, vec3(.4, .38, .5), vec3(.03, .025, .05));
        vec3 base = vec3(.09, .08, .12);
        // dark body, iridescent specular, faint internal glow in cavities
        vec3 col = base * (.4 + .6 * ndv);
        col += env * mix(vec3(1.), tf, .5) * (.22 + fres * 1.1);
        float spec = pow(max(dot(R, normalize(vec3(.3, .8, .5))), 0.), 40.);
        col += tf * spec * 1.6;
        col += vec3(.25, .12, .35) * pow(1. - ndv, 6.) * .35;
        col *= 1. - uFocus * .85;
        gl_FragColor = vec4(applyFog(col, vDepth), 1.);
      }`,
    uniforms: {
      uTime: globalUniforms.uTime,
      uFocus: globalUniforms.uFocus,
      uFogColor: globalUniforms.uFogColor,
      uFogDensity: globalUniforms.uFogDensity,
    },
  });
}

export class WorkSpine {
  readonly group = new THREE.Group();
  readonly materials: THREE.ShaderMaterial[] = [];
  private meshes: THREE.InstancedMesh[] = [];

  constructor() {
    const top = ANCHOR.workTop + 10;
    const bottom = ANCHOR.workBottom - 8;
    const mat = spineMaterial();
    this.materials.push(mat);

    // irregular spacing, scale, twist and lateral drift along a gently curving column
    const r = rng(7);
    const placements: { y: number; variant: number }[] = [];
    for (let y = top; y > bottom; ) {
      placements.push({ y, variant: (r() * 4) | 0 });
      y -= 0.5 + r() * 0.22;
    }
    const variants = [11, 23, 37, 51].map(vertebra);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    // chunk by height so off‑screen parts of the 110‑unit column are frustum‑culled
    const CHUNK = 12;
    variants.forEach((geo, vi) => {
      for (let c0 = top; c0 > bottom; c0 -= CHUNK) {
        const list = placements.filter((pl) => pl.variant === vi && pl.y <= c0 && pl.y > c0 - CHUNK);
        if (!list.length) continue;
        const im = new THREE.InstancedMesh(geo, mat, list.length);
        list.forEach((pl, i) => {
          const y = pl.y;
          p.set(Math.sin(y * 0.09) * 0.35 + (r() - 0.5) * 0.06, y, Math.cos(y * 0.07) * 0.25);
          e.set(0.1 * Math.sin(y * 0.3) + (r() - 0.5) * 0.12, Math.sin(y * 0.05) * 0.9 + (r() - 0.5) * 0.35, 0.08 * Math.cos(y * 0.2) + (r() - 0.5) * 0.08);
          q.setFromEuler(e);
          const sc = 0.92 + 0.22 * Math.sin(y * 0.21) + r() * 0.12;
          s.set(sc * (0.95 + r() * 0.1), sc * (0.9 + r() * 0.25), sc);
          im.setMatrixAt(i, m.compose(p, q, s));
        });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        this.meshes.push(im);
        this.group.add(im);
      }
    });

    // chain links spiralling around the column (dark blue chrome)
    const linkGeo = new THREE.TorusGeometry(0.15, 0.038, 6, 16).scale(1, 1.7, 1);
    const chainMat = spineMaterial();
    chainMat.fragmentShader = chainMat.fragmentShader.replace('vec3 base = vec3(.035, .03, .055);', 'vec3 base = vec3(.01, .03, .09);');
    this.materials.push(chainMat);
    const linkSpacing = 0.36;
    const links = Math.floor((top - bottom) / linkSpacing);
    const chain = new THREE.InstancedMesh(linkGeo, chainMat, links);
    const up = new THREE.Vector3(0, 1, 0), tan = new THREE.Vector3(), prev = new THREE.Vector3();
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    const helixPoint = (y: number, out: THREE.Vector3) => {
      const a = y * 0.16 + 0.6;
      const rad = 1.05 + 0.15 * Math.sin(y * 0.4);
      return out.set(Math.sin(y * 0.09) * 0.35 + Math.cos(a) * rad, y, Math.sin(a) * rad * 0.9 + 0.1);
    };
    for (let i = 0; i < links; i++) {
      const y = top - i * linkSpacing;
      helixPoint(y, p);
      helixPoint(y - 0.05, prev);
      tan.subVectors(prev, p).normalize();
      qa.setFromUnitVectors(up, tan);
      qb.setFromAxisAngle(up, (i % 2) * Math.PI * 0.5);
      q.multiplyQuaternions(qa, qb);
      s.setScalar(1);
      chain.setMatrixAt(i, m.compose(p, q, s));
    }
    chain.instanceMatrix.needsUpdate = true;
    chain.computeBoundingSphere();
    this.group.add(chain);
  }

  update(time: number) {
    this.group.rotation.y = Math.sin(time * 0.1) * 0.05;
  }

  triangles() {
    return this.meshes.reduce((a, m) => a + (m.geometry.getAttribute('position').count / 3) * m.count, 0);
  }
}

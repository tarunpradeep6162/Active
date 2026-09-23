import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { standardVert } from './materials';
import { globalUniforms } from '../world/uniforms';
import { noise, math, iridescence, fog } from '../shaders/chunks';
import { WORK_ORIGIN, SPINE, CHAIN, spineBottom } from '../work/WorkLayout';
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

/** World y below which the column is visible; far above = fully revealed. Shared by spine + chain. */
const revealY = { value: 1e5 };
/** Exit crumble 0…1, shared by spine + chain. */
const crumble = { value: 0 };

/** Dark, dense, oily glass: thin‑film only on grazing/specular, not a neon body colour. */
export function spineMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: standardVert,
    fragmentShader: /* glsl */ `
      ${math}
      ${noise}
      ${iridescence}
      ${fog}
      uniform float uTime, uFocus, uRevealY, uCrumble;
      varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vUv; varying vec3 vLocal;
      void main(){
        // bottom‑up reveal front with a ragged edge (entry seam)
        float edge = uRevealY - vWorldPos.y + snoise(vWorldPos * 2.3) * .35;
        if (edge < 0.) discard;
        // exit crumble: coarse noise cells drop out, with a bright rim
        float crumbleEdge = snoise(vWorldPos * 1.7) * .35 + .7 - uCrumble * 1.4;
        if (crumbleEdge < 0.) discard;
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
        col += vec3(.5, .7, 1.) * smoothstep(.25, 0., edge) * step(uRevealY, 1e4) * .8;
        col += vec3(.5, .7, 1.) * smoothstep(.12, 0., crumbleEdge) * step(.001, uCrumble);
        gl_FragColor = vec4(applyFog(col, vDepth), 1.);
      }`,
    uniforms: {
      uTime: globalUniforms.uTime,
      uFocus: globalUniforms.uFocus,
      uRevealY: revealY,
      uCrumble: crumble,
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
    const mat = spineMaterial();
    this.materials.push(mat);

    // Measured reference layout: a straight column of 40 vertebrae, 0.65 apart, each twisted
    // a further ≈23° about the axis. Four seeded variants break exact repetition, normalised
    // to the reference vertebra size so the silhouette and rhythm match.
    const variants = [11, 23, 37, 51].map((seed) => {
      const g = vertebra(seed);
      g.computeBoundingBox();
      const size = new THREE.Vector3();
      g.boundingBox!.getSize(size);
      g.scale(SPINE.size.x / size.x, SPINE.size.y / size.y, SPINE.size.z / size.z);
      g.computeBoundingBox();
      const c = new THREE.Vector3();
      g.boundingBox!.getCenter(c);
      g.translate(-c.x, -c.y, -c.z);
      return g;
    });
    const r = rng(7);
    const lists: number[][] = [[], [], [], []];
    for (let i = 0; i < SPINE.count; i++) lists[(r() * 4) | 0].push(i);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    variants.forEach((geo, vi) => {
      const list = lists[vi];
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((i, k) => {
        p.set(0, SPINE.top - i * SPINE.spacing, 0);
        q.setFromAxisAngle(up, THREE.MathUtils.degToRad(SPINE.twistDeg * i));
        im.setMatrixAt(k, m.compose(p, q, s));
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      this.meshes.push(im);
      this.group.add(im);
    });

    // chain links spiralling around the column (dark blue chrome)
    const linkGeo = new THREE.TorusGeometry(0.15, 0.038, 6, 16).scale(1, 1.7, 1);
    const chainMat = spineMaterial();
    chainMat.fragmentShader = chainMat.fragmentShader.replace('vec3 base = vec3(.09, .08, .12);', 'vec3 base = vec3(.01, .03, .09);');
    this.materials.push(chainMat);
    const top = CHAIN.top, bottom = spineBottom();
    const linkSpacing = 0.34;
    const links = Math.floor((top - bottom) / linkSpacing);
    const chain = new THREE.InstancedMesh(linkGeo, chainMat, links);
    const tan = new THREE.Vector3(), prev = new THREE.Vector3();
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    const helixPoint = (y: number, out: THREE.Vector3) => {
      const a = y * 0.55 + 0.6;
      return out.set(Math.cos(a) * 1.15, y, Math.sin(a) * 1.15);
    };
    for (let i = 0; i < links; i++) {
      const y = top - i * linkSpacing;
      helixPoint(y, p);
      helixPoint(y - 0.05, prev);
      tan.subVectors(prev, p).normalize();
      qa.setFromUnitVectors(up, tan);
      qb.setFromAxisAngle(up, (i % 2) * Math.PI * 0.5);
      q.multiplyQuaternions(qa, qb);
      chain.setMatrixAt(i, m.compose(p, q, s));
    }
    chain.instanceMatrix.needsUpdate = true;
    chain.computeBoundingSphere();
    this.group.add(chain);
    this.group.position.copy(WORK_ORIGIN);
  }

  /** World‑space vertical extent of the column (for QA projection). */
  get axisTop() {
    return WORK_ORIGIN.y + SPINE.top;
  }
  get axisBottom() {
    return WORK_ORIGIN.y + spineBottom();
  }

  update(_time: number) {
    // the column is static; all apparent motion comes from the camera orbiting it (reference)
  }

  /** Exit crumble, 0 = intact … 1 = gone. */
  setCrumble(c: number) {
    crumble.value = c;
    this.group.visible = c < 0.999;
  }

  /** Entry reveal front in column‑local y (null = fully shown). */
  setReveal(front: number | null) {
    revealY.value = front === null ? 1e5 : WORK_ORIGIN.y + front;
  }

  triangles() {
    return this.meshes.reduce((a, m) => a + (m.geometry.getAttribute('position').count / 3) * m.count, 0);
  }
}

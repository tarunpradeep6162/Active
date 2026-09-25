import * as THREE from 'three';
import { ANCHOR } from '../world/journey';
import { globalUniforms } from '../world/uniforms';
import { fog } from '../shaders/chunks';
import { rng, clamp, smoothstep } from '../utils/math';
import { NightLake, reflectionChunk } from './NightLake';

/** How many lanterns carry a wish she can read (and let go). */
const WISH_LANTERNS = 12;
/** the sky sits well below the lab so a level camera never sees the rig above */
const SKY_Y = ANCHOR.portal - 6;
const P = SKY_Y;
const STORE = 'bday-lanterns-v1';
/** the lake the lanterns rise from */
const WATER_Y = P - 2.5;

/**
 * The lantern sky, where the old underwater hex tunnel was: a night full of paper sky lanterns
 * rising slowly out of the dark, and twelve brighter ones hovering close enough to touch. Each
 * of those carries a wish; touching it lets it go: it climbs, grows small, and becomes a star
 * that stays in this sky (remembered on this device).
 *
 * Ambient lanterns are animated entirely in the vertex shader; the wish lanterns are placed on
 * the CPU each frame so they can be picked and followed on screen.
 */
export class LanternSky {
  readonly group = new THREE.Group();
  readonly materials: THREE.ShaderMaterial[] = [];
  /** the wish lanterns (pickable, instanceId = wish index) */
  readonly wishMesh: THREE.InstancedMesh;
  /** page time each wish lantern was let go (NaN: still waiting) */
  private released = new Float64Array(WISH_LANTERNS).fill(NaN);
  private done: boolean[] = [];
  private home: THREE.Vector3[] = [];
  private now: THREE.Vector3[] = [];
  private scale: number[] = [];
  private stars: THREE.Points;
  private starAlpha: THREE.BufferAttribute;
  private glowWish: THREE.Points;
  private wishRefl!: THREE.ShaderMaterial;
  private time = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private readonly px = { value: 60 };
  /** the night lake under the lanterns (sky, far shore, water) */
  readonly lake = new NightLake(WATER_Y, 16);

  constructor(density = 1) {
    const rr = rng(2511);
    const count = Math.round(110 * clamp(density, 0.4, 1));

    // a sky lantern: narrow open mouth below, widening to a rounded paper top
    const profile = [
      [0.17, 0],
      [0.2, 0.06],
      [0.27, 0.3],
      [0.31, 0.56],
      [0.3, 0.7],
      [0.22, 0.8],
      [0.001, 0.83],
    ].map(([r, y]) => new THREE.Vector2(r, y - 0.4));
    const geo = new THREE.LatheGeometry(profile, 14);

    const motion = /* glsl */ `
      vec3 drift(vec4 s, float t){
        float k = fract(s.y + t * (.006 + s.z * .006));
        float y = ${(WATER_Y + 0.4).toFixed(2)} + k * 24.;
        float x = (s.x - .5) * 30. + sin(t * .11 + s.w * 6.) * .8;
        float z = -3. - s.w * 20.;
        return vec3(x, y, z);
      }
      float driftFade(vec4 s, float t){ float k = fract(s.y + t * (.006 + s.z * .006)); return smoothstep(0., .08, k) * (1. - smoothstep(.82, 1., k)); }
    `;
    const paperFrag = /* glsl */ `
      ${fog}
      uniform float uTime;
      varying vec3 vLocal; varying float vDepth; varying float vGlow; varying float vHue; varying float vFade;
      void main(){
        // warm light from the flame in the mouth: brightest low inside, fading up the paper
        float h = clamp(vLocal.y + .4, 0., .83) / .83;
        float ribs = smoothstep(.93, 1., abs(sin(atan(vLocal.z, vLocal.x) * 3.5)));
        vec3 paper = mix(vec3(1., .62, .3), vec3(.98, .55, .5), vHue);
        float flick = .9 + .1 * sin(uTime * 7. + vHue * 40.);
        vec3 col = paper * (1.5 - h * 1.05) * flick * vGlow;
        col *= 1. - ribs * .35;
        col += vec3(1., .85, .6) * pow(1. - h, 6.) * 1.2 * vGlow;
        gl_FragColor = vec4(applyFog(col * vFade, vDepth * .6), 1.);
      }`;

    // ambient lanterns
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) seeds.set([rr(), rr(), rr(), rr()], i * 4);
    const ambGeo = new THREE.InstancedBufferGeometry().copy(geo as unknown as THREE.InstancedBufferGeometry);
    ambGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    ambGeo.instanceCount = count;
    const ambient = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime;
        varying vec3 vLocal; varying float vDepth; varying float vGlow; varying float vHue; varying float vFade;
        ${motion}
        void main(){
          vec3 c = drift(aSeed, uTime);
          float sc = .55 + aSeed.z * .5;
          float sway = sin(uTime * .6 + aSeed.x * 20.) * .08;
          vFade = driftFade(aSeed, uTime);
          // a lantern fading in or out also grows or shrinks (never a dark shape on the water)
          vec3 p = position * sc * clamp(vFade * 3., 0., 1.);
          p.xy = mat2(cos(sway), -sin(sway), sin(sway), cos(sway)) * p.xy;
          vLocal = position;
          vec4 mv = viewMatrix * modelMatrix * vec4(c + p, 1.);
          vDepth = -mv.z;
          vGlow = .6 + aSeed.w * .4;
          vHue = step(.7, aSeed.x);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: paperFrag,
      uniforms: { uTime: globalUniforms.uTime, uFogColor: globalUniforms.uFogColor, uFogDensity: globalUniforms.uFogDensity },
    });
    this.materials.push(ambient);
    const amb = new THREE.Mesh(ambGeo, ambient);
    amb.frustumCulled = false;
    this.group.add(amb);

    // their halos (one additive point per lantern, same motion)
    const haloGeo = new THREE.BufferGeometry();
    haloGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
    haloGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 4));
    const halo = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec4 aSeed;
        uniform float uTime, uPx;
        varying float vA;
        ${motion}
        void main(){
          vec3 c = drift(aSeed, uTime) + vec3(0., -.25, 0.) * (.55 + aSeed.z * .5);
          vec4 mv = viewMatrix * modelMatrix * vec4(c, 1.);
          gl_Position = projectionMatrix * mv;
          vA = driftFade(aSeed, uTime) * (.5 + aSeed.w * .5);
          gl_PointSize = uPx * 9. * (.55 + aSeed.z * .5) / max(-mv.z, 1.);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){ float d = length(gl_PointCoord - .5); gl_FragColor = vec4(vec3(1., .66, .34) * smoothstep(.5, 0., d) * smoothstep(.5, 0., d) * vA * .5, 1.); }`,
      uniforms: { uTime: globalUniforms.uTime, uPx: this.px },
    });
    this.materials.push(halo);
    const halos = new THREE.Points(haloGeo, halo);
    halos.frustumCulled = false;
    this.group.add(halos);
    this.group.add(this.lake.sky, this.lake.water);

    // every lantern's light, reflected on the lake as a soft streak broken by ripples
    const reflMat = (body: string, attribs: string, size: string) =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          ${attribs}
          uniform float uTime, uPx, uWaterY, uAmt;
          varying float vA; varying float vSeed;
          ${motion}
          ${reflectionChunk}
          void main(){
            ${body}
            float hgt = w.y - uWaterY;
            vec4 mv = viewMatrix * vec4(mirrorWorld(w, uWaterY, uTime, vSeed), 1.);
            gl_Position = projectionMatrix * mv;
            vA *= exp(-hgt * .05) * step(0., hgt) * uAmt;
            gl_PointSize = uPx * ${size} / max(-mv.z, 1.);
          }`,
        fragmentShader: /* glsl */ `
          ${reflectionChunk}
          uniform float uTime; varying float vA; varying float vSeed;
          void main(){ float a = streak(gl_PointCoord, uTime, vSeed) * vA * 1.1; gl_FragColor = vec4(vec3(1., .66, .34) * a, a); }`,
        uniforms: { uTime: globalUniforms.uTime, uPx: this.px, uWaterY: this.lake.uniforms.uWaterY, uAmt: this.lake.uniforms.uAmt },
      });
    const ambRefl = reflMat(
      `vec3 w = (modelMatrix * vec4(drift(aSeed, uTime), 1.)).xyz; vSeed = aSeed.x; vA = driftFade(aSeed, uTime) * (.5 + aSeed.w * .5);`,
      'attribute vec4 aSeed;',
      '22. * (.55 + aSeed.z * .5)',
    );
    this.materials.push(ambRefl);
    const ar = new THREE.Points(haloGeo, ambRefl);
    ar.frustumCulled = false;
    ar.renderOrder = 5;
    this.group.add(ar);
    this.wishRefl = reflMat(`vec3 w = (modelMatrix * vec4(position, 1.)).xyz; vSeed = w.x; vA = aA;`, 'attribute float aA;', '20.');
    this.materials.push(this.wishRefl);

    // wish lanterns: close, larger, brighter, hovering in a loose arc in front of the camera
    const wishMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        attribute float aGlow;
        varying vec3 vLocal; varying float vDepth; varying float vGlow; varying float vHue; varying float vFade;
        void main(){
          vLocal = position;
          vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.);
          vDepth = -mv.z;
          vGlow = aGlow; vHue = float(gl_InstanceID % 3 == 1); vFade = 1.;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: paperFrag,
      uniforms: { uTime: globalUniforms.uTime, uFogColor: globalUniforms.uFogColor, uFogDensity: globalUniforms.uFogDensity },
    });
    this.materials.push(wishMat);
    const wishGeo = geo.clone();
    wishGeo.setAttribute('aGlow', new THREE.InstancedBufferAttribute(new Float32Array(WISH_LANTERNS).fill(1), 1));
    this.wishMesh = new THREE.InstancedMesh(wishGeo, wishMat, WISH_LANTERNS);
    this.wishMesh.frustumCulled = false;
    this.group.add(this.wishMesh);
    const saved = load();
    for (let i = 0; i < WISH_LANTERNS; i++) {
      const a = (i / (WISH_LANTERNS - 1) - 0.5) * 2; // −1 … 1 across the arc
      const row = i % 2;
      this.home.push(new THREE.Vector3(a * 5.2 + (rr() - 0.5) * 0.6, P + 1.2 + row * 1.6 + Math.cos(a * 1.4) * 1.4 + rr() * 0.6, -1.5 - row * 2.2 - Math.abs(a) * 1.5));
      this.now.push(this.home[i].clone());
      this.scale.push(1.05 + rr() * 0.25);
      this.done.push(saved.includes(i));
    }

    // halos for the wish lanterns
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(WISH_LANTERNS * 3), 3));
    wg.setAttribute('aA', new THREE.Float32BufferAttribute(new Float32Array(WISH_LANTERNS).fill(1), 1));
    const wishHalo = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aA; uniform float uPx; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv; vA = aA; gl_PointSize = uPx * 14. / max(-mv.z, 1.); }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){ float d = length(gl_PointCoord - .5); float g = smoothstep(.5, 0., d); gl_FragColor = vec4(vec3(1., .7, .38) * g * g * vA * .55, 1.); }`,
      uniforms: { uPx: this.px },
    });
    this.materials.push(wishHalo);
    this.glowWish = new THREE.Points(wg, wishHalo);
    this.glowWish.frustumCulled = false;
    this.group.add(this.glowWish);
    const wr = new THREE.Points(wg, this.wishRefl);
    wr.frustumCulled = false;
    wr.renderOrder = 5;
    this.group.add(wr);

    // the stars the released wishes become
    const sg = new THREE.BufferGeometry();
    const sp = new Float32Array(WISH_LANTERNS * 3);
    this.home.forEach((h, i) => sp.set([h.x * 2.2, P + 5.6 + (i % 3) * 0.7 + rr() * 0.5, h.z - 10], i * 3));
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    this.starAlpha = new THREE.Float32BufferAttribute(new Float32Array(WISH_LANTERNS), 1);
    sg.setAttribute('aA', this.starAlpha);
    const starMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float aA; uniform float uPx, uTime; varying float vA;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
          vA = aA * (.75 + .25 * sin(uTime * 2. + position.x * 3.)); gl_PointSize = uPx * 13. / max(-mv.z, 1.); }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){ vec2 c = gl_PointCoord - .5; float d = length(c);
          float core = smoothstep(.08, 0., d); float rays = smoothstep(.03, 0., abs(c.x)) * smoothstep(.5, 0., abs(c.y)) + smoothstep(.03, 0., abs(c.y)) * smoothstep(.5, 0., abs(c.x));
          gl_FragColor = vec4(vec3(1., .95, .85) * (core + rays * .6 + smoothstep(.5, 0., d) * .25) * vA, 1.); }`,
      uniforms: { uPx: this.px, uTime: globalUniforms.uTime },
    });
    this.materials.push(starMat);
    this.stars = new THREE.Points(sg, starMat);
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
  }

  /** Let wish i go (idempotent). Returns false if it is already a star or on its way. */
  release(i: number) {
    if (i < 0 || i >= WISH_LANTERNS || this.done[i] || !Number.isNaN(this.released[i])) return false;
    this.released[i] = this.time;
    return true;
  }

  /** The next wish lantern still waiting (keyboard / button path), or −1. */
  nextWaiting() {
    for (let i = 0; i < WISH_LANTERNS; i++) if (!this.done[i] && Number.isNaN(this.released[i])) return i;
    return -1;
  }

  get starsLit() {
    return this.done.filter(Boolean).length;
  }

  /** World position of wish lantern i right now. */
  wishPosition(i: number, out: THREE.Vector3) {
    return out.copy(this.now[i]).applyMatrix4(this.group.matrixWorld);
  }

  update(time: number, dpr: number) {
    this.time = time;
    this.px.value = 60 * dpr;
    const glow = this.wishMesh.geometry.getAttribute('aGlow') as THREE.BufferAttribute;
    const halo = this.glowWish.geometry.getAttribute('position') as THREE.BufferAttribute;
    const haloA = this.glowWish.geometry.getAttribute('aA') as THREE.BufferAttribute;
    const starPos = this.stars.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < WISH_LANTERNS; i++) {
      const h = this.home[i];
      const n = this.now[i];
      let sc = this.scale[i];
      let a = 1;
      const r = this.released[i];
      n.set(h.x + Math.sin(time * 0.35 + i * 1.7) * 0.18, h.y + Math.sin(time * 0.5 + i) * 0.22, h.z);
      if (this.done[i]) {
        sc = 0;
        a = 0;
        this.starAlpha.setX(i, 1);
      } else if (!Number.isNaN(r)) {
        // climb, accelerating, toward its star; shrink and fade as it arrives
        const t = time - r;
        const k = smoothstep(0, 6, t);
        const sx = starPos.getX(i), sy = starPos.getY(i), sz = starPos.getZ(i);
        n.set(n.x + (sx - n.x) * k, n.y + (sy - n.y) * k, n.z + (sz - n.z) * k);
        sc *= 1 - smoothstep(3.5, 6, t) * 0.95;
        a = 1 - smoothstep(4.5, 6, t);
        this.starAlpha.setX(i, smoothstep(4.8, 6.5, t));
        glow.setX(i, 1 + smoothstep(0, 0.6, t) * 0.6);
        if (t > 6.5) {
          this.done[i] = true;
          this.released[i] = NaN;
          save(this.done);
        }
      } else {
        this.starAlpha.setX(i, 0);
        glow.setX(i, 1 + Math.sin(time * 1.3 + i) * 0.08);
      }
      const sway = Math.sin(time * 0.6 + i * 2.1) * 0.07;
      this.m.compose(n, this.q.setFromAxisAngle(this.s.set(0, 0, 1), sway), this.s.set(sc, sc, sc));
      this.wishMesh.setMatrixAt(i, this.m);
      halo.setXYZ(i, n.x, n.y - 0.22 * sc, n.z);
      haloA.setX(i, a);
    }
    this.wishMesh.instanceMatrix.needsUpdate = true;
    // raycasts use a cached bounding sphere of all instances; they move, so refresh it (12 lanterns)
    this.wishMesh.computeBoundingSphere();
    glow.needsUpdate = true;
    halo.needsUpdate = true;
    haloA.needsUpdate = true;
    this.starAlpha.needsUpdate = true;
  }
}

function load(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => Number.isInteger(x)) : [];
  } catch {
    return [];
  }
}
function save(done: boolean[]) {
  try {
    localStorage.setItem(STORE, JSON.stringify(done.map((d, i) => (d ? i : -1)).filter((i) => i >= 0)));
  } catch {
    /* private mode: the stars just won't be remembered */
  }
}

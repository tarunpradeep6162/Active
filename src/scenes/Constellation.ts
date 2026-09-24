import * as THREE from 'three';
import { ANCHOR } from '../world/journey';
import { globalUniforms } from '../world/uniforms';
import { rng, clamp, smoothstep } from '../utils/math';

const O = ANCHOR.outro;
const SERIF = "'Cormorant Garamond', Georgia, serif";

/**
 * The finale sky. A field of stars that, as she scrolls, drifts together into "25 · 11",
 * then rearranges into her name. Restrained fireworks in rose and champagne bloom around it
 * once the name has formed. Everything is one Points draw each; shapes are sampled from text
 * rasterised on a canvas, so they use the site's own serif.
 */
export class Constellation {
  readonly group = new THREE.Group();
  readonly materials: THREE.ShaderMaterial[] = [];
  private stars: THREE.Points;
  private fireworks: THREE.Points;
  private readonly u = {
    uMorph: { value: 0 },
    uPx: { value: 60 },
    uTime: globalUniforms.uTime,
    uFire: { value: 0 },
    uFade: { value: 1 },
  };
  private built = false;
  private readonly count: number;
  /** the width the name spans (world units at scale 1) */
  private readonly span = 11;

  constructor(name: string, date: string, density = 1) {
    this.count = Math.round(1400 * clamp(density, 0.45, 1));
    this.group.position.set(0, O + 0.9, -1.5);
    const geo = new THREE.BufferGeometry();
    const n = this.count;
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aDate', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aName', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Float32Array(n * 4), 4));
    this.stars = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute vec3 aDate; attribute vec3 aName; attribute vec4 aSeed;
          uniform float uMorph, uPx, uTime, uFade;
          varying float vA; varying float vWarm;
          void main(){
            // each star travels on its own schedule, so the words gather rather than snap
            float d = aSeed.x * .45;
            float m1 = smoothstep(d, d + .55, clamp(uMorph, 0., 1.));
            float m2 = smoothstep(d, d + .55, clamp(uMorph - 1., 0., 1.));
            vec3 p = mix(mix(position, aDate, m1), aName, m2);
            // a gentle arc on the way, and a slow shimmer once placed
            float travel = sin(3.1416 * (m1 < 1. ? m1 : m2));
            p.z += travel * (aSeed.y - .5) * 2.;
            p += vec3(sin(uTime * .6 + aSeed.z * 30.), cos(uTime * .5 + aSeed.w * 30.), 0.) * .012;
            vec4 mv = modelViewMatrix * vec4(p, 1.);
            gl_Position = projectionMatrix * mv;
            float tw = .65 + .35 * sin(uTime * (1. + aSeed.z * 2.) + aSeed.w * 40.);
            vA = tw * uFade * (.55 + .45 * max(m1, m2));
            vWarm = aSeed.y;
            gl_PointSize = uPx * (.9 + aSeed.w * 1.3) * (1. + max(m1, m2) * .35) / max(-mv.z, 1.);
          }`,
        fragmentShader: /* glsl */ `
          varying float vA; varying float vWarm;
          void main(){
            float d = length(gl_PointCoord - .5);
            float a = (smoothstep(.5, .0, d) * .35 + smoothstep(.16, .0, d)) * vA;
            vec3 col = mix(vec3(1., .96, .9), vec3(.95, .82, .56), vWarm * .6);
            gl_FragColor = vec4(col * a, 1.);
          }`,
        uniforms: this.u,
      }),
    );
    this.stars.frustumCulled = false;
    this.materials.push(this.stars.material as THREE.ShaderMaterial);
    this.group.add(this.stars);

    // restrained fireworks: five bursts on a slow loop, rose and champagne, soft falling trails
    const B = 5, per = density < 0.7 ? 90 : 160;
    const fg = new THREE.BufferGeometry();
    const fpos = new Float32Array(B * per * 3);
    const fdir = new Float32Array(B * per * 4);
    const rr = rng(1125);
    for (let b = 0; b < B; b++)
      for (let i = 0; i < per; i++) {
        const k = b * per + i;
        const u = rr() * 2 - 1, th = rr() * Math.PI * 2, s = Math.sqrt(1 - u * u);
        fdir.set([Math.cos(th) * s, u, Math.sin(th) * s * 0.4, b], k * 4);
        fpos.set([rr(), rr(), rr()], k * 3);
      }
    fg.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
    fg.setAttribute('aDir', new THREE.Float32BufferAttribute(fdir, 4));
    this.fireworks = new THREE.Points(
      fg,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute vec4 aDir;
          uniform float uTime, uPx, uFire;
          varying float vA; varying float vRose;
          float h(float n){ return fract(sin(n) * 43758.5453); }
          void main(){
            float b = aDir.w;
            float period = 7.;
            float cyc = floor((uTime + b * 1.4) / period);
            float t = mod(uTime + b * 1.4, period);
            // each burst picks a new spot around (never over) the name
            float side = h(cyc * 7.1 + b) < .5 ? -1. : 1.;
            vec3 c = vec3(side * (3.2 + h(cyc * 3.3 + b) * 3.), 1.8 + h(cyc * 5.7 + b) * 2.2, -3. - h(cyc + b * 9.) * 3.);
            float r = (1. - exp(-t * 2.2)) * (1.1 + position.x * .5);
            vec3 p = c + aDir.xyz * r + vec3(0., -.12 * t * t, 0.);
            vec4 mv = modelViewMatrix * vec4(p, 1.);
            gl_Position = projectionMatrix * mv;
            vA = uFire * smoothstep(0., .08, t) * (1. - smoothstep(.6, 2.6, t)) * (.6 + .4 * sin(t * 30. + position.y * 20.));
            vRose = step(.5, h(cyc * 1.9 + b * 4.1));
            gl_PointSize = uPx * (1. + position.z) / max(-mv.z, 1.);
          }`,
        fragmentShader: /* glsl */ `
          varying float vA; varying float vRose;
          void main(){
            float d = length(gl_PointCoord - .5);
            vec3 col = mix(vec3(.96, .82, .52), vec3(.95, .6, .68), vRose);
            gl_FragColor = vec4(col * smoothstep(.5, 0., d) * vA, 1.);
          }`,
        uniforms: this.u,
      }),
    );
    this.fireworks.frustumCulled = false;
    this.materials.push(this.fireworks.material as THREE.ShaderMaterial);
    this.group.add(this.fireworks);

    this.name = name;
    this.date = date;
    // the serif may still be loading; shape the words once it is ready (fallback: after 3 s)
    const build = () => this.build();
    if (document.fonts?.load) {
      Promise.race([document.fonts.load(`500 120px ${SERIF}`), new Promise((r) => setTimeout(r, 3000))]).then(build, build);
    } else build();
  }
  private name: string;
  private date: string;

  /** Sample the lit pixels of a line of text into n points, centred, `span` wide. */
  private sample(text: string, n: number, rr: () => number) {
    const W = 1400, H = 300;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let size = 220;
    g.font = `500 ${size}px ${SERIF}`;
    const w = g.measureText(text).width;
    if (w > W * 0.94) {
      size *= (W * 0.94) / w;
      g.font = `500 ${size}px ${SERIF}`;
    }
    g.fillText(text, W / 2, H / 2);
    const data = g.getImageData(0, 0, W, H).data;
    const lit: number[] = [];
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 128) lit.push(x, y);
    const k = this.span / (W * 0.94);
    const out = new Float32Array(n * 3);
    const pts = lit.length / 2;
    for (let i = 0; i < n; i++) {
      const j = pts ? Math.floor(rr() * pts) : 0;
      const x = pts ? lit[j * 2] : W / 2, y = pts ? lit[j * 2 + 1] : H / 2;
      out.set([(x - W / 2) * k + (rr() - 0.5) * 0.03, -(y - H / 2) * k + (rr() - 0.5) * 0.03, (rr() - 0.5) * 0.15], i * 3);
    }
    return out;
  }

  private build() {
    if (this.built) return;
    this.built = true;
    const rr = rng(2511);
    const n = this.count;
    const geo = this.stars.geometry;
    const sky = geo.getAttribute('position') as THREE.BufferAttribute;
    const seed = geo.getAttribute('aSeed') as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      sky.setXYZ(i, (rr() - 0.5) * 30, (rr() - 0.35) * 14, -2 - rr() * 10);
      seed.setXYZW(i, rr(), rr(), rr(), rr());
    }
    (geo.getAttribute('aDate') as THREE.BufferAttribute).set(this.sample(this.date, n, rr));
    (geo.getAttribute('aName') as THREE.BufferAttribute).set(this.sample(this.name.toUpperCase().split('').join(' '), n, rr));
    for (const k of ['position', 'aDate', 'aName', 'aSeed']) (geo.getAttribute(k) as THREE.BufferAttribute).needsUpdate = true;
  }

  /**
   * local: outro progress 0…1. Stars scattered → "25 · 11" (≈0.3–0.45) → the name (≈0.52–0.68);
   * fireworks from ≈0.74. The words are scaled to fit the camera's view (phones included).
   */
  update(local: number, camera: THREE.PerspectiveCamera, dpr: number) {
    this.u.uMorph.value = smoothstep(0.24, 0.42, local) + smoothstep(0.5, 0.66, local);
    this.u.uFire.value = smoothstep(0.72, 0.8, local);
    this.u.uFade.value = smoothstep(0.02, 0.14, local);
    this.u.uPx.value = 60 * dpr;
    const dist = Math.max(1, camera.position.z - this.group.position.z);
    const viewW = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    this.group.scale.setScalar(Math.min(1, (viewW * 0.86) / this.span));
    this.group.visible = local > 0.001;
  }
}

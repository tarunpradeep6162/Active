import * as THREE from 'three';
import { PROJECTS, type Project } from '../app/projects';
import { globalUniforms } from '../world/uniforms';
import { noise, math, iridescence, fog } from '../shaders/chunks';
import { ANCHOR } from '../world/journey';
import { state } from '../core/state';
import { damp, clamp } from '../utils/math';

export const CARD_W = 4.4;
export const CARD_H = 3.4;
const DISPLAY_FONT = '"Tourney Variable", "Tourney", sans-serif';
const MONO_FONT = '"Share Tech Mono", monospace';

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Rasterise the card title (display face, outlined) into an alpha texture. */
export function titleTexture(p: Project) {
  const W = 1024, H = Math.round((1024 * CARD_H) / CARD_W);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, W, H);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';
  g.font = `400 34px ${MONO_FONT}`;
  g.globalAlpha = 0.85;
  g.fillText(p.kicker, W / 2, H * 0.3);
  g.globalAlpha = 1;
  const words = p.title.toUpperCase().split(' ');
  const lines: string[] = [];
  let line = '';
  const size = 118;
  g.font = `330 ${size}px ${DISPLAY_FONT}`;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > W * 0.78 && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  lines.push(line);
  const lh = size * 0.98;
  const y0 = H * 0.52 - ((lines.length - 1) * lh) / 2;
  g.lineWidth = 2;
  g.strokeStyle = '#fff';
  lines.forEach((l, i) => {
    g.fillText(l, W / 2, y0 + i * lh);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

const cardVert = /* glsl */ `
varying vec3 vN; varying vec3 vLocalN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vCardUv;
uniform vec2 uSize; uniform float uHover; uniform vec2 uHoverUv; uniform float uTime;
void main(){
  vec3 p = position;
  // subtle glass wobble, plus a gentle bulge toward the pointer on hover
  float d = length(p.xy / uSize - (uHoverUv - .5));
  p.z += uHover * .12 * smoothstep(.6, 0., d);
  vCardUv = p.xy / uSize + .5;
  vLocalN = normal;
  vec4 wp = modelMatrix * vec4(p, 1.);
  vWorldPos = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const cardFrag = /* glsl */ `
${math}
${noise}
${iridescence}
${fog}
uniform sampler2D uTitle;
uniform vec3 uPalA, uPalB, uPalC;
uniform float uStyle, uHover, uTime, uFocus, uActive, uHighlight, uOpacity, uGhost;
varying vec3 vN; varying vec3 vLocalN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vCardUv;

vec3 media(vec2 uv){
  vec2 p = uv * vec2(1.3, 1.) * 2.2 + uStyle * 3.1;
  float t = uTime * .045;
  vec2 q = vec2(fbm2(p + t), fbm2(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm2(p + 3.5 * q + vec2(1.7, 9.2) + t * .7), fbm2(p + 3.5 * q + vec2(8.3, 2.8)));
  float f = fbm2(p + 3.8 * r);
  f = mix(f, floor(f * 7.) / 7., .3);
  vec3 col = mix(uPalA, uPalB, smoothstep(.25, .75, f));
  col = mix(col, uPalC, smoothstep(.5, .95, length(r) * f * 1.35));
  col *= .8 + .35 * vnoise(uv * vec2(90., 14.) + q * 8.);
  return col;
}

void main(){
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  float ndv = clamp(dot(N, V), 0., 1.);
  float fres = pow(1. - ndv, 2.5);
  vec2 uv = vCardUv;
  vec3 col;
  float front = step(.5, vLocalN.z);
  float back = step(.5, -vLocalN.z);
  if (front > .5 || back > .5) {
    vec2 muv = back > .5 ? vec2(1. - uv.x, uv.y) : uv;
    col = media(muv);
    // title with scanline glitch on hover
    float band = floor(uv.y * 38.) + floor(uTime * 14.);
    float jitter = (hash11(band) - .5) * .05 * uHover * step(.6, hash11(band * 1.7));
    vec4 tt = texture2D(uTitle, vec2(uv.x + jitter, uv.y));
    float tr = texture2D(uTitle, vec2(uv.x + jitter + .004 * (1. + uHover), uv.y)).a;
    float glow = texture2D(uTitle, uv, 3.).a;
    float titleA = tt.a * front;
    col = mix(col * (1. - glow * .35), vec3(1.), titleA);
    col += vec3(.9, .2, .5) * (tr - tt.a) * front * uHover;
    col += glow * front * (.35 + uHover * .6);
    // inner vignette + glass sheen
    float vig = smoothstep(.95, .2, length((uv - .5) * vec2(1., 1.2)));
    col *= mix(.55, 1., vig);
    float sheen = smoothstep(.25, 0., abs(uv.x + uv.y * .6 - fract(uTime * .04) * 3. + .8)) * .06;
    col += sheen + fres * .45;
    col *= back > .5 ? .35 : 1.;
  } else {
    // glass edge
    vec3 film = thinFilm(ndv, 1.4);
    col = mix(uPalB, film, .6) * (.4 + fres * 2.);
  }
  col *= 1. + uHighlight * .35;
  // other cards recede when a project is focused
  col *= mix(1., mix(.08, 1.25, uActive), uFocus);
  col *= mix(1., .45, uGhost);
  col = applyFog(col, vDepth);
  gl_FragColor = vec4(col, uOpacity);
}`;

export interface CardEntry {
  project: Project;
  mesh: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;
  base: THREE.Object3D; // resting transform
  hover: number;
  hoverTarget: number;
}

export class ProjectCards {
  readonly group = new THREE.Group();
  readonly cards: CardEntry[] = [];
  readonly materials: THREE.ShaderMaterial[] = [];
  private geometry: THREE.ExtrudeGeometry;
  private ghosts: THREE.Mesh[] = [];
  private tmpV = new THREE.Vector3();

  constructor(titles: Map<string, THREE.Texture>) {
    this.geometry = new THREE.ExtrudeGeometry(roundedRect(CARD_W, CARD_H, 0.34), {
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.035,
      bevelSegments: 3,
      curveSegments: 10,
    });
    this.geometry.translate(0, 0, -0.03);
    const empty = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    empty.needsUpdate = true;

    const make = (p: Project, ghost: boolean) => {
      const uniforms: Record<string, THREE.IUniform> = {
        uTitle: { value: ghost ? empty : titles.get(p.slug) ?? empty },
        uPalA: { value: new THREE.Color(p.palette[0]) },
        uPalB: { value: new THREE.Color(p.palette[1]) },
        uPalC: { value: new THREE.Color(p.palette[2]) },
        uStyle: { value: p.style },
        uSize: { value: new THREE.Vector2(CARD_W, CARD_H) },
        uHover: { value: 0 },
        uHoverUv: { value: new THREE.Vector2(0.5, 0.5) },
        uActive: { value: 0 },
        uHighlight: { value: 0 },
        uOpacity: { value: 1 },
        uGhost: { value: ghost ? 1 : 0 },
        uTime: globalUniforms.uTime,
        uFocus: globalUniforms.uFocus,
        uFogColor: globalUniforms.uFogColor,
        uFogDensity: globalUniforms.uFogDensity,
      };
      const mat = new THREE.ShaderMaterial({ vertexShader: cardVert, fragmentShader: cardFrag, uniforms });
      this.materials.push(mat);
      return { mesh: new THREE.Mesh(this.geometry, mat), uniforms };
    };

    PROJECTS.forEach((p) => {
      const { mesh, uniforms } = make(p, false);
      mesh.userData.slug = p.slug;
      const base = new THREE.Object3D();
      this.group.add(mesh);
      this.cards.push({ project: p, mesh, uniforms, base, hover: 0, hoverTarget: 0 });
    });
    // background filler cards give the column depth (dim, non‑interactive)
    for (let i = 0; i < 12; i++) {
      const { mesh } = make(PROJECTS[(i * 5 + 3) % PROJECTS.length], true);
      this.ghosts.push(mesh);
      this.group.add(mesh);
    }
    this.layout();
  }

  /** Card positions adapt to aspect ratio (responsive 3D). */
  layout() {
    const portrait = state.viewport.aspect < 0.9;
    const span = ANCHOR.workTop - 6 - (ANCHOR.workBottom + 4);
    const step = span / PROJECTS.length;
    this.cards.forEach((c, i) => {
      const left = i % 2 === 0;
      const y = ANCHOR.workTop - 6 - i * step;
      const x = portrait ? (left ? -1.05 : 1.35) : left ? -2.55 : 2.85;
      const z = left ? 0.7 : -0.9;
      c.base.position.set(x, y, z);
      c.base.rotation.set(0.04 * (left ? 1 : -1), left ? 0.26 : -0.4, left ? -0.02 : 0.03);
      c.base.scale.setScalar(portrait ? 0.78 : 1);
      c.mesh.position.copy(c.base.position);
      c.mesh.quaternion.copy(c.base.quaternion);
      c.mesh.scale.copy(c.base.scale);
    });
    this.ghosts.forEach((g, i) => {
      const left = i % 2 === 1;
      const y = ANCHOR.workTop - 2 - i * (span / 12) - step * 0.5;
      g.position.set((left ? -1 : 1) * (portrait ? 2.2 : 4.6), y, -4.5 - (i % 3) * 1.4);
      g.rotation.set(0, left ? 0.5 : -0.55, 0);
      g.scale.setScalar(portrait ? 0.7 : 0.85);
    });
  }

  meshes() {
    return this.cards.map((c) => c.mesh);
  }

  /** Where the camera should sit to frame a card full‑screen‑ish (left panel stays readable). */
  focusFor(slug: string, outPos: THREE.Vector3, outTgt: THREE.Vector3) {
    const c = this.cards.find((k) => k.project.slug === slug);
    if (!c) return false;
    const portrait = state.viewport.aspect < 0.9;
    const n = this.tmpV.set(0, 0, 1).applyQuaternion(c.base.quaternion);
    const dist = portrait ? 7.4 : 4.9;
    outTgt.copy(c.base.position);
    outPos.copy(c.base.position).addScaledVector(n, dist);
    if (!portrait) {
      // shift framing so the card sits right of centre, leaving room for the info panel
      const right = this.tmpV.set(1, 0, 0).applyQuaternion(c.base.quaternion);
      outPos.addScaledVector(right, -1.15);
      outTgt.addScaledVector(right, -1.15);
    } else {
      outPos.y -= 0.9;
      outTgt.y -= 0.9;
    }
    return true;
  }

  update(dt: number, activeSlug: string | null, highlightCategory: string | null, hoveredSlug: string | null, pointerUv: THREE.Vector2) {
    const t = state.time;
    for (const c of this.cards) {
      c.hoverTarget = hoveredSlug === c.project.slug ? 1 : 0;
      c.hover = damp(c.hover, c.hoverTarget, 7, dt);
      c.uniforms.uHover.value = c.hover;
      if (c.hoverTarget) c.uniforms.uHoverUv.value.lerp(pointerUv, clamp(dt * 10));
      const active = activeSlug === c.project.slug ? 1 : 0;
      c.uniforms.uActive.value = damp(c.uniforms.uActive.value, active, 6, dt);
      const hl = highlightCategory && c.project.category === highlightCategory ? 1 : 0;
      c.uniforms.uHighlight.value = damp(c.uniforms.uHighlight.value, hl, 5, dt);
      // idle float + hover tilt toward the pointer
      const m = c.mesh;
      const seed = c.project.style;
      m.position.copy(c.base.position);
      m.position.y += Math.sin(t * 0.5 + seed) * 0.08;
      m.position.x += Math.sin(t * 0.35 + seed * 2.1) * 0.05;
      m.rotation.copy(c.base.rotation);
      m.rotation.y += (c.uniforms.uHoverUv.value.x - 0.5) * 0.18 * c.hover + Math.sin(t * 0.3 + seed) * 0.03;
      m.rotation.x += -(c.uniforms.uHoverUv.value.y - 0.5) * 0.14 * c.hover;
      m.scale.copy(c.base.scale).multiplyScalar(1 + c.hover * 0.025);
    }
  }
}

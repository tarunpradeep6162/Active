import * as THREE from 'three';
import { Emblem } from '../scenes/Emblem';
import { WorkSpine } from '../scenes/WorkSpine';
import { ProjectCards } from '../scenes/ProjectCards';
import { Lab } from '../scenes/Lab';
import { HexPortal } from '../scenes/HexPortal';
import { Backdrop } from '../scenes/Backdrop';
import { iridescentMaterial } from '../scenes/materials';
import { ParticleField, type FieldOptions } from '../particles/ParticleField';
import { Streaks } from '../particles/Streaks';
import { Nebula } from '../particles/Nebula';
import type { ParticleResult } from '../workers/particles.worker';
import { ANCHOR, rangeOf, workLocalForCard } from './journey';
import { globalUniforms } from './uniforms';
import { state, store, type SectionId } from '../core/state';
import { smoothstep, clamp, dampFactor } from '../utils/math';
import type { TierSettings } from '../core/Performance';
import { PROJECTS } from '../app/projects';

interface Palette {
  top: THREE.Color;
  bottom: THREE.Color;
  accent: THREE.Color;
  fog: THREE.Color;
  density: number;
  streaks: number;
  glowA: THREE.Color;
  glowB: THREE.Color;
}
const pal = (top: string, bottom: string, accent: string, fog: string, density: number, streaks: number, glowA: string, glowB: string): Palette => ({
  top: new THREE.Color(top),
  bottom: new THREE.Color(bottom),
  accent: new THREE.Color(accent),
  fog: new THREE.Color(fog),
  density,
  streaks,
  glowA: new THREE.Color(glowA),
  glowB: new THREE.Color(glowB),
});

const PALETTES: Record<SectionId, Palette> = {
  intro: pal('#0c1317', '#06080a', '#1a5e5b', '#090d10', 0.028, 0, '#1f6d68', '#10363d'),
  manifesto: pal('#1c2a4c', '#070a14', '#3a5ab0', '#0c1224', 0.03, 0.6, '#2f8f8a', '#23407a'),
  work: pal('#0e1520', '#1a0f30', '#4a3490', '#0d0b18', 0.02, 0, '#237a74', '#4a2c88'),
  lab: pal('#07090b', '#040506', '#3c0a16', '#060708', 0.06, 0, '#15403f', '#2a0b12'),
  portal: pal('#061110', '#030707', '#0f4a47', '#041010', 0.05, 0, '#16605a', '#0b2d2e'),
  outro: pal('#0c1317', '#06080a', '#1a5e5b', '#090d10', 0.028, 0, '#1f6d68', '#10363d'),
};
const ORDER: SectionId[] = ['intro', 'manifesto', 'work', 'lab', 'portal', 'outro'];

interface Piece {
  obj: THREE.Object3D;
  yTop: number;
  yBottom: number;
}

export class World {
  readonly scene = new THREE.Scene();
  readonly root = new THREE.Group();
  readonly backdrop = new Backdrop();
  readonly emblem = new Emblem(false);
  readonly outroEmblem = new Emblem(true);
  readonly spine = new WorkSpine();
  readonly cards: ProjectCards;
  readonly lab = new Lab();
  readonly portal: HexPortal;
  private manifestoRing: THREE.Mesh;
  private fields: Record<string, ParticleField> = {};
  private streaks: Streaks[] = [];
  private nebulae: Record<string, Nebula> = {};
  private pieces: Piece[] = [];
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private hitUv = new THREE.Vector2(0.5, 0.5);
  private invMat = new THREE.Matrix4();
  private localHit = new THREE.Vector3();
  private rayFrame = 0;
  hovered: string | null = null;
  activeSlug: string | null = null;
  highlight: string | null = null;
  private tmpA = new THREE.Color();
  private tmpB = new THREE.Color();

  private nebulaScale: number;

  constructor(particles: ParticleResult[], titles: Map<string, THREE.Texture>, settings: TierSettings) {
    this.nebulaScale = Math.max(0.35, settings.particleScale);
    this.scene.add(this.backdrop.mesh, this.root);
    this.cards = new ProjectCards(titles);
    this.portal = new HexPortal(settings.hexCount);

    // intro emblem
    this.root.add(this.emblem.group);
    this.add(this.emblem.group, 4, -12);

    // manifesto glass ring (edge‑on)
    // reference: a chunky, dark glass torus (thick tube), not a thin neon hoop
    this.manifestoRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.9, 0.52, 48, 160),
      iridescentMaterial({ base: '#0b0a12', envTop: '#9a98a8', envBottom: '#06070c', film: 0.25, glow: 0.08 }),
    );
    this.manifestoRing.position.set(0.55, ANCHOR.manifesto - 0.15, -0.4);
    this.manifestoRing.rotation.set(0, Math.PI / 2 - 0.1, 0);
    this.add(this.manifestoRing, ANCHOR.manifesto + 4, ANCHOR.manifesto - 4);

    this.add(this.spine.group, ANCHOR.workTop + 10, ANCHOR.workBottom - 8);
    this.add(this.cards.group, ANCHOR.workTop + 2, ANCHOR.workBottom - 4);
    this.add(this.lab.group, ANCHOR.lab + 4, ANCHOR.lab - 3);
    this.add(this.portal.group, ANCHOR.portal + 4, ANCHOR.portal - 4);

    this.outroEmblem.group.position.set(0, ANCHOR.outro, 0);
    this.add(this.outroEmblem.group, ANCHOR.outro + 12, ANCHOR.outro - 4);

    // particles
    const byId = new Map(particles.map((p) => [p.id, p]));
    const field = (id: string, o: FieldOptions, top: number, bottom: number) => {
      const d = byId.get(id);
      if (!d) return;
      const f = new ParticleField(d.position, d.seed, o);
      this.fields[id] = f;
      this.add(f.points, top, bottom);
    };
    field('embers', { colors: ['#ff6a1f', '#ff2b3d', '#ffc36b'], size: 3.4, turbulence: 0.25, speed: 0.35, drift: [0, 0.35, 0], puff: 0.06 }, 4, -8);
    field('storm', { colors: ['#ff4a1a', '#ff9a2e', '#ff2a5a'], size: 9, turbulence: 0.45, speed: 0.4, twinkle: 0.3, puff: 0.12 }, 4, -8);
    field('glitter', { colors: ['#e07ad8', '#9a82f0', '#d9a0e8'], size: 1.9, turbulence: 0.05, speed: 0.2, twinkle: 0.35 }, ANCHOR.workTop + 8, ANCHOR.workBottom - 8);
    field('blob', { colors: ['#ff1f4b', '#ff4a6a', '#ff8a5a'], size: 2.6, turbulence: 0.08, speed: 0.3 }, ANCHOR.lab + 4, ANCHOR.lab - 4);
    field('bubbles', { colors: ['#bfe8e6', '#ffffff', '#7fd6d0'], size: 2.2, turbulence: 0.08, speed: 0.2, drift: [0, 1.2, 0], opacity: 0.5 }, ANCHOR.portal + 4, ANCHOR.portal - 8);
    field('outroStorm', { colors: ['#ff4a1a', '#ff9a2e', '#ff2a5a'], size: 5.6, turbulence: 0.45, speed: 0.4, twinkle: 0.3, puff: 0.12 }, ANCHOR.outro + 4, ANCHOR.outro - 8);
    field('outroEmbers', { colors: ['#ff6a1f', '#ff2b3d', '#ffc36b'], size: 3.2, turbulence: 0.25, speed: 0.35, drift: [0, 0.35, 0] }, ANCHOR.outro + 4, ANCHOR.outro - 8);
    // foreground energy specks: few, large, hot — the brightest layer of each storm
    field('specks', { colors: ['#ffd27a', '#ffae3a', '#ff5a2a'], size: 7, turbulence: 0.35, speed: 0.5, twinkle: 0.6 }, 4, -8);
    field('outroSpecks', { colors: ['#ffd27a', '#ffae3a', '#ff5a2a'], size: 4.2, turbulence: 0.35, speed: 0.5, twinkle: 0.6 }, ANCHOR.outro + 4, ANCHOR.outro - 8);
    field('dust', { colors: ['#9fd8d8', '#ffffff', '#ff9a7a'], size: 1.1, turbulence: 0.2, speed: 0.2, twinkle: 0.8, opacity: 0.6 }, 10, ANCHOR.outro - 12);
    // dust is global: always visible
    this.pieces = this.pieces.filter((p) => p.obj !== this.fields.dust?.points);

    const s1 = new Streaks(14, -5, 1.5, 5, ['#ff2a55', '#ff4f7a', '#ff7a3a']);
    const s2 = new Streaks(14, ANCHOR.outro - 5, ANCHOR.outro + 1.5, 9, ['#ff2a55', '#ff4f7a', '#ff7a3a']);
    this.streaks.push(s1, s2);
    this.add(s1.mesh, 4, -8);
    this.add(s2.mesh, ANCHOR.outro + 4, ANCHOR.outro - 8);

    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const neb = (id: string, o: ConstructorParameters<typeof Nebula>[0], top: number, bottom: number) => {
      const nb = new Nebula({ ...o, count: Math.max(6, Math.round(o.count * this.nebulaScale)) });
      this.nebulae[id] = nb;
      this.add(nb.mesh, top, bottom);
    };
    const warm = ['#ff1840', '#ff3a1c', '#ff2a8a', '#c0102c'];
        neb('storm', { count: 60, seed: 12, center: V(0, -2.2, -0.8), spread: V(9, 2.8, 3), size: [2.5, 7], colors: warm, intensity: 0 }, 4, -8);
    neb('glitter', { count: 70, seed: 13, center: V(0, (ANCHOR.workTop + ANCHOR.workBottom) / 2, 0), spread: V(2.6, 52, 1.6), size: [1.5, 4], colors: ['#6a2bb0', '#a8327f', '#2a3aa6', '#1a6e84'], intensity: 0.14 }, ANCHOR.workTop + 8, ANCHOR.workBottom - 8);
    neb('lab', { count: 22, seed: 14, center: V(0, ANCHOR.lab + 0.2, 0), spread: V(1.1, 1.2, 1.1), size: [1.5, 3.5], colors: warm, intensity: 0.4 }, ANCHOR.lab + 4, ANCHOR.lab - 4);
    neb('outroStorm', { count: 50, seed: 15, center: V(0, ANCHOR.outro - 1.8, -0.8), spread: V(5.5, 2.8, 2.5), size: [2.5, 7], colors: warm, intensity: 0 }, ANCHOR.outro + 4, ANCHOR.outro - 8);
  }

  private add(obj: THREE.Object3D, yTop: number, yBottom: number) {
    if (!obj.parent) this.root.add(obj);
    this.pieces.push({ obj, yTop, yBottom });
  }

  /** Every material for pre‑compilation. */
  allVisible(on: boolean) {
    for (const p of this.pieces) p.obj.visible = on;
  }

  layout() {
    this.cards.layout();
    // reference spine reads ~20–25 % of the frame width behind the cards
    const girth = state.viewport.aspect < 0.9 ? 0.85 : 1.3;
    this.spine.group.scale.set(girth, 1, girth);
    this.spine.group.position.z = -0.5;
    const portrait = state.viewport.aspect < 0.9;
    this.manifestoRing.position.x = portrait ? 0.0 : 0.55;
    this.manifestoRing.scale.setScalar(portrait ? 0.8 : 1);
  }

  /** Journey progress where the camera faces card i. */
  progressForCard(slug: string) {
    const i = Math.max(0, PROJECTS.findIndex((p) => p.slug === slug));
    const r = rangeOf('work');
    return r.start + (r.end - r.start) * clamp(workLocalForCard(i));
  }

  private blendPalettes(dt: number, post: THREE.ShaderMaterial) {
    const i = ORDER.indexOf(state.section);
    const cur = PALETTES[state.section];
    const prev = PALETTES[ORDER[Math.max(0, i - 1)]];
    const next = PALETTES[ORDER[Math.min(ORDER.length - 1, i + 1)]];
    const lp = state.sectionProgress;
    // blend across the section boundaries
    let from = cur, to = cur, t = 0;
    // short sections blend over a wider share; the long work section switches quickly
    const win = state.section === 'work' ? 0.04 : 0.12;
    if (lp < win && i > 0) {
      from = prev;
      to = cur;
      t = 0.5 + 0.5 * smoothstep(0, win, lp);
    } else if (lp > 0.88 && i < ORDER.length - 1) {
      from = cur;
      to = next;
      t = 0.5 * smoothstep(0.88, 1, lp);
    }
    const k = dampFactor(4, dt);
    const b = this.backdrop.uniforms;
    b.uTop.value.lerp(this.tmpA.copy(from.top).lerp(to.top, t), k);
    b.uBottom.value.lerp(this.tmpA.copy(from.bottom).lerp(to.bottom, t), k);
    b.uAccent.value.lerp(this.tmpA.copy(from.accent).lerp(to.accent, t), k);
    b.uStreaks.value += (from.streaks + (to.streaks - from.streaks) * t - b.uStreaks.value) * k;
    globalUniforms.uFogColor.value.lerp(this.tmpB.copy(from.fog).lerp(to.fog, t), k);
    globalUniforms.uFogDensity.value += (from.density + (to.density - from.density) * t - globalUniforms.uFogDensity.value) * k;
    post.uniforms.uGlowA.value.lerp(this.tmpA.copy(from.glowA).lerp(to.glowA, t), k);
    post.uniforms.uGlowB.value.lerp(this.tmpA.copy(from.glowB).lerp(to.glowB, t), k);
  }

  private raycast(camera: THREE.Camera) {
    const p = state.pointer;
    const canHover = state.section === 'work' && state.focus < 0.01 && state.overlay < 0.01 && !p.isTouch && p.active;
    let hit: string | null = null;
    if (canHover) {
      this.ndc.set(p.x, p.y);
      this.raycaster.setFromCamera(this.ndc, camera);
      const hits = this.raycaster.intersectObjects(this.cards.meshes(), false);
      if (hits.length) {
        hit = hits[0].object.userData.slug as string;
        this.invMat.copy(hits[0].object.matrixWorld).invert();
        this.localHit.copy(hits[0].point).applyMatrix4(this.invMat);
        this.hitUv.set(this.localHit.x / 4.4 + 0.5, this.localHit.y / 3.4 + 0.5);
      }
    }
    if (hit !== this.hovered) {
      this.hovered = hit;
      store.set({ hoveredProject: hit });
      document.documentElement.classList.toggle('hovering-card', !!hit);
    }
  }

  /** Tap / click picking (touch has no hover). */
  pick(clientX: number, clientY: number, camera: THREE.Camera): string | null {
    if (state.section !== 'work') return null;
    this.ndc.set((clientX / state.viewport.width) * 2 - 1, -(clientY / state.viewport.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, camera);
    const hits = this.raycaster.intersectObjects(this.cards.meshes(), false);
    return hits.length ? (hits[0].object.userData.slug as string) : null;
  }

  update(dt: number, camera: THREE.PerspectiveCamera, pointerWorld: THREE.Vector3, post: THREE.ShaderMaterial) {
    const t = state.time;
    // cull set pieces far from the camera's vertical position
    const cy = camera.position.y;
    for (const p of this.pieces) p.obj.visible = cy < p.yTop + 22 && cy > p.yBottom - 22;

    this.blendPalettes(dt, post);

    const intro = state.section === 'intro' ? state.sectionProgress : state.scroll.progress > rangeOf('intro').end ? 1 : 0;
    this.emblem.update(t, state.reveal, state.pointer.targetX, state.pointer.targetY, smoothstep(0.05, 0.6, intro) * Math.PI);
    const outroLocal = state.section === 'outro' ? state.sectionProgress : 0;
    this.outroEmblem.update(t, smoothstep(0.15, 0.6, outroLocal), state.pointer.targetX, state.pointer.targetY);

    // intro eruption
    const embers = this.fields.embers;
    if (embers) {
      embers.uniforms.uBurst.value = smoothstep(0.18, 0.6, intro) * 3.2;
      embers.uniforms.uPointerWorld.value.copy(pointerWorld);
      embers.uniforms.uPointerStrength.value = 0.9;
    }
    // storms erupt around each emblem as its section scrolls (reference: 25–90 % of the intro)
    const introStorm = smoothstep(0.2, 0.55, intro) * (1 - smoothstep(0.88, 0.97, intro));
    const outroStorm = smoothstep(0.02, 0.2, outroLocal) * (1 - smoothstep(0.5, 0.78, outroLocal));
    this.setStorm('storm', 0, introStorm);
    this.setStorm('outroStorm', 1, outroStorm);
    const oe = this.fields.outroEmbers;
    if (oe) {
      oe.uniforms.uBurst.value = (1 - smoothstep(0.3, 0.8, outroLocal)) * 3.2;
      oe.uniforms.uBurstCenter.value.set(0, ANCHOR.outro, 0);
    }
    for (const id of ['storm', 'glitter', 'blob', 'outroStorm', 'dust']) {
      const f = this.fields[id];
      if (!f) continue;
      f.uniforms.uPointerWorld.value.copy(pointerWorld);
      f.uniforms.uPointerStrength.value = id === 'dust' ? 0.4 : 0.8;
    }
    if (this.fields.blob) this.fields.blob.uniforms.uBurstCenter.value.set(0, ANCHOR.lab, 0);

    const man = state.section === 'manifesto' ? state.sectionProgress : state.scroll.progress > rangeOf('manifesto').end ? 1 : 0;
    this.manifestoRing.rotation.y = Math.PI / 2 - 0.1 - smoothstep(0.05, 0.7, man) * 0.95 + Math.sin(t * 0.25) * 0.06 + state.pointer.targetX * 0.08;
    this.manifestoRing.rotation.x = Math.sin(t * 0.2) * 0.04;

    this.spine.update(t);
    this.lab.update(t);
    if (++this.rayFrame % 2 === 0) this.raycast(camera);
    this.cards.update(dt, this.activeSlug, this.highlight, this.hovered, this.hitUv);
  }

  private setStorm(id: 'storm' | 'outroStorm', streak: number, amount: number) {
    const on = amount > 0.004;
    const sp = this.fields[id === 'storm' ? 'specks' : 'outroSpecks'];
    if (sp) {
      sp.uniforms.uOpacity.value = amount;
      sp.points.visible &&= on;
    }
    const f = this.fields[id];
    if (f) {
      f.points.visible &&= on;
      f.uniforms.uOpacity.value = amount;
      f.uniforms.uBurst.value = amount * 0.35;
      f.uniforms.uBurstCenter.value.set(0, id === 'storm' ? ANCHOR.intro : ANCHOR.outro, 0);
    }
    const n = this.nebulae[id];
    if (n) {
      n.mesh.visible &&= on;
      n.uniforms.uIntensity.value = amount * 0.34;
      n.uniforms.uBurst.value = amount * 1.5;
    }
    this.streaks[streak].uniforms.uIntensity.value = amount;
    this.streaks[streak].mesh.visible &&= on;
  }

  setParticleScale(visibleFraction: number) {
    for (const n of Object.values(this.nebulae)) {
      const full = (n.mesh.userData.full ??= n.mesh.count) as number;
      n.mesh.count = Math.max(4, Math.floor(full * visibleFraction));
    }
    for (const f of Object.values(this.fields)) {
      const g = f.points.geometry;
      const n = g.getAttribute('position').count;
      g.setDrawRange(0, Math.floor(n * visibleFraction));
    }
  }
}

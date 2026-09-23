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
import type { ParticleResult } from '../workers/particles.worker';
import { ANCHOR, rangeOf } from './journey';
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
  manifesto: pal('#131b3a', '#06070f', '#2a3c96', '#0a0d1c', 0.03, 1, '#1d3f7a', '#1a2a55'),
  work: pal('#0b1117', '#150c26', '#3b2a7d', '#0d0b18', 0.026, 0, '#1b6663', '#3a2470'),
  lab: pal('#07090b', '#040506', '#3c0a16', '#060708', 0.045, 0, '#15403f', '#2a0b12'),
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

  constructor(particles: ParticleResult[], titles: Map<string, THREE.Texture>, settings: TierSettings) {
    this.scene.add(this.backdrop.mesh, this.root);
    this.cards = new ProjectCards(titles);
    this.portal = new HexPortal(settings.hexCount);

    // intro emblem
    this.root.add(this.emblem.group);
    this.add(this.emblem.group, 4, -12);

    // manifesto glass ring (edge‑on)
    this.manifestoRing = new THREE.Mesh(
      new THREE.TorusGeometry(3.1, 0.3, 40, 160),
      iridescentMaterial({ base: '#140a26', envTop: '#d2c6ff', envBottom: '#10143a', film: 1.5, glow: 1.2 }),
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
    field('embers', { colors: ['#ff6a1f', '#ff2b3d', '#ffc36b'], size: 2.4, turbulence: 0.25, speed: 0.35, drift: [0, 0.35, 0], puff: 0.06 }, 4, -8);
    field('storm', { colors: ['#ff1f4b', '#ff5a2a', '#ff6ad0'], size: 3.2, turbulence: 0.45, speed: 0.4, twinkle: 0.3, puff: 0.12 }, -1, -28);
    field('glitter', { colors: ['#ff6fd8', '#8f7bff', '#6fe8ff'], size: 2.3, turbulence: 0.12, speed: 0.25, twinkle: 0.7, puff: 0.05 }, ANCHOR.workTop + 8, ANCHOR.workBottom - 8);
    field('blob', { colors: ['#ff1f4b', '#ff6a8a', '#ffb36b'], size: 2.6, turbulence: 0.35, speed: 0.5, puff: 0.1 }, ANCHOR.lab + 4, ANCHOR.lab - 4);
    field('bubbles', { colors: ['#bfe8e6', '#ffffff', '#7fd6d0'], size: 2.2, turbulence: 0.08, speed: 0.2, drift: [0, 1.2, 0], opacity: 0.5 }, ANCHOR.portal + 4, ANCHOR.portal - 8);
    field('outroStorm', { colors: ['#ff1f4b', '#ff5a2a', '#ff6ad0'], size: 3.2, turbulence: 0.45, speed: 0.4, twinkle: 0.3, puff: 0.12 }, ANCHOR.outro + 24, ANCHOR.outro);
    field('outroEmbers', { colors: ['#ff6a1f', '#ff2b3d', '#ffc36b'], size: 2.1, turbulence: 0.25, speed: 0.35, drift: [0, 0.35, 0] }, ANCHOR.outro + 4, ANCHOR.outro - 8);
    field('dust', { colors: ['#9fd8d8', '#ffffff', '#ff9a7a'], size: 1.1, turbulence: 0.2, speed: 0.2, twinkle: 0.8, opacity: 0.6 }, 10, ANCHOR.outro - 12);
    const dust = this.fields.dust;
    if (dust) this.pieces.pop(); // dust is global: always visible

    const s1 = new Streaks(26, -24, -4, 5, ['#ff2a55', '#ff4f7a', '#ff7a3a']);
    const s2 = new Streaks(22, ANCHOR.outro + 4, ANCHOR.outro + 22, 9, ['#ff2a55', '#ff4f7a', '#ff7a3a']);
    this.streaks.push(s1, s2);
    this.add(s1.mesh, -2, -26);
    this.add(s2.mesh, ANCHOR.outro + 24, ANCHOR.outro + 2);
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
    const portrait = state.viewport.aspect < 0.9;
    this.manifestoRing.position.x = portrait ? 0.0 : 0.55;
    this.manifestoRing.scale.setScalar(portrait ? 0.8 : 1);
  }

  /** Journey progress where the camera faces card i. */
  progressForCard(slug: string) {
    const i = PROJECTS.findIndex((p) => p.slug === slug);
    const c = this.cards.cards[i];
    if (!c) return rangeOf('work').start;
    const y = c.base.position.y;
    const yTop = ANCHOR.workTop - 3, yBot = ANCHOR.workBottom;
    const local = clamp(0.02 + 0.96 * ((y + 0.2 - yTop) / (yBot - yTop)));
    const r = rangeOf('work');
    return r.start + (r.end - r.start) * local;
  }

  private blendPalettes(dt: number, post: THREE.ShaderMaterial) {
    const i = ORDER.indexOf(state.section);
    const cur = PALETTES[state.section];
    const prev = PALETTES[ORDER[Math.max(0, i - 1)]];
    const next = PALETTES[ORDER[Math.min(ORDER.length - 1, i + 1)]];
    const lp = state.sectionProgress;
    // blend across the section boundaries
    let from = cur, to = cur, t = 0;
    if (lp < 0.12 && i > 0) {
      from = prev;
      to = cur;
      t = 0.5 + 0.5 * smoothstep(0, 0.12, lp);
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
    this.emblem.update(t, state.reveal, state.pointer.targetX, state.pointer.targetY, intro * 0.8);
    const outroLocal = state.section === 'outro' ? state.sectionProgress : 0;
    this.outroEmblem.update(t, smoothstep(0.35, 0.9, outroLocal), state.pointer.targetX, state.pointer.targetY);

    // intro eruption
    const embers = this.fields.embers;
    if (embers) {
      embers.uniforms.uBurst.value = smoothstep(0.18, 0.6, intro) * 3.2;
      embers.uniforms.uPointerWorld.value.copy(pointerWorld);
      embers.uniforms.uPointerStrength.value = 0.9;
    }
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

    this.manifestoRing.rotation.y = Math.PI / 2 - 0.1 + Math.sin(t * 0.25) * 0.06 + state.pointer.targetX * 0.08;
    this.manifestoRing.rotation.x = Math.sin(t * 0.2) * 0.04;

    this.spine.update(t);
    this.lab.update(t);
    if (++this.rayFrame % 2 === 0) this.raycast(camera);
    this.cards.update(dt, this.activeSlug, this.highlight, this.hovered, this.hitUv);
  }

  setParticleScale(visibleFraction: number) {
    for (const f of Object.values(this.fields)) {
      const g = f.points.geometry;
      const n = g.getAttribute('position').count;
      g.setDrawRange(0, Math.floor(n * visibleFraction));
    }
  }
}

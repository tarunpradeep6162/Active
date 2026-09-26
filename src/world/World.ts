import * as THREE from 'three';
import { Emblem } from '../scenes/Emblem';
import { TulipGarden } from '../scenes/TulipGarden';
import { getProgress } from '../birthday/progress';
import { ProjectCards } from '../scenes/ProjectCards';
import { Lab } from '../scenes/Lab';
import { GardenSky } from '../scenes/GardenSky';
import { StarSky } from '../scenes/StarSky';
import { PetalWreath } from '../scenes/PetalWreath';
import { LanternSky } from '../scenes/LanternSky';
import { Constellation } from '../scenes/Constellation';
import { getContent } from '../birthday/vault';
import { Backdrop } from '../scenes/Backdrop';
import { ParticleField, type FieldOptions } from '../particles/ParticleField';
import { Streaks } from '../particles/Streaks';
import { Nebula } from '../particles/Nebula';
import type { ParticleResult } from '../workers/particles.worker';
import { ANCHOR, rangeOf } from './journey';
import { workTimeline } from '../work/WorkTimeline';
import { globalUniforms } from './uniforms';
import { state, store, events, type SectionId } from '../core/state';
import { smoothstep, clamp, dampFactor } from '../utils/math';
import type { TierSettings } from '../core/Performance';
import { PROJECTS } from '../app/projects';
import { CARD_W, CARD_H } from '../scenes/ProjectCards';
import { FireflyGuide } from '../scenes/FireflyGuide';

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
  // one night, midnight → rose → champagne → sunrise (the colour journey of the whole site)
  intro: pal('#0b1020', '#070914', '#2a2448', '#080a16', 0.028, 0, '#2a3160', '#3a2040'),
  // the garden's threshold: midnight with the first rose light
  manifesto: pal('#11162a', '#070914', '#4a2a48', '#0a0c18', 0.03, 0.25, '#6a3a5a', '#1c2c4a'),
  // the garden at night (top of Work) …
  work: pal('#0b0d1f', '#07060f', '#2a2458', '#0a0b16', 0.02, 0, '#2a3a6a', '#4a2a5a'),
  // the cake room: candle warmth
  lab: pal('#120c14', '#070508', '#4a1a2a', '#0a070c', 0.06, 0, '#6a3a2a', '#3a1424'),
  // the lantern sky: deep night with golden lights
  portal: pal('#0b1020', '#05060e', '#2a2440', '#070914', 0.012, 0, '#8a6a3a', '#2a2448'),
  // the finale sky (the sunrise is layered on top as it plays)
  outro: pal('#11162a', '#070914', '#3a2a50', '#090b18', 0.01, 0, '#d98b9d', '#d6b46a'),
};
/** … and at sunset (bottom of Work): the light warms as she descends through the garden */
const WORK_SUNSET = pal('#2a1622', '#0d0708', '#9a4a2a', '#170c12', 0.02, 0, '#c8844a', '#b04a66');
const WORK_NOW = pal('#000', '#000', '#000', '#000', 0, 0, '#000', '#000');
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
  /** the living tulip garden at the heart of the Work world (replaced the old column) */
  readonly garden: TulipGarden;
  /** 0…1 final pull‑back: every flower in bloom (driven by the finale) */
  gardenReveal = 0;
  readonly cards: ProjectCards;
  readonly lab = new Lab();
  /** the garden's sky, horizon and foreground bokeh */
  readonly gardenSky: GardenSky;
  /** the opening's night sky (emblem and threshold) */
  readonly starSky = new StarSky();
  readonly portal: LanternSky;
  readonly finaleSky: Constellation;
  /** the firefly that leads her to the next chapter */
  readonly guide = new FireflyGuide();
  private manifestoRing: THREE.Group;
  private wreath: PetalWreath;
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
  private visited: boolean[] = [];
  private tmpHead = new THREE.Vector3();
  private lanternHover = false;

  constructor(particles: ParticleResult[], titles: Map<string, THREE.Texture>, settings: TierSettings) {
    this.nebulaScale = Math.max(0.35, settings.particleScale);
    this.scene.add(this.backdrop.mesh, this.root);
    this.cards = new ProjectCards(titles);
    this.garden = new TulipGarden(titles, PROJECTS.map((p) => p.slug), settings.particleScale < 0.7);
    this.gardenSky = new GardenSky(settings.particleScale < 0.7);
    this.scene.add(this.gardenSky.sky, this.gardenSky.bokeh, this.starSky.mesh, this.guide.points);
    this.portal = new LanternSky(settings.hexCount);
    this.finaleSky = new Constellation(getContent().name, getContent().date, settings.particleScale);

    // intro emblem
    this.root.add(this.emblem.group);
    this.add(this.emblem.group, 4, -12);

    // the threshold: a wreath of tulip petals (was a glass ring), edge‑on at first
    this.wreath = new PetalWreath(settings.particleScale < 0.7);
    this.manifestoRing = this.wreath.group;
    // camera‑attached (see placeManifestoRing): part of the headline layer over the work scene
    this.manifestoRing.frustumCulled = false;
    this.root.add(this.manifestoRing);

    this.add(this.garden.group, ANCHOR.workTop + 10, ANCHOR.workBottom - 8);
    // the chapter cards stay as invisible anchors (camera framing, hover, taps); the chapter
    // tulips stand in their place
    this.root.add(this.cards.group);
    this.cards.group.visible = false;
    this.layoutGarden();
    this.add(this.lab.group, ANCHOR.lab + 4, ANCHOR.lab - 3);
    this.add(this.portal.group, ANCHOR.portal + 6, ANCHOR.portal - 18);

    // the finale sky: stars that become the date, then her name (the emblem stays at the start)
    this.add(this.finaleSky.group, ANCHOR.outro + 12, ANCHOR.outro - 6);
    this.add(this.finaleSky.extras, ANCHOR.outro + 12, ANCHOR.outro - 6);

    // particles
    const byId = new Map(particles.map((p) => [p.id, p]));
    const field = (id: string, o: FieldOptions, top: number, bottom: number) => {
      const d = byId.get(id);
      if (!d) return;
      const f = new ParticleField(d.position, d.seed, o);
      this.fields[id] = f;
      this.add(f.points, top, bottom);
    };
    field('embers', { colors: ['#e6c989', '#e8a6b5', '#f8f1e8'], size: 3.4, turbulence: 0.25, speed: 0.35, drift: [0, 0.35, 0], puff: 0.06 }, 4, -8);
    field('storm', { colors: ['#d98b9d', '#e6c989', '#f2c1cb'], size: 9, turbulence: 0.45, speed: 0.4, twinkle: 0.3, puff: 0.12 }, 4, -8);
    // golden motes and dew light drifting through the garden
    field('glitter', { colors: ['#ffd9a0', '#ffb7c5', '#fff1d6'], size: 1.5, turbulence: 0.05, speed: 0.2, twinkle: 0.45, opacity: 0.8 }, ANCHOR.workTop + 8, ANCHOR.workBottom - 8);
    // the red mass inside the cage is now a faint aura behind the cake
    field('blob', { colors: ['#e8a6b5', '#e6c989', '#f2c1cb'], size: 1.4, turbulence: 0.08, speed: 0.3, opacity: 0.35 }, ANCHOR.lab + 4, ANCHOR.lab - 4);
    field('bubbles', { colors: ['#f3dfa7', '#f8f1e8', '#e6c989'], size: 2.2, turbulence: 0.08, speed: 0.2, drift: [0, 1.2, 0], opacity: 0.5 }, ANCHOR.portal + 4, ANCHOR.portal - 8);
    field('outroStorm', { colors: ['#f8f1e8', '#f3dfa7', '#f2c1cb'], size: 5.6, turbulence: 0.45, speed: 0.4, twinkle: 0.3, puff: 0.12 }, ANCHOR.outro + 4, ANCHOR.outro - 8);
    field('outroEmbers', { colors: ['#e6c989', '#e8a6b5', '#f8f1e8'], size: 3.2, turbulence: 0.25, speed: 0.35, drift: [0, 0.35, 0] }, ANCHOR.outro + 4, ANCHOR.outro - 8);
    // foreground energy specks: few, large, hot — the brightest layer of each storm
    field('specks', { colors: ['#f3dfa7', '#e6c989', '#e8a6b5'], size: 7, turbulence: 0.35, speed: 0.5, twinkle: 0.6 }, 4, -8);
    field('outroSpecks', { colors: ['#f3dfa7', '#e6c989', '#e8a6b5'], size: 4.2, turbulence: 0.35, speed: 0.5, twinkle: 0.6 }, ANCHOR.outro + 4, ANCHOR.outro - 8);
    field('dust', { colors: ['#f2c1cb', '#f8f1e8', '#e6c989'], size: 1.1, turbulence: 0.2, speed: 0.2, twinkle: 0.35, opacity: 0.38 }, 10, ANCHOR.outro - 12);
    // dust is global: always visible
    this.pieces = this.pieces.filter((p) => p.obj !== this.fields.dust?.points);

    const s1 = new Streaks(14, -5, 1.5, 5, ['#e8a6b5', '#e6c989', '#f2c1cb']);
    const s2 = new Streaks(14, ANCHOR.outro - 5, ANCHOR.outro + 1.5, 9, ['#e8a6b5', '#e6c989', '#f2c1cb']);
    this.streaks.push(s1, s2);
    this.add(s1.mesh, 4, -8);
    this.add(s2.mesh, ANCHOR.outro + 4, ANCHOR.outro - 8);

    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const neb = (id: string, o: ConstructorParameters<typeof Nebula>[0], top: number, bottom: number) => {
      const nb = new Nebula({ ...o, count: Math.max(6, Math.round(o.count * this.nebulaScale)) });
      this.nebulae[id] = nb;
      this.add(nb.mesh, top, bottom);
    };
    // rose / champagne haze (was a red studio storm)
    const warm = ['#8a3a5a', '#b06a7a', '#a0784a', '#5a2a4a'];
        neb('storm', { count: 60, seed: 12, center: V(0, -2.2, -0.8), spread: V(9, 2.8, 3), size: [2.5, 7], colors: warm, intensity: 0 }, 4, -8);
    neb('glitter', { count: 70, seed: 13, center: V(0, (ANCHOR.workTop + ANCHOR.workBottom) / 2, 0), spread: V(2.6, 52, 1.6), size: [1.5, 4], colors: ['#3a2a6a', '#8a3a5a', '#b0683a', '#2a2a5a'], intensity: 0.12 }, ANCHOR.workTop + 8, ANCHOR.workBottom - 8);
    neb('lab', { count: 22, seed: 14, center: V(0, ANCHOR.lab + 0.6, -1.2), spread: V(1.6, 1.4, 0.8), size: [1.5, 3.5], colors: warm, intensity: 0.18 }, ANCHOR.lab + 4, ANCHOR.lab - 4);
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
    this.layoutGarden();
  }

  private guideTgt = new THREE.Vector3();
  private restM: THREE.Matrix4[] = [];
  private layoutGarden() {
    this.restM = this.cards.cards.map((c, i) => (this.restM[i] ?? new THREE.Matrix4()).compose(c.base.position, c.base.quaternion, c.base.scale));
    this.garden.layoutChapters(this.restM);
    this.garden.setHeightMap((y) => workTimeline.progressAtHeight(y));
  }

  private ringQ = new THREE.Quaternion();
  private ringV = new THREE.Vector3();
  /**
   * Headline ring (measured, clean settle): it does NOT scroll with the headline — it holds near
   * the frame centre (≈49 % across, ≈50 % down) at ≈68 % of the frame height, opens from edge‑on
   * (before the section) through a ¾ view (m = 0) toward face‑on, and dissolves at m ≈ 0.62–0.8
   * while card 0 and the column arrive.
   */
  private placeManifestoRing(camera: THREE.PerspectiveCamera, man: number) {
    const ring = this.manifestoRing;
    ring.visible = man > -0.35 && man < 1.05;
    if (!ring.visible) return;
    const d = 3.8;
    const visH = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const portrait = state.viewport.aspect < 0.9;
    // phone (measured): ≈ screen‑width ring centred near 45 % of the height, gone by m 0.75
    const centreVh = portrait ? 45 : 50;
    ring.position.copy(camera.position)
      .addScaledVector(this.ringV.set(0, 0, -1).applyQuaternion(camera.quaternion), d)
      .addScaledVector(this.ringV.set(0, 1, 0).applyQuaternion(camera.quaternion), (0.5 - centreVh / 100) * visH)
      .addScaledVector(this.ringV.set(1, 0, 0).applyQuaternion(camera.quaternion), (portrait ? 0 : 0.05) * visH * state.viewport.aspect);
    // outer diameter (2 × (2.9 + 0.52)) ≈ 68 % of the frame height
    const visW = visH * state.viewport.aspect;
    ring.scale.setScalar(portrait ? (0.48 * visW) / 3.42 : (0.34 * visH) / 3.42);
    const fade = portrait ? 1 - smoothstep(0.62, 0.75, man) : 1 - smoothstep(0.62, 0.8, man);
    ring.visible = fade > 0.001;
    this.wreath.setOpacity(fade);
    // edge‑on before the section → ¾ at m = 0 → nearly face‑on by m ≈ 0.7
    const open = THREE.MathUtils.clamp(1 - man * (man < 0 ? 2.5 : 1), 0.05, Math.PI / 2 - 0.1) + Math.sin(state.time * 0.25) * 0.05 + state.pointer.targetX * 0.08;
    ring.quaternion.copy(camera.quaternion).multiply(this.ringQ.setFromAxisAngle(this.ringV.set(0, 1, 0), open));
  }

  /** Journey progress where the camera faces card i. */
  progressForCard(slug: string) {
    const i = Math.max(0, PROJECTS.findIndex((p) => p.slug === slug));
    const r = rangeOf('work');
    // measured: the progress at which the reference camera faces card i
    return r.start + (r.end - r.start) * clamp(workTimeline.cardCentre(i));
  }

  private blendPalettes(dt: number, post: THREE.ShaderMaterial) {
    const i = ORDER.indexOf(state.section);
    let cur = PALETTES[state.section];
    if (state.section === 'work') {
      const w = smoothstep(0.05, 0.9, state.sectionProgress);
      for (const k of ['top', 'bottom', 'accent', 'fog', 'glowA', 'glowB'] as const) WORK_NOW[k].copy(PALETTES.work[k]).lerp(WORK_SUNSET[k], w);
      WORK_NOW.density = PALETTES.work.density;
      WORK_NOW.streaks = 0;
      cur = WORK_NOW;
    }
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
        this.hitUv.set(this.localHit.x / CARD_W + 0.5, this.localHit.y / CARD_H + 0.5);
      }
    }
    // the locked cage is touchable too
    const cageHover = !p.isTouch && p.active && !this.lab.isOpen && state.section === 'lab' && state.focus < 0.01 && this.pickCageAt(p.x, p.y, camera);
    // …and so are the wish lanterns in the sky
    const lanternHover = !p.isTouch && p.active && state.section === 'portal' && state.focus < 0.01 && this.rayFrame % 4 === 0 ? this.pickLantern(((p.x + 1) / 2) * state.viewport.width, ((1 - p.y) / 2) * state.viewport.height, camera) >= 0 : this.lanternHover;
    this.lanternHover = lanternHover;
    document.documentElement.classList.toggle('hovering-cage', cageHover || lanternHover);
    if (hit !== this.hovered) {
      this.hovered = hit;
      store.set({ hoveredProject: hit });
      document.documentElement.classList.toggle('hovering-card', !!hit);
    }
  }

  private pickCageAt(nx: number, ny: number, camera: THREE.Camera) {
    this.ndc.set(nx, ny);
    this.raycaster.setFromCamera(this.ndc, camera);
    return this.raycaster.intersectObjects(this.lab.pickables, false).length > 0;
  }

  /** True when a tap at this point hits the locked cage or the cake inside it. */
  pickCage(clientX: number, clientY: number, camera: THREE.Camera) {
    if (this.lab.isOpen || (state.section !== 'lab' && state.section !== 'portal')) return false;
    this.ndc.set((clientX / state.viewport.width) * 2 - 1, -(clientY / state.viewport.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, camera);
    return this.raycaster.intersectObjects(this.lab.pickables, false).length > 0;
  }

  /** The wish lantern under this point in the lantern sky, or −1. */
  pickLantern(clientX: number, clientY: number, camera: THREE.Camera) {
    if (state.section !== 'portal') return -1;
    this.ndc.set((clientX / state.viewport.width) * 2 - 1, -(clientY / state.viewport.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, camera);
    const hit = this.raycaster.intersectObject(this.portal.wishMesh, false)[0];
    return hit?.instanceId ?? -1;
  }

  /** Let wish lantern i go and tell the page where it is on screen (for its words). */
  releaseLantern(i: number, camera: THREE.Camera) {
    if (i < 0 || !this.portal.release(i)) return false;
    const v = this.portal.wishPosition(i, this.tmpHead).project(camera);
    events.emit('lanternWish', { index: i, x: (v.x * 0.5 + 0.5) * state.viewport.width, y: (-v.y * 0.5 + 0.5) * state.viewport.height });
    return true;
  }

  private waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  /** A touch on the lake (lantern sky or finale): a ring spreads from it. */
  touchWater(clientX: number, clientY: number, camera: THREE.Camera) {
    const lake = state.section === 'portal' ? this.portal.lake : state.section === 'outro' ? this.finaleSky.lake : null;
    if (!lake) return false;
    this.ndc.set((clientX / state.viewport.width) * 2 - 1, -(clientY / state.viewport.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, camera);
    this.waterPlane.constant = -lake.waterY;
    const hit = this.raycaster.ray.intersectPlane(this.waterPlane, this.tmpHead);
    if (!hit || hit.distanceTo(camera.position) > 80) return false;
    lake.ripple(hit.x, hit.z, 1.2);
    return true;
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
    // below the lab floor the rig is out of the story; keep its props from peeking into the sky
    if (cy < ANCHOR.lab - 4.5) this.lab.group.visible = false;
    // the garden draws nothing before it starts to grow or once it has fully dissolved into the
    // lab (unless a chapter or the finale reveal needs it): skip its ~50k triangles there
    {
      const wr0 = rangeOf('work');
      const w0 = (state.scroll.progress - wr0.start) / (wr0.end - wr0.start);
      const front = workTimeline.spineFront(w0);
      const gone = workTimeline.spineDissolve(w0) >= 0.999 && state.focus < 0.001 && this.gardenReveal < 0.001 && !this.activeSlug;
      // desktop: before work −0.05 the growth front sits 20 units below the garden (nothing shows)
      if ((front !== null && w0 <= -0.05) || gone) this.garden.group.visible = false;
    }

    this.blendPalettes(dt, post);

    const intro = state.section === 'intro' ? state.sectionProgress : state.scroll.progress > rangeOf('intro').end ? 1 : 0;
    if (this.emblem.group.visible) this.emblem.update(t, state.reveal, state.pointer.targetX, state.pointer.targetY, smoothstep(0.05, 0.6, intro) * Math.PI);
    const outroLocal = state.section === 'outro' ? state.sectionProgress : 0;
    this.finaleSky.update(outroLocal, camera, state.viewport.dpr);
    state.finaleLocal = outroLocal;
    state.nameHalfPx = this.finaleSky.nameHalfPx;

    // intro eruption
    const embers = this.fields.embers;
    if (embers) {
      embers.uniforms.uBurst.value = smoothstep(0.18, 0.6, intro) * 3.2;
      embers.uniforms.uPointerWorld.value.copy(pointerWorld);
      embers.uniforms.uPointerStrength.value = 0.9;
    }
    // storms erupt around each emblem as its section scrolls (reference: 25–90 % of the intro)
    const introStorm = smoothstep(0.2, 0.55, intro) * (1 - smoothstep(0.88, 0.97, intro));
    // closing storm keyed to the whole portal→end span so phones (shorter last section) match
    const tail = clamp((state.scroll.progress - rangeOf('portal').start) / (1 - rangeOf('portal').start));
    const outroStorm = smoothstep(0.3, 0.5, tail) * (1 - smoothstep(0.78, 0.92, tail));
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

    const mr = rangeOf('manifesto');
    this.placeManifestoRing(camera, (state.scroll.progress - mr.start) / (mr.end - mr.start));

    // measured entry seam: column sweep + card 0 rise, both pure functions of work progress
    const wr = rangeOf('work');
    const wt = (state.scroll.progress - wr.start) / (wr.end - wr.start);
    this.garden.setReveal(workTimeline.spineFront(wt));
    this.cards.setEntry(workTimeline.card0Entry(wt));
    // an open chapter (and the finale's reveal) always sees the whole garden
    this.garden.setCrumble(workTimeline.spineDissolve(wt) * (1 - clamp(state.focus + this.gardenReveal)));
    // the opening's night, handing over to the garden's own sky as she enters it
    this.starSky.update(camera, state.reveal * (1 - smoothstep(-0.07, 0.02, wt)), smoothstep(0, 0.4, intro) * (1 - smoothstep(0.7, 1, intro)) + (state.section === 'intro' ? 0.6 : 0));
    // the sky behind the garden: there while the garden is, gone with it into the cake room
    const skyAmt = Math.max(smoothstep(-0.05, 0.04, wt) * (1 - workTimeline.spineDissolve(wt)), this.gardenReveal) * (1 - clamp(state.focus * 1.5));
    this.gardenSky.update(camera, skyAmt, clamp(0.1 + wt * 0.95) * (1 - this.gardenReveal) + this.gardenReveal, state.viewport.dpr);
    // the night lake under the lanterns: there once the camera has come down into their sky
    const lp = state.section === 'portal' ? state.sectionProgress : state.section === 'outro' ? 1 : 0;
    this.portal.lake.update(camera, smoothstep(0.04, 0.16, lp) * (1 - smoothstep(0.88, 0.98, lp)), 0, state.rain);
    if (state.section === 'portal' || state.section === 'lab' || state.section === 'outro') {
      this.portal.update(t, state.viewport.dpr);
      state.starsLit = this.portal.starsLit;
    }
    this.lab.blow = state.cakeBlow;
    // off‑screen worlds don't need their per‑frame CPU work (instance matrices, raycasts)
    if (this.lab.group.visible || this.lab.isOpen) this.lab.update(t, state.viewport.dpr);
    state.cakeReady = this.lab.candlesReady;
    state.cageOpen = this.lab.isOpen;
    state.cakeDark = this.lab.dark;
    state.labDolly = this.lab.dolly;
    if (++this.rayFrame % 2 === 0) this.raycast(camera);
    // the guide: ahead to the next chapter she hasn't reached
    {
      let next = -1;
      for (let i = 0; i < PROJECTS.length; i++) if (workTimeline.cardCentre(i) > wt + 0.004 && (next < 0 || workTimeline.cardCentre(i) < workTimeline.cardCentre(next))) next = i;
      let seen = 0;
      if (next >= 0) {
        this.garden.chapterHead(next, this.guideTgt);
        this.tmpHead.copy(this.guideTgt).project(camera);
        seen = this.tmpHead.z < 1 ? clamp(1 - (Math.max(Math.abs(this.tmpHead.x), Math.abs(this.tmpHead.y)) - 0.75) / 0.3) : 0;
      }
      const on = state.section === 'work' && this.garden.group.visible && state.focus < 0.3 && wt > 0.03 && !state.reducedMotion ? 1 : 0;
      this.guide.update(dt, t, camera, next >= 0 ? this.guideTgt : null, seen, on, state.viewport.dpr);
    }
    const gardenOn = this.garden.group.visible || state.focus > 0.001 || this.activeSlug !== null;
    if (!gardenOn) return;
    this.cards.update(dt, this.activeSlug, this.highlight, this.hovered, this.hitUv);
    // chapter tulips follow their anchors (hover tilt, chapter‑1 entry rise)
    this.cards.group.updateMatrixWorld();
    this.cards.cards.forEach((c, i) => this.garden.syncChapter(i, c.mesh.matrixWorld));
    const done = getProgress().done;
    for (let i = 0; i < PROJECTS.length; i++) this.visited[i] = done.includes(PROJECTS[i].slug);
    const active = this.activeSlug ? PROJECTS.findIndex((p) => p.slug === this.activeSlug) : -1;
    // where the open chapter's tulip is on screen — the chapter unfolds out of it
    if (active >= 0) {
      this.garden.chapterHead(active, this.tmpHead).project(camera);
      // clamped on screen: the unfolding circle must always be able to cover the whole view
      state.bloomX = clamp((this.tmpHead.x * 0.5 + 0.5) * state.viewport.width, 0, state.viewport.width);
      state.bloomY = clamp((-this.tmpHead.y * 0.5 + 0.5) * state.viewport.height, 0, state.viewport.height);
    }
    this.garden.grow(camera.position.y, dt, state.focus > 0.01 || this.gardenReveal > 0.01);
    this.garden.hold = state.wishHold;
    this.garden.fireflyPx.value = 60 * state.viewport.dpr;
    this.garden.update(t, wt, (i) => workTimeline.cardCentre(i), state.focus > 0.5 ? active : -1, this.visited, this.gardenReveal);
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

import { workTimeline } from '../work/WorkTimeline';
import * as THREE from 'three';
import { WORK_ORIGIN } from '../work/WorkLayout';
import { state, store, events, type Route } from './state';
import { createRenderer, readViewport } from '../renderer/Renderer';
import { PostFX } from '../post/PostFX';
import { CameraRig } from '../camera/CameraRig';
import { ScrollEngine } from '../scroll/ScrollEngine';
import { Pointer } from '../interaction/Pointer';
import { Multiuser } from '../interaction/Multiuser';
import { TrailSystem } from '../trails/TrailSystem';
import { TransitionController } from '../transitions/TransitionController';
import { AudioEngine } from '../audio/AudioEngine';
import { AssetManager } from './AssetManager';
import { detectTier, tierSettings, FpsGovernor, type TierSettings } from './Performance';
import { World } from '../world/World';
import { PreloaderPortal } from '../scenes/PreloaderPortal';
import { titleTexture } from '../scenes/ProjectCards';
import { PROJECTS } from '../app/projects';
import { parseRoute } from '../app/router';
import { ANCHOR } from '../world/journey';
import { globalUniforms } from '../world/uniforms';
import { UIDriver } from '../ui/UIDriver';
import { DebugOverlay } from '../ui/DebugOverlay';
import { clamp, easeInOutCubic } from '../utils/math';
import type { ParticleRequest } from '../workers/particles.worker';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

export class Experience {
  readonly renderer: THREE.WebGLRenderer;
  private post: PostFX;
  private rig = new CameraRig();
  private scroll: ScrollEngine;
  private pointer = new Pointer();
  private multi = new Multiuser();
  private trails: TrailSystem | null = null;
  private transition: TransitionController | null = null;
  private audio = new AudioEngine();
  private ui = new UIDriver();
  private governor: FpsGovernor;
  private world: World | null = null;
  private bootScene = new THREE.Scene();
  private preloader = new PreloaderPortal();
  private settings: TierSettings;
  private initialParticleScale: number;
  private last = performance.now();
  private revealStart = -1;
  private preloaderOut = -1;
  private resizeTimer = 0;
  private debug: DebugOverlay | null = null;
  /** QA harness flag: skip the intro choreography so captures don't wait on software rendering. */
  private qa = new URLSearchParams(location.search).has('qa');
  private fixedMs: number | null = null;

  /** QA only: freeze the realtime loop and advance simulated time in exact steps. */
  qaStep(totalMs: number, stepMs = 1000 / 60) {
    if (!this.qa) return;
    this.renderer.setAnimationLoop(null);
    this.fixedMs = stepMs;
    for (let t = 0; t < totalMs - 1e-3; t += stepMs) this.frame();
    this.fixedMs = null;
  }
  qaResume() {
    if (!this.qa) return;
    this.last = performance.now();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** The backdrop ignores depth; during the wipe's second view it must respect the mask. */
  private toggleBackdropDepth = (on: boolean) => {
    const m = this.world?.backdrop.mesh.material as THREE.Material | undefined;
    if (m && m.depthTest !== on) { m.depthTest = on; m.needsUpdate = true; }
  };

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = createRenderer(canvas);
    readViewport();
    const rm = matchMedia('(prefers-reduced-motion: reduce)');
    state.reducedMotion = rm.matches;
    rm.addEventListener('change', () => (state.reducedMotion = rm.matches));

    state.performanceTier = detectTier(this.renderer.getContext() as WebGL2RenderingContext);
    store.set({ tier: state.performanceTier });
    this.settings = tierSettings(state.performanceTier);
    this.initialParticleScale = this.settings.particleScale;
    this.post = new PostFX(this.renderer, this.settings);
    this.scroll = new ScrollEngine();
    this.governor = new FpsGovernor(() => this.applyTier());
    const dbg = new URLSearchParams(location.search).get('debug');
    if (dbg === '1' || dbg === '') this.debug = new DebugOverlay(this.renderer, this.rig.camera, this.rig.debugTarget, this.governor);

    globalUniforms.uReveal.value = 1;
    this.bootScene.add(this.rig.camera);
    this.rig.camera.add(this.preloader.mesh);
    this.resize();

    window.addEventListener('resize', () => this.scheduleResize());
    window.visualViewport?.addEventListener('resize', () => this.scheduleResize());
    window.addEventListener('orientationchange', () => this.scheduleResize());
    window.addEventListener('popstate', () => this.transition?.request(parseRoute(location.pathname), false));
    window.addEventListener('click', (e) => this.onClick(e));
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (state.route.name === 'project') events.emit('navigate', { name: 'work' });
      else if (state.route.name === 'contact') events.emit('navigate', { name: 'home' });
    });
    events.on('navigate', (r: Route) => this.transition?.request(r, true));
    events.on('toggleAudio', () => this.audio.toggle());
    events.on('openCage', () => this.world?.lab.open());
    events.on('wishLight', () => {
      this.world?.garden.pulse(state.time);
      this.thinUntil = state.time + 5.5;
    });
    events.on('gardenPulse', () => this.world?.garden.pulse(state.time));
    events.on('gardenReveal', (on) => {
      this.revealTarget = on ? 1 : 0;
      if (on) {
        this.revealFromPos.copy(this.rig.focusPos);
        this.revealFromTgt.copy(this.rig.focusTgt);
      }
    });
    events.on('filter', (cat) => {
      if (!this.world) return;
      this.world.highlight = cat;
      store.set({ activeCategory: cat });
      const first = PROJECTS.find((p) => p.category === cat);
      if (first) this.transition?.jump(this.world.progressForCard(first.slug));
    });
    events.on('jumpToProject', (slug) => this.world && this.transition?.jump(this.world.progressForCard(slug)));
    events.on('scrollTo', (p) => this.transition?.jump(p));

    this.canvas.addEventListener('webglcontextrestored', () => this.recoverContext());
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private scheduleResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.resize(), 120);
  }

  private resize() {
    const vp = readViewport();
    this.renderer.setPixelRatio(this.settings.dpr);
    this.renderer.setSize(vp.width, vp.height, false);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.post.setSize(size.x, size.y);
    state.viewport.dpr = this.settings.dpr;
    globalUniforms.uResolution.value.set(vp.width, vp.height);
    globalUniforms.uDPR.value = this.settings.dpr;
    this.rig.camera.aspect = vp.aspect;
    this.rig.camera.updateProjectionMatrix();
    this.scroll.layout();
    this.world?.layout();
  }

  private applyTier() {
    this.settings = tierSettings(state.performanceTier);
    this.post.applySettings(this.settings);
    this.resize();
    this.world?.setParticleScale(this.settings.particleScale / this.initialParticleScale);
    this.trails?.setStrands(this.settings.trailStrands);
  }

  /** three.js re‑creates its GL state on restore and lazily re‑uploads every resource; we only re‑size targets. */
  private recoverContext() {
    this.post.rebuildAfterContextLoss();
    this.resize();
  }

  // ── garden moments: the wish's light and the finale's pull‑back
  private thinUntil = -1;
  private revealTarget = 0;
  private revealFromPos = new THREE.Vector3();
  private revealFromTgt = new THREE.Vector3();
  private revealFar = new THREE.Vector3();
  private revealMid = new THREE.Vector3();
  private updateGardenMoments(dt: number) {
    const w = this.world;
    if (!w) return;
    const thin = state.time < this.thinUntil || this.revealTarget > 0 ? 1 : 0;
    state.veilThin += (thin - state.veilThin) * Math.min(1, dt * 2.5);
    // the reveal eases in slowly (≈4 s) and out quickly when the chapter closes
    const k = this.revealTarget > w.gardenReveal ? dt * 0.35 : dt * 2;
    w.gardenReveal = Math.abs(this.revealTarget - w.gardenReveal) < 0.002 ? this.revealTarget : w.gardenReveal + Math.sign(this.revealTarget - w.gardenReveal) * k;
    if (w.gardenReveal > 0 && state.route.name === 'project') {
      // pull far back along the current heading until the whole garden is in frame
      const e = easeInOutCubic(clamp(w.gardenReveal));
      this.revealMid.set(WORK_ORIGIN.x, WORK_ORIGIN.y - 3.8, WORK_ORIGIN.z);
      this.revealFar.set(this.revealFromPos.x - WORK_ORIGIN.x, 0, this.revealFromPos.z - WORK_ORIGIN.z).normalize();
      const dist = state.viewport.aspect < 0.9 ? 44 : 31;
      this.revealFar.multiplyScalar(dist).add(this.revealMid);
      this.rig.focusPos.lerpVectors(this.revealFromPos, this.revealFar, e);
      this.rig.focusTgt.lerpVectors(this.revealFromTgt, this.revealMid, e);
    }
  }

  private onClick(e: MouseEvent) {
    const t = e.target as Element | null;
    if (t && t.closest('a,button,input,textarea,select,[data-ui]')) return;
    if (!this.world || state.route.name === 'project' || state.route.name === 'contact' || state.transition.phase !== 'IDLE') return;
    if (this.world.pickCage(e.clientX, e.clientY, this.rig.camera)) return this.world.lab.open();
    const slug = this.world.hovered ?? this.world.pick(e.clientX, e.clientY, this.rig.camera);
    if (slug) events.emit('navigate', { name: 'project', slug });
  }

  /* ------------------------------------------------------------ boot */
  async boot() {
    const assets = new AssetManager();
    const reservation = assets.reserve(5);
    const k = this.settings.particleScale;
    const req = (id: string, kind: ParticleRequest['kind'], count: number, seed: number, y0: number, y1: number): ParticleRequest => ({
      id,
      kind,
      count: Math.max(200, Math.floor(count * k)),
      seed,
      y0,
      y1,
    });
    const requests: ParticleRequest[] = [
      req('embers', 'embers', 9000, 1, -7, 3.5),
      req('storm', 'storm', 30000, 2, -6.5, 3),
      req('glitter', 'glitter', 34000, 3, ANCHOR.workBottom - 6, ANCHOR.workTop + 6),
      req('blob', 'blob', 12000, 4, ANCHOR.lab - 1, ANCHOR.lab + 1),
      req('specks', 'specks', 2600, 9, -5, 3),
      req('outroSpecks', 'specks', 1200, 10, ANCHOR.outro - 5, ANCHOR.outro + 3),
      req('bubbles', 'dust', 900, 5, ANCHOR.portal - 6, ANCHOR.portal + 3),
      req('outroStorm', 'storm', 18000, 6, ANCHOR.outro - 6.5, ANCHOR.outro + 3),
      req('outroEmbers', 'embers', 5000, 7, ANCHOR.outro - 7, ANCHOR.outro + 3.5),
      req('dust', 'dust', 5000, 8, ANCHOR.outro - 12, 10),
    ];

    // the preloader's own program first, so it appears immediately
    this.renderer.compile(this.bootScene, this.rig.camera);
    const [, particles] = await Promise.all([assets.loadFonts(), assets.generateParticles(requests)]);
    reservation();

    const titles = await assets.run({
      weight: 1,
      run: async (report) => {
        const map = new Map<string, THREE.Texture>();
        for (let i = 0; i < PROJECTS.length; i++) {
          map.set(PROJECTS[i].slug, titleTexture(PROJECTS[i]));
          report((i + 1) / PROJECTS.length);
          if (i % 4 === 3) await nextFrame();
        }
        return map;
      },
    });

    const world = await assets.run({
      weight: 1,
      run: async () => {
        await nextFrame();
        const w = new World(particles, titles, this.settings);
        w.layout();
        return w;
      },
    });

    this.trails = new TrailSystem(this.settings.trailStrands, this.multi);
    world.scene.add(this.trails.group);

    await assets.run({
      weight: 3,
      run: async (report) => {
        world.allVisible(true);
        // compile every program (parallel where KHR_parallel_shader_compile exists)
        await this.renderer.compileAsync(world.scene, this.rig.camera);
        report(0.6);
        this.post.warmup();
        // upload buffers/textures for each section offscreen, so first scroll never hitches
        const saveReveal = globalUniforms.uReveal.value;
        const probes = [0, 0.2, 0.33, 0.55, 0.8, 0.95];
        for (let i = 0; i < probes.length; i++) {
          state.scroll.progress = probes[i];
          this.rig.snap();
          this.rig.update(0);
          this.rig.camera.updateMatrixWorld();
          world.allVisible(true);
          this.renderer.setRenderTarget(this.post.sceneRT);
          this.renderer.render(world.scene, this.rig.camera);
          this.renderer.setRenderTarget(null);
          report(0.6 + (0.4 * (i + 1)) / probes.length);
          await nextFrame();
        }
        globalUniforms.uReveal.value = saveReveal;
        state.scroll.progress = state.scroll.position / state.scroll.max;
        this.rig.snap();
      },
    });

    this.world = world;
    this.world.root.visible = false;
    this.transition = new TransitionController(this.scroll, this.rig, world);
    state.loaded = true;
    store.set({ loaded: true, loadProgress: 1 });
    this.preloaderOut = state.time;
  }

  /* ------------------------------------------------------------ frame */
  private frame() {
    const now = performance.now();
    const rawMs = this.fixedMs ?? now - this.last;
    const dt = Math.min(0.05, rawMs / 1000);
    this.last = now;
    state.delta = dt;
    state.time += dt;
    state.frame++;
    if (store.get().webglLost) return;

    this.pointer.update(dt);
    this.scroll.update(dt);
    this.transition?.update(dt);
    this.multi.update(dt);
    this.audio.update(dt);

    // preloader choreography
    const pu = this.preloader.uniforms;
    pu.uIn.value = clamp(state.time / 0.8);
    pu.uProgress.value += (store.get().loadProgress - pu.uProgress.value) * 0.12;
    if (this.preloaderOut >= 0) {
      const t = clamp((state.time - this.preloaderOut) / (this.qa ? 0.01 : state.reducedMotion ? 0.2 : 0.9));
      pu.uOut.value = easeInOutCubic(t);
      if (t >= 1 && this.revealStart < 0) {
        this.preloader.mesh.visible = false;
        this.revealStart = state.time;
        this.world!.scene.add(this.rig.camera);
        this.world!.root.visible = true;
        store.set({ revealed: true });
        const initial = parseRoute(location.pathname);
        if (initial.name !== 'home') this.transition!.request(initial, false);
      }
    }
    if (this.revealStart >= 0) {
      const t = clamp((state.time - this.revealStart) / (this.qa ? 0.01 : state.reducedMotion ? 0.3 : 2.6));
      state.reveal = t;
      globalUniforms.uReveal.value = clamp(t * 1.8);
    }

    this.updateGardenMoments(dt);
    this.rig.update(dt);
    const cam = this.rig.camera;
    if (this.trails && this.world) {
      this.trails.update(dt, cam);
      this.world.update(dt, cam, this.trails.pointerWorld, this.post.composite);
    }

    // global uniforms (written once per frame, shared by reference)
    const g = globalUniforms;
    g.uTime.value = state.time;
    g.uScroll.value = state.scroll.progress;
    g.uScrollVelocity.value = state.scroll.velocity;
    g.uPointer.value.set(state.pointer.x, state.pointer.y);
    g.uPointerVelocity.value.set(state.pointer.vx, state.pointer.vy);
    g.uTransition.value = state.transition.progress;
    g.uFocus.value = state.focus;
    g.uAudio.value = state.audioLevel;

    const cu = this.post.composite.uniforms;
    // an open birthday chapter sits over a softened, darker world so its text never competes
    const veil = state.focus * (1 - state.veilThin);
    cu.uBlur.value = Math.max(state.overlay * 0.92, veil * 0.85);
    cu.uDim.value = state.overlay * 0.35 + veil * 0.3;
    cu.uBloomStrength.value = 0.85 + Math.min(Math.abs(state.scroll.velocity), 3) * 0.12 + this.rig.warp * 0.8;
    if (!this.world) cu.uGlowA.value.setRGB(0, 0, 0), cu.uGlowB.value.setRGB(0, 0, 0);

    this.ui.update();
    if (this.revealStart >= 0) this.governor.sample(rawMs);
    this.renderer.info.reset();
    const world = this.world && this.world.root.visible ? this.world : null;
    const edge = world ? this.rig.overlayEdge : null;
    this.post.render(world ? world.scene : this.bootScene, cam, edge === null ? undefined : { camera: this.rig.overlayCamera, edge, slant: workTimeline.config.seam.wipeSlant, toggle: this.toggleBackdropDepth });
    this.debug?.frame(rawMs);
  }
}

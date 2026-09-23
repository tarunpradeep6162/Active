import * as THREE from 'three';
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
    this.resize();
  }

  private onClick(e: MouseEvent) {
    const t = e.target as Element | null;
    if (t && t.closest('a,button,input,textarea,select,[data-ui]')) return;
    if (!this.world || state.route.name === 'project' || state.route.name === 'contact' || state.transition.phase !== 'IDLE') return;
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
      req('storm', 'storm', 22000, 2, -6.5, 3),
      req('glitter', 'glitter', 22000, 3, ANCHOR.workBottom - 6, ANCHOR.workTop + 6),
      req('blob', 'blob', 9000, 4, ANCHOR.lab - 1, ANCHOR.lab + 1),
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
    const dt = Math.min(0.05, (now - this.last) / 1000);
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
      const t = clamp((state.time - this.preloaderOut) / (state.reducedMotion ? 0.2 : 0.9));
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
      const t = clamp((state.time - this.revealStart) / (state.reducedMotion ? 0.3 : 2.6));
      state.reveal = t;
      globalUniforms.uReveal.value = clamp(t * 1.8);
    }

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
    cu.uBlur.value = state.overlay * 0.92;
    cu.uDim.value = state.overlay * 0.35 + state.focus * 0.08;
    cu.uBloomStrength.value = 0.85 + Math.min(Math.abs(state.scroll.velocity), 3) * 0.12 + this.rig.warp * 0.8;
    if (!this.world) cu.uGlowA.value.setRGB(0, 0, 0), cu.uGlowB.value.setRGB(0, 0, 0);

    this.ui.update();
    this.governor.sample(dt);
    this.renderer.info.reset();
    this.post.render(this.world && this.world.root.visible ? this.world.scene : this.bootScene, cam);
  }
}

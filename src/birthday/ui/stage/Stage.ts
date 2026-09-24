import * as THREE from 'three';

/**
 * Shared base for the cinematic chapter stages (each renders into its own canvas).
 * Handles the renderer, resizing, pausing while off screen or in a hidden tab, adaptive
 * quality on slow devices (lower pixel ratio, then every other frame) and clean disposal.
 */
export abstract class Stage {
  protected renderer: THREE.WebGLRenderer;
  protected scene = new THREE.Scene();
  protected camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
  protected clock = new THREE.Clock();
  protected readonly still: boolean;
  protected low: boolean;
  private raf = 0;
  private running = false;
  private disposables: { dispose(): void }[] = [];
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private samples: number[] = [];
  private lastNow = 0;
  private every = 1;
  private tick = 0;
  private last = 0;

  constructor(
    protected canvas: HTMLCanvasElement,
    opts: { alpha?: boolean; dpr?: number } = {},
  ) {
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.low = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 4) <= 4;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: !!opts.alpha, premultipliedAlpha: true, powerPreference: 'high-performance' });
    const gl = this.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg && /swiftshader|llvmpipe|software|basic render/i.test(String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)))) this.low = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.low ? 1 : opts.dpr ?? 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    if (opts.alpha) this.renderer.setClearColor(0x000000, 0);
    this.io = new IntersectionObserver(([e]) => (e.isIntersecting ? this.start() : this.stop()));
    this.ro = new ResizeObserver(() => this.resize());
    document.addEventListener('visibilitychange', this.onVis);
  }

  /** Call at the end of the subclass constructor, once the scene is built. */
  protected begin() {
    this.io.observe(this.canvas);
    this.ro.observe(this.canvas);
    this.resize();
    this.start();
  }

  protected track<T extends { dispose(): void }>(x: T) {
    this.disposables.push(x);
    return x;
  }

  /** per‑frame animation; t = seconds since start, dt = seconds since last frame */
  protected abstract update(t: number, dt: number): void;
  protected onResize(_w: number, _h: number) {}

  private onVis = () => (document.hidden ? this.stop() : this.start());

  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.onResize(w, h);
    if (!this.running) this.frame();
  }

  private start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      if (++this.tick % this.every === 0) this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }
  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private adapt() {
    const now = performance.now();
    if (this.lastNow) this.samples.push(now - this.lastNow);
    this.lastNow = now;
    if (this.samples.length < 30) return;
    const med = [...this.samples].sort((a, b) => a - b)[15];
    this.samples = [];
    if (med > 40 && this.renderer.getPixelRatio() > 1) {
      this.renderer.setPixelRatio(1);
      this.resize();
    } else if (med > 70 && this.every < 2) this.every = 2;
  }

  private frame() {
    this.adapt();
    const t = this.clock.getElapsedTime();
    const dt = Math.min(0.1, t - this.last);
    this.last = t;
    this.update(t, dt);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    this.io.disconnect();
    this.ro.disconnect();
    document.removeEventListener('visibilitychange', this.onVis);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

/** Sample the lit pixels of a line of serif text into n points, centred, `span` units wide. */
export function sampleText(text: string, n: number, span: number, rnd: () => number = Math.random) {
  const W = 1400, H = 320;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 240;
  const font = (s: number) => `500 ${s}px 'Cormorant Garamond', Georgia, serif`;
  g.font = font(size);
  const w = g.measureText(text).width;
  if (w > W * 0.94) {
    size *= (W * 0.94) / w;
    g.font = font(size);
  }
  g.fillText(text, W / 2, H / 2);
  const data = g.getImageData(0, 0, W, H).data;
  const lit: number[] = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (data[(y * W + x) * 4 + 3] > 128) lit.push(x, y);
  const k = span / (W * 0.94);
  const out = new Float32Array(n * 3);
  const pts = lit.length / 2;
  for (let i = 0; i < n; i++) {
    const j = pts ? Math.floor(rnd() * pts) : 0;
    const x = pts ? lit[j * 2] : W / 2, y = pts ? lit[j * 2 + 1] : H / 2;
    out.set([(x - W / 2) * k + (rnd() - 0.5) * 0.02, -(y - H / 2) * k + (rnd() - 0.5) * 0.02, (rnd() - 0.5) * 0.12], i * 3);
  }
  return out;
}

export const ease = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

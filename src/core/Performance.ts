import { state, store } from './state';

export type PerformanceTier = 'high' | 'medium' | 'low';

export interface TierSettings {
  dpr: number;
  particleScale: number;
  bloom: boolean;
  bloomLevels: number;
  msaa: number;
  trailStrands: number;
  chromatic: boolean;
  hexCount: number;
}

const isMobileDevice = () =>
  matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

export function detectTier(gl: WebGL2RenderingContext | null): PerformanceTier {
  const q = new URLSearchParams(location.search).get('tier');
  if (q === 'high' || q === 'medium' || q === 'low') return q;
  if (!gl) return 'low';
  let renderer = '';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  if (ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
  const software = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (software) return 'low';
  if (isMobileDevice()) {
    const modern = /apple gpu|adreno \(tm\) (7|8)\d\d|mali-g(7|6)\d|xclipse/i.test(renderer);
    return modern && mem >= 4 ? 'medium' : 'low';
  }
  if (cores <= 4 || mem <= 4 || /intel.*(hd|uhd) graphics [2-5]/i.test(renderer)) return 'medium';
  return 'high';
}

export function tierSettings(tier: PerformanceTier): TierSettings {
  const mobile = state.viewport.mobile;
  const dpr = window.devicePixelRatio || 1;
  // Reference renders at 1.5× on DPR‑1 desktop and 1.25× on DPR‑1 mobile.
  if (tier === 'high')
    return {
      dpr: mobile ? Math.min(Math.max(dpr, 1.25), 1.5) : Math.min(Math.max(dpr, 1.5), 1.75),
      particleScale: 1,
      bloom: true,
      bloomLevels: 5,
      msaa: 4,
      trailStrands: 3,
      chromatic: true,
      hexCount: 1,
    };
  if (tier === 'medium')
    return {
      dpr: mobile ? Math.min(dpr, 1.25) : Math.min(dpr, 1.25),
      particleScale: 0.6,
      bloom: true,
      bloomLevels: 4,
      msaa: 0,
      trailStrands: 2,
      chromatic: true,
      hexCount: 0.7,
    };
  return {
    dpr: 1,
    particleScale: 0.3,
    bloom: true,
    bloomLevels: 3,
    msaa: 0,
    trailStrands: 1,
    chromatic: false,
    hexCount: 0.45,
  };
}

/**
 * Automatic tiering with hysteresis.
 *  1. Startup benchmark: the first ~90 settled frames after reveal. If their median
 *     frame time is far over budget, step down once immediately.
 *  2. Rolling monitor: 1 s windows. Three consecutive slow windows → step down.
 *     After any change there is a cooldown, so tiers never oscillate.
 *  3. One step back up is allowed per session, only if the benchmark caused the
 *     drop and the device then runs well under budget for 10 s straight.
 * Only rendering cost changes between tiers — never layout.
 */
export class FpsGovernor {
  private samples: number[] = [];
  private benchmarkDone = false;
  private acc = 0;
  private frames = 0;
  private slow = 0;
  private fast = 0;
  private cooldown = 2;
  private upgradedOnce = false;
  private droppedByBenchmark = false;
  private startTier: PerformanceTier;
  readonly history: string[] = [];
  lastFps = 0;
  benchmarkMs = 0;
  enabled = true;

  constructor(private onChange: (tier: PerformanceTier) => void) {
    this.startTier = state.performanceTier;
    // a forced ?tier= disables automatic changes
    this.enabled = !new URLSearchParams(location.search).get('tier');
  }

  private budget() {
    return state.viewport.mobile ? 1000 / 30 : 1000 / 60;
  }

  private set(tier: PerformanceTier, why: string) {
    if (tier === state.performanceTier) return;
    this.history.push(`${state.performanceTier}→${tier} (${why})`);
    state.performanceTier = tier;
    store.set({ tier });
    this.cooldown = 5;
    this.slow = this.fast = 0;
    this.onChange(tier);
  }

  /** Call once per frame after reveal with the real frame delta in ms. */
  sample(ms: number) {
    if (document.hidden || ms > 250) return; // ignore tab switches / stalls
    this.acc += ms;
    this.frames++;
    if (!this.benchmarkDone) {
      this.samples.push(ms);
      if (this.samples.length >= 90) {
        this.benchmarkDone = true;
        const sorted = this.samples.slice().sort((a, b) => a - b);
        this.benchmarkMs = sorted[sorted.length >> 1];
        if (this.enabled && this.benchmarkMs > this.budget() * 1.8 && state.performanceTier !== 'low') {
          this.droppedByBenchmark = true;
          this.set(state.performanceTier === 'high' ? 'medium' : 'low', `benchmark median ${this.benchmarkMs.toFixed(1)} ms`);
        }
      }
    }
    if (this.acc < 1000) return;
    const mean = this.acc / this.frames;
    this.lastFps = 1000 / mean;
    this.acc = 0;
    this.frames = 0;
    if (!this.enabled) return;
    if (this.cooldown > 0) {
      this.cooldown--;
      return;
    }
    const budget = this.budget();
    this.slow = mean > budget * 1.45 ? this.slow + 1 : 0;
    this.fast = mean < budget * 0.55 ? this.fast + 1 : 0;
    if (this.slow >= 3 && state.performanceTier !== 'low') {
      this.set(state.performanceTier === 'high' ? 'medium' : 'low', `sustained ${mean.toFixed(1)} ms`);
    } else if (this.fast >= 10 && this.droppedByBenchmark && !this.upgradedOnce && state.performanceTier !== this.startTier) {
      this.upgradedOnce = true;
      this.set(state.performanceTier === 'low' ? 'medium' : 'high', `recovered ${mean.toFixed(1)} ms`);
    }
  }
}

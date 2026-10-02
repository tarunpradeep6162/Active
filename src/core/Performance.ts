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
  /** fewer samples for the light shafts and lens streaks (phones, low tier) */
  cheapPost: boolean;
}

/** a phone GPU from the current top class (OnePlus 11R's Adreno 730 and up) vs the mid class
 *  (vivo V70's Adreno 722 and the like): the mid class starts at a slightly lower resolution */
let strongPhoneGpu = false;
/** true once detectTier has seen a top‑class phone GPU (Adreno 730+, Immortalis, Apple…) */
export const isStrongPhoneGpu = () => strongPhoneGpu;

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
    strongPhoneGpu = /apple gpu|adreno \(tm\) (7[3-9]\d|8\d\d)|immortalis|mali-g7[1-9]\d|xclipse/i.test(renderer);
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
      dpr: Math.min(Math.max(dpr, 1.25), 1.5),
      particleScale: 1,
      bloom: true,
      bloomLevels: 5,
      msaa: 4,
      trailStrands: 3,
      chromatic: true,
      hexCount: 1,
      cheapPost: mobile,
    };
  if (tier === 'medium')
    return {
      // phones: drawn at the screen's own resolution (3× on the OnePlus 11R class) or 2.5× on the
      // mid class, with the glow passes at quarter resolution so the pixels stay affordable. The
      // governor trims it (never below 85%) only if frames start to slip.
      dpr: mobile ? Math.min(dpr, strongPhoneGpu ? 3 : 2.5) : Math.min(dpr, 1.25),
      particleScale: 0.6,
      bloom: true,
      bloomLevels: 4,
      // phones: 4× MSAA (nearly free on their tile‑based GPUs) keeps petal and stem edges clean
      // once the frame is scaled up to the 3× screen
      // (at 2.5× and up the pixels are already tiny: 2 samples finish the edges)
      msaa: mobile ? (Math.min(dpr, strongPhoneGpu ? 3 : 2.5) >= 2.5 ? 2 : 4) : 0,
      trailStrands: 2,
      chromatic: true,
      hexCount: 0.7,
      // (half‑resolution glow passes even on phones: drawn at the screen's own 3×, a quarter‑res
      // light shaft shows as soft blocks)
      cheapPost: false,
    };
  return {
    // phones keep a readable sharpness even on the lowest tier (their screens are ~3×)
    dpr: mobile ? Math.min(dpr, 1.25) : 1,
    particleScale: mobile ? 0.4 : 0.3,
    bloom: true,
    bloomLevels: 3,
    msaa: 0,
    trailStrands: 1,
    chromatic: false,
    hexCount: 0.45,
    cheapPost: true,
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
  private seen = 0;
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

  /** phones: the share of the tier's resolution being drawn (eased down before any tier drop) */
  resScale = 1;
  private resCooldown = 0;
  private resGood = 0;

  constructor(private onChange: (tier: PerformanceTier) => void, private onScale: (scale: number) => void = () => {}) {
    this.startTier = state.performanceTier;
    // a forced ?tier= disables automatic changes
    this.enabled = !new URLSearchParams(location.search).get('tier');
  }

  private budget() {
    // phones too: the aim is a steady 60 (the loop caps 90/120 Hz screens at 60)
    return 1000 / 60;
  }

  /**
   * Phones: before ever dropping a tier, trim the drawing resolution in 5% steps (never below 85%)
   * once frames have stayed under ~50 fps for three seconds running, and give 5% back only after
   * fifteen smooth seconds. Every change rebuilds the render targets (a one-frame hitch), so it
   * acts rarely and never flip-flops. Returns true when it acted (the tier logic then waits).
   */
  private resSlow = 0;
  private adaptScale(mean: number) {
    if (!state.viewport.mobile) return false;
    if (this.resCooldown > 0) {
      this.resCooldown--;
      return false;
    }
    const MIN = 0.85;
    this.resSlow = mean > 20 ? this.resSlow + 1 : 0;
    this.resGood = mean < 17.6 ? this.resGood + 1 : 0;
    if (this.resSlow >= 3 && this.resScale > MIN) {
      this.resScale = Math.max(MIN, +(this.resScale - 0.05).toFixed(2));
      this.resSlow = this.resGood = 0;
      this.resCooldown = 3;
      this.history.push(`res ${this.resScale} (${mean.toFixed(1)} ms)`);
      this.onScale(this.resScale);
      return true;
    }
    if (this.resGood >= 15 && this.resScale < 1) {
      this.resScale = Math.min(1, +(this.resScale + 0.05).toFixed(2));
      this.resSlow = this.resGood = 0;
      this.resCooldown = 5;
      this.history.push(`res ${this.resScale} (recovered)`);
      this.onScale(this.resScale);
      return true;
    }
    return false;
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
    // the first two seconds after the reveal are uploads and the intro settling: not a verdict
    if (++this.seen <= 120) return;
    if (!this.benchmarkDone) {
      this.samples.push(ms);
      if (this.samples.length >= 90) {
        this.benchmarkDone = true;
        const sorted = this.samples.slice().sort((a, b) => a - b);
        this.benchmarkMs = sorted[sorted.length >> 1];
        // (phones never drop a tier on the benchmark: the resolution trim handles them gently)
        if (this.enabled && !state.viewport.mobile && this.benchmarkMs > this.budget() * 1.8 && state.performanceTier !== 'low') {
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
    if (this.adaptScale(mean)) {
      this.slow = 0;
      return;
    }
    const budget = this.budget();
    // phones only drop a tier once the resolution has nowhere left to go, and only when frames
    // have stayed under ~35 fps for five seconds running
    const phone = state.viewport.mobile;
    const canTrim = phone && this.resScale > 0.85;
    this.slow = mean > budget * (phone ? 1.7 : 1.45) && !canTrim ? this.slow + 1 : 0;
    this.fast = mean < budget * 0.55 ? this.fast + 1 : 0;
    if (this.slow >= (phone ? 5 : 3) && state.performanceTier !== 'low') {
      this.set(state.performanceTier === 'high' ? 'medium' : 'low', `sustained ${mean.toFixed(1)} ms`);
    } else if (this.fast >= 10 && this.droppedByBenchmark && !this.upgradedOnce && state.performanceTier !== this.startTier) {
      this.upgradedOnce = true;
      this.set(state.performanceTier === 'low' ? 'medium' : 'high', `recovered ${mean.toFixed(1)} ms`);
    }
  }
}

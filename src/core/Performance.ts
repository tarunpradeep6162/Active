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
 * Watches frame times and steps the tier down when the device can't keep up.
 * Never steps up automatically (avoids oscillation).
 */
export class FpsGovernor {
  private acc = 0;
  private frames = 0;
  private slowWindows = 0;
  private cooldown = 3; // ignore first seconds (shader warm‑up)
  constructor(private onDowngrade: (tier: PerformanceTier) => void) {}

  sample(dt: number) {
    if (document.hidden) return;
    this.acc += dt;
    this.frames++;
    if (this.acc < 1) return;
    const fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;
    if (this.cooldown > 0) {
      this.cooldown--;
      return;
    }
    const floor = state.viewport.mobile ? 26 : 42;
    this.slowWindows = fps < floor ? this.slowWindows + 1 : Math.max(0, this.slowWindows - 1);
    if (this.slowWindows >= 3 && state.performanceTier !== 'low') {
      const next: PerformanceTier = state.performanceTier === 'high' ? 'medium' : 'low';
      state.performanceTier = next;
      store.set({ tier: next });
      this.slowWindows = 0;
      this.cooldown = 3;
      this.onDowngrade(next);
    }
  }
}

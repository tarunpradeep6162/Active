import { state } from '../core/state';
import { Spring } from '../utils/math';

/**
 * Deforms the nav pill outline with a spring driven by scroll velocity and
 * morphs the divider between a straight rule and a wave. Runs on its own rAF,
 * touching only SVG attributes.
 */
export class NavFX {
  private bow = new Spring(220, 11);
  private skew = new Spring(160, 9);
  private wave = new Spring(90, 14);
  private raf = 0;
  private waveTarget = 0;

  constructor(
    private root: HTMLElement,
    private fill: SVGPathElement,
    private stroke: SVGPathElement,
    private divider: SVGPathElement,
    private glow: HTMLElement,
  ) {
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.update(dt);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  setWave(on: boolean) {
    this.waveTarget = on ? 1 : 0;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
  }

  private update(dt: number) {
    const reduced = state.reducedMotion;
    const v = reduced ? 0 : Math.max(-5, Math.min(5, state.scroll.velocity));
    const b = this.bow.step(v * 3.2, dt);
    const sk = this.skew.step(v * 1.4, dt);
    const w = this.wave.step(this.waveTarget, dt);
    const W = this.root.clientWidth, H = this.root.clientHeight;
    if (!W || !H) return;
    const r = H / 2;
    const pad = 14;
    const x0 = pad, y0 = pad, x1 = pad + W, y1 = pad + H;
    // top/bottom edges bow opposite to travel; caps lean with the skew
    const t = state.time;
    const wob = reduced ? 0 : Math.sin(t * 9) * Math.min(Math.abs(b), 6) * 0.25;
    const d =
      `M ${x0 + r} ${y0} ` +
      `C ${x0 + W * 0.35} ${y0 - b + wob} ${x1 - W * 0.35} ${y0 - b - wob} ${x1 - r} ${y0} ` +
      `C ${x1 + r * 0.55 + sk} ${y0} ${x1 + r * 0.55 + sk} ${y1} ${x1 - r} ${y1} ` +
      `C ${x1 - W * 0.35} ${y1 - b * 0.6 - wob} ${x0 + W * 0.35} ${y1 - b * 0.6 + wob} ${x0 + r} ${y1} ` +
      `C ${x0 - r * 0.55 - sk} ${y1} ${x0 - r * 0.55 - sk} ${y0} ${x0 + r} ${y0} Z`;
    this.fill.setAttribute('d', d);
    this.stroke.setAttribute('d', d);

    // divider: 50px rule ↔ wave
    const amp = w * 3.2 + Math.min(Math.abs(v), 3) * 0.8;
    let dd = 'M 0 7';
    for (let x = 2; x <= 50; x += 2) {
      const y = 7 + Math.sin((x / 50) * Math.PI * 2 * 1.25 + t * 4) * amp * Math.sin((x / 50) * Math.PI);
      dd += ` L ${x} ${y.toFixed(2)}`;
    }
    this.divider.setAttribute('d', dd);

    const energy = Math.min(1, Math.abs(v) / 3);
    this.glow.style.transform = `scaleY(${(1 + energy * 0.8).toFixed(3)})`;
    this.glow.style.opacity = (0.65 + energy * 0.35).toFixed(3);
  }
}

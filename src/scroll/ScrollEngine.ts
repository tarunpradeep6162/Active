import { state } from '../core/state';
import { SECTIONS, sectionVh, totalVh, sectionAt, computeRanges } from '../world/journey';
import { rebuildCameraPath } from '../camera/cameraPath';
import { setWorkDevice } from '../work/WorkTimeline';
import { damp, clamp } from '../utils/math';

/**
 * Native document scroll drives the journey (keyboard, scrollbar, a11y and
 * mobile toolbars keep working). A tall spacer holds the six measured
 * sections; the engine smooths the raw value and derives velocity.
 */
export class ScrollEngine {
  private spacer: HTMLDivElement;
  private sectionEls: HTMLDivElement[] = [];
  private lastPos = 0;
  private locked = false;

  constructor() {
    this.spacer = document.createElement('div');
    this.spacer.className = 'scroll-spacer';
    this.spacer.setAttribute('aria-hidden', 'true');
    for (const s of SECTIONS) {
      const el = document.createElement('div');
      el.dataset.section = s.id;
      this.sectionEls.push(el);
      this.spacer.appendChild(el);
    }
    document.body.prepend(this.spacer);
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    this.layout();
  }

  /** Phone‑sized screens use the measured phone journey (tablets keep the desktop one). */
  private phone() {
    return Math.min(state.viewport.width, state.viewport.height) < 600;
  }

  layout() {
    // Use a stable height on mobile so the toolbar showing/hiding doesn't rescale the journey.
    const vh = state.viewport.mobile ? Math.max(window.innerHeight, screen.height * 0.8) / 100 : window.innerHeight / 100;
    const phone = this.phone();
    const deviceChanged = setWorkDevice(phone);
    if (computeRanges(phone) || deviceChanged) rebuildCameraPath();
    const lens = sectionVh(phone);
    SECTIONS.forEach((_, i) => (this.sectionEls[i].style.height = `${Math.round(lens[i] * vh)}px`));
    const total = Math.round(totalVh(phone) * vh);
    this.spacer.style.height = `${total}px`;
    const prev = state.scroll.max;
    state.scroll.max = Math.max(1, total - window.innerHeight);
    // keep progress stable across resize / orientation change
    if (prev > 1 && prev !== state.scroll.max) {
      const y = state.scroll.targetProgress * state.scroll.max;
      window.scrollTo(0, y);
      state.scroll.target = state.scroll.position = this.lastPos = y;
    }
  }

  /** Journey progress (0..1) → document px. */
  toPx(progress: number) {
    return clamp(progress) * state.scroll.max;
  }

  jumpTo(progress: number, instant = true) {
    const y = this.toPx(progress);
    window.scrollTo({ top: y, behavior: instant ? 'instant' : 'smooth' });
    state.scroll.target = y;
    if (instant) {
      state.scroll.position = y;
      this.lastPos = y;
    }
  }

  lock(on: boolean) {
    if (this.locked === on) return;
    this.locked = on;
    document.documentElement.classList.toggle('scroll-locked', on);
  }

  update(dt: number) {
    const s = state.scroll;
    if (!this.locked) s.target = window.scrollY;
    const lambda = state.reducedMotion ? 30 : state.viewport.mobile ? 9 : 6.5;
    s.position = damp(s.position, s.target, lambda, dt);
    if (Math.abs(s.position - s.target) < 0.05) s.position = s.target;
    const vh = window.innerHeight || 1;
    const instVel = dt > 0 ? (s.position - this.lastPos) / vh / dt : 0;
    this.lastPos = s.position;
    // velocity in viewport heights / second, lightly smoothed
    s.velocity = damp(s.velocity, clamp(instVel, -12, 12), 10, dt);
    if (Math.abs(s.velocity) < 1e-4) s.velocity = 0;
    s.direction = s.velocity > 0.01 ? 1 : s.velocity < -0.01 ? -1 : 0;
    s.progress = clamp(s.position / s.max);
    s.targetProgress = clamp(s.target / s.max);
    const sec = sectionAt(s.progress);
    state.section = sec.id;
    state.sectionProgress = sec.local;
  }
}

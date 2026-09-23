import { state, store } from '../core/state';
import { smoothstep } from '../utils/math';
import { rangeOf } from '../world/journey';

/**
 * Per‑frame bridge from runtime state to DOM: writes CSS custom properties
 * (never React state) so overlays fade/shift in lockstep with the camera.
 */
export class UIDriver {
  private root = document.documentElement;
  private last = new Map<string, number>();

  private set(name: string, v: number) {
    const prev = this.last.get(name);
    if (prev !== undefined && Math.abs(prev - v) < 0.002) return;
    this.last.set(name, v);
    this.root.style.setProperty(name, v.toFixed(4));
  }

  update() {
    const p = state.scroll.progress;
    const band = (id: Parameters<typeof rangeOf>[0], a: number, b: number, c: number, d: number) => {
      const r = rangeOf(id);
      const l = (p - r.start) / (r.end - r.start);
      return smoothstep(a, b, l) * (1 - smoothstep(c, d, l));
    };
    const free = (1 - state.focus) * (1 - state.overlay);
    this.set('--reveal', state.reveal);
    this.set('--v-intro', state.reveal * band('intro', -1, -0.9, 0.03, 0.1) * free);
    this.set('--v-manifesto', band('manifesto', -0.35, 0.08, 0.78, 1.05) * free);
    const mr = rangeOf('manifesto');
    this.set('--manifesto-local', (p - mr.start) / (mr.end - mr.start));
    this.set('--v-work', band('work', 0.0, 0.03, 0.97, 1.0) * (1 - state.overlay) * (1 - state.focus));
    this.set('--v-lab', band('portal', 0.15, 0.4, 0.85, 1.0) * free);
    this.set('--v-end', band('outro', 0.82, 0.97, 2, 3) * free);
    this.set('--focus', state.focus);
    this.set('--overlay', state.overlay);
    this.set('--scroll-vel', Math.max(-4, Math.min(4, state.scroll.velocity)));
    this.set('--progress', p);
    const atEnd = p > 0.985;
    if (store.get().atEnd !== atEnd) store.set({ atEnd });
    if (store.get().section !== state.section) store.set({ section: state.section });
  }
}

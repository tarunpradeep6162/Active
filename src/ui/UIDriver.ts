import { lightLeak } from './lightLeak';
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
    // the opening's title card gives way to the opening credits as she scrolls into the night
    this.set('--scroll-intro-out', state.section === 'intro' ? smoothstep(0.07, 0.13, state.sectionProgress) : 0);
    this.set('--v-manifesto', band('manifesto', -0.35, 0.08, 0.78, 1.05) * free);
    const mr = rangeOf('manifesto');
    const man = (p - mr.start) / (mr.end - mr.start);
    this.set('--manifesto-local', man);
    const phone = Math.min(state.viewport.width, state.viewport.height) < 600;
    this.set('--headline-shift', headlineShift(man, phone));
    // phone: the body copy leaves early and the project list arrives by work p −0.07 (measured)
    this.set('--v-manifesto-copy', phone ? 1 - smoothstep(0.56, 0.64, man) : 1);
    const wb = phone ? band('work', -0.08, -0.065, 0.86, 0.88) : band('work', -0.045, -0.02, 0.93, 0.965);
    this.set('--v-work', wb * (1 - state.overlay) * (1 - state.focus));
    // from the moment the cake is framed in its cage until the lanterns take the sky
    this.set('--v-lab', band('lab', 0.3, 0.48, 1.05, 1.2) * free);
    this.set('--v-sky', band('portal', 0.12, 0.3, 0.86, 0.98) * free);
    // the finale sky: HAPPY BIRTHDAY once her name has formed in stars, then the sunrise
    const fl = state.section === 'outro' ? state.finaleLocal : 0;
    this.set('--v-happy', smoothstep(0.68, 0.76, fl) * free);
    if (fl > 0) this.root.style.setProperty('--name-half', `${Math.round(state.nameHalfPx)}px`);
    this.set('--v-sunrise', smoothstep(0.74, 0.97, fl) * (1 - state.overlay));
    this.set('--v-end', band('outro', 0.82, 0.97, 2, 3) * free);
    this.set('--focus', state.focus);
    this.set('--veil-thin', state.veilThin);
    this.root.style.setProperty('--bloom-x', `${Math.round(state.bloomX)}px`);
    this.root.style.setProperty('--bloom-y', `${Math.round(state.bloomY)}px`);
    this.set('--overlay', state.overlay);
    this.set('--scroll-vel', Math.max(-4, Math.min(4, state.scroll.velocity)));
    this.set('--progress', p);
    const atEnd = p > 0.985;
    if (store.get().atEnd !== atEnd) store.set({ atEnd });
    if (store.get().section !== state.section) {
      // a light leak between scenes (not on the very first frame)
      if (store.get().section && state.reveal >= 1) lightLeak();
      store.set({ section: state.section });
    }
  }
}

/**
 * Headline vertical offset (vh) against manifesto progress m — measured on the reference at
 * 1440×900 with a frame‑counted settle: rising in from below before the section (≈112 vh per
 * section length), pinned for m ∈ [0, 0.2], then leaving upward at ≈42 vh per section length.
 * Shared with the headline ring's timing in World.
 */
function headlineShift(m: number, phone = false) {
  if (m < 0) return -m * 112;
  // phone (390×844): no pin, a steady climb of ≈34 vh per section length (1.7 vh per 1 % of work;
  // the phone headline section spans work p −0.2 … 0, so m = 0.5 at work p −0.1)
  if (phone) return -m * 34;
  if (m < 0.2) return 0;
  return -(m - 0.2) * 42;
}


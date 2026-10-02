import { lightLeak } from './lightLeak';
import { state, store } from '../core/state';
import { smoothstep } from '../utils/math';
import { rangeOf } from '../world/journey';

/**
 * Per‑frame bridge from runtime state to DOM: writes CSS custom properties
 * (never React state) so overlays fade/shift in lockstep with the camera.
 *
 * A custom property set on the root is inherited by every element, so each change makes the
 * browser restyle the whole page (on a phone, ~10 ms a time). The root only carries values that
 * change at a scene's edges; the two that move continuously with the scroll are written on the
 * one element that uses each.
 */
export class UIDriver {
  private root = document.documentElement;
  private last = new Map<string, number | string>();
  private els = new Map<string, HTMLElement | null>();

  /** where each value is used: written there, not on the root, so only that element restyles */
  private static readonly SCOPE: Record<string, string> = {
    '--v-intro': '.intro-hint',
    '--v-manifesto': '.manifesto',
    '--headline-shift': '.manifesto',
    '--v-manifesto-copy': '.manifesto__copy',
    '--v-work': '.work-panel',
    '--v-lab': '.lab-label',
    '--v-sky': '.sky-label',
    '--v-sunrise': '.sunrise',
    '--v-happy': '.finale-sky',
    '--v-end': '.endcap',
    '--scroll-intro-out': '.opening',
    '--progress': '.journey-line',
  };

  private set(name: string, v: number, on?: HTMLElement | null, key?: string) {
    const scope = UIDriver.SCOPE[name];
    if (on === undefined) on = scope ? this.el(scope) : this.root;
    key ??= scope ? scope + name : name;
    if (!on) return;
    const prev = this.last.get(key) as number | undefined;
    if (prev !== undefined && Math.abs(prev - v) < 0.002) return;
    this.last.set(key, v);
    on.style.setProperty(name, v.toFixed(4));
  }
  private setStr(name: string, v: string, on: HTMLElement | null = this.root) {
    if (!on) return;
    const key = on === this.root ? name : '.finale-sky' + name;
    if (this.last.get(key) === v) return;
    this.last.set(key, v);
    on.style.setProperty(name, v);
  }
  /** the element for a selector (looked up again if React replaced it) */
  private el(sel: string) {
    let e = this.els.get(sel);
    if (!e || !e.isConnected) {
      e = document.querySelector<HTMLElement>(sel);
      this.els.set(sel, e);
      // a new element starts without our values: write them all again
      if (e) for (const k of [...this.last.keys()]) if (k.startsWith(sel + '--')) this.last.delete(k);
    }
    return e;
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
    // (held still once the headline is well out of view, so it stops being restyled)
    const man = Math.max(-1.2, Math.min(3.5, (p - mr.start) / (mr.end - mr.start)));
    const phone = Math.min(state.viewport.width, state.viewport.height) < 600;
    this.set('--headline-shift', headlineShift(man, phone));
    // phone: the body copy leaves early and the project list arrives by work p −0.07 (measured)
    this.set('--v-manifesto-copy', phone ? 1 - smoothstep(0.56, 0.64, man) : 1);
    const wb = phone ? band('work', -0.08, -0.065, 0.86, 0.88) : band('work', -0.045, -0.02, 0.93, 0.965);
    this.set('--v-work', wb * (1 - state.overlay) * (1 - state.focus));
    // from the moment the cake is framed in its cage until the camera leaves the room
    this.set('--v-lab', band('lab', 0.3, 0.48, 0.9, 0.98) * free);
    this.set('--v-sky', band('portal', 0.12, 0.3, 0.86, 0.98) * free);
    // the finale sky: HAPPY BIRTHDAY once her name has formed in stars, then the sunrise
    const fl = state.section === 'outro' ? state.finaleLocal : 0;
    this.set('--v-happy', smoothstep(0.68, 0.76, fl) * free);
    if (fl > 0) this.setStr('--name-half', `${Math.round(state.nameHalfPx)}px`, this.el('.finale-sky'));
    this.set('--v-sunrise', smoothstep(0.74, 0.97, fl) * (1 - state.overlay));
    this.set('--v-end', band('outro', 0.82, 0.97, 2, 3) * free);
    this.set('--veil-thin', state.veilThin);
    this.setStr('--bloom-x', `${Math.round(state.bloomX)}px`);
    this.setStr('--bloom-y', `${Math.round(state.bloomY)}px`);
    this.set('--overlay', state.overlay);
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


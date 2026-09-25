import { events } from '../core/state';
/**
 * A warm light leak sweeping across the frame, like light spilling into a film camera between
 * scenes. Played on every change of scene and when a chapter opens (never with reduced motion).
 */
let el: HTMLDivElement | null = null;
let last = 0;
export function lightLeak() {
  if (typeof document === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const now = performance.now();
  if (now - last < 900) return; // a quick scroll through several scenes plays it once
  last = now;
  if (!el) {
    el = document.createElement('div');
    el.className = 'lightleak';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
  }
  el.classList.remove('is-on');
  void el.offsetWidth; // restart the animation
  el.dataset.side = Math.random() < 0.5 ? 'l' : 'r';
  el.classList.add('is-on');
  events.emit('sfx', 'leak');
}

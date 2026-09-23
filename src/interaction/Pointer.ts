import { state } from '../core/state';
import { damp } from '../utils/math';

/** Normalised pointer + velocity. Touch works through Pointer + Touch events without blocking scroll. */
export class Pointer {
  private lastX = 0;
  private lastY = 0;
  private rawX = 0;
  private rawY = 0;
  private moved = false;

  constructor() {
    const p = state.pointer;
    const set = (cx: number, cy: number, touch: boolean) => {
      p.px = cx;
      p.py = cy;
      this.rawX = (cx / state.viewport.width) * 2 - 1;
      this.rawY = -((cy / state.viewport.height) * 2 - 1);
      p.isTouch = touch;
      p.active = true;
      p.lastMove = performance.now();
      if (!this.moved) {
        this.moved = true;
        this.lastX = p.x = p.targetX = this.rawX;
        this.lastY = p.y = p.targetY = this.rawY;
      }
    };
    window.addEventListener('pointermove', (e) => set(e.clientX, e.clientY, e.pointerType === 'touch'), { passive: true });
    window.addEventListener(
      'pointerdown',
      (e) => {
        set(e.clientX, e.clientY, e.pointerType === 'touch');
        p.down = true;
      },
      { passive: true },
    );
    window.addEventListener('pointerup', () => (p.down = false), { passive: true });
    window.addEventListener('pointercancel', () => (p.down = false), { passive: true });
    // While the browser scrolls a touch, pointer events are cancelled; touchmove keeps feeding the trail.
    window.addEventListener(
      'touchmove',
      (e) => {
        const t = e.touches[0];
        if (t) set(t.clientX, t.clientY, true);
      },
      { passive: true },
    );
    window.addEventListener('touchend', () => (p.active = false), { passive: true });
    document.addEventListener('mouseleave', () => (p.active = false));
  }

  update(dt: number) {
    const p = state.pointer;
    p.x = this.rawX;
    p.y = this.rawY;
    const vx = dt > 0 ? (p.x - this.lastX) / dt : 0;
    const vy = dt > 0 ? (p.y - this.lastY) / dt : 0;
    this.lastX = p.x;
    this.lastY = p.y;
    p.vx = damp(p.vx, vx, 12, dt);
    p.vy = damp(p.vy, vy, 12, dt);
    p.speed = Math.hypot(p.vx, p.vy);
    // camera parallax target: slow, and recentres on touch devices when idle
    const idle = p.isTouch && performance.now() - p.lastMove > 1500;
    p.targetX = damp(p.targetX, idle ? 0 : p.x, 2.2, dt);
    p.targetY = damp(p.targetY, idle ? 0 : p.y, 2.2, dt);
  }
}

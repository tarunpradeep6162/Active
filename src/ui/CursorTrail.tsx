import { useEffect, useRef } from 'react';

/**
 * A restrained petal + gold‑dust trail for the mouse (desktop only; off for touch and for
 * reduced motion). Each movement releases 1–3 tiny motes and, now and then, a microscopic
 * petal; everything fades within about a second.
 */
export function CursorTrail() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const fine = matchMedia('(pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cv = ref.current;
    if (!fine || !cv) return;
    const g = cv.getContext('2d')!;
    let dpr = 1;
    const size = () => {
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = innerWidth * dpr;
      cv.height = innerHeight * dpr;
    };
    size();
    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; petal: boolean; rot: number; r: number };
    const ps: P[] = [];
    let lx = -1, ly = -1, raf = 0, idle = true;
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      const speed = Math.hypot(dx, dy);
      lx = e.clientX;
      ly = e.clientY;
      if (speed < 2 || ps.length > 60) return;
      const n = Math.min(3, 1 + Math.floor(speed / 24));
      for (let i = 0; i < n; i++) {
        const petal = Math.random() < 0.08;
        ps.push({ x: e.clientX, y: e.clientY, vx: (Math.random() - 0.5) * 0.6, vy: Math.random() * 0.4 + (petal ? 0.3 : -0.1), life: 0, max: petal ? 1.2 : 0.7 + Math.random() * 0.4, petal, rot: Math.random() * 6.3, r: petal ? 3.2 : 0.8 + Math.random() * 0.9 });
      }
      if (idle) {
        idle = false;
        raf = requestAnimationFrame(tick);
      }
    };
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      g.clearRect(0, 0, cv.width, cv.height);
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life += dt;
        if (p.life >= p.max) {
          ps.splice(i, 1);
          continue;
        }
        p.x += p.vx;
        p.y += p.vy;
        p.rot += dt * 2;
        const a = 1 - p.life / p.max;
        g.save();
        g.translate(p.x * dpr, p.y * dpr);
        if (p.petal) {
          g.rotate(p.rot);
          g.fillStyle = `rgba(232, 166, 181, ${a * 0.85})`;
          g.beginPath();
          g.ellipse(0, 0, p.r * dpr, p.r * 0.55 * dpr, 0, 0, Math.PI * 2);
          g.fill();
        } else {
          g.fillStyle = `rgba(243, 223, 167, ${a})`;
          g.shadowColor = 'rgba(243, 223, 167, .8)';
          g.shadowBlur = 6 * dpr;
          g.beginPath();
          g.arc(0, 0, p.r * dpr, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }
      if (ps.length) raf = requestAnimationFrame(tick);
      else {
        idle = true;
        g.clearRect(0, 0, cv.width, cv.height);
      }
    };
    addEventListener('pointermove', move, { passive: true });
    addEventListener('resize', size);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', move);
      removeEventListener('resize', size);
    };
  }, []);
  return <canvas ref={ref} className="cursor-trail" aria-hidden="true" />;
}

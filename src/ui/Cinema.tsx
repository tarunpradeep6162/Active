import { useEffect, useRef, useState } from 'react';
import { state } from '../core/state';
import { useStore } from './useStore';

/**
 * The film's own moments that sit over the world: the paper flower that opens the night.
 * (Opening and end credits, her constellation and the replay live here too.)
 */

/**
 * The opening: a folded paper flower in the middle of the dark. Its petals open one by one
 * like an invitation being unfolded, then drift apart into the night as the emblem comes to
 * light behind them. Once per visit; never with reduced motion or on a direct chapter link.
 */
export function PaperFlower() {
  const revealed = useStore((s) => s.revealed);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!revealed || state.reducedMotion || location.pathname !== '/' || state.scroll.progress > 0.02) return;
    try {
      if (sessionStorage.getItem('bday-paper-flower')) return;
      sessionStorage.setItem('bday-paper-flower', '1');
    } catch {
      /* private mode: just play it */
    }
    setOn(true);
    const t = window.setTimeout(() => setOn(false), 4600);
    return () => window.clearTimeout(t);
  }, [revealed]);
  // driven frame by frame (not CSS), so it keeps time with the world's own clock
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!on) return;
    const t0 = performance.now();
    let raf = 0;
    const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
    const tick = (now: number) => {
      const t = (now - t0) / 1000;
      const el = svg.current;
      if (!el) return;
      el.style.opacity = String(Math.min(1, t / 0.35) * (1 - ease((t - 3.2) / 1.2)));
      el.querySelectorAll<SVGGElement>('.paperflower__petal').forEach((g) => {
        const a = +g.dataset.a!, d = +g.dataset.d!;
        const open = ease((t - d - 0.3) / 1.6); // folded → open
        const away = ease((t - d - 2.4) / 1.8); // drifting into the night
        const sx = 0.2 + 0.8 * open + 0.2 * away, sy = 0.32 + 0.68 * open + 0.2 * away;
        g.setAttribute('transform', `rotate(${a + 6 * open + 32 * away}) translate(0 ${-120 * away}) scale(${sx} ${sy})`);
        g.style.opacity = String(Math.min(1, (t - d) / 0.25) * (1 - away));
      });
      const glow = el.querySelector<SVGCircleElement>('.paperflower__glow');
      glow?.setAttribute('opacity', String(ease((t - 1) / 1) * (1 - ease((t - 2.8) / 1.4))));
      const heart = el.querySelector<SVGCircleElement>('.paperflower__heart');
      heart?.setAttribute('r', String(2 + 8 * ease((t - 0.8) / 1.4) + 12 * ease((t - 2.6) / 1.6)));
      heart?.setAttribute('opacity', String(ease((t - 0.8) / 1) * (1 - ease((t - 2.8) / 1.4))));
      if (t < 4.6) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  if (!on) return null;
  const petals = Array.from({ length: 10 }, (_, i) => ({ a: (i % 5) * 72 + (i >= 5 ? 36 : 0), inner: i >= 5, i }));
  return (
    <div className="paperflower" aria-hidden="true">
      <svg ref={svg} viewBox="-110 -110 220 220" style={{ opacity: 0 }}>
        <defs>
          <linearGradient id="pf-paper" x1="0" y1="0" x2="0" y2="-1" gradientUnits="objectBoundingBox">
            <stop offset="0" stopColor="#e9d6bf" />
            <stop offset=".55" stopColor="#fbf1e2" />
            <stop offset="1" stopColor="#f6dccf" />
          </linearGradient>
          <radialGradient id="pf-glow">
            <stop offset="0" stopColor="#ffe6b8" stopOpacity=".9" />
            <stop offset="1" stopColor="#ffe6b8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="paperflower__glow" r="70" fill="url(#pf-glow)" opacity="0" />
        {petals.map((p) => (
          <g key={p.i} className={`paperflower__petal ${p.inner ? 'is-inner' : ''}`} data-a={p.a} data-d={(p.inner ? 0.5 : 0) + (p.i % 5) * 0.09} transform={`rotate(${p.a}) scale(.2 .32)`} opacity="0">
            <path d="M0 0 C 20 -18, 26 -58, 0 -86 C -26 -58, -20 -18, 0 0 Z" fill="url(#pf-paper)" />
            {/* the crease down the middle, and the shadow of the fold */}
            <path d="M0 -4 L0 -80" stroke="#c9a98c" strokeWidth=".8" opacity=".7" />
            <path d="M0 0 C -20 -18, -26 -58, 0 -86 Z" fill="#b48a74" opacity=".16" />
          </g>
        ))}
        <circle r="2" fill="#e6c989" className="paperflower__heart" opacity="0" />
      </svg>
    </div>
  );
}

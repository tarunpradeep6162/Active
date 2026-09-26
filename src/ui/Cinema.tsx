import { useEffect, useRef, useState } from 'react';
import { events, state } from '../core/state';
import { useStore } from './useStore';
import { useContent, useProgress } from '../birthday/ui/shared';
import { getProgress } from '../birthday/progress';
import { Signature } from '../birthday/ui/Signature';
import { PROJECTS } from '../app/projects';
import { getJournal, note } from './journal';
import { store } from '../core/state';
import { rangeOf } from '../world/journey';

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

/* ------------------------------------------------------------------ opening credits */

/**
 * The opening titles: as she scrolls through the night, the film's credits come up one at a
 * time in the lower third, like the start of a movie ("A film for Dheepika", "Starring …").
 */
export function OpeningCredits() {
  const c = useContent();
  const section = useStore((s) => s.section);
  const ref = useRef<HTMLDivElement>(null);
  const cards = (c.credits?.opening ?? []).map(([role, name]) => [role, name.replace('{signature}', c.signature)] as const);
  useEffect(() => {
    if (section !== 'intro' || !cards.length) return;
    let raf = 0;
    const tick = () => {
      const el = ref.current;
      if (el) {
        const p = state.sectionProgress, a = 0.14, b = 0.86, seg = (b - a) / cards.length;
        el.querySelectorAll<HTMLElement>('.credit').forEach((node, i) => {
          const l = (p - a - i * seg) / seg;
          const o = l < 0 || l > 1 ? 0 : Math.min(1, l / 0.25, (1 - l) / 0.25);
          node.style.opacity = String(o);
          node.style.transform = `translateY(${(1 - o) * 10}px)`;
          node.style.filter = o < 1 ? `blur(${(1 - o) * 4}px)` : '';
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [section, cards.length]);
  if (section !== 'intro' || !cards.length) return null;
  return (
    <div className="credits-open" ref={ref} aria-hidden="true">
      {cards.map(([role, name], i) => (
        <p className="credit" key={i} style={{ opacity: 0 }}>
          {role && <span className="credit__role">{role}</span>}
          <span className="credit__name">{name}</span>
        </p>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ end credits */

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'];

/**
 * The end credits: the chapters roll up over the sunrise like the end of a film, then a
 * post‑credits scene (the secret ending if she found every heart, and the replay of her night).
 * They roll at the end of the film, or when she asks at the sunrise.
 */
export function EndCredits() {
  const c = useContent();
  const progress = useProgress();
  const [phase, setPhase] = useState<'off' | 'roll' | 'post'>('off');
  const roll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const off = events.on('rollCredits', () => setPhase('roll'));
    return () => void off();
  }, []);
  // the roll: ~32 s, frame by frame; a key, a wheel or a tap skips to the end
  useEffect(() => {
    if (phase !== 'roll') return;
    events.emit('filmCue', 'end');
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const el = roll.current;
      if (!el) return;
      const dur = state.reducedMotion ? 12 : 32;
      const k = (now - t0) / 1000 / dur;
      const h = el.scrollHeight + innerHeight;
      el.style.transform = `translateY(${innerHeight - k * h}px)`;
      if (k >= 1) return setPhase('post');
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const skip = (e: Event) => {
      if (e instanceof KeyboardEvent && !['Escape', 'Enter', ' ', 'ArrowDown'].includes(e.key)) return;
      setPhase('post');
    };
    addEventListener('keydown', skip);
    addEventListener('wheel', skip, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('keydown', skip);
      removeEventListener('wheel', skip);
    };
  }, [phase]);
  if (phase === 'off') return null;
  const hearts = progress.hearts.length;
  return (
    <div className={`endcredits endcredits--${phase}`} role="dialog" aria-label="End credits" onClick={() => phase === 'roll' && setPhase('post')}>
      {phase === 'roll' && (
        <div className="endcredits__roll" ref={roll} style={{ transform: 'translateY(100vh)' }}>
          <p className="endcredits__title">Happy birthday, {c.name}</p>
          <p className="endcredits__date">{c.date}</p>
          <h3>Chapters</h3>
          <ol className="endcredits__chapters">
            {PROJECTS.map((p, i) => (
              <li key={p.slug}>
                <span>{ROMAN[i]}</span> {p.title}
              </li>
            ))}
          </ol>
          <h3>Starring</h3>
          <p>{c.name}</p>
          <h3>With</h3>
          <p>the moon, the candles, twelve lanterns and one sunrise</p>
          <h3>Music</h3>
          <p>an original music box, composed live in your browser</p>
          <h3>Made with love by</h3>
          <Signature className="endcredits__sig" color="#f3dfa7" delay={0.2} />
          <p className="endcredits__closing">{c.credits?.closing ?? 'Happy birthday.'}</p>
        </div>
      )}
      {phase === 'post' && (
        <div className="endcredits__post">
          <p className="endcredits__ps">P.S.</p>
          <p>{hearts >= 14 ? c.finale.secretEnding : hearts ? `There is a tiny hidden heart in every chapter. You have found ${hearts} of 14.` : 'There is a tiny hidden heart in every chapter. Find all fourteen for one last secret.'}</p>
          <div className="endcredits__actions">
            <button type="button" onClick={() => (setPhase('off'), events.emit('replay', undefined))}>
              ▶ Replay your night
            </button>
            <button type="button" onClick={() => setPhase('off')}>
              Back to the sunrise
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ her own constellation */

type Pt = [number, number];
const SKY_KEY = 'bday-sky-stars';
function loadSky(): Pt[][] {
  try {
    const v = JSON.parse(localStorage.getItem(SKY_KEY) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * At the finale she can draw across the sky with a finger or the mouse: every point becomes a
 * star, joined by faint gold lines, and her constellation stays in this sky (on her device).
 * The same corner holds the button that rolls the credits.
 */
export function FinaleTools() {
  const section = useStore((s) => s.section);
  const [show, setShow] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const cv = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Pt[][]>(loadSky());
  const [count, setCount] = useState(() => strokes.current.flat().length);
  // the tools come up once her name is written in the stars
  useEffect(() => {
    if (section !== 'outro') return setShow(false);
    const id = setInterval(() => setShow(state.finaleLocal > 0.6 && !state.filmOn), 400);
    return () => clearInterval(id);
  }, [section]);
  // the stars: drawn while the finale is on screen
  useEffect(() => {
    if (section !== 'outro') return;
    const el = cv.current!;
    const g = el.getContext('2d')!;
    let raf = 0;
    const draw = (now: number) => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      if (el.width !== innerWidth * dpr) (el.width = innerWidth * dpr), (el.height = innerHeight * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, innerWidth, innerHeight);
      const a = Math.min(1, Math.max(0, (state.finaleLocal - 0.5) / 0.1));
      g.globalAlpha = a;
      for (const s of strokes.current) {
        g.strokeStyle = 'rgba(243, 223, 167, .28)';
        g.lineWidth = 1;
        g.beginPath();
        s.forEach(([x, y], i) => (i ? g.lineTo(x * innerWidth, y * innerHeight) : g.moveTo(x * innerWidth, y * innerHeight)));
        g.stroke();
        s.forEach(([x, y], i) => {
          const tw = 0.65 + 0.35 * Math.sin(now / 420 + i * 1.7 + x * 40);
          const r = 7 * tw;
          const px = x * innerWidth, py = y * innerHeight;
          const grd = g.createRadialGradient(px, py, 0, px, py, r * 2.2);
          grd.addColorStop(0, 'rgba(255, 246, 225, 1)');
          grd.addColorStop(0.25, 'rgba(255, 220, 160, .6)');
          grd.addColorStop(1, 'rgba(255, 200, 120, 0)');
          g.fillStyle = grd;
          g.beginPath();
          g.arc(px, py, r * 2.2, 0, Math.PI * 2);
          g.fill();
        });
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [section]);
  // drawing: each few pixels of her stroke leaves a star
  useEffect(() => {
    if (!drawing) return;
    const el = cv.current!;
    let cur: Pt[] | null = null;
    const pt = (e: PointerEvent): Pt => [e.clientX / innerWidth, e.clientY / innerHeight];
    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      cur = [pt(e)];
      strokes.current.push(cur);
      setCount((n) => n + 1);
    };
    const move = (e: PointerEvent) => {
      if (!cur) return;
      const p = pt(e), l = cur[cur.length - 1];
      if (Math.hypot((p[0] - l[0]) * innerWidth, (p[1] - l[1]) * innerHeight) > 34) {
        cur.push(p);
        setCount((n) => n + 1);
        if (cur.length % 3 === 0) events.emit('sfx', 'star');
      }
    };
    const up = () => (cur = null);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, [drawing]);
  const keep = () => {
    setDrawing(false);
    try {
      localStorage.setItem(SKY_KEY, JSON.stringify(strokes.current));
    } catch {
      /* this visit only */
    }
    note({ stars: strokes.current.flat().length });
  };
  if (section !== 'outro') return null;
  return (
    <>
      <canvas ref={cv} className={`skydraw ${drawing ? 'is-drawing' : ''}`} aria-hidden="true" />
      {drawing ? (
        <div className="finale-tools finale-tools--drawing" role="group" aria-label="Draw your stars">
          <span>Draw across the sky. Every point becomes a star.</span>
          <button type="button" onClick={() => ((strokes.current = []), setCount(0))}>
            Clear
          </button>
          <button type="button" onClick={keep}>
            ✓ Keep them
          </button>
        </div>
      ) : (
        show && (
          <div className="finale-tools" role="group" aria-label="The sky">
            <button type="button" onClick={() => setDrawing(true)}>
              ✦ {count ? 'Add to your stars' : 'Draw your own stars'}
            </button>
            <button type="button" onClick={() => events.emit('rollCredits', undefined)}>
              ▸ Roll the credits
            </button>
            <button type="button" onClick={() => events.emit('windowSeat', true)}>
              ☾ Just sit here
            </button>
          </div>
        )
      )}
    </>
  );
}

/* ------------------------------------------------------------------ the replay */

const clock = (t?: number) => (t ? new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');

/** Her night, told back to her as a short film of title cards, from what the site remembered. */
export function Replay() {
  const c = useContent();
  const [on, setOn] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => {
    const off = events.on('replay', () => (setI(0), setOn(true)));
    return () => void off();
  }, []);
  const j = getJournal();
  const p = getProgress();
  const cards: { k: string; big: string; small?: string[] }[] = [];
  if (on) {
    cards.push({ k: 'night', big: 'Your night', small: [j.first ? new Date(j.first).toLocaleDateString([], { day: 'numeric', month: 'long' }) : c.date] });
    if (j.cage) cards.push({ k: 'cage', big: `At ${clock(j.cage)}, you opened the cage.` });
    if (j.candles) cards.push({ k: 'candles', big: `At ${clock(j.candles)}, you blew out the candles`, small: ['and made a wish.'] });
    if (j.wishes.length)
      cards.push({ k: 'wishes', big: `You let ${j.wishes.length} ${j.wishes.length === 1 ? 'wish' : 'wishes'} go:`, small: j.wishes.slice(0, 3).map((w) => c.lanternWishes[w % Math.max(1, c.lanternWishes.length)]).filter(Boolean) });
    if (p.done.length) {
      const first = PROJECTS.find((x) => x.slug === p.done[0]);
      cards.push({ k: 'chapters', big: `You opened ${p.done.length} of 14 chapters.`, small: first ? [`The first was ${first.title}.`] : [] });
    }
    if (p.gift !== null && c.gifts[p.gift]) cards.push({ k: 'gift', big: 'You chose a gift:', small: [c.gifts[p.gift].label] });
    if (p.hearts.length) cards.push({ k: 'hearts', big: `You found ${p.hearts.length} hidden ${p.hearts.length === 1 ? 'heart' : 'hearts'}.` });
    if (j.letterSky) cards.push({ k: 'letter', big: 'You sent my letter to the stars.' });
    if (j.stars) cards.push({ k: 'stars', big: `You drew ${j.stars} stars of your own into the sky.` });
    if (j.film) cards.push({ k: 'film', big: 'You watched our film.' });
    cards.push({ k: 'end', big: 'Thank you for tonight.' });
  }
  const last = cards.length - 1;
  useEffect(() => {
    if (!on) return;
    const id = setTimeout(() => (i < last ? setI(i + 1) : undefined), 3800);
    return () => clearTimeout(id);
  }, [on, i, last]);
  // each card comes up out of a soft blur (frame by frame, in step with the world)
  const cardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!on) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const el = cardRef.current;
      if (!el) return;
      const k = Math.min(1, (now - t0) / 700);
      el.style.opacity = String(k);
      el.style.filter = k < 1 ? `blur(${(1 - k) * 6}px)` : '';
      el.style.transform = `translateY(${(1 - k) * 8}px)`;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, i]);
  if (!on) return null;
  const card = cards[Math.min(i, last)];
  return (
    <div className="replay" role="dialog" aria-label="Your night, replayed" onClick={() => i < last && setI(i + 1)}>
      <div className="replay__card" key={card.k} ref={cardRef} style={{ opacity: 0 }} aria-live="polite">
        <p className="replay__big">{card.big}</p>
        {card.small?.map((s, n) => (
          <p className="replay__small" key={n}>
            {s}
          </p>
        ))}
        {card.k === 'end' && <Signature className="replay__sig" color="#f3dfa7" delay={0.4} />}
      </div>
      <div className="replay__dots" aria-hidden="true">
        {cards.map((x, n) => (
          <span key={x.k} className={n === i ? 'is-on' : ''} />
        ))}
      </div>
      <button type="button" className="replay__close" onClick={(e) => (e.stopPropagation(), setOn(false))}>
        ✕ Close
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ the window seat */

/**
 * "Just sit here": everything on the page goes away and the camera settles on a view (the lake
 * at dawn from the finale, the garden at sunset from anywhere else), letterboxed, with the music
 * soft. Nothing to do. Any tap, key or scroll brings her back.
 */
export function WindowSeat() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const off = events.on('windowSeat', (v) => {
      if (v) {
        const r = state.section === 'outro' ? rangeOf('outro') : rangeOf('work');
        events.emit('scrollTo', r.start + (r.end - r.start) * (state.section === 'outro' ? 0.995 : 0.95));
        if (!store.get().audioOn) events.emit('toggleAudio', undefined);
      }
      setOn(v);
    });
    return () => void off();
  }, []);
  useEffect(() => {
    state.seat = on;
    document.documentElement.classList.toggle('is-seat', on);
    if (!on) return;
    // let the view settle before listening, so the tap that started it doesn't end it
    let armed = false;
    const t = setTimeout(() => (armed = true), 1500);
    const leave = () => armed && events.emit('windowSeat', false);
    addEventListener('pointerdown', leave);
    addEventListener('keydown', leave);
    addEventListener('wheel', leave, { passive: true });
    return () => {
      clearTimeout(t);
      removeEventListener('pointerdown', leave);
      removeEventListener('keydown', leave);
      removeEventListener('wheel', leave);
    };
  }, [on]);
  if (!on) return null;
  return (
    <p className="seat-hint" aria-live="polite">
      ☾ Just sitting here · tap to come back
    </p>
  );
}

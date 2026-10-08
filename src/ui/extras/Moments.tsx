import { useEffect, useRef, useState } from 'react';
import { events, state } from '../../core/state';
import { useStore } from '../useStore';
import { now, nextBirthday, localMood } from '../../core/clock';
import { useContent, reducedMotion } from '../../birthday/ui/shared';
import { buzz } from './haptics';

const q = new URLSearchParams(location.search);
const testing = q.has('qa');
const store = {
  get<T>(k: string, d: T): T {
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : (JSON.parse(v) as T);
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* private mode */
    }
  },
};

/**
 * Her birthday morning: on the day (her local date) every tulip in the garden stays fully open,
 * and the first time she reaches the garden that day a banner greets her.
 */
export function MorningBanner() {
  const c = useContent();
  const section = useStore((s) => s.section);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const check = () => (state.festive = nextBirthday(c.date).today);
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, [c.date]);
  useEffect(() => {
    if (section !== 'work' || !state.festive) return;
    const day = now().toDateString();
    if (store.get('bday-morning-seen', '') === day) return;
    store.set('bday-morning-seen', day);
    setShow(true);
    buzz('bloom');
    const id = setTimeout(() => setShow(false), 7000);
    return () => clearTimeout(id);
  }, [section]);
  if (!show) return null;
  const part = localMood().part;
  const hello = part === 'night' ? 'Tonight' : part === 'evening' ? 'This evening' : part === 'day' ? 'This afternoon' : 'This morning';
  return (
    <div className="morning" role="status" onClick={() => setShow(false)}>
      <p className="morning__kicker">{c.date} · {hello}</p>
      <p className="morning__title">{c.morning.title}, {c.name}</p>
      <p className="morning__line">{c.morning.line}</p>
    </div>
  );
}

/**
 * Make‑a‑wish timer: after she blows out the candles, she can write her wish. It's sealed with
 * wax and kept only on her phone, and on her next birthday the garden gives it back to her:
 * "A year ago, you wished…".
 */
type SealedWish = { text: string; sealed: string; opens: string; shown?: boolean };
const WISH = 'bday-sealed-wish';
export function WishTimer() {
  const c = useContent();
  const [mode, setMode] = useState<'none' | 'write' | 'sealed' | 'reveal'>('none');
  const [text, setText] = useState('');
  const [reveal, setReveal] = useState<SealedWish | null>(null);
  // a wish from a year ago, due today
  useEffect(() => {
    const w = store.get<SealedWish | null>(WISH, null);
    if (w && !w.shown && now() >= new Date(w.opens)) {
      setReveal(w);
      const id = setTimeout(() => setMode('reveal'), 9000);
      return () => clearTimeout(id);
    }
  }, []);
  useEffect(() => {
    const off = events.on('blowCandles', () => {
      if (testing && !q.has('wish')) return;
      const w = store.get<SealedWish | null>(WISH, null);
      if (w && !w.shown) return; // one sealed wish at a time
      setTimeout(() => setMode('write'), 5200);
    });
    return () => {
      off();
    };
  }, []);
  const seal = () => {
    const opens = nextBirthday(c.date, new Date(now().getTime() + 36 * 3600 * 1000)).start;
    store.set(WISH, { text: text.trim(), sealed: now().toISOString(), opens: opens.toISOString() } satisfies SealedWish);
    buzz('click');
    events.emit('sfx', 'seal');
    setMode('sealed');
    setTimeout(() => setMode('none'), 3200);
  };
  const close = () => {
    if (mode === 'reveal' && reveal) store.set(WISH, { ...reveal, shown: true });
    setMode('none');
  };
  if (mode === 'none') return null;
  return (
    <div className="wishseal" role="dialog" aria-modal="true" aria-label="Your wish">
      <div className={`wishseal__card is-${mode}`}>
        {mode === 'write' && (
          <>
            <p className="wishseal__kicker">your wish</p>
            <h3>Write it down, if you like</h3>
            <p className="wishseal__note">Only you will ever see it. It stays sealed on your phone until your next birthday, and then the garden gives it back to you.</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={400} placeholder="I wish…" autoFocus />
            <div className="wishseal__row">
              <button type="button" onClick={seal} disabled={!text.trim()}>
                Seal it until next year
              </button>
              <button type="button" className="wishseal__skip" onClick={close}>
                Keep it in my heart
              </button>
            </div>
          </>
        )}
        {mode === 'sealed' && (
          <div className="wishseal__wax" aria-live="polite">
            <span>♥</span>
            <p>Sealed until {c.date}</p>
          </div>
        )}
        {mode === 'reveal' && reveal && (
          <>
            <p className="wishseal__kicker">sealed {new Date(reveal.sealed).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <h3>A year ago, you wished…</h3>
            <p className="wishseal__text">“{reveal.text}”</p>
            <p className="wishseal__note">I hope it came true. And if it didn’t yet, there’s a whole new year for it.</p>
            <div className="wishseal__row">
              <button type="button" onClick={close}>
                Keep going ♥
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Shake the phone: a burst of petals falls across whatever she is looking at. (On a phone only;
 * nothing with reduced motion.)
 */
export function ShakePetals() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!matchMedia('(pointer: coarse)').matches || reducedMotion() || typeof DeviceMotionEvent === 'undefined') return;
    let peaks: number[] = [];
    let quietUntil = 0;
    const on = (e: DeviceMotionEvent) => {
      const a = e.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;
      const m = Math.hypot(a.x, a.y, a.z);
      const t = performance.now();
      if (m < 24 || t < quietUntil) return;
      peaks = peaks.filter((p) => t - p < 700);
      peaks.push(t);
      if (peaks.length >= 3) {
        peaks = [];
        quietUntil = t + 2500;
        setBurst((b) => b + 1);
        buzz('flutter');
      }
    };
    addEventListener('devicemotion', on);
    return () => removeEventListener('devicemotion', on);
  }, []);
  useEffect(() => {
    if (!burst) return;
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    const dpr = Math.min(3, devicePixelRatio || 1);
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    const W = cv.width, H = cv.height;
    const cols = ['#f6c3cf', '#e8a6b5', '#fbe3e8', '#d98b9d', '#f3dfa7'];
    const ps = Array.from({ length: 90 }, () => ({
      x: Math.random() * W,
      y: -Math.random() * H * 0.6 - 20,
      vy: (90 + Math.random() * 140) * dpr,
      sway: Math.random() * Math.PI * 2,
      sw: (20 + Math.random() * 40) * dpr,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 4,
      s: (7 + Math.random() * 9) * dpr,
      c: cols[(Math.random() * cols.length) | 0],
    }));
    let raf = 0, last = performance.now(), t = 0;
    const frame = (n: number) => {
      const dt = Math.min(0.05, (n - last) / 1000);
      last = n;
      t += dt;
      g.clearRect(0, 0, W, H);
      const fade = Math.min(1, Math.max(0, (6 - t) / 1.2));
      for (const p of ps) {
        p.y += p.vy * dt;
        p.sway += dt * 1.6;
        p.r += p.vr * dt;
        const x = p.x + Math.sin(p.sway) * p.sw;
        g.save();
        g.translate(x, p.y);
        g.rotate(p.r);
        g.scale(1, 0.55 + 0.45 * Math.abs(Math.sin(p.sway * 1.3)));
        g.globalAlpha = 0.9 * fade;
        g.fillStyle = p.c;
        g.beginPath();
        g.moveTo(0, -p.s);
        g.bezierCurveTo(p.s * 0.9, -p.s * 0.5, p.s * 0.7, p.s * 0.7, 0, p.s);
        g.bezierCurveTo(-p.s * 0.7, p.s * 0.7, -p.s * 0.9, -p.s * 0.5, 0, -p.s);
        g.fill();
        g.restore();
      }
      if (t < 6) raf = requestAnimationFrame(frame);
      else g.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [burst]);
  // (no canvas at all until the first shake)
  return burst ? <canvas key={burst} ref={ref} className="petalburst" aria-hidden="true" /> : null;
}

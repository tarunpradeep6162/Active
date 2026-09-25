import { useEffect, useRef, useState } from 'react';
import { events } from '../core/state';
import { useContent } from '../birthday/ui/shared';

/**
 * Her birthday, on her own clock (the device's local time). Before the day, the opening counts
 * down to it; on the day it says so; and at midnight, or the first time she opens the site on
 * the day, a surprise plays over whatever she is looking at: the screen goes dark, a title card
 * wishes her happy birthday, and rose and champagne fireworks fill the sky.
 *
 * For testing only: `?qa=1&now=2026-11-24T23:59:50` (or `&debug=1`) pretends the clock reads
 * that time, and keeps running from there.
 */

const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const fake = (q.has('qa') || q.has('debug')) && q.get('now') ? Date.parse(q.get('now')!) : NaN;
const offset = Number.isNaN(fake) ? 0 : fake - Date.now();
export const now = () => new Date(Date.now() + offset);

/** the day and month from the site's date ("25 · 11"), or 25 November */
function birthday(date: string) {
  const [d, m] = (date.match(/\d+/g) ?? []).map(Number);
  return { day: d >= 1 && d <= 31 ? d : 25, month: m >= 1 && m <= 12 ? m : 11 };
}
/** local midnight at the start of her next (or current) birthday */
function nextBirthday(date: string, from: Date) {
  const { day, month } = birthday(date);
  const y = from.getFullYear();
  const start = new Date(y, month - 1, day);
  const end = new Date(y, month - 1, day + 1);
  if (from >= end) return { start: new Date(y + 1, month - 1, day), today: false };
  return { start, today: from >= start };
}

const SEEN = 'bday-midnight-seen';
const seenThisYear = (y: number) => {
  try {
    return localStorage.getItem(SEEN) === String(y);
  } catch {
    return false;
  }
};
const markSeen = (y: number) => {
  try {
    localStorage.setItem(SEEN, String(y));
  } catch {
    /* private mode: it may play again on the day, which is fine */
  }
};

/** Shown in the opening, under the date: the countdown, or "today". */
export function Countdown() {
  const c = useContent();
  const [t, setT] = useState(now);
  useEffect(() => {
    const id = window.setInterval(() => setT(now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const { start, today } = nextBirthday(c.date, t);
  if (today)
    return (
      <p className="countdown countdown--today" aria-live="polite">
        <span>It’s today</span> ♥
      </p>
    );
  const s = Math.max(0, Math.floor((start.getTime() - t.getTime()) / 1000));
  const days = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <p className="countdown" aria-label={`${days} days, ${h} hours and ${m} minutes until your birthday`}>
      {[
        [days, days === 1 ? 'day' : 'days'],
        [pad(h), 'hours'],
        [pad(m), 'minutes'],
        [pad(sec), 'seconds'],
      ].map(([v, l]) => (
        <span key={l} className="countdown__unit">
          <b>{v}</b>
          <i>{l}</i>
        </span>
      ))}
    </p>
  );
}

/** The midnight surprise, over every page. */
export function MidnightSurprise() {
  const c = useContent();
  const [on, setOn] = useState(false);
  useEffect(() => {
    const play = () => {
      const y = now().getFullYear();
      if (seenThisYear(y)) return;
      markSeen(y);
      setOn(true);
      events.emit('birthdayMidnight', undefined);
    };
    // already her birthday when she opens it: play once, after the site has settled
    let id = 0;
    if (nextBirthday(c.date, now()).today) id = window.setTimeout(play, 2500);
    // otherwise, watch the clock for midnight
    const tick = window.setInterval(() => nextBirthday(c.date, now()).today && play(), 1000);
    return () => {
      window.clearTimeout(id);
      window.clearInterval(tick);
    };
  }, [c.date]);
  const close = () => setOn(false);
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [on]);
  if (!on) return null;
  return (
    <div className="midnight" role="dialog" aria-modal="true" aria-label={`Happy birthday, ${c.name}`}>
      <Fireworks />
      <div className="midnight__card">
        <p className="midnight__time">00:00 · {c.date}</p>
        <h2 className="midnight__title">Happy birthday</h2>
        <p className="midnight__name">{c.name}</p>
        <p className="midnight__line">It’s your day. The whole garden has been waiting for it.</p>
        <button type="button" className="midnight__go" onClick={close} autoFocus>
          Open your garden ♥
        </button>
      </div>
    </div>
  );
}

/** Rose and champagne fireworks on a 2D canvas: rockets with trails, bursts that fall and fade. */
function Fireworks() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const size = () => {
      cv.width = innerWidth * dpr;
      cv.height = innerHeight * dpr;
    };
    size();
    addEventListener('resize', size);
    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; hue: string; rocket?: { ty: number } };
    const ps: P[] = [];
    const cols = ['255,214,154', '255,168,188', '255,236,210', '240,140,170', '255,196,120'];
    let next = 0, raf = 0, last = performance.now(), t = 0;
    const launch = () => {
      const W = cv.width, H = cv.height;
      ps.push({ x: W * (0.15 + Math.random() * 0.7), y: H, vx: (Math.random() - 0.5) * 60 * dpr, vy: -(H * (0.9 + Math.random() * 0.35)), life: 0, max: 9, hue: cols[(Math.random() * cols.length) | 0], rocket: { ty: H * (0.18 + Math.random() * 0.3) } });
    };
    const burst = (x: number, y: number, hue: string) => {
      const n = 70 + ((Math.random() * 50) | 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, sp = (140 + Math.random() * 170) * dpr;
        ps.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 1.6 + Math.random() * 1.2, hue });
      }
    };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      // long exposure: the previous frame fades rather than clears, leaving trails
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = 'rgba(0,0,0,.22)';
      g.fillRect(0, 0, cv.width, cv.height);
      g.globalCompositeOperation = 'lighter';
      next -= dt;
      if (next <= 0 && t < 22) {
        launch();
        if (Math.random() < 0.35) launch();
        next = 0.55 + Math.random() * 0.7;
      }
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life += dt;
        if (p.rocket) {
          p.vy += cv.height * 0.55 * dt;
          if (p.y <= p.rocket.ty || p.vy >= 0) {
            burst(p.x, p.y, p.hue);
            ps.splice(i, 1);
            continue;
          }
        } else {
          p.vx *= 0.985;
          p.vy = p.vy * 0.985 + 60 * dpr * dt;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const k = 1 - p.life / p.max;
        if (k <= 0) {
          ps.splice(i, 1);
          continue;
        }
        const r = (p.rocket ? 2.2 : 1.6) * dpr;
        g.fillStyle = `rgba(${p.hue},${p.rocket ? 0.9 : k * (0.6 + 0.4 * Math.random())})`;
        g.beginPath();
        g.arc(p.x, p.y, r, 0, Math.PI * 2);
        g.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', size);
    };
  }, []);
  return <canvas ref={ref} className="midnight__fireworks" aria-hidden="true" />;
}

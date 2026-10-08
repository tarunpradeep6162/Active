import { useEffect, useRef, useState } from 'react';
import { useContent, useProgress, useTypewriter } from '../../../birthday/ui/shared';
import { local } from '../local';
import { buzz } from '../haptics';
import { events } from '../../../core/state';
import { savePng } from '../../../birthday/keepsakes';
import { SERIF } from '../../../utils/fonts';

/* ------------------------------------------------------------------ 12 · Open when… */

const OPENED = 'bday-openwhen-opened';
/** Sealed envelopes ("Open when you miss me" …): she breaks the wax and the letter writes itself. */
export function OpenWhen() {
  const c = useContent();
  const [opened, setOpened] = useState<number[]>(() => local.get(OPENED, []));
  const [open, setOpen] = useState<number | null>(null);
  const read = (i: number) => {
    setOpen(i);
    if (!opened.includes(i)) {
      const next = [...opened, i];
      setOpened(next);
      local.set(OPENED, next);
      buzz('click');
      events.emit('sfx', 'seal');
    }
  };
  return (
    <div className="ow">
      <p className="sheet__intro">Letters for later. Open each one only when the moment comes.</p>
      <div className="ow__grid">
        {c.openWhen.map((l, i) => (
          <button key={i} type="button" className={`ow__env ${opened.includes(i) ? 'is-opened' : ''}`} onClick={() => read(i)}>
            <span className="ow__flap" aria-hidden="true" />
            <span className="ow__seal" aria-hidden="true">
              ♥
            </span>
            <span className="ow__label">
              <i>Open when</i> {l.when}
            </span>
          </button>
        ))}
      </div>
      {open !== null && <Letter when={c.openWhen[open].when} text={c.openWhen[open].text} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Letter({ when, text, onClose }: { when: string; text: string; onClose: () => void }) {
  const shown = useTypewriter(text, true, 48);
  return (
    <div className="ow__letter" role="dialog" aria-label={`Open when ${when}`} onClick={onClose}>
      <div className="ow__paper" onClick={(e) => e.stopPropagation()}>
        <p className="ow__when">Open when {when}</p>
        <p className="ow__text" aria-label={text}>
          {shown}
          <span className="ow__caret" aria-hidden="true" />
        </p>
        <button type="button" className="sheet__btn" onClick={onClose}>
          Fold it back
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 13 · Our year in numbers */

const daysSince = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.max(0, Math.floor((Date.now() - t) / 86400000));
};

/** Animated counters: from your real numbers (content) and from the garden itself. */
export function Numbers() {
  const c = useContent();
  const prog = useProgress();
  const items: { value: number | null; label: string; suffix?: string }[] = [
    { value: c.numbers.since ? daysSince(c.numbers.since) : null, label: 'days since our story began' },
    { value: c.timeline.length, label: 'moments on our timeline' },
    { value: c.reasons.length, label: 'reasons I love you, and counting' },
    { value: c.wishes.length, label: 'wishes for your year' },
    ...c.numbers.items,
    { value: prog.hearts.length, label: 'hidden hearts you’ve found' },
  ].filter((x) => x.value !== null || x.suffix);
  const save = () => {
    const W = 1080, H = 1350, cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d')!;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#070914');
    bg.addColorStop(1, '#2a1622');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.fillStyle = '#e6c989';
    g.font = "26px 'Share Tech Mono', monospace";
    g.fillText('O U R   Y E A R   I N   N U M B E R S', W / 2, 150);
    items.slice(0, 7).forEach((it, i) => {
      const y = 290 + i * 145;
      g.fillStyle = '#f3dfa7';
      g.font = `500 84px ${SERIF}`;
      g.fillText(it.value === null ? it.suffix ?? '' : `${it.value.toLocaleString()}${it.suffix ?? ''}`, W / 2, y);
      g.fillStyle = 'rgba(248, 241, 232, .75)';
      g.font = `italic 500 34px ${SERIF}`;
      g.fillText(it.label, W / 2, y + 46);
    });
    g.fillStyle = '#e8a6b5';
    g.font = "26px 'Share Tech Mono', monospace";
    g.fillText(`${c.name.toUpperCase()} · ${c.date}`, W / 2, H - 80);
    savePng(cv, 'our-year-in-numbers.png');
  };
  return (
    <div className="num">
      <div className="num__grid">
        {items.map((it, i) => (
          <div key={i} className="num__tile" style={{ ['--i' as string]: i }}>
            <b>{it.value === null ? it.suffix : <Count to={it.value} suffix={it.suffix} delay={i * 180} />}</b>
            <span>{it.label}</span>
          </div>
        ))}
      </div>
      {!c.numbers.since && <p className="sheet__note">[Add the day your story began, and your own numbers, in the content file.]</p>}
      <button type="button" className="sheet__btn" onClick={save}>
        Save as an image
      </button>
    </div>
  );
}

function Count({ to, suffix = '', delay = 0 }: { to: number; suffix?: string; delay?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + delay;
    const dur = 1400 + Math.min(1200, to * 2);
    const tick = (n: number) => {
      const k = Math.min(1, Math.max(0, (n - t0) / dur));
      setV(Math.round(to * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delay]);
  return (
    <>
      {v.toLocaleString()}
      {suffix}
    </>
  );
}

/* ------------------------------------------------------------------ 14 · Two stars */

/** Picks n well‑spread points inside a glyph (farthest‑point sampling), in drawing order. */
function glyphStars(ch: string, n: number): [number, number][] {
  const S = 160, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `600 ${ch === '♥' ? 130 : 150}px ${SERIF}`;
  g.fillText(ch, S / 2, S / 2 + 8);
  const d = g.getImageData(0, 0, S, S).data;
  const pts: [number, number][] = [];
  for (let y = 0; y < S; y += 3) for (let x = 0; x < S; x += 3) if (d[(y * S + x) * 4 + 3] > 128) pts.push([x / S, y / S]);
  if (!pts.length) return [[0.5, 0.5]];
  // start at the top‑left‑most point, then always the farthest from those chosen
  const out: [number, number][] = [pts.reduce((a, b) => (b[0] + b[1] < a[0] + a[1] ? b : a))];
  const dist = pts.map((p) => Math.hypot(p[0] - out[0][0], p[1] - out[0][1]));
  while (out.length < n) {
    let k = 0;
    for (let i = 1; i < pts.length; i++) if (dist[i] > dist[k]) k = i;
    out.push(pts[k]);
    for (let i = 0; i < pts.length; i++) dist[i] = Math.min(dist[i], Math.hypot(pts[i][0] - pts[k][0], pts[i][1] - pts[k][1]));
  }
  // order them as a path: nearest neighbour from the first
  const path = [out.shift()!];
  while (out.length) {
    const p = path[path.length - 1];
    let k = 0;
    for (let i = 1; i < out.length; i++) if (Math.hypot(out[i][0] - p[0], out[i][1] - p[1]) < Math.hypot(out[k][0] - p[0], out[k][1] - p[1])) k = i;
    path.push(out.splice(k, 1)[0]);
  }
  return path;
}

const PER = 7; // stars per letter

/** Her initial and yours as constellations: she joins the stars in order with taps. */
export function TwoStars() {
  const c = useContent();
  const you = c.us.you.trim() || '♥';
  const ref = useRef<HTMLCanvasElement>(null);
  const [stars] = useState(() => {
    const a = glyphStars(c.us.her.trim() || c.name[0], PER).map(([x, y]) => [0.06 + x * 0.42, 0.2 + y * 0.56] as [number, number]);
    const b = glyphStars(you, PER).map(([x, y]) => [0.52 + x * 0.42, 0.2 + y * 0.56] as [number, number]);
    return [...a, ...b];
  });
  const [n, setN] = useState(0); // stars joined so far
  const done = n >= stars.length;
  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    let raf = 0;
    const draw = (t: number) => {
      const dpr = Math.min(3, devicePixelRatio || 1);
      const W = cv.clientWidth * dpr, H = cv.clientHeight * dpr;
      if (cv.width !== W || cv.height !== H) (cv.width = W), (cv.height = H);
      g.clearRect(0, 0, W, H);
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(243, 223, 167, .75)';
      g.lineWidth = 1.6 * dpr;
      g.shadowColor = 'rgba(243, 223, 167, .8)';
      g.shadowBlur = 8 * dpr;
      g.beginPath();
      for (let i = 1; i < Math.min(n, stars.length); i++) {
        if (i === PER) continue; // the two letters stay apart until the end
        g.moveTo(stars[i - 1][0] * W, stars[i - 1][1] * H);
        g.lineTo(stars[i][0] * W, stars[i][1] * H);
      }
      g.stroke();
      if (done) {
        // and one long line joining the two of you
        g.strokeStyle = 'rgba(232, 166, 181, .85)';
        g.setLineDash([4 * dpr, 6 * dpr]);
        g.lineDashOffset = -t / 40;
        g.beginPath();
        g.moveTo(stars[PER - 1][0] * W, stars[PER - 1][1] * H);
        g.quadraticCurveTo(W / 2, H * 0.08, stars[PER][0] * W, stars[PER][1] * H);
        g.stroke();
        g.setLineDash([]);
      }
      g.shadowBlur = 0;
      stars.forEach(([x, y], i) => {
        const next = i === n && !done;
        const lit = i < n;
        const r = (lit ? 3.4 : next ? 3.2 + Math.sin(t / 180) * 1.2 : 2.2) * dpr;
        const halo = g.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * 6);
        halo.addColorStop(0, lit ? 'rgba(255, 240, 200, .55)' : next ? 'rgba(232, 166, 181, .55)' : 'rgba(255,255,255,.15)');
        halo.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = halo;
        g.beginPath();
        g.arc(x * W, y * H, r * 6, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = lit ? '#fff4d6' : next ? '#f6c3cf' : 'rgba(255,255,255,.7)';
        g.beginPath();
        g.arc(x * W, y * H, r, 0, Math.PI * 2);
        g.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [n, done, stars]);
  const tap = (e: React.PointerEvent) => {
    if (done) return;
    const r = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const [sx, sy] = stars[n];
    if (Math.hypot(e.clientX - r.left - sx * r.width, e.clientY - r.top - sy * r.height) < 36) {
      setN(n + 1);
      buzz(n + 1 === stars.length ? 'bloom' : 'soft');
      events.emit('sfx', 'star');
    }
  };
  return (
    <div className="two">
      <p className="sheet__intro">{done ? ' ' : n === 0 ? 'Tap the glowing star, then the next, and the next…' : n < PER ? 'Keep going…' : 'Now the other one…'}</p>
      <canvas ref={ref} className="two__sky" onPointerDown={tap} aria-label="Two constellations: tap the glowing star to join them" />
      {done && <p className="two__line">{c.us.line}</p>}
      {done && (
        <button type="button" className="sheet__btn" onClick={() => setN(0)}>
          Draw them again
        </button>
      )}
    </div>
  );
}

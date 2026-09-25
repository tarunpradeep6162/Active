import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SignatureInk } from '../types';
import { useContent } from './shared';

/**
 * Your handwritten signature. Sign once on the private signing page (`/?sign`); it is saved
 * as pen strokes, and wherever the site signs off (the end of the letter, One last thing, For
 * you) it is drawn stroke by stroke, as if written in front of her. Until you have signed,
 * the sign‑off words are written out in handwriting instead.
 *
 * The strokes live in the content (`signatureInk`), so they can go in the public content or,
 * with the rest of the private material, in the encrypted vault. Signing on this device also
 * previews it here straight away (kept only in this browser).
 */

const PREVIEW = 'bday-signature-preview';
function preview(): SignatureInk | null {
  try {
    const v = JSON.parse(localStorage.getItem(PREVIEW) ?? 'null');
    return v && Array.isArray(v.strokes) ? v : null;
  } catch {
    return null;
  }
}

/** Draws the signature (or the sign‑off words in handwriting), once it is on screen. */
export function Signature({ className = '', color = 'currentColor', delay = 0 }: { className?: string; color?: string; delay?: number }) {
  const c = useContent();
  const ink = c.signatureInk ?? preview();
  const ref = useRef<SVGSVGElement>(null);
  const [go, setGo] = useState(false);
  // start drawing when it scrolls into view
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setGo(true), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // each stroke is drawn after the last, at the speed of a steady hand
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let at = delay;
    el.querySelectorAll<SVGGeometryElement>('.sig__stroke').forEach((p) => {
      const len = p.getTotalLength?.() ?? 400;
      const dur = Math.max(0.25, len / 520);
      p.style.setProperty('--len', String(Math.ceil(len) + 2));
      p.style.setProperty('--dur', `${dur}s`);
      p.style.setProperty('--at', `${at}s`);
      at += dur + 0.08;
    });
  }, [ink]);
  if (ink)
    return (
      <svg ref={ref} className={`sig ${go ? 'is-drawing' : ''} ${className}`} viewBox={`0 0 ${ink.w} ${ink.h}`} role="img" aria-label={`Signed: ${c.signature}`}>
        {ink.strokes.map((d, i) => (
          <path key={i} className="sig__stroke" d={d} stroke={color} />
        ))}
      </svg>
    );
  // not signed yet: the words, written out in handwriting (outline drawn, then the ink fills in)
  return (
    <svg ref={ref} className={`sig sig--words ${go ? 'is-drawing' : ''} ${className}`} viewBox="0 0 400 90" role="img" aria-label={c.signature}>
      <text className="sig__stroke sig__text" x="10" y="62" stroke={color} fill={color} style={{ ['--len' as string]: 1400, ['--dur' as string]: '2.4s', ['--at' as string]: `${delay}s` }}>
        {c.signature}
      </text>
    </svg>
  );
}

/** The private signing page: draw, see it written back, then copy it (or keep it on this device). */
export function SignPad() {
  const ref = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<{ x: number; y: number }[][]>([]);
  const [ink, setInk] = useState<SignatureInk | null>(null);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const fit = () => {
      cv.width = cv.clientWidth * dpr;
      cv.height = cv.clientHeight * dpr;
      redraw();
    };
    const redraw = () => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      g.lineCap = g.lineJoin = 'round';
      g.lineWidth = 3;
      g.strokeStyle = '#3b2620';
      for (const s of strokes.current) {
        g.beginPath();
        s.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
        g.stroke();
      }
    };
    let cur: { x: number; y: number }[] | null = null;
    const pos = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: PointerEvent) => {
      cv.setPointerCapture(e.pointerId);
      cur = [pos(e)];
      strokes.current.push(cur);
    };
    const move = (e: PointerEvent) => {
      if (!cur) return;
      const p = pos(e);
      const l = cur[cur.length - 1];
      if (Math.hypot(p.x - l.x, p.y - l.y) > 1.5) cur.push(p);
      redraw();
    };
    const up = () => {
      cur = null;
      setInk(toInk(strokes.current));
    };
    fit();
    addEventListener('resize', fit);
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    (cv as unknown as { clear: () => void }).clear = () => {
      strokes.current = [];
      setInk(null);
      redraw();
    };
    return () => removeEventListener('resize', fit);
  }, []);
  const code = ink ? JSON.stringify(ink) : '';
  return (
    <main className="signpad">
      <h1>Your signature</h1>
      <p>Sign in the box with your finger or the mouse, the way you sign a card. It will be drawn, stroke by stroke, where the site signs off to her.</p>
      <canvas ref={ref} className="signpad__canvas" aria-label="Signature pad" />
      <div className="signpad__row">
        <button type="button" onClick={() => (ref.current as unknown as { clear: () => void }).clear()}>
          Clear
        </button>
        <button
          type="button"
          disabled={!ink}
          onClick={() => {
            try {
              localStorage.setItem(PREVIEW, code);
              setCopied('Kept on this device: open the site here to see it in place.');
            } catch {
              setCopied('This browser would not keep it; copy the code instead.');
            }
          }}
        >
          Preview on this device
        </button>
        <button
          type="button"
          disabled={!ink}
          onClick={() => navigator.clipboard?.writeText(code).then(() => setCopied('Copied. Send it to me (or paste it into signatureInk) and it goes into the site.'), () => setCopied('Select the code below and copy it.'))}
        >
          Copy the code
        </button>
      </div>
      {copied && <p className="signpad__note">{copied}</p>}
      {ink && (
        <>
          <p className="signpad__label">How it will be written:</p>
          <div className="signpad__preview" key={code}>
            <InkPreview ink={ink} />
          </div>
          <textarea className="signpad__code" readOnly value={code} rows={3} onFocus={(e) => e.currentTarget.select()} />
        </>
      )}
    </main>
  );
}

function InkPreview({ ink }: { ink: SignatureInk }) {
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    let at = 0.2;
    ref.current?.querySelectorAll<SVGPathElement>('path').forEach((p) => {
      const len = p.getTotalLength();
      const dur = Math.max(0.25, len / 520);
      p.style.setProperty('--len', String(Math.ceil(len) + 2));
      p.style.setProperty('--dur', `${dur}s`);
      p.style.setProperty('--at', `${at}s`);
      at += dur + 0.08;
    });
  }, [ink]);
  return (
    <svg ref={ref} className="sig is-drawing" viewBox={`0 0 ${ink.w} ${ink.h}`}>
      {ink.strokes.map((d, i) => (
        <path key={i} className="sig__stroke" d={d} stroke="#3b2620" />
      ))}
    </svg>
  );
}

/** pen strokes → smooth SVG paths, cropped to the ink and rounded to keep the code short */
function toInk(strokes: { x: number; y: number }[][]): SignatureInk | null {
  const all = strokes.flat();
  if (all.length < 4) return null;
  const pad = 6;
  const x0 = Math.min(...all.map((p) => p.x)) - pad, y0 = Math.min(...all.map((p) => p.y)) - pad;
  const x1 = Math.max(...all.map((p) => p.x)) + pad, y1 = Math.max(...all.map((p) => p.y)) + pad;
  const r = (v: number) => Math.round(v * 10) / 10;
  const paths = strokes
    .filter((s) => s.length > 1)
    .map((s) => {
      const pts = s.map((p) => ({ x: r(p.x - x0), y: r(p.y - y0) }));
      let d = `M${pts[0].x} ${pts[0].y}`;
      // quadratic curves through the midpoints: smooth, like ink
      for (let i = 1; i < pts.length - 1; i++) d += `Q${pts[i].x} ${pts[i].y} ${r((pts[i].x + pts[i + 1].x) / 2)} ${r((pts[i].y + pts[i + 1].y) / 2)}`;
      const l = pts[pts.length - 1];
      return d + `L${l.x} ${l.y}`;
    });
  return { w: r(x1 - x0), h: r(y1 - y0), strokes: paths };
}

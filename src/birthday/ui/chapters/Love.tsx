import { useEffect, useRef, useState } from 'react';
import { events, state } from '../../../core/state';
import { HiddenHeart, ParticleText, useContent, useTypewriter } from '../shared';
import type { ChapterProps } from '../ChapterView';
import { saveLetterPdf } from '../../keepsakes';

/* 3 ── A letter I never said out loud: a sealed envelope, then the letter writes itself. */
export function Letter({ slug, onDone }: ChapterProps) {
  const c = useContent();
  const [open, setOpen] = useState(false);
  const full = [c.letter.greeting, ...c.letter.paragraphs, c.letter.signoff].join('\n\n');
  const text = useTypewriter(full, open, 42);
  useEffect(() => {
    if (open && text.length === full.length) onDone();
  }, [open, text]);
  return (
    <div className="bd-letter">
      {!open ? (
        <button type="button" className="bd-envelope" onClick={() => setOpen(true)} aria-label="Open the letter">
          <span className="bd-envelope__flap" />
          <span className="bd-envelope__seal">♥</span>
        </button>
      ) : (
        <div className="bd-paper" aria-live="polite">
          {text.split('\n\n').map((p, k) => (
            <p key={k}>{p}</p>
          ))}
          <span className="bd-caret" aria-hidden="true" />
        </div>
      )}
      {open && text.length === full.length && (
        <button type="button" className="bd-link" onClick={() => saveLetterPdf(c)}>
          Keep this letter (PDF)
        </button>
      )}
      {!open && (
        <button type="button" className="bd-btn" onClick={() => setOpen(true)}>
          Open my letter
        </button>
      )}
      {!open && <p className="bd-hint">Sealed. For you only.</p>}
      <HiddenHeart slug={slug} style={{ right: '8%', bottom: '6%' }} />
    </div>
  );
}

/* 4 ── 14 Things I Love About You, then the Constellation of Her. */
export function Reasons({ slug, onDone }: ChapterProps) {
  const c = useContent();
  const [seen, setSeen] = useState<number[]>([]);
  const [cur, setCur] = useState<number | null>(null);
  const [letter, setLetter] = useState<number | null>(null);
  const all = seen.length >= c.reasons.length;
  useEffect(() => {
    if (all) onDone();
  }, [all]);
  const letters = c.name.toUpperCase().split('');
  return (
    <div className={`bd-reasons ${all ? 'is-constellation' : ''}`}>
      <svg className="bd-reasons__lines" viewBox="-50 -50 100 100" aria-hidden="true">
        {all && c.reasons.map((_, k) => {
          const a = star(k, c.reasons.length), b = star((k + 1) % c.reasons.length, c.reasons.length);
          return <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} style={{ animationDelay: `${k * 0.12}s` }} />;
        })}
      </svg>
      {c.reasons.map((_, k) => {
        const p = star(k, c.reasons.length);
        return (
          <button
            key={k}
            type="button"
            className={`bd-reason-star ${seen.includes(k) ? 'is-seen' : ''}`}
            style={{ left: `${50 + p.x}%`, top: `${50 + p.y}%` }}
            aria-label={`Reason ${k + 1}`}
            onClick={() => {
              setCur(k);
              setSeen((s) => (s.includes(k) ? s : [...s, k]));
            }}
          >
            ✦
          </button>
        );
      })}
      <div className="bd-reasons__centre">
        {all ? (
          <h2 className="bd-reasons__name">
            {letters.map((l, k) => (
              <button key={k} type="button" onClick={() => setLetter(k)} aria-label={`Letter ${l}`}>
                {l}
              </button>
            ))}
          </h2>
        ) : (
          <h2 className="bd-reasons__name">{c.name}</h2>
        )}
        <p className="bd-reasons__text" aria-live="polite">
          {letter !== null ? c.nameLetters[letter] ?? '' : cur !== null ? c.reasons[cur] : 'Touch a star.'}
        </p>
        <p className="bd-meta">{all ? 'Constellation of Her — touch a letter' : `${seen.length} / ${c.reasons.length}`}</p>
      </div>
      <HiddenHeart slug={slug} style={{ left: '3%', top: '3%' }} />
    </div>
  );
}
function star(k: number, n: number) {
  const a = (k / n) * Math.PI * 2 - Math.PI / 2;
  const r = 38 + (k % 2 ? -4 : 3);
  return { x: Math.cos(a) * r, y: Math.sin(a) * r * 0.86 };
}

/* 11 ── Make a Wish: close your eyes, then hold (or blow) to put the candle out. */
export function Wish({ slug, onDone }: ChapterProps) {
  const c = useContent();
  const [stage, setStage] = useState<'ready' | 'holding' | 'out'>('ready');
  const [hold, setHold] = useState(0);
  const raf = useRef(0);
  const stopMicRef = useRef<() => void>(() => {});
  const blowOut = () => {
    stopMicRef.current();
    state.wishHold = 0;
    setStage('out');
    // the wish's light climbs the whole garden; every flower already visited glows as it passes
    events.emit('wishLight', undefined);
    onDone();
  };
  const startHold = () => {
    if (stage !== 'ready') return; // key repeat / double pointerdown must not start a second loop
    setStage('holding');
    const t0 = performance.now();
    const tick = () => {
      const h = Math.min(1, (performance.now() - t0) / 1800);
      setHold(h);
      state.wishHold = h;
      if (h >= 1) return blowOut();
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const stopHold = () => {
    cancelAnimationFrame(raf.current);
    if (stage === 'holding') {
      setStage('ready');
      setHold(0);
      state.wishHold = 0;
    }
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  // optional: blow into the microphone (only if she chooses to allow it)
  const [mic, setMic] = useState<'off' | 'on' | 'denied'>('off');
  const micRef = useRef<{ stream: MediaStream; ctx: AudioContext; raf: number } | null>(null);
  const stopMic = () => {
    const m = micRef.current;
    if (!m) return;
    cancelAnimationFrame(m.raf);
    m.stream.getTracks().forEach((t) => t.stop());
    m.ctx.close().catch(() => {});
    micRef.current = null;
  };
  stopMicRef.current = stopMic;
  // leaving the chapter must always release the microphone
  useEffect(() => () => {
    stopMicRef.current();
    state.wishHold = 0;
  }, []);
  const useMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMic('on');
      const ctx = new AudioContext();
      micRef.current = { stream, ctx, raf: 0 };
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      let loud = 0;
      const tick = () => {
        an.getByteTimeDomainData(buf);
        let s = 0;
        for (const v of buf) s += ((v - 128) / 128) ** 2;
        loud = Math.sqrt(s / buf.length) > 0.18 ? loud + 1 : 0;
        if (loud > 12) {
          stopMic();
          return blowOut();
        }
        if (micRef.current) micRef.current.raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setMic('denied');
    }
  };
  return (
    <div className="bd-wish" data-stage={stage}>
      <div className="bd-candle" style={{ ['--hold' as string]: hold }}>
        <span className="bd-candle__flame" />
        <span className="bd-candle__body" />
      </div>
      {stage !== 'out' ? (
        <>
          <p className="bd-hint">Close your eyes. Make a wish. Then hold the candle until it goes out.</p>
          <div className="bd-row">
            <button type="button" className="bd-btn" onPointerDown={startHold} onPointerUp={stopHold} onPointerLeave={stopHold} onKeyDown={(e) => e.key === ' ' && startHold()} onKeyUp={stopHold}>
              Hold to blow
            </button>
            {mic === 'off' && typeof navigator !== 'undefined' && navigator.mediaDevices && (
              <button type="button" className="bd-link" onClick={useMic}>
                or blow into the mic
              </button>
            )}
            {mic === 'on' && <span className="bd-meta">Listening… blow!</span>}
          </div>
        </>
      ) : null}
      <ParticleText text={c.wish.line} phase={stage === 'out' ? 'form' : 'hidden'} className="bd-wish__line" />
      <HiddenHeart slug={slug} style={{ right: '4%', bottom: '4%' }} />
    </div>
  );
}

/* 12 ── Future Universe: playful possibilities, and a sphere of wishes for the year. */
export function Future({ slug, onDone }: ChapterProps) {
  const c = useContent();
  const [open, setOpen] = useState<number | null>(null);
  const [wish, setWish] = useState<string | null>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= 3) onDone();
  }, [n]);
  return (
    <div className="bd-future">
      <div className="bd-orbs">
        {c.future.map((f, k) => (
          <button key={k} type="button" className={`bd-orb ${open === k ? 'is-open' : ''}`} onClick={() => { setOpen(k); setN((x) => x + 1); }} style={{ ['--k' as string]: k }}>
            <span className="bd-orb__title">{f.title}</span>
            {open === k && <span className="bd-orb__text">{f.text}</span>}
          </button>
        ))}
      </div>
      <WishSphere
        onPick={() => {
          if (c.wishes.length) setWish(c.wishes[Math.floor(Math.random() * c.wishes.length)]);
          setN((x) => x + 1);
        }}
      />
      <p className="bd-future__wish" aria-live="polite">
        {wish ?? `A sphere of wishes for your year — touch it.`}
      </p>
      <HiddenHeart slug={slug} style={{ left: '46%', top: '2%' }} />
    </div>
  );
}

/** A slowly turning sphere of particles; any tap pulls one wish out. */
function WishSphere({ onPick }: { onPick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (cv.width = Math.max(1, Math.round(cv.clientWidth * dpr))), H = (cv.height = Math.max(1, Math.round(cv.clientHeight * dpr)));
    const N = 365;
    const pts = Array.from({ length: N }, (_, i) => {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
      return [Math.cos(a) * r, y, Math.sin(a) * r];
    });
    let t = 0, raf = 0;
    const tick = () => {
      t += 0.004;
      g.clearRect(0, 0, W, H);
      const R = Math.min(W, H) * 0.42, cs = Math.cos(t), sn = Math.sin(t);
      for (const [x, y, z] of pts) {
        const X = x * cs - z * sn, Z = x * sn + z * cs;
        const s = (Z + 2) / 3;
        g.globalAlpha = 0.25 + 0.75 * s;
        g.fillStyle = Z > 0 ? '#fff1c9' : '#8fb6ff';
        g.fillRect(W / 2 + X * R, H / 2 + y * R, 2 * dpr * s, 2 * dpr * s);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="bd-sphere" role="button" tabIndex={0} aria-label="Pull out a wish" onClick={onPick} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick()} />;
}

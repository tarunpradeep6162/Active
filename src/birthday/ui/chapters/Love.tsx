import { useEffect, useRef, useState } from 'react';
import { events, state } from '../../../core/state';
import { HiddenHeart, ParticleText, useContent, useTypewriter } from '../shared';
import type { ChapterProps } from '../ChapterView';
import { saveLetterPdf } from '../../keepsakes';
import { Backdrop, useStage } from '../stage/useStage';

/* 3 ── A letter I never said out loud: a sealed envelope, then the letter writes itself. */
export function Letter({ slug, onDone }: ChapterProps) {
  const c = useContent();
  // sealed → opening (the envelope in 3D breaks its seal) → open (the letter writes itself)
  const [phase, setPhase] = useState<'sealed' | 'opening' | 'open'>('sealed');
  const open = phase === 'open';
  const full = [c.letter.greeting, ...c.letter.paragraphs, c.letter.signoff].join('\n\n');
  const parts = c.letter.paragraphs.length + 2;
  const text = useTypewriter(full, open, 42);
  const ref = useRef<HTMLCanvasElement>(null);
  const stage = useRef<{ open(): void; dispose(): void } | null>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (open && text.length === full.length) onDone();
  }, [open, text]);
  useEffect(() => {
    let alive = true;
    import('../stage/LetterScene')
      .then(({ LetterScene }) => {
        if (!alive || !ref.current) return;
        const s = new LetterScene(ref.current);
        s.onOpened = () => alive && setPhase('open');
        stage.current = s;
        setLive(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
      stage.current?.dispose();
      stage.current = null;
    };
  }, []);
  const breakSeal = () => {
    if (phase !== 'sealed') return;
    if (stage.current) {
      setPhase('opening');
      stage.current.open();
    } else setPhase('open');
  };
  // never wait on the animation forever
  useEffect(() => {
    if (phase !== 'opening') return;
    const id = setTimeout(() => setPhase('open'), 6000);
    return () => clearTimeout(id);
  }, [phase]);
  return (
    <div className="bd-letter" data-live={live} data-phase={phase}>
      <div className="bd-cosmos" aria-hidden="true" onClick={breakSeal}>
        <canvas ref={ref} className="bd-cosmos__canvas bd-cosmos__canvas--interactive" />
      </div>
      {!live && phase === 'sealed' && (
        <button type="button" className="bd-envelope" onClick={breakSeal} aria-label="Open the letter">
          <span className="bd-envelope__flap" />
          <span className="bd-envelope__seal">♥</span>
        </button>
      )}
      {open && (
        <div className="bd-paper" aria-live="polite" data-done={text.length === full.length}>
          {/* each paragraph flows in like ink; the greeting and the sign-off are in her hand */}
          {text.split('\n\n').map((p, k, all) => (
            <p key={k} className={k === 0 ? 'bd-paper__greeting' : k === parts - 1 && all.length === parts ? 'bd-paper__sign' : ''}>
              {p}
            </p>
          ))}
          <span className="bd-caret" aria-hidden="true" />
          {text.length === full.length && (
            <>
              <svg className="bd-paper__flourish" viewBox="0 0 220 24" aria-hidden="true">
                <path d="M4 16 C40 4 70 22 104 12 S170 2 216 10" />
              </svg>
              <span className="bd-paper__seal" aria-hidden="true">♥</span>
            </>
          )}
        </div>
      )}
      {open && text.length === full.length && (
        <button type="button" className="bd-link" onClick={() => saveLetterPdf(c)}>
          Keep this letter (PDF)
        </button>
      )}
      {phase === 'sealed' && (
        <button type="button" className="bd-btn bd-letter__open" onClick={breakSeal}>
          Open my letter
        </button>
      )}
      {phase === 'sealed' && <p className="bd-hint bd-letter__hint">Sealed. For you only.</p>}
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
  // the sky behind: glows, threads of light and, at the end, her name written in stars
  const root = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const stage = useRef<{ setStars(p: { x: number; y: number }[], s: boolean[]): void; flare(i: number): void; complete(): void; dispose(): void } | null>(null);
  const [live, setLive] = useState(false);
  const seenRef = useRef(seen);
  seenRef.current = seen;
  useEffect(() => {
    let alive = true;
    let raf = 0;
    import('../stage/ReasonsScene')
      .then(({ ReasonsScene }) => {
        if (!alive || !ref.current) return;
        stage.current = new ReasonsScene(ref.current, c.reasons.length, c.name);
        setLive(true);
        const tick = () => {
          const stars = root.current ? [...root.current.querySelectorAll<HTMLElement>('.bd-reason-star')] : [];
          const pos = stars.map((b) => {
            const r = b.getBoundingClientRect();
            return { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight };
          });
          stage.current?.setStars(pos, c.reasons.map((_, k) => seenRef.current.includes(k)));
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => {});
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stage.current?.dispose();
      stage.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (all) stage.current?.complete();
  }, [all, live]);
  return (
    <div className={`bd-reasons ${all ? 'is-constellation' : ''}`} ref={root} data-live={live}>
      <div className="bd-cosmos" aria-hidden="true">
        <canvas ref={ref} className="bd-cosmos__canvas" />
      </div>
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
              if (seen.includes(k)) stage.current?.flare(k);
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
  const holdFrom = useRef(0);
  const stopMicRef = useRef<() => void>(() => {});
  // the candle in 3D: its flame leans and dims as she holds, then smoke and her wish's sparks rise
  const scene = useStage(() => import('../stage/WishScene').then(({ WishScene }) => (cv: HTMLCanvasElement) => new WishScene(cv)));
  useEffect(() => scene.stage.current?.setHold(hold), [hold, scene.live]);
  const blowOut = () => {
    stopMicRef.current();
    state.wishHold = 0;
    scene.stage.current?.blowOut();
    setStage('out');
    // the wish's light climbs the whole garden; every flower already visited glows as it passes
    events.emit('wishLight', undefined);
    onDone();
  };
  const startHold = () => {
    if (stage !== 'ready') return; // key repeat / double pointerdown must not start a second loop
    setStage('holding');
    const t0 = (holdFrom.current = performance.now());
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
    // held long enough, even if a slow device never drew the frame that would have ended it
    if (stage === 'holding' && performance.now() - holdFrom.current >= 1800) return blowOut();
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
    <div className="bd-wish" data-stage={stage} data-live={scene.live} style={{ ['--hold' as string]: hold }}>
      <Backdrop canvas={scene.ref} />
      {!scene.live && (
        <div className="bd-candle" style={{ ['--hold' as string]: hold }}>
          <span className="bd-candle__flame" />
          <span className="bd-candle__body" />
        </div>
      )}
      {stage !== 'out' ? (
        <>
          <p className="bd-hint">Close your eyes. Make a wish. Then hold the candle until it goes out.</p>
          <div className="bd-row">
            <button type="button" className="bd-btn bd-wish__hold" onPointerDown={startHold} onPointerUp={stopHold} onPointerLeave={stopHold} onKeyDown={(e) => e.key === ' ' && startHold()} onKeyUp={stopHold}>
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
      <Manor />
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

/** "Someday": the manor, rendered in its own canvas and loaded only when this chapter opens. */
function Manor() {
  const c = useContent();
  const ref = useRef<HTMLCanvasElement>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    let scene: { dispose(): void; onReady?: () => void } | null = null;
    let alive = true;
    import('../stage/ManorScene')
      .then(({ ManorScene }) => {
        if (!alive || !ref.current) return;
        const s = new ManorScene(ref.current);
        s.onReady = () => alive && setLive(true);
        scene = s;
      })
      .catch(() => {
        /* the still photograph stays as the backdrop */
      });
    return () => {
      alive = false;
      scene?.dispose();
    };
  }, []);
  return (
    <>
      {/* the whole chapter sits in the garden of this manor: a still first, the live scene when ready */}
      <div className={`bd-manorbg ${live ? 'is-live' : ''}`} role="img" aria-label="A cream manor with arched windows and an ivy arch over the door, pink blossoms along a sunlit path">
        <canvas ref={ref} className="bd-manorbg__canvas" />
      </div>
      <header className="bd-manor__caption">
        <span className="bd-manor__kicker">{c.manor.kicker}</span>
        <span className="bd-manor__title">{c.manor.title}</span>
        <span className="bd-manor__line">{c.manor.line}</span>
      </header>
    </>
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
        g.fillStyle = Z > 0 ? '#fff1c9' : '#f2c1cb';
        g.fillRect(W / 2 + X * R, H / 2 + y * R, 2 * dpr * s, 2 * dpr * s);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="bd-sphere" role="button" tabIndex={0} aria-label="Pull out a wish" onClick={onPick} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick()} />;
}

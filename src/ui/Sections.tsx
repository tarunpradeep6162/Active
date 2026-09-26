import { useEffect, useRef, useState } from 'react';
import { events, state } from '../core/state';
import { useStore } from './useStore';
import { CATEGORIES, PROJECTS, type Project } from '../app/projects';
import { routePath, isKnownPath } from '../app/router';
import { rangeOf } from '../world/journey';
import { useContent, useProgress, useVaultState, Media } from '../birthday/ui/shared';
import { Gate } from '../birthday/ui/ChapterView';
import { saveFutureCard, saveLetterPdf, saveNextDateCard } from '../birthday/keepsakes';
import { Countdown } from './Birthday';
import { canTilt, setTilt } from './tilt';
import { makePoster, recordFilm } from './Cinema';
import { canRecord } from './recorder';
import { Signature } from '../birthday/ui/Signature';
import type { Memory } from '../birthday/types';

export function Preloader() {
  const progress = useStore((s) => s.loadProgress);
  const loaded = useStore((s) => s.loaded);
  const revealed = useStore((s) => s.revealed);
  if (revealed) return null;
  // one closed tulip bud in the dark, gathering light as the memories load
  const p = Math.max(0.04, progress);
  return (
    <div className={`preloader ${loaded ? 'is-done' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Gathering memories">
      {/* a night coming out of the dark, framed like a film before it begins */}
      <div className="preloader__stars" aria-hidden="true" />
      <div className="preloader__frame" aria-hidden="true" />
      <svg className="preloader__bud" viewBox="-40 -60 80 120" aria-hidden="true" style={{ ['--p' as string]: p }}>
        <defs>
          <radialGradient id="bud-light" cx="50%" cy="60%" r="60%">
            <stop offset="0" stopColor="#f3dfa7" stopOpacity={0.35 + p * 0.65} />
            <stop offset="0.6" stopColor="#e8a6b5" stopOpacity={0.15 + p * 0.5} />
            <stop offset="1" stopColor="#070914" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="0" cy="-12" r={24 + p * 18} fill="url(#bud-light)" />
        <path d="M0 58 C-3 30 2 16 0 2" />
        <path d="M0 34 C-12 26 -18 18 -20 10" />
        <path d="M-15 -6 C-17 -24 -8 -34 0 -38 C8 -34 17 -24 15 -6 C9 1 -9 1 -15 -6 Z" className="preloader__petals" />
        <path d="M0 -38 C-5 -26 -5 -12 0 -2" />
      </svg>
      <p className="preloader__label">Gathering memories…</p>
      <div className="preloader__bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${p})` }} />
      </div>
    </div>
  );
}

/**
 * The opening, over the first stars: 25 · 11 → two lines → a shooting star (tap it) → her name
 * → "Enter our garden". HAPPY BIRTHDAY is saved for the sky at the very end.
 */
export function IntroHint() {
  const c = useContent();
  const section = useStore((s) => s.section);
  const [wish, setWish] = useState(false);
  const [tilt, setTiltOn] = useState(state.tilt.on);
  const starRef = useRef<HTMLButtonElement>(null);
  const hidden = section !== 'intro';
  const enter = () => {
    const r = rangeOf('manifesto');
    window.scrollTo({ top: r.start * state.scroll.max + 2, behavior: state.reducedMotion ? 'auto' : 'smooth' });
  };
  return (
    <section className="opening" aria-label="Opening" data-hidden={hidden} aria-hidden={hidden}>
      <p className="opening__date">{c.date}</p>
      <Countdown />
      {c.opening.lines.map((l, i) => (
        <p key={i} className="opening__line" style={{ ['--i' as string]: i }}>
          {l}
        </p>
      ))}
      <button
        ref={starRef}
        type="button"
        className={`opening__star ${wish ? 'is-wishing' : ''}`}
        tabIndex={hidden ? -1 : 0}
        aria-label="A shooting star — make a wish"
        onClick={() => {
          setWish(true);
          window.setTimeout(() => setWish(false), 2800);
        }}
      >
        <span className="opening__star-tail" />
        {wish && <span className="opening__wish">{c.opening.shootingStar}</span>}
      </button>
      <h2 className="opening__name">{c.name}</h2>
      <div className="opening__actions">
        <button type="button" className="opening__enter" tabIndex={hidden ? -1 : 0} onClick={enter}>
          {c.opening.enter} <span aria-hidden="true">↓</span>
        </button>
        <button type="button" className="opening__film" tabIndex={hidden ? -1 : 0} onClick={() => events.emit('playFilm', 'film')}>
          ▶ Play the film
        </button>
        <button type="button" className="opening__film opening__film--cut" tabIndex={hidden ? -1 : 0} onClick={() => events.emit('playFilm', 'directors')}>
          Director’s cut
        </button>
        {canTilt() && (
          <button type="button" className="opening__film opening__film--cut" aria-pressed={tilt} tabIndex={hidden ? -1 : 0} onClick={() => setTilt(!tilt).then(setTiltOn)}>
            {tilt ? '↻ Tilt on' : '↻ Tilt to look'}
          </button>
        )}
      </div>
    </section>
  );
}

/** The threshold of the garden (the measured headline section): three serif lines + a whisper. */
export function Manifesto() {
  const c = useContent();
  return (
    <section className="manifesto" aria-labelledby="manifesto-title">
      <h2 className="manifesto__title" id="manifesto-title">
        {c.threshold.lines.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </h2>
      <div className="manifesto__copy">
        {c.threshold.copy.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </div>
    </section>
  );
}

function search(q: string): Project[] {
  const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  if (!words.length) return [];
  const scored = PROJECTS.map((p) => {
    const hay = `${p.title} ${p.client} ${p.category} ${p.description} ${p.year}`.toLowerCase();
    return { p, s: words.reduce((a, w) => a + (hay.includes(w) ? 1 : 0), 0) };
  }).filter((x) => x.s > 0);
  return scored.sort((a, b) => b.s - a.s).map((x) => x.p);
}

export function WorkPanel() {
  const active = useStore((s) => s.activeCategory);
  const route = useStore((s) => s.route);
  const section = useStore((s) => s.section);
  const [response, setResponse] = useState('');
  const [results, setResults] = useState<Project[]>([]);
  const hidden = (section !== 'work' && section !== 'manifesto') || route.name === 'project' || route.name === 'contact';
  return (
    <aside className="work-panel" data-hidden={hidden} aria-label="Browse work" aria-hidden={hidden}>
      <h2 className="work-panel__q">Where shall we go?</h2>
      <ul className="work-panel__list">
        {CATEGORIES.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              tabIndex={hidden ? -1 : 0}
              aria-pressed={active === c.id}
              onClick={() => {
                const next = active === c.id ? null : c.id;
                events.emit('filter', next);
                const n = PROJECTS.filter((p) => p.category === c.id).length;
                setResults([]);
                setResponse(next ? `${n} ${n === 1 ? 'chapter' : 'chapters'} lit up in ${c.label}.` : '');
              }}
            >
              -&gt; {c.label}
            </button>
          </li>
        ))}
      </ul>
      <p className="work-panel__response" aria-live="polite">
        {response}{' '}
        {results.slice(0, 2).map((p) => (
          <button key={p.slug} type="button" onClick={() => events.emit('navigate', { name: 'project', slug: p.slug })}>
            [{p.title}]
          </button>
        ))}
      </p>
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          const input = (e.currentTarget.elements.namedItem('q') as HTMLInputElement) ?? null;
          const q = input?.value ?? '';
          const found = search(q);
          setResults(found);
          if (found.length) {
            setResponse(`Closest: chapter ${found[0].year}, ${found[0].title}.`);
            events.emit('jumpToProject', found[0].slug);
          } else setResponse(q.trim() ? 'Nothing yet — try “letter”, “music” or “wish”.' : '');
        }}
      >
        <label className="sr-only" htmlFor="ask-input">
          Search the chapters
        </label>
        <input id="ask-input" name="q" type="text" maxLength={100} autoComplete="off" placeholder="Find a chapter..." tabIndex={hidden ? -1 : 0} />
      </form>
      <ul className="sr-only">
        {PROJECTS.map((p) => (
          <li key={p.slug}>
            <a
              className="sr-only-focusable"
              href={routePath({ name: 'project', slug: p.slug })}
              onClick={(e) => {
                e.preventDefault();
                events.emit('navigate', { name: 'project', slug: p.slug });
              }}
            >
              {p.client}: {p.title}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function LabLabel() {
  // opacity alone would leave the button clickable (and tabbable) everywhere else on the page
  const section = useStore((s) => s.section);
  const hidden = section !== 'lab' && section !== 'portal';
  // the cage → the cake → its candles; read from the runtime each frame while the lab is near
  const [stage, setStage] = useState<'locked' | 'rising' | 'candles' | 'wished'>('locked');
  const [hold, setHold] = useState(0);
  const [mic, setMic] = useState<'off' | 'asking' | 'on' | 'denied'>('off');
  const veil = useRef<HTMLDivElement>(null);
  const holding = useRef(false);
  const micLevel = useRef(0);
  const stopMic = useRef<() => void>(() => {});
  useEffect(() => {
    if (hidden) return;
    let raf = 0;
    let last = performance.now();
    let blow = 0;
    let wasReady = false;
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // hold: ~1.6 s of steady blowing; the microphone: sustained breath above the room's noise
      const push = holding.current || state.filmBlow ? 0.65 : micLevel.current > 0.06 ? Math.min(1.4, micLevel.current * 9) : 0;
      blow = state.cakeReady ? Math.max(0, Math.min(1, blow + (push > 0 ? push * dt : -dt * 0.8))) : 0;
      state.cakeBlow = blow;
      setHold((h) => (Math.abs(h - blow) > 0.01 || (blow === 0 && h !== 0) ? blow : h));
      if (state.cageOpen) setStage((st) => (st === 'locked' ? 'rising' : st));
      if (blow >= 1 && state.cakeReady) {
        events.emit('blowCandles', undefined);
        holding.current = false;
        blow = 0;
        stopMic.current();
        setStage('wished');
      }
      if (state.cakeReady && !wasReady) setStage('candles');
      wasReady = state.cakeReady;
      if (veil.current) veil.current.style.opacity = String(state.cakeDark * 0.82);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      state.cakeBlow = 0;
    };
  }, [hidden]);
  useEffect(() => () => stopMic.current(), []);
  useEffect(() => {
    if (hidden) stopMic.current();
  }, [hidden]);

  const open = () => {
    events.emit('openCage', undefined);
    setStage('rising');
  };
  // the microphone is only asked for after this explicit tap; the sound is measured locally, never recorded
  const listen = async () => {
    setMic('asking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Float32Array(an.fftSize);
      let raf = 0;
      const read = () => {
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        micLevel.current = micLevel.current * 0.7 + Math.sqrt(sum / buf.length) * 0.3;
        raf = requestAnimationFrame(read);
      };
      read();
      stopMic.current = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});
        micLevel.current = 0;
        stopMic.current = () => {};
        setMic('off');
      };
      setMic('on');
    } catch {
      setMic('denied');
    }
  };
  const holdOn = (on: boolean) => () => {
    holding.current = on;
  };
  const candles = stage === 'candles';
  return (
    <>
      <div className="cake-veil" ref={veil} aria-hidden="true" />
      <section className="lab-label" aria-labelledby="lab-title" data-hidden={hidden} data-stage={stage} aria-hidden={hidden}>
        <h2 className="lab-label__title" id="lab-title">
          {stage === 'locked' ? 'Something sweet,' : stage === 'wished' ? 'Your wish' : 'Blow out'}
          <br />
          {stage === 'locked' ? 'locked inside' : stage === 'wished' ? 'is on its way' : 'the candles'}
        </h2>
        <div className="lab-label__side">
          <p className="lab-label__copy" aria-live="polite">
            {stage === 'locked' && 'Touch the cage to open it.'}
            {stage === 'rising' && 'Wait for the candles…'}
            {candles && (mic === 'on' ? 'Close your eyes, make a wish, and blow gently toward your phone.' : 'Close your eyes and make a wish. Then hold the button, and blow.')}
            {stage === 'wished' && 'Kept in the dark for a moment, and then let go. The candles will light again.'}
            {mic === 'denied' && candles && ' (No microphone. Holding works just as well.)'}
          </p>
          {stage === 'locked' && (
            <button type="button" className="lab-label__open" tabIndex={hidden ? -1 : 0} onClick={open}>
              Open the cage
            </button>
          )}
          {candles && (
            <div className="lab-label__actions">
              <button
                type="button"
                className="lab-label__open lab-label__blow"
                tabIndex={hidden ? -1 : 0}
                style={{ ['--hold' as string]: hold }}
                onPointerDown={holdOn(true)}
                onPointerUp={holdOn(false)}
                onPointerLeave={holdOn(false)}
                onPointerCancel={holdOn(false)}
                onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && holdOn(true)()}
                onKeyUp={holdOn(false)}
                onContextMenu={(e) => e.preventDefault()}
              >
                Hold to blow
              </button>
              {mic !== 'on' && mic !== 'denied' && 'mediaDevices' in navigator && (
                <button type="button" className="bd-link lab-label__mic" tabIndex={hidden ? -1 : 0} onClick={listen} disabled={mic === 'asking'}>
                  or use the microphone
                </button>
              )}
              {mic === 'on' && (
                <button type="button" className="bd-link lab-label__mic" onClick={() => stopMic.current()}>
                  turn the microphone off
                </button>
              )}
            </div>
          )}
          {stage === 'wished' && (
            <button type="button" className="lab-label__open" tabIndex={hidden ? -1 : 0} onClick={() => setStage(state.cakeReady ? 'candles' : 'rising')}>
              Make another wish
            </button>
          )}
        </div>
      </section>
    </>
  );
}

/**
 * The lantern sky: touch a lantern (or press the button) to let its wish go. The wish's words
 * rise from where the lantern was, and the lantern becomes a star.
 */
export function LanternSkyLabel() {
  const c = useContent();
  const section = useStore((s) => s.section);
  const hidden = section !== 'portal';
  const [said, setSaid] = useState<{ key: number; text: string; x: number; y: number; memory?: Memory }[]>([]);
  const [lit, setLit] = useState(0);
  useEffect(() => {
    const off = events.on('lanternWish', ({ index, x, y }) => {
        const list = c.lanternWishes.length ? c.lanternWishes : ['A wish, just for you.'];
        const key = performance.now();
        const text = list[index % list.length];
        // a memory rises inside the lantern too: one of her photos, lit from within
        const photos = c.memories.filter((m) => m.media?.type === 'image');
        const memory = photos.length ? photos[index % photos.length] : undefined;
        setSaid((s) => [...s.slice(-2), { key, text, x, y, memory }]);
        setTimeout(() => setSaid((s) => s.filter((w) => w.key !== key)), 6500);
    });
    return () => {
      off();
    };
  }, [c]);
  useEffect(() => {
    if (hidden) return;
    const id = setInterval(() => setLit(state.starsLit), 500);
    return () => clearInterval(id);
  }, [hidden]);
  return (
    <>
      <section className="sky-label" aria-labelledby="sky-title" data-hidden={hidden} aria-hidden={hidden}>
        <h2 className="sky-label__title" id="sky-title">
          A sky of wishes
        </h2>
        <p className="sky-label__copy">Touch a lantern to let its wish go. Each one becomes a star.</p>
        <button type="button" className="lab-label__open" tabIndex={hidden ? -1 : 0} onClick={() => events.emit('releaseNextLantern', undefined)}>
          Let a wish go
        </button>
        <p className="sky-label__count" aria-live="polite">
          {lit > 0 && `${lit} of 12 wishes are stars now`}
        </p>
      </section>
      <div className="sky-wishes" aria-live="polite">
        {!hidden &&
          said.map((w) => (
            <div key={w.key} className="sky-wish" style={{ left: `clamp(24px, ${w.x}px, calc(100vw - 24px))`, top: `${Math.max(90, w.y)}px` }}>
              {w.memory && (
                <figure className="sky-wish__memory">
                  <Media media={w.memory.media} label={w.memory.caption} />
                </figure>
              )}
              <p>{w.text}</p>
            </div>
          ))}
      </div>
    </>
  );
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * The finale over the sky: once the stars have spelled her name, HAPPY BIRTHDAY above it and
 * the date below, a sunrise from the horizon, the final words one by one, and ONE LAST THING.
 */
export function FinaleSky() {
  const c = useContent();
  const section = useStore((s) => s.section);
  const hidden = section !== 'outro';
  const [words, setWords] = useState(-1);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (hidden || words >= 0) return;
    const id = setInterval(() => state.finaleLocal > 0.84 && setWords(0), 300);
    return () => clearInterval(id);
  }, [hidden, words]);
  useEffect(() => {
    if (words < 0 || words >= c.finalWords.length) return;
    const id = setTimeout(() => setWords((w) => w + 1), state.reducedMotion ? 600 : 2600);
    return () => clearTimeout(id);
  }, [words, c.finalWords.length]);
  const month = MONTHS[(c.birthday.month || 11) - 1];
  return (
    <>
      <div className="sunrise" aria-hidden="true" />
      <section className="finale-sky" data-hidden={hidden} aria-hidden={hidden} aria-label="Happy birthday">
        <p className="finale-sky__happy">Happy birthday</p>
        <h2 className="sr-only">{c.name}</h2>
        <p className="finale-sky__date">
          {c.birthday.day || 25} · {month}
        </p>
        <div className="finale-sky__words" aria-live="polite">
          {c.finalWords.slice(0, Math.max(0, words + 1)).map((w, i) => (
            <p key={i} className={i === Math.min(words, c.finalWords.length - 1) ? 'is-now' : ''}>
              {w}
            </p>
          ))}
        </div>
        {words >= c.finalWords.length && (
          <button type="button" className="finale-sky__last" tabIndex={hidden ? -1 : 0} onClick={() => setOpen(true)}>
            One last thing
          </button>
        )}
      </section>
      {open && <LastThing onClose={() => setOpen(false)} />}
    </>
  );
}

/** The private ending: the voice note and the last message (behind the passcode when set). */
function LastThing({ onClose }: { onClose: () => void }) {
  const c = useContent();
  const vault = useVaultState();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="lastthing" role="dialog" aria-modal="true" aria-label="One last thing" ref={ref} tabIndex={-1}>
      <div className="lastthing__card">
        {vault === 'locked' ? (
          <Gate />
        ) : (
          <>
            <p className="lastthing__kicker">One last thing</p>
            {c.finale.voice ? <Media media={c.finale.voice} label="A voice note for you" /> : <p className="lastthing__note">[A voice note will play here]</p>}
            <p className="lastthing__text">{c.finale.lastThing}</p>
            <Signature className="lastthing__sig" color="#e8a6b5" delay={0.6} />
          </>
        )}
        <button type="button" className="bd-link" onClick={onClose}>
          Back to the sky
        </button>
      </div>
    </div>
  );
}

const ACTS: Partial<Record<string, [string, string]>> = {
  work: ['I', 'Our Garden'],
  lab: ['II', 'Something Sweet'],
  portal: ['III', 'A Sky of Wishes'],
  outro: ['IV', 'Your Stars'],
};

/** A quiet title card, like a film's act break, the first time she arrives in each world. */
export function ActCard() {
  const section = useStore((s) => s.section);
  const route = useStore((s) => s.route);
  const [card, setCard] = useState<{ key: number; act: [string, string] } | null>(null);
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const act = ACTS[section];
    if (!act || seen.current.has(section) || route.name !== 'home' || state.focus > 0.01) return;
    seen.current.add(section);
    const key = performance.now();
    setCard({ key, act });
    const id = setTimeout(() => setCard((c) => (c?.key === key ? null : c)), 3400);
    return () => clearTimeout(id);
  }, [section]);
  if (!card) return null;
  return (
    <div className="actcard" key={card.key} aria-hidden="true">
      <span className="actcard__num">{card.act[0]}</span>
      <span className="actcard__title">{card.act[1]}</span>
    </div>
  );
}

export function EndCap() {
  const atEnd = useStore((s) => s.atEnd);
  return (
    <div className="endcap" data-hidden={!atEnd}>
      <button type="button" tabIndex={atEnd ? 0 : -1} onClick={() => events.emit('navigate', { name: 'home' })}>
        Back to the first star
      </button>
    </div>
  );
}

/** "For you": the keepsakes — a message to future us, our next date, the letter as a PDF. */
export function Contact() {
  const route = useStore((s) => s.route);
  const open = route.name === 'contact';
  const c = useContent();
  const prog = useProgress();
  const [mounted, setMounted] = useState(open);
  const [msg, setMsg] = useState(() => readFuture());
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (open) setMounted(true);
    else {
      const t = setTimeout(() => setMounted(false), 600);
      return () => clearTimeout(t);
    }
  }, [open]);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 500);
  }, [open]);
  const picks = c.thisOrThat.map((pair, k) => (prog.thisOrThat[k] !== undefined ? pair[prog.thisOrThat[k]] : null)).filter(Boolean) as string[];
  return (
    <section className={`contact foryou ${mounted ? 'is-open' : ''}`} aria-hidden={!open} aria-label="For you" role="dialog" aria-modal={open}>
      <div className="foryou__sky" aria-hidden="true" />
      <p className="foryou__kicker">
        <span>25 · 11</span>
      </p>
      <h2 className="foryou__title">For you</h2>
      <div className="foryou__grid">
        <article className="foryou__card" data-icon="✉">
          <h3>A message to future us</h3>
          <label className="sr-only" htmlFor="future-us">
            {c.futurePrompt}
          </label>
          <textarea
            id="future-us"
            value={msg}
            placeholder={c.futurePrompt}
            maxLength={1200}
            onChange={(e) => {
              setMsg(e.target.value);
              setSaved(false);
            }}
          />
          <div className="foryou__row">
            <button type="button" onClick={() => setSaved(writeFuture(msg))}>
              Save
            </button>
            <button type="button" onClick={() => saveFutureCard(msg)} disabled={!msg.trim()}>
              Keep as a card
            </button>
          </div>
          <p className="foryou__note">{saved ? 'Saved — ' : ''}Kept only on this device. Clearing the browser’s data removes it; nothing is sent anywhere.</p>
        </article>
        <article className="foryou__card" data-icon="✦">
          <h3>Our next date</h3>
          {picks.length ? (
            <ul className="foryou__picks">
              {picks.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="foryou__note">Play “Know Us?” in the garden and your choices will plan it.</p>
          )}
          <button type="button" disabled={!picks.length} onClick={() => saveNextDateCard(picks)}>
            Save as an image
          </button>
        </article>
        <article className="foryou__card" data-icon="❦">
          <h3>Keep the letter</h3>
          <p className="foryou__note">The letter from the garden, as a small PDF to keep.</p>
          <button type="button" onClick={() => saveLetterPdf(c)}>
            Keep this letter
          </button>
        </article>
        <article className="foryou__card" data-icon="✦">
          <h3>A poster of your night</h3>
          <p className="foryou__note">Your name in the stars at dawn, the stars you drew and the wishes you let go, as a large image.</p>
          <button type="button" onClick={() => makePoster(c)}>
            Save the poster
          </button>
        </article>
        {canRecord() && (
          <article className="foryou__card" data-icon="●">
            <h3>Your film</h3>
            <p className="foryou__note">A 40‑second film of your night (the cake, your lanterns, the sunrise and your stars), recorded as it plays and saved to this device.</p>
            <button type="button" onClick={recordFilm}>
              Record and save
            </button>
          </article>
        )}
      </div>
      <div className="foryou__sign">
        <Signature className="foryou__sig" color="#f3dfa7" delay={0.4} />
      </div>
      <button ref={closeRef} className="contact__close" type="button" onClick={() => events.emit('navigate', { name: 'home' })}>
        Back to our garden ×
      </button>
    </section>
  );
}

const FUTURE_KEY = 'bday-future-us';
function readFuture() {
  try {
    return localStorage.getItem(FUTURE_KEY) ?? '';
  } catch {
    return '';
  }
}
function writeFuture(v: string) {
  try {
    localStorage.setItem(FUTURE_KEY, v);
    return true;
  } catch {
    return false;
  }
}

export function WebGLLost() {
  const lost = useStore((s) => s.webglLost);
  if (!lost) return null;
  return (
    <div className="fallback" role="alert">
      <div>
        <p>The garden flickered for a moment — bringing it back…</p>
        <button type="button" onClick={() => location.reload()}>
          Return to our garden
        </button>
      </div>
    </div>
  );
}

/** Any path that isn’t ours. */
export function NotFound() {
  const [lost, setLost] = useState(() => !isKnownPath(location.pathname));
  useEffect(() => {
    const check = () => setLost(!isKnownPath(location.pathname));
    addEventListener('popstate', check);
    return () => removeEventListener('popstate', check);
  }, []);
  if (!lost) return null;
  return (
    <div className="notfound" role="alert">
      <p>Looks like this path wandered out of the garden.</p>
      <button
        type="button"
        onClick={() => {
          history.replaceState({}, '', '/');
          setLost(false);
        }}
      >
        Return to our garden
      </button>
    </div>
  );
}


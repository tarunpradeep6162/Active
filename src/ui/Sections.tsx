import { useEffect, useRef, useState } from 'react';
import { events, state } from '../core/state';
import { useStore } from './useStore';
import { CATEGORIES, PROJECTS, type Project } from '../app/projects';
import { routePath, isKnownPath } from '../app/router';
import { rangeOf } from '../world/journey';
import { useContent, useProgress } from '../birthday/ui/shared';
import { saveFutureCard, saveLetterPdf, saveNextDateCard } from '../birthday/keepsakes';

export function Preloader() {
  const progress = useStore((s) => s.loadProgress);
  const loaded = useStore((s) => s.loaded);
  const revealed = useStore((s) => s.revealed);
  if (revealed) return null;
  // one closed tulip bud in the dark, gathering light as the memories load
  const p = Math.max(0.04, progress);
  return (
    <div className={`preloader ${loaded ? 'is-done' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Gathering memories">
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
  const starRef = useRef<HTMLButtonElement>(null);
  const hidden = section !== 'intro';
  const enter = () => {
    const r = rangeOf('manifesto');
    window.scrollTo({ top: r.start * state.scroll.max + 2, behavior: state.reducedMotion ? 'auto' : 'smooth' });
  };
  return (
    <section className="opening" aria-label="Opening" data-hidden={hidden} aria-hidden={hidden}>
      <p className="opening__date">{c.date}</p>
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
      <button type="button" className="opening__enter" tabIndex={hidden ? -1 : 0} onClick={enter}>
        {c.opening.enter} <span aria-hidden="true">↓</span>
      </button>
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
  return (
    <section className="lab-label" aria-labelledby="lab-title" data-hidden={hidden} aria-hidden={hidden}>
      <h2 className="lab-label__title" id="lab-title">
        // Locked
        <br />
        inside -&gt;
      </h2>
      <p className="lab-label__copy">Something sweet is waiting behind these bars. Touch the cage to open it.</p>
      <button type="button" className="lab-label__open" tabIndex={hidden ? -1 : 0} onClick={() => events.emit('openCage', undefined)}>
        Open the cage
      </button>
    </section>
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
      <p className="foryou__kicker">25 · 11</p>
      <h2 className="foryou__title">For you</h2>
      <div className="foryou__grid">
        <article className="foryou__card">
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
        <article className="foryou__card">
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
        <article className="foryou__card">
          <h3>Keep the letter</h3>
          <p className="foryou__note">The letter from the garden, as a small PDF to keep.</p>
          <button type="button" onClick={() => saveLetterPdf(c)}>
            Keep this letter
          </button>
        </article>
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


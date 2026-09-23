import { useEffect, useRef, useState } from 'react';
import { events, state } from '../core/state';
import { useStore } from './useStore';
import { scramble } from './scramble';
import { CATEGORIES, PROJECTS, type Project } from '../app/projects';
import { routePath } from '../app/router';

export function Preloader() {
  const progress = useStore((s) => s.loadProgress);
  const loaded = useStore((s) => s.loaded);
  const revealed = useStore((s) => s.revealed);
  if (revealed) return null;
  return (
    <div className={`preloader ${loaded ? 'is-done' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Loading">
      <span className={`preloader__count ${progress <= 0 ? 'is-hidden' : ''}`}>//{Math.max(1, Math.round(progress * 100))}</span>
    </div>
  );
}

export function IntroHint() {
  return (
    <p className="intro-hint label" aria-hidden="true">
      Scroll down
    </p>
  );
}

const HEADLINE = ['Realtime', 'Digital', 'Worlds'];

export function Manifesto() {
  const section = useStore((s) => s.section);
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const shown = useRef(false);
  useEffect(() => {
    const visible = section === 'manifesto';
    if (visible && !shown.current) {
      shown.current = true;
      refs.current.forEach((el, i) => el && setTimeout(() => scramble(el, HEADLINE[i].toUpperCase(), 650, state.reducedMotion), i * 120));
    }
    if (section === 'intro') shown.current = false;
  }, [section]);
  return (
    <section className="manifesto" aria-labelledby="manifesto-title">
      <h2 className="manifesto__title" id="manifesto-title">
        {HEADLINE.map((w, i) => (
          <span key={w} ref={(el) => void (refs.current[i] = el)}>
            {w.toUpperCase()}
          </span>
        ))}
      </h2>
      <div className="manifesto__copy">
        <p>Independent since 2019</p>
        <p>We build worlds for the browser — part story, part system, all running live on the device in your hand.</p>
        <p>Our own realtime toolkit lets a small team ship ambitious work that stays fast on every screen.</p>
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
  return (
    <section className="lab-label" aria-labelledby="lab-title">
      <h2 className="lab-label__title" id="lab-title">
        // Locked
        <br />
        inside -&gt;
      </h2>
      <p className="lab-label__copy">Something sweet is waiting behind these bars. Touch the cage to open it.</p>
      <button type="button" className="lab-label__open" onClick={() => events.emit('openCage', undefined)}>
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
        Back to the start
      </button>
    </div>
  );
}

export function Contact() {
  const route = useStore((s) => s.route);
  const open = route.name === 'contact';
  const [mounted, setMounted] = useState(open);
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
  return (
    <section className={`contact ${mounted ? 'is-open' : ''}`} aria-hidden={!open} aria-label="Contact" role="dialog" aria-modal={open}>
      <p className="contact__head label">✦ Say hello ✦</p>
      <h2 className="contact__cities">
        <span>OSL</span>
        <span className="contact__arrow" aria-hidden="true">
          →
        </span>
        <span>SEL</span>
        <span className="contact__arrow" aria-hidden="true">
          →
        </span>
        <span>MEX</span>
      </h2>
      <p className="contact__email">
        <a href="mailto:hello@example.com">hello@example.com</a>
      </p>
      <nav className="contact__social" aria-label="Social">
        <a href="#instagram">Instagram</a>
        <a href="#linkedin">LinkedIn</a>
        <a href="#newsletter">Newsletter signup</a>
        <a href="#careers">Careers</a>
      </nav>
      <button ref={closeRef} className="contact__close" type="button" onClick={() => events.emit('navigate', { name: 'home' })}>
        CLOSE ×
      </button>
    </section>
  );
}

export function WebGLLost() {
  const lost = useStore((s) => s.webglLost);
  if (!lost) return null;
  return (
    <div className="fallback" role="alert">
      <div>
        <p>Graphics context lost — restoring…</p>
        <button type="button" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    </div>
  );
}

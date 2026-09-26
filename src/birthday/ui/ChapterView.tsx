import { useEffect, useRef, useState } from 'react';
import { lightLeak } from '../../ui/lightLeak';
import { PROJECTS, projectBySlug, type Project } from '../../app/projects';
import { events } from '../../core/state';
import { useStore } from '../../ui/useStore';
import { markDone } from '../progress';
import { getHint, initVault, unlock } from '../vault';
import { useProgress, useVaultState } from './shared';
import { Beginning, Finale, Movie, Timeline } from './chapters/Story';
import { Gifts, MemoryUniverse, Secret } from './chapters/Memories';
import { Future, Letter, Reasons, Wish } from './chapters/Love';
import { CatchGame, Quiz } from './chapters/Play';
import { MusicRoom } from './chapters/Music';

export interface ChapterProps {
  slug: string;
  onDone: () => void;
}

const CHAPTERS: Record<string, (p: ChapterProps) => React.ReactElement | null> = {
  'the-beginning': Beginning,
  'memory-universe': MemoryUniverse,
  'the-letter': Letter,
  'fourteen-things': Reasons,
  'catch-my-heart': CatchGame,
  'know-us': Quiz,
  'our-secret': Secret,
  'music-room': MusicRoom,
  'our-timeline': Timeline,
  'gift-boxes': Gifts,
  'make-a-wish': Wish,
  'future-universe': Future,
  'little-movie': Movie,
  'for-dheepika': Finale,
};

/** Replaces the portfolio detail panel: an opened card becomes a full chapter stage. */
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'];

export function ChapterView() {
  const route = useStore((s) => s.route);
  const open = route.name === 'project';
  const [last, setLast] = useState<Project | null>(null);
  const project = open ? projectBySlug(route.slug) : null;
  useEffect(() => {
    if (project) setLast(project);
  }, [project]);
  useEffect(() => {
    initVault();
  }, []);
  const p = project ?? last;
  const vault = useVaultState();
  const prog = useProgress();
  const closeRef = useRef<HTMLButtonElement>(null);
  // a light leak as a chapter opens, and on every cut to another chapter
  useEffect(() => {
    if (open) {
      lightLeak();
      events.emit('sfx', 'open');
    }
  }, [open, p?.slug]);
  useEffect(() => {
    if (open) window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 700);
  }, [open, p?.slug]);
  if (!p) return null;
  const idx = PROJECTS.indexOf(p);
  const next = PROJECTS[(idx + 1) % PROJECTS.length];
  const Chapter = CHAPTERS[p.slug];
  return (
    <section className={`bd-chapter ${open ? 'is-open' : ''}`} aria-hidden={!open} inert={!open} aria-label={`Chapter ${idx + 1}: ${p.title}`}>
      {/* the frame: letterbox bars and a soft vignette, like a film */}
      <div className="bd-frame" aria-hidden="true" />
      {/* a title card, replayed on every chapter */}
      <header className="bd-chapter__head" key={p.slug}>
        <p className="bd-chapter__kicker" aria-hidden="true">
          <span>Chapter {ROMAN[idx]}</span>
        </p>
        <p className="bd-meta bd-chapter__slate">
          {String(idx + 1).padStart(2, '0')} / {PROJECTS.length} · {prog.done.includes(p.slug) ? 'opened ✓' : p.description}
        </p>
        <h2 className="bd-chapter__title">{p.title}</h2>
      </header>
      <div className="bd-chapter__stage">
        {open && vault === 'locked' && <Gate />}
        {open && vault !== 'locked' && vault !== 'checking' && <Chapter key={p.slug} slug={p.slug} onDone={() => markDone(p.slug)} />}
      </div>
      <footer className="bd-chapter__foot">
        {/* the reel: every chapter as a frame of film; gold once opened, lit where she is */}
        <nav className="bd-reel" aria-label="Chapters">
          {PROJECTS.map((c, k) => (
            <button
              key={c.slug}
              type="button"
              className="bd-reel__frame"
              data-done={prog.done.includes(c.slug)}
              aria-current={c.slug === p.slug ? 'true' : undefined}
              aria-label={`Chapter ${k + 1}: ${c.title}`}
              title={c.title}
              tabIndex={open ? 0 : -1}
              onClick={() => c.slug !== p.slug && events.emit('navigate', { name: 'project', slug: c.slug })}
            >
              <span>{k + 1}</span>
            </button>
          ))}
        </nav>
        <span className="bd-meta" title="Hidden hearts found">
          ♥ {prog.hearts.length} / {PROJECTS.length}
        </span>
        
        <button type="button" className="bd-btn" tabIndex={open ? 0 : -1} onClick={() => events.emit('navigate', { name: 'project', slug: next.slug })}>
          Next: {next.title} →
        </button>
        <button ref={closeRef} type="button" className="bd-btn" tabIndex={open ? 0 : -1} onClick={() => events.emit('navigate', { name: 'work' })}>
          ← Back to the stars
        </button>
      </footer>
    </section>
  );
}

/** Passcode gate: the chapters' real content only exists encrypted until this is right. */
export function Gate() {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  const hint = getHint();
  return (
    <form
      className="bd-gate"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await unlock(value);
        setBusy(false);
        setWrong(!ok);
      }}
    >
      <p className="bd-gate__lock" aria-hidden="true">
        🔐
      </p>
      <label htmlFor="bd-pass">This part of the universe is only for you.</label>
      {hint && <p className="bd-meta">Hint: {hint}</p>}
      <input id="bd-pass" type="password" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" autoFocus />
      <button type="submit" className="bd-btn" disabled={busy || !value}>
        {busy ? 'Opening…' : 'Open'}
      </button>
      {wrong && <p className="bd-soft">Not that one — try again. 💭</p>}
    </form>
  );
}

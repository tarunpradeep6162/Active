import { useEffect, useRef, useState } from 'react';
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
import { MoodSky } from './MoodSky';

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
  useEffect(() => {
    if (open) window.setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 700);
  }, [open, p?.slug]);
  if (!p) return null;
  const idx = PROJECTS.indexOf(p);
  const next = PROJECTS[(idx + 1) % PROJECTS.length];
  const Chapter = CHAPTERS[p.slug];
  return (
    <section className={`bd-chapter ${open ? 'is-open' : ''}`} aria-hidden={!open} aria-label={`Chapter ${idx + 1}: ${p.title}`}>
      <header className="bd-chapter__head">
        <p className="bd-meta">
          {String(idx + 1).padStart(2, '0')} / {PROJECTS.length} · {prog.done.includes(p.slug) ? 'opened ✓' : p.description}
        </p>
        <h2 className="bd-chapter__title">{p.title}</h2>
      </header>
      <div className="bd-chapter__stage">
        {open && vault === 'locked' && <Gate />}
        {open && <MoodSky key={`sky-${p.slug}`} slug={p.slug} />}
        {open && vault !== 'locked' && vault !== 'checking' && <Chapter key={p.slug} slug={p.slug} onDone={() => markDone(p.slug)} />}
      </div>
      <footer className="bd-chapter__foot">
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

import { useEffect, useRef, useState } from 'react';
import { events } from '../../../core/state';
import { PROJECTS } from '../../../app/projects';
import { HiddenHeart, Media, ParticleText, filled, reducedMotion, useContent, useProgress, useTypewriter } from '../shared';
import type { ChapterProps } from '../ChapterView';

/* 1 ── The Beginning: darkness, one star; waking it reveals the date and the line. */
export function Beginning({ slug, onDone }: ChapterProps) {
  const c = useContent();
  const [awake, setAwake] = useState(0);
  const ref = useRef<HTMLCanvasElement>(null);
  const stage = useRef<{ wake(l: number): void; dispose(): void } | null>(null);
  const [live, setLive] = useState(false);
  // the words follow the stars: they begin once the date has gathered (at once without 3D)
  const [ready, setReady] = useState(false);
  const line = useTypewriter(c.beginning.line, ready, 26);
  useEffect(() => {
    if (ready && line.length === c.beginning.line.length) onDone();
  }, [ready, line]);
  useEffect(() => {
    let alive = true;
    import('../stage/BeginningScene')
      .then(({ BeginningScene }) => {
        if (!alive || !ref.current) return;
        stage.current = new BeginningScene(ref.current, c.date);
        setLive(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
      stage.current?.dispose();
      stage.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (awake < 2) return;
    const id = setTimeout(() => setReady(true), live && !reducedMotion() ? 5600 : 0);
    return () => clearTimeout(id);
  }, [awake, live]);
  const touch = () => {
    const next = Math.min(2, awake + 1);
    setAwake(next);
    stage.current?.wake(next);
  };
  return (
    <div className="bd-beginning" data-awake={awake} data-live={live}>
      <div className="bd-cosmos" aria-hidden="true">
        <canvas ref={ref} className="bd-cosmos__canvas" />
      </div>
      <button type="button" className="bd-star" aria-label={awake ? (awake > 1 ? 'The star is awake' : 'Touch the star once more') : 'Wake the star'} onClick={touch}>
        <span />
      </button>
      <p className="bd-hint bd-beginning__hint">{awake === 0 ? 'Touch the star.' : awake === 1 ? 'Once more.' : ''}</p>
      <h2 className="bd-date" aria-hidden={awake < 2}>
        {c.date}
      </h2>
      <p className="bd-line">{line}</p>
      <HiddenHeart slug={slug} style={{ right: '9%', bottom: '12%' }} />
    </div>
  );
}

/* 9 ── Timeline: Before Us → … → What Comes Next, ending on the empty frame. */
export function Timeline({ slug, onDone }: ChapterProps) {
  const c = useContent();
  const [i, setI] = useState(0);
  const stops = [...c.timeline, { label: 'Next', text: c.emptyFrame, empty: true as const }];
  const s = stops[i];
  const track = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (i === stops.length - 1) onDone();
    // keep the current date in view on narrow screens (the strip scrolls sideways)
    const el = track.current?.children[i] as HTMLElement | undefined;
    const t = track.current;
    if (el && t && t.scrollWidth > t.clientWidth) t.scrollTo({ left: el.offsetLeft - t.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [i]);
  return (
    <div className="bd-timeline">
      {c.timelineStory?.intro && i === 0 && <p className="bd-timeline__intro">{c.timelineStory.intro}</p>}
      <ol className="bd-timeline__track" aria-label="Our timeline" ref={track}>
        {stops.map((t, k) => (
          <li key={k}>
            <button type="button" aria-current={k === i} onClick={() => setI(k)}>
              <span className="bd-dot" />
              <span className="bd-timeline__label">{t.label}</span>
            </button>
          </li>
        ))}
      </ol>
      <article className="bd-timeline__stop" key={i}>
        {'empty' in s ? (
          <>
            {c.timelineStory?.outro && <p className="bd-timeline__outro">{c.timelineStory.outro}</p>}
            <div className="bd-emptyframe">
              <div className="bd-emptyframe__frame" aria-hidden="true" />
              <p>{s.text}</p>
            </div>
          </>
        ) : (
          <>
            {/* a date without a photo simply tells the story */}
            {s.media && <Media media={s.media} label={`${s.label} — photo or clip`} className="bd-timeline__media" />}
            <h3>{s.label}</h3>
            {filled(s.date) && <p className="bd-meta">{s.date}</p>}
            <p>{s.text}</p>
          </>
        )}
      </article>
      <div className="bd-row">
        <button type="button" className="bd-btn" disabled={i === 0} onClick={() => setI(i - 1)}>
          ← Back in time
        </button>
        <button type="button" className="bd-btn" disabled={i === stops.length - 1} onClick={() => setI(i + 1)}>
          Forward →
        </button>
      </div>
      <HiddenHeart slug={slug} style={{ left: '4%', top: '8%' }} />
    </div>
  );
}

/* 13 ── Our Little Movie: a quiet montage, one line, fade to black. */
export function Movie({ slug, onDone }: ChapterProps) {
  const c = useContent();
  const clips = c.movie.clips;
  const [i, setI] = useState(-1);
  const [end, setEnd] = useState(false);
  const count = Math.max(clips.length, 5);
  useEffect(() => {
    if (i < 0 || end) return;
    const clip = clips[i];
    if (clip?.type === 'video') return; // videos advance on `ended`
    const t = window.setTimeout(() => next(), reducedMotion() ? 2500 : 3600);
    return () => window.clearTimeout(t);
  }, [i, end]);
  const next = () => {
    if (i + 1 >= count) {
      setEnd(true);
      onDone();
    } else setI(i + 1);
  };
  return (
    <div className={`bd-movie ${end ? 'is-end' : ''}`}>
      {i < 0 ? (
        <button type="button" className="bd-btn bd-btn--big" onClick={() => setI(0)}>
          ▶ Play
        </button>
      ) : !end ? (
        <div className="bd-movie__frame" key={i}>
          <Media media={clips[i]} label={`Clip ${i + 1} — photo or video`} className="bd-movie__media" autoPlay onEnded={next} />
        </div>
      ) : (
        <p className="bd-movie__line">{c.movie.line}</p>
      )}
      {i >= 0 && !end && <p className="bd-movie__caption">{c.movie.line}</p>}
      <HiddenHeart slug={slug} style={{ right: '3%', top: '4%' }} />
    </div>
  );
}

/* 14 ── For Dheepika: Door 25. Opens once chapters 1–13 are done. */
export function Finale({ slug, onDone }: ChapterProps) {
  const c = useContent();
  const prog = useProgress();
  const others = PROJECTS.filter((p) => p.slug !== slug);
  const doneCount = others.filter((p) => prog.done.includes(p.slug)).length;
  const locked = doneCount < others.length;
  const allHearts = prog.hearts.length >= PROJECTS.length;
  const [stage, setStage] = useState(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const begin = () => {
    setStage(1);
    const at = (ms: number, s: number) => timers.current.push(window.setTimeout(() => setStage(s), reducedMotion() ? ms / 3 : ms));
    at(c.finale.voice ? 9000 : 2500, 2); // darkness (+ voice) → memories
    at(c.finale.voice ? 14000 : 7500, 3); // → 25 · 11
    at(c.finale.voice ? 19000 : 12500, 4); // → headline
    at(c.finale.voice ? 24000 : 17500, 5); // → pull back: the whole garden, every flower in bloom
  };
  useEffect(() => {
    if (stage >= 5) events.emit('gardenReveal', true);
  }, [stage]);
  // leaving the finale always returns the camera to the chapter
  useEffect(() => () => events.emit('gardenReveal', false), []);
  useEffect(() => {
    if (stage >= 4) onDone();
  }, [stage]);
  if (locked) {
    return (
      <div className="bd-door">
        <div className="bd-door__frame" aria-hidden="true">
          <span>25</span>
        </div>
        <p>
          This door opens when every other door is open. <strong>{doneCount} / {others.length}</strong>
        </p>
        <ul className="bd-door__list">
          {others.map((p) => (
            <li key={p.slug} data-done={prog.done.includes(p.slug)}>
              {p.title}
            </li>
          ))}
        </ul>
        <HiddenHeart slug={slug} style={{ left: '50%', bottom: '3%' }} />
      </div>
    );
  }
  return (
    <div className="bd-finale" data-stage={stage}>
      {/* the 14th heart must be findable whether or not the door was ever seen locked */}
      <HiddenHeart slug={slug} style={{ left: '3%', bottom: '3%' }} />
      {stage === 0 && (
        <button type="button" className="bd-btn bd-btn--big" onClick={begin}>
          Open Door 25
        </button>
      )}
      {stage >= 1 && c.finale.voice && <Media media={c.finale.voice} label="Your voice" autoPlay className="bd-finale__voice" />}
      {stage >= 2 && (
        <div className="bd-orbit" aria-hidden="true">
          {c.memories.slice(0, 10).map((m, k) => (
            <div key={k} className="bd-orbit__item" style={{ ['--k' as string]: k, ['--n' as string]: Math.min(10, c.memories.length) }}>
              <Media media={m.media} label="" />
            </div>
          ))}
        </div>
      )}
      <ParticleText text={c.date} phase={stage >= 3 ? 'form' : stage >= 2 ? 'scatter' : 'hidden'} className="bd-finale__date" />
      {stage >= 4 && (
        <div className="bd-finale__end">
          <h2 className="bd-finale__name">{c.name.toUpperCase()}</h2>
          <p className="bd-finale__headline">{c.finale.headline}</p>
          <LastThing text={c.finale.lastThing} />
          {allHearts && <p className="bd-secret-ending">♥ {c.finale.secretEnding}</p>}
        </div>
      )}
    </div>
  );
}

function LastThing({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const shown = useTypewriter(text, open, 30);
  return open ? (
    <p className="bd-lastthing">{shown}</p>
  ) : (
    <button type="button" className="bd-btn" onClick={() => setOpen(true)}>
      One last thing…
    </button>
  );
}

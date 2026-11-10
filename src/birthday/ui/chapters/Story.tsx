import { useEffect, useRef, useState } from 'react';
import { events, state } from '../../../core/state';
import { PROJECTS } from '../../../app/projects';
import { HiddenHeart, Media, ParticleText, filled, reducedMotion, useContent, useProgress, useTypewriter } from '../shared';
import type { ChapterProps } from '../ChapterView';
import { Backdrop, liveAttr, useStage } from '../stage/useStage';
import { mediaUrl } from '../../vault';
import type { MediaRef } from '../../types';

/* 1 ── The Beginning: darkness, one star; waking it reveals the date and the line. */
export function Beginning({ slug, onDone }: ChapterProps) {
  const c = useContent();
  const [awake, setAwake] = useState(0);
  const ref = useRef<HTMLCanvasElement>(null);
  const stage = useRef<{ wake(l: number): void; dispose(): void } | null>(null);
  const [live, setLive] = useState(false);
  const [failed, setFailed] = useState(false);
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
      .catch(() => alive && setFailed(true));
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
    events.emit('sfx', 'star');
    stage.current?.wake(next);
  };
  return (
    <div className="bd-beginning" data-awake={awake} data-live={liveAttr(live, failed)}>
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
/** each lantern on the river carries its number; the date itself is on the page's title card */
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function Timeline({ slug, onDone }: ChapterProps) {
  const c = useContent();
  const [i, setI] = useState(0);
  const stops = [...c.timeline, { label: 'Next', text: c.emptyFrame, empty: true as const }];
  const s = stops[i];
  const track = useRef<HTMLOListElement>(null);
  // the river of light in 3D: one lantern per date; moving through the story travels along it
  const scene = useStage(() =>
    import('../stage/TimelineScene').then(({ TimelineScene }) => (cv: HTMLCanvasElement) => new TimelineScene(cv, stops.map((t, k) => ('empty' in t ? '…' : k === 0 && c.timelineStory?.intro ? '' : NUMERALS[k] ?? String(k + 1))))),
  );
  useEffect(() => scene.stage.current?.go(i), [i, scene.live]);
  useEffect(() => {
    if (i === stops.length - 1) onDone();
    // each date opens at the top of its card (the chapter may have been scrolled down the last one)
    const stage = track.current?.closest<HTMLElement>('.bd-chapter__stage');
    if (stage && stage.scrollTop > 0) stage.scrollTo({ top: 0, behavior: state.reducedMotion ? 'auto' : 'smooth' });
    // keep the current date in view on narrow screens (the strip scrolls sideways)
    const el = track.current?.children[i] as HTMLElement | undefined;
    const t = track.current;
    if (el && t && t.scrollWidth > t.clientWidth) t.scrollTo({ left: el.offsetLeft - t.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' });
  }, [i]);
  return (
    <div className="bd-timeline" data-live={scene.attr}>
      <Backdrop canvas={scene.ref} />
      {c.timelineStory?.intro && i === 0 && <p className="bd-timeline__intro">{c.timelineStory.intro}</p>}
      <ol className="bd-timeline__track" aria-label="Our timeline" ref={track}>
        {stops.map((t, k) => (
          <li key={k} data-passed={k < i}>
            <button type="button" aria-current={k === i} onClick={() => setI(k)}>
              <span className="bd-dot" />
              <span className="bd-timeline__label">{t.label}</span>
            </button>
          </li>
        ))}
      </ol>
      {/* every date is an engraved card: a numeral medallion, the date in gold, a diamond rule,
          the title in gold leaf, the story, and (when there is one) the photo in a gilt frame */}
      <article className="bd-timeline__stop bd-tl-card" key={i}>
        <Corners />
        <span className="bd-tl-card__num" aria-hidden="true">
          {'empty' in s ? '∞' : NUMERALS[i] ?? i + 1}
        </span>
        {'empty' in s ? (
          <>
            {c.timelineStory?.outro && <p className="bd-timeline__outro">{c.timelineStory.outro}</p>}
            <div className="bd-emptyframe">
              <div className="bd-emptyframe__frame" aria-hidden="true">
                <Corners />
                <span className="bd-emptyframe__heart">♡</span>
              </div>
              <p>{s.text}</p>
            </div>
          </>
        ) : (
          <>
            {filled(s.date) && <TimelineDate date={s.date!} />}
            {s.place && <p className="bd-tl-place">{s.place}</p>}
            <span className="bd-tl-rule" aria-hidden="true">
              <i />
            </span>
            <h3>{s.label}</h3>
            {s.gallery && s.gallery.length > 1 ? (
              <TimelineGallery photos={s.gallery} label={s.label} />
            ) : (
              (s.gallery?.[0] ?? s.media) && (
                <figure className="bd-tl-photo">
                  <Media media={(s.gallery?.[0] ?? s.media)!} label={`${s.label} — photo or clip`} className="bd-timeline__media" />
                </figure>
              )
            )}
            <p className="bd-timeline__lines">
              {s.text.split('\n').map((line, n) => (
                <span key={n} style={{ ['--n' as string]: n }}>
                  {line}
                </span>
              ))}
            </p>
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
  // her clips, or five leader frames until they're added
  const count = clips.length || 5;
  const [tall, setTall] = useState(false);
  // the cinema in 3D: its screen lies under the page's screen box, which holds her clips
  const box = useRef<HTMLDivElement>(null);
  const [parting, setParting] = useState(false);
  const scene = useStage(() => import('../stage/MovieScene').then(({ MovieScene }) => (cv: HTMLCanvasElement) => new MovieScene(cv)));
  useEffect(() => {
    if (!scene.live) return;
    let raf = 0;
    const tick = () => {
      const r = box.current?.getBoundingClientRect();
      if (r && r.width) scene.stage.current?.setAnchor(r.left / innerWidth, r.top / innerHeight, r.width / innerWidth, r.height / innerHeight);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [scene.live]);
  useEffect(() => {
    if (i >= 0 && !end) scene.stage.current?.clip(i, count);
    if (end) scene.stage.current?.close();
  }, [i, end]);
  const play = () => {
    if (!scene.stage.current) return setI(0);
    // house lights down, the curtains part, then the first clip
    setParting(true);
    scene.stage.current.open();
    window.setTimeout(() => setI(0), reducedMotion() ? 300 : 1800);
  };
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
    <div className={`bd-movie ${end ? 'is-end' : ''}`} data-live={scene.attr}>
      <Backdrop canvas={scene.ref} />
      <div ref={box} className="bd-movie__screen">
        {i >= 0 && !end && clips[i]?.type !== 'video' && (
          <div className="bd-movie__frame" key={i}>
            <Media media={clips[i]} label={`Clip ${i + 1} — photo or video`} className="bd-movie__media" autoPlay onEnded={next} />
          </div>
        )}
        {/* a portrait clip plays tall, in front of the cinema, instead of shrunk onto its wide screen */}
        {i >= 0 && !end && clips[i]?.type === 'video' && <MovieClip key={i} media={clips[i]} onEnded={next} onShape={setTall} tall={tall} />}
        {end && <p className="bd-movie__line">{c.movie.line}</p>}
      </div>
      {i < 0 && !parting && (
        <button type="button" className="bd-btn bd-btn--big bd-movie__play" onClick={play}>
          ▶ Play
        </button>
      )}
      {i >= 0 && !end && !(tall && clips[i]?.type === 'video') && <p className="bd-movie__caption">{c.movie.line}</p>}
      <HiddenHeart slug={slug} style={{ right: '3%', top: '4%' }} />
    </div>
  );
}

/**
 * One of her video clips, with its own sound: the garden's score falls silent while it plays.
 * If the phone refuses to start it with sound, it plays muted and offers a tap for sound.
 * Tapping the picture pauses and resumes it.
 */
function MovieClip({ media, onEnded, onShape, tall = false }: { media: MediaRef; onEnded: () => void; onShape: (tall: boolean) => void; tall?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let live = true;
    mediaUrl(media).then((u) => live && setUrl(u)).catch(() => live && onEnded());
    return () => {
      live = false;
      events.emit('duck', false);
    };
  }, [media.src]);
  useEffect(() => {
    const v = ref.current;
    if (!url || !v) return;
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => {});
    });
  }, [url]);
  return (
    <div className={`bd-movie__frame bd-movie__frame--video ${tall ? 'is-tall' : ''}`}>
      {url ? (
        <video
          ref={ref}
          className="bd-movie__video"
          src={url}
          playsInline
          aria-label={media.alt ?? 'A clip from our little movie'}
          onLoadedMetadata={(e) => onShape(e.currentTarget.videoHeight > e.currentTarget.videoWidth)}
          onPlay={(e) => !e.currentTarget.muted && events.emit('duck', 'full')}
          onPause={() => events.emit('duck', false)}
          onEnded={() => (events.emit('duck', false), onEnded())}
          onClick={(e) => (e.currentTarget.paused ? e.currentTarget.play().catch(() => {}) : e.currentTarget.pause())}
        />
      ) : (
        <div className="bd-media bd-media--loading" aria-busy="true" />
      )}
      {muted && (
        <button
          type="button"
          className="bd-btn bd-movie__sound"
          onClick={() => {
            const v = ref.current;
            if (!v) return;
            v.muted = false;
            setMuted(false);
            events.emit('duck', 'full');
          }}
        >
          🔊 Tap for sound
        </button>
      )}
    </div>
  );
}

/**
 * Several photos for one date: gilt-framed, side by side, swiped one to the next (each snaps to
 * the centre, the next one peeking in); gold diamonds below show which one she's on and take
 * her to any of them.
 */
function TimelineGallery({ photos, label }: { photos: MediaRef[]; label: string }) {
  const row = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const onScroll = () => {
    const r = row.current;
    if (!r) return;
    const items = [...r.children] as HTMLElement[];
    const mid = r.scrollLeft + r.clientWidth / 2;
    let best = 0;
    items.forEach((el, k) => {
      if (Math.abs(el.offsetLeft + el.clientWidth / 2 - mid) < Math.abs(items[best].offsetLeft + items[best].clientWidth / 2 - mid)) best = k;
    });
    // at either end of the row, the photo at that end is the one she's on
    if (r.scrollLeft >= r.scrollWidth - r.clientWidth - 2) best = items.length - 1;
    else if (r.scrollLeft <= 2) best = 0;
    setAt(best);
  };
  const go = (k: number) => {
    const r = row.current;
    const el = r?.children[k] as HTMLElement | undefined;
    setAt(k);
    if (r && el) r.scrollTo({ left: el.offsetLeft - (r.clientWidth - el.clientWidth) / 2, behavior: state.reducedMotion ? 'auto' : 'smooth' });
  };
  return (
    <div className="bd-tl-gallery" role="group" aria-label={`${label}: ${photos.length} photos`}>
      <div className="bd-tl-gallery__row" ref={row} onScroll={onScroll}>
        {photos.map((m, k) => (
          <figure key={k} className="bd-tl-photo" aria-current={k === at}>
            <Media media={m} label={`${label} — photo ${k + 1} of ${photos.length}`} className="bd-timeline__media" />
          </figure>
        ))}
      </div>
      <div className="bd-tl-gallery__dots">
        {photos.map((_, k) => (
          <button key={k} type="button" aria-label={`Photo ${k + 1} of ${photos.length}`} aria-current={k === at} onClick={() => go(k)}>
            <i />
          </button>
        ))}
      </div>
    </div>
  );
}

/** The date as an engraving: the day in large gold numerals, the month in spaced capitals. */
function TimelineDate({ date }: { date: string }) {
  const m = date.match(/^([\d\s&–-]+?)\s+([A-Za-z].*)$/);
  return (
    <p className="bd-tl-date">
      {m ? (
        <>
          <b>{m[1]}</b>
          <span>{m[2]}</span>
        </>
      ) : (
        <span>{date}</span>
      )}
    </p>
  );
}

/** Four small gilt flourishes for a card's corners. */
function Corners() {
  return (
    <span className="bd-corners" aria-hidden="true">
      {[0, 1, 2, 3].map((k) => (
        <svg key={k} viewBox="0 0 40 40" className={`bd-corner bd-corner--${k}`}>
          <path d="M2 30 V8 Q2 2 8 2 H30" />
          <path d="M8 22 V12 Q8 8 12 8 H22" />
          <circle cx="2" cy="34" r="1.6" />
          <circle cx="34" cy="2" r="1.6" />
        </svg>
      ))}
    </span>
  );
}

/* 14 ── For Dheepika: Door 25. Opens once chapters 1–13 are done. */
export function Finale({ slug, onDone }: ChapterProps) {
  const prog = useProgress();
  const others = PROJECTS.filter((p) => p.slug !== slug);
  const doneCount = others.filter((p) => prog.done.includes(p.slug)).length;
  const locked = doneCount < others.length;
  const allHearts = prog.hearts.length >= PROJECTS.length;
  const [stage, setStage] = useState(0);
  const [opening, setOpening] = useState(false);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  // Door 25 in 3D: lights around the arch count the open chapters; it swings open and the camera
  // passes through into the light before the finale begins
  const beginRef = useRef(() => {});
  const scene = useStage(() =>
    import('../stage/FinaleScene').then(({ FinaleScene }) => (cv: HTMLCanvasElement) => {
      const s = new FinaleScene(cv, others.length);
      s.onThrough = () => beginRef.current();
      return s;
    }),
  );
  useEffect(() => scene.stage.current?.setProgress(doneCount), [doneCount, scene.live]);
  const begun = useRef(false);
  const openDoor = () => {
    if (opening || begun.current) return;
    if (!scene.stage.current) return begin();
    setOpening(true);
    events.emit('sfx', 'door');
    scene.stage.current.open();
    timers.current.push(window.setTimeout(() => beginRef.current(), 7000)); // never wait forever
  };
  const begin = () => {
    if (begun.current) return;
    begun.current = true;
    setOpening(false);
    setStage(1);
    const at = (ms: number, s: number) => timers.current.push(window.setTimeout(() => setStage(s), reducedMotion() ? ms / 3 : ms));
    at(2500, 2); // darkness → memories
    at(7500, 3); // → 25 · 11
    at(12500, 4); // → headline
    at(17500, 5); // → pull back: the whole garden, every flower in bloom
  };
  useEffect(() => {
    if (stage >= 5) events.emit('gardenReveal', true);
  }, [stage]);
  // leaving the finale always returns the camera to the chapter
  useEffect(() => () => events.emit('gardenReveal', false), []);
  beginRef.current = begin;
  useEffect(() => {
    if (stage >= 4) onDone();
  }, [stage]);
  return (
    <>
      <Backdrop canvas={scene.ref} className={stage >= 5 ? 'bd-cosmos--gone' : ''} />
      {locked ? (
        <FinaleLocked slug={slug} live={scene.live} attr={scene.attr} doneCount={doneCount} others={others} done={prog.done} />
      ) : (
        <FinaleOpen slug={slug} stage={stage} opening={opening} allHearts={allHearts} onOpen={openDoor} />
      )}
    </>
  );
}

type LockedProps = { slug: string; live: boolean; attr: string; doneCount: number; others: typeof PROJECTS; done: string[] };
function FinaleLocked({ slug, live, attr, doneCount, others, done }: LockedProps) {
  return (
    <div className="bd-door" data-live={attr}>
      {!live && (
        <div className="bd-door__frame" aria-hidden="true">
          <span>25</span>
        </div>
      )}
      <p>
        This door opens when every other door is open. <strong>{doneCount} / {others.length}</strong>
      </p>
      <ul className="bd-door__list">
        {others.map((p) => (
          <li key={p.slug} data-done={done.includes(p.slug)}>
            {p.title}
          </li>
        ))}
      </ul>
      <HiddenHeart slug={slug} style={{ left: '50%', bottom: '3%' }} />
    </div>
  );
}

type OpenProps = { slug: string; stage: number; opening: boolean; allHearts: boolean; onOpen: () => void };
function FinaleOpen({ slug, stage, opening, allHearts, onOpen }: OpenProps) {
  const c = useContent();
  return (
    <div className="bd-finale" data-stage={stage} data-opening={opening}>
      {/* the 14th heart must be findable whether or not the door was ever seen locked */}
      <HiddenHeart slug={slug} style={{ left: '3%', bottom: '3%' }} />
      {stage === 0 && !opening && (
        <button type="button" className="bd-btn bd-btn--big" onClick={onOpen}>
          Open Door 25
        </button>
      )}
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

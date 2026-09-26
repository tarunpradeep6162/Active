import { useEffect, useRef, useState } from 'react';
import { events, state, store, type SectionId } from '../core/state';
import { rangeOf } from '../world/journey';
import { useStore } from './useStore';
import { useContent } from '../birthday/ui/shared';
import { mediaUrl } from '../birthday/vault';
import type { NarrationCue } from '../birthday/types';

/**
 * "Play the film": the whole journey, hands‑free, like a short movie (about two and a half
 * minutes). The camera travels from the opening through the garden, cuts to the cake while
 * the cage opens and the candles go out, cuts to the lake to let two lanterns go, and ends on
 * the sunrise under her name, then the end credits roll. Letterboxed, scored (the music
 * follows the shots), with your voice at its moments if you have recorded any. The director's
 * cut also steps into three chapters: the letter, the gifts and the wish. Scrolling, swiping
 * or a key press pauses it; she can resume or stop at any time.
 */

type Chapter = { slug: string; secs: number; note?: string; steps: { at: number; do: 'click' | 'hold'; sel: string; ms?: number }[] };
/** cut: no travel, the new shot is simply there (a blink of black, like a splice) */
type Shot = {
  to: [SectionId, number];
  travel: number;
  hold?: number;
  cut?: boolean;
  act?: 'openCage' | 'blow' | 'lantern';
  /** the score: a musical cue as the shot begins */
  cue?: 'rise' | 'hush' | 'swell';
  /** your voice, if you recorded one for this moment */
  voice?: NarrationCue;
  /** the director's cut: step into a chapter */
  chapter?: Chapter;
};

const OPENING: Shot[] = [
  { to: ['intro', 0], travel: 0, hold: 5, voice: 'opening' },
  { to: ['intro', 0.95], travel: 12 },
  { to: ['manifesto', 0.55], travel: 6, hold: 2.5 },
  { to: ['work', 0.02], travel: 5, voice: 'garden' },
];
const ENDING: Shot[] = [
  { to: ['lab', 0.6], travel: 0, cut: true, hold: 1.6, cue: 'rise', voice: 'cake' },
  { to: ['lab', 0.6], travel: 0, hold: 1.2, act: 'openCage' },
  { to: ['lab', 0.6], travel: 0, hold: 4, act: 'blow', cue: 'hush' },
  { to: ['lab', 0.6], travel: 0, hold: 7 },
  { to: ['portal', 0.45], travel: 0, cut: true, hold: 1.8, voice: 'lanterns' },
  { to: ['portal', 0.45], travel: 0, hold: 1.5, act: 'lantern' },
  { to: ['portal', 0.45], travel: 0, hold: 4.5, act: 'lantern' },
  { to: ['portal', 0.45], travel: 0, hold: 4.5 },
  { to: ['outro', 0.995], travel: 40, hold: 5, cue: 'swell', voice: 'sunrise' },
];
const FILM: Shot[] = [...OPENING, { to: ['work', 0.98], travel: 46 }, ...ENDING];
const DIRECTORS: Shot[] = [
  ...OPENING,
  { to: ['work', 0.2], travel: 12 },
  { to: ['work', 0.2], travel: 0, chapter: { slug: 'the-letter', secs: 30, steps: [{ at: 3, do: 'click', sel: '.bd-letter__open' }] } },
  { to: ['work', 0.62], travel: 16 },
  { to: ['work', 0.62], travel: 0, chapter: { slug: 'gift-boxes', secs: 9, note: 'Three boxes. Yours to open, later.', steps: [] } },
  { to: ['work', 0.62], travel: 0, chapter: { slug: 'make-a-wish', secs: 13, steps: [{ at: 4, do: 'hold', sel: '.bd-wish .bd-btn', ms: 2600 }] } },
  { to: ['work', 0.98], travel: 14 },
  ...ENDING,
];

const at = ([id, local]: [SectionId, number]) => {
  const r = rangeOf(id);
  return r.start + (r.end - r.start) * local;
};
const smooth = (x: number) => x * x * (3 - 2 * x);

export function FilmMode() {
  const c = useContent();
  const route = useStore((s) => s.route);
  const audioOn = useStore((s) => s.audioOn);
  const [mode, setMode] = useState<'off' | 'playing' | 'paused'>('off');
  const [cut, setCut] = useState<'film' | 'directors'>('film');
  const [subtitle, setSubtitle] = useState('');
  const clock = useRef({ shot: 0, t: 0, from: 0, acted: false, begun: false, spliced: false, steps: 0, inChapter: false });
  const script = cut === 'directors' ? DIRECTORS : FILM;
  const voice = useRef<HTMLAudioElement | null>(null);

  // start from the opening's buttons (or anywhere that emits playFilm)
  useEffect(() => {
    const off = events.on('playFilm', (which) => {
      clock.current = { shot: 0, t: 0, from: 0, acted: false, begun: false, spliced: false, steps: 0, inChapter: false };
      setCut(which === 'directors' ? 'directors' : 'film');
      window.scrollTo({ top: 0, behavior: 'instant' });
      // a film has a score: the sound comes up with it (this is her tap, so the browser allows it)
      if (!store.get().audioOn) events.emit('toggleAudio', undefined);
      setMode('playing');
    });
    return () => void off();
  }, []);

  // the page reflects the film: letterbox, controls tucked away
  useEffect(() => {
    state.filmOn = mode === 'playing';
    document.documentElement.classList.toggle('is-film', mode !== 'off');
    if (mode === 'off') {
      state.filmBlow = false;
      events.emit('filmCue', 'reset');
      setSubtitle('');
    }
    if (mode !== 'playing') voice.current?.pause();
    else if (voice.current && !voice.current.ended) voice.current.play().catch(() => {});
  }, [mode]);

  // opening a chapter (or For you) herself pauses the film; the director's cut opens its own
  useEffect(() => {
    if (mode === 'playing' && route.name !== 'home' && route.name !== 'work' && !clock.current.inChapter) setMode('paused');
  }, [route.name]);

  // the candles went out: stop blowing
  useEffect(() => {
    const off = events.on('blowCandles', () => (state.filmBlow = false));
    return () => void off();
  }, []);

  // her own scrolling, swiping or keys pause it
  useEffect(() => {
    if (mode !== 'playing') return;
    const pause = () => !clock.current.inChapter && setMode('paused');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMode('off');
      else if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) pause();
    };
    addEventListener('wheel', pause, { passive: true });
    addEventListener('touchmove', pause, { passive: true });
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('wheel', pause);
      removeEventListener('touchmove', pause);
      removeEventListener('keydown', onKey);
    };
  }, [mode]);

  /** your voice for this moment: the music steps back while you speak */
  const speak = (cue: NarrationCue) => {
    const line = c.narration?.find((n) => n.at === cue);
    if (!line) return;
    mediaUrl(line.media)
      .then((url) => {
        if (!state.filmOn) return;
        voice.current?.pause();
        const a = new Audio(url);
        voice.current = a;
        events.emit('duck', true);
        if (line.text) setSubtitle(line.text);
        a.onended = () => (events.emit('duck', false), setSubtitle(''));
        a.play().catch(() => events.emit('duck', false));
      })
      .catch(() => {});
  };

  // the projector: one shot at a time, travelling then holding
  useEffect(() => {
    if (mode !== 'playing') return;
    let raf = 0, last = performance.now();
    const k0 = clock.current;
    // resuming: travel on from wherever she is now (the shot's action is not repeated)
    if (k0.shot > 0 || k0.t > 0) {
      k0.from = state.scroll.progress;
      if (!k0.inChapter) k0.t = 0;
    }
    const run = (now: number) => {
      // real time (a slow device drops frames but the film keeps its pace)
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      const k = clock.current;
      const shot = script[k.shot];
      if (!shot) {
        setMode('off');
        events.emit('rollCredits', undefined);
        return;
      }
      if (!k.begun) {
        k.begun = true;
        // a match cut: the iris closes on this shot's subject first, then the splice
        if (shot.cut) events.emit('filmCutStart', undefined);
        if (shot.cue) events.emit('filmCue', shot.cue);
        if (shot.voice) speak(shot.voice);
        if (shot.chapter) {
          k.inChapter = true;
          k.steps = 0;
          if (shot.chapter.note) setSubtitle(shot.chapter.note);
          events.emit('navigate', { name: 'project', slug: shot.chapter.slug });
        }
      }
      k.t += dt;
      if (shot.cut && !k.spliced) {
        if (k.t < 0.5) {
          raf = requestAnimationFrame(run);
          return;
        }
        k.spliced = true;
        k.t = 0;
        events.emit('filmCut', at(shot.to));
        k.from = at(shot.to);
      }
      if (shot.chapter) {
        // inside a chapter: its own moments, then back out to the garden
        const ch = shot.chapter;
        while (k.steps < ch.steps.length && k.t >= ch.steps[k.steps].at) {
          const st = ch.steps[k.steps++];
          const el = document.querySelector<HTMLElement>(st.sel);
          if (st.do === 'click') el?.click();
          else if (el) {
            el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, isPrimary: true }));
            setTimeout(() => el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, isPrimary: true })), st.ms ?? 2000);
          }
        }
        if (k.t >= ch.secs) {
          events.emit('navigate', { name: 'work' });
          if (ch.note) setSubtitle('');
          k.inChapter = false;
          k.shot++;
          k.t = 0;
          k.acted = false;
          k.begun = false;
          k.from = state.scroll.progress;
        }
        raf = requestAnimationFrame(run);
        return;
      }
      const e = shot.travel > 0 ? smooth(Math.min(1, k.t / shot.travel)) : 1;
      const p = k.from + (at(shot.to) - k.from) * e;
      // after a chapter the garden is still settling back; don't fight the transition
      if (state.transition.phase === 'IDLE') window.scrollTo({ top: p * state.scroll.max, behavior: 'instant' });
      if (e >= 1 && shot.act && !k.acted) {
        k.acted = true;
        if (shot.act === 'openCage') events.emit('openCage', undefined);
        if (shot.act === 'blow') state.filmBlow = true; // the cake's own label blows, as if she held the button
        if (shot.act === 'lantern') events.emit('releaseNextLantern', undefined);
      }
      // the candles: hold until the cage has lifted and they are really out (on a slow device the
      // cake's own clock runs behind real time), at most a minute
      const waiting = shot.act === 'blow' && state.filmBlow && k.t < shot.travel + 60;
      if (!waiting && k.t >= shot.travel + (shot.hold ?? 0)) {
        if (shot.act === 'blow') state.filmBlow = false;
        k.shot++;
        k.t = 0;
        k.from = p;
        k.acted = false;
        k.begun = false;
        k.spliced = false;
      }
      raf = requestAnimationFrame(run);
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [mode, script]);

  if (mode === 'off') return null;
  return (
    <>
      {subtitle && (
        <p className="film-subtitle" aria-live="polite">
          {subtitle}
        </p>
      )}
      <div className="film-controls" role="group" aria-label="Film">
        <span className="film-controls__label">{mode === 'playing' ? `Now playing · ${cut === 'directors' ? 'director’s cut' : 'our film'}` : 'Film paused'}</span>
        <button type="button" onClick={() => setMode(mode === 'playing' ? 'paused' : 'playing')}>
          {mode === 'playing' ? '❚❚ Pause' : '▶ Resume'}
        </button>
        <button type="button" aria-pressed={audioOn} onClick={() => events.emit('toggleAudio', undefined)}>
          {audioOn ? '♪ On' : '♪ Off'}
        </button>
        <button type="button" onClick={() => setMode('off')}>
          ✕ Stop
        </button>
      </div>
    </>
  );
}

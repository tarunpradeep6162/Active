import { useEffect, useRef, useState } from 'react';
import { events, state, type SectionId } from '../core/state';
import { rangeOf } from '../world/journey';
import { useStore } from './useStore';

/**
 * "Play the film": the whole journey, hands‑free, like a short movie (about two and a half
 * minutes). The camera travels from the opening through the garden, holds on the cake while
 * the cage opens and the candles go out, lets two lanterns go over the lake, and ends on the
 * sunrise under her name. Letterboxed, with the page's controls tucked away. Scrolling,
 * swiping or a key press pauses it; she can resume or stop at any time.
 */

type Shot = { to: [SectionId, number]; travel: number; hold?: number; act?: 'openCage' | 'blow' | 'lantern' };

const SCRIPT: Shot[] = [
  { to: ['intro', 0], travel: 0, hold: 5 },
  { to: ['intro', 0.95], travel: 10 },
  { to: ['manifesto', 0.55], travel: 6, hold: 2.5 },
  { to: ['work', 0.02], travel: 5 },
  { to: ['work', 0.98], travel: 46 },
  { to: ['lab', 0.6], travel: 6, hold: 1.5, act: 'openCage' },
  { to: ['lab', 0.6], travel: 0, hold: 4, act: 'blow' },
  { to: ['lab', 0.6], travel: 0, hold: 7 },
  { to: ['portal', 0.45], travel: 7, hold: 1.5, act: 'lantern' },
  { to: ['portal', 0.45], travel: 0, hold: 4.5, act: 'lantern' },
  { to: ['portal', 0.45], travel: 0, hold: 4.5 },
  { to: ['outro', 0.995], travel: 40, hold: 5 },
];

const at = ([id, local]: [SectionId, number]) => {
  const r = rangeOf(id);
  return r.start + (r.end - r.start) * local;
};
const smooth = (x: number) => x * x * (3 - 2 * x);

export function FilmMode() {
  const route = useStore((s) => s.route);
  const [mode, setMode] = useState<'off' | 'playing' | 'paused'>('off');
  const clock = useRef({ shot: 0, t: 0, from: 0, acted: false });

  // start from the opening's button (or anywhere that emits playFilm)
  useEffect(() => {
    const off = events.on('playFilm', () => {
      clock.current = { shot: 0, t: 0, from: 0, acted: false };
      window.scrollTo({ top: 0, behavior: 'instant' });
      setMode('playing');
    });
    return () => void off();
  }, []);

  // the page reflects the film: letterbox, controls tucked away
  useEffect(() => {
    state.filmOn = mode === 'playing';
    document.documentElement.classList.toggle('is-film', mode !== 'off');
    if (mode === 'off') state.filmBlow = false;
  }, [mode]);

  // opening a chapter, or For you, pauses the film
  useEffect(() => {
    if (mode === 'playing' && route.name !== 'home' && route.name !== 'work') setMode('paused');
  }, [route.name]);

  // the candles went out: stop blowing
  useEffect(() => {
    const off = events.on('blowCandles', () => (state.filmBlow = false));
    return () => void off();
  }, []);

  // her own scrolling, swiping or keys pause it
  useEffect(() => {
    if (mode !== 'playing') return;
    const pause = () => setMode('paused');
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

  // the projector: one shot at a time, travelling then holding
  useEffect(() => {
    if (mode !== 'playing') return;
    let raf = 0, last = performance.now();
    const c = clock.current;
    // resuming: travel on from wherever she is now (the shot's action is not repeated)
    if (c.shot > 0 || c.t > 0) {
      c.from = state.scroll.progress;
      c.t = 0;
    }
    const run = (now: number) => {
      // real time (a slow device drops frames but the film keeps its pace)
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      const shot = SCRIPT[c.shot];
      if (!shot) return setMode('off');
      c.t += dt;
      const k = shot.travel > 0 ? smooth(Math.min(1, c.t / shot.travel)) : 1;
      const p = c.from + (at(shot.to) - c.from) * k;
      window.scrollTo({ top: p * state.scroll.max, behavior: 'instant' });
      if (k >= 1 && shot.act && !c.acted) {
        c.acted = true;
        if (shot.act === 'openCage') events.emit('openCage', undefined);
        if (shot.act === 'blow') state.filmBlow = true; // the cake's own label blows, as if she held the button
        if (shot.act === 'lantern') events.emit('releaseNextLantern', undefined);
      }
      // the candles: hold until they are really out (on a slow device it takes longer), at most 20 s
      const waiting = shot.act === 'blow' && state.filmBlow && c.t < shot.travel + 20;
      if (!waiting && c.t >= shot.travel + (shot.hold ?? 0)) {
        if (shot.act === 'blow') state.filmBlow = false;
        c.shot++;
        c.t = 0;
        c.from = p;
        c.acted = false;
      }
      raf = requestAnimationFrame(run);
    };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  if (mode === 'off') return null;
  return (
    <div className="film-controls" role="group" aria-label="Film">
      <span className="film-controls__label">{mode === 'playing' ? 'Now playing · our film' : 'Film paused'}</span>
      <button type="button" onClick={() => setMode(mode === 'playing' ? 'paused' : 'playing')}>
        {mode === 'playing' ? '❚❚ Pause' : '▶ Resume'}
      </button>
      <button type="button" onClick={() => setMode('off')}>
        ✕ Stop
      </button>
    </div>
  );
}

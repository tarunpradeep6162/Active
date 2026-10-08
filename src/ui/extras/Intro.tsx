import { useEffect, useState } from 'react';
import { useContent } from '../../birthday/ui/shared';
import { playIntro, finishIntro } from './introGate';

/**
 * The first visit only: a ten‑second opening, like a studio's logo before a film. A gold line
 * draws across the dark, a tulip draws itself, "a garden grown in secret · for" and then her name
 * in gold; the frame opens like a curtain onto the garden. A tap skips it. It plays while the
 * garden loads, so it costs her no waiting at all.
 */
export function Intro() {
  const c = useContent();
  const [phase, setPhase] = useState<'play' | 'out' | 'gone'>(playIntro ? 'play' : 'gone');
  useEffect(() => {
    if (phase !== 'play') return;
    const short = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setPhase('out'), short ? 2600 : 9200);
    return () => clearTimeout(t);
  }, [phase]);
  useEffect(() => {
    if (phase !== 'out') return;
    finishIntro();
    const t = setTimeout(() => setPhase('gone'), 1300);
    return () => clearTimeout(t);
  }, [phase]);
  if (phase === 'gone') return null;
  return (
    <div className={`intro is-${phase}`} role="presentation" onClick={() => phase === 'play' && setPhase('out')}>
      <div className="intro__half intro__half--top" />
      <div className="intro__half intro__half--bottom" />
      <div className="intro__stage" aria-hidden="true">
        <span className="intro__line" />
        <svg className="intro__tulip" viewBox="-40 -60 80 120">
          <path d="M0 58 C-3 30 2 16 0 2" pathLength={1} />
          <path d="M0 34 C-12 26 -18 18 -20 10" pathLength={1} />
          <path d="M-15 -6 C-17 -24 -8 -34 0 -38 C8 -34 17 -24 15 -6 C9 1 -9 1 -15 -6 Z" pathLength={1} />
          <path d="M0 -38 C-5 -26 -5 -12 0 -2" pathLength={1} />
        </svg>
        <p className="intro__kicker">a garden grown in secret</p>
        <p className="intro__for">for</p>
        <h2 className="intro__name">{c.name}</h2>
        <p className="intro__date">{c.date}</p>
      </div>
      <p className="intro__skip">tap to begin</p>
    </div>
  );
}

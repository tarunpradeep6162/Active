import { useEffect, useRef, useState } from 'react';
import { state } from '../../core/state';
import { now, nextBirthday } from '../../core/clock';
import { useContent } from '../../birthday/ui/shared';
import { buzz } from './haptics';

/**
 * Before her birthday the garden waits behind a sealed gate: a live countdown to midnight on the
 * day and two wrought gates with a rose seal. At midnight it opens by itself (and the midnight
 * surprise plays). Until then she can still press and hold the seal to peek, so it never locks
 * her out; a peek lasts for this visit. Off with `gate.enabled: false`, and never shown while
 * testing (?qa) unless asked for (?gate).
 */
const q = new URLSearchParams(location.search);
const PEEK = 'bday-gate-peek';
const peeked = () => {
  try {
    return sessionStorage.getItem(PEEK) === '1';
  } catch {
    return false;
  }
};

export function BirthdayGate() {
  const c = useContent();
  const [t, setT] = useState(now);
  const [phase, setPhase] = useState<'closed' | 'opening' | 'gone'>(() =>
    !c.gate.enabled || nextBirthday(c.date).today || peeked() || ((q.has('qa') || q.has('sign')) && !q.has('gate')) ? 'gone' : 'closed',
  );
  const [hold, setHold] = useState(0);
  const holdRef = useRef<{ raf: number; t0: number } | null>(null);
  useEffect(() => {
    if (phase === 'gone') return;
    state.hold++;
    const id = setInterval(() => setT(now()), 1000);
    return () => {
      state.hold--;
      clearInterval(id);
    };
  }, [phase === 'gone']);
  const { start, today } = nextBirthday(c.date, t);
  // midnight arrived while she was waiting: the gates open by themselves
  useEffect(() => {
    if (today && phase === 'closed') open(false);
  }, [today]);
  function open(peek: boolean) {
    if (peek)
      try {
        sessionStorage.setItem(PEEK, '1');
      } catch {
        /* fine */
      }
    buzz('click');
    setPhase('opening');
    setTimeout(() => setPhase('gone'), 2200);
  }
  const down = () => {
    if (phase !== 'closed') return;
    const t0 = performance.now();
    const tick = (n: number) => {
      const k = Math.min(1, (n - t0) / 1600);
      setHold(k);
      if (k >= 1) {
        holdRef.current = null;
        open(true);
        return;
      }
      if (holdRef.current) holdRef.current.raf = requestAnimationFrame(tick);
    };
    holdRef.current = { t0, raf: requestAnimationFrame(tick) };
    buzz('soft');
  };
  const up = () => {
    if (holdRef.current) cancelAnimationFrame(holdRef.current.raf);
    holdRef.current = null;
    if (phase === 'closed') setHold(0);
  };
  if (phase === 'gone') return null;
  const s = Math.max(0, Math.floor((start.getTime() - t.getTime()) / 1000));
  const days = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <div className={`gate is-${phase}`} role="dialog" aria-modal="true" aria-label={c.gate.title}>
      <div className="gate__sky" aria-hidden="true" />
      <div className="gate__door gate__door--l" aria-hidden="true" />
      <div className="gate__door gate__door--r" aria-hidden="true" />
      <div className="gate__body">
        <p className="gate__date">{c.date}</p>
        <h2 className="gate__title">{c.gate.title}</h2>
        <p className="gate__line">{c.gate.line}</p>
        <p className="gate__count" aria-label={`${days} days, ${h} hours, ${m} minutes to go`}>
          {[
            [days, days === 1 ? 'day' : 'days'],
            [pad(h), 'hours'],
            [pad(m), 'min'],
            [pad(sec), 'sec'],
          ].map(([v, l]) => (
            <span key={l}>
              <b>{v}</b>
              <i>{l}</i>
            </span>
          ))}
        </p>
        <button
          type="button"
          className="gate__seal"
          style={{ ['--hold' as string]: hold }}
          onPointerDown={down}
          onPointerUp={up}
          onPointerLeave={up}
          onPointerCancel={up}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !e.repeat && down()}
          onKeyUp={up}
          onContextMenu={(e) => e.preventDefault()}
          aria-label="Press and hold to peek inside early"
        >
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle className="gate__ring" cx="50" cy="50" r="46" pathLength={1} />
          </svg>
          <span>♥</span>
        </button>
        <p className="gate__hint">press and hold the seal to peek</p>
      </div>
    </div>
  );
}

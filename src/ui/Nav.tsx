import { useEffect, useRef } from 'react';
import { events } from '../core/state';
import { useStore } from './useStore';
import { NavFX } from './NavFX';
import { scramble } from './scramble';
import { routePath } from '../app/router';

function NavLink({ label, to, current }: { label: string; to: 'work' | 'contact'; current: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const cancel = useRef<() => void>(() => {});
  const run = () => {
    if (!ref.current) return;
    cancel.current();
    cancel.current = scramble(ref.current, label, 360, matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  return (
    <a
      className="nav__link"
      href={routePath({ name: to })}
      aria-current={current ? 'page' : undefined}
      aria-label={label}
      onMouseEnter={run}
      onFocus={run}
      onClick={(e) => {
        e.preventDefault();
        events.emit('navigate', current && to === 'contact' ? { name: 'home' } : { name: to });
      }}
    >
      <span className="nav__sizer" aria-hidden="true">
        {label}
      </span>
      <span ref={ref} className="nav__fx" aria-hidden="true">
        {label}
      </span>
    </a>
  );
}

export function Nav() {
  const route = useStore((s) => s.route);
  const audioOn = useStore((s) => s.audioOn);
  const root = useRef<HTMLElement>(null);
  const fill = useRef<SVGPathElement>(null);
  const stroke = useRef<SVGPathElement>(null);
  const divider = useRef<SVGPathElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const fx = useRef<NavFX | null>(null);

  useEffect(() => {
    fx.current = new NavFX(root.current!, fill.current!, stroke.current!, divider.current!, glow.current!);
    return () => fx.current?.destroy();
  }, []);
  const waved = route.name !== 'home';
  useEffect(() => fx.current?.setWave(waved), [waved]);

  const onWork = route.name === 'work' || route.name === 'project';
  return (
    <nav
      ref={root}
      className="nav"
      aria-label="Primary"
      onMouseEnter={() => root.current?.classList.add('is-hot')}
      onMouseLeave={() => root.current?.classList.remove('is-hot')}
    >
      <div ref={glow} className="nav__glow" aria-hidden="true">
        <div className="nav__rain" />
      </div>
      <svg className="nav__svg" aria-hidden="true">
        <path ref={fill} className="nav__fill" />
        <path ref={stroke} className="nav__stroke" />
      </svg>
      <div className="nav__row">
        <NavLink label="WORK" to="work" current={onWork} />
        <svg className="nav__divider" viewBox="0 0 50 14" aria-hidden="true">
          <path ref={divider} d="M 0 7 L 50 7" />
        </svg>
        <NavLink label="CONTACT" to="contact" current={route.name === 'contact'} />
      </div>
      <div className={`ticker ${onWork ? 'is-visible' : ''}`} aria-hidden={!onWork}>
        <button type="button" aria-label={audioOn ? 'Mute ambient audio' : 'Play ambient audio'} onClick={() => events.emit('toggleAudio', undefined)} tabIndex={onWork ? 0 : -1}>
          {audioOn ? '■' : '▶'}
        </button>
        <div className="ticker__track">
          <span>{audioOn ? 'NOW PLAYING — MERIDIAN FIELD · TIDEWATER DRONE (GENERATIVE)' : 'SOUND OFF — PRESS PLAY FOR THE GENERATIVE AMBIENT BED'}</span>
        </div>
      </div>
      {!onWork && (
        <button type="button" className={`audio-toggle label ${audioOn ? 'is-on' : ''}`} aria-pressed={audioOn} onClick={() => events.emit('toggleAudio', undefined)}>
          <span className="audio-toggle__bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          {audioOn ? 'SOUND ON' : 'SOUND OFF'}
        </button>
      )}
    </nav>
  );
}

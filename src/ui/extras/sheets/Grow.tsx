import { useMemo, useState, type ReactElement } from 'react';
import { useContent, Media, filled } from '../../../birthday/ui/shared';
import { local, visitDays } from '../local';
import { buzz } from '../haptics';
import { events } from '../../../core/state';
import type { Place } from '../../../birthday/types';

/* ------------------------------------------------------------------ 15 · Map of us */

/**
 * The places you've been together as glowing points on a quiet night map (a fine grid of
 * latitude and longitude, no map tiles, nothing fetched). Tap a point for its date, words and
 * photo. One more point, faint, waits for the place you haven't been yet.
 */
export function MapOfUs() {
  const c = useContent();
  const places = c.places;
  const [sel, setSel] = useState<number | null>(places.length ? 0 : null);
  const view = useMemo(() => frame(places), [places]);
  const W = 600, H = 720;
  const px = (p: { lat: number; lng: number }) => [((p.lng - view.w) / (view.e - view.w)) * W, ((view.n - p.lat) / (view.n - view.s)) * H] as const;
  const step = view.e - view.w > 12 ? 5 : view.e - view.w > 4 ? 1 : 0.5;
  const lines: ReactElement[] = [];
  for (let x = Math.ceil(view.w / step) * step; x <= view.e; x += step) {
    const X = ((x - view.w) / (view.e - view.w)) * W;
    lines.push(<line key={`x${x}`} x1={X} x2={X} y1={0} y2={H} />);
  }
  for (let y = Math.ceil(view.s / step) * step; y <= view.n; y += step) {
    const Y = ((view.n - y) / (view.n - view.s)) * H;
    lines.push(<line key={`y${y}`} x1={0} x2={W} y1={Y} y2={Y} />);
  }
  // the next place: a faint point a little beyond the last one
  const last = places[places.length - 1];
  const next = last ? px({ lat: last.lat + (view.n - view.s) * 0.18, lng: last.lng + (view.e - view.w) * 0.22 }) : ([W * 0.6, H * 0.4] as const);
  const route = places.map((p) => px(p).join(',')).join(' ');
  const p = sel !== null ? places[sel] : null;
  return (
    <div className="map">
      <svg className="map__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="A map of the places we've been">
        <defs>
          <radialGradient id="map-glow">
            <stop offset="0" stopColor="#fff4d6" />
            <stop offset=".35" stopColor="#f3dfa7" stopOpacity=".7" />
            <stop offset="1" stopColor="#f3dfa7" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="map__grid">{lines}</g>
        <g className="map__rose" transform={`translate(${W - 60} ${H - 70})`}>
          <path d="M0 -26 L5 0 L0 26 L-5 0 Z" />
          <text y="-32" textAnchor="middle">
            N
          </text>
        </g>
        {places.length > 1 && <polyline className="map__route" points={route} />}
        <g className="map__next" transform={`translate(${next[0]} ${next[1]})`}>
          <circle r="16" fill="url(#map-glow)" opacity=".35" />
          <text y="-18" textAnchor="middle">
            ?
          </text>
        </g>
        {places.map((pl, i) => {
          const [x, y] = px(pl);
          return (
            <g key={i} className={`map__pt ${sel === i ? 'is-on' : ''}`} transform={`translate(${x} ${y})`} onClick={() => (setSel(i), buzz('soft'))} role="button" tabIndex={0} aria-label={pl.name} onKeyDown={(e) => e.key === 'Enter' && setSel(i)}>
              <circle r="34" fill="url(#map-glow)" />
              <circle r="4.5" fill="#fff4d6" />
              <text y="-24" textAnchor="middle">
                {pl.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="map__card" aria-live="polite">
        {p ? <PlaceCard p={p} /> : <p className="sheet__note">[Add the places you've been together in the content file.]</p>}
        <p className="map__future">
          <b>?</b> {c.future[0]?.text ?? 'The next place is still a secret.'}
        </p>
      </div>
    </div>
  );
}

function PlaceCard({ p }: { p: Place }) {
  return (
    <>
      <p className="map__date">{filled(p.date) || ' '}</p>
      <h4 className="map__name">{p.name}</h4>
      {p.text && <p className="map__text">{p.text}</p>}
      {p.media && <Media media={p.media} label={p.name} className="map__photo" />}
    </>
  );
}

/** the map's bounds around the places (a sensible region even for one place) */
function frame(ps: Place[]) {
  if (!ps.length) return { n: 14, s: 8, w: 74, e: 80 };
  let n = Math.max(...ps.map((p) => p.lat)), s = Math.min(...ps.map((p) => p.lat));
  let e = Math.max(...ps.map((p) => p.lng)), w = Math.min(...ps.map((p) => p.lng));
  const span = Math.max(1.6, (n - s) * 1.6, (e - w) * 1.6);
  const cy = (n + s) / 2, cx = (e + w) / 2;
  // keep the map's own shape (600 × 720)
  n = cy + (span * 1.2) / 2;
  s = cy - (span * 1.2) / 2;
  e = cx + span / 2;
  w = cx - span / 2;
  return { n, s, e, w };
}

/* ------------------------------------------------------------------ 16 · Plant a tulip */

type Plot = { planted: string; name: string; waters: string[] } | null;
const PLOT = 'bday-my-tulip';
const STAGES = ['A seed, tucked into the soil.', 'A first green shoot!', 'Two leaves, reaching up.', 'A stem, growing taller.', 'A bud. Any day now…', 'In full bloom. Just like you.'];

/** She plants her own tulip; it grows a stage with each day she comes back (or waters it). */
export function PlantTulip() {
  const [plot, setPlot] = useState<Plot>(() => local.get<Plot>(PLOT, null));
  const [name, setName] = useState('');
  const [splash, setSplash] = useState(0);
  const today = new Date().toDateString();
  const stage = plot ? Math.max(0, Math.min(5, new Set([...visitDays().filter((d) => Date.parse(d) >= Date.parse(new Date(plot.planted).toDateString())), ...plot.waters, today]).size - 1)) : -1;
  const plant = () => {
    const p = { planted: new Date().toISOString(), name: name.trim() || 'Little one', waters: [] };
    local.set(PLOT, p);
    setPlot(p);
    buzz('click');
    events.emit('sfx', 'gift');
  };
  const water = () => {
    if (!plot || plot.waters.includes(today)) return;
    const p = { ...plot, waters: [...plot.waters, today] };
    local.set(PLOT, p);
    setPlot(p);
    setSplash((s) => s + 1);
    buzz('flutter');
  };
  return (
    <div className="plant">
      <svg className="plant__svg" viewBox="0 0 300 300" aria-hidden="true">
        <defs>
          <radialGradient id="plant-glow" cx="50%" cy="55%" r="55%">
            <stop offset="0" stopColor="#f3dfa7" stopOpacity={0.12 + Math.max(0, stage) * 0.05} />
            <stop offset="1" stopColor="#f3dfa7" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="petal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f6c3cf" />
            <stop offset="1" stopColor="#c8475f" />
          </linearGradient>
        </defs>
        <circle cx="150" cy="170" r="150" fill="url(#plant-glow)" />
        <ellipse cx="150" cy="262" rx="110" ry="22" fill="#2a1a16" />
        <ellipse cx="150" cy="256" rx="100" ry="16" fill="#3b261f" />
        {stage === 0 && <ellipse cx="150" cy="250" rx="7" ry="5" fill="#8a6a3a" />}
        {stage >= 1 && <path className="plant__grow" d={`M150 256 C 148 ${256 - stage * 14} 152 ${256 - stage * 26} 150 ${256 - [0, 22, 46, 90, 120, 128][stage]}`} stroke="#5d8a4a" strokeWidth="5" fill="none" strokeLinecap="round" />}
        {stage >= 2 && (
          <>
            <path className="plant__grow" d="M150 238 C 120 228 108 206 104 186 C 126 196 142 214 150 236 Z" fill="#6b9a52" />
            <path className="plant__grow" d="M150 226 C 178 214 190 194 194 172 C 172 184 156 200 150 224 Z" fill="#5d8a4a" />
          </>
        )}
        {stage === 4 && <path className="plant__grow" d="M150 104 C 138 120 136 140 150 146 C 164 140 162 120 150 104 Z" fill="url(#petal)" />}
        {stage >= 5 && (
          <g className="plant__bloom">
            <path d="M150 92 C 126 104 122 132 138 146 C 146 152 154 152 162 146 C 178 132 174 104 150 92 Z" fill="url(#petal)" />
            <path d="M128 104 C 112 118 116 142 138 146 C 132 132 130 118 128 104 Z" fill="#e8a6b5" />
            <path d="M172 104 C 188 118 184 142 162 146 C 168 132 170 118 172 104 Z" fill="#e8a6b5" />
          </g>
        )}
        {splash > 0 && (
          <g key={splash} className="plant__drops">
            {[0, 1, 2, 3, 4].map((i) => (
              <circle key={i} cx={130 + i * 10} cy="60" r="3" fill="#a8d4f0" style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </g>
        )}
      </svg>
      {!plot ? (
        <div className="plant__form">
          <p className="sheet__intro">A tulip of your own. Plant it today, and it will grow a little more every day you come back.</p>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Give it a name" aria-label="Your tulip's name" />
          <button type="button" className="sheet__btn" onClick={plant}>
            Plant it
          </button>
        </div>
      ) : (
        <div className="plant__form">
          <p className="plant__name">{plot.name}</p>
          <p className="sheet__intro">{STAGES[Math.max(0, stage)]}</p>
          <button type="button" className="sheet__btn" onClick={water} disabled={plot.waters.includes(today)}>
            {plot.waters.includes(today) ? 'Watered today ♥' : 'Water it'}
          </button>
          <p className="sheet__note">Planted {new Date(plot.planted).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}. It lives only on this phone.</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ 17 · Wish jar */

type Star = { text: string; at: string; x: number; y: number; r: number };
const JAR = 'bday-wish-jar';

/** Her wishes fold into paper stars and drop into a glass jar that fills up over time. */
export function WishJar() {
  const [stars, setStars] = useState<Star[]>(() => local.get<Star[]>(JAR, []));
  const [text, setText] = useState('');
  const [read, setRead] = useState<Star | null>(null);
  const [falling, setFalling] = useState(0);
  const add = () => {
    if (!text.trim()) return;
    // stars settle in layers from the bottom of the jar
    const k = stars.length;
    const row = Math.floor(k / 5), col = k % 5;
    const s: Star = { text: text.trim(), at: new Date().toISOString(), x: 92 + col * 29 + (row % 2) * 14 + (Math.random() - 0.5) * 8, y: 300 - row * 22 + (Math.random() - 0.5) * 6, r: Math.random() * 60 };
    const next = [...stars, s].slice(-60);
    setStars(next);
    local.set(JAR, next);
    setText('');
    setFalling((f) => f + 1);
    buzz('soft');
    events.emit('sfx', 'star');
  };
  const star = (cx: number, cy: number, r: number) => {
    const pts: string[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rad = i % 2 ? r * 0.45 : r;
      pts.push(`${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad}`);
    }
    return pts.join(' ');
  };
  return (
    <div className="jar">
      <svg className="jar__svg" viewBox="0 0 300 360" aria-label={`A glass jar holding ${stars.length} wishes`}>
        <defs>
          <linearGradient id="glass" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".16" />
            <stop offset=".2" stopColor="#fff" stopOpacity=".04" />
            <stop offset=".8" stopColor="#fff" stopOpacity=".03" />
            <stop offset="1" stopColor="#fff" stopOpacity=".14" />
          </linearGradient>
        </defs>
        <ellipse cx="150" cy="54" rx="58" ry="10" fill="#8a6a3a" opacity=".8" />
        <rect x="94" y="40" width="112" height="16" rx="6" fill="#b8925a" />
        <path d="M100 62 C 70 80 66 110 66 140 L 66 300 C 66 322 86 334 150 334 C 214 334 234 322 234 300 L 234 140 C 234 110 230 80 200 62 Z" fill="url(#glass)" stroke="rgba(255,255,255,.35)" strokeWidth="2" />
        {stars.map((s, i) => (
          <polygon
            key={i}
            points={star(s.x, s.y, 11)}
            transform={`rotate(${s.r} ${s.x} ${s.y})`}
            className={`jar__star ${i === stars.length - 1 && falling ? 'is-new' : ''}`}
            fill={['#f3dfa7', '#f6c3cf', '#fff4d6', '#e8a6b5'][i % 4]}
            onClick={() => setRead(s)}
            role="button"
            aria-label="A wish"
          />
        ))}
        <path d="M80 100 C 76 150 76 230 82 290" stroke="rgba(255,255,255,.25)" strokeWidth="5" fill="none" strokeLinecap="round" />
      </svg>
      {read ? (
        <div className="jar__read">
          <p className="jar__wish">“{read.text}”</p>
          <p className="sheet__note">wished {new Date(read.at).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <button type="button" className="sheet__btn" onClick={() => setRead(null)}>
            Back in the jar
          </button>
        </div>
      ) : (
        <div className="jar__form">
          <p className="sheet__intro">{stars.length ? `${stars.length} ${stars.length === 1 ? 'wish' : 'wishes'} in the jar. Tap a star to read it.` : 'Write a wish. It folds into a paper star and drops into the jar.'}</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="I wish…" aria-label="Your wish" />
          <button type="button" className="sheet__btn" onClick={add} disabled={!text.trim()}>
            Fold it into a star
          </button>
          <p className="sheet__note">Kept only on this phone.</p>
        </div>
      )}
    </div>
  );
}

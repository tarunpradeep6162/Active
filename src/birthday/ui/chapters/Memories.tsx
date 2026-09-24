import { useEffect, useRef, useState } from 'react';
import { events } from '../../../core/state';
import { chooseGift } from '../../progress';
import { mediaUrl } from '../../vault';
import { HiddenHeart, Media, filled, useContent } from '../shared';
import type { ChapterProps } from '../ChapterView';

/* 2 ── Memory Universe: floating memories, a Polaroid camera and a photo puzzle. */
export function MemoryUniverse({ slug, onDone }: ChapterProps) {
  const c = useContent();
  const [tab, setTab] = useState<'float' | 'polaroid' | 'puzzle'>('float');
  const [open, setOpen] = useState<number | null>(null);
  const [seen, setSeen] = useState<Set<number>>(new Set());
  useEffect(() => {
    if (seen.size >= Math.min(3, c.memories.length)) onDone();
  }, [seen]);
  const m = open !== null ? c.memories[open] : null;
  return (
    <div className="bd-memories">
      <div className="bd-tabs" role="tablist">
        {(['float', 'polaroid', 'puzzle'] as const).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === 'float' ? 'Memories' : t === 'polaroid' ? 'Polaroid camera' : 'Puzzle our photo'}
          </button>
        ))}
      </div>
      {tab === 'float' && (
        <MemoryOrbit
          onOpen={(k) => {
            setOpen(k);
            setSeen((s) => new Set(s).add(k));
          }}
          focus={open}
        />
      )}
      {tab === 'float' && m && (
        <div className="bd-lightbox" role="dialog" aria-label="Memory">
          {m.media && <Media media={m.media} label={`Photo ${open! + 1}`} className="bd-lightbox__media" />}
          <p className="bd-lightbox__caption">{m.caption}</p>
          <p className="bd-meta">{[filled(m.date), filled(m.place)].filter(Boolean).join(' · ')}</p>
          {m.note && <p>{m.note}</p>}
          <button type="button" className="bd-btn" onClick={() => setOpen(null)}>
            Close
          </button>
        </div>
      )}
      {tab === 'polaroid' && <Polaroid />}
      {tab === 'puzzle' && <Puzzle />}
      <HiddenHeart slug={slug} style={{ right: '2%', bottom: '2%' }} />
    </div>
  );
}

/** Places item k of n on an ellipse around the stage centre, alternating near / far. */
/**
 * The memories as polaroids in slow orbit (3D), with the flat floating photos as the fallback
 * and an accessible list for keyboards and screen readers.
 */
function MemoryOrbit({ onOpen, focus }: { onOpen: (k: number) => void; focus: number | null }) {
  const c = useContent();
  const ref = useRef<HTMLCanvasElement>(null);
  const stage = useRef<{ open(i: number): void; release(): void; dispose(): void } | null>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      const urls = await Promise.all(c.memories.map((m) => (m.media && m.media.type === 'image' ? mediaUrl(m.media, 768).catch(() => undefined) : Promise.resolve(undefined))));
      const { MemoryScene } = await import('../stage/MemoryScene');
      if (!alive || !ref.current) return;
      const s = new MemoryScene(
        ref.current,
        c.memories.map((m, i) => ({ caption: m.caption, url: urls[i] })),
      );
      s.onOpen = onOpen;
      stage.current = s;
      setLive(true);
    })().catch(() => {});
    return () => {
      alive = false;
      stage.current?.dispose();
      stage.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c]);
  useEffect(() => {
    if (focus === null) stage.current?.release();
  }, [focus]);
  return (
    <>
      <div className="bd-cosmos" aria-hidden="true">
        <canvas ref={ref} className="bd-cosmos__canvas bd-cosmos__canvas--interactive" />
      </div>
      {live ? (
        <>
          <p className="bd-hint bd-orbit__hint">Touch a memory.</p>
          <ul className="sr-only">
            {c.memories.map((m, k) => (
              <li key={k}>
                <button type="button" onClick={() => (stage.current ? stage.current.open(k) : onOpen(k))}>
                  Open memory {k + 1}: {m.caption}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="bd-float">
          {c.memories.map((mem, k) => (
            <button key={k} type="button" className="bd-float__item" style={ellipse(k, c.memories.length)} onClick={() => onOpen(k)} aria-label={`Open memory ${k + 1}`}>
              <Media media={mem.media} label={`Photo ${k + 1}`} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function ellipse(k: number, n: number): React.CSSProperties {
  const a = (k / n) * Math.PI * 2 - Math.PI / 2;
  const far = k % 2 ? 0.82 : 1;
  return { left: `${50 + Math.cos(a) * 38 * far}%`, top: `${50 + Math.sin(a) * 36 * far}%`, ['--k' as string]: k, ['--s' as string]: far };
}

function Polaroid() {
  const c = useContent();
  const [shot, setShot] = useState<number | null>(null);
  const [n, setN] = useState(0);
  const take = () => {
    const pool = c.memories.map((_, i) => i).filter((i) => i !== shot);
    setShot(pool[Math.floor(Math.random() * pool.length)] ?? 0);
    setN((x) => x + 1);
  };
  const m = shot !== null ? c.memories[shot] : null;
  return (
    <div className="bd-polaroid">
      <button type="button" className="bd-camera" onClick={take} aria-label="Press the shutter">
        <span className="bd-camera__lens" />
      </button>
      <p className="bd-hint">{c.polaroidPrompt}</p>
      {m && (
        <figure className="bd-polaroid__print" key={n}>
          <Media media={m.media} label={`Photo ${shot! + 1}`} />
          <figcaption>{m.caption}</figcaption>
        </figure>
      )}
    </div>
  );
}

/** 3×3 tap‑to‑swap puzzle; the picture is whole again when every tile is home. */
function Puzzle() {
  const c = useContent();
  const [order, setOrder] = useState<number[]>(() => shuffle());
  const [pick, setPick] = useState<number | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (c.puzzle.media) mediaUrl(c.puzzle.media).then(setUrl).catch(() => setUrl(null));
  }, [c.puzzle.media?.src]);
  const solved = order.every((v, i) => v === i);
  const bg = url ? `url(${url})` : 'linear-gradient(135deg,#3b1d4a,#d9738c 45%,#ffe0a0)';
  return (
    <div className="bd-puzzle">
      <div className={`bd-puzzle__grid ${solved ? 'is-solved' : ''}`} role="grid" aria-label="Photo puzzle">
        {order.map((tile, pos) => (
          <button
            key={pos}
            type="button"
            className={`bd-puzzle__tile ${pick === pos ? 'is-picked' : ''}`}
            style={{ backgroundImage: bg, backgroundPosition: `${(tile % 3) * 50}% ${Math.floor(tile / 3) * 50}%` }}
            aria-label={`Tile ${pos + 1}`}
            disabled={solved}
            onClick={() => {
              if (pick === null) return setPick(pos);
              const next = order.slice();
              [next[pick], next[pos]] = [next[pos], next[pick]];
              setOrder(next);
              setPick(null);
            }}
          />
        ))}
      </div>
      <p className="bd-hint">{solved ? c.puzzle.caption : url ? 'Tap two tiles to swap them.' : 'Tap two tiles to swap them. (Your photo goes here.)'}</p>
    </div>
  );
}
function shuffle() {
  const a = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  do for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  while (a.every((v, i) => v === i));
  return a;
}

/* 7 ── Unlock Our Secret: clues → symbols → scratch to reveal the hidden memory. */
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '');

export function Secret({ slug, onDone }: ChapterProps) {
  const c = useContent();
  const [solved, setSolved] = useState<boolean[]>(() => c.secret.clues.map(() => false));
  const [i, setI] = useState(0);
  const [value, setValue] = useState('');
  const [wobble, setWobble] = useState(false);
  const all = solved.every(Boolean);
  const clue = c.secret.clues[i];
  return (
    <div className="bd-secret">
      <p className="bd-hint">{c.secret.intro}</p>
      <div className="bd-code" aria-label="The code so far">
        {c.secret.clues.map((cl, k) => (
          <span key={k} className={solved[k] ? 'is-open' : ''}>
            {solved[k] ? cl.symbol : '•'}
          </span>
        ))}
      </div>
      {!all ? (
        <form
          className={`bd-clue ${wobble ? 'is-wobble' : ''}`}
          onSubmit={(e) => {
            e.preventDefault();
            if (clue.answers.some((a) => norm(a) === norm(value))) {
              const next = solved.slice();
              next[i] = true;
              events.emit('gardenPulse', undefined);
              setSolved(next);
              setValue('');
              const k = next.findIndex((v) => !v);
              if (k >= 0) setI(k);
            } else {
              setWobble(true);
              window.setTimeout(() => setWobble(false), 450);
            }
          }}
        >
          <p className="bd-clue__text">
            Clue {i + 1}: {clue.clue}
          </p>
          <label className="sr-only" htmlFor="bd-clue-input">
            Your answer
          </label>
          <input id="bd-clue-input" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" placeholder="Your answer" />
          <button type="submit" className="bd-btn">
            Try
          </button>
          {wobble && <p className="bd-soft">Not quite — think about us. 💭</p>}
        </form>
      ) : (
        <Scratch onRevealed={onDone}>
          <Media media={c.secret.reveal.media} label="The hidden photo" className="bd-scratch__media" />
          <p>{c.secret.reveal.text}</p>
        </Scratch>
      )}
      <HiddenHeart slug={slug} style={{ left: '2%', bottom: '4%' }} />
    </div>
  );
}

/** Dark‑gold surface she scratches away with a finger or the mouse. */
function Scratch({ children, onRevealed }: { children: React.ReactNode; onRevealed: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.max(1, Math.round(cv.clientWidth * dpr));
    cv.height = Math.max(1, Math.round(cv.clientHeight * dpr));
    const grad = g.createLinearGradient(0, 0, cv.width, cv.height);
    grad.addColorStop(0, '#3a2a12');
    grad.addColorStop(0.5, '#b8913f');
    grad.addColorStop(1, '#2a1d0c');
    g.fillStyle = grad;
    g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = 'rgba(255,240,200,.85)';
    g.font = `${16 * dpr}px 'Share Tech Mono', monospace`;
    g.textAlign = 'center';
    g.fillText('scratch here', cv.width / 2, cv.height / 2);
    g.globalCompositeOperation = 'destination-out';
    let down = false;
    let strokes = 0;
    const at = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      g.beginPath();
      g.arc((e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr, 26 * dpr, 0, Math.PI * 2);
      g.fill();
      if (++strokes % 20 === 0) {
        const d = g.getImageData(0, 0, cv.width, cv.height).data;
        let clear = 0;
        for (let k = 3; k < d.length; k += 64) if (d[k] === 0) clear++;
        if (clear / (d.length / 64) > 0.55) {
          setDone(true);
          onRevealed();
        }
      }
    };
    const dn = (e: PointerEvent) => { down = true; cv.setPointerCapture(e.pointerId); at(e); };
    const mv = (e: PointerEvent) => down && at(e);
    const up = () => (down = false);
    cv.addEventListener('pointerdown', dn);
    cv.addEventListener('pointermove', mv);
    cv.addEventListener('pointerup', up);
    return () => {
      cv.removeEventListener('pointerdown', dn);
      cv.removeEventListener('pointermove', mv);
      cv.removeEventListener('pointerup', up);
    };
  }, []);
  return (
    <div className="bd-scratch">
      <div className="bd-scratch__under">{children}</div>
      <canvas ref={ref} className={`bd-scratch__cover ${done ? 'is-done' : ''}`} aria-label="Scratch to reveal" />
      {!done && (
        <button type="button" className="bd-link" onClick={() => { setDone(true); onRevealed(); }}>
          Reveal without scratching
        </button>
      )}
    </div>
  );
}

/* 10 ── Choose a Gift: three boxes, one choice. */
export function Gifts({ slug, onDone }: ChapterProps) {
  const c = useContent();
  // every visit starts with three closed boxes: she chooses each time (the last choice is still
  // remembered for her progress, but never opens a box on its own)
  const [chosen, setChosen] = useState<number | null>(null);
  const [round, setRound] = useState(0);
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = useRef<{ choose(i: number): void; dispose(): void } | null>(null);
  const [failed, setFailed] = useState(false);
  // the message appears once the lid is off and the light has risen
  const [revealed, setRevealed] = useState(false);
  const pick = (k: number) => {
    setChosen((cur) => {
      if (cur !== null) return cur;
      chooseGift(k);
      onDone();
      return k;
    });
  };
  const again = () => {
    setRevealed(false);
    setChosen(null);
    setRound((r) => r + 1);
  };
  useEffect(() => {
    let alive = true;
    import('../GiftScene')
      .then(({ GiftScene }) => {
        if (!alive || !ref.current) return;
        const s = new GiftScene(ref.current, null);
        s.onPick = (k) => pick(k);
        s.onRevealed = () => alive && setRevealed(true);
        scene.current = s;
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      scene.current?.dispose();
      scene.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);
  // no 3D (or not loaded yet): the reveal happens straight away; and it never waits forever
  useEffect(() => {
    if (chosen === null || revealed) return;
    if (failed || !scene.current) return setRevealed(true);
    const id = setTimeout(() => setRevealed(true), 5000);
    return () => clearTimeout(id);
  }, [failed, chosen, revealed]);
  const gift = chosen !== null ? c.gifts[chosen] : null;
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (revealed) setTimeout(() => card.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 500);
  }, [revealed]);
  return (
    <div className="bd-gifts">
      <p className="bd-hint bd-gifts__hint">{chosen === null ? 'Three boxes. You may open only one.' : revealed ? 'Your gift' : 'Opening…'}</p>
      {!failed ? (
        <div className={`bd-giftstage ${revealed ? 'is-revealed' : ''}`}>
          <canvas key={round} ref={ref} className="bd-giftstage__canvas" role="img" aria-label="Three gift boxes wrapped in satin with gold ribbons, floating in soft spotlights" />
          {/* keyboard and screen‑reader path to the same three boxes */}
          <div className="sr-only">
            {c.gifts.map((g, k) => (
              <button key={k} type="button" disabled={chosen !== null} onClick={() => (scene.current ? scene.current.choose(k) : pick(k))}>
                Open gift {g.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="bd-gifts__row">
          {c.gifts.map((g, k) => (
            <button key={k} type="button" className={`bd-gift ${chosen === k ? 'is-open' : chosen !== null ? 'is-shut' : ''}`} disabled={chosen !== null} onClick={() => pick(k)} aria-label={`Gift ${g.label}`}>
              <span className="bd-gift__lid" />
              <span className="bd-gift__box">{g.label}</span>
            </button>
          ))}
        </div>
      )}
      {gift && revealed && (
        <div className="bd-giftcard" aria-live="polite" ref={card}>
          <p className="bd-giftcard__kind">{gift.kind === 'promise' ? 'A promise' : gift.kind === 'message' ? 'A message' : gift.kind === 'photo' ? 'A photo' : gift.kind === 'memory' ? 'A memory' : 'A clue'} · {gift.label}</p>
          {gift.media && <Media media={gift.media} label="Your gift" className="bd-gift__media" />}
          <p className="bd-giftcard__text">{gift.text}</p>
          <button type="button" className="bd-link bd-giftcard__again" onClick={again}>
            Close the box and choose again
          </button>
        </div>
      )}
      <HiddenHeart slug={slug} style={{ right: '6%', top: '6%' }} />
    </div>
  );
}

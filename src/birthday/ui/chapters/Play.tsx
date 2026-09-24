import { useEffect, useRef, useState } from 'react';
import { chooseThisOrThat } from '../../progress';
import { HiddenHeart, useContent, useProgress } from '../shared';
import type { ChapterProps } from '../ChapterView';
import { saveNextDateCard } from '../../keepsakes';

/* 5 ── Catch My Heart: petals escape the flower; steer a little light to catch them, dodge the clouds. */
/** A tulip petal (rose, or gold for the double‑value ones), tumbling as it falls. */
function drawPetal(g: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, gold: boolean) {
  g.save();
  g.translate(x, y);
  g.rotate(Math.sin(t * 1.3) * 0.8);
  g.scale(1, 0.75 + 0.25 * Math.sin(t * 2.1));
  const grad = g.createLinearGradient(0, r, 0, -r);
  grad.addColorStop(0, gold ? '#fff1c9' : '#ffe4c4');
  grad.addColorStop(0.35, gold ? '#ffcf6b' : '#e0567a');
  grad.addColorStop(1, gold ? '#ffe9a8' : '#ffb3c6');
  g.fillStyle = grad;
  g.shadowColor = gold ? 'rgba(255, 207, 107, .8)' : 'rgba(255, 122, 162, .6)';
  g.shadowBlur = r * 0.8;
  g.beginPath();
  g.moveTo(0, r);
  g.bezierCurveTo(r * 0.95, r * 0.4, r * 0.8, -r * 0.9, 0, -r);
  g.bezierCurveTo(-r * 0.8, -r * 0.9, -r * 0.95, r * 0.4, 0, r);
  g.fill();
  g.restore();
}

export function CatchGame({ slug, onDone }: ChapterProps) {
  const c = useContent();
  const ref = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<'ready' | 'play' | 'won'>('ready');
  const [score, setScore] = useState(0);
  const GOAL = 14;
  useEffect(() => {
    if (state !== 'play') return;
    const cv = ref.current!;
    const g = cv.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (cv.width = Math.max(1, Math.round(cv.clientWidth * dpr))), H = (cv.height = Math.max(1, Math.round(cv.clientHeight * dpr)));
    let px = W / 2, target = W / 2, caught = 0, stun = 0, raf = 0, last = performance.now(), spawn = 0;
    type Item = { x: number; y: number; v: number; kind: 'heart' | 'star' | 'cloud'; r: number };
    const items: Item[] = [];
    const move = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      target = (e.clientX - r.left) * dpr;
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') target = Math.max(0, target - W * 0.08);
      if (e.key === 'ArrowRight') target = Math.min(W, target + W * 0.08);
    };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerdown', move);
    window.addEventListener('keydown', key);
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      spawn -= dt;
      if (spawn <= 0) {
        spawn = 0.55 + Math.random() * 0.4;
        const roll = Math.random();
        items.push({ x: (0.08 + Math.random() * 0.84) * W, y: -20 * dpr, v: (120 + Math.random() * 90) * dpr, kind: roll < 0.55 ? 'heart' : roll < 0.75 ? 'star' : 'cloud', r: 16 * dpr });
      }
      px += (target - px) * Math.min(1, dt * 10);
      stun = Math.max(0, stun - dt);
      g.clearRect(0, 0, W, H);
      const py = H - 46 * dpr;
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.y += it.v * dt;
        const hit = Math.hypot(it.x - px, it.y - py) < it.r + 22 * dpr;
        if (hit && stun <= 0) {
          if (it.kind === 'cloud') {
            stun = 0.8;
            caught = Math.max(0, caught - 1);
          } else caught += it.kind === 'heart' ? 1 : 0;
          if (it.kind === 'star') caught = Math.min(GOAL, caught + 2);
          setScore(caught);
          items.splice(i, 1);
          continue;
        }
        if (it.y > H + 40) {
          items.splice(i, 1);
          continue;
        }
        if (it.kind === 'cloud') {
          g.font = `${it.r * 2}px serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('☁', it.x, it.y);
        } else drawPetal(g, it.x, it.y, it.r, now / 1000 + it.x, it.kind === 'star');
      }
      // the player: a small glowing light
      const glow = g.createRadialGradient(px, py, 0, px, py, 34 * dpr);
      glow.addColorStop(0, stun > 0 ? 'rgba(160,170,200,1)' : 'rgba(255,241,201,1)');
      glow.addColorStop(1, 'rgba(255,120,160,0)');
      g.fillStyle = glow;
      g.beginPath();
      g.arc(px, py, 34 * dpr, 0, Math.PI * 2);
      g.fill();
      if (caught >= GOAL) {
        setState('won');
        onDone();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerdown', move);
      window.removeEventListener('keydown', key);
    };
  }, [state]);
  return (
    <div className="bd-game">
      <canvas ref={ref} className="bd-game__canvas" aria-label="Catch the falling hearts; move with the pointer or the arrow keys" />
      <div className="bd-game__hud">
        ✿ {score} / {GOAL}
      </div>
      {state === 'ready' && (
        <div className="bd-game__overlay">
          <p>The petals are escaping. Catch {GOAL}. Golden ones count double; clouds steal one.</p>
          <button type="button" className="bd-btn bd-btn--big" onClick={() => { setScore(0); setState('play'); }}>
            Start
          </button>
          <button type="button" className="bd-link" onClick={() => { setState('won'); onDone(); }}>
            Skip the game
          </button>
        </div>
      )}
      {state === 'won' && (
        <div className="bd-game__overlay">
          <p className="bd-game__win">You caught them all.</p>
          <p className="bd-game__win bd-game__win--late">{c.game.finish}</p>
        </div>
      )}
      <HiddenHeart slug={slug} style={{ left: '2%', top: '2%' }} />
    </div>
  );
}

/* 6 ── How well do you know us? Gentle reactions, then This‑or‑That → our next date. */
export function Quiz({ slug, onDone }: ChapterProps) {
  const c = useContent();
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [part, setPart] = useState<'quiz' | 'tot' | 'card'>('quiz');
  const q = c.quiz[i];
  useEffect(() => {
    // nothing to ask: go straight on (content may leave the quiz empty)
    if (part === 'quiz' && !c.quiz.length) setPart(c.thisOrThat.length ? 'tot' : 'card');
  }, [part, c.quiz.length]);
  if (part === 'quiz' && !q) return null;
  if (part === 'tot') return <ThisOrThat slug={slug} onFinish={() => { setPart('card'); onDone(); }} />;
  if (part === 'card') return <NextDateCard slug={slug} />;
  return (
    <div className="bd-quiz">
      <p className="bd-meta">
        Question {i + 1} / {c.quiz.length}
      </p>
      <h3 className="bd-quiz__q">{q.q}</h3>
      <div className="bd-quiz__options">
        {q.options.map((o, k) => (
          <button key={k} type="button" className={`bd-choice ${picked === k ? 'is-picked' : ''}`} disabled={picked !== null} onClick={() => setPicked(k)}>
            {o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="bd-quiz__reaction" aria-live="polite">
          <p>{q.answer === null || q.answer === picked ? q.yes : q.no}</p>
          {q.answer !== null && q.answer !== picked && <p className="bd-meta">My answer: {q.options[q.answer]}</p>}
          <button
            type="button"
            className="bd-btn"
            onClick={() => {
              setPicked(null);
              if (i + 1 < c.quiz.length) setI(i + 1);
              else setPart('tot');
            }}
          >
            {i + 1 < c.quiz.length ? 'Next question' : 'Now: this or that?'}
          </button>
        </div>
      )}
      <HiddenHeart slug={slug} style={{ right: '3%', bottom: '3%' }} />
    </div>
  );
}

function ThisOrThat({ slug, onFinish }: { slug: string; onFinish: () => void }) {
  const c = useContent();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!c.thisOrThat.length) onFinish();
  }, []);
  if (!c.thisOrThat[i]) return null;
  const [a, b] = c.thisOrThat[i];
  const pick = (k: 0 | 1) => {
    chooseThisOrThat(i, k);
    if (i + 1 < c.thisOrThat.length) setI(i + 1);
    else onFinish();
  };
  return (
    <div className="bd-tot">
      <p className="bd-meta">This or that? {i + 1} / {c.thisOrThat.length}</p>
      <div className="bd-tot__pair">
        <button type="button" className="bd-choice bd-choice--big" onClick={() => pick(0)}>
          {a}
        </button>
        <span className="bd-tot__or">or</span>
        <button type="button" className="bd-choice bd-choice--big" onClick={() => pick(1)}>
          {b}
        </button>
      </div>
      <HiddenHeart slug={slug} style={{ right: '3%', bottom: '3%' }} />
    </div>
  );
}

function NextDateCard({ slug }: { slug: string }) {
  const c = useContent();
  const picks = useProgress().thisOrThat;
  const chosen = c.thisOrThat.map((pair, k) => (picks[k] !== undefined ? pair[picks[k]] : null)).filter(Boolean) as string[];
  return (
    <div className="bd-datecard">
      <p className="bd-meta">Our next date, according to you</p>
      <ul>
        {chosen.map((x, k) => (
          <li key={k}>{x}</li>
        ))}
      </ul>
      <p>Saved on this device. I'll take it from here. 😌</p>
      {chosen.length > 0 && (
        <button type="button" className="bd-link" onClick={() => saveNextDateCard(chosen)}>
          Save as an image
        </button>
      )}
      <HiddenHeart slug={slug} style={{ right: '3%', bottom: '3%' }} />
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useContent, filled } from '../../../birthday/ui/shared';
import { mediaUrl } from '../../../birthday/vault';
import { saveBlob, savePng } from '../../../birthday/keepsakes';
import { canRecord } from '../../recorder';
import { events, store } from '../../../core/state';
import { buzz } from '../haptics';
import { SERIF } from '../../../utils/fonts';

const MONO = "'Share Tech Mono', ui-monospace, monospace";
const HAND = "'Caveat', 'Segoe Script', cursive";

/* ------------------------------------------------------------------ 19 · Photo booth */

/**
 * A selfie in a golden birthday frame. The front camera starts only when she taps, the picture
 * is made on her phone and saved to her phone; nothing is uploaded, and the camera switches off
 * as soon as she leaves.
 */
export function PhotoBooth() {
  const c = useContent();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [mode, setMode] = useState<'idle' | 'live' | 'count' | 'shot' | 'denied'>('idle');
  const [n, setN] = useState(3);
  const [shot, setShot] = useState<HTMLCanvasElement | null>(null);
  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => stop, []);
  // the preview element is new each time she comes back to the camera ("Take another"):
  // hand it the stream again
  useEffect(() => {
    if ((mode === 'live' || mode === 'count') && video.current && stream.current && video.current.srcObject !== stream.current) {
      video.current.srcObject = stream.current;
      video.current.play().catch(() => {});
    }
  }, [mode]);
  const start = async () => {
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1440 }, height: { ideal: 1440 } }, audio: false });
      setMode('live');
    } catch {
      setMode('denied');
    }
  };
  const snap = () => {
    setMode('count');
    let k = 3;
    setN(k);
    const id = setInterval(() => {
      k--;
      if (k > 0) {
        setN(k);
        buzz('soft');
        return;
      }
      clearInterval(id);
      const v = video.current!;
      setShot(compose(v, c.name, c.date));
      buzz('click');
      events.emit('sfx', 'gift');
      setMode('shot');
    }, 800);
  };
  return (
    <div className="booth">
      {mode === 'idle' && (
        <div className="booth__start">
          <p className="sheet__intro">A birthday photo, in a golden frame. Your camera turns on only when you tap below, and the photo stays on your phone.</p>
          <button type="button" className="sheet__btn" onClick={start}>
            Open the camera
          </button>
        </div>
      )}
      {mode === 'denied' && <p className="sheet__intro">The camera isn’t available here. (You can allow it in your browser’s settings for this site, then try again.)</p>}
      {(mode === 'live' || mode === 'count') && (
        <div className="booth__live">
          <div className="booth__frame">
            <video ref={video} playsInline muted className="booth__video" />
            <div className="booth__overlay" aria-hidden="true">
              <span className="booth__title">Happy birthday</span>
              <span className="booth__name">
                {c.name} · {c.date}
              </span>
            </div>
            {mode === 'count' && (
              <span className="booth__count" key={n}>
                {n}
              </span>
            )}
          </div>
          <button type="button" className="booth__shutter" onClick={snap} disabled={mode === 'count'} aria-label="Take the photo" />
        </div>
      )}
      {mode === 'shot' && shot && (
        <div className="booth__result">
          <img src={shot.toDataURL('image/jpeg', 0.9)} alt="Your birthday photo" className="booth__img" />
          <div className="sheet__row">
            <button type="button" className="sheet__btn" onClick={() => savePng(shot, `birthday-${c.name.toLowerCase()}.png`)}>
              Save to my phone
            </button>
            <button type="button" className="sheet__btn sheet__btn--ghost" onClick={() => setMode('live')}>
              Take another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The photo, mirrored like a mirror, in a gold frame with her name and the date. */
function compose(v: HTMLVideoElement, name: string, date: string) {
  const W = 1080, H = 1350, cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  const vw = v.videoWidth || 1, vh = v.videoHeight || 1, k = Math.max(W / vw, H / vh);
  g.save();
  g.translate(W, 0);
  g.scale(-1, 1);
  g.drawImage(v, (W - vw * k) / 2, (H - vh * k) / 2, vw * k, vh * k);
  g.restore();
  // warm grade and a soft vignette
  g.fillStyle = 'rgba(255, 190, 150, .08)';
  g.fillRect(0, 0, W, H);
  const vg = g.createRadialGradient(W / 2, H * 0.45, H * 0.3, W / 2, H / 2, H * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(10, 6, 16, .6)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
  // the band at the bottom
  const band = g.createLinearGradient(0, H - 330, 0, H);
  band.addColorStop(0, 'rgba(7, 9, 20, 0)');
  band.addColorStop(1, 'rgba(7, 9, 20, .85)');
  g.fillStyle = band;
  g.fillRect(0, H - 330, W, 330);
  // gold frame: a double line with corner flourishes
  const gold = g.createLinearGradient(0, 0, W, H);
  gold.addColorStop(0, '#d6b46a');
  gold.addColorStop(0.5, '#fff0c4');
  gold.addColorStop(1, '#d6b46a');
  g.strokeStyle = gold;
  g.lineWidth = 6;
  g.strokeRect(34, 34, W - 68, H - 68);
  g.lineWidth = 2;
  g.strokeRect(54, 54, W - 108, H - 108);
  for (const [x, y] of [
    [54, 54],
    [W - 54, 54],
    [54, H - 54],
    [W - 54, H - 54],
  ]) {
    g.fillStyle = gold;
    g.beginPath();
    g.arc(x, y, 9, 0, Math.PI * 2);
    g.fill();
  }
  // sparkles
  for (let i = 0; i < 36; i++) {
    const x = 70 + Math.random() * (W - 140), y = 70 + Math.random() * (H * 0.35);
    g.fillStyle = `rgba(255, 244, 214, ${0.3 + Math.random() * 0.6})`;
    g.beginPath();
    g.arc(x, y, Math.random() * 2.6 + 0.8, 0, Math.PI * 2);
    g.fill();
  }
  g.textAlign = 'center';
  g.fillStyle = gold;
  g.font = `italic 500 92px ${SERIF}`;
  g.fillText('Happy birthday', W / 2, H - 170);
  g.fillStyle = '#f6c3cf';
  g.font = `76px ${HAND}`;
  g.fillText(name, W / 2, H - 92);
  g.fillStyle = 'rgba(243, 223, 167, .85)';
  g.font = `24px ${MONO}`;
  g.fillText(date, W / 2, H - 52 - 8);
  return cv;
}

/* ------------------------------------------------------------------ 20 · Our little film */

const pickType = () => {
  for (const t of ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'])
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  return '';
};

type Slide = { img: HTMLImageElement | null; title: string; sub: string };

/**
 * The memory film: your photos one after another (slow push‑ins, soft crossfades), each with its
 * caption, date and place; a title at the start and your words and signature at the end. Scored
 * with your song if you've added one (and have the right to use it), or the garden's own music
 * box. Recorded on her phone and saved there as a video. Without photos yet, each memory is a
 * title card, so the film already plays.
 */
export function MemoryReel() {
  const c = useContent();
  const ref = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<'idle' | 'loading' | 'playing' | 'done'>('idle');
  const [p, setP] = useState(0);
  const cancel = useRef(false);
  useEffect(
    () => () => {
      cancel.current = true;
    },
    [],
  );
  const run = async (record: boolean) => {
    setMode('loading');
    cancel.current = false;
    const slides: Slide[] = [];
    for (const m of c.memories) {
      let img: HTMLImageElement | null = null;
      if (m.media && m.media.type === 'image')
        try {
          img = await loadImg(await mediaUrl(m.media, 1600));
        } catch {
          img = null;
        }
      slides.push({ img, title: m.caption, sub: [filled(m.date), filled(m.place)].filter(Boolean).join(' · ') });
    }
    const cv = ref.current!;
    const W = (cv.width = 1080), H = (cv.height = 1920);
    const g = cv.getContext('2d')!;
    // sound: her song (if added) or the garden's music box
    let audio: MediaStream | null = null;
    let song: HTMLAudioElement | null = null;
    let ctx: AudioContext | null = null;
    if (c.reel.music) {
      try {
        song = new Audio(await mediaUrl(c.reel.music));
        ctx = new AudioContext();
        const src = ctx.createMediaElementSource(song);
        const dest = ctx.createMediaStreamDestination();
        src.connect(dest);
        src.connect(ctx.destination);
        audio = dest.stream;
        song.play().catch(() => {});
      } catch {
        song = null;
      }
    }
    if (!song) {
      if (!store.get().audioOn) events.emit('toggleAudio', undefined);
      events.emit('audioStream', (s) => (audio = s));
    }
    let rec: MediaRecorder | null = null;
    const chunks: Blob[] = [];
    const type = pickType();
    if (record && canRecord()) {
      const tracks = [...cv.captureStream(30).getVideoTracks(), ...((audio as MediaStream | null)?.getAudioTracks() ?? [])];
      rec = new MediaRecorder(new MediaStream(tracks), type ? { mimeType: type, videoBitsPerSecond: 9_000_000 } : undefined);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.start(500);
    }
    setMode('playing');
    const TITLE = 3.2, EACH = 3.6, END = 4.6, X = 0.7;
    const total = TITLE + slides.length * EACH + END;
    const t0 = performance.now();
    await new Promise<void>((done) => {
      const frame = (n: number) => {
        if (cancel.current) return done();
        const t = (n - t0) / 1000;
        setP(Math.min(1, t / total));
        drawReel(g, W, H, t, slides, c, { TITLE, EACH, END, X });
        if (t < total) requestAnimationFrame(frame);
        else done();
      };
      requestAnimationFrame(frame);
    });
    song?.pause();
    ctx?.close().catch(() => {});
    if (rec) {
      await new Promise<void>((r) => {
        rec!.onstop = () => r();
        rec!.stop();
      });
      if (!cancel.current) saveBlob(new Blob(chunks, { type: type || 'video/webm' }), `our-little-film.${type.includes('mp4') ? 'mp4' : 'webm'}`);
    }
    if (!cancel.current) {
      buzz('bloom');
      setMode('done');
    }
  };
  return (
    <div className="reel">
      <canvas ref={ref} className="reel__screen" width={1080} height={1920} aria-label="Your memory film" />
      {mode === 'playing' || mode === 'loading' ? (
        <div className="reel__bar" aria-hidden="true">
          <span style={{ transform: `scaleX(${p})` }} />
        </div>
      ) : (
        <div className="reel__actions">
          <p className="sheet__intro">
            {mode === 'done' ? (canRecord() ? 'Saved to your phone. Play it again any time.' : 'That was your film.') : `${c.memories.length} memories, ${c.reel.music ? 'your song' : 'the garden’s music box'}, about ${Math.round(3.2 + c.memories.length * 3.6 + 4.6)} seconds.`}
          </p>
          <div className="sheet__row">
            {canRecord() && (
              <button type="button" className="sheet__btn" onClick={() => run(true)}>
                Make the film and save it
              </button>
            )}
            <button type="button" className={`sheet__btn ${canRecord() ? 'sheet__btn--ghost' : ''}`} onClick={() => run(false)}>
              Just watch it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

function drawReel(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  slides: Slide[],
  c: ReturnType<typeof useContent>,
  T: { TITLE: number; EACH: number; END: number; X: number },
) {
  const ease = (x: number) => x * x * (3 - 2 * x);
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#070914');
  bg.addColorStop(0.6, '#141026');
  bg.addColorStop(1, '#2a1622');
  g.globalAlpha = 1;
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  const card = (i: number, a: number, local: number) => {
    if (a <= 0) return;
    g.globalAlpha = a;
    const s = slides[i];
    if (s.img) {
      // a slow push‑in, alternating direction
      const z = 1.12 - 0.1 * (local / T.EACH), k = Math.max(W / s.img.width, H / s.img.height) * z;
      const dx = (i % 2 ? -1 : 1) * 30 * (local / T.EACH);
      g.drawImage(s.img, (W - s.img.width * k) / 2 + dx, (H - s.img.height * k) / 2, s.img.width * k, s.img.height * k);
      const fade = g.createLinearGradient(0, H * 0.55, 0, H);
      fade.addColorStop(0, 'rgba(7, 9, 20, 0)');
      fade.addColorStop(1, 'rgba(7, 9, 20, .85)');
      g.fillStyle = fade;
      g.fillRect(0, H * 0.55, W, H * 0.45);
    } else {
      // no photo yet: a tulip and the caption, like a title card
      g.strokeStyle = 'rgba(232, 166, 181, .7)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(W / 2, H * 0.36, 120 + Math.sin(local) * 4, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = 'rgba(243, 223, 167, .9)';
      g.font = `120px ${SERIF}`;
      g.fillText('❦', W / 2, H * 0.36 + 40);
    }
    g.fillStyle = '#f8f1e8';
    g.font = `italic 500 64px ${SERIF}`;
    wrapLines(g, s.title, W - 200).forEach((l, k) => g.fillText(l, W / 2, H * (s.img ? 0.8 : 0.58) + k * 78));
    if (s.sub) {
      g.fillStyle = 'rgba(243, 223, 167, .85)';
      g.font = `30px ${MONO}`;
      g.fillText(s.sub.toUpperCase(), W / 2, H * (s.img ? 0.8 : 0.58) - 90);
    }
  };
  if (t < T.TITLE + T.X) {
    const a = Math.min(1, t / 0.8) * (1 - ease(Math.min(1, Math.max(0, (t - T.TITLE) / T.X))));
    g.globalAlpha = a;
    g.fillStyle = '#e6c989';
    g.font = `30px ${MONO}`;
    g.fillText(c.date, W / 2, H * 0.42);
    g.fillStyle = '#f2c1cb';
    g.font = `italic 500 110px ${SERIF}`;
    g.fillText(c.reel.title, W / 2, H * 0.5);
    g.fillStyle = 'rgba(248, 241, 232, .8)';
    g.font = `500 48px ${SERIF}`;
    g.fillText(`for ${c.name}`, W / 2, H * 0.56);
  }
  const st = t - T.TITLE;
  slides.forEach((_, i) => {
    const local = st - i * T.EACH;
    if (local < -T.X || local > T.EACH + T.X) return;
    const a = ease(Math.min(1, Math.max(0, (local + T.X) / T.X))) * (1 - ease(Math.min(1, Math.max(0, (local - T.EACH) / T.X))));
    card(i, a, Math.max(0, local));
  });
  const et = st - slides.length * T.EACH;
  if (et > -T.X) {
    const a = ease(Math.min(1, Math.max(0, (et + T.X) / T.X)));
    g.globalAlpha = a;
    g.fillStyle = '#f8f1e8';
    g.font = `italic 500 62px ${SERIF}`;
    wrapLines(g, c.reel.line, W - 200).forEach((l, k) => g.fillText(l, W / 2, H * 0.44 + k * 76));
    g.fillStyle = '#f2c1cb';
    g.font = `80px ${HAND}`;
    g.fillText(c.signature, W / 2, H * 0.62);
    g.fillStyle = '#e6c989';
    g.font = `28px ${MONO}`;
    g.fillText(`HAPPY BIRTHDAY · ${c.date}`, W / 2, H * 0.7);
  }
  g.globalAlpha = 1;
}

function wrapLines(g: CanvasRenderingContext2D, text: string, width: number) {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > width && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  if (line) out.push(line);
  return out.slice(0, 4);
}

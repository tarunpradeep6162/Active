import { events, state } from '../core/state';

/**
 * Her film to keep: while the short trailer plays, each frame of the world is drawn into a
 * recording canvas with the film's titles (and the stars she drew), and recorded together
 * with the sound. At the end it is saved to her device as a video. Nothing is uploaded.
 */
export const canRecord = () =>
  typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function' && !matchMedia('(max-width: 380px)').matches;

function pickType() {
  for (const t of ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'])
    if (MediaRecorder.isTypeSupported(t)) return t;
  return '';
}

export interface Titles {
  name: string;
  date: string;
  signature: string;
  stars: [number, number][][];
}

export class FilmRecorder {
  private cv = document.createElement('canvas');
  private g = this.cv.getContext('2d')!;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private raf = 0;
  private t0 = 0;
  private type = pickType();

  private endAt = Infinity;
  /** the last shot has begun: bring up the end card */
  ending() {
    this.endAt = Math.min(this.endAt, performance.now());
  }

  constructor(private titles: Titles) {
    // 1280 wide, the screen's shape (never taller than 16:9 portrait allows)
    const src = document.getElementById('experience') as HTMLCanvasElement;
    const a = src.width / Math.max(1, src.height);
    this.cv.width = 1280;
    this.cv.height = Math.round(1280 / a / 2) * 2;
  }

  start() {
    const src = document.getElementById('experience') as HTMLCanvasElement;
    const video = this.cv.captureStream(30);
    let audio: MediaStream | null = null;
    events.emit('audioStream', (s) => (audio = s));
    const tracks = [...video.getVideoTracks(), ...((audio as MediaStream | null)?.getAudioTracks() ?? [])];
    this.rec = new MediaRecorder(new MediaStream(tracks), this.type ? { mimeType: this.type, videoBitsPerSecond: 8_000_000 } : undefined);
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(500);
    this.t0 = performance.now();
    const W = this.cv.width, H = this.cv.height, g = this.g;
    const draw = (now: number) => {
      const t = (now - this.t0) / 1000;
      g.drawImage(src, 0, 0, W, H);
      g.textAlign = 'center';
      // opening title
      const o1 = Math.min(1, t / 0.8) * (1 - Math.min(1, Math.max(0, (t - 3) / 0.8)));
      if (o1 > 0) this.title(`A film for ${this.titles.name}`, W / 2, H * 0.72, H * 0.06, o1);
      // her stars over the sunrise
      if (state.section === 'outro' && state.finaleLocal > 0.6) {
        g.strokeStyle = 'rgba(243, 223, 167, .35)';
        g.fillStyle = 'rgba(255, 240, 210, .95)';
        for (const s of this.titles.stars) {
          g.beginPath();
          s.forEach(([x, y], i) => (i ? g.lineTo(x * W, y * H) : g.moveTo(x * W, y * H)));
          g.stroke();
          s.forEach(([x, y]) => (g.beginPath(), g.arc(x * W, y * H, 2.4, 0, Math.PI * 2), g.fill()));
        }
      }
      // the end card
      const o2 = Math.min(1, Math.max(0, (now - this.endAt) / 1000 - 1.5));
      if (o2 > 0) {
        g.fillStyle = `rgba(4, 5, 11, ${o2 * 0.55})`;
        g.fillRect(0, 0, W, H);
        this.title(`Happy birthday, ${this.titles.name}`, W / 2, H * 0.47, H * 0.065, o2);
        this.title(this.titles.date, W / 2, H * 0.56, H * 0.03, o2, true);
        this.title(this.titles.signature, W / 2, H * 0.66, H * 0.045, o2, false, true);
      }
      // letterbox
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H * 0.075);
      g.fillRect(0, H * 0.925, W, H * 0.075);
      this.raf = requestAnimationFrame(draw);
    };
    this.raf = requestAnimationFrame(draw);
  }

  private title(text: string, x: number, y: number, size: number, o: number, mono = false, hand = false) {
    const g = this.g;
    g.font = hand ? `${size * 1.2}px 'Caveat', cursive` : mono ? `${size}px 'Share Tech Mono', monospace` : `400 ${size}px 'Cormorant Garamond', 'Cormorant', Georgia, serif`;
    g.fillStyle = hand ? `rgba(243, 223, 167, ${o})` : `rgba(248, 241, 232, ${o})`;
    g.shadowColor = 'rgba(0, 0, 0, .8)';
    g.shadowBlur = 16;
    g.fillText(text, x, y);
    g.shadowBlur = 0;
  }

  /** stop, and save the film to her device */
  stop(save = true): Promise<void> {
    cancelAnimationFrame(this.raf);
    return new Promise((resolve) => {
      if (!this.rec || this.rec.state === 'inactive') return resolve();
      this.rec.onstop = () => {
        if (save && this.chunks.length) {
          const type = this.rec!.mimeType || 'video/webm';
          const blob = new Blob(this.chunks, { type });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `our-film-${this.titles.name.toLowerCase()}.${type.includes('mp4') ? 'mp4' : 'webm'}`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        }
        resolve();
      };
      this.rec.stop();
    });
  }
}

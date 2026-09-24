import monoUrl from '@fontsource/share-tech-mono/files/share-tech-mono-latin-400-normal.woff2?url';
import serifUrl from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2?url';
import serifItalicUrl from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2?url';
import serifBoldUrl from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2?url';
import handUrl from '@fontsource/caveat/files/caveat-latin-400-normal.woff2?url';
import type { ParticleRequest, ParticleResult } from '../workers/particles.worker';
import ParticleWorker from '../workers/particles.worker?worker';
import { store } from './state';

type Task<T> = { weight: number; run: (report: (fraction: number) => void) => Promise<T> };

/**
 * Tracks genuinely pending work (network font files, worker particle generation,
 * texture rasterisation, GPU shader compilation) and reports weighted progress.
 */
export class AssetManager {
  private done = 0;
  private total = 0;
  private partial = new Map<number, number>();
  private displayed = 0;

  private report() {
    let p = this.done;
    this.partial.forEach((v) => (p += v));
    const next = this.total ? Math.min(1, p / this.total) : 0;
    this.displayed = Math.max(this.displayed, next);
    store.set({ loadProgress: this.displayed });
  }

  async run<T>(task: Task<T>): Promise<T> {
    const id = Math.random();
    this.total += task.weight;
    this.partial.set(id, 0);
    this.report();
    const result = await task.run((f) => {
      this.partial.set(id, Math.min(1, f) * task.weight);
      this.report();
    });
    this.partial.delete(id);
    this.done += task.weight;
    this.report();
    return result;
  }

  /** Reserve weight up front so progress never runs backwards when later tasks start. */
  reserve(weight: number) {
    this.total += weight;
    this.report();
    return () => {
      this.total -= weight;
    };
  }

  static async fetchWithProgress(url: string, onProgress: (f: number) => void) {
    const res = await fetch(url);
    const len = Number(res.headers.get('content-length')) || 0;
    if (!res.body || !len) {
      const buf = await res.arrayBuffer();
      onProgress(1);
      return buf;
    }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      onProgress(got / len);
    }
    const out = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out.buffer;
  }

  loadFonts() {
    return this.run({
      weight: 2,
      run: async (report) => {
        const fonts: [string, string, FontFaceDescriptors][] = [
          ['Share Tech Mono', monoUrl, { weight: '400', style: 'normal', display: 'block' }],
          // emotion (serif), a personal touch (handwriting) — the mono above stays for the interface
          ['Cormorant Garamond', serifUrl, { weight: '500', style: 'normal', display: 'block' }],
          ['Cormorant Garamond', serifItalicUrl, { weight: '500', style: 'italic', display: 'block' }],
          ['Cormorant Garamond', serifBoldUrl, { weight: '600', style: 'normal', display: 'block' }],
          ['Caveat', handUrl, { weight: '400', style: 'normal', display: 'block' }],
        ];
        const progress = fonts.map(() => 0);
        await Promise.all(
          fonts.map(async ([family, url, desc], i) => {
            const buf = await AssetManager.fetchWithProgress(url, (f) => {
              progress[i] = f;
              report(progress.reduce((a, b) => a + b, 0) / fonts.length);
            });
            const face = new FontFace(family, buf, desc);
            await face.load();
            document.fonts.add(face);
          }),
        );
      },
    });
  }

  generateParticles(requests: ParticleRequest[]) {
    return this.run<ParticleResult[]>({
      weight: 2,
      run: (report) =>
        new Promise((resolve, reject) => {
          const w = new ParticleWorker();
          w.onmessage = (e: MessageEvent<ParticleResult[]>) => {
            report(1);
            resolve(e.data);
            w.terminate();
          };
          w.onerror = (e) => reject(e);
          w.postMessage(requests);
        }),
    });
  }
}

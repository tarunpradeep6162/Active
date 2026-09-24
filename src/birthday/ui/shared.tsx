import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { MediaRef } from '../types';
import { getContent, getVaultState, mediaUrl, subscribeVault } from '../vault';
import { findHeart, getProgress, subscribeProgress } from '../progress';

export const useContent = () => useSyncExternalStore(subscribeVault, getContent);
export const useVaultState = () => useSyncExternalStore(subscribeVault, getVaultState);
export const useProgress = () => useSyncExternalStore(subscribeProgress, getProgress);

/** True when the user asked the OS for less motion. */
export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A photo / video / audio slot; missing media shows a labelled placeholder frame. */
export function Media({ media, label, className = '', autoPlay = false, onEnded }: { media?: MediaRef; label: string; className?: string; autoPlay?: boolean; onEnded?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    if (media) mediaUrl(media).then((u) => live && setUrl(u)).catch(() => live && setUrl(null));
    return () => {
      live = false;
    };
  }, [media?.src]);
  if (!media) {
    return (
      <div className={`bd-media bd-media--empty ${className}`} role="img" aria-label={`Placeholder: ${label}`}>
        <span>{label}</span>
      </div>
    );
  }
  if (!url) return <div className={`bd-media bd-media--loading ${className}`} aria-busy="true" />;
  if (media.type === 'video') return <video className={`bd-media ${className}`} src={url} autoPlay={autoPlay} muted={autoPlay} playsInline controls={!autoPlay} onEnded={onEnded} aria-label={media.alt ?? label} />;
  if (media.type === 'audio') return <audio className={`bd-audio ${className}`} src={url} controls autoPlay={autoPlay} onEnded={onEnded} />;
  return <img className={`bd-media ${className}`} src={url} alt={media.alt ?? label} draggable={false} />;
}

/**
 * One hidden heart per chapter. It sits somewhere small and quiet; finding all fourteen
 * unlocks the secret ending in the last chapter.
 */
export function HiddenHeart({ slug, style }: { slug: string; style: React.CSSProperties }) {
  const found = useProgress().hearts.includes(slug);
  return (
    <button type="button" className={`bd-heart ${found ? 'is-found' : ''}`} style={style} aria-label={found ? 'Hidden heart (found)' : 'A tiny hidden heart'} onClick={() => findHeart(slug)}>
      ♥
    </button>
  );
}

/** Reveals text one character at a time (instantly with reduced motion). */
export function useTypewriter(text: string, run: boolean, cps = 38) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) return setN(0);
    if (reducedMotion()) return setN(text.length);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) window.clearInterval(id);
    }, 1000 / cps);
    return () => window.clearInterval(id);
  }, [text, run, cps]);
  return text.slice(0, n);
}

/**
 * Particles that scatter and re‑form into a line of text (wish, finale). Canvas 2D so it
 * works everywhere; sized to its box and to the device pixel ratio.
 */
export function ParticleText({ text, phase, className = '', color = '#fff1c9' }: { text: string; phase: 'hidden' | 'scatter' | 'form'; className?: string; color?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (cv.width = Math.max(1, Math.round(cv.clientWidth * dpr))), H = (cv.height = Math.max(1, Math.round(cv.clientHeight * dpr)));
    // sample the text into target points
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    const o = off.getContext('2d')!;
    let size = Math.min(H * 0.5, (W * 1.6) / Math.max(4, text.length));
    o.font = `600 ${size}px 'Cormorant Garamond', Georgia, serif`;
    while (o.measureText(text).width > W * 0.92 && size > 8) {
      size *= 0.92;
      o.font = `600 ${size}px 'Cormorant Garamond', Georgia, serif`;
    }
    o.fillStyle = '#fff';
    o.textAlign = 'center';
    o.textBaseline = 'middle';
    o.fillText(text, W / 2, H / 2);
    const img = o.getImageData(0, 0, W, H).data;
    const pts: [number, number][] = [];
    const step = Math.max(2, Math.round(3 * dpr));
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) if (img[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
    const P = pts.map(([tx, ty]) => ({ tx, ty, x: W / 2 + (Math.random() - 0.5) * W * 0.2, y: H / 2 + (Math.random() - 0.5) * H * 0.2, vx: (Math.random() - 0.5) * 18 * dpr, vy: (Math.random() - 0.5) * 18 * dpr }));
    let raf = 0;
    const tick = () => {
      g.clearRect(0, 0, W, H);
      const ph = phaseRef.current;
      if (ph !== 'hidden') {
        g.fillStyle = color;
        for (const p of P) {
          if (ph === 'form') {
            p.vx += (p.tx - p.x) * 0.02;
            p.vy += (p.ty - p.y) * 0.02;
            p.vx *= 0.82;
            p.vy *= 0.82;
          } else {
            p.vy += 0.02 * dpr;
            p.vx *= 0.995;
          }
          p.x += p.vx;
          p.y += p.vy;
          g.globalAlpha = 0.85;
          g.fillRect(p.x, p.y, 1.6 * dpr, 1.6 * dpr);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [text, color]);
  return <canvas ref={ref} className={`bd-particles ${className}`} aria-label={phase === 'form' ? text : undefined} role="img" />;
}

import { useEffect, useRef, useState } from 'react';

/**
 * Mounts a chapter's cinematic stage (lazy‑loaded) on a full‑screen canvas behind the chapter.
 * Returns the canvas ref, the live stage (null until loaded, or without WebGL) and `live`.
 */
export function useStage<T extends { dispose(): void }>(load: () => Promise<(canvas: HTMLCanvasElement) => T>, deps: unknown[] = []) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stage = useRef<T | null>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    let alive = true;
    load()
      .then((make) => {
        if (!alive || !ref.current) return;
        stage.current = make(ref.current);
        setLive(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
      stage.current?.dispose();
      stage.current = null;
      setLive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ref, stage, live };
}

/** The full‑screen canvas behind a chapter (above the chapter's veil, below its content). */
export function Backdrop({ canvas, interactive = false, className = '' }: { canvas: React.RefObject<HTMLCanvasElement | null>; interactive?: boolean; className?: string }) {
  return (
    <div className={`bd-cosmos ${className}`} aria-hidden="true">
      <canvas ref={canvas} className={`bd-cosmos__canvas ${interactive ? 'bd-cosmos__canvas--interactive' : ''}`} />
    </div>
  );
}

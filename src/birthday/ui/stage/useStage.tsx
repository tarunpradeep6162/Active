import { useEffect, useRef, useState } from 'react';

/**
 * Mounts a chapter's cinematic stage (lazy‑loaded) on a full‑screen canvas behind the chapter.
 * Returns the canvas ref, the live stage (null until loaded, or without WebGL), `live`, and `attr`
 * for the chapter's `data-live`: 'false' while the stage loads (the chapter waits, unseen, instead
 * of flashing its flat version first), 'true' once live, 'off' when 3D is not possible here.
 */
export const liveAttr = (live: boolean, failed: boolean) => (live ? 'true' : failed ? 'off' : 'false');

export function useStage<T extends { dispose(): void }>(load: () => Promise<(canvas: HTMLCanvasElement) => T>, deps: unknown[] = []) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stage = useRef<T | null>(null);
  const [live, setLive] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    load()
      .then((make) => {
        if (!alive || !ref.current) return;
        stage.current = make(ref.current);
        setLive(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      stage.current?.dispose();
      stage.current = null;
      setLive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { ref, stage, live, attr: liveAttr(live, failed) };
}

/** The full‑screen canvas behind a chapter (above the chapter's veil, below its content). */
export function Backdrop({ canvas, interactive = false, className = '' }: { canvas: React.RefObject<HTMLCanvasElement | null>; interactive?: boolean; className?: string }) {
  return (
    <div className={`bd-cosmos ${className}`} aria-hidden="true">
      <canvas ref={canvas} className={`bd-cosmos__canvas ${interactive ? 'bd-cosmos__canvas--interactive' : ''}`} />
    </div>
  );
}

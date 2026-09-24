import { useEffect, useRef } from 'react';
import { MOODS } from './stage/moods';

let current: { pulse(): void } | null = null;

/** A soft wave of light through the open chapter's sky (a right answer, a solved clue…). */
export function pulseSky() {
  current?.pulse();
}

/** The chapter's cinematic sky behind its content (only for chapters with a mood). */
export function MoodSky({ slug }: { slug: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mood = MOODS[slug];
  useEffect(() => {
    if (!mood) return;
    let alive = true;
    let scene: { pulse(): void; dispose(): void } | null = null;
    import('./stage/MoodScene')
      .then(({ MoodScene }) => {
        if (!alive || !ref.current) return;
        scene = new MoodScene(ref.current, mood);
        current = scene;
      })
      .catch(() => {});
    return () => {
      alive = false;
      if (current === scene) current = null;
      scene?.dispose();
    };
  }, [slug]);
  if (!mood) return null;
  return (
    <div className="bd-cosmos bd-moodsky" aria-hidden="true">
      <canvas ref={ref} className="bd-cosmos__canvas" />
    </div>
  );
}

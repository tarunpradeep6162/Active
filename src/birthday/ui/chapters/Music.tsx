import { useEffect, useRef, useState } from 'react';
import { HiddenHeart, Media, filled, useContent } from '../shared';
import type { ChapterProps } from '../ChapterView';
import { Backdrop, useStage } from '../stage/useStage';

/**
 * 8 ── Our Music Room: a floating record player. Each song carries only its title, artist and
 * your own note about what it reminds you of — plus audio you have the right to use.
 */
export function MusicRoom({ slug, onDone }: ChapterProps) {
  const c = useContent();
  const [i, setI] = useState<number | null>(null);
  const [heard, setHeard] = useState(0);
  useEffect(() => {
    if (heard >= Math.min(2, c.songs.length)) onDone();
  }, [heard]);
  const s = i !== null ? c.songs[i] : null;
  const name = (k: number) => filled(c.songs[k].title) || `Song ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][k] ?? k + 1}`;
  // the record player in 3D stands where the page's record sits (measured every frame)
  const record = useRef<HTMLDivElement>(null);
  const scene = useStage(() => import('../stage/MusicScene').then(({ MusicScene }) => (cv: HTMLCanvasElement) => new MusicScene(cv)));
  useEffect(() => {
    if (!scene.live) return;
    let raf = 0;
    const tick = () => {
      const r = record.current?.getBoundingClientRect();
      if (r && r.height) scene.stage.current?.setAnchor((r.left + r.width / 2) / innerWidth, (r.top + r.height / 2) / innerHeight, r.height / innerHeight);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [scene.live]);
  useEffect(() => {
    if (i !== null) scene.stage.current?.play(name(i));
  }, [i, scene.live]);
  return (
    <div className="bd-music" data-live={scene.live}>
      <Backdrop canvas={scene.ref} />
      <div ref={record} className={`bd-record ${s ? 'is-playing' : ''}`} aria-hidden="true">
        <div className="bd-record__disc">
          <div className="bd-record__label">{s && filled(s.title) ? s.title : '♪'}</div>
        </div>
        <div className="bd-record__arm" />
      </div>
      <ol className="bd-songs">
        {c.songs.map((song, k) => (
          <li key={k}>
            <button type="button" aria-current={i === k} onClick={() => { setI(k); setHeard((h) => h + 1); }}>
              <span className="bd-songs__title">{name(k)}</span>
              <span className="bd-songs__artist">{filled(song.artist)}</span>
            </button>
          </li>
        ))}
      </ol>
      {s && (
        <div className="bd-songnote" aria-live="polite">
          <p>{s.note}</p>
          {s.audio ? <Media media={s.audio} label={s.title} autoPlay /> : <p className="bd-meta">Play this one together.</p>}
        </div>
      )}
      <HiddenHeart slug={slug} style={{ left: '3%', bottom: '3%' }} />
    </div>
  );
}

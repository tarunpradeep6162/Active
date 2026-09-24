import { useEffect, useState } from 'react';
import { HiddenHeart, Media, filled, useContent } from '../shared';
import type { ChapterProps } from '../ChapterView';

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
  return (
    <div className="bd-music">
      <div className={`bd-record ${s ? 'is-playing' : ''}`} aria-hidden="true">
        <div className="bd-record__disc">
          <div className="bd-record__label">{s && filled(s.title) ? s.title : '♪'}</div>
        </div>
        <div className="bd-record__arm" />
      </div>
      <ol className="bd-songs">
        {c.songs.map((song, k) => (
          <li key={k}>
            <button type="button" aria-current={i === k} onClick={() => { setI(k); setHeard((h) => h + 1); }}>
              <span className="bd-songs__title">{filled(song.title) || `Song ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][k] ?? k + 1}`}</span>
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

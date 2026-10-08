import { useEffect, useState } from 'react';
import { events } from '../../core/state';
import { useStore } from '../useStore';
import { useContent, useVaultState } from '../../birthday/ui/shared';
import { Gate } from '../../birthday/ui/ChapterView';
import { mediaUrl } from '../../birthday/vault';
import { buzz } from './haptics';

/**
 * In the garden, one tulip hums: a small glowing bud at the edge of the frame. Tap it and your
 * voice message plays (from the encrypted vault), while the garden's music steps back. Until a
 * recording is added it says so, quietly.
 */
export function VoiceTulip() {
  const c = useContent();
  const section = useStore((s) => s.section);
  const route = useStore((s) => s.route);
  const vault = useVaultState();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const here = section === 'work' && route.name === 'home';
  useEffect(() => {
    if (!open || !c.voiceTulip.media || vault === 'locked') return;
    let live = true;
    mediaUrl(c.voiceTulip.media)
      .then((u) => live && setUrl(u))
      .catch(() => live && setUrl(null));
    return () => {
      live = false;
    };
  }, [open, c.voiceTulip.media?.src, vault]);
  useEffect(() => {
    if (!here) setOpen(false);
  }, [here]);
  useEffect(() => () => events.emit('duck', false), []);
  if (!here) return null;
  return (
    <>
      <button
        type="button"
        className={`vtulip ${open ? 'is-open' : ''}`}
        onClick={() => {
          setOpen(!open);
          buzz('soft');
          events.emit('sfx', 'open');
        }}
        aria-expanded={open}
        aria-label="A humming tulip: tap to listen"
      >
        <svg viewBox="-20 -30 40 60" aria-hidden="true">
          <path d="M0 28 C-2 14 1 6 0 -2" />
          <path d="M-9 -4 C-10 -16 -5 -21 0 -24 C5 -21 10 -16 9 -4 C5 1 -5 1 -9 -4 Z" className="vtulip__bud" />
        </svg>
        <span className="vtulip__notes" aria-hidden="true">
          ♪
        </span>
      </button>
      {open && (
        <div className="vtulip__card" role="dialog" aria-label="A voice message">
          {vault === 'locked' && c.voiceTulip.media ? (
            <Gate />
          ) : (
            <>
              <p className="vtulip__line">{c.voiceTulip.line}</p>
              {c.voiceTulip.media ? (
                url ? (
                  <audio src={url} controls autoPlay onPlay={() => events.emit('duck', true)} onPause={() => events.emit('duck', false)} onEnded={() => events.emit('duck', false)} />
                ) : (
                  <p className="vtulip__note">Opening the tulip…</p>
                )
              ) : (
                <p className="vtulip__note">[Your voice message will play here]</p>
              )}
            </>
          )}
          <button type="button" className="bd-link" onClick={() => setOpen(false)}>
            Back to the garden
          </button>
        </div>
      )}
    </>
  );
}

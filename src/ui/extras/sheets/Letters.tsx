import { useEffect, useState } from 'react';
import { useContent, useTypewriter } from '../../../birthday/ui/shared';
import { local } from '../local';
import { buzz } from '../haptics';
import { events } from '../../../core/state';

/* ------------------------------------------------------------------ 12 · Open when… */

const OPENED = 'bday-openwhen-opened';
/** Sealed envelopes ("Open when you miss me" …): she breaks the wax and the letter writes itself. */
export function OpenWhen() {
  const c = useContent();
  const [opened, setOpened] = useState<number[]>(() => local.get(OPENED, []));
  const [open, setOpen] = useState<number | null>(null);
  const read = (i: number) => {
    setOpen(i);
    if (!opened.includes(i)) {
      const next = [...opened, i];
      setOpened(next);
      local.set(OPENED, next);
      buzz('click');
      events.emit('sfx', 'seal');
    }
  };
  return (
    <div className="ow">
      <p className="sheet__intro">Letters for later. Open each one only when the moment comes.</p>
      <div className="ow__grid">
        {c.openWhen.map((l, i) => (
          <button key={i} type="button" className={`ow__env ${opened.includes(i) ? 'is-opened' : ''}`} onClick={() => read(i)}>
            <span className="ow__flap" aria-hidden="true" />
            <span className="ow__seal" aria-hidden="true">
              ♥
            </span>
            <span className="ow__label">
              <i>Open when</i> {l.when}
            </span>
          </button>
        ))}
      </div>
      {open !== null && <Letter when={c.openWhen[open].when} text={c.openWhen[open].text} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Letter({ when, text, onClose }: { when: string; text: string; onClose: () => void }) {
  const shown = useTypewriter(text, true, 48);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="ow__letter" role="dialog" aria-label={`Open when ${when}`} onClick={onClose}>
      <div className="ow__paper" onClick={(e) => e.stopPropagation()}>
        <p className="ow__when">Open when {when}</p>
        <p className="ow__text" aria-label={text}>
          {shown}
          <span className="ow__caret" aria-hidden="true" />
        </p>
        <button type="button" className="sheet__btn" onClick={onClose}>
          Fold it back
        </button>
      </div>
    </div>
  );
}

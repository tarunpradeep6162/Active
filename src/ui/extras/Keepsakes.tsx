import { useEffect, useRef } from 'react';
import { OpenWhen, Numbers, TwoStars } from './sheets/Letters';
import { MapOfUs, PlantTulip, WishJar } from './sheets/Grow';
import { PhotoBooth, MemoryReel } from './sheets/Booth';

/**
 * The keepsakes she opens from "For you", each in its own sheet. This file (and the sheets)
 * load only when she first opens one, so none of it weighs on the garden.
 */
export type SheetKind = 'openWhen' | 'numbers' | 'twoStars' | 'map' | 'plant' | 'jar' | 'booth' | 'reel';

const SHEETS: Record<SheetKind, { title: string; kicker: string; Body: () => React.ReactElement }> = {
  openWhen: { title: 'Open when…', kicker: 'letters for later', Body: OpenWhen },
  numbers: { title: 'Our year in numbers', kicker: 'counted with love', Body: Numbers },
  twoStars: { title: 'Two stars', kicker: 'join them', Body: TwoStars },
  map: { title: 'Map of us', kicker: 'where we’ve been', Body: MapOfUs },
  plant: { title: 'Your tulip', kicker: 'plant it, watch it grow', Body: PlantTulip },
  jar: { title: 'The wish jar', kicker: 'paper stars', Body: WishJar },
  booth: { title: 'Photo booth', kicker: 'a birthday picture', Body: PhotoBooth },
  reel: { title: 'Our little film', kicker: 'your memories, as a film', Body: MemoryReel },
};

export default function KeepsakeSheet({ kind, onClose }: { kind: SheetKind; onClose: () => void }) {
  const s = SHEETS[kind];
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={s.title} ref={ref} tabIndex={-1}>
      <div className="sheet__panel">
        <p className="sheet__kicker">{s.kicker}</p>
        <h3 className="sheet__title">{s.title}</h3>
        <s.Body />
        <button type="button" className="sheet__close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
    </div>
  );
}

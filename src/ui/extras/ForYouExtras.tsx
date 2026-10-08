import { lazy, Suspense, useState } from 'react';
import { createPortal } from 'react-dom';
import { useContent } from '../../birthday/ui/shared';
import { saveBirthdayCard } from '../../birthday/keepsakes';
import { useInstall, promptInstall } from './pwa';
import { canBuzz, hapticsOn, setHaptics } from './haptics';
import type { SheetKind } from './Keepsakes';

const KeepsakeSheet = lazy(() => import('./Keepsakes'));

const CARDS: { kind: SheetKind; icon: string; title: string; note: string; cta: string }[] = [
  { kind: 'openWhen', icon: '✉', title: 'Letters for later', note: 'Sealed envelopes: open when you miss me, when you can’t sleep, on a bad day…', cta: 'Open the letters' },
  { kind: 'reel', icon: '▶', title: 'Our little film', note: 'Your memories, one after another, with music: a film to keep on your phone.', cta: 'Play the film' },
  { kind: 'numbers', icon: '✶', title: 'Our year in numbers', note: 'Everything counted, and saved as a card if you like.', cta: 'Count them' },
  { kind: 'twoStars', icon: '✦', title: 'Two stars', note: 'Your initial and mine, as constellations. Join the stars with your finger.', cta: 'Draw the stars' },
  { kind: 'map', icon: '⌖', title: 'Map of us', note: 'The places we’ve been, glowing on a night map.', cta: 'Open the map' },
  { kind: 'plant', icon: '❀', title: 'Your tulip', note: 'Plant a tulip of your own. It grows a little every day you come back.', cta: 'Visit your tulip' },
  { kind: 'jar', icon: '✧', title: 'The wish jar', note: 'Write a wish; it folds into a paper star and fills the jar.', cta: 'Open the jar' },
  { kind: 'booth', icon: '◉', title: 'Photo booth', note: 'A birthday selfie in a golden frame. It stays on your phone.', cta: 'Take a photo' },
];

/** The new keepsake cards in "For you", and the sheet each one opens. */
export function ForYouExtras() {
  const c = useContent();
  const [open, setOpen] = useState<SheetKind | null>(null);
  const cam = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  return (
    <>
      {CARDS.filter((k) => k.kind !== 'booth' || cam).map((k) => (
        <article key={k.kind} className="foryou__card foryou__card--new" data-icon={k.icon}>
          <h3>{k.title}</h3>
          <p className="foryou__note">{k.note}</p>
          <button type="button" onClick={() => setOpen(k.kind)}>
            {k.cta}
          </button>
        </article>
      ))}
      <article className="foryou__card foryou__card--new" data-icon="❦">
        <h3>A birthday card</h3>
        <p className="foryou__note">A card to print: a night‑sky cover outside, my words and signature inside. Print both sides on A4, fold in half.</p>
        <button type="button" onClick={() => saveBirthdayCard(c)}>
          Save the card (PDF)
        </button>
      </article>
      <HomeScreen />
      {open &&
        createPortal(
          <Suspense fallback={<div className="sheet sheet--loading" aria-busy="true" />}>
            <KeepsakeSheet kind={open} onClose={() => setOpen(null)} />
          </Suspense>,
          document.body,
        )}
    </>
  );
}

/** "On your home screen": install the garden as an app; and the gentle vibrations switch. */
function HomeScreen() {
  const inst = useInstall();
  const [buzzOn, setBuzzOn] = useState(hapticsOn);
  return (
    <article className="foryou__card foryou__card--new" data-icon="⌂">
      <h3>On your home screen</h3>
      {inst.installed ? (
        <p className="foryou__note">It’s on your home screen. It opens full‑screen, starts in a second, and plays even without internet.</p>
      ) : inst.canPrompt ? (
        <>
          <p className="foryou__note">Keep the garden as an app: its own icon, full‑screen, and it plays even without internet.</p>
          <button type="button" onClick={() => promptInstall()}>
            Add to home screen
          </button>
        </>
      ) : (
        <p className="foryou__note">
          {inst.ios ? 'Tap the Share button, then “Add to Home Screen”.' : 'Open your browser’s menu (⋮) and choose “Add to Home screen” or “Install app”.'} It gets its own icon, opens full‑screen, and plays even without internet.
        </p>
      )}
      {canBuzz() && (
        <label className="foryou__toggle">
          <input
            type="checkbox"
            checked={buzzOn}
            onChange={(e) => {
              setHaptics(e.target.checked);
              setBuzzOn(e.target.checked);
            }}
          />
          <span>Gentle vibrations</span>
        </label>
      )}
    </article>
  );
}

import { useEffect } from 'react';
import { initVault } from '../vault';
import { Gate } from './ChapterView';
import { Media, filled, useContent, useVaultState } from './shared';

/**
 * The story without 3D (no WebGL 2, or the world failed to start): the same words and
 * photos as a quiet page, behind the same passcode when a vault is deployed.
 */
export function FallbackStory() {
  const c = useContent();
  const vault = useVaultState();
  useEffect(() => {
    initVault();
  }, []);
  return (
    <main className="story">
      <p className="story__date">{c.date}</p>
      {c.opening.lines.map((l, i) => (
        <p key={i} className="story__line">
          {l}
        </p>
      ))}
      <h1 className="story__name">{c.name}</h1>
      {vault === 'locked' ? (
        <div className="story__gate">
          <Gate />
        </div>
      ) : (
        <>
          <section className="story__memories" aria-label="Memories">
            {c.memories.map((m, i) => (
              <figure key={i}>
                <Media media={m.media} label={`Photo ${i + 1}`} />
                <figcaption>
                  {m.caption}
                  {filled(m.date) || filled(m.place) ? <span>{[filled(m.date), filled(m.place)].filter(Boolean).join(' · ')}</span> : null}
                </figcaption>
              </figure>
            ))}
          </section>
          <section className="story__letter" aria-label="A letter">
            <p>{c.letter.greeting}</p>
            {c.letter.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <p>{c.letter.signoff}</p>
            <p className="story__signature">{c.signature}</p>
          </section>
          <section className="story__end">
            <p className="story__happy">{c.finale.headline}</p>
            {c.finalWords.map((w, i) => (
              <p key={i}>{w}</p>
            ))}
            <p className="story__last">{c.finale.lastThing}</p>
          </section>
        </>
      )}
    </main>
  );
}

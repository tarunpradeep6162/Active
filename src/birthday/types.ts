/**
 * Birthday content model. Everything personal lives in ONE object of this shape:
 *  - `placeholder.ts` ships clearly marked placeholders (safe to publish),
 *  - the real content is written to `birthday-private/content.json` (git‑ignored) and
 *    encrypted with the passcode into `public/vault/` by `npm run vault`.
 * Media are referenced by `MediaRef`; in the vault their bytes are encrypted too.
 */
export interface MediaRef {
  /** vault id (`vault:<id>`) or a plain URL for non‑private media */
  src: string;
  type: 'image' | 'video' | 'audio';
  /** short description for screen readers */
  alt?: string;
}

export interface Memory {
  media?: MediaRef;
  caption: string;
  date?: string;
  place?: string;
  note?: string;
}

export interface QuizQuestion {
  q: string;
  options: string[];
  /** index of your answer, or null when any answer is lovely */
  answer: number | null;
  /** reaction when she picks your answer / something else — keep both kind */
  yes: string;
  no: string;
}

export interface SecretClue {
  clue: string;
  /** accepted answers, compared case‑ and space‑insensitively */
  answers: string[];
  /** the digit or symbol this clue unlocks */
  symbol: string;
}

export interface Song {
  title: string;
  artist: string;
  /** what the song reminds you of (your own words — never lyrics) */
  note: string;
  /** optional audio you have the right to use */
  audio?: MediaRef;
}

export interface TimelineStop {
  label: string;
  date?: string;
  text: string;
  media?: MediaRef;
}

export interface Gift {
  label: string;
  kind: 'message' | 'memory' | 'promise' | 'photo' | 'clue';
  text: string;
  media?: MediaRef;
}

export interface BirthdayContent {
  /** true while the content is the shipped placeholder set */
  placeholder: boolean;
  name: string;
  /** shown as the big date, e.g. "25 · 11" */
  date: string;
  beginning: { line: string };
  memories: Memory[];
  polaroidPrompt: string;
  puzzle: { media?: MediaRef; caption: string };
  letter: { greeting: string; paragraphs: string[]; signoff: string };
  /** exactly 14 */
  reasons: string[];
  /** one memory per letter of her name (D H E E P I K A) */
  nameLetters: string[];
  game: { finish: string };
  quiz: QuizQuestion[];
  thisOrThat: [string, string][];
  secret: { intro: string; clues: SecretClue[]; reveal: { text: string; media?: MediaRef } };
  songs: Song[];
  timeline: TimelineStop[];
  emptyFrame: string;
  gifts: [Gift, Gift, Gift];
  wish: { line: string };
  future: { title: string; text: string }[];
  wishes: string[];
  movie: { clips: MediaRef[]; line: string };
  finale: {
    voice?: MediaRef;
    headline: string;
    lastThing: string;
    /** extra ending once every hidden heart has been found */
    secretEnding: string;
  };
}

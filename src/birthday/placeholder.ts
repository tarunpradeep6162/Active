import type { BirthdayContent } from './types';

/**
 * Shipped PLACEHOLDER content — nothing here is real or private. Every bracketed line is a
 * slot for your own words; lines without brackets are the copy you wrote in the brief.
 * Real content goes in `birthday-private/content.json` (same shape, git‑ignored) and is
 * encrypted into the site with `npm run vault` (see BIRTHDAY.md).
 */
const P = (s: string) => `[${s}]`;

export const PLACEHOLDER: BirthdayContent = {
  placeholder: true,
  name: 'Dheepika',
  date: '25 · 11',
  beginning: { line: 'The day my favourite person entered this world.' },
  memories: Array.from({ length: 8 }, (_, i) => ({
    caption: P(`Memory ${i + 1}: what you remember about this moment`),
    date: P('date'),
    place: P('place'),
  })),
  polaroidPrompt: 'Press the shutter.',
  puzzle: { caption: P('The caption that appears when the photo is whole again') },
  letter: {
    greeting: P('Dear Dheepika,'),
    paragraphs: [
      P('The first paragraph of the letter you never said out loud.'),
      P('The second paragraph.'),
      P('The third paragraph.'),
    ],
    signoff: P('Yours,'),
  },
  reasons: [
    'Your smile', 'Your laugh', 'Your kindness', 'Your angry face', 'Your craziness', 'Your voice', 'The way you support me',
    'Your little habits', 'Reason 9', 'Reason 10', 'Reason 11', 'Reason 12', 'Reason 13', 'Reason 14',
  ].map((r) => P(`${r} — write why, in your own words`)),
  nameLetters: ['D', 'H', 'E', 'E', 'P', 'I', 'K', 'A'].map((l) => P(`A memory for the letter ${l}`)),
  game: { finish: 'You already caught the important one — mine.' },
  quiz: [
    { q: 'What was our first ___?', options: [P('option A'), P('option B'), P('option C')], answer: 0, yes: 'You remember! 🥹', no: P('A gentle, funny hint') },
    { q: 'Which moment do I talk about the most?', options: [P('option A'), P('option B'), P('option C')], answer: 1, yes: 'Of course you know. 💛', no: P('A gentle, funny hint') },
    { q: 'What do you think I noticed first about you?', options: [P('option A'), P('option B'), P('option C')], answer: null, yes: P('Your real answer, told sweetly'), no: P('Your real answer, told sweetly') },
  ],
  thisOrThat: [
    ['Beach', 'Mountains'],
    ['Movie', 'Long drive'],
    ['Hugs', 'Kisses'],
    ['Morning', 'Night'],
    ['Planned trip', 'Random adventure'],
  ],
  secret: {
    intro: 'Answer each clue to reveal one symbol of the code.',
    clues: [
      { clue: P('Clue 1 about us'), answers: ['answer'], symbol: '2' },
      { clue: P('Clue 2 about us'), answers: ['answer'], symbol: '5' },
      { clue: P('Clue 3 about us'), answers: ['answer'], symbol: '♥' },
      { clue: P('Clue 4 about us'), answers: ['answer'], symbol: '1' },
      { clue: P('Clue 5 about us'), answers: ['answer'], symbol: '1' },
    ],
    reveal: { text: P('The hidden memory or message she unlocks') },
  },
  songs: Array.from({ length: 5 }, (_, i) => ({
    title: P(`Song ${i + 1}`),
    artist: P('artist'),
    note: P('What this song reminds you of (your words, not lyrics)'),
  })),
  timeline: [
    { label: 'Before Us', text: P('Who we were before') },
    { label: 'We Met', date: P('date'), text: P('How it happened') },
    { label: P('A memory'), date: P('date'), text: P('What happened') },
    { label: P('Another memory'), date: P('date'), text: P('What happened') },
    { label: 'Today', text: P('Where we are now') },
    { label: 'What Comes Next', text: P('What you hope for') },
  ],
  emptyFrame: 'Next memory goes here.',
  gifts: [
    { label: 'I', kind: 'message', text: P('A message') },
    { label: 'II', kind: 'promise', text: P('A promise') },
    { label: 'III', kind: 'clue', text: P('A clue to a real‑world gift') },
  ],
  wish: { line: 'I hope this one comes true.' },
  future: [
    { title: 'A place we should visit', text: P('where') },
    { title: 'Something we should try', text: P('what') },
    { title: "A photo we haven't taken yet", text: P('which one') },
    { title: 'A midnight adventure', text: P('the plan') },
    { title: 'One dream for us', text: P('the dream') },
  ],
  wishes: Array.from({ length: 24 }, (_, i) => P(`Wish ${i + 1} for your year`)),
  movie: { clips: [], line: 'Different days. Different places. Same person I keep choosing.' },
  finale: {
    headline: 'HAPPY BIRTHDAY, DHEEPIKA.',
    lastThing: P('Your most personal message — only ever stored encrypted'),
    secretEnding: P('A secret ending for finding every hidden heart'),
  },
};

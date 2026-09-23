/**
 * The Work helix carries the 14 birthday chapters (one per card, in order). The shape is the
 * old portfolio record so the cards, focus framing and search keep working unchanged:
 * `client` is the chapter label, `year` its number, `description` the teaser line.
 */
export type Category = 'story' | 'memories' | 'love' | 'play' | 'music';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'story', label: 'Our story' },
  { id: 'memories', label: 'Memories' },
  { id: 'love', label: 'Love notes' },
  { id: 'play', label: 'Play' },
  { id: 'music', label: 'Music' },
];

export interface Project {
  slug: string;
  title: string;
  kicker: string;
  client: string;
  year: number;
  category: Category;
  description: string;
  /** three palette stops for the procedural media, hex */
  palette: [string, string, string];
  /** media shader variant */
  style: number;
}

const ch = (n: number, slug: string, title: string, kicker: string, category: Category, description: string, palette: [string, string, string]): Project => ({
  slug,
  title,
  kicker,
  client: `Chapter ${String(n).padStart(2, '0')}`,
  year: n,
  category,
  description,
  palette,
  style: n - 1,
});

export const PROJECTS: Project[] = [
  ch(1, 'the-beginning', '25 · 11', 'THE BEGINNING', 'story', 'Start in the dark, with one star.', ['#07081a', '#6b6fd8', '#fff1c9']),
  ch(2, 'memory-universe', 'Memory Universe', 'OUR', 'memories', 'Our photos, floating where they belong.', ['#101a2c', '#7fb3e6', '#ffe0ef']),
  ch(3, 'the-letter', 'The Letter', 'UNSAID', 'love', 'Something I never said out loud.', ['#2a0f18', '#d9738c', '#ffe6d0']),
  ch(4, 'fourteen-things', '14 Things', 'I LOVE ABOUT YOU', 'love', 'Fourteen stars, fourteen reasons.', ['#1a0d24', '#b06ad8', '#ffd8f2']),
  ch(5, 'catch-my-heart', 'Catch My Heart', 'PLAY', 'play', 'A little game. Catch what falls.', ['#1d0a12', '#ff5a7a', '#ffd89a']),
  ch(6, 'know-us', 'Know Us?', 'QUIZ', 'play', 'How well do you know us?', ['#0f1d24', '#58c2b5', '#fff1c9']),
  ch(7, 'our-secret', 'Our Secret', 'UNLOCK', 'memories', 'Five clues. One hidden memory.', ['#0c0c14', '#c9a25a', '#fff0c8']),
  ch(8, 'music-room', 'Music Room', 'OUR SONGS', 'music', 'Songs that mean us.', ['#140c20', '#8a6ff0', '#ffd2f4']),
  ch(9, 'our-timeline', 'Our Timeline', 'BEFORE → NEXT', 'story', 'From before us to what comes next.', ['#161410', '#d6b27a', '#fff6e0']),
  ch(10, 'gift-boxes', 'Choose a Gift', 'THREE BOXES', 'memories', 'Pick one. Choose carefully.', ['#1f0c10', '#e0567a', '#ffe0a0']),
  ch(11, 'make-a-wish', 'Make a Wish', 'ONE CANDLE', 'love', 'Close your eyes first.', ['#140d06', '#ffb14a', '#fff4d6']),
  ch(12, 'future-universe', 'Future Universe', 'SOMEDAY', 'love', 'Possibilities, not predictions.', ['#08101f', '#5fa8ff', '#e6f2ff']),
  ch(13, 'little-movie', 'Our Little Movie', 'MONTAGE', 'story', 'Different days. Different places.', ['#0d0d10', '#a0a6b8', '#f4f4f6']),
  ch(14, 'for-dheepika', 'For Dheepika', 'DOOR 25', 'story', 'Opens when every other door is open.', ['#0a0716', '#c77dff', '#fff1c9']),
];

export const projectBySlug = (slug: string) => PROJECTS.find((p) => p.slug === slug) ?? null;

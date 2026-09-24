export type Motif = 'petals' | 'hearts' | 'notes' | 'sparks' | 'snow';
export type Mood = { tint: [string, string]; motif: Motif; colors: [string, string]; glow?: number };

/** The mood of each chapter's sky: nebula tint, what drifts through it, and its colours. */
export const MOODS: Record<string, Mood> = {
  'catch-my-heart': { tint: ['#4a1a3a', '#b24a6a'], motif: 'petals', colors: ['#f2a0b4', '#ffd9a0'] },
  'know-us': { tint: ['#2a2458', '#8a5a9a'], motif: 'sparks', colors: ['#e6c989', '#f2c1cb'] },
  'our-secret': { tint: ['#1a2a4a', '#5a4a8a'], motif: 'sparks', colors: ['#a8c4ff', '#f3dfa7'], glow: 0.2 },
  'music-room': { tint: ['#3a1a3a', '#9a5a4a'], motif: 'notes', colors: ['#f3dfa7', '#f2c1cb'] },
  'our-timeline': { tint: ['#2a1a3a', '#7a4a5a'], motif: 'sparks', colors: ['#f3dfa7', '#e8a6b5'] },
  'little-movie': { tint: ['#1a1a2a', '#5a3a4a'], motif: 'snow', colors: ['#f8f1e8', '#e6c989'] },
};

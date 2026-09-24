export type Motif = 'petals' | 'hearts' | 'notes' | 'sparks' | 'snow';
export type Mood = { tint: [string, string]; motif: Motif; colors: [string, string]; glow?: number };

/** The mood of each chapter's sky: nebula tint, what drifts through it, and its colours. */
export const MOODS: Record<string, Mood> = {
  'catch-my-heart': { tint: ['#4a1a3a', '#b24a6a'], motif: 'petals', colors: ['#f2a0b4', '#ffd9a0'] },
};

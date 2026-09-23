import type { SectionId } from '../core/state';

/** Section lengths in viewport heights — measured on the reference (desktop). */
export const SECTIONS: { id: SectionId; vh: number }[] = [
  { id: 'intro', vh: 420 },
  { id: 'manifesto', vh: 105 },
  { id: 'work', vh: 1050 },
  { id: 'lab', vh: 210 },
  { id: 'portal', vh: 126 },
  { id: 'outro', vh: 420 },
];

/** Reference mobile journey is ~54 % of the desktop length. */
export const MOBILE_SCALE = 0.54;

export const TOTAL_VH = SECTIONS.reduce((a, s) => a + s.vh, 0);

export interface SectionRange {
  id: SectionId;
  start: number;
  end: number;
}

/** Normalised [start,end] of each section inside the full journey. */
export const RANGES: SectionRange[] = (() => {
  let acc = 0;
  return SECTIONS.map((s) => {
    const r = { id: s.id, start: acc / TOTAL_VH, end: (acc + s.vh) / TOTAL_VH };
    acc += s.vh;
    return r;
  });
})();

export const rangeOf = (id: SectionId) => RANGES.find((r) => r.id === id)!;

export function sectionAt(p: number): { id: SectionId; local: number } {
  for (const r of RANGES) {
    if (p < r.end || r.id === 'outro') {
      return { id: r.id, local: Math.min(1, Math.max(0, (p - r.start) / (r.end - r.start))) };
    }
  }
  return { id: 'outro', local: 1 };
}

/** Vertical world anchors of each set piece (the journey descends along -Y). */
export const ANCHOR = {
  intro: 0,
  manifesto: -34,
  workTop: -52,
  workBottom: -150,
  lab: -176,
  /** the lab floor (lab − 2.1) is the water surface seen from below in the portal (portal + 3.4) */
  portal: -181.5,
  outro: -206,
};

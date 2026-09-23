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

/**
 * Phone journey length relative to desktop. Measured on the reference at 375/390/430 px
 * wide: 1259.9 vh of 2331 vh. Tablets (e.g. 768×1024) keep the full desktop journey.
 */
export const MOBILE_SCALE = 0.5405;

export const TOTAL_VH = SECTIONS.reduce((a, s) => a + s.vh, 0);

export interface SectionRange {
  id: SectionId;
  start: number;
  end: number;
}

/**
 * Normalised [start,end] of each section in *scroll progress* (scrollTop / maxScroll).
 * The reference's section boundaries sit at cumulative vh in pixels, while progress is
 * measured against maxScroll = total − one viewport. So boundary_i = cum_i / (TOTAL − 100)
 * (in vh, scaled on mobile). The last section therefore only plays to ~76 %, exactly as on
 * the reference, and every boundary lands on the same pixel at any viewport height.
 */
export const RANGES: SectionRange[] = [];
let rangeScale = -1;
export function computeRanges(scale = 1) {
  if (scale === rangeScale) return false;
  rangeScale = scale;
  const denom = TOTAL_VH * scale - 100;
  let acc = 0;
  RANGES.length = 0;
  for (const s of SECTIONS) {
    const start = (acc * scale) / denom;
    acc += s.vh;
    RANGES.push({ id: s.id, start, end: s.id === 'outro' ? 1 : (acc * scale) / denom });
  }
  return true;
}
computeRanges(1);

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
  // a tighter column: cards ~5 units apart so the next card is always partly in frame (reference)
  workBottom: -115,
  lab: -141,
  /** the lab floor (lab − 2.1) is the water surface seen from below in the portal (portal + 3.4) */
  portal: -146.5,
  outro: -171,
};

/**
 * Work‑section anchors shared by the camera timeline, card layout and routing,
 * so "card i is framed" means the same scroll position everywhere.
 * The camera descends linearly from WORK_CAM.y0 (local 0) to WORK_CAM.y1 (local 1).
 */
export const WORK_CAM = { y0: ANCHOR.workTop - 3, y1: ANCHOR.workBottom };
export const WORK_CARDS = 12;
/** Local work progress at which card i sits in front of the camera. */
export const workLocalForCard = (i: number) => 0.003 + (i / WORK_CARDS) * 0.93;
export const workCameraY = (local: number) => WORK_CAM.y0 + (WORK_CAM.y1 - WORK_CAM.y0) * local;

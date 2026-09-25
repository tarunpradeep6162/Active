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
 * Phone section lengths (vh), measured per section on the reference's scroll spacers at
 * 390×844 (qa/sections.mjs): 210 / 105 / 525 / 105 / 105 / 210 = 1260 vh. This is NOT a
 * uniform scale of the desktop split (the headline keeps its full 105 vh, the tunnel grows).
 * Tablets (e.g. 768×1024) keep the full desktop journey.
 */
const PHONE_VH: Record<SectionId, number> = { intro: 210, manifesto: 105, work: 525, lab: 105, portal: 105, outro: 210 };

/** Section lengths (vh) for the device class. */
export function sectionVh(phone: boolean) {
  return SECTIONS.map((s) => (phone ? PHONE_VH[s.id] : s.vh));
}
export const totalVh = (phone: boolean) => sectionVh(phone).reduce((a, v) => a + v, 0);

export interface SectionRange {
  id: SectionId;
  start: number;
  end: number;
}

/**
 * Normalised [start,end] of each section in *scroll progress* (scrollTop / maxScroll).
 * The reference's section boundaries sit at cumulative vh in pixels, while progress is
 * measured against maxScroll = total − one viewport. So boundary_i = cum_i / (TOTAL − 100)
 * (in vh, per device class). The last section therefore only plays partly, exactly as on the
 * reference, and every boundary lands on the same pixel at any viewport height.
 */
const RANGES: SectionRange[] = [];
let rangePhone: boolean | null = null;
export function computeRanges(phone = false) {
  if (phone === rangePhone) return false;
  rangePhone = phone;
  const vh = sectionVh(phone);
  const denom = totalVh(phone) - 100;
  let acc = 0;
  RANGES.length = 0;
  SECTIONS.forEach((s, i) => {
    const start = acc / denom;
    acc += vh[i];
    RANGES.push({ id: s.id, start, end: s.id === 'outro' ? 1 : acc / denom });
  });
  return true;
}
computeRanges(false);

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
  // the work scene (measured reference layout) spans WORK_ORIGIN.y + 7.45 … − 17.9
  workTop: -52,
  // the reference camera never sees below local y ≈ −15, so the column is trimmed there and the
  // lab sits directly beneath it: the exit is a vertical slide from the last card into the lab
  workBottom: -75.5,
  lab: -81,
  /** the lab floor (lab − 2.1) is the water surface seen from below in the portal (portal + 3.4) */
  portal: -86.5,
  outro: -111,
};


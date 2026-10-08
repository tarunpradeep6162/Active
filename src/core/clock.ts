/**
 * Her clock: the device's local time. One place for "now", so the countdown, the birthday gate,
 * the birthday morning and the day/night garden all agree.
 *
 * For testing only: `?qa=1&now=2026-11-24T23:59:50` (or `&debug=1`) pretends the clock reads that
 * time, and keeps running from there.
 */
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
const fake = (q.has('qa') || q.has('debug')) && q.get('now') ? Date.parse(q.get('now')!) : NaN;
const offset = Number.isNaN(fake) ? 0 : fake - Date.now();
export const now = () => new Date(Date.now() + offset);

/** the day and month from the site's date ("25 · 11"), or 25 November */
export function birthdayOf(date: string) {
  const [d, m] = (date.match(/\d+/g) ?? []).map(Number);
  return { day: d >= 1 && d <= 31 ? d : 25, month: m >= 1 && m <= 12 ? m : 11 };
}

/** local midnight at the start of her next (or current) birthday, and whether it is today */
export function nextBirthday(date: string, from = now()) {
  const { day, month } = birthdayOf(date);
  const y = from.getFullYear();
  const start = new Date(y, month - 1, day);
  const end = new Date(y, month - 1, day + 1);
  if (from >= end) return { start: new Date(y + 1, month - 1, day), today: false };
  return { start, today: from >= start };
}

export type DayPart = 'night' | 'dawn' | 'morning' | 'day' | 'evening';
/** the part of her day right now (her local hour) */
export function dayPart(d = now()): DayPart {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 11.5) return 'morning';
  if (h >= 11.5 && h < 16.5) return 'day';
  if (h >= 16.5 && h < 19.5) return 'evening';
  return 'night';
}

/**
 * The garden's light by her real hour: how warm its sky starts (the moon → sunset warmth never
 * falls below this) and a grade the whole frame leans toward. At night it is exactly as designed.
 */
const MOODS: Record<DayPart, { warmMin: number; tint: [number, number, number]; amt: number }> = {
  night: { warmMin: 0, tint: [1, 1, 1], amt: 0 },
  dawn: { warmMin: 0.42, tint: [1.08, 0.97, 0.98], amt: 0.12 },
  morning: { warmMin: 0.55, tint: [1.07, 1.02, 0.9], amt: 0.14 },
  day: { warmMin: 0.62, tint: [1.05, 1.03, 0.96], amt: 0.1 },
  evening: { warmMin: 0.85, tint: [1.1, 0.94, 0.9], amt: 0.14 },
};
let moodAt = -1e9;
let mood = MOODS.night;
let part: DayPart = 'night';
/** her day's mood (re‑read at most every 20 s) */
export function localMood() {
  const t = performance.now();
  if (t - moodAt > 20000) {
    moodAt = t;
    part = dayPart();
    mood = MOODS[part];
  }
  return { part, ...mood };
}

/**
 * Per‑viewer progress (chapters completed, hidden hearts found, choices). It lives in this
 * browser only — a convenience for the one person the experience is for — and every access
 * is guarded so the site still works with storage blocked.
 */
const KEY = 'bday-progress-v1';

export interface Progress {
  done: string[];
  hearts: string[];
  gift: number | null;
  thisOrThat: Record<number, 0 | 1>;
}

const empty = (): Progress => ({ done: [], hearts: [], gift: null, thisOrThat: {} });
let data: Progress = load();
const listeners = new Set<() => void>();

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable: progress lasts for this visit only */
  }
  listeners.forEach((l) => l());
}

export const getProgress = () => data;
export function subscribeProgress(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function markDone(slug: string) {
  if (data.done.includes(slug)) return;
  data = { ...data, done: [...data.done, slug] };
  save();
}
export function findHeart(slug: string) {
  if (data.hearts.includes(slug)) return;
  data = { ...data, hearts: [...data.hearts, slug] };
  save();
}
export function chooseGift(i: number) {
  data = { ...data, gift: i };
  save();
}
export function chooseThisOrThat(i: number, pick: 0 | 1) {
  data = { ...data, thisOrThat: { ...data.thisOrThat, [i]: pick } };
  save();
}

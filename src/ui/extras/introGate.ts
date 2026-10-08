/**
 * The first‑visit intro plays while the garden loads; the garden waits for it to finish (or be
 * skipped) before it fades in, so the two never overlap. With no intro this resolves at once.
 */
const KEY = 'bday-intro-seen';
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

function firstVisit() {
  if (q.has('qa') || q.has('sign') || q.has('nointro')) return q.has('intro');
  if (q.has('intro')) return true;
  try {
    return localStorage.getItem(KEY) !== '1';
  } catch {
    return false;
  }
}

export const playIntro = firstVisit();
let done!: () => void;
export const introDone = playIntro ? new Promise<void>((r) => (done = r)) : Promise.resolve();
export function finishIntro() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* private mode: it may play again next time */
  }
  done?.();
}

import { events } from '../../core/state';
import { subscribeProgress, getProgress } from '../../birthday/progress';

/**
 * Gentle haptics on a phone: a soft tap when a lantern lets go, a flutter as the candles go
 * out, a firm click as the cage unlocks, a heartbeat for each hidden heart. Phones that can't
 * vibrate (and every desktop) simply feel nothing. Off with reduced motion, or when she turns it
 * off in For you.
 */
const KEY = 'bday-haptics-off';
export const hapticsOn = () => {
  try {
    return localStorage.getItem(KEY) !== '1';
  } catch {
    return true;
  }
};
export function setHaptics(on: boolean) {
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, '1');
  } catch {
    /* storage unavailable */
  }
  if (on) buzz('tap');
}
export const canBuzz = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && matchMedia('(pointer: coarse)').matches;

const PATTERNS = {
  tap: [12],
  soft: [8],
  click: [18, 40, 10],
  flutter: [10, 30, 10, 30, 14],
  heart: [14, 90, 22],
  bloom: [6, 40, 6, 40, 6, 40, 20],
  thud: [30],
} as const;
export type Buzz = keyof typeof PATTERNS;

let last = 0;
export function buzz(kind: Buzz) {
  if (!canBuzz() || !hapticsOn() || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const t = performance.now();
  if (t - last < 60) return; // never a rattle
  last = t;
  try {
    navigator.vibrate([...PATTERNS[kind]]);
  } catch {
    /* not allowed yet (no tap so far) */
  }
}

export function startHaptics() {
  if (!canBuzz()) return;
  events.on('lanternWish', () => buzz('soft'));
  events.on('blowCandles', () => buzz('flutter'));
  events.on('openCage', () => buzz('click'));
  events.on('birthdayMidnight', () => buzz('bloom'));
  events.on('sfx', (s) => {
    if (s === 'open' || s === 'door') buzz('tap');
    else if (s === 'seal' || s === 'gift') buzz('click');
    else if (s === 'star') buzz('soft');
    else if (s === 'wrong') buzz('thud');
  });
  let hearts = getProgress().hearts?.length ?? 0;
  subscribeProgress(() => {
    const n = getProgress().hearts?.length ?? 0;
    if (n > hearts) buzz('heart');
    hearts = n;
  });
}

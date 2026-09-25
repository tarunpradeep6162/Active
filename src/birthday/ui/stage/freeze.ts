import { events } from '../../../core/state';

/**
 * When she navigates away from a chapter, its scene should stop drawing at once, so the whole
 * device goes to the page transition (a heavy scene, like the manor, would otherwise slow the
 * exit to a crawl on a weak GPU). Each scene registers its stop function here while alive.
 */
const live = new Set<() => void>();
events.on('navigate', () => live.forEach((f) => f()));

export function freezeOnLeave(stop: () => void) {
  live.add(stop);
  return () => live.delete(stop);
}

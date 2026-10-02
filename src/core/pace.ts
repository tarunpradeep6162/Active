/**
 * Phones: their screens refresh at 90 or 120 Hz, but a WebGL scene that tries to keep up wobbles
 * between frame rates and heats the GPU until it throttles. Every render loop on a phone draws at
 * most ~60 times a second instead: steady pacing, and a cool, unthrottled GPU.
 */
export const isPhone =
  typeof matchMedia !== 'undefined' && (matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));

/** under this many ms since the last drawn frame, a phone skips the refresh (120 Hz → 60) */
export const PHONE_MIN_FRAME_MS = 10.5;

/** A gate for a requestAnimationFrame loop: true when this refresh should draw. */
export function frameGate() {
  let last = -1e9;
  return (now = performance.now()) => {
    if (isPhone && now - last < PHONE_MIN_FRAME_MS) return false;
    last = now;
    return true;
  };
}

import { state } from '../core/state';

/**
 * Tilt to look around: on a phone, turning it moves the camera a little, as if she were turning
 * her head in the scene. Only after she taps for it (iOS asks for permission); the first
 * reading is her resting angle.
 */
type Perm = { requestPermission?: () => Promise<'granted' | 'denied'> };
let base: { b: number; g: number } | null = null;
let listening = false;

function onOrient(e: DeviceOrientationEvent) {
  if (e.beta == null || e.gamma == null) return;
  base ??= { b: e.beta, g: e.gamma };
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  // lightly smoothed toward the new reading
  state.tilt.x += (clamp((e.gamma - base.g) / 28) - state.tilt.x) * 0.25;
  state.tilt.y += (clamp(-(e.beta - base.b) / 28) - state.tilt.y) * 0.25;
}

export const canTilt = () => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window && matchMedia('(pointer: coarse)').matches;

export async function setTilt(on: boolean): Promise<boolean> {
  if (!on) {
    removeEventListener('deviceorientation', onOrient);
    listening = false;
    state.tilt.on = false;
    state.tilt.x = state.tilt.y = 0;
    return false;
  }
  try {
    const D = DeviceOrientationEvent as unknown as Perm;
    if (typeof D.requestPermission === 'function' && (await D.requestPermission()) !== 'granted') return false;
  } catch {
    return false;
  }
  base = null;
  if (!listening) addEventListener('deviceorientation', onOrient);
  listening = true;
  state.tilt.on = true;
  return true;
}

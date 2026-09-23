import * as THREE from 'three';

/**
 * Work‑scene layout, measured from the rendered reference scene (see WORK_SCROLL_MAP.md).
 * All values are in the work scene's local space; WORK_ORIGIN places that space in our world.
 *
 *  spine    40 vertebrae on the Y axis, 0.65 apart, top at y 7.45, each twisted a further
 *           ≈ 22.95° about Y; one vertebra is ≈ 1.93 × 1.16 × 1.68 units.
 *  cards    14 items on a helix: radius 3.8, −50° and −0.84 in y per item, first at angle 0
 *           (on +X), each facing outward from the axis; 4 × 2.6 units.
 *  camera   sits 2 units behind a pivot that orbits the axis and faces it (see WorkTimeline).
 */
export const WORK_ORIGIN = new THREE.Vector3(0, -60, 0);

// reference has 40 (to local −17.9); only 36 are ever in view (camera y ≥ −11.9, FOV 35) so the
// column stops at −15.3 and the lab can sit directly beneath it
export const SPINE = { count: 36, top: 7.45, spacing: 0.65, twistDeg: 22.95, size: new THREE.Vector3(1.93, 1.16, 1.68) };
export interface HelixConfig { radius: number; startY: number; stepDeg: number; stepY: number; count: number }
/** Desktop helix (measured at 1440×900). */
export const HELIX_DESKTOP: HelixConfig = { radius: 3.8, startY: 0, stepDeg: -50, stepY: -0.84, count: 14 };
/** Phone helix (measured at 390×844): starts higher, tighter angle, taller pitch. */
export const HELIX_PHONE: HelixConfig = { radius: 3.8, startY: 4, stepDeg: -35, stepY: -1.12, count: 14 };
/** Active helix — switched with the device class (see setWorkDevice). */
export let HELIX: HelixConfig = HELIX_DESKTOP;
export function setHelix(h: HelixConfig) {
  HELIX = h;
}
// reference transform is 4 × 2.6 but its geometry spans ±0.38, so the visible card is 3.04 × 1.98
export const CARD = { w: 3.04, h: 1.98 };
export const CHAIN = { top: 3, count: 80 };
export const GLITTER_CENTER_Y = -4.5;

/** Local position and outward‑facing yaw of helix slot i. */
export function helixSlot(i: number, out = new THREE.Vector3()) {
  const a = THREE.MathUtils.degToRad(HELIX.stepDeg * i);
  out.set(Math.cos(a) * HELIX.radius, HELIX.startY + HELIX.stepY * i, Math.sin(a) * HELIX.radius);
  // yaw so the card's +Z normal points away from the axis: normal = (sin yaw, 0, cos yaw)
  const yaw = Math.atan2(out.x, out.z);
  return { pos: out, yaw };
}

export const spineBottom = () => SPINE.top - SPINE.spacing * (SPINE.count - 1);

import * as THREE from 'three';

/**
 * Global uniforms shared *by reference* across every custom material, so a
 * single write per frame reaches the whole scene.
 */
export const globalUniforms = {
  uTime: { value: 0 },
  uResolution: { value: new THREE.Vector2(1, 1) },
  uDPR: { value: 1 },
  uPointer: { value: new THREE.Vector2() },
  uPointerVelocity: { value: new THREE.Vector2() },
  uScroll: { value: 0 },
  uScrollVelocity: { value: 0 },
  uTransition: { value: 0 },
  uFocus: { value: 0 },
  uReveal: { value: 0 },
  uAudio: { value: 0 },
  uFogColor: { value: new THREE.Color('#0a0e12') },
  uFogDensity: { value: 0.035 },
};

export type GlobalUniforms = typeof globalUniforms;

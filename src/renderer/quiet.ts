import type * as THREE from 'three';

/**
 * In the published site the renderer doesn't read back every shader's compile log: the GPU
 * driver's harmless notes (e.g. Windows' "X4122 … double precision") stay out of her console,
 * and skipping the synchronous status checks makes shaders compile faster. Development and
 * the QA runs (?qa, ?debug) keep full checking, so real shader errors are still caught there.
 */
const checks = import.meta.env.DEV || /[?&](qa|debug)\b/.test(location.search);
export function quiet<T extends THREE.WebGLRenderer>(renderer: T): T {
  renderer.debug.checkShaderErrors = checks;
  return renderer;
}

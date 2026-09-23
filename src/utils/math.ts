export const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = invLerp(a, b, v);
  return t * t * (3 - 2 * t);
};
/** Frame‑rate independent exponential damping factor. */
export const dampFactor = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt);
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * dampFactor(lambda, dt);

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInExpo = (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10));
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Critically damped spring integrator (per scalar). */
export class Spring {
  value = 0;
  velocity = 0;
  constructor(public stiffness = 170, public damping = 14) {}
  step(target: number, dt: number) {
    const f = -this.stiffness * (this.value - target) - this.damping * this.velocity;
    this.velocity += f * dt;
    this.value += this.velocity * dt;
    return this.value;
  }
}

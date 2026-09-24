import * as THREE from 'three';
import { Stage, makeNebula, makeStarfield } from './Stage';

import type { Mood } from './moods';
export type { Mood } from './moods';

/**
 * A chapter's cinematic sky: nebula, stars, and a drifting motif (petals, small hearts, music
 * notes, warm sparks or soft motes) moving in depth, with a slow camera drift and a pointer
 * parallax. It sits behind the chapter; `pulse()` sends a soft wave of light through it.
 */
export class MoodScene extends Stage {
  private u = { uTime: { value: 0 }, uAspect: { value: 1 }, uPx: { value: 60 }, uGlow: { value: 0.3 }, uPulse: { value: 0 } };
  private pulseAt = -10;
  private ndc = new THREE.Vector2();
  private drift: THREE.Points;

  constructor(canvas: HTMLCanvasElement, mood: Mood) {
    super(canvas, { dpr: 1.25 });
    this.u.uGlow.value = mood.glow ?? 0.3;
    this.camera.position.set(0, 0, 12);
    this.scene.add(makeNebula(this.u, mood.tint), makeStarfield(this.low ? 700 : 1400, this.u));
    this.drift = this.makeDrift(mood);
    this.scene.add(this.drift);
    addEventListener('pointermove', this.onMove, { passive: true });
    this.begin();
  }

  private onMove = (e: PointerEvent) => this.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);

  private makeDrift(mood: Mood) {
    const n = this.low ? 90 : 170;
    const d = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) d.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    const g = this.track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aD', new THREE.BufferAttribute(d, 4));
    const shape = { petals: 0, hearts: 1, notes: 2, sparks: 3, snow: 4 }[mood.motif];
    const pts = new THREE.Points(
      g,
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { ...this.u, uA: { value: new THREE.Color(mood.colors[0]) }, uB: { value: new THREE.Color(mood.colors[1]) } },
          vertexShader: `attribute vec4 aD; uniform float uTime, uPx, uPulse; varying float vA; varying float vRot; varying float vMix;
            void main(){
              float fall = ${shape === 3 ? '-1.' : '1.'};
              float y = mod(aD.y * 16. - fall * uTime * (.25 + aD.z * .35), 16.) - 8.;
              vec3 p = vec3((aD.x - .5) * 26. + sin(uTime * .4 + aD.w * 20.) * .8, y * fall, -aD.z * 14. + 2.);
              vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
              vA = (.35 + .65 * aD.w) * (1. + uPulse * 1.5) * smoothstep(8., 6., abs(y));
              vRot = uTime * (aD.w - .5) * 2. + aD.x * 6.28;
              vMix = aD.w;
              gl_PointSize = uPx * (${shape === 3 || shape === 4 ? '.9' : '3.2'} + aD.w * ${shape === 3 || shape === 4 ? '1.2' : '2.4'}) / -mv.z; }`,
          fragmentShader: `uniform vec3 uA, uB; varying float vA; varying float vRot; varying float vMix;
            float heart(vec2 p){ p.y -= .1; p *= 1.4; float a = atan(p.x, p.y) / 3.1416; float r = length(p); float h = abs(a); float d = (13. * h - 22. * h * h + 10. * h * h * h) / (6. - 5. * h); return smoothstep(d * .5 + .02, d * .5 - .04, r); }
            void main(){
              vec2 c = gl_PointCoord - .5;
              c = mat2(cos(vRot), -sin(vRot), sin(vRot), cos(vRot)) * c;
              float a;
              ${
                shape === 0
                  ? 'a = smoothstep(.42, .3, length(c * vec2(1., 2.2)));'
                  : shape === 1
                    ? 'a = heart(vec2(c.x, -c.y) * 1.1);'
                    : shape === 2
                      ? 'vec2 q = c + vec2(.08, -.18); a = smoothstep(.16, .1, length(q * vec2(1., 1.3))) + step(abs(c.x - .06), .025) * step(-.18, c.y) * step(c.y, .28) + step(abs(c.y - .26), .04) * step(.06, c.x) * step(c.x, .26);'
                      : shape === 3
                        ? 'float d = length(c); a = smoothstep(.5, 0., d) * .4 + smoothstep(.1, 0., d);'
                        : 'float d = length(c); a = smoothstep(.5, .1, d) * .6;'
              }
              a *= vA * .95;
              gl_FragColor = vec4(mix(uA, uB, vMix) * a, a);
            }`,
        }),
      ),
    );
    pts.frustumCulled = false;
    return pts;
  }

  /** A soft wave of light through the sky (a right answer, a found clue, a pressed button). */
  pulse() {
    this.pulseAt = this.clock.getElapsedTime();
  }

  protected onResize(w: number, h: number) {
    this.u.uAspect.value = w / h;
    this.u.uPx.value = 60 * this.renderer.getPixelRatio() * (h / 800) * 1.4;
  }

  protected update(t: number) {
    this.u.uTime.value = this.still ? 0 : t;
    const p = t - this.pulseAt;
    this.u.uPulse.value = p >= 0 && p < 1.6 ? Math.sin((p / 1.6) * Math.PI) : 0;
    this.u.uGlow.value += ((this.u.uPulse.value > 0 ? 0.9 : 0.3) - this.u.uGlow.value) * 0.05;
    const px = this.still ? 0 : this.ndc.x * 0.6 + Math.sin(t * 0.05) * 0.4;
    const py = this.still ? 0 : this.ndc.y * 0.35;
    this.camera.position.x += (px - this.camera.position.x) * 0.04;
    this.camera.position.y += (py - this.camera.position.y) * 0.04;
    this.camera.lookAt(0, 0, -4);
  }

  dispose() {
    removeEventListener('pointermove', this.onMove);
    super.dispose();
  }
}

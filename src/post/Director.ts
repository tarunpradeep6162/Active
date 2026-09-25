import * as THREE from 'three';
import { state, events, type SectionId } from '../core/state';
import { rangeOf, ANCHOR } from '../world/journey';
import { clamp, dampFactor } from '../utils/math';
import type { World } from '../world/World';

/**
 * The cinematographer. Each frame it decides what a camera crew would: where the focus sits
 * (and pulls it when the scene changes), how much the camera breathes in the hand, where the
 * light pours from, and what hour of the night the whole frame is graded to. It also makes the
 * film's hard cuts (a blink of black, then the new shot). It only writes post uniforms and a
 * few state values; the scenes themselves don't know it exists.
 */

type Hour = { tint: THREE.Color; amt: number };
const col = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
/** the grade of each part of the journey: dusk → night → candlelight → midnight → dawn */
const HOURS: Record<SectionId, Hour> = {
  intro: { tint: col(0.9, 0.94, 1.12), amt: 0.55 }, // deep blue night under the stars
  manifesto: { tint: col(0.96, 0.92, 1.1), amt: 0.45 }, // violet dusk at the threshold
  work: { tint: col(0.94, 0.96, 1.08), amt: 0.35 }, // moonlit garden → (warms toward sunset below)
  lab: { tint: col(1.1, 0.96, 0.84), amt: 0.55 }, // candlelight
  portal: { tint: col(0.88, 0.94, 1.14), amt: 0.5 }, // midnight over the lake
  outro: { tint: col(0.92, 0.94, 1.12), amt: 0.45 }, // night → dawn (warms with the sunrise below)
};
const SUNSET = col(1.1, 0.95, 0.86);
const DAWN = col(1.12, 1.0, 0.88);

export class Director {
  private section: SectionId | null = null;
  private pull = 0;
  private blink = 0;
  private tint = new THREE.Color(1, 1, 1);
  private tintAmt = 0;
  private v = new THREE.Vector3();
  private d = new THREE.Vector3();
  private focus = { x: 0.5, y: 0.5, r: 0.3, amt: 0 };
  private rays = { x: 0.5, y: 0.8, amt: 0 };
  private rayTint = new THREE.Color();
  private candle = 0;

  constructor(private post: THREE.ShaderMaterial, private lens: boolean) {
    // a hard cut in the film: a blink of black, then the new shot
    events.on('filmCut', () => (this.blink = 1));
  }

  setLens(on: boolean) {
    this.lens = on;
  }

  update(dt: number, world: World, camera: THREE.PerspectiveCamera) {
    const u = this.post.uniforms;
    const reduced = state.reducedMotion;
    const sec = state.section;
    const lp = state.sectionProgress;
    // a new scene: the focus starts soft and pulls in, as if the focus puller found her
    if (sec !== this.section) {
      if (this.section !== null && !reduced) this.pull = 1;
      this.section = sec;
    }
    this.pull = Math.max(0, this.pull - dt / 1.8);
    this.blink = Math.max(0, this.blink - dt / 0.45);

    // ---- focus: what the shot is about
    const f = this.focus;
    let fx = 0.5, fy = 0.5, fr = 0.34, fa = 0;
    if (sec === 'intro') (fy = 0.48), (fr = 0.26), (fa = 0.3 * state.reveal);
    else if (sec === 'lab') {
      this.project(this.v.copy(world.lab.center).add(this.d.set(0, 0.6, 0)), camera);
      (fx = this.v.x), (fy = this.v.y), (fr = state.cageOpen ? 0.2 : 0.3), (fa = state.cageOpen ? 0.55 : 0.28);
    } else if (sec === 'portal') (fy = 0.4), (fr = 0.42), (fa = 0.22);
    else if (sec === 'outro') (fy = 0.6), (fr = 0.62), (fa = 0.25 * clamp((state.finaleLocal - 0.3) / 0.3));
    // an open chapter already softens the world; don't double it
    fa *= 1 - clamp(state.focus * 2);
    const pullEase = this.pull * this.pull * (3 - 2 * this.pull);
    fa = Math.min(1, fa + pullEase * 0.75);
    fr = fr * (1 - pullEase * 0.85);
    const k = dampFactor(5, dt);
    f.x += (fx - f.x) * k;
    f.y += (fy - f.y) * k;
    f.r += (fr - f.r) * k;
    f.amt += ((reduced ? 0 : fa) - f.amt) * k;
    u.uFocusPt.value.set(f.x, f.y);
    u.uFocusR.value = f.r;
    u.uFocusAmt.value = f.amt;
    u.uLens.value = this.lens ? 1 : 0;

    // ---- handheld: close, emotional shots breathe; wide shots stay on sticks
    state.handheld = reduced ? 0 : sec === 'lab' ? (state.cageOpen ? 1 : 0.5) : sec === 'portal' ? 0.7 : sec === 'outro' ? 0.4 : sec === 'intro' ? 0.3 : 0.12;

    // ---- light shafts: where the light pours from
    let ra = 0;
    const rt = this.rayTint.setRGB(1, 0.85, 0.65);
    if (sec === 'work') {
      const gs = world.gardenSky.uniforms;
      const w = gs.uWarm.value as number;
      this.d.set(Math.cos(gs.uMoonAz.value), 0.13 + (0.045 - 0.13) * w, Math.sin(gs.uMoonAz.value)).normalize();
      ra = this.projectDir(this.d, camera) * 0.55 * (gs.uAmt.value as number);
      rt.setRGB(0.75 + 0.35 * w, 0.8 + 0.05 * w, 1 - 0.4 * w);
    } else if (sec === 'lab') {
      ra = this.projectPoint(this.v.copy(world.lab.center).add(this.d.set(0, 3.3, 0)), camera) * (state.cageOpen ? 0.7 : 0.3) * (1 - state.cakeDark);
      rt.setRGB(1, 0.82, 0.6);
    } else if (sec === 'portal') {
      ra = this.projectPoint(this.v.set(0, ANCHOR.portal - 2.5, -26), camera) * 0.45 * clamp((lp - 0.05) / 0.12);
      rt.setRGB(1, 0.72, 0.45);
    } else if (sec === 'outro') {
      const s = world.finaleSky.lake.uniforms.uSun.value as number;
      this.d.set(0, -0.05 + 0.11 * s, -1).normalize();
      ra = this.projectDir(this.d, camera) * 1.1 * s;
      rt.setRGB(1, 0.7, 0.42);
    }
    const r = this.rays;
    r.x += (this.v.x - r.x) * (ra > 0 ? 1 : 0);
    r.y += (this.v.y - r.y) * (ra > 0 ? 1 : 0);
    r.amt += (ra * (1 - clamp(state.focus * 1.5)) - r.amt) * dampFactor(3, dt);
    u.uRayPt.value.set(r.x, r.y);
    u.uRays.value = r.amt;
    (u.uRayTint.value as THREE.Color).lerp(rt, dampFactor(3, dt));

    // ---- the hour: the grade travels from night to candlelight to dawn with her
    const h = HOURS[sec];
    const target = this.v.set(h.tint.r, h.tint.g, h.tint.b);
    let amt = h.amt;
    if (sec === 'work') {
      const wr = rangeOf('work');
      const w = clamp((state.scroll.progress - wr.start) / (wr.end - wr.start));
      target.lerp(this.d.set(SUNSET.r, SUNSET.g, SUNSET.b), w * w);
    } else if (sec === 'outro') {
      const s = world.finaleSky.lake.uniforms.uSun.value as number;
      target.lerp(this.d.set(DAWN.r, DAWN.g, DAWN.b), s);
      amt += s * 0.15;
    }
    if (sec === 'lab' && state.cakeDark > 0) amt *= 1 - state.cakeDark * 0.5;
    const kt = dampFactor(2, dt);
    this.tint.r += (target.x - this.tint.r) * kt;
    this.tint.g += (target.y - this.tint.g) * kt;
    this.tint.b += (target.z - this.tint.b) * kt;
    this.tintAmt += (amt * (1 - state.overlay) - this.tintAmt) * kt;
    (u.uTint.value as THREE.Color).copy(this.tint);
    u.uTintAmt.value = this.tintAmt;

    // ---- weather: the lantern sky opens in a light rain that clears as the lanterns rise;
    // mist rolls low over the threshold and the first of the garden
    const rain = sec === 'portal' ? clamp((lp - 0.04) / 0.08) * (1 - clamp((lp - 0.22) / 0.2)) : 0;
    state.rain += ((reduced ? rain * 0.5 : rain) - state.rain) * dampFactor(2, dt);
    u.uRain.value = reduced ? 0 : state.rain;
    const mist = sec === 'manifesto' ? 1 : sec === 'intro' ? clamp((lp - 0.75) / 0.2) : sec === 'work' ? 1 - clamp((lp - 0.04) / 0.18) : 0;
    u.uMist.value += (mist * (1 - clamp(state.focus * 2)) - u.uMist.value) * dampFactor(2, dt);

    // ---- candlelight: the flames light the room and breathe; when they go out, real darkness
    const burning = sec === 'lab' && state.cakeReady ? 1 : 0;
    this.candle += (burning - this.candle) * dampFactor(burning ? 1.2 : 6, dt);
    const t = state.time;
    const flick = 0.82 + 0.1 * Math.sin(t * 9.1) * Math.sin(t * 3.7 + 1) + 0.08 * Math.sin(t * 17.3 + 2);
    this.project(this.v.copy(world.lab.center).add(this.d.set(0, 1.0, 0)), camera);
    (u.uCandle.value as THREE.Vector3).set(this.v.x, this.v.y, this.candle * flick * (1 - clamp(state.focus * 2)));
    const exposure = sec === 'lab' ? 1 - state.cakeDark * 0.55 + this.candle * (flick - 0.82) * 0.25 : 1;
    u.uExposure.value += (exposure - u.uExposure.value) * dampFactor(8, dt);

    // ---- cuts
    u.uBlink.value = reduced ? 0 : Math.sin(Math.min(1, this.blink) * Math.PI * 0.5) ** 0.5 * (this.blink > 0 ? 1 : 0);
  }

  /** world point → screen uv (0…1, y up) in this.v; returns 1 in front of the camera, else 0 */
  private project(p: THREE.Vector3, camera: THREE.Camera) {
    p.project(camera);
    const front = p.z < 1;
    this.v.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5, 0);
    return front ? 1 : 0;
  }
  /** as project, faded out as the light leaves the frame */
  private projectPoint(p: THREE.Vector3, camera: THREE.Camera) {
    const front = this.project(p, camera);
    return front * this.onScreen();
  }
  /** a light at infinity in direction d from the camera */
  private projectDir(d: THREE.Vector3, camera: THREE.Camera) {
    return this.projectPoint(this.v.copy(camera.position).addScaledVector(d, 150), camera);
  }
  private onScreen() {
    const ox = Math.max(0, Math.abs(this.v.x - 0.5) - 0.5), oy = Math.max(0, Math.abs(this.v.y - 0.5) - 0.5);
    return clamp(1 - Math.hypot(ox, oy) / 0.6);
  }
}

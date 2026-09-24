import * as THREE from 'three';
import { Stage, makeNebula, makeStarfield, sampleText, ease } from './Stage';

/**
 * Chapter 4 · 14 Things — the reasons are stars in a nebula sky. The page's own star buttons
 * stay the tap targets; this scene lights them: each glows, flares with a ring when touched,
 * and a thread of light joins it to the last one found. When all fourteen are found, light
 * streams out of every star and gathers into her name written in stars.
 */
export class ReasonsScene extends Stage {
  private u = { uTime: { value: 0 }, uAspect: { value: 1 }, uPx: { value: 60 }, uGlow: { value: 0.3 } };
  private glows: THREE.Mesh[] = [];
  private flareAt: number[] = [];
  private seen: boolean[] = [];
  private order: number[] = [];
  private screen: THREE.Vector2[] = [];
  private world: THREE.Vector3[] = [];
  private thread: THREE.LineSegments;
  private threadU = { uTime: this.u.uTime, uDraw: { value: 0 } };
  private lastLinkAt = -10;
  private name: THREE.Points;
  private nameU = { uTime: this.u.uTime, uK: { value: 0 }, uPx: this.u.uPx, uFit: { value: 1 } };
  private completeAt = -1;
  private readonly count: number;

  constructor(canvas: HTMLCanvasElement, count: number, herName: string) {
    super(canvas, { dpr: 1.5 });
    this.count = count;
    this.camera.position.set(0, 0, 12);
    this.scene.add(makeNebula(this.u, ['#2a1f5a', '#8a4a7a']), makeStarfield(this.low ? 900 : 1800, this.u));

    const glowGeo = this.track(new THREE.PlaneGeometry(1.8, 1.8));
    for (let i = 0; i < count; i++) {
      const m = this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uTime: this.u.uTime, uOn: { value: 0 }, uFlare: { value: 0 }, uSeed: { value: i * 1.7 } },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv - .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
          fragmentShader: `uniform float uTime, uOn, uFlare, uSeed; varying vec2 vUv;
            void main(){
              float r = length(vUv);
              float tw = .75 + .25 * sin(uTime * 2.2 + uSeed);
              float core = smoothstep(.06, 0., r) * (.5 + uOn * .8);
              float halo = exp(-r * (16. - uOn * 6.)) * (.25 + uOn * .6) * tw;
              float rays = (exp(-abs(vUv.x) * 90.) * exp(-abs(vUv.y) * 7.) + exp(-abs(vUv.y) * 90.) * exp(-abs(vUv.x) * 7.)) * (.15 + uOn * .45 + uFlare * 1.2);
              float ring = exp(-pow((r - uFlare * .45) * 26., 2.)) * (1. - uFlare) * step(.001, uFlare);
              float a = core + halo + rays + ring * .8;
              vec3 col = mix(vec3(.85, .8, 1.), vec3(1., .86, .6), uOn);
              gl_FragColor = vec4(col * a, min(1., a));
            }`,
        }),
      );
      const g = new THREE.Mesh(glowGeo, m);
      this.glows.push(g);
      this.flareAt.push(-10);
      this.seen.push(false);
      this.screen.push(new THREE.Vector2(0.5, 0.5));
      this.world.push(new THREE.Vector3());
      this.scene.add(g);
    }

    // the thread of light between found stars (in the order she found them)
    const tg = this.track(new THREE.BufferGeometry());
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
    tg.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(count * 2), 1));
    this.thread = new THREE.LineSegments(
      tg,
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: this.threadU,
          vertexShader: `attribute float aT; varying float vT; void main(){ vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
          fragmentShader: `uniform float uTime, uDraw; varying float vT;
            void main(){ float a = step(vT, uDraw) * (.45 + .2 * sin(uTime * 3. - vT * 8.)); gl_FragColor = vec4(vec3(1., .85, .7) * a, a); }`,
        }),
      ),
    );
    this.thread.frustumCulled = false;
    this.scene.add(this.thread);

    // her name in stars (gathers from the fourteen stars when the constellation completes)
    const M = this.low ? 1400 : 2600;
    const seeds = new Float32Array(M * 2);
    for (let i = 0; i < M; i++) seeds.set([Math.floor(Math.random() * count), Math.random()], i * 2);
    const ng = this.track(new THREE.BufferGeometry());
    ng.setAttribute('position', new THREE.BufferAttribute(new Float32Array(M * 3), 3));
    ng.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 2));
    ng.setAttribute('aTarget', new THREE.BufferAttribute(sampleText(herName.toUpperCase().split('').join(' '), M, 7), 3));
    ng.setAttribute('aFrom', new THREE.BufferAttribute(new Float32Array(M * 3), 3));
    this.name = new THREE.Points(
      ng,
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: this.nameU,
          vertexShader: `attribute vec2 aSeed; attribute vec3 aTarget; attribute vec3 aFrom; uniform float uTime, uK, uPx, uFit; varying float vA;
            void main(){
              float d = aSeed.y * .5;
              float k = smoothstep(d, d + .5, uK);
              vec3 tgt = aTarget * uFit + vec3(0., .75, 0.);
              vec3 p = mix(aFrom, tgt, k);
              p.z += sin(3.1416 * k) * (aSeed.y - .5) * 3.;
              p += vec3(sin(uTime + aSeed.y * 40.), cos(uTime * .8 + aSeed.y * 30.), 0.) * .01 * k;
              vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
              vA = step(.001, uK) * (.35 + .65 * k) * (.7 + .3 * sin(uTime * 2. + aSeed.y * 50.));
              gl_PointSize = uPx * (.7 + aSeed.y) / -mv.z; }`,
          fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = (smoothstep(.5, 0., d) * .35 + smoothstep(.14, 0., d)) * vA; gl_FragColor = vec4(vec3(1., .93, .84) * a, a); }`,
        }),
      ),
    );
    this.name.frustumCulled = false;
    this.scene.add(this.name);
    this.begin();
  }

  /** Screen positions (0…1) of the page's star buttons, and which have been found. */
  setStars(pos: { x: number; y: number }[], seen: boolean[]) {
    pos.forEach((p, i) => this.screen[i]?.set(p.x, p.y));
    seen.forEach((s, i) => {
      if (s && !this.seen[i]) {
        this.seen[i] = true;
        this.order.push(i);
        this.flareAt[i] = this.clock.getElapsedTime();
        this.lastLinkAt = this.clock.getElapsedTime();
      }
    });
  }
  /** Touched again: flare without adding a thread. */
  flare(i: number) {
    this.flareAt[i] = this.clock.getElapsedTime();
  }
  complete() {
    if (this.completeAt < 0) this.completeAt = this.clock.getElapsedTime();
  }

  protected onResize(w: number, h: number) {
    this.u.uAspect.value = w / h;
    this.u.uPx.value = 60 * this.renderer.getPixelRatio() * (h / 800) * 1.4;
    this.camera.fov = w / h < 1 ? 58 : 40;
    this.camera.updateProjectionMatrix();
    const viewW = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
    this.nameU.uFit.value = Math.min(1, (viewW * 0.8) / 7);
  }

  protected update(t: number) {
    this.u.uTime.value = this.still ? 0 : t;
    this.camera.position.x = this.still ? 0 : Math.sin(t * 0.06) * 0.3;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    // map each page star (screen fraction) onto the z = 0 plane
    const v = new THREE.Vector3();
    for (let i = 0; i < this.count; i++) {
      const s = this.screen[i];
      v.set(s.x * 2 - 1, -(s.y * 2 - 1), 0.5).unproject(this.camera);
      const dir = v.sub(this.camera.position).normalize();
      const dist = -this.camera.position.z / dir.z;
      this.world[i].copy(this.camera.position).addScaledVector(dir, dist);
      const g = this.glows[i];
      g.position.copy(this.world[i]);
      const m = g.material as THREE.ShaderMaterial;
      m.uniforms.uOn.value += ((this.seen[i] ? 1 : 0) - m.uniforms.uOn.value) * 0.08;
      const f = t - this.flareAt[i];
      m.uniforms.uFlare.value = f >= 0 && f < 1.4 ? ease(0, 1.4, f) : 0;
      g.scale.setScalar(1 + m.uniforms.uFlare.value * 0.6);
    }
    // the thread, drawn segment by segment as she finds them
    const pos = this.thread.geometry.getAttribute('position') as THREE.BufferAttribute;
    const at = this.thread.geometry.getAttribute('aT') as THREE.BufferAttribute;
    const n = this.order.length;
    for (let k = 0; k < this.count; k++) {
      const a = k < n - 1 ? this.world[this.order[k]] : null;
      const b = k < n - 1 ? this.world[this.order[k + 1]] : null;
      pos.setXYZ(k * 2, a?.x ?? 0, a?.y ?? 0, a?.z ?? 0);
      pos.setXYZ(k * 2 + 1, b?.x ?? 0, b?.y ?? 0, b?.z ?? 0);
      at.setX(k * 2, k / Math.max(1, n));
      at.setX(k * 2 + 1, (k + 1) / Math.max(1, n));
    }
    pos.needsUpdate = at.needsUpdate = true;
    // the newest segment draws itself in
    const draw = n <= 1 ? 1 : (n - 2 + ease(0, 0.8, t - this.lastLinkAt)) / (n - 1);
    this.threadU.uDraw.value = this.completeAt >= 0 ? 1.01 : Math.min(1.01, draw * ((n - 1) / Math.max(1, n)) + 0.001);
    // completion: the name gathers out of the stars
    if (this.completeAt >= 0) {
      const from = this.name.geometry.getAttribute('aFrom') as THREE.BufferAttribute;
      const seed = this.name.geometry.getAttribute('aSeed') as THREE.BufferAttribute;
      if (!this.fromSet) {
        for (let i = 0; i < from.count; i++) {
          const w = this.world[seed.getX(i)];
          from.setXYZ(i, w.x, w.y, w.z);
        }
        from.needsUpdate = true;
        this.fromSet = true;
      }
      this.nameU.uK.value = this.still ? 1 : ease(0.2, 3, t - this.completeAt);
    }
    this.u.uGlow.value = 0.3 + (n / this.count) * 0.5;
  }
  private fromSet = false;
}

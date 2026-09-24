import * as THREE from 'three';
import { Stage, sampleText, ease } from './Stage';

/**
 * Chapter 1 · 25 · 11 — the first light.
 *
 * A deep night of drifting plum and rose nebula, a field of twinkling stars and the odd
 * shooting star, with one star waiting at the centre. The first touch ignites it (rings of
 * light ripple out, the sky warms). The second touch bursts it: thousands of motes fly out,
 * swirl into a small spiral galaxy, then gather into the date written in stars.
 */
export class BeginningScene extends Stage {
  private awake = 0;
  private awakeAt = [0, 0, 0];
  private u = {
    uTime: { value: 0 },
    uIgnite: { value: 0 },
    uBurst: { value: 0 },
    /** the burst's flash in the sky: bright, then fading to a soft residual glow */
    uFlash: { value: 0 },
    uGalaxy: { value: 0 },
    uGather: { value: 0 },
    uPx: { value: 60 },
    uAspect: { value: 1 },
  };
  private nebula: THREE.Mesh;
  private star: THREE.Mesh;
  private rings: THREE.Mesh[] = [];
  private ringAt: number[] = [];
  private streak: THREE.Mesh;
  private streakAt = 3;
  private streakFrom = new THREE.Vector3();
  private streakDir = new THREE.Vector3();
  /** the date's world height on screen, for placing the words below it */
  dateTopBottom = { top: 0.35, bottom: 0.55 };

  constructor(canvas: HTMLCanvasElement, date: string, startAwake = 0) {
    super(canvas, { dpr: 1.5 });
    this.camera.position.set(0, 0, 14);
    this.renderer.toneMappingExposure = 1;

    // nebula: a screen‑filling quad with layered noise clouds (drawn first, behind everything)
    const nebMat = this.track(
      new THREE.ShaderMaterial({
        depthWrite: false,
        depthTest: false,
        uniforms: this.u,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.); }`,
        fragmentShader: `
          uniform float uTime, uIgnite, uFlash, uAspect; varying vec2 vUv;
          float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
            return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
          float fbm(vec2 p){ float v = 0., a = .5; for (int i = 0; i < 5; i++){ v += a * n(p); p = p * 2.03 + 11.7; a *= .5; } return v; }
          void main(){
            vec2 p = (vUv - .5) * vec2(uAspect, 1.);
            float t = uTime * .015;
            float c1 = fbm(p * 1.6 + vec2(t, -t * .6));
            float c2 = fbm(p * 3.1 - vec2(t * 1.3, t) + c1 * 1.4);
            float cloud = smoothstep(.35, .95, c1 * .6 + c2 * .6);
            vec3 base = mix(vec3(.018, .02, .05), vec3(.03, .025, .07), vUv.y);
            vec3 plum = vec3(.28, .1, .26), rose = vec3(.62, .3, .38), gold = vec3(.75, .55, .3);
            vec3 col = base + plum * cloud * .55 + rose * pow(cloud, 2.2) * .35;
            // the centre warms as the star wakes, and flashes with the burst
            float r = length(p);
            col += gold * exp(-r * r * 9.) * (uIgnite * .35 + uFlash * .9);
            col += rose * exp(-r * r * 2.5) * uIgnite * .12;
            col *= 1. - smoothstep(.45, 1.1, r) * .55;
            gl_FragColor = vec4(col, 1.);
          }`,
      }),
    );
    this.nebula = new THREE.Mesh(this.track(new THREE.PlaneGeometry(2, 2)), nebMat);
    this.nebula.frustumCulled = false;
    this.nebula.renderOrder = -10;
    this.scene.add(this.nebula);

    // background stars
    const N = this.low ? 900 : 1800;
    const sp = new Float32Array(N * 3), ss = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      sp.set([(Math.random() - 0.5) * 80, (Math.random() - 0.5) * 50, -10 - Math.random() * 60], i * 3);
      ss[i] = Math.random();
    }
    const sg = this.track(new THREE.BufferGeometry());
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sg.setAttribute('aSeed', new THREE.BufferAttribute(ss, 1));
    const stars = new THREE.Points(
      sg,
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: this.u,
          vertexShader: `attribute float aSeed; uniform float uTime, uPx; varying float vA;
            void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
              vA = (.25 + .75 * pow(.5 + .5 * sin(uTime * (.6 + aSeed * 2.) + aSeed * 60.), 2.)) * (.3 + aSeed * .7);
              gl_PointSize = uPx * (.6 + aSeed * 1.4) * 4. / -mv.z; }`,
          fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = (smoothstep(.5, 0., d) * .3 + smoothstep(.15, 0., d)) * vA; gl_FragColor = vec4(vec3(1., .95, .88) * a, a); }`,
        }),
      ),
    );
    stars.frustumCulled = false;
    this.scene.add(stars);

    // the star: a billboard with a hot core, halo and four soft rays, breathing
    const starMat = this.track(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: this.u,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv - .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
        fragmentShader: `uniform float uTime, uIgnite, uBurst; varying vec2 vUv;
          void main(){
            float r = length(vUv);
            float breathe = .85 + .15 * sin(uTime * 1.8);
            float core = smoothstep(.035 + uIgnite * .02, 0., r);
            float halo = exp(-r * (26. - uIgnite * 12.)) * (.55 + uIgnite * .9) * breathe;
            float rays = (exp(-abs(vUv.x) * 160.) * exp(-abs(vUv.y) * 5.5) + exp(-abs(vUv.y) * 160.) * exp(-abs(vUv.x) * 5.5)) * (.35 + uIgnite * 1.2);
            float d = exp(-abs(vUv.x + vUv.y) * 120.) * exp(-abs(vUv.x - vUv.y) * 8.) + exp(-abs(vUv.x - vUv.y) * 120.) * exp(-abs(vUv.x + vUv.y) * 8.);
            rays += d * .25 * uIgnite;
            float a = (core * 1.6 + halo + rays) * (1. - uBurst);
            vec3 col = mix(vec3(1., .86, .62), vec3(1., .97, .92), core);
            gl_FragColor = vec4(col * a, min(1., a));
          }`,
      }),
    );
    this.star = new THREE.Mesh(this.track(new THREE.PlaneGeometry(9, 9)), starMat);
    this.scene.add(this.star);

    // shock rings (one per touch)
    for (let i = 0; i < 2; i++) {
      const rm = this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uR: { value: 0 }, uA: { value: 0 }, uColor: { value: new THREE.Color(i ? '#ffc6d6' : '#ffe2b0') } },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv - .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
          fragmentShader: `uniform float uR, uA; uniform vec3 uColor; varying vec2 vUv;
            void main(){ float r = length(vUv); float a = exp(-pow((r - uR) * 60., 2.)) * uA + exp(-pow((r - uR * .8) * 30., 2.)) * uA * .3; gl_FragColor = vec4(uColor * a, a); }`,
        }),
      );
      const ring = new THREE.Mesh(this.track(new THREE.PlaneGeometry(20, 20)), rm);
      ring.position.z = -0.2;
      this.rings.push(ring);
      this.ringAt.push(-1);
      this.scene.add(ring);
    }

    // the burst: motes that fly out, swirl into a spiral galaxy, then gather into the date
    const M = this.low ? 2600 : 5200;
    const seeds = new Float32Array(M * 4);
    for (let i = 0; i < M; i++) seeds.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    const pg = this.track(new THREE.BufferGeometry());
    pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(M * 3), 3));
    pg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    // the date is about 8 units wide (scaled down on narrow screens in onResize)
    pg.setAttribute('aTarget', new THREE.BufferAttribute(sampleText(date, M, 8), 3));
    const motes = new THREE.Points(
      pg,
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { ...this.u, uFit: this.fit },
          vertexShader: `
            attribute vec4 aSeed; attribute vec3 aTarget;
            uniform float uTime, uBurst, uGalaxy, uGather, uPx, uFit;
            varying float vA; varying float vWarm;
            void main(){
              // 1 · burst: straight out from the star
              float th = aSeed.x * 6.2832, ph = acos(aSeed.y * 2. - 1.);
              vec3 dir = vec3(sin(ph) * cos(th), sin(ph) * sin(th) * .75, cos(ph) * .6);
              vec3 burst = dir * (1.2 + aSeed.z * 7.) * (1. - exp(-uBurst * 3.));
              // 2 · galaxy: three logarithmic arms, inner stars turning faster
              float arm = floor(aSeed.w * 3.) / 3. * 6.2832;
              float r = .25 + pow(aSeed.z, .7) * 5.2;
              float a = arm + r * 1.35 + uTime * (.55 / (.4 + r)) + (aSeed.x - .5) * .5;
              vec3 gal = vec3(cos(a) * r, sin(a) * r * .38, sin(a) * r * .5);
              gal.y += (aSeed.y - .5) * .25 * (1. - r / 6.);
              vec3 p = mix(burst, gal, uGalaxy);
              // 3 · gather into the date, each mote on its own delay
              float d0 = aSeed.w * .45;
              float g = smoothstep(d0, d0 + .55, uGather);
              p = mix(p, aTarget * uFit, g);
              p.z += sin(3.1416 * g) * (aSeed.x - .5) * 2.;
              // after gathering, a gentle shimmer
              p += vec3(sin(uTime * .8 + aSeed.x * 40.), cos(uTime * .7 + aSeed.y * 40.), 0.) * .012 * g;
              vec4 mv = modelViewMatrix * vec4(p, 1.);
              gl_Position = projectionMatrix * mv;
              float tw = .6 + .4 * sin(uTime * (1. + aSeed.z * 3.) + aSeed.w * 50.);
              vA = tw * min(1., uBurst * 4.) * (.45 + .55 * max(g, uGalaxy * (1. - r / 7.)));
              vWarm = aSeed.z;
              gl_PointSize = uPx * (.7 + aSeed.y * 1.1) * (1. + g * .35) / -mv.z;
            }`,
          fragmentShader: `varying float vA; varying float vWarm;
            void main(){ float d = length(gl_PointCoord - .5); float a = (smoothstep(.5, 0., d) * .35 + smoothstep(.14, 0., d)) * vA;
              vec3 col = mix(vec3(1., .97, .9), mix(vec3(.98, .8, .5), vec3(.96, .62, .72), step(.6, vWarm)), vWarm * .7);
              gl_FragColor = vec4(col * a, a); }`,
        }),
      ),
    );
    motes.frustumCulled = false;
    this.scene.add(motes);

    // a shooting star now and then
    const streakMat = this.track(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uA: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
        fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ float a = pow(vUv.x, 3.) * exp(-pow((vUv.y - .5) * 7., 2.)) * uA; gl_FragColor = vec4(vec3(1., .93, .82) * a, a); }`,
      }),
    );
    this.streak = new THREE.Mesh(this.track(new THREE.PlaneGeometry(6, 0.08)), streakMat);
    this.streak.visible = false;
    this.scene.add(this.streak);

    // returning to a chapter already opened: show the finished date straight away
    if (startAwake >= 2) {
      this.awake = 2;
      this.awakeAt = [0, -30, -30];
    }
    this.begin();
  }

  private fit = { value: 1 };

  protected onResize(w: number, h: number) {
    this.u.uAspect.value = w / h;
    this.u.uPx.value = 60 * this.renderer.getPixelRatio() * (h / 800) * 1.4;
    // keep the 8‑unit date inside the view on narrow screens
    const viewW = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
    this.fit.value = Math.min(1, (viewW * 0.84) / 8);
  }

  /** The star was touched (1: it wakes, 2: it bursts into the date). */
  wake(level: number) {
    if (level <= this.awake) return;
    this.awake = level;
    this.awakeAt[level] = this.clock.getElapsedTime();
    this.ringAt[level - 1] = this.awakeAt[level];
  }

  protected update(t: number) {
    const u = this.u;
    u.uTime.value = this.still ? 0 : t;
    const s1 = this.awake >= 1 ? t - this.awakeAt[1] : -1;
    const s2 = this.awake >= 2 ? t - this.awakeAt[2] : -1;
    u.uIgnite.value = s1 < 0 ? 0 : ease(0, 1.2, s1) * (s2 < 0 ? 1 : 1 - ease(0, 0.4, s2));
    u.uBurst.value = s2 < 0 ? 0 : ease(0, 0.9, s2);
    u.uFlash.value = s2 < 0 ? 0 : ease(0, 0.5, s2) * (1 - ease(1.2, 4.5, s2) * 0.82);
    u.uGalaxy.value = s2 < 0 ? 0 : ease(0.6, 2.4, s2);
    u.uGather.value = s2 < 0 ? 0 : ease(3.2, 5.6, s2);
    this.star.scale.setScalar(1 + (this.still ? 0 : Math.sin(t * 1.8) * 0.02));

    this.rings.forEach((ring, i) => {
      const r0 = this.ringAt[i];
      const k = r0 < 0 ? -1 : t - r0;
      const m = ring.material as THREE.ShaderMaterial;
      m.uniforms.uR.value = k < 0 ? 0 : ease(0, 2.8, k) * 0.48;
      m.uniforms.uA.value = k < 0 ? 0 : (1 - ease(0.4, 2.8, k)) * (i ? 1.2 : 0.9);
    });

    // shooting star every few seconds
    if (!this.still) {
      const sk = t - this.streakAt;
      if (sk > 1.4) {
        this.streakAt = t + 3 + Math.random() * 5;
        this.streakFrom.set((Math.random() - 0.2) * 22, 6 + Math.random() * 5, -12);
        this.streakDir.set(-1, -0.45 - Math.random() * 0.3, 0).normalize();
      }
      const on = sk >= 0 && sk <= 1.4;
      this.streak.visible = on;
      if (on) {
        this.streak.position.copy(this.streakFrom).addScaledVector(this.streakDir, sk * 16);
        this.streak.rotation.z = Math.atan2(this.streakDir.y, this.streakDir.x) + Math.PI;
        (this.streak.material as THREE.ShaderMaterial).uniforms.uA.value = Math.sin((sk / 1.4) * Math.PI) * 0.9;
      }
    }

    // slow drift, a gentle push in as the galaxy turns, settling for the date
    const push = ease(0.5, 5, s2 < 0 ? 0 : s2);
    this.camera.position.set(this.still ? 0 : Math.sin(t * 0.07) * 0.6, this.still ? 0 : Math.cos(t * 0.05) * 0.3, 14 - push * 2.5 + ease(4, 6.5, s2 < 0 ? 0 : s2) * 1.2);
    this.camera.lookAt(0, 0, 0);
  }
}

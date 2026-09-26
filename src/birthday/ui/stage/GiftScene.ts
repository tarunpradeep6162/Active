import * as THREE from 'three';
import { SceneClock } from './clock';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SERIF } from '../../../utils/fonts';
import { freezeOnLeave } from './freeze';


/** satin wrap, ribbon and inner‑glow colours for each of the three boxes */
const WRAPS = [
  { wrap: '#9c2f55', sheen: '#ffb3c8', ribbon: '#e8c27a', glow: '#ffd9a0' },
  { wrap: '#2a2346', sheen: '#b7a8ff', ribbon: '#f0d49a', glow: '#ffe7c2' },
  { wrap: '#e9d7c2', sheen: '#fff4e6', ribbon: '#c9867d', glow: '#ffc9d6' },
];

type Box = {
  group: THREE.Group;
  lid: THREE.Group;
  bow: THREE.Group;
  body: THREE.Mesh;
  glow: THREE.Mesh;
  beam: THREE.Mesh;
  light: THREE.PointLight;
  home: THREE.Vector3;
  hover: number;
};

/**
 * "Choose a Gift": three satin‑wrapped boxes floating in soft spotlights over dark velvet.
 * Hover lifts a box; choosing one plays the opening: the camera glides in, the bow unties,
 * the lid lifts away, warm light pours out with rising sparkles, the other two dim and sink.
 * Everything is procedural (no external models).
 */
export class GiftScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 100);
  private clock = new SceneClock();
  private boxes: Box[] = [];
  private raf = 0;
  private running = false;
  private disposables: { dispose(): void }[] = [];
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2(9, 9);
  private hovered = -1;
  private chosen = -1;
  private openedAt = -1;
  private sparkles!: THREE.Points;
  private sparkleU = { uTime: { value: 0 }, uBurst: { value: 0 }, uOrigin: { value: new THREE.Vector3() }, uPx: { value: 40 } };
  private dust!: THREE.Points;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private readonly still: boolean;
  onPick?: (i: number) => void;
  /** fired when the lid is off and the light has risen: time to show the message */
  onRevealed?: () => void;
  private revealedFired = false;
  private hits: THREE.Mesh[] = [];
  private beams: THREE.ShaderMaterial[] = [];
  private hitMat = new THREE.MeshBasicMaterial({ visible: false });

  constructor(private canvas: HTMLCanvasElement, opened: number | null) {
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.build();
    if (opened !== null && opened >= 0) {
      // already opened on an earlier visit: show it open, no replay
      this.chosen = opened;
      this.openedAt = -100;
      this.revealedFired = true;
    }
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('click', this.onClick);
    this.io = new IntersectionObserver(([e]) => (e.isIntersecting ? this.start() : this.stop()));
    this.io.observe(canvas);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    document.addEventListener('visibilitychange', this.onVis);
    this.resize();
    this.start();
  }

  private track<T extends { dispose(): void }>(x: T) {
    this.disposables.push(x);
    return x;
  }

  /* ------------------------------------------------------------------ build */
  private build() {
    const s = this.scene;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    s.environment = this.track(pmrem.fromScene(room, 0.04).texture);
    s.environmentIntensity = 0.55;
    room.dispose();
    pmrem.dispose();

    // velvet floor: a wide disc fading into the dark, catching soft pools of light
    const floorMat = this.track(
      new THREE.MeshStandardMaterial({ color: '#1a0f1c', roughness: 0.95, metalness: 0 }),
    );
    floorMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= smoothstep(9., 3., length(vW.xz));');
    };
    floorMat.transparent = true;
    const floor = new THREE.Mesh(this.track(new THREE.CircleGeometry(10, 64).rotateX(-Math.PI / 2)), floorMat);
    floor.receiveShadow = true;
    s.add(floor);

    s.add(new THREE.HemisphereLight('#6a4a7a', '#120812', 0.6));
    const key = new THREE.SpotLight('#ffe2c4', 90, 30, 0.55, 0.7, 1.6);
    key.position.set(-3, 9, 6);
    key.target.position.set(0, 0.6, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0005;
    key.shadow.radius = 4;
    s.add(key, key.target);
    const rim = new THREE.SpotLight('#ff9ec0', 45, 25, 0.7, 0.9, 1.8);
    rim.position.set(4, 5, -5);
    rim.target.position.set(0, 1, 0);
    s.add(rim, rim.target);

    const X = [-2.35, 0, 2.35];
    // each box on its own small stage: a velvet plinth with a rose‑gold rim
    const PH = 0.42;
    const plinthTop = this.track(new THREE.MeshPhysicalMaterial({ color: '#2a1224', roughness: 0.85, sheen: 1, sheenColor: new THREE.Color('#c0607e'), sheenRoughness: 0.5 }));
    const rimGold = this.track(new THREE.MeshPhysicalMaterial({ color: '#e8b48c', metalness: 1, roughness: 0.28, clearcoat: 0.5 }));
    X.forEach((x, i) => {
      const z = i === 1 ? -0.35 : 0;
      const plinth = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.98, 1.05, PH, 64)), plinthTop);
      plinth.position.set(x, PH / 2, z);
      plinth.castShadow = plinth.receiveShadow = true;
      const rim = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.985, 0.022, 12, 96).rotateX(Math.PI / 2)), rimGold);
      rim.position.set(x, PH, z);
      const foot = new THREE.Mesh(this.track(new THREE.TorusGeometry(1.05, 0.02, 12, 96).rotateX(Math.PI / 2)), rimGold);
      foot.position.set(x, 0.02, z);
      s.add(plinth, rim, foot);
    });
    WRAPS.forEach((w, i) => this.boxes.push(this.makeBox(w, i, new THREE.Vector3(X[i], PH, i === 1 ? -0.35 : 0))));

    // soft spotlight beams from above (additive cones)
    // one spotlight per box: they breathe while she decides, then the chosen one blazes and the others fade
    const beamMat = () =>
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          uniforms: { uTime: this.sparkleU.uTime, uA: { value: 1 } },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
          fragmentShader: `uniform float uTime, uA; varying vec2 vUv;
            void main(){ float a = pow(1. - vUv.y, 1.6) * .1 * uA * (.85 + .15 * sin(uTime * .7 + vUv.x * 12.)); a *= smoothstep(0., .2, vUv.x) * smoothstep(1., .8, vUv.x) + .5;
            gl_FragColor = vec4(vec3(1., .86, .7) * a, a); }`,
        }),
      );
    for (const b of this.boxes) {
      const m = beamMat();
      this.beams.push(m);
      const cone = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.35, 1.35, 7, 32, 1, true)), m);
      cone.position.set(b.home.x, 3.5 + 0.2, b.home.z);
      s.add(cone);
    }

    this.dust = this.makeDust();
    this.sparkles = this.makeSparkles();
    s.add(this.dust, this.sparkles);
  }

  private numeral(text: string, color: string) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `italic 600 150px ${SERIF}`;
    g.shadowColor = 'rgba(0,0,0,.35)';
    g.shadowBlur = 6;
    g.fillText(text, 128, 138);
    const t = this.track(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private makeBox(w: (typeof WRAPS)[number], i: number, home: THREE.Vector3): Box {
    const group = new THREE.Group();
    group.position.copy(home);
    group.rotation.y = (i - 1) * -0.28;
    this.scene.add(group);
    const satin = this.track(
      new THREE.MeshPhysicalMaterial({ color: w.wrap, roughness: 0.42, metalness: 0, sheen: 1, sheenColor: new THREE.Color(w.sheen), sheenRoughness: 0.35, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
    );
    const ribbonMat = this.track(new THREE.MeshPhysicalMaterial({ color: w.ribbon, roughness: 0.28, metalness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#fff2d6'), clearcoat: 0.8 }));
    const S = 1.25; // body size
    const body = new THREE.Mesh(this.track(new RoundedBoxGeometry(S, S * 0.92, S, 4, 0.06)), satin);
    body.position.y = (S * 0.92) / 2;
    body.castShadow = body.receiveShadow = true;
    group.add(body);
    // ribbons down the body (both axes)
    const band = (sx: number, sz: number, h: number) => new THREE.BoxGeometry(sx, h, sz);
    const ribbons = new THREE.Mesh(this.track(mergeGeometries([band(0.16, S + 0.02, S * 0.92 + 0.01), band(S + 0.02, 0.16, S * 0.92 + 0.01)])!), ribbonMat);
    ribbons.position.y = (S * 0.92) / 2;
    ribbons.castShadow = true;
    group.add(ribbons);
    // engraved numeral on the front
    const tag = new THREE.Mesh(this.track(new THREE.PlaneGeometry(0.42, 0.42)), this.track(new THREE.MeshStandardMaterial({ map: this.numeral(['I', 'II', 'III'][i], w.ribbon), transparent: true, roughness: 0.3, metalness: 0.6 })));
    tag.position.set(0.34, 0.36, S / 2 + 0.012);
    group.add(tag);

    // the lid (its own group so it can lift away), with ribbon and a bow
    const lid = new THREE.Group();
    lid.position.y = S * 0.92;
    group.add(lid);
    const lidMesh = new THREE.Mesh(this.track(new RoundedBoxGeometry(S + 0.1, 0.26, S + 0.1, 4, 0.05)), satin);
    lidMesh.position.y = 0.1;
    lidMesh.castShadow = lidMesh.receiveShadow = true;
    lid.add(lidMesh);
    const lidRibbon = new THREE.Mesh(this.track(mergeGeometries([band(0.17, S + 0.13, 0.27), band(S + 0.13, 0.17, 0.27)])!), ribbonMat);
    lidRibbon.position.y = 0.1;
    lid.add(lidRibbon);
    const bow = new THREE.Group();
    bow.position.y = 0.26;
    lid.add(bow);
    const loop = this.track(new THREE.TorusGeometry(0.2, 0.055, 14, 40));
    for (const sgn of [-1, 1]) {
      const l = new THREE.Mesh(loop, ribbonMat);
      l.scale.set(1.25, 0.8, 0.55);
      l.rotation.set(0.25, 0, sgn * 0.5);
      l.position.set(sgn * 0.21, 0.13, 0);
      l.castShadow = true;
      bow.add(l);
      const tail = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.1, 0.02, 0.42)), ribbonMat);
      tail.position.set(sgn * 0.1, 0.02, 0.2);
      tail.rotation.set(0.1, sgn * 0.45, 0);
      bow.add(tail);
    }
    const knot = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.085, 20, 14)), ribbonMat);
    knot.scale.set(1.2, 0.9, 1);
    knot.position.y = 0.1;
    bow.add(knot);

    // light inside: a glow disc at the opening, a rising beam and a warm point light
    const glowMat = this.track(new THREE.MeshBasicMaterial({ color: w.glow, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const glow = new THREE.Mesh(this.track(new THREE.PlaneGeometry(S * 0.95, S * 0.95).rotateX(-Math.PI / 2)), glowMat);
    glow.position.y = S * 0.92 + 0.005;
    group.add(glow);
    const beamMat = this.track(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uA: { value: 0 }, uTime: this.sparkleU.uTime, uColor: { value: new THREE.Color(w.glow) } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
        fragmentShader: `uniform float uA, uTime; uniform vec3 uColor; varying vec2 vUv;
          void main(){ float a = pow(vUv.y < 1. ? 1. - vUv.y : 0., 1.3) * uA; a *= .8 + .2 * sin(vUv.x * 30. + uTime * 3.); gl_FragColor = vec4(uColor * a * .9, a * .9); }`,
      }),
    );
    const beam = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.75, 0.55, 5, 32, 1, true)), beamMat);
    beam.position.y = S * 0.92 + 2.5;
    group.add(beam);
    const light = new THREE.PointLight(w.glow, 0, 6, 1.6);
    light.position.y = S * 0.92 + 0.4;
    group.add(light);
    // a generous, invisible tap target around the whole box (fingers are bigger than bows)
    const hit = new THREE.Mesh(this.track(new THREE.BoxGeometry(S * 1.55, S * 1.9, S * 1.55)), this.hitMat);
    hit.position.y = S * 0.8;
    hit.userData.box = i;
    group.add(hit);
    this.hits.push(hit);
    return { group, lid, bow, body, glow, beam, light, home, hover: 0 };
  }

  private makeDust() {
    const n = 260;
    const p = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      p.set([(Math.random() - 0.5) * 10, Math.random() * 5, (Math.random() - 0.5) * 6 - 0.5], i * 3);
      seed[i] = Math.random();
    }
    const g = this.track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = this.track(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: this.sparkleU,
        vertexShader: `attribute float aSeed; uniform float uTime, uPx; varying float vA;
          void main(){ vec3 q = position; q.y = mod(q.y + uTime * (.05 + aSeed * .08), 5.); q.x += sin(uTime * .3 + aSeed * 20.) * .2;
            vec4 mv = modelViewMatrix * vec4(q, 1.); gl_Position = projectionMatrix * mv;
            vA = (.35 + .65 * pow(.5 + .5 * sin(uTime * 1.5 + aSeed * 40.), 3.)) * smoothstep(0., .6, q.y) * smoothstep(5., 4., q.y);
            gl_PointSize = uPx * (.6 + aSeed) / -mv.z; }`,
        fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d) * vA * .5; gl_FragColor = vec4(vec3(1., .85, .6) * a, a); }`,
      }),
    );
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    return pts;
  }

  private makeSparkles() {
    const n = 420;
    const d = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.55;
      d.set([Math.cos(a) * r, Math.sin(a) * r, Math.random(), Math.random()], i * 4);
    }
    const g = this.track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aD', new THREE.BufferAttribute(d, 4));
    const m = this.track(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: this.sparkleU,
        vertexShader: `attribute vec4 aD; uniform float uTime, uBurst, uPx; uniform vec3 uOrigin; varying float vA; varying float vHue;
          void main(){ float t = fract(aD.z + uTime * (.12 + aD.w * .1));
            vec3 q = uOrigin + vec3(aD.x * (1. + t * 1.6), t * 4.2, aD.y * (1. + t * 1.6));
            q.x += sin(uTime * 2. + aD.w * 30.) * .08 * t;
            vec4 mv = modelViewMatrix * vec4(q, 1.); gl_Position = projectionMatrix * mv;
            vA = uBurst * sin(3.14159 * t) * (.55 + .45 * sin(uTime * 8. + aD.z * 50.)); vHue = aD.w;
            gl_PointSize = uPx * (1.2 + aD.w * 2.) / -mv.z; }`,
        fragmentShader: `varying float vA; varying float vHue; void main(){ vec2 c = gl_PointCoord - .5; float d = length(c);
            float star = smoothstep(.5, 0., d) * .6 + smoothstep(.06, 0., abs(c.x)) * smoothstep(.5, .0, abs(c.y)) * .5 + smoothstep(.06, 0., abs(c.y)) * smoothstep(.5, .0, abs(c.x)) * .5;
            float a = clamp(star * vA, 0., 1.); gl_FragColor = vec4(mix(vec3(1., .88, .6), vec3(1., .7, .8), vHue) * a, a); }`,
      }),
    );
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    return pts;
  }

  /* ------------------------------------------------------------------ input */
  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  private onLeave = () => this.ndc.set(9, 9);
  private onClick = (e: MouseEvent) => {
    this.onMove(e as PointerEvent);
    const i = this.pick();
    if (i >= 0) this.choose(i);
  };
  private onVis = () => (document.hidden ? this.stop() : this.start());

  private pick() {
    if (Math.abs(this.ndc.x) > 1.5) return -1;
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.ray.intersectObjects(this.hits, false)[0];
    return hit ? (hit.object.userData.box as number) : -1;
  }

  /** Open box i (only once; later calls are ignored). */
  choose(i: number) {
    if (this.chosen >= 0 || i < 0 || i > 2) return;
    this.chosen = i;
    this.openedAt = this.clock.getElapsedTime();
    this.canvas.style.cursor = '';
    this.onPick?.(i);
  }

  /* ------------------------------------------------------------------ run */
  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 52 : 34;
    this.camera.updateProjectionMatrix();
    this.sparkleU.uPx.value = 40 * this.renderer.getPixelRatio() * (h / 600);
    if (!this.running) this.frame();
  }
  private frozen = false;
  private unfreeze = freezeOnLeave(() => {
    this.frozen = true;
    this.stop();
  });

  private start() {
    if (this.frozen) return;
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.frame();
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }
  private stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private frame() {
    const t = this.clock.getElapsedTime();
    this.sparkleU.uTime.value = this.still ? 0 : t;
    const ease = (a: number, b: number, x: number) => {
      const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return k * k * (3 - 2 * k);
    };
    const o = this.chosen < 0 ? -1 : this.still ? 99 : t - this.openedAt; // seconds into the opening

    // hover (before a choice)
    const h = this.chosen < 0 && this.running ? this.pick() : -1;
    if (h !== this.hovered) {
      this.hovered = h;
      this.canvas.style.cursor = h >= 0 ? 'pointer' : '';
    }

    const portrait = this.camera.aspect < 1;
    const wide = new THREE.Vector3(0, portrait ? 3.1 : 2.7, portrait ? 9.8 : 9.2);
    const look = new THREE.Vector3(0, 0.9, 0);
    this.boxes.forEach((b, i) => {
      b.hover += ((h === i ? 1 : 0) - b.hover) * 0.12;
      const mine = i === this.chosen;
      const beam = this.beams[i];
      if (beam) {
        const want = this.chosen < 0 ? 1 + b.hover * 0.8 + (this.still ? 0 : Math.sin(t * 0.9 + i * 2) * 0.12) : mine ? 2.2 : 0.2;
        beam.uniforms.uA.value += (want - beam.uniforms.uA.value) * 0.06;
      }
      const float = this.still ? 0 : Math.sin(t * 1.1 + i * 2.1) * 0.06;
      const sink = this.chosen >= 0 && !mine ? ease(0, 1.4, o) : 0;
      b.group.position.set(b.home.x, b.home.y + float + b.hover * 0.22 - sink * 0.35, b.home.z);
      b.group.rotation.y = (i - 1) * -0.28 + (this.still ? 0 : Math.sin(t * 0.5 + i) * 0.05) + (mine ? ease(0.2, 1.4, o) * (i - 1) * 0.28 : 0);
      b.group.scale.setScalar(1 - sink * 0.12);
      // the two not chosen dim as they sink
      (b.body.material as THREE.MeshPhysicalMaterial).envMapIntensity = 1 - sink * 0.7;
      if (mine) {
        // the bow unties, the lid lifts and drifts away, light pours out
        const untie = ease(0.5, 1.2, o);
        b.bow.scale.setScalar(Math.max(0.001, 1 - untie));
        b.bow.rotation.y = untie * 2.4;
        const lift = ease(1.1, 2.4, o);
        b.lid.position.set(-lift * 0.9, 1.25 * 0.92 + lift * 2.2, -lift * 0.8);
        b.lid.rotation.set(-lift * 0.9, lift * 0.6, lift * 0.5);
        const light = ease(1.4, 2.6, o);
        (b.glow.material as THREE.MeshBasicMaterial).opacity = light * 0.9;
        (b.beam.material as THREE.ShaderMaterial).uniforms.uA.value = light * (0.85 + (this.still ? 0 : Math.sin(t * 2) * 0.1));
        b.light.intensity = light * 14;
        b.group.getWorldPosition(this.sparkleU.uOrigin.value);
        this.sparkleU.uOrigin.value.y += 1.2;
        this.sparkleU.uBurst.value = light;
        // the camera glides in toward the open box
        const glide = ease(0.1, 2.2, o);
        wide.lerp(new THREE.Vector3(b.home.x * 0.55, portrait ? 3.2 : 2.9, portrait ? 7.6 : 6.4), glide);
        look.lerp(new THREE.Vector3(b.home.x * 0.8, 1.6, b.home.z), glide);
        if (o > 2.6 && !this.revealedFired) {
          this.revealedFired = true;
          this.onRevealed?.();
        }
      }
    });
    if (!this.still) wide.x += Math.sin(t * 0.25) * 0.25;
    this.camera.position.copy(wide);
    this.camera.lookAt(look);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.unfreeze();
    this.stop();
    this.io.disconnect();
    this.ro.disconnect();
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('click', this.onClick);
    document.removeEventListener('visibilitychange', this.onVis);
    this.disposables.forEach((d) => d.dispose());
    this.hitMat.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

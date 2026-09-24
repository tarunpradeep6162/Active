import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * "Someday": an original, fully procedural manor at golden hour for the Future Universe
 * chapter. A cream neoclassical villa (a central block with projecting corner bays, two
 * low side wings, arched windows, cornices and balustraded balconies), an ivy arch over the
 * front door, flowering pink shrubs, two fruit trees, a sunlit path up a grassy rise, and a
 * soft sky with clouds. Everything is built here from primitives; no external models.
 *
 * It renders into its own canvas, only while on screen, and scales its detail to the device.
 */
export class ManorScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 400);
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private disposables: { dispose(): void }[] = [];
  private sways: { mesh: THREE.InstancedMesh; base: THREE.Matrix4[]; amp: number }[] = [];
  private pointer = new THREE.Vector2();
  private visible = true;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private readonly low: boolean;
  private readonly still: boolean;

  constructor(private canvas: HTMLCanvasElement) {
    this.low = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 4) <= 4;
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.low ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.build();
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      this.visible ? this.start() : this.stop();
    });
    this.io.observe(canvas);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    canvas.addEventListener('pointermove', this.onPointer);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.resize();
    this.start();
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
  };
  private onVisibility = () => (document.hidden ? this.stop() : this.visible && this.start());

  private track<T extends { dispose(): void }>(x: T) {
    this.disposables.push(x);
    return x;
  }

  /* ------------------------------------------------------------------ build */
  private build() {
    const s = this.scene;
    const rnd = mulberry(1125);

    // sky: a gradient dome, warm near the horizon, soft blue above, with a sun glow
    const skyMat = this.track(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: { uSun: { value: new THREE.Vector3(-0.35, 0.28, -1).normalize() } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
        fragmentShader: `
          uniform vec3 uSun; varying vec3 vDir;
          void main(){
            float h = clamp(vDir.y, -.1, 1.);
            vec3 top = vec3(.36, .55, .78), mid = vec3(.78, .84, .88), low = vec3(1., .88, .74);
            vec3 c = mix(low, mid, smoothstep(0., .22, h));
            c = mix(c, top, smoothstep(.2, .75, h));
            float sd = max(dot(normalize(vDir), uSun), 0.);
            c += vec3(1., .82, .6) * (pow(sd, 8.) * .45 + pow(sd, 90.) * 1.2);
            gl_FragColor = vec4(c, 1.);
            #include <colorspace_fragment>
          }`,
      }),
    );
    s.add(new THREE.Mesh(this.track(new THREE.SphereGeometry(200, 32, 16)), skyMat));
    s.fog = new THREE.Fog(new THREE.Color('#f3e2cf'), 40, 150);

    // clouds: soft puffs made of a few overlapping transparent spheres
    const cloudMat = this.track(new THREE.MeshBasicMaterial({ color: '#fff8ee', transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
    const puff = this.track(new THREE.SphereGeometry(1, 16, 10));
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Group();
      for (let k = 0; k < 6; k++) {
        const m = new THREE.Mesh(puff, cloudMat);
        m.position.set((k - 2.5) * 2.2 + rnd() * 1.5, rnd() * 1.2, rnd() * 1.5);
        m.scale.set(2.6 + rnd() * 1.8, 1.3 + rnd() * 0.8, 1.6);
        c.add(m);
      }
      c.position.set(-70 + i * 24 + rnd() * 8, 34 + rnd() * 16, -120 - rnd() * 30);
      c.scale.setScalar(1.4 + rnd());
      s.add(c);
    }

    // light: a low warm sun from the front‑left, sky/ground fill
    const sun = new THREE.DirectionalLight('#ffd6a4', 3.1);
    sun.position.set(-26, 16, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.low ? 1024 : 2048, this.low ? 1024 : 2048);
    const sc = sun.shadow.camera;
    sc.left = -30;
    sc.right = 30;
    sc.top = 20;
    sc.bottom = -12;
    sc.near = 1;
    sc.far = 80;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.03;
    s.add(sun, new THREE.HemisphereLight('#c4d8ef', '#8e9a5e', 0.75));

    this.buildGround(rnd);
    this.buildManor();
    this.buildGarden(rnd);

    this.camera.position.set(0, 3.2, 30);
    this.camera.lookAt(0, 6, 0);
  }

  private buildGround(rnd: () => number) {
    const s = this.scene;
    // a gentle rise toward the house, with a sandy path up the middle
    const g = this.track(new THREE.PlaneGeometry(160, 120, 120, 90));
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color('#7fa04a'), grass2 = new THREE.Color('#a7b85c'), sand = new THREE.Color('#e8d3b0');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      // flat terrace at the house, rising toward the camera then dipping away
      const rise = z > 4 ? Math.sin(Math.min(1, (z - 4) / 14) * Math.PI) * 1.1 - Math.max(0, z - 18) * 0.12 : 0;
      const hills = Math.max(0, Math.abs(x) - 16) * 0.12 * (z < 6 ? 1 : 0.4);
      pos.setY(i, rise + hills + (rnd() - 0.5) * 0.04);
      const path = Math.abs(x + Math.sin(z * 0.08) * 0.6) < 1.9 - Math.max(0, z - 6) * -0.03 && z > 2.6;
      c.copy(grass).lerp(grass2, rnd() * 0.5 + (hills > 0 ? 0.3 : 0));
      if (path) c.copy(sand).offsetHSL(0, 0, (rnd() - 0.5) * 0.03);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, this.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
    m.receiveShadow = true;
    s.add(m);
  }

  private buildManor() {
    const s = this.scene;
    const stucco = this.track(new THREE.MeshStandardMaterial({ color: '#f1e6d6', roughness: 0.88 }));
    const trim = this.track(new THREE.MeshStandardMaterial({ color: '#fbf5ec', roughness: 0.75 }));
    const shade = this.track(new THREE.MeshStandardMaterial({ color: '#e2d3c0', roughness: 0.9 }));
    const glass = this.track(new THREE.MeshStandardMaterial({ color: '#4a5566', roughness: 0.18, metalness: 0.35 }));
    const dark = this.track(new THREE.MeshStandardMaterial({ color: '#2b2522', roughness: 0.8 }));
    const terracotta = this.track(new THREE.MeshStandardMaterial({ color: '#c98f6e', roughness: 0.85 }));
    const house = new THREE.Group();
    s.add(house);
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(this.track(new THREE.BoxGeometry(w, h, d)), mat);
      m.position.set(x, y + h / 2, z);
      m.castShadow = m.receiveShadow = true;
      house.add(m);
      return m;
    };

    // masses: central block, two projecting corner bays, two low side wings
    box(12, 10.2, 7, 0, 0, -1, stucco);
    for (const sx of [-1, 1]) {
      box(4.2, 11, 7.6, sx * 7.6, 0, -0.7, stucco);
      box(6, 4.6, 6.2, sx * 12.4, 0, -1.4, shade);
      // wing roof parapet
      box(6.3, 0.35, 6.5, sx * 12.4, 4.6, -1.4, trim);
    }
    // cornices and string courses
    box(20, 0.45, 8.3, 0, 10.2, -0.9, trim);
    for (const sx of [-1, 1]) box(4.8, 0.55, 8.4, sx * 7.6, 11, -0.7, trim);
    box(11, 0.6, 7.4, 0, 10.65, -1, trim);
    box(20.2, 0.3, 8.2, 0, 3.9, -0.9, trim);
    box(20.2, 0.25, 8.2, 0, 7.2, -0.9, trim);
    box(21, 0.5, 9, 0, 0, -0.9, shade); // plinth
    // pilasters between the bays
    for (const x of [-5.3, -2, 2, 5.3]) box(0.45, 10.2, 0.25, x, 0, 2.55, trim);

    // arched windows (glass inset + frame), instanced across the facade
    const arch = (w: number, h: number) => {
      const sh = new THREE.Shape();
      sh.moveTo(-w / 2, 0);
      sh.lineTo(w / 2, 0);
      sh.lineTo(w / 2, h - w / 2);
      sh.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
      sh.lineTo(-w / 2, 0);
      return sh;
    };
    const winGlass = this.track(new THREE.ShapeGeometry(arch(1.3, 2.3), 12));
    const frameShape = arch(1.6, 2.6);
    frameShape.holes.push(new THREE.Path(arch(1.3, 2.3).getPoints(24).map((p) => new THREE.Vector2(p.x, p.y + 0.12))));
    const winFrame = this.track(new THREE.ExtrudeGeometry(frameShape, { depth: 0.18, bevelEnabled: false, curveSegments: 12 }));
    // mullions: a cross in each window
    const mull = this.track(mergeGeometries([new THREE.BoxGeometry(0.07, 2.2, 0.06).translate(0, 1.2, 0), new THREE.BoxGeometry(1.3, 0.07, 0.06).translate(0, 1.45, 0)])!);
    const spots: [number, number, number][] = [];
    for (const y of [0.9, 4.5, 7.8]) {
      for (const x of [-3.6, -1.1, 1.1, 3.6]) if (!(y < 1 && Math.abs(x) < 2)) spots.push([x, y, 2.52]);
      for (const sx of [-1, 1]) spots.push([sx * 7.6, y, 3.12]);
    }
    for (const sx of [-1, 1]) for (const x of [-1.6, 1.6]) spots.push([sx * 12.4 + x, 0.9, 1.72]);
    const place = (geo: THREE.BufferGeometry, mat: THREE.Material, dz: number) => {
      const im = new THREE.InstancedMesh(geo, mat, spots.length);
      spots.forEach(([x, y, z], i) => im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z + dz)));
      im.castShadow = true;
      im.receiveShadow = true;
      house.add(im);
    };
    place(winGlass, glass, 0.01);
    place(winFrame, trim, -0.02);
    place(mull, trim, 0.05);
    // keystones and sills
    const sill = this.track(new THREE.BoxGeometry(1.9, 0.14, 0.4));
    const sills = new THREE.InstancedMesh(sill, trim, spots.length);
    spots.forEach(([x, y, z], i) => sills.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y - 0.07, z + 0.18)));
    sills.castShadow = true;
    house.add(sills);

    // balconies with balustrades: first floor across the centre, small ones on the corner bays
    const baluster = this.track(
      new THREE.LatheGeometry(
        [
          [0.09, 0],
          [0.09, 0.08],
          [0.05, 0.14],
          [0.1, 0.36],
          [0.05, 0.56],
          [0.08, 0.64],
          [0.08, 0.7],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        10,
      ),
    );
    const rails: { x0: number; x1: number; y: number; z: number }[] = [
      { x0: -5.2, x1: 5.2, y: 4.05, z: 3.5 },
      { x0: -9.5, x1: -5.7, y: 4.05, z: 3.95 },
      { x0: 5.7, x1: 9.5, y: 4.05, z: 3.95 },
      { x0: -8.7, x1: -6.5, y: 7.35, z: 3.6 },
      { x0: 6.5, x1: 8.7, y: 7.35, z: 3.6 },
      { x0: -15.2, x1: -9.6, y: 4.95, z: 1.8 },
      { x0: 9.6, x1: 15.2, y: 4.95, z: 1.8 },
    ];
    const bal: THREE.Matrix4[] = [];
    for (const r of rails) {
      const n = Math.round((r.x1 - r.x0) / 0.28);
      for (let i = 0; i <= n; i++) bal.push(new THREE.Matrix4().makeTranslation(r.x0 + ((r.x1 - r.x0) * i) / n, r.y + 0.12, r.z));
      box(r.x1 - r.x0 + 0.3, 0.14, 0.4, (r.x0 + r.x1) / 2, r.y + 0.82, r.z, trim);
      box(r.x1 - r.x0 + 0.3, 0.12, 0.42, (r.x0 + r.x1) / 2, r.y, r.z, trim);
      if (r.y < 5 && r.z > 3) box(r.x1 - r.x0 + 0.4, 0.25, r.z - 2.4, (r.x0 + r.x1) / 2, r.y - 0.25, (r.z + 2.4) / 2 + 0.2, trim); // slab
    }
    const bals = new THREE.InstancedMesh(baluster, trim, bal.length);
    bal.forEach((m, i) => bals.setMatrixAt(i, m));
    bals.castShadow = true;
    house.add(bals);
    // porch columns under the centre balcony
    const col = this.track(new THREE.CylinderGeometry(0.26, 0.3, 3.8, 18));
    for (const x of [-4.8, -2.4, 2.4, 4.8]) {
      const m = new THREE.Mesh(col, trim);
      m.position.set(x, 1.95, 3.25);
      m.castShadow = true;
      house.add(m);
    }

    // entrance: a dark door, steps, gate posts and low rails
    box(2.2, 2.9, 0.2, 0, 0.5, 2.58, dark);
    for (let i = 0; i < 5; i++) box(4.4 - i * 0.2, 0.12, 0.5, 0, i * 0.12, 3.9 - i * 0.28, trim);
    for (const sx of [-1, 1]) {
      box(1, 1.7, 1, sx * 5.8, 0, 6.2, terracotta);
      box(1.15, 0.14, 1.15, sx * 5.8, 1.7, 6.2, trim);
      box(3.4, 0.06, 0.06, sx * 3.9, 1.1, 6.2, dark);
      box(3.4, 0.06, 0.06, sx * 3.9, 0.55, 6.2, dark);
    }
  }

  /** instanced leaf clusters (bushes, tree crowns, the ivy arch) with a gentle wind sway */
  private leaves(points: THREE.Vector3[], size: [number, number], colors: string[], amp: number, rnd: () => number) {
    const geo = this.track(new THREE.IcosahedronGeometry(1, 0));
    const mat = this.track(new THREE.MeshStandardMaterial({ roughness: 0.85 }));
    const im = new THREE.InstancedMesh(geo, mat, points.length);
    const pal = colors.map((c) => new THREE.Color(c));
    const c = new THREE.Color();
    const base: THREE.Matrix4[] = [];
    points.forEach((p, i) => {
      const k = size[0] + rnd() * (size[1] - size[0]);
      const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6)), new THREE.Vector3(k, k * 0.7, k));
      base.push(m);
      im.setMatrixAt(i, m);
      c.copy(pal[(rnd() * pal.length) | 0]).offsetHSL(0, 0, (rnd() - 0.5) * 0.08);
      im.setColorAt(i, c);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    this.scene.add(im);
    if (amp > 0 && !this.still) this.sways.push({ mesh: im, base, amp });
    return im;
  }

  private buildGarden(rnd: () => number) {
    const q = this.low ? 0.55 : 1;
    // flowering shrubs flanking the path, and along the house
    const blossom: THREE.Vector3[] = [];
    const bushCore = this.track(new THREE.MeshStandardMaterial({ color: '#9c5a6c', roughness: 0.95 }));
    const coreGeo = this.track(new THREE.SphereGeometry(1, 20, 14));
    const bush = (cx: number, cz: number, r: number, h: number, n: number) => {
      // a solid core so the blossom reads as a full shrub, not a cloud of petals
      const core = new THREE.Mesh(coreGeo, bushCore);
      core.position.set(cx, h * 0.36, cz);
      core.scale.set(r * 0.66, h * 0.4, r * 0.54);
      core.castShadow = core.receiveShadow = true;
      this.scene.add(core);
      for (let i = 0; i < n * q; i++) {
        const a = rnd() * Math.PI * 2, u = Math.pow(rnd(), 0.28); // mostly on the surface
        const y = rnd() * h;
        const rr = r * u * (1 - (y / h) * 0.45);
        blossom.push(new THREE.Vector3(cx + Math.cos(a) * rr, y + 0.2, cz + Math.sin(a) * rr * 0.8));
      }
    };
    bush(-9.5, 13, 4.4, 4.4, 2300);
    bush(10, 13, 4.4, 4.4, 2300);
    bush(-15.5, 8.5, 3.6, 3.4, 1300);
    bush(16, 8.5, 3.6, 3.4, 1300);
    bush(-4.6, 4.6, 1.2, 1.6, 420);
    bush(4.6, 4.6, 1.2, 1.6, 420);
    this.leaves(blossom, [0.09, 0.17], ['#e6a8b8', '#d98b9d', '#f2c1cb', '#c97a90', '#f6d0d8'], 0.02, rnd);

    // the ivy arch over the steps (a leafy torus half, then leaves over it)
    const archCore = new THREE.Mesh(this.track(new THREE.TorusGeometry(2.75, 0.32, 12, 40, Math.PI)), this.track(new THREE.MeshStandardMaterial({ color: '#4d7331', roughness: 0.95 })));
    archCore.position.set(0, 1.1, 4.7);
    archCore.scale.set(1, 1.12, 1.4);
    archCore.castShadow = true;
    this.scene.add(archCore);
    const ivy: THREE.Vector3[] = [];
    for (let i = 0; i < 2200 * q; i++) {
      const t = rnd() * Math.PI;
      const R = 2.75 + (rnd() - 0.5) * 0.55;
      ivy.push(new THREE.Vector3(Math.cos(t) * R, Math.sin(t) * R * 1.12 + 1.1 + (rnd() - 0.5) * 0.2, 4.7 + (rnd() - 0.5) * 0.8));
      if (rnd() < 0.18) ivy.push(new THREE.Vector3((rnd() < 0.5 ? -1 : 1) * (2.75 + (rnd() - 0.5) * 0.4), rnd() * 1.2, 4.7 + (rnd() - 0.5) * 0.8));
    }
    this.leaves(ivy, [0.07, 0.13], ['#5f8a3a', '#7aa24a', '#4c7432', '#8fb45a'], 0.01, rnd);

    // two fruit trees framing the view
    const bark = this.track(new THREE.MeshStandardMaterial({ color: '#6b5646', roughness: 0.95 }));
    const fruitMat = this.track(new THREE.MeshStandardMaterial({ color: '#f0a33c', roughness: 0.5, emissive: '#6a3a10', emissiveIntensity: 0.25 }));
    const fruitGeo = this.track(new THREE.SphereGeometry(0.2, 10, 8));
    for (const [tx, tz, lean] of [
      [-19, 6, 0.25],
      [19.5, 2, -0.2],
    ] as const) {
      const trunkCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(tx, 0, tz), new THREE.Vector3(tx + lean * 3, 4, tz), new THREE.Vector3(tx + lean * 7, 8.5, tz - 1)]);
      const trunk = new THREE.Mesh(this.track(new THREE.TubeGeometry(trunkCurve, 16, 0.55, 10)), bark);
      trunk.castShadow = true;
      this.scene.add(trunk);
      const crown: THREE.Vector3[] = [];
      const cx = tx + lean * 7, cy = 11;
      const crownCore = new THREE.Mesh(this.track(new THREE.SphereGeometry(1, 24, 16)), this.track(new THREE.MeshStandardMaterial({ color: '#4f7430', roughness: 0.95 })));
      crownCore.position.set(cx, cy, tz - 1);
      crownCore.scale.set(5.3, 2.9, 3.8);
      crownCore.castShadow = crownCore.receiveShadow = true;
      this.scene.add(crownCore);
      for (let i = 0; i < 3600 * q; i++) {
        const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(0.72 + Math.pow(rnd(), 0.5) * 0.3);
        crown.push(new THREE.Vector3(cx + v.x * 7, cy + v.y * 3.8, tz - 1 + v.z * 5));
      }
      this.leaves(crown, [0.12, 0.22], ['#6f9a44', '#88b057', '#5b8436', '#a2c06a'], 0.035, rnd);
      const fruits = new THREE.InstancedMesh(fruitGeo, fruitMat, 26);
      for (let i = 0; i < 26; i++) {
        const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
        fruits.setMatrixAt(i, new THREE.Matrix4().makeTranslation(cx + v.x * 6.6, cy + v.y * 3.4, tz - 1 + Math.abs(v.z) * 4.6));
      }
      this.scene.add(fruits);
    }
  }

  /* ------------------------------------------------------------------ run */
  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the whole facade in frame on narrow screens
    this.camera.fov = w / h < 1.2 ? 52 : 34;
    this.camera.updateProjectionMatrix();
    if (!this.running) this.frame();
  }

  private start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
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
    const t = this.clock.elapsedTime + (this.running ? this.clock.getDelta() : 0);
    // a slow walk up the path toward the door, then a gentle hold; the pointer looks around
    const k = this.still ? 1 : 1 - Math.exp(-t * 0.09);
    const z = 50 - k * 12;
    this.camera.position.set(Math.sin(t * 0.12) * 0.6 - this.pointer.x * 1.2, 2.4 + k * 0.5 + this.pointer.y * 0.4, z);
    this.camera.lookAt(this.pointer.x * 1.5, 5.6 - k * 0.2, 0);
    if (this.sways.length) {
      const tmp = new THREE.Matrix4();
      for (const s of this.sways) {
        const n = s.base.length;
        // only a sixth of the leaves per frame: the eye reads it as wind, the CPU barely notices
        const off = Math.floor((t * 60) % 6);
        for (let i = off; i < n; i += 6) {
          const b = s.base[i];
          const e = b.elements;
          const w = Math.sin(t * 1.3 + e[12] * 0.4 + e[13] * 0.6) * s.amp;
          tmp.copy(b);
          tmp.elements[12] += w;
          tmp.elements[14] += w * 0.5;
          s.mesh.setMatrixAt(i, tmp);
        }
        s.mesh.instanceMatrix.needsUpdate = true;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    this.io.disconnect();
    this.ro.disconnect();
    this.canvas.removeEventListener('pointermove', this.onPointer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.scene.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
    });
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

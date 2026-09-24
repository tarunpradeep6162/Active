import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const BASE = '/manor/';
type Model = { geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial; height: number };
type Item = { p: THREE.Vector3; s: number; r: number };

/**
 * "Someday": a photographic manor at golden hour for the Future Universe chapter.
 *
 * An original neoclassical villa of our own design (central block, projecting corner bays,
 * low wings, arched windows with deep reveals, classical cornices, balustraded balconies, a
 * porch of columns), dressed with real‑world CC0 assets from Poly Haven (public domain):
 * photoscanned plaster, grass and gravel materials, a captured partly‑cloudy sky for
 * image‑based lighting and reflections, and scanned shrubs (tinted to blossom, and grown into
 * an ivy arch). Rendered physically (ACES, PBR, soft shadows) with ground‑truth ambient
 * occlusion and a touch of bloom. It renders only while on screen.
 */
export class ManorScene {
  private renderer: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 600);
  private clock = new THREE.Clock();
  private raf = 0;
  private running = false;
  private ready = false;
  private disposed = false;
  private disposables: { dispose(): void }[] = [];
  private pointer = new THREE.Vector2();
  private visible = true;
  private io: IntersectionObserver;
  private ro: ResizeObserver;
  private low: boolean;
  private aoPass: GTAOPass | null = null;
  /** adaptive quality: frame timing after load, and render every Nth frame on slow devices */
  private samples: number[] = [];
  private lastNow = 0;
  private every = 1;
  private tick = 0;
  private readonly still: boolean;
  private tex = new THREE.TextureLoader();
  private windUniform = { value: 0 };
  onReady?: () => void;

  constructor(private canvas: HTMLCanvasElement) {
    this.low = matchMedia('(pointer: coarse)').matches || (navigator.hardwareConcurrency || 4) <= 4;
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    // software rendering (no GPU) gets the light path straight away
    const gl = this.renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg && /swiftshader|llvmpipe|software|basic render/i.test(String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)))) this.low = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.low ? 1 : 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      this.visible ? this.start() : this.stop();
    });
    this.io.observe(canvas);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    canvas.addEventListener('pointermove', this.onPointer);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.build()
      .then(() => {
        if (this.disposed) return;
        this.ready = true;
        this.resize();
        this.start();
        this.onReady?.();
      })
      .catch((e) => console.warn('manor:', e));
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

  /** A PBR material from a Poly Haven texture set (diffuse, normal, AO/rough/metal packed). */
  private pbr(name: string, repeat: number, opts: THREE.MeshStandardMaterialParameters = {}) {
    const load = (m: string, srgb: boolean) => {
      const t = this.track(this.tex.load(`${BASE}${name}_${m}.webp`));
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      t.anisotropy = 8;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      return t;
    };
    const arm = load('arm', false);
    return this.track(
      new THREE.MeshStandardMaterial({
        map: load('diff', true),
        normalMap: load('nor', false),
        aoMap: arm,
        roughnessMap: arm,
        metalnessMap: arm,
        metalness: 1,
        ...opts,
      }),
    );
  }

  /* ------------------------------------------------------------------ build */
  private async build() {
    const s = this.scene;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const [hdr, sky, shrubB, shrubC] = await Promise.all([
      new HDRLoader().loadAsync(`${BASE}sky_1k.hdr`),
      this.tex.loadAsync(`${BASE}sky_2k.jpg`),
      this.loadModel('shrub_02'),
      this.loadModel('shrub_04'),
    ]);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const env = this.track(pmrem.fromEquirectangular(hdr).texture);
    hdr.dispose();
    pmrem.dispose();
    s.environment = env;
    s.environmentIntensity = 0.85;
    sky.mapping = THREE.EquirectangularReflectionMapping;
    sky.colorSpace = THREE.SRGBColorSpace;
    s.background = this.track(sky);
    s.backgroundRotation.set(0, Math.PI * 0.62, 0);
    s.environmentRotation.set(0, Math.PI * 0.62, 0);
    s.fog = new THREE.Fog(new THREE.Color('#e9e2d6'), 70, 260);

    // warm late‑afternoon sun from the front left, soft shadows
    const sun = new THREE.DirectionalLight('#ffe6c6', 4.4);
    sun.position.set(-30, 26, 34);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.low ? 1024 : 2048, this.low ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 24, bottom: -14, near: 1, far: 120 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    sun.shadow.radius = 3;
    s.add(sun);

    this.buildGround();
    this.buildManor();
    this.buildPlanting(shrubB, shrubC);

    // post: ground‑truth AO grounds everything; a whisper of bloom on the sunlit plaster
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(s, this.camera));
    if (!this.low) {
      const ao = new GTAOPass(s, this.camera, 16, 9);
      ao.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.6, thickness: 1.2, scale: 1.1, samples: 12 });
      ao.blendIntensity = 0.6;
      this.composer.addPass(ao);
      this.aoPass = ao;
    }
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.18, 0.6, 0.92));
    this.composer.addPass(new OutputPass());
  }

  private async loadModel(name: string): Promise<Model> {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const g = await loader.loadAsync(`${BASE}${name}.glb`);
    let found: THREE.Mesh | null = null;
    g.scene.traverse((o) => {
      if (!found && (o as THREE.Mesh).isMesh) found = o as THREE.Mesh;
    });
    if (!found) throw new Error(`no mesh in ${name}`);
    const m = found as THREE.Mesh;
    m.updateWorldMatrix(true, false);
    // meshopt/quantized attributes are normalized integers: expand to floats before transforming
    const src = m.geometry;
    const geo = this.track(new THREE.BufferGeometry());
    for (const name of ['position', 'normal', 'uv'] as const) {
      const a = src.getAttribute(name) as THREE.BufferAttribute | undefined;
      if (!a) continue;
      const out = new Float32Array(a.count * a.itemSize);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
      geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
    }
    if (src.index) geo.setIndex(src.index.clone());
    geo.applyMatrix4(m.matrixWorld);
    geo.computeBoundingBox();
    const bb = geo.boundingBox!;
    // stand it on the ground, centred
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
    geo.computeBoundingBox();
    return { geo, mat: m.material as THREE.MeshStandardMaterial, height: geo.boundingBox!.max.y };
  }

  /** Planar (world‑space) UVs so plaster tiles at a real scale on every surface. */
  private worldUV<G extends THREE.BufferGeometry>(geo: G, scale = 0.35): G {
    const p = geo.attributes.position as THREE.BufferAttribute;
    const n = geo.attributes.normal as THREE.BufferAttribute;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const [u, v] = ax > ay && ax > az ? [z, y] : ay > az ? [x, z] : [x, y];
      uv[i * 2] = u * scale;
      uv[i * 2 + 1] = v * scale;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geo;
  }

  private groundY(z: number) {
    return z > 7 ? Math.sin(Math.min(1, (z - 7) / 16) * Math.PI) * 1.2 - Math.max(0, z - 23) * 0.1 : 0;
  }

  private buildGround() {
    const s = this.scene;
    // terrace at the house, a gentle rise toward the camera, soft hills at the sides
    const g = this.track(new THREE.PlaneGeometry(240, 200, 160, 140));
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const hills = Math.max(0, Math.abs(x) - 22) * 0.16 * (z < 8 ? 1 : 0.4) + Math.max(0, -z - 30) * 0.12;
      pos.setY(i, this.groundY(z) + hills);
    }
    g.computeVertexNormals();
    const ground = new THREE.Mesh(g, this.pbr('leafy_grass', 60, { color: '#cfe58a', metalness: 0 }));
    ground.receiveShadow = true;
    s.add(ground);

    // a gravel path up to the steps, following the ground, with feathered edges
    const pathW = 3.6, z0 = 5.6, z1 = 60;
    const pg = this.track(new THREE.PlaneGeometry(pathW, z1 - z0, 8, 80));
    pg.rotateX(-Math.PI / 2);
    pg.translate(0, 0, (z0 + z1) / 2);
    const pp = pg.attributes.position as THREE.BufferAttribute;
    const edge = new Float32Array(pp.count);
    for (let i = 0; i < pp.count; i++) {
      const x = pp.getX(i), z = pp.getZ(i);
      const widen = 1 + Math.max(0, z - 20) * 0.03;
      pp.setX(i, x * widen + Math.sin(z * 0.07) * 0.4);
      pp.setY(i, this.groundY(z) + 0.03);
      edge[i] = 1 - Math.pow(Math.abs(x) / (pathW / 2), 6);
    }
    pg.setAttribute('aEdge', new THREE.BufferAttribute(edge, 1));
    pg.computeVertexNormals();
    const gravel = this.pbr('gravel_floor', 1, { color: '#efe3cf', metalness: 0, transparent: true });
    for (const k of ['map', 'normalMap', 'aoMap', 'roughnessMap', 'metalnessMap'] as const) gravel[k]?.repeat.set(1.2, 16);
    gravel.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aEdge; varying float vEdge;').replace('#include <uv_vertex>', '#include <uv_vertex>\nvEdge = aEdge;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vEdge;').replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= smoothstep(0., .5, vEdge);');
    };
    const path = new THREE.Mesh(pg, gravel);
    path.receiveShadow = true;
    s.add(path);
  }

  private buildManor() {
    const house = new THREE.Group();
    this.scene.add(house);
    // clean, freshly painted plaster (the scan's grain and relief, a warm cream finish)
    const plaster = this.pbr('painted_plaster_wall', 1, { color: '#fff4e4', metalness: 0, roughness: 0.92 });
    const trimMat = this.pbr('plastered_wall_02', 1, { color: '#ffffff', metalness: 0, roughness: 0.75 });
    trimMat.aoMapIntensity = 0.3;
    const glass = this.track(new THREE.MeshPhysicalMaterial({ color: '#2d3440', metalness: 0, roughness: 0.06, envMapIntensity: 1.3, clearcoat: 1, clearcoatRoughness: 0.05 }));
    const interior = this.track(new THREE.MeshStandardMaterial({ color: '#1c1b1d', roughness: 1 }));
    const doorMat = this.track(new THREE.MeshStandardMaterial({ color: '#2a211d', roughness: 0.55 }));
    const brick = this.track(new THREE.MeshStandardMaterial({ color: '#c99474', roughness: 0.9 }));
    const iron = this.track(new THREE.MeshStandardMaterial({ color: '#1e1c1b', roughness: 0.45, metalness: 0.8 }));

    const add = (geo: THREE.BufferGeometry, mat: THREE.Material, uv = true) => {
      const m = new THREE.Mesh(uv ? this.worldUV(geo) : geo, mat);
      m.castShadow = m.receiveShadow = true;
      house.add(m);
      return m;
    };
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material = plaster) => add(this.track(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z)), mat);

    // a classical cornice profile (fillets, corona and a cyma curve), run along x
    const profile = new THREE.Shape();
    profile.moveTo(0, 0);
    profile.lineTo(0.12, 0);
    profile.lineTo(0.12, 0.06);
    profile.lineTo(0.18, 0.08);
    profile.lineTo(0.2, 0.14);
    profile.lineTo(0.28, 0.16);
    profile.lineTo(0.3, 0.3);
    profile.bezierCurveTo(0.4, 0.3, 0.38, 0.31, 0.44, 0.33);
    profile.lineTo(0.46, 0.4);
    profile.lineTo(0.62, 0.44);
    profile.lineTo(0.64, 0.5);
    profile.lineTo(0, 0.5);
    profile.lineTo(0, 0);
    const moulding = (len: number, scale: number, x: number, y: number, z: number) => {
      const g = new THREE.ExtrudeGeometry(profile, { depth: len, bevelEnabled: false, curveSegments: 8 });
      g.rotateY(-Math.PI / 2);
      g.scale(1, scale, scale);
      g.translate(x + len / 2, y, z);
      add(this.track(g), trimMat);
    };

    // ── masses
    const FRONT = 3.2; // z of the central facade
    box(13, 11, 8, 0, 0, FRONT - 4);
    for (const sx of [-1, 1]) {
      box(4.6, 12, 8.8, sx * 8.8, 0, FRONT - 3.6); // corner bays project 0.8
      box(7, 5, 7, sx * 14.3, 0, FRONT - 5.3);
      box(7.3, 0.4, 7.3, sx * 14.3, 5, FRONT - 5.3, trimMat);
      box(4.9, 0.35, 9.1, sx * 8.8, 12, FRONT - 3.6, trimMat);
    }
    box(23, 0.6, 9.8, 0, -0.3, FRONT - 4.1, trimMat); // plinth
    // cornices: over the central block, the bays and the wings
    moulding(13.4, 1.4, 0, 11, FRONT);
    for (const sx of [-1, 1]) moulding(5, 1.5, sx * 8.8, 12.1, FRONT + 0.8);
    for (const sx of [-1, 1]) moulding(7.4, 0.9, sx * 14.3, 5.05, FRONT - 1.8);
    // string courses between floors
    for (const y of [4.3, 7.8]) {
      box(13.1, 0.22, 0.2, 0, y, FRONT + 0.1, trimMat);
      for (const sx of [-1, 1]) box(4.7, 0.22, 0.2, sx * 8.8, y, FRONT + 0.9, trimMat);
    }
    // quoins (rusticated corners) on the bays
    for (const sx of [-1, 1]) for (const cx of [-2.3, 2.3]) for (let i = 0; i < 18; i++) box(0.5 + (i % 2) * 0.25, 0.5, 0.12, sx * 8.8 + cx - Math.sign(cx) * (0.25 + (i % 2) * 0.12), 0.3 + i * 0.64, FRONT + 0.86, trimMat);

    // ── arched windows with deep reveals, frames, glazing bars, sills and keystones
    const arch = (w: number, h: number) => {
      const sh = new THREE.Shape();
      sh.moveTo(-w / 2, 0);
      sh.lineTo(w / 2, 0);
      sh.lineTo(w / 2, h - w / 2);
      sh.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
      sh.lineTo(-w / 2, 0);
      return sh;
    };
    const W = 1.35, H = 2.5;
    const surround = arch(W + 0.5, H + 0.3);
    surround.holes.push(new THREE.Path(arch(W, H).getPoints(40).map((p) => new THREE.Vector2(p.x, p.y + 0.15))));
    const frameGeo = this.track(new THREE.ExtrudeGeometry(surround, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 20 }));
    // the reveal is a hollow jamb (so the glass shows), with a dark room behind it
    const jamb = arch(W + 0.12, H + 0.06);
    jamb.holes.push(new THREE.Path(arch(W, H).getPoints(40).map((p) => new THREE.Vector2(p.x, p.y + 0.03))));
    const revealGeo = this.track(
      mergeGeometries([
        new THREE.ExtrudeGeometry(jamb, { depth: 0.5, bevelEnabled: false, curveSegments: 20 }).translate(0, 0.12, -0.5),
        new THREE.ShapeGeometry(arch(W + 0.1, H + 0.05), 20).translate(0, 0.12, -0.52),
      ].map((g) => g.toNonIndexed()))!,
    );
    const glassGeo = this.track(new THREE.ShapeGeometry(arch(W - 0.04, H - 0.02), 20).translate(0, 0.16, -0.32));
    const bars = this.track(
      mergeGeometries([
        new THREE.BoxGeometry(0.05, H - 0.1, 0.05).translate(0, H / 2 + 0.12, -0.3),
        new THREE.BoxGeometry(W - 0.05, 0.05, 0.05).translate(0, H * 0.62, -0.3),
        new THREE.BoxGeometry(W - 0.05, 0.05, 0.05).translate(0, H * 0.32, -0.3),
        new THREE.BoxGeometry(W + 0.08, 0.08, 0.08).translate(0, H - W / 2 + 0.15, -0.28),
      ])!,
    );
    const sillGeo = this.track(new THREE.BoxGeometry(W + 0.7, 0.14, 0.42).translate(0, 0.03, 0.14));
    const keyGeo = this.track(new THREE.BoxGeometry(0.28, 0.42, 0.14).translate(0, H + 0.26, 0.1));
    const spots: [number, number, number][] = [];
    for (const y of [1.0, 4.9, 8.4]) {
      for (const x of [-4.2, -1.4, 1.4, 4.2]) if (!(y < 2 && Math.abs(x) < 2)) spots.push([x, y, FRONT]);
      for (const sx of [-1, 1]) spots.push([sx * 8.8, y, FRONT + 0.8]);
    }
    for (const sx of [-1, 1]) for (const x of [-1.6, 1.6]) spots.push([sx * 14.3 + x, 1.0, FRONT - 1.8]);
    const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, dz = 0) => {
      const im = new THREE.InstancedMesh(geo, mat, spots.length);
      spots.forEach(([x, y, z], i) => im.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, z + dz)));
      im.castShadow = im.receiveShadow = true;
      house.add(im);
      return im;
    };
    // the walls are solid boxes, so each window's depth is built outward from the face
    inst(revealGeo, interior, 0.53);
    inst(glassGeo, glass, 0.53);
    inst(bars, trimMat, 0.53);
    inst(frameGeo, trimMat, 0.5);
    inst(sillGeo, trimMat, 0.5);
    inst(keyGeo, trimMat, 0.5);

    // ── balconies: slab, balusters, top and bottom rails, end piers
    const baluster = this.track(
      new THREE.LatheGeometry(
        [
          [0.075, 0],
          [0.075, 0.06],
          [0.045, 0.1],
          [0.06, 0.16],
          [0.1, 0.34],
          [0.06, 0.5],
          [0.04, 0.56],
          [0.065, 0.6],
          [0.065, 0.66],
        ].map(([r, y]) => new THREE.Vector2(r, y)),
        24,
      ),
    );
    const rails: { x0: number; x1: number; y: number; z: number; slab: number }[] = [
      { x0: -6.2, x1: 6.2, y: 4.5, z: FRONT + 2.35, slab: 2.4 },
      { x0: -10.6, x1: -7, y: 4.5, z: FRONT + 2.35, slab: 1.6 },
      { x0: 7, x1: 10.6, y: 4.5, z: FRONT + 2.35, slab: 1.6 },
      { x0: -9.9, x1: -7.7, y: 8, z: FRONT + 1.55, slab: 0.8 },
      { x0: 7.7, x1: 9.9, y: 8, z: FRONT + 1.55, slab: 0.8 },
      { x0: -17.6, x1: -11, y: 5.4, z: FRONT - 1.95, slab: 0 },
      { x0: 11, x1: 17.6, y: 5.4, z: FRONT - 1.95, slab: 0 },
    ];
    const bal: THREE.Matrix4[] = [];
    for (const r of rails) {
      const n = Math.round((r.x1 - r.x0) / 0.26);
      for (let i = 0; i <= n; i++) bal.push(new THREE.Matrix4().makeTranslation(r.x0 + ((r.x1 - r.x0) * i) / n, r.y + 0.14, r.z));
      box(r.x1 - r.x0 + 0.4, 0.16, 0.36, (r.x0 + r.x1) / 2, r.y + 0.8, r.z, trimMat);
      box(r.x1 - r.x0 + 0.3, 0.14, 0.32, (r.x0 + r.x1) / 2, r.y, r.z, trimMat);
      for (const px of [r.x0 - 0.1, r.x1 + 0.1]) box(0.36, 0.95, 0.36, px, r.y, r.z, trimMat);
      if (r.slab) {
        box(r.x1 - r.x0 + 0.6, 0.3, r.slab + 0.2, (r.x0 + r.x1) / 2, r.y - 0.3, r.z - r.slab / 2 + 0.1, trimMat);
        moulding(r.x1 - r.x0 + 0.6, 0.45, (r.x0 + r.x1) / 2, r.y - 0.52, r.z + 0.2);
      }
    }
    const bals = new THREE.InstancedMesh(baluster, trimMat, bal.length);
    bal.forEach((m, i) => bals.setMatrixAt(i, m));
    bals.castShadow = bals.receiveShadow = true;
    house.add(bals);

    // ── porch: columns with bases and capitals under the central balcony
    const shaft = this.track(new THREE.CylinderGeometry(0.25, 0.3, 3.6, 32, 1));
    const cap = this.track(mergeGeometries([new THREE.TorusGeometry(0.3, 0.06, 10, 32).rotateX(Math.PI / 2).translate(0, 3.62, 0), new THREE.BoxGeometry(0.78, 0.16, 0.78).translate(0, 3.78, 0)])!);
    const base = this.track(mergeGeometries([new THREE.BoxGeometry(0.8, 0.18, 0.8).translate(0, 0.09, 0), new THREE.TorusGeometry(0.33, 0.07, 10, 32).rotateX(Math.PI / 2).translate(0, 0.22, 0)])!);
    for (const x of [-5.6, -2.8, 2.8, 5.6]) {
      for (const [g, y] of [
        [shaft, 1.95],
        [cap, 0.15],
        [base, 0],
      ] as const) {
        const m = new THREE.Mesh(g, trimMat);
        m.position.set(x, y, FRONT + 2.2);
        m.castShadow = m.receiveShadow = true;
        house.add(m);
      }
    }

    // ── the entrance: a door in a deep arch, steps, gate piers and railings
    const doorArch = arch(2.3, 3.4);
    add(this.track(new THREE.ExtrudeGeometry(doorArch, { depth: 0.12, bevelEnabled: false, curveSegments: 20 }).translate(0, 0.5, FRONT - 0.3)), doorMat, false);
    const doorFrame = arch(2.9, 3.75);
    doorFrame.holes.push(new THREE.Path(doorArch.getPoints(40).map((p) => new THREE.Vector2(p.x, p.y))));
    add(this.track(new THREE.ExtrudeGeometry(doorFrame, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 20 }).translate(0, 0.5, FRONT - 0.05)), trimMat, false);
    for (let i = 0; i < 6; i++) box(4.6 - i * 0.16, 0.14, 0.52, 0, i * 0.12 - 0.3, FRONT + 5.2 - i * 0.48, trimMat);
    box(4.8, 0.5, 2.6, 0, -0.1, FRONT + 1.3, trimMat);
    for (const sx of [-1, 1]) {
      box(1, 1.6, 1, sx * 6.6, -0.1, FRONT + 7.6, brick);
      box(1.2, 0.16, 1.2, sx * 6.6, 1.5, FRONT + 7.6, trimMat);
      for (const y of [0.55, 1.15]) box(4.4, 0.05, 0.05, sx * 4.2, y, FRONT + 7.6, iron);
      for (let i = 0; i < 12; i++) box(0.035, 1.1, 0.035, sx * (2.2 + i * 0.36), 0.1, FRONT + 7.6, iron);
    }
  }

  /** Scanned shrubs as instanced meshes, with a gentle wind sway in the vertex shader. */
  private plant(model: Model, items: Item[], tint?: [number, number, number], castShadow = true) {
    const mat = this.track(model.mat.clone());
    mat.envMapIntensity = 0.7;
    const wind = this.windUniform;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = wind;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.);
        #endif
        float sway = sin(uWind * 1.3 + ip.x * .35 + ip.z * .2 + position.y * 1.7) * .018 * position.y;
        transformed.x += sway; transformed.z += sway * .6;`,
      );
      if (tint) {
        // re‑colour the scanned foliage toward blossom, keeping its photographic detail
        sh.fragmentShader = sh.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          {
            float l = dot(diffuseColor.rgb, vec3(.299, .587, .114));
            vec3 bloom = vec3(${tint.map((v) => v.toFixed(3)).join(', ')});
            diffuseColor.rgb = mix(vec3(l), bloom * (l * 3.1 + .16), .92);
          }`,
        );
      }
    };
    mat.customProgramCacheKey = () => (tint ? `tint${tint.join()}` : 'plain');
    const im = new THREE.InstancedMesh(model.geo, mat, items.length);
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    items.forEach(({ p, s, r }, i) => im.setMatrixAt(i, new THREE.Matrix4().compose(p, q.setFromAxisAngle(up, r), new THREE.Vector3(s, s * (0.9 + (i % 3) * 0.08), s))));
    im.castShadow = castShadow;
    im.receiveShadow = true;
    this.scene.add(im);
    return im;
  }

  private buildPlanting(b: Model, c: Model) {
    const rnd = mulberry(2511);
    const FRONT = 3.2;
    const at = (x: number, z: number, s: number, jitter = 1): Item => {
      const px = x + (rnd() - 0.5) * jitter, pz = z + (rnd() - 0.5) * jitter;
      return { p: new THREE.Vector3(px, this.groundY(pz) - 0.1, pz), s, r: rnd() * Math.PI * 2 };
    };
    const unit = (m: Model) => 1 / m.height;

    // blossom shrubs: soft rose masses along the path and in front of the wings
    const sB = unit(b);
    const sFlower = unit(c);
    const blossom: Item[] = [];
    const mass = (cx: number, cz: number, n: number, spread: number, size: number) => {
      for (let i = 0; i < n; i++) blossom.push(at(cx + (rnd() - 0.5) * spread, cz + (rnd() - 0.5) * spread * 0.7, sFlower * size * (0.75 + rnd() * 0.5)));
    };
    const q = this.low ? 0.6 : 1;
    // big masses flank the path in the foreground and sit before the wings; the centre stays open
    // fewer, fuller shrubs: the same masses at roughly a third of the triangles
    mass(-11.5, FRONT + 16, Math.round(32 * q), 6.5, 3.2);
    mass(12, FRONT + 16, Math.round(32 * q), 6.5, 3.2);
    mass(-18.5, FRONT + 6, Math.round(22 * q), 5, 2.9);
    mass(19, FRONT + 6, Math.round(22 * q), 5, 2.9);
    mass(-5.2, FRONT + 8.2, 5, 1.2, 1.5);
    mass(5.2, FRONT + 8.2, 5, 1.2, 1.5);
    this.plant(c, blossom, [1.0, 0.42, 0.52]);

    // low green shrubs along the facade
    const sC = unit(c);
    const hedge: Item[] = [];
    for (let x = -18; x <= 18; x += 1.6) if (Math.abs(x) > 3.4) hedge.push(at(x, FRONT + (Math.abs(x) > 11 ? -1.2 : 1.1), sC * (1 + rnd() * 0.4), 0.4));
    this.plant(c, hedge, undefined, false);

    // the ivy arch: leafy shrubs grown along a half‑ellipse over the steps
    const sA = unit(c) * 0.8;
    const ivy: Item[] = [];
    const n = this.low ? 20 : 30;
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI;
      ivy.push({ p: new THREE.Vector3(Math.cos(t) * 2.9, Math.sin(t) * 3.6 - 0.2, FRONT + 7.2 + (rnd() - 0.5) * 0.3), s: sA * (0.62 + rnd() * 0.2), r: rnd() * 6.28 });
    }
    for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) ivy.push({ p: new THREE.Vector3(sx * (2.9 + (rnd() - 0.5) * 0.25), k * 0.55 - 0.2, FRONT + 7.2), s: sA * 0.75, r: rnd() * 6.28 });
    this.plant(c, ivy, undefined, false);

    // two broad trees framing the view: a curved trunk and a crown of many leafy shrubs
    const bark = this.track(new THREE.MeshStandardMaterial({ color: '#5b4b3f', roughness: 0.95 }));
    const crown: Item[] = [];
    for (const [tx, tz, lean] of [
      [-24, 10, 0.3],
      [25, 6, -0.25],
    ] as const) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(tx, -0.2, tz), new THREE.Vector3(tx + lean * 3, 5, tz), new THREE.Vector3(tx + lean * 7, 10, tz - 1)]);
      const trunk = new THREE.Mesh(this.track(new THREE.TubeGeometry(curve, 24, 0.7, 14)), bark);
      trunk.castShadow = true;
      this.scene.add(trunk);
      const cx = tx + lean * 7, cy = 12;
      for (let i = 0; i < (this.low ? 26 : 44); i++) {
        const v = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(0.4 + rnd() * 0.6);
        crown.push({ p: new THREE.Vector3(cx + v.x * 10, cy + v.y * 4.4 - 2.4, tz - 1 + v.z * 8), s: sB * (4.4 + rnd() * 2), r: rnd() * 6.28 });
      }
    }
    this.plant(b, crown);
  }

  /* ------------------------------------------------------------------ run */
  private resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    // keep the whole facade in frame on narrow screens
    this.camera.fov = w / h < 1.2 ? 50 : 32;
    this.camera.updateProjectionMatrix();
    if (this.ready && !this.running) this.frame();
  }

  private start() {
    if (this.running || !this.ready) return;
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

  /** Watch the first frames after load; step quality down (once each) if the device struggles. */
  private adapt() {
    const now = performance.now();
    if (this.lastNow) this.samples.push(now - this.lastNow);
    this.lastNow = now;
    if (this.samples.length < 24) return;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const med = sorted[sorted.length >> 1];
    this.samples = [];
    if (med > 40 && this.aoPass?.enabled) {
      this.aoPass.enabled = false; // the ambient occlusion is the most expensive pass
    } else if (med > 40 && this.renderer.getPixelRatio() > 1) {
      this.renderer.setPixelRatio(1);
      this.resize();
    } else if (med > 70 && this.every < 3) {
      this.every++; // still slow: redraw every other (then every third) frame
    }
  }

  private frame() {
    if (this.running && ++this.tick % this.every !== 0) return;
    this.adapt();
    const t = this.clock.getElapsedTime();
    this.windUniform.value = this.still ? 0 : t;
    // a slow walk up the path toward the door, then a gentle hold; the pointer looks around
    const k = this.still ? 1 : 1 - Math.exp(-t * 0.08);
    const z = 52 - k * 14;
    this.camera.position.set(Math.sin(t * 0.1) * 0.8 - this.pointer.x * 1.4, 2.6 + k * 0.5 + this.pointer.y * 0.4 + this.groundY(z), z);
    this.camera.lookAt(this.pointer.x * 1.6, 6.6 - k * 0.4, 0);
    this.composer.render();
  }

  dispose() {
    this.disposed = true;
    this.stop();
    this.io.disconnect();
    this.ro.disconnect();
    this.canvas.removeEventListener('pointermove', this.onPointer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.scene.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    this.disposables.forEach((d) => d.dispose());
    this.composer?.dispose();
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

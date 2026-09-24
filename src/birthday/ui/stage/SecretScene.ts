import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Stage, makeNebula, makeStarfield, ease } from './Stage';

const SERIF = "'Cormorant Garamond', Georgia, serif";
const SLOTS = 12;
const DECOYS = ['A', '7', '★', '∞', 'D', '9', '3', '☾', 'K', '4', '✦', '8'];

/**
 * Chapter 7 · Our Secret — a brass cryptex with one engraved ring per clue. The ring for the
 * clue she is on glows softly; a right answer turns it with a click until its symbol faces
 * her, lit from inside, and light begins to leak through the seams. A wrong one makes the
 * whole cryptex shudder. With every ring aligned it opens: the rings slide apart, the end caps
 * pull away and light pours out. The page's code row (`setAnchor`) says where it lies.
 */
export class SecretScene extends Stage {
  private u = { uTime: { value: 0 }, uAspect: { value: 1 }, uPx: { value: 60 }, uGlow: { value: 0.2 } };
  private sparkU = { uTime: this.u.uTime, uPx: this.u.uPx, uK: { value: 0 } };
  private rig = new THREE.Group();
  private body = new THREE.Group();
  private rings: { mesh: THREE.Mesh; mat: THREE.MeshPhysicalMaterial; angle: number; rest: number; glow: number }[] = [];
  private caps: THREE.Group[] = [];
  private core: THREE.Mesh;
  private light: THREE.PointLight;
  private solved: boolean[] = [];
  private active = 0;
  private shakeAt = -10;
  private openAt = -1;
  private anchor = { x: 0.5, y: 0.35, w: 0.5 };
  private readonly n: number;
  private readonly W = 0.56; // ring width

  constructor(canvas: HTMLCanvasElement, symbols: string[]) {
    super(canvas, { dpr: 1.5 });
    this.n = symbols.length;
    this.solved = symbols.map(() => false);
    this.renderer.toneMappingExposure = 1;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = this.track(pmrem.fromScene(room, 0.04).texture);
    this.scene.environmentIntensity = 0.55;
    room.dispose();
    pmrem.dispose();
    this.scene.add(makeNebula(this.u, ['#1a2a4a', '#5a4a8a']), makeStarfield(this.low ? 700 : 1400, this.u));
    this.scene.add(new THREE.AmbientLight('#6a6a9a', 0.35));
    const key = new THREE.SpotLight('#ffe0b8', 70, 30, 0.5, 0.7, 1.4);
    key.position.set(-3, 5, 6);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#8aa8ff', 1.4);
    rim.position.set(4, -1, -4);
    this.scene.add(rim);
    this.light = new THREE.PointLight('#ffd9a0', 0, 12, 1.5);
    this.scene.add(this.light);

    const brass = this.track(new THREE.MeshPhysicalMaterial({ color: '#c9a560', metalness: 1, roughness: 0.3, clearcoat: 0.4 }));
    const dark = this.track(new THREE.MeshPhysicalMaterial({ color: '#3a2a18', metalness: 1, roughness: 0.45 }));
    const len = this.n * this.W;
    // the light inside (seen through the seams, and when it opens)
    this.core = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(0.5, 0.5, len + 0.4, 48, 1, true).rotateZ(Math.PI / 2)),
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uA: { value: 0.2 }, uTime: this.u.uTime },
          vertexShader: `varying vec3 vN; varying vec3 vV; varying float vX; void main(){ vX = position.x; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
          fragmentShader: `uniform float uA, uTime; varying vec3 vN; varying vec3 vV; varying float vX;
            void main(){ float f = pow(abs(dot(vN, vV)), 1.5); float a = uA * (.4 + .6 * f) * (.85 + .15 * sin(vX * 9. - uTime * 2.)); gl_FragColor = vec4(vec3(1., .8, .5) * a, a); }`,
        }),
      ),
    );
    this.body.add(this.core);
    // rings, each engraved with its symbol and eleven decoys
    symbols.forEach((sym, k) => {
      const { map, glow } = this.ringTextures(sym, k);
      const mat = this.track(new THREE.MeshPhysicalMaterial({ map, emissiveMap: glow, emissive: new THREE.Color('#ffe6a8'), emissiveIntensity: 0, metalness: 0.9, roughness: 0.34, clearcoat: 0.5 }));
      const mesh = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.66, 0.66, this.W - 0.05, 72, 1, false).rotateZ(Math.PI / 2)), [mat, brass, brass]);
      mesh.position.x = -len / 2 + this.W * (k + 0.5);
      const rest = (3.5 + ((k * 5) % 7)) * ((Math.PI * 2) / SLOTS); // a decoy faces front
      this.rings.push({ mesh, mat, angle: rest, rest, glow: 0 });
      this.body.add(mesh);
      // raised brass bands between the rings
      const band = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.665, 0.025, 10, 72).rotateY(Math.PI / 2)), brass);
      band.position.x = mesh.position.x - this.W / 2;
      this.body.add(band);
    });
    // end caps: a collar, a fluted drum and a finial
    for (const sx of [-1, 1]) {
      const cap = new THREE.Group();
      const collar = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.72, 0.72, 0.16, 72).rotateZ(Math.PI / 2)), brass);
      collar.position.x = sx * 0.08;
      const drum = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.6, 0.64, 0.5, 24).rotateZ(Math.PI / 2)), dark);
      drum.position.x = sx * 0.4;
      for (let f = 0; f < 12; f++) {
        const a = (f / 12) * Math.PI * 2;
        const rib = new THREE.Mesh(this.track(new THREE.BoxGeometry(0.5, 0.05, 0.05)), brass);
        rib.position.set(sx * 0.4, Math.sin(a) * 0.62, Math.cos(a) * 0.62);
        cap.add(rib);
      }
      const ring2 = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.66, 0.6, 0.12, 72).rotateZ(Math.PI / 2)), brass);
      ring2.position.x = sx * 0.72;
      const fin = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.22, 32, 16)), brass);
      fin.position.x = sx * 0.92;
      fin.scale.set(1.2, 0.8, 0.8);
      cap.add(collar, drum, ring2, fin);
      cap.position.x = sx * (len / 2);
      this.caps.push(cap);
      this.body.add(cap);
    }
    // a pointer line along the front, where the code must line up
    const guide = new THREE.Mesh(this.track(new THREE.BoxGeometry(len + 0.2, 0.012, 0.012)), this.track(new THREE.MeshBasicMaterial({ color: '#ffe2b0', transparent: true, opacity: 0.5 })));
    guide.position.set(0, -0.36, 0.69);
    this.body.add(guide);
    const guide2 = guide.clone();
    guide2.position.y = 0.36;
    this.body.add(guide2);
    this.rig.add(this.body, this.makeSparks(len));
    this.scene.add(this.rig);
    this.camera.position.set(0, 0.5, 9);
    this.begin();
  }

  private ringTextures(sym: string, k: number) {
    const W = 1024, H = 128;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const e = document.createElement('canvas');
    e.width = W;
    e.height = H;
    const g = c.getContext('2d')!, ge = e.getContext('2d')!;
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, '#8a6a34');
    grd.addColorStop(0.5, '#e0c080');
    grd.addColorStop(1, '#8a6a34');
    g.fillStyle = grd;
    g.fillRect(0, 0, W, H);
    // fine machining lines
    for (let y = 0; y < H; y += 3) {
      g.fillStyle = `rgba(60,40,10,${0.05 + Math.random() * 0.08})`;
      g.fillRect(0, y, W, 1);
    }
    ge.fillStyle = '#000';
    ge.fillRect(0, 0, W, H);
    const glyphs = [sym, ...DECOYS.filter((d) => d !== sym).slice(k, k + SLOTS - 1)];
    while (glyphs.length < SLOTS) glyphs.push(DECOYS[glyphs.length % DECOYS.length]);
    glyphs.forEach((gl, j) => {
      for (const [ctx, col] of [
        [g, 'rgba(40,24,6,.85)'],
        [ge, j === 0 ? '#fff' : '#000'],
      ] as const) {
        ctx.save();
        ctx.translate(((j + 0.5) / SLOTS) * W, H / 2);
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = col;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `600 64px ${SERIF}`;
        ctx.fillText(gl, 0, 4);
        ctx.restore();
      }
      // slot dividers
      g.fillStyle = 'rgba(40,24,6,.5)';
      g.fillRect((j / SLOTS) * W - 1, 8, 2, H - 16);
    });
    const map = this.track(new THREE.CanvasTexture(c));
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    const glow = this.track(new THREE.CanvasTexture(e));
    return { map, glow };
  }

  private makeSparks(len: number) {
    const n = this.low ? 300 : 600;
    const d = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) d.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    const g = this.track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aD', new THREE.BufferAttribute(d, 4));
    const pts = new THREE.Points(
      g,
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: this.sparkU,
          vertexShader: `attribute vec4 aD; uniform float uTime, uPx, uK; varying float vA;
            void main(){
              float t = clamp(uK * 1.3 - aD.w * .3, 0., 1.);
              float a = aD.y * 6.2832;
              vec3 dir = normalize(vec3((aD.x - .5) * 2.2, cos(a), sin(a)));
              vec3 p = vec3((aD.x - .5) * ${len.toFixed(2)}, 0., 0.) + dir * (.6 + t * (2. + aD.z * 4.));
              p.y += t * t * 1.5;
              vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
              vA = step(.001, t) * (1. - t) * (.5 + .5 * aD.z);
              gl_PointSize = uPx * (.5 + aD.z * .8) / -mv.z; }`,
          fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = (smoothstep(.5, 0., d) * .4 + smoothstep(.12, 0., d)) * vA; gl_FragColor = vec4(vec3(1., .85, .55) * a, a); }`,
        }),
      ),
    );
    pts.frustumCulled = false;
    return pts;
  }

  /** Where the page's code row sits: centre (0…1 of the viewport) and width fraction. */
  setAnchor(x: number, y: number, w: number) {
    this.anchor = { x, y, w };
  }
  /** Which rings are solved, and which clue she is on. */
  setSolved(solved: boolean[], active: number) {
    this.solved = solved.slice();
    this.active = active;
  }
  shake() {
    this.shakeAt = this.clock.getElapsedTime();
  }
  open() {
    if (this.openAt < 0) this.openAt = this.clock.getElapsedTime();
  }

  protected onResize(w: number, h: number) {
    this.u.uAspect.value = w / h;
    this.u.uPx.value = 60 * this.renderer.getPixelRatio() * (h / 800) * 1.4;
    this.camera.fov = w / h < 1 ? 50 : 36;
    this.camera.updateProjectionMatrix();
  }

  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private hit = new THREE.Vector3();

  protected update(t: number, dt: number) {
    this.u.uTime.value = this.still ? 0 : t;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    // lie along the page's code row
    this.ray.setFromCamera(new THREE.Vector2(this.anchor.x * 2 - 1, -(this.anchor.y * 2 - 1)), this.camera);
    if (this.ray.ray.intersectPlane(this.plane, this.hit)) {
      this.rig.position.lerp(this.hit, this.rig.position.lengthSq() ? 0.15 : 1);
      const dist = this.camera.position.distanceTo(this.hit);
      const viewW = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.aspect;
      this.rig.scale.setScalar(Math.min(1.6, (this.anchor.w * viewW) / (this.n * this.W + 2 + ease(0.2, 1.6, this.openAt < 0 ? -1 : t - this.openAt) * 3.2)));
    }
    const k = 1 - Math.exp(-dt * 6);
    const s = t - this.shakeAt;
    const shake = s < 0.5 ? Math.sin(s * 60) * (1 - s / 0.5) * 0.06 : 0;
    this.body.rotation.set(this.still ? 0 : Math.sin(t * 0.4) * 0.04, this.still ? -0.12 : -0.12 + Math.sin(t * 0.25) * 0.08 + shake, shake * 0.5);
    const o = this.openAt < 0 ? -1 : t - this.openAt;
    const spread = ease(0.2, 1.6, o);
    const done = this.solved.filter(Boolean).length;
    this.rings.forEach((r, i) => {
      // solved rings turn to their symbol (slot 0, facing her); the others idle a little
      const target = this.solved[i] ? (0.5 / SLOTS) * Math.PI * 2 : r.rest + (this.still ? 0 : Math.sin(t * 0.3 + i) * 0.05);
      r.angle += (target - r.angle) * (this.still ? 1 : k);
      r.mesh.rotation.x = r.angle;
      r.glow += ((this.solved[i] ? 4 : 0) - r.glow) * k;
      r.mat.emissiveIntensity = r.glow;
      // the ring she is solving swells gently, as if waiting to be turned
      const on = !this.solved[i] && i === this.active && this.openAt < 0;
      r.mesh.scale.setScalar(1 + (on ? 0.035 + (this.still ? 0 : Math.sin(t * 3) * 0.02) : 0));
      r.mesh.position.x = (-this.n * this.W) / 2 + this.W * (i + 0.5) + (i - (this.n - 1) / 2) * spread * 0.35;
    });
    this.caps.forEach((c, j) => (c.position.x = (j ? 1 : -1) * ((this.n * this.W) / 2 + spread * (0.35 * (this.n - 1)) / 2 + spread * 0.9)));
    // light inside grows with every ring aligned, and floods out when it opens
    const inner = done / this.n;
    (this.core.material as THREE.ShaderMaterial).uniforms.uA.value = 0.15 + inner * 0.5 + spread * 1.2;
    this.light.position.copy(this.rig.position).add(new THREE.Vector3(0, 0, 1.2));
    this.light.intensity = inner * 6 + spread * 30;
    this.sparkU.uK.value = o < 0 ? 0 : ease(0.3, 3.2, o);
    this.u.uGlow.value = 0.2 + inner * 0.25 + spread * 0.5;
  }
}

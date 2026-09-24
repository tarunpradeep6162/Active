import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Stage, makeNebula, makeStarfield, ease } from './Stage';

/**
 * Chapter 5 · Catch My Heart — the tulip the petals are escaping from stands behind the game,
 * its head at the top where they fall. Every petal she catches comes home: the tulip regains
 * its petals one by one, opens a little more and glows warmer inside; a cloud makes it
 * shiver. When she has caught them all it opens fully and a spiral of light petals rises.
 * The page's game box (`setAnchor`) says where it stands.
 */
export class CatchScene extends Stage {
  private u = { uTime: { value: 0 }, uAspect: { value: 1 }, uPx: { value: 60 }, uGlow: { value: 0.25 } };
  private burstU = { uTime: this.u.uTime, uPx: this.u.uPx, uK: { value: 0 } };
  private rig = new THREE.Group();
  private head = new THREE.Group();
  private stamens = new THREE.Group();
  private petals: { m: THREE.Mesh; base: number; inner: boolean; shown: number }[] = [];
  private core: THREE.Sprite;
  private light: THREE.PointLight;
  private prog = 0;
  private shown = 0;
  private catchAt = -10;
  private shiverAt = -10;
  private winAt = -1;
  private anchor = { l: 0.2, t: 0.2, w: 0.6, h: 0.6 };

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { dpr: 1.5 });
    this.renderer.toneMappingExposure = 1;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = this.track(pmrem.fromScene(room, 0.04).texture);
    this.scene.environmentIntensity = 0.35;
    room.dispose();
    pmrem.dispose();
    this.scene.add(makeNebula(this.u, ['#4a1a3a', '#b24a6a']), makeStarfield(this.low ? 700 : 1400, this.u));
    const key = new THREE.DirectionalLight('#ffe6d6', 2.2);
    key.position.set(-3, 5, 6);
    const rim = new THREE.DirectionalLight('#ff9ab4', 2.4);
    rim.position.set(4, 2, -5);
    this.scene.add(key, rim, new THREE.AmbientLight('#7a4a6a', 0.45));

    // stem and leaves
    const green = this.track(new THREE.MeshPhysicalMaterial({ color: '#3d6b3a', roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color('#a8e0a0'), clearcoat: 0.3, side: THREE.DoubleSide }));
    const stemCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.25, -7.2, 0), new THREE.Vector3(-0.15, -4.5, 0.1), new THREE.Vector3(0.12, -2, 0), new THREE.Vector3(0, 0, 0)]);
    this.rig.add(new THREE.Mesh(this.track(new THREE.TubeGeometry(stemCurve, 64, 0.09, 12)), green));
    for (const sx of [-1, 1]) {
      const leaf = new THREE.Mesh(this.leafGeometry(), green);
      leaf.position.set(0.1 * sx, -6.6, 0);
      leaf.rotation.set(0, sx > 0 ? 0.4 : Math.PI - 0.3, sx * 0.28);
      this.rig.add(leaf);
    }

    // the flower: six petals, three outer and three inner, cupped around a warm light
    const petalGeo = this.petalGeometry();
    const petalMat = this.track(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color('#ffc0d0'), clearcoat: 0.25, side: THREE.DoubleSide, transmission: this.low ? 0 : 0.15, thickness: 0.2 }));
    for (let i = 0; i < 6; i++) {
      const inner = i % 2 === 1;
      const pivot = new THREE.Group();
      pivot.rotation.y = (i / 6) * Math.PI * 2;
      const m = new THREE.Mesh(petalGeo, petalMat);
      m.position.z = inner ? 0.12 : 0.2;
      m.scale.setScalar(inner ? 0.92 : 1);
      pivot.add(m);
      this.head.add(pivot);
      this.petals.push({ m, base: inner ? 0.08 : 0.16, inner, shown: 0 });
    }
    // stamens
    const dark = this.track(new THREE.MeshStandardMaterial({ color: '#2a1420', roughness: 0.6 }));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      const s = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6)), dark);
      s.position.set(Math.cos(a) * 0.12, 0.45, Math.sin(a) * 0.12);
      s.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2);
      const tip = new THREE.Mesh(this.track(new THREE.CapsuleGeometry(0.04, 0.14, 4, 8)), dark);
      tip.position.y = 0.48;
      s.add(tip);
      this.stamens.add(s);
    }
    this.head.add(this.stamens);
    const pistil = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.06, 0.08, 0.8, 12)), this.track(new THREE.MeshStandardMaterial({ color: '#c8d890', roughness: 0.5 })));
    pistil.position.y = 0.4;
    this.head.add(pistil);
    this.core = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: this.track(this.glowTexture()), color: '#ffd9b0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    this.core.position.y = 0.9;
    this.head.add(this.core);
    this.light = new THREE.PointLight('#ffc89a', 0, 8, 1.5);
    this.light.position.y = 0.9;
    this.head.add(this.light);
    this.rig.add(this.head, this.makeBurst());
    this.scene.add(this.rig);
    this.camera.position.set(0, 0, 14);
    this.begin();
  }

  /** A tulip petal: a cupped spoon, deep crimson at the base to blush pink at the tip. */
  private petalGeometry() {
    const g = this.track(new THREE.PlaneGeometry(1, 1, 12, 20));
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    const col = new Float32Array(p.count * 3);
    const base = new THREE.Color('#5a0a24'), mid = new THREE.Color('#d8406c'), tip = new THREE.Color('#ffb4c8'), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) * 2, v = p.getY(i) + 0.5;
      const w = 1.1 * Math.pow(Math.sin(Math.PI * (0.12 + 0.86 * v)), 0.65) * (0.75 + 0.35 * v);
      const x = (u * w) / 2;
      const y = v * 2.3;
      // cupped across, bulging out in the middle, the tip turning back in
      const z = -u * u * 0.32 * w + Math.sin(Math.PI * v) * 0.42 - v * v * 0.28;
      p.setXYZ(i, x, y, z);
      c.copy(v < 0.5 ? base.clone().lerp(mid, v / 0.5) : mid.clone().lerp(tip, (v - 0.5) / 0.5));
      c.lerp(new THREE.Color('#ffe0e8'), Math.max(0, 0.25 - Math.abs(u) * 0.3) * v);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  }

  private leafGeometry() {
    const g = this.track(new THREE.PlaneGeometry(1, 1, 8, 24));
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) * 2, v = p.getY(i) + 0.5;
      const w = 0.75 * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.05)), 0.8);
      const x = (u * w) / 2 + v * v * 1.4;
      const y = v * 5;
      const z = Math.abs(u) * 0.22 * w - v * v * 0.6;
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
  }

  private glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.3, 'rgba(255,220,200,.4)');
    r.addColorStop(1, 'rgba(255,180,190,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private makeBurst() {
    const n = this.low ? 260 : 520;
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
          uniforms: this.burstU,
          vertexShader: `attribute vec4 aD; uniform float uTime, uPx, uK; varying float vA; varying float vRot;
            void main(){
              float t = clamp(uK * 1.4 - aD.w * .4, 0., 1.);
              float a = aD.x * 6.2832 + t * 5.;
              float r = .3 + t * (2. + aD.y * 5.);
              vec3 p = vec3(cos(a) * r, 1. + t * (3. + aD.z * 6.), sin(a) * r * .6);
              vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
              vA = step(.001, t) * (1. - t);
              vRot = uTime * (aD.y - .5) * 4. + aD.z * 6.28;
              gl_PointSize = uPx * (1.6 + aD.y * 2.) / -mv.z; }`,
          fragmentShader: `varying float vA; varying float vRot;
            void main(){ vec2 c = gl_PointCoord - .5; c = mat2(cos(vRot), -sin(vRot), sin(vRot), cos(vRot)) * c;
              float a = smoothstep(.42, .28, length(c * vec2(1., 2.2))) * vA; gl_FragColor = vec4(mix(vec3(1., .6, .75), vec3(1., .9, .75), .5 + c.y) * a, a); }`,
        }),
      ),
    );
    pts.frustumCulled = false;
    return pts;
  }

  /** The page's game box, as fractions of the viewport. */
  setAnchor(l: number, t: number, w: number, h: number) {
    this.anchor = { l, t, w, h };
  }
  /** How many petals are home (0…1). */
  setProgress(p: number) {
    if (p > this.prog + 1e-3) this.catchAt = this.clock.getElapsedTime();
    else if (p < this.prog - 1e-3) this.shiverAt = this.clock.getElapsedTime();
    this.prog = Math.max(0, Math.min(1, p));
  }
  win() {
    if (this.winAt < 0) this.winAt = this.clock.getElapsedTime();
  }

  protected onResize(w: number, h: number) {
    this.u.uAspect.value = w / h;
    this.u.uPx.value = 60 * this.renderer.getPixelRatio() * (h / 800) * 1.4;
    this.camera.fov = w / h < 1 ? 56 : 40;
    this.camera.updateProjectionMatrix();
  }

  private v = new THREE.Vector3();
  private at(x: number, y: number, out: THREE.Vector3) {
    this.v.set(x * 2 - 1, -(y * 2 - 1), 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    return out.copy(this.camera.position).addScaledVector(this.v, -this.camera.position.z / this.v.z);
  }
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();

  protected update(t: number, dt: number) {
    this.u.uTime.value = this.still ? 0 : t;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    // the flower's head at the top of the game box, its stem reaching down behind it
    const { l, t: top, w, h } = this.anchor;
    this.at(l + w / 2, top + h * 0.3, this.a);
    this.at(l + w / 2, top + h, this.b);
    const s = Math.abs(this.a.y - this.b.y) / 5.6;
    this.rig.position.copy(this.a);
    this.rig.scale.setScalar(s);
    const o = this.winAt < 0 ? -1 : t - this.winAt;
    const won = ease(0, 1.8, o);
    this.shown += ((won > 0 ? 1 : this.prog) - this.shown) * (this.still ? 1 : 1 - Math.exp(-dt * 3));
    // petals come home one by one (six petals for fourteen catches), then the cup opens
    const c = t - this.catchAt, sh = t - this.shiverAt;
    const bounce = c >= 0 && c < 0.8 ? Math.sin((c / 0.8) * Math.PI) * 0.06 : 0;
    const shiver = sh >= 0 && sh < 0.6 ? Math.sin(sh * 55) * (1 - sh / 0.6) * 0.05 : 0;
    const open = 0.1 + this.shown * 0.35 + won * 0.55;
    this.petals.forEach((pt, i) => {
      const order = [0, 3, 1, 4, 2, 5].indexOf(i);
      const want = Math.min(1, Math.max(0, this.shown * 6.2 - order * 1.0));
      pt.shown += (want - pt.shown) * (this.still ? 1 : 1 - Math.exp(-dt * 4));
      const k = ease(0, 1, pt.shown);
      // from a small closed bud to a full petal
      pt.m.scale.setScalar((pt.inner ? 0.92 : 1) * (0.38 + 0.62 * k));
      pt.m.rotation.x = pt.base + (pt.inner ? open * 0.7 : open) * k - (1 - k) * 0.12;
    });
    const sway = this.still ? 0 : Math.sin(t * 0.7) * 0.03;
    this.rig.rotation.z = sway + shiver;
    this.head.rotation.set(0.12 + bounce, t * (this.still ? 0 : 0.08), sway * 1.5);
    this.head.scale.setScalar(1 + bounce * 0.8 + won * 0.1);
    // the stamens only show once the cup has opened
    this.stamens.scale.set(1, Math.max(0.01, ease(0.5, 1, this.shown) * 0.7 + won * 0.3), 1);
    const glow = 0.15 + this.shown * 0.6 + won * 1.2;
    (this.core.material as THREE.SpriteMaterial).opacity = Math.min(0.7, glow * 0.5);
    this.core.scale.setScalar(0.8 + glow * 0.8);
    this.light.intensity = glow * 5;
    this.burstU.uK.value = o < 0 ? 0 : ease(0.4, 4, o);
    this.u.uGlow.value = 0.25 + this.shown * 0.3 + won * 0.5;
  }
}

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Stage, makeNebula, makeStarfield, ease } from './Stage';

/**
 * Chapter 6 · Know Us? — two glass hearts, one rose and one gold, begin far apart. Every answer
 * draws them closer along a thread of light; a right answer makes both glow from inside, a
 * wrong one makes them tremble (but they still come closer). When the questions are done they
 * meet above her next‑date card in a flash of light and turn slowly together.
 */
export class QuizScene extends Stage {
  private u = { uTime: { value: 0 }, uAspect: { value: 1 }, uPx: { value: 60 }, uGlow: { value: 0.3 } };
  private threadU = { uTime: this.u.uTime, uPx: this.u.uPx, uA: { value: 0.3 } };
  private hearts: { g: THREE.Group; glow: THREE.Sprite; side: number }[] = [];
  private thread: THREE.Points;
  private ring: THREE.Mesh;
  private prog = 0;
  private shown = 0;
  private pulseAt = -10;
  private ok = true;
  private uniteAt = -1;
  private portrait = false;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { dpr: 1.25 });
    this.renderer.toneMappingExposure = 1.05;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = this.track(pmrem.fromScene(room, 0.04).texture);
    this.scene.environmentIntensity = 0.8;
    room.dispose();
    pmrem.dispose();
    this.scene.add(makeNebula(this.u, ['#2a2458', '#8a5a9a']), makeStarfield(this.low ? 700 : 1400, this.u));
    const key = new THREE.DirectionalLight('#fff0e0', 2);
    key.position.set(-3, 4, 6);
    const rim = new THREE.DirectionalLight('#c8a8ff', 2.5);
    rim.position.set(3, -2, -4);
    this.scene.add(key, rim, new THREE.AmbientLight('#8a7aaa', 0.4));

    // a soft, rounded heart
    const s = new THREE.Shape();
    s.moveTo(0, -1);
    s.bezierCurveTo(-0.35, -0.62, -1.05, -0.25, -1.05, 0.28);
    s.bezierCurveTo(-1.05, 0.72, -0.68, 0.98, -0.34, 0.98);
    s.bezierCurveTo(-0.12, 0.98, 0, 0.84, 0, 0.66);
    s.bezierCurveTo(0, 0.84, 0.12, 0.98, 0.34, 0.98);
    s.bezierCurveTo(0.68, 0.98, 1.05, 0.72, 1.05, 0.28);
    s.bezierCurveTo(1.05, -0.25, 0.35, -0.62, 0, -1);
    const geo = this.track(new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.32, bevelSize: 0.28, bevelSegments: this.low ? 6 : 10, curveSegments: this.low ? 24 : 40 }));
    geo.center();
    geo.computeVertexNormals();
    const glowTex = this.track(this.glowTexture());
    for (const [side, tint] of [
      [-1, '#ff9ab4'],
      [1, '#ffd48a'],
    ] as const) {
      const mat = this.track(
        new THREE.MeshPhysicalMaterial({
          color: tint,
          transmission: this.low ? 0.6 : 1,
          thickness: 1.2,
          roughness: 0.06,
          ior: 1.45,
          iridescence: 0.5,
          iridescenceIOR: 1.3,
          clearcoat: 1,
          attenuationColor: new THREE.Color(tint),
          attenuationDistance: 1.4,
          transparent: this.low,
          opacity: this.low ? 0.75 : 1,
        }),
      );
      const g = new THREE.Group();
      const mesh = new THREE.Mesh(geo, mat);
      g.add(mesh);
      const glow = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: glowTex, color: tint, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
      glow.scale.setScalar(2.2);
      g.add(glow);
      this.hearts.push({ g, glow, side });
      this.scene.add(g);
    }

    // the thread of light between them
    const n = 90;
    const g = this.track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aT', new THREE.BufferAttribute(Float32Array.from({ length: n }, (_, i) => i / (n - 1)), 1));
    this.thread = new THREE.Points(
      g,
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: this.threadU,
          vertexShader: `attribute float aT; uniform float uTime, uPx, uA; varying float vA;
            void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
              vA = uA * (.4 + .6 * pow(.5 + .5 * sin(aT * 40. - uTime * 4.), 3.)) * smoothstep(0., .12, aT) * smoothstep(1., .88, aT);
              gl_PointSize = uPx * 1.8 / -mv.z; }`,
          fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = (smoothstep(.5, 0., d) * .4 + smoothstep(.14, 0., d)) * vA; gl_FragColor = vec4(vec3(1., .88, .9) * a, a); }`,
        }),
      ),
    );
    this.thread.frustumCulled = false;
    this.scene.add(this.thread);
    this.ring = new THREE.Mesh(
      this.track(new THREE.RingGeometry(0.96, 1, 96)),
      this.track(new THREE.MeshBasicMaterial({ color: '#ffe6d0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })),
    );
    this.scene.add(this.ring);
    this.camera.position.set(0, 0, 10);
    this.begin();
  }

  private glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,230,230,.45)');
    r.addColorStop(1, 'rgba(255,200,200,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** How far through the questions she is (0…1): the hearts draw closer. */
  setProgress(p: number) {
    this.prog = Math.max(0, Math.min(1, p));
  }
  /** An answer: both hearts glow (right) or tremble (not quite). */
  pulse(ok: boolean) {
    this.ok = ok;
    this.pulseAt = this.clock.getElapsedTime();
  }
  /** The end: the hearts meet. */
  unite() {
    if (this.uniteAt < 0) this.uniteAt = this.clock.getElapsedTime();
  }

  protected onResize(w: number, h: number) {
    this.u.uAspect.value = w / h;
    this.u.uPx.value = 60 * this.renderer.getPixelRatio() * (h / 800) * 1.4;
    this.portrait = w / h < 1;
    this.camera.fov = this.portrait ? 56 : 40;
    this.camera.updateProjectionMatrix();
  }

  private v = new THREE.Vector3();
  /** A point on the z = 0 plane from normalised screen coordinates. */
  private at(x: number, y: number, out: THREE.Vector3) {
    this.v.set(x, y, 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    return out.copy(this.camera.position).addScaledVector(this.v, -this.camera.position.z / this.v.z);
  }
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private c = new THREE.Vector3();

  protected update(t: number, dt: number) {
    this.u.uTime.value = this.still ? 0 : t;
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    this.shown += (this.prog - this.shown) * (this.still ? 1 : 1 - Math.exp(-dt * 1.6));
    const o = this.uniteAt < 0 ? -1 : t - this.uniteAt;
    const meet = ease(0, 1.6, o);
    const p = ease(0, 1, this.shown);
    // from far apart (beside her questions) to side by side above the card, then touching
    const [x0, y0, x1, y1, size, xm] = this.portrait ? [0.55, 0.56, 0.3, 0.56, 0.1, 0.13] : [0.62, 0.05, 0.18, 0.44, 0.15, 0.055];
    const x = x0 + (x1 - x0) * p - meet * (x1 - xm), y = y0 + (y1 - y0) * p;
    this.at(0, y, this.a);
    this.at(0, y + size, this.b);
    const unit = Math.abs(this.b.y - this.a.y) / 2; // world units for a heart's half‑height
    const f = t - this.pulseAt;
    const pl = f >= 0 && f < 1.4 ? Math.sin((f / 1.4) * Math.PI) : 0;
    const tremble = !this.ok && f >= 0 && f < 0.6 ? Math.sin(f * 50) * (1 - f / 0.6) * 0.12 : 0;
    this.hearts.forEach((h, i) => {
      h.g.position.copy(this.at(h.side * x, y, this.c));
      h.g.position.y += this.still ? 0 : Math.sin(t * 0.8 + i * 2) * unit * 0.12;
      h.g.scale.setScalar(unit * (1 + meet * 0.15 + (this.ok ? pl * 0.08 : 0)));
      // each turns gently, leaning toward the other, and faces her as they meet
      const lean = -h.side * 0.35 * (1 - meet);
      h.g.rotation.set(this.still ? 0 : Math.sin(t * 0.5 + i) * 0.12, lean + (this.still ? 0 : Math.sin(t * 0.4 + i * 3) * 0.25 * (1 - meet)) + tremble, h.side * 0.12 * (1 - meet) + tremble * 0.5);
      const gm = h.glow.material as THREE.SpriteMaterial;
      gm.opacity = 0.25 + p * 0.35 + (this.ok ? pl * 0.6 : 0) + meet * 0.5;
      h.glow.scale.setScalar(2 + (this.ok ? pl : 0) + meet * 1.5);
    });
    // the thread arcs between them, brighter with every step closer
    const pos = this.thread.geometry.getAttribute('position') as THREE.BufferAttribute;
    const L = this.hearts[0].g.position, R = this.hearts[1].g.position;
    for (let i = 0; i < pos.count; i++) {
      const k = i / (pos.count - 1);
      const sag = Math.sin(k * Math.PI) * unit * (0.6 - p * 0.4) * (1 - meet);
      pos.setXYZ(i, L.x + (R.x - L.x) * k, L.y + (R.y - L.y) * k - sag, L.z);
    }
    pos.needsUpdate = true;
    this.threadU.uA.value = (0.45 + p * 0.7 + (this.ok ? pl * 1.2 : -pl * 0.3)) * (1 - meet * 0.8);
    // when they meet: a ring of light
    this.ring.position.set((L.x + R.x) / 2, (L.y + R.y) / 2, 0.1);
    const rm = this.ring.material as THREE.MeshBasicMaterial;
    rm.opacity = o > 1.2 && o < 3.4 ? (1 - ease(1.2, 3.4, o)) * 0.9 : 0;
    this.ring.scale.setScalar(unit * (1 + ease(1.2, 3.4, o) * 6));
    this.u.uGlow.value = 0.3 + p * 0.3 + meet * 0.5 + (this.ok ? pl * 0.3 : 0);
  }
}

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Stage, makeNebula, makeStarfield, ease } from './Stage';

const SERIF = "'Cormorant Garamond', Georgia, serif";

/**
 * Chapter 14 · For Dheepika — Door 25. A tall arched door of deep plum with gold trim floats in
 * a rose nebula; around its arch, one small light for every other chapter, lit as she opens
 * them. When the door opens, both leaves swing wide, light floods out with a stream of motes
 * and small hearts, and the camera passes through into a warm sky where the finale plays.
 */
export class FinaleScene extends Stage {
  private u = { uTime: { value: 0 }, uAspect: { value: 1 }, uPx: { value: 60 }, uGlow: { value: 0.5 } };
  private flood = { uTime: this.u.uTime, uK: { value: 0 }, uPx: this.u.uPx };
  private left = new THREE.Group();
  private right = new THREE.Group();
  private lights: THREE.Mesh[] = [];
  private lit = 0;
  private openAt = -1;
  private glowPlane: THREE.Mesh;
  private beam: THREE.Mesh;
  onThrough?: () => void;
  private through = false;
  private lookY = 0;

  constructor(canvas: HTMLCanvasElement, total: number) {
    super(canvas, { dpr: 1.5 });
    this.renderer.toneMappingExposure = 1;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = this.track(pmrem.fromScene(room, 0.04).texture);
    this.scene.environmentIntensity = 0.45;
    room.dispose();
    pmrem.dispose();
    this.scene.add(makeNebula(this.u, ['#4a1a3a', '#c06a7a']), makeStarfield(this.low ? 800 : 1500, this.u));
    this.scene.add(new THREE.AmbientLight('#8a5a7a', 0.4));
    const key = new THREE.SpotLight('#ffe2c4', 60, 30, 0.6, 0.8, 1.5);
    key.position.set(-4, 6, 8);
    this.scene.add(key);

    const W = 2.6, H = 4.6; // door opening
    const arch = (w: number, h: number) => {
      const s = new THREE.Shape();
      s.moveTo(-w / 2, 0);
      s.lineTo(w / 2, 0);
      s.lineTo(w / 2, h - w / 2);
      s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
      s.lineTo(-w / 2, 0);
      return s;
    };
    // the golden frame
    const frameShape = arch(W + 0.6, H + 0.35);
    frameShape.holes.push(new THREE.Path(arch(W, H).getPoints(48).map((p) => new THREE.Vector2(p.x, p.y))));
    const gold = this.track(new THREE.MeshPhysicalMaterial({ color: '#d6b46a', metalness: 1, roughness: 0.28, clearcoat: 0.6 }));
    const frame = new THREE.Mesh(this.track(new THREE.ExtrudeGeometry(frameShape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 32 })), gold);
    frame.position.set(0, -H / 2, -0.15);
    this.scene.add(frame);

    // light behind the door (revealed as it opens)
    this.glowPlane = new THREE.Mesh(
      this.track(new THREE.ShapeGeometry(arch(W, H), 32)),
      this.track(new THREE.MeshBasicMaterial({ color: '#fff1d6', transparent: true, opacity: 0 })),
    );
    this.glowPlane.position.set(0, -H / 2, -0.2);
    this.scene.add(this.glowPlane);

    // two leaves, each half the arch, hinged at the sides; plum with gold panel lines and the 25
    const leafMat = this.track(new THREE.MeshPhysicalMaterial({ color: '#3a1830', roughness: 0.45, sheen: 0.6, sheenColor: new THREE.Color('#c06a7a'), clearcoat: 0.3 }));
    const half = (sign: number) => {
      const s = new THREE.Shape();
      const pts = arch(W, H).getPoints(64).filter((p) => (sign < 0 ? p.x <= 0.001 : p.x >= -0.001));
      pts.sort((a, b) => (sign < 0 ? a.y - b.y : b.y - a.y));
      s.moveTo(0, 0);
      s.lineTo(sign * (W / 2), 0);
      for (const p of pts.sort((a, b) => a.y - b.y)) s.lineTo(p.x, p.y);
      s.lineTo(0, H);
      s.lineTo(0, 0);
      return s;
    };
    for (const [grp, sign] of [
      [this.left, -1],
      [this.right, 1],
    ] as const) {
      const leaf = new THREE.Mesh(this.track(new THREE.ExtrudeGeometry(half(sign), { depth: 0.12, bevelEnabled: false, curveSegments: 24 })), leafMat);
      leaf.position.set(-sign * (W / 2), 0, 0); // pivot at the hinge
      grp.add(leaf);
      // gold panel mouldings
      for (const [y, h] of [
        [0.4, 1.6],
        [2.3, 1.2],
      ]) {
        const panel = new THREE.LineSegments(this.track(new THREE.EdgesGeometry(new THREE.BoxGeometry(W / 2 - 0.45, h, 0.02))), this.track(new THREE.LineBasicMaterial({ color: '#e6c989' })));
        panel.position.set(-sign * (W / 2) + sign * (W / 4), y + h / 2, 0.13);
        grp.add(panel);
      }
      grp.position.set(sign * (W / 2), -H / 2, 0);
      this.scene.add(grp);
    }
    // the numeral across the two leaves
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#e6c989';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `500 190px ${SERIF}`;
    g.shadowColor = 'rgba(255, 210, 140, .8)';
    g.shadowBlur = 18;
    g.fillText('25', 256, 136);
    const numTex = this.track(new THREE.CanvasTexture(c));
    numTex.colorSpace = THREE.SRGBColorSpace;
    for (const [grp, sign] of [
      [this.left, -1],
      [this.right, 1],
    ] as const) {
      const m = new THREE.Mesh(this.track(new THREE.PlaneGeometry(0.6, 0.6)), this.track(new THREE.MeshBasicMaterial({ map: numTex, transparent: true })));
      // each leaf carries its half of the numeral
      m.geometry = this.track(new THREE.PlaneGeometry(0.6, 0.6));
      const uv = m.geometry.getAttribute('uv') as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setX(i, sign < 0 ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
      m.position.set(-sign * (W / 2) + sign * 0.3, H * 0.62, 0.14);
      grp.add(m);
    }

    // one light for every other chapter, around the arch
    const orb = this.track(new THREE.SphereGeometry(0.07, 16, 12));
    for (let i = 0; i < total; i++) {
      const a = Math.PI * (0.05 + (0.9 * i) / Math.max(1, total - 1));
      const m = new THREE.Mesh(orb, this.track(new THREE.MeshBasicMaterial({ color: '#5a3a4a' })));
      m.position.set(Math.cos(Math.PI - a) * (W / 2 + 0.62), -H / 2 + H - W / 2 + Math.sin(a) * (W / 2 + 0.62), 0.25);
      this.lights.push(m);
      this.scene.add(m);
    }

    // the light that pours out: a soft beam toward the camera and a stream of motes and hearts
    this.beam = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(1.6, 3.8, 10, 32, 1, true).rotateX(Math.PI / 2)),
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          uniforms: this.flood,
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
          fragmentShader: `uniform float uK, uTime; varying vec2 vUv; void main(){ float a = uK * .22 * pow(1. - vUv.y, 1.2) * (.85 + .15 * sin(vUv.x * 40. + uTime)); gl_FragColor = vec4(vec3(1., .9, .75) * a, a); }`,
        }),
      ),
    );
    this.beam.position.set(0, 0, 5);
    this.scene.add(this.beam);
    this.scene.add(this.makeStream());

    this.camera.position.set(0, 0, 11);
    this.begin();
  }

  private makeStream() {
    const n = this.low ? 400 : 800;
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
          uniforms: this.flood,
          vertexShader: `attribute vec4 aD; uniform float uTime, uK, uPx; varying float vA; varying float vHeart;
            void main(){
              float t = fract(aD.x + uTime * (.12 + aD.y * .1));
              vec3 p = vec3((aD.z - .5) * 2.4 * (1. + t * 2.5), (aD.w - .5) * 3.8 * (1. + t * 1.5), -0.3 + t * 12.);
              vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
              vA = uK * sin(3.1416 * t) * .9;
              vHeart = step(.85, aD.y);
              gl_PointSize = uPx * (1. + aD.y * 1.5) * (1. + vHeart * 2.) / -mv.z; }`,
          fragmentShader: `varying float vA; varying float vHeart;
            void main(){ vec2 c = gl_PointCoord - .5; float a;
              if (vHeart > .5) { vec2 p = vec2(c.x, -c.y) * 2.4; p.y -= .15; float h = p.x * p.x + pow(p.y - sqrt(abs(p.x)) * .6, 2.); a = smoothstep(.62, .45, h); }
              else { float d = length(c); a = smoothstep(.5, 0., d) * .5 + smoothstep(.12, 0., d); }
              a *= vA; gl_FragColor = vec4(mix(vec3(1., .92, .78), vec3(1., .62, .74), vHeart) * a, a); }`,
        }),
      ),
    );
    pts.frustumCulled = false;
    return pts;
  }

  /** How many of the other chapters are open (lights around the arch). */
  setProgress(done: number) {
    this.lit = done;
  }
  open() {
    if (this.openAt < 0) this.openAt = this.clock.getElapsedTime();
  }

  protected onResize(w: number, h: number) {
    this.u.uAspect.value = w / h;
    this.u.uPx.value = 60 * this.renderer.getPixelRatio() * (h / 800) * 1.4;
    this.camera.fov = w / h < 1 ? 64 : 42;
    this.lookY = w / h < 1 ? 0 : 0.45; // wide: sit the door a little lower, clear of the title
    this.camera.updateProjectionMatrix();
  }

  protected update(t: number) {
    this.u.uTime.value = this.still ? 0 : t;
    this.lights.forEach((m, i) => {
      const on = i < this.lit;
      (m.material as THREE.MeshBasicMaterial).color.set(on ? '#ffe2a8' : '#4a2a3a');
      m.scale.setScalar(on ? 1.3 + (this.still ? 0 : Math.sin(t * 2 + i) * 0.15) : 1);
    });
    const o = this.openAt < 0 ? -1 : t - this.openAt;
    const swing = ease(0.3, 2.2, o);
    this.left.rotation.y = swing * 1.75;
    this.right.rotation.y = -swing * 1.75;
    (this.glowPlane.material as THREE.MeshBasicMaterial).opacity = ease(0.3, 1.4, o);
    this.flood.uK.value = ease(0.6, 2, o);
    this.u.uGlow.value = 0.5 + ease(0.5, 3, o) * 1.2;
    // the camera floats, then passes through the doorway into the light
    const pass = ease(2.2, 5.2, o);
    const idle = this.still ? 0 : Math.sin(t * 0.3) * 0.12;
    // framed between the title and the words below it
    this.camera.position.set(this.still ? 0 : Math.sin(t * 0.07) * 0.4, idle + 0.1, 14 - pass * 15);
    this.camera.lookAt(0, this.lookY, -4);
    if (o > 5 && !this.through) {
      this.through = true;
      this.onThrough?.();
    }
  }
}

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Stage, makeNebula, ease } from './Stage';
import { SERIF } from '../../../utils/fonts';

/**
 * Chapter 3 · The Letter — a sealed envelope floating in warm candlelight. Opening it: the wax
 * seal cracks and flies off in a few red sparks, the flap swings open, and the letter slides
 * up toward her. The page then writes the letter itself.
 */
export class LetterScene extends Stage {
  private u = { uTime: { value: 0 }, uAspect: { value: 1 }, uPx: { value: 60 }, uGlow: { value: 0.9 } };
  private env = new THREE.Group();
  private flap = new THREE.Group();
  private seal = new THREE.Group();
  private letter: THREE.Mesh;
  private candle: THREE.PointLight;
  private sparks: THREE.Points;
  private sparkU = { uTime: { value: 0 }, uK: { value: 0 }, uPx: { value: 40 } };
  private openedAt = -1;
  private ndc = new THREE.Vector2();
  private fired = false;
  onOpened?: () => void;

  constructor(canvas: HTMLCanvasElement, alreadyOpen = false) {
    super(canvas, { dpr: 1.5 });
    this.renderer.toneMappingExposure = 0.82;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = this.track(pmrem.fromScene(room, 0.04).texture);
    this.scene.environmentIntensity = 0.22;
    room.dispose();
    pmrem.dispose();
    this.scene.add(makeNebula(this.u, ['#4a2a1a', '#a0585a']));
    this.scene.add(new THREE.AmbientLight('#6a4a5a', 0.22));
    this.candle = new THREE.PointLight('#ffb26b', 40, 20, 1.6);
    this.candle.position.set(2.5, 1.5, 3.5);
    this.candle.castShadow = true;
    this.scene.add(this.candle);
    const rim = new THREE.DirectionalLight('#f2c1cb', 1.1);
    rim.position.set(-4, 3, -3);
    this.scene.add(rim);

    // paper with a faint laid texture
    const paperTex = this.paperTexture();
    const paper = this.track(new THREE.MeshStandardMaterial({ color: '#efdcc2', roughness: 0.9, map: paperTex, side: THREE.DoubleSide }));
    const inner = this.track(new THREE.MeshStandardMaterial({ color: '#c98f7e', roughness: 0.85, side: THREE.DoubleSide }));
    const W = 4.2, H = 2.7;
    // back and front of the envelope (a thin box), with the pocket's diagonal folds drawn on
    const body = new THREE.Mesh(this.track(new THREE.BoxGeometry(W, H, 0.06)), paper);
    body.castShadow = body.receiveShadow = true;
    this.env.add(body);
    const folds = new THREE.Shape();
    folds.moveTo(-W / 2, -H / 2);
    folds.lineTo(0, 0.1);
    folds.lineTo(W / 2, -H / 2);
    const foldLine = new THREE.Line(this.track(new THREE.BufferGeometry().setFromPoints(folds.getPoints())), this.track(new THREE.LineBasicMaterial({ color: '#d9c4a8', transparent: true, opacity: 0.8 })));
    foldLine.position.z = 0.032;
    this.env.add(foldLine);
    // the flap: a triangle hinged along the top edge
    const tri = new THREE.Shape();
    tri.moveTo(-W / 2, 0);
    tri.lineTo(W / 2, 0);
    tri.lineTo(0, -H * 0.62);
    tri.lineTo(-W / 2, 0);
    const flapGeo = this.track(new THREE.ShapeGeometry(tri));
    const flapFront = new THREE.Mesh(flapGeo, paper);
    flapFront.position.z = 0.035;
    flapFront.castShadow = true;
    const flapBack = new THREE.Mesh(flapGeo, inner);
    flapBack.position.z = 0.03;
    this.flap.add(flapFront, flapBack);
    this.flap.position.set(0, H / 2, 0);
    this.env.add(this.flap);

    // the letter inside (slides out)
    const letterTex = this.letterTexture();
    this.letter = new THREE.Mesh(this.track(new THREE.PlaneGeometry(W * 0.9, H * 0.92)), this.track(new THREE.MeshStandardMaterial({ map: letterTex, roughness: 0.95, side: THREE.DoubleSide })));
    this.letter.position.set(0, 0, -0.01);
    this.letter.castShadow = true;
    this.env.add(this.letter);

    // the wax seal with an embossed heart
    const wax = this.track(new THREE.MeshPhysicalMaterial({ color: '#7d1428', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color('#ff8fa6') }));
    const disc = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.42, 0.46, 0.1, 40).rotateX(Math.PI / 2)), wax);
    const hs = new THREE.Shape();
    const k = 0.2;
    hs.moveTo(0, -k * 0.9);
    hs.bezierCurveTo(k * 1.2, -k * 0.2, k * 0.9, k * 0.9, 0, k * 0.35);
    hs.bezierCurveTo(-k * 0.9, k * 0.9, -k * 1.2, -k * 0.2, 0, -k * 0.9);
    const heart = new THREE.Mesh(this.track(new THREE.ExtrudeGeometry(hs, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 3 })), wax);
    heart.position.z = 0.05;
    this.seal.add(disc, heart);
    this.seal.position.set(0, H / 2 - H * 0.62 + 0.05, 0.1);
    this.env.add(this.seal);

    this.env.rotation.x = -0.12;
    this.env.scale.setScalar(0.72);
    this.scene.add(this.env);

    // warm dust and the seal's sparks
    this.sparks = this.makeSparks();
    this.scene.add(this.sparks);

    this.camera.position.set(0, 0.4, 9);
    canvas.addEventListener('pointermove', this.onMove);
    if (alreadyOpen) {
      this.openedAt = -100;
      this.fired = true;
    }
    this.begin();
  }

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };

  private paperTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(120, 90, 60, ${Math.random() * 0.05})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1);
    }
    for (let y = 0; y < 256; y += 4) {
      g.fillStyle = 'rgba(150, 120, 90, .03)';
      g.fillRect(0, y, 256, 1);
    }
    const t = this.track(new THREE.CanvasTexture(c));
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 2);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private letterTexture() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 440;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fbf4ea';
    g.fillRect(0, 0, 512, 440);
    g.fillStyle = 'rgba(58, 34, 38, .55)';
    // lines of handwriting, suggested (the real words are written by the page)
    for (let y = 70; y < 400; y += 30) {
      const w = 300 + Math.random() * 120;
      for (let x = 60; x < 60 + w; x += 8 + Math.random() * 18) g.fillRect(x, y + Math.sin(x * 0.2) * 1.5, 4 + Math.random() * 10, 2);
    }
    g.font = `italic 34px ${SERIF}`;
    g.fillStyle = 'rgba(58, 34, 38, .8)';
    g.fillText('Dear Dheepika,', 56, 44);
    const t = this.track(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private makeSparks() {
    const n = 160;
    const d = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) d.set([Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random(), Math.random()], i * 4);
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
          vertexShader: `attribute vec4 aD; uniform float uTime, uK, uPx; varying float vA; varying float vGold;
            void main(){
              // idle: warm dust drifting through the candlelight; on opening: red wax sparks burst from the seal
              vec3 dust = vec3(aD.x * 6., mod(aD.y * 4. + uTime * (.08 + aD.z * .1), 8.) - 4., aD.z * 3. - 1.);
              vec3 spark = vec3(0., .15, .3) + vec3(aD.x, aD.y + .6, aD.z) * uK * 2.4 + vec3(0., -uK * uK * 1.4, 0.);
              float s = step(.72, aD.w);
              vec3 p = mix(dust, spark, s);
              vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
              vA = mix(.35 * (.5 + .5 * sin(uTime * 2. + aD.w * 40.)), (1. - uK) * step(.001, uK), s);
              vGold = 1. - s;
              gl_PointSize = uPx * (.8 + aD.w) / -mv.z; }`,
          fragmentShader: `varying float vA; varying float vGold;
            void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d) * vA; gl_FragColor = vec4(mix(vec3(1., .35, .4), vec3(1., .8, .55), vGold) * a, a); }`,
        }),
      ),
    );
    pts.frustumCulled = false;
    return pts;
  }

  /** Break the seal and open the envelope (once). */
  open() {
    if (this.openedAt !== -1) return;
    this.openedAt = this.clock.getElapsedTime();
  }

  protected onResize(w: number, h: number) {
    this.u.uAspect.value = w / h;
    this.sparkU.uPx.value = 60 * this.renderer.getPixelRatio() * (h / 800);
    this.camera.fov = w / h < 1 ? 62 : 38;
    this.camera.updateProjectionMatrix();
  }

  protected update(t: number) {
    this.u.uTime.value = this.sparkU.uTime.value = this.still ? 0 : t;
    const o = this.openedAt === -1 ? -1 : this.openedAt < -50 ? 99 : t - this.openedAt;
    // candle flicker
    this.candle.intensity = 40 * (this.still ? 1 : 0.9 + Math.sin(t * 9) * 0.05 + Math.sin(t * 23) * 0.03);
    // the envelope floats and leans toward the pointer
    const float = this.still ? 0 : Math.sin(t * 0.9) * 0.08;
    this.env.position.y = -0.55 + float - ease(2, 3.2, o) * 0.4;
    this.env.rotation.y += ((o < 0 ? this.ndc.x * 0.25 : 0) - this.env.rotation.y) * 0.05;
    this.env.rotation.x += ((o < 0 ? -0.12 - this.ndc.y * 0.12 : -0.05) - this.env.rotation.x) * 0.05;
    // 1 · the seal lifts, turns and falls away with sparks
    const crack = ease(0, 0.7, o);
    this.seal.position.z = 0.1 + crack * 1.2;
    this.seal.position.y = 2.7 / 2 - 2.7 * 0.62 + 0.05 + crack * 0.4 - ease(0.5, 1.4, o) * 3;
    this.seal.rotation.set(crack * 1.2, crack * 2.2, crack * 0.8);
    this.seal.visible = o < 1.4;
    this.sparkU.uK.value = o < 0 ? 0 : ease(0, 1.1, o);
    // 2 · the flap swings open on its hinge
    this.flap.rotation.x = -ease(0.35, 1.3, o) * Math.PI * 0.92;
    // 3 · the letter slides up and toward her
    const slide = ease(1.2, 2.8, o);
    this.letter.position.set(0, slide * 2.3, 0.02 + slide * 0.6);
    this.letter.rotation.x = slide * 0.12;
    if (o > 2.8 && !this.fired) {
      this.fired = true;
      this.onOpened?.();
    }
    // camera: gentle drift, then a slow push toward the letter
    const push = ease(1.4, 3.4, o);
    this.camera.position.set(this.still ? 0 : Math.sin(t * 0.1) * 0.4, 0.4 + push * 0.8, 9 - push * 0.9);
    this.camera.lookAt(0, -0.3 + push * 1.1, 0);
  }

  dispose() {
    this.canvas.removeEventListener('pointermove', this.onMove);
    super.dispose();
  }
}

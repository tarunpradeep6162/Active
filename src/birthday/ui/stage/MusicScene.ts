import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Stage, makeNebula, makeStarfield, ease } from './Stage';
import { SERIF } from '../../../utils/fonts';


/**
 * Chapter 8 · Our Music Room — a walnut record player under one warm light. Choosing a song
 * writes its title on the label, swings the tonearm onto the record and spins it up; a ring
 * of light spreads from the needle and music notes rise from the grooves into the sky.
 * The page's placeholder (`setAnchor`) says where on screen the turntable should stand.
 */
export class MusicScene extends Stage {
  private u = { uTime: { value: 0 }, uAspect: { value: 1 }, uPx: { value: 60 }, uGlow: { value: 0.35 } };
  private notesU = { uTime: this.u.uTime, uPx: this.u.uPx, uOn: { value: 0 } };
  private rig = new THREE.Group();
  private disc = new THREE.Group();
  private arm = new THREE.Group();
  private armLift = new THREE.Group();
  private ring: THREE.Mesh;
  private label: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture };
  private playing = false;
  private spin = 0;
  private startedAt = -10;
  private anchor = { x: 0.5, y: 0.5, s: 0.4 };
  private ndc = new THREE.Vector2();

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { dpr: 1.5 });
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = this.track(pmrem.fromScene(room, 0.04).texture);
    this.scene.environmentIntensity = 0.35;
    room.dispose();
    pmrem.dispose();
    this.scene.add(makeNebula(this.u, ['#3a1a3a', '#9a5a4a']), makeStarfield(this.low ? 700 : 1400, this.u));
    this.scene.add(new THREE.AmbientLight('#6a4a5a', 0.35));
    const key = new THREE.SpotLight('#ffd9b0', 90, 30, 0.5, 0.7, 1.4);
    key.position.set(-2.5, 8, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(this.low ? 512 : 1024, this.low ? 512 : 1024);
    key.shadow.bias = -0.0004;
    this.scene.add(key, key.target);
    const rim = new THREE.DirectionalLight('#c08aa8', 1.2);
    rim.position.set(4, 2, -5);
    this.scene.add(rim);

    // plinth: warm walnut with a satin finish (grain painted into a canvas)
    const wood = this.track(new THREE.CanvasTexture(this.walnut()));
    wood.colorSpace = THREE.SRGBColorSpace;
    wood.anisotropy = 4;
    const plinth = new THREE.Mesh(
      this.track(new RoundedBoxGeometry(4.6, 0.5, 3.6, 4, 0.08)),
      this.track(new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 })),
    );
    plinth.position.y = -0.25;
    plinth.castShadow = plinth.receiveShadow = true;
    this.rig.add(plinth);
    // brushed top plate
    const steel = this.track(new THREE.MeshPhysicalMaterial({ color: '#b9b4ae', metalness: 1, roughness: 0.32 }));
    const brass = this.track(new THREE.MeshPhysicalMaterial({ color: '#d6b46a', metalness: 1, roughness: 0.26, clearcoat: 0.4 }));
    // feet
    for (const [x, z] of [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]]) {
      const f = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.22, 0.26, 0.16, 24)), brass);
      f.position.set(x, -0.58, z);
      this.rig.add(f);
    }

    // platter and record
    const platter = new THREE.Mesh(this.track(new THREE.CylinderGeometry(1.52, 1.52, 0.12, 96)), steel);
    platter.position.y = 0.06;
    platter.castShadow = platter.receiveShadow = true;
    this.disc.add(platter);
    const grooves = this.track(new THREE.CanvasTexture(this.grooves()));
    grooves.colorSpace = THREE.SRGBColorSpace;
    grooves.anisotropy = 8;
    const vinyl = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(1.46, 1.46, 0.03, 128)),
      [
        this.track(new THREE.MeshPhysicalMaterial({ color: '#0c0b0e', roughness: 0.3 })),
        this.track(new THREE.MeshPhysicalMaterial({ map: grooves, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.18, sheen: 0.4, sheenColor: new THREE.Color('#8a6a9a') })),
        this.track(new THREE.MeshPhysicalMaterial({ color: '#0c0b0e', roughness: 0.3 })),
      ],
    );
    vinyl.position.y = 0.135;
    vinyl.receiveShadow = true;
    this.disc.add(vinyl);
    const lc = document.createElement('canvas');
    lc.width = lc.height = 512;
    this.label = { canvas: lc, tex: this.track(new THREE.CanvasTexture(lc)) };
    this.label.tex.colorSpace = THREE.SRGBColorSpace;
    this.drawLabel('');
    const label = new THREE.Mesh(this.track(new THREE.CircleGeometry(0.52, 64).rotateX(-Math.PI / 2)), this.track(new THREE.MeshPhysicalMaterial({ map: this.label.tex, roughness: 0.6 })));
    label.position.y = 0.152;
    this.disc.add(label);
    const spindle = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 12)), steel);
    spindle.position.y = 0.2;
    this.disc.add(spindle);
    this.disc.position.set(-0.55, 0, 0);
    this.rig.add(this.disc);

    // tonearm: a pivot tower, a slim tube, a headshell with a needle, and a counterweight
    const tower = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.2, 0.24, 0.34, 32)), brass);
    tower.position.y = 0.17;
    tower.castShadow = true;
    this.arm.add(tower);
    this.armLift.position.y = 0.3;
    this.arm.add(this.armLift);
    const tube = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.035, 0.035, 2.3, 16).rotateX(Math.PI / 2)), steel);
    tube.position.z = 1.05;
    tube.castShadow = true;
    this.armLift.add(tube);
    const head = new THREE.Mesh(this.track(new RoundedBoxGeometry(0.22, 0.07, 0.36, 2, 0.02)), this.track(new THREE.MeshPhysicalMaterial({ color: '#1a1418', roughness: 0.4, clearcoat: 0.6 })));
    head.position.set(-0.06, -0.06, 2.24);
    head.rotation.y = 0.35;
    head.castShadow = true;
    this.armLift.add(head);
    const weight = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 32).rotateX(Math.PI / 2)), steel);
    weight.position.z = -0.3;
    this.armLift.add(weight);
    this.arm.position.set(1.55, 0, -1.15);
    this.rig.add(this.arm);
    // a small brass start button and speed dial
    for (const [x, z, r] of [[-1.95, 1.35, 0.14], [-1.55, 1.35, 0.1]]) {
      const b = new THREE.Mesh(this.track(new THREE.CylinderGeometry(r, r, 0.06, 32)), brass);
      b.position.set(x, 0.03, z);
      this.rig.add(b);
    }

    // a ring of light that spreads from the needle when a song starts
    this.ring = new THREE.Mesh(
      this.track(new THREE.RingGeometry(0.95, 1, 96).rotateX(-Math.PI / 2)),
      this.track(new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })),
    );
    this.ring.position.set(-0.55, 0.16, 0);
    this.rig.add(this.ring);
    this.rig.add(this.makeNotes());
    this.scene.add(this.rig);

    this.camera.position.set(0, 5.2, 8.2);
    addEventListener('pointermove', this.onMove, { passive: true });
    this.begin();
  }

  private onMove = (e: PointerEvent) => this.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);

  private walnut() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    const g = c.getContext('2d')!;
    const grd = g.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#4a2c1c');
    grd.addColorStop(1, '#3a2014');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 260; i++) {
      const y = Math.random() * 512;
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? '20,10,6' : '120,72,40'},${0.08 + Math.random() * 0.14})`;
      g.lineWidth = 0.6 + Math.random() * 2.4;
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= 1024; x += 32) g.lineTo(x, y + Math.sin(x * 0.006 + i) * 6 + Math.sin(x * 0.02 + i * 3) * 1.5);
      g.stroke();
    }
    return c;
  }

  private grooves() {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d')!;
    g.fillStyle = '#0b0a0d';
    g.fillRect(0, 0, 1024, 1024);
    // grooves in five tracks, the gaps between them slightly glossier
    for (let r = 190; r < 505; r += 1.6) {
      const gap = [250, 310, 370, 430].some((b) => Math.abs(r - b) < 4);
      g.strokeStyle = gap ? 'rgba(90,86,100,.5)' : `rgba(${40 + Math.random() * 30},${38 + Math.random() * 26},${48 + Math.random() * 30},.45)`;
      g.lineWidth = gap ? 3 : 0.7;
      g.beginPath();
      g.arc(512, 512, r, 0, Math.PI * 2);
      g.stroke();
    }
    return c;
  }

  private drawLabel(title: string) {
    const { canvas: c, tex } = this.label;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(256, 256, 20, 256, 256, 256);
    grd.addColorStop(0, '#e98aa6');
    grd.addColorStop(1, '#7a2346');
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(255,233,190,.7)';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(256, 256, 238, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#fff1dc';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `500 44px ${SERIF}`;
    g.fillText('25 · 11', 256, 120);
    g.font = `italic 500 ${title.length > 16 ? 40 : 54}px ${SERIF}`;
    const words = (title || '♪').split(' ');
    const lines: string[] = [];
    for (const w of words) {
      const cur = lines[lines.length - 1];
      if (cur && g.measureText(`${cur} ${w}`).width < 380) lines[lines.length - 1] = `${cur} ${w}`;
      else lines.push(w);
    }
    lines.slice(0, 3).forEach((l, i, a) => g.fillText(l, 256, 360 + (i - (a.length - 1) / 2) * 50));
    g.font = `500 22px ${SERIF}`;
    g.fillText('FOR DHEEPIKA', 256, 176);
    g.fillStyle = '#1a0c14';
    g.beginPath();
    g.arc(256, 256, 12, 0, Math.PI * 2);
    g.fill();
    tex.needsUpdate = true;
  }

  private makeNotes() {
    const n = this.low ? 60 : 110;
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
          uniforms: this.notesU,
          vertexShader: `attribute vec4 aD; uniform float uTime, uPx, uOn; varying float vA; varying float vRot; varying float vMix;
            void main(){
              float k = fract(aD.x + uTime * (.06 + aD.y * .05));
              float r = .5 + aD.z * 1.;
              float a = aD.w * 6.2832 + k * 2.;
              vec3 p = vec3(-.55 + cos(a) * r * (1. + k * .8), .2 + k * 6.5, sin(a) * r * (1. + k * .8));
              vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
              vA = uOn * smoothstep(0., .12, k) * smoothstep(1., .6, k) * (.5 + .5 * aD.y);
              vRot = sin(uTime * 1.5 + aD.w * 20.) * .5;
              vMix = aD.z;
              gl_PointSize = uPx * (2.4 + aD.y * 2.) / -mv.z; }`,
          fragmentShader: `varying float vA; varying float vRot; varying float vMix;
            void main(){
              vec2 c = gl_PointCoord - .5; c.y = -c.y;
              c = mat2(cos(vRot), -sin(vRot), sin(vRot), cos(vRot)) * c;
              vec2 q = c + vec2(.08, .18);
              float a = smoothstep(.16, .1, length(q * vec2(1., 1.3)));
              a += step(abs(c.x - .06), .025) * step(-.18, c.y) * step(c.y, .28);
              a += step(abs(c.y - .26), .04) * step(.06, c.x) * step(c.x, .26) * step(.5, vMix);
              a = min(a, 1.) * vA;
              gl_FragColor = vec4(mix(vec3(1., .85, .6), vec3(1., .7, .8), vMix) * a, a);
            }`,
        }),
      ),
    );
    pts.frustumCulled = false;
    return pts;
  }

  /** Where the page's placeholder stands: centre (0…1 of the viewport) and height fraction. */
  setAnchor(x: number, y: number, s: number) {
    this.anchor = { x, y, s };
  }
  play(title: string) {
    this.drawLabel(title);
    this.playing = true;
    this.startedAt = this.clock.getElapsedTime();
  }
  pause() {
    this.playing = false;
  }

  protected onResize(w: number, h: number) {
    this.u.uAspect.value = w / h;
    this.u.uPx.value = 60 * this.renderer.getPixelRatio() * (h / 800) * 1.4;
    this.camera.fov = w / h < 1 ? 50 : 34;
    this.camera.updateProjectionMatrix();
  }

  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private hit = new THREE.Vector3();

  protected update(t: number, dt: number) {
    this.u.uTime.value = this.still ? 0 : t;
    const px = this.still ? 0 : this.ndc.x * 0.4;
    this.camera.position.set(px, 5.2 + (this.still ? 0 : this.ndc.y * 0.25), 8.2);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateMatrixWorld();
    // stand the turntable where the page's placeholder is, sized to it
    this.ray.setFromCamera(new THREE.Vector2(this.anchor.x * 2 - 1, -(this.anchor.y * 2 - 1)), this.camera);
    if (this.ray.ray.intersectPlane(this.plane, this.hit)) {
      this.rig.position.lerp(this.hit, this.rig.position.lengthSq() ? 0.12 : 1);
      const dist = this.camera.position.distanceTo(this.hit);
      const viewH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
      this.rig.scale.setScalar((this.anchor.s * viewH) / 5.8);
    }
    this.rig.rotation.y = -0.18 + (this.still ? 0 : Math.sin(t * 0.15) * 0.04);
    // spin up and down like a real platter (33⅓ rpm)
    this.spin += ((this.playing ? 3.49 : 0) - this.spin) * Math.min(1, dt * (this.playing ? 1.4 : 0.9));
    this.disc.rotation.y -= this.spin * dt;
    // the tonearm swings over, then lowers the needle into the groove
    const k = this.playing ? ease(0, 1.2, t - this.startedAt) : 0;
    this.arm.rotation.y += ((this.playing ? -0.52 : 0) - this.arm.rotation.y) * 0.06;
    const lift = this.playing ? -0.05 + ease(0.9, 1.5, t - this.startedAt) * 0.07 : -0.05;
    this.armLift.rotation.x += (lift - this.armLift.rotation.x) * 0.15;
    const r = t - this.startedAt;
    const m = this.ring.material as THREE.MeshBasicMaterial;
    m.opacity = r > 1.2 && r < 3.2 ? (1 - ease(1.2, 3.2, r)) * 0.8 : 0;
    this.ring.scale.setScalar(0.3 + ease(1.2, 3.2, r) * 2.2);
    this.notesU.uOn.value += ((this.playing ? k : 0) - this.notesU.uOn.value) * 0.04;
    this.u.uGlow.value = 0.35 + this.notesU.uOn.value * 0.35;
  }

  dispose() {
    removeEventListener('pointermove', this.onMove);
    super.dispose();
  }
}

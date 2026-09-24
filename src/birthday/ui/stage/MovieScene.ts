import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Stage, makeNebula, makeStarfield, ease } from './Stage';

const SERIF = "'Cormorant Garamond', Georgia, serif";

/**
 * Chapter 13 · Our Little Movie — a small velvet cinema floating in the stars. The house lights
 * dim, the curtains part, a projector beam full of dust lights the screen and the rows of seats
 * in front of it. Until her own clips are added, the screen plays a film‑leader countdown.
 * At the end the curtains close again. The screen always lies under the page's screen box
 * (`setAnchor`), so photos and videos in the page sit exactly on it.
 */
export class MovieScene extends Stage {
  private u = { uTime: { value: 0 }, uAspect: { value: 1 }, uPx: { value: 60 }, uGlow: { value: 0.25 } };
  private screenU = { uTime: this.u.uTime, uOn: { value: 0 }, uLeader: { value: null as THREE.Texture | null }, uClip: { value: 0 }, uFlash: { value: 0 } };
  private beamU = { uTime: this.u.uTime, uOn: { value: 0 } };
  private dustU = { uTime: this.u.uTime, uPx: this.u.uPx, uOn: { value: 0 }, uP: { value: new THREE.Vector3() }, uC: { value: new THREE.Vector3() }, uHalf: { value: new THREE.Vector2(1, 1) } };
  private theatre = new THREE.Group();
  private curtains: THREE.Group[] = [];
  private beam: THREE.Mesh;
  private sconces: THREE.Mesh[] = [];
  private house: THREE.SpotLight;
  private screenLight: THREE.PointLight;
  private rows: THREE.Group[] = [];
  private leader: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture };
  private anchor = { l: 0.2, t: 0.25, w: 0.6, h: 0.34 };
  private state: 'closed' | 'open' | 'end' = 'closed';
  private openK = 0;
  private clipAt = -10;
  private projector = new THREE.Vector3(0, 4.2, 11.5);

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { dpr: 1.5 });
    this.renderer.toneMappingExposure = 1;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = this.track(pmrem.fromScene(room, 0.04).texture);
    this.scene.environmentIntensity = 0.2;
    room.dispose();
    pmrem.dispose();
    this.scene.add(makeNebula(this.u, ['#1a1a2a', '#5a3a4a']), makeStarfield(this.low ? 700 : 1400, this.u));
    this.scene.add(new THREE.AmbientLight('#5a4a6a', 0.3));
    this.house = new THREE.SpotLight('#ffcf9a', 70, 40, 0.55, 0.8, 1.3);
    this.house.position.set(0, 9, 10);
    this.scene.add(this.house, this.house.target);
    this.screenLight = new THREE.PointLight('#dfe6ff', 0, 30, 1.2);
    this.scene.add(this.screenLight);

    // everything around the screen is built in "screen units": the screen is 16 × 9
    const gold = this.track(new THREE.MeshPhysicalMaterial({ color: '#d6b46a', metalness: 1, roughness: 0.3, clearcoat: 0.5 }));
    const velvet = this.track(new THREE.MeshPhysicalMaterial({ color: '#3e0616', roughness: 0.82, sheen: 0.7, sheenRoughness: 0.5, sheenColor: new THREE.Color('#c0405e') }));
    const lc = document.createElement('canvas');
    lc.width = 512;
    lc.height = 288;
    this.leader = { canvas: lc, tex: this.track(new THREE.CanvasTexture(lc)) };
    this.leader.tex.colorSpace = THREE.SRGBColorSpace;
    this.screenU.uLeader.value = this.leader.tex;
    this.drawLeader(5);
    const screen = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(16, 9)),
      this.track(
        new THREE.ShaderMaterial({
          uniforms: this.screenU,
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
          fragmentShader: `uniform float uTime, uOn, uClip, uFlash; uniform sampler2D uLeader; varying vec2 vUv;
            float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
            void main(){
              vec2 p = (vUv - .5) * vec2(16. / 9., 1.);
              // film leader: rings, a cross, a sweeping hand and the number
              float r = length(p);
              float ring = smoothstep(.012, 0., abs(r - .36)) + smoothstep(.008, 0., abs(r - .3));
              float cross = smoothstep(.005, 0., abs(p.x)) + smoothstep(.005, 0., abs(p.y));
              float a = fract(atan(p.x, p.y) / 6.2832 + .5);
              float sweep = step(a, fract(uClip)) * step(r, .36) * .35;
              vec3 col = vec3(.78, .74, .68) * (.55 + sweep) ;
              col = mix(col, vec3(.12, .1, .1), clamp(ring + cross * .6, 0., 1.));
              vec4 num = texture2D(uLeader, vUv);
              col = mix(col, vec3(.08, .07, .08), num.a);
              // grain, scratches, flicker, vignette
              col *= .9 + .1 * h(vUv * 400. + floor(uTime * 24.));
              col *= 1. - step(.997, h(vec2(floor(vUv.x * 300.), floor(uTime * 12.)))) * .5;
              col *= .92 + .08 * sin(uTime * 50.);
              col *= smoothstep(1.05, .35, length((vUv - .5) * vec2(1.6, 1.8)));
              col += uFlash * .6;
              vec3 off = vec3(.03, .025, .035);
              gl_FragColor = vec4(mix(off, col, uOn), 1.);
            }`,
        }),
      ),
    );
    this.theatre.add(screen);
    // soft glow the screen throws onto its frame
    const halo = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(26, 17)),
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uOn: this.screenU.uOn },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv - .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
          fragmentShader: `uniform float uOn; varying vec2 vUv; void main(){ vec2 q = abs(vUv) - vec2(.3, .26); float d = length(max(q, 0.)); float a = exp(-d * 9.) * .35 * uOn * step(.0001, d); gl_FragColor = vec4(vec3(.85, .88, 1.) * a, a); }`,
        }),
      ),
    );
    halo.position.z = -0.05;
    this.theatre.add(halo);

    // proscenium: a gold frame with fluted pilasters, a velvet pelmet with gold fringe
    const W = 19, H = 11;
    for (const sx of [-1, 1]) {
      const pil = new THREE.Mesh(this.track(new RoundedBoxGeometry(1.1, H + 2, 1.2, 3, 0.2)), gold);
      pil.position.set(sx * (W / 2 + 0.55), -0.4, 0.8);
      this.theatre.add(pil);
      for (let k = -1; k <= 1; k++) {
        const flute = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.06, 0.06, H + 1, 8)), this.track(new THREE.MeshStandardMaterial({ color: '#6a5020', roughness: 0.6 })));
        flute.position.set(sx * (W / 2 + 0.55) + k * 0.3, -0.4, 1.42);
        this.theatre.add(flute);
      }
    }
    const top = new THREE.Mesh(this.track(new RoundedBoxGeometry(W + 3.4, 0.8, 1.4, 3, 0.2)), gold);
    top.position.set(0, H / 2 + 0.85, 0.9);
    this.theatre.add(top);
    const pelmet = new THREE.Mesh(this.fold(W + 2, 2.2, 36, 0.18), velvet);
    pelmet.position.set(0, H / 2 - 0.35, 1.5);
    this.theatre.add(pelmet);
    const fringe = new THREE.Mesh(this.track(new THREE.BoxGeometry(W + 2, 0.12, 0.1)), gold);
    fringe.position.set(0, H / 2 - 1.45, 1.75);
    this.theatre.add(fringe);
    // the two curtains, pivoting at the outer edges so they gather to the sides when opened
    for (const sx of [-1, 1]) {
      const g = new THREE.Group();
      const c = new THREE.Mesh(this.fold(W / 2 + 0.6, H + 0.6, 30, 0.34, -sx), velvet);
      c.position.x = -sx * (W / 4 + 0.3);
      g.add(c);
      g.position.set(sx * (W / 2), -0.2, 1.1);
      this.curtains.push(g);
      this.theatre.add(g);
    }
    // warm sconces either side (the house lights)
    for (const sx of [-1, 1]) {
      const s = new THREE.Mesh(
        this.track(new THREE.PlaneGeometry(3, 3)),
        this.track(
          new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            uniforms: { uA: { value: 1 } },
            vertexShader: `varying vec2 vUv; void main(){ vUv = uv - .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
            fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ float r = length(vUv * vec2(1., .8)); float a = (exp(-r * 9.) + smoothstep(.06, 0., r)) * uA; gl_FragColor = vec4(vec3(1., .72, .4) * a, a); }`,
          }),
        ),
      );
      s.position.set(sx * (W / 2 + 2.6), 2.4, 0.6);
      this.sconces.push(s);
      this.theatre.add(s);
    }
    this.scene.add(this.theatre);

    // rows of velvet seats in front of us (placed at the bottom of the frame on resize)
    const seatGeo = this.track(new RoundedBoxGeometry(0.9, 1.1, 0.35, 3, 0.14));
    const seatMat = this.track(new THREE.MeshPhysicalMaterial({ color: '#22050f', roughness: 0.85, sheen: 0.5, sheenColor: new THREE.Color('#a04060') }));
    for (let r = 0; r < 3; r++) {
      const row = new THREE.Group();
      for (let k = -9; k <= 9; k++) {
        const s = new THREE.Mesh(seatGeo, seatMat);
        s.position.x = k * 1.02 + (r % 2) * 0.5;
        s.rotation.x = -0.12;
        row.add(s);
      }
      this.rows.push(row);
      this.scene.add(row);
    }

    // the projector beam (a lit frustum from the booth to the screen) and dust in it
    const bg = this.track(new THREE.BufferGeometry());
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
    bg.setAttribute('aT', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 1, 1, 1, 1]), 1));
    bg.setIndex([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
    this.beam = new THREE.Mesh(
      bg,
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          uniforms: this.beamU,
          vertexShader: `attribute float aT; varying float vT; varying vec3 vP; void main(){ vT = aT; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
          fragmentShader: `uniform float uTime, uOn; varying float vT; varying vec3 vP;
            void main(){ float n = .75 + .25 * sin(vP.x * 3. + uTime * .7) * sin(vP.y * 2.3 - uTime * .5);
              float a = uOn * .055 * n * smoothstep(0., .25, vT) * (.9 + .1 * sin(uTime * 48.));
              gl_FragColor = vec4(vec3(.85, .9, 1.) * a, a); }`,
        }),
      ),
    );
    this.beam.frustumCulled = false;
    this.scene.add(this.beam);
    this.scene.add(this.makeDust());

    this.camera.position.set(0, 0.2, 10);
    this.begin();
  }

  /** A pleated cloth: a plane whose vertices fold in and out (sideways gather for curtains). */
  private fold(w: number, h: number, folds: number, depth: number, gatherSide = 0) {
    const g = this.track(new THREE.PlaneGeometry(w, h, folds * 6, 8));
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const u = x / w + 0.5;
      const f = Math.sin(u * folds * Math.PI * 2) * depth * (1 + 0.3 * Math.sin(u * 7 + 1));
      // a gentle swag toward the bottom of the inner edge
      const sw = gatherSide ? Math.max(0, (gatherSide > 0 ? 1 - u : u) - 0.6) * Math.max(0, -y / h) * 0.6 : 0;
      p.setZ(i, f + sw);
    }
    g.computeVertexNormals();
    return g;
  }

  private makeDust() {
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
          uniforms: this.dustU,
          vertexShader: `attribute vec4 aD; uniform float uTime, uPx, uOn; uniform vec3 uP, uC; uniform vec2 uHalf; varying float vA;
            void main(){
              float t = .15 + .8 * aD.z;
              vec3 target = uC + vec3((aD.x - .5) * 2. * uHalf.x, (aD.y - .5) * 2. * uHalf.y, 0.);
              vec3 p = mix(uP, target, t);
              p += vec3(sin(uTime * .3 + aD.w * 30.), cos(uTime * .23 + aD.w * 20.), sin(uTime * .2 + aD.x * 9.)) * .08;
              vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
              vA = uOn * (.25 + .75 * aD.w) * (.6 + .4 * sin(uTime * 2. + aD.w * 40.));
              gl_PointSize = uPx * (.35 + aD.w * .5) / -mv.z; }`,
          fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d) * vA; gl_FragColor = vec4(vec3(1., .95, .88) * a, a); }`,
        }),
      ),
    );
    pts.frustumCulled = false;
    return pts;
  }

  private drawLeader(n: number) {
    const { canvas: c, tex } = this.leader;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = '#000';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 150px ${SERIF}`;
    g.fillText(String(n), 256, 150);
    tex.needsUpdate = true;
  }

  /** The page's screen box, as fractions of the viewport. */
  setAnchor(l: number, t: number, w: number, h: number) {
    this.anchor = { l, t, w, h };
  }
  open() {
    this.state = 'open';
  }
  close() {
    this.state = 'end';
  }
  /** A new clip: a flicker of the projector, and the leader counts down. */
  clip(i: number, count: number) {
    this.clipAt = this.clock.getElapsedTime();
    this.drawLeader(Math.max(1, count - i));
  }

  protected onResize(w: number, h: number) {
    this.u.uAspect.value = w / h;
    this.u.uPx.value = 60 * this.renderer.getPixelRatio() * (h / 800) * 1.4;
    this.camera.fov = w / h < 1 ? 56 : 40;
    this.camera.updateProjectionMatrix();
    // seat rows peek in at the bottom of the frame
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.rows.forEach((row, r) => {
      const z = 4.8 - r * 1.2;
      const d = this.camera.position.z - z;
      row.position.set(0, this.camera.position.y - d * tan - 0.05 + r * 0.12, z);
    });
  }

  private v = new THREE.Vector3();
  private corner(x: number, y: number, out: THREE.Vector3) {
    this.v.set(x * 2 - 1, -(y * 2 - 1), 0.5).unproject(this.camera).sub(this.camera.position).normalize();
    return out.copy(this.camera.position).addScaledVector(this.v, -this.camera.position.z / this.v.z);
  }
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();

  protected update(t: number, dt: number) {
    this.u.uTime.value = this.still ? 0 : t;
    this.camera.position.x = this.still ? 0 : Math.sin(t * 0.08) * 0.12;
    this.camera.lookAt(0, 0.2, 0);
    this.camera.updateMatrixWorld();
    // lay the screen exactly under the page's screen box
    const { l, t: top, w, h } = this.anchor;
    this.corner(l, top, this.a);
    this.corner(l + w, top + h, this.b);
    const sw = Math.abs(this.b.x - this.a.x);
    this.theatre.position.set((this.a.x + this.b.x) / 2, (this.a.y + this.b.y) / 2, 0);
    this.theatre.scale.setScalar(sw / 16);
    // curtains gather to the sides as the show begins, and fall closed at the end
    const target = this.state === 'open' ? 1 : 0;
    this.openK += (target - this.openK) * Math.min(1, dt * (this.state === 'open' ? 1.1 : 0.8));
    const k = this.openK;
    this.curtains.forEach((c) => {
      c.scale.x = 1 - k * 0.85;
      c.rotation.z = (c.position.x > 0 ? 1 : -1) * k * 0.02;
    });
    const on = ease(0.35, 0.9, k) * (this.state === 'open' ? 1 : 0.4);
    this.screenU.uOn.value += (on - this.screenU.uOn.value) * 0.08;
    const f = t - this.clipAt;
    this.screenU.uFlash.value = f >= 0 && f < 0.35 ? (1 - f / 0.35) * 0.8 : 0;
    this.screenU.uClip.value = this.still ? 0.25 : f * 0.9;
    this.beamU.uOn.value = this.dustU.uOn.value = this.screenU.uOn.value;
    // house lights down while the film runs
    const houseOn = 1 - this.screenU.uOn.value * 0.85;
    this.house.intensity = 70 * houseOn;
    this.sconces.forEach((s) => ((s.material as THREE.ShaderMaterial).uniforms.uA.value = 0.25 + houseOn * 0.75));
    this.screenLight.position.set(this.theatre.position.x, this.theatre.position.y, 2.5);
    this.screenLight.intensity = 40 * this.screenU.uOn.value * (0.9 + (this.still ? 0 : 0.1 * Math.sin(t * 40)));
    this.u.uGlow.value = 0.18 + houseOn * 0.12;
    // beam from the booth (above and behind us) to the four corners of the screen
    const pos = this.beam.geometry.getAttribute('position') as THREE.BufferAttribute;
    const P = this.projector, s = 0.12;
    pos.setXYZ(0, P.x - s, P.y - s, P.z);
    pos.setXYZ(1, P.x + s, P.y - s, P.z);
    pos.setXYZ(2, P.x + s, P.y + s, P.z);
    pos.setXYZ(3, P.x - s, P.y + s, P.z);
    const x0 = Math.min(this.a.x, this.b.x), x1 = Math.max(this.a.x, this.b.x), y0 = Math.min(this.a.y, this.b.y), y1 = Math.max(this.a.y, this.b.y);
    pos.setXYZ(4, x0, y0, 0.02);
    pos.setXYZ(5, x1, y0, 0.02);
    pos.setXYZ(6, x1, y1, 0.02);
    pos.setXYZ(7, x0, y1, 0.02);
    pos.needsUpdate = true;
    this.dustU.uP.value.copy(P);
    this.dustU.uC.value.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    this.dustU.uHalf.value.set((x1 - x0) / 2, (y1 - y0) / 2);
  }
}

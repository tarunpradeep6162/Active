import * as THREE from 'three';
import { Stage, makeNebula, makeStarfield, ease } from './Stage';

const SERIF = "'Cormorant Garamond', Georgia, serif";

/**
 * Chapter 9 · Our Timeline — a river of light winding away into the stars, with a lantern
 * standing at every date. Moving through the story carries the camera along the river; the
 * path lights up behind her as she travels, the lantern she reaches flares, and the dates
 * still ahead wait softly. The last stop is an open horizon: the part not written yet.
 */
export class TimelineScene extends Stage {
  private u = { uTime: { value: 0 }, uAspect: { value: 1 }, uPx: { value: 60 }, uGlow: { value: 0.3 } };
  private pathU = { uTime: this.u.uTime, uProg: { value: 0 } };
  private curve: THREE.CatmullRomCurve3;
  private stops: { t: number; orb: THREE.Sprite; pillar: THREE.Sprite; label: THREE.Sprite; ring: THREE.Mesh; arrivedAt: number }[] = [];
  private horizon: THREE.Sprite;
  private stars: THREE.Points;
  private target = 0;
  private cur = 0;
  private vel = 0;
  private index = 0;
  private readonly count: number;
  private lookY = -0.3;

  constructor(canvas: HTMLCanvasElement, labels: string[]) {
    super(canvas, { dpr: 1.5 });
    this.count = labels.length;
    // the far stars travel with us (the fireflies along the river give the sense of motion)
    this.stars = makeStarfield(this.low ? 900 : 1800, this.u);
    this.scene.add(makeNebula(this.u, ['#2a1a3a', '#7a4a5a']), this.stars);
    this.scene.fog = new THREE.FogExp2('#0a0812', 0.012);

    // the river's course: a lead‑in, one point per date, then on toward the horizon
    const pts: THREE.Vector3[] = [];
    const at = (k: number) => new THREE.Vector3(Math.sin(k * 1.25) * 3.4, Math.sin(k * 0.6) * 0.6 + k * 0.18, -k * 9);
    for (let k = -1; k <= this.count + 2; k++) pts.push(at(k));
    this.curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const tOf = (k: number) => (k + 1) / (pts.length - 1);

    this.scene.add(this.makeRiver(), this.makeFireflies());
    const glow = this.track(this.glowTexture());
    const pillarTex = this.track(this.pillarTexture());
    labels.forEach((text, k) => {
      const t = tOf(k);
      const p = this.curve.getPoint(t);
      const orb = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: glow, color: '#ffd9a0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
      orb.position.copy(p).add(new THREE.Vector3(0, 1.1, 0));
      orb.scale.setScalar(1.6);
      const pillar = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: pillarTex, color: '#ffcf9a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
      pillar.position.copy(p).add(new THREE.Vector3(0, 0.6, 0));
      pillar.scale.set(0.35, 1.3, 1);
      const label = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: this.track(this.labelTexture(text)), transparent: true, depthWrite: false })));
      label.position.copy(p).add(new THREE.Vector3(0, 1.95, 0));
      label.scale.set(2.6, 0.65, 1);
      const ring = new THREE.Mesh(
        this.track(new THREE.RingGeometry(0.9, 1, 64).rotateX(-Math.PI / 2)),
        this.track(new THREE.MeshBasicMaterial({ color: '#ffe2b0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })),
      );
      ring.position.copy(p).add(new THREE.Vector3(0, 0.05, 0));
      this.scene.add(orb, pillar, label, ring);
      this.stops.push({ t, orb, pillar, label, ring, arrivedAt: -10 });
    });
    // the horizon beyond the last date
    this.horizon = new THREE.Sprite(this.track(new THREE.SpriteMaterial({ map: glow, color: '#ffe8c8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
    this.horizon.scale.setScalar(34);
    this.scene.add(this.horizon);

    this.cur = this.target = this.stops[0].t;
    this.stops[0].arrivedAt = 0;
    this.begin();
  }

  private makeRiver() {
    const S = 900;
    const pos = new Float32Array(S * 2 * 3), at = new Float32Array(S * 2), side = new Float32Array(S * 2);
    const up = new THREE.Vector3(0, 1, 0), sv = new THREE.Vector3();
    const idx: number[] = [];
    for (let i = 0; i < S; i++) {
      const t = i / (S - 1);
      const p = this.curve.getPoint(t), tan = this.curve.getTangent(t);
      sv.crossVectors(tan, up).normalize().multiplyScalar(0.38);
      pos.set([p.x - sv.x, p.y, p.z - sv.z, p.x + sv.x, p.y, p.z + sv.z], i * 6);
      at.set([t, t], i * 2);
      side.set([-1, 1], i * 2);
      if (i < S - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = this.track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aT', new THREE.BufferAttribute(at, 1));
    g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
    g.setIndex(idx);
    const m = new THREE.Mesh(
      g,
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          uniforms: this.pathU,
          vertexShader: `attribute float aT; attribute float aSide; varying float vT; varying float vS; varying float vD;
            void main(){ vT = aT; vS = aSide; vec4 mv = modelViewMatrix * vec4(position, 1.); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
          fragmentShader: `uniform float uTime, uProg; varying float vT; varying float vS; varying float vD;
            void main(){
              float edge = 1. - abs(vS);
              float core = smoothstep(.75, 1., edge);
              float body = pow(edge, 1.6);
              float lit = smoothstep(uProg + .004, uProg - .01, vT);
              // light flowing forward along the river; dotted and faint where it isn't written yet
              float flow = .5 + .5 * sin(vT * 900. - uTime * 3.);
              float ahead = (1. - lit) * step(.5, fract(vT * 160.)) * .5;
              vec3 warm = vec3(1., .78, .5), cool = vec3(.62, .52, .82);
              vec3 col = mix(cool * (.25 + ahead), warm * (.55 + .45 * flow), lit) * body + vec3(1., .95, .85) * core * (.2 + lit * .9);
              float a = (body * (.28 + lit * .5) + core * (.15 + lit * .7)) * smoothstep(90., 20., vD) * smoothstep(2., 9., vD);
              gl_FragColor = vec4(col * a, a);
            }`,
        }),
      ),
    );
    m.frustumCulled = false;
    return m;
  }

  private makeFireflies() {
    const n = this.low ? 500 : 1000;
    const pos = new Float32Array(n * 3), d = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = this.curve.getPoint(Math.random());
      pos.set([p.x + (Math.random() - 0.5) * 9, p.y + Math.random() * 4 - 0.6, p.z + (Math.random() - 0.5) * 6], i * 3);
      d[i] = Math.random();
    }
    const g = this.track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aD', new THREE.BufferAttribute(d, 1));
    const pts = new THREE.Points(
      g,
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uTime: this.u.uTime, uPx: this.u.uPx },
          vertexShader: `attribute float aD; uniform float uTime, uPx; varying float vA;
            void main(){ vec3 p = position + vec3(sin(uTime * .4 + aD * 30.), sin(uTime * .6 + aD * 20.) * .6, cos(uTime * .3 + aD * 40.)) * .35;
              vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
              vA = (.3 + .7 * pow(.5 + .5 * sin(uTime * (1. + aD * 2.) + aD * 60.), 3.)) * smoothstep(80., 20., -mv.z);
              gl_PointSize = uPx * (.6 + aD * .6) / -mv.z; }`,
          fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = (smoothstep(.5, 0., d) * .4 + smoothstep(.12, 0., d)) * vA; gl_FragColor = vec4(vec3(1., .86, .6) * a, a); }`,
        }),
      ),
    );
    pts.frustumCulled = false;
    return pts;
  }

  private glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.12, 'rgba(255,240,215,.85)');
    r.addColorStop(0.35, 'rgba(255,200,140,.25)');
    r.addColorStop(1, 'rgba(255,180,120,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private pillarTexture() {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 256;
    const g = c.getContext('2d')!;
    const v = g.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, 'rgba(255,220,170,0)');
    v.addColorStop(0.7, 'rgba(255,220,170,.35)');
    v.addColorStop(1, 'rgba(255,220,170,.6)');
    g.fillStyle = v;
    g.fillRect(0, 0, 32, 256);
    const h = g.createLinearGradient(0, 0, 32, 0);
    h.addColorStop(0, 'rgba(0,0,0,1)');
    h.addColorStop(0.5, 'rgba(0,0,0,0)');
    h.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = h;
    g.fillRect(0, 0, 32, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private labelTexture(text: string) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const g = c.getContext('2d')!;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `italic 500 64px ${SERIF}`;
    g.shadowColor = 'rgba(255,190,120,.9)';
    g.shadowBlur = 16;
    g.fillStyle = '#fff3e0';
    g.fillText(text, 256, 66);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** Travel to date i (the lantern flares when the camera arrives). */
  go(i: number) {
    this.index = Math.max(0, Math.min(this.count - 1, i));
    this.target = this.stops[this.index].t;
  }

  protected onResize(w: number, h: number) {
    this.u.uAspect.value = w / h;
    this.u.uPx.value = 60 * this.renderer.getPixelRatio() * (h / 800) * 1.4;
    this.camera.fov = w / h < 1 ? 62 : 44;
    this.lookY = w / h < 1 ? 0.25 : 0.5; // the lantern between the dates strip and her words
    this.camera.far = 400;
    this.camera.updateProjectionMatrix();
  }

  private tmp = new THREE.Vector3();
  private look = new THREE.Vector3();

  protected update(t: number, dt: number) {
    this.u.uTime.value = this.still ? 0 : t;
    // a critically damped glide along the river
    if (this.still) this.cur = this.target;
    else {
      // (time‑based, in small steps, so the glide takes the same time on any device)
      const k = 3.2;
      for (let n = 0, h = Math.min(dt, 0.1) / 4; n < 4; n++) {
        this.vel += (k * k * (this.target - this.cur) - 2 * k * this.vel) * h;
        this.cur += this.vel * h;
      }
    }
    const ease1 = 1 - Math.exp(-dt * 5);
    const c = Math.max(0, Math.min(1, this.cur));
    // (level heading, so the lantern she stands at always sits in the same place on screen)
    const p = this.curve.getPoint(c), tan = this.curve.getTangent(c).setY(0).normalize();
    this.tmp.copy(p).addScaledVector(tan, -6.5).add(new THREE.Vector3(0, 2 + (this.still ? 0 : Math.sin(t * 0.3) * 0.15), 0));
    this.camera.position.copy(this.tmp);
    this.look.copy(p).addScaledVector(tan, 3).add(new THREE.Vector3(0, this.lookY, 0));
    this.camera.lookAt(this.look);
    this.stars.position.copy(this.camera.position);
    this.pathU.uProg.value = c + 0.002;
    // lanterns: behind her warm, the one she stands at bright and flaring, the ones ahead waiting
    this.stops.forEach((s, k) => {
      const near = Math.abs(this.cur - s.t) < 0.004;
      if (k === this.index && near && s.arrivedAt < 0) s.arrivedAt = t;
      if (k !== this.index) s.arrivedAt = -10;
      const passed = s.t <= c + 0.004;
      const here = k === this.index && s.arrivedAt >= 0;
      const f = here ? t - s.arrivedAt : 99;
      const pulse = this.still ? 0 : Math.sin(t * 2 + k) * 0.08;
      const om = s.orb.material as THREE.SpriteMaterial;
      om.opacity += ((here ? 1 : passed ? 0.8 : 0.35) - om.opacity) * ease1;
      om.color.set(passed || here ? '#ffd9a0' : '#b7a4e0');
      s.orb.scale.setScalar((here ? 2.2 : 1.5) * (1 + pulse) + (f < 1.2 ? Math.sin((f / 1.2) * Math.PI) * 1.4 : 0));
      (s.pillar.material as THREE.SpriteMaterial).opacity = here ? 0.7 : passed ? 0.4 : 0.2;
      // only the date she stands at, and a hint of the next one, carry words
      const lm = s.label.material as THREE.SpriteMaterial;
      lm.opacity += ((here ? 1 : k === this.index + 1 ? 0.35 : 0) - lm.opacity) * ease1;
      // words never loom past the camera while travelling
      lm.opacity = Math.min(lm.opacity, ease(4.5, 6.2, this.camera.position.distanceTo(s.label.position)));
      const rm = s.ring.material as THREE.MeshBasicMaterial;
      rm.opacity = f < 2 ? (1 - ease(0, 2, f)) * 0.8 : 0;
      s.ring.scale.setScalar(0.4 + ease(0, 2, f) * 3.2);
    });
    const last = this.index === this.count - 1 ? 1 : 0;
    // the horizon waits far ahead, brightening when she reaches the part not written yet
    this.horizon.position.copy(p).addScaledVector(tan, 80).add(new THREE.Vector3(0, 4, 0));
    const hm = this.horizon.material as THREE.SpriteMaterial;
    hm.opacity += (0.12 + last * 0.45 - hm.opacity) * ease1;
    this.u.uGlow.value = 0.3 + c * 0.3;
  }
}

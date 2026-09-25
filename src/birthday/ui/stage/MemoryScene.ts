import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Stage, makeNebula, makeStarfield, ease } from './Stage';
import { SERIF } from '../../../utils/fonts';

const HAND = "'Caveat', cursive";

export type MemoryCard = { caption: string; url?: string };

/**
 * Chapter 2 · Memory Universe — memories as polaroids drifting in slow orbit around a warm
 * core of light, in a nebula sky. Hover tilts a polaroid toward her; a tap flies the camera
 * toward it and hands the memory to the page. Photos load from the vault when present; until
 * then each polaroid shows a softly lit card with its caption in handwriting.
 */
export class MemoryScene extends Stage {
  private u = { uTime: { value: 0 }, uAspect: { value: 1 }, uPx: { value: 60 }, uGlow: { value: 0.6 } };
  private frames: { group: THREE.Group; angle: number; radius: number; lift: number; tilt: number; hover: number }[] = [];
  private hits: THREE.Mesh[] = [];
  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2(9, 9);
  private focus = -1;
  private focusAt = 0;
  private core: THREE.Mesh;
  private tex = new THREE.TextureLoader();
  onOpen?: (i: number) => void;

  constructor(canvas: HTMLCanvasElement, cards: MemoryCard[]) {
    super(canvas, { dpr: 1.5 });
    this.renderer.toneMappingExposure = 1.05;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = this.track(pmrem.fromScene(room, 0.04).texture);
    this.scene.environmentIntensity = 0.5;
    room.dispose();
    pmrem.dispose();
    this.scene.add(makeNebula(this.u, ['#3d1a4a', '#a45a6d']), makeStarfield(this.low ? 800 : 1600, this.u));
    this.scene.add(new THREE.AmbientLight('#8a6a9a', 0.5));
    const key = new THREE.PointLight('#ffd9a8', 60, 30, 1.6);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight('#f2c1cb', 1.2);
    fill.position.set(-4, 6, 8);
    this.scene.add(fill);

    // the warm core the memories turn around
    const coreMat = this.track(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: this.u,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv - .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
        fragmentShader: `uniform float uTime; varying vec2 vUv;
          void main(){ float r = length(vUv); float a = exp(-r * 18.) * (.8 + .2 * sin(uTime * 1.3)) + smoothstep(.025, 0., r) * .8;
            // shafts of light turning slowly out of the core, through the drifting dust
            float ang = atan(vUv.y, vUv.x);
            float rays = pow(abs(sin(ang * 7. + uTime * .04)), 14.) + pow(abs(sin(ang * 11. - uTime * .03 + 1.3)), 22.) * .7;
            a += rays * exp(-r * 4.2) * .16 * smoothstep(.02, .08, r);
            gl_FragColor = vec4(mix(vec3(1., .72, .5), vec3(1., .95, .85), smoothstep(.1, 0., r)) * a, a); }`,
      }),
    );
    this.core = new THREE.Mesh(this.track(new THREE.PlaneGeometry(14, 14)), coreMat);
    this.scene.add(this.core);
    // dust turning in the core's light
    const nd = this.low ? 160 : 320;
    const dd = new Float32Array(nd * 4);
    for (let i = 0; i < nd; i++) dd.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    const dg = this.track(new THREE.BufferGeometry());
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nd * 3), 3));
    dg.setAttribute('aD', new THREE.BufferAttribute(dd, 4));
    const dust = new THREE.Points(
      dg,
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: this.u,
          vertexShader: /* glsl */ `attribute vec4 aD; uniform float uTime, uPx; varying float vA;
            void main(){
              float a = aD.x * 6.2832 + uTime * (.02 + aD.y * .03);
              float r = .6 + pow(aD.z, .7) * 6.;
              vec3 p = vec3(cos(a) * r, (aD.w - .5) * 4.5 + sin(uTime * .2 + aD.x * 20.) * .3, sin(a) * r * .6);
              vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
              vA = (.25 + .75 * pow(.5 + .5 * sin(uTime * (.8 + aD.y * 2.) + aD.x * 60.), 3.)) * exp(-r * .22);
              gl_PointSize = uPx * (.3 + aD.y * .5) / -mv.z; }`,
          fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = (smoothstep(.5, 0., d) * .4 + smoothstep(.12, 0., d)) * vA; gl_FragColor = vec4(vec3(1., .88, .7) * a, a); }`,
        }),
      ),
    );
    dust.frustumCulled = false;
    this.scene.add(dust);

    // the polaroids
    const frameMat = this.track(new THREE.MeshPhysicalMaterial({ color: '#f7f1e6', roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.5 }));
    const frameGeo = this.track(new RoundedBoxGeometry(1.5, 1.8, 0.04, 3, 0.03));
    const photoGeo = this.track(new THREE.PlaneGeometry(1.3, 1.3));
    const n = Math.max(1, cards.length);
    cards.forEach((card, i) => {
      const group = new THREE.Group();
      const frame = new THREE.Mesh(frameGeo, frameMat);
      group.add(frame);
      const photoMat = this.track(new THREE.MeshStandardMaterial({ map: this.placeholder(card.caption, i), roughness: 0.6 }));
      const photo = new THREE.Mesh(photoGeo, photoMat);
      photo.position.set(0, 0.14, 0.025);
      group.add(photo);
      if (card.url) {
        this.tex.load(card.url, (t) => {
          t.colorSpace = THREE.SRGBColorSpace;
          // cover‑fit the photo into the square window
          const img = t.image as { width: number; height: number };
          const ar = img.width / img.height;
          if (ar > 1) t.repeat.set(1 / ar, 1), t.offset.set((1 - 1 / ar) / 2, 0);
          else t.repeat.set(1, ar), t.offset.set(0, (1 - ar) / 2);
          this.track(t);
          photoMat.map = t;
          photoMat.needsUpdate = true;
        });
      }
      const hit = new THREE.Mesh(this.track(new THREE.PlaneGeometry(1.9, 2.2)), this.hitMat);
      hit.userData.i = i;
      group.add(hit);
      this.hits.push(hit);
      this.scene.add(group);
      this.frames.push({ group, angle: (i / n) * Math.PI * 2, radius: 4.4 + (i % 2) * 0.8, lift: (((i * 37) % 7) / 7 - 0.5) * 2.2, tilt: (((i * 53) % 5) / 5 - 0.5) * 0.5, hover: 0 });
    });

    this.camera.position.set(0, 1.6, 12);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('click', this.onClick);
    this.begin();
  }

  private hitMat = new THREE.MeshBasicMaterial({ visible: false });

  /** a softly lit card with the caption in handwriting, until the real photo arrives */
  private placeholder(caption: string, i: number) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d')!;
    const hues = [
      ['#f3c9b6', '#b86a7e'],
      ['#e8d6f0', '#7f5a9a'],
      ['#f6dcc0', '#c28a5a'],
      ['#f2c1cb', '#9c3f5e'],
    ][i % 4];
    const gr = g.createLinearGradient(0, 0, 512, 512);
    gr.addColorStop(0, hues[0]);
    gr.addColorStop(1, hues[1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, 512, 512);
    // soft light leak
    const lk = g.createRadialGradient(380, 120, 10, 380, 120, 320);
    lk.addColorStop(0, 'rgba(255, 244, 220, .75)');
    lk.addColorStop(1, 'rgba(255, 244, 220, 0)');
    g.fillStyle = lk;
    g.fillRect(0, 0, 512, 512);
    g.fillStyle = 'rgba(40, 20, 30, .78)';
    g.textAlign = 'center';
    g.font = `44px ${HAND}`;
    const words = caption.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const t = line ? `${line} ${w}` : w;
      if (g.measureText(t).width > 420 && line) (lines.push(line), (line = w));
      else line = t;
    }
    lines.push(line);
    lines.slice(0, 5).forEach((l, k) => g.fillText(l, 256, 256 - ((Math.min(5, lines.length) - 1) * 48) / 2 + k * 48));
    g.font = `italic 26px ${SERIF}`;
    g.fillStyle = 'rgba(40, 20, 30, .55)';
    g.fillText(`— ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][i] ?? i + 1} —`, 256, 470);
    const t = this.track(new THREE.CanvasTexture(c));
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private onMove = (e: PointerEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  };
  private onLeave = () => this.ndc.set(9, 9);
  private onClick = (e: MouseEvent) => {
    this.onMove(e as PointerEvent);
    const i = this.pick();
    if (i >= 0) this.open(i);
  };
  private pick() {
    if (Math.abs(this.ndc.x) > 1.5) return -1;
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.ray.intersectObjects(this.hits, false)[0];
    return hit ? (hit.object.userData.i as number) : -1;
  }

  private lastFocus = -1;

  open(i: number) {
    this.focus = i;
    this.lastFocus = i;
    this.focusAt = this.clock.getElapsedTime();
    this.onOpen?.(i);
  }
  release() {
    this.focus = -1;
    this.focusAt = this.clock.getElapsedTime();
  }

  protected onResize(w: number, h: number) {
    this.u.uAspect.value = w / h;
    this.u.uPx.value = 60 * this.renderer.getPixelRatio() * (h / 800) * 1.4;
    this.camera.fov = w / h < 1 ? 58 : 40;
    this.camera.updateProjectionMatrix();
  }

  protected update(t: number) {
    this.u.uTime.value = this.still ? 0 : t;
    const hov = this.focus < 0 ? this.pick() : -1;
    this.canvas.style.cursor = hov >= 0 ? 'pointer' : '';
    const spin = this.still ? 0 : t * 0.06;
    // the camera drifts gently and never flies away; the chosen polaroid comes to her instead
    this.camera.position.set(this.still ? 0 : Math.sin(t * 0.08) * 1.2, 1.6, 12);
    this.camera.lookAt(0, 0.2, 0);
    this.camera.updateMatrixWorld();
    const portrait = this.camera.aspect < 1;
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    const right = new THREE.Vector3().crossVectors(fwd, this.camera.up).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
    // where a chosen memory is held: left of centre on wide screens, upper centre on phones
    const front = this.camera.position.clone().addScaledVector(fwd, portrait ? 6.2 : 5.4).addScaledVector(right, portrait ? 0 : -1.9).addScaledVector(up, portrait ? 1.1 : 0.1);
    const k = this.focus >= 0 ? ease(0, 1.1, t - this.focusAt) : 0;
    const back = this.focus < 0 ? 1 - ease(0, 1, t - this.focusAt) : 0;
    this.frames.forEach((f, i) => {
      f.hover += ((hov === i ? 1 : 0) - f.hover) * 0.1;
      const a = f.angle + spin;
      const orbit = new THREE.Vector3(Math.cos(a) * f.radius, f.lift + (this.still ? 0 : Math.sin(t * 0.6 + i) * 0.18), Math.sin(a) * f.radius * 0.55);
      const held = i === this.focus ? k : i === this.lastFocus ? back : 0;
      f.group.position.copy(orbit).lerp(front, held);
      f.group.lookAt(this.camera.position);
      f.group.rotateZ(f.tilt * (1 - Math.max(f.hover, held)) + held * 0.04);
      // the others step back a little while one is held
      const others = this.focus >= 0 && i !== this.focus ? k : 0;
      f.group.scale.setScalar((1 + f.hover * 0.18) * (1 - others * 0.25));
    });
    this.core.lookAt(this.camera.position);
  }

  dispose() {
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('click', this.onClick);
    this.hitMat.dispose();
    super.dispose();
  }
}

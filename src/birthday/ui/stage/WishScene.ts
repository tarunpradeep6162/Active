import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Stage, makeNebula, makeStarfield, ease } from './Stage';

/**
 * Chapter 11 · Make a Wish — one candle in the dark. While she holds, the flame leans and
 * flutters as if breathed on; when it goes out, a ribbon of smoke curls up, and then her wish
 * rises from the wick as a spiral of golden sparks that drift up into the sky and become stars.
 */
export class WishScene extends Stage {
  private u = { uTime: { value: 0 }, uAspect: { value: 1 }, uPx: { value: 60 }, uGlow: { value: 0.55 } };
  private flameU = { uTime: this.u.uTime, uHold: { value: 0 }, uOut: { value: 0 } };
  private smokeU = { uTime: this.u.uTime, uK: { value: 0 }, uPx: this.u.uPx };
  private sparkU = { uTime: this.u.uTime, uK: { value: 0 }, uPx: this.u.uPx };
  private light: THREE.PointLight;
  private halo: THREE.Mesh;
  private bokeh!: THREE.Points;
  private hold = 0;
  private outAt = -1;
  private readonly wickY = 1.72;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { dpr: 1.5 });
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.scene.environment = this.track(pmrem.fromScene(room, 0.04).texture);
    this.scene.environmentIntensity = 0.18;
    room.dispose();
    pmrem.dispose();
    this.scene.add(makeNebula(this.u, ['#3a2a1a', '#a0703a']), makeStarfield(this.low ? 700 : 1400, this.u));
    this.scene.add(new THREE.AmbientLight('#4a3a4a', 0.25));

    // the candle: cream wax with a few drips, a dark wick, on a small gold dish
    const wax = this.track(new THREE.MeshPhysicalMaterial({ color: '#f6e7d2', roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color('#ffe6c8'), transmission: 0.08, thickness: 0.5 }));
    const candle = new THREE.Group();
    const body = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.34, 0.36, 1.6, 48)), wax);
    body.position.y = 0.8;
    body.castShadow = body.receiveShadow = true;
    candle.add(body);
    const top = new THREE.Mesh(this.track(new THREE.TorusGeometry(0.3, 0.05, 12, 40).rotateX(Math.PI / 2)), wax);
    top.position.y = 1.6;
    candle.add(top);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + i * 0.4;
      const len = 0.15 + ((i * 37) % 5) * 0.08;
      const drip = new THREE.Mesh(this.track(new THREE.CapsuleGeometry(0.045, len, 4, 10)), wax);
      drip.position.set(Math.cos(a) * 0.345, 1.58 - len / 2, Math.sin(a) * 0.345);
      candle.add(drip);
    }
    const wick = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.018, 0.02, 0.16, 8)), this.track(new THREE.MeshStandardMaterial({ color: '#1a1210', roughness: 1 })));
    wick.position.y = 1.66;
    candle.add(wick);
    const gold = this.track(new THREE.MeshPhysicalMaterial({ color: '#d6b46a', metalness: 1, roughness: 0.25, clearcoat: 0.5 }));
    const dish = new THREE.Mesh(
      this.track(new THREE.LatheGeometry([[0, 0], [0.9, 0], [1.05, 0.05], [1.1, 0.14], [1.02, 0.16], [0.9, 0.08], [0.4, 0.07], [0.38, 0.12], [0, 0.12]].map(([x, y]) => new THREE.Vector2(x, y)), 64)),
      gold,
    );
    dish.receiveShadow = true;
    candle.add(dish);
    candle.position.y = -1.3;
    this.scene.add(candle);

    // a polished dark table the candle stands on, holding its light
    const table = new THREE.Mesh(
      this.track(new THREE.CylinderGeometry(3.4, 3.4, 0.12, 96)),
      this.track(new THREE.MeshPhysicalMaterial({ color: '#120805', roughness: 0.4, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.12 })),
    );
    table.position.y = -1.305 - 0.06;
    table.receiveShadow = true;
    this.scene.add(table);
    // warm lights far behind, softly out of focus
    const nb = this.low ? 26 : 46;
    const bp = new Float32Array(nb * 3), bs = new Float32Array(nb);
    for (let i = 0; i < nb; i++) {
      bp.set([(Math.random() - 0.5) * 22, -0.5 + Math.random() * 6, -9 - Math.random() * 6], i * 3);
      bs[i] = Math.random();
    }
    const bg = this.track(new THREE.BufferGeometry());
    bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    bg.setAttribute('aSeed', new THREE.BufferAttribute(bs, 1));
    this.bokeh = new THREE.Points(
      bg,
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uTime: this.u.uTime, uPx: this.u.uPx, uA: { value: 1 } },
          vertexShader: `attribute float aSeed; uniform float uTime, uPx, uA; varying float vA; varying float vS;
            void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
              vA = uA * (.5 + .5 * sin(uTime * (.4 + aSeed) + aSeed * 40.)); vS = aSeed; gl_PointSize = uPx * (6. + aSeed * 8.) / -mv.z; }`,
          fragmentShader: `varying float vA; varying float vS; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .4, d) * (.35 + .15 * smoothstep(.3, .47, d)) * vA * .22;
            gl_FragColor = vec4(mix(vec3(1., .7, .4), vec3(1., .55, .6), step(.7, vS)) * a, a); }`,
        }),
      ),
    );
    this.bokeh.frustumCulled = false;
    this.scene.add(this.bokeh);

    // warm light from the flame
    this.light = new THREE.PointLight('#ffb05a', 30, 18, 1.5);
    this.light.position.set(0, -1.3 + this.wickY + 0.3, 0);
    this.light.castShadow = true;
    this.scene.add(this.light);

    // the flame: a camera‑facing teardrop with a blue root and a hot core
    const flame = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(0.5, 1.1).translate(0, 0.42, 0)),
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: this.flameU,
          vertexShader: `uniform float uTime, uHold, uOut; varying vec2 vUv;
            void main(){ vUv = uv; vec3 p = position;
              float flick = sin(uTime * 13.) * .04 + sin(uTime * 29.) * .025;
              float lean = uHold * (.55 + .2 * sin(uTime * 17.));
              p.x += (flick + lean) * p.y * p.y * 1.6;
              p *= (1. + uHold * .25) * (1. - uOut);
              vec4 base = modelViewMatrix * vec4(0., 0., 0., 1.);
              gl_Position = projectionMatrix * (base + vec4(p.xy, 0., 0.)); }`,
          fragmentShader: `uniform float uTime; varying vec2 vUv;
            void main(){
              vec2 c = vUv - vec2(.5, .18);
              c.x *= 2.2 + c.y * 2.8;
              float d = length(vec2(c.x, c.y * (c.y > 0. ? .55 : 1.8)));
              float body = smoothstep(.42, .05, d);
              float core = smoothstep(.2, 0., length(vec2(c.x * 1.4, (c.y - .02) * 1.1)));
              float blue = smoothstep(.12, 0., abs(c.y + .06)) * smoothstep(.3, 0., abs(c.x)) * .6;
              vec3 col = vec3(1., .45, .12) * body + vec3(1., .9, .7) * core * 1.4 + vec3(.3, .45, 1.) * blue;
              float a = clamp(body + core, 0., 1.);
              gl_FragColor = vec4(col * a, a);
            }`,
        }),
      ),
    );
    flame.position.set(0, -1.3 + this.wickY + 0.02, 0);
    this.scene.add(flame);
    this.halo = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(4, 4)),
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: { uA: { value: 1 } },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv - .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
          fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ float a = exp(-length(vUv) * 7.) * .55 * uA; gl_FragColor = vec4(vec3(1., .66, .32) * a, a); }`,
        }),
      ),
    );
    this.halo.position.copy(flame.position).add(new THREE.Vector3(0, 0.35, -0.1));
    this.scene.add(this.halo);

    this.scene.add(this.makeSmoke(), this.makeSparks());
    this.camera.position.set(0, -0.1, 7.5);
    this.begin();
  }

  private makeSmoke() {
    const n = 140;
    const d = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) d.set([Math.random(), Math.random()], i * 2);
    const g = this.track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aD', new THREE.BufferAttribute(d, 2));
    const y0 = -1.3 + this.wickY + 0.08;
    const pts = new THREE.Points(
      g,
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: this.smokeU,
          vertexShader: `attribute vec2 aD; uniform float uTime, uK, uPx; varying float vA;
            void main(){
              float t = clamp(uK * 1.4 - aD.x * .5, 0., 1.);
              float h = t * 3.4;
              vec3 p = vec3(sin(h * 2.4 + aD.y * 3.) * h * .22, ${y0.toFixed(3)} + h, cos(h * 1.7 + aD.y * 4.) * h * .1);
              vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
              vA = step(.001, t) * (1. - t) * .35;
              gl_PointSize = uPx * (1.5 + t * 7.) / -mv.z; }`,
          fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d) * vA; gl_FragColor = vec4(vec3(.75, .72, .78) * a, a); }`,
        }),
      ),
    );
    pts.frustumCulled = false;
    return pts;
  }

  private makeSparks() {
    const n = this.low ? 420 : 800;
    const d = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) d.set([Math.random(), Math.random(), Math.random()], i * 3);
    const g = this.track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aD', new THREE.BufferAttribute(d, 3));
    const y0 = -1.3 + this.wickY;
    const pts = new THREE.Points(
      g,
      this.track(
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          uniforms: this.sparkU,
          vertexShader: `attribute vec3 aD; uniform float uTime, uK, uPx; varying float vA;
            void main(){
              // a spiral of light rising from the wick, widening as it climbs, then scattering into the sky
              float t = clamp(uK - aD.x * .6, 0., 1.4);
              float h = t * 7.;
              float a = aD.y * 6.2832 + h * 1.6;
              float r = .1 + h * .28 + aD.z * h * .35;
              vec3 p = vec3(cos(a) * r, ${y0.toFixed(3)} + h, sin(a) * r * .5);
              p += vec3(aD.z - .5, aD.y - .5, 0.) * max(0., t - 1.) * 6.;
              vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
              vA = step(.001, t) * smoothstep(1.4, .9, t) * (.6 + .4 * sin(uTime * 8. + aD.y * 50.));
              gl_PointSize = uPx * (.7 + aD.z * 1.2) / -mv.z; }`,
          fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = (smoothstep(.5, 0., d) * .4 + smoothstep(.12, 0., d)) * vA; gl_FragColor = vec4(vec3(1., .82, .5) * a, a); }`,
        }),
      ),
    );
    pts.frustumCulled = false;
    return pts;
  }

  setHold(h: number) {
    this.hold = h;
  }
  blowOut() {
    if (this.outAt < 0) this.outAt = this.clock.getElapsedTime();
  }

  protected onResize(w: number, h: number) {
    this.u.uAspect.value = w / h;
    this.u.uPx.value = 60 * this.renderer.getPixelRatio() * (h / 800) * 1.4;
    this.camera.fov = w / h < 1 ? 60 : 38;
    this.camera.updateProjectionMatrix();
  }

  protected update(t: number) {
    this.u.uTime.value = this.still ? 0 : t;
    const o = this.outAt < 0 ? -1 : t - this.outAt;
    this.flameU.uHold.value += (this.hold - this.flameU.uHold.value) * 0.15;
    const out = o < 0 ? 0 : ease(0, 0.35, o);
    this.flameU.uOut.value = out;
    const flick = this.still ? 1 : 0.88 + Math.sin(t * 11) * 0.07 + Math.sin(t * 27) * 0.05;
    this.light.intensity = 30 * flick * (1 - out) + 18 * (o < 0 ? 0 : ease(1.6, 3, o) * (1 - ease(5, 9, o)));
    this.light.color.set(o > 1.5 ? '#ffd28a' : '#ffb05a');
    (this.halo.material as THREE.ShaderMaterial).uniforms.uA.value = (1 + this.hold * 0.6) * (1 - out);
    (this.bokeh.material as THREE.ShaderMaterial).uniforms.uA.value = (1 - this.hold * 0.6) * (1 - out * 0.7) + (o < 0 ? 0 : ease(2, 5, o) * 0.9);
    this.smokeU.uK.value = o < 0 ? 0 : ease(0.1, 3.6, o);
    this.sparkU.uK.value = o < 0 ? 0 : ease(1.3, 7.5, o) * 1.6;
    this.u.uGlow.value = 0.5 * (1 - out) + (o < 0 ? 0 : ease(2, 5, o) * 0.7);
    // camera leans in while she holds, and tilts up to follow the wish
    const up = o < 0 ? 0 : ease(1.5, 6, o);
    // (the candle stays in the lower frame, smoking, as her wish climbs past the words)
    this.camera.position.set(this.still ? 0 : Math.sin(t * 0.1) * 0.3, -0.1 + up * 0.9, 7.5 - this.hold * 1.2 + up * 1.8);
    this.camera.lookAt(0, -0.55 + up * 1.5, 0);
  }
}

import * as THREE from 'three';

/**
 * One firefly that leads her through the garden. It flies a little ahead to the next chapter
 * she hasn't reached yet, circles its tulip while she stops, and slips on ahead when she moves.
 * A short tail of fading light follows it.
 */
const TAIL = 10;

export class FireflyGuide {
  readonly points: THREE.Points;
  private pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private trail: THREE.Vector3[] = Array.from({ length: TAIL }, () => new THREE.Vector3());
  private attr: THREE.BufferAttribute;
  private started = false;
  private tmp = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private goal = new THREE.Vector3();
  readonly uniforms = { uPx: { value: 60 }, uAmt: { value: 0 }, uTime: { value: 0 } };

  constructor() {
    const g = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(new Float32Array((TAIL + 1) * 3), 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.attr);
    const idx = new Float32Array(TAIL + 1).map((_, i) => i);
    g.setAttribute('aI', new THREE.BufferAttribute(idx, 1));
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `
          attribute float aI; uniform float uPx, uTime; varying float vI;
          void main(){
            vI = aI;
            vec4 mv = modelViewMatrix * vec4(position, 1.);
            gl_Position = projectionMatrix * mv;
            float head = aI < .5 ? 1. + .25 * sin(uTime * 5.) : 1. - aI / ${TAIL + 1}.;
            gl_PointSize = uPx * (aI < .5 ? 1. : .3) * head / max(1., -mv.z) * 6.;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uAmt, uTime; varying float vI;
          void main(){
            float d = length(gl_PointCoord - .5) * 2.;
            float core = exp(-d * d * 12.), halo = exp(-d * d * 2.5) * .5;
            float a = vI < .5 ? core + halo * (.8 + .2 * sin(uTime * 5.)) : core * .5 * (1. - vI / ${TAIL + 1}.);
            gl_FragColor = vec4(vec3(1., .86, .5) * a * uAmt, 1.);
          }`,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
  }

  /**
   * target: the next chapter's tulip (world) or null · on: 0…1 (garden on screen)
   * onScreen: 0…1 how visible the target is (off screen, the guide stays in front of her)
   */
  update(dt: number, time: number, camera: THREE.PerspectiveCamera, target: THREE.Vector3 | null, onScreen: number, on: number, dpr: number) {
    this.uniforms.uTime.value = time;
    this.uniforms.uAmt.value += (on - this.uniforms.uAmt.value) * Math.min(1, dt * 2);
    this.uniforms.uPx.value = 60 * dpr;
    this.points.visible = this.uniforms.uAmt.value > 0.01;
    if (!this.points.visible) return;
    // somewhere just ahead of her, a little low and to the side
    camera.getWorldDirection(this.fwd);
    const ahead = this.tmp.copy(camera.position).addScaledVector(this.fwd, 6);
    ahead.x += 0.8;
    ahead.y -= 0.9;
    const goal = this.goal.copy(target ? ahead.lerp(target, onScreen) : ahead);
    // a lazy loop around wherever it is waiting
    goal.x += Math.sin(time * 1.3) * 0.45 + Math.sin(time * 2.9) * 0.12;
    goal.y += Math.sin(time * 1.7 + 1) * 0.3;
    goal.z += Math.cos(time * 1.1) * 0.45;
    if (!this.started) {
      this.started = true;
      this.pos.copy(goal);
      this.trail.forEach((t) => t.copy(goal));
    }
    // a spring: it darts, overshoots a touch, then settles
    const k = 7, c = 4.2;
    this.vel.addScaledVector(this.tmp.subVectors(goal, this.pos), k * dt).multiplyScalar(Math.max(0, 1 - c * dt));
    this.pos.addScaledVector(this.vel, dt);
    for (let i = TAIL - 1; i > 0; i--) this.trail[i].lerp(this.trail[i - 1], Math.min(1, dt * 18));
    this.trail[0].lerp(this.pos, Math.min(1, dt * 18));
    const a = this.attr.array as Float32Array;
    this.pos.toArray(a, 0);
    this.trail.forEach((t, i) => t.toArray(a, (i + 1) * 3));
    this.attr.needsUpdate = true;
  }
}

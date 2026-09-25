import * as THREE from 'three';
import { globalUniforms } from '../world/uniforms';
import { noise, math } from '../shaders/chunks';
import type { TierSettings } from '../core/Performance';

const fullscreenVert = /* glsl */ `
out vec2 vUv;
void main(){ vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }
`;

function fsTriangle() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return g;
}

function pass(frag: string, uniforms: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: fullscreenVert,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

const thresholdFrag = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tInput; uniform float uThreshold; uniform float uKnee;
void main(){
  vec3 c = texture(tInput, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float soft = clamp(l - uThreshold + uKnee, 0., 2. * uKnee);
  soft = soft * soft / (4. * uKnee + 1e-4);
  float w = max(soft, l - uThreshold) / max(l, 1e-4);
  o = vec4(c * w, 1.);
}`;

// Dual‑filter (Kawase‑style) down/up sampling.
const downFrag = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tInput; uniform vec2 uTexel;
void main(){
  vec2 h = uTexel * .5;
  vec3 s = texture(tInput, vUv).rgb * 4.;
  s += texture(tInput, vUv - h).rgb; s += texture(tInput, vUv + h).rgb;
  s += texture(tInput, vUv + vec2(h.x, -h.y)).rgb; s += texture(tInput, vUv - vec2(h.x, -h.y)).rgb;
  o = vec4(s / 8., 1.);
}`;
const upFrag = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tInput; uniform sampler2D tPrev; uniform vec2 uTexel; uniform float uHasPrev;
void main(){
  vec2 h = uTexel * .5;
  vec3 s = texture(tInput, vUv + vec2(-h.x * 2., 0.)).rgb;
  s += texture(tInput, vUv + vec2(-h.x, h.y)).rgb * 2.;
  s += texture(tInput, vUv + vec2(0., h.y * 2.)).rgb;
  s += texture(tInput, vUv + vec2(h.x, h.y)).rgb * 2.;
  s += texture(tInput, vUv + vec2(h.x * 2., 0.)).rgb;
  s += texture(tInput, vUv + vec2(h.x, -h.y)).rgb * 2.;
  s += texture(tInput, vUv + vec2(0., -h.y * 2.)).rgb;
  s += texture(tInput, vUv + vec2(-h.x, -h.y)).rgb * 2.;
  vec3 prev = uHasPrev > .5 ? texture(tPrev, vUv).rgb : vec3(0.);
  o = vec4(s / 12. + prev, 1.);
}`;

const compositeFrag = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tBlur; uniform sampler2D tStreak;
uniform float uBloomStrength; uniform float uHasBloom;
uniform float uTime; uniform vec2 uResolution; uniform float uScrollVelocity;
uniform float uChromatic; uniform float uBlur; uniform float uDim; uniform float uExposure;
uniform vec3 uGlowA; uniform vec3 uGlowB; uniform float uReveal; uniform float uLetterbox; uniform float uStreak;
// the cinematographer (see Director.ts): focus, lens, light shafts, the hour, cuts
uniform vec2 uFocusPt; uniform float uFocusR; uniform float uFocusAmt; uniform float uLens; uniform float uBlink;
uniform vec2 uRayPt; uniform float uRays; uniform vec3 uRayTint; uniform vec3 uTint; uniform float uTintAmt;
uniform vec3 uCandle; uniform float uRain; uniform float uMist;
${math}
${noise}
vec3 aces(vec3 x){ const float a = 2.51, b = .03, c = 2.43, d = .59, e = .14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0., 1.); }
void main(){
  vec2 uv = vUv;
  vec2 c = uv - .5;
  float r2 = dot(c, c);
  float aspect = uResolution.x / uResolution.y;
  // lens character: a whisper of barrel distortion (the corners stay put)
  if (uLens > .001) {
    float k = .07 * uLens;
    uv = .5 + c * (1. + k * r2) / (1. + k * .5);
    c = uv - .5;
  }
  // velocity‑scaled chromatic fringe, strongest at the edges
  float ca = uChromatic * (.0012 + abs(uScrollVelocity) * .004) * r2 * 4.;
  vec3 col;
  col.r = texture(tScene, uv + c * ca).r;
  col.g = texture(tScene, uv).g;
  col.b = texture(tScene, uv - c * ca).b;
  // depth of field: a focus pull toward one point on screen, and the lens softening its edges
  float dof = uFocusAmt * smoothstep(uFocusR, uFocusR + .38, length((uv - uFocusPt) * vec2(aspect, 1.)));
  dof = max(dof, uLens * smoothstep(.16, .5, r2) * .35);
  if (dof > .001) {
    // a touch of lateral colour where the lens is soft
    vec3 bl = vec3(texture(tBlur, uv + c * .003 * uLens).r, texture(tBlur, uv).g, texture(tBlur, uv - c * .003 * uLens).b);
    col = mix(col, bl * 1.05, clamp(dof, 0., 1.));
  }
  if (uHasBloom > .5) col += texture(tBloom, uv).rgb * uBloomStrength;
  // light shafts: the brightest light (the moon, the sun, the spotlight, the lanterns) pours
  // through whatever stands in front of it
  if (uHasBloom > .5 && uRays > .001) {
    vec2 d = (uv - uRayPt) / 32.;
    vec2 q = uv; float dec = 1.; vec3 acc = vec3(0.);
    for (int i = 0; i < 32; i++) { q -= d; acc += texture(tStreak, q).rgb * dec; dec *= .955; }
    col += acc / 32. * uRays * uRayTint;
  }
  // anamorphic streaks: the brightest lights (candles, fairy lights, the sun) stretch sideways
  // into thin champagne lines, like a cinema lens (squared, so only real highlights streak)
  if (uHasBloom > .5 && uStreak > .001) {
    vec3 s = vec3(0.);
    for (int k = 1; k <= 14; k++) {
      float o = float(k) * .0065;
      float w = exp(-float(k) * .2);
      vec3 a = texture(tStreak, uv + vec2(o, 0.)).rgb, b = texture(tStreak, uv - vec2(o, 0.)).rgb;
      s += (a * a + b * b) * w;
    }
    col += s * vec3(1., .8, .7) * uStreak;
  }
  // candlelight: the flames warm everything around them, breathing as they flicker
  if (uCandle.z > .001) {
    float cd = length((uv - uCandle.xy) * vec2(aspect, 1.));
    col += vec3(1., .6, .28) * uCandle.z * (exp(-cd * 2.6) * .22 + exp(-cd * 8.) * .28);
  }
  // rain: fine streaks falling past the lens (two depths)
  if (uRain > .001) {
    float rs = 0.;
    for (int L = 0; L < 2; L++) {
      float fl = float(L);
      float sc = mix(70., 130., fl);
      vec2 g = vec2((uv.x * aspect + uv.y * .06) * sc, uv.y * 2.4 + uTime * mix(1.9, 1.3, fl));
      float id = floor(g.x);
      float h = hash11(id * 1.37 + fl * 7.1);
      float y = fract(g.y * .5 + h * 10.);
      float st = smoothstep(0., .015, y) * smoothstep(.13, .015, y);
      st *= smoothstep(.7, 1., 1. - abs(fract(g.x) - .5) * 2.) * step(.5, h);
      rs += st * mix(1., .55, fl);
    }
    col += vec3(.72, .76, .92) * rs * uRain * .16;
  }
  if (uBlur > .001) col = mix(col, texture(tBlur, uv).rgb * 1.1, clamp(uBlur, 0., 1.));
  // corner glow (teal wash seen on the reference) — screen space so it frames every scene
  vec2 p = c * vec2(aspect, 1.);
  float g1 = exp(-2.2 * length(p - vec2(.62 * aspect, -.55)));
  float g2 = exp(-2.6 * length(p - vec2(-.62 * aspect, .55)));
  col += uGlowA * g1 * .22 + uGlowB * g2 * .12;
  col *= uExposure;
  col = aces(col);
  col = pow(col, vec3(1. / 2.2));
  // cinematic grade: plum in the shadows, champagne in the highlights, a touch more contrast
  float l = dot(col, vec3(.2126, .7152, .0722));
  col += mix(vec3(.018, .004, .03), vec3(.02, .012, -.012), smoothstep(.15, .75, l)) * (1. - abs(l - .5) * 1.2);
  col = mix(vec3(l), col, 1.06);
  col = clamp((col - .5) * 1.04 + .5, 0., 1.);
  // mist rolling low across the frame
  if (uMist > .001) {
    float m = fbm2(vec2(uv.x * aspect * 1.4 + uTime * .035, uv.y * 3.2 - uTime * .012));
    float band = smoothstep(.62, .05, uv.y);
    col = mix(col, vec3(.62, .56, .7), clamp(smoothstep(.35, .8, m) * band * uMist * .38, 0., 1.));
  }
  // the hour of the night: the whole frame leans toward the light of the moment
  col = mix(col, col * uTint * 1.08 + (uTint - 1.) * .012, uTintAmt);
  // soft vignette (oval, gentle)
  col *= mix(1., smoothstep(1.1, .22, length(c * vec2(.92, 1.))), .5);
  col *= 1. - uDim;
  // a whisper of temporal dither, only enough to keep dark gradients from banding
  float gr = hash12(uv * uResolution + fract(uTime * 7.3) * 61.) + hash12(uv * uResolution * 1.37 - fract(uTime * 3.1) * 17.) - 1.;
  col += gr * (.006 + .006 * l);
  // letterbox for the big moments
  float bar = uLetterbox * .075;
  col *= smoothstep(bar, bar + .004, uv.y) * smoothstep(bar, bar + .004, 1. - uv.y);
  col *= uReveal * (1. - uBlink);
  o = vec4(col, 1.);
}`;

const blurFrag = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tInput; uniform vec2 uTexel;
void main(){
  vec3 s = vec3(0.); float w = 0.;
  for (int x = -2; x <= 2; x++) for (int y = -2; y <= 2; y++){
    float k = exp(-float(x*x + y*y) * .25);
    s += texture(tInput, vUv + vec2(float(x), float(y)) * uTexel * 2.).rgb * k; w += k;
  }
  o = vec4(s / w, 1.);
}`;

export class PostFX {
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private scene = new THREE.Scene();
  sceneRT: THREE.WebGLRenderTarget;
  private levels: THREE.WebGLRenderTarget[] = [];
  private ups: THREE.WebGLRenderTarget[] = [];
  private blurRT: THREE.WebGLRenderTarget;
  private threshold = pass(thresholdFrag, { tInput: { value: null }, uThreshold: { value: 0.72 }, uKnee: { value: 0.35 } });
  private down = pass(downFrag, { tInput: { value: null }, uTexel: { value: new THREE.Vector2() } });
  private up = pass(upFrag, { tInput: { value: null }, tPrev: { value: null }, uTexel: { value: new THREE.Vector2() }, uHasPrev: { value: 0 } });
  private blur = pass(blurFrag, { tInput: { value: null }, uTexel: { value: new THREE.Vector2() } });
  composite = pass(compositeFrag, {
    tScene: { value: null },
    tBloom: { value: null },
    tBlur: { value: null },
    tStreak: { value: null },
    uBloomStrength: { value: 0.9 },
    uHasBloom: { value: 1 },
    uTime: globalUniforms.uTime,
    uResolution: globalUniforms.uResolution,
    uScrollVelocity: globalUniforms.uScrollVelocity,
    uReveal: globalUniforms.uReveal,
    uChromatic: { value: 1 },
    uBlur: { value: 0 },
    uDim: { value: 0 },
    uExposure: { value: 1 },
    uLetterbox: { value: 0 },
    uStreak: { value: 0.045 },
    uFocusPt: { value: new THREE.Vector2(0.5, 0.5) },
    uFocusR: { value: 0.3 },
    uFocusAmt: { value: 0 },
    uLens: { value: 0 },
    uBlink: { value: 0 },
    uRayPt: { value: new THREE.Vector2(0.5, 0.8) },
    uRays: { value: 0 },
    uRayTint: { value: new THREE.Color(1, 0.85, 0.65) },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uTintAmt: { value: 0 },
    uCandle: { value: new THREE.Vector3(0.5, 0.5, 0) },
    uRain: { value: 0 },
    uMist: { value: 0 },
    uGlowA: { value: new THREE.Color('#1e6f6a') },
    uGlowB: { value: new THREE.Color('#123a44') },
  });
  private settings: TierSettings;
  private w = 1;
  private h = 1;

  constructor(private renderer: THREE.WebGLRenderer, settings: TierSettings) {
    this.settings = settings;
    this.quad = new THREE.Mesh(fsTriangle(), this.composite);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.sceneRT = this.makeRT(1, 1, settings.msaa);
    this.blurRT = this.makeRT(1, 1, 0);
  }

  private makeRT(w: number, h: number, samples: number) {
    return new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      samples,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });
  }

  applySettings(settings: TierSettings) {
    this.settings = settings;
    this.sceneRT.dispose();
    this.sceneRT = this.makeRT(this.w, this.h, settings.msaa);
    this.composite.uniforms.uChromatic.value = settings.chromatic ? 1 : 0;
    this.setSize(this.w, this.h);
  }

  /**
   * After a WebGL context restore the old GL handles died with the old context: create fresh
   * targets and drop the stale ones *without* dispose() (which would issue GL deletes against
   * objects that no longer belong to the current context).
   */
  rebuildAfterContextLoss() {
    this.sceneRT = this.makeRT(this.w, this.h, this.settings.msaa);
    this.blurRT = this.makeRT(Math.max(1, this.w >> 2), Math.max(1, this.h >> 2), 0);
    this.levels = [];
    this.ups = [];
    this.setSize(this.w, this.h);
  }

  setSize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.sceneRT.setSize(w, h);
    this.levels.forEach((l) => l.dispose());
    this.ups.forEach((l) => l.dispose());
    this.levels = [];
    this.ups = [];
    let lw = Math.max(1, w >> 1), lh = Math.max(1, h >> 1);
    for (let i = 0; i < this.settings.bloomLevels; i++) {
      const rt = this.makeRT(lw, lh, 0);
      rt.depthBuffer = false;
      this.levels.push(rt);
      this.ups.push(this.makeRT(lw, lh, 0));
      lw = Math.max(1, lw >> 1);
      lh = Math.max(1, lh >> 1);
    }
    this.blurRT.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2));
  }

  private draw(mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Two‑view wipe (measured Work → lab seam): `overlay.camera` is drawn over the main view
   * everywhere ABOVE a slanted edge (edge = screen y from the top at the centre, 0…1; the
   * edge rises to the right by `slant`). A depth‑only mask blocks the overlay below the edge.
   */
  private wipeMask = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms: { uEdge: { value: 1 }, uSlant: { value: 0 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, -1., 1.); }`,
      fragmentShader: /* glsl */ `varying vec2 vUv; uniform float uEdge, uSlant;
        void main(){ float yTop = 1. - vUv.y; float edge = uEdge + (.5 - vUv.x) * uSlant; if (yTop < edge) discard; gl_FragColor = vec4(0.); }`,
      colorWrite: false,
      depthWrite: true,
      // GL skips depth writes when the depth test is disabled, so test with ALWAYS instead
      depthTest: true,
      depthFunc: THREE.AlwaysDepth,
    }),
  );
  private wipeScene = new THREE.Scene().add(this.wipeMask);
  private wipeCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  render(scene: THREE.Scene, camera: THREE.Camera, overlay?: { camera: THREE.Camera; edge: number; slant: number; toggle: (on: boolean) => void }) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera);
    if (overlay) {
      const auto = r.autoClear;
      r.autoClear = false;
      r.clearDepth();
      const u = (this.wipeMask.material as THREE.ShaderMaterial).uniforms;
      u.uEdge.value = overlay.edge;
      u.uSlant.value = overlay.slant;
      this.wipeMask.frustumCulled = false;
      r.render(this.wipeScene, this.wipeCam);
      overlay.toggle(true);
      r.render(scene, overlay.camera);
      overlay.toggle(false);
      r.autoClear = auto;
    }

    const bloom = this.settings.bloom && this.levels.length > 0;
    if (bloom) {
      this.threshold.uniforms.tInput.value = this.sceneRT.texture;
      this.draw(this.threshold, this.levels[0]);
      for (let i = 1; i < this.levels.length; i++) {
        this.down.uniforms.tInput.value = this.levels[i - 1].texture;
        this.down.uniforms.uTexel.value.set(1 / this.levels[i - 1].width, 1 / this.levels[i - 1].height);
        this.draw(this.down, this.levels[i]);
      }
      for (let i = this.levels.length - 1; i >= 0; i--) {
        const src = this.levels[i];
        this.up.uniforms.tInput.value = src.texture;
        this.up.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
        const hasPrev = i < this.levels.length - 1;
        this.up.uniforms.uHasPrev.value = hasPrev ? 1 : 0;
        this.up.uniforms.tPrev.value = hasPrev ? this.ups[i + 1].texture : null;
        this.draw(this.up, this.ups[i]);
      }
    }
    const cu = this.composite.uniforms;
    if ((cu.uBlur.value as number) > 0.001 || (cu.uFocusAmt.value as number) > 0.001 || (cu.uLens.value as number) > 0.001) {
      this.blur.uniforms.tInput.value = this.sceneRT.texture;
      this.blur.uniforms.uTexel.value.set(1 / this.blurRT.width, 1 / this.blurRT.height);
      this.draw(this.blur, this.blurRT);
    }
    this.composite.uniforms.tScene.value = this.sceneRT.texture;
    this.composite.uniforms.tBloom.value = bloom ? this.ups[0].texture : null;
    this.composite.uniforms.tStreak.value = bloom ? this.levels[Math.min(1, this.levels.length - 1)].texture : null;
    this.composite.uniforms.uHasBloom.value = bloom ? 1 : 0;
    this.composite.uniforms.tBlur.value = this.blurRT.texture;
    this.draw(this.composite, null);
  }

  /** Materials used by the post chain, for shader pre‑compilation. */
  materials() {
    return [this.threshold, this.down, this.up, this.blur, this.composite];
  }
  warmup() {
    // One render of each pass into a scratch target so programs are linked before reveal.
    const scratch = this.makeRT(4, 4, 0);
    const saved = this.materials().map((m) => ({ ...m.uniforms }));
    for (const m of this.materials()) {
      for (const k in m.uniforms) if (m.uniforms[k].value instanceof THREE.Texture) m.uniforms[k] = { value: this.sceneRT.texture };
      this.draw(m, scratch);
    }
    this.materials().forEach((m, i) => Object.assign(m.uniforms, saved[i]));
    this.renderer.setRenderTarget(null);
    scratch.dispose();
  }
}

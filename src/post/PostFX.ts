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
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tBlur;
uniform float uBloomStrength; uniform float uHasBloom;
uniform float uTime; uniform vec2 uResolution; uniform float uScrollVelocity;
uniform float uChromatic; uniform float uBlur; uniform float uDim; uniform float uExposure;
uniform vec3 uGlowA; uniform vec3 uGlowB; uniform float uReveal;
${math}
${noise}
vec3 aces(vec3 x){ const float a = 2.51, b = .03, c = 2.43, d = .59, e = .14; return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0., 1.); }
void main(){
  vec2 uv = vUv;
  vec2 c = uv - .5;
  float r2 = dot(c, c);
  // velocity‑scaled chromatic fringe, strongest at the edges
  float ca = uChromatic * (.0012 + abs(uScrollVelocity) * .004) * r2 * 4.;
  vec3 col;
  col.r = texture(tScene, uv + c * ca).r;
  col.g = texture(tScene, uv).g;
  col.b = texture(tScene, uv - c * ca).b;
  if (uHasBloom > .5) col += texture(tBloom, uv).rgb * uBloomStrength;
  if (uBlur > .001) col = mix(col, texture(tBlur, uv).rgb * 1.1, clamp(uBlur, 0., 1.));
  // corner glow (teal wash seen on the reference) — screen space so it frames every scene
  float aspect = uResolution.x / uResolution.y;
  vec2 p = c * vec2(aspect, 1.);
  float g1 = exp(-2.2 * length(p - vec2(.62 * aspect, -.55)));
  float g2 = exp(-2.6 * length(p - vec2(-.62 * aspect, .55)));
  col += uGlowA * g1 * .3 + uGlowB * g2 * .16;
  col *= uExposure;
  col = aces(col);
  col = pow(col, vec3(1. / 2.2));
  // vignette
  col *= mix(1., smoothstep(1.05, .25, length(c * vec2(1., .9))), .55);
  col *= 1. - uDim;
  // film grain
  float gr = hash12(uv * uResolution + fract(uTime * 13.7) * 91.) - .5;
  col += gr * .045;
  col *= uReveal;
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

  render(scene: THREE.Scene, camera: THREE.Camera) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.render(scene, camera);

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
    const blurAmt = this.composite.uniforms.uBlur.value as number;
    if (blurAmt > 0.001) {
      this.blur.uniforms.tInput.value = this.sceneRT.texture;
      this.blur.uniforms.uTexel.value.set(1 / this.blurRT.width, 1 / this.blurRT.height);
      this.draw(this.blur, this.blurRT);
    }
    this.composite.uniforms.tScene.value = this.sceneRT.texture;
    this.composite.uniforms.tBloom.value = bloom ? this.ups[0].texture : null;
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

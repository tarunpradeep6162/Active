import * as THREE from 'three';
import { globalUniforms } from '../world/uniforms';
import { noise, math } from '../shaders/chunks';

/**
 * A still night lake under an open sky, used by the lantern sky and the finale. The sky is
 * drawn per view direction: a deep night with the Milky Way, a far shore of hills and pines,
 * and (in the finale) a sun that rises behind the hills. The water reflects that same sky
 * through soft ripples, so the shore, the stars and the sunrise's golden path all shimmer in
 * it. Anything that glows in the sky can add its own reflection with `reflectionChunk`.
 */
const SKY = /* glsl */ `
  uniform float uSun, uTime;
  // the far shore, by direction: rolling hills and a ragged line of pines along them
  float shore(vec3 d){
    float az = atan(d.x, -d.z);
    vec2 ring = vec2(cos(az), sin(az));
    float h = .012 + .03 * fbm2(ring * 3.2 + 1.7) + .012 * sin(az * 7. + 1.);
    float cell = floor(az * 70.);
    float t = abs(fract(az * 70.) - .5) * 2.;
    float pine = step(.35, hash12(vec2(cell, 3.))) * (1. - t) * (.008 + .012 * hash12(vec2(cell, 9.)));
    return h + pine * smoothstep(.2, .6, fbm2(ring * 5. + 4.));
  }
  vec3 skyCol(vec3 d){
    float e = d.y;
    float s = smoothstep(0., 1., uSun);
    vec3 top = mix(vec3(.004, .005, .018), vec3(.035, .03, .1), s);
    vec3 hor = mix(vec3(.05, .028, .08), vec3(.5, .22, .16), s);
    vec3 col = mix(hor, top, smoothstep(-.02, mix(.5, .28, s), e));
    // the Milky Way: a soft band of light and dust across the night, washed out by the sunrise
    vec3 nb = normalize(vec3(.42, .72, -.55));
    float bd = dot(d, nb);
    float band = exp(-bd * bd * 30.);
    float dust = fbm2(vec2(atan(d.x, -d.z) * 3., e * 5.) + 3.);
    col += vec3(.55, .5, .75) * band * (.07 + .2 * dust) * smoothstep(.0, .12, e) * (1. - s);
    col -= vec3(.03, .03, .05) * band * smoothstep(.55, .75, dust) * (1. - s);
    vec3 sc = floor(d * 300.);
    float st = step(.9965 - band * .006, hash12(sc.xy + sc.z * 17.31));
    col += st * (.5 + .5 * sin(uTime * (1. + hash12(sc.yz) * 3.) + sc.x)) * smoothstep(.03, .2, e) * (1. - s) * .9;
    // the sun, rising behind the hills straight ahead
    vec3 sd = normalize(vec3(0., mix(-.05, .06, s), -1.));
    float ca = dot(d, sd);
    col += vec3(1., .6, .32) * (exp(-(1. - ca) * 1400.) * 1.8 + exp(-(1. - ca) * 90.) * .22 + exp(-(1. - ca) * 10.) * .06) * s;
    // the far shore, a little lighter than the water, rim‑lit by the sky behind it
    float h = shore(d);
    vec3 land = mix(vec3(.012, .01, .025), vec3(.09, .04, .06), s);
    col = mix(col, land + hor * .06, smoothstep(h + .0015, h - .0015, e));
    return col;
  }
`;

export class NightLake {
  readonly sky: THREE.Mesh;
  readonly water: THREE.Mesh;
  readonly uniforms = {
    uTime: globalUniforms.uTime,
    uAmt: { value: 0 },
    uSun: { value: 0 },
    uRain: { value: 0 },
    /** rings on the water: (x, z, start time, strength) — a lantern lifting off, her touch */
    uRipples: { value: Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, -100, 0)) },
    uCamWorld: { value: new THREE.Matrix4() },
    uProjInv: { value: new THREE.Matrix4() },
    uWaterY: { value: 0 },
  };

  constructor(waterY: number, zNear: number) {
    this.waterY = waterY;
    this.uniforms.uWaterY.value = waterY;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.sky = new THREE.Mesh(
      g,
      new THREE.ShaderMaterial({
        transparent: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        depthTest: false,
        depthWrite: false,
        uniforms: this.uniforms,
        vertexShader: /* glsl */ `
          uniform mat4 uCamWorld, uProjInv;
          varying vec3 vDir;
          void main(){
            vec4 v = uProjInv * vec4(position.xy, 1., 1.);
            vDir = mat3(uCamWorld) * (v.xyz / v.w);
            gl_Position = vec4(position.xy, .9999, 1.);
          }`,
        fragmentShader: /* glsl */ `
          ${math}
          ${noise}
          uniform float uAmt;
          varying vec3 vDir;
          ${SKY}
          void main(){
            vec3 d = normalize(vDir);
            // below the horizon (past the far edge of the water): the lake's dark far reach
            vec3 col = d.y < 0. ? skyCol(vec3(d.x, -d.y, d.z)) * .35 : skyCol(d);
            gl_FragColor = vec4(col, uAmt);
          }`,
      }),
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -998;

    // the water: a wide plane reflecting the sky through slow ripples
    const wg = new THREE.PlaneGeometry(420, 400).rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(
      wg,
      new THREE.ShaderMaterial({
        transparent: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.SrcAlphaFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        uniforms: this.uniforms,
        vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `
          ${math}
          ${noise}
          uniform float uAmt, uRain; uniform vec4 uRipples[6];
          varying vec3 vW;
          ${SKY}
          void main(){
            vec3 V = normalize(cameraPosition - vW);
            float dist = length(cameraPosition - vW);
            // ripples: two slow wave trains, calmer toward the far shore
            vec2 q = vW.xz;
            float amp = .05 / (1. + dist * .04);
            vec2 n = vec2(snoise(vec3(q * .35, uTime * .12)), snoise(vec3(q * .35 + 7.3, uTime * .12))) * amp
                   + vec2(sin(q.y * 2.1 + uTime * .9), cos(q.x * 1.7 - uTime * .7)) * amp * .35;
            // rain: rings spreading where the drops land
            if (uRain > .001) {
              for (int L = 0; L < 2; L++) {
                vec2 rq = q * (1.1 + float(L) * .7) + float(L) * 3.7;
                vec2 cell = floor(rq), f = fract(rq) - .5;
                vec2 o = (hash22(cell + float(L) * 9.) - .5) * .5;
                float ph = fract(uTime * .8 + hash12(cell * 1.7 + float(L)));
                vec2 dv = f - o;
                float d = length(dv);
                float ring = exp(-pow((d - ph * .45) * 28., 2.)) * (1. - ph);
                n += dv / (d + 1e-3) * ring * .35 * uRain / (1. + dist * .03);
              }
            }
            // rings spreading from where a lantern lifted off, or where she touched the water
            for (int k = 0; k < 6; k++) {
              vec4 rp = uRipples[k];
              float age = uTime - rp.z;
              if (age < 0. || age > 7. || rp.w <= 0.) continue;
              vec2 dv = q - rp.xy;
              float d = length(dv);
              float front = d - age * 1.6;
              float ring = sin(front * 9.) * exp(-front * front * 1.6) * exp(-age * .55) * rp.w;
              n += dv / (d + 1e-3) * ring * .22;
            }
            vec3 N = normalize(vec3(n.x, 1., n.y));
            vec3 R = reflect(-V, N);
            R.y = abs(R.y);
            float fres = .04 + .96 * pow(1. - max(dot(N, V), 0.), 5.);
            vec3 col = mix(vec3(.004, .006, .016), skyCol(R), clamp(fres * 1.15 + .08, 0., 1.));
            gl_FragColor = vec4(col, uAmt);
          }`,
      }),
    );
    this.water.position.set(0, waterY, zNear - 200);
    this.water.renderOrder = -997;
  }

  private nextRipple = 0;
  /** a ring spreading on the water at world (x, z) */
  ripple(x: number, z: number, strength = 1) {
    this.uniforms.uRipples.value[this.nextRipple++ % 6].set(x, z, this.uniforms.uTime.value, strength);
  }
  readonly waterY: number;

  /** amt: how present the lake is (0…1) · sun: the sunrise (0…1) · rain: rings on the water (0…1) */
  update(camera: THREE.PerspectiveCamera, amt: number, sun: number, rain = 0) {
    this.uniforms.uAmt.value = amt;
    this.uniforms.uRain.value = rain;
    this.uniforms.uSun.value = sun;
    this.sky.visible = this.water.visible = amt > 0.001;
    if (!this.sky.visible) return;
    camera.updateMatrixWorld();
    this.uniforms.uCamWorld.value.copy(camera.matrixWorld);
    this.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
  }
}

/**
 * GLSL for a glowing thing's reflection on the lake: mirror a world position across the water
 * (`mirrorWorld`) and draw it as a soft vertical streak broken by ripples (`streak`).
 */
export const reflectionChunk = /* glsl */ `
  vec3 mirrorWorld(vec3 w, float waterY, float t, float seed){
    vec3 m = vec3(w.x, 2. * waterY - w.y, w.z);
    m.x += sin(t * 1.3 + seed * 20. + m.z) * .06;
    return m;
  }
  float streak(vec2 pc, float t, float seed){
    vec2 c = pc - .5;
    float a = exp(-c.x * c.x * 36.) * smoothstep(.5, .05, abs(c.y));
    a *= .55 + .45 * sin(c.y * 38. + t * 3. + seed * 30.);
    return max(a, 0.);
  }
`;

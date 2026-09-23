/** Reusable GLSL utilities. Concatenate into shaders as needed. */

export const hash = /* glsl */ `
float hash11(float p){ p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
vec3 hash33(vec3 p3){ p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }
`;

export const noise = /* glsl */ `
${hash}
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1,0)), u.x), mix(hash12(i + vec2(0,1)), hash12(i + vec2(1,1)), u.x), u.y);
}
// 3D simplex noise (Ashima / Stefan Gustavson, MIT)
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm2(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; } return s; }
float fbm3(vec3 p){ float a = .5, s = 0.; for (int i = 0; i < 4; i++){ s += a * snoise(p); p = p * 2.01 + 11.3; a *= .5; } return s; }
// cheap curl‑like field from three offset noises
vec3 curlish(vec3 p){
  return vec3(snoise(p + vec3(0., 13.1, 7.7)), snoise(p + vec3(31.4, 0., 3.3)), snoise(p + vec3(5.2, 71.9, 0.)));
}
`;

export const math = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718
mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float easeOutCubic(float t){ return 1. - pow(1. - t, 3.); }
float easeInOutCubic(float t){ return t < .5 ? 4. * t * t * t : 1. - pow(-2. * t + 2., 3.) / 2.; }
float remap(float v, float a, float b){ return clamp((v - a) / (b - a), 0., 1.); }
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b * cos(TAU * (c * t + d)); }
float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(1., 2./3., 1./3.)) * 6. - 3.); return c.z * mix(vec3(1.), clamp(p - 1., 0., 1.), c.y); }
`;

/** Thin‑film iridescence approximation used by glass/chrome surfaces. */
export const iridescence = /* glsl */ `
vec3 thinFilm(float cosTheta, float thickness){
  float d = thickness * (1.0 - cosTheta * .6);
  return .5 + .5 * cos(TAU * (vec3(0.0, .33, .67) + d));
}
vec3 fakeEnv(vec3 r, vec3 tintTop, vec3 tintBottom){
  float h = r.y * .5 + .5;
  vec3 c = mix(tintBottom, tintTop, smoothstep(.0, 1., h));
  c += smoothstep(.92, 1., dot(r, normalize(vec3(.4, .8, .45)))) * 2.2;
  c += smoothstep(.95, 1., dot(r, normalize(vec3(-.7, .2, .6)))) * 1.2;
  c += smoothstep(.6, 1., abs(r.x)) * .08;
  return c;
}
`;

/** Exponential depth fog shared by custom materials. */
export const fog = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogDensity;
vec3 applyFog(vec3 col, float depth){
  float f = 1.0 - exp(-uFogDensity * uFogDensity * depth * depth);
  return mix(col, uFogColor, clamp(f, 0., 1.));
}
`;

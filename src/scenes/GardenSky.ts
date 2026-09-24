import * as THREE from 'three';
import { globalUniforms } from '../world/uniforms';
import { noise, math } from '../shaders/chunks';

/**
 * The garden's sky and lens. Behind the tulips: a real sky with a horizon, rolling hills in
 * the haze, thin clouds, stars, and a moon that becomes a low golden sun as she descends
 * through the garden (the same night‑to‑sunset warmth as the flowers). In front of them: a
 * few large out‑of‑focus lights drifting past the lens, sliding with the camera's movement
 * like real bokeh. Both fade in with the garden and out as it dissolves into the cake room.
 */
export class GardenSky {
  readonly sky: THREE.Mesh;
  readonly bokeh: THREE.Points;
  readonly uniforms = {
    uTime: globalUniforms.uTime,
    uAmt: { value: 0 },
    uWarm: { value: 0 },
    uCamWorld: { value: new THREE.Matrix4() },
    uProjInv: { value: new THREE.Matrix4() },
    uMoonAz: { value: 0.6 },
  };
  private bokehU = {
    uTime: globalUniforms.uTime,
    uAmt: this.uniforms.uAmt,
    uWarm: this.uniforms.uWarm,
    uYaw: { value: 0 },
    uCamY: { value: 0 },
    uPx: { value: 60 },
    uAspect: { value: 1 },
    uTan: { value: 0.4 },
  };
  private yaw = 0;
  private dir = new THREE.Vector3();

  constructor(lowTier: boolean) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.sky = new THREE.Mesh(
      g,
      new THREE.ShaderMaterial({
        // drawn in the opaque pass right after the backdrop (so the garden draws over it), but
        // still blended in by uAmt
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
          uniform float uTime, uAmt, uWarm, uMoonAz;
          varying vec3 vDir;
          void main(){
            vec3 d = normalize(vDir);
            float e = d.y;
            float az = atan(d.z, d.x);
            float w = smoothstep(0., 1., uWarm);
            // the sky: midnight blue‑violet → a rose and amber sunset low on the horizon
            vec3 top = mix(vec3(.018, .02, .06), vec3(.09, .04, .1), w);
            vec3 hor = mix(vec3(.085, .06, .16), vec3(.62, .26, .2), w);
            vec3 col = mix(hor, top, smoothstep(-.02, .55, e));
            col = mix(col, mix(vec3(.16, .08, .22), vec3(.95, .55, .32), w), exp(-abs(e) * 22.) * .3);
            // the moon, sinking and turning into the sun as the garden warms
            vec3 sd = normalize(vec3(cos(uMoonAz), mix(.13, .045, w), sin(uMoonAz)));
            float ca = dot(d, sd);
            float r = mix(.045, .065, w);
            float disc = smoothstep(cos(r * 1.08), cos(r), ca);
            vec3 tang = normalize(cross(sd, vec3(0., 1., 0.)));
            vec2 lp = vec2(dot(d - sd, tang), dot(d - sd, cross(tang, sd))) / r;
            float maria = fbm2(lp * 1.6 + 3.) * (1. - w);
            vec3 moon = mix(vec3(.95, .93, 1.) * (.85 - maria * .35), vec3(1.3, .82, .45), w);
            col = mix(col, moon, disc);
            col += mix(vec3(.55, .6, .95), vec3(1., .6, .32), w) * (exp(-(1. - ca) * mix(420., 260., w)) * .5 + exp(-(1. - ca) * 18.) * mix(.08, .3, w));
            // stars, fading as the light warms and near the horizon
            vec3 sc = floor(d * 260.);
            float st = step(.9975, hash12(sc.xy + sc.z * 17.31));
            col += st * (.5 + .5 * sin(uTime * (1. + hash12(sc.yz) * 3.) + sc.x)) * (1. - w) * smoothstep(.05, .3, e) * vec3(.9, .9, 1.);
            // thin clouds, lit from underneath by the moon or the sun
            vec2 cp = d.xz / (max(e, .02) + .12) * .9;
            float cl = smoothstep(.55, .85, fbm2(cp * .55 + vec2(uTime * .004, 0.))) * smoothstep(.0, .06, e) * smoothstep(.45, .1, e);
            col = mix(col, mix(vec3(.16, .12, .24), vec3(1., .55, .42), w) * (.6 + .6 * exp(-(1. - ca) * 6.)), cl * .55);
            // hills in the haze: a far range and a nearer, darker one, with mist between
            float h1 = .02 + .055 * fbm2(vec2(az * 2.1, 1.3));
            float h2 = -.005 + .06 * fbm2(vec2(az * 3.7 + 4., 7.1)) + .02 * sin(az * 5. + 1.);
            vec3 far = mix(hor * .55, hor * .75, w) + vec3(.02, .01, .03);
            vec3 near = mix(vec3(.03, .02, .05), vec3(.12, .05, .06), w);
            col = mix(col, far, smoothstep(h1 + .002, h1 - .004, e));
            col += hor * exp(-abs(e - h2 - .012) * 60.) * .18;
            col = mix(col, near, smoothstep(h2 + .002, h2 - .004, e));
            // tiny warm lights of distant tulip farms scattered over the near hills
            vec2 fc = vec2(az * 90., e * 260.);
            float lamp = step(.985, hash12(floor(fc))) * smoothstep(.45, .1, length(fract(fc) - .5)) * step(e, h2 - .01) * step(-.06, e);
            col += lamp * vec3(1., .72, .4) * (.4 + .6 * w) * (.6 + .4 * sin(uTime * 2. + floor(fc.x)));
            gl_FragColor = vec4(col, uAmt);
          }`,
      }),
    );
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -999;

    // foreground bokeh: a few large soft lights just in front of the lens
    const n = lowTier ? 9 : 18;
    const seeds = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) seeds.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    bg.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    this.bokeh = new THREE.Points(
      bg,
      new THREE.ShaderMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: this.bokehU,
        vertexShader: /* glsl */ `
          attribute vec4 aSeed;
          uniform float uTime, uYaw, uCamY, uPx, uAspect, uTan;
          varying float vSeed; varying float vZ;
          void main(){
            float z = 1.4 + aSeed.z * 2.6;
            float par = 2.2 / z;
            float x = fract(aSeed.x - uYaw * .16 * par + uTime * .003 * (aSeed.w - .5)) * 2.2 - 1.1;
            float y = fract(aSeed.y + uCamY * .018 * par + uTime * .004 * (.5 + aSeed.w)) * 2.2 - 1.1;
            vec3 vp = vec3(x * z * uTan * uAspect, y * z * uTan, -z);
            gl_Position = projectionMatrix * vec4(vp, 1.);
            gl_PointSize = uPx * (1.4 + aSeed.w * 2.2) / z;
            vSeed = aSeed.w; vZ = z;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uAmt, uWarm, uTime;
          varying float vSeed; varying float vZ;
          void main(){
            float d = length(gl_PointCoord - .5);
            // a lens‑shaped disc: soft edge with a slightly brighter rim, like real bokeh
            float a = smoothstep(.5, .45, d) * (.55 + .45 * smoothstep(.28, .47, d));
            vec3 rose = vec3(1., .55, .68), gold = vec3(1., .8, .5), blue = vec3(.6, .66, 1.);
            vec3 col = mix(mix(blue, rose, step(.45, vSeed)), gold, step(.75, vSeed) + uWarm * .4);
            a *= uAmt * .13 * (.6 + .4 * sin(uTime * .5 + vSeed * 20.)) * smoothstep(1.3, 2.2, vZ);
            gl_FragColor = vec4(col * a, a);
          }`,
      }),
    );
    this.bokeh.frustumCulled = false;
    this.bokeh.renderOrder = 50;
  }

  /** amt: how much of the garden is on screen (0…1) · warm: night → sunset (0…1) */
  update(camera: THREE.PerspectiveCamera, amt: number, warm: number, dpr: number) {
    this.uniforms.uAmt.value = amt;
    this.uniforms.uWarm.value = warm;
    this.sky.visible = this.bokeh.visible = amt > 0.001;
    if (!this.sky.visible) return;
    camera.updateMatrixWorld();
    this.uniforms.uCamWorld.value.copy(camera.matrixWorld);
    this.uniforms.uProjInv.value.copy(camera.projectionMatrixInverse);
    // the moon keeps a little to the right of where she is looking, drifting slowly
    camera.getWorldDirection(this.dir);
    const yaw = Math.atan2(this.dir.z, this.dir.x);
    let dy = yaw - this.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += dy;
    this.uniforms.uMoonAz.value = this.yaw + 0.38 + Math.sin(globalUniforms.uTime.value * 0.01) * 0.05;
    this.bokehU.uYaw.value = this.yaw;
    this.bokehU.uCamY.value = camera.position.y;
    this.bokehU.uPx.value = 60 * dpr * (camera.aspect < 1 ? 1.2 : 1) * (window.innerHeight / 800) * 2.4;
    this.bokehU.uAspect.value = camera.aspect;
    this.bokehU.uTan.value = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  }
}

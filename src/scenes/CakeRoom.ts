import * as THREE from 'three';
import { globalUniforms } from '../world/uniforms';
import { noise, math, fog } from '../shaders/chunks';
import { standardVert } from './materials';
import { rng } from '../utils/math';

/**
 * The room around the cake, staged like a film set: a deep plum velvet drape curving behind
 * the cage, strings of warm fairy lights hung across it (soft and out of focus, like bokeh),
 * and a spotlight from the housing above that pools on the cake, with dust turning in its
 * beam. `setStage(on, dark)`: on = the stage light coming up as the cage opens; dark = the
 * breath of darkness after the candles go out (the fairy lights dim, the spotlight fades).
 */
export class CakeRoom {
  readonly group = new THREE.Group();
  readonly materials: THREE.ShaderMaterial[] = [];
  private u = {
    uTime: globalUniforms.uTime,
    uOn: { value: 0 },
    uDark: { value: 0 },
    uPx: { value: 60 },
    uCake: { value: new THREE.Vector3() },
    uFogColor: globalUniforms.uFogColor,
    uFogDensity: globalUniforms.uFogDensity,
  };

  /** c: the cage centre · front: unit heading toward the camera · floor: floor height */
  constructor(c: THREE.Vector3, front: THREE.Vector3, floor: number, lowTier: boolean) {
    const back = Math.atan2(-front.z, -front.x);
    this.u.uCake.value.set(c.x, floor + 2.2, c.z);

    // the velvet drape: a curved wall of soft folds behind the cage
    const R = 9, H = 9.5, segs = lowTier ? 220 : 420;
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const a = back + (u - 0.5) * 2.7;
      const fold = Math.sin(u * 150) * 0.16 + Math.sin(u * 47 + 1) * 0.1;
      for (let j = 0; j <= 1; j++) {
        const r = R + fold * (j ? 1.4 : 0.8);
        pos.push(c.x + Math.cos(a) * r, floor + j * H, c.z + Math.sin(a) * r);
        uv.push(u, j);
      }
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    dg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    dg.setIndex(idx);
    dg.computeVertexNormals();
    const drapeMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: standardVert,
      fragmentShader: /* glsl */ `
        ${math}
        ${noise}
        ${fog}
        uniform float uOn, uDark, uTime; uniform vec3 uCake;
        varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vUv; varying vec3 vLocal;
        void main(){
          vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vWorldPos);
          if (dot(N, V) < 0.) N = -N;
          vec3 L = uCake - vWorldPos; float d = length(L); L /= d;
          float wrap = max(dot(N, L) * .6 + .4, 0.);
          float glow = wrap / (1. + d * d * .045);
          float sheen = pow(1. - max(dot(N, V), 0.), 2.5);
          vec3 velvet = vec3(.1, .018, .042);
          // warm light from the cake and the fairy lights, fading into darkness toward the top
          vec3 col = velvet * (.08 + glow * (1. + uOn * 1.1)) + vec3(.8, .3, .36) * sheen * glow * .22;
          // folds catch the light in soft vertical bands
          col *= .75 + .25 * smoothstep(-.3, .6, dot(N, L));
          col += vec3(1., .6, .35) * .05 * smoothstep(.75, .35, vUv.y) * (1. - uDark * .8);
          col *= smoothstep(1., .55, vUv.y) * (1. - uDark * .7);
          gl_FragColor = vec4(applyFog(col, vDepth), 1.);
        }`,
      uniforms: this.u,
    });
    this.materials.push(drapeMat);
    this.group.add(new THREE.Mesh(dg, drapeMat));

    // fairy lights: strings draped in catenaries across the velvet
    const rr = rng(1125);
    const bulbs: number[] = [], seeds: number[] = [];
    const strings = lowTier ? 5 : 7;
    for (let s = 0; s < strings; s++) {
      const a0 = back + (rr() - 0.5) * 2.3, a1 = a0 + (rr() > 0.5 ? 1 : -1) * (0.5 + rr() * 0.7);
      const y0 = floor + 3.2 + rr() * 4.5, y1 = floor + 3.2 + rr() * 4.5;
      const sag = 0.8 + rr() * 1.4;
      const n = 22;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const a = a0 + (a1 - a0) * t;
        const r = R - 0.7;
        bulbs.push(c.x + Math.cos(a) * r, y0 + (y1 - y0) * t - Math.sin(Math.PI * t) * sag, c.z + Math.sin(a) * r);
        seeds.push(rr(), rr() < 0.18 ? 1 : 0);
      }
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(bulbs, 3));
    bg.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 2));
    const bulbMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute vec2 aSeed; uniform float uTime, uPx, uDark; varying float vA; varying float vRose;
        void main(){
          vec4 mv = modelViewMatrix * vec4(position, 1.); gl_Position = projectionMatrix * mv;
          vA = (.65 + .35 * sin(uTime * (.8 + aSeed.x * 1.6) + aSeed.x * 40.)) * (1. - uDark * .85);
          vRose = aSeed.y;
          gl_PointSize = uPx * 3.2 / -mv.z; }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying float vRose;
        void main(){ float d = length(gl_PointCoord - .5);
          // out of focus: a soft disc with a faint rim, and a hot centre
          float a = (smoothstep(.5, .38, d) * (.5 + .12 * smoothstep(.3, .46, d)) + smoothstep(.2, 0., d) * .55) * vA;
          vec3 col = mix(vec3(1., .72, .38), vec3(1., .55, .65), vRose);
          gl_FragColor = vec4(col * a, a); }`,
      uniforms: this.u,
    });
    this.materials.push(bulbMat);
    const pts = new THREE.Points(bg, bulbMat);
    pts.frustumCulled = false;
    this.group.add(pts);

    // the spotlight from the housing onto the cake, and a pool of light on the floor
    const beamH = 5.4;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 2.3, beamH, 64, 1, true),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vW; varying float vY;
          void main(){ vY = uv.y; vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: /* glsl */ `
          ${math}
          ${noise}
          uniform float uOn, uDark, uTime; varying vec3 vN; varying vec3 vW; varying float vY;
          void main(){
            vec3 V = normalize(cameraPosition - vW);
            float edge = pow(abs(dot(normalize(vN), V)), 1.6);
            float haze = .75 + .25 * snoise(vW * 1.3 + vec3(0., uTime * .15, 0.));
            float a = edge * haze * (.25 + .75 * vY) * smoothstep(0., .15, vY) * (.03 + uOn * .09) * (1. - uDark * .9);
            gl_FragColor = vec4(vec3(1., .86, .68) * a, a);
          }`,
        uniforms: this.u,
      }),
    );
    this.materials.push(beam.material as THREE.ShaderMaterial);
    beam.position.set(c.x, floor + beamH / 2 - 0.02, c.z);
    this.group.add(beam);
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(3.2, 64).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv - .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
        fragmentShader: `uniform float uOn, uDark; varying vec2 vUv; void main(){ float a = smoothstep(.5, .1, length(vUv)) * (.05 + uOn * .16) * (1. - uDark * .9); gl_FragColor = vec4(vec3(1., .8, .6) * a, a); }`,
        uniforms: this.u,
      }),
    );
    this.materials.push(pool.material as THREE.ShaderMaterial);
    pool.position.set(c.x, floor + 0.03, c.z);
    this.group.add(pool);
    // dust turning slowly in the beam
    const n = lowTier ? 110 : 220;
    const dp = new Float32Array(n * 3), ds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const h = rr();
      const r = Math.sqrt(rr()) * (0.5 + (1 - h) * 1.7);
      const a = rr() * Math.PI * 2;
      dp.set([c.x + Math.cos(a) * r, floor + h * beamH, c.z + Math.sin(a) * r], i * 3);
      ds[i] = rr();
    }
    const dgeo = new THREE.BufferGeometry();
    dgeo.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
    dgeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(ds, 1));
    const dust = new THREE.Points(
      dgeo,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */ `attribute float aSeed; uniform float uTime, uPx, uOn, uDark; varying float vA;
          void main(){ vec3 p = position + vec3(sin(uTime * .2 + aSeed * 30.), sin(uTime * .13 + aSeed * 20.) * .6, cos(uTime * .17 + aSeed * 40.)) * .25;
            vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
            vA = (.3 + .7 * pow(.5 + .5 * sin(uTime * (1. + aSeed * 2.) + aSeed * 60.), 2.)) * (.15 + uOn * .85) * (1. - uDark * .9);
            gl_PointSize = uPx * (.35 + aSeed * .45) / -mv.z; }`,
        fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, 0., d) * vA * .8; gl_FragColor = vec4(vec3(1., .9, .75) * a, a); }`,
        uniforms: this.u,
      }),
    );
    this.materials.push(dust.material as THREE.ShaderMaterial);
    dust.frustumCulled = false;
    this.group.add(dust);
  }

  setStage(on: number, dark: number, dpr: number) {
    this.u.uOn.value = on;
    this.u.uDark.value = dark;
    this.u.uPx.value = 60 * dpr * (window.innerHeight / 800) * 1.4;
  }
}


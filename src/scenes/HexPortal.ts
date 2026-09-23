import * as THREE from 'three';
import { ANCHOR } from '../world/journey';
import { globalUniforms } from '../world/uniforms';
import { noise, math, iridescence, fog } from '../shaders/chunks';
import { createWaterSurface } from '../fluid/Water';

/** Underwater approach to a wall of mirrored hex tiles rippling in concentric rings. */
export class HexPortal {
  readonly group = new THREE.Group();
  readonly materials: THREE.ShaderMaterial[] = [];
  private hex: THREE.InstancedMesh;
  readonly wallCenter = new THREE.Vector3(0, ANCHOR.portal - 0.6, -6);

  constructor(density = 1) {
    const radius = 0.14 / Math.sqrt(Math.max(0.45, density));
    const w = 13, h = 8.4;
    const dx = radius * Math.sqrt(3) * 1.02;
    const dy = radius * 1.5 * 1.02;
    const cols = Math.ceil(w / dx), rows = Math.ceil(h / dy);
    const count = cols * rows;
    const geo = new THREE.CylinderGeometry(radius, radius, 0.1, 6).rotateX(Math.PI / 2).rotateZ(Math.PI / 6);
    const cells = new Float32Array(count * 2);
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        ${math}
        attribute vec2 aCell;
        uniform float uTime; uniform vec2 uHalf;
        varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vCell; varying float vRipple;
        void main(){
          vec2 c = aCell;
          float r = length(c * vec2(1., 1.15));
          float wave = sin(r * 5.5 - uTime * 1.8);
          // concave dish + travelling ripple
          float z = -r * r * .06 + wave * .09 * smoothstep(0., 1.5, r);
          float tilt = cos(r * 5.5 - uTime * 1.8) * .35;
          vec2 dir = normalize(c + 1e-4);
          vec3 p = position;
          // rotate tile about the tangent axis to catch light
          float ca = cos(tilt), sa = sin(tilt);
          vec3 axis = vec3(-dir.y, dir.x, 0.);
          p = p * ca + cross(axis, p) * sa + axis * dot(axis, p) * (1. - ca);
          vec3 n = normal * ca + cross(axis, normal) * sa + axis * dot(axis, normal) * (1. - ca);
          vec4 lp = instanceMatrix * vec4(p, 1.);
          lp.z += z;
          vec4 wp = modelMatrix * lp;
          vWorldPos = wp.xyz;
          vN = normalize(mat3(modelMatrix) * n);
          vCell = c; vRipple = wave;
          vec4 mv = viewMatrix * wp;
          vDepth = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        ${math}
        ${noise}
        ${iridescence}
        ${fog}
        uniform float uTime; uniform vec2 uHalf;
        varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vCell; varying float vRipple;
        void main(){
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 N = normalize(vN);
          float ndv = clamp(dot(N, V), 0., 1.);
          vec3 R = reflect(-V, N);
          // mosaic image across the wall
          vec2 uv = vCell / uHalf * .5 + .5;
          float f = fbm2(uv * 3. + vec2(uTime * .03, 0.));
          vec3 img = mix(vec3(.12, .28, .22), vec3(.75, .62, .35), smoothstep(.3, .75, f));
          img = mix(img, vec3(.45, .3, .7), smoothstep(.55, .8, fbm2(uv * 5. - 2.)) * step(.62, uv.x));
          img = mix(img, vec3(.15, .55, .45), smoothstep(.4, .8, fbm2(uv * 4. + 7.)) * step(uv.x, .62) * step(.42, uv.x) * step(.6, uv.y));
          vec3 env = fakeEnv(R, vec3(.6, .85, .9), vec3(.02, .04, .05));
          vec3 film = thinFilm(ndv, 1.1 + vRipple * .2);
          vec3 col = img * (.12 + .3 * ndv * ndv) + env * film * .6 * pow(1. - ndv, 1.2) + film * .03;
          float edge = smoothstep(.0, 1., length(vCell / uHalf));
          col *= mix(1., .35, edge);
          gl_FragColor = vec4(applyFog(col, vDepth), 1.);
        }`,
      uniforms: {
        uTime: globalUniforms.uTime,
        uHalf: { value: new THREE.Vector2(w / 2, h / 2) },
        uFogColor: globalUniforms.uFogColor,
        uFogDensity: globalUniforms.uFogDensity,
      },
    });
    this.materials.push(mat);
    this.hex = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let r = 0; r < rows; r++)
      for (let q = 0; q < cols; q++) {
        const x = -w / 2 + q * dx + (r % 2 ? dx / 2 : 0);
        const y = -h / 2 + r * dy;
        m.makeTranslation(x, y, 0);
        this.hex.setMatrixAt(i, m);
        cells[i * 2] = x;
        cells[i * 2 + 1] = y;
        i++;
      }
    geo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
    this.hex.position.copy(this.wallCenter);
    this.hex.frustumCulled = false;
    this.group.add(this.hex);

    // crosshair glyph
    const ringGeo = new THREE.RingGeometry(0.62, 0.66, 64);
    const glyphMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, opacity: 0.75, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, glyphMat);
    const bars = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.025), glyphMat);
    const bars2 = bars.clone();
    bars2.rotation.z = Math.PI / 2;
    const glyph = new THREE.Group();
    glyph.add(ring, bars, bars2);
    glyph.position.copy(this.wallCenter).add(new THREE.Vector3(0.1, -0.45, 0.6));
    glyph.scale.setScalar(0.9);
    this.group.add(glyph);

    // water surface above
    const water = createWaterSurface(60);
    water.position.set(0, ANCHOR.portal + 3.4, -4);
    this.materials.push(water.material as THREE.ShaderMaterial);
    this.group.add(water);
  }
}

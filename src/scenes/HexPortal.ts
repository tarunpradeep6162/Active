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
  readonly wallCenter = new THREE.Vector3(0, ANCHOR.portal - 1.2, -7);

  constructor(density = 1) {
    const radius = 0.14 / Math.sqrt(Math.max(0.45, density));
    const dx = radius * Math.sqrt(3) * 1.1;
    const dy = radius * 1.5 * 1.1;
    const geo = new THREE.CylinderGeometry(radius, radius, 0.1, 6).rotateX(Math.PI / 2).rotateZ(Math.PI / 6);
    const makeMat = (dish: number, half: THREE.Vector2) =>
      new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        ${math}
        attribute vec2 aCell;
        uniform float uTime; uniform vec2 uHalf; uniform float uDish;
        varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vCell; varying float vRipple;
        void main(){
          vec2 c = aCell;
          float r = length(c * vec2(1., 1.15));
          float wave = sin(r * 5.5 - uTime * 1.8);
          // concave dish + travelling ripple (back wall); side walls only shimmer
          float z = -r * r * .16 * uDish + wave * .09 * smoothstep(0., 1.5, r);
          float tilt = cos(r * 5.5 - uTime * 1.8) * .35;
          vec2 dir = normalize(c + 1e-4);
          vec3 p = position;
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
        uniform float uTime; uniform vec2 uHalf; uniform float uDish;
        varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vCell; varying float vRipple;
        void main(){
          vec3 V = normalize(cameraPosition - vWorldPos);
          vec3 N = normalize(vN);
          float ndv = clamp(dot(N, V), 0., 1.);
          vec3 R = reflect(-V, N);
          vec2 uv = vCell / uHalf * .5 + .5;
          float f = fbm2(uv * 3. + vec2(uTime * .03, 0.) + uDish * 4.);
          vec3 img = mix(vec3(.12, .28, .22), vec3(.75, .62, .35), smoothstep(.3, .75, f));
          img = mix(img, vec3(.45, .3, .7), smoothstep(.55, .8, fbm2(uv * 5. - 2.)) * step(.62, uv.x));
          img = mix(img, vec3(.15, .55, .45), smoothstep(.4, .8, fbm2(uv * 4. + 7.)) * step(uv.x, .62) * step(.42, uv.x) * step(.6, uv.y));
          img = mix(vec3(luma(img)), img, .7);
          vec3 env = fakeEnv(R, vec3(.12, .2, .24), vec3(.0, .005, .01));
          vec3 film = thinFilm(ndv, 1.1 + vRipple * .2);
          vec3 col = img * img * (.16 + .28 * ndv * ndv) + env * mix(vec3(1.), film, .7) * (.25 + .9 * pow(1. - ndv, 1.2));
          vec2 e = abs(vCell / uHalf);
          float edge = max(e.x, e.y);
          col *= 1. - smoothstep(.8, 1., edge) * .6;
          col *= mix(.45, 1., smoothstep(.0, .5, length(vCell / uHalf)) * uDish + (1. - uDish));
          gl_FragColor = vec4(applyFog(col, vDepth), 1.);
        }`,
      uniforms: {
        uTime: globalUniforms.uTime,
        uHalf: { value: half },
        uDish: { value: dish },
        uFogColor: globalUniforms.uFogColor,
        uFogDensity: globalUniforms.uFogDensity,
      },
    });
    const wall = (w: number, h: number, dish: number) => {
      const cols = Math.ceil(w / dx), rows = Math.ceil(h / dy);
      const count = cols * rows;
      const cells = new Float32Array(count * 2);
      const mat = makeMat(dish, new THREE.Vector2(w / 2, h / 2));
      this.materials.push(mat);
      const g = geo.clone();
      const mesh = new THREE.InstancedMesh(g, mat, count);
      const m = new THREE.Matrix4();
      let i = 0;
      for (let r = 0; r < rows; r++)
        for (let q = 0; q < cols; q++) {
          const x = -w / 2 + q * dx + (r % 2 ? dx / 2 : 0);
          const y = -h / 2 + r * dy;
          m.makeTranslation(x, y, 0);
          mesh.setMatrixAt(i, m);
          cells[i * 2] = x;
          cells[i * 2 + 1] = y;
          i++;
        }
      g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2));
      mesh.frustumCulled = false;
      return mesh;
    };
    const W = 5.6, H = 5.2, side = 4.2;
    this.hex = wall(W, H, 1);
    this.hex.position.copy(this.wallCenter);
    this.group.add(this.hex);
    for (const sgn of [-1, 1]) {
      const sw = wall(side, H, 0);
      sw.position.set(this.wallCenter.x + sgn * (W / 2 + Math.cos(1.05) * side * 0.5), this.wallCenter.y, this.wallCenter.z + Math.sin(1.05) * side * 0.5);
      sw.rotation.y = -sgn * 1.05;
      this.group.add(sw);
    }

    // crosshair glyph
    const ringGeo = new THREE.RingGeometry(0.62, 0.66, 64);
    const glyphMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, opacity: 0.45, depthWrite: false });
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
    water.renderOrder = -1;
    this.materials.push(water.material as THREE.ShaderMaterial);
    this.group.add(water);
  }
}

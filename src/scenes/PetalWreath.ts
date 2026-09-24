import * as THREE from 'three';
import { globalUniforms } from '../world/uniforms';
import { rng } from '../utils/math';

/**
 * The threshold of the garden: a wreath of tulip petals and leaves (where a glass ring used to
 * be), with gold light flowing round it and a soft glow inside, like a doorway into the
 * garden. Same size and plane as the old ring (radius 2.9, in XY), so it is placed and turned
 * the same way. `setOpacity` fades it with the section.
 */
export class PetalWreath {
  readonly group = new THREE.Group();
  readonly materials: THREE.ShaderMaterial[] = [];
  private u = { uTime: globalUniforms.uTime, uOpacity: { value: 1 }, uPx: globalUniforms.uDPR };

  constructor(lowTier = false) {
    const R = 2.9;
    const rr = rng(1125);

    // one cupped petal (base at the origin, along +Y, facing +Z)
    const pg = new THREE.PlaneGeometry(1, 1, 6, 8);
    const pp = pg.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < pp.count; i++) {
      const u = pp.getX(i) * 2, v = pp.getY(i) + 0.5;
      const w = 0.34 * Math.pow(Math.sin(Math.PI * (0.1 + 0.88 * v)), 0.6);
      pp.setXYZ(i, u * w, v * 0.62, -u * u * 0.09 + Math.sin(Math.PI * v) * 0.06);
    }
    pg.computeVertexNormals();
    const n = lowTier ? 320 : 560;
    const petals = new THREE.InstancedMesh(pg, this.petalMaterial(), n);
    const col = new Float32Array(n * 3);
    const palette = ['#f2a3b8', '#e87a98', '#f7c3cf', '#e9c9a0', '#b8305a', '#d9577a', '#f4b0c0'].map((c) => new THREE.Color(c));
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rr() * 0.05;
      const off = 0.12 + rr() * 0.4, ang = rr() * Math.PI * 2;
      // around the ring, and around the ring's tube, a little fuller on the front
      const radial = R + Math.cos(ang) * off;
      p.set(Math.cos(a) * radial, Math.sin(a) * radial, Math.sin(ang) * off * 0.7 + 0.1);
      e.set(rr() * 1.2 - 0.3, rr() * 1.2 - 0.6, a - Math.PI / 2 + (rr() - 0.5) * 1.8);
      q.setFromEuler(e);
      const s = 0.5 + rr() * 0.45;
      petals.setMatrixAt(i, m.compose(p, q, sc.set(s, s, s)));
      palette[Math.floor(rr() * palette.length)].toArray(col, i * 3);
    }
    pg.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
    petals.frustumCulled = false;
    this.group.add(petals);

    // leaves tucked among the petals
    const lg = new THREE.PlaneGeometry(1, 1, 2, 8);
    const lp = lg.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < lp.count; i++) {
      const u = lp.getX(i) * 2, v = lp.getY(i) + 0.5;
      const w = 0.12 * Math.sin(Math.PI * Math.min(1, v * 1.05 + 0.03));
      lp.setXYZ(i, u * w, v * 0.9, Math.abs(u) * 0.03 + v * v * 0.12);
    }
    lg.computeVertexNormals();
    const nl = lowTier ? 70 : 130;
    const leaves = new THREE.InstancedMesh(lg, this.petalMaterial(), nl);
    const lc = new Float32Array(nl * 3);
    for (let i = 0; i < nl; i++) {
      const a = rr() * Math.PI * 2, off = 0.25 + rr() * 0.4, ang = rr() * Math.PI * 2;
      const radial = R + Math.cos(ang) * off;
      p.set(Math.cos(a) * radial, Math.sin(a) * radial, Math.sin(ang) * off * 0.6 - 0.05);
      e.set(rr() * 0.8, rr() * 0.8 - 0.4, a + (rr() > 0.5 ? 0 : Math.PI) + (rr() - 0.5));
      q.setFromEuler(e);
      leaves.setMatrixAt(i, m.compose(p, q, sc.set(1, 1, 1)));
      new THREE.Color(rr() > 0.5 ? '#2f5a2c' : '#41733a').toArray(lc, i * 3);
    }
    lg.setAttribute('aColor', new THREE.InstancedBufferAttribute(lc, 3));
    leaves.frustumCulled = false;
    this.group.add(leaves);

    // gold light flowing round the wreath
    const nm = lowTier ? 260 : 520;
    const md = new Float32Array(nm * 4);
    for (let i = 0; i < nm; i++) md.set([rr(), rr(), rr(), rr()], i * 4);
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nm * 3), 3));
    mg.setAttribute('aD', new THREE.BufferAttribute(md, 4));
    const motes = new THREE.Points(
      mg,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: this.u,
        vertexShader: /* glsl */ `attribute vec4 aD; uniform float uTime, uPx, uOpacity; varying float vA;
          void main(){
            float a = aD.x * 6.2832 + uTime * (.06 + aD.y * .1);
            float off = (aD.z - .5) * 1.4, ang = aD.w * 6.2832 + uTime * .3;
            float r = ${R.toFixed(2)} + cos(ang) * off;
            vec3 p = vec3(cos(a) * r, sin(a) * r, sin(ang) * off * .6 + .2);
            vec4 mv = modelViewMatrix * vec4(p, 1.); gl_Position = projectionMatrix * mv;
            vA = uOpacity * (.3 + .7 * pow(.5 + .5 * sin(uTime * (1. + aD.y * 2.) + aD.x * 60.), 3.));
            gl_PointSize = uPx * 60. * (.3 + aD.y * .5) / -mv.z; }`,
        fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - .5); float a = (smoothstep(.5, 0., d) * .4 + smoothstep(.12, 0., d)) * vA; gl_FragColor = vec4(vec3(1., .84, .56) * a, a); }`,
      }),
    );
    motes.frustumCulled = false;
    this.materials.push(motes.material as THREE.ShaderMaterial);
    this.group.add(motes);

    // a soft glow inside, like light on the far side of a doorway
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(R * 1.25, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: this.u,
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv - .5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
        fragmentShader: `uniform float uOpacity, uTime; varying vec2 vUv; void main(){ float r = length(vUv) * 2.; float a = (smoothstep(1., .2, r) * .08 + exp(-pow((r - .78) * 7., 2.)) * .12) * uOpacity * (.85 + .15 * sin(uTime * .8)); gl_FragColor = vec4(vec3(1., .72, .62) * a, a); }`,
      }),
    );
    glow.position.z = -0.2;
    this.materials.push(glow.material as THREE.ShaderMaterial);
    this.group.add(glow);
  }

  private petalMaterial() {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      uniforms: this.u,
      vertexShader: /* glsl */ `attribute vec3 aColor; uniform float uTime; varying vec3 vN; varying vec3 vCol; varying vec3 vW; varying float vV;
        void main(){ vec3 p = position; p.z += sin(uTime * 1.1 + float(gl_InstanceID) * .7) * .02 * p.y;
          vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); vCol = aColor; vV = uv.y;
          gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `uniform float uOpacity; varying vec3 vN; varying vec3 vCol; varying vec3 vW; varying float vV;
        void main(){
          vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW); if (dot(N, V) < 0.) N = -N;
          vec3 L = normalize(vec3(-.4, .6, .8));
          float ndl = max(dot(N, L), 0.);
          float back = pow(max(dot(-N, L), 0.), 1.5) * .5 + pow(1. - max(dot(N, V), 0.), 2.) * .35;
          vec3 c = vCol * (.12 + ndl * .75 + back * vec3(1., .7, .65)) * mix(.75, 1.1, vV);
          gl_FragColor = vec4(c * .95, uOpacity);
        }`,
    });
    this.materials.push(mat);
    return mat;
  }

  setOpacity(o: number) {
    this.u.uOpacity.value = o;
  }
}

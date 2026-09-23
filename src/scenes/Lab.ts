import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { iridescentMaterial, darkLitMaterial, standardVert } from './materials';
import { ANCHOR } from '../world/journey';
import { globalUniforms } from '../world/uniforms';
import { noise, math, fog } from '../shaders/chunks';
import { rng } from '../utils/math';

/** The lab rig: chrome cage, ring platforms, hanging cables, wet floor. The red particle mass is added by World. */
export class Lab {
  readonly group = new THREE.Group();
  readonly materials: THREE.ShaderMaterial[] = [];
  readonly center = new THREE.Vector3(0, ANCHOR.lab, 0);

  constructor() {
    const c = this.center;
    const chrome = iridescentMaterial({ base: '#12080b', envTop: '#b0475e', envBottom: '#0a0406', film: 0.45, glow: 0.3 });
    this.materials.push(chrome);

    // ring platforms
    const rings: THREE.BufferGeometry[] = [];
    for (const [dy, rad] of [
      [2.9, 2.5],
      [2.55, 2.3],
      [1.4, 2.2],
      [-1.75, 2.35],
    ] as const) {
      rings.push(new THREE.TorusGeometry(rad, 0.06, 10, 96).rotateX(Math.PI / 2).translate(0, dy, 0).toNonIndexed());
    }
    const top = new THREE.CylinderGeometry(2.55, 2.55, 0.16, 64, 1, true).translate(0, 3.05, 0).toNonIndexed();
    rings.push(top);
    rings.forEach((g) => g.deleteAttribute('uv'));
    const ringMesh = new THREE.Mesh(mergeGeometries(rings)!, chrome);
    ringMesh.position.copy(c);
    this.group.add(ringMesh);

    // vertical rods
    const rodGeo = new THREE.CylinderGeometry(0.03, 0.03, 5.0, 8);
    const rods = new THREE.InstancedMesh(rodGeo, chrome, 18);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = i % 3 === 0 ? 2.5 : 2.25;
      m.makeTranslation(c.x + Math.cos(a) * r, c.y + 0.6, c.z + Math.sin(a) * r);
      rods.setMatrixAt(i, m);
    }
    rods.computeBoundingSphere();
    this.group.add(rods);

    // hanging cables (catenaries) from the top ring down to the floor
    const cables: THREE.BufferGeometry[] = [];
    const rr = rng(21);
    for (let i = 0; i < 14; i++) {
      const a0 = rr() * Math.PI * 2;
      const a1 = a0 + (rr() - 0.5) * 1.6;
      const r0 = 2.3, r1 = 2.8 + rr() * 3.5;
      const p0 = new THREE.Vector3(Math.cos(a0) * r0, 2.9, Math.sin(a0) * r0);
      const p2 = new THREE.Vector3(Math.cos(a1) * r1, -2.05, Math.sin(a1) * r1);
      const p1 = p0.clone().lerp(p2, 0.5);
      p1.y -= 1.2 + rr() * 1.4;
      p1.x *= 0.8;
      p1.z *= 0.8;
      const curve = new THREE.QuadraticBezierCurve3(p0, p1, p2);
      const g = new THREE.TubeGeometry(curve, 48, 0.022 + rr() * 0.02, 6, false).toNonIndexed();
      g.deleteAttribute('uv');
      cables.push(g);
    }
    const cableMat = darkLitMaterial('#14030a', '#c8203f', c.clone(), '#7a2a3c');
    this.materials.push(cableMat);
    const cableMesh = new THREE.Mesh(mergeGeometries(cables)!, cableMat);
    cableMesh.position.copy(c);
    this.group.add(cableMesh);


    // wet reflective floor
    const floorMat = new THREE.ShaderMaterial({
      vertexShader: standardVert,
      fragmentShader: /* glsl */ `
        ${math}
        ${noise}
        ${fog}
        uniform vec3 uCenter; uniform float uTime;
        varying vec3 vN; varying vec3 vWorldPos; varying float vDepth; varying vec2 vUv; varying vec3 vLocal;
        void main(){
          vec2 d = vWorldPos.xz - uCenter.xz;
          float r = length(d);
          float ripple = sin(r * 7. - uTime * 1.6) * .5 + .5;
          float n = fbm2(vWorldPos.xz * .6 + uTime * .05);
          vec3 red = vec3(1., .12, .28);
          float glow = exp(-r * .55) * 1.6 + exp(-r * 1.8) * 2.5;
          vec3 col = vec3(.004, .006, .008) + red * glow * (.1 + .12 * ripple * n);
          // streaky reflection of the rods
          col += red * .12 * smoothstep(.96, 1., sin(atan(d.y, d.x) * 18.)) * exp(-abs(r - 2.3) * 1.5);
          gl_FragColor = vec4(applyFog(col, vDepth), 1.);
        }
      `,
      uniforms: {
        uCenter: { value: c.clone() },
        uTime: globalUniforms.uTime,
        uFogColor: globalUniforms.uFogColor,
        uFogDensity: globalUniforms.uFogDensity,
      },
    });
    this.materials.push(floorMat);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), floorMat);
    floor.position.set(c.x, c.y - 2.1, c.z);
    this.group.add(floor);
  }

  update(time: number) {
    this.group.children[0].rotation.y = time * 0.05;
  }
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { iridescentMaterial, darkLitMaterial } from './materials';
import { createWaterFloor } from '../fluid/Water';
import { ANCHOR } from '../world/journey';
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
    for (let i = 0; i < 22; i++) {
      const a0 = rr() * Math.PI * 2;
      const a1 = a0 + (rr() - 0.5) * 1.6;
      const r0 = 2.3, r1 = 2.8 + rr() * 3.5;
      const p0 = new THREE.Vector3(Math.cos(a0) * r0, 3.3 + rr() * 0.8, Math.sin(a0) * r0);
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


    // wet environmental water floor (becomes the portal's surface from below)
    const floor = createWaterFloor(c, 40);
    floor.position.set(c.x, c.y - 2.1, c.z);
    this.materials.push(floor.material as THREE.ShaderMaterial);
    this.group.add(floor);

    // murky room: large dark housing above the cage, leaning buttresses, rocks
    const concrete = darkLitMaterial('#060708', '#2c0610', c.clone().add(new THREE.Vector3(0, 0.6, 0)), '#081c1e');
    this.materials.push(concrete);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.75, 1.7, 48, 1, true), concrete);
    housing.material.side = THREE.DoubleSide;
    housing.position.set(c.x, c.y + 4.0, c.z);
    this.group.add(housing);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.75, 2.75, 0.1, 48), concrete);
    cap.position.set(c.x, c.y + 4.85, c.z);
    this.group.add(cap);
    for (const [x, z, lean, h] of [[-5.2, -2.5, 0.28, 11], [5.6, -2.8, -0.3, 11], [-8.5, -6, 0.12, 12], [8.8, -6.5, -0.15, 12]] as const) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, h, 1.8).translate(0, h / 2, 0), concrete);
      b.position.set(c.x + x, c.y - 2.3, c.z + z);
      b.rotation.set(0, x > 0 ? -0.4 : 0.4, lean);
      this.group.add(b);
    }
    const rockGeo = new THREE.DodecahedronGeometry(0.6, 1);
    const rocks = new THREE.InstancedMesh(rockGeo, concrete, 9);
    const rm = new THREE.Matrix4(), rq = new THREE.Quaternion(), rs = new THREE.Vector3(), rp = new THREE.Vector3(), re = new THREE.Euler();
    const rr2 = rng(77);
    for (let i = 0; i < 9; i++) {
      const side = i < 6 ? 1 : -1;
      rp.set(c.x + side * (2.8 + rr2() * 2.4), c.y - 2.15, c.z + 0.5 + rr2() * 2.5);
      re.set(rr2() * 3, rr2() * 3, rr2() * 3);
      rq.setFromEuler(re);
      const k = 0.5 + rr2() * 1.1;
      rs.set(k * 1.4, k * 0.6, k);
      rocks.setMatrixAt(i, rm.compose(rp, rq, rs));
    }
    rocks.computeBoundingSphere();
    this.group.add(rocks);
    // foreground silhouettes left/right of frame
    for (const side of [-1, 1]) {
      const fg = new THREE.Mesh(new THREE.BoxGeometry(1.2, 10, 1.2), concrete);
      fg.position.set(c.x + side * 6.4, c.y + 2.5, c.z + 5.8);
      fg.rotation.set(0, side * 0.5, side * -0.08);
      this.group.add(fg);
    }
  }

  update(time: number) {
    this.group.children[0].rotation.y = time * 0.05;
  }
}

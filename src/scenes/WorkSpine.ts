import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { iridescentMaterial } from './materials';
import { ANCHOR } from '../world/journey';
import { rng } from '../utils/math';

function vertebra() {
  const body = new THREE.CylinderGeometry(0.4, 0.46, 0.3, 16, 1);
  const disc = new THREE.TorusGeometry(0.42, 0.06, 6, 20).rotateX(Math.PI / 2).translate(0, 0.18, 0);
  const wingL = new THREE.CapsuleGeometry(0.1, 0.5, 3, 7).rotateZ(Math.PI / 2 + 0.35).translate(-0.62, 0.06, -0.2);
  const wingR = new THREE.CapsuleGeometry(0.1, 0.5, 3, 7).rotateZ(-Math.PI / 2 - 0.35).translate(0.62, 0.06, -0.2);
  const spike = new THREE.CapsuleGeometry(0.09, 0.45, 3, 7).rotateX(-Math.PI / 2 - 0.6).translate(0, -0.12, -0.6);
  const knobA = new THREE.SphereGeometry(0.13, 8, 6).translate(-0.34, 0.12, -0.42);
  const knobB = new THREE.SphereGeometry(0.13, 8, 6).translate(0.34, 0.12, -0.42);
  const parts = [body, disc, wingL, wingR, spike, knobA, knobB].map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.deleteAttribute('uv');
    return ng;
  });
  return mergeGeometries(parts, false)!;
}

/** The iridescent vertebral column + chain that the work cards orbit. */
export class WorkSpine {
  readonly group = new THREE.Group();
  readonly materials: THREE.ShaderMaterial[] = [];
  private spine: THREE.InstancedMesh;
  private chain: THREE.InstancedMesh;

  constructor() {
    const top = ANCHOR.workTop + 10;
    const bottom = ANCHOR.workBottom - 8;
    const spacing = 0.58;
    const count = Math.floor((top - bottom) / spacing);
    const mat = iridescentMaterial({ base: '#140f24', envTop: '#9fb4e8', envBottom: '#2a1438', film: 1.3, glow: 0.7 });
    this.materials.push(mat);
    this.spine = new THREE.InstancedMesh(vertebra(), mat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    const r = rng(7);
    for (let i = 0; i < count; i++) {
      const y = top - i * spacing;
      const bend = Math.sin(y * 0.09) * 0.35;
      p.set(bend, y, Math.cos(y * 0.07) * 0.25);
      e.set(0.12 * Math.sin(y * 0.3), Math.sin(y * 0.05) * 0.9 + (r() - 0.5) * 0.08, 0.08 * Math.cos(y * 0.2));
      q.setFromEuler(e);
      const sc = 0.95 + 0.25 * Math.sin(y * 0.21) + r() * 0.08;
      s.set(sc, sc * 0.9, sc);
      this.spine.setMatrixAt(i, m.compose(p, q, s));
    }
    this.spine.instanceMatrix.needsUpdate = true;
    this.spine.computeBoundingSphere();
    this.group.add(this.spine);

    // chain links spiralling around the column
    const linkGeo = new THREE.TorusGeometry(0.15, 0.038, 6, 16).scale(1, 1.7, 1);
    const chainMat = iridescentMaterial({ base: '#07183a', envTop: '#7fb4ff', envBottom: '#081238', film: 0.8, glow: 0.9 });
    this.materials.push(chainMat);
    const linkSpacing = 0.36;
    const links = Math.floor((top - bottom) / linkSpacing);
    this.chain = new THREE.InstancedMesh(linkGeo, chainMat, links);
    const up = new THREE.Vector3(0, 1, 0), tan = new THREE.Vector3(), prev = new THREE.Vector3();
    const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    const helixPoint = (y: number, out: THREE.Vector3) => {
      const a = y * 0.16 + 0.6;
      const rad = 1.0 + 0.15 * Math.sin(y * 0.4);
      return out.set(Math.sin(y * 0.09) * 0.35 + Math.cos(a) * rad, y, Math.sin(a) * rad * 0.9 + 0.1);
    };
    for (let i = 0; i < links; i++) {
      const y = top - i * linkSpacing;
      helixPoint(y, p);
      helixPoint(y - 0.05, prev);
      tan.subVectors(prev, p).normalize();
      qa.setFromUnitVectors(up, tan);
      qb.setFromAxisAngle(up, (i % 2) * Math.PI * 0.5);
      q.multiplyQuaternions(qa, qb);
      s.setScalar(1);
      this.chain.setMatrixAt(i, m.compose(p, q, s));
    }
    this.chain.instanceMatrix.needsUpdate = true;
    this.chain.computeBoundingSphere();
    this.group.add(this.chain);
  }

  update(time: number) {
    this.group.rotation.y = Math.sin(time * 0.1) * 0.05;
  }
}

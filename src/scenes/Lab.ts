import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { iridescentMaterial, darkLitMaterial } from './materials';
import { createWaterFloor } from '../fluid/Water';
import { ANCHOR } from '../world/journey';
import { rng, clamp, smoothstep } from '../utils/math';
import { BirthdayCake } from './BirthdayCake';

/** Heading (from the centre) the lab camera looks along — the lock hangs on that side. */
const FRONT_DEG = 70;
const ease = (a: number, b: number, t: number) => smoothstep(a, b, t);

/**
 * The lab rig: chrome cage, ring platforms, hanging cables, wet floor — with a birthday cake
 * locked inside. Touching the cage (or the cake) plays the unlock: the padlock pops, the bars and
 * lower rings slide up into the housing, and the cake rises on its stand and comes forward while
 * its candles light one by one.
 */
export class Lab {
  readonly group = new THREE.Group();
  readonly materials: THREE.ShaderMaterial[] = [];
  readonly center = new THREE.Vector3(0, ANCHOR.lab, 0);
  readonly cake = new BirthdayCake();
  /** meshes a tap can hit to open the cage */
  readonly pickables: THREE.Object3D[] = [];
  private opened = false;
  /** page time at which the cage was opened */
  private openedAt = 0;
  private time = 0;
  private bars = new THREE.Group();
  private cables = new THREE.Group();
  private lock = new THREE.Group();
  private shackle!: THREE.Mesh;
  private front = new THREE.Vector3(Math.cos((FRONT_DEG * Math.PI) / 180), 0, Math.sin((FRONT_DEG * Math.PI) / 180));
  private cakeHome = new THREE.Vector3();

  constructor() {
    const c = this.center;
    const chrome = iridescentMaterial({ base: '#12080b', envTop: '#b0475e', envBottom: '#0a0406', film: 0.45, glow: 0.3 });
    this.materials.push(chrome);

    // ring platforms: the top pair stays with the housing, the lower pair lifts with the bars
    const ringsOf = (list: readonly (readonly [number, number])[]) => {
      const gs = list.map(([dy, rad]) => new THREE.TorusGeometry(rad, 0.06, 10, 96).rotateX(Math.PI / 2).translate(0, dy, 0).toNonIndexed());
      gs.forEach((g) => g.deleteAttribute('uv'));
      return gs;
    };
    const topParts = ringsOf([[2.9, 2.5], [2.55, 2.3]]);
    const topCyl = new THREE.CylinderGeometry(2.55, 2.55, 0.16, 64, 1, true).translate(0, 3.05, 0).toNonIndexed();
    topCyl.deleteAttribute('uv');
    const ringMesh = new THREE.Mesh(mergeGeometries([...topParts, topCyl])!, chrome);
    ringMesh.position.copy(c);
    this.group.add(ringMesh);
    this.bars.position.copy(c);
    this.group.add(this.bars);
    const lowerRings = new THREE.Mesh(mergeGeometries(ringsOf([[1.4, 2.2], [-1.75, 2.35]]))!, chrome);
    this.bars.add(lowerRings);

    // vertical rods (the bars of the cage)
    const rodGeo = new THREE.CylinderGeometry(0.03, 0.03, 5.0, 8);
    const rods = new THREE.InstancedMesh(rodGeo, chrome, 18);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = i % 3 === 0 ? 2.5 : 2.25;
      m.makeTranslation(Math.cos(a) * r, 0.6, Math.sin(a) * r);
      rods.setMatrixAt(i, m);
    }
    rods.computeBoundingSphere();
    this.bars.add(rods);
    this.pickables.push(rods, lowerRings);

    // the padlock, hanging from the middle ring on the side the camera sees
    const lockGold = iridescentMaterial({ base: '#5a3a10', envTop: '#ffe2a8', envBottom: '#3a1c06', film: 0.2, glow: 0.8 });
    this.materials.push(lockGold);
    const lockShape = new THREE.Shape();
    lockShape.moveTo(-0.16, -0.14); lockShape.lineTo(0.16, -0.14); lockShape.quadraticCurveTo(0.2, -0.14, 0.2, -0.1);
    lockShape.lineTo(0.2, 0.1); lockShape.quadraticCurveTo(0.2, 0.14, 0.16, 0.14); lockShape.lineTo(-0.16, 0.14);
    lockShape.quadraticCurveTo(-0.2, 0.14, -0.2, 0.1); lockShape.lineTo(-0.2, -0.1); lockShape.quadraticCurveTo(-0.2, -0.14, -0.16, -0.14);
    const keyhole = new THREE.Path(); keyhole.absarc(0, 0.02, 0.035, 0, Math.PI * 2, true);
    lockShape.holes.push(keyhole);
    const body = new THREE.Mesh(new THREE.ExtrudeGeometry(lockShape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 3 }).translate(0, 0, -0.05), lockGold);
    this.shackle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.028, 10, 32, Math.PI), lockGold);
    this.shackle.position.y = 0.13;
    this.lock.add(body, this.shackle);
    this.lock.position.copy(this.front).multiplyScalar(2.32).add(c).setY(c.y + 1.05);
    this.lock.lookAt(this.lock.position.clone().add(this.front));
    this.lock.userData.baseScale = 1.7;
    this.group.add(this.lock);
    this.pickables.push(body, this.shackle);

    // the cake, standing on the floor inside the cage
    this.cakeHome.set(c.x, c.y - 2.1, c.z);
    this.cake.group.position.copy(this.cakeHome);
    this.cake.group.scale.setScalar(1.18);
    this.group.add(this.cake.group);
    this.materials.push(...this.cake.materials);
    this.pickables.push(...this.cake.pickables);
    this.cake.syncLights(c.clone().add(this.front.clone().multiplyScalar(6)).setY(c.y + 1.5));

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
    // hung from a pivot at the top ring so they can be reeled up when the cage opens
    const cableMesh = new THREE.Mesh(mergeGeometries(cables)!.translate(0, -3.4, 0), cableMat);
    this.cables.position.set(c.x, c.y + 3.4, c.z);
    this.cables.add(cableMesh);
    this.group.add(this.cables);


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

  get isOpen() {
    return this.opened;
  }

  /** Start the unlock (idempotent). */
  open() {
    if (this.opened) return;
    this.opened = true;
    this.openedAt = this.time;
  }

  update(time: number, dpr = 1) {
    this.time = time;
    this.group.children[0].rotation.y = time * 0.05;
    const t = this.opened ? time - this.openedAt : -1;
    const c = this.center;
    // locked: the lock breathes a little glow so it reads as touchable
    const pop = ease(0, 0.5, t);
    this.shackle.position.y = 0.13 + pop * 0.08;
    this.shackle.rotation.y = pop * 1.1;
    const drop = ease(0.6, 1.3, t);
    this.lock.visible = drop < 1;
    this.lock.scale.setScalar(Math.max(0.001, 1 - drop) * 1.7 * (t < 0 ? 1 + Math.sin(time * 2.4) * 0.04 : 1));
    this.lock.rotation.z = drop * 2.4;
    // bars and lower rings slide up into the housing
    this.bars.position.y = c.y + ease(0.8, 2.6, t) * 5.4;
    this.bars.rotation.y = ease(0.8, 2.6, t) * 0.6;
    // the cables are reeled up into the housing
    const reel = ease(0.9, 2.8, t);
    this.cables.scale.set(1 - reel * 0.55, Math.max(0.04, 1 - reel * 0.96), 1 - reel * 0.55);
    this.cables.visible = reel < 0.98;
    // the cake rises and comes forward, turning to show itself
    const rise = ease(1.8, 3.6, t);
    this.cake.group.position.copy(this.cakeHome).addScaledVector(this.front, rise * 1.7);
    this.cake.group.position.y += rise * 0.35 + (t > 3.6 ? Math.sin((t - 3.6) * 1.2) * 0.04 : 0);
    this.cake.group.rotation.y = rise * 0.9 + (t > 3.6 ? (t - 3.6) * 0.18 : 0);
    const lit = clamp((t - 2.4) / 1.8);
    const burst = t < 0 ? 0 : ease(2.8, 3.4, t) * (1 - ease(3.4, 6, t) * 0.45);
    this.cake.syncLights(c.clone().add(this.front.clone().multiplyScalar(6)).setY(c.y + 1.5));
    this.cake.update(time, t < 0 ? 0 : lit, burst, dpr);
  }
}

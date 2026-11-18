// Harbor of Two Hours — an original surrealist study.
//
// Two hours share one canvas. The sky dome is a sunlit afternoon with
// sculpted cumulus. The stone harbor below is night: the dome gives the
// ground no light. One iron beacon lantern and two amber windows are the
// only light sources. The quays, the stepped terrace, the bell-tower, the
// sea-gate, the curved breakwater, and the trees are one merged mesh. The
// skiff is a second mesh that rocks on the basin. The basin mirrors the scene
// through one planar reflection pass. The post pass adds a thin oil glaze: a
// symmetric nearest-neighbour filter, canvas weave, and pooled varnish.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { fbm2, fbm3, mulberry32, smoothstep, type RGB } from '../util';

// ---------------------------------------------------------------------------
// Plan of the harbor. The water is at y = 0. The viewer looks toward -z.
// ---------------------------------------------------------------------------

const QUAY_Y = 1.15;
const TERRACE_Y = 4.45;
const QUAY = { x0: -96, x1: 4.8, zFront: 2, zBack: -6 };
const TERRACE = { x0: -96, x1: -1.6, zFront: -6, zBack: -20 };
const STAIR = { xFoot: -2.4, tread: 0.56, rise: 0.3, steps: 11, landing: 1.6, zOut: -3.7 };
const STAIR_X_END = STAIR.xFoot - STAIR.tread * STAIR.steps - STAIR.landing;
const TOWER = { x: -15.2, z: -10.6, half: 1.75, shaft: 9.3, belfry: 3.0 };
const HOUSE = { x0: -13.45, x1: -6.4, z0: -12.6, z1: -8.6, wall: 4.2 };
const GATE = { x: 8, z: -9, halfW: 3.2, depth: 3, top: 8.3, spring: 3.4, radius: 1.75 };
const MOLE = { cx: 2, cz: 3, r: 15.12, a0: -0.94, a1: 0.52, half: 1.25, deck: 1.55, parapet: 0.85 };
const BEACON_POST = { x: 0.6, z: 0.45, top: QUAY_Y + 5.9 };
const BEACON = new THREE.Vector3(BEACON_POST.x, BEACON_POST.top - 0.795, BEACON_POST.z + 1.1);
const SKIFF = { x: 1.3, z: 15.6, yaw: 0.22 };
const PILE = { x: 5.3, z: 14.1, top: 1.5 };

const M_ASHLAR = 0, M_MOLE = 1, M_PLASTER = 2, M_ROOF = 3, M_WOOD = 4, M_IRON = 5, M_LIT = 6, M_LANTERN = 7, M_FOLIAGE = 8, M_LAND = 9, M_BRONZE = 10, M_ROPE = 11;

const STONE: RGB = [0.43, 0.41, 0.37];
const COPING: RGB = [0.52, 0.5, 0.45];
const PLASTER: RGB = [0.5, 0.47, 0.41];
const TILE: RGB = [0.34, 0.16, 0.1];
const TIMBER: RGB = [0.3, 0.21, 0.13];
const IRON: RGB = [0.035, 0.036, 0.04];

/** Height of the walkable surface at a plan point. The water counts as zero. */
function surfaceAt(x: number, z: number): number {
  if (x >= TERRACE.x0 && x <= TERRACE.x1 && z >= TERRACE.zBack && z <= TERRACE.zFront) return TERRACE_Y;
  if (x >= STAIR_X_END && x <= STAIR.xFoot && z > TERRACE.zFront && z <= STAIR.zOut) {
    const step = Math.min(Math.floor((STAIR.xFoot - x) / STAIR.tread) + 1, STAIR.steps);
    return QUAY_Y + step * STAIR.rise;
  }
  if (x >= QUAY.x0 && x <= QUAY.x1 && z >= QUAY.zBack && z <= QUAY.zFront) return QUAY_Y;
  if (x >= TERRACE.x1 && x <= GATE.x + GATE.halfW && z >= GATE.z - GATE.depth / 2 && z <= QUAY.zBack) {
    return x >= GATE.x - GATE.halfW ? GATE.top : QUAY_Y;
  }
  const r = Math.hypot(x - MOLE.cx, z - MOLE.cz);
  const a = Math.atan2(z - MOLE.cz, x - MOLE.cx);
  if (Math.abs(r - MOLE.r) <= MOLE.half + 0.9 && a >= MOLE.a0 - 0.1 && a <= MOLE.a1 + 0.16) return MOLE.deck + MOLE.parapet;
  return 0;
}

// ---------------------------------------------------------------------------
// Mesh builder: collects every part into one geometry (one draw call).
// ---------------------------------------------------------------------------

type V3 = [number, number, number];

class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly dat: number[] = [];
  private readonly mat: number[] = [];

  private vertex(p: V3, n: V3, d: RGB, m: number): void {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.dat.push(d[0], d[1], d[2]);
    this.mat.push(m);
  }

  /** Flat triangle. The builder sets the winding so that the face looks toward `out`. */
  tri(a: V3, b: V3, c: V3, out: V3, color: RGB, m: number): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-10) throw new Error('MeshBuilder.tri received a degenerate triangle');
    nx /= len; ny /= len; nz /= len;
    const facing = nx * out[0] + ny * out[1] + nz * out[2];
    if (facing === 0) throw new Error('MeshBuilder.tri received an outward hint that lies in the face');
    if (facing > 0) {
      const n: V3 = [nx, ny, nz];
      this.vertex(a, n, color, m); this.vertex(b, n, color, m); this.vertex(c, n, color, m);
    } else {
      const n: V3 = [-nx, -ny, -nz];
      this.vertex(a, n, color, m); this.vertex(c, n, color, m); this.vertex(b, n, color, m);
    }
  }

  quad(a: V3, b: V3, c: V3, d: V3, out: V3, color: RGB, m: number): void {
    this.tri(a, b, c, out, color, m);
    this.tri(a, c, d, out, color, m);
  }

  /** Upright window pane that faces +z. The payload carries uv and the height-to-width ratio (0 = square head). */
  pane(x0: number, x1: number, y0: number, y1: number, z: number, arched: boolean): void {
    const n: V3 = [0, 0, 1];
    const ratio = arched ? (y1 - y0) / (x1 - x0) : 0;
    const corner = (x: number, y: number, u: number, v: number): void => this.vertex([x, y, z], n, [u, v, ratio], M_LIT);
    corner(x0, y0, 0, 0); corner(x1, y0, 1, 0); corner(x1, y1, 1, 1);
    corner(x0, y0, 0, 0); corner(x1, y1, 1, 1); corner(x0, y1, 0, 1);
  }

  /** Adds a geometry with its normals. The builder disposes the geometry. */
  add(g: THREE.BufferGeometry, m4: THREE.Matrix4 | null, color: RGB, m: number): void {
    const src = g.index ? g.toNonIndexed() : g;
    const p = src.getAttribute('position'), n = src.getAttribute('normal');
    if (!n) throw new Error('MeshBuilder.add received a geometry without normals');
    const nm = m4 ? new THREE.Matrix3().getNormalMatrix(m4) : null;
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      if (m4) v.applyMatrix4(m4);
      this.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i);
      if (nm) v.applyMatrix3(nm).normalize();
      this.nor.push(v.x, v.y, v.z);
      this.dat.push(color[0], color[1], color[2]);
      this.mat.push(m);
    }
    if (src !== g) src.dispose();
    g.dispose();
  }

  /** Box given by its two corners. */
  block(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: RGB, m: number): void {
    if (x1 <= x0 || y1 <= y0 || z1 <= z0) throw new Error(`MeshBuilder.block has no volume: ${[x0, y0, z0, x1, y1, z1].join(', ')}`);
    this.add(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), new THREE.Matrix4().makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), color, m);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aDat', new THREE.Float32BufferAttribute(this.dat, 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 1));
    return g;
  }
}

function at(x: number, y: number, z: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(x, y, z);
}

/**
 * Smooth parametric surface on a grid. `facing` is +1 when the normals must
 * point away from `centre` and -1 when they must point toward it.
 */
function surface(nu: number, nv: number, wrapU: boolean, fn: (u: number, v: number) => THREE.Vector3, centre: THREE.Vector3, facing: 1 | -1): THREE.BufferGeometry {
  const cols = wrapU ? nu : nu + 1;
  const pos: number[] = [];
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i < cols; i++) {
      const p = fn(i / nu, j / nv);
      pos.push(p.x, p.y, p.z);
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const i1 = wrapU ? (i + 1) % nu : i + 1;
      const a = j * cols + i, b = j * cols + i1, c = (j + 1) * cols + i, d = (j + 1) * cols + i1;
      idx.push(a, b, d, a, d, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Vote over the vertices: the mean of (p - centre) . n gives the side that the normals look at.
  const p = g.getAttribute('position'), n = g.getAttribute('normal');
  let vote = 0;
  for (let i = 0; i < p.count; i++) vote += (p.getX(i) - centre.x) * n.getX(i) + (p.getY(i) - centre.y) * n.getY(i) + (p.getZ(i) - centre.z) * n.getZ(i);
  if (vote === 0) throw new Error('surface() cannot tell which side the normals look at');
  if (Math.sign(vote) !== facing) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

interface Opening { x: number; sill: number; width: number; spring: number }

/**
 * Wall in the local xy plane with round-headed openings, extruded along z and
 * centred on z = 0. An opening whose sill is at the wall foot becomes a notch.
 */
function archWall(b: MeshBuilder, width: number, y0: number, y1: number, depth: number, openings: Opening[], m4: THREE.Matrix4, color: RGB, m: number): void {
  const shape = new THREE.Shape();
  const notches = openings.filter((o) => o.sill <= y0).sort((p, q) => p.x - q.x);
  shape.moveTo(-width / 2, y0);
  for (const o of notches) {
    shape.lineTo(o.x - o.width / 2, y0);
    shape.lineTo(o.x - o.width / 2, o.spring);
    shape.absarc(o.x, o.spring, o.width / 2, Math.PI, 0, true);
    shape.lineTo(o.x + o.width / 2, y0);
  }
  shape.lineTo(width / 2, y0);
  shape.lineTo(width / 2, y1);
  shape.lineTo(-width / 2, y1);
  shape.closePath();
  for (const o of openings) {
    if (o.sill <= y0) continue;
    const hole = new THREE.Path();
    hole.moveTo(o.x - o.width / 2, o.sill);
    hole.lineTo(o.x - o.width / 2, o.spring);
    hole.absarc(o.x, o.spring, o.width / 2, Math.PI, 0, true);
    hole.lineTo(o.x + o.width / 2, o.sill);
    hole.closePath();
    shape.holes.push(hole);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 14 });
  g.translate(0, 0, -depth / 2);
  b.add(g, m4, color, m);
}

interface WindowLight { x: number; y: number; z: number; power: number }

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

function buildQuays(b: MeshBuilder): void {
  // Lower quay: the long front quay and the short arm that reaches the sea-gate.
  b.block(QUAY.x0, -3, QUAY.zBack, QUAY.x1, QUAY_Y, QUAY.zFront, STONE, M_ASHLAR);
  b.block(TERRACE.x1, -3, GATE.z - GATE.depth / 2, QUAY.x1, QUAY_Y, QUAY.zBack, STONE, M_ASHLAR);
  // Kerb stones on the water edge.
  b.block(QUAY.x0, QUAY_Y - 0.24, QUAY.zFront - 0.3, QUAY.x1 + 0.08, QUAY_Y + 0.07, QUAY.zFront + 0.09, COPING, M_ASHLAR);

  // Upper terrace with a parapet. The parapet opens at the head of the stair.
  b.block(TERRACE.x0, -3, TERRACE.zBack, TERRACE.x1, TERRACE_Y, TERRACE.zFront, STONE, M_ASHLAR);
  const parapet = (x0: number, x1: number, z0: number, z1: number): void => {
    b.block(x0, TERRACE_Y, z0, x1, TERRACE_Y + 0.92, z1, STONE, M_ASHLAR);
    b.block(x0 - 0.06, TERRACE_Y + 0.92, z0 - 0.06, x1 + 0.06, TERRACE_Y + 1.03, z1 + 0.06, COPING, M_ASHLAR);
  };
  const stairHead = STAIR.xFoot - STAIR.tread * (STAIR.steps - 1);
  parapet(TERRACE.x0, STAIR_X_END, TERRACE.zFront - 0.36, TERRACE.zFront);
  parapet(stairHead, TERRACE.x1, TERRACE.zFront - 0.36, TERRACE.zFront);
  parapet(TERRACE.x1 - 0.36, TERRACE.x1, TERRACE.zBack, TERRACE.zFront - 0.36);
  // String course under the parapet.
  b.block(TERRACE.x0, TERRACE_Y - 0.2, TERRACE.zFront, TERRACE.x1 + 0.07, TERRACE_Y, TERRACE.zFront + 0.07, COPING, M_ASHLAR);

  // The stair climbs along the terrace wall. Each layer is one course of stone.
  for (let i = 0; i < STAIR.steps; i++) {
    b.block(STAIR_X_END, QUAY_Y + STAIR.rise * i, TERRACE.zFront, STAIR.xFoot - STAIR.tread * i, QUAY_Y + STAIR.rise * (i + 1), STAIR.zOut, i % 2 === 0 ? COPING : STONE, M_ASHLAR);
  }

  // Water stair on the quay face: six steps go down into the basin.
  for (let j = 0; j < 6; j++) {
    b.block(-9.5 + 0.55 * j, -3, QUAY.zFront, -9.5 + 0.55 * (j + 1), QUAY_Y - 0.26 * (j + 1), QUAY.zFront + 1.15, COPING, M_ASHLAR);
  }

  // Mooring bollards.
  for (const x of [-18.5, -12.2, -5.1, 3.4]) {
    b.add(new THREE.CylinderGeometry(0.15, 0.2, 0.52, 10), at(x, QUAY_Y + 0.26, QUAY.zFront - 0.62), IRON, M_IRON);
    b.add(new THREE.CylinderGeometry(0.23, 0.2, 0.13, 10), at(x, QUAY_Y + 0.58, QUAY.zFront - 0.62), IRON, M_IRON);
  }

  // Two casks, a crate, and a coil of rope near the beacon.
  const stave = [0.26, 0.31, 0.34, 0.35, 0.34, 0.31, 0.26].map((r, i) => new THREE.Vector2(r, (i / 6) * 0.86));
  b.add(new THREE.LatheGeometry(stave, 16), at(-1.5, QUAY_Y, -1.1), TIMBER, M_WOOD);
  b.add(new THREE.LatheGeometry(stave, 16), at(-2.25, QUAY_Y, -0.72), TIMBER, M_WOOD);
  b.add(new THREE.CircleGeometry(0.26, 16).rotateX(-Math.PI / 2), at(-1.5, QUAY_Y + 0.86, -1.1), [0.24, 0.17, 0.1], M_WOOD);
  b.add(new THREE.CircleGeometry(0.26, 16).rotateX(-Math.PI / 2), at(-2.25, QUAY_Y + 0.86, -0.72), [0.24, 0.17, 0.1], M_WOOD);
  b.add(new THREE.BoxGeometry(0.72, 0.6, 0.72), new THREE.Matrix4().makeRotationY(0.4).setPosition(-3.2, QUAY_Y + 0.3, -1.5), [0.33, 0.25, 0.16], M_WOOD);
  b.add(new THREE.TorusGeometry(0.3, 0.06, 6, 20).rotateX(Math.PI / 2), at(2.3, QUAY_Y + 0.06, -0.6), [0.36, 0.3, 0.2], M_ROPE);
  b.add(new THREE.TorusGeometry(0.2, 0.055, 6, 18).rotateX(Math.PI / 2), at(2.3, QUAY_Y + 0.16, -0.6), [0.36, 0.3, 0.2], M_ROPE);
}

function buildTower(b: MeshBuilder, windows: WindowLight[]): void {
  const { x, z, half } = TOWER;
  const shaftTop = TERRACE_Y + TOWER.shaft;
  const belfryTop = shaftTop + TOWER.belfry;
  b.block(x - half - 0.14, TERRACE_Y, z - half - 0.14, x + half + 0.14, TERRACE_Y + 0.55, z + half + 0.14, COPING, M_ASHLAR);
  b.block(x - half, TERRACE_Y + 0.55, z - half, x + half, shaftTop, z + half, PLASTER, M_PLASTER);
  b.block(x - half - 0.12, shaftTop - 0.24, z - half - 0.12, x + half + 0.12, shaftTop, z + half + 0.12, COPING, M_ASHLAR);
  // Belfry: four thin walls, each with one round-headed opening. The sky shows through.
  for (let k = 0; k < 4; k++) {
    const m4 = new THREE.Matrix4().makeRotationY((k * Math.PI) / 2);
    const off = new THREE.Vector3(0, 0, half - 0.21).applyMatrix4(m4);
    m4.setPosition(x + off.x, shaftTop, z + off.z);
    archWall(b, half * 2, 0, TOWER.belfry, 0.42, [{ x: 0, sill: 0.55, width: 1.3, spring: 1.75 }], m4, PLASTER, M_PLASTER);
  }
  b.block(x - half - 0.2, belfryTop, z - half - 0.2, x + half + 0.2, belfryTop + 0.3, z + half + 0.2, COPING, M_ASHLAR);
  b.add(new THREE.ConeGeometry((half + 0.2) * Math.SQRT2, 2.7, 4, 1, false, Math.PI / 4), at(x, belfryTop + 0.3 + 1.35, z), TILE, M_ROOF);
  b.add(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), at(x, belfryTop + 3.4, z), IRON, M_IRON);
  b.add(new THREE.SphereGeometry(0.13, 10, 8), at(x, belfryTop + 3.75, z), IRON, M_IRON);
  // Bell and headstock.
  const bell = [[0.0, 0.74], [0.12, 0.72], [0.2, 0.62], [0.24, 0.4], [0.3, 0.2], [0.42, 0.06], [0.5, 0.0]].map(([r, h]) => new THREE.Vector2(r, h));
  b.add(new THREE.LatheGeometry(bell, 18), at(x, shaftTop + 1.25, z), [0.3, 0.22, 0.1], M_BRONZE);
  b.block(x - half + 0.1, shaftTop + 2.0, z - 0.1, x + half - 0.1, shaftTop + 2.2, z + 0.1, TIMBER, M_WOOD);
  b.add(new THREE.SphereGeometry(0.09, 8, 6), at(x, shaftTop + 1.22, z), IRON, M_IRON);

  // The lit window of the tower: a narrow round-headed slit.
  const sill = TERRACE_Y + 5.3, w = 0.66, h = 1.4, zf = z + half;
  b.pane(x - w / 2, x + w / 2, sill, sill + h, zf + 0.012, true);
  b.block(x - w / 2 - 0.22, sill - 0.14, zf, x + w / 2 + 0.22, sill, zf + 0.16, COPING, M_ASHLAR);
  b.block(x - 0.022, sill, zf + 0.012, x + 0.022, sill + h, zf + 0.04, IRON, M_IRON);
  windows.push({ x, y: sill + h * 0.5, z: zf + 0.06, power: 0.8 });
}

function buildWatchhouse(b: MeshBuilder, windows: WindowLight[]): void {
  const { x0, x1, z0, z1 } = HOUSE;
  const top = TERRACE_Y + HOUSE.wall;
  b.block(x0, TERRACE_Y, z0, x1, top, z1, PLASTER, M_PLASTER);
  b.block(x0, TERRACE_Y, z0 - 0.06, x1 + 0.06, TERRACE_Y + 0.4, z1 + 0.06, COPING, M_ASHLAR);
  // Gable roof. The ridge runs along x.
  const e = 0.3, ridge = top + 1.55, zm = (z0 + z1) / 2;
  const a: V3 = [x0, top, z1 + e], c: V3 = [x1 + e, top, z1 + e], d: V3 = [x1 + e, top, z0 - e], f: V3 = [x0, top, z0 - e];
  const r0: V3 = [x0, ridge, zm], r1: V3 = [x1 + e, ridge, zm];
  b.quad(a, c, r1, r0, [0, 1, 1], TILE, M_ROOF);
  b.quad(d, f, r0, r1, [0, 1, -1], TILE, M_ROOF);
  b.tri([x1, top, z1], [x1, top, z0], [x1, ridge - 0.1, zm], [1, 0, 0], PLASTER, M_PLASTER);
  b.quad([x0, top - 0.06, z0 - e], [x1 + e, top - 0.06, z0 - e], [x1 + e, top - 0.06, z1 + e], [x0, top - 0.06, z1 + e], [0, -1, 0], [0.2, 0.14, 0.09], M_WOOD);
  // Chimney.
  b.block(-8.5, top + 0.3, -11.7, -7.8, top + 2.5, -11.1, PLASTER, M_PLASTER);
  b.block(-8.58, top + 2.5, -11.78, -7.72, top + 2.64, -11.02, COPING, M_ASHLAR);

  // Door with a stone lintel and one step.
  const dx = -11.7;
  b.block(dx - 0.5, TERRACE_Y, z1, dx + 0.5, TERRACE_Y + 2.1, z1 + 0.06, [0.16, 0.12, 0.08], M_WOOD);
  b.block(dx - 0.72, TERRACE_Y + 2.1, z1, dx + 0.72, TERRACE_Y + 2.34, z1 + 0.14, COPING, M_ASHLAR);
  b.block(dx - 0.8, TERRACE_Y, z1, dx + 0.8, TERRACE_Y + 0.16, z1 + 0.5, COPING, M_ASHLAR);
  // The lit window of the watchhouse, with glazing bars and open shutters.
  const wx = -8.35, sill = TERRACE_Y + 1.45, w = 1.0, h = 1.3;
  b.pane(wx - w / 2, wx + w / 2, sill, sill + h, z1 + 0.012, false);
  b.block(wx - w / 2 - 0.16, sill - 0.13, z1, wx + w / 2 + 0.16, sill, z1 + 0.18, COPING, M_ASHLAR);
  b.block(wx - w / 2 - 0.14, sill + h, z1, wx + w / 2 + 0.14, sill + h + 0.16, z1 + 0.12, COPING, M_ASHLAR);
  b.block(wx - 0.022, sill, z1 + 0.012, wx + 0.022, sill + h, z1 + 0.04, IRON, M_IRON);
  b.block(wx - w / 2, sill + h * 0.5 - 0.02, z1 + 0.012, wx + w / 2, sill + h * 0.5 + 0.02, z1 + 0.04, IRON, M_IRON);
  for (const s of [-1, 1]) {
    const sx = wx + s * (w / 2 + 0.27);
    b.block(sx - 0.25, sill, z1, sx + 0.25, sill + h, z1 + 0.05, [0.13, 0.17, 0.15], M_WOOD);
  }
  windows.push({ x: wx, y: sill + h * 0.5, z: z1 + 0.06, power: 1 });
}

function buildGate(b: MeshBuilder): void {
  const { x, z, halfW, depth, top, spring, radius } = GATE;
  archWall(b, halfW * 2, -3, top, depth, [{ x: 0, sill: -3, width: radius * 2, spring }], at(x, 0, z), STONE, M_ASHLAR);
  // String course, keystone, and merlons.
  b.block(x - halfW - 0.08, top - 1.5, z - depth / 2 - 0.08, x + halfW + 0.08, top - 1.28, z + depth / 2 + 0.08, COPING, M_ASHLAR);
  b.block(x - 0.26, spring + radius - 0.1, z + depth / 2, x + 0.26, spring + radius + 0.62, z + depth / 2 + 0.1, COPING, M_ASHLAR);
  for (let i = 0; i < 5; i++) {
    const mx = x - halfW + 0.55 + i * ((halfW * 2 - 1.1) / 4);
    b.block(mx - 0.42, top, z - depth / 2, mx + 0.42, top + 0.75, z + depth / 2, STONE, M_ASHLAR);
  }
  // Buttress at each flank.
  for (const s of [-1, 1]) {
    b.block(x + s * (halfW - 0.45) - 0.45, -3, z + depth / 2, x + s * (halfW - 0.45) + 0.45, 4.6, z + depth / 2 + 0.45, STONE, M_ASHLAR);
    b.block(x + s * (halfW - 0.45) - 0.5, 4.6, z + depth / 2, x + s * (halfW - 0.45) + 0.5, 4.78, z + depth / 2 + 0.5, COPING, M_ASHLAR);
  }
}

/** Curved breakwater: a swept section with a parapet on the sea side and a round head. */
function buildMole(b: MeshBuilder): void {
  const SEG = 44;
  const { cx, cz, r, a0, a1, half, deck, parapet } = MOLE;
  const rIn = r - half, rOut = r + half, rPar = rOut - 0.46, topY = deck + parapet;
  const pt = (a: number, rad: number, y: number): V3 => [cx + Math.cos(a) * rad, y, cz + Math.sin(a) * rad];
  for (let i = 0; i < SEG; i++) {
    const p = a0 + ((a1 - a0) * i) / SEG, q = a0 + ((a1 - a0) * (i + 1)) / SEG, mid = (p + q) / 2;
    const out: V3 = [Math.cos(mid), 0, Math.sin(mid)], inward: V3 = [-out[0], 0, -out[2]], up: V3 = [0, 1, 0];
    b.quad(pt(p, rIn, -3), pt(q, rIn, -3), pt(q, rIn, deck), pt(p, rIn, deck), inward, STONE, M_MOLE);
    b.quad(pt(p, rIn, deck), pt(q, rIn, deck), pt(q, rPar, deck), pt(p, rPar, deck), up, STONE, M_MOLE);
    b.quad(pt(p, rPar, deck), pt(q, rPar, deck), pt(q, rPar, topY), pt(p, rPar, topY), inward, STONE, M_MOLE);
    b.quad(pt(p, rPar, topY), pt(q, rPar, topY), pt(q, rOut, topY), pt(p, rOut, topY), up, COPING, M_MOLE);
    b.quad(pt(p, rOut, -3), pt(q, rOut, -3), pt(q, rOut, topY), pt(p, rOut, topY), out, STONE, M_MOLE);
  }
  // Round head with a stone daymark and a bollard.
  const head = pt(a1, r, 0);
  b.add(new THREE.CylinderGeometry(2.05, 2.25, deck + 3.25, 28), at(head[0], (deck + 0.25 - 3) / 2, head[2]), STONE, M_MOLE);
  b.add(new THREE.CylinderGeometry(2.2, 2.2, 0.2, 28), at(head[0], deck + 0.3, head[2]), COPING, M_MOLE);
  b.add(new THREE.CylinderGeometry(0.2, 0.42, 2.3, 4, 1, false, Math.PI / 4), at(head[0] + 0.3, deck + 1.55, head[2] + 0.5), COPING, M_ASHLAR);
  b.add(new THREE.CylinderGeometry(0.15, 0.2, 0.5, 10), at(head[0] - 0.9, deck + 0.65, head[2] - 0.5), IRON, M_IRON);
}

/** Wrought-iron beacon: a post with a crook, a scroll, and a hanging hexagonal lantern. */
function buildBeacon(b: MeshBuilder): void {
  const { x, z, top } = BEACON_POST;
  b.block(x - 0.36, QUAY_Y, z - 0.36, x + 0.36, QUAY_Y + 0.34, z + 0.36, COPING, M_ASHLAR);
  b.add(new THREE.CylinderGeometry(0.12, 0.2, 0.62, 8), at(x, QUAY_Y + 0.65, z), IRON, M_IRON);
  const shaftFoot = QUAY_Y + 0.96;
  b.add(new THREE.CylinderGeometry(0.05, 0.085, top - shaftFoot, 8), at(x, (top + shaftFoot) / 2, z), IRON, M_IRON);
  for (const y of [shaftFoot + 0.05, shaftFoot + 0.6, top - 1.2, top - 0.05]) b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 8), at(x, y, z), IRON, M_IRON);
  // The crook lies in the y-z plane and reaches toward the water.
  const turn = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  b.add(new THREE.TorusGeometry(0.55, 0.034, 6, 22, Math.PI), turn.clone().setPosition(x, top, z + 0.55), IRON, M_IRON);
  b.add(new THREE.TorusGeometry(0.25, 0.02, 5, 20, Math.PI * 1.5), turn.clone().setPosition(x, top - 0.34, z + 0.3), IRON, M_IRON);
  b.add(new THREE.TorusGeometry(0.13, 0.016, 5, 16, Math.PI * 1.6), turn.clone().setPosition(x, top - 0.78, z + 0.18), IRON, M_IRON);
  const lx = BEACON.x, lz = BEACON.z, ly = BEACON.y;
  b.add(new THREE.CylinderGeometry(0.014, 0.014, 0.32, 5), at(lx, top - 0.14, lz), IRON, M_IRON);
  b.add(new THREE.CylinderGeometry(0.05, 0.3, 0.22, 6), at(lx, ly + 0.385, lz), IRON, M_IRON);
  b.add(new THREE.CylinderGeometry(0.24, 0.15, 0.55, 6, 1, true), at(lx, ly, lz), [1, 1, 1], M_LANTERN);
  b.add(new THREE.CylinderGeometry(0.16, 0.06, 0.11, 6), at(lx, ly - 0.33, lz), IRON, M_IRON);
  b.add(new THREE.SphereGeometry(0.035, 6, 5), at(lx, ly - 0.42, lz), IRON, M_IRON);
  // Glazing bars on the six edges of the glass.
  const upAxis = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const head = new THREE.Vector3(lx + Math.sin(a) * 0.243, ly + 0.275, lz + Math.cos(a) * 0.243);
    const foot = new THREE.Vector3(lx + Math.sin(a) * 0.153, ly - 0.275, lz + Math.cos(a) * 0.153);
    const m4 = new THREE.Matrix4().compose(
      head.clone().add(foot).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(upAxis, head.clone().sub(foot).normalize()),
      new THREE.Vector3(1, 1, 1),
    );
    b.add(new THREE.CylinderGeometry(0.011, 0.011, head.distanceTo(foot), 4), m4, IRON, M_IRON);
  }
}

/** Cypress: one lumpy spindle on a short trunk. The payload carries a seed for the leaf fringe. */
function cypress(b: MeshBuilder, x: number, z: number, height: number, radius: number, seed: number): void {
  const base = TERRACE_Y;
  b.add(new THREE.CylinderGeometry(0.11, 0.16, 1.2, 7), at(x, base + 0.6, z), [0.09, 0.07, 0.05], M_WOOD);
  const centre = new THREE.Vector3(x, base + height * 0.45, z);
  const g = surface(26, 40, true, (u, v) => {
    const a = u * Math.PI * 2;
    const profile = Math.pow(smoothstep(0, 0.16, v), 0.6) * Math.pow(1 - v, 0.6) * 1.32;
    const lump = fbm3(Math.cos(a) * 1.5 + seed, v * height * 0.5, Math.sin(a) * 1.5 + seed * 0.7, 3) - 0.5;
    const fine = fbm3(Math.cos(a) * 5 + seed * 3, v * height * 1.7, Math.sin(a) * 5, 2) - 0.5;
    const r = radius * profile * (1 + 0.62 * lump + 0.3 * fine) + 0.012;
    return new THREE.Vector3(x + Math.cos(a) * r, base + 0.7 + v * height, z + Math.sin(a) * r);
  }, centre, 1);
  b.add(g, null, [seed, 0, 0], M_FOLIAGE);
}

/** Stone pine: a leaning trunk under a flat crown of lumpy masses. */
function pine(b: MeshBuilder, x: number, z: number, height: number, lean: number, spread: number, rand: () => number): void {
  const base = TERRACE_Y;
  const top = new THREE.Vector3(x + lean, base + height, z - 0.3);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x, base - 0.1, z),
    new THREE.Vector3(x + lean * 0.18, base + height * 0.35, z + 0.08),
    new THREE.Vector3(x + lean * 0.62, base + height * 0.72, z - 0.15),
    top,
  ]);
  b.add(new THREE.TubeGeometry(curve, 18, 0.19, 7), null, [0.1, 0.075, 0.055], M_WOOD);
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * spread;
    const k = 0.95 + 0.55 * rand();
    const seed = rand() * 40;
    const centre = new THREE.Vector3(top.x + Math.cos(a) * d, top.y + 0.35 + (1 - d / spread) * 0.7 + (rand() - 0.5) * 0.4, top.z + Math.sin(a) * d * 0.85);
    const g = new THREE.IcosahedronGeometry(1, 3);
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    for (let v = 0; v < p.count; v++) {
      const px = p.getX(v), py = p.getY(v), pz = p.getZ(v);
      const s = 1 + 0.5 * (fbm3(px * 1.7 + seed, py * 1.7, pz * 1.7 + seed, 3) - 0.5);
      // The sphere normal gives a soft, rounded mass.
      n.setXYZ(v, px, py, pz);
      p.setXYZ(v, px * s, py * s, pz * s);
    }
    const m4 = new THREE.Matrix4().compose(centre, new THREE.Quaternion(), new THREE.Vector3(1.75 * k, 0.8 * k, 1.6 * k));
    b.add(g, m4, [seed, 0, 0], M_FOLIAGE);
  }
}

/** Low scrub land behind the terrace, and a dark headland far away. */
function buildHeadland(b: MeshBuilder): void {
  const near = surface(60, 40, false, (u, v) => {
    const x = -170 + 172 * u, z = TERRACE.zBack + 2 - 124 * v;
    // The land leaves the terrace level, rolls a little, and goes down to the sea on three sides.
    const shore = smoothstep(1, 0.86, u) * smoothstep(0, 0.1, u) * smoothstep(1, 0.72, v);
    const roll = 4.2 * smoothstep(0.05, 0.6, v) * fbm2(u * 6 + 9, v * 5 + 2, 3);
    return new THREE.Vector3(x, (TERRACE_Y - 0.06 + roll) * shore - 2.5 * (1 - shore), z);
  }, new THREE.Vector3(-80, -300, -80), 1);
  b.add(near, null, [0.06, 0.07, 0.05], M_LAND);
  const g = surface(72, 22, false, (u, v) => {
    const x = -760 + 700 * u, z = -150 - 300 * v;
    const env = smoothstep(0, 0.12, v) * smoothstep(1, 0.6, v) * smoothstep(1, 0.72, u) * (0.45 + 0.55 * smoothstep(0.75, 0.1, u));
    return new THREE.Vector3(x, 46 * env * (0.35 + fbm2(u * 7 + 3, v * 3 + 1, 4)) - 1.5, z);
  }, new THREE.Vector3(-400, -400, -300), 1);
  b.add(g, null, [0.05, 0.06, 0.055], M_LAND);
}

/** Half beam, gunwale height, and keel height of the skiff at station u (0 = stern, 1 = bow). */
function hullStation(u: number): { beam: number; gunwale: number; keel: number } {
  const fore = Math.max(u - 0.42, 0) / 0.58;
  const beam = 0.76 * (u < 0.42 ? 0.6 + 0.4 * smoothstep(0, 0.42, u) : Math.pow(Math.max(1 - Math.pow(fore, 2.3), 0), 0.72)) + 0.02;
  const gunwale = 0.42 + 0.2 * fore * fore + 0.05 * Math.pow(Math.max(0.4 - u, 0) / 0.4, 2);
  const keel = -0.14 + 0.3 * Math.pow(Math.max(u - 0.5, 0) / 0.5, 3) + 0.06 * Math.pow(Math.max(0.3 - u, 0) / 0.3, 2);
  return { beam, gunwale, keel };
}

/** Wooden skiff in its own frame: the bow points to +x, the keel is near y = 0. */
function buildSkiff(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  const L = 2.2, FLOOR = 0.1;
  const paint: RGB = [0.66, 0.67, 0.62], inside: RGB = [0.46, 0.36, 0.23];
  const outer = (u: number, v: number): THREE.Vector3 => {
    const st = hullStation(u);
    const s = v * 2 - 1, th = Math.abs(s) * Math.PI * 0.5;
    return new THREE.Vector3(-L + 2 * L * u, st.keel + (st.gunwale - st.keel) * (1 - Math.pow(Math.cos(th), 1.4)), Math.sign(s) * st.beam * Math.pow(Math.sin(th), 0.72));
  };
  const inner = (u: number, v: number): THREE.Vector3 => {
    const p = outer(u, v);
    const st = hullStation(u);
    return new THREE.Vector3(p.x, Math.min(Math.max(p.y + 0.035, FLOOR), st.gunwale), p.z * 0.93);
  };
  const NU = 28, NV = 18;
  b.add(surface(NU, NV, false, outer, new THREE.Vector3(0, 0.2, 0), 1), null, paint, M_WOOD);
  b.add(surface(NU, NV, false, inner, new THREE.Vector3(0, 0.2, 0), -1), null, inside, M_WOOD);
  // Gunwale rail between the two skins.
  for (let i = 0; i < NU; i++) {
    for (const v of [0, 1]) {
      const a = outer(i / NU, v), c = outer((i + 1) / NU, v), d = inner((i + 1) / NU, v), e = inner(i / NU, v);
      if (a.distanceTo(d) < 1e-4 || c.distanceTo(e) < 1e-4) continue;
      b.quad([a.x, a.y, a.z], [c.x, c.y, c.z], [d.x, d.y, d.z], [e.x, e.y, e.z], [0, 1, 0], [0.5, 0.4, 0.26], M_WOOD);
    }
  }
  // Transom: one fan for the outside and one for the inside.
  const fan = (fn: (u: number, v: number) => THREE.Vector3, out: V3, color: RGB): void => {
    const st = hullStation(0);
    const hub: V3 = [fn(0, 0.5).x, (st.gunwale + st.keel) / 2 + 0.08, 0];
    for (let j = 0; j < NV; j++) {
      const p = fn(0, j / NV), q = fn(0, (j + 1) / NV);
      b.tri(hub, [p.x, p.y, p.z], [q.x, q.y, q.z], out, color, M_WOOD);
    }
    const p = fn(0, 0), q = fn(0, 1);
    b.tri(hub, [p.x, p.y, p.z], [q.x, q.y, q.z], out, color, M_WOOD);
  };
  fan(outer, [-1, 0, 0], paint);
  fan((u, v) => inner(u, v).add(new THREE.Vector3(0.035, 0, 0)), [1, 0, 0], inside);
  // Two thwarts, a stem post, and two shipped oars.
  for (const tx of [-0.75, 0.55]) {
    const st = hullStation((tx + L) / (2 * L));
    b.block(tx - 0.13, 0.29, -st.beam * 0.9, tx + 0.13, 0.325, st.beam * 0.9, [0.46, 0.36, 0.23], M_WOOD);
  }
  b.block(L - 0.06, 0.2, -0.035, L + 0.03, 0.74, 0.035, [0.4, 0.31, 0.2], M_WOOD);
  for (const s of [-1, 1]) {
    const m4 = new THREE.Matrix4().makeRotationZ(Math.PI / 2 - 0.02).premultiply(new THREE.Matrix4().makeRotationY(s * 0.07)).setPosition(-0.15, 0.36, s * 0.26);
    b.add(new THREE.CylinderGeometry(0.022, 0.026, 2.5, 6), m4, [0.5, 0.41, 0.28], M_WOOD);
    b.add(new THREE.BoxGeometry(0.5, 0.02, 0.13), new THREE.Matrix4().makeRotationY(s * 0.07).setPosition(-1.5, 0.35, s * 0.35), [0.5, 0.41, 0.28], M_WOOD);
  }
  return b.build();
}

// ---------------------------------------------------------------------------
// Shaders. Lit colour is stored square-root encoded.
// ---------------------------------------------------------------------------

const NIGHT = /* glsl */ `
uniform vec3 uCam;
uniform float uClip;
uniform vec3 uBeacon;
uniform float uFlame;
uniform vec4 uWin[2];
const vec3 BEACON_TINT = vec3(1.0, 0.70, 0.34);
const vec3 WINDOW_TINT = vec3(1.0, 0.60, 0.20);
// The lantern roof keeps the light below its eaves.
vec3 beaconLight(vec3 p, vec3 n, float wrap) {
  vec3 d = uBeacon - p;
  float r2 = dot(d, d);
  vec3 L = d * inversesqrt(r2);
  float lambert = clamp((dot(n, L) + wrap) / (1.0 + wrap), 0.0, 1.0);
  float hood = smoothstep(-0.75, -0.15, L.y);
  return BEACON_TINT * (uFlame * 4.2 * lambert * hood / (1.0 + 0.15 * r2));
}
// Both windows look toward +z. They light only what stands in front of them.
vec3 windowLight(vec3 p, vec3 n) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    vec3 d = uWin[i].xyz - p;
    float r2 = dot(d, d);
    vec3 L = d * inversesqrt(r2);
    float lobe = clamp(-L.z * 1.4, 0.0, 1.0);
    sum += WINDOW_TINT * (uWin[i].w * 1.7 * max(dot(n, L), 0.0) * lobe / (1.0 + 0.28 * r2));
  }
  return sum;
}
vec3 nightAir(vec3 col, vec3 wp) {
  float f = 1.0 - exp(-length(wp - uCam) * 0.0042);
  return mix(col, vec3(0.013, 0.019, 0.028), clamp(f, 0.0, 1.0));
}
`;

const WORLD_VERT = /* glsl */ `
attribute vec3 aDat;
attribute float aMat;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vDat;
varying float vMat;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vN = mat3(modelMatrix) * normal;
  vDat = aDat;
  vMat = aMat;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WORLD_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vDat;
varying float vMat;
${GLSL_NOISE}
${NIGHT}
// Coursed blocks. Returns x = joint (1 in the mortar), y = tone of the block.
vec2 courses(vec2 uv, vec2 size) {
  vec2 q = uv / size;
  q.x += 0.5 * mod(floor(q.y), 2.0) + 0.17 * hash11(floor(q.y) * 7.3);
  vec2 f = abs(fract(q) - 0.5);
  vec2 edge = (0.5 - f) * size;
  float joint = 1.0 - smoothstep(0.012, 0.04, min(edge.x, edge.y));
  return vec2(joint, hash21(floor(q)));
}
void main() {
  if (uClip > 0.5 && vWp.y < 0.0) discard;
  vec3 p = vWp;
  vec3 n = normalize(vN);
  vec3 V = normalize(uCam - p);
  int m = int(vMat + 0.5);
  vec3 albedo = vDat;
  float gloss = 0.0;
  float wrap = 0.0;
  float cover = 1.0;
  vec3 emit = vec3(0.0);

  if (m == ${M_ASHLAR} || m == ${M_MOLE}) {
    bool top = n.y > 0.7;
    vec2 uv;
    if (m == ${M_MOLE}) {
      vec2 r = p.xz - vec2(${MOLE.cx.toFixed(2)}, ${MOLE.cz.toFixed(2)});
      float arc = atan(r.y, r.x) * ${MOLE.r.toFixed(2)};
      uv = top ? vec2(arc, length(r)) : vec2(arc, p.y);
    } else {
      uv = top ? p.xz : (abs(n.x) > abs(n.z) ? p.zy : p.xy);
    }
    if (top && abs(p.y - ${QUAY_Y.toFixed(2)}) < 0.03 && m == ${M_ASHLAR}) {
      // Wet setts on the lower quay. Each sett is a small dome with water in the joints.
      vec2 q = uv * vec2(3.9, 3.1);
      q.x += 0.5 * mod(floor(q.y), 2.0);
      vec2 id = floor(q);
      vec2 f = fract(q) - 0.5;
      float rim = smoothstep(0.26, 0.5, max(abs(f.x), abs(f.y)));
      albedo = vec3(0.29, 0.275, 0.25) * (0.66 + 0.6 * hash21(id)) * (1.0 - 0.6 * rim);
      albedo *= 0.8 + 0.4 * fbm(uv * 0.45);
      n = normalize(n + vec3(f.x, 0.0, f.y) * rim * 1.1);
      gloss = mix(0.34, 0.75, rim) * (0.55 + 0.45 * fbm(uv * 0.8 + 7.0));
    } else if (top) {
      // Flagstones on the terrace, the treads, and the breakwater deck.
      vec2 c = courses(uv, vec2(1.15, 0.8));
      albedo *= (0.8 + 0.3 * c.y) * (1.0 - 0.5 * c.x) * (0.85 + 0.3 * fbm(uv * 1.3));
      gloss = 0.12;
    } else {
      // Ashlar courses, weather streaks, and a wet, weedy band at the water line.
      vec2 c = courses(uv, vec2(0.95, 0.44));
      albedo *= (0.74 + 0.4 * c.y) * (1.0 - 0.55 * c.x);
      albedo *= 0.78 + 0.34 * fbm(vec2(uv.x * 1.6, uv.y * 0.35));
      float tide = 1.0 - smoothstep(0.15, 0.75 + 0.25 * vnoise(vec2(uv.x * 0.7, 3.0)), p.y);
      albedo = mix(albedo, vec3(0.035, 0.05, 0.035) + 0.03 * c.y, tide * 0.85);
      gloss = 0.5 * tide;
    }
  } else if (m == ${M_PLASTER}) {
    // Lime render over rubble: damp patches and bare stone where the render fell away.
    vec2 uv = abs(n.x) > abs(n.z) ? p.zy : p.xy;
    float mottle = fbm(uv * 0.8);
    float bare = smoothstep(0.6, 0.68, fbm(uv * 0.45 + 11.0));
    vec2 c = courses(uv, vec2(0.6, 0.3));
    albedo *= 0.78 + 0.34 * mottle;
    albedo = mix(albedo, vec3(0.3, 0.27, 0.23) * (0.7 + 0.5 * c.y) * (1.0 - 0.5 * c.x), bare);
    albedo *= 0.82 + 0.18 * smoothstep(${TERRACE_Y.toFixed(2)}, ${(TERRACE_Y + 2.5).toFixed(2)}, p.y);
  } else if (m == ${M_ROOF}) {
    // Clay tiles in courses down the slope.
    float along = abs(n.x) > abs(n.z) ? p.z : p.x;
    float row = p.y * 3.4;
    float tile = fract(along * 2.6 + 0.5 * floor(row));
    albedo *= 0.72 + 0.3 * fract(row) + 0.2 * hash21(vec2(floor(along * 2.6 + 0.5 * floor(row)), floor(row)));
    albedo *= 1.0 - 0.35 * smoothstep(0.38, 0.5, abs(tile - 0.5));
    gloss = 0.1;
  } else if (m == ${M_WOOD}) {
    // Planks: the grain runs along the longest direction of the face.
    vec2 g = abs(n.y) > 0.6 ? p.xz : vec2(p.x + p.z, p.y);
    float grain = fbm(vec2(g.x * 1.3, g.y * 13.0)) * 0.7 + 0.3 * vnoise(vec2(g.x * 3.0, g.y * 40.0));
    albedo *= 0.66 + 0.6 * grain;
    albedo *= 1.0 - 0.3 * smoothstep(0.44, 0.5, abs(fract(g.y * 5.5) - 0.5));
    gloss = 0.14;
  } else if (m == ${M_IRON}) {
    gloss = 0.22;
  } else if (m == ${M_LIT}) {
    // Lamplit room behind old glass. The round head of the tower slit is cut from the pane.
    vec2 uv = vDat.xy;
    float ratio = vDat.z;
    float open = 1.0;
    if (ratio > 0.0) {
      float cy = 1.0 - 0.5 / ratio;
      vec2 d = vec2(uv.x - 0.5, max(uv.y - cy, 0.0) * ratio);
      open = 1.0 - smoothstep(0.47, 0.5, length(d));
    }
    float core = 1.0 - 0.6 * length((uv - vec2(0.5, 0.45)) * vec2(1.0, 0.75));
    vec3 glow = mix(vec3(0.97, 0.52, 0.12), vec3(1.0, 0.86, 0.46), clamp(core, 0.0, 1.0));
    float pane = 0.9 + 0.1 * vnoise(uv * vec2(9.0, 14.0) + 3.0);
    float lead = smoothstep(0.0, 0.06, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
    glow *= pane * (0.82 + 0.18 * lead);
    emit = glow * glow * open;
    albedo = vec3(0.4, 0.38, 0.34) * (1.0 - open);
  } else if (m == ${M_LANTERN}) {
    // Frosted glass around the flame.
    float core = 1.0 - smoothstep(0.0, 0.3, abs(p.y - uBeacon.y + 0.05));
    vec3 glass = mix(vec3(0.99, 0.74, 0.34), vec3(1.0, 0.97, 0.82), core);
    emit = glass * glass * (0.9 + 0.1 * uFlame);
    albedo = vec3(0.0);
  } else if (m == ${M_FOLIAGE}) {
    // Leaf masses. The rim of each mass breaks into small leaf shapes.
    float seed = vDat.x;
    float leaf = vnoise3(p * 4.6 + seed) * 0.6 + vnoise3(p * 11.0 + seed) * 0.4;
    float facing = abs(dot(n, V));
    cover = smoothstep(0.0, 0.16, facing - 0.42 * leaf * leaf);
    if (cover < 0.03) discard;
    float clump = fbm3(p * 1.3 + seed);
    albedo = mix(vec3(0.014, 0.024, 0.016), vec3(0.05, 0.072, 0.034), smoothstep(0.3, 0.75, clump));
    n = normalize(n + 0.7 * (vec3(leaf, clump, leaf * clump) - 0.45));
    wrap = 0.5;
  } else if (m == ${M_LAND}) {
    albedo *= 0.7 + 0.6 * fbm(p.xz * 0.02);
  } else if (m == ${M_BRONZE}) {
    albedo *= 0.8 + 0.4 * vnoise(vec2(atan(n.x, n.z) * 3.0, p.y * 9.0));
    gloss = 0.5;
  } else if (m == ${M_ROPE}) {
    albedo *= 0.75 + 0.5 * step(0.5, fract((p.x + p.y + p.z) * 22.0));
  }

  vec3 ambient = vec3(0.03, 0.042, 0.066) * (0.5 + 0.5 * n.y);
  vec3 light = ambient + beaconLight(p, n, wrap) + windowLight(p, n);
  vec3 col = albedo * light + emit;
  // Warm highlight of the lantern on wet stone and iron.
  vec3 toBeacon = uBeacon - p;
  float r2 = dot(toBeacon, toBeacon);
  vec3 H = normalize(toBeacon * inversesqrt(r2) + V);
  float spec = pow(max(dot(n, H), 0.0), 46.0) * smoothstep(-0.75, -0.15, toBeacon.y * inversesqrt(r2));
  col += BEACON_TINT * (gloss * spec * uFlame * 2.2 / (1.0 + 0.09 * r2));
  col = nightAir(col, p);
  gl_FragColor = vec4(sqrt(max(col, 0.0)), cover);
}
`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
uniform float uTime;
uniform float uDim;
varying vec3 vDir;
${GLSL_NOISE}
// One cumulus mound for each cell of a band. The mound is the upper envelope of
// seven lobes: four broad ones on the flat base, three small ones on top. The
// winning lobe gives the surface slope, so the lobes meet in sharp creases.
// Returns x = light, y = base shade, z = cover.
vec3 mound(vec2 uv, float cols, float seed, float density) {
  vec2 cell = floor(uv);
  vec2 q = fract(uv) - 0.5;
  vec2 key = vec2(mod(cell.x, cols), cell.y) + seed;
  vec3 h = hash23(key);
  if (h.x > density) return vec3(0.0);
  q.x += (h.z - 0.5) * 0.16;
  q /= mix(0.6, 1.0, h.y);
  q += 0.06 * (vec2(fbm(uv * 4.3 + seed), fbm(uv * 4.3 + seed + 19.0)) - 0.5);
  q += 0.012 * (vec2(vnoise(uv * 21.0 + seed), vnoise(uv * 21.0 - seed)) - 0.5);
  float field = -1.0;
  vec2 slope = vec2(0.0);
  for (int i = 0; i < 7; i++) {
    vec3 r = hash23(key * 3.7 + float(i) * 5.3);
    bool upper = i >= 4;
    float fx = upper ? (float(i) - 5.0) * 0.125 : (float(i) - 1.5) * 0.14;
    vec2 c = vec2(fx + (r.x - 0.5) * 0.06, upper ? 0.105 + 0.06 * r.y : 0.01 + 0.035 * r.y);
    float rad = upper ? 0.08 + 0.035 * r.z : 0.115 + 0.04 * r.z;
    vec2 d = (q - c) / rad;
    float f = 1.0 - dot(d, d);
    if (f > field) { field = f; slope = d; }
  }
  float base = smoothstep(-0.088, -0.062, q.y);
  float cover = smoothstep(0.0, 0.1, field) * base;
  if (cover <= 0.0) return vec3(0.0);
  vec3 n = normalize(vec3(slope, sqrt(max(field, 0.0)) + 0.22));
  float light = clamp(dot(n, normalize(vec3(-0.5, 0.6, 0.62))), 0.0, 1.0);
  float shade = 1.0 - smoothstep(-0.08, 0.05, q.y);
  return vec3(light, shade, cover);
}
vec3 layCloud(vec3 col, vec3 c, float gate, float haze) {
  vec3 lit = vec3(0.995, 0.985, 0.955);
  vec3 dark = vec3(0.62, 0.69, 0.80);
  vec3 cloud = mix(dark, lit, smoothstep(0.2, 0.9, c.x) * (1.0 - 0.6 * c.y));
  cloud = mix(cloud, vec3(0.87, 0.92, 0.96), haze);
  return mix(col, cloud, c.z * gate);
}
void main() {
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float az = atan(d.x, -d.z);
  float h = clamp(d.y, 0.0, 1.0);
  // Afternoon blue: milky at the horizon, deep overhead.
  vec3 col = mix(vec3(0.80, 0.89, 0.95), vec3(0.47, 0.69, 0.92), smoothstep(0.0, 0.24, h));
  col = mix(col, vec3(0.22, 0.44, 0.80), smoothstep(0.2, 0.9, h));

  // Three ranks of cumulus. The low rank is small and hazy, so the sky recedes.
  float drift = uTime * 0.003;
  float open = 1.0 - smoothstep(1.02, 1.28, el);
  float low = smoothstep(0.035, 0.1, el);
  vec3 c0 = mound(vec2((az + drift * 0.45) / K_TAU * 38.0, el * 10.0 - 0.15), 38.0, 23.0, 0.58);
  col = layCloud(col, c0, low * (1.0 - smoothstep(0.28, 0.46, el)), 0.5);
  vec3 c1 = mound(vec2((az + drift * 0.75) / K_TAU * 21.0 + 0.3, el * 5.4 + 0.3), 21.0, 61.0, 0.66);
  col = layCloud(col, c1, low * open, 0.16);
  vec3 c2 = mound(vec2((az + drift) / K_TAU * 11.0 + 0.6, el * 2.9 + 0.2), 11.0, 97.0, 0.7);
  col = layCloud(col, c2, low * open, 0.0);

  col *= uDim;
  // Below the horizon the dome is the night sea.
  col = mix(vec3(0.016, 0.022, 0.03), col, smoothstep(-0.003, 0.003, d.y));
  gl_FragColor = vec4(col, 1.0);
}
`;

const HALO_VERT = /* glsl */ `
attribute vec3 aCentre;
attribute vec4 aTint;
varying vec2 vQ;
varying vec3 vTint;
void main() {
  vQ = position.xy;
  vTint = aTint.rgb;
  vec4 mv = viewMatrix * vec4(aCentre, 1.0);
  mv.xy += position.xy * aTint.w;
  gl_Position = projectionMatrix * mv;
}
`;

const HALO_FRAG = /* glsl */ `
uniform float uFlame;
varying vec2 vQ;
varying vec3 vTint;
void main() {
  float r = length(vQ);
  float veil = pow(max(1.0 - r, 0.0), 2.8);
  float heart = exp(-r * r * 30.0);
  gl_FragColor = vec4(vTint * (veil * 0.5 + heart * 0.5) * uFlame, 1.0);
}
`;

const WATER_VERT = /* glsl */ `
varying vec3 vWp;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WATER_FRAG = /* glsl */ `
uniform sampler2D tMirror;
uniform mat4 uMirrorMatrix;
uniform float uTime;
varying vec3 vWp;
${GLSL_NOISE}
${NIGHT}
float swell(vec2 p) {
  float t = uTime * 0.15;
  return fbm(p * vec2(0.42, 1.0) + vec2(t, t * 0.55)) + 0.42 * vnoise(p * vec2(1.9, 4.6) - vec2(t * 1.5, 0.0));
}
vec3 mirror(vec2 uv) {
  vec3 c = texture2D(tMirror, clamp(uv, 0.002, 0.998)).rgb;
  return c * c;
}
void main() {
  vec3 toCam = uCam - vWp;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 p = vWp.xz;
  float e = 0.1 + dist * 0.004;
  float h0 = swell(p);
  vec2 grad = vec2(swell(p + vec2(e, 0.0)) - h0, swell(p + vec2(0.0, e)) - h0) / e;
  vec3 n = normalize(vec3(-grad.x * 0.075, 1.0, -grad.y * 0.075));
  vec4 clip = uMirrorMatrix * vec4(vWp, 1.0);
  vec2 uv = clip.xy / clip.w;
  float calm = 1.0 / (1.0 + dist * 0.018);
  vec2 jig = n.xz * vec2(0.11, 0.5) * calm;
  // Three taps along the wave slope pull each light into a long streak.
  vec3 refl = mirror(uv + jig) * 0.5 + mirror(uv + jig * 1.9 + vec2(0.0, 0.004)) * 0.3 + mirror(uv + jig * 0.35 - vec2(0.0, 0.004)) * 0.2;
  float fres = 0.05 + 0.95 * pow(1.0 - max(dot(V, n), 0.0), 4.0);
  // The basin is dark glass: it holds the mirrored lights and a dim day sky.
  vec3 col = mix(vec3(0.004, 0.008, 0.011), refl * 0.92, clamp(fres + 0.4, 0.0, 1.0));
  // Glitter of the lantern on the ripples.
  vec3 toBeacon = uBeacon - vWp;
  float r2 = dot(toBeacon, toBeacon);
  vec3 H = normalize(toBeacon * inversesqrt(r2) + V);
  col += BEACON_TINT * (pow(max(dot(n, H), 0.0), 240.0) * uFlame * 2.4 / (1.0 + 0.02 * r2));
  col = nightAir(col, vWp);
  gl_FragColor = vec4(sqrt(max(col, 0.0)), 1.0);
}
`;

const POST_FRAG = /* glsl */ `
vec3 tap(vec2 uv) { return texture2D(tScene, uv).rgb; }
void main() {
  float s = uRes.y / 760.0;
  vec2 px = s / uRes;
  vec2 cv = gl_FragCoord.xy / s;
  // Symmetric nearest-neighbour filter: of each opposite pair of taps, keep the
  // one that is closer to the centre colour. Flat paint grows, edges stay crisp.
  vec3 c0 = tap(vUv);
  vec3 sum = c0;
  for (int i = 0; i < 6; i++) {
    float a = (float(i) + 0.5) * K_PI / 6.0;
    vec2 o = vec2(cos(a), sin(a)) * (i % 2 == 0 ? 1.2 : 2.2) * px;
    vec3 a1 = tap(vUv + o);
    vec3 a2 = tap(vUv - o);
    vec3 d1 = a1 - c0;
    vec3 d2 = a2 - c0;
    sum += dot(d1, d1) < dot(d2, d2) ? a1 : a2;
  }
  vec3 col = mix(c0, sum / 7.0, 0.72);

  // Thin glaze: a faint relief from the luminance, fine canvas, pooled varnish.
  float l0 = dot(col, vec3(0.3, 0.6, 0.1));
  float lx = dot(tap(vUv + vec2(px.x * 1.5, 0.0)), vec3(0.3, 0.6, 0.1)) - l0;
  float ly = dot(tap(vUv + vec2(0.0, px.y * 1.5)), vec3(0.3, 0.6, 0.1)) - l0;
  col *= 1.0 + (lx - ly) * 0.5;
  col *= 0.955 + 0.07 * canvasWeave(cv * 1.1);
  col *= 0.97 + 0.06 * fbm(cv * 0.011 + 5.0);

  // Grade: cream lights, blue-green darks.
  float lum = dot(col, vec3(0.3, 0.6, 0.1));
  col = mix(col, col * vec3(1.03, 1.0, 0.94), smoothstep(0.3, 0.9, lum));
  col = mix(col, col * vec3(0.9, 1.0, 1.06) + vec3(0.005, 0.01, 0.014), 1.0 - smoothstep(0.0, 0.3, lum));
  col = mix(vec3(lum), col, 1.07);
  col *= vignette(vUv, 0.4);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 37.0) - 0.5) * 0.01;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

export function createDaylightNocturne(): PaintingScene {
  const scene = new THREE.Scene();
  const far = 2600;
  const time = { value: 0 };
  // The basin mirrors the day sky as dark glass.
  const skyDim = { value: 1 };
  const windows: WindowLight[] = [];

  const b = new MeshBuilder();
  buildQuays(b);
  buildTower(b, windows);
  buildWatchhouse(b, windows);
  buildGate(b);
  buildMole(b);
  buildBeacon(b);
  buildHeadland(b);
  const rand = mulberry32(1207);
  cypress(b, -21.4, -13.6, 10.8, 1.25, 3.1);
  cypress(b, -24.3, -15.2, 12.6, 1.4, 8.4);
  cypress(b, -27.6, -13.2, 9.2, 1.15, 14.9);
  cypress(b, -19.2, -17.0, 8.4, 1.05, 21.3);
  cypress(b, -3.6, -16.4, 9.8, 1.2, 27.7);
  pine(b, -34.5, -12.5, 7.4, -1.4, 3.3, rand);
  pine(b, -4.6, -12.2, 6.2, 1.3, 2.6, rand);
  if (windows.length !== 2) throw new Error(`Expected 2 lit windows, found ${windows.length}`);

  // Two mooring piles in the basin, and the line from the bow of the skiff to the taller one.
  b.add(new THREE.CylinderGeometry(0.1, 0.13, PILE.top + 3, 9), at(PILE.x, (PILE.top - 3) / 2, PILE.z), [0.2, 0.15, 0.1], M_WOOD);
  b.add(new THREE.CylinderGeometry(0.09, 0.12, PILE.top + 2.6, 9), new THREE.Matrix4().makeRotationZ(0.07).setPosition(PILE.x + 0.5, (PILE.top - 3.4) / 2, PILE.z - 0.35), [0.2, 0.15, 0.1], M_WOOD);
  const bow = new THREE.Vector3(2.2, 0.62, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), SKIFF.yaw).add(new THREE.Vector3(SKIFF.x, 0, SKIFF.z));
  const cleat = new THREE.Vector3(PILE.x - 0.1, PILE.top - 0.35, PILE.z);
  const line = new THREE.CatmullRomCurve3([bow, bow.clone().lerp(cleat, 0.5).setY(0.36), cleat]);
  b.add(new THREE.TubeGeometry(line, 24, 0.017, 5), null, [0.38, 0.32, 0.22], M_ROPE);
  b.add(new THREE.TorusGeometry(0.12, 0.02, 5, 14).rotateX(Math.PI / 2), at(PILE.x, PILE.top - 0.35, PILE.z), [0.38, 0.32, 0.22], M_ROPE);

  const night = {
    uCam: { value: new THREE.Vector3() },
    uClip: { value: 0 },
    uBeacon: { value: BEACON },
    uFlame: { value: 1 },
    uWin: { value: windows.map((w) => new THREE.Vector4(w.x, w.y, w.z, w.power)) },
    uTime: time,
  };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(far * 0.9, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: { uTime: time, uDim: skyDim }, side: THREE.BackSide, depthWrite: false }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  const worldMaterial = new THREE.ShaderMaterial({ vertexShader: WORLD_VERT, fragmentShader: WORLD_FRAG, uniforms: night, alphaToCoverage: true });
  const world = new THREE.Mesh(b.build(), worldMaterial);
  world.frustumCulled = false;
  scene.add(world);

  // The skiff shares the world material. The scene disposes the material once.
  const skiff = new THREE.Mesh(buildSkiff(), worldMaterial);
  skiff.rotation.order = 'YXZ';
  skiff.position.set(SKIFF.x, 0, SKIFF.z);
  skiff.rotation.y = SKIFF.yaw;
  skiff.frustumCulled = false;
  scene.add(skiff);

  // Additive halos: the beacon and the two windows.
  const halos: Array<{ c: THREE.Vector3; tint: [number, number, number, number] }> = [
    { c: BEACON.clone(), tint: [0.8, 0.54, 0.25, 1.9] },
    { c: BEACON.clone(), tint: [0.13, 0.08, 0.03, 4.6] },
    ...windows.map((w) => ({ c: new THREE.Vector3(w.x, w.y, w.z + 0.08), tint: [0.3, 0.17, 0.055, 2.2 * w.power] as [number, number, number, number] })),
  ];
  const haloGeo = new THREE.InstancedBufferGeometry();
  haloGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  haloGeo.setAttribute('aCentre', new THREE.InstancedBufferAttribute(new Float32Array(halos.flatMap((h) => [h.c.x, h.c.y, h.c.z])), 3));
  haloGeo.setAttribute('aTint', new THREE.InstancedBufferAttribute(new Float32Array(halos.flatMap((h) => h.tint)), 4));
  haloGeo.instanceCount = halos.length;
  const halo = new THREE.Mesh(haloGeo, new THREE.ShaderMaterial({
    vertexShader: HALO_VERT, fragmentShader: HALO_FRAG, uniforms: { uFlame: night.uFlame },
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  halo.frustumCulled = false;
  halo.renderOrder = 2;
  scene.add(halo);

  const mirrorTarget = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  const mirrorMatrix = new THREE.Matrix4();
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1500, 64),
    new THREE.ShaderMaterial({ vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, uniforms: { ...night, tMirror: { value: mirrorTarget.texture }, uMirrorMatrix: { value: mirrorMatrix } } }),
  );
  water.rotation.x = -Math.PI / 2;
  water.frustumCulled = false;
  scene.add(water);

  const mirrorCam = new THREE.PerspectiveCamera();
  // Reflection in the plane y = 0, with a second flip in the camera frame to keep it right-handed.
  const FLIP = new THREE.Matrix4().makeScale(1, -1, 1);
  const TO_UV = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const pose = new THREE.Matrix4();
  const unused = new THREE.Vector3();

  const viewFrom = (position: THREE.Vector3): void => {
    sky.position.copy(position);
    night.uCam.value.copy(position);
  };

  return {
    scene,
    meta: {
      title: 'Harbor of Two Hours',
      artist: 'Original Surrealist Study · Day-Sky Nocturne',
      technique: 'Day-sky dome with creased cumulus mounds over a night harbor lit only by one iron beacon and two amber windows, extruded arch masonry, a rocking lofted skiff, planar basin reflection with streaked lights, thin oil glaze.',
    },
    presets: [
      { name: 'The Two Hours', position: [0.5, 2.5, 32], target: [-1.2, 7.0, -4], fov: 50 },
      { name: 'Under the Beacon', position: [-4.6, 2.75, 4.6], target: [2.2, 4.7, -1.6], fov: 54 },
      { name: 'The Sea-Gate', position: [6.6, 1.3, 9.5], target: [8.2, 3.6, -9], fov: 44 },
      { name: 'Breakwater Overlook', position: [27, 13.5, 25], target: [-5, 4.2, -5], fov: 46 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near: 0.2,
    far,
    flySpeed: 7,
    maxDistance: 170,
    floorAt: (x, z) => surfaceAt(x, z) + 0.5,
    update(ctx: FrameContext): void {
      const t = ctx.time;
      time.value = t;
      // The oil flame breathes a little.
      night.uFlame.value = 1 + 0.035 * Math.sin(t * 6.7) * Math.sin(t * 2.3) + 0.02 * Math.sin(t * 0.8);
      // The skiff rocks on the basin and swings a little on its line.
      skiff.position.y = 0.014 * Math.sin(t * 1.1) + 0.006 * Math.sin(t * 2.3 + 1);
      skiff.rotation.x = 0.03 * Math.sin(t * 0.9) + 0.008 * Math.sin(t * 2.1 + 0.6);
      skiff.rotation.z = 0.012 * Math.sin(t * 0.63 + 1.4);
      skiff.rotation.y = SKIFF.yaw + 0.012 * Math.sin(t * 0.21);
      viewFrom(ctx.camera.position);
    },
    prePass(ctx: FrameContext): void {
      const w = Math.max(Math.floor(ctx.width / 2), 2), h = Math.max(Math.floor(ctx.height / 2), 2);
      if (mirrorTarget.width !== w || mirrorTarget.height !== h) mirrorTarget.setSize(w, h);
      ctx.camera.updateMatrixWorld();
      pose.copy(FLIP).multiply(ctx.camera.matrixWorld).multiply(FLIP);
      pose.decompose(mirrorCam.position, mirrorCam.quaternion, unused);
      mirrorCam.projectionMatrix.copy(ctx.camera.projectionMatrix);
      mirrorCam.projectionMatrixInverse.copy(ctx.camera.projectionMatrixInverse);
      mirrorCam.updateMatrixWorld();
      mirrorMatrix.copy(TO_UV).multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse);
      water.visible = false;
      night.uClip.value = 1;
      skyDim.value = 0.32;
      viewFrom(mirrorCam.position);
      ctx.renderer.setRenderTarget(mirrorTarget);
      ctx.renderer.clear();
      ctx.renderer.render(scene, mirrorCam);
      water.visible = true;
      night.uClip.value = 0;
      skyDim.value = 1;
      viewFrom(ctx.camera.position);
    },
    dispose(): void {
      const materials = new Set<THREE.Material>();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          materials.add(o.material as THREE.Material);
        }
      });
      for (const material of materials) material.dispose();
      mirrorTarget.dispose();
    },
  };
}

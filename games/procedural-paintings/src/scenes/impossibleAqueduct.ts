// The Perpetual Aqueduct — an original paradox study.
//
// The paradox is true 3D forced perspective. The real flume is level. It
// starts at the wheel trough, runs along an arched viaduct to the first turn
// drum, and then crosses the plaza and runs far behind it through three more
// turn drums. Three towers stand near the viewer around a sunken basin. Each
// tower top carries a copy of one far turn drum. The copy is the far drum
// scaled toward the eye of the first camera preset. A scale about the eye does
// not change the image, so from that one point each copy and its far drum
// join without a seam, and the thin far piers hide behind the tower shafts.
// The flume then seems to climb around the basin through four turns and
// to fall from the plunge chute back onto the wheel. From any other point the
// radial gap between the copies and the far drums shows, and so does the
// hidden drop at the far end of the real flume.
//
// All procedural patterns use the unscaled source position, so the hatching,
// the coursing and the ripples cross the joins without a break.
//
// Materials write tone, two hatch fields, and a part id. The post pass draws
// the lithograph: swelling hatch lines, crayon grain, and ink edges where the
// id or the tone breaks. It does not use depth edges: a depth edge would draw
// the hidden joins.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { mulberry32 } from '../util';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Flume floor level, outer half width, wall thickness, wall height, slab depth. */
const H = 5.5, HALF = 0.95, WALL = 0.3, RIM = 0.6, SLAB = 0.5;
const INNER = HALF - WALL;
const WATER_Y = H + 0.34;
/** Turn drum: outer radius, wall thickness, top of the wall. */
const DRUM_R = 2.0, DRUM_WALL = 0.32, DRUM_TOP = H + RIM + 0.12;
/** Distance from a drum centre at which a flume piece starts. */
const JOIN = 1.45;
/** Length of the flume piece that each near drum copy carries on each side. */
const STUB = 6.2;
/** Plunge chute: half width and length past the drum wall. */
const CHUTE_HALF = 0.55, CHUTE_LEN = 4.4;
/** Spacing of the weir sills along the flow. */
const SILL_PITCH = 2.6, SILL_PHASE = 1.3;

/** Eye of the first preset. */
const EYE = new THREE.Vector3(0, H + 64, 96);

/** Plan position: x, z. */
type Plan = [number, number];

const BASIN = { x: 1.5, z: -1, hole: 5.2, pool: 3.8, terrace: -0.8, canal: -0.92, water: -1.35, floor: -2.4 };
const PLAZA_R = 25;
const HILL = { r0: 58, step: 8, rise: 1.2, count: 8 };

const SLUICE: Plan = [0, -11];
const TROUGH_START: Plan = [2.3, -11];
const TURN_1: Plan = [12.5, -11];
const TOWER_2: Plan = [9, 7];
const TOWER_3: Plan = [-9, 5];
/** Apparent rise of the flume floor at the second, third and fourth turn. */
const RISE: [number, number, number] = [4.5, 9, 13.5];

/** Scale about the eye that lifts the flume floor by `rise`. */
function scaleFor(rise: number): number {
  return (EYE.y - (H + rise)) / (EYE.y - H);
}

/** Plan position whose image under the scale s is q. */
function pushBack(q: Plan, s: number): Plan {
  return [EYE.x + (q[0] - EYE.x) / s, EYE.z + (q[1] - EYE.z) / s];
}

const S2 = scaleFor(RISE[0]), S3 = scaleFor(RISE[1]), S4 = scaleFor(RISE[2]);
const TURN_2 = pushBack(TOWER_2, S2);
const TURN_3 = pushBack(TOWER_3, S3);
const TURN_4 = pushBack(SLUICE, S4);

function towardEye(s: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(EYE.x, EYE.y, EYE.z)
    .multiply(new THREE.Matrix4().makeScale(s, s, s))
    .multiply(new THREE.Matrix4().makeTranslation(-EYE.x, -EYE.y, -EYE.z));
}

/** Near height of a source height under the scale s. */
function nearHeight(ySource: number, s: number): number {
  return EYE.y + (ySource - EYE.y) * s;
}

const WHEEL_R = 2.5;
/** The near chute lip is this far from the sluicehouse axis. The wheel centre is a little past it. */
const LIP_NEAR = (DRUM_R + CHUTE_LEN) * S4;
const WHEEL = { x: LIP_NEAR + 0.45, y: WATER_Y + WHEEL_R - 0.15, z: SLUICE[1] };

const M_STONE = 0, M_PLAIN = 1, M_FLUME = 2, M_WATER = 3, M_POOL = 4, M_FALL = 5;
const M_GROUND = 6, M_LEAF = 7, M_WOOD = 8, M_BRONZE = 9, M_FOAM = 10, M_DARK = 11;
/** Every flume and drum part shares one id, so no ink line appears on a join. */
const FLUME_ID = 0.31;
const STONE = 0.95;

function v3(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

const UP = v3(0, 1, 0), DOWN = v3(0, -1, 0);

function groundAt(x: number, z: number): number {
  const r = Math.hypot(x - BASIN.x, z - BASIN.z);
  if (r < HILL.r0) return 0;
  return Math.min(Math.floor((r - HILL.r0) / HILL.step) + 1, HILL.count) * HILL.rise;
}

// ---------------------------------------------------------------------------
// Mesh kit: collects parts into one geometry (one draw call).
// ---------------------------------------------------------------------------

type AuxFn = (local: THREE.Vector3) => [number, number];
const NO_AUX: AuxFn = () => [0, 0];

class Kit {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly src: number[] = [];
  private readonly tone: number[] = [];
  private readonly mat: number[] = [];
  private readonly ids: number[] = [];
  private readonly aux: number[] = [];
  private readonly shell: number[] = [];
  private parts = 0;
  /** Rigid transform from the local frame of a part to the source frame. */
  readonly place = new THREE.Matrix4();
  /** Scale toward the eye that takes the source frame to the world. */
  readonly frame = new THREE.Matrix4();

  /** A new edge id. Parts with different ids get an ink line between them. */
  id(): number {
    return 0.06 + 0.9 * ((++this.parts * 0.61803398875) % 1);
  }

  private vert(p: THREE.Vector3, n: THREE.Vector3, tone: number, m: number, id: number, aux: AuxFn, shell: boolean): void {
    const a = aux(p);
    const s = p.clone().applyMatrix4(this.place);
    const w = s.clone().applyMatrix4(this.frame);
    const d = n.clone().transformDirection(this.place);
    this.src.push(s.x, s.y, s.z);
    this.pos.push(w.x, w.y, w.z);
    this.nor.push(d.x, d.y, d.z);
    this.tone.push(tone);
    this.mat.push(m);
    this.ids.push(id);
    this.aux.push(a[0], a[1]);
    this.shell.push(shell ? 1 : 0);
  }

  /**
   * Flat quad. Without `out` the quad has two sides: the shader turns the normal
   * toward the viewer, so the winding is free. With `out` the quad is a shell
   * face with one side: it faces `out`, and the shader does not draw its back.
   * A viewer who looks into the cut end of a shell then sees what is behind it.
   */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, tone: number, m: number, id: number, aux: AuxFn = NO_AUX, out: THREE.Vector3 | null = null): void {
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (n.lengthSq() < 1e-14) throw new Error('Kit.quad received a degenerate quad');
    n.normalize();
    let order = [a, b, c, a, c, d];
    if (out) {
      const facing = n.dot(out);
      if (Math.abs(facing) < 1e-6) throw new Error('Kit.quad: the outward hint lies in the plane of the quad');
      if (facing < 0) {
        n.negate();
        order = [a, c, b, a, d, c];
      }
    }
    for (const p of order) this.vert(p, n, tone, m, id, aux, out !== null);
  }

  /** Axis-aligned box in the local frame. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tone: number, m: number, id: number): void {
    this.quad(v3(x1, y0, z1), v3(x1, y0, z0), v3(x1, y1, z0), v3(x1, y1, z1), tone, m, id);
    this.quad(v3(x0, y0, z0), v3(x0, y0, z1), v3(x0, y1, z1), v3(x0, y1, z0), tone, m, id);
    this.quad(v3(x0, y1, z1), v3(x1, y1, z1), v3(x1, y1, z0), v3(x0, y1, z0), tone, m, id);
    this.quad(v3(x0, y0, z0), v3(x1, y0, z0), v3(x1, y0, z1), v3(x0, y0, z1), tone, m, id);
    this.quad(v3(x0, y0, z1), v3(x1, y0, z1), v3(x1, y1, z1), v3(x0, y1, z1), tone, m, id);
    this.quad(v3(x1, y0, z0), v3(x0, y0, z0), v3(x0, y1, z0), v3(x1, y1, z0), tone, m, id);
  }

  /** Adds a geometry. flat = one normal for each triangle. The kit disposes the geometry. */
  geo(g: THREE.BufferGeometry, local: THREE.Matrix4, tone: number, m: number, id: number, flat = false, aux: AuxFn = NO_AUX): void {
    const src = g.index ? g.toNonIndexed() : g;
    if (flat) src.computeVertexNormals();
    const p = src.getAttribute('position'), n = src.getAttribute('normal');
    const nm = new THREE.Matrix3().getNormalMatrix(local);
    for (let i = 0; i < p.count; i++) {
      this.vert(
        new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(local),
        new THREE.Vector3().fromBufferAttribute(n, i).applyMatrix3(nm).normalize(),
        tone, m, id, aux, false,
      );
    }
    if (src !== g) src.dispose();
    g.dispose();
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aSrc', new THREE.Float32BufferAttribute(this.src, 3));
    g.setAttribute('aTone', new THREE.Float32BufferAttribute(this.tone, 1));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 1));
    g.setAttribute('aId', new THREE.Float32BufferAttribute(this.ids, 1));
    g.setAttribute('aAux', new THREE.Float32BufferAttribute(this.aux, 2));
    g.setAttribute('aShell', new THREE.Float32BufferAttribute(this.shell, 1));
    return g;
  }
}

function at(x: number, y: number, z: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(x, y, z);
}

/** Octagonal prism or frustum with one flat face toward +z. */
function oct(kit: Kit, rTop: number, rBottom: number, y0: number, y1: number, x: number, z: number, tone: number, m: number): void {
  kit.geo(
    new THREE.CylinderGeometry(rTop, rBottom, y1 - y0, 8),
    new THREE.Matrix4().makeRotationY(Math.PI / 8).setPosition(x, (y0 + y1) / 2, z), tone, m, kit.id(), true,
  );
}

// ---------------------------------------------------------------------------
// Flume
// ---------------------------------------------------------------------------

/** One straight leg of the real flume. Its local frame has +x along the flow. */
interface Leg {
  from: Plan;
  length: number;
  /** Direction of the flow in plan, as an angle from +x toward +z. */
  angle: number;
  /** Flow coordinate at the start of the leg. */
  flow0: number;
  place: THREE.Matrix4;
}

function makeLeg(from: Plan, to: Plan, flow0: number): Leg {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const angle = Math.atan2(dz, dx);
  return { from, length: Math.hypot(dx, dz), angle, flow0, place: new THREE.Matrix4().makeRotationY(-angle).setPosition(from[0], 0, from[1]) };
}

/**
 * Flume piece between the distances d0 and d1 along a leg. It is a shell of
 * the faces that a viewer can see. It has no end faces, so a cut end shows
 * only what is behind it. Weir sills sit at fixed flow positions, so a near
 * copy and the far flume carry the same sills.
 */
function flumePiece(kit: Kit, leg: Leg, d0: number, d1: number): void {
  kit.place.copy(leg.place);
  const y0 = H - SLAB, y1 = H + RIM;
  const flow: AuxFn = (p) => [leg.flow0 + p.x, p.z];
  for (const s of [-1, 1]) {
    kit.quad(v3(d0, y0, s * HALF), v3(d1, y0, s * HALF), v3(d1, y1, s * HALF), v3(d0, y1, s * HALF), STONE, M_FLUME, FLUME_ID, NO_AUX, v3(0, 0, s));
    kit.quad(v3(d0, y1, s * INNER), v3(d1, y1, s * INNER), v3(d1, y1, s * HALF), v3(d0, y1, s * HALF), STONE, M_STONE, FLUME_ID, NO_AUX, UP);
    kit.quad(v3(d0, WATER_Y, s * INNER), v3(d1, WATER_Y, s * INNER), v3(d1, y1, s * INNER), v3(d0, y1, s * INNER), STONE, M_STONE, FLUME_ID, NO_AUX, v3(0, 0, -s));
  }
  kit.quad(v3(d0, WATER_Y, -INNER), v3(d1, WATER_Y, -INNER), v3(d1, WATER_Y, INNER), v3(d0, WATER_Y, INNER), 1, M_WATER, FLUME_ID, flow, UP);
  kit.quad(v3(d0, y0, -HALF), v3(d1, y0, -HALF), v3(d1, y0, HALF), v3(d0, y0, HALF), STONE, M_STONE, FLUME_ID, NO_AUX, DOWN);
  const first = Math.ceil((leg.flow0 + d0 + 0.2 - SILL_PHASE) / SILL_PITCH);
  for (let k = first; ; k++) {
    const x = k * SILL_PITCH + SILL_PHASE - leg.flow0;
    if (x > d1 - 0.2) break;
    kit.box(x - 0.09, WATER_Y - 0.05, -INNER, x + 0.09, WATER_Y + 0.07, INNER, STONE, M_PLAIN, FLUME_ID);
  }
  kit.place.identity();
}

interface Opening { angle: number; half: number }

const FLUME_GAP = Math.asin(HALF / DRUM_R);
const CHUTE_GAP = Math.asin(CHUTE_HALF / DRUM_R);

/** Round turn drum: corbel slab, ring wall with a gap at each opening, water. */
function drum(kit: Kit, c: Plan, openings: Opening[]): void {
  kit.place.makeTranslation(c[0], 0, c[1]);
  const rIn = DRUM_R - DRUM_WALL;
  kit.geo(new THREE.CylinderGeometry(DRUM_R, DRUM_R - 0.3, SLAB + 0.3, 24), at(0, H - (SLAB + 0.3) / 2, 0), STONE, M_PLAIN, FLUME_ID);
  kit.geo(
    new THREE.CircleGeometry(rIn + 0.02, 24), new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, WATER_Y - 0.012, 0),
    1, M_POOL, FLUME_ID, false, (p) => [Math.hypot(p.x, p.z), 0],
  );
  const P = (r: number, t: number, y: number): THREE.Vector3 => v3(r * Math.cos(t), y, r * Math.sin(t));
  const turn = Math.PI * 2;
  const sorted = openings.map((o) => ({ angle: ((o.angle % turn) + turn) % turn, half: o.half })).sort((a, b) => a.angle - b.angle);
  if (sorted.length === 0) throw new Error('A turn drum needs one opening or more');
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i], b = sorted[(i + 1) % sorted.length];
    const t0 = a.angle + a.half;
    let t1 = b.angle - b.half;
    if (t1 <= a.angle) t1 += turn;
    if (t1 - t0 < 0.02) throw new Error(`Two drum openings overlap at (${c[0].toFixed(1)}, ${c[1].toFixed(1)})`);
    const n = Math.ceil((t1 - t0) / 0.2);
    for (let j = 0; j < n; j++) {
      const u0 = t0 + ((t1 - t0) * j) / n, u1 = t0 + ((t1 - t0) * (j + 1)) / n;
      const radial = P(1, (u0 + u1) / 2, 0);
      kit.quad(P(DRUM_R, u0, H), P(DRUM_R, u1, H), P(DRUM_R, u1, DRUM_TOP), P(DRUM_R, u0, DRUM_TOP), STONE, M_PLAIN, FLUME_ID, NO_AUX, radial);
      kit.quad(P(rIn, u0, WATER_Y), P(rIn, u1, WATER_Y), P(rIn, u1, DRUM_TOP), P(rIn, u0, DRUM_TOP), STONE, M_PLAIN, FLUME_ID, NO_AUX, radial.clone().negate());
      kit.quad(P(rIn, u0, DRUM_TOP), P(rIn, u1, DRUM_TOP), P(DRUM_R, u1, DRUM_TOP), P(DRUM_R, u0, DRUM_TOP), STONE, M_PLAIN, FLUME_ID, NO_AUX, UP);
    }
    // The end of the wall at each opening looks into the opening.
    for (const [t, sign] of [[t0, -1], [t1, 1]]) {
      const tangent = v3(-Math.sin(t) * sign, 0, Math.cos(t) * sign);
      kit.quad(P(rIn, t, H), P(DRUM_R, t, H), P(DRUM_R, t, DRUM_TOP), P(rIn, t, DRUM_TOP), STONE, M_PLAIN, FLUME_ID, NO_AUX, tangent);
    }
  }
  kit.place.identity();
}

/** Plunge chute: a narrow trough that leaves the last drum along +x. The lip is DRUM_R + CHUTE_LEN from the drum centre. */
function chute(kit: Kit, c: Plan): void {
  kit.place.makeTranslation(c[0], 0, c[1]);
  const d0 = DRUM_R - DRUM_WALL - 0.1, d1 = DRUM_R + CHUTE_LEN;
  const y0 = H - 0.25, y1 = H + RIM - 0.08, inner = CHUTE_HALF - 0.17;
  for (const s of [-1, 1]) {
    kit.quad(v3(d0, y0, s * CHUTE_HALF), v3(d1, y0, s * CHUTE_HALF), v3(d1, y1, s * CHUTE_HALF), v3(d0, y1, s * CHUTE_HALF), STONE, M_PLAIN, FLUME_ID, NO_AUX, v3(0, 0, s));
    kit.quad(v3(d0, y1, s * inner), v3(d1, y1, s * inner), v3(d1, y1, s * CHUTE_HALF), v3(d0, y1, s * CHUTE_HALF), STONE, M_PLAIN, FLUME_ID, NO_AUX, UP);
    kit.quad(v3(d0, WATER_Y, s * inner), v3(d1, WATER_Y, s * inner), v3(d1, y1, s * inner), v3(d0, y1, s * inner), STONE, M_PLAIN, FLUME_ID, NO_AUX, v3(0, 0, -s));
    // End of each wall at the lip.
    kit.quad(v3(d1, y0, s * inner), v3(d1, y0, s * CHUTE_HALF), v3(d1, y1, s * CHUTE_HALF), v3(d1, y1, s * inner), STONE, M_PLAIN, FLUME_ID, NO_AUX, v3(1, 0, 0));
  }
  kit.quad(v3(d0, WATER_Y, -inner), v3(d1 + 0.05, WATER_Y, -inner), v3(d1 + 0.05, WATER_Y, inner), v3(d0, WATER_Y, inner), 1, M_WATER, FLUME_ID, (p) => [p.x * 1.7, p.z], UP);
  kit.quad(v3(d0, y0, -CHUTE_HALF), v3(d1, y0, -CHUTE_HALF), v3(d1, y0, CHUTE_HALF), v3(d0, y0, CHUTE_HALF), STONE, M_PLAIN, FLUME_ID, NO_AUX, DOWN);
  kit.quad(v3(d1, y0, -inner), v3(d1, y0, inner), v3(d1, WATER_Y, inner), v3(d1, WATER_Y, -inner), STONE, M_PLAIN, FLUME_ID, NO_AUX, v3(1, 0, 0));
  kit.place.identity();
}

/** Falling water as a tube. The tube starts at `top`, falls by `drop`, and leans by `lean` along +x. */
function fall(kit: Kit, top: THREE.Vector3, drop: number, lean: number, rx: number, rz: number, spread: number, id: number): void {
  const N = 26, SIDES = 8;
  const ring = (i: number, k: number): THREE.Vector3 => {
    const t = i / N, a = (k / SIDES) * Math.PI * 2;
    const grow = 1 + spread * t;
    return v3(top.x + lean * Math.sqrt(t) + rx * grow * Math.cos(a), top.y - drop * t, top.z + rz * grow * Math.sin(a));
  };
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < SIDES; k++) {
      // The seam is at k = 0. The aux value uses the segment index, so it does not wrap inside a quad.
      const aux = (kk: number, ii: number): [number, number] => [(drop * ii) / N, kk / SIDES];
      const corners: Array<[THREE.Vector3, [number, number]]> = [
        [ring(i, k), aux(k, i)], [ring(i, k + 1), aux(k + 1, i)], [ring(i + 1, k + 1), aux(k + 1, i + 1)], [ring(i + 1, k), aux(k, i + 1)],
      ];
      kit.quad(corners[0][0], corners[1][0], corners[2][0], corners[3][0], 1, M_FALL, id, (p) => {
        for (const [q, a] of corners) if (q.distanceToSquared(p) < 1e-10) return a;
        throw new Error('fall: a vertex does not match a corner');
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Architecture
// ---------------------------------------------------------------------------

/** Carved obelisk on a small pedestal. */
function obelisk(kit: Kit, x: number, y: number, z: number, height: number, width: number): void {
  const turn = (py: number): THREE.Matrix4 => new THREE.Matrix4().makeRotationY(Math.PI / 4).setPosition(x, py, z);
  kit.box(x - width * 0.95, y, z - width * 0.95, x + width * 0.95, y + height * 0.08, z + width * 0.95, STONE, M_PLAIN, kit.id());
  kit.geo(new THREE.CylinderGeometry(width * 0.55, width, height * 0.76, 4), turn(y + height * 0.46), 1, M_PLAIN, kit.id(), true);
  kit.geo(new THREE.ConeGeometry(width * 0.55, height * 0.16, 4), turn(y + height * 0.92), 1, M_PLAIN, kit.id(), true);
}

/** Small carved stone lantern: base, dark core between posts, cap, ball. */
function lanternFinial(kit: Kit, x: number, y: number, z: number, k: number): void {
  oct(kit, 0.36 * k, 0.44 * k, y, y + 0.28 * k, x, z, STONE, M_PLAIN);
  oct(kit, 0.2 * k, 0.2 * k, y + 0.28 * k, y + 1.0 * k, x, z, 0.34, M_DARK);
  for (let i = 0; i < 4; i++) {
    const a = (i + 0.5) * Math.PI / 2;
    kit.geo(new THREE.CylinderGeometry(0.05 * k, 0.05 * k, 0.72 * k, 5), at(x + 0.3 * k * Math.cos(a), y + 0.64 * k, z + 0.3 * k * Math.sin(a)), STONE, M_PLAIN, kit.id());
  }
  oct(kit, 0.46 * k, 0.46 * k, y + 1.0 * k, y + 1.12 * k, x, z, STONE, M_PLAIN);
  kit.geo(new THREE.ConeGeometry(0.44 * k, 0.7 * k, 8), at(x, y + 1.47 * k, z), 1, M_PLAIN, kit.id(), true);
  kit.geo(new THREE.SphereGeometry(0.13 * k, 10, 8), at(x, y + 1.92 * k, z), 1, M_PLAIN, kit.id());
}

/**
 * Octagonal tower shaft from the ground to yTop. The shaft tapers, so the far
 * flume that arrives at the drum copy stays clear of the shaft below the stub.
 * The top flares to the radius rTop.
 */
function towerShaft(kit: Kit, q: Plan, yTop: number, rTop: number, yBase = 0): void {
  const [x, z] = q;
  const wide = 1.12, slim = 0.84;
  if (yBase === 0) {
    oct(kit, 1.8, 1.92, 0, 0.6, x, z, STONE, M_PLAIN);
    oct(kit, 1.5, 1.5, 0.6, 1.9, x, z, STONE, M_STONE);
  }
  const y0 = yBase === 0 ? 1.9 : yBase, y1 = yTop - 1.0;
  const radius = (y: number): number => wide + ((slim - wide) * (y - y0)) / (y1 - y0);
  oct(kit, slim, wide, y0, y1, x, z, STONE, M_STONE);
  oct(kit, rTop, slim, y1, yTop, x, z, STONE, M_PLAIN);
  for (let y = y0 + 2.6; y < yTop - 1.8; y += 3.1) oct(kit, radius(y + 0.22) + 0.15, radius(y) + 0.15, y, y + 0.22, x, z, STONE, M_PLAIN);
  // Slit windows in the face that looks at the viewer.
  for (let y = y0 + 0.9; y < yTop - 2.6; y += 3.1) {
    const zf = z + radius(y + 0.5) * Math.cos(Math.PI / 8) + 0.02;
    kit.box(x - 0.11, y, zf, x + 0.11, y + 1.0, zf + 0.04, 0.32, M_DARK, kit.id());
  }
}

/** Stepped flying buttress: a pier in three steps and a flyer that leans on the shaft. */
function buttress(kit: Kit, q: Plan, angle: number, reach: number, height: number): void {
  kit.place.makeRotationY(-angle).setPosition(q[0], 0, q[1]);
  kit.box(reach - 0.58, 0, -0.4, reach + 0.58, height * 0.5, 0.4, STONE, M_STONE, kit.id());
  kit.box(reach - 0.44, height * 0.5, -0.33, reach + 0.44, height * 0.78, 0.33, STONE, M_STONE, kit.id());
  kit.box(reach - 0.3, height * 0.78, -0.26, reach + 0.3, height, 0.26, STONE, M_STONE, kit.id());
  kit.geo(new THREE.ConeGeometry(0.44, 0.7, 4), new THREE.Matrix4().makeRotationY(Math.PI / 4).setPosition(reach, height + 0.35, 0), 1, M_PLAIN, kit.id(), true);
  // The flyer rises from the second step to the shaft.
  const x0 = reach - 0.3, ya = height * 0.74, x1 = 1.0, yb = height * 0.74 + (reach - 1.3) * 0.85;
  const len = Math.hypot(x1 - x0, yb - ya);
  kit.geo(
    new THREE.BoxGeometry(len, 0.34, 0.42),
    new THREE.Matrix4().makeRotationZ(Math.atan2(yb - ya, x1 - x0)).setPosition((x0 + x1) / 2, (ya + yb) / 2, 0), STONE, M_PLAIN, kit.id(),
  );
  kit.place.identity();
}

/** Open roof stage on a near drum copy: thin columns, slab, octagonal roof. Returns the top of the roof. */
function roofStage(kit: Kit, q: Plan, yRim: number, s: number, openings: Opening[]): number {
  const [x, z] = q;
  const r = (DRUM_R - DRUM_WALL / 2) * s;
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) * Math.PI / 4;
    const blocked = openings.some((o) => Math.abs(Math.atan2(Math.sin(a - o.angle), Math.cos(a - o.angle))) < o.half + 0.12);
    if (blocked) continue;
    kit.geo(new THREE.CylinderGeometry(0.07, 0.09, 1.5, 6), at(x + r * Math.cos(a), yRim + 0.75, z + r * Math.sin(a)), STONE, M_PLAIN, kit.id());
  }
  oct(kit, DRUM_R * s * 1.1, DRUM_R * s * 1.1, yRim + 1.5, yRim + 1.72, x, z, STONE, M_PLAIN);
  kit.geo(new THREE.ConeGeometry(DRUM_R * s * 1.02, 1.25, 8), new THREE.Matrix4().makeRotationY(Math.PI / 8).setPosition(x, yRim + 2.345, z), 0.9, M_WOOD, kit.id(), true);
  return yRim + 2.75;
}

/** Sunken basin with a recessed canal terrace, a pool, and a coping. */
function buildBasin(kit: Kit): void {
  kit.place.makeTranslation(BASIN.x, 0, BASIN.z);
  const profile = [
    [BASIN.hole, 0], [BASIN.hole, BASIN.terrace], [4.75, BASIN.terrace], [4.75, BASIN.terrace - 0.3], [4.25, BASIN.terrace - 0.3],
    [4.25, BASIN.terrace], [BASIN.pool, BASIN.terrace], [BASIN.pool, BASIN.floor], [0.001, BASIN.floor],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  kit.geo(new THREE.LatheGeometry(profile, 64), new THREE.Matrix4(), STONE, M_STONE, kit.id(), true);
  const coping = [[BASIN.hole, 0], [BASIN.hole, 0.24], [BASIN.hole + 0.55, 0.24], [BASIN.hole + 0.55, 0]].map(([r, y]) => new THREE.Vector2(r, y));
  kit.geo(new THREE.LatheGeometry(coping, 64), new THREE.Matrix4(), 1, M_PLAIN, kit.id(), true);
  // The tail race enters at the back of the basin. Ripples spread from that point.
  const entry = v3(Math.cos(TAIL_ANGLE) * 4.5, 0, Math.sin(TAIL_ANGLE) * 4.5);
  const rings: AuxFn = (p) => [Math.hypot(p.x - entry.x, p.z - entry.z), 0];
  const flat = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
  kit.geo(new THREE.RingGeometry(4.25, 4.75, 64), flat.clone().setPosition(0, BASIN.canal, 0), 1, M_POOL, kit.id(), false, rings);
  kit.geo(new THREE.CircleGeometry(BASIN.pool, 64), flat.clone().setPosition(0, BASIN.water, 0), 1, M_POOL, kit.id(), false, rings);
  // Four low steps of the terrace carry small carved lanterns.
  for (let i = 0; i < 4; i++) {
    const a = TAIL_ANGLE + Math.PI / 4 + (i * Math.PI) / 2;
    kit.place.identity();
    lanternFinial(kit, BASIN.x + 5.47 * Math.cos(a), 0.24, BASIN.z + 5.47 * Math.sin(a), 0.62);
    kit.place.makeTranslation(BASIN.x, 0, BASIN.z);
  }
  kit.place.identity();
}

/** Direction from the basin centre to the sluice gate. */
const TAIL_ANGLE = Math.atan2(SLUICE[1] + 2.3 - BASIN.z, SLUICE[0] - BASIN.x);

/** Octagonal drum sluicehouse with the tail race to the basin. */
function buildSluicehouse(kit: Kit): number {
  const [x, z] = SLUICE;
  const top = 8.2, r = 2.4;
  oct(kit, r + 0.3, r + 0.42, 0, 0.55, x, z, STONE, M_PLAIN);
  oct(kit, r, r, 0.55, top - 0.5, x, z, STONE, M_STONE);
  oct(kit, r + 0.26, r, top - 0.5, top - 0.2, x, z, STONE, M_PLAIN);
  oct(kit, r + 0.26, r + 0.26, top - 0.2, top, x, z, STONE, M_PLAIN);
  // Roof ring between the drum and the shaft.
  kit.geo(new THREE.CylinderGeometry(1.3, r + 0.3, 1.3, 8), new THREE.Matrix4().makeRotationY(Math.PI / 8).setPosition(x, top + 0.65, z), 0.9, M_WOOD, kit.id(), true);
  // Arched sluice gate and two arched windows in the faces toward the viewer.
  const ap = r * Math.cos(Math.PI / 8);
  for (const [k, w, h] of [[0, 0.62, 2.1], [-1, 0.34, 1.1], [1, 0.34, 1.1]]) {
    const a = Math.PI / 2 + (k * Math.PI) / 4;
    const y0 = k === 0 ? 0.55 : 3.6;
    kit.place.makeRotationY(-a + Math.PI / 2).setPosition(x, 0, z);
    kit.box(-w, y0, ap, w, y0 + h, ap + 0.03, 0.3, M_DARK, kit.id());
    kit.geo(new THREE.CircleGeometry(w, 16, 0, Math.PI), at(0, y0 + h, ap + 0.03), 0.3, M_DARK, kit.id());
    kit.box(-w - 0.16, y0 + h - 0.12, ap, -w, y0 + h + 0.06, ap + 0.12, 1, M_PLAIN, kit.id());
    kit.box(w, y0 + h - 0.12, ap, w + 0.16, y0 + h + 0.06, ap + 0.12, 1, M_PLAIN, kit.id());
  }
  kit.place.identity();
  // Tail race: a low curbed canal from the gate to the basin, then a short fall onto the canal terrace.
  const from: Plan = [x, z + ap], end: Plan = [BASIN.x + (BASIN.hole + 0.05) * Math.cos(TAIL_ANGLE), BASIN.z + (BASIN.hole + 0.05) * Math.sin(TAIL_ANGLE)];
  const race = makeLeg(from, end, 0);
  kit.place.copy(race.place);
  for (const s of [-1, 1]) kit.box(0, 0, s * 0.62 - 0.11, race.length - 0.5, 0.3, s * 0.62 + 0.11, STONE, M_PLAIN, kit.id());
  kit.quad(v3(0, 0.16, -0.51), v3(race.length, 0.16, -0.51), v3(race.length, 0.16, 0.51), v3(0, 0.16, 0.51), 1, M_WATER, kit.id(), (p) => [p.x * 1.4 + 0.4, p.z]);
  kit.quad(
    v3(race.length, 0.16, -0.5), v3(race.length, 0.16, 0.5), v3(race.length + 0.35, BASIN.canal, 0.56), v3(race.length + 0.35, BASIN.canal, -0.56),
    1, M_FALL, kit.id(), (p) => [0.16 - p.y, p.z * 0.6],
  );
  kit.place.identity();
  return top + 1.3;
}

/** Romanesque viaduct under the trough: round arches on piers with impost blocks and a cornice. */
function buildViaduct(kit: Kit): void {
  const x0 = 2.55, x1 = TURN_1[0] - 1.25, top = H - SLAB, bays = 4;
  const z = SLUICE[1], half = 0.72;
  const pitch = (x1 - x0) / bays, r = pitch / 2 - 0.36, spring = 2.85;
  const wall = new THREE.Shape([new THREE.Vector2(x0, 0), new THREE.Vector2(x1, 0), new THREE.Vector2(x1, top), new THREE.Vector2(x0, top)]);
  for (let i = 0; i < bays; i++) {
    const mid = x0 + pitch * (i + 0.5);
    const hole = new THREE.Path();
    hole.moveTo(mid + r, 0.004);
    hole.lineTo(mid + r, spring);
    hole.absarc(mid, spring, r, 0, Math.PI, false);
    hole.lineTo(mid - r, 0.004);
    hole.closePath();
    wall.holes.push(hole);
  }
  kit.geo(new THREE.ExtrudeGeometry(wall, { depth: half * 2, bevelEnabled: false, curveSegments: 16 }), at(0, 0, z - half), STONE, M_STONE, kit.id());
  for (let i = 0; i <= bays; i++) {
    const px = x0 + pitch * i;
    const a = i === 0 ? px : px - 0.36, b = i === bays ? px : px + 0.36;
    kit.box(a - 0.08, 0, z - half - 0.1, b + 0.08, 0.4, z + half + 0.1, STONE, M_PLAIN, kit.id());
    kit.box(a - 0.07, spring - 0.2, z - half - 0.08, b + 0.07, spring, z + half + 0.08, 1, M_PLAIN, kit.id());
  }
  kit.box(x0 - 0.1, top - 0.24, z - half - 0.14, x1 + 0.1, top, z + half + 0.14, 1, M_PLAIN, kit.id());
  // Stout pier under the first turn drum.
  oct(kit, 1.55, 1.68, 0, 0.6, TURN_1[0], TURN_1[1], STONE, M_PLAIN);
  oct(kit, 1.3, 1.3, 0.6, top - 1.1, TURN_1[0], TURN_1[1], STONE, M_STONE);
  oct(kit, DRUM_R - 0.3, 1.3, top - 1.1, top - 0.3, TURN_1[0], TURN_1[1], STONE, M_PLAIN);
}

/** Timber frames that carry the wheel axle on the trough walls. */
function buildBearings(kit: Kit): void {
  const wood = 0.8;
  for (const s of [-1, 1]) {
    const z = WHEEL.z + s * (HALF + 0.42);
    // A sill beam on two stone corbels that stand out from the flume wall.
    const zA = WHEEL.z + s * HALF, zB = WHEEL.z + s * (HALF + 0.6);
    kit.box(WHEEL.x - 1.5, H - 0.1, z - 0.16, WHEEL.x + 1.5, H + 0.12, z + 0.16, wood, M_WOOD, kit.id());
    kit.box(WHEEL.x - 1.5, H - SLAB, Math.min(zA, zB), WHEEL.x - 1.2, H - 0.1, Math.max(zA, zB), STONE, M_PLAIN, kit.id());
    kit.box(WHEEL.x + 1.2, H - SLAB, Math.min(zA, zB), WHEEL.x + 1.5, H - 0.1, Math.max(zA, zB), STONE, M_PLAIN, kit.id());
    for (const lean of [-1, 1]) {
      const len = Math.hypot(1.25, WHEEL.y - H);
      kit.geo(
        new THREE.BoxGeometry(0.22, len, 0.22),
        new THREE.Matrix4().makeRotationZ(lean * Math.atan2(1.25, WHEEL.y - H)).setPosition(WHEEL.x + lean * 0.625, (H + WHEEL.y) / 2, z), wood, M_WOOD, kit.id(),
      );
    }
    kit.box(WHEEL.x - 0.26, WHEEL.y - 0.24, z - 0.2, WHEEL.x + 0.26, WHEEL.y + 0.24, z + 0.2, 0.7, M_BRONZE, kit.id());
  }
}

/** Plaza wall, free obelisks, cypress trees, and the terraced hills around the site. */
function buildGrounds(kit: Kit, rand: () => number): void {
  kit.place.makeTranslation(BASIN.x, 0, BASIN.z);
  kit.geo(new THREE.RingGeometry(BASIN.hole, 330, 96, 1), new THREE.Matrix4().makeRotationX(-Math.PI / 2), 1, M_GROUND, kit.id());
  const wall = [[PLAZA_R - 0.3, 0], [PLAZA_R - 0.3, 0.8], [PLAZA_R - 0.42, 0.8], [PLAZA_R - 0.42, 1.0], [PLAZA_R + 0.42, 1.0], [PLAZA_R + 0.42, 0.8], [PLAZA_R + 0.3, 0.8], [PLAZA_R + 0.3, 0]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  kit.geo(new THREE.LatheGeometry(wall, 96), new THREE.Matrix4(), STONE, M_STONE, kit.id(), true);
  const hill: THREE.Vector2[] = [];
  for (let i = 0; i < HILL.count; i++) {
    hill.push(new THREE.Vector2(HILL.r0 + HILL.step * i, HILL.rise * i), new THREE.Vector2(HILL.r0 + HILL.step * i, HILL.rise * (i + 1)));
  }
  hill.push(new THREE.Vector2(HILL.r0 + HILL.step * HILL.count + 30, HILL.rise * HILL.count));
  kit.geo(new THREE.LatheGeometry(hill, 96), new THREE.Matrix4(), 1, M_GROUND, kit.id(), true);
  kit.place.identity();
  for (let i = 0; i < 12; i++) {
    const a = (i + 0.5) * Math.PI / 6;
    obelisk(kit, BASIN.x + PLAZA_R * Math.cos(a), 1.0, BASIN.z + PLAZA_R * Math.sin(a), 1.7, 0.3);
  }
  obelisk(kit, -19.5, 0, 12.5, 7.4, 0.62);
  obelisk(kit, 21, 0, 11, 7.4, 0.62);
  // Cypress trees outside the wall and on the hill terraces.
  for (let i = 0; i < 90; i++) {
    const a = rand() * Math.PI * 2;
    const r = i < 46 ? PLAZA_R + 3 + rand() * 26 : HILL.r0 + 2 + rand() * 60;
    const x = BASIN.x + r * Math.cos(a), z = BASIN.z + r * Math.sin(a);
    const k = 0.75 + rand() * 0.6, y = groundAt(x, z);
    const id = kit.id();
    kit.geo(new THREE.CylinderGeometry(0.1 * k, 0.14 * k, 0.8 * k, 6), at(x, y + 0.4 * k, z), 0.5, M_PLAIN, id);
    kit.geo(new THREE.ConeGeometry(0.62 * k, 3.4 * k, 9), at(x, y + 2.3 * k, z), 0.62, M_LEAF, id);
  }
}

function buildWheel(): THREE.BufferGeometry {
  const kit = new Kit();
  const wood = 0.82, bronze = 0.72, R = WHEEL_R;
  const alongZ = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  kit.geo(new THREE.CylinderGeometry(0.15, 0.15, 3.1, 10), alongZ, wood, M_WOOD, kit.id());
  kit.geo(new THREE.CylinderGeometry(0.42, 0.42, 1.12, 14), alongZ, bronze, M_BRONZE, kit.id());
  kit.geo(new THREE.CylinderGeometry(R - 0.72, R - 0.72, 0.9, 40, 1, true), alongZ, wood * 0.9, M_WOOD, kit.id());
  for (const s of [-1, 1]) {
    const rim = kit.id();
    kit.geo(new THREE.TorusGeometry(R - 0.14, 0.09, 6, 44), at(0, 0, s * 0.47), wood, M_WOOD, rim);
    kit.geo(new THREE.TorusGeometry(R - 0.72, 0.065, 6, 44), at(0, 0, s * 0.47), wood, M_WOOD, rim);
    kit.geo(new THREE.TorusGeometry(R - 0.02, 0.05, 5, 44), at(0, 0, s * 0.53), bronze, M_BRONZE, kit.id());
    kit.geo(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 12), alongZ.clone().setPosition(0, 0, s * 0.62), bronze, M_BRONZE, kit.id());
    for (let i = 0; i < 8; i++) {
      const turn = new THREE.Matrix4().makeRotationZ((i / 8) * Math.PI * 2);
      kit.geo(new THREE.BoxGeometry(0.1, R - 0.5, 0.1), turn.multiply(at(0, (R - 0.5) / 2 + 0.3, s * 0.47)), wood, M_WOOD, kit.id());
    }
  }
  // Buckets: boards that lean from the radius, so they hold the water at the top.
  for (let i = 0; i < 18; i++) {
    const turn = new THREE.Matrix4().makeRotationZ(((i + 0.5) / 18) * Math.PI * 2);
    kit.geo(
      new THREE.BoxGeometry(0.7, 0.05, 0.9),
      turn.multiply(at(R - 0.4, 0, 0)).multiply(new THREE.Matrix4().makeRotationZ(-0.62)), wood, M_WOOD, kit.id(),
    );
  }
  return kit.build();
}

// ---------------------------------------------------------------------------
// Shaders. Colour buffer: r = tone, g and b = hatch line fields, a = part id.
// ---------------------------------------------------------------------------

const WORLD_VERT = /* glsl */ `
attribute vec3 aSrc;
attribute float aTone;
attribute float aMat;
attribute float aId;
attribute vec2 aAux;
attribute float aShell;
varying vec3 vSrc;
varying vec3 vN;
varying float vTone;
varying float vMat;
varying float vId;
varying vec2 vAux;
varying float vShell;
void main() {
  vShell = aShell;
  vSrc = aSrc;
  vN = normalize(mat3(modelMatrix) * normal);
  vTone = aTone;
  vMat = aMat;
  vId = aId;
  vAux = aAux;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

const WORLD_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vSrc;
varying vec3 vN;
varying float vTone;
varying float vMat;
varying float vId;
varying vec2 vAux;
varying float vShell;
${GLSL_NOISE}
const vec3 LIGHT = vec3(-0.45, 0.72, 0.528);
// Reflected light from the plaza reaches the faces that look away from the sun.
const vec3 FILL = vec3(0.76, 0.25, -0.6);
const vec2 BASIN_C = vec2(${BASIN.x.toFixed(2)}, ${BASIN.z.toFixed(2)});
// Triangle-wave line field with a screen-stable spacing: 0 on a line, 1 between lines.
float lineField(float c, float px) {
  float fw = max(fwidth(c), 1e-5);
  float lod = log2(fw * px);
  float l0 = floor(lod);
  float s0 = exp2(l0);
  float a = abs(fract(c / s0) - 0.5) * 2.0;
  float b = abs(fract(c / (s0 * 2.0)) - 0.5) * 2.0;
  return mix(a, b, lod - l0);
}
float tri(float c) { return abs(fract(c) - 0.5) * 2.0; }
void main() {
  // p is the source position: it is the same on a near drum copy and on the far drum behind it.
  // A shell face has one side. Its back is open, so a cut end of the flume shows what is behind it.
  if (vShell > 0.5 && !gl_FrontFacing) discard;
  vec3 p = vSrc;
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  int m = int(vMat + 0.5);
  float lit = 0.5 + 0.4 * max(dot(n, LIGHT), 0.0) + 0.08 * n.y + 0.11 * max(dot(n, FILL), 0.0);
  float tone = vTone * lit;
  // Chart of the face: level faces use the plan, upright faces use (length along the wall, height).
  bool level = abs(n.y) > 0.9;
  bool upright = abs(n.y) < 0.25;
  vec2 uv = vec2(dot(p, vec3(0.62, 0.7, 0.35)), dot(p, vec3(-0.7, 0.3, 0.65)));
  if (level) uv = p.zx;
  else if (upright) uv = vec2(dot(p, normalize(vec3(n.z, 0.0, -n.x))), p.y);
  float h1 = lineField((uv.x + uv.y) * 0.7071, 3.8);
  float h2 = lineField((uv.x - uv.y) * 0.7071, 3.8);

  if (m == ${M_STONE} || m == ${M_FLUME}) {
    if (upright) {
      // Coursed ashlar.
      vec2 g = vec2(uv.x / 0.95 + 0.5 * floor(uv.y / 0.42), uv.y / 0.42);
      vec2 d = (0.5 - abs(fract(g) - 0.5)) * vec2(0.95, 0.42);
      float fw = fwidth(uv.x) + fwidth(uv.y);
      float joint = (1.0 - smoothstep(0.0, 1.2 * fw, min(d.x, d.y) - 0.006)) * (1.0 - smoothstep(0.05, 0.14, fw));
      tone *= 1.0 - 0.24 * joint;
      tone *= 0.95 + 0.1 * hash21(floor(g));
      if (m == ${M_FLUME}) {
        // Corbel table: a row of small blind arches under the flume wall.
        float yy = p.y - ${(H - SLAB).toFixed(2)};
        float cx = (fract(uv.x / 0.62) - 0.5) * 0.62;
        float d2 = length(vec2(cx, max(yy - 0.34, 0.0))) - 0.2;
        float arch = (1.0 - smoothstep(-fw, fw, d2)) * step(0.1, yy) * (1.0 - smoothstep(0.03, 0.09, fw));
        tone *= 1.0 - 0.34 * arch;
      }
    }
  } else if (m == ${M_WATER}) {
    // Ripples cross the flow. vAux = (flow coordinate, position across the flume).
    float f = vAux.x;
    float rip = f * 2.3 + 0.7 * vnoise(vec2(vAux.y * 2.6, f * 0.9)) - uTime * 1.5;
    h1 = tri(rip);
    h1 = mix(h1, 1.0, smoothstep(0.45, 0.75, vnoise(vec2(vAux.y * 3.4, f * 0.8 - uTime * 0.6))));
    h2 = 1.0;
    tone = 0.74;
    // White water below each weir sill.
    float cell = fract((f - ${SILL_PHASE.toFixed(2)}) / ${SILL_PITCH.toFixed(2)}) * ${SILL_PITCH.toFixed(2)};
    float foam = (1.0 - smoothstep(0.1, 0.5, cell)) * (0.5 + 0.5 * vnoise(vec2(vAux.y * 9.0, f * 6.0 - uTime * 3.0)));
    tone = mix(tone, 0.99, foam);
    h1 = mix(h1, 1.0, foam);
  } else if (m == ${M_POOL}) {
    // Still water: rings that spread from the inflow. vAux.x = distance from the inflow.
    float rip = vAux.x * 2.1 + 0.6 * vnoise(p.xz * 1.3) - uTime * 0.9;
    h1 = tri(rip);
    h1 = mix(h1, 1.0, smoothstep(0.4, 0.72, vnoise(p.xz * 1.9 + vec2(uTime * 0.2, 0.0))));
    h2 = 1.0;
    tone = 0.7;
  } else if (m == ${M_FALL}) {
    // vAux = (distance down the fall, position around it).
    float c = vAux.x * 1.3 - uTime * 3.4;
    h1 = tri(vAux.y * 6.0 + 0.12 * sin(c * 1.7));
    h1 = mix(h1, 1.0, smoothstep(0.3, 0.7, vnoise(vec2(vAux.y * 12.0, c))));
    h2 = 1.0;
    tone = 0.8 - 0.14 * vnoise(vec2(vAux.y * 9.0, c * 0.6));
  } else if (m == ${M_GROUND}) {
    vec2 g = p.xz - BASIN_C;
    float r = length(g);
    if (!level) {
      // Terrace walls of the hills.
      tone = 0.74 * vTone;
    } else if (r < ${PLAZA_R.toFixed(1)}) {
      // Plaza: ring courses of paving around the basin.
      float ring = r / 1.55;
      float ri = floor(ring);
      float count = floor(ri * 4.0) + 8.0;
      float a = atan(g.y, g.x) / K_TAU * count + 0.37 * ri;
      float fw = fwidth(r) * 1.4;
      float dr = (0.5 - abs(fract(ring) - 0.5)) * 1.55;
      float da = (0.5 - abs(fract(a) - 0.5)) * K_TAU * r / count;
      float joint = (1.0 - smoothstep(0.0, fw, min(dr, da) - 0.012)) * (1.0 - smoothstep(0.08, 0.22, fw));
      tone = 0.95 * (0.95 + 0.09 * hash21(vec2(ri, floor(a)))) * (1.0 - 0.22 * joint);
    } else {
      // Fields: plots with tilled rows. The plots follow rings on the hill terraces.
      vec2 cell = r > ${HILL.r0.toFixed(1)} ? vec2(floor(r / ${HILL.step.toFixed(1)}), floor(atan(g.y, g.x) * 5.0)) : floor(p.xz / 11.0 + 0.3);
      float plot = hash21(cell);
      tone = 0.72 + 0.22 * plot;
      float rows = plot > 0.5 ? p.x * 0.94 + p.z * 0.34 : p.z * 0.94 - p.x * 0.34;
      h1 = lineField(rows, 4.4);
    }
  } else if (m == ${M_LEAF}) {
    float leaf = vnoise3(p * 4.0);
    tone = vTone * (0.4 + 0.8 * max(dot(normalize(n + 0.8 * (leaf - 0.5)), LIGHT), 0.0));
    h1 = vnoise3(p * 11.0);
    h2 = vnoise3(p * 11.0 + 17.0);
  } else if (m == ${M_WOOD}) {
    // Grain lines along each board.
    h1 = lineField(uv.x * 0.9 + 0.3 * uv.y, 3.4);
  } else if (m == ${M_BRONZE}) {
    // Burnished metal: dark body, a hard light on the side that faces the sun, fine lines.
    tone = vTone * (0.36 + 0.42 * lit) + 0.3 * pow(max(dot(n, LIGHT), 0.0), 6.0);
    h1 = lineField((uv.x + uv.y) * 0.7071, 2.6);
    h2 = lineField((uv.x - uv.y) * 0.7071, 2.6);
  } else if (m == ${M_FOAM}) {
    tone = 0.97;
    h1 = vnoise3(p * 9.0);
    h2 = 1.0;
  } else if (m == ${M_DARK}) {
    tone = vTone;
  }
  gl_FragColor = vec4(clamp(tone, 0.0, 1.0), h1, h2, vId);
}
`;

const SKY_VERT = /* glsl */ `
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
void main() {
  gl_FragColor = vec4(0.975, 1.0, 1.0, 0.0);
}
`;

const POST_FRAG = /* glsl */ `
void main() {
  float sc = uRes.y / 760.0;
  vec2 px = sc / uRes;
  vec2 cv = gl_FragCoord.xy / sc;
  vec4 s = texture2D(tScene, vUv);
  vec4 e0 = texture2D(tScene, vUv + vec2(px.x, 0.0));
  vec4 e1 = texture2D(tScene, vUv - vec2(px.x, 0.0));
  vec4 e2 = texture2D(tScene, vUv + vec2(0.0, px.y));
  vec4 e3 = texture2D(tScene, vUv - vec2(0.0, px.y));

  // Ink edges from the part id and the tone only. A depth edge would draw the hidden joins.
  float idE = max(max(abs(e0.a - s.a), abs(e1.a - s.a)), max(abs(e2.a - s.a), abs(e3.a - s.a)));
  float toneE = max(abs(e0.r - e1.r), abs(e2.r - e3.r));
  float edge = max(smoothstep(0.006, 0.03, idE), smoothstep(0.06, 0.15, toneE));

  // Crayon on a grained stone: the grain breaks the lines.
  float tooth = 0.6 * vnoise(cv * 1.9) + 0.4 * hash21(floor(cv * 1.3));
  float dark = 1.0 - s.r;
  // The first line set swells with the darkness. The second set starts in the half tones.
  float w1 = clamp(pow(dark, 1.2) * 1.15 + (tooth - 0.5) * 0.14, 0.0, 1.0);
  float w2 = clamp((dark - 0.36) * 1.7 + (tooth - 0.5) * 0.14, 0.0, 1.0);
  float l1 = (1.0 - smoothstep(w1 - 0.13, w1 + 0.13, s.g)) * smoothstep(0.03, 0.14, w1);
  float l2 = (1.0 - smoothstep(w2 - 0.13, w2 + 0.13, s.b)) * smoothstep(0.03, 0.14, w2);
  float ink = max(max(l1, l2), edge * 0.9);

  float wash = dark * dark * (0.45 + 0.55 * tooth);
  vec3 paper = vec3(0.935, 0.918, 0.868) * (0.965 + 0.05 * vnoise(cv * 0.35) + 0.03 * (tooth - 0.5));
  vec3 col = paper * (1.0 - 0.36 * wash);
  col = mix(col, vec3(0.1, 0.098, 0.108), ink * (0.8 + 0.2 * tooth));
  col *= vignette(vUv, 0.28);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

export function createImpossibleAqueduct(): PaintingScene {
  const scene = new THREE.Scene();
  const far = 1400;
  const time = { value: 0 };
  const rand = mulberry32(4127);
  const kit = new Kit();

  buildGrounds(kit, rand);
  buildBasin(kit);
  const sluiceTop = buildSluicehouse(kit);
  buildViaduct(kit);
  buildBearings(kit);

  // --- Real flume: one level run from the wheel trough through four turn drums. ---
  const trough = makeLeg(TROUGH_START, TURN_1, 0);
  const leg1 = makeLeg(TURN_1, TURN_2, trough.length);
  const leg2 = makeLeg(TURN_2, TURN_3, leg1.flow0 + leg1.length);
  const leg3 = makeLeg(TURN_3, TURN_4, leg2.flow0 + leg2.length);
  const inlet = (leg: Leg): Opening => ({ angle: leg.angle + Math.PI, half: FLUME_GAP });
  const outlet = (leg: Leg): Opening => ({ angle: leg.angle, half: FLUME_GAP });
  const spout: Opening = { angle: 0, half: CHUTE_GAP };
  const open1 = [inlet(trough), outlet(leg1)];
  const open2 = [inlet(leg1), outlet(leg2)];
  const open3 = [inlet(leg2), outlet(leg3)];
  const open4 = [inlet(leg3), spout];

  flumePiece(kit, trough, 0, trough.length - JOIN);
  kit.place.copy(trough.place);
  kit.box(-WALL, H - SLAB, -HALF, 0, H + RIM, HALF, STONE, M_STONE, FLUME_ID);
  kit.place.identity();
  drum(kit, TURN_1, open1);
  flumePiece(kit, leg1, JOIN, leg1.length - JOIN);
  drum(kit, TURN_2, open2);
  flumePiece(kit, leg2, JOIN, leg2.length - JOIN);
  drum(kit, TURN_3, open3);
  flumePiece(kit, leg3, JOIN, leg3.length - JOIN);
  drum(kit, TURN_4, open4);
  chute(kit, TURN_4);
  // Thin piers of the far drums. The tower shafts hide them from the first preset.
  for (const c of [TURN_2, TURN_3, TURN_4]) {
    kit.geo(new THREE.CylinderGeometry(0.36, 0.42, H - SLAB - 0.3, 8), at(c[0], (H - SLAB - 0.3) / 2, c[1]), STONE, M_PLAIN, kit.id());
  }
  // The hidden drop: the real flume ends far behind the plaza and pours onto the ground there.
  const farLip = v3(TURN_4[0] + DRUM_R + CHUTE_LEN, WATER_Y, TURN_4[1]);
  const fallId = kit.id();
  fall(kit, v3(farLip.x + 0.08, farLip.y, farLip.z), WATER_Y - 0.02, 0.1, 0.1, 0.24, 0, fallId);

  // --- Towers: each top is a far turn drum scaled toward the eye. ---
  const nearDrum = (turn: Plan, s: number, openings: Opening[], inLeg: Leg, outLeg: Leg | null): void => {
    kit.frame.copy(towardEye(s));
    drum(kit, turn, openings);
    flumePiece(kit, inLeg, inLeg.length - JOIN - STUB, inLeg.length - JOIN);
    if (outLeg) flumePiece(kit, outLeg, JOIN, JOIN + STUB);
    else chute(kit, turn);
    kit.frame.identity();
  };
  const under = H - SLAB - 0.3, rim = DRUM_TOP;
  nearDrum(TURN_2, S2, open2, leg1, leg2);
  nearDrum(TURN_3, S3, open3, leg2, leg3);
  nearDrum(TURN_4, S4, open4, leg3, null);

  towerShaft(kit, TOWER_2, nearHeight(under, S2), (DRUM_R - 0.3) * S2);
  buttress(kit, TOWER_2, 0.35, 3.3, 4.6);
  buttress(kit, TOWER_2, 2.5, 3.3, 4.6);
  const top2 = roofStage(kit, TOWER_2, nearHeight(rim, S2), S2, open2);
  obelisk(kit, TOWER_2[0], top2 - 0.1, TOWER_2[1], 2.6, 0.3);

  towerShaft(kit, TOWER_3, nearHeight(under, S3), (DRUM_R - 0.3) * S3);
  buttress(kit, TOWER_3, 2.9, 3.6, 6.4);
  buttress(kit, TOWER_3, 0.9, 3.6, 6.4);
  const top3 = roofStage(kit, TOWER_3, nearHeight(rim, S3), S3, open3);
  lanternFinial(kit, TOWER_3[0], top3 - 0.1, TOWER_3[1], 1.15);

  towerShaft(kit, SLUICE, nearHeight(under, S4), (DRUM_R - 0.3) * S4, sluiceTop - 0.6);
  buttress(kit, SLUICE, Math.PI + 0.5, 4.3, 7.2);
  buttress(kit, SLUICE, -1.25, 4.3, 7.2);
  const top4 = roofStage(kit, SLUICE, nearHeight(rim, S4), S4, open4);
  lanternFinial(kit, SLUICE[0], top4 - 0.1, SLUICE[1], 1.0);
  obelisk(kit, SLUICE[0], top4 + 1.85, SLUICE[1], 2.2, 0.22);
  // A carved bracket under the near chute.
  {
    const lipY = nearHeight(H - 0.25, S4);
    const x0 = 1.0, y0 = lipY - 3.0, x1 = LIP_NEAR - 0.6, y1 = lipY - 0.12;
    kit.geo(
      new THREE.BoxGeometry(Math.hypot(x1 - x0, y1 - y0), 0.26, 0.4),
      new THREE.Matrix4().makeRotationZ(Math.atan2(y1 - y0, x1 - x0)).setPosition(SLUICE[0] + (x0 + x1) / 2, (y0 + y1) / 2, SLUICE[1]), STONE, M_PLAIN, kit.id(),
    );
  }

  // --- The cascade: from the near chute lip down onto the wheel. ---
  {
    const lip = farLip.clone().applyMatrix4(towardEye(S4));
    const land = WHEEL.y + WHEEL_R - 0.25;
    fall(kit, v3(lip.x + 0.3, lip.y, lip.z), lip.y - land, 0.3, 0.42, CHUTE_HALF * S4 * 0.82, 0.25, fallId);
    // Foam where the water strikes the buckets and where the wheel meets the trough.
    for (let i = 0; i < 11; i++) {
      const s = 0.2 + rand() * 0.2;
      const low = i > 7;
      kit.geo(
        new THREE.IcosahedronGeometry(s, 1),
        at(WHEEL.x + (low ? 0.6 + rand() * 1.4 : -0.1 + rand() * 0.9), low ? WATER_Y + 0.05 : land + (rand() - 0.3) * 0.5, WHEEL.z + (rand() - 0.5) * 0.7),
        1.2, M_FOAM, fallId,
      );
    }
  }

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(far * 0.8, 16, 8),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  const material = new THREE.ShaderMaterial({ vertexShader: WORLD_VERT, fragmentShader: WORLD_FRAG, uniforms: { uTime: time }, side: THREE.DoubleSide });
  const world = new THREE.Mesh(kit.build(), material);
  world.frustumCulled = false;
  scene.add(world);

  const wheel = new THREE.Mesh(buildWheel(), material);
  wheel.position.set(WHEEL.x, WHEEL.y, WHEEL.z);
  wheel.frustumCulled = false;
  scene.add(wheel);

  return {
    scene,
    meta: {
      title: 'The Perpetual Aqueduct',
      artist: 'Original Paradox Study · Lithograph Geometry',
      technique: 'True 3D forced perspective: a level flume through four turn drums, with tower tops that are far drums scaled toward the preset eye, so the loop around the basin closes from one point only. Hatch line fields, crayon grain, id + tone ink edges.',
    },
    presets: [
      { name: 'The Lithograph', position: [EYE.x, EYE.y, EYE.z], target: [0.8, 12.8, -1.2], fov: 18.6 },
      { name: 'Side Perspective', position: [88, 36, 6], target: [0, 8, -15], fov: 25 },
      { name: 'Wheel Basin', position: [-5.5, 14, 8.5], target: [4.2, 5.4, -8.5], fov: 50 },
      { name: 'Overhead Reveal', position: [8, 170, 26], target: [0, 5, -14], fov: 22 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near: 1,
    far,
    flySpeed: 14,
    maxDistance: 420,
    floorAt: (x, z) => groundAt(x, z) + 0.8,
    update(ctx: FrameContext): void {
      time.value = ctx.time;
      sky.position.copy(ctx.camera.position);
      // The cascade lands past the top of the wheel and drives that side down.
      wheel.rotation.z = -ctx.time * 0.8;
    },
    dispose(): void {
      // The world and the wheel share one material.
      world.geometry.dispose();
      wheel.geometry.dispose();
      material.dispose();
      sky.geometry.dispose();
      (sky.material as THREE.Material).dispose();
    },
  };
}

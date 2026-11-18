// Rotunda of Three Gravities — an original paradox study.
//
// The rotunda is a real, consistent solid with three-fold symmetry about the
// space diagonal. A star-chart dome (one sphere) holds three round marble
// floors. Each floor lies in one of three orthogonal planes, so each floor is
// "down" for one gravity world. One module is built for the world whose
// "down" is -y: its floor, its library wall with book alcoves and a grand
// portal, its flying stair, its armillary and globe pedestals. The cyclic axis
// permutation (x, y, z) -> (z, x, y) copies the module for the worlds whose
// "down" is -z and -x. The three library walls then stand in a pinwheel.
//
// Each flying stair is a 45-degree sky-bridge between two floors. A square
// step has two faces, so two worlds use each stair on the same side: one
// walks on the treads, the other walks on the risers. The balusters stand
// square to the flight, so they serve both worlds. The scholars are one
// instanced mesh; the vertex shader swings the feet, the sleeves and the hem.
//
// All patterns use the module position, so the three copies are exact images
// of each other. Materials write tone, two hatch fields, and a part id. The
// post pass draws the lithograph from them: swelling cross-hatch lines,
// charcoal tone, and ink edges where the id, the tone, or the depth breaks.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { mulberry32 } from '../util';

/** Distance from the centre to each floor plane, and the radius of the dome. */
const S = 10, DOME = 14;
/** Radius of each round floor: the circle where the floor plane cuts the dome. */
const FLOOR_R = Math.sqrt(DOME * DOME - S * S);
/** Rise of each stair, step size, stair width. */
const RISE = 7.5, STEP = 0.5, WIDTH = 2.2;
const FOOT = -S + RISE;
/** Library wall: back face, depth of the solid back layer, depth of the alcove layer, half length, height. */
const WALL = { x0: -8.3, back: 0.7, front: 0.5, half: 4.2, height: 8.6 };
const PORTAL = { half: 1.2, straight: 6.6 };
const ALCOVE = { half: 0.5, straight: 2.4, centres: [-3.45, -2.15, 2.15, 3.45], sills: [0.5, 4.1] };
const FIGURE = 1.35;

const M_WALL = 0, M_MARBLE = 1, M_FLOOR = 2, M_BOOKS = 3, M_BRASS = 4, M_GLOBE = 5, M_DARK = 6;

/** Cyclic permutation: sends +x to +y, +y to +z, +z to +x. */
const CYCLE = new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);

// ---------------------------------------------------------------------------
// Mesh kit: collects parts into one geometry (one draw call).
// ---------------------------------------------------------------------------

class Kit {
  private readonly pos: number[] = [];
  private readonly nor: number[] = [];
  private readonly lp: number[] = [];
  private readonly ln: number[] = [];
  private readonly tone: number[] = [];
  private readonly mat: number[] = [];
  private readonly ids: number[] = [];
  private parts = 0;
  /** Transform from the module to the world. It is applied to every part that is added. */
  readonly frame = new THREE.Matrix4();

  /** A new edge id. Parts with different ids get an ink line between them. */
  id(): number {
    return 0.06 + 0.9 * ((++this.parts * 0.61803398875) % 1);
  }

  /** Adds a geometry as one part. flat = one normal for each triangle. The kit disposes the geometry. */
  geo(g: THREE.BufferGeometry, local: THREE.Matrix4, tone: number, m: number, flat = false, id = this.id()): void {
    const src = g.index ? g.toNonIndexed() : g;
    if (flat) src.computeVertexNormals();
    const p = src.getAttribute('position'), n = src.getAttribute('normal');
    const nm = new THREE.Matrix3().getNormalMatrix(local);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(local);
      this.lp.push(v.x, v.y, v.z);
      v.applyMatrix4(this.frame);
      this.pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      this.ln.push(v.x, v.y, v.z);
      v.transformDirection(this.frame);
      this.nor.push(v.x, v.y, v.z);
      this.tone.push(tone);
      this.mat.push(m);
      this.ids.push(id);
    }
    if (src !== g) src.dispose();
    g.dispose();
  }

  /** Axis-aligned box from its two corners. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tone: number, m: number): void {
    this.geo(
      new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)),
      new THREE.Matrix4().makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), tone, m,
    );
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aLp', new THREE.Float32BufferAttribute(this.lp, 3));
    g.setAttribute('aLn', new THREE.Float32BufferAttribute(this.ln, 3));
    g.setAttribute('aTone', new THREE.Float32BufferAttribute(this.tone, 1));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 1));
    g.setAttribute('aId', new THREE.Float32BufferAttribute(this.ids, 1));
    return g;
  }
}

const IDENTITY = new THREE.Matrix4();
const STONE = 0.94, PALE = 1.0, DARK = 0.8;

function at(x: number, y: number, z: number): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(x, y, z);
}

/** Arched outline that stands on the line y = y0. */
function archPath(cx: number, y0: number, straight: number, half: number): THREE.Path {
  const path = new THREE.Path();
  path.moveTo(cx + half, y0);
  path.lineTo(cx + half, y0 + straight);
  path.absarc(cx, y0 + straight, half, 0, Math.PI, false);
  path.lineTo(cx - half, y0);
  path.closePath();
  return path;
}

/** Turned baluster. Its axis is the local y axis and its foot is at the origin. */
function baluster(): THREE.LatheGeometry {
  const profile = [[0.001, 0], [0.075, 0], [0.075, 0.08], [0.045, 0.14], [0.1, 0.38], [0.085, 0.5], [0.04, 0.72], [0.04, 0.96], [0.075, 1.02], [0.075, 1.1], [0.001, 1.1]];
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 8);
}

/**
 * Library wall along the -x side of the floor. The wall frame has X along -z,
 * Y up, and Z toward +x, so the book alcoves look at the middle of the floor.
 */
function buildLibraryWall(kit: Kit): void {
  const toWorld = new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(WALL.x0, -S, 0);
  const put = (local: THREE.Matrix4): THREE.Matrix4 => new THREE.Matrix4().multiplyMatrices(toWorld, local);
  const outline = (): THREE.Shape => new THREE.Shape([
    new THREE.Vector2(-WALL.half, 0), new THREE.Vector2(WALL.half, 0), new THREE.Vector2(WALL.half, WALL.height), new THREE.Vector2(-WALL.half, WALL.height),
  ]);
  const portal = (): THREE.Path => archPath(0, 0.004, PORTAL.straight, PORTAL.half);

  // Solid back layer: only the portal goes through it.
  const back = outline();
  back.holes.push(portal());
  kit.geo(new THREE.ExtrudeGeometry(back, { depth: WALL.back, bevelEnabled: false, curveSegments: 18 }), put(IDENTITY), STONE, M_WALL);
  // Front layer: the alcoves are holes in it, so each alcove is a recess.
  const front = outline();
  front.holes.push(portal());
  for (const cx of ALCOVE.centres) {
    for (const sill of ALCOVE.sills) {
      front.holes.push(archPath(cx, sill, ALCOVE.straight, ALCOVE.half));
      // Book shelves on the back of the recess.
      const panel = new THREE.Shape(archPath(cx, sill, ALCOVE.straight, ALCOVE.half).getPoints(10));
      kit.geo(new THREE.ShapeGeometry(panel, 10), put(at(0, 0, WALL.back + 0.012)), 1, M_BOOKS);
      // Sill board.
      const s = put(at(cx, sill - 0.06, WALL.back + WALL.front + 0.07));
      kit.geo(new THREE.BoxGeometry(ALCOVE.half * 2 + 0.24, 0.12, 0.2), s, PALE, M_MARBLE);
    }
  }
  kit.geo(new THREE.ExtrudeGeometry(front, { depth: WALL.front, bevelEnabled: false, curveSegments: 18 }), put(at(0, 0, WALL.back)), STONE, M_WALL);

  const depth = WALL.back + WALL.front;
  const trim = (x0: number, y0: number, x1: number, y1: number, out: number, tone: number): void => {
    kit.geo(new THREE.BoxGeometry(x1 - x0, y1 - y0, out), put(at((x0 + x1) / 2, (y0 + y1) / 2, depth + out / 2)), tone, M_MARBLE);
  };
  for (const side of [-1, 1]) {
    const a = side * PORTAL.half, b = side * WALL.half;
    const lo = Math.min(a, b), hi = Math.max(a, b);
    trim(lo, 0, hi, 0.36, 0.14, PALE);
    trim(lo, 3.62, hi, 3.82, 0.09, PALE);
    trim(lo, 7.36, hi, 7.54, 0.09, PALE);
    // Pilasters at the portal jamb and at the end of the wall.
    trim(Math.min(a, a + side * 0.3), 0.36, Math.max(a, a + side * 0.3), PORTAL.straight, 0.1, PALE);
    trim(Math.min(a - side * 0.02, a + side * 0.36), PORTAL.straight, Math.max(a - side * 0.02, a + side * 0.36), PORTAL.straight + 0.22, 0.16, PALE);
    trim(Math.min(b, b - side * 0.24), 0.36, Math.max(b, b - side * 0.24), 7.36, 0.08, PALE);
  }
  // Archivolt of the portal: a half ring that stands out from the wall.
  kit.geo(
    new THREE.TorusGeometry(PORTAL.half + 0.16, 0.11, 6, 28, Math.PI),
    put(at(0, PORTAL.straight, depth + 0.02)), PALE, M_MARBLE,
  );
  // Cornice and a row of stone orbs.
  kit.geo(new THREE.BoxGeometry(WALL.half * 2 + 0.3, 0.26, depth + 0.34), put(at(0, WALL.height + 0.13, depth / 2 + 0.06)), PALE, M_MARBLE);
  for (const x of [-3.6, -1.8, 0, 1.8, 3.6]) {
    kit.geo(new THREE.CylinderGeometry(0.16, 0.22, 0.2, 8), put(at(x, WALL.height + 0.36, depth / 2)), PALE, M_MARBLE);
    kit.geo(new THREE.SphereGeometry(0.24, 14, 10), put(at(x, WALL.height + 0.68, depth / 2)), PALE, M_MARBLE);
  }
}

/** Flying stair between the floor y = -S and the floor x = -S. Profile plane = (x, y). */
function buildStair(kit: Kit): void {
  const count = Math.round(RISE / STEP);
  const shape = new THREE.Shape();
  shape.moveTo(FOOT, -S);
  for (let i = 0; i < count; i++) {
    shape.lineTo(FOOT - i * STEP, -S + (i + 1) * STEP);
    shape.lineTo(FOOT - (i + 1) * STEP, -S + (i + 1) * STEP);
  }
  // The soffit is an arch: thick at the two floors, thin at the crown.
  const butt = 2.6;
  shape.lineTo(-S, -S + RISE - butt);
  shape.quadraticCurveTo(-5.94, -5.94, FOOT - butt, -S);
  shape.closePath();
  const flight = new THREE.ExtrudeGeometry(shape, { depth: WIDTH, bevelEnabled: false, curveSegments: 20 });
  flight.translate(0, 0, -WIDTH / 2);
  kit.geo(flight, IDENTITY, PALE, M_MARBLE);

  // Balustrades. Rail and balusters are square to the flight, so they serve both worlds.
  const out = Math.SQRT1_2;
  const lift = 1.1;
  for (const z of [-WIDTH / 2 + 0.1, WIDTH / 2 - 0.1]) {
    const mid = (FOOT - S + STEP) / 2;
    kit.geo(
      new THREE.BoxGeometry(RISE * Math.SQRT2 - 1.1, 0.14, 0.17),
      new THREE.Matrix4().makeRotationZ(Math.PI * 0.75).setPosition(mid + (lift + 0.07) * out, mid + (lift + 0.07) * out, z), DARK, M_MARBLE,
    );
    for (let i = 1; i < count - 1; i += 2) {
      const nx = FOOT - i * STEP, ny = -S + (i + 1) * STEP;
      kit.geo(baluster(), new THREE.Matrix4().makeRotationZ(-Math.PI / 4).setPosition(nx, ny, z), DARK, M_MARBLE);
    }
    // Newel post with an orb at the foot of the flight.
    kit.box(FOOT + 0.04, -S, z - 0.13, FOOT + 0.3, -S + 1.55, z + 0.13, PALE, M_MARBLE);
    kit.geo(new THREE.SphereGeometry(0.19, 12, 8), at(FOOT + 0.17, -S + 1.72, z), PALE, M_MARBLE);
  }

  // Landing balconies at the top of the flight, one on each side of it.
  const by = -S + RISE;
  for (const side of [-1, 1]) {
    const z0 = side * WIDTH / 2, z1 = side * (WIDTH / 2 + 1.8);
    const lo = Math.min(z0, z1), hi = Math.max(z0, z1);
    kit.box(-S, by - 0.28, lo, -S + 1.5, by, hi, PALE, M_MARBLE);
    kit.box(-S, by - 0.8, z1 - side * 0.5, -S + 0.9, by - 0.28, z1 - side * 0.2, STONE, M_MARBLE);
    const edge = -S + 1.4;
    kit.box(edge - 0.07, by + 1.1, lo, edge + 0.07, by + 1.24, hi, DARK, M_MARBLE);
    kit.box(-S, by + 1.1, z1 - side * 0.14, edge, by + 1.24, z1, DARK, M_MARBLE);
    for (let z = lo + 0.22; z < hi; z += 0.45) kit.geo(baluster(), at(edge, by, z), DARK, M_MARBLE);
    for (let x = -S + 0.3; x < edge - 0.2; x += 0.45) kit.geo(baluster(), at(x, by, z1 - side * 0.07), DARK, M_MARBLE);
  }
}

/** Armillary sphere on a pedestal at the middle of the floor. */
function buildArmillary(kit: Kit): void {
  const y = -S;
  kit.geo(new THREE.CylinderGeometry(0.85, 0.95, 0.3, 8), at(0, y + 0.15, 0), PALE, M_MARBLE, true);
  kit.geo(new THREE.CylinderGeometry(0.46, 0.56, 0.9, 16), at(0, y + 0.75, 0), STONE, M_MARBLE);
  kit.geo(new THREE.CylinderGeometry(0.66, 0.5, 0.14, 8), at(0, y + 1.27, 0), PALE, M_MARBLE, true);
  const c = y + 2.52, brass = 0.74;
  // Cradle: a half ring that holds the sphere.
  kit.geo(new THREE.TorusGeometry(1.12, 0.05, 6, 24, Math.PI), new THREE.Matrix4().makeRotationZ(Math.PI).setPosition(0, c, 0), brass, M_BRASS);
  kit.geo(new THREE.CylinderGeometry(0.06, 0.09, 0.2, 8), at(0, y + 1.42, 0), brass, M_BRASS);
  const tilt = new THREE.Matrix4().makeRotationZ(0.41);
  const ring = (radius: number, tube: number, turn: THREE.Matrix4): void => {
    kit.geo(new THREE.TorusGeometry(radius, tube, 6, 48), tilt.clone().multiply(turn).setPosition(0, c, 0), brass, M_BRASS);
  };
  ring(1.0, 0.04, new THREE.Matrix4());
  ring(1.0, 0.04, new THREE.Matrix4().makeRotationY(Math.PI / 2));
  ring(1.0, 0.04, new THREE.Matrix4().makeRotationX(Math.PI / 2));
  ring(0.86, 0.06, new THREE.Matrix4().makeRotationX(Math.PI / 2 - 0.41));
  ring(0.6, 0.03, new THREE.Matrix4().makeRotationX(Math.PI / 2 + 0.3));
  kit.geo(new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6), tilt.clone().setPosition(0, c, 0), brass, M_BRASS);
  kit.geo(new THREE.SphereGeometry(0.3, 18, 12), at(0, c, 0), 0.9, M_GLOBE);
}

/** Celestial globe on a turned stand with a meridian ring and a horizon ring. */
function buildGlobe(kit: Kit, x: number, z: number, radius: number): void {
  const y = -S;
  const stand = [[0.001, 0], [0.5, 0], [0.5, 0.1], [0.16, 0.22], [0.1, 0.6], [0.2, 0.84], [0.12, 0.98], [0.3, 1.08], [0.001, 1.08]];
  kit.geo(new THREE.LatheGeometry(stand.map(([r, h]) => new THREE.Vector2(r, h)), 12), at(x, y, z), DARK, M_MARBLE);
  const c = y + 1.08 + radius * 1.02;
  kit.geo(new THREE.SphereGeometry(radius, 26, 18), at(x, c, z), 0.95, M_GLOBE);
  kit.geo(new THREE.TorusGeometry(radius + 0.07, 0.035, 6, 40), new THREE.Matrix4().makeRotationY(0.6).setPosition(x, c, z), 0.74, M_BRASS);
  kit.geo(new THREE.TorusGeometry(radius + 0.13, 0.04, 6, 40), new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(x, c, z), 0.74, M_BRASS);
}

/** Everything that belongs to the world whose "down" is -y. */
function buildModule(kit: Kit): void {
  // Round floor with a raised curb.
  kit.geo(new THREE.CircleGeometry(FLOOR_R, 72), new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, -S, 0), 1, M_FLOOR);
  const curb = [[FLOOR_R - 0.42, 0], [FLOOR_R - 0.42, 0.2], [FLOOR_R - 0.04, 0.2]].map(([r, h]) => new THREE.Vector2(r, h));
  kit.geo(new THREE.LatheGeometry(curb, 72), at(0, -S, 0), PALE, M_MARBLE, true);

  buildLibraryWall(kit);
  buildStair(kit);
  buildArmillary(kit);
  buildGlobe(kit, -4.5, 5.9, 0.62);
  buildGlobe(kit, 5.6, -4.3, 0.5);

  // Reading table with open folios, in front of the alcoves.
  const y = -S;
  kit.box(-5.5, y + 0.9, 1.9, -4.5, y + 1.0, 4.1, DARK, M_MARBLE);
  for (const [x, z] of [[-5.4, 2.0], [-4.6, 2.0], [-5.4, 4.0], [-4.6, 4.0]]) kit.box(x - 0.06, y, z - 0.06, x + 0.06, y + 0.9, z + 0.06, DARK, M_MARBLE);
  kit.geo(new THREE.BoxGeometry(0.5, 0.07, 0.7), new THREE.Matrix4().makeRotationY(0.25).setPosition(-5.0, y + 1.04, 2.6), PALE, M_BOOKS);
  kit.geo(new THREE.BoxGeometry(0.42, 0.14, 0.32), new THREE.Matrix4().makeRotationY(-0.4).setPosition(-4.95, y + 1.07, 3.55), 0.7, M_BOOKS);
  // Slanted lectern near the middle of the floor.
  kit.box(2.4, y, 2.4, 2.56, y + 1.25, 2.56, DARK, M_MARBLE);
  kit.geo(new THREE.BoxGeometry(0.75, 0.06, 0.55), new THREE.Matrix4().makeRotationX(-0.5).setPosition(2.48, y + 1.3, 2.48), DARK, M_MARBLE);
}

// ---------------------------------------------------------------------------
// Scholars
// ---------------------------------------------------------------------------

/** One robed scholar: feet at the origin, faces +z. aPart marks the part for the walk swing. */
function buildScholar(): THREE.BufferGeometry {
  const pos: number[] = [], nor: number[] = [], part: number[] = [];
  const add = (g: THREE.BufferGeometry, m: THREE.Matrix4, limb: number): void => {
    const src = g.index ? g.toNonIndexed() : g;
    const p = src.getAttribute('position'), n = src.getAttribute('normal');
    const nm = new THREE.Matrix3().getNormalMatrix(m);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      nor.push(v.x, v.y, v.z);
      part.push(limb);
    }
    if (src !== g) src.dispose();
    g.dispose();
  };
  const place = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): THREE.Matrix4 => new THREE.Matrix4().makeScale(sx, sy, sz).setPosition(x, y, z);
  // Part 5 = the long robe. Its hem sways with the stride.
  add(new THREE.CylinderGeometry(0.17, 0.31, 1.0, 14, 5), place(0, 0.57, 0, 1, 1, 0.82), 5);
  // Part 0 = chest, short cape, neck, head, flat cap.
  add(new THREE.CylinderGeometry(0.2, 0.17, 0.34, 12), place(0, 1.23, 0, 1, 1, 0.7), 0);
  add(new THREE.SphereGeometry(0.25, 14, 8), place(0, 1.4, -0.01, 1, 0.42, 0.78), 0);
  add(new THREE.CylinderGeometry(0.045, 0.055, 0.1, 8), place(0, 1.49, 0), 0);
  add(new THREE.SphereGeometry(0.12, 14, 10), place(0, 1.62, 0.01, 1, 1.15, 1.05), 0);
  add(new THREE.CylinderGeometry(0.125, 0.13, 0.07, 12), place(0, 1.735, 0), 0);
  add(new THREE.CylinderGeometry(0.19, 0.19, 0.025, 4), new THREE.Matrix4().makeRotationY(Math.PI / 4).setPosition(0, 1.785, 0), 0);
  for (const side of [-1, 1]) {
    const foot = side < 0 ? 1 : 2, arm = side < 0 ? 3 : 4;
    add(new THREE.BoxGeometry(0.09, 0.07, 0.24), place(side * 0.09, 0.035, 0.06), foot);
    // Wide sleeve that opens toward the wrist, and a hand.
    add(new THREE.SphereGeometry(0.07, 8, 6), place(side * 0.235, 1.38, 0), arm);
    add(new THREE.CylinderGeometry(0.06, 0.1, 0.52, 10), place(side * 0.25, 1.12, 0), arm);
    add(new THREE.SphereGeometry(0.045, 8, 6), place(side * 0.25, 0.83, 0, 0.8, 1.2, 1), arm);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  return g;
}

/** A scholar of the -y world. The scholar walks between a and b, or stands at a and looks toward b. */
interface Walker { a: THREE.Vector3; b: THREE.Vector3; speed: number; start: number }

function walkers(): Walker[] {
  const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
  // Feet follow the middle of the treads: x + y = const on the flight.
  const line = FOOT - S + STEP / 2;
  const low = FOOT - 0.3, high = -S + 0.45;
  return [
    // On the treads of the flight that rises toward the floor x = -S.
    { a: v(low, line - low, -0.45), b: v(high, line - high, -0.45), speed: 0.9, start: 0.1 },
    // On the risers of the flight that rises toward the floor z = -S. They are treads in this world.
    { a: v(0.45, high, line - high), b: v(0.45, low, line - low), speed: 0.8, start: 0.62 },
    // Across the open floor.
    { a: v(3.6, -S, 6.6), b: v(7.0, -S, -1.6), speed: 1.0, start: 0.3 },
    { a: v(-2.6, -S, 5.4), b: v(-5.4, -S, 8.0), speed: 0.85, start: 0.8 },
    // Along the book alcoves and under the flying stair.
    { a: v(-6.25, -S, -3.5), b: v(-6.25, -S, 3.5), speed: 0.7, start: 0.45 },
    // Standing scholars: at the shelves, at the armillary, on the landing balcony.
    { a: v(-6.6, -S, -2.2), b: v(-8, -S, -2.2), speed: 0, start: 0 },
    { a: v(1.5, -S, 1.1), b: v(0, -S, 0), speed: 0, start: 0 },
    { a: v(-S + 0.75, -S + RISE, 2.0), b: v(-4, -S + RISE, 4.5), speed: 0, start: 0 },
  ];
}

// ---------------------------------------------------------------------------
// Shaders. Colour buffer: r = tone, g and b = hatch line fields, a = part id.
// ---------------------------------------------------------------------------

const LITHO = /* glsl */ `
const vec3 LIGHT = vec3(0.47, 0.8, 0.372);
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
// Light on a face. Faces that look away from the lamp take reflected light from the three floors.
float lithoLight(vec3 n) {
  return 0.58 + 0.39 * max(dot(n, LIGHT), 0.0) + 0.1 * max(-dot(n, LIGHT), 0.0) + 0.05 * dot(n, vec3(0.577));
}
`;

const WORLD_VERT = /* glsl */ `
attribute vec3 aLp;
attribute vec3 aLn;
attribute float aTone;
attribute float aMat;
attribute float aId;
varying vec3 vLp;
varying vec3 vLn;
varying vec3 vWp;
varying vec3 vN;
varying float vTone;
varying float vMat;
varying float vId;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vLp = aLp;
  vLn = aLn;
  vN = normal;
  vTone = aTone;
  vMat = aMat;
  vId = aId;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WORLD_FRAG = /* glsl */ `
varying vec3 vLp;
varying vec3 vLn;
varying vec3 vWp;
varying vec3 vN;
varying float vTone;
varying float vMat;
varying float vId;
${GLSL_NOISE}
${LITHO}
void main() {
  // p and ln are in the module frame, so the three worlds carry the same patterns.
  vec3 p = vLp;
  vec3 ln = normalize(vLn);
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) { n = -n; ln = -ln; }
  vec3 an = abs(ln);
  int m = int(vMat + 0.5);
  float tone = vTone * lithoLight(n);
  // Charcoal gathers toward the dome, away from the middle of the room.
  tone *= 1.0 - 0.12 * smoothstep(8.5, ${DOME.toFixed(1)}, length(vWp));

  bool planar = max(an.x, max(an.y, an.z)) > 0.9;
  // Chart of an axis face: (length along the face, height in the module).
  vec2 uv = an.y > 0.9 ? p.zx : (an.x > 0.9 ? p.zy : p.xy);
  if (!planar) uv = vec2(dot(p, vec3(0.62, 0.7, 0.35)), dot(p, vec3(-0.7, 0.3, 0.65)));
  float h1 = lineField((uv.x + uv.y) * 0.7071, 3.8);
  float h2 = lineField((uv.x - uv.y) * 0.7071, 3.8);
  float fw = fwidth(uv.x) + fwidth(uv.y);

  if (m == ${M_WALL}) {
    if (planar && an.y < 0.5) {
      // Coursed ashlar.
      vec2 g = vec2(uv.x / 1.05 + 0.5 * floor(uv.y / 0.46), uv.y / 0.46);
      vec2 d = (0.5 - abs(fract(g) - 0.5)) * vec2(1.05, 0.46);
      float joint = (1.0 - smoothstep(0.0, 1.3 * fw, min(d.x, d.y) - 0.008)) * (1.0 - smoothstep(0.05, 0.16, fw));
      tone *= 1.0 - 0.22 * joint;
      tone *= 0.95 + 0.1 * hash21(floor(g) + ln.xz * 5.0);
    }
  } else if (m == ${M_MARBLE}) {
    // Faint veins.
    tone *= 0.96 + 0.07 * vnoise3(p * vec3(1.6, 3.1, 1.6) + 2.0 * vnoise3(p * 0.7));
  } else if (m == ${M_FLOOR}) {
    // Inlaid marble: a sixteen-point star, ring courses, a chequer band, a dark border.
    vec2 g = p.xz;
    float r = length(g);
    float a = atan(g.y, g.x) / K_TAU;
    float fr = fwidth(r) * 1.4;
    float body = 0.97;
    float joint = 0.0;
    if (r < 1.5) {
      body = 0.9;
    } else if (r < 3.6) {
      float spoke = abs(fract(a * 8.0) - 0.5) * 2.0;
      float reach = 1.5 + 2.1 * (1.0 - spoke);
      float star = 1.0 - smoothstep(-fr, fr, r - reach);
      float half_ = step(0.5, fract(a * 16.0 + 0.5));
      body = mix(0.99, mix(0.62, 0.84, half_), star);
    } else if (r < 5.2) {
      float da = (0.5 - abs(fract(a * 24.0) - 0.5)) * K_TAU * r / 24.0;
      joint = 1.0 - smoothstep(0.0, fr, da - 0.012);
      body = 0.93 + 0.06 * hash11(floor(a * 24.0) + 3.0);
    } else if (r < 6.0) {
      float chk = mod(floor(a * 48.0) + floor((r - 5.2) / 0.4), 2.0);
      body = mix(0.62, 0.98, chk);
    } else if (r < 9.0) {
      float ring = floor((r - 6.0) / 1.5);
      float count = 36.0 + 12.0 * ring;
      float da = (0.5 - abs(fract(a * count + 0.5 * ring) - 0.5)) * K_TAU * r / count;
      float dr = (0.5 - abs(fract((r - 6.0) / 1.5) - 0.5)) * 1.5;
      joint = 1.0 - smoothstep(0.0, fr, min(da, dr) - 0.012);
      body = 0.92 + 0.07 * hash21(vec2(floor(a * count + 0.5 * ring), ring));
    } else {
      body = 0.7;
    }
    // Ring joints between the bands.
    float band = min(min(abs(r - 1.5), abs(r - 3.6)), min(min(abs(r - 5.2), abs(r - 6.0)), abs(r - 9.0)));
    joint = max(joint, 1.0 - smoothstep(0.0, fr, band - 0.02));
    joint *= 1.0 - smoothstep(0.06, 0.2, fr);
    tone = vTone * lithoLight(n) * body * (1.0 - 0.3 * joint);
    tone *= 1.0 - 0.12 * smoothstep(8.5, ${DOME.toFixed(1)}, length(vWp));
  } else if (m == ${M_BOOKS}) {
    // Rows of book spines. uv = (length along the shelf, height).
    float rowH = 0.42;
    float row = floor(uv.y / rowH);
    float fv = uv.y - row * rowH;
    float bu = uv.x / 0.085 + 13.7 * hash11(row + 5.0);
    float bi = floor(bu);
    float bh = 0.25 + 0.11 * hash21(vec2(bi, row));
    float spine = 0.34 + 0.5 * hash21(vec2(bi + 7.0, row));
    float body = fv < 0.04 ? 0.95 : (fv < 0.04 + bh ? spine : 0.16);
    float gap = step(0.86, fract(bu)) * step(0.04, fv) * (1.0 - smoothstep(0.02, 0.06, fw));
    tone = body * (1.0 - 0.45 * gap) * (0.72 + 0.28 * lithoLight(n));
    // The lines run up the spines.
    h1 = lineField(uv.x, 3.0);
    h2 = lineField(uv.y, 3.6);
  } else if (m == ${M_BRASS}) {
    tone = vTone * (0.42 + 0.4 * lithoLight(n)) + 0.3 * pow(max(dot(n, LIGHT), 0.0), 8.0);
    h1 = lineField((uv.x + uv.y) * 0.7071, 2.6);
    h2 = lineField((uv.x - uv.y) * 0.7071, 2.6);
  } else if (m == ${M_GLOBE}) {
    // Celestial globe: the normal of a sphere is its own chart. Meridians, parallels, stars.
    float lon = atan(ln.z, ln.x) / K_TAU;
    float lat = asin(clamp(ln.y, -1.0, 1.0)) / K_PI;
    float gl = min(abs(fract(lon * 12.0) - 0.5) * 2.0, abs(fract(lat * 12.0) - 0.5) * 2.0);
    float grid = smoothstep(0.86, 0.96, gl);
    vec2 cell = vec2(lon * 40.0, lat * 20.0);
    vec3 hs = hash23(floor(cell));
    float star = step(0.72, hs.z) * (1.0 - smoothstep(0.08, 0.2, length(fract(cell) - 0.25 - 0.5 * hs.xy)));
    tone *= 1.0 - 0.3 * grid - 0.55 * star;
    h1 = lineField(lon * 9.0 + lat * 3.0, 3.6);
    h2 = lineField(lat * 9.0 - lon * 3.0, 3.6);
  } else if (m == ${M_DARK}) {
    tone = vTone;
  }
  gl_FragColor = vec4(clamp(tone, 0.0, 1.0), h1, h2, vId);
}
`;

const DOME_VERT = /* glsl */ `
varying vec3 vWp;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const DOME_FRAG = /* glsl */ `
varying vec3 vWp;
${GLSL_NOISE}
${LITHO}
void main() {
  // Chart about the space diagonal, so the star chart has the three-fold symmetry of the room.
  vec3 d = normalize(vWp);
  vec3 axis = vec3(0.57735);
  vec3 e1 = vec3(0.70711, -0.70711, 0.0);
  vec3 e2 = cross(axis, e1);
  float lat = asin(clamp(dot(d, axis), -1.0, 1.0));
  float lon = atan(dot(d, e2), dot(d, e1)) / K_TAU;
  vec3 n = -d;
  // The dome is pale plaster: it takes soft light from all three floors.
  float tone = 0.94 * (0.7 + 0.3 * lithoLight(n));
  // Ribs on 24 meridians and ring courses: coffers between them.
  float span = cos(lat) * ${DOME.toFixed(1)};
  float ribA = (0.5 - abs(fract(lon * 24.0) - 0.5)) * K_TAU * span / 24.0;
  float ribR = (0.5 - abs(fract(lat / 0.2244) - 0.5)) * 0.2244 * ${DOME.toFixed(1)};
  float fw = fwidth(lat) * ${DOME.toFixed(1)} * 1.5;
  float inset = min(ribA, ribR);
  float coffer = smoothstep(0.16, 0.16 + fw, inset) * step(abs(lat), 1.24);
  tone *= 1.0 - 0.13 * coffer;
  // The shadow line on the inner edge of each coffer.
  tone *= 1.0 - 0.3 * coffer * (1.0 - smoothstep(0.16, 0.3 + fw, inset));
  // Stars of the chart in the coffers.
  vec2 cell = vec2(lon * 96.0, lat / 0.0561);
  vec3 hs = hash23(floor(cell) + 3.0);
  vec2 sp = fract(cell) - 0.2 - 0.6 * hs.xy;
  float star = step(0.6, hs.z) * (1.0 - smoothstep(0.06, 0.18, length(sp))) * coffer;
  tone *= 1.0 - 0.62 * star;
  // Oculus at the top of the diagonal. A carved rosette closes the bottom, between the three floors.
  float eye = smoothstep(1.3, 1.34, lat);
  tone = mix(tone, 0.99, eye);
  float petal = step(0.5, fract(lon * 12.0));
  float boss = smoothstep(1.24, 1.27, -lat);
  tone = mix(tone, mix(0.6, 0.86, petal) * (0.75 + 0.25 * lithoLight(n)), boss);
  float ring = 1.0 - smoothstep(0.0, 0.025, abs(abs(lat) - 1.27));
  tone *= 1.0 - 0.4 * ring;
  // The hatch chart has no seam: it does not use the longitude.
  float h1 = lineField(lat * 9.0 + dot(d, e1) * 7.0, 3.8);
  float h2 = lineField(lat * 9.0 - dot(d, e2) * 7.0, 3.8);
  gl_FragColor = vec4(clamp(tone, 0.0, 1.0), mix(h1, 1.0, eye), mix(h2, 1.0, eye), 0.02);
}
`;

const FIGURE_VERT = /* glsl */ `
attribute float aPart;
attribute vec4 aWalk;
uniform float uTime;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vBody;
varying float vId;
varying float vGarb;
void main() {
  // aWalk = (phase, swing, id, garment tone). Feet step, sleeves swing, the hem follows the feet.
  float swing = sin(uTime * 3.1 + aWalk.x) * aWalk.y;
  vec3 p = position;
  vec3 nrm = normal;
  if (aPart > 0.5 && aPart < 2.5) {
    float s = aPart < 1.5 ? 1.0 : -1.0;
    p.z += 0.17 * swing * s;
    p.y += 0.05 * max(swing * s, 0.0);
  } else if (aPart > 2.5 && aPart < 4.5) {
    float ang = (aPart < 3.5 ? -0.42 : 0.42) * swing;
    float c = cos(ang), sn = sin(ang);
    p.y -= 1.38;
    p = vec3(p.x, c * p.y - sn * p.z, sn * p.y + c * p.z);
    p.y += 1.38;
    nrm = vec3(nrm.x, c * nrm.y - sn * nrm.z, sn * nrm.y + c * nrm.z);
  } else if (aPart > 4.5) {
    float hem = clamp(1.07 - p.y, 0.0, 1.0);
    p.z += 0.13 * hem * hem * swing * sign(p.x) * -1.0;
    p.x += 0.02 * hem * abs(swing);
  }
  // A small bob with each step.
  p.y += 0.018 * abs(swing) * step(0.1, p.y);
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vWp = wp.xyz;
  vN = normalize(mat3(instanceMatrix) * nrm);
  vBody = position;
  vId = aWalk.z;
  vGarb = aWalk.w;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FIGURE_FRAG = /* glsl */ `
varying vec3 vWp;
varying vec3 vN;
varying vec3 vBody;
varying float vId;
varying float vGarb;
${GLSL_NOISE}
${LITHO}
void main() {
  vec3 n = normalize(vN);
  // Cloth: soft tone, long fold lines down the robe. Face and hands stay pale.
  float skin = step(1.5, vBody.y) * step(vBody.y, 1.7) + step(vBody.y, 0.9) * step(0.78, vBody.y) * step(0.2, abs(vBody.x));
  float cloth = mix(vGarb, 0.96, clamp(skin, 0.0, 1.0));
  float fold = 0.5 + 0.5 * sin(atan(vBody.z, vBody.x) * 9.0 + vBody.y * 2.0);
  float tone = cloth * (lithoLight(n) - 0.07 * fold * step(vBody.y, 1.1));
  float h1 = lineField(dot(vWp, vec3(0.62, 0.7, 0.35)), 3.4);
  float h2 = lineField(dot(vWp, vec3(-0.7, 0.3, 0.65)), 3.4);
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
  gl_FragColor = vec4(0.985, 1.0, 1.0, 0.0);
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

  // Ink edges: a break in the part id, the tone, or the depth.
  float idE = max(max(abs(e0.a - s.a), abs(e1.a - s.a)), max(abs(e2.a - s.a), abs(e3.a - s.a)));
  float toneE = max(abs(e0.r - e1.r), abs(e2.r - e3.r));
  float edge = max(smoothstep(0.006, 0.03, idE), smoothstep(0.07, 0.17, toneE));
  edge = max(edge, smoothstep(0.012, 0.035, depthEdge(vUv, px)));

  // Paper tooth breaks the crayon lines.
  float tooth = 0.6 * vnoise(cv * 1.9) + 0.4 * hash21(floor(cv * 1.3));
  float dark = 1.0 - s.r;
  // Cross-hatching: the lines swell with the darkness. The second set starts in the half tones.
  float w1 = clamp(pow(dark, 1.25) * 1.15 + (tooth - 0.5) * 0.12, 0.0, 1.0);
  float w2 = clamp((dark - 0.38) * 1.7 + (tooth - 0.5) * 0.12, 0.0, 1.0);
  float l1 = (1.0 - smoothstep(w1 - 0.13, w1 + 0.13, s.g)) * smoothstep(0.03, 0.14, w1);
  float l2 = (1.0 - smoothstep(w2 - 0.13, w2 + 0.13, s.b)) * smoothstep(0.03, 0.14, w2);
  float ink = max(max(l1, l2), edge * 0.92);

  // Charcoal ground under the lines.
  float wash = dark * dark * (0.5 + 0.5 * tooth);
  vec3 paper = vec3(0.928, 0.908, 0.86) * (0.965 + 0.05 * vnoise(cv * 0.35) + 0.03 * (tooth - 0.5));
  vec3 col = paper * (1.0 - 0.42 * wash);
  col = mix(col, vec3(0.112, 0.104, 0.102), ink * (0.8 + 0.2 * tooth));
  col *= vignette(vUv, 0.3);
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

export function createThreeGravityRotunda(): PaintingScene {
  const scene = new THREE.Scene();
  const far = 600;
  const time = { value: 0 };
  const rand = mulberry32(3301);

  // Three copies of the module: the -y world, the -z world, the -x world.
  const kit = new Kit();
  const frames = [new THREE.Matrix4(), CYCLE.clone(), CYCLE.clone().multiply(CYCLE)];
  for (const frame of frames) {
    kit.frame.copy(frame);
    buildModule(kit);
  }

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(far * 0.8, 16, 8),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  scene.add(sky);

  // The dome shows its inner face only, so a camera outside the dome looks into the room.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(DOME, 96, 64),
    new THREE.ShaderMaterial({ vertexShader: DOME_VERT, fragmentShader: DOME_FRAG, side: THREE.BackSide }),
  );
  dome.frustumCulled = false;
  scene.add(dome);

  const world = new THREE.Mesh(kit.build(), new THREE.ShaderMaterial({ vertexShader: WORLD_VERT, fragmentShader: WORLD_FRAG, side: THREE.DoubleSide }));
  world.frustumCulled = false;
  scene.add(world);

  // Scholars of all three worlds.
  const base = walkers();
  const total = base.length * frames.length;
  const figures = new THREE.InstancedMesh(
    buildScholar(),
    new THREE.ShaderMaterial({ vertexShader: FIGURE_VERT, fragmentShader: FIGURE_FRAG, uniforms: { uTime: time } }),
    total,
  );
  const walk = new Float32Array(total * 4);
  for (let i = 0; i < total; i++) {
    const w = base[i % base.length];
    walk[i * 4] = rand() * 6.28;
    walk[i * 4 + 1] = w.speed > 0 ? 1 : 0;
    walk[i * 4 + 2] = 0.07 + 0.88 * ((i * 0.754877666 + 0.31) % 1);
    // Pale robes and dark coats.
    walk[i * 4 + 3] = rand() < 0.45 ? 0.5 + 0.12 * rand() : 0.82 + 0.14 * rand();
  }
  figures.geometry.setAttribute('aWalk', new THREE.InstancedBufferAttribute(walk, 4));
  figures.frustumCulled = false;
  scene.add(figures);

  const up = new THREE.Vector3(0, 1, 0);
  const posV = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
  const size = new THREE.Vector3(FIGURE, FIGURE, FIGURE);
  const local = new THREE.Matrix4(), out = new THREE.Matrix4();
  const placeFigures = (t: number): void => {
    for (let i = 0; i < total; i++) {
      const w = base[i % base.length];
      const world_ = Math.floor(i / base.length);
      fwd.subVectors(w.b, w.a);
      const len = fwd.length();
      let s = 0;
      if (w.speed > 0) {
        // There and back. The scholar turns at each end.
        const u = (((t * w.speed) / (2 * len) + w.start + world_ * 0.37) % 1) * 2;
        s = u < 1 ? u : 2 - u;
        if (u >= 1) fwd.negate();
      }
      posV.copy(w.a).lerp(w.b, s);
      // The scholar stays upright in its own world: only the level part of the path turns the body.
      fwd.y = 0;
      fwd.normalize();
      right.crossVectors(up, fwd);
      local.makeBasis(right, up, fwd).scale(size).setPosition(posV);
      figures.setMatrixAt(i, out.multiplyMatrices(frames[world_], local));
    }
    figures.instanceMatrix.needsUpdate = true;
  };
  placeFigures(0);

  return {
    scene,
    meta: {
      title: 'Rotunda of Three Gravities',
      artist: 'Original Paradox Study · Lithograph Geometry',
      technique: 'One library module copied by the cyclic axis permutation for three gravity worlds under one star-chart dome, flying 45° stairs with treads for one world and risers for the next, instanced scholars with shader walk cycles, cross-hatch line fields, charcoal tone, id + tone + depth ink edges.',
    },
    presets: [
      { name: 'The Rotunda', position: [7.6, 5.9, 8.9], target: [-3.6, -4.6, -3.2], fov: 62 },
      { name: 'Tread and Riser', position: [-0.6, -5.2, 6.4], target: [-6.4, -6.2, -0.4], fov: 54 },
      { name: 'Library Alcoves', position: [0.4, -7.2, 5.8], target: [-8, -6.2, -1.2], fov: 56 },
      { name: 'Open Dome', position: [27, 21, 31], target: [-1.2, -2.2, -1.2], fov: 36 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near: 0.1,
    far,
    flySpeed: 6,
    maxDistance: 90,
    // The rotunda has no single ground: the camera may go below any floor.
    floorAt: () => -80,
    update(ctx: FrameContext): void {
      time.value = ctx.time;
      sky.position.copy(ctx.camera.position);
      placeFigures(ctx.time);
    },
    dispose(): void {
      for (const mesh of [sky, dome, world, figures]) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      // The instanced mesh owns a GPU buffer for the instance matrices.
      figures.dispose();
    },
  };
}

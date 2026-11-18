// The Port of Saint-Tropez — Paul Signac, 1901.
//
// The harbour is built as a mosaic. Every surface carries rectangular tiles of
// pure pigment, laid in brick courses over a pale primed ground that shows in
// the joints: house fronts, roofs, quay, hulls, sails, hills. All tiles are
// sized from the painter's eye, so they come out at one size on the canvas.
// The water is a field of tilted facets. Each facet takes the colour that the
// town, a sail, or the sky reflects into it from the painter's eye, then
// breaks it into the prismatic set: the reflection, its violet, the blue of
// the water, and a spark of the complement. The facets rock with the swell.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { clamp, fbm2, hex, mix3, mulberry32, noise2, smoothstep, type RGB } from '../util';

type V3 = [number, number, number];

/** The painter's eye. Tile sizes and reflections are measured from it. */
const EYE: V3 = [-6, 5, 80];
const EYE_TARGET: V3 = [4, 5.6, 0];
const EYE_FOV = 30;
/** Focal length in pixels for a picture 760 pixels high. */
const FOCAL = 380 / Math.tan((EYE_FOV * Math.PI) / 360);
/** Size of one tile and its joint on the canvas, in pixels. */
const TILE_W = 9.5, TILE_H = 5.8;
/** Share of a cell that the tile covers. The rest is the joint. */
const FILL = 0.84;

const QUAY_TOP = 1.2;
const QUAY_DEPTH = 7;
const FRONT_Z = -QUAY_DEPTH;
const BACK_Z = -24;
const BACK_BASE = 4.2;

const CREAM = hex(0xf6ecd6);
const VIOLET = hex(0x6f63b8);
const LILAC = hex(0xa79be0);
const ULTRAMARINE = hex(0x3d55c4);
const PANE = hex(0x4f58a6);
const ROOF = hex(0xd9683f);
const QUAY_STONE = hex(0xf0c9a6);
const MAST: RGB[] = [hex(0xe6a85a), hex(0xf28c3e), hex(0x80598a), hex(0xf7d072), hex(0xc7743f)];
const WALLS: RGB[] = [
  hex(0xedb25c), hex(0xdb7f54), hex(0xf28f73), hex(0xeea89e), hex(0xf5e0b2), hex(0xf5cc6b),
  hex(0xf29e7a), hex(0xf5c7b8), hex(0xf0994d), hex(0xd1946b), hex(0xf7d98c), hex(0xe98a66),
];
const SHUTTERS: RGB[] = [hex(0x4d9e9e), hex(0x6b9e73), hex(0x5c7ab8), hex(0x8c6680), hex(0x40736b), hex(0x7aa6c2)];
const AWNINGS: RGB[] = [hex(0xd9483b), hex(0x3f6fc0), hex(0xf0a030), hex(0x3f9a78)];
const SAIL_CREAM: RGB[] = [hex(0xfaedc7), hex(0xfce69e), hex(0xfdf7ea), hex(0xf7d1cc), hex(0xfbe3b0)];
const SAIL_SHADE: RGB[] = [hex(0xbdb3e6), hex(0xb8d1f2), hex(0xd6b8dc)];
const SAIL_TAN: RGB[] = [hex(0xed943f), hex(0xf5b04d), hex(0xd96a38), hex(0xf7c46b)];
const WATER_NEAR: RGB[] = [hex(0x5c57b8), hex(0x4061cc), hex(0x409eb3), hex(0x7a66c2), hex(0x3f8fa8), hex(0x4f49a8)];
const WATER_FAR: RGB[] = [hex(0x8cadE6), hex(0xb8a8e6), hex(0x9cc7e0), hex(0xa3b8f0), hex(0xc9b3e0)];
const HILL_FAR: RGB[] = [hex(0x738cd9), hex(0x9985d1), hex(0xa8bfeb), hex(0x8573c7), hex(0x7fa3e0)];
const HILL_NEAR: RGB[] = [hex(0x8ca861), hex(0x59998c), hex(0xc7c76b), hex(0x7f6bb3), hex(0x6b9e6b), hex(0xa3b85c)];

function pick<T>(list: T[], rand: () => number): T {
  return list[Math.min(Math.floor(rand() * list.length), list.length - 1)];
}

function tint(c: RGB, k: number): RGB {
  return [c[0] * k, c[1] * k, c[2] * k];
}

/** The primed ground under the tiles: the local colour, laid thin over cream. */
function under(c: RGB): RGB {
  return mix3(c, CREAM, 0.45);
}

/** Tile cell size in metres at a point, so the cell has the canvas size from the painter's eye. */
function tileSize(p: V3, scale = 1): [number, number] {
  const d = clamp(Math.hypot(p[0] - EYE[0], p[1] - EYE[1], p[2] - EYE[2]), 18, 1500);
  return [(TILE_W * d * scale) / FOCAL, (TILE_H * d * scale) / FOCAL];
}

/**
 * Signac's division of one local colour: most tiles hold the colour, some take
 * its light tint, some a hotter note, and a few the cool complement.
 */
function divide(base: RGB, rand: () => number, shade = 0): RGB {
  let c = base;
  if (shade > 0) c = mix3(c, VIOLET, 0.42 * shade);
  const r = rand();
  if (r < 0.17) c = mix3(c, [1.0, 0.96, 0.82], 0.42);
  else if (r < 0.31) c = [Math.min(c[0] * 1.08, 1), c[1] * 0.9, c[2] * 0.72];
  else if (r < 0.41 + 0.14 * shade) c = mix3(c, LILAC, 0.6);
  else if (r < 0.44 + 0.14 * shade) c = mix3(c, [0.98, 0.62, 0.66], 0.6);
  const k = 0.93 + 0.14 * rand();
  return [Math.min(c[0] * k, 1), Math.min(c[1] * k, 1), Math.min(c[2] * k, 1)];
}

// ---------------------------------------------------------------------------
// Tiles. One record is one instance: 16 floats, stored as the instance matrix.
//   column 0: centre.xyz, kind (0 = fixed, 1 = turns about its long axis to face the eye, 2 = water facet)
//   column 1: half width vector, phase
//   column 2: half height vector, rock amplitude
//   column 3: colour.rgb, seed
// ---------------------------------------------------------------------------

class Tiles {
  readonly data: number[] = [];

  add(c: V3, u: V3, v: V3, col: RGB, kind: number, phase: number, rock: number, seed: number): void {
    this.data.push(c[0], c[1], c[2], kind, u[0], u[1], u[2], phase, v[0], v[1], v[2], rock, col[0], col[1], col[2], seed);
  }

  get count(): number {
    return this.data.length / 16;
  }
}

interface Surface {
  /** A point of the surface. u and v are lengths in metres along its two directions. */
  point(u: number, v: number): V3;
  v0: number;
  v1: number;
  /** The extent of one course at height v. */
  span(v: number): [number, number];
  /** Local colour of a tile, or null where the surface has a hole. */
  colour(u: number, v: number, p: V3): RGB | null;
  size: [number, number];
  /** Distance the tiles stand off the surface. */
  lift: number;
  /** Reverses the side that the tiles stand on. */
  flip?: boolean;
  /**
   * The tiles stand on the surface in level courses, like the faces of terrace
   * walls, and lean back up the slope by this angle in radians. They keep
   * their height from the painter's eye and still show from above.
   */
  terrace?: number;
}

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function unit(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]);
  if (l < 1e-9) throw new Error('unit: the vector has no length');
  return [a[0] / l, a[1] / l, a[2] / l];
}

function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Lays brick courses of tiles on a surface. */
function tileSurface(tiles: Tiles, s: Surface, rand: () => number): void {
  const [w, h] = s.size;
  const rows = Math.max(1, Math.round((s.v1 - s.v0) / h));
  const rh = (s.v1 - s.v0) / rows;
  const e = Math.min(w, h) * 0.25;
  for (let j = 0; j < rows; j++) {
    const v = s.v0 + (j + 0.5) * rh;
    const [u0, u1] = s.span(v);
    const len = u1 - u0;
    if (len < w * 0.45) continue;
    const cols = Math.max(1, Math.round(len / w));
    const cw = len / cols;
    // Odd courses start with a half tile, so the joints break.
    const cells: Array<[number, number]> = [];
    if (j % 2 === 0 || cols < 2) {
      for (let i = 0; i < cols; i++) cells.push([u0 + (i + 0.5) * cw, cw]);
    } else {
      cells.push([u0 + cw * 0.25, cw * 0.5]);
      for (let i = 0; i < cols - 1; i++) cells.push([u0 + (i + 1) * cw, cw]);
      cells.push([u1 - cw * 0.25, cw * 0.5]);
    }
    for (const [uc, tw] of cells) {
      const p = s.point(uc, v);
      const col = s.colour(uc, v, p);
      if (!col) continue;
      let a = unit(sub(s.point(uc + e, v), s.point(uc - e, v)));
      let b = unit(sub(s.point(uc, v + e), s.point(uc, v - e)));
      let tall = 1, raise = 0;
      if (s.terrace !== undefined) {
        const uphill = unit([b[0], 0, b[2]]);
        a = unit([a[0], 0, a[2]]);
        b = [uphill[0] * Math.sin(s.terrace), Math.cos(s.terrace), uphill[2] * Math.sin(s.terrace)];
        tall = 1 / Math.cos(s.terrace);
        raise = Math.sin(s.terrace) * 0.6;
      }
      let n = unit(cross(a, b));
      if (s.flip) n = [-n[0], -n[1], -n[2]];
      const psi = (rand() - 0.5) * 0.12;
      const cs = Math.cos(psi), sn = Math.sin(psi);
      const hw = (tw / 2) * FILL * (0.92 + 0.14 * rand());
      const hh = (rh / 2) * FILL * (0.9 + 0.16 * rand()) * tall;
      const lift = s.lift * (0.35 + rand()) + hh * raise;
      tiles.add(
        [p[0] + n[0] * lift, p[1] + n[1] * lift, p[2] + n[2] * lift],
        [(a[0] * cs + b[0] * sn) * hw, (a[1] * cs + b[1] * sn) * hw, (a[2] * cs + b[2] * sn) * hw],
        [(b[0] * cs - a[0] * sn) * hh, (b[1] * cs - a[1] * sn) * hh, (b[2] * cs - a[2] * sn) * hh],
        col, 0, 0, 0, rand(),
      );
    }
  }
}

/** A flat surface: origin, two unit axes, and the extent of each course. */
function plane(origin: V3, e1: V3, e2: V3): (u: number, v: number) => V3 {
  return (u, v) => [origin[0] + e1[0] * u + e2[0] * v, origin[1] + e1[1] * u + e2[1] * v, origin[2] + e1[2] * u + e2[2] * v];
}

// ---------------------------------------------------------------------------
// The solid ground under the tiles: one triangle soup
// ---------------------------------------------------------------------------

class Solid {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly col: number[] = [];

  vert(p: V3, n: V3, c: RGB): void {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.col.push(c[0], c[1], c[2]);
  }

  tri(a: V3, b: V3, c: V3, col: RGB): void {
    const n = cross(sub(b, a), sub(c, a));
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-12) return;
    const nn: V3 = [n[0] / l, n[1] / l, n[2] / l];
    this.vert(a, nn, col); this.vert(b, nn, col); this.vert(c, nn, col);
  }

  quad(a: V3, b: V3, c: V3, d: V3, col: RGB): void {
    this.tri(a, b, c, col);
    this.tri(a, c, d, col);
  }

  /** An upright box between two corners. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: RGB): void {
    const v: V3[] = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    this.quad(v[1], v[0], v[3], v[2], col);
    this.quad(v[4], v[5], v[6], v[7], col);
    this.quad(v[0], v[4], v[7], v[3], col);
    this.quad(v[5], v[1], v[2], v[6], col);
    this.quad(v[3], v[7], v[6], v[2], col);
    this.quad(v[0], v[1], v[5], v[4], col);
  }

  /** A spar from a to b. The radius runs from ra to rb. */
  tube(a: V3, b: V3, ra: number, rb: number, sides: number, col: RGB): void {
    const ax = unit(sub(b, a));
    const u = unit(cross(ax, Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const w = cross(ax, u);
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2, a1 = ((i + 1) / sides) * Math.PI * 2;
      const n0: V3 = [u[0] * Math.cos(a0) + w[0] * Math.sin(a0), u[1] * Math.cos(a0) + w[1] * Math.sin(a0), u[2] * Math.cos(a0) + w[2] * Math.sin(a0)];
      const n1: V3 = [u[0] * Math.cos(a1) + w[0] * Math.sin(a1), u[1] * Math.cos(a1) + w[1] * Math.sin(a1), u[2] * Math.cos(a1) + w[2] * Math.sin(a1)];
      const p00: V3 = [a[0] + n0[0] * ra, a[1] + n0[1] * ra, a[2] + n0[2] * ra];
      const p01: V3 = [a[0] + n1[0] * ra, a[1] + n1[1] * ra, a[2] + n1[2] * ra];
      const p10: V3 = [b[0] + n0[0] * rb, b[1] + n0[1] * rb, b[2] + n0[2] * rb];
      const p11: V3 = [b[0] + n1[0] * rb, b[1] + n1[1] * rb, b[2] + n1[2] * rb];
      this.vert(p00, n0, col); this.vert(p01, n1, col); this.vert(p11, n1, col);
      this.vert(p00, n0, col); this.vert(p11, n1, col); this.vert(p10, n0, col);
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
}

// ---------------------------------------------------------------------------
// The town
// ---------------------------------------------------------------------------

interface House {
  x0: number;
  w: number;
  /** z of the front wall. */
  z: number;
  depth: number;
  /** Height of the ground under the house. */
  base: number;
  h: number;
  wall: RGB;
  shutter: RGB;
  awning: RGB | null;
  windows: number;
  bays: number;
  /** Bit i is set when the shutters of window column i are closed. */
  closed: number;
}

function layRow(x0: number, x1: number, z: number, base: number, minFloors: number, rand: () => number): House[] {
  const out: House[] = [];
  let x = x0;
  let last = -1;
  while (x < x1) {
    const w = 5 + 3.6 * rand();
    const floors = minFloors + Math.floor(rand() * 2.6);
    let k = Math.floor(rand() * WALLS.length);
    if (k === last) k = (k + 1) % WALLS.length;
    last = k;
    out.push({
      x0: x, w, z, depth: 9 + 2 * rand(), base, h: 3.2 + (floors - 1) * 3.1 + 0.5 + rand() * 0.8,
      wall: WALLS[k], shutter: pick(SHUTTERS, rand), awning: rand() < 0.5 ? pick(AWNINGS, rand) : null,
      windows: Math.max(2, Math.round(w / 2.15)), bays: Math.max(2, Math.round(w / 2.6)), closed: Math.floor(rand() * 64),
    });
    x += w;
  }
  return out;
}

/** Local colour of a house front at u metres along it and v metres up it. */
function frontColour(h: House, u: number, v: number): RGB {
  if (v > h.h - 0.4) return mix3(h.wall, CREAM, 0.5);
  if (v < 3.2) {
    if (h.awning && v > 2.35) return Math.floor(u / 0.62) % 2 === 0 ? h.awning : CREAM;
    const bay = (u / h.w) * h.bays;
    const f = bay - Math.floor(bay);
    if (f > 0.2 && f < 0.8 && v < 2.5) return Math.floor(bay) % 2 === 0 ? PANE : mix3(PANE, h.shutter, 0.5);
    return mix3(h.wall, VIOLET, 0.22);
  }
  const fv = (v - 3.2) % 3.1;
  const bayW = h.w / h.windows;
  const wi = Math.min(Math.floor(u / bayW), h.windows - 1);
  const cu = Math.abs(u - (wi + 0.5) * bayW);
  if (fv > 0.7 && fv < 2.4) {
    const closed = ((h.closed >> (wi % 6)) & 1) === 1;
    if (cu < 0.46) return closed ? h.shutter : PANE;
    if (cu < 0.94 && !closed) return h.shutter;
  }
  return tint(h.wall, 0.95 + 0.1 * (v / h.h));
}

/** Builds one house. leftTop and rightTop are the roof lines of its neighbours: a party wall below them is never seen. */
function buildHouse(solid: Solid, tiles: Tiles, h: House, leftTop: number, rightTop: number, rand: () => number): void {
  const y0 = h.base, y1 = h.base + h.h;
  const x1 = h.x0 + h.w, zb = h.z - h.depth;
  solid.box(h.x0, y0 - 1.5, zb, x1, y1, h.z, under(h.wall));
  // The roof: two slopes of red tile from a ridge that runs along the street.
  const ridge = y1 + 1.0, zm = (h.z + zb) / 2;
  const eave = 0.35;
  const roofUnder = under(ROOF);
  solid.quad([h.x0, y1, h.z + eave], [x1, y1, h.z + eave], [x1, ridge, zm], [h.x0, ridge, zm], roofUnder);
  solid.quad([x1, y1, zb - eave], [h.x0, y1, zb - eave], [h.x0, ridge, zm], [x1, ridge, zm], roofUnder);
  solid.tri([h.x0, y1, h.z], [h.x0, ridge, zm], [h.x0, y1, zb], under(h.wall));
  solid.tri([x1, y1, h.z], [x1, y1, zb], [x1, ridge, zm], under(h.wall));

  const centre: V3 = [h.x0 + h.w / 2, (y0 + y1) / 2, h.z];
  const size = tileSize(centre);
  tileSurface(tiles, {
    point: plane([h.x0, y0, h.z], [1, 0, 0], [0, 1, 0]), v0: 0, v1: h.h, span: () => [0, h.w],
    colour: (u, v) => divide(frontColour(h, u, v), rand), size, lift: 0.07,
  }, rand);
  // The two side walls: the left one takes the sun, the right one is in violet shade.
  const coarse: [number, number] = [size[0] * 1.25, size[1] * 1.25];
  if (leftTop < h.h - 0.5) {
    tileSurface(tiles, {
      point: plane([h.x0, y0, zb], [0, 0, 1], [0, 1, 0]), v0: leftTop, v1: h.h, span: () => [0, h.depth],
      colour: () => divide(mix3(h.wall, [1, 0.95, 0.8], 0.25), rand), size: coarse, lift: 0.07,
    }, rand);
  }
  if (rightTop < h.h - 0.5) {
    tileSurface(tiles, {
      point: plane([x1, y0, h.z], [0, 0, -1], [0, 1, 0]), v0: rightTop, v1: h.h, span: () => [0, h.depth],
      colour: () => divide(h.wall, rand, 1), size: coarse, lift: 0.07,
    }, rand);
  }
  tileSurface(tiles, {
    point: plane([x1, y0, zb], [-1, 0, 0], [0, 1, 0]), v0: 0, v1: h.h, span: () => [0, h.w],
    colour: () => divide(h.wall, rand, 0.8), size: [size[0] * 1.6, size[1] * 1.6], lift: 0.07,
  }, rand);
  const slope = Math.hypot(ridge - y1, h.depth / 2 + eave);
  const up: V3 = unit([0, ridge - y1, zm - (h.z + eave)]);
  tileSurface(tiles, {
    point: plane([h.x0, y1, h.z + eave], [1, 0, 0], up), v0: 0, v1: slope, span: () => [0, h.w],
    colour: () => divide(ROOF, rand), size: coarse, lift: 0.07,
  }, rand);
  const upBack: V3 = unit([0, ridge - y1, zm - (zb - eave)]);
  tileSurface(tiles, {
    point: plane([x1, y1, zb - eave], [-1, 0, 0], upBack), v0: 0, v1: slope, span: () => [0, h.w],
    colour: () => divide(ROOF, rand, 0.7), size: coarse, lift: 0.07,
  }, rand);
}

interface Tower { x: number; z: number; half: number; base: number; shaft: number; belfry: number }
const TOWER: Tower = { x: 31, z: -31, half: 2.7, base: BACK_BASE, shaft: 20, belfry: 5.5 };
const TOWER_LOW = hex(0xee9a6e), TOWER_HIGH = hex(0xf7cf63);

function towerColour(u: number, v: number): RGB {
  const T = TOWER;
  if (v > T.shaft) {
    // The belfry: an arched opening on each face.
    const cu = Math.abs(u - T.half * 0.86);
    if (cu < 0.75 && v > T.shaft + 1.0 && v < T.shaft + 4.2) return PANE;
    return TOWER_HIGH;
  }
  if (Math.abs(v - T.shaft) < 0.5 || Math.abs(v - T.shaft * 0.55) < 0.35) return CREAM;
  if (Math.abs(u - T.half) < 0.4 && Math.abs(v - T.shaft * 0.78) < 0.9) return PANE;
  return mix3(TOWER_LOW, TOWER_HIGH, smoothstep(0.3, 1, v / T.shaft) * 0.5);
}

function buildTower(solid: Solid, tiles: Tiles, rand: () => number): void {
  const T = TOWER;
  const y0 = T.base, y1 = T.base + T.shaft, y2 = y1 + T.belfry;
  solid.box(T.x - T.half, y0 - 2, T.z - T.half, T.x + T.half, y1, T.z + T.half, under(TOWER_LOW));
  const b = T.half * 0.86;
  solid.box(T.x - b, y1, T.z - b, T.x + b, y2, T.z + b, under(TOWER_HIGH));
  // The cap and the iron campanile.
  const apex: V3 = [T.x, y2 + 2.2, T.z];
  const c: V3[] = [[T.x - b, y2, T.z + b], [T.x + b, y2, T.z + b], [T.x + b, y2, T.z - b], [T.x - b, y2, T.z - b]];
  for (let i = 0; i < 4; i++) solid.tri(c[i], c[(i + 1) % 4], apex, under(ROOF));
  const iron = hex(0x4a4a78);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.78;
    solid.tube([T.x + Math.cos(a) * 0.9, y2 + 1.2, T.z + Math.sin(a) * 0.9], [T.x, y2 + 5.4, T.z], 0.07, 0.05, 3, iron);
  }
  solid.tube(apex, [T.x, y2 + 6.6, T.z], 0.06, 0.04, 3, iron);
  const size = tileSize([T.x, y1, T.z + T.half]);
  const faces: Array<{ o: V3; e: V3; shade: number }> = [
    { o: [T.x - T.half, y0, T.z + T.half], e: [1, 0, 0], shade: 0 },
    { o: [T.x - T.half, y0, T.z - T.half], e: [0, 0, 1], shade: 0 },
    { o: [T.x + T.half, y0, T.z + T.half], e: [0, 0, -1], shade: 1 },
    { o: [T.x + T.half, y0, T.z - T.half], e: [-1, 0, 0], shade: 0.8 },
  ];
  for (const f of faces) {
    tileSurface(tiles, {
      point: plane(f.o, f.e, [0, 1, 0]), v0: 0, v1: T.shaft, span: () => [0, T.half * 2],
      colour: (u, v) => divide(towerColour(u, v), rand, f.shade), size, lift: 0.07,
    }, rand);
    // The belfry is a smaller box: its face starts further along and further in.
    const inset = T.half - b;
    const n = cross(f.e, [0, 1, 0]);
    const o: V3 = [f.o[0] + (f.e[0] - n[0]) * inset, f.o[1] + T.shaft, f.o[2] + (f.e[2] - n[2]) * inset];
    tileSurface(tiles, {
      point: plane(o, f.e, [0, 1, 0]), v0: 0, v1: T.belfry, span: () => [0, b * 2],
      colour: (u, v) => divide(towerColour(u, v + T.shaft), rand, f.shade), size, lift: 0.07,
    }, rand);
  }
}

/** Crest of the citadel hill behind the town. */
function hillCrest(x: number): number {
  return 46 * Math.exp(-Math.pow((x - 84) / 62, 2)) + 13 * Math.exp(-Math.pow((x - 8) / 44, 2)) + 5 * noise2(x * 0.03, 3.3);
}

const HILL_Z0 = -36, HILL_RUN = 135;

function hillPoint(x: number, s: number): V3 {
  const k = s * s * (3 - 2 * s);
  return [x, BACK_BASE + (hillCrest(x) - BACK_BASE + 3) * k + 0.5 * s, HILL_Z0 - s * HILL_RUN];
}

/** Crest of the Maures, the blue range across the gulf. */
function rangeCrest(x: number): number {
  return 44 + 95 * fbm2(x * 0.0016 + 4.2, 1.7, 3) + 28 * Math.exp(-Math.pow((x + 420) / 260, 2));
}

const RANGE_Z = -900;

function buildHills(solid: Solid, tiles: Tiles, rand: () => number): void {
  // The citadel hill.
  const X0 = -40, X1 = 230, NX = 60, NS = 10;
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NS; j++) {
      const xa = X0 + ((X1 - X0) * i) / NX, xb = X0 + ((X1 - X0) * (i + 1)) / NX;
      const col = under(mix3(HILL_NEAR[0], HILL_NEAR[1], noise2(xa * 0.05, j * 0.4)));
      solid.quad(hillPoint(xa, j / NS), hillPoint(xb, j / NS), hillPoint(xb, (j + 1) / NS), hillPoint(xa, (j + 1) / NS), col);
    }
  }
  // The tiles stand in courses of equal height, like terrace walls, so they
  // keep their size from the painter's eye.
  const onHill = (x: number, rise: number): V3 => {
    let lo = 0, hi = 1;
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      if (hillPoint(x, mid)[1] - BACK_BASE < rise) lo = mid; else hi = mid;
    }
    return hillPoint(x, (lo + hi) / 2);
  };
  tileSurface(tiles, {
    point: (u, v) => onHill(X0 + u, v), v0: 0.3, v1: 46, span: () => [0, X1 - X0], terrace: 0.72,
    colour: (u, v, p) => {
      if (v > hillPoint(p[0], 1)[1] - BACK_BASE - 0.4) return null;
      // Sunlit terraces of olive and vine, violet in the folds.
      const fold = fbm2(p[0] * 0.03, p[2] * 0.03 + 9, 3);
      const k = rand();
      if (fold < 0.42 && k < 0.6) return divide(mix3(VIOLET, HILL_NEAR[1], 0.4), rand);
      if (k < 0.07) return divide(hex(0xeea05c), rand);
      return divide(pick(HILL_NEAR, rand), rand);
    },
    size: tileSize([84, 30, -120], 1.15), lift: 0.5,
  }, rand);
  // The citadel on the crest.
  const cy = hillCrest(88);
  const wall = hex(0xeeb980);
  solid.box(70, cy - 2, -176, 106, cy + 5.5, -160, under(wall));
  tileSurface(tiles, {
    point: plane([70, cy, -160], [1, 0, 0], [0, 1, 0]), v0: 0, v1: 5.5, span: () => [0, 36],
    colour: () => divide(wall, rand), size: tileSize([88, cy, -160]), lift: 0.3,
  }, rand);

  // The Maures: a far wall of blue and violet.
  const RX0 = -1500, RX1 = 900, RN = 120;
  const rangePoint = (x: number, s: number): V3 => [x, rangeCrest(x) * s, RANGE_Z - s * 70];
  for (let i = 0; i < RN; i++) {
    const xa = RX0 + ((RX1 - RX0) * i) / RN, xb = RX0 + ((RX1 - RX0) * (i + 1)) / RN;
    const col = under(HILL_FAR[i % 2]);
    solid.quad(rangePoint(xa, 0), rangePoint(xb, 0), rangePoint(xb, 1), rangePoint(xa, 1), col);
  }
  const rangeSize = tileSize([-300, 60, RANGE_Z], 1.1);
  tileSurface(tiles, {
    point: (u, v) => rangePoint(RX0 + u, v / 190), v0: 0, v1: 190, span: () => [0, RX1 - RX0],
    colour: (u, v, p) => {
      const top = p[1] / rangeCrest(p[0]);
      // The crest takes rose light. The foot goes pale in the haze over the water.
      const k = rand();
      if (top > 0.72 && k < 0.45) return divide(hex(0xe6b8cc), rand);
      if (top < 0.25 && k < 0.5) return divide(hex(0xc2d1f2), rand);
      return divide(pick(HILL_FAR, rand), rand);
    },
    size: rangeSize, lift: 2,
  }, rand);
}

function buildQuay(solid: Solid, tiles: Tiles, x0: number, x1: number, rand: () => number): void {
  solid.box(x0, -2, FRONT_Z - 40, x1, QUAY_TOP, 0, under(QUAY_STONE));
  const size = tileSize([10, QUAY_TOP, -3]);
  tileSurface(tiles, {
    point: plane([x0, 0, 0], [1, 0, 0], [0, 1, 0]), v0: 0.05, v1: QUAY_TOP, span: () => [0, x1 - x0],
    colour: (u, v) => divide(v < 0.45 ? mix3(QUAY_STONE, VIOLET, 0.55) : mix3(QUAY_STONE, hex(0xe08a5c), 0.35), rand),
    size, lift: 0.06,
  }, rand);
  tileSurface(tiles, {
    point: plane([x0, QUAY_TOP, 0], [1, 0, 0], [0, 0, -1]), v0: 0, v1: QUAY_DEPTH, span: () => [0, x1 - x0],
    colour: (u, v, p) => {
      // Pale paving, with the blue shadows of awnings and people near the houses.
      const shade = smoothstep(4.6, 6.4, v) * 0.8 + (noise2(p[0] * 0.5, 2.0) > 0.62 ? 0.5 : 0);
      return divide(mix3(QUAY_STONE, CREAM, 0.35), rand, Math.min(shade, 1));
    },
    size: [size[0], size[1] * 2.4], lift: 0.05,
  }, rand);
  // People on the quay: each one is a dab for the body and a dab for the head.
  const CLOTHES: RGB[] = [hex(0x2f3a8c), hex(0x4a3a7a), hex(0xd9483b), hex(0xfdf3e0), hex(0x24305c), hex(0x3f7a8c), hex(0xf0a030)];
  for (let i = 0; i < 46; i++) {
    const x = x0 + 4 + rand() * (x1 - x0 - 30);
    const z = -0.8 - rand() * (QUAY_DEPTH - 1.6);
    const tall = 0.72 + 0.14 * rand();
    tiles.add([x, QUAY_TOP + tall, z], [0.27 + 0.1 * rand(), 0, 0], [(rand() - 0.5) * 0.1, tall, 0], pick(CLOTHES, rand), 1, 0, 0, rand());
    tiles.add([x, QUAY_TOP + tall * 2 + 0.17, z], [0.15, 0, 0], [0, 0.17, 0], rand() < 0.5 ? hex(0xf2c49a) : hex(0xf7e3a1), 1, 0, 0, rand());
  }
  // The mole runs out to the left, with the harbour light at its end.
  const MX0 = x0 - 62;
  solid.box(MX0, -2, -5, x0, 0.9, -1, under(QUAY_STONE));
  tileSurface(tiles, {
    point: plane([MX0, 0, -1], [1, 0, 0], [0, 1, 0]), v0: 0.05, v1: 0.9, span: () => [0, x0 - MX0],
    colour: (u, v) => divide(v < 0.4 ? mix3(QUAY_STONE, VIOLET, 0.5) : QUAY_STONE, rand), size, lift: 0.06,
  }, rand);
  tileSurface(tiles, {
    point: plane([MX0, 0.9, -1], [1, 0, 0], [0, 0, -1]), v0: 0, v1: 4, span: () => [0, x0 - MX0],
    colour: () => divide(mix3(QUAY_STONE, CREAM, 0.4), rand), size: [size[0], size[1] * 2.4], lift: 0.05,
  }, rand);
  const lx = MX0 + 3.5, lz = -3;
  const white = hex(0xfdf6e6), red = hex(0xd9483b);
  solid.tube([lx, 0.9, lz], [lx, 9.4, lz], 1.25, 0.9, 10, under(white));
  solid.tube([lx, 9.4, lz], [lx, 11.4, lz], 0.7, 0.7, 8, under(red));
  solid.tube([lx, 11.4, lz], [lx, 12.3, lz], 0.75, 0.05, 8, under(red));
  for (let j = 0; j < 12; j++) {
    const y = 1.3 + j * 0.9;
    const band = j > 9 ? red : j % 4 === 1 ? red : white;
    tiles.add([lx, y, lz], [j > 9 ? 0.85 : 1.25 - j * 0.035, 0, 0], [0, 0.38, 0], divide(band, rand), 1, 0, 0, rand());
  }
}

// ---------------------------------------------------------------------------
// Boats
// ---------------------------------------------------------------------------

type SailKind = 'none' | 'lateen' | 'square';

interface Boat {
  x: number; z: number; yaw: number;
  len: number; beam: number; free: number;
  hull: RGB; strake: RGB;
  mast: number;
  sail: SailKind;
}

const BOATS: Boat[] = [
  { x: -17, z: 19, yaw: 0.06, len: 15.5, beam: 4.4, free: 1.9, hull: hex(0x2f5a4a), strake: hex(0xf5e6c2), mast: 17.5, sail: 'lateen' },
  { x: 3.5, z: 12, yaw: -0.08, len: 13, beam: 3.9, free: 1.7, hull: hex(0x2c3f8f), strake: hex(0xd9483b), mast: 15, sail: 'square' },
  { x: 17, z: 7.5, yaw: 0.05, len: 12.5, beam: 3.7, free: 1.6, hull: hex(0x26304f), strake: hex(0xf0a030), mast: 16.5, sail: 'none' },
  { x: 29.5, z: 6.5, yaw: -0.04, len: 13.5, beam: 3.9, free: 1.7, hull: hex(0x8c2f2f), strake: hex(0xf5e6c2), mast: 18, sail: 'none' },
  { x: 43, z: 7, yaw: 0.07, len: 12, beam: 3.6, free: 1.5, hull: hex(0x2f6e7a), strake: hex(0xf7d072), mast: 15.5, sail: 'none' },
  { x: 55, z: 8, yaw: -0.05, len: 13, beam: 3.8, free: 1.6, hull: hex(0x3a3a6e), strake: hex(0xd9483b), mast: 17, sail: 'none' },
  { x: 8, z: 47, yaw: 0.5, len: 5.2, beam: 1.9, free: 0.75, hull: hex(0x2c4fa8), strake: hex(0xf5e6c2), mast: 0, sail: 'none' },
  { x: -3, z: 4.2, yaw: 0, len: 4.6, beam: 1.7, free: 0.65, hull: hex(0xd9483b), strake: hex(0xf5e6c2), mast: 0, sail: 'none' },
];

/** The boats in order from the painter's eye: the nearest one is mirrored first. */
const BOATS_NEAR_FIRST = [...BOATS].sort((a, b) => b.z - a.z);

function placer(b: Boat): (x: number, y: number, z: number) => V3 {
  const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  return (x, y, z) => [b.x + x * cs - z * sn, y, b.z + x * sn + z * cs];
}

/** Half beam and height of the rail at station s (-1 = stern, 1 = bow). */
function hullSection(b: Boat, s: number): { hb: number; top: number } {
  return {
    hb: (b.beam / 2) * Math.pow(Math.max(1 - Math.pow(Math.abs(s), 2.6), 0), 0.55) + 0.02,
    top: b.free * (1 + 0.34 * s * s),
  };
}

/** Local corners of the sail of a boat: a triangle, or four corners for a square sail. */
function sailCorners(b: Boat): Array<[number, number]> {
  if (b.sail === 'lateen') return [[b.len * 0.44, b.free + 0.9], [-b.len * 0.2, b.mast * 1.1], [-b.len * 0.47, b.free + 1.3]];
  if (b.sail === 'square') {
    const mx = b.len * 0.08;
    return [[mx - 3.3, b.free + 2.6], [mx + 3.3, b.free + 2.4], [mx + 3.6, b.mast * 0.9], [mx - 3.6, b.mast * 0.9]];
  }
  return [];
}

/** True when the local point (x, y) is inside the sail. */
function inSail(b: Boat, x: number, y: number): boolean {
  const c = sailCorners(b);
  if (c.length === 0) return false;
  let sign = 0;
  for (let i = 0; i < c.length; i++) {
    const p = c[i], q = c[(i + 1) % c.length];
    const k = (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]);
    if (k === 0) continue;
    if (sign === 0) sign = Math.sign(k);
    else if (Math.sign(k) !== sign) return false;
  }
  return true;
}

function sailColour(b: Boat, x: number, y: number, rand: () => number): RGB {
  if (b.sail === 'square') return rand() < 0.18 ? pick(SAIL_SHADE, rand) : pick(SAIL_TAN, rand);
  // The lateen sail is full of light. Its foot and its leech turn to lilac.
  const low = 1 - smoothstep(b.free, b.mast * 0.55, y);
  const aft = smoothstep(-b.len * 0.1, -b.len * 0.45, x);
  return rand() < 0.12 + 0.55 * low * (0.5 + 0.5 * aft) ? pick(SAIL_SHADE, rand) : pick(SAIL_CREAM, rand);
}

function buildBoat(solid: Solid, tiles: Tiles, b: Boat, rand: () => number): void {
  const at = placer(b);
  const N = 14;
  const hullUnder = under(b.hull);
  const ring = (i: number): V3[] => {
    const s = (i / N) * 2 - 1;
    const { hb, top } = hullSection(b, s);
    const x = (s * b.len) / 2;
    return [at(x, top, -hb), at(x, top * 0.3, -hb * 0.84), at(x, -0.4, -hb * 0.3), at(x, -0.4, hb * 0.3), at(x, top * 0.3, hb * 0.84), at(x, top, hb)];
  };
  let prev = ring(0);
  for (let i = 1; i <= N; i++) {
    const next = ring(i);
    for (let j = 0; j < 5; j++) solid.quad(prev[j], next[j], next[j + 1], prev[j + 1], hullUnder);
    solid.quad(prev[5], next[5], next[0], prev[0], under(hex(0xe6b06b)));
    prev = next;
  }
  const size = tileSize(at(0, b.free, 0));
  for (const side of [-1, 1]) {
    const girth = b.free * 1.25;
    tileSurface(tiles, {
      point: (u, v) => {
        const s = (u / b.len) * 2 - 1;
        const { hb, top } = hullSection(b, s);
        const k = clamp(v / girth, 0, 1);
        return at((s * b.len) / 2, top * k, side * hb * (0.82 + 0.18 * k));
      },
      v0: 0.04, v1: girth, span: () => [b.len * 0.02, b.len * 0.98],
      colour: (u, v) => divide(v > girth * 0.7 ? b.strake : v < girth * 0.22 ? mix3(b.hull, VIOLET, 0.5) : b.hull, rand, side < 0 ? 0.6 : 0),
      size, lift: 0.05, flip: side < 0,
    }, rand);
  }
  if (b.mast <= 0) return;
  // The mast, a little raked, and the long yard of the lateen rig.
  const mx = b.len * 0.08;
  const foot = at(mx, b.free * 0.8, 0), top = at(mx + b.mast * 0.03, b.mast, 0);
  const spar = hex(0xb0703f);
  solid.tube(foot, top, 0.2, 0.1, 6, under(spar));
  const spars: Array<[V3, V3, number]> = [[foot, top, 0.27]];
  const corners = sailCorners(b);
  let yardA: V3, yardB: V3;
  if (b.sail === 'square') {
    yardA = at(corners[3][0] - 0.5, corners[3][1], 0.25); yardB = at(corners[2][0] + 0.5, corners[2][1], 0.25);
  } else if (b.sail === 'lateen') {
    const dx = corners[1][0] - corners[0][0], dy = corners[1][1] - corners[0][1];
    yardA = at(corners[0][0] - dx * 0.06, corners[0][1] - dy * 0.06, 0.25); yardB = at(corners[1][0] + dx * 0.05, corners[1][1] + dy * 0.05, 0.25);
  } else {
    // The sail is furled along a yard that is lowered and cocked up.
    yardA = at(b.len * 0.4, b.free + 1.6, 0.25); yardB = at(-b.len * 0.36, b.mast * 0.72, 0.25);
  }
  solid.tube(yardA, yardB, 0.1, 0.07, 5, under(spar));
  spars.push([yardA, yardB, b.sail === 'none' ? 0.32 : 0.16]);
  for (const [a, c, r] of spars) {
    const len = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const n = Math.max(2, Math.round(len / (size[1] * 2.2)));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const half = (len / n / 2) * 0.86;
      const furled = b.sail === 'none' && r > 0.25;
      tiles.add(
        [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t],
        [r * (0.9 + 0.3 * rand()), 0, 0],
        [((c[0] - a[0]) / len) * half, ((c[1] - a[1]) / len) * half, ((c[2] - a[2]) / len) * half],
        furled ? divide(pick(SAIL_CREAM, rand), rand, rand() < 0.3 ? 1 : 0) : divide(pick(MAST, rand), rand), 1, 0, 0, rand(),
      );
    }
  }
  // Standing rigging.
  const rope = hex(0x5a5a8c);
  const bow = at(b.len * 0.5, b.free * 1.34, 0), stern = at(-b.len * 0.5, b.free * 1.34, 0);
  solid.tube(top, bow, 0.035, 0.035, 3, rope);
  solid.tube(top, stern, 0.035, 0.035, 3, rope);
  for (const side of [-1, 1]) {
    solid.tube(top, at(mx - 1.2, b.free, side * b.beam * 0.46), 0.03, 0.03, 3, rope);
    solid.tube(top, at(mx + 0.4, b.free, side * b.beam * 0.46), 0.03, 0.03, 3, rope);
  }
  // A pennant at the masthead.
  const flag = pick(AWNINGS, rand);
  tiles.add(at(mx + b.mast * 0.03 + 0.7, b.mast + 0.2, 0), [0.7, 0, 0], [0, 0.26, 0], flag, 0, 0, 0, rand());

  if (corners.length === 0) return;
  const pts = corners.map((c) => at(c[0], c[1], 0.32));
  const sailUnder = under(b.sail === 'square' ? SAIL_TAN[0] : SAIL_CREAM[0]);
  solid.tri(pts[0], pts[1], pts[2], sailUnder);
  if (pts.length === 4) solid.tri(pts[0], pts[2], pts[3], sailUnder);
  const ys = corners.map((c) => c[1]);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  // Extent of the sail along the boat at each height.
  const span = (y: number): [number, number] => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < corners.length; i++) {
      const p = corners[i], q = corners[(i + 1) % corners.length];
      if ((p[1] - y) * (q[1] - y) > 0 || p[1] === q[1]) continue;
      const x = p[0] + ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1]);
      lo = Math.min(lo, x); hi = Math.max(hi, x);
    }
    return lo > hi ? [0, 0] : [lo, hi];
  };
  for (const side of [-1, 1]) {
    tileSurface(tiles, {
      point: (u, v) => at(u, v, 0.32 + side * 0.06),
      v0: yMin, v1: yMax, span,
      colour: (u, v) => divide(sailColour(b, u, v, rand), rand, side < 0 ? 0.5 : 0),
      size, lift: 0.04, flip: side < 0,
    }, rand);
  }
}

// ---------------------------------------------------------------------------
// Reflections: what each point of the water mirrors toward the painter's eye
// ---------------------------------------------------------------------------

const SKY_STOPS: Array<[number, RGB]> = [
  [0, [0.99, 0.91, 0.74]], [0.11, [0.97, 0.85, 0.80]], [0.28, [0.81, 0.85, 0.94]], [0.6, [0.60, 0.75, 0.94]], [1, [0.44, 0.63, 0.90]],
];

/** Sky colour at an elevation in radians. The same ramp is in the sky shader. */
function skyAt(el: number): RGB {
  const t = clamp(el / 0.9, 0, 1);
  for (let i = 1; i < SKY_STOPS.length; i++) {
    if (t <= SKY_STOPS[i][0]) {
      const a = SKY_STOPS[i - 1], b = SKY_STOPS[i];
      return mix3(a[1], b[1], (t - a[0]) / (b[0] - a[0]));
    }
  }
  return SKY_STOPS[SKY_STOPS.length - 1][1];
}

interface Town { front: House[]; back: House[] }

interface Mirror { col: RGB; solid: boolean }

function houseAt(row: House[], x: number): House | null {
  for (const h of row) if (x >= h.x0 && x < h.x0 + h.w) return h;
  return null;
}

/** Colour that the water at (wx, wz) mirrors toward the painter's eye. */
function mirrorAt(town: Town, wx: number, wz: number, rand: () => number): Mirror {
  const dx = wx - EYE[0], dz = wz - EYE[2];
  // The mirrored ray climbs from the water. At a plane z = zp it is at (x, y).
  const hit = (zp: number): [number, number] => {
    const s = (zp - wz) / dz;
    return [wx + dx * s, EYE[1] * s];
  };
  for (const b of BOATS_NEAR_FIRST) {
    if (b.z >= wz - 0.5) continue;
    const [x, y] = hit(b.z);
    const lx = x - b.x;
    const s = (lx / b.len) * 2;
    if (Math.abs(s) < 1) {
      const { top } = hullSection(b, s);
      if (y < top) return { col: y > top * 0.68 ? b.strake : b.hull, solid: true };
    }
    if (b.mast > 0) {
      if (inSail(b, lx, y)) return { col: sailColour(b, lx, y, rand), solid: true };
      if (Math.abs(lx - b.len * 0.08) < 0.32 && y < b.mast) return { col: MAST[0], solid: true };
    }
  }
  if (wz > 0) {
    const [x, y] = hit(-2);
    const h = houseAt(town.front, x);
    if (y < QUAY_TOP && x > town.front[0].x0 - 62) return { col: mix3(QUAY_STONE, VIOLET, 0.35), solid: true };
    if (h && y < QUAY_TOP + h.h) return { col: frontColour(h, x - h.x0, y - QUAY_TOP), solid: true };
    if (h && y < QUAY_TOP + h.h + 1) return { col: ROOF, solid: true };
  }
  {
    const [x, y] = hit(BACK_Z);
    const h = houseAt(town.back, x);
    if (h && y < h.base + h.h) return { col: frontColour(h, x - h.x0, Math.max(y - h.base, 3.3)), solid: true };
    if (h && y < h.base + h.h + 1) return { col: ROOF, solid: true };
  }
  {
    const [x, y] = hit(TOWER.z + TOWER.half);
    if (Math.abs(x - TOWER.x) < TOWER.half && y < TOWER.base + TOWER.shaft + TOWER.belfry) {
      return { col: towerColour(x - TOWER.x + TOWER.half, y - TOWER.base), solid: true };
    }
  }
  {
    const [x, y] = hit(HILL_Z0 - HILL_RUN * 0.7);
    if (x > -40 && x < 230 && y < hillCrest(x) * 0.92) return { col: pick(HILL_NEAR, rand), solid: true };
  }
  {
    const [x, y] = hit(RANGE_Z);
    if (y < rangeCrest(x)) return { col: pick(HILL_FAR, rand), solid: true };
  }
  return { col: skyAt(Math.atan2(EYE[1], Math.hypot(dx, dz))), solid: false };
}

/** Where the swell breaks the mirror, the water shows its own blue. 0 to 1. */
function swellBreak(x: number, z: number): number {
  return smoothstep(0.42, 0.62, noise2(x * 0.045 + 3, z * 0.38) * 0.7 + noise2(x * 0.16, z * 1.1 + 5) * 0.3);
}

function waterLocal(dist: number, rand: () => number): RGB {
  return rand() < smoothstep(40, 150, dist) ? pick(WATER_FAR, rand) : pick(WATER_NEAR, rand);
}

/** The prismatic division of one water facet. */
function facetColour(town: Town, wx: number, wz: number, rand: () => number): RGB {
  const m = mirrorAt(town, wx, wz, rand);
  const dist = Math.hypot(wx - EYE[0], wz - EYE[2]);
  const broken = swellBreak(wx, wz);
  const r = rand();
  let c: RGB;
  if (m.solid) {
    const keep = 0.74 - 0.5 * broken;
    if (r < keep) c = mix3(m.col, [m.col[0] * m.col[0], m.col[1] * m.col[1], m.col[2] * m.col[2]], 0.2);
    else if (r < keep + 0.1) c = mix3(m.col, VIOLET, 0.5);
    else if (r < 0.94) c = waterLocal(dist, rand);
    else if (r < 0.97) c = m.col[0] > m.col[2] ? ULTRAMARINE : hex(0xf2a05c);
    else c = hex(0xfdf0e0);
  } else {
    const keep = 0.42 - 0.25 * broken;
    if (r < keep) c = m.col;
    else if (r < 0.9) c = waterLocal(dist, rand);
    else if (r < 0.95) c = hex(0x5cb394);
    else c = hex(0xf5ad7a);
  }
  const k = 0.93 + 0.14 * rand();
  return [Math.min(c[0] * k, 1), Math.min(c[1] * k, 1), Math.min(c[2] * k, 1)];
}

/** Lays the water facets on a grid of the picture plane, as the painter set them. */
function layWater(tiles: Tiles, town: Town, rand: () => number): number {
  const fwd = unit(sub(EYE_TARGET, EYE));
  const right = unit(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const before = tiles.count;
  // Picture coordinates in pixels: x to the right, y down, from the centre.
  let y = -40;
  let row = 0;
  while (y < 520) {
    const t = clamp((y + 40) / 420, 0, 1);
    const ch = TILE_H * (1.0 + 1.1 * t);
    const cw = TILE_W * (1.0 + 0.9 * t);
    const yc = y + ch / 2;
    for (let x = -1500 + (row % 2) * cw * 0.5; x < 1500; x += cw) {
      const px = x + (rand() - 0.5) * cw * 0.2, py = yc + (rand() - 0.5) * ch * 0.2;
      const dir = unit([fwd[0] * FOCAL + right[0] * px - up[0] * py, fwd[1] * FOCAL + right[1] * px - up[1] * py, fwd[2] * FOCAL + right[2] * px - up[2] * py]);
      if (dir[1] > -0.004) continue;
      const s = -EYE[1] / dir[1];
      if (s > 700) continue;
      const wx = EYE[0] + dir[0] * s, wz = EYE[2] + dir[2] * s;
      if (wz < 0.4 && wx > town.front[0].x0 - 62) continue;
      const away = unit([dir[0], 0, dir[2]]);
      const side: V3 = [-away[2], 0, away[0]];
      // The facet tilts up toward the eye, like the near face of a ripple.
      const tilt = 0.62 + (rand() - 0.5) * 0.3;
      const seen = Math.sin(tilt + Math.asin(-dir[1]));
      const hw = ((cw * s) / FOCAL / 2) * FILL * (0.92 + 0.14 * rand());
      const hh = ((ch * s) / FOCAL / 2 / seen) * FILL * (0.9 + 0.16 * rand());
      const psi = (rand() - 0.5) * 0.16;
      const v: V3 = [away[0] * Math.cos(tilt), Math.sin(tilt), away[2] * Math.cos(tilt)];
      const u: V3 = [side[0] * Math.cos(psi) + v[0] * Math.sin(psi), v[1] * Math.sin(psi), side[2] * Math.cos(psi) + v[2] * Math.sin(psi)];
      const vv: V3 = [v[0] * Math.cos(psi) - side[0] * Math.sin(psi), v[1] * Math.cos(psi), v[2] * Math.cos(psi) - side[2] * Math.sin(psi)];
      tiles.add(
        [wx, hh * (Math.sin(Math.min(tilt + 0.45, Math.PI / 2)) + 0.26) + 0.02, wz],
        [u[0] * hw, u[1] * hw, u[2] * hw], [vv[0] * hh, vv[1] * hh, vv[2] * hh],
        facetColour(town, wx, wz, rand), 2, wz * 0.33 + wx * 0.08 + rand() * 1.2, 0.16 + 0.14 * rand(), rand(),
      );
    }
    y += ch;
    row++;
  }
  return tiles.count - before;
}

const MAP_N = 256;
const MAP_X0 = EYE[0] - 150, MAP_Z0 = -10, MAP_SPAN = 300;

/** Bakes the mean colour of the water: the ground that the facets stand on. */
function bakeWaterMap(town: Town, rand: () => number): THREE.DataTexture {
  const data = new Uint8Array(MAP_N * MAP_N * 4);
  for (let j = 0; j < MAP_N; j++) {
    for (let i = 0; i < MAP_N; i++) {
      const x = MAP_X0 + ((i + 0.5) / MAP_N) * MAP_SPAN, z = MAP_Z0 + ((j + 0.5) / MAP_N) * MAP_SPAN;
      const m = mirrorAt(town, x, Math.max(z, 0.5), rand);
      const dist = Math.hypot(x - EYE[0], z - EYE[2]);
      const local = mix3(hex(0x4f5cc0), hex(0x9cb0e8), smoothstep(40, 150, dist));
      const share = (m.solid ? 0.6 : 0.35) * (1 - 0.6 * swellBreak(x, z));
      const c = mix3(local, m.col, share);
      const k = (i + j * MAP_N) * 4;
      data[k] = Math.round(clamp(c[0], 0, 1) * 255);
      data[k + 1] = Math.round(clamp(c[1], 0, 1) * 255);
      data[k + 2] = Math.round(clamp(c[2], 0, 1) * 255);
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, MAP_N, MAP_N, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const TILE_VERT = /* glsl */ `
uniform vec3 uCam;
uniform float uTime;
varying vec3 vColor;
varying vec3 vQ;
void main() {
  vec4 c0 = instanceMatrix[0];
  vec4 c1 = instanceMatrix[1];
  vec4 c2 = instanceMatrix[2];
  vec4 c3 = instanceMatrix[3];
  vec3 centre = c0.xyz;
  vec3 U = c1.xyz;
  vec3 V = c2.xyz;
  float kind = c0.w;
  float shade = 1.0;
  if (kind > 1.5) {
    // A water facet rocks about its level axis as the swell passes under it.
    vec3 n = normalize(cross(U, V));
    float a = c2.w * sin(uTime * 1.25 + c1.w) + 0.5 * c2.w * sin(uTime * 2.3 + c1.w * 1.7);
    float len = length(V);
    V = V * cos(a) + n * (len * sin(a));
    centre.y += len * 0.25 * sin(uTime * 1.25 + c1.w + 1.3);
    shade = 1.0 + 0.5 * a;
  } else if (kind > 0.5) {
    // A spar tile turns about its long axis to face the eye.
    vec3 side = cross(V, centre - uCam);
    U = side / max(length(side), 1e-5) * length(U);
  }
  vec3 p = centre + U * position.x + V * position.y;
  vQ = vec3(position.xy, c3.w);
  vColor = c3.rgb * shade;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const TILE_FRAG = /* glsl */ `
${GLSL_NOISE}
varying vec3 vColor;
varying vec3 vQ;
void main() {
  // One loaded touch of a flat brush: streaks along it, and a ridge of paint at its top edge.
  float bristle = vnoise(vec2(vQ.x * 2.4 + vQ.z * 61.0, vQ.y * 5.0 + vQ.z * 23.0));
  vec3 col = vColor * (0.95 + 0.09 * bristle) * (1.0 + 0.045 * vQ.y);
  gl_FragColor = vec4(col, 1.0);
}
`;

const SOLID_VERT = /* glsl */ `
attribute vec3 aCol;
varying vec3 vCol;
varying vec3 vN;
void main() {
  vCol = aCol;
  vN = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SOLID_FRAG = /* glsl */ `
varying vec3 vCol;
varying vec3 vN;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  // The primed ground: nearly flat, a little cooler away from the light.
  float l = dot(n, normalize(vec3(-0.45, 0.6, 0.66)));
  vec3 col = vCol * mix(vec3(0.86, 0.86, 0.95), vec3(1.0), smoothstep(-0.3, 0.6, l));
  gl_FragColor = vec4(col, 1.0);
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
${GLSL_NOISE}
uniform float uTime;
varying vec3 vDir;
vec3 skyRamp(float el) {
  float t = clamp(el / 0.9, 0.0, 1.0);
  vec3 c = mix(vec3(0.99, 0.91, 0.74), vec3(0.97, 0.85, 0.80), smoothstep(0.0, 0.11, t));
  c = mix(c, vec3(0.81, 0.85, 0.94), smoothstep(0.11, 0.28, t));
  c = mix(c, vec3(0.60, 0.75, 0.94), smoothstep(0.28, 0.6, t));
  return mix(c, vec3(0.44, 0.63, 0.90), smoothstep(0.6, 1.0, t));
}
void main() {
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float az = atan(d.x, -d.z);
  // Brick courses of tiles on the dome. Each course has a whole number of cells.
  float rowH = 0.0068;
  float row = floor(el / rowH);
  float elc = (row + 0.5) * rowH;
  float cells = max(floor(K_TAU * cos(elc) / 0.0115), 6.0);
  float q = (az / K_TAU + 0.5) * cells + 0.5 * mod(row, 2.0);
  float cell = floor(q);
  vec2 f = vec2(fract(q), fract(el / rowH));
  vec3 h = hash23(vec2(mod(cell, cells), row) + 7.0);
  float azc = ((cell + 0.5 - 0.5 * mod(row, 2.0)) / cells - 0.5) * K_TAU;
  vec3 col = skyRamp(elc);
  // Summer cloud: banks of cream and rose low in the sky.
  vec2 cp = vec2(azc * 2.2 + uTime * 0.004, elc * 9.0);
  float cloud = smoothstep(0.50, 0.66, fbm(cp + 3.0) * 0.8 + 0.25 * fbm(cp * 2.7 + 9.0)) * smoothstep(0.02, 0.12, elc) * (1.0 - smoothstep(0.42, 0.75, elc));
  vec3 cloudCol = mix(vec3(0.99, 0.95, 0.86), vec3(0.97, 0.80, 0.80), step(0.55, h.y));
  col = mix(col, cloudCol, cloud * 0.85);
  // The division: a light tint, a rose, a blue, and a yellow note.
  if (h.x < 0.16) col = mix(col, vec3(1.0, 0.98, 0.92), 0.5);
  else if (h.x < 0.30) col = mix(col, vec3(0.98, 0.74, 0.76), 0.34);
  else if (h.x < 0.46) col = mix(col, vec3(0.50, 0.66, 0.95), 0.36);
  else if (h.x < 0.54) col = mix(col, vec3(1.0, 0.90, 0.55), 0.4);
  col *= 0.95 + 0.1 * h.z;
  // The joint shows the primed canvas.
  vec2 e = abs(f - 0.5) * 2.0;
  float aa = fwidth(el / rowH) * 1.5;
  float inside = (1.0 - smoothstep(0.80 - aa, 0.80 + aa, e.x)) * (1.0 - smoothstep(0.76 - aa, 0.76 + aa, e.y));
  col = mix(mix(vec3(0.96, 0.93, 0.85), col, 0.35), col, inside);
  // Below the horizon the dome is far water.
  col = mix(vec3(0.62, 0.70, 0.90), col, smoothstep(-0.012, 0.0, el));
  gl_FragColor = vec4(col, 1.0);
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
${GLSL_NOISE}
uniform sampler2D tMap;
uniform vec4 uMapRect;
uniform float uTime;
varying vec3 vWp;
void main() {
  vec2 p = vWp.xz;
  // Under the facets the water is a flat mosaic of the same colours.
  vec2 size = vec2(1.5, 0.72);
  float row = floor(p.y / size.y);
  vec2 q = vec2(p.x / size.x + 0.5 * mod(row, 2.0), p.y / size.y);
  vec2 id = floor(q);
  vec2 f = fract(q);
  vec2 centre = vec2((id.x + 0.5 - 0.5 * mod(row, 2.0)) * size.x, (id.y + 0.5) * size.y);
  vec3 h = hash23(id + 3.0);
  vec3 col = texture2D(tMap, (centre - uMapRect.xy) * uMapRect.zw).rgb;
  if (h.x < 0.2) col = mix(col, vec3(0.24, 0.36, 0.80), 0.55);
  else if (h.x < 0.32) col = mix(col, vec3(0.45, 0.38, 0.74), 0.55);
  else if (h.x < 0.40) col = mix(col, vec3(0.99, 0.84, 0.80), 0.5);
  col *= 0.92 + 0.14 * h.y;
  col *= 1.0 + 0.05 * sin(uTime * 1.25 + centre.y * 0.33 + centre.x * 0.08);
  vec2 e = abs(f - 0.5) * 2.0;
  vec2 fw = fwidth(p / size);
  float inside = (1.0 - smoothstep(0.82 - fw.x * 1.5, 0.82 + fw.x * 1.5, e.x)) * (1.0 - smoothstep(0.76 - fw.y * 1.5, 0.76 + fw.y * 1.5, e.y));
  col = mix(vec3(0.84, 0.85, 0.94), col, inside);
  // Far cells are smaller than a pixel: there the ground is the smooth colour.
  vec3 far = texture2D(tMap, (p - uMapRect.xy) * uMapRect.zw).rgb * 0.97 + 0.02;
  col = mix(col, far, smoothstep(0.3, 0.8, max(fw.x, fw.y)));
  gl_FragColor = vec4(col, 1.0);
}
`;

const POST_FRAG = /* glsl */ `
vec3 scene(vec2 uv) { return texture2D(tScene, uv).rgb; }
float luma(vec3 c) { return dot(c, vec3(0.3, 0.6, 0.1)); }
void main() {
  float s = uRes.y / 760.0;
  vec2 px = s / uRes;
  vec2 cv = gl_FragCoord.xy / s;
  vec3 col = scene(vUv);
  // Each tile is a ridge of paint: a raking light picks out its upper edge.
  float l0 = luma(col);
  float lx = luma(scene(vUv + vec2(px.x, 0.0))) - l0;
  float ly = luma(scene(vUv + vec2(0.0, px.y))) - l0;
  float relief = clamp(lx - ly, -0.3, 0.3);
  col *= 1.0 + relief * 0.55;
  col *= 0.945 + 0.085 * canvasWeave(cv);
  // Grade: pure pigment, kept bright.
  float lum = luma(col);
  col = mix(vec3(lum), col, 1.12);
  col = mix(col, col * vec3(1.03, 1.0, 0.95), smoothstep(0.5, 0.95, lum));
  col *= vignette(vUv, 0.22);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 37.0) - 0.5) * 0.01;
  gl_FragColor = vec4(col, 1.0);
}
`;

/** One tile: a rectangle with its corners cut, so it reads as a rounded touch. */
function buildTileGeometry(): THREE.BufferGeometry {
  const c = 0.3;
  const pos = [-1 + c, -1, 0, 1 - c, -1, 0, 1, -1 + c, 0, 1, 1 - c, 0, 1 - c, 1, 0, -1 + c, 1, 0, -1, 1 - c, 0, -1, -1 + c, 0];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 7]);
  return g;
}

// ---------------------------------------------------------------------------

export function createSaintTropez(): PaintingScene {
  const scene = new THREE.Scene();
  const near = 0.3, far = 3200;
  const rand = mulberry32(1901);
  const time = { value: 0 };
  const cam = { value: new THREE.Vector3() };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(far * 0.9, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: { uTime: time }, side: THREE.BackSide, depthWrite: false }),
  );
  sky.frustumCulled = false;
  scene.add(sky);

  const town: Town = {
    front: layRow(-14, 96, FRONT_Z, QUAY_TOP, 3, rand),
    back: layRow(-6, 100, BACK_Z, BACK_BASE, 3, rand),
  };
  const solid = new Solid();
  const tiles = new Tiles();
  for (const row of [town.front, town.back]) {
    row.forEach((h, i) => buildHouse(solid, tiles, h, i > 0 ? row[i - 1].h : 0, i < row.length - 1 ? row[i + 1].h : 0, rand));
  }
  buildTower(solid, tiles, rand);
  buildHills(solid, tiles, rand);
  buildQuay(solid, tiles, town.front[0].x0, 110, rand);
  for (const b of BOATS) buildBoat(solid, tiles, b, rand);
  const landTiles = tiles.count;
  const facets = layWater(tiles, town, rand);

  const solidMesh = new THREE.Mesh(
    solid.build(),
    new THREE.ShaderMaterial({ vertexShader: SOLID_VERT, fragmentShader: SOLID_FRAG, side: THREE.DoubleSide }),
  );
  solidMesh.frustumCulled = false;
  scene.add(solidMesh);

  const waterMap = bakeWaterMap(town, rand);
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(far * 0.85, 64),
    new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: { tMap: { value: waterMap }, uMapRect: { value: new THREE.Vector4(MAP_X0, MAP_Z0, 1 / MAP_SPAN, 1 / MAP_SPAN) }, uTime: time },
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 2,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.frustumCulled = false;
  scene.add(water);

  const tileMesh = new THREE.InstancedMesh(
    buildTileGeometry(),
    new THREE.ShaderMaterial({ vertexShader: TILE_VERT, fragmentShader: TILE_FRAG, uniforms: { uCam: cam, uTime: time }, side: THREE.DoubleSide }),
    tiles.count,
  );
  (tileMesh.instanceMatrix.array as Float32Array).set(tiles.data);
  tileMesh.instanceMatrix.needsUpdate = true;
  tileMesh.frustumCulled = false;
  scene.add(tileMesh);

  return {
    scene,
    meta: {
      title: 'The Port of Saint-Tropez',
      artist: 'Paul Signac · 1901',
      technique: `A divisionist mosaic: ${Math.round(landTiles / 1000)}k instanced pigment tiles in brick courses on house fronts, roofs, hulls, sails and hills, and ${Math.round(facets / 1000)}k rocking water facets that hold the mirrored town in prismatic bars, over a pale primed ground.`,
    },
    presets: [
      { name: 'The Painting', position: EYE, target: EYE_TARGET, fov: EYE_FOV },
      { name: 'Among the Masts', position: [-33, 2.4, 33], target: [-6, 9, 2], fov: 50 },
      { name: 'Along the Quay', position: [-15, 4.4, 2.6], target: [32, 7.2, -8.5], fov: 58 },
      { name: 'Above the Port', position: [-52, 58, 92], target: [14, 4, -12], fov: 38 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near,
    far,
    flySpeed: 16,
    maxDistance: 320,
    floorAt: (x, z) => (z < 0 && x > town.front[0].x0 - 62 ? QUAY_TOP + 1.2 : 0.7),
    update(ctx: FrameContext): void {
      time.value = ctx.time;
      cam.value.copy(ctx.camera.position);
      sky.position.copy(ctx.camera.position);
    },
    dispose(): void {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
        if (o instanceof THREE.InstancedMesh) o.dispose();
      });
      waterMap.dispose();
    },
  };
}

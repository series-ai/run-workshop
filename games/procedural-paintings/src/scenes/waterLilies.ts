// Water Lilies and Japanese Footbridge — Claude Monet, 1899.
//
// The garden is painted with geometry. Each leaf mass is a cloud of flat
// colour dabs: one instanced brush-stroke card that turns toward the viewer.
// The dab colours are lit and mixed on the palette at build time, so the
// foliage is broken colour and not a shaded surface. Willow fronds, reeds,
// irises, and grass use the same stroke mesh. The bridge, banks, trunks, and
// the dark cores of the trees share one sculpted mesh. Lily pads, layered
// blossoms, and wisteria racemes are instanced meshes. The pond mirrors the
// garden through one planar reflection pass and refracts its own bed. A
// Kuwahara filter, impasto relief, and canvas finish the image.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { clamp, fbm2, hex, mix3, mulberry32, noise3, smoothstep, type RGB } from '../util';

type V3 = [number, number, number];

const SUN = new THREE.Vector3(-0.45, 0.8, 0.32).normalize();

// Bridge: a parabolic hump between the banks. The pergola carries the wisteria.
const HS = 6.6;
const DECK0 = 0.7;
const RISE = 1.75;
const RAIL = 1.0;
const PERGOLA = 2.45;
const BRIDGE_HALF_WIDTH = 0.78;

const MAT_GROUND = 0, MAT_PAINT = 1, MAT_DECK = 2, MAT_BARK = 3, MAT_CORE = 4;

function deckY(x: number): number {
  const u = x / HS;
  return DECK0 + RISE * (1 - u * u);
}

// ---------------------------------------------------------------------------
// Pond shape. The GLSL twin below must stay in step with these functions.
// ---------------------------------------------------------------------------

function shoreL(z: number): number {
  const back = 1 - smoothstep(-12, -3, z);
  return -(5.9 + 1.7 * smoothstep(3, 15, z) - 2.2 * back + 0.35 * Math.sin(z * 0.7 + 0.5) + 0.2 * Math.sin(z * 1.9));
}

function shoreR(z: number): number {
  const back = 1 - smoothstep(-12, -3, z);
  return 6.1 + 2.8 * smoothstep(1, 11, z) - 2.8 * back + 0.4 * Math.sin(z * 0.6 + 2.0) + 0.2 * Math.sin(z * 1.7 + 1.0);
}

/** Approximate distance to the shore. Positive on the water. */
function pondD(x: number, z: number): number {
  return Math.min(x - shoreL(z), shoreR(z) - x, (z + 13.5) * 0.7, (27 - z) * 0.7);
}

const POND_GLSL = /* glsl */ `
float pondD(vec2 p) {
  float z = p.y;
  float back = 1.0 - smoothstep(-12.0, -3.0, z);
  float xl = -(5.9 + 1.7 * smoothstep(3.0, 15.0, z) - 2.2 * back + 0.35 * sin(z * 0.7 + 0.5) + 0.2 * sin(z * 1.9));
  float xr = 6.1 + 2.8 * smoothstep(1.0, 11.0, z) - 2.8 * back + 0.4 * sin(z * 0.6 + 2.0) + 0.2 * sin(z * 1.7 + 1.0);
  return min(min(p.x - xl, xr - p.x), min((z + 13.5) * 0.7, (27.0 - z) * 0.7));
}
float pondDepth(float sd) { return min(0.05 + sd * 0.42, 1.5); }
`;

function groundH(x: number, z: number): number {
  const d = pondD(x, z);
  if (d > 0) return -Math.min(0.05 + d * 0.42, 1.5);
  const land = -d;
  let h = 0.03 + 0.42 * smoothstep(0, 2.0, land) + 0.5 * smoothstep(3, 16, land);
  h += 0.22 * (fbm2(x * 0.16, z * 0.16) - 0.5) * smoothstep(0.4, 3, land);
  // The banks rise to meet the two ends of the bridge.
  const ax = Math.abs(x) - 6.9;
  h += 0.62 * Math.exp(-(ax * ax) / 1.6 - (z * z) / 2.2);
  return h;
}

/** True inside the volume of the bridge and its pergola. Fronds stop here. */
function inBridge(x: number, y: number, z: number): boolean {
  return Math.abs(z) < 1.5 && Math.abs(x) < HS + 0.8 && y < deckY(x) + PERGOLA + 0.5;
}

// ---------------------------------------------------------------------------
// Palette (display-referred sRGB)
// ---------------------------------------------------------------------------

const rampOf = (...stops: number[]): RGB[] => stops.map((s) => hex(s));

const WILLOW = rampOf(0x1e4d3a, 0x3f7a45, 0x7fae4c, 0xbccf5e, 0xe6e792);
const WILLOW_DEEP = rampOf(0x14362f, 0x1f5140, 0x35744a, 0x6c9c52, 0xaec566);
const BROAD = rampOf(0x173f38, 0x2c6a47, 0x4f9150, 0x86b85a, 0xc6d97c);
const DARK = rampOf(0x12303a, 0x1c4a44, 0x2f6b52, 0x5b9358, 0x9cc06a);
const POPLAR = rampOf(0x27503c, 0x4c8548, 0x86b24e, 0xb9cc62, 0xe0df88);
const BLUE = rampOf(0x1b3d4a, 0x2d6060, 0x4c8a78, 0x7fb394, 0xb5d6ae);
const REED = rampOf(0x1f4a3c, 0x3a7048, 0x6f9a4e, 0xa9c260, 0xdde18e);
const GRASS = rampOf(0x2a5a34, 0x4c8a40, 0x86b548, 0xbfd060, 0xe8e28c);
const VINE = rampOf(0x3d7a3f, 0x6aa648, 0xa3c95a, 0xd6e285);
const AZALEA = rampOf(0xb23a5e, 0xd9577c, 0xee8fae, 0xf8c3d2, 0xfff0ee);
const IRIS_VIOLET = rampOf(0x4b3fa6, 0x6a5bd0, 0x8d7be6, 0xb3a6f4);
const IRIS_YELLOW = rampOf(0xd9ae22, 0xf0cf3e, 0xf8e478);
const VIOLET_SHADOW = hex(0x34407a);
const SKY_FLECK = hex(0x9cc7c8);
const GOLD_FLECK = hex(0xefe08a);
const BARK = hex(0x4a3b3c);
const WHITE: RGB = [1, 1, 1];

const PAD_TINTS = rampOf(0x5aa87c, 0x6dba8a, 0x84c79a, 0x4c9a78, 0x9fd0a0, 0xb9d98f, 0x77b58a, 0x66ad92);
const PAD_BRONZE = hex(0x8f8a5c);
const LILY_PINK = rampOf(0xf79cba, 0xfab4ca, 0xf486ac, 0xfdc9d6);
const LILY_ROSE = hex(0xe65c88);
const LILY_WHITE = rampOf(0xfff6ec, 0xfdf3e2);
const LILY_CREAM = hex(0xf8e6a6);
const LILY_YELLOW = hex(0xf4d35a);
const WISTERIA_PURPLE = rampOf(0x9d86e0, 0x8f78d6, 0xae9aea, 0xa58ae0, 0x8b74cf);
const WISTERIA_WHITE = hex(0xf1eeff);
const WISTERIA_PINK = hex(0xc79be0);

function ramp(stops: RGB[], t: number): RGB {
  const f = clamp(t, 0, 1) * (stops.length - 1);
  const i = Math.min(Math.floor(f), stops.length - 2);
  return mix3(stops[i], stops[i + 1], f - i);
}

function pick<T>(list: T[], rand: () => number): T {
  return list[Math.min(Math.floor(rand() * list.length), list.length - 1)];
}

// ---------------------------------------------------------------------------
// Brush strokes. One record is one instance: 16 floats, stored as the
// instance matrix of the stroke mesh.
//   column 0: root.xyz, half width
//   column 1: axis.xyz (direction * length), sway of the whole dab
//   column 2: bend.xyz (offset of the tip), extra sway at the tip
//   column 3: colour.rgb, sway phase
// ---------------------------------------------------------------------------

class Strokes {
  readonly data: number[] = [];

  add(root: V3, axis: V3, bend: V3, width: number, swayAll: number, swayTip: number, phase: number, col: RGB): void {
    this.data.push(root[0], root[1], root[2], width, axis[0], axis[1], axis[2], swayAll, bend[0], bend[1], bend[2], swayTip, col[0], col[1], col[2], phase);
  }

  get count(): number {
    return this.data.length / 16;
  }

  /** Packs the records in a random order, so a prefix is an even sample. */
  pack(rand: () => number): Float32Array {
    const n = this.count;
    const order = new Uint32Array(n);
    for (let i = 0; i < n; i++) order[i] = i;
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }
    const out = new Float32Array(n * 16);
    for (let i = 0; i < n; i++) {
      const s = order[i] * 16;
      for (let k = 0; k < 16; k++) out[i * 16 + k] = this.data[s + k];
    }
    return out;
  }
}

/** Palette position of a leaf dab: sun side, sky side, and clumps of shade. */
function leafLight(nx: number, ny: number, nz: number, px: number, py: number, pz: number, rand: () => number): number {
  const ndl = nx * SUN.x + ny * SUN.y + nz * SUN.z;
  let l = (0.5 + 0.5 * ndl) * 0.8 + 0.2 * clamp(ny * 0.5 + 0.5, 0, 1);
  l += (noise3(px * 0.45, py * 0.45, pz * 0.45) - 0.5) * 0.6 + (noise3(px * 1.7, py * 1.7, pz * 1.7) - 0.5) * 0.35 + (rand() - 0.5) * 0.42;
  return clamp(l, 0, 1);
}

/** Broken colour: most dabs sit on the ramp; a few take a violet shadow or a fleck of sky or gold. */
function leafColour(stops: RGB[], l: number, rand: () => number): RGB {
  let c = ramp(stops, l);
  const k = 1 + (rand() - 0.5) * 0.14;
  c = [c[0] * k, c[1] * k, c[2] * k];
  const r = rand();
  if (r < 0.1 && l < 0.4) c = mix3(c, VIOLET_SHADOW, 0.55);
  else if (r < 0.06) c = mix3(c, SKY_FLECK, 0.5);
  else if (r > 0.95 && l > 0.55) c = mix3(c, GOLD_FLECK, 0.55);
  return c;
}

interface Lobe { c: V3; r: V3 }

interface LobeOptions {
  stops: RGB[];
  count: number;
  dab: number;
  /** Lowest shell latitude that takes dabs, as the sine (-1 to 1). */
  yMin: number;
  /** Unit vector toward the pond. The far side of the lobe takes fewer dabs. */
  face: [number, number];
  /** How far the dab axis leans to vertical: 0 follows the shell, 1 hangs straight. */
  hang: number;
  accent?: RGB[];
  accentShare?: number;
}

function addLobe(strokes: Strokes, rand: () => number, lobe: Lobe, o: LobeOptions): void {
  const seed = rand() * 50;
  for (let i = 0; i < o.count; i++) {
    const a = rand() * Math.PI * 2;
    const y = o.yMin + (1 - o.yMin) * rand();
    const s = Math.sqrt(Math.max(1 - y * y, 0));
    const ux = Math.cos(a) * s, uz = Math.sin(a) * s;
    const facing = 0.3 + 0.7 * Math.max(ux * o.face[0] + uz * o.face[1], 0) + 0.25 * Math.max(y, 0);
    if (rand() > facing) continue;
    // A second, deeper layer fills the gaps between the outer dabs.
    const inner = rand() < 0.22;
    const lump = (inner ? 0.74 : 0.9) + 0.3 * (noise3(ux * 2.3 + seed, y * 2.3, uz * 2.3) - 0.5) + (rand() - 0.5) * 0.1;
    const px = lobe.c[0] + ux * lobe.r[0] * lump;
    const py = lobe.c[1] + y * lobe.r[1] * lump;
    const pz = lobe.c[2] + uz * lobe.r[2] * lump;
    if (inBridge(px, py, pz)) continue;
    let nx = ux / lobe.r[0], ny = y / lobe.r[1], nz = uz / lobe.r[2];
    const nl = Math.hypot(nx, ny, nz);
    nx /= nl; ny /= nl; nz /= nl;
    // Stroke axis: down the slope of the shell, pulled toward vertical.
    let tx = ny * nx, ty = -(1 - ny * ny), tz = ny * nz;
    const tl = Math.hypot(tx, ty, tz);
    if (tl < 0.05) { tx = Math.cos(a); ty = 0; tz = Math.sin(a); } else { tx /= tl; ty /= tl; tz /= tl; }
    let dx = tx * (1 - o.hang) + (rand() - 0.5) * 0.45;
    let dy = ty * (1 - o.hang) - o.hang + (rand() - 0.5) * 0.3;
    let dz = tz * (1 - o.hang) + (rand() - 0.5) * 0.45;
    const dl = Math.hypot(dx, dy, dz);
    dx /= dl; dy /= dl; dz /= dl;
    const len = o.dab * (0.7 + 0.65 * rand());
    let l = leafLight(nx, ny, nz, px, py, pz, rand);
    if (inner) l *= 0.5;
    let col = leafColour(o.stops, l, rand);
    if (o.accent && !inner && rand() < (o.accentShare ?? 0)) col = ramp(o.accent, 0.15 + 0.85 * l + (rand() - 0.5) * 0.2);
    strokes.add(
      [px - dx * len * 0.5, py - dy * len * 0.5, pz - dz * len * 0.5],
      [dx * len, dy * len, dz * len],
      [0, 0, 0],
      len * (0.19 + 0.08 * rand()),
      0.012 + 0.03 * rand(), 0.03, rand() * 6.28, col,
    );
  }
}

// ---------------------------------------------------------------------------
// The sculpted mesh: banks, bridge, trunks, tree cores
// ---------------------------------------------------------------------------

class Solid {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly mat: number[] = [];
  readonly ao: number[] = [];
  readonly col: number[] = [];

  vert(p: V3, n: V3, mat: number, ao: number, col: RGB): void {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.mat.push(mat);
    this.ao.push(ao);
    this.col.push(col[0], col[1], col[2]);
  }

  /** Flat quad a-b-c-d. The normal is turned to agree with the direction `out`. */
  quad(a: V3, b: V3, c: V3, d: V3, out: V3, mat: number, ao: number, col: RGB = WHITE): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) throw new Error('Solid.quad received a degenerate quad');
    nx /= l; ny /= l; nz /= l;
    if (nx * out[0] + ny * out[1] + nz * out[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const n: V3 = [nx, ny, nz];
    for (const p of [a, b, c, a, c, d]) this.vert(p, n, mat, ao, col);
  }

  box(cx: number, cy: number, cz: number, hx: number, hy: number, hz: number, mat: number, col: RGB = WHITE): void {
    const x0 = cx - hx, x1 = cx + hx, y0 = cy - hy, y1 = cy + hy, z0 = cz - hz, z1 = cz + hz;
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], [0, 1, 0], mat, 1, col);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], mat, 0.45, col);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], mat, 0.88, col);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [0, 0, -1], mat, 0.88, col);
    this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0], mat, 0.88, col);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], mat, 0.88, col);
  }

  /** A beam that follows the deck curve at a height offset, on the line z = zc. */
  arcBeam(x0: number, x1: number, off: number, zc: number, hw: number, hh: number, segs: number, mat: number): void {
    let prev: { top: V3[]; bot: V3[]; up: V3 } | null = null;
    for (let i = 0; i <= segs; i++) {
      const x = x0 + ((x1 - x0) * i) / segs;
      const slope = (-2 * RISE * x) / (HS * HS);
      const pl = Math.hypot(slope, 1);
      const ux = -slope / pl, uy = 1 / pl;
      const y = deckY(x) + off;
      const top: V3[] = [[x + ux * hh, y + uy * hh, zc - hw], [x + ux * hh, y + uy * hh, zc + hw]];
      const bot: V3[] = [[x - ux * hh, y - uy * hh, zc - hw], [x - ux * hh, y - uy * hh, zc + hw]];
      const up: V3 = [ux, uy, 0];
      if (prev) {
        this.quad(prev.top[0], top[0], top[1], prev.top[1], up, mat, 1);
        this.quad(prev.bot[0], bot[0], bot[1], prev.bot[1], [-up[0], -up[1], 0], mat, 0.45);
        this.quad(prev.bot[1], bot[1], top[1], prev.top[1], [0, 0, 1], mat, 0.88);
        this.quad(prev.bot[0], bot[0], top[0], prev.top[0], [0, 0, -1], mat, 0.88);
      }
      if (i === 0 || i === segs) this.quad(bot[0], bot[1], top[1], top[0], [i === 0 ? -1 : 1, 0, 0], mat, 0.88);
      prev = { top, bot, up };
    }
  }

  /** A tapered, slightly bowed trunk. */
  trunk(base: V3, top: V3, r0: number, r1: number, bow: V3, col: RGB): void {
    const SIDES = 8, SEGS = 6;
    const ring = (t: number): { p: V3[]; n: V3[] } => {
      const k = Math.sin(Math.PI * t);
      const cx = base[0] + (top[0] - base[0]) * t + bow[0] * k;
      const cy = base[1] + (top[1] - base[1]) * t;
      const cz = base[2] + (top[2] - base[2]) * t + bow[2] * k;
      const r = r0 + (r1 - r0) * t + 0.35 * r0 * Math.pow(1 - t, 6);
      const p: V3[] = [], n: V3[] = [];
      for (let j = 0; j < SIDES; j++) {
        const a = (j / SIDES) * Math.PI * 2;
        n.push([Math.cos(a), 0, Math.sin(a)]);
        p.push([cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r]);
      }
      return { p, n };
    };
    for (let i = 0; i < SEGS; i++) {
      const a = ring(i / SEGS), b = ring((i + 1) / SEGS);
      for (let j = 0; j < SIDES; j++) {
        const k = (j + 1) % SIDES;
        const quad: Array<[V3, V3]> = [[a.p[j], a.n[j]], [a.p[k], a.n[k]], [b.p[k], b.n[k]], [a.p[j], a.n[j]], [b.p[k], b.n[k]], [b.p[j], b.n[j]]];
        for (const [p, n] of quad) this.vert(p, n, MAT_BARK, 0.9, col);
      }
    }
  }

  /** The dark heart of a leaf mass. It closes the gaps between the dabs. */
  ellipsoid(c: V3, r: V3, col: RGB): void {
    const LON = 12, LAT = 8;
    const at = (i: number, j: number): [V3, V3] => {
      const th = (i / LON) * Math.PI * 2, ph = (j / LAT) * Math.PI;
      const ux = Math.sin(ph) * Math.cos(th), uz = Math.sin(ph) * Math.sin(th);
      // The underside is flattened, so no dark belly hangs below the dabs.
      const uy = Math.cos(ph) * (Math.cos(ph) < 0 ? 0.45 : 1);
      const nx = ux / r[0], ny = uy / r[1], nz = uz / r[2];
      const l = Math.hypot(nx, ny, nz);
      return [[c[0] + ux * r[0], c[1] + uy * r[1], c[2] + uz * r[2]], [nx / l, ny / l, nz / l]];
    };
    for (let j = 0; j < LAT; j++) {
      for (let i = 0; i < LON; i++) {
        const a = at(i, j), b = at(i + 1, j), cc = at(i + 1, j + 1), d = at(i, j + 1);
        for (const [p, n] of [a, b, cc, a, cc, d]) this.vert(p, n, MAT_CORE, 1, col);
      }
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aMat', new THREE.Float32BufferAttribute(this.mat, 1));
    g.setAttribute('aAO', new THREE.Float32BufferAttribute(this.ao, 1));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
}

function buildBanks(solid: Solid): void {
  const X0 = -34, X1 = 34, Z0 = -34, Z1 = 42, CELL = 0.55;
  const nx = Math.ceil((X1 - X0) / CELL), nz = Math.ceil((Z1 - Z0) / CELL);
  const h = new Float32Array((nx + 1) * (nz + 1));
  const deep = new Uint8Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = X0 + i * CELL, z = Z0 + j * CELL;
      h[i + j * (nx + 1)] = groundH(x, z);
      deep[i + j * (nx + 1)] = pondD(x, z) > 1.2 ? 1 : 0;
    }
  }
  const corner = (i: number, j: number): [V3, V3] => {
    const x = X0 + i * CELL, z = Z0 + j * CELL;
    const e = 0.3;
    const gx = (groundH(x + e, z) - groundH(x - e, z)) / (2 * e);
    const gz = (groundH(x, z + e) - groundH(x, z - e)) / (2 * e);
    const l = Math.hypot(gx, 1, gz);
    return [[x, h[i + j * (nx + 1)], z], [-gx / l, 1 / l, -gz / l]];
  };
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = i + j * (nx + 1);
      // The deep pond bed is never seen through the opaque water.
      if (deep[k] && deep[k + 1] && deep[k + nx + 1] && deep[k + nx + 2]) continue;
      const a = corner(i, j), b = corner(i + 1, j), c = corner(i + 1, j + 1), d = corner(i, j + 1);
      for (const [p, n] of [a, b, c, a, c, d]) solid.vert(p, n, MAT_GROUND, 1, WHITE);
    }
  }
}

function buildBridge(solid: Solid): void {
  const W = BRIDGE_HALF_WIDTH;
  // Deck planks and the two timber arches that carry them.
  solid.arcBeam(-HS - 0.35, HS + 0.35, -0.05, 0, W + 0.04, 0.05, 52, MAT_DECK);
  for (const s of [-1, 1]) {
    solid.arcBeam(-HS, HS, -0.27, s * (W - 0.07), 0.075, 0.17, 48, MAT_PAINT);
    solid.arcBeam(-HS, HS, RAIL, s * W, 0.062, 0.05, 48, MAT_PAINT);
    solid.arcBeam(-HS, HS, 0.52, s * W, 0.036, 0.036, 40, MAT_PAINT);
    // Pergola: an upper arch on each side and two light slats between them.
    solid.arcBeam(-HS, HS, PERGOLA, s * W, 0.05, 0.05, 44, MAT_PAINT);
    solid.arcBeam(-HS + 0.4, HS - 0.4, PERGOLA + 0.07, s * 0.27, 0.022, 0.022, 36, MAT_PAINT);
  }
  const POSTS = 14;
  for (let i = 0; i <= POSTS; i++) {
    const x = -HS + (2 * HS * i) / POSTS;
    const tall = i % 3 === 1;
    const end = i === 0 || i === POSTS;
    const y0 = deckY(x) - 0.38;
    const y1 = deckY(x) + (tall ? PERGOLA + 0.1 : RAIL + (end ? 0.2 : 0.07));
    const half = tall ? 0.056 : end ? 0.075 : 0.046;
    for (const s of [-1, 1]) {
      solid.box(x, (y0 + y1) / 2, s * W, half, (y1 - y0) / 2, half, MAT_PAINT);
      if (end) solid.box(x, y1 + 0.03, s * W, half + 0.025, 0.03, half + 0.025, MAT_PAINT);
    }
    if (tall) solid.box(x, deckY(x) + PERGOLA + 0.07, 0, 0.04, 0.035, W + 0.2, MAT_PAINT);
  }
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

interface TreeSpec {
  x: number; z: number; h: number; r: number;
  kind: 'broad' | 'poplar' | 'willow';
  stops: RGB[];
  /** Centre of the crown, when the tree leans away from its trunk. */
  cx?: number; cz?: number;
  strands?: number;
  /** Lowest height the frond tips reach above the ground or water. */
  tip?: number;
}

const TREES: TreeSpec[] = [
  // Behind the bridge: the sunlit willow over the far channel, flanked by dark masses.
  { x: 5.8, z: -11.6, cx: 1.6, cz: -10.2, h: 11, r: 5.4, kind: 'willow', stops: WILLOW, strands: 620, tip: 0.25 },
  { x: -9.0, z: -7.5, h: 12.5, r: 4.9, kind: 'broad', stops: DARK },
  { x: 9.8, z: -8.5, h: 13, r: 5.1, kind: 'broad', stops: BROAD },
  { x: -4.2, z: -17.5, h: 12, r: 4.4, kind: 'broad', stops: BROAD },
  { x: 5.0, z: -18.5, h: 12.5, r: 4.2, kind: 'broad', stops: DARK },
  // The back row.
  { x: -15, z: -19, h: 15, r: 2.3, kind: 'poplar', stops: POPLAR },
  { x: -9.5, z: -23, h: 17, r: 2.5, kind: 'poplar', stops: POPLAR },
  { x: -2, z: -26, h: 14.5, r: 5.6, kind: 'broad', stops: BLUE },
  { x: 5.5, z: -25.5, h: 16.5, r: 2.5, kind: 'poplar', stops: POPLAR },
  { x: 9.5, z: -27, h: 15.5, r: 2.3, kind: 'poplar', stops: POPLAR },
  { x: 14, z: -20, h: 14.5, r: 5.2, kind: 'broad', stops: BLUE },
  { x: 19, z: -13, h: 13, r: 4.8, kind: 'broad', stops: DARK },
  { x: -19, z: -12, h: 13.5, r: 5.0, kind: 'broad', stops: BROAD },
  // Beside the two ends of the bridge.
  { x: -11.6, z: -1.8, h: 10, r: 3.9, kind: 'broad', stops: BROAD },
  { x: 11.9, z: -2.2, h: 10.5, r: 4.1, kind: 'broad', stops: DARK },
  // The two willows that frame the view.
  { x: -10.8, z: 4.8, cx: -8.0, cz: 4.2, h: 10.5, r: 4.3, kind: 'willow', stops: WILLOW_DEEP, strands: 520, tip: 3.3 },
  { x: 11.8, z: 4.1, cx: 8.9, cz: 3.4, h: 10, r: 4.2, kind: 'willow', stops: WILLOW_DEEP, strands: 480, tip: 3.3 },
  // The long banks.
  { x: -14, z: 12.5, h: 11.5, r: 4.6, kind: 'broad', stops: BROAD },
  { x: -13.5, z: 20.5, h: 10.5, r: 4.3, kind: 'broad', stops: DARK },
  { x: -18, z: 5.5, h: 12.5, r: 4.4, kind: 'broad', stops: BLUE },
  { x: 15.5, z: 11.5, h: 12, r: 4.8, kind: 'broad', stops: DARK },
  { x: 15.5, z: 20, h: 10.5, r: 4.2, kind: 'broad', stops: BROAD },
  { x: 19.5, z: 4, h: 13, r: 4.5, kind: 'broad', stops: BLUE },
  // The near end of the pond.
  { x: -9.0, z: 31, cx: -6.5, cz: 29.2, h: 10, r: 4.6, kind: 'willow', stops: WILLOW, strands: 380, tip: 0.5 },
  { x: 1, z: 34.5, h: 12, r: 5, kind: 'broad', stops: BROAD },
  { x: 10, z: 32, h: 11, r: 4.4, kind: 'broad', stops: DARK },
  { x: -17, z: 28, h: 12, r: 4.6, kind: 'broad', stops: BLUE },
  { x: 18.5, z: 28, h: 12.5, r: 4.8, kind: 'broad', stops: BROAD },
  { x: 7, z: 39, h: 14.5, r: 2.4, kind: 'poplar', stops: POPLAR },
  { x: -5, z: 40, h: 15.5, r: 2.4, kind: 'poplar', stops: POPLAR },
];

function buildTree(spec: TreeSpec, index: number, strokes: Strokes, solid: Solid, rand: () => number): void {
  const gy = groundH(spec.x, spec.z);
  if (gy < 0) throw new Error(`Tree ${index} stands in the pond at (${spec.x}, ${spec.z})`);
  const cx = spec.cx ?? spec.x, cz = spec.cz ?? spec.z;
  const { h, r } = spec;
  // Dabs grow with distance from the pond, so far trees cost fewer strokes.
  const away = Math.hypot(cx, cz - 6);
  const dab = clamp(0.3 + away * 0.03, 0.42, 1.1);
  const fl = Math.hypot(cx, cz - 6) || 1;
  const face: [number, number] = [-cx / fl, -(cz - 6) / fl];
  const core = mix3(spec.stops[0], spec.stops[1], 0.45);
  const lobes: Lobe[] = [];
  let yMin = -0.45, hang = 0.35;

  if (spec.kind === 'poplar') {
    lobes.push({ c: [cx, gy + 0.55 * h, cz], r: [r, 0.47 * h, r] });
    hang = 0.75;
  } else if (spec.kind === 'willow') {
    lobes.push({ c: [cx, gy + 0.66 * h, cz], r: [r, 0.34 * h, r] });
    yMin = -0.1;
    hang = 0.5;
  } else {
    lobes.push({ c: [cx, gy + 0.62 * h, cz], r: [r, 0.4 * h, r] });
    // Lower boughs: the crown comes down toward the undergrowth.
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + rand() * 1.1;
      const sr = r * (0.5 + 0.2 * rand());
      lobes.push({
        c: [cx + Math.cos(a) * r * 0.62, gy + h * (0.27 + 0.3 * rand()), cz + Math.sin(a) * r * 0.62],
        r: [sr, h * (0.17 + 0.08 * rand()), sr],
      });
    }
  }

  lobes.forEach((lobe, k) => {
    const area = lobe.r[0] * lobe.r[1] + lobe.r[1] * lobe.r[2] + lobe.r[0] * lobe.r[2];
    const count = Math.round((k === 0 ? 22 : 18) * area / (dab * dab));
    addLobe(strokes, rand, lobe, { stops: spec.stops, count, dab, yMin, face, hang });
    solid.ellipsoid(lobe.c, [lobe.r[0] * 0.8, lobe.r[1] * 0.8, lobe.r[2] * 0.8], core);
  });

  const top: V3 = [cx, gy + (spec.kind === 'willow' ? 0.62 : 0.5) * h, cz];
  solid.trunk([spec.x, gy - 0.3, spec.z], top, h * 0.034, h * 0.018, [(rand() - 0.5) * 0.6, 0, (rand() - 0.5) * 0.6], mix3(BARK, spec.stops[0], 0.25));

  if (spec.kind !== 'willow') return;
  // Weeping fronds: each one is a chain of slender leaf dabs that sways as one.
  const lobe = lobes[0];
  const strands = spec.strands ?? 0;
  const tipClear = spec.tip ?? 0.4;
  for (let s = 0; s < strands; s++) {
    const a = rand() * Math.PI * 2;
    const y = -0.1 + 0.85 * Math.pow(rand(), 1.5);
    const sr = Math.sqrt(1 - y * y);
    const ux = Math.cos(a) * sr, uz = Math.sin(a) * sr;
    if (rand() > 0.35 + 0.65 * Math.max(ux * face[0] + uz * face[1], 0) + 0.2 * y) continue;
    const px = lobe.c[0] + ux * lobe.r[0] * 0.97;
    const py = lobe.c[1] + y * lobe.r[1] * 0.97;
    const pz = lobe.c[2] + uz * lobe.r[2] * 0.97;
    const hl = Math.hypot(ux, uz) || 1;
    const ox = ux / hl, oz = uz / hl;
    const floor = Math.max(groundH(px + ox * 0.5, pz + oz * 0.5), 0) + tipClear + rand() * rand() * 2.4;
    const length = Math.min(py - floor, lobe.r[1] * (1.5 + 1.3 * rand()));
    if (length < 0.8) continue;
    const fine = clamp(away / 13, 0.62, 1);
    const STEP = 0.34 * fine;
    const n = Math.floor(length / STEP);
    // Each frond keeps one place on the palette, so dark and sunlit fronds hang side by side.
    const light = clamp(0.55 * leafLight(ux, y, uz, px, py, pz, rand) + 0.75 * rand() - 0.12, 0, 1);
    const phase = rand() * 6.28 + index * 1.7;
    const amp = 0.06 + 0.04 * length;
    const lean = 0.35 + 0.4 * rand();
    for (let k = 0; k < n; k++) {
      const t = k / Math.max(n - 1, 1);
      const out = lean * (1 - Math.exp(-k * 0.35));
      const x = px + ox * out, yy = py - k * STEP, z = pz + oz * out;
      if (inBridge(x, yy - 0.45, z)) break;
      const side = (k % 2 === 0 ? 1 : -1) * (0.05 + 0.1 * rand());
      const len = (0.42 + 0.18 * rand()) * fine;
      const col = leafColour(spec.stops, clamp(light + 0.14 * t + (rand() - 0.5) * 0.3, 0, 1), rand);
      strokes.add(
        [x, yy, z],
        [-oz * side + (rand() - 0.5) * 0.06, -len, ox * side + (rand() - 0.5) * 0.06],
        [0, 0, 0],
        (0.048 + 0.032 * rand()) * fine,
        amp * Math.pow(t, 1.6), 0.02, phase, col,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Banks: reeds, irises, grass, flowering shrubs
// ---------------------------------------------------------------------------

function buildReeds(strokes: Strokes, rand: () => number): void {
  for (let z = -13; z < 26.6; z += 0.4) {
    for (const side of [-1, 1]) {
      if (Math.abs(z) < 1.6) continue;
      // The left bank in front of the bridge carries the tall mass of the painting.
      const mass = side < 0 && z > 0.5 && z < 13.5;
      if (rand() < (mass ? 0.08 : 0.38)) continue;
      const sx = side < 0 ? shoreL(z) : shoreR(z);
      const inward = -side;
      const cx = sx + inward * (rand() * 1.1 - 0.4), cz = z + (rand() - 0.5) * 0.4;
      const blades = 9 + Math.floor(rand() * (mass ? 10 : 7));
      const tall = (mass ? 1.25 : 0.8) + rand() * (mass ? 1.0 : 0.8);
      const clumpLight = 0.3 + 0.6 * rand();
      const phase = rand() * 6.28;
      for (let b = 0; b < blades; b++) {
        const bx = cx + (rand() - 0.5) * 0.5, bz = cz + (rand() - 0.5) * 0.5;
        const by = Math.max(groundH(bx, bz), -0.5);
        const len = tall * (0.6 + 0.5 * rand());
        const tilt: V3 = [(rand() - 0.5) * 0.5 + inward * 0.12, 1, (rand() - 0.5) * 0.5];
        const arch = len * (0.12 + 0.4 * rand());
        const bend: V3 = [inward * arch * (0.4 + 0.6 * rand()) + (rand() - 0.5) * arch, -0.22 * arch, (rand() - 0.5) * arch];
        const sway = 0.03 + 0.05 * len;
        const col = leafColour(REED, clamp(clumpLight + (rand() - 0.5) * 0.5, 0, 1), rand);
        strokes.add([bx, by, bz], [tilt[0] * len, len, tilt[2] * len], bend, 0.03 + 0.03 * rand(), 0, sway, phase, col);
        if (rand() > 0.16) continue;
        // An iris on the blade: three falls and three standards, as six dabs.
        const tx = bx + tilt[0] * len + bend[0], ty = by + len + bend[1], tz = bz + tilt[2] * len + bend[2];
        const petals = rand() < 0.68 ? IRIS_VIOLET : IRIS_YELLOW;
        const turn = rand() * 6.28;
        for (let p = 0; p < 3; p++) {
          const a = turn + (p / 3) * Math.PI * 2;
          strokes.add([tx, ty, tz], [Math.cos(a) * 0.13, -0.07, Math.sin(a) * 0.13], [0, -0.04, 0], 0.062, sway, 0, phase, ramp(petals, 0.2 + 0.6 * rand()));
          strokes.add([tx, ty - 0.01, tz], [Math.cos(a + 1.05) * 0.04, 0.14, Math.sin(a + 1.05) * 0.04], [0, 0, 0], 0.05, sway, 0, phase, ramp(petals, 0.5 + 0.5 * rand()));
        }
      }
    }
  }
}

function buildGrass(strokes: Strokes, rand: () => number): void {
  let placed = 0, tries = 0;
  while (placed < 3600 && tries < 60000) {
    tries++;
    const x = -17 + rand() * 34, z = -17 + rand() * 48;
    const land = -pondD(x, z);
    if (land < 0.05 || land > 6.5) continue;
    if (Math.abs(z) < 1.0 && Math.abs(x) < HS + 1.6) continue;
    const y = groundH(x, z);
    const len = 0.26 + 0.34 * rand();
    const l = clamp(0.2 + 0.9 * noise3(x * 0.3, 3.1, z * 0.3) + (rand() - 0.5) * 0.4, 0, 1);
    strokes.add(
      [x, y - 0.03, z],
      [(rand() - 0.5) * 0.3 * len, len, (rand() - 0.5) * 0.3 * len],
      [(rand() - 0.5) * 0.12, -0.02, (rand() - 0.5) * 0.12],
      0.05 + 0.05 * rand(), 0, 0.03, rand() * 6.28, leafColour(GRASS, l, rand),
    );
    placed++;
  }
  if (placed < 3600) throw new Error(`Grass placement stopped at ${placed} of 3600 dabs`);
}

const SHRUBS: Array<[number, number, number]> = [
  [-7.9, 2.0, 1.25], [8.4, 1.9, 1.3], [-8.6, -2.6, 1.4], [8.9, -2.9, 1.2],
  [10.6, 9.5, 1.5], [-9.8, 13.5, 1.4], [11.2, 16.5, 1.3], [-6.4, -6.2, 1.1],
  [6.2, -6.4, 1.2], [-9.6, 22.5, 1.3], [9.4, 24.5, 1.4],
];

function buildShrubs(strokes: Strokes, solid: Solid, rand: () => number): void {
  for (const [x, z, r] of SHRUBS) {
    const gy = groundH(x, z);
    if (gy < 0) throw new Error(`Shrub stands in the pond at (${x}, ${z})`);
    const lobe: Lobe = { c: [x, gy + r * 0.62, z], r: [r, r * 0.8, r] };
    const fl = Math.hypot(x, z - 6) || 1;
    addLobe(strokes, rand, lobe, {
      stops: BROAD, count: Math.round(260 * r * r), dab: 0.36, yMin: -0.3, face: [-x / fl, -(z - 6) / fl], hang: 0.2,
      accent: AZALEA, accentShare: 0.42,
    });
    solid.ellipsoid(lobe.c, [r * 0.78, r * 0.62, r * 0.78], mix3(BROAD[0], BROAD[1], 0.4));
  }
}

/** Undergrowth: a ring of low bushes behind the banks. It hides the trunks and closes the garden. */
function buildHedge(strokes: Strokes, solid: Solid, rand: () => number): void {
  const bush = (x: number, z: number): void => {
    if (pondD(x, z) > -1.4) return;
    if (Math.abs(z) < 2.4 && Math.abs(x) < 12) return;
    const gy = groundH(x, z);
    const r = 1.5 + rand() * 1.4, tall = 1.3 + rand() * 1.9;
    const lobe: Lobe = { c: [x, gy + tall * 0.5, z], r: [r, tall, r] };
    const fl = Math.hypot(x, z - 6) || 1;
    const stops = pick([BROAD, DARK, BLUE, BROAD, WILLOW_DEEP], rand);
    const flowering = rand() < 0.22;
    const dab = clamp(0.3 + fl * 0.022, 0.42, 0.8);
    const area = r * tall * 2 + r * r;
    addLobe(strokes, rand, lobe, {
      stops, count: Math.round(15 * area / (dab * dab)), dab, yMin: -0.2, face: [-x / fl, -(z - 6) / fl], hang: 0.45,
      accent: flowering ? AZALEA : undefined, accentShare: 0.3,
    });
    solid.ellipsoid(lobe.c, [r * 0.8, tall * 0.8, r * 0.8], mix3(stops[0], stops[1], 0.4));
  };
  for (let z = -13; z <= 26.5; z += 2.3) {
    bush(shoreL(z) - 4.0 - rand() * 3.4, z + (rand() - 0.5) * 1.6);
    bush(shoreR(z) + 4.0 + rand() * 3.4, z + (rand() - 0.5) * 1.6);
  }
  for (let x = -9; x <= 9; x += 2.4) {
    bush(x + (rand() - 0.5) * 1.4, -17.5 - rand() * 2.5);
    bush(x + (rand() - 0.5) * 1.4, 30.5 + rand() * 2.5);
  }
}

/** Wisteria foliage along the pergola. The racemes hang below it. */
function buildVine(strokes: Strokes, rand: () => number): void {
  for (let i = 0; i < 1500; i++) {
    const x = (rand() * 2 - 1) * (HS - 0.2);
    const outer = rand() < 0.68;
    const z = outer ? (rand() < 0.5 ? -1 : 1) * (BRIDGE_HALF_WIDTH + (rand() - 0.5) * 0.4) : (rand() * 2 - 1) * BRIDGE_HALF_WIDTH;
    const y = deckY(x) + PERGOLA + 0.06 + rand() * 0.34;
    const a = rand() * 6.28;
    const len = 0.13 + 0.12 * rand();
    strokes.add(
      [x, y, z],
      [Math.cos(a) * len * 0.75, -len * (0.25 + 0.6 * rand()), Math.sin(a) * len * 0.75],
      [0, -0.03, 0],
      0.05 + 0.03 * rand(), 0.008, 0.02, rand() * 6.28,
      leafColour(VINE, clamp(0.35 + 0.75 * rand(), 0, 1), rand),
    );
  }
}

// ---------------------------------------------------------------------------
// Geometry of the instanced pieces
// ---------------------------------------------------------------------------

/** One brush stroke: a blunt-ended card, like a loaded flat brush set down once. x is the signed half width, y runs 0 to 1 along it. */
function buildStrokeGeometry(): THREE.BufferGeometry {
  const profile = [0.46, 0.9, 1.0, 0.97, 0.84, 0.38];
  const pos: number[] = [];
  const idx: number[] = [];
  profile.forEach((w, i) => {
    const t = i / (profile.length - 1);
    pos.push(-w, t, 0, w, t, 0);
  });
  for (let i = 0; i < profile.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** A lily pad: a disc with the radial notch of Nymphaea and a faintly raised, wavy rim. */
function buildPadGeometry(): THREE.BufferGeometry {
  const RIM = 28;
  const NOTCH = 0.2;
  const pos: number[] = [0.06, 0, 0];
  const idx: number[] = [];
  for (let i = 0; i < RIM; i++) {
    const a = NOTCH + ((Math.PI * 2 - 2 * NOTCH) * i) / (RIM - 1);
    const lobeEnd = Math.exp(-Math.pow((a - NOTCH) / 0.3, 2)) + Math.exp(-Math.pow((Math.PI * 2 - NOTCH - a) / 0.3, 2));
    const rho = 1 + 0.035 * Math.sin(a * 5 + 1) - 0.1 * lobeEnd;
    pos.push(Math.cos(a) * rho, 0.03 + 0.012 * Math.sin(a * 7), Math.sin(a) * rho);
    if (i > 0) idx.push(0, i + 1, i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

/** A water lily: four rings of cupped, pointed petals around a tuft of stamens. Radius 1. */
function buildBlossomGeometry(): THREE.BufferGeometry {
  const rings = [
    { n: 12, elev: 0.14, len: 1.0, wide: 0.19, curl: 0.3, turn: 0 },
    { n: 10, elev: 0.5, len: 0.86, wide: 0.18, curl: 0.3, turn: 0.35 },
    { n: 7, elev: 0.95, len: 0.66, wide: 0.15, curl: 0.24, turn: 0.2 },
    { n: 5, elev: 1.26, len: 0.46, wide: 0.12, curl: 0.1, turn: 0.6 },
  ];
  const ROWS = 5;
  const pos: number[] = [];
  const petal: number[] = [];
  const idx: number[] = [];
  rings.forEach((ring, ri) => {
    for (let p = 0; p < ring.n; p++) {
      const phi = ring.turn + (p / ring.n) * Math.PI * 2;
      const rx = Math.cos(phi), rz = Math.sin(phi);
      const base = pos.length / 3;
      for (let row = 0; row < ROWS; row++) {
        const s = row / (ROWS - 1);
        const w = ring.wide * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.72)), 0.85);
        const ang = ring.elev + ring.curl * s;
        const rad = 0.07 + ring.len * s * Math.cos(ang);
        const hgt = 0.02 + ri * 0.025 + ring.len * s * Math.sin(ang);
        for (let c = -1; c <= 1; c++) {
          // The edges of the petal lift, so it cups toward the centre.
          const cup = 0.45 * w * c * c;
          pos.push(rx * rad - rz * c * w - rx * cup * Math.sin(ang), hgt + cup * Math.cos(ang), rz * rad + rx * c * w - rz * cup * Math.sin(ang));
          petal.push(s, ri / (rings.length - 1));
        }
      }
      for (let row = 0; row < ROWS - 1; row++) {
        for (let c = 0; c < 2; c++) {
          const a = base + row * 3 + c;
          idx.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
        }
      }
    }
  });
  // Stamens: a ring of short golden spikes.
  const SPIKES = 12;
  for (let i = 0; i < SPIKES; i++) {
    const a = (i / SPIKES) * Math.PI * 2;
    const b = a + (Math.PI * 2) / SPIKES * 0.62;
    const base = pos.length / 3;
    const r = i % 2 === 0 ? 0.16 : 0.09;
    pos.push(Math.cos(a) * 0.03, 0.05, Math.sin(a) * 0.03, Math.cos(b) * 0.03, 0.05, Math.sin(b) * 0.03, Math.cos((a + b) / 2) * r, 0.3 - r * 0.5, Math.sin((a + b) / 2) * r);
    petal.push(0, -1, 0, -1, 1, -1);
    idx.push(base, base + 1, base + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aPetal', new THREE.Float32BufferAttribute(petal, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A wisteria raceme: a tapered spiral of pea flowers. Each open floret is a
 * pale banner petal over a darker keel; the tip of the raceme is closed buds.
 * It hangs from the origin, length 1. aFloret = (place along the raceme, jitter, part).
 */
function buildRacemeGeometry(rand: () => number): THREE.BufferGeometry {
  const FLORETS = 64;
  const pos: number[] = [];
  const meta: number[] = [];
  const tri = (a: V3, b: V3, c: V3, t: number, jitter: number, part: number): void => {
    pos.push(...a, ...b, ...c);
    for (let k = 0; k < 3; k++) meta.push(t, jitter, part);
  };
  for (let i = 0; i < FLORETS; i++) {
    const t = (i + 0.5) / FLORETS;
    const a = i * 2.39996 + (rand() - 0.5) * 0.5;
    const radius = 0.19 * Math.pow(1 - t, 0.7) + 0.012;
    const size = 0.14 * (1 - 0.66 * t) + 0.014;
    const ox = Math.cos(a), oz = Math.sin(a);
    const at = (out: number, up: number, across: number): V3 => [ox * out - oz * across, -t + up, oz * out + ox * across];
    const jitter = rand();
    const stalk = at(radius * 0.45, 0, 0);
    // Keel: a pointed boat that droops outward.
    const kTip = at(radius + size * 0.75, -size * 0.5, 0);
    tri(stalk, at(radius + size * 0.1, -size * 0.1, size * 0.24), kTip, t, jitter, 1);
    tri(stalk, kTip, at(radius + size * 0.1, -size * 0.1, -size * 0.24), t, jitter, 1);
    if (t > 0.82) continue;
    // Wings: two small petals that spread to the sides.
    const wingRoot = at(radius + size * 0.08, size * 0.02, 0);
    tri(wingRoot, at(radius + size * 0.5, -size * 0.12, size * 0.5), at(radius + size * 0.62, size * 0.1, size * 0.16), t, jitter, 0.5);
    tri(wingRoot, at(radius + size * 0.62, size * 0.1, -size * 0.16), at(radius + size * 0.5, -size * 0.12, -size * 0.5), t, jitter, 0.5);
    // Banner: a rounded petal that stands up behind the keel.
    const rim: V3[] = [];
    for (const th of [-1.25, -0.42, 0.42, 1.25]) {
      rim.push(at(radius + size * (0.1 + 0.36 * Math.cos(th)), size * (0.1 + 0.72 * Math.cos(th)), size * 0.72 * Math.sin(th)));
    }
    for (let k = 0; k < 3; k++) tri(stalk, rim[k], rim[k + 1], t, jitter, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aFloret', new THREE.Float32BufferAttribute(meta, 3));
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
// Lily rafts
// ---------------------------------------------------------------------------

interface Raft { x: number; z: number; hx: number; hz: number; pads: number; blooms: number }

const RAFTS: Raft[] = [
  // In front of the bridge: the bands of the painting.
  { x: -1.0, z: 11.6, hx: 3.3, hz: 1.0, pads: 52, blooms: 9 },
  { x: 2.6, z: 9.6, hx: 3.0, hz: 0.85, pads: 44, blooms: 8 },
  { x: -2.0, z: 7.7, hx: 3.4, hz: 0.62, pads: 40, blooms: 8 },
  { x: 1.8, z: 5.9, hx: 3.7, hz: 0.56, pads: 38, blooms: 8 },
  { x: -1.3, z: 4.3, hx: 3.9, hz: 0.5, pads: 36, blooms: 7 },
  { x: 2.0, z: 3.0, hx: 3.5, hz: 0.42, pads: 30, blooms: 6 },
  { x: -0.5, z: 1.9, hx: 4.2, hz: 0.36, pads: 30, blooms: 6 },
  // Behind the bridge.
  { x: 0.3, z: -2.3, hx: 3.6, hz: 0.6, pads: 34, blooms: 5 },
  { x: -0.6, z: -4.9, hx: 3.0, hz: 0.75, pads: 32, blooms: 5 },
  { x: 0.4, z: -7.9, hx: 2.3, hz: 0.85, pads: 26, blooms: 4 },
  // The wide near end of the pond.
  { x: -3.6, z: 14.6, hx: 3.0, hz: 1.2, pads: 46, blooms: 7 },
  { x: 3.6, z: 16.6, hx: 3.4, hz: 1.3, pads: 52, blooms: 8 },
  { x: -1.0, z: 19.6, hx: 4.0, hz: 1.4, pads: 60, blooms: 9 },
  { x: 2.2, z: 22.8, hx: 3.0, hz: 1.2, pads: 42, blooms: 6 },
  { x: 5.8, z: 12.6, hx: 2.2, hz: 1.0, pads: 30, blooms: 5 },
  { x: -5.2, z: 17.6, hx: 2.0, hz: 1.2, pads: 30, blooms: 5 },
];

interface Pad { x: number; z: number; r: number }
interface Bloom { x: number; z: number; r: number }

function layRafts(rand: () => number): { pads: Pad[]; blooms: Bloom[] } {
  const pads: Pad[] = [];
  const blooms: Bloom[] = [];
  const fits = (x: number, z: number, r: number): boolean => {
    if (pondD(x, z) < r + 0.3) return false;
    for (const p of pads) if (Math.hypot(p.x - x, p.z - z) < (p.r + r) * 0.84) return false;
    return true;
  };
  for (const raft of RAFTS) {
    const rot = (rand() - 0.5) * 0.3;
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const first = pads.length;
    let tries = raft.pads * 40;
    while (pads.length - first < raft.pads && tries-- > 0) {
      const a = rand() * Math.PI * 2, q = Math.pow(rand(), 0.6);
      const edge = 0.82 + 0.35 * noise3(Math.cos(a) * 1.5 + raft.x, Math.sin(a) * 1.5, raft.z);
      if (q > edge) continue;
      const lx = Math.cos(a) * q * raft.hx, lz = Math.sin(a) * q * raft.hz;
      const x = raft.x + lx * cr - lz * sr, z = raft.z + lx * sr + lz * cr;
      const r = (0.17 + 0.2 * rand()) * (1.12 - 0.3 * q);
      if (fits(x, z, r)) pads.push({ x, z, r });
    }
    if (pads.length - first < raft.pads * 0.6) throw new Error(`Raft at z=${raft.z} placed only ${pads.length - first} of ${raft.pads} pads`);
    for (let b = 0; b < raft.blooms; b++) {
      const host = pads[first + Math.floor(rand() * (pads.length - first))];
      const a = rand() * 6.28;
      blooms.push({ x: host.x + Math.cos(a) * host.r * 0.8, z: host.z + Math.sin(a) * host.r * 0.8, r: 0.15 + 0.08 * rand() });
    }
  }
  // Stray pads drift between the rafts.
  let loose = 0, tries = 0;
  while (loose < 80 && tries++ < 6000) {
    const x = -8 + rand() * 17, z = -12 + rand() * 38;
    const r = 0.13 + 0.14 * rand();
    if (!fits(x, z, r)) continue;
    pads.push({ x, z, r });
    loose++;
    if (rand() < 0.12) blooms.push({ x: x + r * 0.5, z: z + r * 0.4, r: 0.13 + 0.06 * rand() });
  }
  if (loose < 80) throw new Error(`Only ${loose} of 80 stray pads fit on the pond`);
  return { pads, blooms };
}

// ---------------------------------------------------------------------------
// Shaders. Colours are display-referred; the palette is mixed directly.
// ---------------------------------------------------------------------------

const AIR = /* glsl */ `
uniform vec3 uCam;
uniform vec3 uSun;
uniform float uClip;
uniform float uTime;
vec3 haze(vec3 col, vec3 wp) {
  float f = 1.0 - exp(-length(wp - uCam) * 0.011);
  return mix(col, vec3(0.70, 0.80, 0.76), f * 0.72);
}
`;

// Leaf shadow and sun flecks, cast along the sun direction. The middle of the pond lies open.
const DAPPLE = /* glsl */ `
float leafShade(vec3 p) {
  vec2 q = p.xz - uSun.xz * (p.y / uSun.y);
  float n = fbm(q * 0.42 + vec2(uTime * 0.02, 0.0));
  float m = vnoise(q * 1.9 + vec2(0.0, uTime * 0.11));
  return smoothstep(0.40, 0.58, n * 0.78 + m * 0.24);
}
float dapple(vec3 p) {
  float d = leafShade(p);
  float open = (1.0 - smoothstep(3.5, 8.5, abs(p.x))) * smoothstep(-8.0, 0.0, p.z);
  return mix(d, 1.0, open * 0.7);
}
`;

const STROKE_VERT = /* glsl */ `
${AIR}
varying vec3 vColor;
varying vec3 vWp;
varying vec2 vQ;
void main() {
  // The instance matrix holds the stroke record, not a transform.
  vec4 c0 = instanceMatrix[0];
  vec4 c1 = instanceMatrix[1];
  vec4 c2 = instanceMatrix[2];
  vec4 c3 = instanceMatrix[3];
  float t = position.y;
  vec3 axis = c1.xyz + 2.0 * c2.xyz * t;
  vec3 p = c0.xyz + c1.xyz * t + c2.xyz * (t * t);
  float ph = c3.w;
  vec2 wind = vec2(
    sin(uTime * 0.83 + ph + c0.z * 0.21) + 0.45 * sin(uTime * 1.9 + ph * 2.3),
    cos(uTime * 0.61 + ph * 1.7 + c0.x * 0.17) + 0.35 * sin(uTime * 2.3 + ph));
  p.xz += wind * (c1.w + c2.w * t * t);
  // The card turns about its own axis to face the eye.
  vec3 side = cross(axis, p - uCam);
  side /= max(length(side), 1e-5);
  p += side * (position.x * c0.w);
  vWp = p;
  vQ = vec2(position.x, t);
  vColor = c3.rgb * (0.9 + 0.2 * t);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const STROKE_FRAG = /* glsl */ `
${GLSL_NOISE}
${AIR}
varying vec3 vColor;
varying vec3 vWp;
varying vec2 vQ;
void main() {
  if (uClip > 0.5 && vWp.y < 0.0) discard;
  // Bristle streaks along the stroke, and a loaded edge.
  float bristle = vnoise(vec2(vQ.x * 4.0 + vColor.g * 60.0, vQ.y * 1.3 + vColor.r * 40.0));
  vec3 col = vColor * (0.92 + 0.16 * bristle) * (0.95 + 0.08 * vQ.x);
  gl_FragColor = vec4(haze(col, vWp), 1.0);
}
`;

const SOLID_VERT = /* glsl */ `
attribute float aMat;
attribute float aAO;
attribute vec3 aCol;
varying vec3 vWp;
varying vec3 vN;
varying float vMat;
varying float vAO;
varying vec3 vCol;
void main() {
  vWp = position;
  vN = normal;
  vMat = aMat; vAO = aAO; vCol = aCol;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;

const SOLID_FRAG = /* glsl */ `
${GLSL_NOISE}
${AIR}
${DAPPLE}
varying vec3 vWp;
varying vec3 vN;
varying float vMat;
varying float vAO;
varying vec3 vCol;
void main() {
  if (uClip > 0.5 && vWp.y < 0.0) discard;
  vec3 n = normalize(vN);
  vec3 p = vWp;
  float ndl = max(dot(n, uSun), 0.0);
  float dap = dapple(p);
  vec3 sunCol = vec3(1.0, 0.94, 0.76);
  vec3 amb = mix(vec3(0.30, 0.42, 0.30), vec3(0.50, 0.62, 0.80), n.y * 0.5 + 0.5) * 0.62;
  vec3 albedo;
  float sunK = 1.0;
  if (vMat < 0.5) {
    // Banks: grass laid in short strokes, a sandy path to each end of the bridge.
    float g = fbm(p.xz * 0.4);
    float tuft = vnoise(p.xz * vec2(2.2, 7.0) + 3.0);
    float fleck = vnoise(p.xz * 5.0);
    albedo = mix(vec3(0.19, 0.40, 0.24), vec3(0.48, 0.64, 0.30), smoothstep(0.3, 0.7, g * 0.6 + tuft * 0.4));
    albedo = mix(albedo, vec3(0.74, 0.76, 0.42), smoothstep(0.72, 0.92, fleck) * 0.5);
    float path = (1.0 - smoothstep(0.7, 1.2, abs(p.z + 0.3 * sin(p.x * 0.4)))) * smoothstep(6.3, 7.1, abs(p.x));
    albedo = mix(albedo, vec3(0.80, 0.72, 0.56) * (0.85 + 0.3 * fleck), path);
    albedo = mix(vec3(0.15, 0.20, 0.13), albedo, smoothstep(0.0, 0.16, p.y));
    sunK = 0.85;
  } else if (vMat < 1.5) {
    // Verdigris paint: pale where the brush loaded it, blue-green in the shade.
    float streak = vnoise(vec2(p.x * 2.6 + p.y * 7.0, p.z * 11.0 + p.y * 3.0));
    float wear = vnoise(p.xy * vec2(9.0, 17.0) + p.z * 5.0);
    albedo = mix(vec3(0.30, 0.58, 0.53), vec3(0.50, 0.77, 0.67), streak);
    albedo = mix(albedo, vec3(0.80, 0.93, 0.83), smoothstep(0.6, 0.9, wear) * 0.5);
    amb = mix(amb, vec3(0.36, 0.52, 0.68) * 0.62, 0.45) * 1.25;
    // Sun flecks fall through the wisteria onto the rails.
    dap = mix(leafShade(p + vec3(0.0, 0.0, 3.0)), 1.0, 0.25);
    albedo = mix(albedo * vec3(0.82, 0.92, 1.04), albedo * vec3(1.12, 1.1, 0.94) + 0.03, dap);
  } else if (vMat < 2.5) {
    // Deck planks and stone: weathered, with a seam at each board.
    float seam = step(0.9, fract(p.x * 5.2));
    float grain = vnoise(vec2(p.x * 3.0, p.z * 22.0));
    albedo = mix(vec3(0.52, 0.55, 0.45), vec3(0.72, 0.72, 0.60), grain) * (1.0 - 0.35 * seam);
    dap = mix(leafShade(p + vec3(0.0, 0.0, 3.0)), 1.0, 0.3);
  } else if (vMat < 3.5) {
    float bark = vnoise(vec2(atan(n.x, n.z) * 5.0, p.y * 1.3));
    albedo = mix(vCol * 0.75, vCol * 1.5 + vec3(0.05, 0.04, 0.07), bark);
    albedo = mix(albedo, vec3(0.30, 0.42, 0.22), smoothstep(0.55, 0.9, vnoise(p.xy * 2.0 + p.z)) * 0.5);
    sunK = 0.7;
  } else {
    // The heart of a leaf mass, broken into touches of green, blue shadow, and olive.
    float c1 = vnoise3(p * vec3(1.7, 0.9, 1.7));
    float c2 = vnoise3(p * vec3(4.2, 1.7, 4.2) + 7.0);
    albedo = vCol * (0.7 + 0.7 * c1);
    albedo = mix(albedo, vCol * vec3(0.75, 1.0, 1.55), smoothstep(0.55, 0.68, c2) * 0.55);
    albedo = mix(albedo, vCol * 2.1 + vec3(0.03, 0.06, 0.0), smoothstep(0.30, 0.42, c1 * c2) * 0.5);
    ndl = ndl * 0.5 + 0.2;
    dap = 1.0;
    sunK = 0.55;
  }
  vec3 col = albedo * (sunCol * ndl * mix(0.12, 1.0, dap) * sunK + amb * vAO);
  gl_FragColor = vec4(haze(col, p), 1.0);
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
uniform vec3 uSun;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0));
  vec2 hd = normalize(d.xz + vec2(1e-5, 0.0));
  float h = clamp(el / 1.3, 0.0, 1.0);
  vec3 col = mix(vec3(0.90, 0.91, 0.86), vec3(0.64, 0.78, 0.91), smoothstep(0.0, 0.5, h));
  col = mix(col, vec3(0.46, 0.64, 0.87), smoothstep(0.35, 1.0, h));
  float sd = max(dot(d, uSun), 0.0);
  col += vec3(1.0, 0.92, 0.72) * (pow(sd, 20.0) * 0.28 + pow(sd, 400.0) * 0.7);
  // Summer cumulus, pink-white where it faces the sun.
  vec2 cp = d.xz / (d.y + 0.25) * 0.9 + vec2(uTime * 0.006, 0.0);
  float c1 = fbm(cp * 1.1 + 3.0);
  float c2 = fbm(cp * 3.1 + 11.0);
  float cover = smoothstep(0.50, 0.72, c1 * 0.8 + c2 * 0.26);
  vec3 cloud = mix(vec3(0.78, 0.79, 0.88), vec3(1.0, 0.97, 0.92), smoothstep(0.45, 0.85, c1 + 0.3 * sd));
  col = mix(col, cloud, cover * smoothstep(0.0, 0.12, el));
  // The far wall of the garden: a ragged tree line laid in upright dabs.
  float ridge = 0.14 + 0.10 * fbm(hd * 2.4 + 5.0) + 0.04 * vnoise(hd * 11.0);
  float ragged = 0.014 * (vnoise3(vec3(hd * 46.0, el * 40.0)) - 0.5);
  float tree = 1.0 - smoothstep(ridge - 0.008, ridge + 0.008, el + ragged);
  float mass = fbm3(vec3(hd * 5.0, el * 5.0));
  float dab = vnoise3(vec3(hd * 70.0, el * 26.0));
  vec3 fol = mix(vec3(0.15, 0.35, 0.32), vec3(0.42, 0.62, 0.40), smoothstep(0.25, 0.75, mass * 0.7 + dab * 0.4));
  fol = mix(fol, vec3(0.74, 0.81, 0.50), smoothstep(0.66, 0.95, mass * 0.5 + dab * 0.62) * smoothstep(0.0, ridge, el));
  fol = mix(fol, vec3(0.62, 0.75, 0.72), 0.3);
  col = mix(col, fol, tree);
  col = mix(vec3(0.36, 0.52, 0.32), col, smoothstep(-0.03, 0.0, el));
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
${AIR}
${DAPPLE}
${POND_GLSL}
uniform sampler2D tReflect;
uniform mat4 uTexMatrix;
varying vec3 vWp;
float ripple(vec2 p) {
  float t = uTime;
  float h = fbm(p * vec2(0.9, 1.7) + vec2(t * 0.05, t * 0.03)) + 0.35 * vnoise(p * vec2(4.0, 7.5) - vec2(t * 0.25, t * 0.1));
  // Rings spread from where an insect or a fish touched the surface.
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float cycle = t / (5.0 + fi * 1.7) + fi * 0.37;
    float f = fract(cycle);
    vec2 c = (hash23(vec2(floor(cycle), fi * 7.0 + 1.0)).xy - 0.5) * vec2(9.0, 20.0) + vec2(0.3, 7.0);
    float r = length(p - c);
    float front = f * 3.4;
    float env = exp(-pow((r - front) / 0.5, 2.0)) * (1.0 - f) * (1.0 - f);
    h += 0.5 * sin((r - front) * 10.0) * env;
  }
  return h;
}
void main() {
  vec3 toCam = uCam - vWp;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  vec2 p = vWp.xz;
  float e = 0.06 + dist * 0.004;
  float h0 = ripple(p);
  vec2 grad = vec2(ripple(p + vec2(e, 0.0)) - h0, ripple(p + vec2(0.0, e)) - h0) / e;
  float calm = 1.0 / (1.0 + dist * 0.02);
  vec3 n = normalize(vec3(-grad.x * 0.05 * calm, 1.0, -grad.y * 0.05 * calm));

  // Under the surface: the refracted bed, weed, sun caustics, and reed stems.
  float sd = pondD(p);
  float depth = pondDepth(max(sd, 0.0));
  vec3 R = refract(-V, n, 0.75);
  float travel = depth / max(-R.y, 0.25);
  vec2 bed = p + R.xz * travel;
  float lit = dapple(vWp);
  vec3 bedCol = mix(vec3(0.19, 0.21, 0.10), vec3(0.37, 0.35, 0.18), fbm(bed * 0.8 + 4.0));
  bedCol = mix(bedCol, vec3(0.06, 0.20, 0.10), smoothstep(0.45, 0.7, fbm(bed * 1.7 + 9.0)) * 0.8);
  vec2 cq = bed * 2.4 + 0.9 * vec2(vnoise(bed * 1.3 + uTime * 0.2), vnoise(bed * 1.3 + 7.0 - uTime * 0.17));
  float caustic = pow(1.0 - abs(vnoise(cq) * 2.0 - 1.0), 7.0);
  bedCol += vec3(0.50, 0.48, 0.28) * caustic * lit * 0.55;
  float stems = 0.0;
  for (int k = 1; k <= 3; k++) {
    vec2 q = mix(p, bed, float(k) / 3.0);
    stems += smoothstep(0.80, 0.9, vnoise(q * 19.0));
  }
  float reedZone = (1.0 - smoothstep(0.3, 1.6, sd)) * smoothstep(0.35, 0.6, vnoise(p * 0.7 + 2.0));
  bedCol = mix(bedCol, vec3(0.04, 0.12, 0.06), clamp(stems, 0.0, 1.0) * reedZone);
  vec3 T = exp(-travel * vec3(2.3, 1.1, 1.8));
  vec3 under = (bedCol * T + vec3(0.03, 0.10, 0.085) * (1.0 - T)) * (0.6 + 0.6 * lit);

  // The mirror: the garden above, pulled into long upright streaks by the ripples.
  vec4 clip = uTexMatrix * vec4(vWp, 1.0);
  float amp = min(0.05, 0.36 / dist);
  // Neighbouring columns of water take the image from different heights: brush streaks.
  float streak = (vnoise(vec2(p.x * 4.5, p.y * 0.3 + uTime * 0.02)) - 0.5) * 1.1 + (vnoise(vec2(p.x * 11.0 + 3.0, p.y * 0.8)) - 0.5) * 0.5;
  vec2 uv = clip.xy / clip.w + vec2(n.x * 6.0, n.z * 16.0 + streak) * amp;
  vec2 smear = vec2(0.0, amp * 0.3);
  vec3 refl = (texture2D(tReflect, clamp(uv, 0.002, 0.998)).rgb
    + texture2D(tReflect, clamp(uv + smear, 0.002, 0.998)).rgb
    + texture2D(tReflect, clamp(uv - smear, 0.002, 0.998)).rgb) / 3.0;
  float fres = clamp(0.5 + 0.5 * pow(1.0 - max(V.y, 0.0), 3.0), 0.0, 1.0);
  vec3 col = mix(under, refl, fres);
  // Flecks of sky where a ripple tilts.
  float fleck = smoothstep(0.62, 0.9, vnoise(p * vec2(1.3, 6.0) + vec2(uTime * 0.05, 0.0)) * (0.7 + 0.3 * h0));
  col += vec3(0.62, 0.74, 0.80) * fleck * 0.07 * lit;
  // The wet margin of the bank.
  col = mix(col, vec3(0.09, 0.15, 0.10), (1.0 - smoothstep(0.0, 0.3, sd)) * 0.55);
  gl_FragColor = vec4(haze(col, vWp), 1.0);
}
`;

const PAD_VERT = /* glsl */ `
${AIR}
varying vec2 vL;
varying vec3 vWp;
varying vec3 vTint;
varying float vSeed;
void main() {
  vL = position.xz;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vSeed = fract(instanceMatrix[3].x * 3.7 + instanceMatrix[3].z * 5.3);
  wp.y += 0.005 * sin(uTime * 0.9 + instanceMatrix[3].x * 1.3 + instanceMatrix[3].z * 1.7);
  vWp = wp.xyz;
  vTint = instanceColor;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const PAD_FRAG = /* glsl */ `
${GLSL_NOISE}
${AIR}
${DAPPLE}
varying vec2 vL;
varying vec3 vWp;
varying vec3 vTint;
varying float vSeed;
void main() {
  float r = length(vL);
  float a = atan(vL.y, vL.x);
  vec3 col = vTint * (0.84 + 0.26 * vnoise(vL * 3.0 + vSeed * 20.0));
  // Veins fan out from the notch; the rim takes a dark wet contour.
  float vein = pow(abs(cos(a * 6.5 + vSeed * 6.0)), 8.0) * smoothstep(0.08, 0.5, r);
  col = mix(col, col * vec3(1.14, 1.12, 0.88) + 0.03, vein * 0.3);
  float rim = smoothstep(0.80, 0.99, r);
  col = mix(col, vec3(0.09, 0.24, 0.21), rim * (0.4 + 0.3 * vnoise(vec2(a * 3.0, vSeed * 9.0))));
  float dap = dapple(vWp);
  vec3 lit = col * (vec3(1.0, 0.95, 0.78) * uSun.y * mix(0.32, 1.0, dap) + vec3(0.36, 0.46, 0.58) * 0.62);
  // The waxed leaf takes a sheen of sky at a low angle.
  vec3 V = normalize(uCam - vWp);
  lit = mix(lit, vec3(0.78, 0.89, 0.90), pow(1.0 - max(V.y, 0.0), 3.0) * 0.26 * (1.0 - rim));
  gl_FragColor = vec4(haze(lit, vWp), 1.0);
}
`;

const BLOSSOM_VERT = /* glsl */ `
${AIR}
attribute vec2 aPetal;
varying vec2 vPetal;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vTint;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  wp.y += 0.005 * sin(uTime * 0.9 + instanceMatrix[3].x * 1.3 + instanceMatrix[3].z * 1.7);
  vWp = wp.xyz;
  vN = normalize(mat3(instanceMatrix) * normal);
  vPetal = aPetal;
  vTint = instanceColor;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const BLOSSOM_FRAG = /* glsl */ `
${GLSL_NOISE}
${AIR}
${DAPPLE}
varying vec2 vPetal;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vTint;
void main() {
  float s = vPetal.x;
  float ring = vPetal.y;
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 col;
  if (ring < -0.5) {
    col = mix(vec3(0.95, 0.66, 0.14), vec3(1.0, 0.90, 0.42), s);
  } else {
    // Deep at the heart, pale at the tip; the inner rings hold more pigment.
    vec3 deep = mix(vTint, vTint * vTint, 0.7) * vec3(1.0, 0.94, 0.97);
    col = mix(deep, vTint, smoothstep(0.0, 0.5, s + (1.0 - ring) * 0.3));
    col = mix(col, vec3(1.0, 0.99, 0.96), s * s * 0.4);
    // Each petal darkens toward its root, so the rings read as layers.
    col *= 0.7 + 0.34 * smoothstep(0.0, 0.7, s);
    col = mix(col, col * vec3(1.0, 0.90, 0.93), ring * 0.35);
    col = mix(col, vec3(1.0, 0.88, 0.50), (1.0 - smoothstep(0.0, 0.3, s)) * 0.4);
  }
  float ndl = dot(n, uSun);
  float wrap = clamp(ndl * 0.5 + 0.5, 0.0, 1.0);
  float dap = dapple(vWp);
  // Petals are thin: the sun comes through them, so the shade side stays luminous and turns lilac.
  vec3 light = vec3(1.0, 0.97, 0.88) * (0.52 + 0.48 * wrap) * mix(0.72, 1.0, dap) + vec3(0.60, 0.60, 0.90) * 0.22;
  col = col * light * mix(vec3(0.88, 0.84, 1.0), vec3(1.0), wrap);
  gl_FragColor = vec4(haze(col, vWp), 1.0);
}
`;

const RACEME_VERT = /* glsl */ `
${AIR}
attribute vec3 aFloret;
varying vec3 vFloret;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vTint;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  // Each raceme swings from its stalk.
  float ph = instanceMatrix[3].x * 2.1 + instanceMatrix[3].z * 3.3;
  float swing = aFloret.x * length(instanceMatrix[1].xyz);
  wp.x += swing * 0.09 * (sin(uTime * 0.9 + ph) + 0.4 * sin(uTime * 2.1 + ph * 1.7));
  wp.z += swing * 0.07 * cos(uTime * 0.7 + ph * 1.3);
  vWp = wp.xyz;
  vN = normalize(mat3(instanceMatrix) * normal);
  vFloret = aFloret;
  vTint = instanceColor;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const RACEME_FRAG = /* glsl */ `
${GLSL_NOISE}
${AIR}
${DAPPLE}
varying vec3 vFloret;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vTint;
void main() {
  if (uClip > 0.5 && vWp.y < 0.0) discard;
  float t = vFloret.x;
  // The banner is pale, the keel holds the pigment, and the buds at the tip are deep.
  vec3 banner = mix(vTint, vec3(1.0, 0.98, 1.0), 0.5);
  vec3 keel = vTint * vec3(0.86, 0.78, 1.0);
  vec3 col = mix(banner, keel, vFloret.z);
  col = mix(col, vTint * vec3(0.76, 0.66, 0.96), smoothstep(0.5, 1.0, t + (vFloret.y - 0.5) * 0.3) * 0.8);
  col *= 0.88 + 0.24 * vFloret.y;
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float wrap = clamp(dot(n, uSun) * 0.5 + 0.5, 0.0, 1.0);
  float dap = dapple(vWp);
  vec3 light = vec3(1.0, 0.95, 0.86) * (0.5 + 0.5 * wrap) * mix(0.7, 1.0, dap) * 0.92 + vec3(0.58, 0.58, 0.88) * 0.3;
  gl_FragColor = vec4(haze(col * light, vWp), 1.0);
}
`;

const POST_FRAG = /* glsl */ `
vec3 scene(vec2 uv) { return texture2D(tScene, uv).rgb; }
float luma(vec3 c) { return dot(c, vec3(0.3, 0.6, 0.1)); }
void main() {
  float s = uRes.y / 760.0;
  vec2 px = s / uRes;
  vec2 cv = gl_FragCoord.xy / s;
  // Kuwahara: keep the calmest of four neighbourhoods, so colour gathers into flat touches.
  vec3 best = vec3(0.0);
  float bestVar = 1e9;
  for (int q = 0; q < 4; q++) {
    vec2 sgn = vec2(q == 0 || q == 2 ? 1.0 : -1.0, q < 2 ? 1.0 : -1.0);
    vec3 m = vec3(0.0); vec3 m2 = vec3(0.0);
    for (int j = 0; j < 3; j++) {
      for (int i = 0; i < 3; i++) {
        vec3 c = scene(vUv + sgn * vec2(float(i), float(j)) * px * 1.3);
        m += c; m2 += c * c;
      }
    }
    m /= 9.0; m2 = m2 / 9.0 - m * m;
    float v = m2.r + m2.g + m2.b;
    if (v < bestVar) { bestVar = v; best = m; }
  }
  vec3 col = mix(scene(vUv), best, 0.88);

  // Impasto: the paint stands in ridges that catch a raking light.
  float l0 = luma(best);
  float lx = luma(scene(vUv + vec2(px.x * 1.6, 0.0))) - l0;
  float ly = luma(scene(vUv + vec2(0.0, px.y * 1.6))) - l0;
  float relief = lx - ly;
  col *= 1.0 + relief * 1.25;
  col += vec3(1.0, 0.98, 0.90) * smoothstep(0.04, 0.16, relief) * 0.045;
  col *= 0.93 + 0.10 * canvasWeave(cv);

  // Grade: richer chroma, warm lights, blue-green darks.
  float lum = luma(col);
  col = mix(vec3(lum), col, 1.13);
  col = mix(col, col * vec3(1.04, 1.01, 0.93), smoothstep(0.35, 0.9, lum));
  col = mix(col, col * vec3(0.92, 0.98, 1.06) + vec3(0.0, 0.010, 0.018), 1.0 - smoothstep(0.0, 0.35, lum));
  col *= vignette(vUv, 0.36);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 37.0) - 0.5) * 0.012;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

export function createWaterLilies(): PaintingScene {
  const scene = new THREE.Scene();
  const near = 0.2, far = 500;
  const rand = mulberry32(1899);
  const air = { uCam: { value: new THREE.Vector3() }, uSun: { value: SUN }, uClip: { value: 0 }, uTime: { value: 0 } };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(far * 0.9, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: air, side: THREE.BackSide, depthWrite: false }),
  );
  sky.frustumCulled = false;
  scene.add(sky);

  // Everything that grows is collected first, then packed into two meshes.
  const strokes = new Strokes();
  const solid = new Solid();
  buildBanks(solid);
  buildBridge(solid);
  TREES.forEach((spec, i) => buildTree(spec, i, strokes, solid, rand));
  buildShrubs(strokes, solid, rand);
  buildHedge(strokes, solid, rand);
  buildReeds(strokes, rand);
  buildGrass(strokes, rand);
  buildVine(strokes, rand);

  const solidMesh = new THREE.Mesh(
    solid.build(),
    new THREE.ShaderMaterial({ vertexShader: SOLID_VERT, fragmentShader: SOLID_FRAG, uniforms: air, side: THREE.DoubleSide }),
  );
  solidMesh.frustumCulled = false;
  scene.add(solidMesh);

  const strokeCount = strokes.count;
  const strokeMesh = new THREE.InstancedMesh(
    buildStrokeGeometry(),
    new THREE.ShaderMaterial({ vertexShader: STROKE_VERT, fragmentShader: STROKE_FRAG, uniforms: air, side: THREE.DoubleSide }),
    strokeCount,
  );
  (strokeMesh.instanceMatrix.array as Float32Array).set(strokes.pack(rand));
  strokeMesh.instanceMatrix.needsUpdate = true;
  strokeMesh.frustumCulled = false;
  scene.add(strokeMesh);

  // Wisteria: racemes hang from the two upper arches, thickest toward the ends.
  const RACEMES = 270;
  const racemes = new THREE.InstancedMesh(
    buildRacemeGeometry(rand),
    new THREE.ShaderMaterial({ vertexShader: RACEME_VERT, fragmentShader: RACEME_FRAG, uniforms: air, side: THREE.DoubleSide }),
    RACEMES,
  );
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const colour = new THREE.Color();
  for (let i = 0; i < RACEMES; i++) {
    // Bias toward the ends, so the middle of the arch stays open.
    const u = rand() * 2 - 1;
    const x = Math.sign(u) * Math.pow(Math.abs(u), 0.58) * (HS - 0.25);
    const side = rand() < 0.56 ? 1 : -1;
    const z = side * (BRIDGE_HALF_WIDTH + (rand() - 0.5) * 0.36);
    const len = 0.3 + 0.32 * rand();
    const girth = len * (0.75 + 0.3 * rand());
    euler.set((rand() - 0.5) * 0.14, rand() * 6.28, (rand() - 0.5) * 0.14);
    quat.setFromEuler(euler);
    m4.compose(new THREE.Vector3(x, deckY(x) + PERGOLA - 0.02 + rand() * 0.12, z), quat, new THREE.Vector3(girth, len, girth));
    racemes.setMatrixAt(i, m4);
    const r = rand();
    const tint = r < 0.26 ? WISTERIA_WHITE : r < 0.38 ? WISTERIA_PINK : pick(WISTERIA_PURPLE, rand);
    racemes.setColorAt(i, colour.setRGB(tint[0], tint[1], tint[2]));
  }
  racemes.frustumCulled = false;
  scene.add(racemes);

  // Lilies.
  const { pads, blooms } = layRafts(rand);
  const padMesh = new THREE.InstancedMesh(
    buildPadGeometry(),
    new THREE.ShaderMaterial({ vertexShader: PAD_VERT, fragmentShader: PAD_FRAG, uniforms: air, side: THREE.DoubleSide }),
    pads.length,
  );
  pads.forEach((p, i) => {
    euler.set((rand() - 0.5) * 0.05, rand() * 6.28, (rand() - 0.5) * 0.05);
    quat.setFromEuler(euler);
    m4.compose(new THREE.Vector3(p.x, 0.008 + rand() * 0.024, p.z), quat, new THREE.Vector3(p.r, p.r, p.r));
    padMesh.setMatrixAt(i, m4);
    const tint = rand() < 0.05 ? PAD_BRONZE : pick(PAD_TINTS, rand);
    const k = 0.9 + 0.2 * rand();
    padMesh.setColorAt(i, colour.setRGB(tint[0] * k, tint[1] * k, tint[2] * k));
  });
  padMesh.frustumCulled = false;
  scene.add(padMesh);

  const blossomMesh = new THREE.InstancedMesh(
    buildBlossomGeometry(),
    new THREE.ShaderMaterial({ vertexShader: BLOSSOM_VERT, fragmentShader: BLOSSOM_FRAG, uniforms: air, side: THREE.DoubleSide }),
    blooms.length,
  );
  blooms.forEach((b, i) => {
    euler.set((rand() - 0.5) * 0.16, rand() * 6.28, (rand() - 0.5) * 0.16);
    quat.setFromEuler(euler);
    m4.compose(new THREE.Vector3(b.x, 0.035, b.z), quat, new THREE.Vector3(b.r, b.r * (0.85 + 0.3 * rand()), b.r));
    blossomMesh.setMatrixAt(i, m4);
    const r = rand();
    const tint = r < 0.42 ? pick(LILY_PINK, rand) : r < 0.5 ? LILY_ROSE : r < 0.86 ? pick(LILY_WHITE, rand) : r < 0.94 ? LILY_CREAM : LILY_YELLOW;
    blossomMesh.setColorAt(i, colour.setRGB(tint[0], tint[1], tint[2]));
  });
  blossomMesh.frustumCulled = false;
  scene.add(blossomMesh);

  // Water: one plane over the pond. The banks cover its edges.
  const reflectTarget = new THREE.WebGLRenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
  const texMatrix = new THREE.Matrix4();
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 46),
    new THREE.ShaderMaterial({
      vertexShader: WATER_VERT,
      fragmentShader: WATER_FRAG,
      uniforms: { ...air, tReflect: { value: reflectTarget.texture }, uTexMatrix: { value: texMatrix } },
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0.5, 0, 6.5);
  water.frustumCulled = false;
  scene.add(water);

  const mirrorCam = new THREE.PerspectiveCamera();
  const MIRROR = new THREE.Matrix4().makeScale(1, -1, 1);
  const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  const scratch = new THREE.Matrix4();
  const unit = new THREE.Vector3();
  // The mirror image is rippled and half size, so it draws a thinner sample of the strokes.
  const reflectStrokes = Math.floor(strokeCount * 0.6);

  return {
    scene,
    meta: {
      title: 'Water Lilies and Japanese Footbridge',
      artist: 'Claude Monet · 1899',
      technique: `Foliage painted as ${Math.round(strokeCount / 1000)}k instanced colour dabs with palette-mixed light, instanced notched pads, four-ring blossoms and wisteria racemes, planar reflection over a refracted pond bed, Kuwahara impasto.`,
    },
    presets: [
      { name: 'The Painting', position: [0, 1.7, 15], target: [0, 1.9, 0], fov: 28 },
      { name: 'Among the Lilies', position: [3.0, 0.5, 8.3], target: [-1.2, 1.7, 0], fov: 52 },
      { name: 'On the Bridge', position: [-1.9, 3.85, -0.36], target: [1.3, 3.3, 11], fov: 66 },
      { name: 'Above the Pond', position: [2.5, 13.5, 23], target: [0, 0.8, 2], fov: 40 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near,
    far,
    flySpeed: 4,
    maxDistance: 70,
    floorAt: (x, z) => Math.max(groundH(x, z), 0) + 0.3,
    update(ctx: FrameContext): void {
      air.uTime.value = ctx.time;
      sky.position.copy(ctx.camera.position);
      air.uCam.value.copy(ctx.camera.position);
    },
    prePass(ctx: FrameContext): void {
      const w = Math.max(Math.floor(ctx.width / 2), 2), h = Math.max(Math.floor(ctx.height / 2), 2);
      if (reflectTarget.width !== w || reflectTarget.height !== h) reflectTarget.setSize(w, h);
      ctx.camera.updateMatrixWorld();
      // Mirror the camera in the water plane. The extra local flip keeps it right-handed.
      scratch.copy(MIRROR).multiply(ctx.camera.matrixWorld).multiply(MIRROR);
      scratch.decompose(mirrorCam.position, mirrorCam.quaternion, unit);
      mirrorCam.projectionMatrix.copy(ctx.camera.projectionMatrix);
      mirrorCam.projectionMatrixInverse.copy(ctx.camera.projectionMatrixInverse);
      mirrorCam.updateMatrixWorld();
      texMatrix.copy(BIAS).multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse);
      water.visible = false;
      padMesh.visible = false;
      blossomMesh.visible = false;
      strokeMesh.count = reflectStrokes;
      air.uClip.value = 1;
      sky.position.copy(mirrorCam.position);
      air.uCam.value.copy(mirrorCam.position);
      ctx.renderer.setRenderTarget(reflectTarget);
      ctx.renderer.clear();
      ctx.renderer.render(scene, mirrorCam);
      water.visible = true;
      padMesh.visible = true;
      blossomMesh.visible = true;
      strokeMesh.count = strokeCount;
      air.uClip.value = 0;
      sky.position.copy(ctx.camera.position);
      air.uCam.value.copy(ctx.camera.position);
    },
    dispose(): void {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      reflectTarget.dispose();
    },
  };
}

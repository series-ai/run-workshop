// A Sunday Afternoon on the Island of La Grande Jatte — Georges Seurat, 1884.
//
// The island is a cloud of pigment dots in space. The lawn, the river, and the
// far bank are laid from the painter's eye: one dot for each small cell of the
// picture plane, set where its ray meets the ground. The figures are sculpted
// as distance fields, meshed once, and their surfaces are sown with dots. The
// trees are shells of dots about dark cores. Every dot has the size that gives
// it one size on the canvas from the painter's eye, so the cloud closes into
// the frieze there and opens into separate points of colour everywhere else.
//
// The colour of a dot is never the local colour. It is one pigment from the
// division of that colour: the local hue, the orange of the sun, the blue of
// the shade, and the complement that the eye mixes back at a distance.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { meshSdf } from '../sdf';
import { clamp, hex, mix3, mulberry32, noise2, noise3, smoothstep, type RGB } from '../util';

type V3 = [number, number, number];

/** The painter's eye. Dot sizes are measured from it. */
const EYE: V3 = [0, 1.65, 10];
const EYE_TARGET: V3 = [0, 0.1, 0];
const EYE_FOV = 32;
/** Focal length in pixels for a picture 760 pixels high. */
const FOCAL = 380 / Math.tan((EYE_FOV * Math.PI) / 360);
/** Radius of one dot on the canvas, in pixels. */
const DOT_PX = 1.6;

/** Direction to the sun: high, from the left, a little behind the painter. */
const SUN: V3 = (() => {
  const l = Math.hypot(-0.5, 0.78, 0.38);
  return [-0.5 / l, 0.78 / l, 0.38 / l] as V3;
})();
/** Ground direction of a cast shadow, and its length for each metre of height. */
const SHADOW_DIR: [number, number] = [0.796, -0.605];
const SHADOW_LEN = 0.805;

// ---------------------------------------------------------------------------
// Palettes: each surface has a set of pigments for the light and for the shade.
// A pair holds a pigment and its share.
// ---------------------------------------------------------------------------

type Mix = Array<[RGB, number]>;

const LAWN_SUN: Mix = [
  [hex(0xc6ca66), 0.40], [hex(0xa6c468), 0.22], [hex(0xeede82), 0.14], [hex(0xeeaf58), 0.09], [hex(0x9cc9a0), 0.07], [hex(0x58a468), 0.05], [hex(0xf5efb8), 0.03],
];
const LAWN_SHADE: Mix = [
  [hex(0x2f6b48), 0.33], [hex(0x2a6468), 0.19], [hex(0x3a4c96), 0.15], [hex(0x6c4c8e), 0.08], [hex(0x8c9a4c), 0.11], [hex(0xcc7f58), 0.05], [hex(0x3f8c5c), 0.09],
];
const WATER: Mix = [
  [hex(0xb8d4ea), 0.33], [hex(0xf2f1e4), 0.21], [hex(0x82aedb), 0.21], [hex(0xb3ade0), 0.10], [hex(0xf5c79a), 0.07], [hex(0x8cb89a), 0.08],
];
const WATER_BANK: Mix = [
  [hex(0x6c9a8c), 0.3], [hex(0x82aedb), 0.25], [hex(0x4c7a8c), 0.18], [hex(0xb8d4ea), 0.15], [hex(0xd9c48c), 0.12],
];
const LEAF_SUN: Mix = [
  [hex(0x8ca83f), 0.34], [hex(0xbfc65a), 0.26], [hex(0x5c8c3f), 0.18], [hex(0xe6c95c), 0.10], [hex(0xe69a4c), 0.06], [hex(0x7fb88c), 0.06],
];
const LEAF_SHADE: Mix = [
  [hex(0x214c3d), 0.36], [hex(0x26406c), 0.20], [hex(0x2f5c33), 0.20], [hex(0x4c3a73), 0.09], [hex(0x5c7a3a), 0.10], [hex(0x9a5c40), 0.05],
];
const BARK_SUN: Mix = [[hex(0xb38c73), 0.4], [hex(0xd9a873), 0.25], [hex(0x8c6c73), 0.2], [hex(0xe6c48c), 0.15]];
const BARK_SHADE: Mix = [[hex(0x473347), 0.4], [hex(0x33336c), 0.25], [hex(0x5c3a40), 0.2], [hex(0x8c5c40), 0.15]];
const SAND: Mix = [[hex(0xe0cf96), 0.5], [hex(0xc9b87f), 0.25], [hex(0xf2e6bf), 0.15], [hex(0xd9a873), 0.1]];

const ORANGE = hex(0xf2a54a);
const GOLD = hex(0xf7e07a);
const SKY_BLUE = hex(0x9cc3e6);
const ULTRAMARINE = hex(0x3a4ca6);
const VIOLET = hex(0x7a4c96);

const SKIN = hex(0xedc0a0);
const NAVY = hex(0x23213d);
const PLUM = hex(0x3b2a52);
const GREY_VIOLET = hex(0x6a6480);
const WHITE = hex(0xf5f0e3);
const RED = hex(0xd9573a);
const STRAW = hex(0xe6c97a);
const BROWN = hex(0x7a5540);

function pickMix(m: Mix, rand: () => number): RGB {
  let r = rand();
  for (const [c, w] of m) {
    if (r < w) return c;
    r -= w;
  }
  return m[m.length - 1][0];
}

/** Mean colour of a palette: the tone of the ground that the dots lie on. */
function meanMix(m: Mix): RGB {
  const out: RGB = [0, 0, 0];
  let total = 0;
  for (const [c, w] of m) {
    out[0] += c[0] * w; out[1] += c[1] * w; out[2] += c[2] * w;
    total += w;
  }
  return [out[0] / total, out[1] / total, out[2] / total];
}

function jitter(c: RGB, rand: () => number, k = 0.12): RGB {
  const v = 1 + (rand() - 0.5) * k;
  return [Math.min(c[0] * v, 1), Math.min(c[1] * v, 1), Math.min(c[2] * v, 1)];
}

/** One pigment from a pair of palettes at light level l (0 = shade, 1 = sun). */
function fromPalettes(sun: Mix, shade: Mix, l: number, rand: () => number): RGB {
  return jitter(pickMix(rand() < l ? sun : shade, rand), rand);
}

/**
 * Division of a local colour for the figures. In the light: the hue, the hue
 * warmed by the sun, and sparks of orange and gold. In the shade: the hue
 * cooled, with ultramarine and violet, and a rare spark of the orange.
 */
function divide(local: RGB, l: number, rand: () => number): RGB {
  const lit: RGB = [Math.min(local[0] * 1.16 + 0.05, 1), Math.min(local[1] * 1.1 + 0.035, 1), local[2] * 0.96 + 0.01];
  const dark: RGB = [local[0] * 0.56, local[1] * 0.6, Math.min(local[2] * 0.8 + 0.05, 1)];
  let c = mix3(dark, lit, l);
  const r = rand();
  if (rand() < l) {
    if (r < 0.13) c = mix3(c, ORANGE, 0.55);
    else if (r < 0.21) c = mix3(c, GOLD, 0.55);
    else if (r < 0.27) c = mix3(c, SKY_BLUE, 0.4);
  } else if (r < 0.18) c = mix3(c, ULTRAMARINE, 0.6);
  else if (r < 0.28) c = mix3(c, VIOLET, 0.55);
  else if (r < 0.33) c = mix3(c, ORANGE, 0.5);
  return jitter(c, rand);
}

/** Tone of the solid under the dots. */
function underTone(local: RGB, l: number): RGB {
  return mix3([local[0] * 0.5, local[1] * 0.54, local[2] * 0.72 + 0.03], [Math.min(local[0] * 1.06, 1), Math.min(local[1] * 1.04, 1), local[2] * 0.95], l);
}

// ---------------------------------------------------------------------------
// The lie of the land
// ---------------------------------------------------------------------------

/** x of the river bank at depth z. The river lies to the left of it. */
function shore(z: number): number {
  const t = -0.7 - z;
  return t < 0 ? -5.1 + 0.068 * t : -5.1 + 0.068 * t + 0.0011 * t * t;
}

const ISLAND_END = -96;
const FAR_BANK = -152;

type Ground = 'lawn' | 'water' | 'bank';

function groundAt(x: number, z: number): Ground {
  if (z < FAR_BANK) return 'bank';
  if (z < ISLAND_END - 0.12 * x || x < shore(z)) return 'water';
  return 'lawn';
}

interface TreeSpec {
  x: number; z: number;
  /** Height where the crown starts. */
  bole: number;
  /** Centre of the crown, and its spread. */
  cx: number; cy: number; cz: number; r: number;
  girth: number;
  lobes: number;
  /** Extra lobes: centre and radii. They hang where the painter needs them. */
  extra?: Array<{ c: V3; r: V3 }>;
}

const TREES: TreeSpec[] = [
  // The tree on the left: its boughs hang into the top of the picture.
  {
    x: -3.0, z: -1.6, bole: 3.0, cx: -3.6, cy: 6.0, cz: -1.0, r: 3.6, girth: 0.21, lobes: 5,
    extra: [
      { c: [-4.6, 3.2, 1.2], r: [1.7, 0.75, 1.5] }, { c: [-2.2, 3.4, 0.6], r: [1.5, 0.7, 1.3] }, { c: [-5.6, 3.1, -1.5], r: [1.6, 0.8, 1.6] },
      { c: [-0.9, 3.8, -0.8], r: [1.3, 0.75, 1.2] }, { c: [-3.4, 3.15, 2.8], r: [1.5, 0.65, 1.2] },
    ],
  },
  // The tall tree at the centre.
  { x: 0.9, z: -15, bole: 4.6, cx: 0.4, cy: 9.2, cz: -15, r: 5.6, girth: 0.3, lobes: 9, extra: [{ c: [-1.6, 5.1, -14.4], r: [2.3, 1.1, 2.0] }, { c: [2.8, 4.9, -14.6], r: [2.2, 1.0, 2.0] }] },
  // The grove on the right.
  { x: 4.3, z: -7.4, bole: 3.5, cx: 5.2, cy: 6.9, cz: -7.6, r: 4.0, girth: 0.25, lobes: 8, extra: [{ c: [3.4, 4.0, -6.6], r: [1.9, 0.9, 1.7] }, { c: [6.6, 3.9, -6.2], r: [1.9, 0.9, 1.6] }] },
  { x: 6.7, z: -12.2, bole: 4.0, cx: 7.2, cy: 8.2, cz: -12.6, r: 4.8, girth: 0.3, lobes: 8, extra: [{ c: [5.2, 4.5, -11.6], r: [2.2, 1.0, 1.9] }] },
  { x: 8.2, z: -17.5, bole: 4.4, cx: 8.4, cy: 8.8, cz: -18, r: 5.0, girth: 0.32, lobes: 8, extra: [{ c: [6.0, 4.8, -17], r: [2.3, 1.0, 2.0] }] },
  { x: 5.2, z: -22.5, bole: 4.8, cx: 5.0, cy: 9.4, cz: -23, r: 5.2, girth: 0.3, lobes: 8 },
  { x: 11.2, z: -24.5, bole: 5.0, cx: 11.4, cy: 9.6, cz: -25, r: 5.4, girth: 0.34, lobes: 6 },
  { x: 13.4, z: -14.6, bole: 4.3, cx: 13.6, cy: 8.6, cz: -15, r: 5.0, girth: 0.3, lobes: 6 },
  { x: 10.2, z: -8.2, bole: 3.8, cx: 10.6, cy: 7.6, cz: -8.4, r: 4.4, girth: 0.27, lobes: 6 },
  { x: 3.0, z: -31, bole: 5.2, cx: 3.2, cy: 9.8, cz: -31.5, r: 5.4, girth: 0.32, lobes: 8 },
];

/** The far trees: the dark line where the lawn ends. */
function farTrees(rand: () => number): TreeSpec[] {
  const out: TreeSpec[] = [];
  for (let i = 0; i < 20; i++) {
    const z = -42 - rand() * 46;
    const x = shore(z) + 5 + rand() * (60 - shore(z));
    const h = 9 + rand() * 4;
    out.push({ x, z, bole: h * 0.3, cx: x + rand() - 0.5, cy: h * 0.66, cz: z, r: h * 0.6, girth: 0.3, lobes: 4 });
  }
  return out;
}

interface FigurePlace { kind: FigureKind; x: number; z: number; yaw: number; scale: number; cell: number; height: number }

type FigureKind =
  | 'lady' | 'gentleman' | 'recliner' | 'seatedWoman' | 'seatedMan' | 'mother' | 'child' | 'seatedPink' | 'seatedBlue'
  | 'runner' | 'soldier' | 'angler' | 'stroller' | 'strollerWhite' | 'dog' | 'pug';

const FIGURES: FigurePlace[] = [
  // The promenade couple, in the shade at the right.
  { kind: 'lady', x: 1.62, z: 4.9, yaw: Math.PI, scale: 1, cell: 0.033, height: 2.1 },
  { kind: 'gentleman', x: 1.22, z: 4.42, yaw: Math.PI, scale: 1.02, cell: 0.033, height: 1.95 },
  // The group at the left: the man who looks at the river, the woman who sews, the man with the cane.
  { kind: 'recliner', x: -1.5, z: 4.75, yaw: Math.PI * 1.04, scale: 0.92, cell: 0.033, height: 0.9 },
  { kind: 'seatedWoman', x: -0.95, z: 3.75, yaw: Math.PI * 0.96, scale: 0.95, cell: 0.033, height: 1.1 },
  { kind: 'seatedMan', x: -0.3, z: 3.3, yaw: Math.PI * 1.02, scale: 0.97, cell: 0.033, height: 1.25 },
  { kind: 'dog', x: -0.35, z: 5.45, yaw: 0.1, scale: 0.9, cell: 0.022, height: 0.6 },
  { kind: 'pug', x: 0.42, z: 5.95, yaw: -0.2, scale: 0.5, cell: 0.022, height: 0.4 },
  // The middle of the lawn.
  { kind: 'mother', x: -0.35, z: -5.4, yaw: Math.PI * 0.5, scale: 1, cell: 0.033, height: 2.5 },
  { kind: 'child', x: 0.12, z: -5.3, yaw: Math.PI * 0.5, scale: 1, cell: 0.033, height: 1.0 },
  { kind: 'seatedPink', x: 0.75, z: -1.3, yaw: Math.PI * 0.85, scale: 1, cell: 0.033, height: 1.9 },
  { kind: 'seatedBlue', x: 1.5, z: -1.7, yaw: Math.PI * 1.25, scale: 1, cell: 0.033, height: 1.1 },
  { kind: 'runner', x: 3.1, z: -6.6, yaw: -0.5, scale: 0.8, cell: 0.032, height: 1.3 },
  { kind: 'angler', x: -5.25, z: -6.6, yaw: Math.PI * 1.1, scale: 1, cell: 0.033, height: 1.7 },
  { kind: 'strollerWhite', x: -3.6, z: -10.5, yaw: Math.PI, scale: 1, cell: 0.04, height: 1.7 },
  { kind: 'stroller', x: -3.2, z: -10.8, yaw: Math.PI, scale: 1.04, cell: 0.04, height: 1.8 },
  { kind: 'soldier', x: 1.9, z: -19, yaw: Math.PI * 0.5, scale: 1, cell: 0.045, height: 1.8 },
  { kind: 'soldier', x: 2.45, z: -19.3, yaw: Math.PI * 0.5, scale: 1, cell: 0.045, height: 1.8 },
  { kind: 'stroller', x: -1.6, z: -24, yaw: 0.4, scale: 1, cell: 0.05, height: 1.8 },
  { kind: 'strollerWhite', x: -1.1, z: -24.4, yaw: 0.4, scale: 0.96, cell: 0.05, height: 1.7 },
  { kind: 'stroller', x: 4.4, z: -14.5, yaw: 2.2, scale: 1, cell: 0.04, height: 1.8 },
  { kind: 'strollerWhite', x: -2.4, z: -33, yaw: 1.2, scale: 1, cell: 0.06, height: 1.7 },
  { kind: 'stroller', x: 1.2, z: -38, yaw: 2.0, scale: 1, cell: 0.07, height: 1.8 },
  { kind: 'strollerWhite', x: 6.5, z: -30, yaw: 1.5, scale: 1, cell: 0.06, height: 1.7 },
  { kind: 'stroller', x: -0.6, z: -46, yaw: 0.8, scale: 1, cell: 0.08, height: 1.8 },
];

/** Shade from the trees: the band across the foreground and the patch under each crown. 0 to 1. */
function treeShade(x: number, z: number): number {
  const edge = 2.85 + 0.5 * Math.sin(x * 0.9 + 0.6) + 1.3 * (noise2(x * 0.3, 1.7) - 0.5) - 0.1 * x;
  let s = smoothstep(-0.7, 0.7, z - edge);
  for (const t of TREES) {
    const ox = t.cx + SHADOW_DIR[0] * t.cy * SHADOW_LEN, oz = t.cz + SHADOW_DIR[1] * t.cy * SHADOW_LEN;
    const dx = x - ox, dz = z - oz;
    const a = dx * SHADOW_DIR[0] + dz * SHADOW_DIR[1], b = -dx * SHADOW_DIR[1] + dz * SHADOW_DIR[0];
    const k = Math.hypot(a / (t.r * 1.15), b / (t.r * 0.82));
    if (k < 1.3) s = Math.max(s, 1 - smoothstep(0.7, 1.12, k));
    // The shadow of the bole joins the tree to its patch.
    const len = t.cy * SHADOW_LEN;
    const ta = clamp(((x - t.x) * SHADOW_DIR[0] + (z - t.z) * SHADOW_DIR[1]) / len, 0, 1);
    const d = Math.hypot(x - t.x - SHADOW_DIR[0] * len * ta, z - t.z - SHADOW_DIR[1] * len * ta);
    if (d < t.girth * 2.2) s = Math.max(s, 1 - smoothstep(t.girth, t.girth * 2.2, d));
  }
  return s;
}

/** Shade on the lawn: the trees, the figures, and broken edges where the sun gets through. 0 to 1. */
function shadeAt(x: number, z: number): number {
  let s = treeShade(x, z);
  for (const f of FIGURES) {
    const len = f.height * SHADOW_LEN * 0.9;
    const dx = x - f.x, dz = z - f.z;
    if (Math.abs(dx) + Math.abs(dz) > len + 1.5) continue;
    const a = dx * SHADOW_DIR[0] + dz * SHADOW_DIR[1], b = -dx * SHADOW_DIR[1] + dz * SHADOW_DIR[0];
    const k = Math.hypot((a - len * 0.5) / (len * 0.56), b / 0.27);
    if (k < 1.2) s = Math.max(s, 1 - smoothstep(0.78, 1.1, k));
  }
  s += (noise2(x * 1.9 + 7, z * 1.9) - 0.5) * 0.55 * (1 - Math.abs(s * 2 - 1));
  return smoothstep(0.36, 0.64, s);
}

/** Pigment of one dot of the ground. */
function groundDot(x: number, z: number, rand: () => number): { col: RGB; kind: Ground } {
  const kind = groundAt(x, z);
  if (kind === 'water') {
    const near = Math.min(shore(z) - x, z - FAR_BANK);
    const bankShare = (1 - smoothstep(0.3, 4.5, near)) * 0.85;
    const c = rand() < bankShare ? pickMix(WATER_BANK, rand) : pickMix(WATER, rand);
    return { col: jitter(c, rand), kind };
  }
  if (kind === 'bank') return { col: fromPalettes(LAWN_SUN, LAWN_SHADE, 0.55, rand), kind };
  if (x - shore(z) < 0.45 && z > ISLAND_END + 4) return { col: jitter(pickMix(SAND, rand), rand), kind };
  let c = fromPalettes(LAWN_SUN, LAWN_SHADE, 1 - shadeAt(x, z), rand);
  // The far lawn pales into the air.
  c = mix3(c, [0.70, 0.80, 0.68], smoothstep(-28, -95, z) * 0.42);
  return { col: c, kind };
}

/** Mean tone of the ground: the colour of the ground mesh under the dots. */
function groundTone(x: number, z: number): RGB {
  const kind = groundAt(x, z);
  if (kind === 'water') return mix3(meanMix(WATER), meanMix(WATER_BANK), (1 - smoothstep(0.3, 4.5, Math.min(shore(z) - x, z - FAR_BANK))) * 0.8);
  if (kind === 'bank') return mix3(meanMix(LAWN_SUN), meanMix(LAWN_SHADE), 0.45);
  const c = mix3(meanMix(LAWN_SUN), meanMix(LAWN_SHADE), shadeAt(x, z));
  return mix3(c, [0.70, 0.80, 0.68], smoothstep(-28, -95, z) * 0.42);
}

// ---------------------------------------------------------------------------
// Dots. One record is one instance: 16 floats, stored as the instance matrix.
//   column 0: centre.xyz, radius
//   column 1: colour.rgb, length of the dab (1 = round)
//   column 2: angle of the dab on the picture plane, kind (0 = still, 1 = leaf, 2 = water), phase, sway
//   column 3: unused
// ---------------------------------------------------------------------------

const KIND_STILL = 0, KIND_LEAF = 1, KIND_WATER = 2;

class Dots {
  readonly data: Float32Array;
  count = 0;

  constructor(readonly capacity: number) {
    this.data = new Float32Array(capacity * 16);
  }

  add(x: number, y: number, z: number, radius: number, col: RGB, length: number, angle: number, kind: number, phase: number, sway: number): void {
    if (this.count >= this.capacity) throw new Error(`Dots: capacity ${this.capacity} is too small`);
    const k = this.count * 16;
    const d = this.data;
    d[k] = x; d[k + 1] = y; d[k + 2] = z; d[k + 3] = radius;
    d[k + 4] = col[0]; d[k + 5] = col[1]; d[k + 6] = col[2]; d[k + 7] = length;
    d[k + 8] = angle; d[k + 9] = kind; d[k + 10] = phase; d[k + 11] = sway;
    d[k + 15] = 1;
    this.count++;
  }
}

/** Radius of a dot at a point, so that it has the canvas size from the painter's eye. */
function dotRadius(x: number, y: number, z: number): number {
  return (DOT_PX * clamp(Math.hypot(x - EYE[0], y - EYE[1], z - EYE[2]), 2.5, 420)) / FOCAL;
}

// ---------------------------------------------------------------------------
// The solid under the dots: one indexed mesh
// ---------------------------------------------------------------------------

class Solid {
  readonly pos: number[] = [];
  readonly nor: number[] = [];
  readonly col: number[] = [];
  readonly idx: number[] = [];

  get vertices(): number {
    return this.pos.length / 3;
  }

  vert(p: V3, n: V3, c: RGB): number {
    this.pos.push(p[0], p[1], p[2]);
    this.nor.push(n[0], n[1], n[2]);
    this.col.push(c[0], c[1], c[2]);
    return this.vertices - 1;
  }

  tri(a: V3, b: V3, c: V3, col: RGB): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const n: V3 = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-12) return;
    n[0] /= l; n[1] /= l; n[2] /= l;
    const i = this.vert(a, n, col);
    this.vert(b, n, col); this.vert(c, n, col);
    this.idx.push(i, i + 1, i + 2);
  }

  quad(a: V3, b: V3, c: V3, d: V3, col: RGB): void {
    this.tri(a, b, c, col);
    this.tri(a, c, d, col);
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: RGB): void {
    const v: V3[] = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
    this.quad(v[1], v[0], v[3], v[2], col);
    this.quad(v[4], v[5], v[6], v[7], col);
    this.quad(v[0], v[4], v[7], v[3], col);
    this.quad(v[5], v[1], v[2], v[6], col);
    this.quad(v[3], v[7], v[6], v[2], col);
  }

  /** A round spar from a to b. The radius runs from ra to rb. */
  tube(a: V3, b: V3, ra: number, rb: number, sides: number, col: RGB): void {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) throw new Error('Solid.tube needs two different end points');
    const ax: V3 = [dx / len, dy / len, dz / len];
    const ref: V3 = Math.abs(ax[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let ux = ax[1] * ref[2] - ax[2] * ref[1], uy = ax[2] * ref[0] - ax[0] * ref[2], uz = ax[0] * ref[1] - ax[1] * ref[0];
    const ul = Math.hypot(ux, uy, uz);
    ux /= ul; uy /= ul; uz /= ul;
    const vx = ax[1] * uz - ax[2] * uy, vy = ax[2] * ux - ax[0] * uz, vz = ax[0] * uy - ax[1] * ux;
    const first = this.vertices;
    for (let i = 0; i <= sides; i++) {
      const ang = (i / sides) * Math.PI * 2;
      const n: V3 = [ux * Math.cos(ang) + vx * Math.sin(ang), uy * Math.cos(ang) + vy * Math.sin(ang), uz * Math.cos(ang) + vz * Math.sin(ang)];
      this.vert([a[0] + n[0] * ra, a[1] + n[1] * ra, a[2] + n[2] * ra], n, col);
      this.vert([b[0] + n[0] * rb, b[1] + n[1] * rb, b[2] + n[2] * rb], n, col);
    }
    for (let i = 0; i < sides; i++) {
      const k = first + i * 2;
      this.idx.push(k, k + 2, k + 3, k, k + 3, k + 1);
    }
  }

  ellipsoid(c: V3, r: V3, colour: (n: V3) => RGB, lat = 8, lon = 12): void {
    const first = this.vertices;
    for (let i = 0; i <= lat; i++) {
      const th = (i / lat) * Math.PI;
      for (let j = 0; j <= lon; j++) {
        const ph = (j / lon) * Math.PI * 2;
        const d: V3 = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
        const g: V3 = [d[0] / r[0], d[1] / r[1], d[2] / r[2]];
        const gl = Math.hypot(g[0], g[1], g[2]);
        const n: V3 = [g[0] / gl, g[1] / gl, g[2] / gl];
        this.vert([c[0] + d[0] * r[0], c[1] + d[1] * r[1], c[2] + d[2] * r[2]], n, colour(n));
      }
    }
    for (let i = 0; i < lat; i++) {
      for (let j = 0; j < lon; j++) {
        const a = first + i * (lon + 1) + j, b = a + lon + 1;
        this.idx.push(a, a + 1, b + 1, a, b + 1, b);
      }
    }
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    return g;
  }
}

/**
 * Sows dots on the triangles of the solid from index firstIndex on. local()
 * gives the local colour of each vertex. Each dot stands a little off the
 * surface, so the figure is a shell of points.
 */
function sowDots(
  dots: Dots, solid: Solid, firstIndex: number, local: RGB[], firstVertex: number,
  o: { cover: number; pigment: (c: RGB, l: number) => RGB; light: (n: V3, p: V3) => number; scatter: number; kind: number; sway: number },
  rand: () => number,
): void {
  const P = solid.pos, N = solid.nor, I = solid.idx;
  for (let t = firstIndex; t < I.length; t += 3) {
    const ia = I[t], ib = I[t + 1], ic = I[t + 2];
    const ax = P[ia * 3], ay = P[ia * 3 + 1], az = P[ia * 3 + 2];
    const ux = P[ib * 3] - ax, uy = P[ib * 3 + 1] - ay, uz = P[ib * 3 + 2] - az;
    const vx = P[ic * 3] - ax, vy = P[ic * 3 + 1] - ay, vz = P[ic * 3 + 2] - az;
    const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    const cx = ax + (ux + vx) / 3, cy = ay + (uy + vy) / 3, cz = az + (uz + vz) / 3;
    const r = dotRadius(cx, cy, cz);
    // Faces that look away from the painter take fewer dots.
    const facing = N[ia * 3] * (EYE[0] - cx) + N[ia * 3 + 1] * (EYE[1] - cy) + N[ia * 3 + 2] * (EYE[2] - cz);
    const want = (area * o.cover * (facing < 0 ? 0.5 : 1)) / (Math.PI * r * r * 1.3);
    const n = Math.floor(want + rand());
    for (let k = 0; k < n; k++) {
      let s = rand(), q = rand();
      if (s + q > 1) { s = 1 - s; q = 1 - q; }
      const w = 1 - s - q;
      const nx = N[ia * 3] * w + N[ib * 3] * s + N[ic * 3] * q;
      const ny = N[ia * 3 + 1] * w + N[ib * 3 + 1] * s + N[ic * 3 + 1] * q;
      const nz = N[ia * 3 + 2] * w + N[ib * 3 + 2] * s + N[ic * 3 + 2] * q;
      const nl = Math.hypot(nx, ny, nz) + 1e-9;
      const nn: V3 = [nx / nl, ny / nl, nz / nl];
      const off = r * 0.55 + o.scatter * rand();
      const p: V3 = [ax + ux * s + vx * q + nn[0] * off, ay + uy * s + vy * q + nn[1] * off, az + uz * s + vz * q + nn[2] * off];
      // The dot takes the local colour of one corner, so colour edges stay crisp.
      const pick = rand();
      const iv = pick < w ? ia : pick < w + s ? ib : ic;
      const col = o.pigment(local[iv - firstVertex], o.light(nn, p));
      dots.add(p[0], p[1], p[2], r, col, 1.15 + 0.4 * rand(), Math.PI / 2 + (rand() - 0.5) * 1.3, o.kind, rand() * 6.283, o.sway);
    }
  }
}

// ---------------------------------------------------------------------------
// Figures: distance fields
// ---------------------------------------------------------------------------

type Sdf = (x: number, y: number, z: number) => number;
interface Part { f: Sdf; col: RGB }
interface Rod { a: V3; b: V3; r: number; col: RGB }
/** A parasol: the cap of a sphere about c, above the height c.y + cut. */
interface Canopy { c: V3; R: number; cut: number; col: RGB }
interface FigureDef { parts: Part[]; rods: Rod[]; canopies: Canopy[]; min: V3; max: V3 }

function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

const ell = (cx: number, cy: number, cz: number, rx: number, ry: number, rz: number): Sdf => {
  const m = Math.min(rx, ry, rz);
  return (x, y, z) => (Math.hypot((x - cx) / rx, (y - cy) / ry, (z - cz) / rz) - 1) * m;
};

const cap = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, ra: number, rb: number): Sdf => {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const dd = dx * dx + dy * dy + dz * dz;
  return (x, y, z) => {
    const t = clamp(((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / dd, 0, 1);
    return Math.hypot(x - ax - dx * t, y - ay - dy * t, z - az - dz * t) - (ra + (rb - ra) * t);
  };
};

const cyl = (cx: number, cy: number, cz: number, r: number, h: number): Sdf => (x, y, z) => Math.max(Math.hypot(x - cx, z - cz) - r, Math.abs(y - cy) - h);

const blend = (k: number, ...fs: Sdf[]): Sdf => (x, y, z) => {
  let d = fs[0](x, y, z);
  for (let i = 1; i < fs.length; i++) d = smin(d, fs[i](x, y, z), k);
  return d;
};

// All figures face +x. y is up. +z is the right hand of the figure.

/** Head, hair, and neck at a height. */
function head(x: number, y: number, hair: RGB): Part[] {
  return [
    { f: blend(0.03, ell(x + 0.012, y, 0, 0.086, 0.104, 0.08), cap(x - 0.01, y - 0.17, 0, x, y - 0.08, 0, 0.042, 0.042)), col: SKIN },
    { f: blend(0.03, ell(x - 0.035, y + 0.035, 0, 0.085, 0.09, 0.086), ell(x - 0.1, y - 0.02, 0, 0.045, 0.05, 0.05)), col: hair },
  ];
}

/** The lady of the promenade: bustle skirt, parasol, and the monkey on its lead. */
function lady(): FigureDef {
  const dress = PLUM, bodice = NAVY;
  return {
    parts: [
      // The skirt falls straight in front. Behind, the bustle stands out like a shelf.
      { f: blend(0.09,
        cap(-0.04, 0.2, 0, 0, 1.0, 0, 0.26, 0.115),
        ell(-0.25, 1.0, 0, 0.2, 0.135, 0.18),
        cap(-0.3, 0.9, 0, -0.33, 0.21, 0, 0.13, 0.2)), col: dress },
      { f: blend(0.05,
        cap(0, 1.0, 0, 0.02, 1.36, 0, 0.112, 0.138),
        ell(0.085, 1.31, 0, 0.085, 0.085, 0.128),
        ell(0.01, 1.42, 0, 0.095, 0.06, 0.185),
        cap(0, 1.42, 0.185, 0.06, 1.17, 0.2, 0.052, 0.046), cap(0.06, 1.17, 0.2, 0.26, 1.2, 0.15, 0.043, 0.036),
        cap(0, 1.42, -0.185, 0.05, 1.16, -0.2, 0.052, 0.046), cap(0.05, 1.16, -0.2, 0.22, 1.05, -0.17, 0.043, 0.036)), col: bodice },
      ...head(0.03, 1.6, hex(0x5a3327)),
      { f: blend(0.02, ell(0.04, 1.715, 0, 0.165, 0.03, 0.145), ell(0.015, 1.755, 0, 0.088, 0.06, 0.082)), col: NAVY },
      { f: ell(0.1, 1.775, 0.02, 0.05, 0.042, 0.05), col: RED },
      // The monkey.
      { f: blend(0.03, ell(0.64, 0.17, 0.12, 0.13, 0.08, 0.065), ell(0.77, 0.25, 0.12, 0.055, 0.055, 0.05),
        cap(0.56, 0.12, 0.16, 0.57, 0.02, 0.16, 0.025, 0.02), cap(0.72, 0.13, 0.08, 0.74, 0.02, 0.08, 0.025, 0.02),
        cap(0.52, 0.2, 0.12, 0.42, 0.34, 0.12, 0.022, 0.018), cap(0.42, 0.34, 0.12, 0.47, 0.42, 0.12, 0.018, 0.015)), col: BROWN },
    ],
    rods: [
      { a: [0.26, 1.13, 0.15], b: [0.27, 2.06, 0.11], r: 0.011, col: NAVY },
      { a: [0.22, 1.05, -0.17], b: [0.7, 0.27, 0.12], r: 0.005, col: NAVY },
    ],
    canopies: [{ c: [0.27, 1.7, 0.11], R: 0.36, cut: 0.13, col: hex(0x9a5f4a) }],
    min: [-0.72, -0.05, -0.5], max: [0.9, 1.9, 0.5],
  };
}

/** The gentleman: frock coat, top hat, cane. */
function gentleman(): FigureDef {
  const coat = NAVY;
  return {
    parts: [
      { f: blend(0.03, cap(0, 0.07, 0.085, 0, 0.86, 0.09, 0.068, 0.088), cap(0, 0.07, -0.085, 0, 0.86, -0.09, 0.068, 0.088)), col: GREY_VIOLET },
      { f: blend(0.02, ell(0.05, 0.04, 0.085, 0.12, 0.045, 0.05), ell(0.05, 0.04, -0.085, 0.12, 0.045, 0.05)), col: NAVY },
      { f: blend(0.06,
        cap(0, 0.8, 0, 0, 1.42, 0, 0.165, 0.185),
        ell(0, 1.44, 0, 0.125, 0.07, 0.21),
        cap(-0.02, 0.56, 0, 0, 0.9, 0, 0.2, 0.17),
        cap(0, 1.44, 0.22, 0.03, 1.1, 0.24, 0.06, 0.05), cap(0.03, 1.1, 0.24, 0.2, 0.98, 0.22, 0.05, 0.042),
        cap(0, 1.44, -0.22, 0.03, 1.12, -0.24, 0.06, 0.05), cap(0.03, 1.12, -0.24, 0.17, 1.3, -0.15, 0.05, 0.042)), col: coat },
      { f: ell(0.06, 1.49, 0, 0.07, 0.035, 0.085), col: WHITE },
      ...head(0.02, 1.63, hex(0x33241f)),
      { f: blend(0.015, cyl(0.02, 1.83, 0, 0.088, 0.1), ell(0.02, 1.735, 0, 0.155, 0.024, 0.15)), col: hex(0x17152b) },
    ],
    rods: [{ a: [0.2, 0.98, 0.22], b: [0.37, 0, 0.25], r: 0.011, col: BROWN }],
    canopies: [],
    min: [-0.35, -0.05, -0.42], max: [0.5, 2.0, 0.42],
  };
}

/** The man who lies on the grass and looks at the river: jersey, cap, bare arms. */
function recliner(): FigureDef {
  const jersey = hex(0xd9663f), trousers = hex(0x475080);
  return {
    parts: [
      { f: blend(0.05,
        ell(0, 0.13, 0, 0.17, 0.12, 0.19),
        cap(0.05, 0.13, -0.09, 0.5, 0.12, -0.1, 0.085, 0.07), cap(0.5, 0.12, -0.1, 0.92, 0.07, -0.1, 0.065, 0.05),
        cap(0.05, 0.14, 0.09, 0.42, 0.31, 0.1, 0.085, 0.072), cap(0.42, 0.31, 0.1, 0.8, 0.07, 0.12, 0.066, 0.05)), col: trousers },
      { f: blend(0.02, ell(0.98, 0.1, -0.1, 0.06, 0.1, 0.05), ell(0.86, 0.1, 0.12, 0.06, 0.1, 0.05)), col: NAVY },
      { f: cap(-0.03, 0.18, 0, -0.4, 0.52, 0, 0.165, 0.175), col: jersey },
      { f: blend(0.03,
        cap(-0.4, 0.52, 0.2, -0.52, 0.2, 0.26, 0.055, 0.05), cap(-0.52, 0.2, 0.26, -0.3, 0.06, 0.3, 0.046, 0.04),
        cap(-0.4, 0.52, -0.2, -0.52, 0.2, -0.26, 0.055, 0.05), cap(-0.52, 0.2, -0.26, -0.3, 0.06, -0.3, 0.046, 0.04),
        ell(-0.465, 0.76, 0, 0.088, 0.1, 0.083), cap(-0.42, 0.6, 0, -0.45, 0.68, 0, 0.045, 0.045)), col: hex(0xe0a884) },
      { f: blend(0.02, ell(-0.49, 0.83, 0, 0.1, 0.06, 0.094), ell(-0.4, 0.815, 0, 0.075, 0.022, 0.07)), col: NAVY },
    ],
    rods: [{ a: [-0.38, 0.75, 0], b: [-0.26, 0.72, 0], r: 0.008, col: BROWN }],
    canopies: [],
    min: [-0.72, -0.05, -0.42], max: [1.12, 0.98, 0.42],
  };
}

/** A woman who sits on the grass. With a parasol colour, she holds it open. */
function seatedWoman(skirt: RGB, top: RGB, hat: RGB, trim: RGB, parasol: RGB | null): FigureDef {
  const parts: Part[] = [
    { f: blend(0.08, ell(0.14, 0.17, 0, 0.5, 0.19, 0.37), ell(0.02, 0.27, 0, 0.26, 0.2, 0.27)), col: skirt },
    { f: blend(0.05,
      cap(0, 0.32, 0, -0.02, 0.72, 0, 0.13, 0.125), ell(-0.01, 0.75, 0, 0.09, 0.055, 0.17),
      cap(-0.01, 0.74, 0.17, 0.08, 0.52, 0.17, 0.048, 0.042), cap(0.08, 0.52, 0.17, 0.25, 0.5, 0.08, 0.04, 0.034),
      cap(-0.01, 0.74, -0.17, 0.08, 0.52, -0.17, 0.048, 0.042), cap(0.08, 0.52, -0.17, 0.25, 0.5, -0.08, 0.04, 0.034)), col: top },
    ...head(0, 0.92, hex(0x6b4030)),
    { f: blend(0.02, ell(0.01, 1.025, 0, 0.135, 0.03, 0.125), ell(0, 1.055, 0, 0.08, 0.045, 0.078)), col: hat },
    { f: ell(0.05, 1.07, 0.02, 0.05, 0.035, 0.05), col: trim },
  ];
  const rods: Rod[] = [];
  const canopies: Canopy[] = [];
  if (parasol) {
    canopies.push({ c: [0.22, 1.2, 0.12], R: 0.5, cut: 0.14, col: parasol });
    rods.push({ a: [0.25, 0.5, 0.08], b: [0.22, 1.7, 0.12], r: 0.011, col: BROWN });
  }
  return { parts, rods, canopies, min: [-0.45, -0.05, -0.45], max: [0.78, 1.15, 0.45] };
}

/** The man who sits with his knees up: top hat and cane. */
function seatedMan(): FigureDef {
  return {
    parts: [
      { f: blend(0.05,
        ell(0, 0.14, 0, 0.17, 0.13, 0.18),
        cap(0, 0.16, 0.09, 0.42, 0.31, 0.1, 0.082, 0.07), cap(0.42, 0.31, 0.1, 0.62, 0.06, 0.1, 0.06, 0.05),
        cap(0, 0.16, -0.09, 0.42, 0.31, -0.1, 0.082, 0.07), cap(0.42, 0.31, -0.1, 0.62, 0.06, -0.1, 0.06, 0.05)), col: GREY_VIOLET },
      { f: blend(0.05,
        cap(-0.02, 0.22, 0, 0.02, 0.72, 0, 0.15, 0.16), ell(0.02, 0.75, 0, 0.11, 0.06, 0.2),
        cap(0.02, 0.72, 0.2, 0.3, 0.42, 0.15, 0.052, 0.045), cap(0.02, 0.72, -0.2, 0.3, 0.42, -0.15, 0.052, 0.045)), col: NAVY },
      ...head(0.04, 0.94, hex(0x33241f)),
      { f: blend(0.015, cyl(0.04, 1.13, 0, 0.086, 0.09), ell(0.04, 1.045, 0, 0.15, 0.024, 0.145)), col: hex(0x17152b) },
      { f: blend(0.02, ell(0.68, 0.045, 0.1, 0.1, 0.045, 0.048), ell(0.68, 0.045, -0.1, 0.1, 0.045, 0.048)), col: NAVY },
    ],
    rods: [{ a: [0.3, 0.42, 0.15], b: [0.56, 0, 0.3], r: 0.011, col: BROWN }],
    canopies: [],
    min: [-0.3, -0.05, -0.42], max: [0.85, 1.28, 0.42],
  };
}

/** A woman who stands or walks. With a parasol colour, she holds it over her head. */
function standingWoman(skirt: RGB, top: RGB, hat: RGB, parasol: RGB | null): FigureDef {
  const parts: Part[] = [
    { f: blend(0.07, cap(0, 0.2, 0, 0, 1.0, 0, 0.33, 0.125), ell(-0.16, 0.95, 0, 0.16, 0.14, 0.17)), col: skirt },
    { f: blend(0.05,
      cap(0, 1.0, 0, 0.01, 1.36, 0, 0.112, 0.135), ell(0.01, 1.42, 0, 0.09, 0.06, 0.18),
      cap(0, 1.42, 0.18, 0.05, 1.18, 0.2, 0.05, 0.044), cap(0.05, 1.18, 0.2, 0.2, 1.24, 0.16, 0.042, 0.035),
      cap(0, 1.42, -0.18, 0.02, 1.14, -0.2, 0.05, 0.044), cap(0.02, 1.14, -0.2, 0.06, 0.92, -0.2, 0.042, 0.035)), col: top },
    ...head(0.02, 1.6, hex(0x5a3327)),
    { f: blend(0.02, ell(0.03, 1.71, 0, 0.16, 0.03, 0.145), ell(0.01, 1.75, 0, 0.085, 0.055, 0.08)), col: hat },
  ];
  const rods: Rod[] = [];
  const canopies: Canopy[] = [];
  if (parasol) {
    canopies.push({ c: [0.14, 1.78, 0.14], R: 0.54, cut: 0.16, col: parasol });
    rods.push({ a: [0.2, 1.22, 0.16], b: [0.14, 2.32, 0.14], r: 0.011, col: BROWN });
  }
  return { parts, rods, canopies, min: [-0.45, -0.05, -0.42], max: [0.5, 1.88, 0.42] };
}

/** The little girl in white. */
function child(): FigureDef {
  return {
    parts: [
      { f: blend(0.05, cap(0, 0.14, 0, 0, 0.6, 0, 0.2, 0.085), cap(0, 0.55, 0, 0, 0.72, 0, 0.085, 0.09),
        cap(0, 0.7, 0.1, 0.02, 0.48, 0.14, 0.035, 0.03), cap(0, 0.7, -0.1, 0.02, 0.48, -0.14, 0.035, 0.03)), col: WHITE },
      { f: ell(0.01, 0.84, 0, 0.075, 0.085, 0.072), col: SKIN },
      { f: blend(0.02, ell(0.01, 0.92, 0, 0.14, 0.025, 0.135), ell(0, 0.945, 0, 0.07, 0.04, 0.068)), col: hex(0xf0e6c9) },
    ],
    rods: [],
    canopies: [],
    min: [-0.3, -0.05, -0.3], max: [0.3, 1.05, 0.3],
  };
}

/** A man who stands: a column of trousers and coat under a hat. */
function standingMan(legs: RGB, coat: RGB, hat: RGB, tall: boolean): FigureDef {
  return {
    parts: [
      { f: blend(0.03, cap(0, 0.07, 0.085, 0, 0.86, 0.09, 0.07, 0.09), cap(0, 0.07, -0.085, 0, 0.86, -0.09, 0.07, 0.09)), col: legs },
      { f: blend(0.06, cap(0, 0.8, 0, 0, 1.42, 0, 0.165, 0.185), ell(0, 1.44, 0, 0.125, 0.07, 0.21),
        cap(0, 1.44, 0.22, 0.02, 0.98, 0.23, 0.06, 0.048), cap(0, 1.44, -0.22, 0.02, 0.98, -0.23, 0.06, 0.048)), col: coat },
      ...head(0.02, 1.63, hex(0x33241f)),
      { f: tall ? blend(0.015, cyl(0.02, 1.83, 0, 0.088, 0.1), ell(0.02, 1.735, 0, 0.155, 0.024, 0.15)) : blend(0.015, cyl(0.02, 1.77, 0, 0.09, 0.05), ell(0.08, 1.735, 0, 0.1, 0.02, 0.08)), col: hat },
    ],
    rods: [],
    canopies: [],
    min: [-0.32, -0.05, -0.42], max: [0.36, 2.0, 0.42],
  };
}

/** The girl who runs across the lawn. */
function runner(): FigureDef {
  const dress = hex(0xe66e3a);
  return {
    parts: [
      { f: blend(0.06, cap(-0.05, 0.62, 0, 0.1, 1.1, 0, 0.26, 0.11), cap(0.1, 1.1, 0, 0.2, 1.38, 0, 0.11, 0.12),
        cap(0.2, 1.38, 0.14, 0.42, 1.25, 0.16, 0.04, 0.034), cap(0.2, 1.38, -0.14, 0.0, 1.2, -0.2, 0.04, 0.034)), col: dress },
      { f: blend(0.03, cap(0, 0.66, 0.07, 0.26, 0.34, 0.07, 0.06, 0.05), cap(0.26, 0.34, 0.07, 0.34, 0.05, 0.07, 0.045, 0.04),
        cap(-0.04, 0.66, -0.07, -0.26, 0.42, -0.07, 0.06, 0.05), cap(-0.26, 0.42, -0.07, -0.52, 0.3, -0.07, 0.045, 0.04)), col: WHITE },
      { f: ell(0.27, 1.56, 0, 0.085, 0.1, 0.08), col: SKIN },
      { f: blend(0.03, ell(0.22, 1.6, 0, 0.09, 0.09, 0.088), cap(0.16, 1.58, 0, -0.02, 1.46, 0, 0.06, 0.03)), col: hex(0xd9a04a) },
    ],
    rods: [],
    canopies: [],
    min: [-0.66, -0.05, -0.4], max: [0.6, 1.76, 0.4],
  };
}

/** A dog. sniff = the big black dog with its nose in the grass; otherwise the pug that jumps. */
function dog(col: RGB, sniff: boolean): FigureDef {
  const body = sniff
    ? blend(0.04, ell(0, 0.36, 0, 0.3, 0.125, 0.11), cap(0.24, 0.38, 0, 0.42, 0.22, 0, 0.085, 0.07), ell(0.5, 0.15, 0, 0.1, 0.065, 0.06),
      cap(-0.28, 0.4, 0, -0.44, 0.56, 0, 0.03, 0.018))
    : blend(0.04, ell(0, 0.4, 0, 0.26, 0.13, 0.12), cap(0.2, 0.46, 0, 0.3, 0.58, 0, 0.09, 0.08), ell(0.36, 0.62, 0, 0.1, 0.085, 0.085),
      cap(-0.24, 0.46, 0, -0.3, 0.62, 0, 0.03, 0.02));
  const legs = sniff
    ? blend(0.02, cap(0.18, 0.3, 0.07, 0.2, 0.02, 0.07, 0.035, 0.028), cap(0.18, 0.3, -0.07, 0.24, 0.02, -0.07, 0.035, 0.028),
      cap(-0.2, 0.3, 0.07, -0.22, 0.02, 0.07, 0.04, 0.028), cap(-0.2, 0.3, -0.07, -0.17, 0.02, -0.07, 0.04, 0.028))
    : blend(0.02, cap(0.16, 0.34, 0.07, 0.36, 0.16, 0.07, 0.035, 0.028), cap(0.16, 0.34, -0.07, 0.38, 0.2, -0.07, 0.035, 0.028),
      cap(-0.18, 0.34, 0.07, -0.36, 0.12, 0.07, 0.04, 0.028), cap(-0.18, 0.34, -0.07, -0.4, 0.16, -0.07, 0.04, 0.028));
  return { parts: [{ f: blend(0.03, body, legs), col }], rods: [], canopies: [], min: [-0.56, -0.05, -0.24], max: [0.68, 0.78, 0.24] };
}

function figureDef(kind: FigureKind): FigureDef {
  switch (kind) {
    case 'lady': return lady();
    case 'gentleman': return gentleman();
    case 'recliner': return recliner();
    case 'seatedWoman': return seatedWoman(hex(0x8c96b8), hex(0x4a4a73), STRAW, RED, null);
    case 'seatedMan': return seatedMan();
    case 'mother': return standingWoman(hex(0xc98c9a), hex(0x73405c), hex(0x33294a), hex(0xe6703a));
    case 'child': return child();
    case 'seatedPink': return seatedWoman(hex(0xe0a3a8), hex(0xb8607a), STRAW, hex(0x4a5ca6), hex(0xd9573a));
    case 'seatedBlue': return seatedWoman(hex(0x7a8cc4), hex(0x40477a), hex(0xf0e6c9), RED, null);
    case 'runner': return runner();
    case 'soldier': return standingMan(hex(0xc9473a), hex(0x2f3a73), hex(0xc9473a), false);
    case 'angler': return standingWoman(hex(0xe6903f), hex(0xb85c33), STRAW, null);
    case 'stroller': return standingMan(GREY_VIOLET, NAVY, hex(0x17152b), true);
    case 'strollerWhite': return standingWoman(hex(0xe6dcc9), hex(0x9a8cb0), hex(0xd9573a), null);
    case 'dog': return dog(hex(0x1c1a2b), true);
    case 'pug': return dog(hex(0xc9a073), false);
    default: {
      const never: never = kind;
      throw new Error(`Unknown figure kind: ${String(never)}`);
    }
  }
}

interface Sculpt { def: FigureDef; positions: Float32Array; indices: Uint32Array; normals: Float32Array; local: RGB[] }

/** Sculpts one kind of figure in its own frame: mesh, outward normals, and the local colour of each vertex. */
function sculptFigure(kind: FigureKind, cell: number): Sculpt {
  const def = figureDef(kind);
  const parts = def.parts;
  // A box about each part. A part is skipped when the point is farther from its box than from a part already found.
  const G = [12, 18, 10];
  const step = Math.max((def.max[0] - def.min[0]) / G[0], (def.max[1] - def.min[1]) / G[1], (def.max[2] - def.min[2]) / G[2]);
  const boxes = parts.map((part) => {
    const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (let k = 0; k <= G[2]; k++) {
      for (let j = 0; j <= G[1]; j++) {
        for (let i = 0; i <= G[0]; i++) {
          const x = def.min[0] + ((def.max[0] - def.min[0]) * i) / G[0];
          const y = def.min[1] + ((def.max[1] - def.min[1]) * j) / G[1];
          const z = def.min[2] + ((def.max[2] - def.min[2]) * k) / G[2];
          if (part.f(x, y, z) > step) continue;
          b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.min(b[2], z);
          b[3] = Math.max(b[3], x); b[4] = Math.max(b[4], y); b[5] = Math.max(b[5], z);
        }
      }
    }
    if (b[0] > b[3]) throw new Error(`sculptFigure: a part of "${kind}" lies outside the bounds of the figure`);
    return [b[0] - step, b[1] - step, b[2] - step, b[3] + step, b[4] + step, b[5] + step];
  });
  const field = (x: number, y: number, z: number): number => {
    let d = Infinity;
    for (let i = 0; i < parts.length; i++) {
      const b = boxes[i];
      if (Math.max(b[0] - x, x - b[3], b[1] - y, y - b[4], b[2] - z, z - b[5]) >= d) continue;
      const v = parts[i].f(x, y, z);
      if (v < d) d = v;
    }
    return d;
  };
  // Every part is a lower bound of its true distance, so the field less a small margin is a safe bound.
  const mesh = meshSdf(field, { min: def.min, max: def.max, cell, bound: (x, y, z) => field(x, y, z) - 0.03 });
  const count = mesh.positions.length / 3;
  // Smooth normals from the faces. One gradient test sets which way is out.
  const nor = new Float32Array(count * 3);
  const P = mesh.positions, I = mesh.indices;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) { nor[k] += nx; nor[k + 1] += ny; nor[k + 2] += nz; }
  }
  const e = cell * 0.5;
  const outward = (field(P[0] + e, P[1], P[2]) - field(P[0] - e, P[1], P[2])) * nor[0]
    + (field(P[0], P[1] + e, P[2]) - field(P[0], P[1] - e, P[2])) * nor[1]
    + (field(P[0], P[1], P[2] + e) - field(P[0], P[1], P[2] - e)) * nor[2];
  const sign = outward < 0 ? -1 : 1;
  const local: RGB[] = [];
  for (let v = 0; v < count; v++) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    let best = Infinity, col = parts[0].col;
    for (const part of parts) {
      const d = part.f(x, y, z);
      if (d < best) { best = d; col = part.col; }
    }
    local.push(col);
    const l = (Math.hypot(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2]) || 1) * sign;
    nor[v * 3] /= l; nor[v * 3 + 1] /= l; nor[v * 3 + 2] /= l;
  }
  if (sign < 0) {
    for (let t = 0; t < I.length; t += 3) { const k = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = k; }
  }
  return { def, positions: P, indices: I, normals: nor, local };
}

/** Places one sculpted figure in the world, adds it to the solid, and sows it with dots. */
function buildFigure(solid: Solid, dots: Dots, place: FigurePlace, sculpt: Sculpt, rand: () => number): void {
  const { def, positions: P, indices: I, normals: nor } = sculpt;
  const count = P.length / 3;
  const cs = Math.cos(place.yaw), sn = Math.sin(place.yaw), s = place.scale;
  const at = (x: number, y: number, z: number): V3 => [place.x + (x * cs - z * sn) * s, y * s, place.z + (x * sn + z * cs) * s];
  // The whole figure stands in the light or in the shade of the trees.
  const shade = treeShade(place.x, place.z);
  const light = (n: V3, p: V3): number => {
    const ndl = n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2];
    const open = clamp(0.5 + 0.62 * ndl, 0, 1);
    // In the shade only the rim that faces the sun keeps some light.
    const l = open * (1 - 0.74 * shade) + 0.1 * shade * Math.max(n[1], 0);
    return clamp(l * (0.7 + 0.3 * smoothstep(0, 0.5 * s, p[1])), 0, 1);
  };
  const firstVertex = solid.vertices, firstIndex = solid.idx.length;
  const local: RGB[] = sculpt.local.slice();
  for (let v = 0; v < count; v++) {
    const lx = nor[v * 3], ly = nor[v * 3 + 1], lz = nor[v * 3 + 2];
    const n: V3 = [lx * cs - lz * sn, ly, lx * sn + lz * cs];
    const p = at(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    solid.vert(p, n, underTone(local[v], light(n, p)));
  }
  for (let t = 0; t < I.length; t++) solid.idx.push(firstVertex + I[t]);
  for (const rod of def.rods) {
    const first = solid.vertices;
    const tone = underTone(rod.col, 0.4 * (1 - shade));
    solid.tube(at(rod.a[0], rod.a[1], rod.a[2]), at(rod.b[0], rod.b[1], rod.b[2]), rod.r * s, rod.r * s, 5, tone);
    for (let v = first; v < solid.vertices; v++) local.push(rod.col);
  }
  for (const can of def.canopies) {
    // The parasol: rings from the crown down to the rim.
    const first = solid.vertices;
    const RINGS = 6, SEGS = 16;
    const open = Math.acos(can.cut / can.R);
    for (let i = 0; i <= RINGS; i++) {
      const th = (open * i) / RINGS;
      for (let j = 0; j <= SEGS; j++) {
        const ph = (j / SEGS) * Math.PI * 2;
        const d: V3 = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
        const n: V3 = [d[0] * cs - d[2] * sn, d[1], d[0] * sn + d[2] * cs];
        const p = at(can.c[0] + d[0] * can.R, can.c[1] + d[1] * can.R, can.c[2] + d[2] * can.R);
        solid.vert(p, n, underTone(can.col, light(n, p)));
        local.push(can.col);
      }
    }
    for (let i = 0; i < RINGS; i++) {
      for (let j = 0; j < SEGS; j++) {
        const a = first + i * (SEGS + 1) + j, b = a + SEGS + 1;
        solid.idx.push(a, a + 1, b + 1, a, b + 1, b);
      }
    }
  }
  sowDots(dots, solid, firstIndex, local, firstVertex, { cover: 1.9, pigment: (c, l) => divide(c, l, rand), light, scatter: 0.004 * s, kind: KIND_STILL, sway: 0 }, rand);
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

interface Lobe { c: V3; r: V3 }

function leafLight(n: V3, p: V3, crown: TreeSpec, rand: () => number): number {
  const ndl = n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2];
  let l = 0.5 + 0.55 * ndl;
  // Clumps of leaf shade inside the crown, and the dark under side.
  l += (noise3(p[0] * 0.55, p[1] * 0.55, p[2] * 0.55) - 0.5) * 0.7 + (rand() - 0.5) * 0.3;
  l -= 0.3 * (1 - smoothstep(crown.bole - 0.5, crown.cy + crown.r * 0.3, p[1]));
  // The far trees stand as one dark line against the light.
  if (p[2] < -38) l *= 0.62;
  return clamp(l, 0, 1);
}

function buildTree(solid: Solid, dots: Dots, t: TreeSpec, far: boolean, rand: () => number): void {
  // The bole: a bent column that divides under the crown.
  const firstVertex = solid.vertices, firstIndex = solid.idx.length;
  const top: V3 = [t.x + (t.cx - t.x) * 0.5, t.bole, t.z + (t.cz - t.z) * 0.5];
  const mid: V3 = [t.x + (t.cx - t.x) * 0.12 + (rand() - 0.5) * 0.25, t.bole * 0.55, t.z + (t.cz - t.z) * 0.12];
  const barkTone = underTone(hex(0x6b4f55), 0.35);
  const sides = far ? 5 : 8;
  solid.tube([t.x, -0.1, t.z], mid, t.girth * 1.15, t.girth * 0.9, sides, barkTone);
  solid.tube(mid, top, t.girth * 0.9, t.girth * 0.72, sides, barkTone);
  for (let b = 0; b < (far ? 2 : 3); b++) {
    const a = (b / 3) * Math.PI * 2 + rand() * 1.2;
    const reach = t.r * (0.35 + 0.25 * rand());
    solid.tube(top, [t.cx + Math.cos(a) * reach, t.bole + (t.cy - t.bole) * (0.5 + 0.3 * rand()), t.cz + Math.sin(a) * reach], t.girth * 0.6, t.girth * 0.2, far ? 4 : 6, barkTone);
  }
  const bark: RGB[] = [];
  for (let v = firstVertex; v < solid.vertices; v++) bark.push(hex(0x6b4f55));
  const groundShade = treeShade(t.x + 0.3, t.z);
  sowDots(dots, solid, firstIndex, bark, firstVertex, {
    cover: 1.5, scatter: 0.01, kind: KIND_STILL, sway: 0,
    pigment: (_c, l) => fromPalettes(BARK_SUN, BARK_SHADE, l, rand),
    light: (n) => clamp((0.45 + 0.7 * (n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2])) * (1 - 0.5 * groundShade), 0, 1),
  }, rand);

  // The crown: lobes of leaf about the centre.
  const lobes: Lobe[] = [];
  for (let i = 0; i < t.lobes; i++) {
    const a = (i / t.lobes) * Math.PI * 2 + rand() * 0.8;
    const k = i === 0 ? 0 : 0.35 + 0.4 * rand();
    const rr = t.r * (0.42 + 0.2 * rand());
    lobes.push({
      c: [t.cx + Math.cos(a) * t.r * k, t.cy + (rand() - 0.45) * t.r * 0.55, t.cz + Math.sin(a) * t.r * k],
      r: [rr * 1.15, rr * 0.82, rr * 1.15],
    });
  }
  if (t.extra) lobes.push(...t.extra);
  const inside = (p: V3, skip: number): boolean => {
    for (let j = 0; j < lobes.length; j++) {
      if (j === skip) continue;
      const o = lobes[j];
      if (Math.hypot((p[0] - o.c[0]) / o.r[0], (p[1] - o.c[1]) / o.r[1], (p[2] - o.c[2]) / o.r[2]) < 0.93) return true;
    }
    return false;
  };
  lobes.forEach((lobe, li) => {
    const core: V3 = [lobe.r[0] * 0.84, lobe.r[1] * 0.84, lobe.r[2] * 0.84];
    solid.ellipsoid(lobe.c, core, (n) => {
      const l = clamp(0.35 + 0.5 * (n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]), 0, 1);
      return mix3(meanMix(LEAF_SHADE), meanMix(LEAF_SUN), l * 0.6);
    }, far ? 5 : 7, far ? 8 : 11);
    // Leaf dabs are larger than the dots of the figures.
    const r = Math.max(dotRadius(lobe.c[0], lobe.c[1], lobe.c[2]) * 1.7, 0.03);
    const pp = 1.6;
    const area = 4 * Math.PI * Math.pow((Math.pow(lobe.r[0] * lobe.r[1], pp) + Math.pow(lobe.r[0] * lobe.r[2], pp) + Math.pow(lobe.r[1] * lobe.r[2], pp)) / 3, 1 / pp);
    const want = Math.round((area * (far ? 0.8 : 1.0)) / (Math.PI * r * r * 1.3));
    for (let i = 0; i < want; i++) {
      const y = rand() * 2 - 1, a = rand() * Math.PI * 2;
      const sxz = Math.sqrt(Math.max(1 - y * y, 0));
      const d: V3 = [Math.cos(a) * sxz, y, Math.sin(a) * sxz];
      const lump = 0.94 + 0.2 * (noise3(d[0] * 2.1 + li * 7, d[1] * 2.1, d[2] * 2.1) - 0.5) + rand() * 0.12;
      const p: V3 = [lobe.c[0] + d[0] * lobe.r[0] * lump, lobe.c[1] + d[1] * lobe.r[1] * lump, lobe.c[2] + d[2] * lobe.r[2] * lump];
      if (inside(p, li)) continue;
      const g: V3 = [d[0] / lobe.r[0], d[1] / lobe.r[1], d[2] / lobe.r[2]];
      const gl = Math.hypot(g[0], g[1], g[2]);
      const n: V3 = [g[0] / gl, g[1] / gl, g[2] / gl];
      // The far side of the crown takes fewer dots.
      const facing = n[0] * (EYE[0] - p[0]) + n[1] * (EYE[1] - p[1]) + n[2] * (EYE[2] - p[2]);
      if (facing < 0 && rand() < 0.72) continue;
      const col = fromPalettes(LEAF_SUN, LEAF_SHADE, leafLight(n, p, t, rand), rand);
      dots.add(p[0], p[1], p[2], r, col, 1.1 + 0.5 * rand(), rand() * Math.PI, KIND_LEAF, rand() * 6.283, 0.012 + 0.03 * rand());
    }
  });
}

// ---------------------------------------------------------------------------
// The river and the far bank
// ---------------------------------------------------------------------------

interface Sail { x: number; z: number; h: number; yaw: number }
const SAILS: Sail[] = [
  { x: -13.5, z: -27, h: 5.2, yaw: 0.5 }, { x: -9.5, z: -53, h: 6.2, yaw: -0.3 }, { x: -24, z: -74, h: 6.6, yaw: 0.2 }, { x: -3, z: -118, h: 7, yaw: 0.1 },
];

/** Sows a flat patch with dots of one palette. a, b, c are corners of a triangle. */
function sowTriangle(dots: Dots, a: V3, b: V3, c: V3, pigment: () => RGB, cover: number, kind: number, rand: () => number): void {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  const r = dotRadius(a[0] + (ux + vx) / 3, a[1] + (uy + vy) / 3, a[2] + (uz + vz) / 3);
  const n = Math.round((area * cover) / (Math.PI * r * r * 1.3));
  for (let i = 0; i < n; i++) {
    let s = rand(), q = rand();
    if (s + q > 1) { s = 1 - s; q = 1 - q; }
    const j = (rand() - 0.5) * r;
    dots.add(a[0] + ux * s + vx * q + j, a[1] + uy * s + vy * q, a[2] + uz * s + vz * q + j, r, pigment(), 1.2 + 0.4 * rand(), (rand() - 0.5) * 1.2, kind, rand() * 6.283, 0);
  }
}

function buildRiver(solid: Solid, dots: Dots, rand: () => number): void {
  const sailTone: RGB = [0.93, 0.92, 0.86];
  const sailPigment = (): RGB => {
    const r = rand();
    return jitter(r < 0.6 ? WHITE : r < 0.78 ? hex(0xf5e3b0) : r < 0.9 ? hex(0xc9d6ee) : hex(0xf2c7a6), rand, 0.08);
  };
  const hullPigment = (): RGB => divide(hex(0x3a3550), 0.35, rand);
  for (const s of SAILS) {
    const cs = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    const at = (x: number, y: number, z: number): V3 => [s.x + x * cs - z * sn, y, s.z + x * sn + z * cs];
    const len = s.h * 0.9;
    // The hull, the mast, the mainsail, and the jib.
    solid.ellipsoid(at(0, 0.1, 0), [len * 0.5, 0.42, len * 0.14], () => underTone(hex(0x3a3550), 0.4), 5, 10);
    sowTriangle(dots, at(-len * 0.5, 0.38, 0), at(len * 0.5, 0.38, 0), at(0, 0.05, 0), hullPigment, 2.6, KIND_STILL, rand);
    solid.tube(at(len * 0.08, 0.3, 0), at(len * 0.08, s.h, 0), 0.06, 0.04, 4, underTone(BROWN, 0.5));
    const m0 = at(len * 0.04, 0.9, 0), m1 = at(len * 0.04, s.h, 0), m2 = at(-len * 0.52, 1.0, 0);
    const j0 = at(len * 0.13, 0.8, 0), j1 = at(len * 0.1, s.h * 0.86, 0), j2 = at(len * 0.52, 0.7, 0);
    solid.tri(m0, m1, m2, sailTone); solid.tri(m0, m2, m1, sailTone);
    solid.tri(j0, j2, j1, sailTone); solid.tri(j0, j1, j2, sailTone);
    sowTriangle(dots, m0, m1, m2, sailPigment, 1.9, KIND_STILL, rand);
    sowTriangle(dots, j0, j1, j2, sailPigment, 1.9, KIND_STILL, rand);
  }
  // The racing shell with its four oarsmen and the cox.
  {
    const x0 = -8.6, z0 = -19.5, yaw = 0.42;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    const at = (x: number, y: number, z: number): V3 => [x0 + x * cs - z * sn, y, z0 + x * sn + z * cs];
    solid.ellipsoid(at(0, 0.02, 0), [4.4, 0.16, 0.3], () => underTone(hex(0x8c5a3a), 0.5), 4, 12);
    sowTriangle(dots, at(-4.4, 0.16, 0), at(4.4, 0.16, 0), at(0, 0.0, 0.2), () => divide(hex(0x8c5a3a), 0.6, rand), 3, KIND_STILL, rand);
    for (let i = 0; i < 5; i++) {
      const x = -2.6 + i * 1.25;
      const shirt = i === 4 ? hex(0x3a3a66) : WHITE;
      solid.ellipsoid(at(x, 0.52, 0), [0.2, 0.34, 0.22], () => underTone(shirt, 0.7), 5, 8);
      solid.ellipsoid(at(x + 0.05, 0.95, 0), [0.1, 0.12, 0.1], () => underTone(SKIN, 0.7), 4, 7);
      sowTriangle(dots, at(x - 0.22, 0.2, 0.1), at(x + 0.22, 0.2, 0.1), at(x, 0.9, 0.1), () => divide(shirt, 0.8, rand), 3.2, KIND_STILL, rand);
      sowTriangle(dots, at(x - 0.06, 0.86, 0.1), at(x + 0.16, 0.86, 0.1), at(x + 0.05, 1.08, 0.1), () => divide(i === 4 ? SKIN : hex(0xd9a04a), 0.8, rand), 3.2, KIND_STILL, rand);
      if (i < 4) solid.tube(at(x + 0.2, 0.5, 0), at(x + 0.5, 0.08, i % 2 === 0 ? 2.3 : -2.3), 0.025, 0.035, 3, underTone(BROWN, 0.6));
    }
  }
  // The steam tug: dark hull, funnel, and the tricolour at the stern.
  {
    const x0 = -17, z0 = -43;
    solid.box(x0 - 4, -0.2, z0 - 1, x0 + 4, 0.8, z0 + 1, underTone(hex(0x33304a), 0.4));
    solid.box(x0 - 1.4, 0.8, z0 - 0.7, x0 + 1.2, 1.7, z0 + 0.7, underTone(hex(0x8c7a66), 0.6));
    solid.tube([x0 + 0.4, 1.7, z0], [x0 + 0.3, 3.6, z0], 0.28, 0.25, 6, underTone(hex(0x26233a), 0.4));
    sowTriangle(dots, [x0 - 4, 0.05, z0 + 1.05], [x0 + 4, 0.05, z0 + 1.05], [x0 + 4, 0.8, z0 + 1.05], hullPigment, 2.4, KIND_STILL, rand);
    sowTriangle(dots, [x0 - 4, 0.05, z0 + 1.05], [x0 + 4, 0.8, z0 + 1.05], [x0 - 4, 0.8, z0 + 1.05], hullPigment, 2.4, KIND_STILL, rand);
    sowTriangle(dots, [x0 - 1.4, 0.8, z0 + 0.75], [x0 + 1.2, 0.8, z0 + 0.75], [x0 - 0.1, 2.6, z0 + 0.75], () => divide(hex(0x8c7a66), 0.6, rand), 2.2, KIND_STILL, rand);
    sowTriangle(dots, [x0 + 0.1, 1.7, z0 + 0.3], [x0 + 0.7, 1.7, z0 + 0.3], [x0 + 0.35, 5.4, z0 + 0.3], hullPigment, 2.4, KIND_STILL, rand);
    solid.tube([x0 - 3.7, 0.8, z0], [x0 - 3.7, 3.0, z0], 0.03, 0.03, 3, underTone(BROWN, 0.5));
    const flag: RGB[] = [hex(0x3a4ca6), WHITE, hex(0xd9473a)];
    flag.forEach((c, i) => {
      const fx = x0 - 3.7 - (i + 1) * 0.42;
      sowTriangle(dots, [fx, 2.2, z0], [fx + 0.42, 2.2, z0], [fx + 0.2, 3.1, z0], () => jitter(c, rand), 3.6, KIND_STILL, rand);
    });
    // Smoke: pale dots that climb and drift down the river.
    for (let i = 0; i < 520; i++) {
      const k = Math.pow(rand(), 0.8);
      const y = 3.8 + k * 9;
      const spread = 0.3 + k * 2.4;
      const px = x0 + 0.3 - k * k * 9 + (rand() - 0.5) * spread, pz = z0 + (rand() - 0.5) * spread;
      const r = dotRadius(px, y, pz);
      const c = rand() < 0.6 ? hex(0xe6e6ee) : rand() < 0.5 ? hex(0xb8bfd6) : hex(0xf2ddc4);
      dots.add(px, y, pz, r, jitter(c, rand), 1.2, rand() * 3.1, KIND_LEAF, rand() * 6.283, 0.1 + 0.25 * k);
    }
  }
}

/** The far bank: a white quay wall, houses, and a line of trees. */
function buildFarBank(solid: Solid, dots: Dots, rand: () => number): void {
  const z = FAR_BANK;
  const wall = hex(0xf0ead6);
  solid.box(-320, -0.5, z - 3, 320, 2.4, z, underTone(wall, 0.8));
  for (let x = -300; x < 300; x += 2) {
    sowTriangle(dots, [x, 0.1, z + 0.2], [x + 2, 0.1, z + 0.2], [x + 1, 4.4, z + 0.2], () => {
      const r = rand();
      return jitter(r < 0.62 ? wall : r < 0.8 ? hex(0xf5d9a8) : r < 0.92 ? hex(0xc4cde6) : hex(0xe6b08c), rand, 0.08);
    }, 0.9, KIND_STILL, rand);
  }
  for (let i = 0; i < 20; i++) {
    const x = -290 + i * 30 + (rand() - 0.5) * 16;
    const w = 5 + rand() * 7, h = 4 + rand() * 3.5, zz = z - 8 - rand() * 14;
    const house = rand() < 0.7 ? hex(0xf2ecdc) : hex(0xe6c9a3);
    const roof = rand() < 0.6 ? hex(0xc9664a) : hex(0x8c8ca6);
    solid.box(x - w, 0, zz - 6, x + w, h, zz, underTone(house, 0.85));
    solid.box(x - w - 0.4, h, zz - 6.4, x + w + 0.4, h + 1.6, zz + 0.4, underTone(roof, 0.7));
    const face = (y0: number, y1: number, pigment: () => RGB): void => {
      sowTriangle(dots, [x - w, y0, zz + 0.3], [x + w, y0, zz + 0.3], [x + w, y1, zz + 0.3], pigment, 1.5, KIND_STILL, rand);
      sowTriangle(dots, [x - w, y0, zz + 0.3], [x + w, y1, zz + 0.3], [x - w, y1, zz + 0.3], pigment, 1.5, KIND_STILL, rand);
    };
    face(2.4, h, () => (rand() < 0.1 ? divide(hex(0x5c668c), 0.5, rand) : divide(house, 0.9, rand)));
    face(h, h + 1.6, () => divide(roof, 0.75, rand));
  }
  for (let i = 0; i < 44; i++) {
    const x = -310 + i * 14.3 + (rand() - 0.5) * 10;
    const h = 9 + rand() * 6;
    const tz = z - 5 - rand() * 12;
    buildTree(solid, dots, { x, z: tz, bole: h * 0.3, cx: x, cy: h * 0.66, cz: tz, r: h * 0.56, girth: 0.4, lobes: 3 }, true, rand);
  }
}

// ---------------------------------------------------------------------------
// The ground, laid from the painter's eye
// ---------------------------------------------------------------------------

/** The part of the picture plane that the painter covers with ground dots, in pixels from its centre. y runs down. */
const LAID = { halfWidth: 1150, top: -215, bottom: 505 };
/** Smallest radius of a dot outside the painter's view. */
const FILL_RADIUS = 0.12;

function layGround(dots: Dots, count: number, fill: number, rand: () => number): void {
  const f = [EYE_TARGET[0] - EYE[0], EYE_TARGET[1] - EYE[1], EYE_TARGET[2] - EYE[2]];
  const fl = Math.hypot(f[0], f[1], f[2]);
  const fwd: V3 = [f[0] / fl, f[1] / fl, f[2] / fl];
  const rl = Math.hypot(fwd[2], fwd[0]);
  const right: V3 = [-fwd[2] / rl, 0, fwd[0] / rl];
  const up: V3 = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
  const put = (x: number, z: number, r: number): void => {
    const g = groundDot(x, z, rand);
    if (g.kind === 'water') dots.add(x, r * 0.75, z, r, g.col, 1.9 + 0.7 * rand(), (rand() - 0.5) * 0.24, KIND_WATER, rand() * 6.283, 0);
    else dots.add(x, r * 0.75, z, r, g.col, 1.25 + 0.5 * rand(), (rand() - 0.5) * 1.1, KIND_STILL, rand() * 6.283, 0);
  };
  // Outside the painter's view the ground takes larger, sparser dots, so the island holds from any side.
  for (let i = 0; i < fill; i++) {
    const x = -46 + rand() * 92, z = -64 + rand() * 96;
    const vx = x - EYE[0], vy = -EYE[1], vz = z - EYE[2];
    const depth = vx * fwd[0] + vy * fwd[1] + vz * fwd[2];
    if (depth > 0.5) {
      const px = ((vx * right[0] + vz * right[2]) / depth) * FOCAL;
      const py = (-(vx * up[0] + vy * up[1] + vz * up[2]) / depth) * FOCAL;
      if (Math.abs(px) < LAID.halfWidth - 20 && py > LAID.top && py < LAID.bottom - 10) continue;
    }
    put(x, z, Math.max(dotRadius(x, 0, z), FILL_RADIUS) * (0.85 + 0.3 * rand()));
  }
  for (let i = 0; i < count; i++) {
    // A point of the picture plane.
    const px = (rand() * 2 - 1) * LAID.halfWidth, py = LAID.top + rand() * (LAID.bottom - LAID.top);
    const dx = fwd[0] * FOCAL + right[0] * px - up[0] * py;
    const dy = fwd[1] * FOCAL + right[1] * px - up[1] * py;
    const dz = fwd[2] * FOCAL + right[2] * px - up[2] * py;
    if (dy > -1e-3) continue;
    const s = -EYE[1] / dy;
    const dist = s * Math.hypot(dx, dy, dz);
    if (dist > 300) continue;
    put(EYE[0] + dx * s, EYE[2] + dz * s, (DOT_PX * Math.max(dist, 2.5)) / FOCAL);
  }
}

const MAP_N = 384;
const MAP_X0 = -128, MAP_Z0 = -200, MAP_SPAN = 256;

function bakeGroundMap(): THREE.DataTexture {
  const data = new Uint8Array(MAP_N * MAP_N * 4);
  for (let j = 0; j < MAP_N; j++) {
    for (let i = 0; i < MAP_N; i++) {
      const c = groundTone(MAP_X0 + ((i + 0.5) / MAP_N) * MAP_SPAN, MAP_Z0 + ((j + 0.5) / MAP_N) * MAP_SPAN);
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

const DOT_VERT = /* glsl */ `
uniform float uTime;
uniform float uPixel;
varying vec3 vColor;
varying vec2 vQ;
void main() {
  vec4 c0 = instanceMatrix[0];
  vec4 c1 = instanceMatrix[1];
  vec4 c2 = instanceMatrix[2];
  vec3 centre = c0.xyz;
  vec3 col = c1.rgb;
  float kind = c2.y;
  float ph = c2.z;
  if (kind > 1.5) {
    // The river: points of light come and go, and the dabs slide a little.
    col *= 1.0 + 0.17 * sin(uTime * (1.1 + fract(ph * 3.7) * 1.6) + ph * 9.0);
    centre.x += 0.7 * c0.w * sin(uTime * 0.6 + ph * 5.0);
  } else if (kind > 0.5) {
    // Leaves stir in the afternoon air.
    centre.x += c2.w * sin(uTime * 0.9 + ph);
    centre.z += c2.w * 0.7 * cos(uTime * 0.7 + ph * 1.3);
    centre.y += c2.w * 0.4 * sin(uTime * 1.3 + ph * 2.1);
  }
  vec4 mv = viewMatrix * vec4(centre, 1.0);
  // A dot is never smaller than about one pixel, so far views stay solid.
  float r = max(c0.w, uPixel * 1.05 * -mv.z);
  float cs = cos(c2.x);
  float sn = sin(c2.x);
  vec2 q = vec2(position.x * c1.w, position.y);
  mv.xy += vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs) * r;
  vQ = position.xy;
  vColor = col;
  gl_Position = projectionMatrix * mv;
}
`;

const DOT_FRAG = /* glsl */ `
varying vec3 vColor;
varying vec2 vQ;
void main() {
  // A dab of thick paint: the light catches its upper edge.
  gl_FragColor = vec4(vColor * (0.96 + 0.09 * vQ.y), 1.0);
}
`;

const SOLID_VERT = /* glsl */ `
attribute vec3 aCol;
varying vec3 vCol;
varying vec3 vWp;
void main() {
  vCol = aCol;
  vWp = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SOLID_FRAG = /* glsl */ `
${GLSL_NOISE}
varying vec3 vCol;
varying vec3 vWp;
void main() {
  // The first lay-in under the dots: local tone, brushed in loosely.
  float n = vnoise3(vWp * 9.0) * 0.6 + vnoise3(vWp * 31.0) * 0.4;
  gl_FragColor = vec4(vCol * (0.88 + 0.22 * n), 1.0);
}
`;

const GROUND_VERT = /* glsl */ `
varying vec3 vWp;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const GROUND_FRAG = /* glsl */ `
${GLSL_NOISE}
uniform sampler2D tMap;
uniform vec4 uMapRect;
varying vec3 vWp;
// One layer of stipple: a jittered dot in each cell, with one of three notes.
vec3 stipple(vec2 p, float cell, vec3 base, float seed) {
  vec2 q = p / cell;
  vec2 id = floor(q);
  vec3 h = hash23(id + seed);
  vec2 d = fract(q) - 0.5 - (h.xy - 0.5) * 0.4;
  float fw = max(fwidth(q.x), fwidth(q.y));
  float m = (1.0 - smoothstep(0.34 - fw, 0.34 + fw, length(d))) * (1.0 - smoothstep(0.35, 0.9, fw));
  vec3 note = h.z < 0.36 ? base * vec3(1.16, 1.1, 0.8) : h.z < 0.66 ? base * vec3(0.76, 0.93, 1.16) : h.z < 0.84 ? base * vec3(1.2, 0.92, 0.72)
    : h.z < 0.93 ? mix(base, vec3(0.93, 0.68, 0.34), 0.6) : mix(base, vec3(0.30, 0.38, 0.70), 0.6);
  return mix(base, note, m * 0.8);
}
void main() {
  vec2 p = vWp.xz;
  vec3 base = texture2D(tMap, (p - uMapRect.xy) * uMapRect.zw).rgb;
  vec3 col = stipple(p, 0.045, base, 1.0);
  col = stipple(p + 0.031, 0.14, col, 5.0);
  col = stipple(p + 0.4, 0.44, col, 9.0);
  gl_FragColor = vec4(col * 0.97, 1.0);
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
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float el = asin(clamp(d.y, -1.0, 1.0));
  float az = atan(d.x, -d.z);
  // A pale summer sky: cream at the horizon, clear blue above.
  vec3 base = mix(vec3(0.93, 0.92, 0.84), vec3(0.72, 0.83, 0.93), smoothstep(0.0, 0.35, el));
  base = mix(base, vec3(0.56, 0.72, 0.90), smoothstep(0.3, 1.1, el));
  // Dots on the dome, in courses with a whole number of cells.
  float rowH = 0.0045;
  float row = floor(el / rowH);
  float cells = max(floor(K_TAU * cos((row + 0.5) * rowH) / rowH), 8.0);
  vec2 q = vec2((az / K_TAU + 0.5) * cells + 0.5 * mod(row, 2.0), el / rowH);
  vec3 h = hash23(vec2(mod(floor(q.x), cells), row) + 3.0);
  vec2 f = fract(q) - 0.5 - (h.xy - 0.5) * 0.35;
  float fw = fwidth(q.y);
  float m = (1.0 - smoothstep(0.36 - fw, 0.36 + fw, length(f))) * (1.0 - smoothstep(0.4, 1.0, fw));
  vec3 note = h.z < 0.42 ? vec3(0.60, 0.76, 0.94) : h.z < 0.72 ? vec3(0.98, 0.95, 0.84) : h.z < 0.9 ? vec3(0.96, 0.84, 0.80) : vec3(0.74, 0.74, 0.92);
  vec3 col = mix(base, mix(base, note, 0.62), m);
  col = mix(vec3(0.72, 0.80, 0.78), col, smoothstep(-0.02, 0.0, el));
  gl_FragColor = vec4(col, 1.0);
}
`;

const POST_FRAG = /* glsl */ `
vec3 scene(vec2 uv) { return texture2D(tScene, uv).rgb; }
// A course of painted dots for the border.
float borderDot(vec2 p, float cell, float seed, out vec3 h) {
  vec2 q = p / cell;
  h = hash23(floor(q) + seed);
  vec2 d = fract(q) - 0.5 - (h.xy - 0.5) * 0.34;
  return 1.0 - smoothstep(0.30, 0.40, length(d));
}
void main() {
  float s = uRes.y / 760.0;
  vec2 cv = gl_FragCoord.xy / s;
  vec2 size = uRes / s;
  vec3 col = scene(vUv);
  // The colours stay as they were set down: only the canvas shows through.
  col *= 0.955 + 0.075 * canvasWeave(cv);

  // The painted border: a band of dots in the complements of the picture beside it.
  float band = 15.0;
  float edge = min(min(cv.x, size.x - cv.x), min(cv.y, size.y - cv.y));
  float inBand = 1.0 - smoothstep(band - 1.0, band + 1.0, edge);
  if (inBand > 0.0) {
    vec2 inner = clamp(cv, vec2(band + 8.0), size - band - 8.0) / size;
    vec3 near = scene(inner);
    float lum = dot(near, vec3(0.3, 0.6, 0.1));
    // Dark beside light, warm beside cool.
    vec3 ground = mix(vec3(0.20, 0.22, 0.48), vec3(0.42, 0.24, 0.42), smoothstep(0.35, 0.7, lum));
    vec3 h1; vec3 h2;
    float d1 = borderDot(cv, 4.6, 2.0, h1);
    float d2 = borderDot(cv + 2.3, 4.6, 7.0, h2);
    vec3 comp = clamp(vec3(lum * 1.5) - near + 0.25, 0.0, 1.0);
    vec3 n1 = h1.z < 0.34 ? vec3(0.86, 0.45, 0.20) : h1.z < 0.6 ? vec3(0.22, 0.30, 0.66) : h1.z < 0.8 ? comp : vec3(0.72, 0.25, 0.22);
    vec3 n2 = h2.z < 0.4 ? vec3(0.30, 0.36, 0.72) : h2.z < 0.7 ? vec3(0.92, 0.62, 0.28) : comp * 0.9;
    vec3 border = mix(mix(ground, n1, d1), n2, d2 * 0.9);
    border *= 0.955 + 0.075 * canvasWeave(cv);
    col = mix(col, border, inBand);
  }
  // A thin dark line parts the border from the picture, like the edge of the stretcher.
  col *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 1.6, abs(edge - band - 1.0)));
  col *= vignette(vUv, 0.16);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 37.0) - 0.5) * 0.008;
  gl_FragColor = vec4(col, 1.0);
}
`;

/** One dab: a disc of eight sides, a little uneven, like a touch of a round brush. */
function buildDabGeometry(): THREE.BufferGeometry {
  const radii = [1.0, 0.95, 1.0, 0.93, 1.0, 0.96, 1.0, 0.94];
  const pos: number[] = [];
  radii.forEach((r, i) => {
    const a = (i / radii.length) * Math.PI * 2 + 0.2;
    pos.push(Math.cos(a) * r, Math.sin(a) * r, 0);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 7]);
  return g;
}

// ---------------------------------------------------------------------------

export function createGrandeJatte(): PaintingScene {
  const scene = new THREE.Scene();
  const near = 0.15, far = 1600;
  const rand = mulberry32(1884);
  const time = { value: 0 };
  const pixel = { value: 0.001 };

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(far * 0.9, 48, 24),
    new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false }),
  );
  sky.frustumCulled = false;
  scene.add(sky);

  const groundMap = bakeGroundMap();
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(far * 1.7, far * 1.7),
    new THREE.ShaderMaterial({
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
      uniforms: { tMap: { value: groundMap }, uMapRect: { value: new THREE.Vector4(MAP_X0, MAP_Z0, 1 / MAP_SPAN, 1 / MAP_SPAN) } },
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.frustumCulled = false;
  scene.add(ground);

  const solid = new Solid();
  const dots = new Dots(900000);
  layGround(dots, 225000, 130000, rand);
  const groundDots = dots.count;
  // Each kind of figure is sculpted once, at the finest cell that any of its places asks for.
  const sculpts = new Map<FigureKind, Sculpt>();
  for (const f of FIGURES) {
    if (sculpts.has(f.kind)) continue;
    const cell = Math.min(...FIGURES.filter((o) => o.kind === f.kind).map((o) => o.cell));
    sculpts.set(f.kind, sculptFigure(f.kind, cell));
  }
  for (const f of FIGURES) {
    const sculpt = sculpts.get(f.kind);
    if (!sculpt) throw new Error(`No sculpt for figure kind "${f.kind}"`);
    buildFigure(solid, dots, f, sculpt, rand);
  }
  const figureDots = dots.count - groundDots;
  for (const t of TREES) buildTree(solid, dots, t, false, rand);
  for (const t of farTrees(rand)) buildTree(solid, dots, t, true, rand);
  buildRiver(solid, dots, rand);
  buildFarBank(solid, dots, rand);

  const solidMesh = new THREE.Mesh(
    solid.build(),
    new THREE.ShaderMaterial({ vertexShader: SOLID_VERT, fragmentShader: SOLID_FRAG, side: THREE.DoubleSide }),
  );
  solidMesh.frustumCulled = false;
  scene.add(solidMesh);

  const dotMesh = new THREE.InstancedMesh(
    buildDabGeometry(),
    new THREE.ShaderMaterial({ vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, uniforms: { uTime: time, uPixel: pixel } }),
    dots.count,
  );
  (dotMesh.instanceMatrix.array as Float32Array).set(dots.data.subarray(0, dots.count * 16));
  dotMesh.instanceMatrix.needsUpdate = true;
  dotMesh.frustumCulled = false;
  scene.add(dotMesh);

  return {
    scene,
    meta: {
      title: 'A Sunday Afternoon on the Island of La Grande Jatte',
      artist: 'Georges Seurat · 1884',
      technique: `${Math.round(dots.count / 1000)}k instanced pigment dots in space: ${Math.round(groundDots / 1000)}k laid on the lawn and the river, most of them from the painter's eye, ${Math.round(figureDots / 1000)}k sown on figures sculpted as distance fields, the rest on the elms. Each dot is one pigment of a divided colour; the eye mixes them at the painting view.`,
    },
    presets: [
      { name: 'The Painting', position: EYE, target: EYE_TARGET, fov: EYE_FOV },
      { name: 'Among the Promenaders', position: [4.6, 1.2, 7.6], target: [0.2, 1.15, 2.6], fov: 50 },
      { name: 'The River Bank', position: [-4.3, 1.0, 1.5], target: [-7.5, 1.5, -30], fov: 55 },
      { name: 'Above the Island', position: [9, 19, 22], target: [-1.5, 0, -7], fov: 42 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near,
    far,
    flySpeed: 5,
    maxDistance: 110,
    floorAt: () => 0.3,
    update(ctx: FrameContext): void {
      time.value = ctx.time;
      sky.position.copy(ctx.camera.position);
      pixel.value = (2 * Math.tan((ctx.camera.fov * Math.PI) / 360)) / ctx.height;
    },
    dispose(): void {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
        if (o instanceof THREE.InstancedMesh) o.dispose();
      });
      groundMap.dispose();
    },
  };
}

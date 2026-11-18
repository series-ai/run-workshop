// Syncopated Grid No. 1 — an original geometric study.
//
// The canvas is a relief model on a gallery wall. Every part is one instance
// of a unit box: the cream slab, low cream plinths, ochre streets, gold ring
// circuits, colour plazas with stepped towers, and the small blocks that run
// on the streets. All parts sit on a 61 x 61 cell grid, so the straight-on
// view shows flat colour rectangles only. The runners are a small cell
// simulation with a swung sixteenth-note clock: each street has a rhythm of
// sixteen steps, blocks circle the rings and shuttle on the straight streets,
// and a block moves one cell on a step of its street when the next cell is
// free. The shadows march a live height map that the runners are stamped into.

import * as THREE from 'three';
import { GLSL_NOISE } from '../glsl';
import type { FrameContext, PaintingScene } from '../host';
import { hex, mulberry32, type RGB } from '../util';

const N = 61;
const SIZE = 12;
const CELL = SIZE / N;
const CENTER_Y = 8;
const SLAB = 0.4;
const STREET_H = 0.09;
const RING_H = 0.115;
const TIER_STEP = 0.27;
/** Texels of the height map along one cell. */
const RES = 8;
const HEIGHT_MAX = 2.0;
/** Seconds for one sixteenth note. */
const STEP = 0.19;
/** Share of a step by which every second sixteenth comes late. */
const SWING = 0.34;
/** Seconds that a runner takes to glide into its new cell. */
const GLIDE = 0.15;
/** Share of the steps on which a runner with a free cell ahead does not move. */
const REST = 0.1;
const LIGHT = new THREE.Vector3(0.52, 0.6, 0.6).normalize();

const OCHRE = hex(0xd69a1b);
const GOLD = hex(0xeabb35);
const COBALT = hex(0x1b3c8e);
const VERMILION = hex(0xdb3b1d);
const GREY = hex(0xb9b1a3);
const CREAM = hex(0xf1ebdb);
const WALNUT = hex(0x2c1c12);

const K_GROUND = 0, K_STREET = 1, K_BLOCK = 2, K_RUNNER = 3, K_FRAME = 4;

/** World x of a cell coordinate (cell edges are integers). */
function wx(cx: number): number {
  return (cx - N / 2) * CELL;
}

/** World y of a cell coordinate. Cell rows count down from the top edge. */
function wy(cy: number): number {
  return CENTER_Y + (N / 2 - cy) * CELL;
}

// ---------------------------------------------------------------------------
// Streets. A track is an ordered path of cells. A ring closes on itself.
// ---------------------------------------------------------------------------

interface Track {
  /** Cell keys (row * N + column) in travel order. */
  cells: number[];
  ring: boolean;
  /** Bit i set: the track moves on sixteenth i of the bar. */
  rhythm: number;
  /** Inclusive cell rectangles that draw the track. */
  strips: Array<[number, number, number, number]>;
}

function rhythm(pattern: string): number {
  if (pattern.length !== 16) throw new Error(`A rhythm needs 16 steps, received ${pattern.length}: "${pattern}"`);
  let bits = 0;
  for (let i = 0; i < 16; i++) {
    const c = pattern[i];
    if (c !== 'x' && c !== '-') throw new Error(`A rhythm step must be "x" or "-", received "${c}"`);
    if (c === 'x') bits |= 1 << i;
  }
  return bits;
}

/** Straight street along a row (horizontal) or a column. */
function street(horizontal: boolean, index: number, from: number, to: number, pattern: string): Track {
  const cells: number[] = [];
  for (let c = from; c <= to; c++) cells.push(horizontal ? index * N + c : c * N + index);
  return { cells, ring: false, rhythm: rhythm(pattern), strips: [horizontal ? [from, index, to, index] : [index, from, index, to]] };
}

/** Rectangular circuit. turn = 1 runs clockwise on the canvas, -1 runs the other way. */
function circuit(x0: number, y0: number, x1: number, y1: number, turn: 1 | -1, pattern: string): Track {
  const cells: number[] = [];
  for (let x = x0; x < x1; x++) cells.push(y0 * N + x);
  for (let y = y0; y < y1; y++) cells.push(y * N + x1);
  for (let x = x1; x > x0; x--) cells.push(y1 * N + x);
  for (let y = y1; y > y0; y--) cells.push(y * N + x0);
  if (turn < 0) cells.reverse();
  return { cells, ring: true, rhythm: rhythm(pattern), strips: [[x0, y0, x1, y0], [x0, y1, x1, y1], [x0, y0 + 1, x0, y1 - 1], [x1, y0 + 1, x1, y1 - 1]] };
}

const TRACKS: Track[] = [
  circuit(16, 7, 31, 22, 1, 'x-x-x-x-x-x-x-x-'),
  circuit(40, 31, 53, 41, -1, 'x--x--x-x--x--x-'),
  circuit(26, 36, 33, 49, 1, 'x-xx-xx-x-xx-xx-'),
  street(false, 2, 0, 60, 'x---x---x---x---'),
  street(false, 7, 26, 60, '--x---x---x---x-'),
  street(false, 12, 0, 48, 'x--x--x---x-x---'),
  street(false, 22, 30, 60, '-x-x-x-x-x-x-x-x'),
  street(false, 36, 0, 60, 'x-x---x-x-x---x-'),
  street(false, 47, 0, 31, 'x---x-x-x---x-x-'),
  street(false, 57, 12, 60, '--x-x---x-x---x-'),
  street(true, 3, 0, 60, 'x-x-x---x-x-x---'),
  street(true, 15, 12, 60, 'x--x--x--x--x-x-'),
  street(true, 27, 0, 36, '-x---x-x-x---x-x'),
  street(true, 45, 0, 60, 'x-x-x-x-x-x-x-x-'),
  street(true, 51, 7, 47, 'x---x--x--x-x---'),
  street(true, 57, 0, 60, '--x-x-x---x-x-x-'),
];

/** One tier: an inclusive cell rectangle (x0, y0, x1, y1) and a colour. y runs down from the top edge. */
type Tier = [number, number, number, number, RGB];

interface Block {
  /** Height of the first tier above the slab. */
  rise: number;
  /** The first tier is the plaza. Each next tier stands one step higher. */
  tiers: Tier[];
}

const BLOCKS: Block[] = [
  // Grand cobalt plaza with a vermilion tower, right of the centre.
  { rise: 0.2, tiers: [[38, 17, 45, 29, COBALT], [40, 19, 43, 23, VERMILION], [41, 20, 42, 21, CREAM]] },
  // Tall warm-grey plaza on the left with a cobalt tower low in it.
  { rise: 0.16, tiers: [[4, 5, 10, 24, GREY], [5, 15, 8, 22, COBALT], [6, 17, 7, 20, VERMILION]] },
  // The two courts of the large ring.
  { rise: 0.24, tiers: [[18, 9, 29, 13, VERMILION], [20, 10, 23, 12, GREY], [21, 11, 22, 11, COBALT]] },
  { rise: 0.3, tiers: [[24, 17, 29, 20, COBALT]] },
  { rise: 0.14, tiers: [[18, 17, 21, 20, GREY], [19, 18, 20, 19, VERMILION]] },
  // Court of the right ring: the highest tower of the canvas.
  { rise: 0.14, tiers: [[42, 33, 51, 39, GREY], [46, 34, 50, 38, VERMILION], [47, 35, 49, 37, COBALT], [48, 36, 48, 36, CREAM]] },
  { rise: 0.26, tiers: [[50, 22, 54, 28, VERMILION], [51, 23, 53, 26, COBALT]] },
  { rise: 0.18, tiers: [[49, 17, 52, 19, GREY]] },
  { rise: 0.22, tiers: [[14, 33, 20, 43, COBALT], [15, 35, 18, 40, GREY], [16, 36, 17, 38, VERMILION]] },
  { rise: 0.34, tiers: [[28, 38, 31, 43, VERMILION], [29, 40, 30, 41, GREY]] },
  { rise: 0.2, tiers: [[39, 6, 44, 9, GREY], [40, 7, 41, 8, VERMILION]] },
  { rise: 0.28, tiers: [[50, 6, 58, 9, COBALT], [55, 7, 57, 8, CREAM]] },
  { rise: 0.4, tiers: [[4, 30, 5, 36, VERMILION]] },
  { rise: 0.18, tiers: [[9, 37, 10, 43, GREY], [9, 39, 10, 40, COBALT]] },
  { rise: 0.16, tiers: [[24, 29, 34, 33, GREY], [30, 30, 33, 32, VERMILION]] },
  { rise: 0.3, tiers: [[28, 46, 31, 48, COBALT]] },
  { rise: 0.22, tiers: [[39, 47, 45, 49, VERMILION]] },
  { rise: 0.15, tiers: [[49, 47, 54, 49, GREY], [52, 48, 53, 48, COBALT]] },
  { rise: 0.24, tiers: [[9, 53, 13, 55, COBALT]] },
  { rise: 0.16, tiers: [[26, 53, 33, 55, GREY], [28, 54, 30, 54, VERMILION]] },
  { rise: 0.2, tiers: [[49, 52, 55, 55, COBALT], [51, 53, 53, 54, VERMILION]] },
  { rise: 0.3, tiers: [[14, 59, 19, 60, VERMILION]] },
  { rise: 0.14, tiers: [[38, 59, 46, 60, GREY]] },
  { rise: 0.36, tiers: [[13, 5, 14, 13, COBALT]] },
  { rise: 0.2, tiers: [[33, 5, 34, 9, GREY]] },
  { rise: 0.32, tiers: [[37, 34, 38, 40, VERMILION]] },
  { rise: 0.42, tiers: [[55, 33, 55, 43, COBALT]] },
  { rise: 0.18, tiers: [[59, 18, 60, 26, GREY]] },
  { rise: 0.3, tiers: [[59, 34, 59, 40, VERMILION]] },
  { rise: 0.26, tiers: [[0, 8, 1, 13, VERMILION]] },
  { rise: 0.2, tiers: [[0, 30, 1, 39, COBALT]] },
  { rise: 0.16, tiers: [[3, 47, 5, 49, GREY]] },
  { rise: 0.28, tiers: [[14, 24, 20, 25, VERMILION]] },
  { rise: 0.2, tiers: [[26, 24, 34, 25, COBALT]] },
];

// ---------------------------------------------------------------------------
// Instance records. One record is 16 floats, stored as the instance matrix.
//   column 0: centre.xy, foot height, top height
//   column 1: half size.xy, kind, pulse amount
//   column 2: colour.rgb, pulse phase in the bar
//   column 3: scale in the canvas plane, scale of the height, unused, unused
// ---------------------------------------------------------------------------

class Records {
  readonly data: number[] = [];

  /** Adds a box over an inclusive cell rectangle, from height z0 to z1. */
  cells(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, col: RGB, kind: number, pulse = 0, phase = 0): void {
    this.box((wx(x0) + wx(x1 + 1)) / 2, (wy(y0) + wy(y1 + 1)) / 2, ((x1 - x0 + 1) * CELL) / 2, ((y1 - y0 + 1) * CELL) / 2, z0, z1, col, kind, pulse, phase);
  }

  box(cx: number, cy: number, hx: number, hy: number, z0: number, z1: number, col: RGB, kind: number, pulse = 0, phase = 0): void {
    this.data.push(cx, cy, z0, z1, hx, hy, kind, pulse, col[0], col[1], col[2], phase, 1, 1, 0, 0);
  }

  get count(): number {
    return this.data.length / 16;
  }
}

// ---------------------------------------------------------------------------
// Runners
// ---------------------------------------------------------------------------

/** Time at which sixteenth k starts. Every second sixteenth is late. */
function stepTime(k: number): number {
  return (k + ((k & 1) === 1 ? SWING : 0)) * STEP;
}

/** The sixteenth that holds time t. */
function stepAt(t: number): number {
  const k = Math.floor(t / STEP);
  return (k & 1) === 1 && t < stepTime(k) ? k - 1 : k;
}

interface Runner {
  track: number;
  /** Index into the cells of the track. */
  at: number;
  prev: number;
  dir: 1 | -1;
  movedAt: number;
  wait: number;
  height: number;
  color: RGB;
}

const MAX_REPLAY = 2400;

class Runners {
  runners: Runner[] = [];
  private occupied = new Uint8Array(N * N);
  private byTrack: number[][] = [];
  private rand: () => number = mulberry32(0);
  private step = -1;
  private readonly seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.reset();
  }

  /** Puts the runners back on their start cells. The count never changes. */
  private reset(): void {
    this.rand = mulberry32(this.seed);
    const rand = this.rand;
    this.occupied = new Uint8Array(N * N);
    this.runners = [];
    this.byTrack = TRACKS.map(() => []);
    this.step = -1;
    TRACKS.forEach((track, ti) => {
      const share = track.ring ? 0.3 : 0.2;
      track.cells.forEach((key, i) => {
        // A crossing belongs to two tracks. It holds one runner at most.
        if (this.occupied[key] || rand() > share) return;
        const r = rand();
        const kind = r < 0.36 ? 0 : r < 0.7 ? 1 : r < 0.88 ? 2 : 3;
        this.occupied[key] = 1;
        this.byTrack[ti].push(this.runners.length);
        this.runners.push({
          track: ti, at: i, prev: i, dir: rand() < 0.5 ? 1 : -1, movedAt: -100, wait: 0,
          height: [0.25, 0.31, 0.2, 0.17][kind] + rand() * 0.04,
          color: [VERMILION, COBALT, GREY, CREAM][kind],
        });
      });
    });
  }

  /** Advances the simulation to the sixteenth that holds time t. */
  advance(t: number): void {
    const target = stepAt(Math.max(t, 0));
    // Time went back: start again and replay. The state is a pure function of the step count.
    if (target < this.step) this.reset();
    // After a long jump, replay only the last steps.
    if (target - this.step > MAX_REPLAY) this.step = target - MAX_REPLAY;
    while (this.step < target) {
      this.step++;
      this.tick(this.step);
    }
  }

  private tick(k: number): void {
    const at = stepTime(k);
    TRACKS.forEach((track, ti) => {
      if (((track.rhythm >> (k & 15)) & 1) === 0) return;
      const ids = this.byTrack[ti];
      const len = track.cells.length;
      // The runner that is farthest along goes first, so that a queue moves as one train.
      if (track.ring) ids.sort((a, b) => this.runners[b].at - this.runners[a].at);
      for (const id of ids) {
        const r = this.runners[id];
        let next: number;
        if (track.ring) {
          next = (r.at + 1) % len;
        } else {
          // A shuttle turns at the end of its street.
          if (r.at + r.dir < 0 || r.at + r.dir >= len) r.dir = r.dir === 1 ? -1 : 1;
          next = r.at + r.dir;
        }
        if (this.occupied[track.cells[next]] === 0) {
          // A runner sometimes rests for one step. This pulls a queue apart again.
          if (this.rand() < REST) continue;
          this.occupied[track.cells[r.at]] = 0;
          this.occupied[track.cells[next]] = 1;
          r.prev = r.at;
          r.at = next;
          r.movedAt = at;
          r.wait = 0;
        } else if (!track.ring && ++r.wait >= 2) {
          // A shuttle that meets another one turns back.
          r.dir = r.dir === 1 ? -1 : 1;
          r.wait = 0;
        }
      }
    });
  }

  /**
   * Writes the runners for time t: their records into the instance array, and
   * their footprints into the height map that the shadows read.
   */
  write(out: Float32Array, first: number, heights: Uint8Array, t: number): void {
    const R = N * RES;
    for (let i = 0; i < this.runners.length; i++) {
      const r = this.runners[i];
      const cells = TRACKS[r.track].cells;
      const f = Math.min(Math.max((t - r.movedAt) / GLIDE, 0), 1);
      // Ease out: the runner leaves at once and settles into the cell.
      const e = 1 - (1 - f) * (1 - f);
      const from = cells[r.prev], to = cells[r.at];
      const cx = (from % N) + ((to % N) - (from % N)) * e;
      const cy = Math.floor(from / N) + (Math.floor(to / N) - Math.floor(from / N)) * e;
      // A small kick on each move.
      const lift = 1 + 0.3 * Math.sin(Math.PI * f) * (1 - f);
      const o = (first + i) * 16;
      out[o] = wx(cx + 0.5);
      out[o + 1] = wy(cy + 0.5);
      out[o + 2] = 0;
      out[o + 3] = r.height;
      out[o + 4] = CELL / 2;
      out[o + 5] = CELL / 2;
      out[o + 6] = K_RUNNER;
      out[o + 7] = 0;
      out[o + 8] = r.color[0];
      out[o + 9] = r.color[1];
      out[o + 10] = r.color[2];
      out[o + 11] = 0;
      out[o + 12] = 0.86;
      out[o + 13] = lift;
      out[o + 14] = 0;
      out[o + 15] = 0;

      const inset = 0.07 * RES;
      const px0 = Math.max(Math.round(cx * RES + inset), 0), px1 = Math.min(Math.round((cx + 1) * RES - inset), R);
      const py0 = Math.max(Math.round(cy * RES + inset), 0), py1 = Math.min(Math.round((cy + 1) * RES - inset), R);
      const byte = Math.min(Math.round(((r.height * lift) / HEIGHT_MAX) * 255), 255);
      for (let y = py0; y < py1; y++) {
        // Texture row 0 is the bottom edge of the canvas.
        const row = (R - 1 - y) * R;
        for (let x = px0; x < px1; x++) {
          if (byte > heights[row + x]) heights[row + x] = byte;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

interface Layout {
  records: Records;
  /** Height map of the parts that do not move, one byte for each texel. */
  staticHeights: Uint8Array;
  blocks: number;
}

function buildLayout(): Layout {
  const rand = mulberry32(6161);
  const records = new Records();
  // What stands in each cell: 0 cream, 1 street, 2 block.
  const grid = new Uint8Array(N * N);
  const R = N * RES;
  const hmap = new Float32Array(R * R);
  const stamp = (x0: number, y0: number, x1: number, y1: number, h: number): void => {
    for (let y = y0 * RES; y < (y1 + 1) * RES; y++) {
      for (let x = x0 * RES; x < (x1 + 1) * RES; x++) {
        // Texture row 0 is the bottom edge of the canvas.
        const k = (R - 1 - y) * R + x;
        if (h > hmap[k]) hmap[k] = h;
      }
    }
  };

  // The canvas slab and a dark float frame around it.
  const half = SIZE / 2;
  records.box(0, CENTER_Y, half, half, -SLAB, 0, CREAM, K_GROUND);
  const lip = 0.11, gap = 0.05, out = half + gap + lip / 2;
  records.box(0, CENTER_Y + out, half + gap + lip, lip / 2, -SLAB, 0.2, WALNUT, K_FRAME);
  records.box(0, CENTER_Y - out, half + gap + lip, lip / 2, -SLAB, 0.2, WALNUT, K_FRAME);
  records.box(-out, CENTER_Y, lip / 2, half + gap, -SLAB, 0.2, WALNUT, K_FRAME);
  records.box(out, CENTER_Y, lip / 2, half + gap, -SLAB, 0.2, WALNUT, K_FRAME);

  for (const track of TRACKS) {
    const h = track.ring ? RING_H : STREET_H;
    for (const [x0, y0, x1, y1] of track.strips) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y * N + x] = 1;
      records.cells(x0, y0, x1, y1, 0, h, track.ring ? GOLD : OCHRE, K_STREET);
      stamp(x0, y0, x1, y1, h);
    }
  }

  BLOCKS.forEach((block) => {
    // Each tower takes its accent on its own sixteenth of the bar.
    const phase = Math.floor(rand() * 16) / 16;
    const pulse = block.tiers.length > 1 ? 0.07 + 0.08 * rand() : 0.03 + 0.03 * rand();
    block.tiers.forEach((tier, level) => {
      const [x0, y0, x1, y1, col] = tier;
      if (x0 < 0 || y0 < 0 || x1 >= N || y1 >= N || x1 < x0 || y1 < y0) throw new Error(`Tier ${x0},${y0}..${x1},${y1} does not fit the ${N} x ${N} grid`);
      if (level === 0) {
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            if (grid[y * N + x] !== 0) throw new Error(`Block at cell ${x},${y} overlaps a street or another block`);
            grid[y * N + x] = 2;
          }
        }
      } else {
        const [bx0, by0, bx1, by1] = block.tiers[level - 1];
        if (x0 < bx0 || y0 < by0 || x1 > bx1 || y1 > by1) throw new Error(`Tier ${x0},${y0}..${x1},${y1} does not stand on the tier below it`);
      }
      const h = block.rise + level * TIER_STEP;
      records.cells(x0, y0, x1, y1, 0, h, col, K_BLOCK, pulse, phase);
      stamp(x0, y0, x1, y1, h);
    });
  });

  // The cream ground between the streets: greedy rectangles, each a low plinth
  // with its own white. Each rectangle grows along its longer free run first.
  const taken = new Uint8Array(N * N);
  const free = (x: number, y: number): boolean => x < N && y < N && grid[y * N + x] === 0 && taken[y * N + x] === 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!free(x, y)) continue;
      let x1 = x;
      while (free(x1 + 1, y)) x1++;
      let y1 = y;
      for (;;) {
        let clear = true;
        for (let k = x; k <= x1; k++) if (!free(k, y1 + 1)) { clear = false; break; }
        if (!clear) break;
        y1++;
      }
      for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) taken[yy * N + xx] = 1;
      const h = 0.02 + 0.045 * rand();
      const k = 0.985 + 0.03 * rand();
      const warm = (rand() - 0.5) * 0.014;
      records.cells(x, y, x1, y1, 0, h, [CREAM[0] * k + warm, CREAM[1] * k, CREAM[2] * k - warm], K_GROUND);
      stamp(x, y, x1, y1, h);
    }
  }

  const bytes = new Uint8Array(R * R);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.min(Math.round((hmap[i] / HEIGHT_MAX) * 255), 255);
  return { records, staticHeights: bytes, blocks: BLOCKS.length };
}

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const BOX_VERT = /* glsl */ `
uniform float uBar;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vCol;
varying float vKind;
varying float vUp;
varying vec2 vRim;
varying vec2 vHalf;
void main() {
  // The instance matrix holds the box record, not a transform.
  vec4 r0 = instanceMatrix[0];
  vec4 r1 = instanceMatrix[1];
  vec4 r2 = instanceMatrix[2];
  vec4 r3 = instanceMatrix[3];
  // Each tower jumps on its own sixteenth of the bar and falls back, like a struck key.
  float since = fract(uBar - r2.w);
  float pulse = r1.w * exp(-since * 7.0);
  float up = position.z * 0.5 + 0.5;
  float top = r0.z + (r0.w - r0.z) * (1.0 + pulse) * r3.y;
  vec3 p = vec3(r0.xy + position.xy * r1.xy * r3.x, mix(r0.z, top, up));
  vWp = p;
  vN = normal;
  vCol = r2.rgb;
  vKind = r1.z;
  vUp = up;
  vRim = position.xy;
  vHalf = r1.xy * r3.x;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const BOX_FRAG = /* glsl */ `
${GLSL_NOISE}
uniform sampler2D tHeight;
uniform vec3 uCam;
uniform vec3 uLight;
uniform float uShade;
varying vec3 vWp;
varying vec3 vN;
varying vec3 vCol;
varying float vKind;
varying float vUp;
varying vec2 vRim;
varying vec2 vHalf;
// Height of the relief at p. A higher lod gives the mean height of a wider area.
float heightAt(vec2 p, float lod) {
  vec2 uv = (p - vec2(${(-SIZE / 2).toFixed(4)}, ${(CENTER_Y - SIZE / 2).toFixed(4)})) / ${SIZE.toFixed(1)};
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return textureLod(tHeight, uv, lod).r * ${HEIGHT_MAX.toFixed(1)};
}
// Share of the light that reaches q: march the height map toward the light.
// The sample widens with the distance, so the edge of a shadow softens as it goes.
float reliefLight(vec3 q) {
  vec2 dir = normalize(uLight.xy);
  float climb = uLight.z / length(uLight.xy);
  float lit = 1.0;
  float s = 0.025;
  for (int i = 0; i < 11; i++) {
    float h = heightAt(q.xy + dir * s, log2(max(s * ${(((N * RES) / SIZE) * 0.28).toFixed(2)}, 1.0)) + 0.7);
    lit = min(lit, clamp(0.5 + (q.z + s * climb - h) / (0.022 + 0.11 * s), 0.0, 1.0));
    s *= 1.5;
  }
  return lit;
}
// Ambient shade: taller neighbours close in.
float reliefShade(vec3 q) {
  float a = max(heightAt(q.xy, 2.6) - q.z, 0.0) * 2.0;
  a += max(heightAt(q.xy + vec2(0.14, 0.0), 2.0) - q.z, 0.0);
  a += max(heightAt(q.xy - vec2(0.14, 0.0), 2.0) - q.z, 0.0);
  a += max(heightAt(q.xy + vec2(0.0, 0.14), 2.0) - q.z, 0.0);
  a += max(heightAt(q.xy - vec2(0.0, 0.14), 2.0) - q.z, 0.0);
  return 1.0 - exp(-a * 1.3);
}
void main() {
  vec3 n = normalize(vN);
  float top = step(0.5, n.z);
  int kind = int(vKind + 0.5);
  vec3 col = vCol;
  if (kind == ${K_FRAME}) {
    // Walnut frame: the grain runs along each rail.
    vec2 g = vHalf.x > vHalf.y ? vWp.xy : vWp.yx;
    col *= 0.75 + 0.5 * fbm(vec2(g.x * 1.2, g.y * 26.0));
  }

  // Side faces: one tone for each direction, darker toward the foot.
  float side = (0.7 + 0.24 * dot(n, uLight)) * (0.82 + 0.18 * vUp);
  col *= mix(side, 1.0, top);

  // Cast shadow and ambient shade from the live height map, on every face.
  vec3 q = vWp + n * 0.012;
  float dark = clamp((1.0 - reliefLight(q)) * 0.72 + reliefShade(q) * 0.34, 0.0, 0.84) * uShade;
  col = mix(col, col * vec3(0.38, 0.4, 0.58), dark * mix(0.7, 1.0, top));

  // Arris: the edge of each top face that looks at the light takes a thin bright
  // line, the far edge a thin dark one. It is zero when the eye is square to the canvas.
  vec2 edge = (1.0 - abs(vRim)) * vHalf;
  vec2 toward = sign(vRim) * uLight.xy;
  float arris = (1.0 - smoothstep(0.0, 0.022, edge.x)) * toward.x + (1.0 - smoothstep(0.0, 0.022, edge.y)) * toward.y;
  col *= 1.0 + 0.22 * arris * top * uShade;

  // Enamel sheen. It is zero when the eye is square to the canvas.
  vec3 v = normalize(uCam - vWp);
  float sheen = pow(max(dot(n, normalize(uLight + v)), 0.0), 64.0);
  col += sheen * 0.18 * vec3(1.0, 0.98, 0.93);

  // Hand-laid paint: a faint stroke grain along the longer side of each rectangle.
  vec2 lay = vHalf.x > vHalf.y ? vWp.xy : vWp.yx;
  float grain = vnoise(lay * vec2(9.0, 48.0) + vKind * 17.0) + 0.5 * vnoise(lay * vec2(31.0, 140.0));
  col *= 0.982 + 0.014 * grain;
  gl_FragColor = vec4(col, 1.0);
}
`;

const ROOM_VERT = /* glsl */ `
varying vec3 vWp;
varying vec3 vN;
void main() {
  vWp = position;
  vN = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const CARD = { x: SIZE / 2 + 1.7, y: CENTER_Y - SIZE / 2 + 0.75, hx: 0.6, hy: 0.38 };
/** Where the shadow of the canvas falls on the wall: opposite to the light, by the depth of the slab. */
const WALL_SHADOW = new THREE.Vector2(-LIGHT.x, -LIGHT.y).multiplyScalar((SLAB + 0.2) / LIGHT.z);

const ROOM_FRAG = /* glsl */ `
${GLSL_NOISE}
varying vec3 vWp;
varying vec3 vN;
float sdRect(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
void main() {
  vec3 col;
  if (vN.z > 0.5) {
    // Gallery wall: a wash of light over the canvas, the shadow of the canvas, a label card, a skirting board.
    vec2 p = vWp.xy - vec2(0.0, ${CENTER_Y.toFixed(1)});
    col = vec3(0.925, 0.912, 0.884);
    col *= 1.0 - 0.17 * smoothstep(6.5, 27.0, length((p - vec2(0.6, 1.5)) * vec2(0.72, 1.0)));
    float thrown = sdRect(p - vec2(${WALL_SHADOW.x.toFixed(3)}, ${WALL_SHADOW.y.toFixed(3)}), vec2(${(SIZE / 2 + 0.16).toFixed(2)}));
    col *= 1.0 - 0.3 * (1.0 - smoothstep(-0.3, 0.75, thrown));
    float contact = sdRect(p, vec2(${(SIZE / 2 + 0.16).toFixed(2)}));
    col *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 0.16, contact));
    vec2 c = vWp.xy - vec2(${CARD.x.toFixed(2)}, ${CARD.y.toFixed(2)});
    float card = sdRect(c, vec2(${CARD.hx.toFixed(2)}, ${CARD.hy.toFixed(2)}));
    col *= 1.0 - 0.16 * (1.0 - smoothstep(0.0, 0.09, sdRect(c - vec2(-0.03, -0.04), vec2(${CARD.hx.toFixed(2)}, ${CARD.hy.toFixed(2)}))));
    if (card < 0.0) {
      col = vec3(0.975, 0.97, 0.955);
      // Four lines of small type: a title line and three shorter lines.
      float row = floor((${CARD.hy.toFixed(2)} - 0.1 - c.y) / 0.13);
      float inRow = step(abs(fract((${CARD.hy.toFixed(2)} - 0.1 - c.y) / 0.13) - 0.5), row < 0.5 ? 0.28 : 0.16);
      float len = row < 0.5 ? 0.92 : 0.5 + 0.35 * hash11(row + 3.0);
      float word = step(0.25, vnoise(vec2(c.x * 22.0 + row * 9.0, row)));
      float type = inRow * step(row, 3.5) * step(-0.5, row) * step(c.x + ${CARD.hx.toFixed(2)} - 0.09, len * ${(CARD.hx * 2 - 0.18).toFixed(2)}) * step(0.09 - ${CARD.hx.toFixed(2)}, c.x) * word;
      col = mix(col, vec3(0.22, 0.21, 0.2), type * 0.8);
    }
    float board = 1.0 - smoothstep(0.62, 0.64, vWp.y);
    col = mix(col, vec3(0.86, 0.85, 0.825) * (1.0 - 0.2 * (1.0 - smoothstep(0.56, 0.64, vWp.y))), board);
    col *= 0.985 + 0.03 * vnoise(vWp.xy * 2.6);
  } else {
    // Floor: polished concrete in large bays. It takes a little warm light under the canvas.
    float mottled = fbm(vWp.xz * 0.35) * 0.7 + 0.3 * vnoise(vWp.xz * 3.0);
    col = vec3(0.56, 0.55, 0.53) * (0.86 + 0.24 * mottled);
    vec2 bay = abs(fract(vWp.xz / 7.0 + vec2(0.5, 0.15)) - 0.5) * 7.0;
    col *= 1.0 - 0.3 * (1.0 - smoothstep(0.0, 0.035, min(bay.x, bay.y)));
    col *= 0.66 + 0.34 * smoothstep(0.0, 8.0, vWp.z);
    col += vec3(0.07, 0.055, 0.03) * exp(-vWp.z * 0.16) * (1.0 - smoothstep(4.0, 9.0, abs(vWp.x)));
    col *= 1.0 - 0.22 * smoothstep(14.0, 46.0, length(vWp.xz));
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const POST_FRAG = /* glsl */ `
void main() {
  float s = uRes.y / 760.0;
  vec3 col = texture2D(tScene, vUv).rgb;
  col *= 0.986 + 0.02 * canvasWeave(gl_FragCoord.xy / s * 1.05);
  col *= vignette(vUv, 0.15);
  col += (hash21(gl_FragCoord.xy + fract(uTime) * 47.0) - 0.5) * 0.008;
  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

function buildRoom(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const zw = -SLAB;
  const X = 70, TOP = 44, DEPTH = 70;
  const pos = [
    -X, 0, zw, X, 0, zw, X, TOP, zw, -X, 0, zw, X, TOP, zw, -X, TOP, zw,
    -X, 0, DEPTH, X, 0, DEPTH, X, 0, zw, -X, 0, DEPTH, X, 0, zw, -X, 0, zw,
  ];
  const nor = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

export function createKineticGrid(): PaintingScene {
  const scene = new THREE.Scene();
  // Values are display colours. No colour-space conversion runs on them.
  scene.background = new THREE.Color().setRGB(0.82, 0.812, 0.79);
  const near = 0.08, far = 600;

  const layout = buildLayout();
  const runners = new Runners(61);
  const firstRunner = layout.records.count;
  const total = firstRunner + runners.runners.length;

  // The height map that the shadows read. The runners are stamped into it each frame.
  const R = N * RES;
  const heightBytes = new Uint8Array(R * R);
  const heights = new THREE.DataTexture(heightBytes, R, R, THREE.RedFormat, THREE.UnsignedByteType);
  heights.generateMipmaps = true;
  heights.minFilter = THREE.LinearMipmapLinearFilter;
  heights.magFilter = THREE.LinearFilter;
  heights.wrapS = THREE.ClampToEdgeWrapping;
  heights.wrapT = THREE.ClampToEdgeWrapping;
  heights.colorSpace = THREE.NoColorSpace;

  const uniforms = {
    uBar: { value: 0 },
    tHeight: { value: heights },
    uCam: { value: new THREE.Vector3() },
    uLight: { value: LIGHT },
    uShade: { value: 0.5 },
  };
  const boxes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(2, 2, 2),
    new THREE.ShaderMaterial({ vertexShader: BOX_VERT, fragmentShader: BOX_FRAG, uniforms }),
    total,
  );
  const records = boxes.instanceMatrix.array as Float32Array;
  records.set(layout.records.data);
  const writeRunners = (t: number): void => {
    runners.advance(t);
    if (firstRunner + runners.runners.length !== total) throw new Error(`The runner count changed from ${total - firstRunner} to ${runners.runners.length}`);
    heightBytes.set(layout.staticHeights);
    runners.write(records, firstRunner, heightBytes, t);
    boxes.instanceMatrix.needsUpdate = true;
    heights.needsUpdate = true;
  };
  writeRunners(0);
  boxes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  boxes.frustumCulled = false;
  scene.add(boxes);

  // Both sides draw, so the wall also closes the view from behind the canvas.
  const room = new THREE.Mesh(buildRoom(), new THREE.ShaderMaterial({ vertexShader: ROOM_VERT, fragmentShader: ROOM_FRAG, side: THREE.DoubleSide }));
  room.frustumCulled = false;
  scene.add(room);

  const forward = new THREE.Vector3();

  return {
    scene,
    meta: {
      title: 'Syncopated Grid No. 1',
      artist: 'Original Geometric Study · Kinetic Relief',
      technique: `One instanced relief of ${total} boxes on a 61 × 61 grid: ${runners.runners.length} runners circle three gold rings and shuttle on thirteen ochre streets to a swung sixteen-step clock, ${layout.blocks} stepped plazas pulse on their own beat, soft shadows marched through a live height map, faint when the eye is square to the canvas and full when it tilts.`,
    },
    presets: [
      { name: 'The Canvas', position: [0, CENTER_Y, 94], target: [0, CENTER_Y, 0], fov: 8.4 },
      { name: 'Street Level', position: [-5.6, 4.2, 2.0], target: [1.0, 7.3, 0], fov: 50 },
      { name: 'Tower Quarter', position: [8.8, 12.4, 6.6], target: [wx(44), wy(27), 0.2], fov: 34 },
      { name: 'Raking Light', position: [-10.2, 3.4, 9.2], target: [0.5, 8.1, 0], fov: 38 },
    ],
    postFragment: POST_FRAG,
    postUniforms: {},
    near,
    far,
    flySpeed: 5,
    maxDistance: 150,
    floorAt: () => 0.25,
    update(ctx: FrameContext): void {
      uniforms.uBar.value = ctx.time / (STEP * 16);
      uniforms.uCam.value.copy(ctx.camera.position);
      // The shadows are faint when the eye is square to the canvas and full when it tilts.
      ctx.camera.getWorldDirection(forward);
      const tilt = 1 - Math.abs(forward.z);
      uniforms.uShade.value = 0.16 + 0.84 * Math.min(tilt / 0.06, 1);
      writeRunners(ctx.time);
    },
    dispose(): void {
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      heights.dispose();
    },
  };
}

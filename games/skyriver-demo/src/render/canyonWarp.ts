/**
 * @file canyonWarp.ts — the winding canyon: maps straight "canyon space" onto a closed S-curving loop.
 *
 * T7-3 art-direction pivot. The reference footage winds: the chase banks continuously and the
 * corridor ahead keeps changing direction. Every render system was built in a straight canyon
 * ("canyon space": x across, z along, y up). Rather than rebuild each one, this module bends that
 * straight canyon into a closed loop with one mapping, and every system routes its world positions
 * through it:
 *
 *   world(x, y, v) = C(v) + x * N(v) + y * up      (v = along-canyon arc length, wraps every L)
 *
 * C is the loop's centreline, N its right-hand normal. Rigid parts (tower boxes, signs, cars) are
 * placed at their warped centre and rotated by the local heading, so nothing is sheared.
 *
 * The loop's heading is theta(v) = 2*pi*v/L + B*sin(2*pi*M*v/L + phi): one full turn per lap plus
 * M snakes. B*M > 1 makes the curvature change sign, so the canyon really S-curves (left, right,
 * left) instead of bending one way. The loop is closed numerically (the linear closure error is
 * spread over the lap) and shifted so that v = 0 sits at the world origin heading +z with zero
 * curvature: the sim's free-flight box (|x|, |z| <= 400) is then a straight stretch of the canyon,
 * exactly as before.
 *
 * Pure and GL-free: one lookup table, built once at module load.
 */

/** Loop length, metres: 40 rows of the derived 320 m tower grid. */
export const CANYON_LOOP_LENGTH_M = 12800;
/**
 * T7-5: four strong snakes (cycle 5: "a rounded triangle with wiggles"). The heading now swings
 * ~70 degrees either way of the lap's mean turn, the curvature changes sign 7 times (real S-bends,
 * tightest radius ~640 m), and stretches of the loop stay >= 1.5 km apart.
 */
const SNAKES = 4;
const SNAKE_AMPLITUDE = 0.55;
const TABLE_SIZE = 4096;

const L = CANYON_LOOP_LENGTH_M;
const TAU = Math.PI * 2;

const tableX = new Float64Array(TABLE_SIZE + 1);
const tableZ = new Float64Array(TABLE_SIZE + 1);
const tableHeading = new Float64Array(TABLE_SIZE + 1);
const tableCurvature = new Float64Array(TABLE_SIZE + 1);

function rawHeading(v: number, phase: number): number {
  return (TAU * v) / L + SNAKE_AMPLITUDE * Math.sin((TAU * SNAKES * v) / L + phase);
}

(function build(): void {
  // Pick the snake phase so that v = 0 is an inflection point (curvature zero, rising): a straight
  // stretch at the origin for the free-flight box.
  // curvature = 2pi/L * (1 + B*M*cos(2pi*M*v/L + phase)) = 0 at v = 0  =>  cos(phase) = -1/(B*M).
  const phase = -Math.acos(-1 / (SNAKE_AMPLITUDE * SNAKES));
  const dv = L / TABLE_SIZE;
  let x = 0;
  let z = 0;
  const rawX = new Float64Array(TABLE_SIZE + 1);
  const rawZ = new Float64Array(TABLE_SIZE + 1);
  for (let i = 0; i <= TABLE_SIZE; i += 1) {
    rawX[i] = x;
    rawZ[i] = z;
    // Midpoint rule: heading in the sim basis (0 faces +z, x = sin).
    const h = rawHeading((i + 0.5) * dv, phase);
    x += Math.sin(h) * dv;
    z += Math.cos(h) * dv;
  }
  // Close the loop: spread the end-point error linearly over the lap.
  const errX = rawX[TABLE_SIZE]!;
  const errZ = rawZ[TABLE_SIZE]!;
  for (let i = 0; i <= TABLE_SIZE; i += 1) {
    tableX[i] = rawX[i]! - (errX * i) / TABLE_SIZE;
    tableZ[i] = rawZ[i]! - (errZ * i) / TABLE_SIZE;
  }
  // Headings from the closed polyline (central differences), unwrapped.
  for (let i = 0; i <= TABLE_SIZE; i += 1) {
    const a = (i - 1 + TABLE_SIZE) % TABLE_SIZE;
    const b = (i + 1) % TABLE_SIZE;
    tableHeading[i] = Math.atan2(tableX[b]! - tableX[a]!, tableZ[b]! - tableZ[a]!);
  }
  // Rotate so v = 0 heads +z, then translate so v = 0 sits at the origin.
  const rotate = -tableHeading[0]!;
  const c = Math.cos(rotate);
  const s = Math.sin(rotate);
  const x0 = tableX[0]!;
  const z0 = tableZ[0]!;
  for (let i = 0; i <= TABLE_SIZE; i += 1) {
    const px = tableX[i]! - x0;
    const pz = tableZ[i]! - z0;
    // Rotating a heading by +r about y: (x, z) -> (x cos r + z sin r, -x sin r + z cos r).
    tableX[i] = px * c + pz * s;
    tableZ[i] = -px * s + pz * c;
    tableHeading[i] = tableHeading[i]! + rotate;
  }
  for (let i = 0; i <= TABLE_SIZE; i += 1) {
    const a = (i - 1 + TABLE_SIZE) % TABLE_SIZE;
    const b = (i + 1) % TABLE_SIZE;
    let d = tableHeading[b]! - tableHeading[a]!;
    d -= TAU * Math.round(d / TAU);
    tableCurvature[i] = d / (2 * dv);
  }
})();

function sample(table: Float64Array, v: number): number {
  const w = ((v % L) + L) % L;
  const f = (w / L) * TABLE_SIZE;
  const i = Math.floor(f);
  const t = f - i;
  return table[i]! + (table[i + 1]! - table[i]!) * t;
}

/** Wraps an along-canyon coordinate into [-L/2, L/2). */
export function wrapCanyonV(v: number): number {
  const w = ((v + L / 2) % L + L) % L;
  return w - L / 2;
}

/** Heading of the canyon at v, radians, sim basis (0 faces +z, forward x = sin). */
export function canyonHeading(v: number): number {
  const w = ((v % L) + L) % L;
  const f = (w / L) * TABLE_SIZE;
  const i = Math.floor(f);
  const t = f - i;
  let d = tableHeading[i + 1]! - tableHeading[i]!;
  d -= TAU * Math.round(d / TAU);
  return tableHeading[i]! + d * t;
}

/** Signed curvature at v, 1/metres (positive turns right, toward +N). */
export function canyonCurvature(v: number): number {
  return sample(tableCurvature, v);
}

export interface WarpOut {
  x: number;
  z: number;
  /** Heading at the point, radians. */
  heading: number;
}

/** Canyon space (x across, v along) to world xz, plus the local heading. Allocation-free. */
export function warpCanyon(x: number, v: number, out: WarpOut): WarpOut {
  const heading = canyonHeading(v);
  const cx = sample(tableX, v);
  const cz = sample(tableZ, v);
  // Right-hand normal in the sim basis: (cos h, 0, -sin h).
  out.x = cx + x * Math.cos(heading);
  out.z = cz - x * Math.sin(heading);
  out.heading = heading;
  return out;
}

/** Rotates a canyon-space horizontal direction (dx across, dv along) into world xz. */
export function warpDirection(dx: number, dv: number, heading: number, out: { x: number; z: number }): void {
  const c = Math.cos(heading);
  const s = Math.sin(heading);
  // along = (sin h, cos h), across = (cos h, -sin h)
  out.x = dv * s + dx * c;
  out.z = dv * c - dx * s;
}

/**
 * True when a footprint centred at canyon (x, v) would stand inside the corridor of a *different*
 * stretch of the loop (more than 1.5 km away along it). Outer columns on the inside of a bend can
 * reach across to the next stretch; those are dropped so no wall ever blocks the route.
 */
export function intrudesOtherStretch(x: number, v: number, halfFootprint: number, corridorHalf = 560): boolean {
  const o = { x: 0, z: 0, heading: 0 };
  warpCanyon(x, v, o);
  const own = ((v % L) + L) % L;
  const step = 4;
  for (let i = 0; i < TABLE_SIZE; i += step) {
    const at = (i / TABLE_SIZE) * L;
    let along = Math.abs(at - own);
    along = Math.min(along, L - along);
    if (along < 1500) continue;
    const d = Math.hypot(tableX[i]! - o.x, tableZ[i]! - o.z);
    if (d < corridorHalf + halfFootprint) return true;
  }
  return false;
}

/**
 * True when a footprint at canyon (x, v) sits on the inside of a bend beyond ~85% of its radius:
 * there the warp would fold it back through the curve's centre. Such footprints are not drawn.
 */
export function foldsInsideBend(x: number, v: number, halfFootprint: number): boolean {
  let worst = 0;
  for (const dv of [-300, -150, 0, 150, 300]) {
    const k = canyonCurvature(v + dv);
    if (Math.sign(k) !== Math.sign(x)) continue;
    worst = Math.max(worst, Math.abs(k));
  }
  if (worst === 0) return false;
  return Math.abs(x) + halfFootprint > 0.85 / worst;
}

export interface CanyonBendApex {
  readonly v: number;
  /** The bend's inside: the side (sign of canyon x) the route curves around. */
  readonly side: -1 | 1;
  readonly radius: number;
}

/** The tightest point of every bend tighter than `maxRadius` (local curvature maxima). */
export function canyonBendApexes(maxRadius = 1400): readonly CanyonBendApex[] {
  const out: CanyonBendApex[] = [];
  const n = TABLE_SIZE;
  for (let i = 0; i < n; i += 1) {
    const k = Math.abs(tableCurvature[i]!);
    const prev = Math.abs(tableCurvature[(i - 1 + n) % n]!);
    const next = Math.abs(tableCurvature[(i + 1) % n]!);
    if (k > prev && k >= next && 1 / k < maxRadius) {
      const v = (i / n) * L;
      out.push({ v: v > L / 2 ? v - L : v, side: (Math.sign(tableCurvature[i]!) || 1) as -1 | 1, radius: 1 / k });
    }
  }
  return out;
}

/** Diagnostics for tests and probes. */
export function canyonLoopStats(): { minRadius: number; maxRadius: number; signChanges: number; minSelfDistance: number } {
  let minK = Infinity;
  let maxK = -Infinity;
  let signChanges = 0;
  for (let i = 0; i < TABLE_SIZE; i += 1) {
    const k = tableCurvature[i]!;
    minK = Math.min(minK, k);
    maxK = Math.max(maxK, k);
    if (i > 0 && Math.sign(k) !== Math.sign(tableCurvature[i - 1]!)) signChanges += 1;
  }
  // Closest approach between points more than 2 km apart along the loop.
  let minSelf = Infinity;
  const step = 16;
  for (let i = 0; i < TABLE_SIZE; i += step) {
    for (let j = i + step; j < TABLE_SIZE; j += step) {
      const along = Math.min(j - i, TABLE_SIZE - (j - i)) * (L / TABLE_SIZE);
      if (along < 2000) continue;
      minSelf = Math.min(minSelf, Math.hypot(tableX[i]! - tableX[j]!, tableZ[i]! - tableZ[j]!));
    }
  }
  return {
    minRadius: 1 / Math.max(Math.abs(minK), Math.abs(maxK)),
    maxRadius: 1 / Math.max(1e-9, Math.min(Math.abs(minK), Math.abs(maxK))),
    signChanges,
    minSelfDistance: minSelf,
  };
}

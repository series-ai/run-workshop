/**
 * @file city.ts — the brutalist canyon: instanced tower slabs, structural trim, and neon signs.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   R3 — seeded brutalist canyon from instanced modules, sparse neon, <= 16 draw calls shared with traffic.
 *   Design "City / traffic model" — "instanced unit-box towers + trim kit + procedural window hash shader".
 *   Design "Sim <-> render split" — the layout is derived once at boot, never inside step().
 *   T3 — city renderer; verify <= 10 draw calls city-only (this module spends 3).
 *
 * Approved visual direction: concrete mega-slabs with structural ribs and connecting gantries — a
 * kilometre-deep vertical canyon, not Kowloon clutter. Mostly desaturated concrete lost in the dark,
 * sparse lit window grids, wet surfaces catching the neon, thousands of signs.
 *
 * Draw-call budget: 8 owned, 3 spent.
 *   towers 1 + trim 1 + neon signs 1. Every pass is a single instanced mesh, so the count does not
 *   move with instance counts.
 *
 * Zero assets: the window grid, the ribs, the wet streaks and the sign faces are all generated in
 * the fragment shader from an instance-seeded hash. There is no texture and no image file.
 *
 * NO ROADS. Nothing here renders a horizontal surface at or near the flight corridor. Gantries are
 * narrow structural catwalks between towers inside the wall; T6R cantilevers stop at |x| >= 412,
 * clear of `CHASM_BOUNDS` (|x| <= 400); and there is no ground plane — the depths are closed off by
 * the altitude-graded haze in atmosphere.ts instead. T6R skybridges are the one exception that
 * spans the canyon: empty structures above every traffic river (>= 1900 m) and outside the
 * free-flight box (|z| >= 600), so no vehicle ever rides one. Vehicles are T4's, not created here.
 *
 * Layout ownership: `deriveCityLayout` (committed T2, src/sim/derive.ts) is the single source of
 * tower placement and is consumed verbatim. It carries no trim or signage fields, and T2 is not
 * ours to edit, so trim and signs are derived here from the same seed through the same root-entry
 * `DeterministicRandom`, on their own `fork()` labels so the T2 streams are untouched. Both
 * derivations are pure, GL-free and cached per seed at module level.
 */
import { DeterministicRandom } from '@series-inc/rundot-syncplay';
import * as THREE from 'three';

import type { SkyriverCityLayout, SkyriverTower } from '../sim/derive';
import {
  SKYRIVER_HASH_GLSL,
  SKYRIVER_OUTPUT_APPLY_GLSL,
  SKYRIVER_OUTPUT_PARS_GLSL,
  applySkyriverFog,
  installSkyriverFogChunks,
  skyriverFogUniforms,
} from './atmosphere';
import type { SkyriverFrame, SkyriverQualitySettings } from './scene';

/** Draw calls this module may spend (plan T3 allows 10 city-only; the shared budget allots 8). */
export const SKYRIVER_CITY_DRAW_CALL_BUDGET = 8;

/**
 * Tunables, exported so a node-only check can assert them without a GL context. Metres throughout.
 * The window pitch is a real floor height, so windows stay the same size on a 240 m slab and a
 * 1900 m one — that is what sells the scale of the canyon.
 */
export const SKYRIVER_CITY = Object.freeze({
  /**
   * Window cell pitch. T6R: was one 3.6 m floor by one 4.2 m bay, which at canyon distances read as
   * static "QR noise". Now a double bay by a floor-and-a-half, with a sparser lit share.
   */
  windowCellWidthM: 7.2,
  windowCellHeightM: 5.4,
  /** Structural rib pitch down the facade. */
  ribSpacingM: 19,
  /** Hard caps on the locally derived passes. */
  maxTrims: 9000,
  maxSigns: 1600,
  /** Target sign count before the cap and the per-tower fit test. */
  /** T6R-2: halved — the review read the T6R density as confetti competing with the windows. */
  signTarget: 720,
  /** Signs sit this far off the facade so they never z-fight with it. */
  signStandoffM: 0.45,
  drawCallBudget: SKYRIVER_CITY_DRAW_CALL_BUDGET,
});

/** Trim kinds. The shader branches on these; keep the numbering stable for the report. */
export const SKYRIVER_TRIM_ANTENNA = 0;
export const SKYRIVER_TRIM_GANTRY = 1;
export const SKYRIVER_TRIM_ROOF_PLANT = 2;
/** T6R structural kit on the corridor face: these silhouette against the haze. */
export const SKYRIVER_TRIM_RIB = 3;
export const SKYRIVER_TRIM_BAND = 4;
export const SKYRIVER_TRIM_CANTILEVER = 5;
/** High skybridges spanning the canyon. Empty structures: no traffic river runs at their height. */
export const SKYRIVER_TRIM_SKYBRIDGE = 6;
/** Skybridge altitude band and the canyon stretch they keep out of (the free-flight box, |z| <= 400). */
export const SKYRIVER_SKYBRIDGE_MIN_Y_M = 1900;
export const SKYRIVER_SKYBRIDGE_MIN_ABS_Z_M = 600;

/** Sign kinds: a vertical banner, a horizontal strip, and a hollow outline box. */
export const SKYRIVER_SIGN_BANNER = 0;
export const SKYRIVER_SIGN_STRIP = 1;
export const SKYRIVER_SIGN_OUTLINE = 2;

/** Cyan, magenta, amber, green, and one cold white. Packed 0xRRGGBB, matching derive.ts's style. */
const NEON_PALETTE: readonly number[] = Object.freeze([
  0x2ff2ff,
  0xff2fb4,
  0xffb13c,
  0x55ff7a,
  0xd6ecff,
]);
const NEON_WEIGHTS: readonly number[] = Object.freeze([28, 24, 24, 14, 10]);

// --- locally derived trim -------------------------------------------------------------------------

export interface SkyriverCityTrims {
  readonly seed: number;
  readonly count: number;
  /** Centre position, metres. */
  readonly cx: Float32Array;
  readonly cy: Float32Array;
  readonly cz: Float32Array;
  /** Full extents, metres. */
  readonly sx: Float32Array;
  readonly sy: Float32Array;
  readonly sz: Float32Array;
  /** One of SKYRIVER_TRIM_*. */
  readonly kind: Uint8Array;
  /** Per-instance hash seed, 0 .. 1. */
  readonly seedValue: Float32Array;
}

export interface SkyriverNeonSigns {
  readonly seed: number;
  readonly count: number;
  readonly cx: Float32Array;
  readonly cy: Float32Array;
  readonly cz: Float32Array;
  /** Outward facade normal, axis-aligned. */
  readonly nx: Float32Array;
  readonly nz: Float32Array;
  /** Sign face extents, metres: across the facade and up it. */
  readonly sw: Float32Array;
  readonly sh: Float32Array;
  /** Linear RGB, ready for an InstancedBufferAttribute. */
  readonly color: Float32Array;
  /** One of SKYRIVER_SIGN_*. */
  readonly kind: Uint8Array;
  readonly seedValue: Float32Array;
}

/**
 * One drawn mass of concrete: a derived slab, or a T6R-2 setback tier, crown, seam block or far
 * skyline block. All of them render through the tower mesh (one draw call) with the facade shader.
 */
export interface SkyriverMass {
  readonly x: number;
  /** Base altitude, metres. Derived slabs start in the void (SKYRIVER_CITY_VOID_BASE_Y). */
  readonly y0: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly tint: number;
}

/**
 * Every wall continues this far below the canyon floor. The depths haze (atmosphere.ts) swallows it,
 * so there is no wall foot and no plane edge anywhere: the canyon bottom reads as void.
 */
export const SKYRIVER_CITY_VOID_BASE_Y = -1600;
/** The far skyline is a cold, darker concrete so the haze grades it into layered silhouettes. */
const TOWER_FAR_TINT = 0x3c4450;

const trimCache = new Map<number, SkyriverCityTrims>();
const massCache = new Map<number, SkyriverMass[]>();
/** Per seed: inner-wall slab key -> its corridor-face tiers [bottom, top, projection, zCentre, zSpan]. */
const tierCache = new Map<number, Map<string, readonly (readonly [number, number, number, number, number])[]>>();

function towerKey(tower: SkyriverTower): string {
  return `${tower.x.toFixed(2)}:${tower.z.toFixed(2)}`;
}

/** Largest corridor-face projection of a slab's tiers over [y0, y1], metres (0 for a bare slab). */
function tierProjectionOver(seed: number, tower: SkyriverTower, y0: number, y1: number): number {
  const tiers = tierCache.get(seed)?.get(towerKey(tower));
  if (tiers === undefined) return 0;
  let projection = 0;
  for (const [bottom, top, p] of tiers) {
    if (top > y0 && bottom < y1) projection = Math.max(projection, p);
  }
  return projection;
}

/** All drawn concrete masses for a layout. Pure and cached; derived alongside the trims. */
export function deriveCityMasses(layout: SkyriverCityLayout): readonly SkyriverMass[] {
  deriveCityTrims(layout);
  const masses = massCache.get(layout.seed);
  if (masses === undefined) fail('SKYRIVER_CITY_MASSES_MISSING');
  return masses;
}
const signCache = new Map<number, SkyriverNeonSigns>();

function fail(code: string): never {
  throw new Error(code);
}

/** Towers of one canyon wall, ordered inner column first then along the canyon. */
function wallOf(layout: SkyriverCityLayout, side: -1 | 1): readonly SkyriverTower[] {
  return layout.towers
    .filter((tower) => Math.sign(tower.x) === side)
    .sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || a.z - b.z);
}

/**
 * Derives the trim kit: roof plant, antenna masts, and the gantries that tie the slabs together.
 *
 * Gantries only ever join two towers on the same wall — along the canyon, or outward between
 * columns. T6R adds the corridor-face kit (ribs, floor bands, cantilevers) and a few high
 * skybridges; see the file header for why none of it can read as a road.
 *
 * Pure and GL-free; cached per seed.
 */
export function deriveCityTrims(layout: SkyriverCityLayout): SkyriverCityTrims {
  const cached = trimCache.get(layout.seed);
  if (cached !== undefined) return cached;

  const random = new DeterministicRandom(layout.seed).fork('skyriver.city.trim');
  const cap = SKYRIVER_CITY.maxTrims;
  const masses: SkyriverMass[] = [];
  const cx = new Float32Array(cap);
  const cy = new Float32Array(cap);
  const cz = new Float32Array(cap);
  const sx = new Float32Array(cap);
  const sy = new Float32Array(cap);
  const sz = new Float32Array(cap);
  const kind = new Uint8Array(cap);
  const seedValue = new Float32Array(cap);
  let count = 0;

  const push = (
    trimKind: number,
    px: number,
    py: number,
    pz: number,
    ex: number,
    ey: number,
    ez: number,
  ): void => {
    if (count >= cap) return;
    cx[count] = px;
    cy[count] = py;
    cz[count] = pz;
    sx[count] = ex;
    sy[count] = ey;
    sz[count] = ez;
    kind[count] = trimKind;
    seedValue[count] = random.nextInt(0, 9999) / 9999;
    count += 1;
  };

  for (const side of [-1, 1] as const) {
    const wall = wallOf(layout, side);

    for (let i = 0; i < wall.length; i += 1) {
      const tower = wall[i];

      // Roof plant: a low mechanical block, off-centre, on most slabs. Reads as brutalist mass.
      if (random.nextInt(0, 99) < 74) {
        const plantW = tower.width * (0.34 + random.nextInt(0, 260) / 1000);
        const plantD = tower.depth * (0.34 + random.nextInt(0, 260) / 1000);
        const plantH = 9 + random.nextInt(0, 16);
        const offsetX = (random.nextInt(-1000, 1000) / 1000) * (tower.width - plantW) * 0.5;
        const offsetZ = (random.nextInt(-1000, 1000) / 1000) * (tower.depth - plantD) * 0.5;
        push(
          SKYRIVER_TRIM_ROOF_PLANT,
          tower.x + offsetX,
          tower.height + plantH * 0.5,
          tower.z + offsetZ,
          plantW,
          plantH,
          plantD,
        );
      }

      // Antenna masts crown the tall slabs only, so the skyline silhouette stays graded.
      if (tower.height > 900 && random.nextInt(0, 99) < 58) {
        const mastH = 45 + random.nextInt(0, 125);
        const mastT = 2.4 + random.nextInt(0, 26) / 10;
        const offsetX = (random.nextInt(-1000, 1000) / 1000) * tower.width * 0.3;
        const offsetZ = (random.nextInt(-1000, 1000) / 1000) * tower.depth * 0.3;
        push(
          SKYRIVER_TRIM_ANTENNA,
          tower.x + offsetX,
          tower.height + mastH * 0.5,
          tower.z + offsetZ,
          mastT,
          mastH,
          mastT,
        );
      }

      // Gantry along the canyon, to the next slab in the same column.
      const next = wall[i + 1];
      if (
        next !== undefined
        && Math.abs(Math.abs(next.x) - Math.abs(tower.x)) < 1
        && random.nextInt(0, 99) < 46
      ) {
        const nearZ = tower.z + tower.depth * 0.5;
        const farZ = next.z - next.depth * 0.5;
        const span = farZ - nearZ;
        if (span > 8) {
          const deck = 3.2 + random.nextInt(0, 22) / 10;
          const ceiling = Math.min(tower.height, next.height) - 40;
          const level = 90 + (random.nextInt(0, 1000) / 1000) * Math.max(ceiling - 90, 0);
          push(
            SKYRIVER_TRIM_GANTRY,
            tower.x + (random.nextInt(-1000, 1000) / 1000) * tower.width * 0.22,
            level,
            nearZ + span * 0.5,
            4.5 + random.nextInt(0, 30) / 10,
            deck,
            span,
          );
        }
      }

      // Gantry outward, to the slab one column deeper into the wall. Never toward the corridor.
      const outward = wall.find(
        (candidate) => Math.abs(candidate.z - tower.z) < 1
          && Math.abs(candidate.x) > Math.abs(tower.x) + 1,
      );
      if (outward !== undefined && random.nextInt(0, 99) < 34) {
        const nearX = Math.abs(tower.x) + tower.width * 0.5;
        const farX = Math.abs(outward.x) - outward.width * 0.5;
        const span = farX - nearX;
        if (span > 8) {
          const deck = 3.2 + random.nextInt(0, 20) / 10;
          const ceiling = Math.min(tower.height, outward.height) - 40;
          const level = 90 + (random.nextInt(0, 1000) / 1000) * Math.max(ceiling - 90, 0);
          push(
            SKYRIVER_TRIM_GANTRY,
            side * (nearX + span * 0.5),
            level,
            tower.z + (random.nextInt(-1000, 1000) / 1000) * tower.depth * 0.22,
            span,
            deck,
            4.5 + random.nextInt(0, 30) / 10,
          );
        }
      }
    }
  }

  // --- T6R-2 brutalist massing on the inner (corridor) wall -------------------------------------
  // Review T6R-2 P0: the T6R ribs and bands projected 3-9 m from 120-240 m slabs and read as faint
  // lines. Mass now comes in three scales, all of it projecting from the corridor face:
  //   1. Setback tiers (drawn as extra tower-mesh instances, see `masses`): two to three stacked
  //      podium blocks per slab, projecting up to ~48 m at the base and stepping back with height,
  //      so the wall silhouette down the canyon is terraced, not a box edge.
  //   2. Deep ribs (6-9 m wide, up to 14 m deep) and floor slabs (4.5-6.5 m thick, up to 11 m deep)
  //      that follow each tier's own face, plus thick parapets on every tier top.
  //   3. Crowns on every roof, and recessed mid-layer blocks filling the seams between slabs, set
  //      30-90 m back, so the gaps show a second and third depth layer instead of sky.
  // Clearance: every projection stops at |x| >= CORRIDOR_CLEAR_X, outside CHASM_BOUNDS (|x| <= 400).
  const CORRIDOR_CLEAR_X = 405;
  const innerWalls = [innerWallOf(layout, -1), innerWallOf(layout, 1)] as const;
  const tierMap = new Map<string, readonly (readonly [number, number, number, number, number])[]>();
  tierCache.set(layout.seed, tierMap);
  for (const wall of innerWalls) {
    for (let index = 0; index < wall.length; index += 1) {
      const tower = wall[index]!;
      const side = Math.sign(tower.x) as -1 | 1;
      const face = Math.abs(tower.x) - tower.width * 0.5;
      const available = face - CORRIDOR_CLEAR_X;
      const h = tower.height;

      // Tier faces: [bottom, top, projection, zCentre, zSpan]. The core face above the last tier
      // is the slab itself (projection 0).
      const tiers: [number, number, number, number, number][] = [];
      const base = Math.min(48, available * 0.6);
      if (base >= 10) {
        const tops = [
          h * (0.26 + random.nextInt(0, 160) / 1000),
          h * (0.52 + random.nextInt(0, 160) / 1000),
          h * (0.76 + random.nextInt(0, 130) / 1000),
        ];
        const projections = [base, base * 0.56, base * 0.24];
        let bottom = SKYRIVER_CITY_VOID_BASE_Y;
        for (let k = 0; k < 3; k += 1) {
          const zSpan = tower.depth * (0.62 + random.nextInt(0, 330) / 1000);
          const zCentre = tower.z + (random.nextInt(-1000, 1000) / 1000) * (tower.depth - zSpan) * 0.5;
          tiers.push([bottom, tops[k]!, projections[k]!, zCentre, zSpan]);
          // Overlap the slab by 6 m so no seam shows between tier and core.
          masses.push({
            x: side * (face - projections[k]! * 0.5 + 3),
            y0: bottom,
            z: zCentre,
            width: projections[k]! + 6,
            height: tops[k]! - bottom,
            depth: zSpan,
            tint: tower.tint,
          });
          bottom = tops[k]!;
        }
      }
      const coreBottom = tiers.length > 0 ? tiers[tiers.length - 1]![1] : 40;
      tiers.push([coreBottom, h, 0, tower.z, tower.depth]);
      tierMap.set(towerKey(tower), tiers);

      for (const [bottom, top, projection, zCentre, zSpan] of tiers) {
        const outer = face - projection;
        // Ribs on this tier's face.
        const ribDepth = Math.min(14, outer - CORRIDOR_CLEAR_X - 1);
        if (ribDepth >= 3) {
          const ribs = Math.max(1, Math.floor(zSpan / 44));
          const ribBottom = Math.max(bottom, -300);
          for (let r = 0; r <= ribs; r += 1) {
            const z = zCentre - zSpan * 0.5 + 3.5 + (r / ribs) * (zSpan - 7);
            const ribTop = top - (r % 2 === 1 ? random.nextInt(0, 40) : 0);
            push(SKYRIVER_TRIM_RIB, side * (outer - ribDepth * 0.5 + 0.5), (ribBottom + ribTop) * 0.5, z,
              ribDepth + 1, ribTop - ribBottom, 6 + random.nextInt(0, 30) / 10);
          }
        }
        // Floor slabs, then a thick parapet at the tier top.
        const slabDepth = Math.min(11, outer - CORRIDOR_CLEAR_X - 0.5);
        if (slabDepth >= 3) {
          let y = Math.max(bottom, 60) + 30 + random.nextInt(0, 40);
          while (y < top - 25) {
            push(SKYRIVER_TRIM_BAND, side * (outer - slabDepth * 0.5 + 0.5), y, zCentre,
              slabDepth + 1, 4.5 + random.nextInt(0, 20) / 10, zSpan + 3);
            y += 48 + random.nextInt(0, 45);
          }
          if (projection > 0) {
            push(SKYRIVER_TRIM_BAND, side * (outer - slabDepth * 0.5 + 0.5), top - 4, zCentre,
              slabDepth + 1, 8, zSpan + 4);
          }
        }
      }

      // Crown: one or two stepped blocks on the roof.
      const crownW = tower.width * (0.42 + random.nextInt(0, 250) / 1000);
      const crownD = tower.depth * (0.42 + random.nextInt(0, 250) / 1000);
      const crownH = 50 + random.nextInt(0, 110);
      masses.push({ x: tower.x, y0: h - 2, z: tower.z, width: crownW, height: crownH, depth: crownD, tint: tower.tint });
      if (random.nextInt(0, 99) < 60) {
        masses.push({ x: tower.x, y0: h + crownH - 2, z: tower.z, width: crownW * 0.5, height: 25 + random.nextInt(0, 50), depth: crownD * 0.55, tint: tower.tint });
      }

      // Recessed mid-layer block in the seam to the next slab along the canyon.
      const next = wall[index + 1];
      if (next !== undefined && Math.abs(Math.abs(next.x) - Math.abs(tower.x)) < 1) {
        const gapStart = tower.z + tower.depth * 0.5;
        const gapEnd = next.z - next.depth * 0.5;
        if (gapEnd - gapStart > 16) {
          const setback = 30 + random.nextInt(0, 60);
          const width = 70 + random.nextInt(0, 80);
          masses.push({
            x: side * (Math.min(face, Math.abs(next.x) - next.width * 0.5) + setback + width * 0.5),
            y0: SKYRIVER_CITY_VOID_BASE_Y,
            z: (gapStart + gapEnd) * 0.5,
            width,
            height: Math.min(h, next.height) * (0.38 + random.nextInt(0, 420) / 1000) - SKYRIVER_CITY_VOID_BASE_Y,
            depth: gapEnd - gapStart + 6,
            tint: tower.tint,
          });
        }
      }

      // Cantilevered gantries reaching toward the corridor from the outermost tier.
      const cantilevers = random.nextInt(0, 2);
      for (let c = 0; c < cantilevers; c += 1) {
        const [bottom, top, projection] = tiers[random.nextInt(0, tiers.length - 1)]!;
        const outer = face - projection;
        const length = Math.min(30, outer - 412);
        if (length < 8) continue;
        const level = Math.max(bottom, 150) + random.nextInt(0, 1000) / 1000 * Math.max(Math.min(top, 1800) - Math.max(bottom, 150), 0);
        push(SKYRIVER_TRIM_CANTILEVER, side * (outer - length * 0.5), level,
          tower.z + (random.nextInt(-1000, 1000) / 1000) * (tower.depth * 0.5 - 12),
          length, 4 + random.nextInt(0, 20) / 10, 10 + random.nextInt(0, 80) / 10);
      }
    }
  }

  // Far skyline closing each end of the view: four terraced rows beyond the canyon, so the
  // vanishing point holds layered silhouettes graded by the haze instead of a flat slot of sky.
  for (const end of [-1, 1]) {
    for (let row = 0; row < 4; row += 1) {
      const zRow = end * (5000 + row * 650);
      for (let x = -2500; x <= 2500; x += 230 + random.nextInt(0, 90)) {
        const width = 110 + random.nextInt(0, 120);
        const height = 1300 + random.nextInt(0, 2600) + row * 250;
        masses.push({
          x,
          y0: SKYRIVER_CITY_VOID_BASE_Y,
          z: zRow + random.nextInt(-120, 120),
          width,
          height: height - SKYRIVER_CITY_VOID_BASE_Y,
          depth: 110 + random.nextInt(0, 120),
          tint: TOWER_FAR_TINT,
        });
        if (random.nextInt(0, 99) < 55) {
          masses.push({ x, y0: height - 2, z: zRow, width: width * 0.5, height: 60 + random.nextInt(0, 260), depth: 70, tint: TOWER_FAR_TINT });
        }
      }
    }
  }

  // Skybridges: on rows where both inner walls stand, away from the free-flight box.
  const [leftWall, rightWall] = innerWalls;
  const rows = leftWall
    .map((left) => ({ left, right: rightWall.find((candidate) => Math.abs(candidate.z - left.z) < 1) }))
    .filter((pair): pair is { left: SkyriverTower; right: SkyriverTower } =>
      pair.right !== undefined && Math.abs(pair.left.z) >= SKYRIVER_SKYBRIDGE_MIN_ABS_Z_M);
  let bridges = 0;
  for (const { left, right } of rows) {
    if (bridges >= 6 || random.nextInt(0, 99) >= 45) continue;
    const leftFace = -(Math.abs(left.x) - left.width * 0.5);
    const rightFace = Math.abs(right.x) - right.width * 0.5;
    const top = Math.min(left.height, right.height) - 30;
    const level = SKYRIVER_SKYBRIDGE_MIN_Y_M + random.nextInt(0, 1000) / 1000 * Math.max(top - SKYRIVER_SKYBRIDGE_MIN_Y_M - 20, 0);
    push(SKYRIVER_TRIM_SKYBRIDGE, (leftFace + rightFace) * 0.5, level,
      left.z + (random.nextInt(-1000, 1000) / 1000) * 20,
      rightFace - leftFace, 14 + random.nextInt(0, 60) / 10, 20 + random.nextInt(0, 100) / 10);
    bridges += 1;
  }

  // Every derived slab, extended down into the void so no wall has a visible foot.
  for (const tower of layout.towers) {
    masses.unshift({
      x: tower.x,
      y0: SKYRIVER_CITY_VOID_BASE_Y,
      z: tower.z,
      width: tower.width,
      height: tower.height - SKYRIVER_CITY_VOID_BASE_Y,
      depth: tower.depth,
      tint: tower.tint,
    });
  }
  massCache.set(layout.seed, masses);

  const trims: SkyriverCityTrims = {
    seed: layout.seed,
    count,
    cx,
    cy,
    cz,
    sx,
    sy,
    sz,
    kind,
    seedValue,
  };
  trimCache.set(layout.seed, trims);
  return trims;
}

const SIGN_MAX_ABS_Z_M = 3300;

/** Towers of the inner column on one side: the wall that faces the corridor. */
function innerWallOf(layout: SkyriverCityLayout, side: -1 | 1): readonly SkyriverTower[] {
  const wall = wallOf(layout, side);
  if (wall.length === 0) return wall;
  const innerX = Math.abs(wall[0]!.x);
  return wall.filter((tower) => Math.abs(tower.x) < innerX + layout.cell * 0.5);
}


export interface SkyriverHeroBlade {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
  readonly color: number;
  readonly seed: number;
}

/** Along-canyon stations of the hero blades, per wall. Staggered so each straight sees 4-6 ahead. */
const HERO_STATIONS: readonly (readonly [-1 | 1, number])[] = Object.freeze([
  [-1, -1400], [-1, -700], [-1, 0], [-1, 700], [-1, 1400],
  [1, -1050], [1, -350], [1, 350], [1, 1050], [1, 1750],
]);
const HERO_COLORS: readonly number[] = Object.freeze([0x2ff2ff, 0xff2fb4, 0xffb13c, 0x2ff2ff, 0xff4a8c]);
/** Shuttle height band (flightPresentation.ts track: 360-770 m). */
const HERO_CENTRE_Y = 590;

const heroCache = new Map<number, readonly SkyriverHeroBlade[]>();

/**
 * The hero blades: 10 huge vertical glyph signs, 24-60 m deep and 170-240 m tall, projecting from
 * the inner walls into the canyon at shuttle height and facing along it. Pure; cached per seed.
 */
export function deriveHeroBlades(layout: SkyriverCityLayout): readonly SkyriverHeroBlade[] {
  const cached = heroCache.get(layout.seed);
  if (cached !== undefined) return cached;
  deriveCityTrims(layout);
  const random = new DeterministicRandom(layout.seed).fork('skyriver.city.hero');
  const blades: SkyriverHeroBlade[] = [];
  for (const [side, z] of HERO_STATIONS) {
    const wall = innerWallOf(layout, side);
    if (wall.length === 0) continue;
    const tower = wall.reduce((best, candidate) => (Math.abs(candidate.z - z) < Math.abs(best.z - z) ? candidate : best));
    const height = 170 + random.nextInt(0, 70);
    const y = HERO_CENTRE_Y + random.nextInt(-60, 60);
    const face = Math.abs(tower.x) - tower.width * 0.5
      - tierProjectionOver(layout.seed, tower, y - height * 0.5, y + height * 0.5);
    const width = Math.min(60, Math.max(24, face - 410));
    blades.push({
      x: side * (face - width * 0.5),
      y,
      z: Math.max(tower.z - tower.depth * 0.5 + 6, Math.min(tower.z + tower.depth * 0.5 - 6, z)),
      width,
      height,
      color: HERO_COLORS[blades.length % HERO_COLORS.length]!,
      seed: random.nextInt(0, 9999) / 9999,
    });
  }
  heroCache.set(layout.seed, blades);
  return blades;
}

/**
 * Derives the neon signage.
 *
 * T6R P0 "neon signs invisible". The T6 signs were 3-7 m wide, bolted flat to the facades and
 * weighted to the bottom 200 m of each tower. A camera looking down the canyon sees every inner
 * facade edge-on, so a flat sign there is a sliver, and the camera flies at 400-800 m, far above
 * where most of them hung. Now:
 *   - Every sign goes on the inner wall, the one that lines the corridor.
 *   - Most are *blades*: tall vertical signs mounted perpendicular to the facade, projecting into
 *     the canyon and facing along it — exactly the orientation a chase cam looking down the canyon
 *     sees face-on (the Neon Rain still's vertical kanji blades).
 *   - The rest are large flat panels and banners on the corridor face, which read whenever the
 *     camera turns or banks.
 *   - Sizes are scaled to the canyon: blades 8-18 m deep and 35-140 m tall, panels up to 90 m wide.
 *   - 60% of signs sit in the flight band (150-1150 m), the rest anywhere up to ~2 km.
 *
 * Pure and GL-free; cached per seed.
 */
export function deriveNeonSigns(layout: SkyriverCityLayout): SkyriverNeonSigns {
  const cached = signCache.get(layout.seed);
  if (cached !== undefined) return cached;
  if (layout.towers.length === 0) fail('SKYRIVER_CITY_LAYOUT_EMPTY');

  const random = new DeterministicRandom(layout.seed).fork('skyriver.city.neon');
  const cap = SKYRIVER_CITY.maxSigns;
  const cx = new Float32Array(cap);
  const cy = new Float32Array(cap);
  const cz = new Float32Array(cap);
  const nx = new Float32Array(cap);
  const nz = new Float32Array(cap);
  const sw = new Float32Array(cap);
  const sh = new Float32Array(cap);
  const color = new Float32Array(cap * 3);
  const kind = new Uint8Array(cap);
  const seedValue = new Float32Array(cap);
  let count = 0;

  // Only the stretch the camera actually flies (the autopilot track reaches |z| ~ 1.6 km; the view
  // carries another ~1.5 km down the canyon). Beyond that the haze would swallow them anyway.
  const inner = [...innerWallOf(layout, -1), ...innerWallOf(layout, 1)]
    .filter((tower) => Math.abs(tower.z) <= SIGN_MAX_ABS_Z_M);
  if (inner.length === 0) fail('SKYRIVER_CITY_INNER_WALL_EMPTY');
  const tint = new THREE.Color();
  // Signs mount on the outermost tier face at their height, never inside a setback mass.
  deriveCityTrims(layout);

  // Hero blades first (T6R-2 P1): a few huge vertical glyph blades at shuttle height along the
  // autopilot straights, the dominant signage read (the Neon Rain still's vertical kanji blades).
  for (const hero of deriveHeroBlades(layout)) {
    if (count >= cap) break;
    cx[count] = hero.x;
    cy[count] = hero.y;
    cz[count] = hero.z;
    nx[count] = 0;
    nz[count] = 1;
    sw[count] = hero.width;
    sh[count] = hero.height;
    tint.setHex(hero.color, THREE.SRGBColorSpace);
    color[count * 3] = tint.r;
    color[count * 3 + 1] = tint.g;
    color[count * 3 + 2] = tint.b;
    kind[count] = SKYRIVER_SIGN_BANNER;
    seedValue[count] = hero.seed;
    count += 1;
  }

  const target = Math.min(SKYRIVER_CITY.signTarget + count, cap);
  const attemptLimit = target * 8;
  let attempts = 0;

  while (count < target) {
    attempts += 1;
    if (attempts > attemptLimit) fail('SKYRIVER_CITY_NEON_PLACEMENT_STALLED');

    const tower = inner[random.nextInt(0, inner.length - 1)]!;
    const side = Math.sign(tower.x) as -1 | 1;
    const slabFace = Math.abs(tower.x) - tower.width * 0.5;
    const roll = random.nextInt(0, 99);

    // Altitude: weighted into the flight band, otherwise anywhere on the lit part of the slab.
    const ceiling = Math.min(tower.height - 60, 2050);
    const inBand = random.nextInt(0, 99) < 60;
    const low = inBand ? 150 : 60;
    const high = inBand ? Math.min(1150, ceiling) : ceiling;
    const centreYRaw = low + (random.nextInt(0, 1000) / 1000) * Math.max(high - low, 0);

    let width: number;
    let height: number;
    let normalX = 0;
    let normalZ = 0;
    let px: number;
    let pz: number;
    let signKind: number;
    const along = random.nextInt(-1000, 1000) / 1000;

    if (roll < 48) {
      // Blade: perpendicular to the facade, projecting into the canyon, facing along it.
      signKind = SKYRIVER_SIGN_BANNER;
      width = 8 + random.nextInt(0, 100) / 10;
      height = 35 + random.nextInt(0, 1050) / 10;
      normalZ = random.nextInt(0, 1) === 0 ? -1 : 1;
      px = 0;
      pz = tower.z + along * (tower.depth * 0.5 - 4);
    } else {
      // Flat on the corridor face.
      normalX = -side;
      if (roll < 76) {
        signKind = SKYRIVER_SIGN_STRIP;
        width = 26 + random.nextInt(0, 640) / 10;
        height = 8 + random.nextInt(0, 140) / 10;
      } else if (roll < 91) {
        signKind = SKYRIVER_SIGN_BANNER;
        width = 9 + random.nextInt(0, 70) / 10;
        height = 30 + random.nextInt(0, 700) / 10;
      } else {
        signKind = SKYRIVER_SIGN_OUTLINE;
        width = 18 + random.nextInt(0, 260) / 10;
        height = 12 + random.nextInt(0, 160) / 10;
      }
      if (width > tower.depth - 6) continue;
      px = 0;
      pz = tower.z + along * (tower.depth - width) * 0.5;
    }
    const centreY = Math.max(centreYRaw, height * 0.5 + 20);
    const innerFace = slabFace - tierProjectionOver(layout.seed, tower, centreY - height * 0.5, centreY + height * 0.5);
    if (normalZ !== 0) px = side * (innerFace - width * 0.5 - 0.8);
    else px = side * (innerFace - SKYRIVER_CITY.signStandoffM);

    const packed = random.weighted(NEON_PALETTE, NEON_WEIGHTS);
    if (!Number.isInteger(packed) || packed < 0 || packed > 0xffffff) {
      fail('SKYRIVER_CITY_NEON_TINT_INVALID');
    }
    tint.setHex(packed, THREE.SRGBColorSpace);

    cx[count] = px;
    cy[count] = centreY;
    cz[count] = pz;
    nx[count] = normalX;
    nz[count] = normalZ;
    sw[count] = width;
    sh[count] = height;
    color[count * 3] = tint.r;
    color[count * 3 + 1] = tint.g;
    color[count * 3 + 2] = tint.b;
    kind[count] = signKind;
    seedValue[count] = random.nextInt(0, 9999) / 9999;
    count += 1;
  }

  const signs: SkyriverNeonSigns = {
    seed: layout.seed,
    count,
    cx,
    cy,
    cz,
    nx,
    nz,
    sw,
    sh,
    color,
    kind,
    seedValue,
  };
  signCache.set(layout.seed, signs);
  return signs;
}

// --- tower shader ---------------------------------------------------------------------------------

const TOWER_VERTEX = /* glsl */ `
attribute float aSeed;
attribute vec3 aTint;
attribute vec3 aSize;   // width, height, depth in metres

varying vec2 vSurf;      // position on the face, metres
varying float vSeed;
varying vec3 vTint;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying float vUp;       // 0 at the base, 1 at the parapet
varying float vIsSide;   // 1 on a facade, 0 on the roof
varying float vFaceId;
varying vec2 vFaceHalf;  // half extents of this face in vSurf metres

#include <fog_pars_vertex>

void main() {
  vec3 transformed = vec3( position );
  // The slab is a unit box, so object space times the instance extents is metres from the centre.
  vec3 local = transformed * aSize;
  vec3 n = normal;
  float ax = abs( n.x );
  float ay = abs( n.y );

  if ( ay > 0.5 ) {
    // Roof or underside: no windows, no ribs that would read as a facade.
    vSurf = vec2( local.x, local.z );
    vFaceHalf = 0.5 * aSize.xz;
    vIsSide = 0.0;
    vFaceId = 4.0;
  } else if ( ax > 0.5 ) {
    vSurf = vec2( local.z, local.y );
    vFaceHalf = 0.5 * aSize.zy;
    vIsSide = 1.0;
    vFaceId = n.x > 0.0 ? 0.0 : 1.0;
  } else {
    vSurf = vec2( local.x, local.y );
    vFaceHalf = 0.5 * aSize.xy;
    vIsSide = 1.0;
    vFaceId = n.z > 0.0 ? 2.0 : 3.0;
  }

  vSeed = aSeed;
  vTint = aTint;

  vec4 world = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
  vWorldPos = world.xyz;
  // T6R-2: graded on world altitude, not per box — walls now run down into the void, and setback
  // tiers and crowns must share one lit-floor profile with the slab they belong to.
  vUp = clamp( world.y / 2600.0, 0.0, 1.0 );
  // Axis-aligned extents only, so normalising after the scale is enough — no inverse transpose.
  vNormalW = normalize( mat3( modelMatrix ) * ( mat3( instanceMatrix ) * n ) );

  vec4 mvPosition = modelViewMatrix * ( instanceMatrix * vec4( transformed, 1.0 ) );
  #include <fog_vertex>
  gl_Position = projectionMatrix * mvPosition;
}
`;

const TOWER_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uCellWidth;
uniform float uCellHeight;
uniform float uRibSpacing;
uniform float uProjScale;
uniform float uConcreteLevel;
uniform vec3 uConcreteAmbient;
uniform vec3 uWetTint;

varying vec2 vSurf;
varying float vSeed;
varying vec3 vTint;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying float vUp;
varying float vIsSide;
varying float vFaceId;
varying vec2 vFaceHalf;

#define HERO_MAX 12
uniform vec4 uHeroBlades[ HERO_MAX ];   // x, centre y, z, half height
uniform vec3 uHeroColors[ HERO_MAX ];
uniform int uHeroCount;

#include <fog_pars_fragment>
${SKYRIVER_OUTPUT_PARS_GLSL}
${SKYRIVER_HASH_GLSL}

/** Rounded-box signed distance in cell units; the window glass. */
float windowSdf( vec2 cellLocal ) {
  const float radius = 0.055;
  vec2 halfExtent = vec2( 0.41, 0.29 );
  vec2 d = abs( cellLocal - 0.5 ) - halfExtent + radius;
  return length( max( d, 0.0 ) ) + min( max( d.x, d.y ), 0.0 ) - radius;
}

void main() {
  vec3 viewDir = normalize( cameraPosition - vWorldPos );

  // Procedural-detail antialiasing. A 3.6 m floor seen from 600 m covers well under a pixel, and
  // point-sampling a hash at that rate turns the whole far wall into white noise. uProjScale is
  // drawingBufferHeight / (2 * tan(fov/2)), so this is the cell's height in pixels; below a few
  // pixels the grid is blended out to its own average instead of being sampled.
  float viewDepth = max( vFogDepth, 1.0 );
  float cellPixels = uCellHeight * uProjScale / viewDepth;
  float detail = smoothstep( 1.1, 4.5, cellPixels );
  float fineDetail = smoothstep( 2.5, 9.0, cellPixels );

  vec2 cellSize = vec2( uCellWidth, uCellHeight );
  vec2 cellUv = vSurf / cellSize;
  vec2 cell = floor( cellUv );
  vec2 cellLocal = fract( cellUv );
  // Per-face offset so opposite facades never mirror each other.
  vec2 faceOffset = vec2( vFaceId * 311.0 + vSeed * 613.0, vFaceId * 97.0 - vSeed * 271.0 );

  // --- concrete ---------------------------------------------------------------------------------
  // Vertical structural ribs: a deep groove with a lighter arris, the brutalist read.
  float ribWave = abs( fract( vSurf.x / uRibSpacing ) - 0.5 ) * 2.0;
  float groove = smoothstep( 0.78, 0.97, ribWave );
  float arris = smoothstep( 0.62, 0.76, ribWave ) * ( 1.0 - groove );
  // Floor-slab banding on the window pitch.
  float slabWave = abs( fract( vSurf.y / uCellHeight + 0.5 ) - 0.5 ) * 2.0;
  float slab = smoothstep( 0.84, 0.99, slabWave ) * detail;

  float grain = skyValueNoise( vSurf * 0.07 + faceOffset * 0.013 ) * ( 0.5 + 0.5 * ( 1.0 - detail ) )
    + skyValueNoise( vSurf * 0.31 ) * 0.5 * detail;
  vec3 concrete = vTint * uConcreteLevel * ( 0.78 + 0.44 * grain );
  concrete *= 1.0 - 0.52 * groove * vIsSide - 0.22 * slab * vIsSide;
  concrete += vTint * uConcreteLevel * 0.35 * arris * vIsSide;
  // Sky bounce, strongest high up where the overcast is actually visible. A roof faces straight at
  // the overcast and so catches far more of it than a facade — without that the view down the
  // canyon is a single black mass instead of stepped roof planes.
  float skyBounce = ( 0.22 + 0.78 * smoothstep( 0.1, 1.0, vUp ) ) * mix( 2.6, 1.0, vIsSide );
  concrete += uConcreteAmbient * skyBounce;
  // Roofs are gravel and plant decking: matte, so they take none of the facade's rib relief.
  concrete *= mix( 0.9, 1.0, vIsSide );
  // T6R-2 face shading: the overcast lights roofs and setback tops, the canyon-facing fronts of
  // tiers catch the haze glow, and the corridor faces sit darkest. Without this every face of a box
  // is the same value and stepped massing reads flat.
  float faceShade = vNormalW.y > 0.5 ? 1.0 : ( abs( vNormalW.z ) > 0.5 ? ( vNormalW.z > 0.0 ? 0.62 : 0.5 ) : 0.3 );
  concrete *= mix( 0.45, 1.6, faceShade );

  vec3 color = concrete;

  // --- wet reflection ---------------------------------------------------------------------------
  // Rain-slick facades: a grazing-angle sheen, broken into vertical runnels and heavier low down
  // where the water has had further to run.
  float fresnel = pow( 1.0 - clamp( dot( vNormalW, viewDir ), 0.0, 1.0 ), 4.0 );
  float runnel = skyHash11( floor( vSurf.x / 2.6 ) + vSeed * 131.0 + vFaceId * 17.0 );
  float wet = mix( 0.42, smoothstep( 0.58, 1.0, runnel ), fineDetail )
    * ( 0.3 + 0.7 * ( 1.0 - smoothstep( 0.0, 0.45, vUp ) ) );
  // T6R: the wet sheen picks up the neon around it — a slow cyan/magenta drift over the facade.
  float neonDrift = skyValueNoise( vWorldPos.yz * vec2( 0.004, 0.003 ) + vSeed * 7.0 );
  vec3 sheen = mix( uWetTint, mix( vec3( 0.15, 0.55, 0.75 ), vec3( 0.7, 0.18, 0.55 ), neonDrift ), 0.55 );
  color += sheen * fresnel * ( 0.2 + 0.8 * wet ) * vIsSide;

  // Wet arrises: a 1-2 px highlight on every box edge, so each mass separates from the one behind.
  vec2 edgeDistance = vFaceHalf - abs( vSurf );
  vec2 surfPerPixel = max( fwidth( vSurf ), vec2( 1e-4 ) );
  float edgePixels = min( edgeDistance.x / surfPerPixel.x, edgeDistance.y / surfPerPixel.y );
  float arrisLine = 1.0 - smoothstep( 0.5, 2.0, edgePixels );
  color += mix( sheen, vec3( 0.55, 0.7, 0.85 ), 0.5 ) * arrisLine * ( 0.1 + 0.18 * faceShade );

  // Hero blade light: coloured spill on the concrete around each giant sign, and the windows behind
  // and beside it go dark so the sign owns its patch of wall.
  vec3 heroSpill = vec3( 0.0 );
  float heroShadow = 0.0;
  for ( int i = 0; i < HERO_MAX; i ++ ) {
    if ( i >= uHeroCount ) break;
    vec4 blade = uHeroBlades[ i ];
    vec3 nearest = vec3( blade.x, clamp( vWorldPos.y, blade.y - blade.w, blade.y + blade.w ), blade.z );
    float d = length( vWorldPos - nearest );
    heroSpill += uHeroColors[ i ] * exp( - d / 55.0 );
    heroShadow = max( heroShadow, exp( - d / 70.0 ) );
  }
  color += heroSpill * 0.35;

  // --- window grid ------------------------------------------------------------------------------
  // Coarse blocks gate whole stacks dark, so the lit windows stay sparse and clustered instead of
  // speckling evenly over every slab.
  float blockHash = skyHash12( floor( cellUv / vec2( 4.0, 7.0 ) ) + faceOffset * 0.37 );
  float blockLive = step( 0.52, blockHash );

  float sd = windowSdf( cellLocal );
  float glass = ( 1.0 - smoothstep( -0.012, 0.012, sd ) ) * vIsSide * blockLive;
  // Soft halo: the glow the wet haze smears around every lit pane.
  float halo = ( 1.0 - smoothstep( -0.02, 0.3, sd ) ) * vIsSide * blockLive;

  float paneHash = skyHash12( cell + faceOffset );
  // Dark at street level, brightest through the mid-high floors, thinning again at the parapet.
  float litShare = mix( 0.03, 0.16, smoothstep( 0.04, 0.5, vUp ) )
    * ( 1.0 - 0.5 * smoothstep( 0.84, 1.0, vUp ) );
  float lit = step( 1.0 - litShare, paneHash );

  // Colour temperature: mostly warm interior light, some cold office pale, sparse neon.
  float tempHash = skyHash11( paneHash * 311.7 + vSeed * 53.0 );
  // T6R: a wider spread of colour temperatures, so lit panes read as rooms, not as one decal.
  vec3 sodium = vec3( 1.0, 0.55, 0.22 );
  vec3 warm = vec3( 1.0, 0.76, 0.46 );
  vec3 pale = vec3( 0.78, 0.86, 1.0 );
  vec3 cold = vec3( 0.48, 0.72, 1.0 );
  vec3 neonCyan = vec3( 0.22, 0.95, 1.0 );
  vec3 neonMagenta = vec3( 1.0, 0.24, 0.72 );
  vec3 paneColor = sodium;
  paneColor = mix( paneColor, warm, step( 0.18, tempHash ) );
  paneColor = mix( paneColor, pale, step( 0.48, tempHash ) );
  paneColor = mix( paneColor, cold, step( 0.7, tempHash ) );
  paneColor = mix( paneColor, neonCyan, step( 0.86, tempHash ) );
  paneColor = mix( paneColor, neonMagenta, step( 0.94, tempHash ) );

  float brightness = 0.2 + 0.8 * pow( skyHash11( paneHash * 71.3 + 2.0 ), 1.5 );
  // A handful of panes buzz. Cheap, and it stops the grid reading as a static decal.
  float buzzing = step( 0.965, skyHash11( paneHash * 17.7 + 9.0 ) );
  float buzz = 1.0 - buzzing * 0.55 * ( 0.5 + 0.5 * sin( uTime * 23.0 + paneHash * 120.0 ) );

  vec3 resolved = paneColor * ( lit * brightness * buzz ) * ( glass + halo * 0.28 ) * ( 1.0 - 0.9 * heroShadow );
  // What the grid averages out to once it stops resolving: lit share times mean pane brightness,
  // in the mean pane colour. Distant walls read as a dim glow rather than a field of sparks.
  vec3 averaged = vec3( 0.86, 0.72, 0.56 ) * ( litShare * 0.4 * blockLive * vIsSide );
  color += mix( averaged * ( 1.0 - 0.9 * heroShadow ), resolved, detail ) * 0.8;

  gl_FragColor = vec4( max( color, vec3( 0.0 ) ), 1.0 );

${SKYRIVER_OUTPUT_APPLY_GLSL}
  #include <fog_fragment>
}
`;

// --- trim shader ----------------------------------------------------------------------------------

const TRIM_VERTEX = /* glsl */ `
attribute float aSeed;
attribute float aKind;
attribute vec3 aSize;

varying vec3 vTrimLocal;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying float vSeed;
varying float vKind;
varying vec3 vSizeM;

#include <fog_pars_vertex>

void main() {
  vec3 transformed = vec3( position );
  vTrimLocal = transformed;
  vSizeM = aSize;
  vSeed = aSeed;
  vKind = aKind;

  vec4 world = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
  vWorldPos = world.xyz;
  vNormalW = normalize( mat3( modelMatrix ) * ( mat3( instanceMatrix ) * normal ) );

  vec4 mvPosition = modelViewMatrix * ( instanceMatrix * vec4( transformed, 1.0 ) );
  #include <fog_vertex>
  gl_Position = projectionMatrix * mvPosition;
}
`;

const TRIM_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform vec3 uConcreteAmbient;
uniform vec3 uWetTint;
uniform float uConcreteLevel;

varying vec3 vTrimLocal;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying float vSeed;
varying float vKind;
varying vec3 vSizeM;

#include <fog_pars_fragment>
${SKYRIVER_OUTPUT_PARS_GLSL}
${SKYRIVER_HASH_GLSL}

void main() {
  vec3 viewDir = normalize( cameraPosition - vWorldPos );
  // Metres along the instance's longest axis: the run of a gantry or the rise of a mast.
  float longest = max( vSizeM.x, max( vSizeM.y, vSizeM.z ) );
  float run = vSizeM.y >= longest - 0.001
    ? ( vTrimLocal.y + 0.5 ) * vSizeM.y
    : ( vSizeM.z >= longest - 0.001 ? ( vTrimLocal.z + 0.5 ) * vSizeM.z : ( vTrimLocal.x + 0.5 ) * vSizeM.x );

  float grain = skyValueNoise( vec2( run * 0.25, vSeed * 40.0 ) );
  vec3 base = vec3( 0.26, 0.27, 0.29 ) * uConcreteLevel * ( 0.7 + 0.6 * grain );
  base += uConcreteAmbient * 0.55;

  float fresnel = pow( 1.0 - clamp( dot( vNormalW, viewDir ), 0.0, 1.0 ), 4.0 );
  base += uWetTint * fresnel * 0.5;

  vec3 color = base;

  // Gantry (1) and cantilever (5): a line of amber deck lights spaced every ~6 m down the run.
  float isGantry = ( step( 0.5, vKind ) * ( 1.0 - step( 1.5, vKind ) ) )
    + ( step( 4.5, vKind ) * ( 1.0 - step( 5.5, vKind ) ) );
  float lamp = 1.0 - smoothstep( 0.0, 0.12, abs( fract( run / 6.0 ) - 0.5 ) );
  float lampLive = step( 0.25, skyHash11( floor( run / 6.0 ) + vSeed * 83.0 ) );
  color += vec3( 1.0, 0.68, 0.33 ) * ( isGantry * lamp * lampLive * 0.9 );

  // Antenna: a slow aircraft-warning beacon at the mast head.
  float isAntenna = 1.0 - step( 0.5, vKind );
  float head = smoothstep( 0.86, 1.0, vTrimLocal.y + 0.5 );
  float blink = 0.5 + 0.5 * sin( uTime * 1.9 + vSeed * 6.2831853 );
  color += vec3( 1.0, 0.16, 0.12 ) * ( isAntenna * head * blink * 1.5 );

  // Rib (3): darker recess shading toward the facade, a lit arris on the outer edge.
  float isRib = step( 2.5, vKind ) * ( 1.0 - step( 3.5, vKind ) );
  color *= 1.0 - 0.35 * isRib * smoothstep( 0.2, -0.5, vTrimLocal.y );

  // Floor band (4): a strip of light along the soffit, in long hashed runs, warm or cold.
  float isBand = step( 3.5, vKind ) * ( 1.0 - step( 4.5, vKind ) );
  float soffit = step( vNormalW.y, -0.5 );
  float runLive = step( 0.35, skyHash11( floor( run / 22.0 ) + vSeed * 57.0 ) );
  vec3 bandLight = mix( vec3( 1.0, 0.72, 0.42 ), vec3( 0.55, 0.85, 1.0 ), step( 0.6, vSeed ) );
  float edge = smoothstep( 0.5, 0.36, abs( vTrimLocal.y ) ) * ( 1.0 - soffit );
  color += bandLight * isBand * runLive * ( soffit * 0.55 + edge * 0.15 );

  // Skybridge (6): a dark mass with a ribbon of cold windows on each side and blue underlights.
  float isBridge = step( 5.5, vKind );
  float sideFace = step( 0.5, abs( vNormalW.z ) );
  float ribbon = smoothstep( 0.12, 0.08, abs( vTrimLocal.y - 0.05 ) );
  float pane = step( 0.3, fract( run / 4.0 ) ) * step( 0.3, skyHash11( floor( run / 4.0 ) + vSeed * 19.0 ) );
  color = mix( color, color * 0.55, isBridge );
  color += vec3( 0.72, 0.86, 1.0 ) * ( isBridge * sideFace * ribbon * pane * 1.1 );
  float under = step( vNormalW.y, -0.5 ) * ( 1.0 - smoothstep( 0.0, 0.1, abs( fract( run / 12.0 ) - 0.5 ) ) );
  color += vec3( 0.3, 0.6, 1.0 ) * ( isBridge * under * 1.4 );

  gl_FragColor = vec4( max( color, vec3( 0.0 ) ), 1.0 );

${SKYRIVER_OUTPUT_APPLY_GLSL}
  #include <fog_fragment>
}
`;

// --- neon sign shader -----------------------------------------------------------------------------

const SIGN_VERTEX = /* glsl */ `
attribute vec3 aCentre;
attribute vec2 aNormal;   // facade normal (flat signs) or canyon axis (blades), x and z
attribute vec2 aSize;     // across, up
attribute vec3 aColor;
attribute float aKind;
attribute float aSeed;

varying vec2 vSignUv;     // 0..1 across the sign face; outside that range is the halo
varying vec2 vLocal;      // metres from the sign centre
varying vec3 vSignColor;
varying float vSignKind;
varying float vSignSeed;
varying vec3 vSignNormal;
varying vec3 vWorldPos;
varying vec2 vSignSize;
varying float vMargin;

#include <fog_pars_vertex>

void main() {
  vec3 normalW = normalize( vec3( aNormal.x, 0.0, aNormal.y ) );
  // The normal is axis-aligned, so the in-plane tangent is a fixed 90 degree turn in xz.
  vec3 tangent = vec3( -normalW.z, 0.0, normalW.x );
  vec3 up = vec3( 0.0, 1.0, 0.0 );

  // T6R: the quad is grown by a halo margin, so every sign spills coloured light onto the wet
  // concrete and the haze around it — the scene is lit by its signage, not just decorated with it.
  float margin = clamp( 0.6 * min( aSize.x, aSize.y ), 3.0, 36.0 );
  vec2 extent = aSize + 2.0 * margin;
  vec2 local = position.xy * extent;
  vec3 world = aCentre + tangent * local.x + up * local.y;

  vLocal = local;
  vSignUv = local / aSize + 0.5;
  vSignColor = aColor;
  vSignKind = aKind;
  vSignSeed = aSeed;
  vSignNormal = normalW;
  vSignSize = aSize;
  vMargin = margin;
  vWorldPos = world;

  vec4 mvPosition = viewMatrix * vec4( world, 1.0 );
  #ifdef USE_FOG
    vFogDepth = - mvPosition.z;
    vSkyFogHeight = world.y;
  #endif
  gl_Position = projectionMatrix * mvPosition;
}
`;

const SIGN_FRAGMENT = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
uniform float uHalo;
uniform float uFogPenetration;

varying vec2 vSignUv;
varying vec2 vLocal;
varying vec3 vSignColor;
varying float vSignKind;
varying float vSignSeed;
varying vec3 vSignNormal;
varying vec3 vWorldPos;
varying vec2 vSignSize;
varying float vMargin;

#include <fog_pars_fragment>
${SKYRIVER_OUTPUT_PARS_GLSL}
${SKYRIVER_HASH_GLSL}

float roundedRect( vec2 uv, vec2 halfExtent, float radius ) {
  vec2 d = abs( uv - 0.5 ) - halfExtent + radius;
  return length( max( d, 0.0 ) ) + min( max( d.x, d.y ), 0.0 ) - radius;
}

/**
 * A procedural glyph: up to five hashed strokes (alternating horizontal and vertical, with hashed
 * position and extent) inside a padded cell. Reads as kanji/katakana-like lettering, never as any
 * real text, and costs a handful of ALU ops. g is 0..1 across the cell; f is the feather in cell units.
 */
float glyph( vec2 g, float seed, float f ) {
  vec2 q = ( g - 0.5 ) / 0.78 + 0.5;
  float m = 0.0;
  for ( int i = 0; i < 5; i ++ ) {
    float fi = float( i );
    float live = step( 0.22, skyHash11( seed * 17.0 + fi * 3.1 ) );
    float a = skyHash11( seed * 29.0 + fi * 5.7 );
    float b = skyHash11( seed * 41.0 + fi * 7.3 );
    float c = skyHash11( seed * 53.0 + fi * 2.9 );
    vec2 p = mod( fi, 2.0 ) < 0.5 ? q : q.yx;
    float pos = 0.08 + 0.84 * a;
    float s0 = 0.04 + 0.42 * b;
    float s1 = 0.96 - 0.42 * c;
    float d = max( abs( p.y - pos ) - 0.075, max( s0 - p.x, p.x - s1 ) );
    m = max( m, live * ( 1.0 - smoothstep( -f, f, d ) ) );
  }
  // A box frame on some glyphs (the radical-in-a-box shapes).
  float boxed = step( 0.72, skyHash11( seed * 7.7 ) );
  float frame = abs( roundedRect( q, vec2( 0.44 ), 0.02 ) ) - 0.06;
  m = max( m, boxed * ( 1.0 - smoothstep( -f, f, frame ) ) );
  return m;
}

void main() {
  vec2 fw = fwidth( vSignUv );
  float feather = max( 0.5 / max( min( vSignSize.x, vSignSize.y ), 1.0 ), max( fw.x, fw.y ) * 1.2 );
  vec2 uv = vSignUv;
  float inside = step( 0.0, uv.x ) * step( uv.x, 1.0 ) * step( 0.0, uv.y ) * step( uv.y, 1.0 );

  float mask;
  float rows;
  if ( vSignKind < 0.5 ) {
    // Banner / blade: a vertical column of square glyph cells, like vertical kanji signage.
    rows = clamp( floor( vSignSize.y / vSignSize.x * 0.92 ), 2.0, 12.0 );
    float row = floor( uv.y * rows );
    vec2 cell = vec2( ( uv.x - 0.5 ) * 1.1 + 0.5, fract( uv.y * rows ) );
    float g = glyph( cell, row + vSignSeed * 131.0, feather * rows * 1.2 );
    float frame = 1.0 - smoothstep( -feather, feather, abs( roundedRect( uv, vec2( 0.47, 0.49 ), 0.03 ) ) - 0.012 );
    mask = max( g, frame );
  } else if ( vSignKind < 1.5 ) {
    // Panel: a lit tube border around a line of square glyph cells.
    rows = clamp( floor( vSignSize.x / vSignSize.y * 0.85 ), 2.0, 12.0 );
    float column = floor( uv.x * rows );
    vec2 cell = vec2( fract( uv.x * rows ), ( uv.y - 0.5 ) * 1.25 + 0.5 );
    float g = glyph( cell, column + vSignSeed * 97.0, feather * rows * 1.2 );
    float frame = 1.0 - smoothstep( -feather, feather, abs( roundedRect( uv, vec2( 0.485, 0.46 ), 0.1 ) ) - 0.02 );
    mask = max( g, frame );
  } else {
    // Outline: a hollow lit frame.
    rows = 1.0;
    float sd = abs( roundedRect( uv, vec2( 0.42, 0.38 ), 0.1 ) ) - 0.05;
    mask = 1.0 - smoothstep( -feather * 2.0, feather * 2.0, sd );
  }
  // Once the glyphs stop resolving, settle to their average coverage instead of shimmering.
  float glyphPixels = 1.0 / max( max( fw.x, fw.y ) * rows, 1e-5 );
  mask = mix( 0.5, mask, smoothstep( 3.0, 9.0, glyphPixels ) ) * inside;

  // Halo: exponential spill around the sign rectangle, in metres.
  vec2 q = abs( vLocal ) - vSignSize * 0.5;
  float outside = length( max( q, 0.0 ) );
  float halo = exp( - outside / ( vMargin * 0.4 ) ) * ( 1.0 - inside * 0.6 );
  float plate = inside * 0.14;

  // Signs are double-sided: blades are seen from both canyon directions. Grazing views dim, but
  // never to nothing — the halo is volumetric, not a decal.
  vec3 viewDir = normalize( cameraPosition - vWorldPos );
  float facing = abs( dot( vSignNormal, viewDir ) );
  float angle = 0.3 + 0.7 * pow( facing, 0.5 );

  // A few tubes flicker; the rest breathe.
  float flickering = step( 0.9, skyHash11( vSignSeed * 29.0 + 5.0 ) );
  float flicker = mix(
    1.0 + 0.05 * sin( uTime * 2.3 + vSignSeed * 6.2831853 ),
    0.45 + 0.55 * step( 0.4, skyHash11( floor( uTime * 9.0 ) + vSignSeed * 7.0 ) ),
    flickering
  );

  vec3 hot = mix( vSignColor, vec3( 1.0 ), 0.08 );
  vec3 color = hot * mask * angle * uIntensity + vSignColor * ( plate + halo * uHalo );
  gl_FragColor = vec4( color * flicker, 1.0 );

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #ifdef USE_FOG
    // Additive: the haze swallows distant signs rather than tinting them — but light carries further
    // than concrete, so the attenuation is a softened curve.
    gl_FragColor.rgb *= pow( 1.0 - skyriverFogFactor(), uFogPenetration );
  #endif
}
`;

// --- city -----------------------------------------------------------------------------------------

export interface SkyriverCityOptions {
  readonly layout: SkyriverCityLayout;
  readonly quality: SkyriverQualitySettings;
}

export interface SkyriverCityStats {
  readonly towers: number;
  readonly trims: number;
  readonly signs: number;
  readonly meshes: number;
  readonly drawCalls: number;
  readonly drawCallBudget: number;
}

/**
 * Summarises what a layout will cost, without a GL context. The node acceptance check uses this.
 */
export function summarizeCityLayout(layout: SkyriverCityLayout): SkyriverCityStats {
  const trims = deriveCityTrims(layout);
  const signs = deriveNeonSigns(layout);
  return {
    towers: layout.towers.length,
    trims: trims.count,
    signs: signs.count,
    meshes: 3,
    drawCalls: 3,
    drawCallBudget: SKYRIVER_CITY_DRAW_CALL_BUDGET,
  };
}

/** Tower count for a layout. Pure; exposed for the node acceptance check. */
export function deriveTowerCount(layout: SkyriverCityLayout): number {
  return layout.towers.length;
}

/**
 * The canyon: three instanced passes, three draw calls.
 *
 * Instance buffers are written once in the constructor and never touched again — the only per-frame
 * work is one uniform write per material, so the update path allocates nothing.
 */
export class SkyriverCity {
  readonly group = new THREE.Group();
  readonly towerMesh: THREE.InstancedMesh;
  readonly trimMesh: THREE.InstancedMesh;
  readonly signMesh: THREE.Mesh;

  private readonly towerMaterial: THREE.ShaderMaterial;
  private readonly trimMaterial: THREE.ShaderMaterial;
  private readonly signMaterial: THREE.ShaderMaterial;
  private readonly signGeometry: THREE.InstancedBufferGeometry;
  private readonly layout: SkyriverCityLayout;
  private readonly trims: SkyriverCityTrims;
  private readonly signs: SkyriverNeonSigns;

  constructor({ layout }: SkyriverCityOptions) {
    installSkyriverFogChunks();
    this.layout = layout;
    this.trims = deriveCityTrims(layout);
    this.signs = deriveNeonSigns(layout);
    this.group.name = 'skyriver.city';

    // T6R contrast: near-black concrete against the luminous haze (atmosphere.ts).
    // T6R-2: albedo crushed further toward black; the haze, signs and edges carry the read.
    const concreteAmbient = new THREE.Color(0x0b111b);
    const wetTint = new THREE.Color(0x567ba3);

    // --- towers -----------------------------------------------------------------------------------
    const heroBlades = deriveHeroBlades(layout).slice(0, 12);
    const heroColor = new THREE.Color();
    const heroUniforms = {
      blades: heroBlades.map((b) => new THREE.Vector4(b.x, b.y, b.z, b.height * 0.5)),
      colors: heroBlades.map((b) => heroColor.setHex(b.color, THREE.SRGBColorSpace).clone()),
      count: heroBlades.length,
    };
    while (heroUniforms.blades.length < 12) {
      heroUniforms.blades.push(new THREE.Vector4(0, -1e5, 0, 0));
      heroUniforms.colors.push(new THREE.Color(0));
    }
    const towerGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.towerMaterial = new THREE.ShaderMaterial({
      name: 'skyriver.city.towers',
      vertexShader: TOWER_VERTEX,
      fragmentShader: TOWER_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uCellWidth: { value: SKYRIVER_CITY.windowCellWidthM },
        uCellHeight: { value: SKYRIVER_CITY.windowCellHeightM },
        uRibSpacing: { value: SKYRIVER_CITY.ribSpacingM },
        uProjScale: { value: 400 },
        uConcreteLevel: { value: 0.032 },
        uConcreteAmbient: { value: concreteAmbient },
        uWetTint: { value: wetTint },
        uHeroBlades: { value: heroUniforms.blades },
        uHeroColors: { value: heroUniforms.colors },
        uHeroCount: { value: heroUniforms.count },
        ...skyriverFogUniforms(),
      },
      fog: true,
    });
    this.towerMesh = new THREE.InstancedMesh(
      towerGeometry,
      this.towerMaterial,
      Math.max(deriveCityMasses(layout).length, 1),
    );
    this.towerMesh.name = 'skyriver.city.towers';
    this.writeTowers();
    this.group.add(this.towerMesh);

    // --- trim -------------------------------------------------------------------------------------
    const trimGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.trimMaterial = new THREE.ShaderMaterial({
      name: 'skyriver.city.trim',
      vertexShader: TRIM_VERTEX,
      fragmentShader: TRIM_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uConcreteLevel: { value: 0.075 },
        uConcreteAmbient: { value: concreteAmbient },
        uWetTint: { value: wetTint },
        ...skyriverFogUniforms(),
      },
      fog: true,
    });
    this.trimMesh = new THREE.InstancedMesh(
      trimGeometry,
      this.trimMaterial,
      Math.max(this.trims.count, 1),
    );
    this.trimMesh.name = 'skyriver.city.trim';
    this.trimMesh.count = this.trims.count;
    this.writeTrims();
    this.group.add(this.trimMesh);

    // --- neon signs -------------------------------------------------------------------------------
    this.signMaterial = new THREE.ShaderMaterial({
      name: 'skyriver.city.signs',
      vertexShader: SIGN_VERTEX,
      fragmentShader: SIGN_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 1.9 },
        uHalo: { value: 0.32 },
        uFogPenetration: { value: 0.55 },
        ...skyriverFogUniforms(),
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      fog: true,
    });
    this.signGeometry = this.buildSignGeometry();
    this.signMesh = new THREE.Mesh(this.signGeometry, this.signMaterial);
    this.signMesh.name = 'skyriver.city.signs';
    // Built in world space in the vertex shader, so three's object-space bounds mean nothing here.
    this.signMesh.frustumCulled = false;
    this.signMesh.renderOrder = 4;
    this.group.add(this.signMesh);

    applySkyriverFog(this.towerMaterial);
    applySkyriverFog(this.trimMaterial);
    applySkyriverFog(this.signMaterial);
  }

  /**
   * Vertical pixels per metre at one metre of view depth: `drawingBufferHeight / (2 * tan(fov/2))`.
   * The tower shader needs it to know when the window grid is too small on screen to resolve.
   * The scene calls this on every resize and on any field-of-view change.
   */
  setProjectionScale(pixelsPerMetreAtUnitDepth: number): void {
    this.towerMaterial.uniforms.uProjScale.value = pixelsPerMetreAtUnitDepth;
  }

  /** One uniform write per material. No allocation, nothing per instance. */
  update(frame: SkyriverFrame): void {
    const { time } = frame;
    this.towerMaterial.uniforms.uTime.value = time;
    this.trimMaterial.uniforms.uTime.value = time;
    this.signMaterial.uniforms.uTime.value = time;
  }

  stats(): SkyriverCityStats {
    return {
      towers: this.towerMesh.count,
      trims: this.trimMesh.count,
      signs: this.signGeometry.instanceCount,
      meshes: 3,
      drawCalls: 3,
      drawCallBudget: SKYRIVER_CITY_DRAW_CALL_BUDGET,
    };
  }

  dispose(): void {
    this.towerMesh.geometry.dispose();
    this.towerMaterial.dispose();
    this.trimMesh.geometry.dispose();
    this.trimMaterial.dispose();
    this.signGeometry.dispose();
    this.signMaterial.dispose();
    this.towerMesh.dispose();
    this.trimMesh.dispose();
  }

  // --- internals ----------------------------------------------------------------------------------

  private writeTowers(): void {
    const masses = deriveCityMasses(this.layout);
    const matrix = new THREE.Matrix4();
    const tint = new THREE.Color();
    const slots = Math.max(masses.length, 1);
    const seeds = new Float32Array(slots);
    const tints = new Float32Array(slots * 3);
    const sizes = new Float32Array(slots * 3);

    for (let i = 0; i < masses.length; i += 1) {
      const mass = masses[i]!;
      matrix.makeScale(mass.width, mass.height, mass.depth);
      matrix.setPosition(mass.x, mass.y0 + mass.height * 0.5, mass.z);
      this.towerMesh.setMatrixAt(i, matrix);

      tint.setHex(mass.tint, THREE.SRGBColorSpace);
      tints[i * 3] = tint.r;
      tints[i * 3 + 1] = tint.g;
      tints[i * 3 + 2] = tint.b;

      sizes[i * 3] = mass.width;
      sizes[i * 3 + 1] = mass.height;
      sizes[i * 3 + 2] = mass.depth;

      // Seeded off the layout, not off a fresh stream: same seed, same facades, on every peer.
      seeds[i] = hash1(mass.x * 0.173 + mass.z * 0.0411 + mass.height * 0.0017 + i * 0.37);
    }

    this.towerMesh.count = masses.length;
    this.towerMesh.instanceMatrix.needsUpdate = true;
    this.towerMesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.towerMesh.geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
    this.towerMesh.geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 3));
    // Culling off keeps the draw-call count fixed, which is what the A3 smoke test asserts.
    this.towerMesh.frustumCulled = false;
  }

  private writeTrims(): void {
    const { count, cx, cy, cz, sx, sy, sz, kind, seedValue } = this.trims;
    const matrix = new THREE.Matrix4();
    const slots = Math.max(count, 1);
    const seeds = new Float32Array(slots);
    const kinds = new Float32Array(slots);
    const sizes = new Float32Array(slots * 3);

    for (let i = 0; i < count; i += 1) {
      matrix.makeScale(sx[i], sy[i], sz[i]);
      matrix.setPosition(cx[i], cy[i], cz[i]);
      this.trimMesh.setMatrixAt(i, matrix);
      seeds[i] = seedValue[i];
      kinds[i] = kind[i];
      sizes[i * 3] = sx[i];
      sizes[i * 3 + 1] = sy[i];
      sizes[i * 3 + 2] = sz[i];
    }

    this.trimMesh.instanceMatrix.needsUpdate = true;
    this.trimMesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.trimMesh.geometry.setAttribute('aKind', new THREE.InstancedBufferAttribute(kinds, 1));
    this.trimMesh.geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 3));
    this.trimMesh.frustumCulled = false;
  }

  private buildSignGeometry(): THREE.InstancedBufferGeometry {
    const { count, cx, cy, cz, nx, nz, sw, sh, color, kind, seedValue } = this.signs;
    const quad = new THREE.PlaneGeometry(1, 1);
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index;
    geometry.setAttribute('position', quad.getAttribute('position'));
    geometry.setAttribute('uv', quad.getAttribute('uv'));
    geometry.instanceCount = count;

    const centres = new Float32Array(count * 3);
    const normals = new Float32Array(count * 2);
    const sizes = new Float32Array(count * 2);
    const kinds = new Float32Array(count);

    for (let i = 0; i < count; i += 1) {
      centres[i * 3] = cx[i];
      centres[i * 3 + 1] = cy[i];
      centres[i * 3 + 2] = cz[i];
      normals[i * 2] = nx[i];
      normals[i * 2 + 1] = nz[i];
      sizes[i * 2] = sw[i];
      sizes[i * 2 + 1] = sh[i];
      kinds[i] = kind[i];
    }

    geometry.setAttribute('aCentre', new THREE.InstancedBufferAttribute(centres, 3));
    geometry.setAttribute('aNormal', new THREE.InstancedBufferAttribute(normals, 2));
    geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 2));
    geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(color.slice(0, count * 3), 3));
    geometry.setAttribute('aKind', new THREE.InstancedBufferAttribute(kinds, 1));
    geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedValue.slice(0, count), 1));

    quad.dispose();
    return geometry;
  }
}

/** Deterministic scalar hash, the CPU twin of `skyHash11`. Keeps facade seeding off Math.random. */
function hash1(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

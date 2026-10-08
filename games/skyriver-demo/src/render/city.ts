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
 * sparse lit window grids, wet surfaces catching the neon, and spaced signs.
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

import { encodeCard, quantize, SKYRIVER_STRUCTURE_MATERIAL_GLSL } from './structureMaterial.js';

import type { SkyriverCityLayout, SkyriverTower } from '../sim/derive';
import {
  SKYRIVER_HASH_GLSL,
  SKYRIVER_EMISSIVE_GAIN,
  SKYRIVER_OUTPUT_APPLY_GLSL,
  SKYRIVER_OUTPUT_PARS_GLSL,
  applySkyriverFog,
  installSkyriverFogChunks,
  skyriverFogUniforms,
} from './atmosphere';
import { skyriverDeclareStageRole } from './stageRoles';
import type { SkyriverFrame, SkyriverQualitySettings } from './scene';
import { HERO_HORIZONTAL_CELLS, HERO_VERTICAL_CELLS, createSignAtlas, type SignAtlas } from './signAtlas';
import { createInteriorAtlas, type InteriorAtlas } from './interiorAtlas';
import {
  FACADE_FACE_EDGE_MARGIN_M,
  FACADE_STEP_MASK_BAND_M,
  facadeFaceContains,
  fitOnNearestFacadeFace,
  facadeReservationsConflict,
  type FacadeFace,
  type FacadeRect,
  type FacadeReservation,
} from './facadeGeometry';
import {
  SKYRIVER_INTERIOR_AVERAGE_GAIN,
  SKYRIVER_INTERIOR_DARKROOM_SPILL,
  SKYRIVER_INTERIOR_DIM_SHARE,
  SKYRIVER_INTERIOR_FADE,
  SKYRIVER_INTERIOR_RESPONSE_GLSL,
  SKYRIVER_INTERIOR_SHEEN_GAIN,
} from './interiorResponse';
import {
  IMPOSTOR_BODY_PX,
  IMPOSTOR_CAP,
  IMPOSTOR_COLUMNS,
  IMPOSTOR_CROWN_PX,
  IMPOSTOR_FLAT,
  IMPOSTOR_ROWS,
  IMPOSTOR_SPIRE,
  createImpostorAtlas,
  type ImpostorAtlas,
} from './impostorAtlas';
import { CANYON_LOOP_LENGTH_M, canyonBendApexes, foldsInsideBend, intrudesOtherStretch, warpCanyon, warpDirection, wrapCanyonV, type WarpOut } from './canyonWarp';
import {
  SKYRIVER_DISTRICT_COLOUR_GLSL,
  SKYRIVER_DISTRICT_COUNT,
  SKYRIVER_DISTRICT_DISTANCE_GRADE_GLSL,
  SKYRIVER_DISTRICT_SATURATION,
  SKYRIVER_DISTRICT_SOURCE_TERMS,
  SKYRIVER_DISTRICT_UNIT_HUE,
  SKYRIVER_DISTRICT_UNTOUCHED_TERMS,
  SKYRIVER_LUMA,
  assignSkyriverSignDistricts,
  deriveSkyriverDistrictModel,
  skyriverDistanceGradeBrightness,
  skyriverDistanceGradeK,
  skyriverDistrictAt,
  skyriverDistrictDistanceGrade,
  skyriverDistrictIdAt,
  skyriverDistrictSignEmission,
  skyriverGlslFloat,
  skyriverHexToLinear,
  skyriverLegacyDistanceGrade,
  skyriverLinearY,
  skyriverRecolorPreservingY,
  skyriverSignFinalEmission,
  type SkyriverDistrict,
  type SkyriverDistrictColourSwitch,
  type SkyriverDistrictModel,
  type SkyriverDistrictSignAssignment,
  type SkyriverDistrictSignCounts,
  type SkyriverDistrictSignInput,
  type SkyriverLinearRgb,
} from './districts';
import { ROUTE_MAX_ALTITUDE_M, STRATA_GRIME_TOP_M, STRATA_PRISTINE_BASE_M, routeAltitude, routeLateral } from './routeProfile';
import { podiumLotHeight } from './presentationLayout';

/** Draw calls this module may spend (plan T3 allows 10 city-only; the shared budget allots 8). */
export const SKYRIVER_CITY_DRAW_CALL_BUDGET = 8;

/** T7-4 interior mapping per tier. */
export type SkyriverInteriorMode = 'full' | 'near' | 'off';
/** View-depth fade windows (start, end), metres: rooms within start, emissive panes beyond end. */
export { SKYRIVER_INTERIOR_FADE };

export const SKYRIVER_CONTACT_AO = Object.freeze({
  legacyMinimum: 0.35,
  legacyHeightM: 40,
  tunedMinimum: 0.6,
  tunedHeightM: 60,
  topEdgeDarken: 0.06,
  topEdgeWidthM: 4,
});

function contactSmoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function contactShadowFactor(footHeightM: number, tuned = true): number {
  const minimum = tuned ? SKYRIVER_CONTACT_AO.tunedMinimum : SKYRIVER_CONTACT_AO.legacyMinimum;
  const height = tuned ? SKYRIVER_CONTACT_AO.tunedHeightM : SKYRIVER_CONTACT_AO.legacyHeightM;
  return minimum + (1 - minimum) * contactSmoothstep(0, height, footHeightM);
}

export function contactTopEdgeFactor(distanceM: number, tuned = true): number {
  return 1 - (tuned ? SKYRIVER_CONTACT_AO.topEdgeDarken : 0)
    * (1 - contactSmoothstep(0, SKYRIVER_CONTACT_AO.topEdgeWidthM, distanceM));
}

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
  maxTrims: 16000,
  maxSigns: 2600,
  /** R19.9 reference value. The fixed candidate budget sets current sign density. */
  signTarget: 2200,
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
/** T7-4 grime: balcony slabs and their railings (instanced like every other trim). */
export const SKYRIVER_TRIM_BALCONY = 7;
export const SKYRIVER_TRIM_RAILING = 8;
/** R11 landmark lighting: emissive floodlight edge strips and spires on the mega-towers. */
export const SKYRIVER_TRIM_FLOOD = 9;
/**
 * The floor band carries two source colours, warm and cold, selected by the instance's own seed.
 * The trim shader interpolates this threshold into its `step( …, vSeed )`, and the source evidence
 * reads the same constant, so the two can never disagree about which band emits which colour.
 */
export const SKYRIVER_TRIM_BAND_COLD_SEED = 0.6;
/** Skybridge altitude band and the canyon stretch they keep out of (the free-flight box, |z| <= 400). */
export const SKYRIVER_SKYBRIDGE_MIN_Y_M = 2700;
export const SKYRIVER_SKYBRIDGE_MIN_ABS_Z_M = 600;
/** R17: longest single seam block; longer seams are split so they follow the canyon's curve. */
const SEAM_SEGMENT_M = 180;
/** R16: longest gantry between two slabs, metres. */
export const SKYRIVER_GANTRY_MAX_SPAN_M = 300;

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
  /**
   * R16: the mass each trim stands on. A trim is placed rigidly in its owner's warped frame, so it
   * stays on its building through the bends (the warp is near-singular at a bend's centre).
   */
  readonly owner: readonly SkyriverTrimOwner[];
  /** R16: for gantries, the second building of the span (its far end is placed in that frame). */
  readonly spanTo: readonly (SkyriverTrimOwner | null)[];
}

/** A mass a trim is attached to, in canyon space. */
export interface SkyriverTrimOwner {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  /** The along-canyon coordinate the owner is placed rigidly around (its own z, or its tower's). */
  readonly anchorV: number;
}

export type PushTrim = (
  kind: number,
  px: number,
  py: number,
  pz: number,
  ex: number,
  ey: number,
  ez: number,
  on: SkyriverTrimOwner,
  to?: SkyriverTrimOwner | null,
) => void;

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
  readonly faceId: readonly (string | null)[];
  readonly buildingId: readonly (string | null)[];
  readonly compositionId: readonly (string | null)[];
  readonly rootHalfWidthM: Float32Array;
  readonly ordinaryCount: number;
  readonly heroCount: number;
  readonly acceptedByLoopSection: readonly number[];
  /** Every mounted sign's face owner, so it stays attached through canyon bends. */
  readonly owner: readonly (SkyriverTrimOwner | null)[];
  /**
   * R22: the canyon route position, in float64, that this sign is classified by — a hero's own z,
   * and every other sign's building anchor (the same double its facade's masses, trims and rooms
   * are classified by). Never `cz`: cz is float32, and an anchor one float32 ulp from a jittered
   * district boundary would put a facade and its own signs in two different districts.
   */
  readonly anchorV: Float64Array;
}

export type SkyriverLowBaseKind = 'skirt' | 'infill' | 'link' | 'equipment';
export type SkyriverLowBaseCluster = 0 | 1 | 2 | 3;

export interface SkyriverLowBaseRecord {
  readonly kind: SkyriverLowBaseKind;
  readonly towerOwner: string;
  readonly cluster: SkyriverLowBaseCluster;
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
  /** R15 depth layer: 0 = the real city; 1-3 = simplified far-skyline silhouettes, deeper = dimmer. */
  readonly layer?: number;
  /**
   * R16: place this mass rigidly in the frame of the canyon at this v (its tower's centre), not at
   * its own centre. Tiers and annexes then stay flush with their slab through the bends.
   */
  readonly anchorV?: number;
  /** R16: the building's identity seed (0..1) when this mass belongs to another's slab. */
  readonly building?: number;
  /** R19.9 pane mask at an actual facade tier edge. */
  readonly stepBottom?: boolean;
  readonly stepTop?: boolean;
  /** R25: canonical canyon-space owner seed for seeded material profiles. */
  readonly materialOwner?: number;
  /** R27: low-city base sprawl identity record. */
  readonly baseRecord?: SkyriverLowBaseRecord;
}

export function isLowBaseMass(mass: SkyriverMass): mass is SkyriverMass & { readonly baseRecord: SkyriverLowBaseRecord } {
  return mass.baseRecord !== undefined;
}

export interface SkyriverFacadeFace extends FacadeFace {
  readonly projection: number;
  readonly owner: SkyriverTrimOwner;
}

/** R16: per-building identity seed, from the slab's canyon centre. */
export function buildingSeedOf(x: number, z: number): number {
  return hash1(x * 0.0173 + z * 0.00411 + 0.5);
}

/** A tower or mass as a trim owner, placed around its own centre unless told otherwise. */
function ownerOf(mass: { readonly x: number; readonly z: number; readonly width: number; readonly depth: number }, anchorV = mass.z): SkyriverTrimOwner {
  return { x: mass.x, z: mass.z, width: mass.width, depth: mass.depth, anchorV };
}

/**
 * R16: canyon point (x, v) carried rigidly with the frame at `anchorV`: the anchor is warped and
 * the offset from it is turned by the anchor's heading, never warped point by point. Writes world
 * x/z and heading into `out`.
 */
export function warpRigid(x: number, v: number, anchorV: number, out: WarpOut): WarpOut {
  warpCanyon(0, anchorV, out);
  const dv = v - anchorV;
  const c = Math.cos(out.heading);
  const s = Math.sin(out.heading);
  // across = (cos h, -sin h), along = (sin h, cos h)
  out.x += x * c + dv * s;
  out.z += -x * s + dv * c;
  return out;
}

/**
 * Every wall continues this far below the canyon floor. The depths haze (atmosphere.ts) swallows it,
 * so there is no wall foot and no plane edge anywhere: the canyon bottom reads as void.
 */
export const SKYRIVER_CITY_VOID_BASE_Y = -2600;
/** The far skyline is a cold, darker concrete so the haze grades it into layered silhouettes. */
const TOWER_FAR_TINT = 0x3c4450;
/** T7-3 grime annexes: stained brown concrete and rust. */
const GRIME_TINT = 0x6a5440;
/** T7-5 landmark mega-towers: pale clean concrete so they stand apart from the walls. */
const MEGA_TINT = 0x9aa3ad;
/** R14: the showcase tower's base, metres (others are 240 m). */
export const SKYRIVER_SHOWCASE_BASE_M = 340;
/** R13: the showcase bend (the lap's second tight bend, reached ~15 s in). */
export const SKYRIVER_SHOWCASE_BEND_V = (() => {
  const apexes = canyonBendApexes(900).map((a) => a.v).map((v) => ((v % CANYON_LOOP_LENGTH_M) + CANYON_LOOP_LENGTH_M) % CANYON_LOOP_LENGTH_M).sort((a, b) => a - b);
  const second = apexes[1] ?? apexes[0] ?? 0;
  return second > CANYON_LOOP_LENGTH_M / 2 ? second - CANYON_LOOP_LENGTH_M : second;
})();

/** |x| of the inner column on a tower's side (for telling inner-wall slabs from outer columns). */
function innerWallX(layout: SkyriverCityLayout, tower: SkyriverTower): number {
  const wall = innerWallOf(layout, (Math.sign(tower.x) || 1) as -1 | 1);
  return wall.length === 0 ? Math.abs(tower.x) : Math.abs(wall[0]!.x);
}

const trimCache = new Map<number, SkyriverCityTrims>();
const massCache = new Map<number, SkyriverMass[]>();
/** R16: the far-city layers as impostor cards, one per far tower (body, cap and spire together). */
export interface SkyriverFarTower {
  readonly x: number;
  readonly v: number;
  readonly width: number;
  /** Top of the whole tower (spire included), metres. */
  readonly top: number;
  /** Depth layer 1-3, deeper = dimmer and hazier. */
  readonly layer: number;
  /** 0 flat top, 1 stepped cap, 2 cap and spire. */
  readonly shape: number;
}
const farTowerCache = new Map<number, SkyriverFarTower[]>();

/** R16: the far-city towers (as cards). Pure and cached; derived alongside the trims. */
export function deriveFarTowers(layout: SkyriverCityLayout): readonly SkyriverFarTower[] {
  deriveCityTrims(layout);
  const far = farTowerCache.get(layout.seed);
  if (far === undefined) fail('SKYRIVER_CITY_FAR_TOWERS_MISSING');
  return far;
}
/**
 * R11: mega-tower centres (canyon space). They sit at bend centres of curvature, where the warp
 * crushes canyon-space offsets, so their floodlight trims are placed rigidly around the warped
 * centre instead of being warped one by one.
 */
const megaAnchorCache = new Map<number, { x: number; v: number }[]>();
interface FacadeTier {
  readonly face: SkyriverFacadeFace;
}

/** Per seed: exposed corridor faces for each existing inner-wall lot. */
const tierCache = new Map<number, Map<string, readonly FacadeTier[]>>();
const facadeFaceCache = new Map<number, readonly SkyriverFacadeFace[]>();

function towerKey(tower: SkyriverTower): string {
  return `${tower.x.toFixed(2)}:${tower.z.toFixed(2)}`;
}

/** Largest corridor-face projection of a slab's tiers over [y0, y1], metres (0 for a bare slab). */
function tierProjectionOver(seed: number, tower: SkyriverTower, y0: number, y1: number): number {
  const tiers = tierCache.get(seed)?.get(towerKey(tower));
  if (tiers === undefined) return 0;
  let projection = 0;
  for (const tier of tiers) {
    if (tier.face.y1 > y0 && tier.face.y0 < y1) projection = Math.max(projection, tier.face.projection);
  }
  return projection;
}

/** Named exposed face records used by sign fitting and facade diagnostics. */
export function deriveFacadeFaces(layout: SkyriverCityLayout): readonly SkyriverFacadeFace[] {
  deriveCityTrims(layout);
  const faces = facadeFaceCache.get(layout.seed);
  if (faces === undefined) fail('SKYRIVER_CITY_FACADE_FACES_MISSING');
  return faces;
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
  const owner: SkyriverTrimOwner[] = [];
  const spanTo: (SkyriverTrimOwner | null)[] = [];
  let count = 0;

  const push = (
    trimKind: number,
    px: number,
    py: number,
    pz: number,
    ex: number,
    ey: number,
    ez: number,
    on: SkyriverTrimOwner,
    to: SkyriverTrimOwner | null = null,
  ): void => {
    if (count >= cap) return;
    owner[count] = on;
    spanTo[count] = to;
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
  /** Drops the trim just pushed (its seeded draws have already run). */
  const withdrawTrim = (): void => {
    count -= 1;
  };

  for (const side of [-1, 1] as const) {
    const wall = wallOf(layout, side);

    for (let i = 0; i < wall.length; i += 1) {
      const tower = wall[i]!;
      const towerOwner = ownerOf(tower);

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
          towerOwner,
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
          towerOwner,
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
            towerOwner,
            ownerOf(next),
          );
          // R16: where a tower was dropped the next slab can be kilometres on; no bridge that long
          // (it read as a bar floating across the sky). Pushed then withdrawn, so every seeded draw
          // still runs and the rest of the city is unchanged.
          // R17: with blade footprints the far end can miss a thin neighbour; both ends must land.
          if (span > SKYRIVER_GANTRY_MAX_SPAN_M || Math.abs(cx[count - 1]! - next.x) > next.width * 0.5 - 2) withdrawTrim();
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
            towerOwner,
            ownerOf(outward),
          );
          if (span > SKYRIVER_GANTRY_MAX_SPAN_M || Math.abs(cz[count - 1]! - outward.z) > outward.depth * 0.5 - 2) withdrawTrim();
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
  /** R16: a slab plus its tier projection out to `wallFace` (|x|), as the owner of face-mounted kit. */
  const faceOwner = (tower: SkyriverTower, wallFace: number): SkyriverTrimOwner => {
    const back = Math.abs(tower.x) + tower.width * 0.5;
    return { x: Math.sign(tower.x) * (wallFace + back) * 0.5, z: tower.z, width: back - wallFace, depth: tower.depth, anchorV: tower.z };
  };
  const tierMap = new Map<string, readonly FacadeTier[]>();
  const exposedFaces: SkyriverFacadeFace[] = [];
  const heroRows = deriveHeroRowPlans(layout);
  tierCache.set(layout.seed, tierMap);
  for (const wall of innerWalls) {
    for (let index = 0; index < wall.length; index += 1) {
      const tower = wall[index]!;
      const side = Math.sign(tower.x) as -1 | 1;
      const face = Math.abs(tower.x) - tower.width * 0.5;
      const available = face - CORRIDOR_CLEAR_X;
      const h = tower.height;

      const base = Math.min(82, available * 0.62);
      if (base < 10) continue;
      const buildingId = `tower:${towerKey(tower)}`;
      const row = heroRows.find((candidate) => candidate.tower === tower);
      let tops = h >= 1800
        ? [180, 390, 720, 1080, 1410, 1680].map((value, i) => value + (facadeHash01(layout.seed, tower, i + 1) - 0.5) * 34)
        : h >= 1100
          ? [h * 0.16, h * 0.34, h * 0.52, h * 0.70].map((value, i) => value + (facadeHash01(layout.seed, tower, i + 1) - 0.5) * 26)
          : h >= 700
            ? [h * 0.22, h * 0.46, h * 0.70].map((value, i) => value + (facadeHash01(layout.seed, tower, i + 1) - 0.5) * 22)
            : [];
      tops = tops.filter((top) => top >= 130 && top <= h - 150);
      if (row !== undefined && row.faceBottom > 130 && row.faceTop < h - 130) {
        tops = tops.filter((top) => top < row.faceBottom - 130 || top > row.faceTop + 130);
        tops.push(row.faceBottom, row.faceTop);
      }
      tops.sort((a, b) => a - b);
      const separated: number[] = [];
      for (const top of tops) {
        const reserved = row !== undefined && (Math.abs(top - row.faceBottom) < 0.01 || Math.abs(top - row.faceTop) < 0.01);
        if (reserved || separated.length === 0 || top - separated[separated.length - 1]! >= 130) separated.push(top);
      }
      while (separated.length > 6) {
        const drop = separated.findIndex((top) => row === undefined
          || (Math.abs(top - row.faceBottom) >= 0.01 && Math.abs(top - row.faceTop) >= 0.01));
        if (drop < 0) break;
        separated.splice(drop, 1);
      }
      tops = separated;

      const facesForTower: FacadeTier[] = [];
      const projections = tops.map((_, i) => base * Math.max(0.16, 1 - i * 0.15));
      const spans = tops.map((_, i) => tower.depth * Math.max(0.5, 1 - i * 0.085));
      let bottom = SKYRIVER_CITY_VOID_BASE_Y;
      for (let k = 0; k <= tops.length; k += 1) {
        const top = tops[k] ?? h;
        const isHeroFace = row !== undefined && Math.abs(bottom - row.faceBottom) < 0.05 && Math.abs(top - row.faceTop) < 0.05;
        const projection = k < tops.length && !isHeroFace ? projections[k]! : 0;
        const zSpan = isHeroFace ? tower.depth : (k < tops.length ? spans[k]! : tower.depth);
        const zCentre = tower.z;
        const tierMass: SkyriverMass = k < tops.length && projection > 0
          ? {
            x: side * (face - projection * 0.5 + 3),
            y0: bottom,
            z: zCentre,
            width: projection + 6,
            height: top - bottom,
            depth: zSpan,
            tint: tower.tint,
            anchorV: tower.z,
            building: buildingSeedOf(tower.x, tower.z),
            materialOwner: buildingSeedOf(tower.x, tower.z),
            stepBottom: k > 0,
            stepTop: true,
          }
          : {
            x: tower.x,
            y0: bottom,
            z: tower.z,
            width: tower.width,
            height: top - bottom,
            depth: tower.depth,
            tint: tower.tint,
            anchorV: tower.z,
            building: buildingSeedOf(tower.x, tower.z),
            materialOwner: buildingSeedOf(tower.x, tower.z),
            stepBottom: tops.length > 0,
            stepTop: k < tops.length,
          };
        if (k < tops.length && projection > 0) masses.push(tierMass);
        const faceOwnerMass = projection > 0 ? tierMass : tower;
        const faceOwner = ownerOf(faceOwnerMass, tower.z);
        const facadeFace: SkyriverFacadeFace = {
          id: `${buildingId}:face-${k}`,
          buildingId,
          side,
          planeAxis: 'x',
          plane: side * (face - projection),
          outward: -side as -1 | 1,
          u0: tower.z - zSpan * 0.5,
          u1: tower.z + zSpan * 0.5,
          y0: bottom,
          y1: top,
          stepBottom: k > 0,
          stepTop: k < tops.length,
          projection,
          owner: faceOwner,
        };
        const tier: FacadeTier = { face: facadeFace };
        facesForTower.push(tier);
        exposedFaces.push(facadeFace);
        const outer = face - projection;
        const tierOwner = faceOwner;
        // Ribs on this tier's face.
        const ribDepth = Math.min(14, outer - CORRIDOR_CLEAR_X - 1);
        if (ribDepth >= 3) {
          const ribs = Math.max(1, Math.floor(zSpan / 44));
          const ribBottom = Math.max(bottom, -300);
          for (let r = 0; r <= ribs; r += 1) {
            const z = zCentre - zSpan * 0.5 + 3.5 + (r / ribs) * (zSpan - 7);
            // T7-3 strata: high pristine faces are smooth, so ribs stop at the pristine base.
            const ribTop = Math.min(top - (r % 2 === 1 ? random.nextInt(0, 40) : 0), STRATA_PRISTINE_BASE_M + 80);
            if (ribTop <= ribBottom + 20) continue;
            push(SKYRIVER_TRIM_RIB, side * (outer - ribDepth * 0.5 + 0.5), (ribBottom + ribTop) * 0.5, z,
              ribDepth + 1, ribTop - ribBottom, 6 + random.nextInt(0, 30) / 10, tierOwner);
          }
        }
        // Floor slabs, then a thick parapet at the tier top.
        const slabDepth = Math.min(11, outer - CORRIDOR_CLEAR_X - 0.5);
        if (slabDepth >= 3) {
          let y = Math.max(bottom, 60) + 30 + random.nextInt(0, 40);
          while (y < Math.min(top - 25, STRATA_PRISTINE_BASE_M)) {
            push(SKYRIVER_TRIM_BAND, side * (outer - slabDepth * 0.5 + 0.5), y, zCentre,
              slabDepth + 1, 4.5 + random.nextInt(0, 20) / 10, zSpan + 3, tierOwner);
            y += 48 + random.nextInt(0, 45);
          }
          if (projection > 0) {
            push(SKYRIVER_TRIM_BAND, side * (outer - slabDepth * 0.5 + 0.5), top - 4, zCentre,
              slabDepth + 1, 8, zSpan + 4, tierOwner);
          }
        }
        bottom = top;
      }
      tierMap.set(towerKey(tower), facesForTower);

      // Crown: one or two stepped blocks on the roof.
      const crownW = tower.width * (0.42 + random.nextInt(0, 250) / 1000);
      const crownD = tower.depth * (0.42 + random.nextInt(0, 250) / 1000);
      const crownH = 50 + random.nextInt(0, 110);
      masses.push({ x: tower.x, y0: h - 2, z: tower.z, width: crownW, height: crownH, depth: crownD, tint: tower.tint, materialOwner: buildingSeedOf(tower.x, tower.z) });
      if (random.nextInt(0, 99) < 60) {
        masses.push({ x: tower.x, y0: h + crownH - 2, z: tower.z, width: crownW * 0.5, height: 25 + random.nextInt(0, 50), depth: crownD * 0.55, tint: tower.tint, materialOwner: buildingSeedOf(tower.x, tower.z) });
      }

      // Recessed mid-layer block in the seam to the next slab along the canyon.
      const next = wall[index + 1];
      if (next !== undefined && Math.abs(Math.abs(next.x) - Math.abs(tower.x)) < 1) {
        const gapStart = tower.z + tower.depth * 0.5;
        const gapEnd = next.z - next.depth * 0.5;
        if (gapEnd - gapStart > 16) {
          const setback = 30 + random.nextInt(0, 60);
          const width = 70 + random.nextInt(0, 80);
          const seamX = side * (Math.min(face, Math.abs(next.x) - next.width * 0.5) + setback + width * 0.5);
          const seamHeight = Math.min(h, next.height) * (0.38 + random.nextInt(0, 420) / 1000) - SKYRIVER_CITY_VOID_BASE_Y;
          // R17 clearance fix: where towers were dropped the seam runs up to ~1.7 km, and one straight
          // box that long cut across the curving corridor at bends (the camera flew through it at
          // 30.9, 42.3 and 46.2 s of the lap). The seam is now a run of <= SEAM_SEGMENT_M blocks,
          // each placed at its own centre, so the run follows the canyon's curve.
          const span = gapEnd - gapStart;
          const pieces = Math.max(1, Math.ceil(span / SEAM_SEGMENT_M));
          for (let k = 0; k < pieces; k += 1) {
            masses.push({
              x: seamX,
              y0: SKYRIVER_CITY_VOID_BASE_Y,
              z: gapStart + (k + 0.5) * (span / pieces),
              width,
              height: seamHeight,
              depth: span / pieces + 6,
              tint: tower.tint,
              materialOwner: buildingSeedOf(tower.x, tower.z),
            });
          }
        }
      }

      // Cantilevered gantries reaching toward the corridor from the outermost tier.
      const cantilevers = random.nextInt(0, 2);
      for (let c = 0; c < cantilevers; c += 1) {
        const tier = facesForTower[random.nextInt(0, facesForTower.length - 1)]!;
        const { y0: bottom, y1: top, projection } = tier.face;
        const outer = face - projection;
        const length = Math.min(30, outer - 412);
        if (length < 8) continue;
        const level = Math.max(bottom, 150) + random.nextInt(0, 1000) / 1000 * Math.max(Math.min(top, 1800) - Math.max(bottom, 150), 0);
        push(SKYRIVER_TRIM_CANTILEVER, side * (outer - length * 0.5), level,
          tower.z + (random.nextInt(-1000, 1000) / 1000) * (tower.depth * 0.5 - 12),
          length, 4 + random.nextInt(0, 20) / 10, 10 + random.nextInt(0, 80) / 10, faceOwner(tower, outer));
      }
    }
  }

  // --- T7-3 grime strata: buildings-on-buildings low on the inner walls ---------------------------
  // Below ~600 m the reference is utilitarian chaos: small blocks stacked on the big slabs, roofs
  // crowded with water tanks, AC boxes and masts. Annex blocks stack against the corridor face (they
  // stop at |x| >= ANNEX_CLEAR_X, the low corridor), each topped with clutter.
  const ANNEX_CLEAR_X = 372;
  for (const wall of innerWalls) {
    for (const tower of wall) {
      if (Math.abs(tower.z) < 650) continue; // keep the free-flight box's walls exactly as before
      const side = Math.sign(tower.x) as -1 | 1;
      const face = Math.abs(tower.x) - tower.width * 0.5;
      const annexes = 3 + random.nextInt(0, 4);
      for (let a = 0; a < annexes; a += 1) {
        const y0 = -60 + random.nextInt(0, 520);
        const height = 25 + random.nextInt(0, 90);
        const proj = tierProjectionOver(layout.seed, tower, y0, y0 + height);
        const outerFace = face - proj;
        const depthInto = Math.min(18 + random.nextInt(0, 30), outerFace - ANNEX_CLEAR_X);
        if (depthInto < 8) continue;
        const span = 20 + random.nextInt(0, 60);
        const z = tower.z + (random.nextInt(-1000, 1000) / 1000) * (tower.depth * 0.5 - span * 0.5);
        const ax = side * (outerFace - depthInto * 0.5 + 2);
        const annex: SkyriverMass = { x: ax, y0, z, width: depthInto + 4, height, depth: span, tint: GRIME_TINT, anchorV: tower.z, building: buildingSeedOf(tower.x, tower.z), materialOwner: buildingSeedOf(tower.x, tower.z) };
        masses.push(annex);
        const annexOwner = ownerOf(annex, tower.z);
        // Rooftop clutter: water tanks (squat), AC boxes (small), and the odd mast.
        const clutter = 2 + random.nextInt(0, 5);
        for (let c = 0; c < clutter; c += 1) {
          const cxo = ax + (random.nextInt(-1000, 1000) / 1000) * (depthInto * 0.35);
          const czo = z + (random.nextInt(-1000, 1000) / 1000) * (span * 0.4);
          const roll = random.nextInt(0, 99);
          if (roll < 40) {
            const d = 3 + random.nextInt(0, 30) / 10;
            push(SKYRIVER_TRIM_ROOF_PLANT, cxo, y0 + height + 2.5, czo, d, 5, d, annexOwner);
          } else if (roll < 85) {
            push(SKYRIVER_TRIM_ROOF_PLANT, cxo, y0 + height + 0.8, czo, 2.4, 1.6, 1.8, annexOwner);
          } else {
            const mh = 10 + random.nextInt(0, 25);
            push(SKYRIVER_TRIM_ANTENNA, cxo, y0 + height + mh * 0.5, czo, 0.6, mh, 0.6, annexOwner);
          }
        }
        // Cable bundles: thin sagging spans between neighbouring annexes, read as tangled lines.
        if (random.nextInt(0, 99) < 45) {
          push(SKYRIVER_TRIM_GANTRY, ax, y0 + height * 0.7, z + span * 0.5 + 10, 0.5, 0.5, 20, annexOwner);
        }
      }
    }
  }

  // --- T7-4 grime balconies: real ledges with railing hints on the low slabs -----------------------
  // Runs of balcony slabs on the corridor face below ~640 m: 1.6-2.4 m deep, a floor apart, with a
  // railing along the outer edge, broken into runs so the facade reads as lived-in clutter, plus a
  // few big vent/chimney boxes. Everything stays outside |x| >= ANNEX_CLEAR_X.
  const FLOOR_M = SKYRIVER_CITY.windowCellHeightM;
  for (const wall of innerWalls) {
    for (const tower of wall) {
      if (Math.abs(tower.z) < 650) continue;
      const side = Math.sign(tower.x) as -1 | 1;
      const face = Math.abs(tower.x) - tower.width * 0.5;
      const runs = 5 + random.nextInt(0, 6);
      for (let k = 0; k < runs; k += 1) {
        const yBase = 30 + random.nextInt(0, 560);
        const floors = 2 + random.nextInt(0, 6);
        const span = 10 + random.nextInt(0, 40);
        const zc = tower.z + (random.nextInt(-1000, 1000) / 1000) * (tower.depth * 0.5 - span * 0.5);
        const proj = tierProjectionOver(layout.seed, tower, yBase, yBase + floors * FLOOR_M);
        const wallFace = face - proj;
        const depth = 1.6 + random.nextInt(0, 8) / 10;
        if (wallFace - depth < ANNEX_CLEAR_X) continue;
        for (let f = 0; f < floors; f += 1) {
          const y = Math.round((yBase + f * FLOOR_M) / FLOOR_M) * FLOOR_M;
          push(SKYRIVER_TRIM_BALCONY, side * (wallFace - depth * 0.5), y, zc, depth + 0.4, 0.3, span, faceOwner(tower, wallFace));
          push(SKYRIVER_TRIM_RAILING, side * (wallFace - depth + 0.05), y + 0.65, zc, 0.12, 1.0, span, faceOwner(tower, wallFace));
        }
      }
      const vents = random.nextInt(0, 3);
      for (let k = 0; k < vents; k += 1) {
        const y0 = 40 + random.nextInt(0, 520);
        const h = 18 + random.nextInt(0, 40);
        const w = 4 + random.nextInt(0, 50) / 10;
        const proj = tierProjectionOver(layout.seed, tower, y0, y0 + h);
        const wallFace = face - proj;
        if (wallFace - w < ANNEX_CLEAR_X) continue;
        push(SKYRIVER_TRIM_ROOF_PLANT, side * (wallFace - w * 0.5), y0 + h * 0.5,
          tower.z + (random.nextInt(-1000, 1000) / 1000) * (tower.depth * 0.4), w, h, w * 1.3, faceOwner(tower, wallFace));
      }
    }
  }

  // --- T7-5 canyon-bottom service deck (cycle-5 P1: the hole at the bottom) ---------------------
  // The depths are filled with stacked low architecture: blocks of 30-110 m footprint at varied
  // heights (tops -140 to +70 m), a second smaller level on a third of them, rooftop plant and
  // masts — a cluttered roofscape seen from above, never a plane: heights jump by tens of metres
  // between neighbours, and there is no continuous surface or straight edge to read as ground or
  // road. Everything stays below 80 m, under every car (>= 120 m) and the route (>= ~350 m).
  {
    const DECK_HALF_X = 540;
    let v = -CANYON_LOOP_LENGTH_M / 2;
    while (v < CANYON_LOOP_LENGTH_M / 2) {
      const stepV = 35 + random.nextInt(0, 75);
      let x = -DECK_HALF_X + random.nextInt(0, 30);
      while (x < DECK_HALF_X) {
        const w = 30 + random.nextInt(0, 80);
        const d = Math.min(stepV + 10, 30 + random.nextInt(0, 80));
        const cx = x + w * 0.5;
        if (!foldsInsideBend(cx, v, w * 0.5)) {
          const top = -140 + random.nextInt(0, 210);
          const block: SkyriverMass = { x: cx, y0: SKYRIVER_CITY_VOID_BASE_Y, z: v + random.nextInt(-8, 8), width: w, height: top - SKYRIVER_CITY_VOID_BASE_Y, depth: d, tint: GRIME_TINT, materialOwner: buildingSeedOf(cx, v) };
          masses.push(block);
          const blockOwner = ownerOf(block);
          if (random.nextInt(0, 99) < 34) {
            const h2 = 12 + random.nextInt(0, 30);
            masses.push({ x: cx + random.nextInt(-8, 8), y0: top - 1, z: v, width: w * 0.55, height: h2, depth: d * 0.6, tint: GRIME_TINT, anchorV: block.z, materialOwner: buildingSeedOf(cx, v) });
          }
          if (random.nextInt(0, 99) < 40) {
            push(SKYRIVER_TRIM_ROOF_PLANT, cx + random.nextInt(-10, 10), top + 3, v + random.nextInt(-10, 10), 4 + random.nextInt(0, 6), 6, 4 + random.nextInt(0, 6), blockOwner);
          }
          if (random.nextInt(0, 99) < 12) {
            const mh = 20 + random.nextInt(0, 40);
            push(SKYRIVER_TRIM_ANTENNA, cx, top + mh * 0.5, v, 0.8, mh, 0.8, blockOwner);
          }
        }
        x += w + random.nextInt(4, 30);
      }
      v += stepV;
    }
  }

  // --- T7-5 landmark mega-towers: the route curves AROUND these ---------------------------------
  // One colossus at the centre of curvature of each tight bend. Its nearest face stays >= ~500 m from
  // the route's centreline, so the corridor is clear; at speed it reads as the tower the canyon bends
  // around, crowned with a lit stepped top, a spire and beacons.
  const megaAnchors: { x: number; v: number }[] = [];
  megaAnchorCache.set(layout.seed, megaAnchors);
  for (const apex of canyonBendApexes(900)) {
    const x = apex.side * apex.radius * 0.995;
    megaAnchors.push({ x, v: apex.v });
    const showcaseTower = Math.abs(apex.v - SKYRIVER_SHOWCASE_BEND_V) < 1;
    // R14: the showcase tower is broader (340 m base, nearest face ~465 m from the centreline, still
    // well clear of the corridor) so its floodlit face spans more of the frame at close range.
    const base = showcaseTower ? SKYRIVER_SHOWCASE_BASE_M : Math.min(240, (apex.radius - 500) * 2);
    if (base < 120) continue;
    const topsRandom = [random.nextInt(0, 400), random.nextInt(0, 300), random.nextInt(0, 300)];
    // R13: the showcase tower's crown is lowered into the approach's view (crown ~3.2 km, spire
    // above); the others keep their 5 km scale.
    const tops = showcaseTower
      ? [2700 + topsRandom[0]! * 0.25, 3050 + topsRandom[1]! * 0.25, 3300 + topsRandom[2]! * 0.25]
      : [3500 + topsRandom[0]!, 4400 + topsRandom[1]!, 5000 + topsRandom[2]!];
    masses.push({ x, y0: SKYRIVER_CITY_VOID_BASE_Y, z: apex.v, width: base, height: tops[0]! - SKYRIVER_CITY_VOID_BASE_Y, depth: base, tint: MEGA_TINT, materialOwner: buildingSeedOf(x, apex.v) });
    masses.push({ x, y0: tops[0]! - 4, z: apex.v, width: base * 0.72, height: tops[1]! - tops[0]! + 4, depth: base * 0.72, tint: MEGA_TINT, materialOwner: buildingSeedOf(x, apex.v) });
    masses.push({ x, y0: tops[1]! - 4, z: apex.v, width: base * 0.42, height: tops[2]! - tops[1]! + 4, depth: base * 0.42, tint: MEGA_TINT, materialOwner: buildingSeedOf(x, apex.v) });
    const megaOwner = ownerOf({ x, z: apex.v, width: base, depth: base });
    if (showcaseTower) {
      const buildingId = `mega:${apex.v.toFixed(2)}`;
      exposedFaces.push({
        id: `${buildingId}:brand-face`,
        buildingId,
        side: apex.side as -1 | 1,
        planeAxis: 'z',
        plane: apex.v - base * 0.5,
        outward: -1,
        u0: x - base * 0.5,
        u1: x + base * 0.5,
        y0: SKYRIVER_CITY_VOID_BASE_Y,
        y1: tops[0]!,
        stepBottom: false,
        stepTop: true,
        projection: 0,
        owner: megaOwner,
      });
    }
    const spire = 520 + random.nextInt(0, 300);
    push(SKYRIVER_TRIM_ANTENNA, x, tops[2]! + spire * 0.5, apex.v, 7, spire, 7, megaOwner);
    // R11 crown lighting: floodlit edges on each stage's top 260 m and a rim at every setback,
    // plus a lit spire core, so the landmark silhouette is outlined in light from bend entry.
    const stages: readonly (readonly [number, number])[] = [[base, tops[0]!], [base * 0.72, tops[1]!], [base * 0.42, tops[2]!]];
    for (const [size, top] of stages) {
      const half = size * 0.5 + 0.6;
      for (const cx of [-1, 1]) {
        for (const cz of [-1, 1]) {
          push(SKYRIVER_TRIM_FLOOD, x + cx * half, top - 130, apex.v + cz * half, 2.2, 260, 2.2, megaOwner);
        }
      }
      // R17 crown readability: the rim is 6 m tall and 3.6 m proud (was 2.4 x 2.2), so it reads
      // as a line of light on the approach, not as one more row of the facade's windows.
      push(SKYRIVER_TRIM_FLOOD, x, top + 2.5, apex.v - half - 0.7, size + 3, 6, 3.6, megaOwner);
      push(SKYRIVER_TRIM_FLOOD, x, top + 2.5, apex.v + half + 0.7, size + 3, 6, 3.6, megaOwner);
      push(SKYRIVER_TRIM_FLOOD, x - half - 0.7, top + 2.5, apex.v, 3.6, 6, size + 3, megaOwner);
      push(SKYRIVER_TRIM_FLOOD, x + half + 0.7, top + 2.5, apex.v, 3.6, 6, size + 3, megaOwner);
    }
    push(SKYRIVER_TRIM_FLOOD, x, tops[2]! + spire * 0.45, apex.v, 2.6, spire * 0.9, 2.6, megaOwner);
    // The crown sits far above the chase frame, so the outline runs down the whole tower body the
    // route bends around: full-height corner strips and a lit rim every ~420 m.
    const bodyHalf = base * 0.5 + 0.6;
    for (const cx of [-1, 1]) {
      for (const cz of [-1, 1]) {
        push(SKYRIVER_TRIM_FLOOD, x + cx * bodyHalf, (200 + tops[0]!) * 0.5, apex.v + cz * bodyHalf, 2.6, tops[0]! - 200, 2.6, megaOwner);
      }
    }
    for (let y = 840; y < tops[0]! - 100; y += 840) {
      push(SKYRIVER_TRIM_FLOOD, x, y, apex.v - bodyHalf, base + 2, 1.8, 1.8, megaOwner);
      push(SKYRIVER_TRIM_FLOOD, x, y, apex.v + bodyHalf, base + 2, 1.8, 1.8, megaOwner);
      push(SKYRIVER_TRIM_FLOOD, x - bodyHalf, y, apex.v, 1.8, 1.8, base + 2, megaOwner);
      push(SKYRIVER_TRIM_FLOOD, x + bodyHalf, y, apex.v, 1.8, 1.8, base + 2, megaOwner);
    }
    for (const corner of [-1, 1]) {
      push(SKYRIVER_TRIM_ANTENNA, x + corner * base * 0.3, tops[1]! + 110, apex.v + corner * base * 0.25, 3, 220, 3, megaOwner);
    }
  }

  // --- T7-3 tower profile variety: spears, flat tops, masts --------------------------------------
  // R17: only lots left 'plain' by the massing pass keep these tops; the others still take their
  // seeded draws (so every later draw is unchanged) but emit nothing here.
  for (const tower of layout.towers) {
    const legacy = massingArchetype(layout, tower) === 'plain';
    const roll = random.nextInt(0, 99);
    if (roll < 28) {
      // Spear: three narrowing stages and a mast — silhouettes against the sky band.
      let w = tower.width * 0.55;
      let d = tower.depth * 0.55;
      let y = tower.height - 2;
      for (let stage = 0; stage < 3; stage += 1) {
        const h = 90 + random.nextInt(0, 220);
        if (legacy) masses.push({ x: tower.x, y0: y, z: tower.z, width: w, height: h, depth: d, tint: tower.tint, materialOwner: buildingSeedOf(tower.x, tower.z) });
        y += h - 2;
        w *= 0.62;
        d *= 0.62;
      }
      const mast = 120 + random.nextInt(0, 260);
      push(SKYRIVER_TRIM_ANTENNA, tower.x, y + mast * 0.5, tower.z, 3.2, mast, 3.2, ownerOf(tower));
      if (!legacy) withdrawTrim();
    } else if (roll < 55 && Math.abs(Math.abs(tower.x) - innerWallX(layout, tower)) > 1) {
      // Flat top with roof plant and a short antenna cluster (outer columns only; inner walls have crowns).
      const roofOwner = ownerOf(tower);
      push(SKYRIVER_TRIM_ROOF_PLANT, tower.x, tower.height + 9, tower.z, tower.width * 0.6, 18, tower.depth * 0.5, roofOwner);
      if (!legacy) withdrawTrim();
      for (let m = 0; m < 3; m += 1) {
        const mh = 30 + random.nextInt(0, 90);
        push(SKYRIVER_TRIM_ANTENNA, tower.x + (random.nextInt(-1000, 1000) / 1000) * tower.width * 0.35,
          tower.height + mh * 0.5, tower.z + (random.nextInt(-1000, 1000) / 1000) * tower.depth * 0.35, 1.6, mh, 1.6, roofOwner);
        if (!legacy) withdrawTrim();
      }
    }
  }

  // --- R15 far-city depth layers -----------------------------------------------------------------
  // Three silhouette layers per side behind the walls, so gaps between towers, the canyon's open
  // stretches and the sky band above the rooflines show more city receding into the haze (city
  // forever) instead of a single fog-dimmed wall or blue void. Simple dark massing with sparse
  // window grids (no interiors, no signs, shaded by layer in the tower shader: deeper = dimmer and
  // hazier). They draw in the existing tower batch (a per-instance layer attribute), no new call.
  // Each layer keeps clear of every other stretch of the loop and of folding bend interiors.
  const FAR_LAYERS: readonly (readonly [number, number, number, number, number])[] = [
    // [min |x|, span, min height, height span, along spacing]
    // Heights clear the walls in front (inner 2.5-3.8 km): they read above the rooflines.
    [1750, 550, 3400, 2000, 150],
    [2700, 700, 4200, 2600, 190],
    [3800, 1100, 5000, 3200, 240],
  ];
  const farTowers: { x: number; v: number; width: number; top: number; layer: number; shape: number }[] = [];
  farTowerCache.set(layout.seed, farTowers);
  FAR_LAYERS.forEach(([minX, spanX, minH, spanH, spacing], li) => {
    for (const side of [-1, 1] as const) {
      for (let v = -CANYON_LOOP_LENGTH_M / 2; v < CANYON_LOOP_LENGTH_M / 2; v += spacing * (0.7 + random.nextInt(0, 600) / 1000)) {
        const x = side * (minX + random.nextInt(0, 1000) / 1000 * spanX);
        const width = 120 + random.nextInt(0, 160) + li * 40;
        if (intrudesOtherStretch(x, v, width, 700) || foldsInsideBend(x, v, width)) continue;
        const height = minH + random.nextInt(0, 1000) / 1000 * spanH;
        const tint = 0x2a3038;
        masses.push({ x, y0: SKYRIVER_CITY_VOID_BASE_Y, z: v, width, height: height - SKYRIVER_CITY_VOID_BASE_Y, depth: width * (0.7 + random.nextInt(0, 600) / 1000), tint, layer: li + 1, materialOwner: buildingSeedOf(x, v) });
        // R16: the same tower as one impostor card (top shape and full height).
        const far = { x, v, width, top: height, layer: li + 1, shape: 0 };
        farTowers.push(far);
        // A stepped top on about half: crowns and spires break the line into thousands-and-parts.
        if (random.nextInt(0, 99) < 55) {
          const capH = 120 + random.nextInt(0, 500);
          masses.push({ x, y0: height - 2, z: v, width: width * 0.5, height: capH, depth: width * 0.45, tint, layer: li + 1, materialOwner: buildingSeedOf(x, v) });
          far.top = height + capH;
          far.shape = 1;
          if (random.nextInt(0, 99) < 40) {
            const spireH = 150 + random.nextInt(0, 350);
            masses.push({ x, y0: height + capH - 2, z: v, width: width * 0.16, height: spireH, depth: width * 0.16, tint, layer: li + 1, materialOwner: buildingSeedOf(x, v) });
            far.top = height + capH + spireH;
            far.shape = 2;
          }
        }
      }
    }
  });

  // Far spears beyond the outer columns, on the outside of the loop: distant silhouettes that the
  // winding sightline swings across.
  for (let v = -CANYON_LOOP_LENGTH_M / 2; v < CANYON_LOOP_LENGTH_M / 2; v += 260 + random.nextInt(0, 160)) {
    for (const side of [-1, 1] as const) {
      const x = side * (1950 + random.nextInt(0, 900));
      const width = 90 + random.nextInt(0, 110);
      if (intrudesOtherStretch(x, v, width) || foldsInsideBend(x, v, width)) continue;
      const height = 2600 + random.nextInt(0, 2600);
      masses.push({ x, y0: SKYRIVER_CITY_VOID_BASE_Y, z: v, width, height: height - SKYRIVER_CITY_VOID_BASE_Y, depth: width * (0.8 + random.nextInt(0, 400) / 1000), tint: TOWER_FAR_TINT, materialOwner: buildingSeedOf(x, v) });
      masses.push({ x, y0: height - 2, z: v, width: width * 0.45, height: 120 + random.nextInt(0, 400), depth: width * 0.4, tint: TOWER_FAR_TINT, materialOwner: buildingSeedOf(x, v) });
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
      rightFace - leftFace, 14 + random.nextInt(0, 60) / 10, 20 + random.nextInt(0, 100) / 10, ownerOf(left), ownerOf(right));
    bridges += 1;
  }

  deriveMassingVariation(layout, innerWalls, masses, push);

  // Every derived slab, extended down into the void so no wall has a visible foot.
  for (const tower of layout.towers) {
    const tiers = tierMap.get(towerKey(tower));
    if (tiers === undefined || tiers.length < 2) {
      masses.unshift({
        x: tower.x,
        y0: SKYRIVER_CITY_VOID_BASE_Y,
        z: tower.z,
        width: tower.width,
        height: tower.height - SKYRIVER_CITY_VOID_BASE_Y,
        depth: tower.depth,
        tint: tower.tint,
        materialOwner: buildingSeedOf(tower.x, tower.z),
      });
      continue;
    }
    for (let i = tiers.length - 1; i >= 0; i -= 1) {
      const face = tiers[i]!.face;
      masses.unshift({
        x: tower.x,
        y0: face.y0,
        z: tower.z,
        width: tower.width,
        height: face.y1 - face.y0,
        depth: tower.depth,
        tint: tower.tint,
        anchorV: tower.z,
        building: buildingSeedOf(tower.x, tower.z),
        materialOwner: buildingSeedOf(tower.x, tower.z),
        stepBottom: face.stepBottom,
        stepTop: face.stepTop,
      });
    }
  }

  // --- R27 low-city base sprawl pass -------------------------------------------------------------
  const baseRandom = new DeterministicRandom(layout.seed).fork('skyriver.city.r27.base_sprawl');
  const pushBaseTrim: PushTrim = (
    trimKind: number,
    px: number,
    py: number,
    pz: number,
    ex: number,
    ey: number,
    ez: number,
    on: SkyriverTrimOwner,
    to: SkyriverTrimOwner | null = null,
  ): void => {
    if (count >= cap) fail('SKYRIVER_BASE_TRIM_CAP_EXCEEDED');
    owner[count] = on;
    spanTo[count] = to;
    cx[count] = px;
    cy[count] = py;
    cz[count] = pz;
    sx[count] = ex;
    sy[count] = ey;
    sz[count] = ez;
    kind[count] = trimKind;
    seedValue[count] = baseRandom.nextInt(0, 9999) / 9999;
    count += 1;
  };
  appendLowBaseSprawl(layout, masses, pushBaseTrim, baseRandom, () => count, cap);

  facadeFaceCache.set(layout.seed, exposedFaces);
  massCache.set(layout.seed, masses);

  owner.length = count;
  spanTo.length = count;
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
    owner,
    spanTo,
  };
  trimCache.set(layout.seed, trims);
  return trims;
}

// --- R27 low-city base sprawl implementation -----------------------------------------------------

interface InfillClusterPattern {
  readonly id: SkyriverLowBaseCluster;
  readonly dx: number;
  readonly dv: number;
  readonly widthRange: readonly [number, number];
  readonly depthRange: readonly [number, number];
  readonly heightRange: readonly [number, number];
}

const INFILL_CLUSTERS: readonly InfillClusterPattern[] = Object.freeze([
  { id: 0, dx: -35, dv: -45, widthRange: [32, 58], depthRange: [35, 62], heightRange: [18, 38] },
  { id: 1, dx: 45, dv: -30, widthRange: [38, 64], depthRange: [30, 52], heightRange: [22, 42] },
  { id: 2, dx: -40, dv: 40, widthRange: [30, 54], depthRange: [40, 68], heightRange: [16, 36] },
  { id: 3, dx: 40, dv: 35, widthRange: [36, 60], depthRange: [34, 56], heightRange: [24, 44] },
]);

function createLowBaseRecord(tower: SkyriverTower, cluster: SkyriverLowBaseCluster, kind: SkyriverLowBaseKind): SkyriverLowBaseRecord {
  return Object.freeze({
    kind,
    towerOwner: towerKey(tower),
    cluster,
  });
}

function checkLowBaseSafety(x: number, z: number, w: number, d: number): boolean {
  const reach = Math.hypot(w, d) * 0.5;
  if (foldsInsideBend(x, z, reach)) return false;
  if (intrudesOtherStretch(x, z, reach, 580)) return false;
  const innerFaceX = Math.abs(x) - w * 0.5;
  const requiredClearX = Math.abs(z) < 650 ? 408 : 374;
  if (innerFaceX < requiredClearX) return false;
  return true;
}

interface LowBaseSpatialItem {
  readonly cx: number;
  readonly cz: number;
  readonly y0: number;
  readonly y1: number;
  readonly c: number;
  readonly s: number;
  readonly hx: number;
  readonly hz: number;
  readonly reach: number;
  readonly mass: SkyriverMass;
}

interface LowBaseSpatialGrid {
  readonly grid: Map<number, LowBaseSpatialItem[]>;
  readonly cellSize: number;
}

function insertLowBaseSpatialMass(spatial: LowBaseSpatialGrid, mass: SkyriverMass): void {
  if (mass.y0 >= 160) return;
  const placed: WarpOut = { x: 0, z: 0, heading: 0 };
  warpRigid(mass.x, mass.z, mass.anchorV ?? mass.z, placed);
  const reach = Math.hypot(mass.width, mass.depth) * 0.5;
  const item: LowBaseSpatialItem = {
    cx: placed.x, cz: placed.z, y0: mass.y0, y1: mass.y0 + mass.height,
    c: Math.cos(placed.heading), s: Math.sin(placed.heading),
    hx: mass.width * 0.5, hz: mass.depth * 0.5, reach, mass,
  };
  const minX = Math.floor((placed.x - reach) / spatial.cellSize);
  const maxX = Math.floor((placed.x + reach) / spatial.cellSize);
  const minZ = Math.floor((placed.z - reach) / spatial.cellSize);
  const maxZ = Math.floor((placed.z + reach) / spatial.cellSize);
  for (let gx = minX; gx <= maxX; gx += 1) {
    for (let gz = minZ; gz <= maxZ; gz += 1) {
      const key = (gx << 16) ^ gz;
      let cell = spatial.grid.get(key);
      if (!cell) { cell = []; spatial.grid.set(key, cell); }
      cell.push(item);
    }
  }
}

function buildSpatialGrid(masses: readonly SkyriverMass[], cellSize = 200): LowBaseSpatialGrid {
  const spatial: LowBaseSpatialGrid = { grid: new Map(), cellSize };
  for (const mass of masses) insertLowBaseSpatialMass(spatial, mass);
  return spatial;
}

function queryCandidates(
  spatial: LowBaseSpatialGrid,
  x: number,
  z: number,
  anchorV: number,
  w: number,
  d: number,
): { readonly boxWarp: WarpOut; readonly cands: readonly LowBaseSpatialItem[] } {
  const boxWarp: WarpOut = { x: 0, z: 0, heading: 0 };
  warpRigid(x, z, anchorV, boxWarp);
  const reach = Math.hypot(w, d) * 0.5;
  const cellSize = spatial.cellSize;
  const minX = Math.floor((boxWarp.x - reach) / cellSize);
  const maxX = Math.floor((boxWarp.x + reach) / cellSize);
  const minZ = Math.floor((boxWarp.z - reach) / cellSize);
  const maxZ = Math.floor((boxWarp.z + reach) / cellSize);
  const seen = new Set<LowBaseSpatialItem>();
  const cands: LowBaseSpatialItem[] = [];
  for (let gx = minX; gx <= maxX; gx++) {
    for (let gz = minZ; gz <= maxZ; gz++) {
      const key = (gx << 16) ^ gz;
      const cell = spatial.grid.get(key);
      if (!cell) continue;
      for (let i = 0; i < cell.length; i++) {
        const item = cell[i]!;
        if (seen.has(item)) continue;
        seen.add(item);
        if (Math.hypot(item.cx - boxWarp.x, item.cz - boxWarp.z) <= item.reach + reach) {
          cands.push(item);
        }
      }
    }
  }
  return { boxWarp, cands };
}

function lowRoofPlaneConflicts(spatial: LowBaseSpatialGrid, mass: SkyriverMass): boolean {
  const { boxWarp, cands } = queryCandidates(spatial, mass.x, mass.z, mass.anchorV ?? mass.z, mass.width, mass.depth);
  const c = Math.cos(boxWarp.heading), s = Math.sin(boxWarp.heading);
  const hx = mass.width * 0.5, hz = mass.depth * 0.5;
  for (const other of cands) {
    if (!other.mass.baseRecord || Math.abs(mass.y0 + mass.height - other.y1) >= 0.25) continue;
    const dx = other.cx - boxWarp.x, dz = other.cz - boxWarp.z;
    const axes = [[c, -s], [s, c], [other.c, -other.s], [other.s, other.c]];
    const overlaps = axes.every(([ax, az]) => {
      const aRadius = hx * Math.abs(c * ax - s * az) + hz * Math.abs(s * ax + c * az);
      const bRadius = other.hx * Math.abs(other.c * ax - other.s * az) + other.hz * Math.abs(other.s * ax + other.c * az);
      return Math.abs(dx * ax + dz * az) < aRadius + bRadius - 0.01;
    });
    if (overlaps) return true;
  }
  return false;
}

function isLowRoofCovered(
  spatial: LowBaseSpatialGrid,
  x: number,
  z: number,
  anchorV: number,
  w: number,
  d: number,
  y0: number,
  h: number,
): boolean {
  const { boxWarp, cands } = queryCandidates(spatial, x, z, anchorV, w, d);
  const sc = Math.cos(boxWarp.heading);
  const ss = Math.sin(boxWarp.heading);
  const py = y0 + h;
  let coveredCount = 0;
  const N = 7;
  const total = N * N;
  for (let ix = 0; ix < N; ix++) {
    const u = -1 + (2 * (ix + 0.5)) / N;
    for (let iz = 0; iz < N; iz++) {
      const v = -1 + (2 * (iz + 0.5)) / N;
      const px = boxWarp.x + u * (w * 0.5) * sc + v * (d * 0.5) * ss;
      const pz = boxWarp.z - u * (w * 0.5) * ss + v * (d * 0.5) * sc;
      let hit = false;
      for (let i = 0; i < cands.length; i++) {
        const ob = cands[i]!;
        if (py < ob.y0 || py > ob.y1) continue;
        const dx = px - ob.cx;
        const dz = pz - ob.cz;
        const lx = Math.abs(dx * ob.c - dz * ob.s);
        const lz = Math.abs(dx * ob.s + dz * ob.c);
        if (lx <= ob.hx && lz <= ob.hz) {
          hit = true;
          break;
        }
      }
      if (hit) coveredCount++;
    }
  }
  return coveredCount / total >= 0.5;
}

function getMaxLowDeckTop(
  spatial: LowBaseSpatialGrid,
  x: number,
  z: number,
  anchorV: number,
  w: number,
  d: number,
): number {
  const { cands } = queryCandidates(spatial, x, z, anchorV, w, d);
  let maxTop = -Infinity;
  for (let i = 0; i < cands.length; i++) {
    const ob = cands[i]!;
    if (!ob.mass.baseRecord && ob.y1 < 160) {
      if (ob.y1 > maxTop) maxTop = ob.y1;
    }
  }
  return maxTop === -Infinity ? 0 : maxTop;
}

function touch(a: SkyriverMass, b: SkyriverMass): boolean {
  return (
    Math.min(a.x + a.width * 0.5, b.x + b.width * 0.5) > Math.max(a.x - a.width * 0.5, b.x - b.width * 0.5) &&
    Math.min(a.z + a.depth * 0.5, b.z + b.depth * 0.5) > Math.max(a.z - a.depth * 0.5, b.z - b.depth * 0.5) &&
    Math.min(a.y0 + a.height, b.y0 + b.height) > Math.max(a.y0, b.y0)
  );
}

function appendLowBaseSprawl(
  layout: SkyriverCityLayout,
  masses: SkyriverMass[],
  pushTrim: PushTrim,
  random: DeterministicRandom,
  getCurrentTrimCount: () => number,
  trimCap: number,
): void {
  const baseTrimBudget = Math.min(900, Math.max(0, trimCap - getCurrentTrimCount()));
  let addedTrims = 0;
  const safePushTrim: PushTrim = (
    tKind: number,
    px: number,
    py: number,
    pz: number,
    ex: number,
    ey: number,
    ez: number,
    on: SkyriverTrimOwner,
  ): void => {
    if (addedTrims >= baseTrimBudget) fail('SKYRIVER_BASE_TRIM_BUDGET_EXCEEDED');
    pushTrim(tKind, px, py, pz, ex, ey, ez, on);
    addedTrims += 1;
  };

  const spatial = buildSpatialGrid(masses);

  // Compute tier projections for inner towers
  const tierMap = new Map<string, number>();
  for (const t of layout.towers) {
    if (Math.abs(t.x) < 700) {
      const key = towerKey(t);
      const side = Math.sign(t.x);
      const towerMasses = masses.filter(
        (m) =>
          m.anchorV !== undefined &&
          Math.abs(m.anchorV - t.z) < 1e-4 &&
          Math.sign(m.x) === side &&
          m.y0 === SKYRIVER_CITY_VOID_BASE_Y,
      );
      let maxProj = 0;
      for (const m of towerMasses) {
        if (m.width > 6 && Math.abs(m.x - t.x) > 1) {
          const proj = m.width - 6;
          if (proj > maxProj && proj < 120) maxProj = proj;
        }
      }
      tierMap.set(key, maxProj);
    }
  }

  const towersBySide: Record<-1 | 1, SkyriverTower[]> = {
    [-1]: layout.towers.filter((t) => t.x < 0),
    [1]: layout.towers.filter((t) => t.x > 0),
  };

  const findNearest = (x: number, z: number, side: -1 | 1): SkyriverTower => {
    const list = towersBySide[side];
    let best = list[0]!;
    let bestD = Infinity;
    for (const t of list) {
      const d = Math.hypot(t.x - x, t.z - z);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return best;
  };

  const skirtsByTower = new Map<string, SkyriverMass[]>();

  // 1. Skirts per major tower
  for (const tower of layout.towers) {
    const towerSide = (Math.sign(tower.x) || 1) as -1 | 1;
    const isInner = Math.abs(tower.x) < 700;
    const tKey = towerKey(tower);
    const list: SkyriverMass[] = [];
    skirtsByTower.set(tKey, list);

    const nomLeft = tower.x - tower.width * 0.5;
    const nomRight = tower.x + tower.width * 0.5;
    const nomBack = tower.z - tower.depth * 0.5;
    const nomFront = tower.z + tower.depth * 0.5;

    const tierProj = tierMap.get(tKey) || 0;
    const nomInnerFace = Math.abs(tower.x) - tower.width * 0.5;
    const exposedFace = isInner ? nomInnerFace - tierProj : nomInnerFace;
    const safeBoundary = Math.abs(tower.z) < 650 ? 408 : 374;
    const availProj = exposedFace - safeBoundary;

    const targetCount = 2 + (random.nextInt(0, 99) < 60 ? 1 : 0) + (random.nextInt(0, 99) < 20 ? 1 : 0);

    const pickHeight = (hPref?: number): number => {
      if (hPref !== undefined) return hPref;
      const idx = list.length;
      const h = 14 + ((idx * 8 + random.nextInt(0, 5)) % 25);
      return Math.min(38, Math.max(14, h));
    };

    const tryAdd = (bx: number, bz: number, bw: number, bd: number, altPref?: number, hPref?: number): boolean => {
      if (!checkLowBaseSafety(bx, bz, bw, bd)) return false;
      const maxDeck = getMaxLowDeckTop(spatial, bx, bz, tower.z, bw, bd);
      const bh = pickHeight(hPref);
      let by0 = 0;
      if (maxDeck > 10) {
        by0 = Math.max(0, maxDeck - random.nextInt(2, 6));
      } else {
        if (altPref !== undefined) {
          by0 = altPref;
        } else {
          by0 = random.nextInt(0, 99) < 35 ? -random.nextInt(4, 18) : random.nextInt(0, 15);
        }
      }
      if (by0 + bh > 148) by0 = 148 - bh;

      if (isLowRoofCovered(spatial, bx, bz, tower.z, bw, bd, by0, bh)) {
        if (maxDeck > 0 && maxDeck + bh < 148) {
          by0 = maxDeck + 1;
          if (isLowRoofCovered(spatial, bx, bz, tower.z, bw, bd, by0, bh)) return false;
        } else {
          return false;
        }
      }

      const clusterId = Math.min(3, Math.max(0, Math.round((Math.abs(tower.x) - 630) / 320))) as SkyriverLowBaseCluster;
      const record = createLowBaseRecord(tower, clusterId, 'skirt');
      const placedMass: SkyriverMass = {
        x: bx,
        y0: by0,
        z: bz,
        width: bw,
        height: bh,
        depth: bd,
        tint: tower.tint,
        anchorV: tower.z,
        building: buildingSeedOf(tower.x, tower.z),
        materialOwner: buildingSeedOf(tower.x, tower.z),
        baseRecord: record,
      };
      let separatedMass = placedMass;
      for (let attempt = 0; lowRoofPlaneConflicts(spatial, separatedMass); attempt += 1) {
        if (attempt >= 64) return false;
        separatedMass = { ...separatedMass, y0: separatedMass.y0 - 0.35 };
      }
      if (isLowRoofCovered(spatial, bx, bz, tower.z, bw, bd, separatedMass.y0, bh)) return false;
      by0 = separatedMass.y0;
      masses.push(separatedMass);
      insertLowBaseSpatialMass(spatial, separatedMass);
      list.push(separatedMass);

      // Roof trims on actual low roofs
      const roofY = by0 + bh;
      const roofOwner: SkyriverTrimOwner = { x: bx, z: bz, width: bw, depth: bd, anchorV: tower.z };
      if (random.nextInt(0, 99) < 55) {
        const roll = random.nextInt(0, 99);
        if (roll < 45) {
          const d = 3.2 + random.nextInt(0, 20) / 10;
          const h = 4.5 + random.nextInt(0, 15) / 10;
          const maxOx = Math.max(0, (bw - d) * 0.5 - 1);
          const maxOz = Math.max(0, (bd - d) * 0.5 - 1);
          const ox = (random.nextInt(-1000, 1000) / 1000) * maxOx;
          const oz = (random.nextInt(-1000, 1000) / 1000) * maxOz;
          safePushTrim(SKYRIVER_TRIM_ROOF_PLANT, bx + ox, roofY + h * 0.5, bz + oz, d, h, d, roofOwner);
        } else if (roll < 80) {
          const pw = 2.4;
          const ph = 1.8;
          const pd = 2.0;
          const maxOx = Math.max(0, (bw - pw) * 0.5 - 1);
          const maxOz = Math.max(0, (bd - pd) * 0.5 - 1);
          const ox = (random.nextInt(-1000, 1000) / 1000) * maxOx;
          const oz = (random.nextInt(-1000, 1000) / 1000) * maxOz;
          safePushTrim(SKYRIVER_TRIM_ROOF_PLANT, bx + ox, roofY + ph * 0.5, bz + oz, pw, ph, pd, roofOwner);
        } else {
          const mh = 14 + random.nextInt(0, 16);
          safePushTrim(SKYRIVER_TRIM_ANTENNA, bx, roofY + mh * 0.5, bz, 0.6, mh, 0.6, roofOwner);
        }
      }

      // Tower-mass equipment penthouse on a fraction of roofs
      if (random.nextInt(0, 99) < 25) {
        const eh = 4 + random.nextInt(0, 4);
        const ew = Math.min(bw * 0.4, 12);
        const ed = Math.min(bd * 0.4, 12);
        const ex = bx + (random.nextInt(-1000, 1000) / 1000) * Math.max(0, (bw - ew) * 0.35);
        const ez = bz + (random.nextInt(-1000, 1000) / 1000) * Math.max(0, (bd - ed) * 0.35);
        const ey0 = by0 + bh - 0.5;
        const eqRecord = createLowBaseRecord(tower, clusterId, 'equipment');
        const equipment: SkyriverMass = {
          x: ex,
          y0: ey0,
          z: ez,
          width: ew,
          height: eh,
          depth: ed,
          tint: tower.tint,
          anchorV: tower.z,
          building: buildingSeedOf(tower.x, tower.z),
          materialOwner: buildingSeedOf(tower.x, tower.z),
          baseRecord: eqRecord,
        };
        if (!lowRoofPlaneConflicts(spatial, equipment)) {
          masses.push(equipment);
          insertLowBaseSpatialMass(spatial, equipment);
        }
      }

      return true;
    };

    interface CandidateBase {
      readonly x: number;
      readonly z: number;
      readonly w: number;
      readonly d: number;
      readonly alt?: number;
      readonly hPref?: number;
    }

    const cands: CandidateBase[] = [];
    if (isInner) {
      if (availProj >= 6) {
        const frontProj = Math.min(availProj, Math.max(14, 18 + random.nextInt(0, 12)));
        const bw = frontProj + 4.0;
        const bx = towerSide < 0 ? -(exposedFace - frontProj * 0.5 + 2.0) : +(exposedFace - frontProj * 0.5 + 2.0);
        const bd = Math.min(tower.depth * 0.9, Math.max(70, 80 + random.nextInt(0, 40)));
        cands.push({
          x: bx,
          z: tower.z + random.nextInt(-6, 6),
          w: bw,
          d: bd,
          alt: 25 + random.nextInt(0, 25),
          hPref: 34 + random.nextInt(0, 4),
        });
      }

      if (availProj >= 6) {
        const frontProj2 = Math.min(availProj, Math.max(10, 12 + random.nextInt(0, 10)));
        const bw2 = frontProj2 + 4.0;
        const bx2 = towerSide < 0 ? -(exposedFace - frontProj2 * 0.5 + 2.0) : +(exposedFace - frontProj2 * 0.5 + 2.0);
        const bd2 = Math.min(tower.depth * 0.65, Math.max(50, 60 + random.nextInt(0, 30)));
        const shiftZ = (random.nextInt(0, 99) < 50 ? 1 : -1) * (tower.depth * 0.22);
        cands.push({ x: bx2, z: tower.z + shiftZ, w: bw2, d: bd2, alt: 10 + random.nextInt(0, 20) });
      }

      const pitchChoice = random.nextInt(0, 99) < 50 ? 'north' : 'south';
      const bd = 18 + random.nextInt(0, 20);
      const bz = pitchChoice === 'north' ? nomFront + bd * 0.5 - 2.0 : nomBack - bd * 0.5 + 2.0;
      const bw = Math.min(tower.width * 0.6, Math.max(35, 45 + random.nextInt(0, 10)));
      const pitchX = towerSide < 0 ? nomRight - bw * 0.5 + 4 : nomLeft + bw * 0.5 - 4;
      cands.push({ x: pitchX, z: bz, w: bw, d: bd });
      cands.push({ x: tower.x + random.nextInt(-8, 8), z: bz, w: bw, d: bd });

      const bzOpp = pitchChoice === 'north' ? nomBack - bd * 0.5 + 2.0 : nomFront + bd * 0.5 - 2.0;
      cands.push({ x: pitchX, z: bzOpp, w: bw, d: bd });
      cands.push({ x: tower.x + random.nextInt(-8, 8), z: bzOpp, w: bw, d: bd });
    } else {
      // Outer towers
      {
        const bd = 16 + random.nextInt(0, 20);
        const bz = nomFront + bd * 0.5 - 2.0;
        const bw = Math.min(tower.width * 0.8, Math.max(35, 50 + random.nextInt(0, 30)));
        const pitchOuterX = towerSide > 0 ? nomRight - bw * 0.4 : nomLeft + bw * 0.4;
        cands.push({ x: pitchOuterX, z: bz, w: bw, d: bd });
        cands.push({ x: tower.x + random.nextInt(-10, 10), z: bz, w: bw, d: bd });
      }
      {
        const bd = 16 + random.nextInt(0, 20);
        const bz = nomBack - bd * 0.5 + 2.0;
        const bw = Math.min(tower.width * 0.8, Math.max(35, 50 + random.nextInt(0, 30)));
        const pitchOuterX = towerSide > 0 ? nomRight - bw * 0.4 : nomLeft + bw * 0.4;
        cands.push({ x: pitchOuterX, z: bz, w: bw, d: bd });
        cands.push({ x: tower.x + random.nextInt(-10, 10), z: bz, w: bw, d: bd });
      }
      {
        const extX = 14 + random.nextInt(0, 18);
        const bw = extX + 3.0;
        const bx = towerSide > 0 ? nomRight + extX * 0.5 - 1.5 : nomLeft - extX * 0.5 + 1.5;
        const bd = Math.min(tower.depth * 0.75, Math.max(35, 45 + random.nextInt(0, 30)));
        cands.push({ x: bx, z: tower.z + random.nextInt(-15, 15), w: bw, d: bd });
        cands.push({ x: bx, z: nomBack + 20, w: bw, d: 35 });
        cands.push({ x: bx, z: nomFront - 20, w: bw, d: 35 });
      }
      {
        const extX = 12 + random.nextInt(0, 14);
        const bw = extX + 2.0;
        const bx = towerSide > 0 ? nomLeft - extX * 0.5 + 1.0 : nomRight + extX * 0.5 - 1.0;
        const bd = Math.min(tower.depth * 0.6, 40);
        cands.push({ x: bx, z: tower.z + random.nextInt(-10, 10), w: bw, d: bd });
        cands.push({ x: bx, z: nomBack + 20, w: bw, d: 35 });
        cands.push({ x: bx, z: nomFront - 20, w: bw, d: 35 });
      }
    }

    for (const c of cands) {
      if (list.length >= targetCount) break;
      tryAdd(c.x, c.z, c.w, c.d, c.alt, c.hPref);
    }

    if (list.length < 2) {
      const extraCands: CandidateBase[] = [];
      for (const ozShift of [-190, -140, -90, -40, -20, 0, 20, 40, 90, 140, 190]) {
        for (const ox of [0, 25, 45, 70, 95]) {
          const outX = towerSide > 0 ? nomRight + ox : nomLeft - ox;
          const innX = towerSide > 0 ? nomLeft - ox : nomRight + ox;
          extraCands.push({ x: outX, z: tower.z + ozShift, w: 32, d: 32 });
          extraCands.push({ x: innX, z: tower.z + ozShift, w: 30, d: 30 });
          extraCands.push({ x: tower.x + ox * towerSide, z: nomFront + 20 + ozShift, w: 32, d: 32 });
          extraCands.push({ x: tower.x + ox * towerSide, z: nomBack - 20 + ozShift, w: 32, d: 32 });
        }
      }
      for (const c of extraCands) {
        if (list.length >= 2) break;
        tryAdd(c.x, c.z, c.w, c.d);
      }
    }
  }

  // 2. Lower infill using 2-4 offset subgrid cluster patterns
  const loopRows = Math.round(CANYON_LOOP_LENGTH_M / layout.cell);
  for (let r = 0; r < loopRows; r += 1) {
    const vHalf = wrapCanyonV((r + 0.5 - loopRows / 2) * layout.cell);
    for (const side of [-1, 1] as const) {
      for (const colX of [790, 1110, 1430]) {
        const clusterId = ((r * 3 + Math.floor(colX / 300)) % 4) as SkyriverLowBaseCluster;
        const pattern = INFILL_CLUSTERS[clusterId]!;
        const baseX = side * (colX + pattern.dx);
        const baseZ = wrapCanyonV(vHalf + pattern.dv);

        const parentTower = findNearest(baseX, baseZ, side);
        const w = pattern.widthRange[0] + random.nextInt(0, pattern.widthRange[1] - pattern.widthRange[0]);
        const d = pattern.depthRange[0] + random.nextInt(0, pattern.depthRange[1] - pattern.depthRange[0]);
        const h = pattern.heightRange[0] + random.nextInt(0, pattern.heightRange[1] - pattern.heightRange[0]);

        if (!checkLowBaseSafety(baseX, baseZ, w, d)) continue;
        if (
          Math.abs(baseX - parentTower.x) < (w + parentTower.width) * 0.45 &&
          Math.abs(baseZ - parentTower.z) < (d + parentTower.depth) * 0.45
        ) {
          continue;
        }

        const maxDeck = getMaxLowDeckTop(spatial, baseX, baseZ, parentTower.z, w, d);
        let y0 = maxDeck > 10 ? Math.max(0, maxDeck - random.nextInt(2, 6)) : random.nextInt(0, 15);
        if (y0 + h > 148) y0 = 148 - h;

        if (isLowRoofCovered(spatial, baseX, baseZ, parentTower.z, w, d, y0, h)) {
          if (maxDeck > 0 && maxDeck + h < 148) {
            y0 = maxDeck + 1;
            if (isLowRoofCovered(spatial, baseX, baseZ, parentTower.z, w, d, y0, h)) continue;
          } else {
            continue;
          }
        }

        const record = createLowBaseRecord(parentTower, pattern.id, 'infill');
        const mass: SkyriverMass = {
          x: baseX,
          y0,
          z: baseZ,
          width: w,
          height: h,
          depth: d,
          tint: parentTower.tint,
          anchorV: parentTower.z,
          building: buildingSeedOf(parentTower.x, parentTower.z),
          materialOwner: buildingSeedOf(parentTower.x, parentTower.z),
          baseRecord: record,
        };
        let separatedMass = mass;
        for (let attempt = 0; lowRoofPlaneConflicts(spatial, separatedMass); attempt += 1) {
          if (attempt >= 64) fail('SKYRIVER_BASE_ROOF_SEPARATION_FAILED');
          separatedMass = { ...separatedMass, y0: separatedMass.y0 - 0.35 };
        }
        if (isLowRoofCovered(spatial, baseX, baseZ, parentTower.z, w, d, separatedMass.y0, h)) continue;
        y0 = separatedMass.y0;
        masses.push(separatedMass);
        insertLowBaseSpatialMass(spatial, separatedMass);

        if (random.nextInt(0, 99) < 45) {
          const roofY = y0 + h;
          const roofOwner: SkyriverTrimOwner = { x: baseX, z: baseZ, width: w, depth: d, anchorV: parentTower.z };
          const pw = 3.0;
          const ph = 4.0;
          safePushTrim(SKYRIVER_TRIM_ROOF_PLANT, baseX, roofY + ph * 0.5, baseZ, pw, ph, pw, roofOwner);
        }
      }
    }
  }

  // 3. Short covered architectural links between adjacent base blocks
  for (const [tKey, tSkirts] of skirtsByTower) {
    if (tSkirts.length < 2) continue;
    for (let i = 0; i < tSkirts.length; i++) {
      for (let j = i + 1; j < tSkirts.length; j++) {
        const a = tSkirts[i]!;
        const b = tSkirts[j]!;

        const ax0 = a.x - a.width * 0.5;
        const ax1 = a.x + a.width * 0.5;
        const az0 = a.z - a.depth * 0.5;
        const ay0 = a.y0;
        const ay1 = a.y0 + a.height;

        const bx0 = b.x - b.width * 0.5;
        const bx1 = b.x + b.width * 0.5;
        const bz0 = b.z - b.depth * 0.5;
        const by0 = b.y0;
        const by1 = b.y0 + b.height;

        const commonY0 = Math.max(ay0, by0);
        const commonY1 = Math.min(ay1, by1);
        if (commonY1 - commonY0 < 4) continue;

        const lh = Math.min(5, commonY1 - commonY0 - 1.0);
        const ly0 = commonY0 + 0.5;

        interface LinkCandidate {
          readonly x: number;
          readonly y0: number;
          readonly z: number;
          readonly width: number;
          readonly height: number;
          readonly depth: number;
        }

        let linkCandidate: LinkCandidate | null = null;
        const [firstZ, secondZ] = az0 < bz0 ? [a, b] : [b, a];
        const fz1 = firstZ.z + firstZ.depth * 0.5;
        const sz0 = secondZ.z - secondZ.depth * 0.5;
        const fx0 = firstZ.x - firstZ.width * 0.5;
        const fx1 = firstZ.x + firstZ.width * 0.5;
        const sx0 = secondZ.x - secondZ.width * 0.5;
        const sx1 = secondZ.x + secondZ.width * 0.5;

        const gapZ = sz0 - fz1;
        const xOverlap0 = Math.max(fx0, sx0);
        const xOverlap1 = Math.min(fx1, sx1);
        const xOverlap = xOverlap1 - xOverlap0;

        if (gapZ >= 1.5 && gapZ <= 42 && xOverlap >= 5) {
          const lz0 = fz1 - 0.25;
          const lz1 = sz0 + 0.25;
          const ld = lz1 - lz0;
          let lw = Math.min(6, xOverlap - 0.8);
          if (ld <= lw) lw = Math.max(1, ld - 0.5);
          const lx = (xOverlap0 + xOverlap1) * 0.5;
          const lz = (lz0 + lz1) * 0.5;
          linkCandidate = { x: lx, y0: ly0, z: lz, width: lw, height: lh, depth: ld };
        } else {
          const [firstX, secondX] = ax0 < bx0 ? [a, b] : [b, a];
          const fx0_ = firstX.x - firstX.width * 0.5;
          const fx1_ = firstX.x + firstX.width * 0.5;
          const sx0_ = secondX.x - secondX.width * 0.5;
          const sx1_ = secondX.x + secondX.width * 0.5;
          const fz0_ = firstX.z - firstX.depth * 0.5;
          const fz1_ = firstX.z + firstX.depth * 0.5;
          const sz0_ = secondX.z - secondX.depth * 0.5;
          const sz1_ = secondX.z + secondX.depth * 0.5;

          const gapX = sx0_ - fx1_;
          const zOverlap0 = Math.max(fz0_, sz0_);
          const zOverlap1 = Math.min(fz1_, sz1_);
          const zOverlap = zOverlap1 - zOverlap0;

          if (gapX >= 1.5 && gapX <= 42 && zOverlap >= 5) {
            const lx0 = fx1_ - 0.25;
            const lx1 = sx0_ + 0.25;
            const lw = lx1 - lx0;
            let ld = Math.min(6, zOverlap - 0.8);
            if (lw <= ld) ld = Math.max(1, lw - 0.5);
            const lx = (lx0 + lx1) * 0.5;
            const lz = (zOverlap0 + zOverlap1) * 0.5;
            linkCandidate = { x: lx, y0: ly0, z: lz, width: lw, height: lh, depth: ld };
          }
        }

        if (
          linkCandidate &&
          checkLowBaseSafety(linkCandidate.x, linkCandidate.z, linkCandidate.width, linkCandidate.depth)
        ) {
          const lMass: SkyriverMass = {
            ...linkCandidate,
            tint: a.tint,
            anchorV: a.anchorV,
            building: a.building,
            materialOwner: a.materialOwner,
            baseRecord: { kind: 'link', towerOwner: tKey, cluster: a.baseRecord!.cluster },
          };
          if (touch(lMass, a) && touch(lMass, b) && !lowRoofPlaneConflicts(spatial, lMass)) {
            masses.push(lMass);
            insertLowBaseSpatialMass(spatial, lMass);
          }
        }
      }
    }
  }
}


// --- R17 building variation ----------------------------------------------------------------------
// Operator headline: adopt the reference's massing language (scratch/reference/massing_*.png): lots
// become multi-tower complexes on a shared podium, shafts step back in graduated terraces, pure
// ziggurat stacks and crown-only steps, a few very tall spires, cluttered plateau roofs, and low
// infill in the gaps between slabs. Everything rises from a lot's roof inside its footprint, or sits
// recessed behind the wall face in a gap, so nothing reaches the corridor (tests/clearance.test.ts).
// Its own seeded stream: the T2 and trim streams are untouched.

export type SkyriverMassingArchetype = 'plain' | 'complex' | 'ziggurat' | 'setback' | 'crown' | 'spire' | 'plateau';

/** Shares per archetype, inner wall and outer columns (cumulative order below). */
const MASSING_INNER: readonly (readonly [SkyriverMassingArchetype, number])[] = [
  ['complex', 0.3], ['ziggurat', 0.15], ['setback', 0.15], ['crown', 0.1], ['spire', 0.08], ['plateau', 0.12], ['plain', 0.1],
];
const MASSING_OUTER: readonly (readonly [SkyriverMassingArchetype, number])[] = [
  ['complex', 0.3], ['ziggurat', 0.12], ['setback', 0.15], ['crown', 0.13], ['plateau', 0.2], ['plain', 0.1],
];

/** The lot's massing archetype. Pure hash of the lot; slender and spire lots keep simple tops. */
export function massingArchetype(layout: SkyriverCityLayout, tower: SkyriverTower): SkyriverMassingArchetype {
  const inner = Math.abs(Math.abs(tower.x) - innerWallX(layout, tower)) < 1;
  // Podium lots (presentationLayout) always raise their towers back up: a cluster or a stepped shaft.
  if (podiumLotHeight(tower) !== undefined) return hash1(tower.x * 0.031 + tower.z * 0.0071) < 0.72 ? 'complex' : 'setback';
  const aspect = Math.max(tower.width, tower.depth) / Math.max(1, Math.min(tower.width, tower.depth));
  const h = hash1(tower.x * 0.0217 + tower.z * 0.00731 + 4.4);
  if (!inner && aspect > 3) return h < 0.6 ? 'setback' : 'crown';
  if (!inner && tower.height > 4200) return 'crown';
  let acc = 0;
  for (const [kind, share] of inner ? MASSING_INNER : MASSING_OUTER) {
    acc += share;
    if (h < acc) return kind;
  }
  return 'plain';
}

function deriveMassingVariation(
  layout: SkyriverCityLayout,
  innerWalls: readonly (readonly SkyriverTower[])[],
  masses: SkyriverMass[],
  push: PushTrim,
): void {
  const rng = new DeterministicRandom(layout.seed).fork('skyriver.city.massing');
  const u = (): number => rng.nextInt(0, 10000) / 10000;
  const between = (a: number, b: number): number => a + (b - a) * u();
  /** A box on the lot, in the lot's frame (rides the slab through the bends). */
  const box = (tower: SkyriverTower, dx: number, dz: number, y0: number, w: number, hgt: number, d: number, building?: number): void => {
    masses.push({ x: tower.x + dx, y0, z: tower.z + dz, width: w, height: hgt, depth: d, tint: tower.tint, anchorV: tower.z, ...(building === undefined ? {} : { building }), materialOwner: buildingSeedOf(tower.x, tower.z) });
  };
  /** Lit edge bands round a step: the line each terrace reads by at night. */
  const stepBands = (tower: SkyriverTower, dx: number, dz: number, y: number, w: number, d: number): void => {
    const on = ownerOf(tower);
    push(SKYRIVER_TRIM_BAND, tower.x + dx - w * 0.5, y, tower.z + dz, 2.2, 3.6, d + 1, on);
    push(SKYRIVER_TRIM_BAND, tower.x + dx + w * 0.5, y, tower.z + dz, 2.2, 3.6, d + 1, on);
    push(SKYRIVER_TRIM_BAND, tower.x + dx, y, tower.z + dz - d * 0.5, w + 1, 3.6, 2.2, on);
    push(SKYRIVER_TRIM_BAND, tower.x + dx, y, tower.z + dz + d * 0.5, w + 1, 3.6, 2.2, on);
  };
  /** A shaft that steps in `steps` times above y0; returns its top. */
  const terraced = (tower: SkyriverTower, dx: number, dz: number, y0: number, w0: number, d0: number, rise: number, steps: number, shrink: number): number => {
    let y = y0;
    let w = w0;
    let d = d0;
    for (let k = 0; k <= steps; k += 1) {
      const share = k === 0 ? 0.45 + 0.2 * u() : (1 - 0.55) / steps;
      const hgt = Math.max(30, rise * share);
      box(tower, dx, dz, y - 2, w, hgt + 2, d);
      y += hgt;
      if (k < steps) stepBands(tower, dx, dz, y - 2, w, d);
      w *= 1 - shrink * (0.8 + 0.4 * u());
      d *= 1 - shrink * (0.8 + 0.4 * u());
    }
    return y;
  };
  const clutter = (tower: SkyriverTower, dx: number, dz: number, roof: number, w: number, d: number, n: number): void => {
    const on = ownerOf(tower);
    for (let k = 0; k < n; k += 1) {
      const px = tower.x + dx + (u() - 0.5) * w * 0.8;
      const pz = tower.z + dz + (u() - 0.5) * d * 0.8;
      const roll = u();
      if (roll < 0.4) {
        const t = between(6, 13);
        push(SKYRIVER_TRIM_ROOF_PLANT, px, roof + 6, pz, t, between(8, 14), t, on); // water tank
      } else if (roll < 0.75) {
        push(SKYRIVER_TRIM_ROOF_PLANT, px, roof + 1.5, pz, between(4, 9), 3, between(3, 6), on); // AC block
      } else {
        const mh = between(25, 95);
        push(SKYRIVER_TRIM_ANTENNA, px, roof + mh * 0.5, pz, between(0.8, 1.8), mh, between(0.8, 1.8), on);
      }
    }
  };

  for (const tower of layout.towers) {
    const kind = massingArchetype(layout, tower);
    const W = tower.width;
    const D = tower.depth;
    const roof = tower.height;
    const inner = Math.abs(Math.abs(tower.x) - innerWallX(layout, tower)) < 1;
    // Inner-wall lots grow up from the back of the roof so the corridor face keeps its line.
    const back = inner ? Math.sign(tower.x) * W * 0.08 : 0;
    switch (kind) {
      case 'complex': {
        // Shared podium deck (40-80 m) on the lot, then 2-6 towers of very different heights.
        const podiumH = between(40, 80);
        const pw = W * 0.92;
        const pd = D * 0.94;
        box(tower, 0, 0, roof - 2, pw, podiumH + 2, pd, buildingSeedOf(tower.x, tower.z));
        stepBands(tower, 0, 0, roof + podiumH - 2, pw, pd);
        const top = roof + podiumH;
        const count = 2 + Math.floor(u() * 5);
        const cols = count <= 3 ? 1 : 2;
        const rows = Math.ceil(count / cols);
        // On a podium lot the cluster climbs back past the old roofline; elsewhere it tops the roof.
        const full = podiumLotHeight(tower);
        const base = full === undefined ? between(220, 650) : (full - top) * between(0.45, 0.75);
        // A height ladder with one or two towers at 2-3x the others.
        const tall = Math.floor(u() * count);
        for (let k = 0; k < count; k += 1) {
          const cx = (cols === 1 ? 0 : (k % cols - 0.5) * pw * 0.5) + back * 0.5;
          const cz = (Math.floor(k / cols) + 0.5 - rows / 2) * (pd / rows);
          const tw = (pw / cols) * between(0.38, 0.72);
          const td = (pd / rows) * between(0.4, 0.78);
          const f = k === tall ? between(2.2, 3.1) : u() < 0.2 ? between(1.4, 2.0) : between(0.35, 1.0);
          const rise = Math.min(6400 - top, base * f);
          const style = u();
          let t: number;
          if (style < 0.4) t = terraced(tower, cx, cz, top, tw, td, rise, 2 + Math.floor(u() * 2), 0.18);
          else {
            box(tower, cx, cz, top - 2, tw, rise + 2, td);
            t = top + rise;
            if (style < 0.7) { box(tower, cx, cz, t - 2, tw * 0.6, rise * 0.12 + 20, td * 0.6); t += rise * 0.12 + 18; }
          }
          if (k === tall) push(SKYRIVER_TRIM_ANTENNA, tower.x + cx, t + 60, tower.z + cz, 2.4, 120, 2.4, ownerOf(tower));
          else clutter(tower, cx, cz, t, tw, td, 1 + Math.floor(u() * 3));
        }
        break;
      }
      case 'ziggurat': {
        // A pure stack, 4-6 steps, each a ring smaller.
        const steps = 4 + Math.floor(u() * 3);
        let w = W * 0.9;
        let d = D * 0.9;
        let y = roof;
        const stepH = between(60, 150);
        for (let k = 0; k < steps; k += 1) {
          const hgt = stepH * (0.8 + 0.4 * u());
          box(tower, back * 0.3, 0, y - 2, w, hgt + 2, d);
          y += hgt;
          stepBands(tower, back * 0.3, 0, y - 2, w, d);
          w *= 0.8;
          d *= 0.8;
        }
        clutter(tower, back * 0.3, 0, y, w, d, 2);
        break;
      }
      case 'setback': {
        // A shaft stepping in 2-4 times, rising well above the roof.
        const steps = 2 + Math.floor(u() * 3);
        const full = podiumLotHeight(tower);
        const rise = full === undefined ? between(500, 1700) : Math.min(6400 - roof, (full - roof) * between(0.9, 1.5));
        const t = terraced(tower, back, 0, roof, W * between(0.55, 0.8), D * between(0.55, 0.8), rise, steps, 0.2);
        push(SKYRIVER_TRIM_ANTENNA, tower.x + back, t + 40, tower.z, 1.6, 80, 1.6, ownerOf(tower));
        break;
      }
      case 'crown': {
        // One crown step only.
        const ch = between(80, 220);
        box(tower, back * 0.5, 0, roof - 2, W * between(0.5, 0.72), ch + 2, D * between(0.5, 0.72));
        clutter(tower, back * 0.5, 0, roof + ch, W * 0.5, D * 0.5, 2);
        break;
      }
      case 'spire': {
        // A very tall slender spire (1:4-1:6 to its height band), 2-3x its neighbours.
        const s = Math.min(W, D) * between(0.2, 0.28);
        const rise = Math.min(6400 - roof, between(1500, 3200));
        box(tower, back, 0, roof - 2, s * 1.6, rise * 0.55 + 2, s * 1.6);
        box(tower, back, 0, roof + rise * 0.55 - 2, s, rise * 0.45 + 2, s);
        stepBands(tower, back, 0, roof + rise * 0.55, s * 1.6, s * 1.6);
        push(SKYRIVER_TRIM_ANTENNA, tower.x + back, roof + rise + 150, tower.z, 3, 300, 3, ownerOf(tower));
        break;
      }
      case 'plateau': {
        // A flat roof crowded with tanks, plant and masts.
        clutter(tower, 0, 0, roof, W, D, 5 + Math.floor(u() * 6));
        break;
      }
      default:
        break;
    }
  }

  // Low infill in the gaps between slabs: inner wall recessed behind the face line, outer columns
  // between neighbours. Long gaps are split like the seams (they follow the curve).
  const sides = [-1, 1] as const;
  for (const side of sides) {
    const wall = wallOf(layout, side);
    for (let i = 0; i + 1 < wall.length; i += 1) {
      const a = wall[i]!;
      const b = wall[i + 1]!;
      if (Math.abs(Math.abs(a.x) - Math.abs(b.x)) > 1) continue;
      const gapStart = a.z + a.depth * 0.5;
      const gapEnd = b.z - b.depth * 0.5;
      const gap = gapEnd - gapStart;
      if (gap < 40 || u() > 0.75) continue;
      const inner = innerWalls.some((w) => w.includes(a));
      const w = Math.min(a.width, b.width) * between(0.45, 0.8);
      const face = Math.abs(a.x) - a.width * 0.5;
      const x = inner ? side * (face + 12 + w * 0.5) : a.x;
      const hgt = Math.min(a.height, b.height) * between(0.12, 0.45);
      const span = Math.min(gap - 8, 420);
      const pieces = Math.max(1, Math.ceil(span / SEAM_SEGMENT_M));
      for (let k = 0; k < pieces; k += 1) {
        const z = (gapStart + gapEnd) * 0.5 - span * 0.5 + (k + 0.5) * (span / pieces);
        if (!inner && (intrudesOtherStretch(x, z, w * 0.5) || foldsInsideBend(x, z, w * 0.5))) continue;
        masses.push({ x, y0: SKYRIVER_CITY_VOID_BASE_Y, z, width: w, height: hgt - SKYRIVER_CITY_VOID_BASE_Y, depth: span / pieces + 4, tint: a.tint, materialOwner: buildingSeedOf(a.x, a.z) });
      }
    }
  }
}

/** World placement of one trim: centre x/z, heading, and its long-axis length (spans only). */
export interface SkyriverTrimPlacement {
  x: number;
  z: number;
  heading: number;
  /** Span length after placement, metres (0 for a trim that keeps its own size). */
  length: number;
}

const placeEnd0: WarpOut = { x: 0, z: 0, heading: 0 };

/** Canyon-space distance from point (x, v) to an owner's footprint (0 or less: on or inside it). */
function footprintGap(owner: SkyriverTrimOwner, x: number, v: number): number {
  return Math.max(Math.abs(x - owner.x) - owner.width * 0.5, Math.abs(v - owner.z) - owner.depth * 0.5);
}
const placeEnd1: WarpOut = { x: 0, z: 0, heading: 0 };

/**
 * R16: where trim `i` is drawn. Every trim is carried rigidly in its owner's warped frame (the
 * owner's anchor is warped, the offset is only turned), so it stays on its building through the
 * bends: warping each trim at its own centre drifts it off its roof or face wherever the warp
 * stretches or crushes canyon space (outer columns, bend centres). A span (gantry, skybridge) puts
 * each end in the frame of the building it meets and runs straight between them.
 */
export function placeTrim(trims: SkyriverCityTrims, i: number, out: SkyriverTrimPlacement): SkyriverTrimPlacement {
  const owner = trims.owner[i]!;
  const to = trims.spanTo[i]!;
  const cx = trims.cx[i]!;
  const cz = trims.cz[i]!;
  if (to === null) {
    warpRigid(cx, cz, owner.anchorV, placeEnd0);
    out.x = placeEnd0.x;
    out.z = placeEnd0.z;
    out.heading = placeEnd0.heading;
    out.length = 0;
    return out;
  }
  const alongAxis = trims.sz[i]! >= trims.sx[i]!;
  const half = (alongAxis ? trims.sz[i]! : trims.sx[i]!) * 0.5;
  // End 0 is the low end of the long axis; it belongs to whichever building sits nearer to it.
  const e0x = alongAxis ? cx : cx - half;
  const e0z = alongAxis ? cz - half : cz;
  const e1x = alongAxis ? cx : cx + half;
  const e1z = alongAxis ? cz + half : cz;
  const ownerAtLow = footprintGap(owner, e0x, e0z) <= footprintGap(to, e0x, e0z);
  warpRigid(e0x, e0z, (ownerAtLow ? owner : to).anchorV, placeEnd0);
  warpRigid(e1x, e1z, (ownerAtLow ? to : owner).anchorV, placeEnd1);
  const dx = placeEnd1.x - placeEnd0.x;
  const dz = placeEnd1.z - placeEnd0.z;
  out.x = (placeEnd0.x + placeEnd1.x) * 0.5;
  out.z = (placeEnd0.z + placeEnd1.z) * 0.5;
  // Local +z (along) maps to (sin h, cos h); local +x (across) maps to (cos h, -sin h).
  out.heading = alongAxis ? Math.atan2(dx, dz) : Math.atan2(-dz, dx);
  out.length = Math.hypot(dx, dz);
  return out;
}

export interface SkyriverAnchorAudit {
  /** Trims checked (every trim of the layout, all around the loop). */
  readonly checked: number;
  /** Largest offset error of a drawn trim from its place on its owner, metres. Must be ~0. */
  readonly maxDriftM: number;
  /** Drawn trims that touch their owner in canyon space but not in the world. Must be 0. */
  readonly floating: number;
  /** The drawn failures, if any (empty when the pass holds). */
  readonly failures: readonly { kind: number; index: number; x: number; y: number; v: number; wx: number; wz: number; driftM: number; gapM: number }[];
  /** The same two numbers for trims warped at their own centres (the pre-R16 placement). */
  readonly pointWarpMaxDriftM: number;
  readonly pointWarpFloating: number;
  /** pointWarpFloating split by SKYRIVER_TRIM_* kind. */
  readonly pointWarpFloatingByKind: readonly number[];
  /** Facade signs checked, their drawn drift (must be ~0), and the pre-R16 count that left their face. */
  readonly signsChecked: number;
  readonly signMaxDriftM: number;
  readonly signsOffFace: number;
  readonly pointWarpSignsOffFace: number;
  readonly fullFaceFailures: number;
  readonly wrongPlaneFailures: number;
  readonly spacingConflicts: number;
  readonly heroExclusionConflicts: number;
  readonly heroCompositionConflicts: number;
  readonly ordinaryCount: number;
  readonly heroCount: number;
  readonly acceptedByLoopSection: readonly number[];
  readonly corridorFaceCount: number;
  readonly tallInnerBuildingCount: number;
  /** Every pre-R16 floater, worst first: kind, canyon centre, world centre and how far off it was. */
  readonly pointWarpFloaters: readonly { kind: number; index: number; x: number; y: number; v: number; wx: number; wz: number; driftM: number; gapM: number }[];
}

const auditOwner: WarpOut = { x: 0, z: 0, heading: 0 };
const auditPoint: WarpOut = { x: 0, z: 0, heading: 0 };

/**
 * R16 global assertion pass: for every trim instance, the drawn placement must hold its canyon-space
 * relation to its owner through the full loop's warp — the same offset in the owner's frame, and
 * still touching it. Pure; for tests and the evidence probe.
 */
export function auditCityAnchors(layout: SkyriverCityLayout): SkyriverAnchorAudit {
  const trims = deriveCityTrims(layout);
  const placed: SkyriverTrimPlacement = { x: 0, z: 0, heading: 0, length: 0 };
  let maxDrift = 0;
  let floating = 0;
  let pointMaxDrift = 0;
  let pointFloating = 0;
  const worst: { kind: number; index: number; x: number; y: number; v: number; wx: number; wz: number; driftM: number; gapM: number }[] = [];
  const drawnFailures: typeof worst = [];
  const pointByKind: number[] = [];
  // Offset of world point (wx, wz) in the owner's drawn frame, minus the canyon offset.
  const check = (owner: SkyriverTrimOwner, frameV: number, wx: number, wz: number, cx: number, cz: number, ex: number, ez: number): { drift: number; gap: number } => {
    warpRigid(owner.x, owner.z, frameV, auditOwner);
    const dx = wx - auditOwner.x;
    const dz = wz - auditOwner.z;
    const c = Math.cos(auditOwner.heading);
    const s = Math.sin(auditOwner.heading);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const drift = Math.hypot(lx - (cx - owner.x), lz - (cz - owner.z));
    const gap = Math.max(Math.abs(lx) - (owner.width + ex) * 0.5, Math.abs(lz) - (owner.depth + ez) * 0.5);
    return { drift, gap };
  };
  for (let i = 0; i < trims.count; i += 1) {
    const owner = trims.owner[i]!;
    const cx = trims.cx[i]!;
    const cz = trims.cz[i]!;
    const ex = trims.sx[i]!;
    const ez = trims.sz[i]!;
    const touches = Math.max(Math.abs(cx - owner.x) - (owner.width + ex) * 0.5, Math.abs(cz - owner.z) - (owner.depth + ez) * 0.5) <= 0.5;
    placeTrim(trims, i, placed);
    const drawn = check(owner, owner.anchorV, placed.x, placed.z, cx, cz, ex, ez);
    // Spans are checked at their ends below; their centre legitimately moves with the span.
    if (trims.spanTo[i] === null) {
      maxDrift = Math.max(maxDrift, drawn.drift);
      if (touches && drawn.gap > 0.5) {
        floating += 1;
        drawnFailures.push({ kind: trims.kind[i]!, index: i, x: cx, y: trims.cy[i]!, v: cz, wx: placed.x, wz: placed.z, driftM: drawn.drift, gapM: drawn.gap });
      }
    }
    // Pre-R16: warped at its own centre (landmark floods were already rigid around their tower);
    // owners at their own centres.
    if (trims.kind[i] === SKYRIVER_TRIM_FLOOD) warpRigid(cx, cz, owner.z, auditPoint);
    else warpCanyon(cx, cz, auditPoint);
    const to = trims.spanTo[i]!;
    let point = check(owner, owner.z, auditPoint.x, auditPoint.z, cx, cz, ex, ez);
    if (to !== null) {
      // A pre-R16 span was a straight box of its canyon length at its warped centre: check its ends.
      const alongAxis = ez >= ex;
      const half = (alongAxis ? ez : ex) * 0.5;
      const ux = alongAxis ? Math.sin(auditPoint.heading) : Math.cos(auditPoint.heading);
      const uz = alongAxis ? Math.cos(auditPoint.heading) : -Math.sin(auditPoint.heading);
      const px = auditPoint.x;
      const pz = auditPoint.z;
      point = { drift: 0, gap: -Infinity };
      for (const sign of [-1, 1]) {
        const ecx = alongAxis ? cx : cx + sign * half;
        const ecz = alongAxis ? cz + sign * half : cz;
        const nearOwner = footprintGap(owner, ecx, ecz) <= footprintGap(to, ecx, ecz) ? owner : to;
        const end = check(nearOwner, nearOwner.z, px + ux * half * sign, pz + uz * half * sign, ecx, ecz, 0, 0);
        point = { drift: Math.max(point.drift, end.drift), gap: Math.max(point.gap, end.gap) };
      }
    }
    pointMaxDrift = Math.max(pointMaxDrift, point.drift);
    if (touches && point.gap > 0.5) {
      pointFloating += 1;
      pointByKind[trims.kind[i]!] = (pointByKind[trims.kind[i]!] ?? 0) + 1;
      worst.push({ kind: trims.kind[i]!, index: i, x: cx, y: trims.cy[i]!, v: cz, wx: auditPoint.x, wz: auditPoint.z, driftM: point.drift, gapM: point.gap });
    }
    if (to !== null) {
      // Both ends of a span must land on their buildings' faces.
      const alongAxis = ez >= ex;
      const half = placed.length * 0.5;
      const ux = alongAxis ? Math.sin(placed.heading) : Math.cos(placed.heading);
      const uz = alongAxis ? Math.cos(placed.heading) : -Math.sin(placed.heading);
      const canyonHalf = (alongAxis ? ez : ex) * 0.5;
      for (const sign of [-1, 1]) {
        const ecx = alongAxis ? cx : cx + sign * canyonHalf;
        const ecz = alongAxis ? cz + sign * canyonHalf : cz;
        const nearOwner = footprintGap(owner, ecx, ecz) <= footprintGap(to, ecx, ecz) ? owner : to;
        const end = check(nearOwner, nearOwner.anchorV, placed.x + ux * half * sign, placed.z + uz * half * sign, ecx, ecz, 0, 0);
        maxDrift = Math.max(maxDrift, end.drift);
        if (end.gap > 0.5) {
          floating += 1;
          drawnFailures.push({ kind: trims.kind[i]!, index: i, x: ecx, y: trims.cy[i]!, v: ecz, wx: placed.x, wz: placed.z, driftM: end.drift, gapM: end.gap });
        }
      }
    }
  }
  // Facade signs: the sign must stay on its tower's face (centre within the face's run, minus the
  // sign's own half width for flat signs).
  const signs = deriveNeonSigns(layout);
  let signsChecked = 0;
  let signMaxDrift = 0;
  let signsOff = 0;
  let pointSignsOff = 0;
  let wrongPlaneFailures = 0;
  let spacingConflicts = 0;
  let heroExclusionConflicts = 0;
  let heroCompositionConflicts = 0;
  const facadeFaces = deriveFacadeFaces(layout);
  const faceById = new Map(facadeFaces.map((face) => [face.id, face]));
  const ordinaryReservations: FacadeReservation[] = [];
  const heroByComposition = new Map<string, FacadeReservation>();
  for (let i = 0; i < signs.count; i += 1) {
    const mount = signs.owner[i];
    if (!mount) continue;
    signsChecked += 1;
    const cx = signs.cx[i]!;
    const cz = signs.cz[i]!;
    const face = faceById.get(signs.faceId[i] ?? '');
    if (face === undefined) {
      signsOff += 1;
      wrongPlaneFailures += 1;
      continue;
    }
    const alongCentre = face.planeAxis === 'x' ? cz : cx;
    const halfAlong = face.planeAxis === 'z' || signs.nz[i] === 0 ? signs.sw[i]! * 0.5 : signs.rootHalfWidthM[i]!;
    const faceRect: FacadeRect = {
      u0: alongCentre - halfAlong,
      u1: alongCentre + halfAlong,
      y0: signs.cy[i]! - signs.sh[i]! * 0.5,
      y1: signs.cy[i]! + signs.sh[i]! * 0.5,
    };
    if (!facadeFaceContains(face, faceRect)) signsOff += 1;
    const expectedPlane = face.planeAxis === 'z'
      ? face.plane + face.outward * 1.2
      : face.plane + face.outward * (signs.nz[i] !== 0 ? signs.sw[i]! * 0.5 + 0.8 : (i < signs.heroCount ? 0.8 : SKYRIVER_CITY.signStandoffM));
    const placedPlane = face.planeAxis === 'z' ? cz : cx;
    if (Math.abs(placedPlane - expectedPlane) > 0.05) wrongPlaneFailures += 1;
    warpRigid(cx, cz, mount.anchorV, auditPoint);
    const drawn = check(mount, mount.anchorV, auditPoint.x, auditPoint.z, cx, cz, 0, 0);
    signMaxDrift = Math.max(signMaxDrift, drawn.drift);
    // Along-face overrun past the tower's end (the across offset is the standoff, exact either way).
    warpCanyon(cx, cz, auditPoint);
    const point = check(mount, mount.z, auditPoint.x, auditPoint.z, cx, cz, 0, 0);
    // Along-face position of the pre-R16 placement in the tower's frame.
    warpRigid(mount.x, mount.z, mount.z, auditOwner);
    const c = Math.cos(auditOwner.heading);
    const sn = Math.sin(auditOwner.heading);
    const lz = (auditPoint.x - auditOwner.x) * sn + (auditPoint.z - auditOwner.z) * c;
    const legacyOverrun = (d: number): boolean => d + halfAlong > mount.depth * 0.5 + 0.5;
    if (point.drift > 0.5 && legacyOverrun(Math.abs(lz))) pointSignsOff += 1;

    const alongHalfForSpacing = face.planeAxis === 'z' ? 4 : (signs.nz[i] !== 0 ? signs.rootHalfWidthM[i]! : signs.sw[i]! * 0.5);
    const reservation: FacadeReservation = {
      side: face.side,
      buildingId: face.buildingId,
      u0: cz - alongHalfForSpacing,
      u1: cz + alongHalfForSpacing,
      y0: signs.cy[i]! - signs.sh[i]! * 0.5,
      y1: signs.cy[i]! + signs.sh[i]! * 0.5,
      heightM: signs.sh[i]!,
      compositionId: signs.compositionId[i] ?? `sign-${i}`,
      role: i < signs.heroCount ? 'hero' : 'ordinary',
    };
    if (i < signs.heroCount) {
      const current = heroByComposition.get(reservation.compositionId);
      heroByComposition.set(reservation.compositionId, current === undefined ? reservation : {
        ...current,
        u0: Math.min(current.u0, reservation.u0),
        u1: Math.max(current.u1, reservation.u1),
        y0: Math.min(current.y0, reservation.y0),
        y1: Math.max(current.y1, reservation.y1),
        heightM: Math.max(current.heightM, reservation.heightM),
      });
    } else ordinaryReservations.push(reservation);
  }
  for (let i = 0; i < ordinaryReservations.length; i += 1) {
    const reservation = ordinaryReservations[i]!;
    for (let j = i + 1; j < ordinaryReservations.length; j += 1) {
      if (facadeReservationsConflict(reservation, ordinaryReservations[j]!, CANYON_LOOP_LENGTH_M)) spacingConflicts += 1;
    }
    for (const hero of heroByComposition.values()) {
      if (facadeReservationsConflict(reservation, hero, CANYON_LOOP_LENGTH_M)) heroExclusionConflicts += 1;
    }
  }
  const heroCompositions = [...heroByComposition.values()];
  for (let i = 0; i < heroCompositions.length; i += 1) {
    for (let j = i + 1; j < heroCompositions.length; j += 1) {
      if (facadeReservationsConflict(heroCompositions[i]!, heroCompositions[j]!, CANYON_LOOP_LENGTH_M)) heroCompositionConflicts += 1;
    }
  }

  worst.sort((a, b) => b.driftM - a.driftM);
  return {
    checked: trims.count,
    maxDriftM: maxDrift,
    floating,
    failures: drawnFailures.slice(0, 40),
    pointWarpMaxDriftM: pointMaxDrift,
    pointWarpFloating: pointFloating,
    signsChecked,
    signMaxDriftM: signMaxDrift,
    signsOffFace: signsOff,
    pointWarpSignsOffFace: pointSignsOff,
    fullFaceFailures: signsOff,
    wrongPlaneFailures,
    spacingConflicts,
    heroExclusionConflicts,
    heroCompositionConflicts,
    ordinaryCount: signs.ordinaryCount,
    heroCount: signs.heroCount,
    acceptedByLoopSection: signs.acceptedByLoopSection,
    corridorFaceCount: facadeFaces.filter((face) => face.planeAxis === 'x').length,
    tallInnerBuildingCount: new Set(facadeFaces.filter((face) => face.planeAxis === 'x' && face.y1 - face.y0 >= 150).map((face) => face.buildingId)).size,
    pointWarpFloatingByKind: Array.from({ length: SKYRIVER_TRIM_FLOOD + 1 }, (_, k) => pointByKind[k] ?? 0),
    pointWarpFloaters: worst,
  };
}


/** Towers of the inner column on one side: the wall that faces the corridor. */
function innerWallOf(layout: SkyriverCityLayout, side: -1 | 1): readonly SkyriverTower[] {
  const wall = wallOf(layout, side);
  if (wall.length === 0) return wall;
  const innerX = Math.abs(wall[0]!.x);
  return wall.filter((tower) => Math.abs(tower.x) < innerX + layout.cell * 0.5);
}

export interface HeroRowPlan {
  readonly compositionId: string;
  readonly side: -1 | 1;
  readonly tower: SkyriverTower;
  readonly centreY: number;
  readonly faceBottom: number;
  readonly faceTop: number;
}

function facadeHash01(seed: number, tower: SkyriverTower, salt: number): number {
  return hash1(seed * 0.019 + tower.x * 0.0317 + tower.z * 0.00713 + salt * 71.3);
}

/** Selects tall hero hosts from the existing lots before the tier faces are derived. */
export function deriveHeroRowPlans(layout: SkyriverCityLayout): readonly HeroRowPlan[] {
  const bends = canyonBendApexes(900).map((bend) => bend.v).sort((a, b) => a - b);
  const rows: HeroRowPlan[] = [];
  for (let section = 0; section < bends.length; section += 1) {
    const start = bends[section]!;
    let end = bends[(section + 1) % bends.length]!;
    if (end <= start) end += CANYON_LOOP_LENGTH_M;
    const intoShowcase = Math.abs(((end % CANYON_LOOP_LENGTH_M) + CANYON_LOOP_LENGTH_M) % CANYON_LOOP_LENGTH_M
      - ((SKYRIVER_SHOWCASE_BEND_V % CANYON_LOOP_LENGTH_M) + CANYON_LOOP_LENGTH_M) % CANYON_LOOP_LENGTH_M) < 1;
    const lo = intoShowcase ? 0.12 : 0.3;
    const hi = intoShowcase ? 0.3 : 0.7;
    let best: HeroRowPlan & { score: number } | null = null;
    for (const side of [-1, 1] as const) {
      for (const tower of innerWallOf(layout, side)) {
        let hostV = tower.z;
        while (hostV < start + (end - start) * lo) hostV += CANYON_LOOP_LENGTH_M;
        if (hostV > start + (end - start) * hi) continue;
        if (tower.depth < 136) continue;
        const faceAbsX = Math.abs(tower.x) - tower.width * 0.5;
        const bladeWidth = Math.min(90, faceAbsX - 407);
        if (bladeWidth < 60) continue;
        for (const lift of [0, 150, 300, 450]) {
          const centreY = routeAltitude(hostV) + 20 + lift;
          const faceBottom = centreY - 350;
          const faceTop = centreY + 350;
          if (faceBottom < 150 || faceTop > tower.height - 150) continue;
          const score = routeLateral(hostV) * side + Math.min(faceAbsX - 405, 110) * 0.55
            - lift * 0.22 + (tower.height - faceTop) * 0.015;
          if (best === null || score > best.score) {
            best = { compositionId: `hero-row-${section}`, side, tower, centreY, faceBottom, faceTop, score };
          }
          break;
        }
      }
    }
    if (best !== null) {
      const { score: _score, ...row } = best;
      rows.push(row);
    }
  }
  return rows;
}


export interface SkyriverHeroBlade {
  /** T7-2: 'blade' projects into the canyon facing along it; 'panel' is a giant sign flat on the wall. */
  /** R14 'brand': a giant vertical sign flat on the showcase tower's corridor face. */
  readonly kind: 'blade' | 'panel' | 'brand';
  /** Stable source slot within its kind. Rendering wraps this slot through the reserved cells. */
  readonly cell: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
  readonly color: number;
  readonly seed: number;
  readonly buildingId: string;
  readonly faceId: string;
  readonly compositionId: string;
  readonly rootHalfWidthM: number;
  readonly owner: SkyriverTrimOwner;
}

/**
 * T7-3 hero stations around the whole loop: every ~530 m, alternating walls, in a blade-blade-panel
 * rhythm, at the route's own altitude there. Stations where the route is in the pristine heights
 * are skipped (calm, clean slabs up there).
 */
const HERO_SPACING_M = 530;
// R12: weighted toward cyan, amber and green — the hues that stay saturated *and* bright under ACES.
const HERO_COLORS: readonly number[] = Object.freeze([0x2ff2ff, 0xffb13c, 0xff2fb4, 0x55ff7a, 0x2ff2ff, 0xffb13c, 0xff4a8c]);

const heroCache = new Map<number, readonly SkyriverHeroBlade[]>();

/**
 * The hero signs use named exposed faces. Bend sections reserve four-blade rows. Pure; cached per seed.
 */
export function deriveHeroBlades(layout: SkyriverCityLayout): readonly SkyriverHeroBlade[] {
  const cached = heroCache.get(layout.seed);
  if (cached !== undefined) return cached;
  deriveCityTrims(layout);
  const faces = deriveFacadeFaces(layout);
  const rowRandom = new DeterministicRandom(layout.seed).fork('skyriver.city.hero.rows');
  const brandRandom = new DeterministicRandom(layout.seed).fork('skyriver.city.hero.brand');
  const blades: SkyriverHeroBlade[] = [];
  const rows = deriveHeroRowPlans(layout);
  const facesByBuilding = new Map<string, SkyriverFacadeFace[]>();
  for (const face of faces) {
    const bucket = facesByBuilding.get(face.buildingId) ?? [];
    bucket.push(face);
    facesByBuilding.set(face.buildingId, bucket);
  }
  const stations: { readonly k: number; readonly z: number; readonly side: -1 | 1; readonly kind: 'blade' | 'panel'; readonly cell: number }[] = [];
  let bladeCandidateCount = 0;
  let panelCandidateCount = 0;

  for (let k = 0; k * HERO_SPACING_M < CANYON_LOOP_LENGTH_M; k += 1) {
    const z = -CANYON_LOOP_LENGTH_M / 2 + (k + 0.5) * HERO_SPACING_M;
    const side = k % 2 === 0 ? -1 : 1;
    const kind = routeAltitude(z) > STRATA_PRISTINE_BASE_M - 50 || k % 3 === 2 ? 'panel' : 'blade';
    const cell = kind === 'blade' ? bladeCandidateCount++ : panelCandidateCount++;
    stations.push({ k, z, side, kind, cell });
  }

  for (const station of stations) {
    const { k, z, side, kind, cell } = station;
    const stationRandom = new DeterministicRandom(layout.seed).fork(`skyriver.city.hero.station.${k}`);
    const wall = innerWallOf(layout, side);
    if (wall.length === 0) continue;
    const tower = wall.reduce((best, candidate) => Math.abs(candidate.z - z) < Math.abs(best.z - z) ? candidate : best);
    const candidates = (facesByBuilding.get(`tower:${towerKey(tower)}`) ?? [])
      .filter((face) => face.side === side && face.planeAxis === 'x');
    if (kind === 'blade') {
      const height = 230 + stationRandom.nextInt(0, 100);
      const targetY = routeAltitude(z) + 20 + stationRandom.nextInt(-50, 50);
      const targetWidth = Math.min(70, Math.max(30, Math.abs(tower.x) - tower.width * 0.5 - 410));
      let best: { readonly face: SkyriverFacadeFace; readonly rect: FacadeRect; readonly width: number; readonly offsetM: number } | undefined;
      for (const face of candidates) {
        const width = Math.min(targetWidth, Math.abs(face.plane) - 410);
        if (width < 30) continue;
        const fit = fitOnNearestFacadeFace([face], z, targetY, 6, height * 0.5, FACADE_FACE_EDGE_MARGIN_M + 0.25);
        if (fit !== undefined && (best === undefined || fit.offsetM < best.offsetM)) {
          best = { face, rect: fit.rect, width, offsetM: fit.offsetM };
        }
      }
      if (best === undefined) continue;
      const y = (best.rect.y0 + best.rect.y1) * 0.5;
      const placedZ = (best.rect.u0 + best.rect.u1) * 0.5;
      blades.push({
        kind, cell, x: best.face.plane + best.face.outward * (best.width * 0.5 + 0.8), y, z: placedZ,
        width: best.width, height,
        color: HERO_COLORS[k % HERO_COLORS.length]!, seed: stationRandom.nextInt(0, 9999) / 9999,
        buildingId: best.face.buildingId, faceId: best.face.id, compositionId: `hero-${k}`, rootHalfWidthM: 6,
        owner: best.face.owner,
      });
    } else {
      const height = 44 + stationRandom.nextInt(0, 12);
      const targetY = routeAltitude(z) + 130 + stationRandom.nextInt(-40, 40);
      let best: { readonly face: SkyriverFacadeFace; readonly rect: FacadeRect; readonly width: number; readonly offsetM: number } | undefined;
      for (const face of candidates) {
        const width = Math.min(160, face.u1 - face.u0 - 8.5);
        if (width < 60) continue;
        const fit = fitOnNearestFacadeFace([face], z, targetY, width * 0.5, height * 0.5, FACADE_FACE_EDGE_MARGIN_M + 0.25);
        if (fit !== undefined && (best === undefined || fit.offsetM < best.offsetM
          || (fit.offsetM === best.offsetM && width > best.width))) {
          best = { face, rect: fit.rect, width, offsetM: fit.offsetM };
        }
      }
      if (best === undefined) continue;
      const y = (best.rect.y0 + best.rect.y1) * 0.5;
      const placedZ = (best.rect.u0 + best.rect.u1) * 0.5;
      blades.push({
        kind, cell, x: best.face.plane + best.face.outward * 0.8, y, z: placedZ,
        width: best.width, height,
        color: HERO_COLORS[(k + 2) % HERO_COLORS.length]!, seed: stationRandom.nextInt(0, 9999) / 9999,
        buildingId: best.face.buildingId, faceId: best.face.id, compositionId: `hero-${k}`,
        rootHalfWidthM: best.width * 0.5, owner: best.face.owner,
      });
    }
  }

  const rowOffsets = [40, -60, 90, -20] as const;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]!;
    const buildingId = `tower:${towerKey(row.tower)}`;
    const face = faces.find((candidate) => candidate.buildingId === buildingId
      && Math.abs(candidate.y0 - row.faceBottom) < 0.05
      && Math.abs(candidate.y1 - row.faceTop) < 0.05);
    if (face === undefined) continue;
    const corridorRoom = Math.abs(face.plane) - 407;
    const width = Math.min(90, corridorRoom);
    if (width < 60) continue;
    for (let n = 0; n < 4; n += 1) {
      const z = row.tower.z + (n - 1.5) * 38;
      const y = row.centreY + rowOffsets[n]!;
      const height = width * 5.2;
      if (!facadeFaceContains(face, { u0: z - 3, u1: z + 3, y0: y - height * 0.5, y1: y + height * 0.5 }, FACADE_FACE_EDGE_MARGIN_M + 0.25)) continue;
      blades.push({
        kind: 'blade', cell: (bladeCandidateCount + rowIndex * 4 + n) % HERO_VERTICAL_CELLS,
        x: face.plane + face.outward * (width * 0.5 + 0.8), y, z, width, height,
        color: HERO_COLORS[(rowIndex * 2 + n) % HERO_COLORS.length]!,
        seed: rowRandom.nextInt(0, 9999) / 9999,
        buildingId: face.buildingId, faceId: face.id, compositionId: row.compositionId,
        rootHalfWidthM: 3, owner: face.owner,
      });
    }
  }

  for (const apex of canyonBendApexes(900)) {
    if (Math.abs(apex.v - SKYRIVER_SHOWCASE_BEND_V) >= 1) continue;
    const face = faces.find((candidate) => candidate.id.endsWith(':brand-face'));
    if (face === undefined) continue;
    const x = apex.side * apex.radius * 0.995;
    const y = 2380;
    const width = 92;
    const height = width * 5.2;
    if (!facadeFaceContains(face, { u0: x - width * 0.5, u1: x + width * 0.5, y0: y - height * 0.5, y1: y + height * 0.5 })) continue;
    blades.push({
      kind: 'brand', cell: 0, x, y, z: face.plane + face.outward * 1.2,
      width, height, color: 0x2ff2ff, seed: brandRandom.nextInt(0, 9999) / 9999,
      buildingId: face.buildingId, faceId: face.id, compositionId: 'showcase-brand',
      rootHalfWidthM: width * 0.5, owner: face.owner,
    });
  }

  const faceById = new Map(faces.map((face) => [face.id, face]));
  const reservationForHero = (hero: SkyriverHeroBlade, face: SkyriverFacadeFace): FacadeReservation => {
    const halfAlong = face.planeAxis === 'z' ? 4 : hero.kind === 'blade' ? hero.rootHalfWidthM : hero.width * 0.5;
    return {
      side: face.side,
      buildingId: face.buildingId,
      u0: hero.z - halfAlong,
      u1: hero.z + halfAlong,
      y0: hero.y - hero.height * 0.5,
      y1: hero.y + hero.height * 0.5,
      heightM: hero.height,
      compositionId: hero.compositionId,
      role: 'hero',
    };
  };

  const occupied: FacadeReservation[] = [];
  const priorityUnions = new Map<string, FacadeReservation>();
  for (const hero of blades) {
    if (!hero.compositionId.startsWith('hero-row-') && hero.kind !== 'brand') continue;
    const face = faceById.get(hero.faceId);
    if (face === undefined) continue;
    const reservation = reservationForHero(hero, face);
    const previous = priorityUnions.get(hero.compositionId);
    priorityUnions.set(hero.compositionId, previous === undefined ? reservation : {
      ...previous,
      u0: Math.min(previous.u0, reservation.u0),
      u1: Math.max(previous.u1, reservation.u1),
      y0: Math.min(previous.y0, reservation.y0),
      y1: Math.max(previous.y1, reservation.y1),
      heightM: Math.max(previous.heightM, reservation.heightM),
    });
  }
  occupied.push(...priorityUnions.values());

  const stationPlacements = new Map<string, SkyriverHeroBlade>();
  const rejectedStations = new Set<string>();
  const stationHeroes = blades.filter((hero) => hero.compositionId.startsWith('hero-') && !hero.compositionId.startsWith('hero-row-'))
    .sort((a, b) => b.height - a.height || a.compositionId.localeCompare(b.compositionId));
  for (const hero of stationHeroes) {
    const originalFace = faceById.get(hero.faceId);
    if (originalFace === undefined) continue;
    let best: { readonly hero: SkyriverHeroBlade; readonly score: number } | undefined;
    const hostFaces = (facesByBuilding.get(hero.buildingId) ?? [])
      .filter((face) => face.side === originalFace.side && face.planeAxis === 'x');
    for (const face of hostFaces) {
      const margin = FACADE_FACE_EDGE_MARGIN_M + 0.25;
      const isBlade = hero.kind === 'blade';
      const minWidth = isBlade ? 30 : 60;
      const maxWidth = isBlade
        ? Math.abs(face.plane) - 410
        : face.u1 - face.u0 - 2 * margin;
      const width = Math.min(hero.width, maxWidth);
      if (width < minWidth) continue;
      const halfU = isBlade ? hero.rootHalfWidthM : width * 0.5;
      const halfY = hero.height * 0.5;
      const minU = face.u0 + halfU + margin;
      const maxU = face.u1 - halfU - margin;
      const minY = face.y0 + halfY + margin;
      const maxY = face.y1 - halfY - margin;
      if (minU > maxU || minY > maxY) continue;
      const clampU = (u: number): number => Math.max(minU, Math.min(maxU, u));
      const clampY = (y: number): number => Math.max(minY, Math.min(maxY, y));
      const uCandidates = new Set([clampU(hero.z), minU, maxU]);
      const yCandidates = new Set([clampY(hero.y), minY, maxY]);
      for (const reservation of occupied) {
        if (reservation.side !== face.side) continue;
        for (const shift of [-CANYON_LOOP_LENGTH_M, 0, CANYON_LOOP_LENGTH_M]) {
          uCandidates.add(clampU(reservation.u0 + shift - halfU - 0.5));
          uCandidates.add(clampU(reservation.u1 + shift + halfU + 0.5));
        }
        const clearance = 1.5 * Math.max(hero.height, reservation.heightM) + 0.5;
        yCandidates.add(clampY(reservation.y0 - halfY - clearance));
        yCandidates.add(clampY(reservation.y1 + halfY + clearance));
      }
      for (const u of uCandidates) {
        for (const y of yCandidates) {
          const rect = { u0: u - halfU, u1: u + halfU, y0: y - halfY, y1: y + halfY };
          if (!facadeFaceContains(face, rect, margin)) continue;
          const candidate: SkyriverHeroBlade = {
            ...hero,
            x: face.plane + face.outward * (isBlade ? width * 0.5 + 0.8 : 0.8),
            y,
            z: u,
            width,
            faceId: face.id,
            rootHalfWidthM: isBlade ? hero.rootHalfWidthM : width * 0.5,
            owner: face.owner,
          };
          const reservation = reservationForHero(candidate, face);
          if (occupied.some((placed) => facadeReservationsConflict(reservation, placed, CANYON_LOOP_LENGTH_M))) continue;
          const score = Math.hypot(u - hero.z, y - hero.y) + (hero.width - width) * 2;
          if (best === undefined || score < best.score) best = { hero: candidate, score };
        }
      }
    }
    if (best === undefined) {
      rejectedStations.add(hero.compositionId);
      continue;
    }
    stationPlacements.set(hero.compositionId, best.hero);
    const face = faceById.get(best.hero.faceId)!;
    occupied.push(reservationForHero(best.hero, face));
  }

  const retained: SkyriverHeroBlade[] = [];
  for (let i = 0; i < blades.length; i += 1) {
    const placed = stationPlacements.get(blades[i]!.compositionId);
    if (rejectedStations.has(blades[i]!.compositionId)) continue;
    retained.push(placed ?? blades[i]!);
  }
  blades.splice(0, blades.length, ...retained);
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
export const SKYRIVER_CITY_SIGN_CANDIDATE_BUDGET = 12000;

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
  const faceId: (string | null)[] = [];
  const buildingId: (string | null)[] = [];
  const compositionId: (string | null)[] = [];
  const rootHalfWidthM = new Float32Array(cap);
  const owner: (SkyriverTrimOwner | null)[] = [];
  const anchorV = new Float64Array(cap);
  const faces = deriveFacadeFaces(layout).filter((face) => face.planeAxis === 'x');
  if (faces.length === 0) fail('SKYRIVER_CITY_INNER_FACES_EMPTY');
  const faceById = new Map(deriveFacadeFaces(layout).map((face) => [face.id, face]));
  const tint = new THREE.Color();
  const reservations: FacadeReservation[] = [];
  const acceptedByLoopSection = new Array<number>(8).fill(0);
  const heroUnions = new Map<string, FacadeReservation>();
  let count = 0;

  const add = (
    sign: { readonly x: number; readonly y: number; readonly z: number; readonly nx: number; readonly nz: number; readonly width: number; readonly height: number; readonly color: number; readonly seed: number; readonly kind: number; readonly face: SkyriverFacadeFace; readonly compositionId: string; readonly rootHalfWidth: number; readonly anchorV: number },
  ): void => {
    cx[count] = sign.x;
    cy[count] = sign.y;
    cz[count] = sign.z;
    nx[count] = sign.nx;
    nz[count] = sign.nz;
    sw[count] = sign.width;
    sh[count] = sign.height;
    tint.setHex(sign.color, THREE.SRGBColorSpace);
    color[count * 3] = tint.r;
    color[count * 3 + 1] = tint.g;
    color[count * 3 + 2] = tint.b;
    kind[count] = sign.kind;
    seedValue[count] = sign.seed;
    faceId[count] = sign.face.id;
    buildingId[count] = sign.face.buildingId;
    compositionId[count] = sign.compositionId;
    rootHalfWidthM[count] = sign.rootHalfWidth;
    owner[count] = sign.face.owner;
    anchorV[count] = sign.anchorV;
    count += 1;
  };

  const heroes = deriveHeroBlades(layout);
  for (const hero of heroes) {
    const face = faceById.get(hero.faceId);
    if (face === undefined || count >= cap) continue;
    const heroKind = hero.kind === 'panel' ? SKYRIVER_SIGN_STRIP : SKYRIVER_SIGN_BANNER;
    add({
      x: hero.x,
      y: hero.y,
      z: hero.z,
      nx: hero.kind === 'panel' ? face.outward : 0,
      nz: hero.kind === 'blade' || hero.kind === 'brand' ? (hero.kind === 'brand' ? -1 : 1) : 0,
      width: hero.width,
      height: hero.height,
      color: hero.color,
      seed: hero.seed,
      kind: heroKind,
      face,
      compositionId: hero.compositionId,
      rootHalfWidth: hero.rootHalfWidthM,
      // A hero is classified by its own route position, in double: its station or bend z.
      anchorV: hero.z,
    });
    const halfAlong = face.planeAxis === 'x' && hero.kind === 'blade' ? hero.rootHalfWidthM : (hero.kind === 'brand' ? 4 : hero.width * 0.5);
    const key = hero.compositionId;
    const current = heroUnions.get(key);
    const rect = {
      side: face.side,
      buildingId: face.buildingId,
      u0: hero.z - halfAlong,
      u1: hero.z + halfAlong,
      y0: hero.y - hero.height * 0.5,
      y1: hero.y + hero.height * 0.5,
      heightM: hero.height,
      compositionId: key,
      role: 'hero' as const,
    };
    heroUnions.set(key, current === undefined ? rect : {
      ...current,
      u0: Math.min(current.u0, rect.u0),
      u1: Math.max(current.u1, rect.u1),
      y0: Math.min(current.y0, rect.y0),
      y1: Math.max(current.y1, rect.y1),
      heightM: Math.max(current.heightM, rect.heightM),
    });
  }
  const heroCount = count;
  const heroReservations = [...heroUnions.values()];

  for (let attempt = 0; attempt < SKYRIVER_CITY_SIGN_CANDIDATE_BUDGET && count < cap; attempt += 1) {
    const face = faces[random.nextInt(0, faces.length - 1)]!;
    const roll = random.nextInt(0, 99);
    let width: number;
    let height: number;
    let signKind: number;
    let normalZ = 0;
    let normalX = 0;
    let rootHalf = 0;
    if (roll < 48) {
      signKind = SKYRIVER_SIGN_BANNER;
      width = 10 + random.nextInt(0, 130) / 10;
      height = 55 + random.nextInt(0, 1500) / 10;
      normalZ = random.nextInt(0, 1) === 0 ? -1 : 1;
      rootHalf = 3;
    } else {
      normalX = face.outward;
      if (roll < 76) {
        signKind = SKYRIVER_SIGN_STRIP;
        width = 34 + random.nextInt(0, 800) / 10;
        height = 12 + random.nextInt(0, 180) / 10;
      } else if (roll < 91) {
        signKind = SKYRIVER_SIGN_BANNER;
        width = 12 + random.nextInt(0, 90) / 10;
        height = 45 + random.nextInt(0, 1000) / 10;
      } else {
        signKind = SKYRIVER_SIGN_OUTLINE;
        width = 18 + random.nextInt(0, 260) / 10;
        height = 12 + random.nextInt(0, 160) / 10;
      }
      rootHalf = width * 0.5;
    }

    const inBand = random.nextInt(0, 99) < 60;
    const low = inBand ? 350 : 40;
    const high = inBand ? Math.min(STRATA_PRISTINE_BASE_M - 100, 2050) : Math.min(STRATA_PRISTINE_BASE_M, 2050);
    const yMin = Math.max(low, face.y0 + FACADE_FACE_EDGE_MARGIN_M + height * 0.5 + 0.25);
    const yMax = Math.min(high, face.y1 - FACADE_FACE_EDGE_MARGIN_M - height * 0.5 - 0.25);
    if (yMax < yMin) continue;
    const y = yMin + random.nextInt(0, 1000) / 1000 * (yMax - yMin);
    const halfU = normalZ !== 0 ? rootHalf : width * 0.5;
    const uRoom = (face.u1 - face.u0) * 0.5 - FACADE_FACE_EDGE_MARGIN_M - halfU - 0.25;
    if (uRoom < 0) continue;
    const z = (face.u0 + face.u1) * 0.5 + random.nextInt(-1000, 1000) / 1000 * uRoom;
    if (!facadeFaceContains(face, { u0: z - halfU, u1: z + halfU, y0: y - height * 0.5, y1: y + height * 0.5 })) continue;

    let x: number;
    if (normalZ !== 0) {
      if (width + 0.8 > Math.abs(face.plane) - 405) continue;
      x = face.plane + face.outward * (width * 0.5 + 0.8);
    } else {
      x = face.plane + face.outward * SKYRIVER_CITY.signStandoffM;
    }
    const reservation: FacadeReservation = {
      side: face.side,
      buildingId: face.buildingId,
      u0: z - halfU,
      u1: z + halfU,
      y0: y - height * 0.5,
      y1: y + height * 0.5,
      heightM: height,
      compositionId: `ordinary-${attempt}`,
      role: 'ordinary',
    };
    if (reservations.some((placed) => facadeReservationsConflict(reservation, placed, CANYON_LOOP_LENGTH_M))
      || heroReservations.some((hero) => facadeReservationsConflict(reservation, hero, CANYON_LOOP_LENGTH_M))) continue;

    const packed = random.weighted(NEON_PALETTE, NEON_WEIGHTS);
    if (!Number.isInteger(packed) || packed < 0 || packed > 0xffffff) fail('SKYRIVER_CITY_NEON_TINT_INVALID');
    const composition = `ordinary-${attempt}`;
    add({ x, y, z, nx: normalX, nz: normalZ, width, height, color: packed,
      seed: random.nextInt(0, 9999) / 9999, kind: signKind, face, compositionId: composition, rootHalfWidth: rootHalf,
      // The building's own anchor, in double: the facade and its signs classify as one.
      anchorV: face.owner.anchorV });
    reservations.push(reservation);
    let section = Math.floor((((z + CANYON_LOOP_LENGTH_M * 0.5) % CANYON_LOOP_LENGTH_M) / CANYON_LOOP_LENGTH_M) * 8);
    if (section < 0) section += 8;
    acceptedByLoopSection[section] = (acceptedByLoopSection[section] ?? 0) + 1;
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
    color: color.slice(0, count * 3),
    kind: kind.slice(0, count),
    seedValue: seedValue.slice(0, count),
    faceId: faceId.slice(0, count),
    buildingId: buildingId.slice(0, count),
    compositionId: compositionId.slice(0, count),
    rootHalfWidthM: rootHalfWidthM.slice(0, count),
    ordinaryCount: count - heroCount,
    heroCount,
    acceptedByLoopSection,
    owner: owner.slice(0, count),
    anchorV: anchorV.slice(0, count),
  };
  signCache.set(layout.seed, signs);
  return signs;
}


// --- tower shader ---------------------------------------------------------------------------------

/**
 * R17 distance grade (operator: distant buildings read amber/yellow). Beyond ~0.9 km a surface's
 * colour (concrete, windows, rooms) is pulled toward a neutral steel grey-blue of the same
 * brightness; `extra` raises it for the far layers. Depth separation is left to brightness and
 * contrast falloff (fog), never to hue warmth.
 */
/**
 * R22: the grade and the equal-luminance district recolour share one chunk (render/districts.ts), so
 * every pass that grades depth also carries the one colour switch. `uDistrictColour` at 0 restores
 * the R17 grade exactly, including its brightness/chroma coupling.
 */
const SKYRIVER_DISTANCE_GRADE_GLSL = SKYRIVER_DISTRICT_COLOUR_GLSL + SKYRIVER_DISTRICT_DISTANCE_GRADE_GLSL;

const TOWER_VERTEX = /* glsl */ `
attribute float aSeed;
attribute vec3 aTint;
attribute vec3 aSize;   // width, height, depth in metres
attribute float aLayer; // R15 far-city depth layer (0 = near city)
attribute float aBuilding; // R16 per-building identity seed (interior culture)
attribute vec2 aStepEdges; // R19.9: actual tier edges at the bottom and top of this mass
attribute float aDistrict; // R22 colour district, from this mass's own canyon anchor
attribute float aMaterial; // R25 seeded material owner

varying vec2 vSurf;      // position on the face, metres
varying float vSeed;
varying vec3 vTint;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying float vUp;       // 0 at the base, 1 at the parapet
varying float vIsSide;   // 1 on a facade, 0 on the roof
varying float vFaceId;
varying vec2 vFaceHalf;  // half extents of this face in vSurf metres
varying vec3 vTangentW;  // T7-4: world direction of increasing vSurf.x (interior mapping frame)
varying float vLayer;
varying float vBuilding;
varying vec2 vStepEdges;
varying float vDistrict;
flat varying float vMaterial;

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
  vLayer = aLayer;
  vBuilding = aBuilding;
  vStepEdges = aStepEdges;
  vDistrict = aDistrict;
  vMaterial = aMaterial;

  vec4 world = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
  vWorldPos = world.xyz;
  // T6R-2: graded on world altitude, not per box — walls now run down into the void, and setback
  // tiers and crowns must share one lit-floor profile with the slab they belong to.
  vUp = clamp( world.y / 2600.0, 0.0, 1.0 );
  // Axis-aligned extents only, so normalising after the scale is enough — no inverse transpose.
  vNormalW = normalize( mat3( modelMatrix ) * ( mat3( instanceMatrix ) * n ) );
  vec3 tangentObject = ax > 0.5 ? vec3( 0.0, 0.0, 1.0 ) : vec3( 1.0, 0.0, 0.0 );
  vTangentW = normalize( mat3( modelMatrix ) * ( mat3( instanceMatrix ) * tangentObject ) );

  vec4 mvPosition = modelViewMatrix * ( instanceMatrix * vec4( transformed, 1.0 ) );
  #include <fog_vertex>
  gl_Position = projectionMatrix * mvPosition;
}
`;

const TOWER_FRAGMENT = /* glsl */ `
#define EMISSIVE_GAIN ${SKYRIVER_EMISSIVE_GAIN.toFixed(4)}
uniform float uTime;
uniform float uCellWidth;
uniform float uCellHeight;
uniform float uRibSpacing;
uniform float uProjScale;
uniform float uConcreteLevel;
uniform vec3 uConcreteAmbient;
uniform vec3 uWetTint;
uniform float uContactAllowed;

varying vec2 vSurf;
varying float vSeed;
varying vec3 vTint;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying float vUp;
varying float vIsSide;
varying float vFaceId;
varying vec2 vFaceHalf;
varying vec3 vTangentW;
varying float vLayer;
varying float vBuilding;
varying vec2 vStepEdges;
varying float vDistrict;
flat varying float vMaterial;

// --- T7-4 interior mapping ------------------------------------------------------------------------
// Every window cell is a box room [0,1]^3 (x across, y up, z depth from the glass). The view ray is
// expressed in the facade's tangent frame, one slab test finds the wall/floor/ceiling it hits, and a
// cut-out furniture plane at mid-depth sits in front of the back wall. See interiorAtlas.ts.
uniform sampler2D uInterior;
uniform vec2 uInteriorFade;      // view-depth fade window (start, end), metres
uniform float uInteriorStrength; // 0 = off (low tier), 1 = on
#define INTERIOR_COLUMNS 8.0
#define INTERIOR_ROWS 5.0
#define ROOM_DEPTH_M 7.0

vec4 interiorTap( float room, vec2 local, vec4 rect ) {
  // rect = (u0, v0, u1, v1) inside the room cell; local in [0,1]^2 within that part.
  vec2 inPart = mix( rect.xy, rect.zw, clamp( local, 0.02, 0.98 ) );
  float column = mod( room, INTERIOR_COLUMNS );
  float row = floor( room / INTERIOR_COLUMNS );
  vec2 uv = vec2( ( column + inPart.x ) / INTERIOR_COLUMNS, 1.0 - ( row + 1.0 ) / INTERIOR_ROWS + inPart.y / INTERIOR_ROWS );
  return texture2D( uInterior, uv );
}

/** Traces one room. Returns the lit interior colour for unit light; depth01 is the hit depth. */
vec3 traceRoom( vec2 cellLocal, vec3 ray, float room, float mirror, float fRatio, out float depth01 ) {
  vec3 o = vec3( cellLocal, 0.0 );
  if ( mirror > 0.5 ) { o.x = 1.0 - o.x; ray.x = - ray.x; }
  vec3 r = vec3(
    sign( ray.x ) * max( abs( ray.x ), 1e-4 ),
    sign( ray.y ) * max( abs( ray.y ), 1e-4 ),
    max( ray.z, 1e-4 )
  );
  // Slab test against the inner box: each axis exits through the wall the ray heads toward.
  vec3 tAxis = ( step( 0.0, r ) - o ) / r;
  float t = min( tAxis.x, min( tAxis.y, tAxis.z ) );
  vec3 p = o + r * t;
  vec3 c;
  float shadePlane;
  if ( tAxis.z <= tAxis.x && tAxis.z <= tAxis.y ) {
    c = interiorTap( room, p.xy, vec4( 0.0, 0.5, 0.5, 1.0 ) ).rgb;
    shadePlane = 1.0;
  } else if ( tAxis.x <= tAxis.y ) {
    c = interiorTap( room, vec2( p.z, p.y ), vec4( 0.0, 0.0, 0.25, 0.5 ) ).rgb;
    shadePlane = 0.72;
  } else if ( r.y < 0.0 ) {
    c = interiorTap( room, vec2( p.x, p.z ), vec4( 0.25, 0.0, 0.625, 0.25 ) ).rgb;
    shadePlane = 0.6;
  } else {
    c = interiorTap( room, vec2( p.x, p.z ), vec4( 0.25, 0.25, 0.625, 0.5 ) ).rgb;
    shadePlane = 0.95;
  }
  depth01 = p.z;
  float planeDepthShade = shadePlane * mix( 1.0, 0.5, p.z );
  vec3 detailedWall = c * planeDepthShade;
  // Keep the room shape dark before surface detail.
  vec3 coarseWall = vec3( 0.18 ) * planeDepthShade;
  vec3 coarseRoom = coarseWall;
  vec3 detailedRoom = detailedWall;

  // Furniture plane at mid-depth: in front of whatever the ray reached behind it.
  float tf = 0.5 / r.z;
  if ( tf < t ) {
    vec2 pf = ( o + r * tf ).xy;
    if ( pf.x > 0.0 && pf.x < 1.0 && pf.y > 0.0 && pf.y < 1.0 ) {
      vec4 f = interiorTap( room, pf, vec4( 0.5, 0.5, 1.0, 1.0 ) );
      coarseRoom = coarseWall * ( 1.0 - f.a );
      detailedRoom = mix( detailedWall, f.rgb * 0.85, f.a );
      depth01 = mix( depth01, 0.5, f.a );
    }
  }
  return mix( coarseRoom, detailedRoom, fRatio );
}

#define HERO_MAX 12
uniform vec4 uHeroBlades[ HERO_MAX ];   // x, centre y, z, half height
uniform vec3 uHeroColors[ HERO_MAX ];
uniform int uHeroCount;
uniform float uHeroWeight[ HERO_MAX ];
// R13 landmark face-wash: [world x, world z, half size, strength] per mega-tower.
uniform vec4 uMegaWash[ 4 ];
uniform vec3 uMegaTint;

#include <fog_pars_fragment>
${SKYRIVER_OUTPUT_PARS_GLSL}
${SKYRIVER_HASH_GLSL}
${SKYRIVER_INTERIOR_RESPONSE_GLSL}
${SKYRIVER_STRUCTURE_MATERIAL_GLSL}
${SKYRIVER_DISTANCE_GRADE_GLSL}

/** Rounded-box signed distance in cell units; the window glass. */
float windowSdf( vec2 cellLocal, float ribbon ) {
  const float radius = 0.055;
  // T7-4: the pristine heights glaze in near-continuous ribbons (curtain wall), not punched windows.
  vec2 halfExtent = mix( vec2( 0.41, 0.29 ), vec2( 0.495, 0.36 ), ribbon );
  vec2 d = abs( cellLocal - 0.5 ) - halfExtent + radius;
  return length( max( d, 0.0 ) ) + min( max( d.x, d.y ), 0.0 ) - radius;
}

void main() {
  // R15 far-city layers: near-black massing with a sparse, coarse window grid, dimmer and hazier per
  // layer; no interiors, signs or wet sheen. Same fog as the city, so depth still grades with haze.
  if ( vLayer > 0.5 ) {
    float layerDim = vLayer < 1.5 ? 0.6 : ( vLayer < 2.5 ? 0.34 : 0.18 );
    vec2 farCell = vSurf / vec2( 14.0, 9.0 );
    vec2 farId = floor( farCell );
    vec2 farLocal = fract( farCell );
    float farZone = step( 0.45, skyHash12( vec2( floor( farId.y / 9.0 ), vSeed * 31.0 + vFaceId ) ) );
    float farLit = step( 0.86, skyHash12( farId + vSeed * 17.0 ) ) * farZone * vIsSide;
    float farGlass = step( 0.2, farLocal.x ) * step( farLocal.x, 0.8 ) * step( 0.3, farLocal.y ) * step( farLocal.y, 0.7 );
    float farPixels = 9.0 * uProjScale / max( vFogDepth, 1.0 );
    float farResolve = smoothstep( 1.5, 4.0, farPixels );
    float farTemp = skyHash11( farId.x * 3.1 + farId.y * 7.7 + vSeed * 11.0 );
    vec3 farPane = mix( vec3( 1.0, 0.55, 0.22 ), vec3( 0.45, 0.65, 1.0 ), step( 0.6, farTemp ) );
    float farAverage = 0.14 * 0.24 * farZone * vIsSide;
    float farBottomClearance = vFaceHalf.y + farId.y * 9.0;
    float farTopClearance = vFaceHalf.y - ( farId.y + 1.0 ) * 9.0;
    float farStepMask = 1.0;
    if ( vIsSide > 0.5 && vStepEdges.x > 0.5 && farBottomClearance < ${FACADE_STEP_MASK_BAND_M.toFixed(1)} ) farStepMask = 0.0;
    if ( vIsSide > 0.5 && vStepEdges.y > 0.5 && farTopClearance < ${FACADE_STEP_MASK_BAND_M.toFixed(1)} ) farStepMask = 0.0;
    // R22: the complete far window emission is desaturated at equal luminance, so the old warm /
    // cold chroma goes while every per-cell brightness term (zone, lit, resolve, dim) stays.
    vec3 farWindow = farPane * mix( farAverage, farLit * farGlass, farResolve ) * farStepMask * 1.6 * layerDim * EMISSIVE_GAIN;
    vec3 farBase0 = vec3( 0.004, 0.005, 0.007 );
    // Crown tips catch a little sky so stacked silhouettes separate against the haze band.
    farBase0 += vec3( 0.012, 0.016, 0.024 ) * layerDim * smoothstep( 0.5, 1.0, vWorldPos.y / 6500.0 ) * ( 1.0 - vIsSide );
    float farQ = quantizeMaterialSeed( vMaterial );
    float farFamily, farB, farW, farF, farEdge;
    vec3 farChroma;
    structureMaterialProfile( farQ, vFaceId, farFamily, farB, farW, farF, farEdge, farChroma );
    vec3 farBase1 = farBase0 * farChroma;
    vec3 farBase = normalizeMaterial( farBase0, farBase1, farB, farW, farF );
    vec3 farColor = farBase + skyriverDistrictTint( farWindow, vDistrict, DISTRICT_PANE_SATURATION );
    // R17: far layers grade further toward steel per layer (0.35 / 0.55 / 0.7 on top of distance).
    farColor = skyriverDistanceGrade( farColor, max( vFogDepth, 1.0 ), vLayer < 1.5 ? 0.35 : ( vLayer < 2.5 ? 0.55 : 0.7 ) );
    gl_FragColor = vec4( farColor, 1.0 );
${SKYRIVER_OUTPUT_APPLY_GLSL}
    #include <fog_fragment>
    return;
  }
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
  float paneStepMask = 1.0;
  float bottomStepClearance = vFaceHalf.y + cell.y * uCellHeight;
  float topStepClearance = vFaceHalf.y - ( cell.y + 1.0 ) * uCellHeight;
  if ( vIsSide > 0.5 && vStepEdges.x > 0.5 && bottomStepClearance < ${FACADE_STEP_MASK_BAND_M.toFixed(1)} ) paneStepMask = 0.0;
  if ( vIsSide > 0.5 && vStepEdges.y > 0.5 && topStepClearance < ${FACADE_STEP_MASK_BAND_M.toFixed(1)} ) paneStepMask = 0.0;
  // Per-face offset so opposite facades never mirror each other.
  vec2 faceOffset = vec2( vFaceId * 311.0 + vSeed * 613.0, vFaceId * 97.0 - vSeed * 271.0 );

  // --- R16 building culture ------------------------------------------------------------------------
  // One seeded identity per building (its slab, tiers, crowns and annexes share vBuilding), so
  // neighbours stop pattern-matching: a subtle glass colour (warm / cool / teal / amber) that also
  // leans the window-glow temperature, a luminance profile (even, dim, busy, spotty), and a family
  // of room archetypes. The far window average and the room fade-in both carry the tint, so the
  // transition compounds the identity instead of revealing one global room set.
  float culture = fract( vBuilding * 7.31 );
  vec3 glassTint = culture < 0.25 ? vec3( 1.0, 0.84, 0.66 )
    : ( culture < 0.5 ? vec3( 0.7, 0.83, 1.0 ) : ( culture < 0.75 ? vec3( 0.62, 1.0, 0.88 ) : vec3( 1.0, 0.72, 0.4 ) ) );
  float tempLean = culture < 0.25 ? 0.2 : ( culture < 0.5 ? 0.74 : ( culture < 0.75 ? 0.6 : 0.06 ) );
  vec3 cultureGlow = mix( vec3( 1.0 ), glassTint, 0.45 );
  float profile = floor( fract( vBuilding * 13.7 + 0.37 ) * 4.0 );
  float litScale = profile < 0.5 ? 1.0 : ( profile < 1.5 ? 0.5 : ( profile < 2.5 ? 1.5 : 0.85 ) );
  float brightScale = profile < 0.5 ? 1.0 : ( profile < 1.5 ? 0.7 : ( profile < 2.5 ? 1.0 : 1.35 ) );
  float blockGate = profile < 1.5 ? 0.52 : ( profile < 2.5 ? 0.42 : 0.7 );

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
  // R14 darkness pass: the sky fill is a trace, not a light (operator: too much ambient).
  float skyBounce = ( 0.08 + 0.42 * smoothstep( 0.1, 1.0, vUp ) ) * mix( 1.0, 0.6, vIsSide );
  concrete += uConcreteAmbient * skyBounce;
  // Roofs are gravel and plant decking: matte, so they take none of the facade's rib relief.
  concrete *= mix( 0.9, 1.0, vIsSide );
  // T6R-2 face shading: the overcast lights roofs and setback tops, the canyon-facing fronts of
  // tiers catch the haze glow, and the corridor faces sit darkest. Without this every face of a box
  // is the same value and stepped massing reads flat.
  // T7-3: from the object-space face id — boxes are now turned to the canyon heading, so world axes
  // no longer say which face looks down the canyon.
  float faceShade = vFaceId > 3.5 ? 1.0 : ( vFaceId > 2.5 ? 0.5 : ( vFaceId > 1.5 ? 0.62 : 0.3 ) );
  concrete *= mix( 0.45, 1.6, faceShade );

  // --- T7-3 strata -----------------------------------------------------------------------------
  // LOW GRIME (< ~600 m): warm brown, stained by vertical runs of soot, ledges and AC boxes;
  // MID CITY: as before; HIGH PRISTINE (> ~1800 m): clean, pale, cool, smooth mega-slab faces with
  // large panel joints.
  float grime = 1.0 - smoothstep( 420.0, 780.0, vWorldPos.y );
  float pristine = smoothstep( 1750.0, 2250.0, vWorldPos.y );
  float stain = skyValueNoise( vec2( vSurf.x * 0.11 + vSeed * 13.0, vSurf.y * 0.008 ) );
  float soot = skyValueNoise( vec2( vSurf.x * 0.4, vSurf.y * 0.05 ) + faceOffset * 0.02 );
  vec3 grimeTone = vec3( 0.62, 0.45, 0.31 ) * uConcreteLevel * 2.4 * ( 0.45 + 0.75 * stain ) * ( 0.7 + 0.5 * soot );
  float ledge = smoothstep( 0.86, 0.94, cellLocal.y ) * ( 1.0 - smoothstep( 0.97, 1.0, cellLocal.y ) );
  float acBox = step( 0.72, skyHash12( cell * vec2( 1.3, 0.7 ) + faceOffset ) )
    * step( 0.2, cellLocal.x ) * step( cellLocal.x, 0.55 ) * step( 0.55, cellLocal.y ) * step( cellLocal.y, 0.86 );
  grimeTone += vec3( 0.5, 0.4, 0.3 ) * uConcreteLevel * ( ledge * 1.6 + acBox * 1.2 ) * detail;
  // R16 ambient III: the grime floor drops (0.4 -> 0.28).
  concrete = mix( concrete, grimeTone * 0.28 + uConcreteAmbient * 0.15, grime * vIsSide );
  // R14: tiny linear values still land at 40-50/255 after ACES + sRGB; the base tones are the real
  // 'ambient', so they go near black and the emissives carry the frame.
  // R16: pristine glass/concrete a further ~30% down.
  vec3 cleanTone = vec3( 0.005, 0.0056, 0.0078 ) * ( 0.92 + 0.08 * grain ) + uConcreteAmbient * 0.15;
  float joint = max(
    1.0 - smoothstep( 0.0, 0.6, abs( fract( vSurf.x / 36.0 ) - 0.5 ) * 36.0 - 17.4 ),
    1.0 - smoothstep( 0.0, 0.6, abs( fract( vSurf.y / 48.0 ) - 0.5 ) * 48.0 - 23.4 )
  ) * fineDetail;
  cleanTone *= 1.0 - 0.35 * joint;
  concrete = mix( concrete, cleanTone * ( 0.55 + 0.45 * faceShade ), pristine * vIsSide );

  // R12: the structural bands are a darker, smoother concrete with a thin lit soffit line under each.
  float bandRow = mod( floor( vSurf.y / uCellHeight + vSeed * 37.0 ), 12.0 );
  concrete *= mix( 1.0, 0.55, step( bandRow, 1.4 ) * vIsSide );

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
  vec3 wetSheen = sheen * fresnel * ( 0.2 + 0.8 * wet ) * vIsSide * paneStepMask * ( 1.0 - 0.6 * smoothstep( 1750.0, 2250.0, vWorldPos.y ) ) * 0.45;

  // Wet arrises: a 1-2 px highlight on every box edge, so each mass separates from the one behind.
  vec2 edgeDistance = vFaceHalf - abs( vSurf );
  vec2 surfPerPixel = max( fwidth( vSurf ), vec2( 1e-4 ) );
  float edgePixels = min( edgeDistance.x / surfPerPixel.x, edgeDistance.y / surfPerPixel.y );
  float arrisLine = 1.0 - smoothstep( 0.5, 2.0, edgePixels );
  vec3 wetArris = mix( sheen, vec3( 0.55, 0.7, 0.85 ), 0.5 ) * arrisLine * ( 0.1 + 0.18 * faceShade ) * 0.3;

  // T7 mass: a contact shadow along the foot of every box (under terraces, crowns, seam blocks) —
  // the deep recesses that make stacked massing read as weight, not decals.
  float footHeight = vSurf.y + vFaceHalf.y;
  float legacyFoot = mix( ${SKYRIVER_CONTACT_AO.legacyMinimum.toFixed(2)}, 1.0,
    smoothstep( 0.0, ${SKYRIVER_CONTACT_AO.legacyHeightM.toFixed(1)}, footHeight ) );
  float tunedFoot = mix( ${SKYRIVER_CONTACT_AO.tunedMinimum.toFixed(2)}, 1.0,
    smoothstep( 0.0, ${SKYRIVER_CONTACT_AO.tunedHeightM.toFixed(1)}, footHeight ) );
  float contactFoot = mix( legacyFoot, tunedFoot, uContactAllowed );
  float topEdgeDistance = max( vFaceHalf.y - vSurf.y, 0.0 );
  float topEdge = 1.0 - ${SKYRIVER_CONTACT_AO.topEdgeDarken.toFixed(2)}
    * ( 1.0 - smoothstep( 0.0, ${SKYRIVER_CONTACT_AO.topEdgeWidthM.toFixed(1)}, topEdgeDistance ) ) * uContactAllowed;
  float contactAo = mix( 1.0, contactFoot * topEdge, vIsSide );

  // Combined non-emissive material: C0 reference, C1 proposed with family, edge, weather response
  vec3 matC0 = ( concrete + wetSheen + wetArris ) * contactAo;
  float q = quantizeMaterialSeed( vMaterial );
  float matFamily, matB, matW, matF, matEdge;
  vec3 matChroma;
  structureMaterialProfile( q, vFaceId, matFamily, matB, matW, matF, matEdge, matChroma );
  vec3 matC1 = ( concrete * matChroma + wetSheen * matChroma * ( 1.0 + 0.05 * matW ) + wetArris * matChroma * matEdge ) * contactAo;
  vec3 color = normalizeMaterial( matC0, matC1, matB, matW, matF );

  // R12: lit skylights and rooftop lamps on the deck's roofs.
  float deckRoof = ( 1.0 - smoothstep( 70.0, 140.0, vWorldPos.y ) ) * ( 1.0 - vIsSide );
  vec2 skyCell = floor( vSurf / 7.0 );
  float skylight = step( 0.82, skyHash12( skyCell + vSeed * 13.0 ) ) * ( 1.0 - smoothstep( 0.25, 0.42, length( fract( vSurf / 7.0 ) - 0.5 ) ) );
  // R22: a small background lamp — neutral at the same luminance, amber only in the dock.
  color += skyriverDistrictLamp( vec3( 1.0, 0.55, 0.2 ) * skylight * deckRoof * 1.4, vDistrict ) * contactAo;

  // Hero blade light: coloured spill on the concrete around each giant sign, and the windows behind
  // and beside it go dark so the sign owns its patch of wall.
  vec3 heroSpill = vec3( 0.0 );
  float heroShadow = 0.0;
  for ( int i = 0; i < HERO_MAX; i ++ ) {
    if ( i >= uHeroCount ) break;
    vec4 blade = uHeroBlades[ i ];
    vec3 nearest = vec3( blade.x, clamp( vWorldPos.y, blade.y - blade.w, blade.y + blade.w ), blade.z );
    float d = length( vWorldPos - nearest );
    heroSpill += uHeroColors[ i ] * exp( - d / 60.0 );
    heroShadow = max( heroShadow, exp( - d / 90.0 ) * uHeroWeight[ i ] );
  }
  color += heroSpill * 0.2 * contactAo;
  // T7 wet sheen: the rain-slick facade mirrors the nearest giant sign's colour at grazing angles.
  color += heroSpill / ( 1.0 + length( heroSpill ) ) * fresnel * 1.4 * vIsSide * contactAo;

  // Lit parapets on some crowns and terrace tops: a cold line along the top edge that silhouettes
  // the roofline against the haze once bloom catches it.
  float parapetLive = step( 0.6, skyHash11( vSeed * 97.0 + 3.0 ) ) * step( 700.0, vWorldPos.y );
  float parapet = 1.0 - smoothstep( 0.6, 2.2, vFaceHalf.y - vSurf.y );
  color += skyriverDistrictTint( vec3( 0.75, 0.9, 1.0 ) * parapet * parapetLive * vIsSide * 2.4 * EMISSIVE_GAIN,
    vDistrict, DISTRICT_TRIM_LARGE_SATURATION );

  // --- window grid ------------------------------------------------------------------------------
  // Coarse blocks gate whole stacks dark, so the lit windows stay sparse and clustered instead of
  // speckling evenly over every slab.
  float blockHash = skyHash12( floor( cellUv / vec2( 4.0, 7.0 ) ) + faceOffset * 0.37 );
  float blockLive = step( blockGate, blockHash );

  float sd = windowSdf( cellLocal, pristine );
  // R12: no glass in the structural bands (spandrel), computed again below for the lit gate.
  float bandFloor = mod( floor( vSurf.y / uCellHeight + vSeed * 37.0 ), 12.0 );
  sd = mix( sd, 1.0, step( bandFloor, 1.4 ) * vIsSide );
  float glass = ( 1.0 - smoothstep( -0.012, 0.012, sd ) ) * vIsSide * blockLive * paneStepMask;
  // Soft halo: the glow the wet haze smears around every lit pane.
  float halo = ( 1.0 - smoothstep( -0.02, 0.3, sd ) ) * vIsSide * blockLive * paneStepMask;

  float paneHash = skyHash12( cell + faceOffset );
  // Dark at street level, brightest through the mid-high floors, thinning again at the parapet.
  // T7-3 strata: the grime is crowded with small warm lit rooms (and carries city light down into
  // the void), the mid city is as before, the pristine heights are nearly dark glass.
  // R12 deck glow: below ~120 m (the service deck and the wall feet) the rooms crowd and burn warm.
  float deckZone = 1.0 - smoothstep( 70.0, 160.0, vWorldPos.y );
  // R16 ambient III: the deck and void glow thinned (0.24 -> 0.1, 0.06 -> 0.04): their far average
  // was the warm fill lifting the low half of the lap.
  float litShare = ( mix( 0.14, 0.1, smoothstep( 300.0, 900.0, vWorldPos.y ) ) * ( 1.0 - 0.8 * pristine ) + 0.1 * deckZone
    + 0.04 * ( 1.0 - smoothstep( -600.0, 0.0, vWorldPos.y ) ) ) * litScale;
  // T7-2 lit runs: a floor lights in runs of 3-9 panes (an office, a corridor) sharing one colour
  // temperature, with the odd dark pane inside a run. Per-pane hashing read as confetti noise.
  float runLength = 3.0 + floor( skyHash12( vec2( cell.y, faceOffset.x ) ) * 7.0 );
  float runId = floor( ( cell.x + floor( skyHash11( cell.y * 7.3 + faceOffset.y ) * 9.0 ) ) / runLength );
  float runHash = skyHash12( vec2( runId, cell.y ) + faceOffset * 1.31 );
  float lit = step( 1.0 - litShare * 1.15, runHash ) * step( 0.12, paneHash );

  // --- R12 tower shape hierarchy -----------------------------------------------------------------
  // Structural bands: every ~12 floors (per-tower phase) a floor-and-a-half of dark spandrel with
  // no windows. Between bands, each zone of a tower is either a lit zone or a dark-glass run, so a
  // tower reads as stacked shapes in depth rather than one even noise of windows. Mid-city lit
  // fraction drops to about half (the dark zones), the grime stays crowded.
  float floorIndex = floor( vSurf.y / uCellHeight + vSeed * 37.0 );
  float bandPhase = mod( floorIndex, 12.0 );
  float structuralBand = step( bandPhase, 1.4 ) * vIsSide;
  float zone = floor( floorIndex / 12.0 );
  // R16 ambient III: fewer crowded grime zones (0.35 -> 0.15): at play distance their fine grid of
  // lit rooms averaged into a warm grey floor over the whole low half of the lap.
  float zoneLit = step( 0.5 - 0.15 * grime, skyHash12( vec2( zone, vSeed * 71.0 + vFaceId ) ) );
  lit *= zoneLit * ( 1.0 - structuralBand ) * paneStepMask;

  // Colour temperature, per run: mostly warm interior light, some cold office pale, sparse neon.
  float tempHash = skyHash11( runHash * 311.7 + vSeed * 53.0 );
  // Grime rooms are sodium and warm; pristine panes are cold.
  tempHash = mix( mix( tempHash, tempHash * 0.45, grime ), 0.55 + 0.4 * tempHash, pristine );
  // R16: each building leans its window temperatures toward its culture.
  tempHash = mix( tempHash, tempLean, 0.4 );
  // T6R: a wider spread of colour temperatures, so lit panes read as rooms, not as one decal.
  // T7-5: saturated temperatures — near-white panes read as grey glare under ACES and bloom.
  vec3 sodium = vec3( 1.0, 0.42, 0.1 );
  vec3 warm = vec3( 1.0, 0.6, 0.24 );
  vec3 pale = vec3( 0.5, 0.68, 1.0 );
  vec3 cold = vec3( 0.25, 0.5, 1.0 );
  vec3 neonCyan = vec3( 0.22, 0.95, 1.0 );
  vec3 neonMagenta = vec3( 1.0, 0.24, 0.72 );
  vec3 paneColor = sodium;
  paneColor = mix( paneColor, warm, step( 0.18, tempHash ) );
  paneColor = mix( paneColor, pale, step( 0.48, tempHash ) );
  paneColor = mix( paneColor, cold, step( 0.7, tempHash ) );
  paneColor = mix( paneColor, neonCyan, step( 0.86, tempHash ) );
  paneColor = mix( paneColor, neonMagenta, step( 0.94, tempHash ) );
  paneColor *= cultureGlow;

  float brightness = ( 0.45 + 0.55 * skyHash11( runHash * 71.3 + 2.0 ) ) * ( 0.85 + 0.15 * paneHash ) * brightScale;
  // A handful of panes buzz. Cheap, and it stops the grid reading as a static decal.
  float buzzing = step( 0.965, skyHash11( paneHash * 17.7 + 9.0 ) );
  float buzz = 1.0 - buzzing * 0.55 * ( 0.5 + 0.5 * sin( uTime * 23.0 + paneHash * 120.0 ) );

  // R17 crown readability: on the landmark towers the top 60 m of every stage is a dark band (no
  // lit panes), so the crown rim's light separates cleanly from the facade texture below it.
  float crownGap = ( 1.0 - step( 0.02, distance( vTint, uMegaTint ) ) ) * ( 1.0 - smoothstep( 50.0, 64.0, vFaceHalf.y - vSurf.y ) ) * vIsSide;
  lit *= 1.0 - crownGap;
  float glassRaw = ( 1.0 - smoothstep( -0.012, 0.012, sd ) ) * paneStepMask;
  float interiorDepthMix = interiorDepthWeight( viewDepth, uInteriorFade );
  float roomHash = skyHash12( cell * vec2( 1.7, 2.3 ) + faceOffset * 0.71 );
  float dimShare = mix( ${SKYRIVER_INTERIOR_DIM_SHARE.mid.toFixed(2)}, ${SKYRIVER_INTERIOR_DIM_SHARE.grime.toFixed(2)}, grime );
  dimShare = mix( dimShare, ${SKYRIVER_INTERIOR_DIM_SHARE.pristine.toFixed(2)}, pristine );
  float dim = ( 1.0 - lit ) * step( 1.0 - dimShare, skyHash11( roomHash * 53.0 + 11.0 ) );
  float screen = step( 0.7, skyHash11( roomHash * 19.0 ) );
  float screenActive = screen * ( 1.0 - grime ) * ( 1.0 - pristine );

  vec3 d = normalize( vWorldPos - cameraPosition );
  float grazingFade = smoothstep( 0.1, 0.3, - dot( d, vNormalW ) );
  float S = clamp( uInteriorStrength * interiorDepthMix * grazingFade * vIsSide, 0.0, 1.0 );
  float furnitureDepthMix = interiorDepthWeight( viewDepth, vec2( 0.4 * uInteriorFade.x, uInteriorFade.x ) );
  float furniturePixelMix = smoothstep( 4.0, 10.0, cellPixels );
  float F = clamp( S * furnitureDepthMix * furniturePixelMix, 0.0, 1.0 );
  float fRatio = F / max( S, 1e-4 );

  float screenBlueRoom = interiorScreenBlueEnergy( interiorDepthMix, screenActive, dim, uInteriorStrength ) * vIsSide * paneStepMask;
  float screenBluePane = screenBlueRoom * glassRaw;
  vec3 resolved = paneColor * ( lit * brightness * buzz ) * ( glass + halo * 0.28 ) * ( 1.0 - heroShadow );
  resolved += interiorScreenMean( interiorPaneScreenInput( screenBluePane * ( 1.0 - heroShadow ) ) );

  // --- T7-4 interiors: within uInteriorFade of the camera, the glass shows a traced room. -----------
  if ( S > 0.001 && glassRaw > 0.001 ) {
    vec3 ray = vec3( dot( d, vTangentW ) / uCellWidth, d.y / uCellHeight, - dot( d, vNormalW ) / ROOM_DEPTH_M );
    // Strata pick the room set: grime 0-9, mid 10-21, pristine 22-31 (dithered at the borders).
    float bandPick = vWorldPos.y + ( skyHash11( roomHash * 91.0 ) - 0.5 ) * 160.0;
    // R16: each stratum's set includes the new archetypes (grime + noodle, laundry, workshop; mid +
    // server, karaoke, gym, grow; pristine + gallery, server), and each building draws from its own
    // family of 5 consecutive archetypes in that set.
    float setSize = bandPick < 600.0 ? 13.0 : ( bandPick > 1800.0 ? 12.0 : 16.0 );
    float k = mod( floor( vBuilding * 97.0 ) + floor( roomHash * 5.0 ), setSize );
    float room = bandPick < 600.0
      ? ( k < 10.0 ? k : ( k < 10.5 ? 33.0 : ( k < 11.5 ? 35.0 : 39.0 ) ) )
      : ( bandPick > 1800.0
        ? ( k < 10.0 ? 22.0 + k : ( k < 10.5 ? 38.0 : 32.0 ) )
        : ( k < 12.0 ? 10.0 + k : ( k < 14.5 ? 32.0 + 2.0 * ( k - 12.0 ) : 37.0 ) ) );
    float mirror = step( 0.5, skyHash11( roomHash * 37.0 + 3.0 ) );
    float depth01;
    vec3 roomColor = traceRoom( cellLocal, ray, room, mirror, fRatio, depth01 );
    // Existing lit runs stay intact. Non-screen dim lamps keep their pane tint.
    vec3 screenSource = interiorScreenSource( interiorDepthMix, sin( uTime * 7.0 + roomHash * 40.0 ) );
    vec3 dimLight = mix( paneColor * 0.55, screenSource, screenActive );
    // Pristine floors: only the thin cool ceiling light lines are on.
    dimLight = mix( dimLight, vec3( 0.55, 0.75, 1.0 ) * 0.08, pristine );
    // Exposure is set against the facade's 0.55 window scale below: lit rooms read as rooms, dim
    // rooms as lamp-lit silhouettes, dark rooms as shapes in the city's spill light.
    vec3 roomLight = paneColor * ( lit * blockLive * brightness * buzz * 7.0 ) + dimLight * dim * 5.5
      + vec3( ${SKYRIVER_INTERIOR_DARKROOM_SPILL[0].toFixed(2)}, ${SKYRIVER_INTERIOR_DARKROOM_SPILL[1].toFixed(2)}, ${SKYRIVER_INTERIOR_DARKROOM_SPILL[2].toFixed(2)} ) * glassTint * mix( 1.0, 0.25, pristine );
    // The glass colour sits over the whole room (the building's culture), not only its lamps.
    vec3 interior = roomColor * roomLight * glassTint;
    vec3 screenAtlas = roomColor * screenSource * ( screenActive * dim * 5.5 * ( 1.0 - pristine ) ) * glassTint;
    interior -= screenAtlas;
    vec3 matchedScreenMean = interiorScreenMean( interiorPaneScreenInput( screenBlueRoom ) );
    // Start at the pane mean, then reveal atlas detail as the room resolves.
    interior += mix( matchedScreenMean, screenAtlas, fRatio );
    // Keep grazing glass sheen low.
    interior += sheen * fresnel * ${SKYRIVER_INTERIOR_SHEEN_GAIN.toFixed(2)};
    vec3 resolvedInterior = ( interior * glassRaw + paneColor * ( lit * blockLive * brightness ) * halo * 0.1 ) * ( 1.0 - heroShadow );
    resolved = mix( resolved, resolvedInterior, S );
  }
  // R22: ONE equal-luminance recolour of the finished pane-and-room emission. Atlas colour, room
  // light, glass tint, screen light and the R19.7 fade are already inside resolved, so the old
  // sodium / cold / neon pane chroma is replaced by neutral light with a weak district tint without
  // touching occupancy, window runs, room detail, screen energy or any fade.
  resolved = skyriverDistrictTint( resolved, vDistrict, DISTRICT_PANE_SATURATION );
  // T7-5 pristine glass: the curtain wall reflects the cool night sky at grazing angles.
  // R14: a hint only — at 0.02-0.065 linear this sheet covered every high tower in 40-70/255 grey.
  color += vec3( 0.003, 0.006, 0.012 ) * glassRaw * pristine * ( 0.25 + 0.75 * fresnel ) * vIsSide * paneStepMask;
  // What the grid averages out to once it stops resolving: lit share times mean pane brightness,
  // in the mean pane colour. Distant walls read as a dim glow rather than a field of sparks.
  // R12: the far average keeps the zone and band structure, so distant towers read as shapes.
  vec3 averaged = vec3( 0.86, 0.72, 0.56 ) * cultureGlow * ( litShare * 0.3 * blockLive * vIsSide * zoneLit * ( 1.0 - structuralBand ) );
  // T7: dimmer panes — under bloom they compete with the signage otherwise.
  // T7-5 value range: emissives carry the frame — panes at 2x the T7 level.
  // Pristine heights stay calm: their panes run at a third of the mid-city level.
  // R14: the far-field window average (a uniform fill) is cut; resolved panes keep their punch.
  // R16 ambient III: the unresolved fill is cut again (0.55 -> 0.3; it is ambient, not a light) and
  // the resolved panes and rooms take the emissive gain of the exposure trade.
  averaged += interiorScreenMean( interiorAverageScreenInput( screenBluePane ) );
  // The same rule for the unresolved mean, so the room fade boundary does not cross a warm average.
  averaged = skyriverDistrictTint( averaged, vDistrict, DISTRICT_PANE_SATURATION );
  color += mix( averaged * ( 1.0 - heroShadow ) * ${SKYRIVER_INTERIOR_AVERAGE_GAIN.toFixed(2)}, resolved * EMISSIVE_GAIN, detail ) * 1.55 * ( 1.0 - 0.65 * pristine ) * paneStepMask;

  color = skyriverDistanceGrade( color, viewDepth, 0.0 );
  gl_FragColor = vec4( max( color, vec3( 0.0 ) ), 1.0 );

${SKYRIVER_OUTPUT_APPLY_GLSL}
  #include <fog_fragment>
  // R13 landmark wash, after the fog: the floodlit mega-tower stays a block of light through the haze.
  float megaMatch = 1.0 - step( 0.02, distance( vTint, uMegaTint ) );
  if ( megaMatch > 0.5 ) {
    float wash = 0.0;
    for ( int i = 0; i < 4; i ++ ) {
      vec4 m = uMegaWash[ i ];
      float dxz = length( vWorldPos.xz - m.xy );
      wash = max( wash, m.w * step( dxz, m.z * 1.5 ) );
    }
    // Floodlights on every ~300 m ledge throw light up the faces and decay with height (the classic
    // floodlit-landmark look); the faces keep their windows; the upper stages burn brightest.
    float band = fract( vWorldPos.y / 300.0 );
    // R15: the ledge is a hard dark->bright step; antialias it over the pixel footprint so distant
    // bands do not shimmer or crawl as the camera moves.
    float bandAA = max( fwidth( vWorldPos.y / 300.0 ), 1e-4 );
    float throwUp = exp( - band * 5.5 ) * smoothstep( 0.0, bandAA * 1.5, band ) + exp( - 5.5 ) * ( 1.0 - smoothstep( 0.0, bandAA * 1.5, band ) );
    float rise = smoothstep( 1400.0, 3400.0, vWorldPos.y );
    // R14: no flat base term (it read as a pale sheet at exposure 1.75); light only rises off ledges.
    float face = vIsSide * ( 0.02 + 0.3 * throwUp ) * ( 0.6 + 0.9 * rise );
    // Saturated cool cyan-blue: a coloured floodlight, so the landmark is colour as well as light.
    vec3 washColor = vec3( 0.12, 0.55, 1.0 ) * face + vec3( 0.5, 0.8, 1.0 ) * ( 1.0 - vIsSide ) * 0.5;
    #ifdef USE_FOG
      float through = pow( max( 1.0 - skyriverFogFactor(), 0.0 ), 0.3 );
    #else
      float through = 1.0;
    #endif
    // Close by, the wash eases off so the face keeps its windows instead of reading as a flat slab.
    float near = 0.35 + 0.65 * smoothstep( 250.0, 900.0, vFogDepth );
    // R22: the complete face-and-roof wash, recoloured at equal luminance. Its brightness curve and
    // its fog response are the pre-R22 terms.
    gl_FragColor.rgb += skyriverDistrictTint( washColor * wash * through * near * EMISSIVE_GAIN,
      vDistrict, DISTRICT_WASH_SATURATION );
  }
}
`;

// --- R16 far-city impostor cards ------------------------------------------------------------------
// Each far tower is a crossed pair of alpha-tested quads (from the card base up to the tower's top),
// sampling one baked silhouette of impostorAtlas.ts: the crown section at the top, then the body
// tile repeated down the card on a metric scale. Per-layer dim and haze grade the depth.

const IMPOSTOR_VERTEX = /* glsl */ `
attribute vec4 aCard;   // variant, layer, u flip, R22 colour district

varying vec2 vCardUv;
varying vec2 vCardSize; // width, height, metres
varying float vVariant;
varying float vCardLayer;
varying float vCardDistrict;

#include <fog_pars_vertex>

void main() {
  vec3 transformed = vec3( position );
  vCardUv = vec2( aCard.z > 0.5 ? 1.0 - uv.x : uv.x, uv.y );
  vCardSize = vec2( length( instanceMatrix[ 0 ].xyz ), length( instanceMatrix[ 1 ].xyz ) );
  vVariant = aCard.x;
  vCardLayer = aCard.y;
  vCardDistrict = aCard.w;
  vec4 mvPosition = modelViewMatrix * ( instanceMatrix * vec4( transformed, 1.0 ) );
  #include <fog_vertex>
  gl_Position = projectionMatrix * mvPosition;
}
`;

const IMPOSTOR_FRAGMENT = /* glsl */ `
uniform sampler2D uAtlas;
uniform vec3 uLayerDim;
uniform vec3 uLayerHaze;
uniform float uEmissive;

varying vec2 vCardUv;
varying vec2 vCardSize;
varying float vVariant;
varying float vCardLayer;
varying float vCardDistrict;

#include <fog_pars_fragment>
${SKYRIVER_OUTPUT_PARS_GLSL}
${SKYRIVER_STRUCTURE_MATERIAL_GLSL}
${SKYRIVER_DISTANCE_GRADE_GLSL}

#define CARD_COLUMNS ${IMPOSTOR_COLUMNS.toFixed(1)}
#define CARD_ROWS ${IMPOSTOR_ROWS.toFixed(1)}
#define CROWN_PX ${IMPOSTOR_CROWN_PX.toFixed(1)}
#define BODY_PX ${IMPOSTOR_BODY_PX.toFixed(1)}
#define CELL_H ${(IMPOSTOR_CROWN_PX + IMPOSTOR_BODY_PX).toFixed(1)}

void main() {
  // Metres down from the card's top, in card widths: the crown section first, then the body tile.
  float down = ( 1.0 - vCardUv.y ) * vCardSize.y / max( vCardSize.x, 1.0 );
  float crownW = CROWN_PX / ( CELL_H / 8.0 );
  float bodyW = BODY_PX / ( CELL_H / 8.0 );
  // Pixel row in the cell, continuous (for the mip gradient) and wrapped (for the lookup).
  float rowCont = down < crownW ? down / crownW * CROWN_PX : CROWN_PX + ( down - crownW ) / bodyW * BODY_PX;
  float row = down < crownW ? rowCont : CROWN_PX + mod( rowCont - CROWN_PX, BODY_PX );
  float variant = floor( vVariant );
  float cardQ = floor( fract( vVariant ) * 65536.0 );
  float column = mod( variant, CARD_COLUMNS );
  float cellRow = floor( variant / CARD_COLUMNS );
  vec2 uvCont = vec2( ( column + clamp( vCardUv.x, 0.01, 0.99 ) ) / CARD_COLUMNS, 1.0 - ( cellRow * CELL_H + rowCont ) / ( CELL_H * CARD_ROWS ) );
  vec2 uv = vec2( uvCont.x, 1.0 - ( cellRow * CELL_H + row ) / ( CELL_H * CARD_ROWS ) );
  // Gradients from the unwrapped coordinate: no smeared seam where the body tile repeats.
  vec4 card = textureGrad( uAtlas, uv, dFdx( uvCont ), dFdy( uvCont ) );
  if ( card.a < 0.5 ) discard;
  float dim = vCardLayer < 1.5 ? uLayerDim.x : ( vCardLayer < 2.5 ? uLayerDim.y : uLayerDim.z );
  float haze = vCardLayer < 1.5 ? uLayerHaze.x : ( vCardLayer < 2.5 ? uLayerHaze.y : uLayerHaze.z );
  // Windows a little under the R15 boxes' level: on a card every lit window resolves as a dot.
  // R22: the baked card carries the old warm / cold window chroma. Desaturating the sampled
  // emission at equal luminance keeps its silhouette, its sampled brightness and its alpha test.
  vec3 cardBase0 = vec3( 0.004, 0.005, 0.007 );
  float cardFamily, cardB, cardW, cardF, cardEdge;
  vec3 cardChroma;
  structureMaterialProfile( cardQ, 0.0, cardFamily, cardB, cardW, cardF, cardEdge, cardChroma );
  vec3 cardBase1 = cardBase0 * cardChroma;
  vec3 cardBase = normalizeMaterial( cardBase0, cardBase1, cardB, cardW, cardF );
  vec3 color = cardBase
    + skyriverDistrictTint( card.rgb * 1.1 * dim * uEmissive, vCardDistrict, DISTRICT_FAR_CARD_SATURATION );
  color = skyriverDistanceGrade( color, vFogDepth, vCardLayer < 2.5 ? 0.55 : 0.7 );
  gl_FragColor = vec4( color, 1.0 );
${SKYRIVER_OUTPUT_APPLY_GLSL}
  #include <fog_fragment>
  #ifdef USE_FOG
    // Deeper layers sink further into the haze than distance alone gives them. This uLayerHaze mix
    // is independent of the shared analytic fog, so R23's opaque bypass has to gate it as well —
    // otherwise a far card would still be hazed inside the stage that marches its absorption.
    gl_FragColor.rgb = mix( gl_FragColor.rgb, skyriverFogColor(), haze * skyriverFogBypassGate() );
  #endif
}
`;

/**
 * The far-card fragment source, exported so a node check can assert that R23's opaque analytic
 * bypass also gates this card's INDEPENDENT uLayerHaze mix. That term does not go through
 * `fog_fragment`, so bypassing the shared fog alone would leave far cards hazed inside the very
 * stage that marches their absorption.
 */
export const SKYRIVER_IMPOSTOR_FRAGMENT_SOURCE = IMPOSTOR_FRAGMENT;

/** Card base altitude, metres: below every wall foot the haze hides; cards run from here to the top. */
const IMPOSTOR_BASE_Y = -600;
/**
 * Far layers drawn as cards: this one and deeper. Layer 1, the nearest, stays box geometry — up close
 * its haze-lit faces separate it from the layers behind, which a flat card loses.
 */
const IMPOSTOR_MIN_LAYER = 2;

/** Two crossed unit quads (x in [-0.5, 0.5], y in [0, 1]): one along the canyon, one across it. */
function buildCardGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const position = new Float32Array([
    -0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0,
    0, 0, -0.5, 0, 0, 0.5, 0, 1, 0.5, 0, 1, -0.5,
  ]);
  const uv = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1]);
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return geometry;
}

// --- trim shader ----------------------------------------------------------------------------------

const TRIM_VERTEX = /* glsl */ `
attribute float aSeed;
attribute float aKind;
attribute vec3 aSize;
attribute float aDistrict; // R22 colour district, from this trim owner's canyon anchor

varying vec3 vTrimLocal;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying float vSeed;
varying float vKind;
varying vec3 vSizeM;
varying float vDistrict;

#include <fog_pars_vertex>

void main() {
  vec3 transformed = vec3( position );
  vTrimLocal = transformed;
  vSizeM = aSize;
  vSeed = aSeed;
  vKind = aKind;
  vDistrict = aDistrict;

  vec4 world = modelMatrix * instanceMatrix * vec4( transformed, 1.0 );
  vWorldPos = world.xyz;
  vNormalW = normalize( mat3( modelMatrix ) * ( mat3( instanceMatrix ) * normal ) );

  vec4 mvPosition = modelViewMatrix * ( instanceMatrix * vec4( transformed, 1.0 ) );
  #include <fog_vertex>
  gl_Position = projectionMatrix * mvPosition;
}
`;

const TRIM_FRAGMENT = /* glsl */ `
#define EMISSIVE_GAIN ${SKYRIVER_EMISSIVE_GAIN.toFixed(4)}
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
varying float vDistrict;

#include <fog_pars_fragment>
${SKYRIVER_OUTPUT_PARS_GLSL}
${SKYRIVER_HASH_GLSL}
${SKYRIVER_DISTRICT_COLOUR_GLSL}

void main() {
  vec3 viewDir = normalize( cameraPosition - vWorldPos );
  // Metres along the instance's longest axis: the run of a gantry or the rise of a mast.
  float longest = max( vSizeM.x, max( vSizeM.y, vSizeM.z ) );
  float run = vSizeM.y >= longest - 0.001
    ? ( vTrimLocal.y + 0.5 ) * vSizeM.y
    : ( vSizeM.z >= longest - 0.001 ? ( vTrimLocal.z + 0.5 ) * vSizeM.z : ( vTrimLocal.x + 0.5 ) * vSizeM.x );

  float grain = skyValueNoise( vec2( run * 0.25, vSeed * 40.0 ) );
  vec3 base = vec3( 0.26, 0.27, 0.29 ) * uConcreteLevel * ( 0.7 + 0.6 * grain );
  base += uConcreteAmbient * 0.2;

  float fresnel = pow( 1.0 - clamp( dot( vNormalW, viewDir ), 0.0, 1.0 ), 4.0 );
  base += uWetTint * fresnel * 0.2;

  vec3 color = base;

  // Gantry (1) and cantilever (5): a line of amber deck lights spaced every ~6 m down the run.
  float isGantry = ( step( 0.5, vKind ) * ( 1.0 - step( 1.5, vKind ) ) )
    + ( step( 4.5, vKind ) * ( 1.0 - step( 5.5, vKind ) ) );
  float lamp = 1.0 - smoothstep( 0.0, 0.12, abs( fract( run / 6.0 ) - 0.5 ) );
  float lampLive = step( 0.25, skyHash11( floor( run / 6.0 ) + vSeed * 83.0 ) );
  // R22 small lamp: neutral at the same luminance, amber only where the dock owns the light.
  color += skyriverDistrictLamp( vec3( 1.0, 0.68, 0.33 ) * ( isGantry * lamp * lampLive * 0.9 * EMISSIVE_GAIN ), vDistrict );

  // Antenna: a slow aircraft-warning beacon at the mast head.
  float isAntenna = 1.0 - step( 0.5, vKind );
  float head = smoothstep( 0.86, 1.0, vTrimLocal.y + 0.5 );
  float blink = 0.5 + 0.5 * sin( uTime * 1.9 + vSeed * 6.2831853 );
  color += vec3( 1.0, 0.16, 0.12 ) * ( isAntenna * head * blink * 1.5 * EMISSIVE_GAIN );

  // Rib (3): darker recess shading toward the facade, a lit arris on the outer edge.
  float isRib = step( 2.5, vKind ) * ( 1.0 - step( 3.5, vKind ) );
  color *= 1.0 - 0.35 * isRib * smoothstep( 0.2, -0.5, vTrimLocal.y );

  // Floor band (4): a strip of light along the soffit, in long hashed runs, warm or cold.
  float isBand = step( 3.5, vKind ) * ( 1.0 - step( 4.5, vKind ) );
  float soffit = step( vNormalW.y, -0.5 );
  float runLive = step( 0.35, skyHash11( floor( run / 22.0 ) + vSeed * 57.0 ) );
  vec3 bandLight = mix( vec3( 1.0, 0.72, 0.42 ), vec3( 0.55, 0.85, 1.0 ), step( ${skyriverGlslFloat(SKYRIVER_TRIM_BAND_COLD_SEED)}, vSeed ) );
  float edge = smoothstep( 0.5, 0.36, abs( vTrimLocal.y ) ) * ( 1.0 - soffit );
  // R22 large accent: the long soffit strips take the district hue at equal luminance.
  color += skyriverDistrictTint( bandLight * isBand * runLive * ( soffit * 0.55 + edge * 0.15 ) * EMISSIVE_GAIN,
    vDistrict, DISTRICT_TRIM_LARGE_SATURATION );

  // T7-4 balcony (7): a stained grime slab with a warm underlight here and there.
  float isBalcony = step( 6.5, vKind ) * ( 1.0 - step( 7.5, vKind ) );
  color = mix( color, vec3( 0.07, 0.05, 0.035 ) * ( 0.7 + 0.6 * grain ) + uConcreteAmbient * 0.15, isBalcony );
  float underLit = step( 0.72, skyHash11( floor( run / 7.0 ) + vSeed * 31.0 ) ) * step( vNormalW.y, -0.5 );
  color += skyriverDistrictLamp( vec3( 1.0, 0.62, 0.3 ) * underLit * isBalcony * 0.5 * EMISSIVE_GAIN, vDistrict );
  // Railing (8): vertical bars every ~0.4 m and a top rail, painted on the thin rail box.
  float isRailing = step( 7.5, vKind ) * ( 1.0 - step( 8.5, vKind ) );
  float bars = step( 0.62, fract( run / 0.42 ) );
  float topRail = smoothstep( 0.38, 0.46, vTrimLocal.y );
  color = mix( color, mix( vec3( 0.02, 0.018, 0.016 ), vec3( 0.16, 0.13, 0.1 ), max( bars, topRail ) ), isRailing );

  // R11 flood (9): emissive cool-white floodlight strip, pulsing slowly at the spire tip.
  float isFlood = step( 8.5, vKind );
  float tip = smoothstep( 0.85, 1.0, vTrimLocal.y + 0.5 ) * step( 100.0, vSizeM.y );
  // R22: the floodlight strip is a large district accent; its red spire-tip warning is a separate
  // term and is never recoloured.
  vec3 floodStrip = skyriverDistrictTint(
    vec3( 0.75, 0.85, 1.05 ) * ( 1.0 + 0.5 * step( 50.0, vSizeM.y ) ) * ( 0.85 + 0.15 * sin( uTime * 1.3 + vSeed * 6.28 ) ) * EMISSIVE_GAIN,
    vDistrict, DISTRICT_TRIM_LARGE_SATURATION );
  vec3 floodWarning = vec3( 3.0, 0.4, 0.3 ) * tip * ( 0.5 + 0.5 * sin( uTime * 2.0 ) ) * EMISSIVE_GAIN;
  color = mix( color, floodStrip + floodWarning, isFlood );

  // Skybridge (6): a dark mass with a ribbon of cold windows on each side and blue underlights.
  float isBridge = step( 5.5, vKind ) * ( 1.0 - step( 6.5, vKind ) );
  float sideFace = step( 0.5, abs( vNormalW.z ) );
  float ribbon = smoothstep( 0.12, 0.08, abs( vTrimLocal.y - 0.05 ) );
  float pane = step( 0.3, fract( run / 4.0 ) ) * step( 0.3, skyHash11( floor( run / 4.0 ) + vSeed * 19.0 ) );
  color = mix( color, color * 0.55, isBridge );
  color += skyriverDistrictTint( vec3( 0.72, 0.86, 1.0 ) * ( isBridge * sideFace * ribbon * pane * 1.1 * EMISSIVE_GAIN ),
    vDistrict, DISTRICT_TRIM_LARGE_SATURATION );
  float under = step( vNormalW.y, -0.5 ) * ( 1.0 - smoothstep( 0.0, 0.1, abs( fract( run / 12.0 ) - 0.5 ) ) );
  color += vec3( 0.3, 0.6, 1.0 ) * ( isBridge * under * 1.4 * EMISSIVE_GAIN );

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
attribute vec4 aAtlas;    // T7: lettered atlas cell (u0, v0, u1, v1); u1 <= u0 means procedural
attribute vec4 aDistrictTint; // R22: unit-luminance target hue (rgb) and its saturation (w)

varying vec2 vSignUv;     // 0..1 across the sign face; outside that range is the halo
varying vec4 vAtlas;
varying vec2 vLocal;      // metres from the sign centre
varying vec3 vSignColor;
varying float vSignKind;
varying float vSignSeed;
varying vec3 vSignNormal;
varying vec3 vWorldPos;
varying vec2 vSignSize;
varying float vMargin;
varying vec4 vDistrictTint;

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
  vAtlas = aAtlas;
  vDistrictTint = aDistrictTint;
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
#define EMISSIVE_GAIN ${SKYRIVER_EMISSIVE_GAIN.toFixed(4)}
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
varying vec4 vAtlas;
varying vec4 vDistrictTint;
uniform sampler2D uAtlas;

#include <fog_pars_fragment>
${SKYRIVER_OUTPUT_PARS_GLSL}
${SKYRIVER_HASH_GLSL}
${SKYRIVER_DISTRICT_COLOUR_GLSL}

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
  // T7: real lettering from the boot-drawn atlas (signAtlas.ts) replaces the hashed strokes. The
  // back face of a double-sided blade reads unmirrored, as a real two-faced sign does.
  if ( vAtlas.z > vAtlas.x ) {
    vec2 cell = clamp( uv, 0.0, 1.0 );
    if ( !gl_FrontFacing ) cell.x = 1.0 - cell.x;
    mask = texture2D( uAtlas, mix( vAtlas.xy, vAtlas.zw, cell ) ).r * inside;
  }

  // T7-2 halo: a radial (elliptical) falloff from the sign centre, faded to zero before the quad
  // edge — the T7 rectangle-distance spill read as glowing cards.
  vec2 q = vLocal / ( vSignSize * 0.5 + vMargin * 0.5 );
  vec2 edge = abs( vLocal ) / ( vSignSize * 0.5 + vMargin );
  float edgeFade = ( 1.0 - smoothstep( 0.7, 1.0, edge.x ) ) * ( 1.0 - smoothstep( 0.7, 1.0, edge.y ) );
  float halo = exp( - dot( q, q ) * 1.4 ) * edgeFade * ( 1.0 - inside * 0.5 );
  float plate = inside * 0.03;

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

  // Tube core: where the lettering saturates it runs white-hot, the glow around it keeps the hue.
  // T7-5: keep the tubes saturated — ACES and bloom already push the cores toward white.
  vec3 hot = mix( vSignColor * vSignColor * 1.2, vec3( 1.0 ), 0.06 * smoothstep( 0.8, 1.0, mask ) );
  // R13: a big sign near the camera covers a lot of screen; ease its core and halo with proximity so
  // bloom does not wash it to white (keeps the R12 saturation discipline at sign-wall scale).
  #ifdef USE_FOG
    float signNear = mix( 0.72, 1.0, smoothstep( 120.0, 600.0, vFogDepth ) );
  #else
    float signNear = 1.0;
  #endif
  vec3 color = ( hot * mask * angle * uIntensity + vSignColor * ( plate + halo * uHalo * 0.85 ) ) * signNear * EMISSIVE_GAIN;
  // R22: the district hue replaces the chroma of the COMPLETE emission at equal linear luminance.
  // Core, halo, plate, facing angle, proximity ease and intensity are all already inside color;
  // an aColor change alone could not hold the luminance, because the core squares RGB and the
  // white-hot blend adds a neutral term on top of it.
  color = skyriverDistrictEmission( color, vDistrictTint.rgb, vDistrictTint.w );
  gl_FragColor = vec4( color * flicker, 1.0 );

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #ifdef USE_FOG
    // Additive: the haze swallows distant signs rather than tinting them — but light carries further
    // than concrete, so the attenuation is a softened curve.
    gl_FragColor.rgb *= pow( max( 1.0 - skyriverFogFactor(), 0.0 ), uFogPenetration );
  #endif
}
`;

/**
 * The four city shader sources, exported so a node check can assert the R22 colour paths exist
 * without a GL context: which contributions are recoloured, which terms are deliberately left
 * alone (the red warnings, the blue skybridge underlight), and that no path tints a factor in
 * succession instead of recolouring the finished contribution once.
 */
export const SKYRIVER_CITY_SHADER_SOURCE = Object.freeze({
  towerVertex: TOWER_VERTEX,
  towerFragment: TOWER_FRAGMENT,
  trimVertex: TRIM_VERTEX,
  trimFragment: TRIM_FRAGMENT,
  signVertex: SIGN_VERTEX,
  signFragment: SIGN_FRAGMENT,
  impostorVertex: IMPOSTOR_VERTEX,
  impostorFragment: IMPOSTOR_FRAGMENT,
  districtColour: SKYRIVER_DISTRICT_COLOUR_GLSL,
  distanceGrade: SKYRIVER_DISTRICT_DISTANCE_GRADE_GLSL,
});

// --- city -----------------------------------------------------------------------------------------

export interface SkyriverCityOptions {
  readonly layout: SkyriverCityLayout;
  readonly quality: SkyriverQualitySettings;
  /** The scene's one R22 colour-switch flag. The city reads it and never writes it. */
  readonly colourSwitch: SkyriverDistrictColourSwitch;
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

// --- R22 district plumbing ------------------------------------------------------------------------

/** A sign's stable identity: its building, its face and its composition slot, not its draw index. */
function signIdentity(signs: SkyriverNeonSigns, index: number): string {
  return `${signs.buildingId[index] ?? '-'}|${signs.faceId[index] ?? '-'}|${signs.compositionId[index] ?? '-'}`;
}

function buildSignDistrictInput(signs: SkyriverNeonSigns): SkyriverDistrictSignInput {
  const areaM2 = new Float32Array(signs.count);
  const key: string[] = [];
  for (let i = 0; i < signs.count; i += 1) {
    areaM2[i] = signs.sw[i]! * signs.sh[i]!;
    key.push(signIdentity(signs, i));
  }
  // `signs.anchorV` is the float64 route position deriveNeonSigns classified the sign by, so the
  // quota, the masses and the trims all compare the same double against the same boundary.
  return {
    count: signs.count,
    heroCount: signs.heroCount,
    anchorV: signs.anchorV,
    colour: signs.color,
    areaM2,
    key,
  };
}

/**
 * T7-3 hero clearance: true when trim instance `i` would cross in front of a hero sign, so it is
 * not drawn (cycle-4 P1: strips occluding signage). Exported because the drawn trim set is what the
 * source palette and the light sources report, and a check must be able to reproduce it exactly.
 */
export function skyriverTrimBlocksHero(
  trims: SkyriverCityTrims,
  i: number,
  heroes: readonly SkyriverHeroBlade[],
): boolean {
  const k = trims.kind[i];
  if (k !== SKYRIVER_TRIM_BAND && k !== SKYRIVER_TRIM_RIB && k !== SKYRIVER_TRIM_CANTILEVER) return false;
  for (const hero of heroes) {
    const hx = hero.kind === 'blade' ? hero.width * 0.5 + 14 : 16;
    const hz = hero.kind === 'blade' ? 14 : hero.width * 0.5 + 14;
    if (Math.abs(trims.cx[i]! - hero.x) < hx + trims.sx[i]! * 0.5
      && Math.abs(trims.cy[i]! - hero.y) < hero.height * 0.5 + 18 + trims.sy[i]! * 0.5
      && Math.abs(trims.cz[i]! - hero.z) < hz + trims.sz[i]! * 0.5) return true;
  }
  return false;
}

/** The ids in SKYRIVER_DISTRICT_SOURCE_TERMS that a trim instance can emit. */
export type SkyriverTrimSourceTermId = 'trim-flood' | 'trim-skybridge-ribbon'
  | 'trim-band-warm' | 'trim-band-cold' | 'trim-deck-lamp' | 'trim-balcony-underlight';

/**
 * The source-colour term one trim instance emits, or null where the kind has no emissive source in
 * SKYRIVER_DISTRICT_SOURCE_TERMS (antenna beacons and the skybridge underlight are untouched by R22,
 * and ribs, railings and roof plant emit nothing).
 *
 * The floor band is the one kind with two source colours. `seed` selects between them exactly as the
 * trim fragment shader does, from the same SKYRIVER_TRIM_BAND_COLD_SEED threshold — so the palette,
 * the weights and the light sources report the colour the band actually emits.
 */
export function skyriverTrimSourceTermId(kind: number, seed: number): SkyriverTrimSourceTermId | null {
  switch (kind) {
    case SKYRIVER_TRIM_FLOOD:
      return 'trim-flood';
    case SKYRIVER_TRIM_SKYBRIDGE:
      return 'trim-skybridge-ribbon';
    case SKYRIVER_TRIM_BAND:
      return seed < SKYRIVER_TRIM_BAND_COLD_SEED ? 'trim-band-warm' : 'trim-band-cold';
    case SKYRIVER_TRIM_GANTRY:
    case SKYRIVER_TRIM_CANTILEVER:
      return 'trim-deck-lamp';
    case SKYRIVER_TRIM_BALCONY:
      return 'trim-balcony-underlight';
    default:
      return null;
  }
}

/** The large trim lights: the kinds `lightSources` reports as emitters a later round can light from. */
export function skyriverTrimIsLargeLight(kind: number): boolean {
  return kind === SKYRIVER_TRIM_FLOOD || kind === SKYRIVER_TRIM_SKYBRIDGE || kind === SKYRIVER_TRIM_BAND;
}

/** One group of drawn trim instances that emit the same source term in the same district. */
export interface SkyriverTrimSourceGroup {
  readonly termId: SkyriverTrimSourceTermId;
  readonly districtId: number;
  readonly count: number;
}

/**
 * Groups drawn trim instances by the source term they emit and the district they stand in. Pure and
 * GL-free over the drawn instance buffers, so a node check can assert the grouping `sourcePalette`
 * reports — including the floor band's warm/cold split — against the real trims of a seed.
 */
export function skyriverTrimSourceGroups(
  kind: ArrayLike<number>,
  seed: ArrayLike<number>,
  district: ArrayLike<number>,
): readonly SkyriverTrimSourceGroup[] {
  if (seed.length < kind.length || district.length < kind.length) {
    throw new Error('SKYRIVER_TRIM_SOURCE_GROUP_INPUT_SHORT');
  }
  const counts = new Map<string, { termId: SkyriverTrimSourceTermId; districtId: number; count: number }>();
  for (let i = 0; i < kind.length; i += 1) {
    const termId = skyriverTrimSourceTermId(kind[i]!, seed[i]!);
    if (termId === null) continue;
    const districtId = district[i]!;
    const key = `${districtId}:${termId}`;
    const entry = counts.get(key) ?? { termId, districtId, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return Object.freeze([...counts.values()]
    .map((entry) => Object.freeze(entry))
    .sort((a, b) => a.districtId - b.districtId || a.termId.localeCompare(b.termId)));
}

const DISTRICT_SOURCE_TERM_BY_ID = new Map(SKYRIVER_DISTRICT_SOURCE_TERMS.map((term) => [term.id, term]));

/** The source term a drawn instance claims. A miss is a broken invariant, never a skipped source. */
function districtSourceTerm(id: SkyriverTrimSourceTermId): (typeof SKYRIVER_DISTRICT_SOURCE_TERMS)[number] {
  const term = DISTRICT_SOURCE_TERM_BY_ID.get(id);
  if (term === undefined) throw new Error(`SKYRIVER_DISTRICT_SOURCE_TERM_MISSING:${id}`);
  return term;
}

/**
 * The uniform block every recoloured material carries. Fresh objects per material (three compares
 * uniform objects by identity), with the switch collected so one call flips all of them.
 */
function districtUniformBlock(model: SkyriverDistrictModel, allowed: boolean): {
  readonly uDistrictColour: { value: number };
  readonly uDistrictUnitHue: { value: THREE.Vector3[] };
  readonly uDistrictLampSaturation: { value: number[] };
} {
  const hues: THREE.Vector3[] = [];
  const lamps: number[] = [];
  for (let i = 0; i < SKYRIVER_DISTRICT_COUNT; i += 1) {
    const district = model.districts[i]!;
    const hue = SKYRIVER_DISTRICT_UNIT_HUE[district.primary];
    hues.push(new THREE.Vector3(hue[0], hue[1], hue[2]));
    // Only an amber district lights its small service lamps with its own hue.
    lamps.push(district.primary === 'amber'
      ? SKYRIVER_DISTRICT_SATURATION.dockLamp
      : SKYRIVER_DISTRICT_SATURATION.trimSmall);
  }
  return {
    uDistrictColour: { value: allowed ? 1 : 0 },
    uDistrictUnitHue: { value: hues },
    uDistrictLampSaturation: { value: lamps },
  };
}

/** FNV-1a over the float bit patterns of an instance buffer. Geometry identity, never colour. */
const identityScratch = new DataView(new ArrayBuffer(4));

function hashNumbers(state: number, values: ArrayLike<number>): number {
  let h = state >>> 0;
  for (let i = 0; i < values.length; i += 1) {
    identityScratch.setFloat32(0, values[i]!, true);
    const bits = identityScratch.getUint32(0, true);
    h = Math.imul(h ^ (bits & 0xff), 0x01000193) >>> 0;
    h = Math.imul(h ^ ((bits >>> 8) & 0xff), 0x01000193) >>> 0;
    h = Math.imul(h ^ ((bits >>> 16) & 0xff), 0x01000193) >>> 0;
    h = Math.imul(h ^ ((bits >>> 24) & 0xff), 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function hashText(state: number, values: readonly (string | null)[]): number {
  let h = state >>> 0;
  for (const value of values) {
    const text = value ?? '\u0000';
    for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
    h = Math.imul(h ^ 0x1f, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function hex32(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0');
}

/** Geometry, placement and text identity of one instanced pass. Colour treatment is excluded. */
export interface SkyriverGeometryIdentity {
  readonly towers: string;
  readonly towerAttributes: string;
  readonly trims: string;
  readonly trimAttributes: string;
  readonly signPlacement: string;
  readonly signText: string;
  readonly impostors: string;
  readonly impostorCards: string;
  readonly counts: { readonly towers: number; readonly trims: number; readonly signs: number; readonly impostors: number };
  readonly excludes: readonly string[];
}

/** Actual drawn source populations. No colour: the frame-identity hash reads this record. */
export interface SkyriverDistrictSourceCounts {
  readonly masses: number;
  readonly massesByDistrict: readonly number[];
  readonly trims: number;
  readonly trimsByKind: readonly number[];
  readonly trimsByDistrict: readonly number[];
  readonly ordinarySigns: number;
  readonly heroSigns: number;
  readonly signsByDistrict: readonly number[];
  readonly heroesByDistrict: readonly number[];
  readonly heroSpillSlots: number;
  readonly farCards: number;
  readonly farCardsByDistrict: readonly number[];
  readonly paneCells: number;
  readonly roomCells: number;
  readonly meaning: Readonly<Record<string, string>>;
}

export interface SkyriverDistrictRoleEvidence {
  readonly id: string;
  readonly role: string;
  readonly saturation: number;
  readonly samples: number;
  readonly oldFinalY: number;
  readonly newFinalY: number;
  readonly maxAbsoluteYDelta: number;
  readonly measurement: string;
}

export interface SkyriverDistrictSourceEvidence {
  readonly colourSpace: 'linear-rec709';
  readonly luminanceCoefficients: readonly [number, number, number];
  readonly declaredRelativeTolerance: number;
  readonly maxAbsoluteYDelta: number;
  readonly roles: readonly SkyriverDistrictRoleEvidence[];
  readonly signs: {
    readonly ordinary: number;
    readonly heroes: number;
    readonly byRole: Readonly<Record<string, number>>;
    readonly brightAccents: number;
    readonly brightAccentProxy: string;
  };
  readonly districts: readonly SkyriverDistrictSignCounts[];
  readonly distanceGrade: readonly {
    readonly depthM: number;
    readonly extra: number;
    readonly k: number;
    readonly brightnessFactor: number;
    readonly oldY: number;
    readonly newY: number;
    readonly absoluteDelta: number;
  }[];
  readonly untouched: readonly { readonly id: string; readonly role: string; readonly rgb: readonly number[] }[];
  readonly limits: readonly string[];
}

export interface SkyriverDistrictPaletteEntry {
  readonly id: string;
  readonly role: string;
  readonly district: string;
  readonly rgb: readonly [number, number, number];
  readonly weight: number;
}

export interface SkyriverDistrictPalette {
  readonly label: string;
  readonly colorSpace: 'linear';
  readonly weightMeaning: string;
  readonly limits: string;
  readonly entries: readonly SkyriverDistrictPaletteEntry[];
}

/** One emissive source a later round can light the air from. World space, as drawn. */
export interface SkyriverLightSource {
  readonly id: string;
  /**
   * A trim light's role is the source term it actually emits, so the floor band's warm and cold
   * sources are two roles rather than one averaged 'trim-band'.
   */
  readonly role: 'ordinary-sign' | 'hero-sign' | SkyriverTrimSourceTermId;
  readonly districtId: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly sizeM: readonly [number, number, number];
  /**
   * The source's own longest axis in world space, from the rigid frame its instance was drawn with.
   *
   * A sign's long axis lies in its warped facade plane (horizontal for a strip, vertical for a
   * banner); a trim's is the axis its shader measures `run` along. A later round approximating one
   * of these as a line light needs the drawn axis, not a derivation-space one.
   */
  readonly axis: readonly [number, number, number];
  /** Final linear emission with the district recolour applied, at the reference shader terms. */
  readonly emission: readonly [number, number, number];
  /** The same emission on the colour-off path. */
  readonly legacyEmission: readonly [number, number, number];
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
  /** R16: the far-city layers as impostor cards (one call). */
  readonly impostorMesh: THREE.InstancedMesh;

  private readonly towerMaterial: THREE.ShaderMaterial;
  private readonly impostorMaterial: THREE.ShaderMaterial;
  private readonly impostorAtlas: ImpostorAtlas;
  /** R16 A/B: far layers as cards ('impostor', default) or as R15's box masses ('geometry'). */
  private farMode: 'impostor' | 'geometry' = 'impostor';
  /** The interior mapping mode currently applied, for the diagnostic settings record. */
  private roomMode: SkyriverInteriorMode = 'full';
  private readonly trimMaterial: THREE.ShaderMaterial;
  private readonly signMaterial: THREE.ShaderMaterial;
  private readonly signGeometry: THREE.InstancedBufferGeometry;
  private readonly atlas: SignAtlas;
  private readonly interiorAtlas: InteriorAtlas;
  private readonly layout: SkyriverCityLayout;
  private readonly trims: SkyriverCityTrims;
  private readonly signs: SkyriverNeonSigns;
  /** R22: the permanent colour map, its sign quota, and the one A/B switch over both. */
  private readonly districts: SkyriverDistrictModel;
  private readonly signDistricts: SkyriverDistrictSignAssignment;
  private readonly districtSwitches: { value: number }[] = [];
  /** R22: the scene's colour flag, held once (see SkyriverDistrictColourSwitch). Read-only here. */
  private readonly colourSwitch: SkyriverDistrictColourSwitch;
  /** Hero source colours as drawn before R22, and after the equal-luminance district recolour. */
  private readonly heroDistrictColours: THREE.Color[] = [];
  private readonly heroDistrictIds: number[] = [];
  /** Actual drawn source populations, counted as the instance buffers are written. */
  private readonly drawnTrimsByKind = new Int32Array(SKYRIVER_TRIM_FLOOD + 1);
  private readonly drawnTrimsByDistrict = new Int32Array(SKYRIVER_DISTRICT_COUNT);
  private readonly drawnMassesByDistrict = new Int32Array(SKYRIVER_DISTRICT_COUNT);
  private readonly farCardsByDistrict = new Int32Array(SKYRIVER_DISTRICT_COUNT);
  /** Facade window cells on the drawn near-city masses: the pane and room source capacity. */
  private paneCellCapacity = 0;
  /** Drawn world centres, so a later round can light the air from the sources actually on screen. */
  private signWorldCentres = new Float32Array(0);
  /**
   * The drawn sign's warped facade normal (x, z per sign) and the drawn trim's world long axis.
   *
   * R23 lights the air from these sources, so it needs the same rigid frame the instance was
   * written with — a sign on a canyon bend must light where it is drawn, not where it was derived.
   */
  private signDrawnNormal = new Float32Array(0);
  private trimDrawnAxis = new Float32Array(0);
  private trimWorldCentres = new Float32Array(0);
  private trimDrawnKind = new Float32Array(0);
  private trimDrawnSize = new Float32Array(0);
  private trimDrawnDistrict = new Float32Array(0);
  /** The drawn instances' own seeds: the trim shader selects the band's warm or cold source with it. */
  private trimDrawnSeed = new Float32Array(0);

  constructor({ layout, colourSwitch }: SkyriverCityOptions) {
    installSkyriverFogChunks();
    this.layout = layout;
    this.colourSwitch = colourSwitch;
    this.trims = deriveCityTrims(layout);
    this.signs = deriveNeonSigns(layout);
    // R22: the colour map and the sign hue quota are derived from the finished geometry, so no
    // existing random stream moves and no sign changes place, size, kind or text seed.
    this.districts = deriveSkyriverDistrictModel(layout.seed);
    this.signDistricts = assignSkyriverSignDistricts(this.districts, buildSignDistrictInput(this.signs));
    this.atlas = createSignAtlas();
    this.interiorAtlas = createInteriorAtlas(layout.seed);
    this.group.name = 'skyriver.city';

    // T6R contrast: near-black concrete against the luminous haze (atmosphere.ts).
    // T6R-2: albedo crushed further toward black; the haze, signs and edges carry the read.
    // R16 ambient III: 0x020305 -> 0x010204.
    const concreteAmbient = new THREE.Color(0x010204);
    const wetTint = new THREE.Color(0x567ba3);

    // --- towers -----------------------------------------------------------------------------------
    // R13: landmark face-wash entries — bend 2 (the lap's second tight bend) is the showcase at full
    // strength; the others get a cheaper 55% wash.
    const megaWash: THREE.Vector4[] = [];
    const washWarp: WarpOut = { x: 0, z: 0, heading: 0 };
    const showcaseV = SKYRIVER_SHOWCASE_BEND_V;
    for (const anchor of megaAnchorCache.get(layout.seed) ?? []) {
      warpCanyon(anchor.x, anchor.v, washWarp);
      const isShowcase = Math.abs(anchor.v - showcaseV) < 1;
      megaWash.push(new THREE.Vector4(washWarp.x, washWarp.z, isShowcase ? SKYRIVER_SHOWCASE_BASE_M * 0.5 : 120, isShowcase ? 0.7 : 0.35));
    }
    while (megaWash.length < 4) megaWash.push(new THREE.Vector4(0, 0, 0, 0));
    // R12: all heroes are kept CPU-side in world space; each frame the 12 nearest to the camera are
    // uploaded, so the facade's spill loop stays at 12 however many heroes the lap carries.
    const heroBlades = deriveHeroBlades(layout);
    const heroWarp: WarpOut = { x: 0, z: 0, heading: 0 };
    const heroColor = new THREE.Color();
    const heroUniforms = {
      blades: heroBlades.map((b) => {
        const anchor = b.kind === 'brand' ? (megaAnchorCache.get(layout.seed) ?? []).find((m) => Math.abs(m.v - b.z) < 300) : undefined;
        if (anchor !== undefined) {
          warpCanyon(anchor.x, anchor.v, heroWarp);
          const dx = b.x - anchor.x;
          const dz = b.z - anchor.v;
          const sh = Math.sin(heroWarp.heading);
          const ch = Math.cos(heroWarp.heading);
          return new THREE.Vector4(heroWarp.x + dx * ch + dz * sh, b.y, heroWarp.z - dx * sh + dz * ch, b.height * 0.5);
        }
        warpRigid(b.x, b.z, b.owner.anchorV, heroWarp);
        return new THREE.Vector4(heroWarp.x, b.y, heroWarp.z, b.height * 0.5);
      }),
      colors: heroBlades.map((b) => heroColor.setHex(b.color, THREE.SRGBColorSpace).clone()),
      count: heroBlades.length,
    };
    this.heroWorld = heroUniforms.blades.map((b) => b.clone());
    this.heroWorldColors = heroUniforms.colors.map((c) => c.clone());
    // R22: every hero takes its district's primary hue at its own final luminance, so the blade and
    // the spill it throws down the facade keep exactly the brightness they had before.
    for (let i = 0; i < this.heroWorldColors.length; i += 1) {
      const district = skyriverDistrictAt(this.districts, heroBlades[i]!.z);
      const old = this.heroWorldColors[i]!;
      const tinted = skyriverRecolorPreservingY(
        [old.r, old.g, old.b],
        SKYRIVER_DISTRICT_UNIT_HUE[district.primary],
        SKYRIVER_DISTRICT_SATURATION.hero,
      );
      this.heroDistrictIds.push(district.id);
      this.heroDistrictColours.push(new THREE.Color(tinted[0], tinted[1], tinted[2]));
    }
    // Seed the uniform in the state the switch starts in, so even the first frame is consistent.
    if (this.colourSwitch.allowed) {
      for (let i = 0; i < heroUniforms.colors.length; i += 1) {
        heroUniforms.colors[i]!.copy(this.heroDistrictColours[i]!);
      }
    }
    heroUniforms.blades = heroUniforms.blades.slice(0, 12);
    heroUniforms.colors = heroUniforms.colors.slice(0, 12);
    heroUniforms.count = Math.min(12, heroUniforms.count);
    while (heroUniforms.blades.length < 12) {
      heroUniforms.blades.push(new THREE.Vector4(0, -1e5, 0, 0));
      heroUniforms.colors.push(new THREE.Color(0));
    }
    const towerGeometry = new THREE.BoxGeometry(1, 1, 1);
    const towerDistrict = districtUniformBlock(this.districts, this.colourSwitch.allowed);
    this.districtSwitches.push(towerDistrict.uDistrictColour);
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
        // R16 ambient III: 0.011 -> 0.008.
        uConcreteLevel: { value: 0.008 },
        uConcreteAmbient: { value: concreteAmbient },
        uWetTint: { value: wetTint },
        uContactAllowed: { value: 1 },
        uInterior: { value: this.interiorAtlas.texture },
        uInteriorFade: { value: new THREE.Vector2(SKYRIVER_INTERIOR_FADE.full[0], SKYRIVER_INTERIOR_FADE.full[1]) },
        uInteriorStrength: { value: 1 },
        uMegaWash: { value: megaWash },
        uMegaTint: { value: new THREE.Color().setHex(MEGA_TINT, THREE.SRGBColorSpace) },
        uHeroBlades: { value: heroUniforms.blades },
        uHeroColors: { value: heroUniforms.colors },
        uHeroCount: { value: heroUniforms.count },
        uHeroWeight: { value: new Array<number>(12).fill(1) },
        ...towerDistrict,
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
    // R23 draw role. Opaque: the near-city masses, depth-writing.
    skyriverDeclareStageRole(this.towerMesh, 'opaque');
    this.group.add(this.towerMesh);

    // --- trim -------------------------------------------------------------------------------------
    const trimGeometry = new THREE.BoxGeometry(1, 1, 1);
    const trimDistrict = districtUniformBlock(this.districts, this.colourSwitch.allowed);
    this.districtSwitches.push(trimDistrict.uDistrictColour);
    this.trimMaterial = new THREE.ShaderMaterial({
      name: 'skyriver.city.trim',
      vertexShader: TRIM_VERTEX,
      fragmentShader: TRIM_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uConcreteLevel: { value: 0.03 },
        uConcreteAmbient: { value: concreteAmbient },
        uWetTint: { value: wetTint },
        ...trimDistrict,
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
    // R23 draw role. Opaque: the structural kit and its emissive strips, depth-writing.
    skyriverDeclareStageRole(this.trimMesh, 'opaque');
    this.group.add(this.trimMesh);

    // --- neon signs -------------------------------------------------------------------------------
    const signDistrict = districtUniformBlock(this.districts, this.colourSwitch.allowed);
    this.districtSwitches.push(signDistrict.uDistrictColour);
    this.signMaterial = new THREE.ShaderMaterial({
      name: 'skyriver.city.signs',
      vertexShader: SIGN_VERTEX,
      fragmentShader: SIGN_FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        // R12: lower core intensity — at 1.8 the tubes burned through ACES+bloom to white.
        uIntensity: { value: 1.05 },
        uHalo: { value: 0.75 },
        uFogPenetration: { value: 0.55 },
        uAtlas: { value: this.atlas.texture },
        ...signDistrict,
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
    // R23 draw role. Transparent additive, depthWrite false, own-source analytic fog (penetration 0.55).
    skyriverDeclareStageRole(this.signMesh, 'transparent');
    this.group.add(this.signMesh);

    // --- R16 far-city impostor cards --------------------------------------------------------------
    this.impostorAtlas = createImpostorAtlas();
    const impostorDistrict = districtUniformBlock(this.districts, this.colourSwitch.allowed);
    this.districtSwitches.push(impostorDistrict.uDistrictColour);
    this.impostorMaterial = new THREE.ShaderMaterial({
      name: 'skyriver.city.impostors',
      vertexShader: IMPOSTOR_VERTEX,
      fragmentShader: IMPOSTOR_FRAGMENT,
      uniforms: {
        uAtlas: { value: this.impostorAtlas.texture },
        // The R15 per-layer dims, plus extra haze for the deeper two.
        uLayerDim: { value: new THREE.Vector3(0.6, 0.34, 0.18) },
        uLayerHaze: { value: new THREE.Vector3(0.0, 0.12, 0.25) },
        uEmissive: { value: SKYRIVER_EMISSIVE_GAIN },
        ...impostorDistrict,
        ...skyriverFogUniforms(),
      },
      side: THREE.DoubleSide,
      fog: true,
    });
    const far = deriveFarTowers(layout).filter((f) => f.layer >= IMPOSTOR_MIN_LAYER);
    this.impostorMesh = new THREE.InstancedMesh(buildCardGeometry(), this.impostorMaterial, Math.max(far.length, 1));
    this.impostorMesh.name = 'skyriver.city.impostors';
    this.writeImpostors(far);
    this.impostorMesh.frustumCulled = false;
    // R23 draw role. Opaque despite DoubleSide and the atlas alpha discard: it depth-writes.
    skyriverDeclareStageRole(this.impostorMesh, 'opaque');
    this.group.add(this.impostorMesh);

    applySkyriverFog(this.towerMaterial);
    applySkyriverFog(this.trimMaterial);
    applySkyriverFog(this.signMaterial);
    applySkyriverFog(this.impostorMaterial);

    // R22: the materials above were built in the switch's current state, so only a change applies.
    colourSwitch.onChange((allowed) => this.applyDistrictColour(allowed));
  }

  /**
   * R16 A/B (and the geometry-vs-impostor cost measurement): draw the far layers as cards (default)
   * or as R15's box masses in the tower batch.
   */
  setFarMode(mode: 'impostor' | 'geometry'): void {
    if (mode === this.farMode) return;
    this.farMode = mode;
    this.impostorMesh.visible = mode === 'impostor';
    this.writeTowers();
  }

  /**
   * Vertical pixels per metre at one metre of view depth: `drawingBufferHeight / (2 * tan(fov/2))`.
   * The tower shader needs it to know when the window grid is too small on screen to resolve.
   * The scene calls this on every resize and on any field-of-view change.
   */
  setProjectionScale(pixelsPerMetreAtUnitDepth: number): void {
    this.towerMaterial.uniforms.uProjScale.value = pixelsPerMetreAtUnitDepth;
  }

  /**
   * T7-4 interior mapping tier: 'full' traces rooms out to ~750 m, 'near' only close by (medium
   * tier), 'off' keeps the emissive window term (low tier, perf-safe fallback).
   */
  setInteriorMode(mode: SkyriverInteriorMode): void {
    this.roomMode = mode;
    const u = this.towerMaterial.uniforms;
    u.uInteriorStrength!.value = mode === 'off' ? 0 : 1;
    const fade = mode === 'near' ? SKYRIVER_INTERIOR_FADE.near : SKYRIVER_INTERIOR_FADE.full;
    (u.uInteriorFade!.value as THREE.Vector2).set(fade[0], fade[1]);
  }

  setContactAllowed(allowed: boolean): void {
    this.towerMaterial.uniforms.uContactAllowed!.value = allowed ? 1 : 0;
  }

  /** The fade window currently in use, metres (for the debug stats). */
  interiorFade(): { readonly strength: number; readonly start: number; readonly end: number } {
    const u = this.towerMaterial.uniforms;
    const fade = u.uInteriorFade!.value as THREE.Vector2;
    return { strength: u.uInteriorStrength!.value as number, start: fade.x, end: fade.y };
  }

  /** The interior mapping mode and the far-city mode actually applied, for the settings record. */
  currentRoomMode(): SkyriverInteriorMode {
    return this.roomMode;
  }

  currentFarMode(): 'impostor' | 'geometry' {
    return this.farMode;
  }

  // --- R22 districts ------------------------------------------------------------------------------

  /** The permanent colour map this city was built against. */
  districtModel(): SkyriverDistrictModel {
    return this.districts;
  }

  /** The one authoritative query, over a canyon route position in metres. */
  districtAt(v: number): SkyriverDistrict {
    return skyriverDistrictAt(this.districts, v);
  }

  get districtColourAllowed(): boolean {
    return this.colourSwitch.allowed;
  }

  /**
   * Applies the R22 colour A/B state: synchronous, presentation only, idempotent.
   *
   * Registered on the scene's `SkyriverDistrictColourSwitch` — the city never decides the state, so
   * the frame and `renderSettings` always report the one flag. It writes one uniform per recoloured
   * material and selects the hero colour set the next update uploads. It touches no instance buffer,
   * no geometry, no sign placement, no random stream and no simulation state, so the next
   * `scene.update` at the same tick and the same alpha draws the same frame with only the colour
   * treatment changed.
   */
  private applyDistrictColour(allowed: boolean): void {
    const value = allowed ? 1 : 0;
    for (const uniform of this.districtSwitches) uniform.value = value;
    // The hero spill uniform is written per frame from the selected colour set; refresh it now so
    // the switch is complete even if nothing calls update() before the next read.
    const colors = this.towerMaterial.uniforms.uHeroColors!.value as THREE.Color[];
    const weights = this.towerMaterial.uniforms.uHeroWeight!.value as number[];
    const source = allowed ? this.heroDistrictColours : this.heroWorldColors;
    const count = this.towerMaterial.uniforms.uHeroCount!.value as number;
    for (let k = 0; k < count && k < this.heroOrder.length; k += 1) {
      const index = this.heroOrder[k]!;
      const colour = source[index];
      // heroOrder indexes the same hero arrays this colour set was built from, so a miss means the
      // switch would leave the previous colour set bound on that slot: an internal invariant broke.
      if (colour === undefined) throw new Error(`SKYRIVER_HERO_COLOUR_INDEX:${index}`);
      colors[k]!.copy(colour).multiplyScalar(weights[k] ?? 1);
    }
  }

  /**
   * The bound scalar and vector uniform values of the four city materials.
   *
   * The R22 colour switch and the district hues are deliberately absent: this record goes into the
   * frame-identity hash of the A/B pair, so it must be byte-identical in both switch states. The
   * emitted colours live in sourceEvidence and the haze tint in hazeEvidence.
   */
  renderUniforms(): Readonly<Record<string, number | readonly number[]>> {
    const tower = this.towerMaterial.uniforms;
    const sign = this.signMaterial.uniforms;
    const trim = this.trimMaterial.uniforms;
    const impostor = this.impostorMaterial.uniforms;
    const fade = tower.uInteriorFade!.value as THREE.Vector2;
    const layerDim = impostor.uLayerDim!.value as THREE.Vector3;
    const layerHaze = impostor.uLayerHaze!.value as THREE.Vector3;
    return Object.freeze({
      towerCellWidth: tower.uCellWidth!.value as number,
      towerCellHeight: tower.uCellHeight!.value as number,
      towerRibSpacing: tower.uRibSpacing!.value as number,
      towerProjScale: tower.uProjScale!.value as number,
      towerConcreteLevel: tower.uConcreteLevel!.value as number,
      towerContactAllowed: tower.uContactAllowed!.value as number,
      towerInteriorStrength: tower.uInteriorStrength!.value as number,
      towerInteriorFade: Object.freeze([fade.x, fade.y]),
      towerHeroCount: tower.uHeroCount!.value as number,
      signIntensity: sign.uIntensity!.value as number,
      signHalo: sign.uHalo!.value as number,
      signFogPenetration: sign.uFogPenetration!.value as number,
      trimConcreteLevel: trim.uConcreteLevel!.value as number,
      impostorEmissive: impostor.uEmissive!.value as number,
      impostorLayerDim: Object.freeze([layerDim.x, layerDim.y, layerDim.z]),
      impostorLayerHaze: Object.freeze([layerHaze.x, layerHaze.y, layerHaze.z]),
    });
  }

  /** Actual drawn source populations, counted while the instance buffers were written. */
  sourceCounts(): SkyriverDistrictSourceCounts {
    const signsByDistrict = this.signDistricts.counts.map((entry) => entry.ordinary + entry.heroes);
    return {
      masses: this.towerMesh.count,
      massesByDistrict: Array.from(this.drawnMassesByDistrict),
      trims: this.trimMesh.count,
      trimsByKind: Array.from(this.drawnTrimsByKind),
      trimsByDistrict: Array.from(this.drawnTrimsByDistrict),
      ordinarySigns: this.signs.ordinaryCount,
      heroSigns: this.signs.heroCount,
      signsByDistrict,
      heroesByDistrict: this.districts.districts.map((district) =>
        this.heroDistrictIds.reduce((total, id) => total + (id === district.id ? 1 : 0), 0)),
      heroSpillSlots: (this.towerMaterial.uniforms.uHeroBlades!.value as THREE.Vector4[]).length,
      farCards: this.impostorMesh.count,
      farCardsByDistrict: Array.from(this.farCardsByDistrict),
      paneCells: this.paneCellCapacity,
      roomCells: this.paneCellCapacity,
      meaning: Object.freeze({
        masses: 'Drawn tower-batch instances (slabs, tiers, crowns, seam blocks and the far boxes still drawn as geometry).',
        trims: 'Drawn trim instances after the hero-sign clearance pass.',
        signs: 'Sign instances in the one neon draw. Heroes occupy the first heroSigns slots.',
        paneCells: 'Facade window cells on the near-city masses, from side area / (7.2 m x 5.4 m). Panes and rooms are procedural per cell, so this is their source capacity, not a per-instance population.',
        roomCells: 'The same cells: a room is the traced interior of one pane cell inside the R19.7 fade window.',
        farCards: 'R16 impostor card instances in the far-city draw.',
      }),
    };
  }

  /**
   * Old and new FINAL emitted luminance per source role, the sign quota, and the distance grade.
   *
   * Signs and heroes are measured over every real instance, through the CPU twin of the complete
   * sign emission (core, white-hot blend, halo, plate, angle, intensity, proximity ease and the
   * emissive gain). The procedural roles are measured on the actual shader source vectors: the
   * recolour is applied to the finished contribution, so every scalar term in front of it
   * multiplies the old and the new value identically and the comparison holds for all of them.
   */
  sourceEvidence(): SkyriverDistrictSourceEvidence {
    const roles: SkyriverDistrictRoleEvidence[] = [];
    let worst = 0;
    const measureSigns = (
      id: string,
      role: string,
      from: number,
      to: number,
    ): void => {
      let oldSum = 0;
      let newSum = 0;
      let maxDelta = 0;
      let saturation = 0;
      for (let i = from; i < to; i += 1) {
        const source: SkyriverLinearRgb = [
          this.signs.color[i * 3]!, this.signs.color[i * 3 + 1]!, this.signs.color[i * 3 + 2]!,
        ];
        const hue: SkyriverLinearRgb = [
          this.signDistricts.unitHue[i * 3]!,
          this.signDistricts.unitHue[i * 3 + 1]!,
          this.signDistricts.unitHue[i * 3 + 2]!,
        ];
        const sat = this.signDistricts.saturation[i]!;
        const oldFinal = skyriverSignFinalEmission(source);
        const newFinal = skyriverDistrictSignEmission(source, hue, sat);
        const oldY = skyriverLinearY(oldFinal);
        const newY = skyriverLinearY(newFinal);
        oldSum += oldY;
        newSum += newY;
        maxDelta = Math.max(maxDelta, Math.abs(oldY - newY));
        saturation += sat;
      }
      const samples = Math.max(0, to - from);
      worst = Math.max(worst, maxDelta);
      roles.push({
        id,
        role,
        saturation: samples === 0 ? 0 : saturation / samples,
        samples,
        oldFinalY: oldSum,
        newFinalY: newSum,
        maxAbsoluteYDelta: maxDelta,
        measurement: 'Summed final linear Y over every real instance, through the CPU twin of the complete sign emission at SKYRIVER_SIGN_EMISSION_REFERENCE. Saturation is the mean target saturation, not a measured value.',
      });
    };
    measureSigns('hero-signs', 'hero sign face', 0, this.signs.heroCount);
    measureSigns('ordinary-signs', 'ordinary sign face', this.signs.heroCount, this.signs.count);

    let heroSpillOld = 0;
    let heroSpillNew = 0;
    let heroSpillDelta = 0;
    for (let i = 0; i < this.heroWorldColors.length; i += 1) {
      const oldY = skyriverLinearY([
        this.heroWorldColors[i]!.r, this.heroWorldColors[i]!.g, this.heroWorldColors[i]!.b,
      ]);
      const newY = skyriverLinearY([
        this.heroDistrictColours[i]!.r, this.heroDistrictColours[i]!.g, this.heroDistrictColours[i]!.b,
      ]);
      heroSpillOld += oldY;
      heroSpillNew += newY;
      heroSpillDelta = Math.max(heroSpillDelta, Math.abs(oldY - newY));
    }
    worst = Math.max(worst, heroSpillDelta);
    roles.push({
      id: 'hero-spill',
      role: 'hero facade spill source colour',
      saturation: SKYRIVER_DISTRICT_SATURATION.hero,
      samples: this.heroWorldColors.length,
      oldFinalY: heroSpillOld,
      newFinalY: heroSpillNew,
      maxAbsoluteYDelta: heroSpillDelta,
      measurement: 'Summed linear Y of the uHeroColors source colour over every hero. The shader multiplies it by a scalar distance falloff and a scalar weight, so the spill carries this luminance ratio exactly.',
    });

    for (const term of SKYRIVER_DISTRICT_SOURCE_TERMS) {
      // The district hue a term meets depends on where it is drawn; the delta does not. The reported
      // newFinalY is the one district that produced maxAbsoluteYDelta — the worst case, not the last
      // district visited, and not a sum over the five.
      const termOldY = skyriverLinearY(term.rgb);
      let maxDelta = 0;
      let worstNewY = termOldY;
      for (const district of this.districts.districts) {
        const tinted = skyriverRecolorPreservingY(
          term.rgb,
          SKYRIVER_DISTRICT_UNIT_HUE[district.primary],
          term.saturation,
        );
        const y = skyriverLinearY(tinted);
        const delta = Math.abs(y - termOldY);
        if (delta > maxDelta) {
          maxDelta = delta;
          worstNewY = y;
        }
      }
      worst = Math.max(worst, maxDelta);
      roles.push({
        id: term.id,
        role: term.role,
        saturation: term.saturation,
        samples: this.districts.districts.length,
        oldFinalY: termOldY,
        newFinalY: worstNewY,
        maxAbsoluteYDelta: maxDelta,
        measurement: 'Actual shader source vector, recoloured over all five district hues. oldFinalY is the one source luminance; newFinalY is the worst case of the five recoloured values, the one that produced maxAbsoluteYDelta. Neither is a sum. The recolour is applied to the finished contribution, so the scalar terms in front of it cancel in the comparison.',
      });
    }

    const distanceGrade: SkyriverDistrictSourceEvidence['distanceGrade'][number][] = [];
    const probes: SkyriverLinearRgb[] = [
      skyriverHexToLinear(0x2ff2ff), skyriverHexToLinear(0xff2fb4), skyriverHexToLinear(0xffb13c),
      [0.004, 0.005, 0.007], [1, 0.42, 0.1], [0, 0, 0],
    ];
    for (const [depthM, extra] of [[900, 0], [1500, 0], [2500, 0], [5000, 0], [2500, 0.35], [2500, 0.55], [2500, 0.7]] as const) {
      const k = skyriverDistanceGradeK(depthM, extra);
      let oldY = 0;
      let newY = 0;
      let delta = 0;
      for (const probe of probes) {
        const before = skyriverLinearY(skyriverLegacyDistanceGrade(probe, k));
        const after = skyriverLinearY(skyriverDistrictDistanceGrade(probe, k));
        oldY += before;
        newY += after;
        delta = Math.max(delta, Math.abs(before - after));
      }
      worst = Math.max(worst, delta);
      distanceGrade.push({
        depthM, extra, k,
        brightnessFactor: skyriverDistanceGradeBrightness(k),
        oldY, newY, absoluteDelta: delta,
      });
    }

    const byRole: Record<string, number> = {};
    for (const role of this.signDistricts.role) byRole[role] = (byRole[role] ?? 0) + 1;

    return {
      colourSpace: 'linear-rec709',
      luminanceCoefficients: [SKYRIVER_LUMA[0], SKYRIVER_LUMA[1], SKYRIVER_LUMA[2]],
      declaredRelativeTolerance: 1e-5,
      maxAbsoluteYDelta: worst,
      roles,
      signs: {
        ordinary: this.signs.ordinaryCount,
        heroes: this.signs.heroCount,
        byRole,
        brightAccents: this.signDistricts.brightAccents,
        brightAccentProxy: this.signDistricts.brightAccentProxy,
      },
      districts: this.signDistricts.counts,
      distanceGrade,
      untouched: SKYRIVER_DISTRICT_UNTOUCHED_TERMS.map((term) => ({ id: term.id, role: term.role, rgb: [...term.rgb] })),
      limits: Object.freeze([
        'These are source and CPU-twin values. They are not rendered pixel measurements, and a source weight is not image energy.',
        'Pane, room, trim, wash and far-card roles are procedural per pixel; their evidence is the actual shader source vector, not a per-instance population.',
        'The sign and hero figures use SKYRIVER_SIGN_EMISSION_REFERENCE. Per-pixel mask, flicker, facing and fog vary across the frame and are scalar, so they scale old and new identically.',
        'Deltas are computed in double precision. The GPU evaluates the same expression in float32, hence the declared relative tolerance.',
      ]),
    };
  }

  /**
   * The actual emitted source palette, grouped by the hue each drawn source group now carries.
   *
   * Each entry's RGB is the group's mean emitted source colour normalised to a peak channel of 1,
   * and its weight is the instance count times that peak — so (source linear Y x weight) is exactly
   * the group's total source luminance, and the hue stays inside [0, 1] where a display-space hue
   * classification is defined. HDR source colours are therefore reported as direction plus weight,
   * never clipped.
   */
  sourcePalette(): SkyriverDistrictPalette {
    const groups = new Map<string, { sum: [number, number, number]; count: number; role: string; district: string }>();
    /** Colour-pure groups: two sources only share an entry when they emit the same hue. */
    const hueSignature = (rgb: SkyriverLinearRgb): string => {
      const peak = Math.max(rgb[0], rgb[1], rgb[2]);
      if (!(peak > 0)) return 'black';
      return rgb.map((channel) => (channel / peak).toFixed(3)).join('/');
    };
    const push = (group: string, role: string, district: string, rgb: SkyriverLinearRgb, instances = 1): void => {
      const key = `${group}:${hueSignature(rgb)}`;
      const entry = groups.get(key) ?? { sum: [0, 0, 0] as [number, number, number], count: 0, role, district };
      entry.sum[0] += rgb[0] * instances;
      entry.sum[1] += rgb[1] * instances;
      entry.sum[2] += rgb[2] * instances;
      entry.count += instances;
      groups.set(key, entry);
    };
    for (let i = 0; i < this.signs.count; i += 1) {
      const district = this.districts.districts[this.signDistricts.district[i]!]!;
      const role = this.signDistricts.role[i]!;
      const source: SkyriverLinearRgb = [
        this.signs.color[i * 3]!, this.signs.color[i * 3 + 1]!, this.signs.color[i * 3 + 2]!,
      ];
      const hue: SkyriverLinearRgb = [
        this.signDistricts.unitHue[i * 3]!,
        this.signDistricts.unitHue[i * 3 + 1]!,
        this.signDistricts.unitHue[i * 3 + 2]!,
      ];
      const emitted = this.colourSwitch.allowed
        ? skyriverRecolorPreservingY(source, hue, this.signDistricts.saturation[i]!)
        : source;
      push(`${district.name}:${role}-sign`, `${role} sign face`, district.name, emitted);
    }
    // Every instance of one term in one district emits the same colour, so the groups carry their
    // own instance counts. The floor band's warm and cold sources are two terms here, split by the
    // same seed threshold the trim shader uses.
    for (const group of skyriverTrimSourceGroups(this.trimDrawnKind, this.trimDrawnSeed, this.trimDrawnDistrict)) {
      const term = districtSourceTerm(group.termId);
      const district = this.districts.districts[group.districtId]!;
      const saturation = term.saturation === SKYRIVER_DISTRICT_SATURATION.trimSmall && district.primary === 'amber'
        ? SKYRIVER_DISTRICT_SATURATION.dockLamp
        : term.saturation;
      const emitted = this.colourSwitch.allowed
        ? skyriverRecolorPreservingY(term.rgb, SKYRIVER_DISTRICT_UNIT_HUE[district.primary], saturation)
        : term.rgb;
      push(`${district.name}:${group.termId}`, `${term.role} (${group.termId})`, district.name, emitted, group.count);
    }
    const entries: SkyriverDistrictPaletteEntry[] = [];
    for (const [id, entry] of groups) {
      const mean: SkyriverLinearRgb = [
        entry.sum[0] / entry.count, entry.sum[1] / entry.count, entry.sum[2] / entry.count,
      ];
      const peak = Math.max(mean[0], mean[1], mean[2]);
      if (!(peak > 0)) continue;
      entries.push({
        id,
        role: entry.role,
        district: entry.district,
        rgb: [mean[0] / peak, mean[1] / peak, mean[2] / peak],
        weight: entry.count * peak,
      });
    }
    return {
      label: `Skyriver R22 emitted source palette, seed ${this.districts.seed}, district colour ${this.colourSwitch.allowed ? 'on' : 'off'}`,
      colorSpace: 'linear',
      weightMeaning: 'Drawn instance count of the group times the group mean peak linear channel, so (source linear Y x weight) is the group total source luminance. RGB is the mean emitted source colour normalised to a peak of 1. A source count is not screen area and not rendered image energy.',
      limits: 'Procedural per-pixel sources (window panes, traced rooms, the far pane average, the landmark wash and the haze) have no instance count and are reported in sourceEvidence instead. The neutral ice-white sign group is kept in this table rather than dropped. Hue is unstable near grey, so read the neutral group by its role, not by its hue family.',
      entries: entries.sort((a, b) => a.id.localeCompare(b.id)),
    };
  }

  /**
   * The emissive sources a later round can light the air from: the drawn sign and hero faces, and
   * the large trim lights. World centres are the rigid transforms the instances were written with,
   * so a removed sign or a hero-cleared trim is absent here too.
   */
  lightSources(): readonly SkyriverLightSource[] {
    const sources: SkyriverLightSource[] = [];
    for (let i = 0; i < this.signs.count; i += 1) {
      const source: SkyriverLinearRgb = [
        this.signs.color[i * 3]!, this.signs.color[i * 3 + 1]!, this.signs.color[i * 3 + 2]!,
      ];
      const hue: SkyriverLinearRgb = [
        this.signDistricts.unitHue[i * 3]!,
        this.signDistricts.unitHue[i * 3 + 1]!,
        this.signDistricts.unitHue[i * 3 + 2]!,
      ];
      const legacy = skyriverSignFinalEmission(source);
      const tinted = skyriverDistrictSignEmission(source, hue, this.signDistricts.saturation[i]!);
      sources.push({
        id: signIdentity(this.signs, i),
        role: i < this.signs.heroCount ? 'hero-sign' : 'ordinary-sign',
        districtId: this.signDistricts.district[i]!,
        x: this.signWorldCentres[i * 3] ?? 0,
        y: this.signWorldCentres[i * 3 + 1] ?? 0,
        z: this.signWorldCentres[i * 3 + 2] ?? 0,
        sizeM: [this.signs.sw[i]!, this.signs.sh[i]!, 0],
        // In the warped facade plane: across it for a strip, up it for a banner.
        axis: this.signs.sw[i]! >= this.signs.sh[i]!
          ? [-(this.signDrawnNormal[i * 2 + 1] ?? 0), 0, this.signDrawnNormal[i * 2] ?? 1]
          : [0, 1, 0],
        emission: tinted,
        legacyEmission: legacy,
      });
    }
    for (let i = 0; i < this.trimDrawnKind.length; i += 1) {
      const kind = this.trimDrawnKind[i]!;
      if (!skyriverTrimIsLargeLight(kind)) continue;
      // The band emits warm or cold by its own seed; this reads the shader's selector, not a guess.
      const id = skyriverTrimSourceTermId(kind, this.trimDrawnSeed[i]!);
      if (id === null) throw new Error(`SKYRIVER_TRIM_SOURCE_TERM_MISSING:${kind}`);
      const term = districtSourceTerm(id);
      const districtId = this.trimDrawnDistrict[i]!;
      const district = this.districts.districts[districtId]!;
      sources.push({
        id: `trim:${i}:${kind}`,
        role: id,
        districtId,
        x: this.trimWorldCentres[i * 3]!,
        y: this.trimWorldCentres[i * 3 + 1]!,
        z: this.trimWorldCentres[i * 3 + 2]!,
        sizeM: [this.trimDrawnSize[i * 3]!, this.trimDrawnSize[i * 3 + 1]!, this.trimDrawnSize[i * 3 + 2]!],
        axis: [this.trimDrawnAxis[i * 3]!, this.trimDrawnAxis[i * 3 + 1]!, this.trimDrawnAxis[i * 3 + 2]!],
        emission: skyriverRecolorPreservingY(term.rgb, SKYRIVER_DISTRICT_UNIT_HUE[district.primary], term.saturation),
        legacyEmission: term.rgb,
      });
    }
    return sources;
  }

  /**
   * Geometry, placement and text identity of every instanced pass. Colour treatment outputs
   * (`aColor`, `aDistrictTint`, `aDistrict`, `aCard.w`) are excluded on purpose: this hash is what
   * proves the colour A/B moved no geometry, so it must not move with the colour.
   */
  geometryIdentity(): SkyriverGeometryIdentity {
    const signs = this.signs;
    const signPlacement = new Float32Array(signs.count * 9);
    for (let i = 0; i < signs.count; i += 1) {
      signPlacement[i * 9] = signs.cx[i]!;
      signPlacement[i * 9 + 1] = signs.cy[i]!;
      signPlacement[i * 9 + 2] = signs.cz[i]!;
      signPlacement[i * 9 + 3] = signs.nx[i]!;
      signPlacement[i * 9 + 4] = signs.nz[i]!;
      signPlacement[i * 9 + 5] = signs.sw[i]!;
      signPlacement[i * 9 + 6] = signs.sh[i]!;
      signPlacement[i * 9 + 7] = signs.kind[i]!;
      signPlacement[i * 9 + 8] = signs.rootHalfWidthM[i]!;
    }
    // A renamed or dropped attribute must break this proof, not hash an empty buffer: the A/B
    // geometry-identity hash is only evidence while it covers every attribute it claims to cover.
    const attribute = (mesh: THREE.InstancedMesh | THREE.Mesh, name: string): ArrayLike<number> => {
      const found = mesh.geometry.getAttribute(name);
      if (found === undefined) throw new Error(`SKYRIVER_IDENTITY_ATTRIBUTE_MISSING:${name}`);
      return found.array;
    };
    let towerAttributes = 0x811c9dc5;
    for (const name of ['aSeed', 'aTint', 'aSize', 'aLayer', 'aBuilding', 'aStepEdges', 'aMaterial']) {
      towerAttributes = hashNumbers(towerAttributes, attribute(this.towerMesh, name));
    }
    let trimAttributes = 0x811c9dc5;
    for (const name of ['aSeed', 'aKind', 'aSize']) {
      trimAttributes = hashNumbers(trimAttributes, attribute(this.trimMesh, name));
    }
    // aCard.w is the district, so the card hash reads its first three components only.
    const cards = attribute(this.impostorMesh, 'aCard');
    const cardGeometry = new Float32Array(Math.floor(cards.length / 4) * 3);
    for (let i = 0; i * 4 < cards.length; i += 1) {
      cardGeometry[i * 3] = cards[i * 4]!;
      cardGeometry[i * 3 + 1] = cards[i * 4 + 1]!;
      cardGeometry[i * 3 + 2] = cards[i * 4 + 2]!;
    }
    let signText = hashNumbers(0x811c9dc5, attribute(this.signMesh, 'aAtlas'));
    signText = hashNumbers(signText, signs.seedValue.slice(0, signs.count));
    signText = hashText(signText, signs.faceId.slice(0, signs.count));
    signText = hashText(signText, signs.buildingId.slice(0, signs.count));
    signText = hashText(signText, signs.compositionId.slice(0, signs.count));
    return {
      towers: hex32(hashNumbers(0x811c9dc5, this.towerMesh.instanceMatrix.array)),
      towerAttributes: hex32(towerAttributes),
      trims: hex32(hashNumbers(0x811c9dc5, this.trimMesh.instanceMatrix.array)),
      trimAttributes: hex32(trimAttributes),
      signPlacement: hex32(hashNumbers(hashNumbers(0x811c9dc5, signPlacement), attribute(this.signMesh, 'aCentre'))),
      signText: hex32(signText),
      impostors: hex32(hashNumbers(0x811c9dc5, this.impostorMesh.instanceMatrix.array)),
      impostorCards: hex32(hashNumbers(0x811c9dc5, cardGeometry)),
      counts: {
        towers: this.towerMesh.count,
        trims: this.trimMesh.count,
        signs: this.signGeometry.instanceCount,
        impostors: this.impostorMesh.count,
      },
      excludes: Object.freeze([
        'aColor (the drawn source colour)',
        'aDistrictTint (R22 target hue and saturation)',
        'aDistrict (R22 district id on towers and trims)',
        'aCard.w (R22 district id on far cards)',
      ]),
    };
  }

  /** One uniform write per material. No allocation, nothing per instance. */
  private heroWorld: THREE.Vector4[] = [];
  private heroWorldColors: THREE.Color[] = [];
  private readonly heroOrder: number[] = [];

  update(frame: SkyriverFrame): void {
    // R12: upload the 12 hero signs nearest the camera.
    const cam = frame.camera.position;
    const order = this.heroOrder;
    order.length = 0;
    for (let i = 0; i < this.heroWorld.length; i += 1) order.push(i);
    const world = this.heroWorld;
    const d2 = (i: number): number => {
      const h = world[i]!;
      return (h.x - cam.x) ** 2 + (h.y - cam.y) ** 2 + (h.z - cam.z) ** 2;
    };
    order.sort((a, b) => d2(a) - d2(b));
    const u = this.towerMaterial.uniforms;
    const blades = u.uHeroBlades!.value as THREE.Vector4[];
    const colors = u.uHeroColors!.value as THREE.Color[];
    const n = Math.min(12, order.length);
    // R15 glitch fix: spill weight falls to zero toward the 12th-nearest sign, so a sign entering or
    // leaving the uploaded set does so with no light on the facades (no one-frame spill pop).
    const edge = order.length > 12 ? Math.sqrt(d2(order[12]!)) : Infinity;
    for (let k = 0; k < n; k += 1) {
      blades[k]!.copy(world[order[k]!]!);
      const dist = Math.sqrt(d2(order[k]!));
      const w = edge === Infinity ? 1 : 1 - THREE.MathUtils.smoothstep(dist, edge * 0.7, edge);
      // R22: the colour-off path uploads the pre-R22 hero colours, so the A/B pair differs in the
      // district recolour alone — same heroes, same order, same spill weights.
      const heroColours = this.colourSwitch.allowed ? this.heroDistrictColours : this.heroWorldColors;
      colors[k]!.copy(heroColours[order[k]!]!).multiplyScalar(w);
      (u.uHeroWeight!.value as number[])[k] = w;
    }
    u.uHeroCount!.value = n;
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
      meshes: 4,
      drawCalls: this.impostorMesh.visible ? 4 : 3,
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
    this.atlas.dispose();
    this.interiorAtlas.dispose();
    this.impostorMesh.geometry.dispose();
    this.impostorMaterial.dispose();
    this.impostorAtlas.dispose();
    this.towerMesh.dispose();
    this.trimMesh.dispose();
    this.impostorMesh.dispose();
  }

  private writeImpostors(far: readonly SkyriverFarTower[]): void {
    this.farCardsByDistrict.fill(0);
    const matrix = new THREE.Matrix4();
    const cards = new Float32Array(Math.max(far.length, 1) * 4);
    for (let i = 0; i < far.length; i += 1) {
      const f = far[i]!;
      warpCanyon(f.x, f.v, warp);
      quaternion.setFromAxisAngle(UP, warp.heading);
      position.set(warp.x, IMPOSTOR_BASE_Y, warp.z);
      scale.set(f.width, f.top - IMPOSTOR_BASE_Y, f.width);
      matrix.compose(position, quaternion, scale);
      this.impostorMesh.setMatrixAt(i, matrix);
      const range = f.shape === 2 ? IMPOSTOR_SPIRE : f.shape === 1 ? IMPOSTOR_CAP : IMPOSTOR_FLAT;
      const h = hash1(f.x * 0.0131 + f.v * 0.0071 + f.layer * 1.7);
      const variant = range[0] + Math.floor(h * (range[1] - range[0]));
      const q = quantize(Math.fround(buildingSeedOf(f.x, f.v)));
      cards[i * 4] = encodeCard(variant, q);
      cards[i * 4 + 1] = f.layer;
      cards[i * 4 + 2] = hash1(h * 91.7 + 3.1) < 0.5 ? 1 : 0;
      // R22: the card's fourth component was unused. It now carries the far tower's own district,
      // from its canyon v, so the far layers desaturate with the same map and keep one draw.
      cards[i * 4 + 3] = skyriverDistrictIdAt(this.districts, f.v);
      this.farCardsByDistrict[cards[i * 4 + 3]!] += 1;
    }
    this.impostorMesh.count = far.length;
    this.impostorMesh.instanceMatrix.needsUpdate = true;
    this.impostorMesh.geometry.setAttribute('aCard', new THREE.InstancedBufferAttribute(cards, 4));
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
    const layers = new Float32Array(slots);
    const stepEdges = new Float32Array(slots * 2);
    const districts = new Float32Array(slots);

    const buildings = new Float32Array(slots);
    const materials = new Float32Array(slots);
    this.drawnMassesByDistrict.fill(0);
    this.paneCellCapacity = 0;
    const cellArea = SKYRIVER_CITY.windowCellWidthM * SKYRIVER_CITY.windowCellHeightM;
    let i = 0;
    for (let m = 0; m < masses.length; m += 1) {
      const mass = masses[m]!;
      // R16: in impostor mode the far layers are cards (writeImpostors), not boxes.
      if (this.farMode === 'impostor' && (mass.layer ?? 0) >= IMPOSTOR_MIN_LAYER) continue;
      layers[i] = mass.layer ?? 0;
      stepEdges[i * 2] = mass.stepBottom ? 1 : 0;
      stepEdges[i * 2 + 1] = mass.stepTop ? 1 : 0;
      // R16 interior culture: one seed per building (its slab, tiers, crowns and annexes share it).
      buildings[i] = mass.building ?? buildingSeedOf(mass.x, mass.z);
      // R25 material identity: canonical owner seed, separate from interior culture.
      materials[i] = Math.fround(mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z));
      // R22: the base building's own canyon anchor, so a slab, its tiers, its crowns and its annexes
      // always share one district. Never the warped world z this mass is drawn at.
      districts[i] = skyriverDistrictIdAt(this.districts, mass.anchorV ?? mass.z);
      this.drawnMassesByDistrict[districts[i]!] += 1;
      if ((mass.layer ?? 0) === 0) {
        const sideArea = 2 * (mass.width + mass.depth) * mass.height;
        this.paneCellCapacity += Math.floor(sideArea / cellArea);
      }
      // T7-3: canyon space -> the winding loop. Each box keeps its shape, placed at its warped centre
      // and turned to the local canyon heading. R16: tiers and annexes ride their slab's frame.
      warpRigid(mass.x, mass.z, mass.anchorV ?? mass.z, warp);
      quaternion.setFromAxisAngle(UP, warp.heading);
      position.set(warp.x, mass.y0 + mass.height * 0.5, warp.z);
      scale.set(mass.width, mass.height, mass.depth);
      matrix.compose(position, quaternion, scale);
      this.towerMesh.setMatrixAt(i, matrix);

      tint.setHex(mass.tint, THREE.SRGBColorSpace);
      tints[i * 3] = tint.r;
      tints[i * 3 + 1] = tint.g;
      tints[i * 3 + 2] = tint.b;

      sizes[i * 3] = mass.width;
      sizes[i * 3 + 1] = mass.height;
      sizes[i * 3 + 2] = mass.depth;

      // Seeded off the layout, not off a fresh stream: same seed, same facades, on every peer.
      seeds[i] = hash1(mass.x * 0.173 + mass.z * 0.0411 + mass.height * 0.0017 + m * 0.37);
      i += 1;
    }

    this.towerMesh.count = i;
    this.towerMesh.instanceMatrix.needsUpdate = true;
    this.towerMesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.towerMesh.geometry.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3));
    this.towerMesh.geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 3));
    this.towerMesh.geometry.setAttribute('aLayer', new THREE.InstancedBufferAttribute(layers, 1));
    this.towerMesh.geometry.setAttribute('aBuilding', new THREE.InstancedBufferAttribute(buildings, 1));
    this.towerMesh.geometry.setAttribute('aMaterial', new THREE.InstancedBufferAttribute(materials, 1));
    this.towerMesh.geometry.setAttribute('aStepEdges', new THREE.InstancedBufferAttribute(stepEdges, 2));
    this.towerMesh.geometry.setAttribute('aDistrict', new THREE.InstancedBufferAttribute(districts, 1));
    // Culling off keeps the draw-call count fixed, which is what the A3 smoke test asserts.
    this.towerMesh.frustumCulled = false;
  }

  private writeTrims(): void {
    const { count, cy, sx, sy, sz, kind, seedValue } = this.trims;
    const matrix = new THREE.Matrix4();
    const slots = Math.max(count, 1);
    const seeds = new Float32Array(slots);
    const kinds = new Float32Array(slots);
    const sizes = new Float32Array(slots * 3);
    const districts = new Float32Array(slots);
    const centres = new Float32Array(slots * 3);
    const axes = new Float32Array(slots * 3);
    this.drawnTrimsByKind.fill(0);
    this.drawnTrimsByDistrict.fill(0);

    // T7-3: clear space around the hero signs (see skyriverTrimBlocksHero).
    const heroes = deriveHeroBlades(this.layout);
    let drawn = 0;
    const placed: SkyriverTrimPlacement = { x: 0, z: 0, heading: 0, length: 0 };
    for (let i = 0; i < count; i += 1) {
      if (skyriverTrimBlocksHero(this.trims, i, heroes)) continue;
      // R16: rigid in the owner's frame (spans: each end on its own building). See placeTrim.
      placeTrim(this.trims, i, placed);
      quaternion.setFromAxisAngle(UP, placed.heading);
      position.set(placed.x, cy[i]!, placed.z);
      const alongSpan = placed.length > 0 && sz[i]! >= sx[i]!;
      const acrossSpan = placed.length > 0 && sx[i]! > sz[i]!;
      const ex = acrossSpan ? placed.length : sx[i]!;
      const ez = alongSpan ? placed.length : sz[i]!;
      scale.set(ex, sy[i]!, ez);
      matrix.compose(position, quaternion, scale);
      this.trimMesh.setMatrixAt(drawn, matrix);
      seeds[drawn] = seedValue[i]!;
      kinds[drawn] = kind[i]!;
      // R22: the trim's owner anchor — the same building anchor its facade's rooms and signs use.
      districts[drawn] = skyriverDistrictIdAt(this.districts, this.trims.owner[i]!.anchorV);
      this.drawnTrimsByDistrict[districts[drawn]!] += 1;
      this.drawnTrimsByKind[kind[i]!] += 1;
      sizes[drawn * 3] = ex;
      sizes[drawn * 3 + 1] = sy[i]!;
      sizes[drawn * 3 + 2] = ez;
      centres[drawn * 3] = placed.x;
      centres[drawn * 3 + 1] = cy[i]!;
      centres[drawn * 3 + 2] = placed.z;
      // The instance's own longest axis in world space, from the same heading the matrix composes
      // with. This is the axis the trim shader's `run` measures along, so a band's soffit strip and
      // the light R23 derives from it point the same way.
      const sinH = Math.sin(placed.heading);
      const cosH = Math.cos(placed.heading);
      if (sy[i]! >= ex && sy[i]! >= ez) {
        axes[drawn * 3] = 0;
        axes[drawn * 3 + 1] = 1;
        axes[drawn * 3 + 2] = 0;
      } else if (ez >= ex) {
        axes[drawn * 3] = sinH;
        axes[drawn * 3 + 1] = 0;
        axes[drawn * 3 + 2] = cosH;
      } else {
        axes[drawn * 3] = cosH;
        axes[drawn * 3 + 1] = 0;
        axes[drawn * 3 + 2] = -sinH;
      }
      drawn += 1;
    }
    this.trimMesh.count = drawn;
    this.trimWorldCentres = centres.slice(0, drawn * 3);
    this.trimDrawnAxis = axes.slice(0, drawn * 3);
    this.trimDrawnKind = kinds.slice(0, drawn);
    this.trimDrawnSize = sizes.slice(0, drawn * 3);
    this.trimDrawnDistrict = districts.slice(0, drawn);
    this.trimDrawnSeed = seeds.slice(0, drawn);

    this.trimMesh.instanceMatrix.needsUpdate = true;
    this.trimMesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.trimMesh.geometry.setAttribute('aKind', new THREE.InstancedBufferAttribute(kinds, 1));
    this.trimMesh.geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 3));
    this.trimMesh.geometry.setAttribute('aDistrict', new THREE.InstancedBufferAttribute(districts, 1));
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
    const atlasRects = new Float32Array(count * 4);
    // Hero blades keep stable atlas slots; ordinary signs use the remaining cells.
    const heroes = deriveHeroBlades(this.layout);
    const { vertical, horizontal } = this.atlas;
    // Hero cells are reserved: ordinary signs draw only from the cells after them, so no hero text
    // ever repeats on a small sign (cycle-3 caught duplicates reading as repetition).
    const verticalPool = vertical.length - HERO_VERTICAL_CELLS - 1;
    const horizontalPool = horizontal.length - HERO_HORIZONTAL_CELLS;

    for (let i = 0; i < count; i += 1) {
      let rect: readonly number[] = [0, 0, -1, -1];
      const hero = heroes[i];
      if (i < heroes.length && hero !== undefined) {
        rect = hero.kind === 'panel'
          ? horizontal[hero.cell % HERO_HORIZONTAL_CELLS]!
          : vertical[hero.cell % HERO_VERTICAL_CELLS]!;
      } else if (kind[i] === SKYRIVER_SIGN_BANNER) {
        rect = vertical[HERO_VERTICAL_CELLS + 1 + (Math.floor(seedValue[i]! * verticalPool) % verticalPool)]!;
      } else if (kind[i] === SKYRIVER_SIGN_STRIP) {
        rect = horizontal[HERO_HORIZONTAL_CELLS + (Math.floor(seedValue[i]! * horizontalPool) % horizontalPool)]!;
      }
      atlasRects.set(rect, i * 4);
      // T7-3: canyon space -> the winding loop; the facade normal turns with the local heading.
      // R14: the brand sign sits on a mega-tower at a bend's centre of curvature, where the warp is
      // near-singular; it is placed rigidly relative to the tower's warped centre (like the floods).
      const brandAnchor = hero !== undefined && hero.kind === 'brand'
        ? (megaAnchorCache.get(this.layout.seed) ?? []).find((m) => Math.abs(m.v - hero.z) < 300)
        : undefined;
      if (brandAnchor !== undefined) {
        warpCanyon(brandAnchor.x, brandAnchor.v, warp);
        const dx = cx[i]! - brandAnchor.x;
        const dz = cz[i]! - brandAnchor.v;
        const sinH = Math.sin(warp.heading);
        const cosH = Math.cos(warp.heading);
        warp.x += dx * cosH + dz * sinH;
        warp.z += -dx * sinH + dz * cosH;
      } else {
        // R16: a facade sign rides its tower's frame (see placeTrim); hero signs keep their own.
        const mount = this.signs.owner[i];
        warpRigid(cx[i]!, cz[i]!, mount ? mount.anchorV : cz[i]!, warp);
      }
      warpDirection(nx[i]!, nz[i]!, warp.heading, direction);
      centres[i * 3] = warp.x;
      centres[i * 3 + 1] = cy[i]!;
      centres[i * 3 + 2] = warp.z;
      normals[i * 2] = direction.x;
      normals[i * 2 + 1] = direction.z;
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
    geometry.setAttribute('aAtlas', new THREE.InstancedBufferAttribute(atlasRects, 4));
    // R22: unit-luminance target hue and its saturation per sign. `aColor` still carries the colour
    // the existing random.weighted draw produced, so the shader can hold its final luminance.
    const districtTint = new Float32Array(count * 4);
    for (let i = 0; i < count; i += 1) {
      districtTint[i * 4] = this.signDistricts.unitHue[i * 3]!;
      districtTint[i * 4 + 1] = this.signDistricts.unitHue[i * 3 + 1]!;
      districtTint[i * 4 + 2] = this.signDistricts.unitHue[i * 3 + 2]!;
      districtTint[i * 4 + 3] = this.signDistricts.saturation[i]!;
    }
    geometry.setAttribute('aDistrictTint', new THREE.InstancedBufferAttribute(districtTint, 4));
    this.signWorldCentres = centres.slice(0, count * 3);
    this.signDrawnNormal = normals.slice(0, count * 2);

    quad.dispose();
    return geometry;
  }
}

/** Construction-time scratch for the canyon -> loop warp (instance writes happen once, at boot). */
const warp: WarpOut = { x: 0, z: 0, heading: 0 };
const direction = { x: 0, z: 0 };
const quaternion = new THREE.Quaternion();
const position = new THREE.Vector3();
const scale = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** Deterministic scalar hash, the CPU twin of `skyHash11`. Keeps facade seeding off Math.random. */
function hash1(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

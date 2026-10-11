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

import { decodeCard, encodeCard, quantize, SKYRIVER_STRUCTURE_MATERIAL_GLSL } from './structureMaterial.js';
import { WINDOW_PALETTE_GLSL, windowPaletteCode, windowPaletteCodeFromQ, windowPaletteHash, windowPaletteMean } from './windowPalette';

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
import { SKYRIVER_STRUCTURED_LIGHT_GLSL } from './structuredLight';
import type { SkyriverFrame, SkyriverQualitySettings } from './scene';
import { HERO_HORIZONTAL_CELLS, HERO_VERTICAL_CELLS, createSignAtlas, type SignAtlas } from './signAtlas';
import { createInteriorAtlas, type InteriorAtlas } from './interiorAtlas';
import {
  FACADE_FACE_EDGE_MARGIN_M,
  FACADE_STEP_MASK_BAND_M,
  boxLocalPoint,
  boxLocalCoordinates,
  subtractFootprint,
  clipFootprintEdge,
  fitCrownFootprint,
  fitRectangleDimensions,
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
import { autopilotTrackPose } from './flightPresentation';
import { createCameraPoseScratch, writeCameraPose } from './cameraRig';
import { CLEARANCE_CAMERA_RADIUS_M, CLEARANCE_SHUTTLE_RADIUS_M } from './clearance';

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

export type SkyriverRoofDetailRole =
  | 'tank'
  | 'vent'
  | 'pipe'
  | 'stairhouse'
  | 'hvac'
  | 'pad'
  | 'mast';

export type SkyriverRoofDetailStratum = 'grime' | 'mid' | 'pristine';

export const SKYRIVER_ROOF_DETAIL_CAPS = Object.freeze([1200, 480, 120] as const);
export const SKYRIVER_ROOF_DETAIL_TOTAL_CAP = 1800;

export interface SkyriverRoofDetailRecord {
  readonly trimIndex: number;
  readonly supportMassIndex: number;
  readonly clusterId: number;
  readonly role: SkyriverRoofDetailRole;
  readonly stratum: SkyriverRoofDetailStratum;
}

export interface SkyriverRoofDetailDerivation {
  readonly oldTrimCount: number;
  readonly totalTrimCount: number;
  readonly requestedByStratum: readonly [number, number, number];
  readonly acceptedByStratum: readonly [number, number, number];
  readonly rejectedSupportByStratum: readonly [number, number, number];
  readonly rejectedCollisionByStratum: readonly [number, number, number];
  readonly rejectedBudgetByStratum: readonly [number, number, number];
  readonly records: readonly SkyriverRoofDetailRecord[];
}

export type SkyriverRoofDetailDrawRecord =
  | (SkyriverRoofDetailRecord & { readonly drawIndex: number; readonly drawState: 'drawn' })
  | (SkyriverRoofDetailRecord & { readonly drawIndex: null; readonly drawState: 'hero-excluded' });

export interface SkyriverRoofDetailEvidence extends Omit<SkyriverRoofDetailDerivation, 'records'> {
  readonly legacyDrawnCount: number;
  readonly uploadedTotalCount: number;
  readonly uploadedSuffixCount: number;
  readonly uploadedByStratum: readonly [number, number, number];
  readonly heroExcludedByStratum: readonly [number, number, number];
  readonly records: readonly SkyriverRoofDetailDrawRecord[];
}

/** A mass a trim is attached to, in canyon space. */
export interface SkyriverTrimOwner {
  readonly yawRad?: number;
  readonly yawAnchor?: { readonly x: number; readonly z: number };
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  /** The along-canyon coordinate the owner is placed rigidly around (its own z, or its tower's). */
  readonly anchorV: number;
  /** Canonical building seed for the attached non-emissive material. */
  readonly materialOwner?: number;
}

/** R36 D1: Actual 3D bounding geometry for legacy trim records and dispositions. */
export interface SkyriverTrimGeometry {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
}

/** R36 D1: Immutable source inventory record captured before reconciliation. */
export interface SkyriverLegacyTrimSourceRecord {
  readonly sourceIndex: number;
  readonly kind: number;
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly seedValue: number;
  readonly seedBits: number;
  readonly canonicalOwner: number;
  readonly owner: SkyriverTrimOwner;
  readonly spanTo: SkyriverTrimOwner | null;
}

export interface SkyriverUnchangedTrimDisposition {
  readonly kind: 'unchanged';
  readonly sourceIndex: number;
  readonly finalIndex: number;
  readonly heroFiltered: boolean;
  readonly blockingHeroIds: readonly string[];
  readonly oldGeometry: SkyriverTrimGeometry;
  readonly newGeometry: SkyriverTrimGeometry;
}

export interface SkyriverSideRehostedTrimDisposition {
  readonly kind: 'side-rehosted';
  readonly sourceIndex: number;
  readonly finalIndex: number;
  readonly heroFiltered: boolean;
  readonly blockingHeroIds: readonly string[];
  readonly oldGeometry: SkyriverTrimGeometry;
  readonly newGeometry: SkyriverTrimGeometry;
  readonly hostMassIndex: number;
  readonly faceId: string;
}

export interface SkyriverRoofRehostedTrimDisposition {
  readonly kind: 'roof-rehosted';
  readonly sourceIndex: number;
  readonly finalIndex: number;
  readonly heroFiltered: boolean;
  readonly blockingHeroIds: readonly string[];
  readonly oldGeometry: SkyriverTrimGeometry;
  readonly newGeometry: SkyriverTrimGeometry;
  readonly hostMassIndex: number;
  readonly horizontalScale: number;
}

export interface SkyriverInheritedRoofUnsupportedTrimDisposition {
  readonly kind: 'inherited-roof-unsupported';
  readonly sourceIndex: number;
  readonly finalIndex: number;
  readonly heroFiltered: boolean;
  readonly blockingHeroIds: readonly string[];
  readonly oldGeometry: SkyriverTrimGeometry;
  readonly newGeometry: SkyriverTrimGeometry;
}

export interface SkyriverSpanHost {
  readonly massIndex: number;
  readonly canonicalOwner: number;
  readonly anchorV: number;
}

export interface SkyriverSpanEndpoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SkyriverSpanWorldMetrics {
  readonly endpoints: readonly [SkyriverSpanEndpoint, SkyriverSpanEndpoint];
  readonly sourceLengthM: number;
  readonly worldLengthM: number;
  readonly exposedLengthM: number;
}

export interface SkyriverSpanEndpointContact {
  readonly crossOverlapM: number;
  readonly verticalOverlapM: number;
}

export interface SkyriverSpanRehostedTrimDisposition {
  readonly kind: 'span-rehosted';
  readonly sourceIndex: number;
  readonly finalIndex: number;
  readonly heroFiltered: boolean;
  readonly blockingHeroIds: readonly string[];
  readonly oldGeometry: SkyriverTrimGeometry;
  readonly newGeometry: SkyriverTrimGeometry;
  readonly hosts: readonly [SkyriverSpanHost, SkyriverSpanHost];
  readonly oldWorld: SkyriverSpanWorldMetrics;
  readonly newWorld: SkyriverSpanWorldMetrics;
  readonly endpointContacts: readonly [SkyriverSpanEndpointContact, SkyriverSpanEndpointContact];
}

export interface SkyriverInheritedSpanUnsupportedTrimDisposition {
  readonly kind: 'inherited-span-unsupported';
  readonly sourceIndex: number;
  readonly finalIndex: number;
  readonly heroFiltered: boolean;
  readonly blockingHeroIds: readonly string[];
  readonly oldGeometry: SkyriverTrimGeometry;
  readonly newGeometry: SkyriverTrimGeometry;
}

export type SkyriverTrimDisposition =
  | SkyriverUnchangedTrimDisposition
  | SkyriverSideRehostedTrimDisposition
  | SkyriverRoofRehostedTrimDisposition
  | SkyriverInheritedRoofUnsupportedTrimDisposition
  | SkyriverSpanRehostedTrimDisposition
  | SkyriverInheritedSpanUnsupportedTrimDisposition;

export interface SkyriverLegacyTrimReconciliation {
  readonly seed: number;
  readonly sourceCount: number;
  readonly finalCount: number;
  readonly inventoryIdentity: string;
  readonly sourceInventory: readonly SkyriverLegacyTrimSourceRecord[];
  readonly dispositions: readonly SkyriverTrimDisposition[];
  readonly unchangedCount: number;
  readonly rehostedCount: number;
  readonly roofRowsDeferred: number;
  readonly spanRowsDeferred: number;
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

export interface SkyriverSignPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface SkyriverSignMount {
  readonly mode: 'panel' | 'blade';
  readonly host: { readonly kind: 'mass' | 'trim'; readonly index: number };
  readonly edgeIndex: number;
  /** Edge and root use the sign owner frame. */
  readonly edge: readonly [SkyriverSignPoint, SkyriverSignPoint];
  readonly root: readonly [SkyriverSignPoint, SkyriverSignPoint];
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
  readonly faceId: readonly (string | null)[];
  readonly buildingId: readonly (string | null)[];
  readonly compositionId: readonly (string | null)[];
  readonly rootHalfWidthM: Float32Array;
  readonly mount: readonly SkyriverSignMount[];
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

export type SkyriverNeonSignArtwork = Omit<SkyriverNeonSigns, 'mount'>;

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
  readonly yawWingPart?: { readonly roofMassIndex: number; readonly part: 'below' | 'band' | 'roof';
    readonly cutLow: number; readonly cutHigh: number };
  /** Local box yaw, in radians. The canyon heading is added at placement. */
  readonly yawRad?: number;
  readonly yawAnchor?: { readonly x: number; readonly z: number };
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
  readonly supportRole?: 'retained-child-bridge' | 'yaw-roof-cap' | 'yaw-span-ledge';
  readonly supportHostMassIndex?: number;
  readonly supportSourceTrimIndex?: number;
  readonly supportSpanEndpoint?: 0 | 1;
  readonly crownRole?: 'ordinary-dark-crown';
  readonly artBacking?: { readonly hostMassIndex: number; readonly faceId: string };
}

export interface SkyriverRetainedMassSupportRecord {
  readonly supportMassIndex: number;
  readonly childSourceIndex: number;
  readonly childFinalIndex: number;
  readonly hostMassIndex: number;
  readonly owner: number;
  readonly anchorV: number;
  readonly geometry:
    | { readonly kind: 'strict-clear' }
    | { readonly kind: 'original-owner-contained'; readonly sourceMassIndices: readonly number[] };
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

/** Canonical material seed carried by the actual trim placement owner. */
export function trimMaterialOwnerSeed(owner: SkyriverTrimOwner): number {
  return Math.fround(owner.materialOwner ?? buildingSeedOf(owner.x, owner.z));
}

/** A tower or mass as a trim owner, placed around its own centre unless told otherwise. */
function ownerOf(mass: { readonly x: number; readonly z: number; readonly width: number; readonly depth: number; readonly materialOwner?: number; readonly yawRad?: number; readonly yawAnchor?: { readonly x: number; readonly z: number } }, anchorV = mass.z): SkyriverTrimOwner {
  return { x: mass.x, z: mass.z, width: mass.width, depth: mass.depth, anchorV,
    materialOwner: mass.materialOwner ?? buildingSeedOf(mass.x, mass.z),
    ...(mass.yawRad === undefined ? {} : { yawRad: mass.yawRad }),
    ...(mass.yawAnchor === undefined ? {} : { yawAnchor: mass.yawAnchor }) };
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

/** Place a box-local point with the box yaw and its canyon heading. */
export function warpBoxPoint(
  box: { readonly x: number; readonly z: number; readonly anchorV?: number; readonly yawRad?: number; readonly yawAnchor?: { readonly x: number; readonly z: number } },
  x: number,
  z: number,
  out: WarpOut,
): WarpOut {
  const yaw = box.yawRad ?? 0;
  const point = boxLocalPoint({ ...(box.yawAnchor ?? box), yawRad: yaw }, x, z);
  warpRigid(point.x, point.z, box.anchorV ?? box.z, out);
  out.heading += yaw;
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
const massSeedIndexCache = new Map<number, WeakMap<SkyriverMass, number>>();
const roofDetailCache = new Map<number, SkyriverRoofDetailDerivation>();
const trimReconciliationCache = new Map<number, SkyriverLegacyTrimReconciliation>();
const retainedMassSupportCache = new Map<number, readonly SkyriverRetainedMassSupportRecord[]>();
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
const legacyFaceCache = new Map<number, readonly SkyriverFacadeFace[]>();

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

/** Named legacy exposed face records from the c6 generation path used for hero art planning. */
export function deriveLegacyFacadeFaces(layout: SkyriverCityLayout): readonly SkyriverFacadeFace[] {
  deriveCityTrims(layout);
  const faces = legacyFaceCache.get(layout.seed);
  if (faces === undefined) fail('SKYRIVER_CITY_LEGACY_FACES_MISSING');
  return faces;
}

/** All drawn concrete masses for a layout. Pure and cached; derived alongside the trims. */
export function deriveCityMasses(layout: SkyriverCityLayout): readonly SkyriverMass[] {
  deriveCityTrims(layout);
  const masses = massCache.get(layout.seed);
  if (masses === undefined) fail('SKYRIVER_CITY_MASSES_MISSING');
  return masses;
}

/** Return the support records from the complete trim derivation. */
export function deriveRetainedMassSupportRecords(layout: SkyriverCityLayout): readonly SkyriverRetainedMassSupportRecord[] {
  deriveCityTrims(layout);
  const records = retainedMassSupportCache.get(layout.seed);
  if (records === undefined) fail('SKYRIVER_RETAINED_SUPPORT_RECORDS_MISSING');
  return records;
}

/** Named legacy trim reconciliation result (R36 D1). Pure and cached; derived alongside the trims. */
export function deriveLegacyTrimReconciliation(layout: SkyriverCityLayout): SkyriverLegacyTrimReconciliation {
  deriveCityTrims(layout);
  const rec = trimReconciliationCache.get(layout.seed);
  if (rec === undefined) fail('SKYRIVER_CITY_TRIM_RECONCILIATION_MISSING');
  return rec;
}

export type SkyriverShapeFamily =
  | 'offset-decks'
  | 'broad-shelf'
  | 'thin-slab-companion'
  | 'supported-spine';

export interface SkyriverStageOffset {
  readonly axis: 'x' | 'z';
  readonly parentKind: 'stage' | 'original-footprint';
  readonly parentStageIndex: number;
  readonly parentSpanM: number;
  readonly deltaM: number;
  readonly ratio: number;
}

export interface SkyriverStageProfile {
  readonly stageIndex: number;
  readonly massIndices: readonly number[];
  readonly footprint: {
    readonly x: number;
    readonly z: number;
    readonly width: number;
    readonly depth: number;
  };
  readonly verticalBounds: {
    readonly y0: number;
    readonly y1: number;
    readonly height: number;
  };
  readonly offset: SkyriverStageOffset | null;
}

export interface SkyriverSplitCrownProfile {
  readonly kind: 'split';
  readonly axis: 'x' | 'z';
  readonly gapM: number;
  readonly crownSpanM: number;
  readonly bounds: {
    readonly y0: number;
    readonly y1: number;
    readonly width: number;
    readonly height: number;
    readonly depth: number;
  };
  readonly massIndices: readonly [number, number];
}

export interface SkyriverUnsplitFinProfile {
  readonly kind: 'unsplit-fin';
  readonly axis: 'x' | 'z';
  readonly gapM: 0;
  readonly crownSpanM: number;
  readonly bounds: {
    readonly y0: number;
    readonly y1: number;
    readonly width: number;
    readonly height: number;
    readonly depth: number;
  };
  readonly massIndices: readonly [number];
}

export type SkyriverCrownProfile = SkyriverSplitCrownProfile | SkyriverUnsplitFinProfile;

export interface SkyriverLeanProfile {
  readonly axis: 'z';
  readonly angleDeg: number;
  readonly riseM: number;
  readonly totalOffsetM: number;
}

export interface SkyriverEligibleTowerProfile {
  readonly eligibility: {
    readonly kind: 'eligible';
    readonly reason: string;
  };
  readonly towerIndex: number;
  readonly towerKey: string;
  readonly building: number;
  readonly materialOwner: number;
  readonly family: SkyriverShapeFamily;
  readonly stages: readonly SkyriverStageProfile[];
  readonly crown: SkyriverCrownProfile;
  readonly lean: SkyriverLeanProfile | null;
  readonly supportSpineIndex: number | null;
  readonly companionMassIndices: readonly number[];
  readonly hostFace: SkyriverFacadeFace;
}

export interface SkyriverExcludedTowerProfile {
  readonly eligibility: {
    readonly kind: 'excluded';
    readonly reason: string;
  };
  readonly towerIndex: number;
  readonly towerKey: string;
  readonly building: number;
  readonly materialOwner: number;
  readonly archetype: SkyriverMassingArchetype;
}

export type SkyriverTowerProfileRow = SkyriverEligibleTowerProfile | SkyriverExcludedTowerProfile;

const towerProfileCache = new Map<number, readonly SkyriverTowerProfileRow[]>();

/** R36: axis-aligned canyon-space box stage profiles for ordinary towers. Pure, GL-free, backed by actual emitted masses. */
export function deriveTowerProfiles(layout: SkyriverCityLayout): readonly SkyriverTowerProfileRow[] {
  deriveCityTrims(layout);
  const profiles = towerProfileCache.get(layout.seed);
  if (profiles === undefined) fail('SKYRIVER_CITY_TOWER_PROFILES_MISSING');
  return profiles;
}

function r36Hash01(seed: number, tower: SkyriverTower, salt: number): number {
  const n = seed * 0.0001 + tower.x * 0.0173 + tower.z * 0.00911 + salt * 37.19;
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function towerExclusionReason(layout: SkyriverCityLayout, tower: SkyriverTower): string | null {
  // Exclude only a true named landmark or a proven per-tower clearance failure.
  // In the presented layout, all 211 ordinary towers clear flight paths and are eligible.
  return null;
}

function isEligibleTower(layout: SkyriverCityLayout, tower: SkyriverTower): boolean {
  return towerExclusionReason(layout, tower) === null;
}

interface R36StageDraft {
  readonly stageIndex: number;
  readonly masses: readonly SkyriverMass[];
  readonly footprint: {
    readonly x: number;
    readonly z: number;
    readonly width: number;
    readonly depth: number;
  };
  readonly verticalBounds: {
    readonly y0: number;
    readonly y1: number;
    readonly height: number;
  };
  readonly offset: SkyriverStageOffset | null;
}

interface R36EmittedData {
  readonly family: SkyriverShapeFamily;
  readonly stageMasses: readonly SkyriverMass[];
  readonly stageDrafts: readonly R36StageDraft[];
  readonly spineMass: SkyriverMass | null;
  readonly deckWingMasses: readonly SkyriverMass[];
  readonly crownMasses: readonly SkyriverMass[];
  readonly crownProfile: SkyriverCrownProfile;
  readonly crownBounds: { readonly y0: number; readonly y1: number; readonly width: number; readonly height: number; readonly depth: number };
  readonly crownSpan: number;
  readonly companionMasses: readonly SkyriverMass[];
  readonly leanProfile: SkyriverLeanProfile | 'none';
  readonly hostFace: SkyriverFacadeFace;
  readonly faces: readonly SkyriverFacadeFace[];
  readonly tiers: readonly FacadeTier[];
}

const R36_ORDINARY_CROWN_HEIGHT_M = 200;

function deriveR36TowerData(
  layout: SkyriverCityLayout,
  tower: SkyriverTower,
  towerIndex: number,
  isSplitCrown: boolean,
  heroRow?: HeroRowPlan,
  isReservedHero = false,
  heroReservedTop?: number,
  familyOverride?: SkyriverShapeFamily,
  stage0Override?: { readonly width: number; readonly depth: number; readonly x: number; readonly z: number },
  companionScale = 1,
  resolveOriginal = false,
): R36EmittedData {
  const side = Math.sign(tower.x) as -1 | 1;
  const buildingId = `tower:${towerKey(tower)}`;
  const towerSeed = buildingSeedOf(tower.x, tower.z);

  const u1 = r36Hash01(layout.seed, tower, 1);
  const u3 = r36Hash01(layout.seed, tower, 3);
  const u4 = r36Hash01(layout.seed, tower, 4);
  const u5 = r36Hash01(layout.seed, tower, 5);

  const familyIndex = towerIndex % 4;
  let family: SkyriverShapeFamily =
    familyOverride !== undefined ? familyOverride
    : familyIndex === 0 ? 'supported-spine'
    : familyIndex === 1 ? 'thin-slab-companion'
    : familyIndex === 2 ? 'broad-shelf'
    : 'offset-decks';

  if (heroRow !== undefined || isReservedHero) {
    family = 'offset-decks';
  }

  const isLeaning = (towerIndex % 15 === 3) && (heroRow === undefined) && !isReservedHero;
  const voidY = SKYRIVER_CITY_VOID_BASE_Y;

  if (family === 'supported-spine') {
    const spineW = Math.max(12, Math.round(tower.width * 0.16));
    const spineD = Math.max(12, Math.round(tower.depth * 0.16));
    const wingW = Math.round(tower.width * 0.75);
    const wingD = Math.max(14, Math.round((tower.depth - spineD) * 0.45));
    const maxSpineArea = wingW * wingD * 0.25;
    const actualSpineW = spineW * spineD >= maxSpineArea
      ? Math.max(1, Math.min(spineW, Math.floor((maxSpineArea - 0.01) / spineD)))
      : spineW;
    let wingY1: number;
    if (heroRow !== undefined) {
      wingY1 = Math.min(Math.round(tower.height * 0.20), Math.round(heroRow.faceBottom - 60));
    } else {
      wingY1 = Math.min(450, Math.max(120, Math.round(tower.height * 0.20)));
    }
    const airGap = 20;
    const elevatedBodyY0 = wingY1 + airGap;

    const wing0: SkyriverMass = {
      x: tower.x,
      y0: voidY,
      z: tower.z - spineD * 0.5 - wingD * 0.5,
      width: wingW,
      height: wingY1 - voidY,
      depth: wingD,
      tint: tower.tint,
      anchorV: tower.z,
      building: towerSeed,
      materialOwner: towerSeed,
      stepBottom: false,
      stepTop: true,
    };
    const wing1: SkyriverMass = {
      x: tower.x,
      y0: voidY,
      z: tower.z + spineD * 0.5 + wingD * 0.5,
      width: wingW,
      height: wingY1 - voidY,
      depth: wingD,
      tint: tower.tint,
      anchorV: tower.z,
      building: towerSeed,
      materialOwner: towerSeed,
      stepBottom: false,
      stepTop: true,
    };

    const spineStageCount: 3 | 4 = (tower.height >= 3200 && u1 < 0.4 && heroRow === undefined) ? 4 : 3;
    let stage1Y1: number;
    if (heroRow !== undefined) {
      stage1Y1 = Math.ceil(heroRow.faceTop + 10);
    } else {
      stage1Y1 = Math.round(elevatedBodyY0 + (tower.height - elevatedBodyY0) * (spineStageCount === 4 ? 0.40 : 0.55));
    }

    const sw1 = Math.round(tower.width * 0.82);
    const sd1 = Math.round(tower.depth * 0.82);
    const parentSpan1 = spineD + 2 * wingD;
    const parentSpan1X = wingW;

    let sx1 = tower.x;
    let sz1 = tower.z;
    let axis1: 'x' | 'z' = 'z';
    let parentSpan1Used = parentSpan1;
    let delta1 = 0;
    let ratio1 = 0;

    let sx2 = tower.x;
    let sz2 = tower.z;
    let stage2Y1 = tower.height;
    let sw2 = Math.round(sw1 * 0.72);
    let sd2 = Math.round(sd1 * 0.72);
    let axis2: 'x' | 'z' = 'z';
    let parentSpan2Used = sd1;
    let delta2 = 0;
    let ratio2 = 0;

    let leanProfile: SkyriverLeanProfile | 'none' = 'none';

    if (isLeaning) {
      const targetAngle = 4.85;
      const tanTheta = Math.tan(targetAngle * Math.PI / 180);
      const elevatedRise = tower.height - elevatedBodyY0;
      const targetTotalOffset = Math.round(elevatedRise * tanTheta);

      const minDelta1 = Math.ceil(parentSpan1 * 0.085);
      const maxDelta1 = Math.floor(parentSpan1 * 0.325);
      const minDelta2 = Math.ceil(sd1 * 0.085);
      const maxDelta2 = Math.floor(sd1 * 0.325);

      const d1 = Math.max(minDelta1, Math.min(maxDelta1, Math.round(targetTotalOffset * 0.48)));
      const d2 = Math.max(minDelta2, Math.min(maxDelta2, targetTotalOffset - d1));

      axis1 = 'z';
      delta1 = d1;
      parentSpan1Used = parentSpan1;
      ratio1 = delta1 / parentSpan1Used;
      sz1 = tower.z + delta1;

      axis2 = 'z';
      delta2 = d2;
      parentSpan2Used = sd1;
      ratio2 = delta2 / parentSpan2Used;
      sz2 = sz1 + delta2;

      const actualRise = elevatedRise;
      const actualTotalOffset = delta1 + delta2;
      const actualAngle = Number((Math.atan(actualTotalOffset / actualRise) * 180 / Math.PI).toFixed(2));
      if (actualAngle >= 4.0 && actualAngle <= 6.0) {
        leanProfile = {
          axis: 'z',
          angleDeg: actualAngle,
          riseM: actualRise,
          totalOffsetM: actualTotalOffset,
        };
      }
    } else {
      axis1 = ((u3 + 1 * 0.37) % 1.0 < 0.6) ? 'z' : 'x';
      parentSpan1Used = axis1 === 'x' ? parentSpan1X : parentSpan1;
      const targetRatio1 = 0.22 + 0.07 * u4;
      const minDelta1 = Math.ceil(parentSpan1Used * 0.085);
      const maxDelta1 = Math.floor(parentSpan1Used * 0.325);
      const centerDelta1 = Math.max(minDelta1, Math.min(maxDelta1, Math.round(targetRatio1 * parentSpan1Used)));
      ratio1 = centerDelta1 / parentSpan1Used;
      const dir1 = ((u5 + 1 * 0.5) % 1.0 < 0.5 ? -1 : 1);
      sx1 = axis1 === 'x' ? tower.x + side * centerDelta1 : tower.x;
      sz1 = axis1 === 'z' ? tower.z + dir1 * centerDelta1 : tower.z;
      delta1 = axis1 === 'x' ? (sx1 - tower.x) : (sz1 - tower.z);

      stage2Y1 = spineStageCount === 4 ? Math.round(stage1Y1 + (tower.height - stage1Y1) * 0.5) : tower.height;
      axis2 = ((u3 + 2 * 0.37) % 1.0 < 0.6) ? 'z' : 'x';
      parentSpan2Used = axis2 === 'x' ? sw1 : sd1;
      const targetRatio2 = 0.22 + 0.07 * u4;
      const minDelta2 = Math.ceil(parentSpan2Used * 0.085);
      const maxDelta2 = Math.floor(parentSpan2Used * 0.325);
      const centerDelta2 = Math.max(minDelta2, Math.min(maxDelta2, Math.round(targetRatio2 * parentSpan2Used)));
      ratio2 = centerDelta2 / parentSpan2Used;
      const dir2 = ((u5 + 2 * 0.5) % 1.0 < 0.5 ? -1 : 1);
      sx2 = axis2 === 'x' ? sx1 + side * centerDelta2 : sx1;
      sz2 = axis2 === 'z' ? sz1 + dir2 * centerDelta2 : sz1;
      delta2 = axis2 === 'x' ? (sx2 - sx1) : (sz2 - sz1);
    }

    const stage1Mass: SkyriverMass = {
      x: sx1,
      y0: elevatedBodyY0,
      z: sz1,
      width: sw1,
      height: stage1Y1 - elevatedBodyY0,
      depth: sd1,
      tint: tower.tint,
      anchorV: tower.z,
      building: towerSeed,
      materialOwner: towerSeed,
      stepBottom: true,
      stepTop: true,
    };

    const stage2Mass: SkyriverMass = {
      x: sx2,
      y0: stage1Y1,
      z: sz2,
      width: sw2,
      height: stage2Y1 - stage1Y1,
      depth: sd2,
      tint: tower.tint,
      anchorV: tower.z,
      building: towerSeed,
      materialOwner: towerSeed,
      stepBottom: true,
      stepTop: true,
    };

    const stageMasses: SkyriverMass[] = [wing0, wing1, stage1Mass, stage2Mass];

    let topStage = { x: sx2, z: sz2, width: sw2, depth: sd2, y0: stage1Y1, y1: stage2Y1 };
    const stageDrafts: R36StageDraft[] = [
      {
        stageIndex: 0,
        masses: [wing0, wing1],
        footprint: { x: tower.x, z: tower.z, width: wingW, depth: spineD + 2 * wingD },
        verticalBounds: { y0: voidY, y1: wingY1, height: wingY1 - voidY },
        offset: null,
      },
      {
        stageIndex: 1,
        masses: [stage1Mass],
        footprint: { x: sx1, z: sz1, width: sw1, depth: sd1 },
        verticalBounds: { y0: elevatedBodyY0, y1: stage1Y1, height: stage1Y1 - elevatedBodyY0 },
        offset: {
          axis: axis1,
          parentKind: 'stage',
          parentStageIndex: 0,
          parentSpanM: parentSpan1Used,
          deltaM: delta1,
          ratio: ratio1,
        },
      },
      {
        stageIndex: 2,
        masses: [stage2Mass],
        footprint: { x: sx2, z: sz2, width: sw2, depth: sd2 },
        verticalBounds: { y0: stage1Y1, y1: stage2Y1, height: stage2Y1 - stage1Y1 },
        offset: {
          axis: axis2,
          parentKind: 'stage',
          parentStageIndex: 1,
          parentSpanM: parentSpan2Used,
          deltaM: delta2,
          ratio: ratio2,
        },
      },
    ];

    if (spineStageCount === 4 && !isLeaning) {
      const sw3 = Math.round(sw2 * 0.72);
      const sd3 = Math.round(sd2 * 0.72);
      const axis3: 'x' | 'z' = ((u3 + 3 * 0.37) % 1.0 < 0.6) ? 'z' : 'x';
      const parentSpan3 = axis3 === 'x' ? sw2 : sd2;
      const targetRatio3 = 0.22 + 0.07 * u4;
      const minDelta3 = Math.ceil(parentSpan3 * 0.085);
      const maxDelta3 = Math.floor(parentSpan3 * 0.325);
      const centerDelta3 = Math.max(minDelta3, Math.min(maxDelta3, Math.round(targetRatio3 * parentSpan3)));
      const ratio3 = centerDelta3 / parentSpan3;
      const dir3 = ((u5 + 3 * 0.5) % 1.0 < 0.5 ? -1 : 1);
      const sx3 = axis3 === 'x' ? sx2 + side * centerDelta3 : sx2;
      const sz3 = axis3 === 'z' ? sz2 + dir3 * centerDelta3 : sz2;
      const stage3Mass: SkyriverMass = {
        x: sx3,
        y0: stage2Y1,
        z: sz3,
        width: sw3,
        height: tower.height - stage2Y1,
        depth: sd3,
        tint: tower.tint,
        anchorV: tower.z,
        building: towerSeed,
        materialOwner: towerSeed,
        stepBottom: true,
        stepTop: true,
      };
      stageMasses.push(stage3Mass);
      topStage = { x: sx3, z: sz3, width: sw3, depth: sd3, y0: stage2Y1, y1: tower.height };
      stageDrafts.push({
        stageIndex: 3,
        masses: [stage3Mass],
        footprint: { x: sx3, z: sz3, width: sw3, depth: sd3 },
        verticalBounds: { y0: stage2Y1, y1: tower.height, height: tower.height - stage2Y1 },
        offset: {
          axis: axis3,
          parentKind: 'stage',
          parentStageIndex: 2,
          parentSpanM: parentSpan3,
          deltaM: axis3 === 'x' ? (sx3 - sx2) : (sz3 - sz2),
          ratio: ratio3,
        },
      });
    }

    const spineTop = topStage.y0;
    const spineMass: SkyriverMass = {
      x: tower.x,
      y0: voidY,
      z: tower.z,
      width: actualSpineW,
      height: Math.max(10, spineTop - voidY),
      depth: spineD,
      tint: tower.tint,
      anchorV: tower.z,
      building: towerSeed,
      materialOwner: towerSeed,
    };

    const crownMasses: SkyriverMass[] = [];
    let crownProfile: SkyriverCrownProfile;
    let crownBounds: { readonly y0: number; readonly y1: number; readonly width: number; readonly height: number; readonly depth: number };
    let crownSpan: number;

    if (isSplitCrown) {
      const rawSpan = Math.round(topStage.depth * 0.85);
      const gap = Math.round(rawSpan * 0.22);
      const blockD = Math.floor((rawSpan - gap) * 0.5);
      const actualSpan = gap + 2 * blockD;
      const blockW = Math.round(topStage.width * 0.7);
      const crownH = resolveOriginal ? 45 : R36_ORDINARY_CROWN_HEIGHT_M;
      const yCrown = topStage.y1;
      const b0z = topStage.z - (gap + blockD) * 0.5;
      const b1z = topStage.z + (gap + blockD) * 0.5;

      const block0: SkyriverMass = {
        x: topStage.x, y0: yCrown, z: b0z, width: blockW, height: crownH, depth: blockD,
        tint: tower.tint, anchorV: tower.z, materialOwner: towerSeed, building: towerSeed,
      };
      const block1: SkyriverMass = {
        x: topStage.x, y0: yCrown, z: b1z, width: blockW, height: crownH, depth: blockD,
        tint: tower.tint, anchorV: tower.z, materialOwner: towerSeed, building: towerSeed,
      };
      crownMasses.push(block0, block1);
      crownSpan = actualSpan;
      crownBounds = { y0: yCrown, y1: yCrown + crownH, width: blockW, height: crownH, depth: actualSpan };
      crownProfile = { kind: 'split', axis: 'z', gapM: gap, crownSpanM: actualSpan, bounds: crownBounds, massIndices: [0, 0] };
    } else {
      const uCorner = r36Hash01(layout.seed, tower, 7);
      const uCornerX = r36Hash01(layout.seed, tower, 8);
      const uCornerZ = r36Hash01(layout.seed, tower, 9);
      const uFinH = r36Hash01(layout.seed, tower, 10);
      const isCorner = uCorner < 0.40;

      const finW = Math.max(3, Math.round(topStage.width * (isCorner ? 0.18 : 0.15)));
      const finD = Math.round(topStage.depth * (isCorner ? 0.45 : 0.75));
      const finH = resolveOriginal
        ? (isCorner ? Math.round(36 + uFinH * 40) : Math.round(42 + uFinH * 24))
        : R36_ORDINARY_CROWN_HEIGHT_M;
      const yCrown = topStage.y1;

      const shiftX = Math.max(0, (topStage.width - finW) * 0.5 - 2);
      const shiftZ = Math.max(0, (topStage.depth - finD) * 0.5 - 2);
      const cornerX = uCornerX < 0.5 ? -1 : 1;
      const cornerZ = uCornerZ < 0.5 ? -1 : 1;
      const finX = isCorner ? topStage.x + cornerX * shiftX : topStage.x;
      const finZ = isCorner ? topStage.z + cornerZ * shiftZ : topStage.z;

      const fin: SkyriverMass = {
        x: finX, y0: yCrown, z: finZ, width: finW, height: finH, depth: finD,
        tint: tower.tint, anchorV: tower.z, materialOwner: towerSeed, building: towerSeed,
      };
      crownMasses.push(fin);
      crownSpan = finD;
      crownBounds = { y0: yCrown, y1: yCrown + finH, width: finW, height: finH, depth: finD };
      crownProfile = { kind: 'unsplit-fin', axis: 'z', gapM: 0, crownSpanM: finD, bounds: crownBounds, massIndices: [0] };
    }

    const faces: SkyriverFacadeFace[] = [];
    const tiers: FacadeTier[] = [];

    const wing0Face: SkyriverFacadeFace = {
      id: `${buildingId}:face-w0`,
      buildingId,
      side,
      planeAxis: 'x',
      plane: side * (Math.abs(wing0.x) - wing0.width * 0.5),
      outward: -side as -1 | 1,
      u0: wing0.z - wing0.depth * 0.5,
      u1: wing0.z + wing0.depth * 0.5,
      y0: Math.max(0, wing0.y0),
      y1: wingY1,
      stepBottom: false,
      stepTop: true,
      projection: 0,
      owner: ownerOf(wing0, tower.z),
    };
    const wing1Face: SkyriverFacadeFace = {
      id: `${buildingId}:face-w1`,
      buildingId,
      side,
      planeAxis: 'x',
      plane: side * (Math.abs(wing1.x) - wing1.width * 0.5),
      outward: -side as -1 | 1,
      u0: wing1.z - wing1.depth * 0.5,
      u1: wing1.z + wing1.depth * 0.5,
      y0: Math.max(0, wing1.y0),
      y1: wingY1,
      stepBottom: false,
      stepTop: true,
      projection: 0,
      owner: ownerOf(wing1, tower.z),
    };

    const st1FacePlane = side * (Math.abs(stage1Mass.x) - stage1Mass.width * 0.5);
    const st1Face: SkyriverFacadeFace = {
      id: `${buildingId}:face-1`,
      buildingId,
      side,
      planeAxis: 'x',
      plane: st1FacePlane,
      outward: -side as -1 | 1,
      u0: stage1Mass.z - stage1Mass.depth * 0.5,
      u1: stage1Mass.z + stage1Mass.depth * 0.5,
      y0: stage1Mass.y0,
      y1: stage1Mass.y0 + stage1Mass.height,
      stepBottom: true,
      stepTop: true,
      projection: 0,
      owner: ownerOf(stage1Mass, tower.z),
    };

    const hostFace = st1Face;

    faces.push(st1Face, wing0Face, wing1Face);
    tiers.push({ face: st1Face }, { face: wing0Face }, { face: wing1Face });

    for (let s = 2; s < stageMasses.length; s++) {
      const stMass = stageMasses[s]!;
      const stFace: SkyriverFacadeFace = {
        id: `${buildingId}:face-${s}`,
        buildingId,
        side,
        planeAxis: 'x',
        plane: side * (Math.abs(stMass.x) - stMass.width * 0.5),
        outward: -side as -1 | 1,
        u0: stMass.z - stMass.depth * 0.5,
        u1: stMass.z + stMass.depth * 0.5,
        y0: stMass.y0,
        y1: stMass.y0 + stMass.height,
        stepBottom: true,
        stepTop: s < stageMasses.length - 1,
        projection: 0,
        owner: ownerOf(stMass, tower.z),
      };
      faces.push(stFace);
      tiers.push({ face: stFace });
    }

    return {
      family,
      stageMasses,
      stageDrafts,
      spineMass,
      deckWingMasses: [],
      crownMasses: crownMasses.map((mass) => ({ ...mass, crownRole: 'ordinary-dark-crown' as const })),
      crownProfile,
      crownBounds,
      crownSpan,
      companionMasses: [],
      leanProfile,
      hostFace,
      faces,
      tiers,
    };
  }

  let stageCount: 2 | 3 | 4;
  if (heroRow !== undefined || isReservedHero) {
    stageCount = 2;
  } else if (family === 'broad-shelf') {
    stageCount = 3;
  } else if (family === 'offset-decks') {
    stageCount = tower.height >= 2500 ? 4 : 3;
  } else {
    stageCount = tower.height >= 3000 ? 3 : 2;
  }

  interface IntermediateStage {
    y0: number;
    y1: number;
    width: number;
    depth: number;
    x: number;
    z: number;
    parentStage: number | null;
    offsetAxis: 'x' | 'z' | 'none';
    parentSpan: number;
    centerDelta: number;
    ratio: number;
  }
  const stages: IntermediateStage[] = [];

  const defaultY1 = Math.round(tower.height * (stageCount === 2 ? 0.55 : stageCount === 3 ? 0.38 : 0.28));
  const reqTop = heroRow !== undefined ? Math.ceil(heroRow.faceTop + 10) : (heroReservedTop !== undefined ? Math.ceil(heroReservedTop) : 0);
  const y1 = reqTop > 0 ? Math.min(tower.height - 100, Math.max(defaultY1, reqTop)) : defaultY1;
  const w0 = stage0Override !== undefined ? stage0Override.width : (family === 'thin-slab-companion' ? Math.round(tower.width * 0.72) : tower.width);
  const d0 = stage0Override !== undefined ? stage0Override.depth : (family === 'thin-slab-companion' ? Math.round(tower.depth * 0.85) : tower.depth);
  const x0 = stage0Override !== undefined ? stage0Override.x : tower.x;
  const z0 = stage0Override !== undefined ? stage0Override.z : tower.z;
  stages.push({
    y0: voidY,
    y1,
    width: w0,
    depth: d0,
    x: x0,
    z: z0,
    parentStage: null,
    offsetAxis: 'none',
    parentSpan: 0,
    centerDelta: 0,
    ratio: 0,
  });

  let leanProfile: SkyriverLeanProfile | 'none' = 'none';

  if (isLeaning) {
    const targetAngle = 4.85;
    const tanTheta = Math.tan(targetAngle * Math.PI / 180);
    let curD = d0;
    let totalOffset = 0;
    const stageDeltas: number[] = [];
    for (let s = 1; s < stageCount; s++) {
      const minDelta = Math.ceil(curD * 0.085);
      const maxDelta = Math.floor(curD * 0.325);
      const deltaZ = Math.max(minDelta, Math.min(maxDelta, Math.round(0.20 * curD)));
      stageDeltas.push(deltaZ);
      totalOffset += deltaZ;
      if (family === 'broad-shelf') {
        curD = Math.round(curD * (s === 1 ? 1.25 : 0.60));
      } else {
        curD = Math.round(curD * (s === stageCount - 1 ? 0.65 : 0.82));
      }
    }
    const rise = Math.round(totalOffset / tanTheta);
    const upperY0 = Math.max(y1, tower.height - rise);
    stages[0]!.y1 = upperY0;

    let curY = upperY0;
    const numUpper = stageCount - 1;
    const stageH = (tower.height - upperY0) / numUpper;
    for (let s = 1; s < stageCount; s++) {
      const parent = stages[s - 1]!;
      const parentSpan = parent.depth;
      const sY0 = curY;
      const sY1 = s === stageCount - 1 ? tower.height : Math.round(curY + stageH);
      curY = sY1;
      let sw: number;
      let sd: number;
      if (family === 'broad-shelf') {
        sw = s === 1 ? parent.width : Math.round(stages[0]!.width * 0.60);
        sd = s === 1 ? Math.round(parent.depth * 1.25) : Math.round(stages[0]!.depth * 0.60);
      } else {
        sw = Math.round(parent.width * (s === stageCount - 1 ? 0.65 : 0.82));
        sd = Math.round(parent.depth * (s === stageCount - 1 ? 0.65 : 0.82));
      }
      const sDeltaZ = stageDeltas[s - 1]!;
      const sRatio = sDeltaZ / parentSpan;
      stages.push({
        y0: sY0,
        y1: sY1,
        width: sw,
        depth: sd,
        x: parent.x,
        z: parent.z + sDeltaZ,
        parentStage: s - 1,
        offsetAxis: 'z',
        parentSpan,
        centerDelta: sDeltaZ,
        ratio: sRatio,
      });
    }

    const actualRise = tower.height - upperY0;
    const actualTotalOffset = Math.abs(stages[stageCount - 1]!.z - stages[0]!.z);
    const actualAngle = Number((Math.atan(actualTotalOffset / actualRise) * 180 / Math.PI).toFixed(2));
    if (actualAngle >= 4.0 && actualAngle <= 6.0) {
      leanProfile = {
        axis: 'z',
        angleDeg: actualAngle,
        riseM: actualRise,
        totalOffsetM: actualTotalOffset,
      };
    }
  } else {
    let curY = y1;
    const remainingH = tower.height - y1;
    for (let s = 1; s < stageCount; s++) {
      const parent = stages[s - 1]!;
      const sY0 = curY;
      const sY1 = s === stageCount - 1 ? tower.height : Math.round(curY + remainingH / (stageCount - 1));
      curY = sY1;
      const axis = ((u3 + s * 0.37) % 1.0 < 0.6) ? 'z' : 'x';
      let sw: number;
      let sd: number;
      if (family === 'broad-shelf') {
        if (s === 1) {
          sd = Math.round(parent.depth * 1.25);
          sw = axis === 'x' ? Math.round(parent.width * 1.10) : parent.width;
        } else {
          sw = Math.round(stages[0]!.width * 0.60);
          sd = Math.round(stages[0]!.depth * 0.60);
        }
      } else {
        sw = Math.round(parent.width * (s === stageCount - 1 ? 0.68 : 0.82));
        sd = Math.round(parent.depth * (s === stageCount - 1 ? 0.68 : 0.82));
      }
      const parentSpan = axis === 'x' ? parent.width : parent.depth;
      const targetRatio =
        family === 'broad-shelf' ? (0.18 + 0.06 * u4)
        : (0.12 + 0.12 * u4);
      const minDelta = Math.ceil(parentSpan * 0.085);
      const maxDelta = Math.floor(parentSpan * 0.325);
      const centerDelta = Math.max(minDelta, Math.min(maxDelta, Math.round(targetRatio * parentSpan)));
      const ratio = centerDelta / parentSpan;
      const dir = ((u5 + s * 0.5) % 1.0 < 0.5 ? -1 : 1);
      const sx = axis === 'x' ? parent.x + side * centerDelta : parent.x;
      const sz = axis === 'z' ? parent.z + dir * centerDelta : parent.z;
      stages.push({
        y0: sY0,
        y1: sY1,
        width: sw,
        depth: sd,
        x: sx,
        z: sz,
        parentStage: s - 1,
        offsetAxis: axis,
        parentSpan,
        centerDelta,
        ratio,
      });
    }
  }

  const stageMasses: SkyriverMass[] = stages.map((st, sIdx) => ({
    x: st.x,
    y0: st.y0,
    z: st.z,
    width: st.width,
    height: st.y1 - st.y0,
    depth: st.depth,
    tint: tower.tint,
    anchorV: tower.z,
    building: towerSeed,
    materialOwner: towerSeed,
    stepBottom: sIdx > 0,
    stepTop: true,
  }));

  const top = stages[stages.length - 1]!;
  const crownMasses: SkyriverMass[] = [];
  let crownProfile: SkyriverCrownProfile;
  let crownBounds: { readonly y0: number; readonly y1: number; readonly width: number; readonly height: number; readonly depth: number };
  let crownSpan: number;

  if (isSplitCrown) {
    const rawSpan = Math.round(top.depth * 0.85);
    const gap = Math.round(rawSpan * 0.22);
    const blockD = Math.floor((rawSpan - gap) * 0.5);
    const actualSpan = gap + 2 * blockD;
    const blockW = Math.round(top.width * 0.7);
    const crownH = resolveOriginal ? 45 : R36_ORDINARY_CROWN_HEIGHT_M;
    const yCrown = top.y1;
    const b0z = top.z - (gap + blockD) * 0.5;
    const b1z = top.z + (gap + blockD) * 0.5;

    const block0: SkyriverMass = {
      x: top.x,
      y0: yCrown,
      z: b0z,
      width: blockW,
      height: crownH,
      depth: blockD,
      tint: tower.tint,
      anchorV: tower.z,
      materialOwner: towerSeed,
      building: towerSeed,
    };
    const block1: SkyriverMass = {
      x: top.x,
      y0: yCrown,
      z: b1z,
      width: blockW,
      height: crownH,
      depth: blockD,
      tint: tower.tint,
      anchorV: tower.z,
      materialOwner: towerSeed,
      building: towerSeed,
    };
    crownMasses.push(block0, block1);
    crownSpan = actualSpan;
    crownBounds = {
      y0: yCrown,
      y1: yCrown + crownH,
      width: blockW,
      height: crownH,
      depth: actualSpan,
    };
    crownProfile = {
      kind: 'split',
      axis: 'z',
      gapM: gap,
      crownSpanM: actualSpan,
      bounds: crownBounds,
      massIndices: [0, 0],
    };
  } else {
    const uCorner = r36Hash01(layout.seed, tower, 7);
    const uCornerX = r36Hash01(layout.seed, tower, 8);
    const uCornerZ = r36Hash01(layout.seed, tower, 9);
    const uFinH = r36Hash01(layout.seed, tower, 10);
    const isCorner = uCorner < 0.40;

    const finW = Math.max(3, Math.round(top.width * (isCorner ? 0.18 : 0.15)));
    const finD = Math.round(top.depth * (isCorner ? 0.45 : 0.75));
    const finH = resolveOriginal
      ? (isCorner ? Math.round(36 + uFinH * 40) : Math.round(42 + uFinH * 24))
      : R36_ORDINARY_CROWN_HEIGHT_M;
    const yCrown = top.y1;

    const shiftX = Math.max(0, (top.width - finW) * 0.5 - 2);
    const shiftZ = Math.max(0, (top.depth - finD) * 0.5 - 2);
    const cornerX = uCornerX < 0.5 ? -1 : 1;
    const cornerZ = uCornerZ < 0.5 ? -1 : 1;
    const finX = isCorner ? top.x + cornerX * shiftX : top.x;
    const finZ = isCorner ? top.z + cornerZ * shiftZ : top.z;

    const fin: SkyriverMass = {
      x: finX,
      y0: yCrown,
      z: finZ,
      width: finW,
      height: finH,
      depth: finD,
      tint: tower.tint,
      anchorV: tower.z,
      materialOwner: towerSeed,
      building: towerSeed,
    };
    crownMasses.push(fin);
    crownSpan = finD;
    crownBounds = {
      y0: yCrown,
      y1: yCrown + finH,
      width: finW,
      height: finH,
      depth: finD,
    };
    crownProfile = {
      kind: 'unsplit-fin',
      axis: 'z',
      gapM: 0,
      crownSpanM: finD,
      bounds: crownBounds,
      massIndices: [0],
    };
  }

  const companionMasses: SkyriverMass[] = [];
  if (family === 'thin-slab-companion') {
    const originalCompW = Math.round(tower.width * 0.60);
    const originalCompD = Math.round(tower.depth * 0.60);
    const compW = Math.round(originalCompW * companionScale);
    const compD = Math.round(originalCompD * companionScale);
    const compH = Math.round(tower.height * 0.35);
    const compX = tower.x + side * (tower.width * 0.5 + originalCompW * 0.5 + 4);
    const compZ = tower.z + side * 15;
    companionMasses.push({
      x: compX,
      y0: SKYRIVER_CITY_VOID_BASE_Y,
      z: compZ,
      width: compW,
      height: compH - SKYRIVER_CITY_VOID_BASE_Y,
      depth: compD,
      tint: tower.tint,
      anchorV: tower.z,
      materialOwner: towerSeed,
      building: towerSeed,
    });
  }

  const st0 = stages[0]!;
  const st0Mass = stageMasses[0]!;
  const st0FaceOwner = ownerOf(st0Mass, tower.z);

  const faces: SkyriverFacadeFace[] = [];
  const tiers: FacadeTier[] = [];

  const hostFace: SkyriverFacadeFace = {
    id: `${buildingId}:face-0`,
    buildingId,
    side,
    planeAxis: 'x',
    plane: side * (Math.abs(st0.x) - st0.width * 0.5),
    outward: -side as -1 | 1,
    u0: st0.z - st0.depth * 0.5,
    u1: st0.z + st0.depth * 0.5,
    y0: Math.max(0, st0.y0),
    y1: st0.y1,
    stepBottom: false,
    stepTop: true,
    projection: 0,
    owner: st0FaceOwner,
  };

  faces.push(hostFace);
  tiers.push({ face: hostFace });

  for (let s = 1; s < stages.length; s++) {
    const st = stages[s]!;
    const stMass = stageMasses[s]!;
    const facePlane = side * (Math.abs(st.x) - st.width * 0.5);
    const stageFace: SkyriverFacadeFace = {
      id: `${buildingId}:face-${s}`,
      buildingId,
      side,
      planeAxis: 'x',
      plane: facePlane,
      outward: -side as -1 | 1,
      u0: st.z - st.depth * 0.5,
      u1: st.z + st.depth * 0.5,
      y0: st.y0,
      y1: st.y1,
      stepBottom: true,
      stepTop: s < stages.length - 1,
      projection: 0,
      owner: ownerOf(stMass, tower.z),
    };
    faces.push(stageFace);
    tiers.push({ face: stageFace });
  }

  const stageDrafts: R36StageDraft[] = stages.map((st, sIdx) => {
    let offset: SkyriverStageOffset | null = null;
    if (sIdx > 0) {
      const parent = stages[st.parentStage ?? (sIdx - 1)]!;
      const axis = st.offsetAxis as 'x' | 'z';
      const span = axis === 'x' ? parent.width : parent.depth;
      const delta = axis === 'x' ? (st.x - parent.x) : (st.z - parent.z);
      const ratio = Math.abs(delta) / span;
      offset = {
        axis,
        parentKind: 'stage',
        parentStageIndex: st.parentStage ?? (sIdx - 1),
        parentSpanM: span,
        deltaM: delta,
        ratio,
      };
    }
    return {
      stageIndex: sIdx,
      masses: [stageMasses[sIdx]!],
      footprint: {
        x: st.x,
        z: st.z,
        width: st.width,
        depth: st.depth,
      },
      verticalBounds: {
        y0: st.y0,
        y1: st.y1,
        height: st.y1 - st.y0,
      },
      offset,
    };
  });

  return {
    family,
    stageMasses,
    stageDrafts,
    spineMass: null,
    deckWingMasses: [],
    crownMasses: crownMasses.map((mass) => ({ ...mass, crownRole: 'ordinary-dark-crown' as const })),
    crownProfile,
    crownBounds,
    crownSpan,
    companionMasses,
    leanProfile,
    hostFace: heroRow !== undefined ? faces[0]! : hostFace,
    faces,
    tiers,
  };
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
    return { x: Math.sign(tower.x) * (wallFace + back) * 0.5, z: tower.z, width: back - wallFace, depth: tower.depth, anchorV: tower.z,
      materialOwner: buildingSeedOf(tower.x, tower.z) };
  };
  const tierMap = new Map<string, readonly FacadeTier[]>();
  const exposedFaces: SkyriverFacadeFace[] = [];
  const heroRows = deriveHeroRowPlans(layout);
  const reservedHeroTowers = deriveReservedHeroTowers(layout);
  tierCache.set(layout.seed, tierMap);
  const legacyBodyMassesByTower = new Map<string, Set<SkyriverMass>>();
  const legacyCapMassesByTower = new Map<string, Set<SkyriverMass>>();
  const legacyFacesByTower = new Map<string, Set<SkyriverFacadeFace>>();
  const towerKeyByLegacyFace = new Map<SkyriverFacadeFace, string>();

  const recordLegacyBody = (tower: SkyriverTower, mass: SkyriverMass): void => {
    const key = towerKey(tower);
    let bucket = legacyBodyMassesByTower.get(key);
    if (bucket === undefined) {
      bucket = new Set<SkyriverMass>();
      legacyBodyMassesByTower.set(key, bucket);
    }
    bucket.add(mass);
  };

  const recordLegacyCap = (tower: SkyriverTower, mass: SkyriverMass): void => {
    const key = towerKey(tower);
    let bucket = legacyCapMassesByTower.get(key);
    if (bucket === undefined) {
      bucket = new Set<SkyriverMass>();
      legacyCapMassesByTower.set(key, bucket);
    }
    bucket.add(mass);
  };

  const recordLegacyFace = (tower: SkyriverTower, face: SkyriverFacadeFace): void => {
    const key = towerKey(tower);
    let bucket = legacyFacesByTower.get(key);
    if (bucket === undefined) {
      bucket = new Set<SkyriverFacadeFace>();
      legacyFacesByTower.set(key, bucket);
    }
    bucket.add(face);
    towerKeyByLegacyFace.set(face, key);
  };

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
        if (k < tops.length && projection > 0) {
          masses.push(tierMass);
          recordLegacyBody(tower, tierMass);
        }
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
        recordLegacyFace(tower, facadeFace);
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
      const crown1: SkyriverMass = { x: tower.x, y0: h - 2, z: tower.z, width: crownW, height: crownH, depth: crownD, tint: tower.tint, materialOwner: buildingSeedOf(tower.x, tower.z) };
      masses.push(crown1);
      recordLegacyBody(tower, crown1);
      if (random.nextInt(0, 99) < 60) {
        const crown2: SkyriverMass = { x: tower.x, y0: h + crownH - 2, z: tower.z, width: crownW * 0.5, height: 25 + random.nextInt(0, 50), depth: crownD * 0.55, tint: tower.tint, materialOwner: buildingSeedOf(tower.x, tower.z) };
        masses.push(crown2);
        recordLegacyBody(tower, crown2);
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
        if (legacy) {
          const capMass: SkyriverMass = { x: tower.x, y0: y, z: tower.z, width: w, height: h, depth: d, tint: tower.tint, materialOwner: buildingSeedOf(tower.x, tower.z) };
          recordLegacyCap(tower, capMass);
          masses.push(capMass);
        }
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

  deriveMassingVariation(layout, innerWalls, masses, push, recordLegacyBody);

  // Every derived slab, extended down into the void so no wall has a visible foot.
  for (const tower of layout.towers) {
    const tiers = tierMap.get(towerKey(tower));
    if (tiers === undefined || tiers.length < 2) {
      const slabMass: SkyriverMass = {
        x: tower.x,
        y0: SKYRIVER_CITY_VOID_BASE_Y,
        z: tower.z,
        width: tower.width,
        height: tower.height - SKYRIVER_CITY_VOID_BASE_Y,
        depth: tower.depth,
        tint: tower.tint,
        materialOwner: buildingSeedOf(tower.x, tower.z),
      };
      recordLegacyBody(tower, slabMass);
      masses.unshift(slabMass);
      continue;
    }
    for (let i = tiers.length - 1; i >= 0; i -= 1) {
      const face = tiers[i]!.face;
      const slabMass: SkyriverMass = {
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
      };
      recordLegacyBody(tower, slabMass);
      masses.unshift(slabMass);
    }
  }

  const legacyWorld = [...masses];
  const legacyPrefixLength = legacyWorld.length;
  const seedIndices = new WeakMap<SkyriverMass, number>();
  for (let m = 0; m < legacyPrefixLength; m += 1) {
    seedIndices.set(legacyWorld[m]!, m);
  }

  // --- R36 profile deterministic overlay --------------------------------------------------------
  // 1. Derive R36 rows after the old random stream is complete.
  //    Use the existing layout index, inner-wall predicate, near-mega test,
  //    innerEligibleCount rule, heroRows, reservedHeroTowers, and deriveR36TowerData.
  const r36DataByTower = new Map<string, R36EmittedData>();
  const apexes = canyonBendApexes(900);
  const r36InputsByTower = new Map<string, {
    readonly tower: SkyriverTower;
    readonly index: number;
    readonly isSplitCrown: boolean;
    readonly row?: HeroRowPlan;
    readonly isReservedHero: boolean;
    readonly heroReservedTop?: number;
  }>();
  let innerEligibleCount = 0;
  for (let index = 0; index < layout.towers.length; index += 1) {
    const tower = layout.towers[index]!;
    if (isEligibleTower(layout, tower)) {
      const isInner = Math.abs(Math.abs(tower.x) - innerWallX(layout, tower)) < 1;
      const side = Math.sign(tower.x);
      const nearMega = side === 1 && apexes.some((a) => Math.abs(tower.z - a.v) < 950);
      let isSplitCrown = false;
      if (isInner && !nearMega) {
        if (innerEligibleCount % 4 !== 3) {
          isSplitCrown = true;
        }
        innerEligibleCount += 1;
      }
      const row = heroRows.find((candidate) => candidate.tower === tower);
      const isReservedHero = reservedHeroTowers.has(towerKey(tower));
      const heroReservedTop = reservedHeroTowers.get(towerKey(tower));
      // Resolve the original geometry before the final crown and stage pass.
      const r36Data = deriveR36TowerData(
        layout, tower, index, isSplitCrown, row, isReservedHero, heroReservedTop,
        undefined, undefined, 1, true,
      );
      r36InputsByTower.set(towerKey(tower), {
        tower,
        index,
        isSplitCrown,
        row,
        isReservedHero,
        heroReservedTop,
      });
      r36DataByTower.set(towerKey(tower), r36Data);
    }
  }

  // 2. Remove only legacy body objects recorded for towers with an R36 profile.
  const replacedMasses = new Set<SkyriverMass>();
  for (const [key, bodies] of legacyBodyMassesByTower) {
    if (r36DataByTower.has(key)) {
      for (const mass of bodies) replacedMasses.add(mass);
    }
  }
  for (const [key, caps] of legacyCapMassesByTower) {
    if (r36DataByTower.has(key)) {
      for (const mass of caps) replacedMasses.add(mass);
    }
  }
  const keptMasses = masses.filter((mass) => !replacedMasses.has(mass));
  masses.length = 0;
  masses.push(...keptMasses);

  // Preserve an immutable per-seed copy of the actual legacy exposed face objects
  // before Stage A replaces them in the overlay.
  legacyFaceCache.set(layout.seed, Object.freeze([...exposedFaces]));

  // 3. Replace legacy faces by object identity. Preserve all untagged faces.
  //    For an inner-wall profile, append the same r36Data.faces that the current
  //    inner loop exposes. Keep current outer-face exposure policy in Stage A.
  //    Set tierMap[key] = r36Data.tiers for every eligible profile.
  const replacedFaces = new Set<SkyriverFacadeFace>();
  for (const [key, faces] of legacyFacesByTower) {
    if (r36DataByTower.has(key)) {
      for (const face of faces) replacedFaces.add(face);
    }
  }

  const finalExposedFaces: SkyriverFacadeFace[] = [];
  const emittedTowers = new Set<string>();
  for (const face of exposedFaces) {
    if (replacedFaces.has(face)) {
      const key = towerKeyByLegacyFace.get(face)!;
      if (!emittedTowers.has(key)) {
        emittedTowers.add(key);
        const data = r36DataByTower.get(key);
        if (data !== undefined) {
          for (const f of data.faces) {
            finalExposedFaces.push(f);
          }
        }
      }
    } else {
      finalExposedFaces.push(face);
    }
  }
  for (const wall of innerWalls) {
    for (const tower of wall) {
      const key = towerKey(tower);
      if (!emittedTowers.has(key)) {
        const data = r36DataByTower.get(key);
        if (data !== undefined) {
          emittedTowers.add(key);
          for (const f of data.faces) {
            finalExposedFaces.push(f);
          }
        }
      }
    }
  }
  exposedFaces.length = 0;
  exposedFaces.push(...finalExposedFaces);

  for (const [key, data] of r36DataByTower) {
    tierMap.set(key, data.tiers);
  }

  const initialFirstMassByTower = new Map<SkyriverMass, string>();
  const initialRemainingMasses = new Set<SkyriverMass>();
  const allInitialProfileMasses = new Set<SkyriverMass>();
  for (const tower of layout.towers) {
    const key = towerKey(tower);
    const data = r36DataByTower.get(key);
    if (data !== undefined) {
      const towerMasses: SkyriverMass[] = [
        ...data.stageMasses,
        ...data.crownMasses,
        ...(data.spineMass ? [data.spineMass] : []),
        ...data.deckWingMasses,
        ...data.companionMasses,
      ];
      if (towerMasses.length > 0) {
        initialFirstMassByTower.set(towerMasses[0]!, key);
        for (let m = 1; m < towerMasses.length; m += 1) {
          initialRemainingMasses.add(towerMasses[m]!);
        }
      }
      for (const m of towerMasses) allInitialProfileMasses.add(m);
    }
  }
  const initialFirstFaceByTower = new Map<SkyriverFacadeFace, string>();
  const initialRemainingFaces = new Set<SkyriverFacadeFace>();
  for (const [key, data] of r36DataByTower) {
    if (data.faces.length > 0) {
      initialFirstFaceByTower.set(data.faces[0]!, key);
      for (let f = 1; f < data.faces.length; f += 1) initialRemainingFaces.add(data.faces[f]!);
    }
  }

  // 4. Append R36 masses once in layout.towers order:
  //    stageMasses, crownMasses, spineMass (when present), deckWingMasses,
  //    companionMasses. Do not call random or push here.
  for (const tower of layout.towers) {
    const r36Data = r36DataByTower.get(towerKey(tower));
    if (r36Data !== undefined) {
      for (const sm of r36Data.stageMasses) masses.push(sm);
      for (const cm of r36Data.crownMasses) masses.push(cm);
      if (r36Data.spineMass) masses.push(r36Data.spineMass);
      for (const wm of r36Data.deckWingMasses) masses.push(wm);
      for (const cpm of r36Data.companionMasses) masses.push(cpm);
    }
  }

  // 5. tierCache.set(layout.seed, tierMap) now points to final profile tiers.
  tierCache.set(layout.seed, tierMap);

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
  const r27StartIndex = count;
  appendLowBaseSprawl(layout, legacyWorld, pushBaseTrim, baseRandom, () => count, cap);
  const r27EndIndex = count;
  const r27Tail = legacyWorld.slice(legacyPrefixLength);
  for (let tailOrdinal = 0; tailOrdinal < r27Tail.length; tailOrdinal += 1) {
    const tailMass = r27Tail[tailOrdinal]!;
    masses.push(tailMass);
    seedIndices.set(tailMass, legacyPrefixLength + tailOrdinal);
  }

  const createSpatialIndex = (expectedCapacity: number): RoofDetailCollisionIndex => ({
    cellSize: ROOF_DETAIL_SPATIAL_CELL_M,
    cells: new Map(),
    boxes: [],
    stamps: new Int32Array(Math.max(expectedCapacity + 256, 1024)),
    stamp: 0,
  });

  const fixedMasses = masses.filter((m) => !allInitialProfileMasses.has(m));
  const fixedIndex = createSpatialIndex(fixedMasses.length);
  for (let massIndex = 0; massIndex < fixedMasses.length; massIndex += 1) {
    const mass = fixedMasses[massIndex]!;
    if (mass.width <= 0 || mass.height <= 0 || mass.depth <= 0) continue;
    roofDetailInsert(fixedIndex, roofDetailMassObb(mass, massIndex));
  }

  const buildProfileIndex = (r36Map: Map<string, R36EmittedData>): RoofDetailCollisionIndex => {
    let massCount = 0;
    for (const d of r36Map.values()) {
      massCount += d.stageMasses.length + d.crownMasses.length + (d.spineMass ? 1 : 0) + d.deckWingMasses.length + d.companionMasses.length;
    }
    const idx = createSpatialIndex(massCount);
    let massIdx = 0;
    for (const d of r36Map.values()) {
      for (const m of d.stageMasses) {
        if (m.width > 0 && m.height > 0 && m.depth > 0) roofDetailInsert(idx, roofDetailMassObb(m, massIdx));
        massIdx += 1;
      }
      for (const m of d.crownMasses) {
        if (m.width > 0 && m.height > 0 && m.depth > 0) roofDetailInsert(idx, roofDetailMassObb(m, massIdx));
        massIdx += 1;
      }
      if (d.spineMass && d.spineMass.width > 0 && d.spineMass.height > 0 && d.spineMass.depth > 0) {
        roofDetailInsert(idx, roofDetailMassObb(d.spineMass, massIdx));
        massIdx += 1;
      }
      for (const m of d.deckWingMasses) {
        if (m.width > 0 && m.height > 0 && m.depth > 0) roofDetailInsert(idx, roofDetailMassObb(m, massIdx));
        massIdx += 1;
      }
      for (const m of d.companionMasses) {
        if (m.width > 0 && m.height > 0 && m.depth > 0) roofDetailInsert(idx, roofDetailMassObb(m, massIdx));
        massIdx += 1;
      }
    }
    return idx;
  };

  const isAirBlocked = (data: R36EmittedData, tower: SkyriverTower, pIndex: RoofDetailCollisionIndex): boolean => {
    const spine = data.spineMass;
    const sx0 = spine ? spine.x - spine.width * 0.5 : 0;
    const sx1 = spine ? spine.x + spine.width * 0.5 : 0;
    const sz0 = spine ? spine.z - spine.depth * 0.5 : 0;
    const sz1 = spine ? spine.z + spine.depth * 0.5 : 0;

    if (data.family !== 'supported-spine' || !data.stageDrafts[0] || data.stageDrafts[0].stageIndex !== 0 || data.stageDrafts[0].masses.length !== 2) return true;

    for (const wing of data.stageDrafts[0].masses) {
      const wingTop = wing.y0 + wing.height;
      const rx0 = wing.x - wing.width * 0.5;
      const rx1 = wing.x + wing.width * 0.5;
      const rz0 = wing.z - wing.depth * 0.5;
      const rz1 = wing.z + wing.depth * 0.5;

      const rects: { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number }[] = [];
      let hasInt = false;
      if (spine !== null) {
        const ix0 = Math.max(rx0, sx0);
        const ix1 = Math.min(rx1, sx1);
        const iz0 = Math.max(rz0, sz0);
        const iz1 = Math.min(rz1, sz1);
        if (ix1 > ix0 && iz1 > iz0) {
          hasInt = true;
          if (ix0 > rx0) rects.push({ x0: rx0, x1: ix0, z0: rz0, z1: rz1 });
          if (rx1 > ix1) rects.push({ x0: ix1, x1: rx1, z0: rz0, z1: rz1 });
          if (iz0 > rz0) rects.push({ x0: ix0, x1: ix1, z0: rz0, z1: iz0 });
          if (rz1 > iz1) rects.push({ x0: ix0, x1: ix1, z0: iz1, z1: rz1 });
        }
      }
      if (!hasInt) rects.push({ x0: rx0, x1: rx1, z0: rz0, z1: rz1 });

      const anchorV = wing.anchorV ?? tower.z;
      const prismY = wingTop + 4;
      for (const r of rects) {
        const pw = r.x1 - r.x0;
        const pd = r.z1 - r.z0;
        if (pw <= 0 || pd <= 0) continue;
        warpRigid((r.x0 + r.x1) * 0.5, (r.z0 + r.z1) * 0.5, anchorV, roofDetailWarp);
        const obb = roofDetailBox(roofDetailWarp.x, prismY, roofDetailWarp.z, pw, 8, pd, roofDetailWarp.heading);
        if (roofDetailIndexConflicts(fixedIndex, obb, 0) || roofDetailIndexConflicts(pIndex, obb, 0)) return true;
      }
    }
    return false;
  };

  let profileIndex = buildProfileIndex(r36DataByTower);
  const maxScans = layout.towers.length + 1;
  for (let scan = 0; scan < maxScans; scan += 1) {
    let convertedAny = false;
    for (let i = 0; i < layout.towers.length; i += 1) {
      const tower = layout.towers[i]!;
      const key = towerKey(tower);
      const data = r36DataByTower.get(key);
      if (data === undefined || data.family !== 'supported-spine') continue;
      if (isAirBlocked(data, tower, profileIndex)) {
        const inp = r36InputsByTower.get(key)!;
        const rebuilt = deriveR36TowerData(
          layout, inp.tower, inp.index, inp.isSplitCrown, inp.row, inp.isReservedHero, inp.heroReservedTop,
          'offset-decks', undefined, 1, true,
        );
        r36DataByTower.set(key, rebuilt);
        profileIndex = buildProfileIndex(r36DataByTower);
        convertedAny = true;
        break;
      }
    }
    if (!convertedAny) break;
  }

  // --- R36 Stage C: bounded indexed roof-fit pass ------------------------------------------------
  interface SkirtRoofEntry {
    readonly id: number;
    readonly mass: SkyriverMass;
    readonly samples: readonly { readonly x: number; readonly y: number; readonly z: number }[];
  }

  const skirtRoofs: SkirtRoofEntry[] = [];
  const sampleCellMap = new Map<string, number[]>();
  for (let mIdx = 0; mIdx < masses.length; mIdx += 1) {
    const m = masses[mIdx]!;
    if (isLowBaseMass(m) && m.baseRecord.kind === 'skirt') {
      const rId = skirtRoofs.length;
      const roofY = m.y0 + m.height;
      const anchorV = m.anchorV ?? m.z;
      const pts: { readonly x: number; readonly y: number; readonly z: number }[] = [];
      const touchedCells = new Set<string>();
      for (let gx = 0; gx < 7; gx += 1) {
        for (let gz = 0; gz < 7; gz += 1) {
          const u = (gx + 0.5) / 7;
          const v = (gz + 0.5) / 7;
          const px = m.x - m.width * 0.5 + u * m.width;
          const pz = m.z - m.depth * 0.5 + v * m.depth;
          warpRigid(px, pz, anchorV, roofDetailWarp);
          const wx = roofDetailWarp.x;
          const wz = roofDetailWarp.z;
          pts.push({ x: wx, y: roofY, z: wz });
          const cx = Math.floor(wx / ROOF_DETAIL_SPATIAL_CELL_M);
          const cz = Math.floor(wz / ROOF_DETAIL_SPATIAL_CELL_M);
          touchedCells.add(roofDetailCellKey(cx, cz));
        }
      }
      for (const cellKey of touchedCells) {
        const list = sampleCellMap.get(cellKey);
        if (list === undefined) sampleCellMap.set(cellKey, [rId]);
        else list.push(rId);
      }
      skirtRoofs.push({ id: rId, mass: m, samples: Object.freeze(pts) });
    }
  }

  const fixedBoxToMass = new Map<RoofDetailObb, SkyriverMass>();
  for (let bIdx = 0; bIdx < fixedIndex.boxes.length; bIdx += 1) {
    const box = fixedIndex.boxes[bIdx]!;
    if (box.massIndex !== undefined) {
      const fm = fixedMasses[box.massIndex];
      if (fm !== undefined) fixedBoxToMass.set(box, fm);
    }
  }

  const boxToMass = new Map<RoofDetailObb, SkyriverMass>();
  const boxToProfileKey = new Map<RoofDetailObb, string>();
  const profileMasses = new Map<string, SkyriverMass[]>();
  const profileBoxes = new Map<string, RoofDetailObb[]>();
  const activeMasses = new Set<SkyriverMass>();

  const activeProfileIndex = createSpatialIndex(2048);
  for (const [key, data] of r36DataByTower) {
    const mList: SkyriverMass[] = [
      ...data.stageMasses,
      ...data.crownMasses,
      ...(data.spineMass ? [data.spineMass] : []),
      ...data.deckWingMasses,
      ...data.companionMasses,
    ];
    const bList: RoofDetailObb[] = [];
    for (let i = 0; i < mList.length; i += 1) {
      const m = mList[i]!;
      if (m.width <= 0 || m.height <= 0 || m.depth <= 0) continue;
      activeMasses.add(m);
      const obb = roofDetailMassObb(m, 0);
      boxToMass.set(obb, m);
      boxToProfileKey.set(obb, key);
      bList.push(obb);
      roofDetailInsert(activeProfileIndex, obb);
    }
    profileMasses.set(key, mList);
    profileBoxes.set(key, bList);
  }

  const pointInObb = (pt: { readonly x: number; readonly y: number; readonly z: number }, box: RoofDetailObb): boolean => {
    if (Math.abs(pt.y - box.y) > box.halfY + 0.01) return false;
    const dx = pt.x - box.x;
    const dz = pt.z - box.z;
    if (Math.abs(dx * box.ux + dz * box.uz) > box.halfX + 0.01) return false;
    if (Math.abs(dx * box.vx + dz * box.vz) > box.halfZ + 0.01) return false;
    return true;
  };

  const isCoveredPoint = (
    pt: { readonly x: number; readonly y: number; readonly z: number },
    maskProfileKey?: string,
    candBoxes?: readonly RoofDetailObb[],
  ): boolean => {
    const fMinGx = Math.floor((pt.x - 0.01) / fixedIndex.cellSize);
    const fMaxGx = Math.floor((pt.x + 0.01) / fixedIndex.cellSize);
    const fMinGz = Math.floor((pt.z - 0.01) / fixedIndex.cellSize);
    const fMaxGz = Math.floor((pt.z + 0.01) / fixedIndex.cellSize);
    for (let gx = fMinGx; gx <= fMaxGx; gx += 1) {
      for (let gz = fMinGz; gz <= fMaxGz; gz += 1) {
        const bucket = fixedIndex.cells.get(roofDetailCellKey(gx, gz));
        if (bucket !== undefined) {
          for (let i = 0; i < bucket.length; i += 1) {
            const box = fixedIndex.boxes[bucket[i]!]!;
            const fm = fixedBoxToMass.get(box);
            if (fm !== undefined && isLowBaseMass(fm)) continue;
            if (pointInObb(pt, box)) return true;
          }
        }
      }
    }
    if (candBoxes !== undefined) {
      for (let i = 0; i < candBoxes.length; i += 1) {
        if (pointInObb(pt, candBoxes[i]!)) return true;
      }
    }
    const pMinGx = Math.floor((pt.x - 0.01) / activeProfileIndex.cellSize);
    const pMaxGx = Math.floor((pt.x + 0.01) / activeProfileIndex.cellSize);
    const pMinGz = Math.floor((pt.z - 0.01) / activeProfileIndex.cellSize);
    const pMaxGz = Math.floor((pt.z + 0.01) / activeProfileIndex.cellSize);
    for (let gx = pMinGx; gx <= pMaxGx; gx += 1) {
      for (let gz = pMinGz; gz <= pMaxGz; gz += 1) {
        const bucket = activeProfileIndex.cells.get(roofDetailCellKey(gx, gz));
        if (bucket !== undefined) {
          for (let i = 0; i < bucket.length; i += 1) {
            const box = activeProfileIndex.boxes[bucket[i]!]!;
            if (maskProfileKey !== undefined && boxToProfileKey.get(box) === maskProfileKey) continue;
            const m = boxToMass.get(box);
            if (m === undefined || !activeMasses.has(m)) continue;
            if (pointInObb(pt, box)) return true;
          }
        }
      }
    }
    return false;
  };

  const roofCoveredCounts = new Int32Array(skirtRoofs.length);
  for (let rId = 0; rId < skirtRoofs.length; rId += 1) {
    const skirt = skirtRoofs[rId]!;
    let cov = 0;
    for (let sIdx = 0; sIdx < 49; sIdx += 1) {
      if (isCoveredPoint(skirt.samples[sIdx]!)) cov += 1;
    }
    roofCoveredCounts[rId] = cov;
  }

  const wingAirPrisms: RoofDetailObb[] = [];
  for (let i = 0; i < layout.towers.length; i += 1) {
    const tower = layout.towers[i]!;
    const key = towerKey(tower);
    const d = r36DataByTower.get(key);
    if (d === undefined || d.family !== 'supported-spine') continue;
    if (!d.stageDrafts[0] || d.stageDrafts[0].stageIndex !== 0 || d.stageDrafts[0].masses.length !== 2) continue;
    const spine = d.spineMass;
    const sx0 = spine ? spine.x - spine.width * 0.5 : 0;
    const sx1 = spine ? spine.x + spine.width * 0.5 : 0;
    const sz0 = spine ? spine.z - spine.depth * 0.5 : 0;
    const sz1 = spine ? spine.z + spine.depth * 0.5 : 0;
    for (const wing of d.stageDrafts[0].masses) {
      const wingTop = wing.y0 + wing.height;
      const rx0 = wing.x - wing.width * 0.5;
      const rx1 = wing.x + wing.width * 0.5;
      const rz0 = wing.z - wing.depth * 0.5;
      const rz1 = wing.z + wing.depth * 0.5;
      const rects: { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number }[] = [];
      let hasInt = false;
      if (spine !== null) {
        const ix0 = Math.max(rx0, sx0);
        const ix1 = Math.min(rx1, sx1);
        const iz0 = Math.max(rz0, sz0);
        const iz1 = Math.min(rz1, sz1);
        if (ix1 > ix0 && iz1 > iz0) {
          hasInt = true;
          if (ix0 > rx0) rects.push({ x0: rx0, x1: ix0, z0: rz0, z1: rz1 });
          if (rx1 > ix1) rects.push({ x0: ix1, x1: rx1, z0: rz0, z1: rz1 });
          if (iz0 > rz0) rects.push({ x0: ix0, x1: ix1, z0: rz0, z1: iz0 });
          if (rz1 > iz1) rects.push({ x0: ix0, x1: ix1, z0: iz1, z1: rz1 });
        }
      }
      if (!hasInt) rects.push({ x0: rx0, x1: rx1, z0: rz0, z1: rz1 });
      const anchorV = wing.anchorV ?? tower.z;
      const prismY = wingTop + 4;
      for (const r of rects) {
        const pw = r.x1 - r.x0;
        const pd = r.z1 - r.z0;
        if (pw <= 0 || pd <= 0) continue;
        warpRigid((r.x0 + r.x1) * 0.5, (r.z0 + r.z1) * 0.5, anchorV, roofDetailWarp);
        const obb = roofDetailBox(roofDetailWarp.x, prismY, roofDetailWarp.z, pw, 8, pd, roofDetailWarp.heading);
        wingAirPrisms.push(obb);
      }
    }
  }
  const wingAirIndex = createSpatialIndex(wingAirPrisms.length);
  for (let pIdx = 0; pIdx < wingAirPrisms.length; pIdx += 1) {
    roofDetailInsert(wingAirIndex, wingAirPrisms[pIdx]!);
  }

  const checkStageContact = (drafts: readonly R36StageDraft[]): boolean => {
    for (let s = 1; s < drafts.length; s += 1) {
      const parent = drafts[s - 1]!;
      const child = drafts[s]!;
      if (Math.abs(child.verticalBounds.y0 - parent.verticalBounds.y1) > 0.01) return false;
      const xOverlap = Math.min(parent.footprint.x + parent.footprint.width * 0.5, child.footprint.x + child.footprint.width * 0.5) -
        Math.max(parent.footprint.x - parent.footprint.width * 0.5, child.footprint.x - child.footprint.width * 0.5);
      const zOverlap = Math.min(parent.footprint.z + parent.footprint.depth * 0.5, child.footprint.z + child.footprint.depth * 0.5) -
        Math.max(parent.footprint.z - parent.footprint.depth * 0.5, child.footprint.z - child.footprint.depth * 0.5);
      if (xOverlap <= 0 || zOverlap <= 0) return false;
    }
    return true;
  };

  const computeLowerCorridorExtent = (side: number, data: R36EmittedData): number => {
    const lowerMasses: SkyriverMass[] = [
      ...(data.stageDrafts[0] ? data.stageDrafts[0].masses : []),
      ...data.companionMasses,
      ...data.deckWingMasses,
    ];
    let minExtent = Infinity;
    for (let i = 0; i < lowerMasses.length; i += 1) {
      const m = lowerMasses[i]!;
      if (m.width <= 0 || m.height <= 0 || m.depth <= 0) continue;
      const ext = side * m.x - m.width * 0.5;
      if (ext < minExtent) minExtent = ext;
    }
    return minExtent;
  };

  const CANDIDATE_SCALES = [0.90, 0.80, 0.60, 0.40, 0.25, 0.10] as const;

  interface MutableProfileRecord {
    readonly key: string;
    readonly tower: SkyriverTower;
    readonly side: number;
    readonly initialFamily: SkyriverShapeFamily;
    readonly initialStage0: { readonly width: number; readonly depth: number; readonly x: number; readonly z: number };
    readonly initialCorridorExtent: number;
    cursor: number;
  }

  const mutableRecords = new Map<string, MutableProfileRecord>();
  for (let i = 0; i < layout.towers.length; i += 1) {
    const tower = layout.towers[i]!;
    const key = towerKey(tower);
    const data = r36DataByTower.get(key);
    if (data === undefined || data.family === 'supported-spine') continue;
    const inp = r36InputsByTower.get(key)!;
    if (inp.row !== undefined || inp.isReservedHero) continue;
    const side = Math.sign(tower.x);
    const st0 = data.stageDrafts[0]!.footprint;
    const initialCorridorExtent = computeLowerCorridorExtent(side, data);
    mutableRecords.set(key, {
      key,
      tower,
      side,
      initialFamily: data.family,
      initialStage0: { width: st0.width, depth: st0.depth, x: st0.x, z: st0.z },
      initialCorridorExtent,
      cursor: 0,
    });
  }

  const queue: string[] = [];
  const inQueue = new Set<string>();

  const findActiveCoveringMutableProfiles = (rId: number): readonly string[] => {
    const skirt = skirtRoofs[rId]!;
    const matched = new Set<string>();
    for (let sIdx = 0; sIdx < 49; sIdx += 1) {
      const pt = skirt.samples[sIdx]!;
      const pMinGx = Math.floor((pt.x - 0.01) / activeProfileIndex.cellSize);
      const pMaxGx = Math.floor((pt.x + 0.01) / activeProfileIndex.cellSize);
      const pMinGz = Math.floor((pt.z - 0.01) / activeProfileIndex.cellSize);
      const pMaxGz = Math.floor((pt.z + 0.01) / activeProfileIndex.cellSize);
      for (let gx = pMinGx; gx <= pMaxGx; gx += 1) {
        for (let gz = pMinGz; gz <= pMaxGz; gz += 1) {
          const bucket = activeProfileIndex.cells.get(roofDetailCellKey(gx, gz));
          if (bucket !== undefined) {
            for (let i = 0; i < bucket.length; i += 1) {
              const box = activeProfileIndex.boxes[bucket[i]!]!;
              const m = boxToMass.get(box);
              if (m === undefined || !activeMasses.has(m)) continue;
              if (pointInObb(pt, box)) {
                const k = boxToProfileKey.get(box);
                if (k !== undefined && mutableRecords.has(k)) matched.add(k);
              }
            }
          }
        }
      }
    }
    return Array.from(matched).sort();
  };

  for (let rId = 0; rId < skirtRoofs.length; rId += 1) {
    if (roofCoveredCounts[rId] === 49) {
      for (const k of findActiveCoveringMutableProfiles(rId)) {
        if (!inQueue.has(k)) {
          queue.push(k);
          inQueue.add(k);
        }
      }
    }
  }

  let qHead = 0;
  while (qHead < queue.length) {
    const key = queue[qHead++]!;
    inQueue.delete(key);

    const rec = mutableRecords.get(key);
    if (rec === undefined || rec.cursor >= CANDIDATE_SCALES.length) continue;

    const inp = r36InputsByTower.get(key)!;
    const origFamily = rec.initialFamily;
    const origW = rec.initialStage0.width;
    const origD = rec.initialStage0.depth;
    const origX = rec.initialStage0.x;
    const origZ = rec.initialStage0.z;

    while (rec.cursor < CANDIDATE_SCALES.length) {
      const scale = CANDIDATE_SCALES[rec.cursor]!;
      rec.cursor += 1;

      const candW = Math.round(origW * scale);
      const candD = Math.round(origD * scale);
      const s0Override = { width: candW, depth: candD, x: origX, z: origZ };

      const candData = deriveR36TowerData(
        layout, inp.tower, inp.index, inp.isSplitCrown, inp.row, inp.isReservedHero, inp.heroReservedTop,
        origFamily, s0Override, scale, true,
      );

      const candCorridorExtent = computeLowerCorridorExtent(rec.side, candData);
      if (candCorridorExtent < rec.initialCorridorExtent - 0.01) continue;
      if (!checkStageContact(candData.stageDrafts)) continue;

      let invalidDraft = false;
      for (let i = 0; i < candData.stageDrafts.length; i += 1) {
        const d = candData.stageDrafts[i]!;
        const fp = d.footprint;
        const vb = d.verticalBounds;
        if (
          !Number.isFinite(fp.x) || !Number.isFinite(fp.z) ||
          !Number.isFinite(fp.width) || !Number.isFinite(fp.depth) ||
          fp.width <= 0 || fp.depth <= 0 ||
          !Number.isFinite(vb.y0) || !Number.isFinite(vb.y1) ||
          !Number.isFinite(vb.height) || vb.height <= 0
        ) {
          invalidDraft = true;
          break;
        }
        if (d.offset !== null && (!Number.isFinite(d.offset.ratio) || d.offset.ratio < 0.08 || d.offset.ratio > 0.33)) {
          invalidDraft = true;
          break;
        }
      }
      if (invalidDraft) continue;

      if ((inp.index % 15 === 3) && candData.leanProfile === 'none') continue;
      if (candData.leanProfile !== 'none' && (candData.leanProfile.angleDeg < 4.0 || candData.leanProfile.angleDeg > 6.0)) {
        continue;
      }

      const candM: SkyriverMass[] = [
        ...candData.stageMasses,
        ...candData.crownMasses,
        ...(candData.spineMass ? [candData.spineMass] : []),
        ...candData.deckWingMasses,
        ...candData.companionMasses,
      ];
      let invalidMass = false;
      for (let i = 0; i < candM.length; i += 1) {
        const m = candM[i]!;
        if (
          !Number.isFinite(m.x) || !Number.isFinite(m.y0) || !Number.isFinite(m.z) ||
          !Number.isFinite(m.width) || !Number.isFinite(m.height) || !Number.isFinite(m.depth) ||
          m.width <= 0 || m.height <= 0 || m.depth <= 0
        ) {
          invalidMass = true;
          break;
        }
      }
      if (invalidMass) continue;

      const candB: RoofDetailObb[] = candM.map((m) => roofDetailMassObb(m, 0));

      let wingAirConflict = false;
      for (let i = 0; i < candB.length; i += 1) {
        if (roofDetailIndexConflicts(wingAirIndex, candB[i]!, 0)) {
          wingAirConflict = true;
          break;
        }
      }
      if (wingAirConflict) continue;

      const oldB = profileBoxes.get(key) ?? [];
      const affectedRoofs = new Set<number>();
      const findRoofs = (boxes: readonly RoofDetailObb[]): void => {
        for (let i = 0; i < boxes.length; i += 1) {
          const b = boxes[i]!;
          const minGx = Math.floor((b.minX - 0.01) / ROOF_DETAIL_SPATIAL_CELL_M);
          const maxGx = Math.floor((b.maxX + 0.01) / ROOF_DETAIL_SPATIAL_CELL_M);
          const minGz = Math.floor((b.minZ - 0.01) / ROOF_DETAIL_SPATIAL_CELL_M);
          const maxGz = Math.floor((b.maxZ + 0.01) / ROOF_DETAIL_SPATIAL_CELL_M);
          for (let gx = minGx; gx <= maxGx; gx += 1) {
            for (let gz = minGz; gz <= maxGz; gz += 1) {
              const list = sampleCellMap.get(roofDetailCellKey(gx, gz));
              if (list !== undefined) {
                for (let j = 0; j < list.length; j += 1) affectedRoofs.add(list[j]!);
              }
            }
          }
        }
      };
      findRoofs(oldB);
      findRoofs(candB);

      let makesNewBuried = false;
      let oldLocalBuriedSum = 0;
      let candLocalBuriedSum = 0;
      const tempCounts = new Map<number, number>();

      for (const rId of affectedRoofs) {
        const curCov = roofCoveredCounts[rId]!;
        const skirt = skirtRoofs[rId]!;
        let candCov = 0;
        let oldLocalCov = 0;
        let candLocalCov = 0;
        for (let sIdx = 0; sIdx < 49; sIdx += 1) {
          const pt = skirt.samples[sIdx]!;
          if (isCoveredPoint(pt, key, candB)) candCov += 1;
          if (curCov === 49) {
            let inOld = false;
            for (let b = 0; b < oldB.length; b += 1) {
              if (pointInObb(pt, oldB[b]!)) {
                inOld = true;
                break;
              }
            }
            if (inOld) oldLocalCov += 1;

            let inCand = false;
            for (let b = 0; b < candB.length; b += 1) {
              if (pointInObb(pt, candB[b]!)) {
                inCand = true;
                break;
              }
            }
            if (inCand) candLocalCov += 1;
          }
        }
        if (curCov < 49 && candCov === 49) {
          makesNewBuried = true;
          break;
        }
        if (curCov === 49) {
          oldLocalBuriedSum += oldLocalCov;
          candLocalBuriedSum += candLocalCov;
        }
        tempCounts.set(rId, candCov);
      }

      if (!makesNewBuried && candLocalBuriedSum < oldLocalBuriedSum) {
        for (const om of profileMasses.get(key) ?? []) activeMasses.delete(om);
        for (let i = 0; i < candB.length; i += 1) {
          const b = candB[i]!;
          roofDetailInsert(activeProfileIndex, b);
        }
        for (let i = 0; i < candM.length; i += 1) {
          const m = candM[i]!;
          activeMasses.add(m);
          const b = candB[i]!;
          boxToMass.set(b, m);
          boxToProfileKey.set(b, key);
        }
        profileMasses.set(key, candM);
        profileBoxes.set(key, candB);
        r36DataByTower.set(key, candData);

        for (const [rId, c] of tempCounts) {
          roofCoveredCounts[rId] = c;
        }

        for (const [rId, c] of tempCounts) {
          if (c === 49) {
            for (const coveringKey of findActiveCoveringMutableProfiles(rId)) {
              if (!inQueue.has(coveringKey)) {
                const targetRec = mutableRecords.get(coveringKey);
                if (targetRec !== undefined && targetRec.cursor < CANDIDATE_SCALES.length) {
                  queue.push(coveringKey);
                  inQueue.add(coveringKey);
                }
              }
            }
          }
        }
        break;
      }
    }
  }

  let finalBuried = 0;
  let finalExposed = 0;
  for (let rId = 0; rId < skirtRoofs.length; rId += 1) {
    const skirt = skirtRoofs[rId]!;
    let cov = 0;
    for (let sIdx = 0; sIdx < 49; sIdx += 1) {
      if (isCoveredPoint(skirt.samples[sIdx]!)) cov += 1;
    }
    if (cov === 49) finalBuried += 1;
    else finalExposed += 1;
  }
  if (finalBuried > 0 || (skirtRoofs.length > 0 && finalExposed / skirtRoofs.length < 0.80)) {
    fail('SKYRIVER_ROOF_FIT_AUDIT_FAILED');
  }
  profileIndex = activeProfileIndex;

  const finalMasses: SkyriverMass[] = [];
  for (let i = 0; i < masses.length; i += 1) {
    const m = masses[i]!;
    const key = initialFirstMassByTower.get(m);
    if (key !== undefined) {
      const fd = r36DataByTower.get(key)!;
      for (const sm of fd.stageMasses) finalMasses.push(sm);
      for (const cm of fd.crownMasses) finalMasses.push(cm);
      if (fd.spineMass) finalMasses.push(fd.spineMass);
      for (const wm of fd.deckWingMasses) finalMasses.push(wm);
      for (const cpm of fd.companionMasses) finalMasses.push(cpm);
    } else if (initialRemainingMasses.has(m)) {
      continue;
    } else {
      finalMasses.push(m);
    }
  }
  masses.length = 0;
  masses.push(...finalMasses);

  const finalExposedFacesList: SkyriverFacadeFace[] = [];
  for (let i = 0; i < exposedFaces.length; i += 1) {
    const f = exposedFaces[i]!;
    const key = initialFirstFaceByTower.get(f);
    if (key !== undefined) {
      const fd = r36DataByTower.get(key)!;
      for (const nf of fd.faces) finalExposedFacesList.push(nf);
    } else if (initialRemainingFaces.has(f)) {
      continue;
    } else {
      finalExposedFacesList.push(f);
    }
  }
  exposedFaces.length = 0;
  exposedFaces.push(...finalExposedFacesList);

  for (const [key, data] of r36DataByTower) {
    tierMap.set(key, data.tiers);
  }

  tierCache.set(layout.seed, tierMap);

  // --- R36 Stage E: Crown-only repair pass --------------------------------------------------------
  let targetSplitCount = 0;
  for (const data of r36DataByTower.values()) {
    if (data.crownProfile.kind === 'split') targetSplitCount += 1;
  }

  const computeSplitCrownNotch = (
    cm0: SkyriverMass,
    cm1: SkyriverMass,
    axis: 'x' | 'z',
    anchorV: number,
  ): {
    readonly notchObb: RoofDetailObb;
    readonly gapM: number;
    readonly gapX: number;
    readonly gapZ: number;
    readonly gapW: number;
    readonly gapD: number;
  } => {
    const b0 = axis === 'x' ? (cm0.x < cm1.x ? cm0 : cm1) : (cm0.z < cm1.z ? cm0 : cm1);
    const b1 = axis === 'x' ? (cm0.x < cm1.x ? cm1 : cm0) : (cm0.z < cm1.z ? cm1 : cm0);
    const facing0 = axis === 'x' ? b0.x + b0.width * 0.5 : b0.z + b0.depth * 0.5;
    const facing1 = axis === 'x' ? b1.x - b1.width * 0.5 : b1.z - b1.depth * 0.5;
    const gapM = facing1 - facing0;
    const gapX = axis === 'x' ? (facing0 + facing1) * 0.5 : b0.x;
    const gapZ = axis === 'z' ? (facing0 + facing1) * 0.5 : b0.z;
    const gapW = axis === 'x' ? gapM : b0.width;
    const gapD = axis === 'z' ? gapM : b0.depth;
    const gapY = b0.y0 + b0.height * 0.5;
    const gapH = b0.height;

    warpBoxPoint({ ...b0, anchorV }, gapX, gapZ, roofDetailWarp);
    const notchObb = roofDetailBox(
      roofDetailWarp.x,
      gapY,
      roofDetailWarp.z,
      gapW,
      gapH,
      gapD,
      roofDetailWarp.heading,
    );

    return { notchObb, gapM, gapX, gapZ, gapW, gapD };
  };

  const crownRepairWorldIndex = createSpatialIndex(masses.length + 256);
  const crownBoxToMass = new Map<RoofDetailObb, SkyriverMass>();
  const activeWorldMasses = new Set<SkyriverMass>(masses);

  for (let mIdx = 0; mIdx < masses.length; mIdx += 1) {
    const m = masses[mIdx]!;
    if (m.width <= 0 || m.height <= 0 || m.depth <= 0) continue;
    const obb = roofDetailMassObb(m, mIdx);
    roofDetailInsert(crownRepairWorldIndex, obb);
    crownBoxToMass.set(obb, m);
  }

  const checkNotchWorldConflict = (
    notchObb: RoofDetailObb,
    maskedMasses: Set<SkyriverMass>,
  ): boolean => {
    const minGx = Math.floor((notchObb.minX - 0.01) / crownRepairWorldIndex.cellSize);
    const maxGx = Math.floor((notchObb.maxX + 0.01) / crownRepairWorldIndex.cellSize);
    const minGz = Math.floor((notchObb.minZ - 0.01) / crownRepairWorldIndex.cellSize);
    const maxGz = Math.floor((notchObb.maxZ + 0.01) / crownRepairWorldIndex.cellSize);

    crownRepairWorldIndex.stamp += 1;
    if (crownRepairWorldIndex.stamp >= 0x7ffffffe) {
      crownRepairWorldIndex.stamps.fill(0);
      crownRepairWorldIndex.stamp = 1;
    }
    const stamp = crownRepairWorldIndex.stamp;

    for (let gx = minGx; gx <= maxGx; gx += 1) {
      for (let gz = minGz; gz <= maxGz; gz += 1) {
        const bucket = crownRepairWorldIndex.cells.get(roofDetailCellKey(gx, gz));
        if (bucket === undefined) continue;
        for (let i = 0; i < bucket.length; i += 1) {
          const bIdx = bucket[i]!;
          if (crownRepairWorldIndex.stamps[bIdx] === stamp) continue;
          crownRepairWorldIndex.stamps[bIdx] = stamp;
          const box = crownRepairWorldIndex.boxes[bIdx]!;
          const m = crownBoxToMass.get(box);
          if (m === undefined || !activeWorldMasses.has(m) || maskedMasses.has(m)) continue;
          if (roofDetailObbsConflict(notchObb, box, 0)) return true;
        }
      }
    }
    return false;
  };

  interface CrownCandidateResult {
    readonly axis: 'x' | 'z';
    readonly masses: readonly [SkyriverMass, SkyriverMass];
    readonly profile: SkyriverSplitCrownProfile;
    readonly bounds: { readonly y0: number; readonly y1: number; readonly width: number; readonly height: number; readonly depth: number };
    readonly crownSpan: number;
    readonly notchObb: RoofDetailObb;
  }

  const findSplitCandidate = (
    tower: SkyriverTower,
    data: R36EmittedData,
    maskedMasses: Set<SkyriverMass>,
    acceptedNotchesIter: Iterable<RoofDetailObb>,
    resolveOriginal = false,
    preserveFootprint = false,
  ): CrownCandidateResult | null => {
    const topDraft = data.stageDrafts[data.stageDrafts.length - 1]!;
    const topFace = {
      x: topDraft.footprint.x,
      z: topDraft.footprint.z,
      width: topDraft.footprint.width,
      depth: topDraft.footprint.depth,
      y1: topDraft.verticalBounds.y1,
    };
    const towerSeed = buildingSeedOf(tower.x, tower.z);
    if (preserveFootprint) {
      if (data.crownProfile.kind !== 'split') return null;
      const cm0: SkyriverMass = {
        ...data.crownMasses[0]!, height: R36_ORDINARY_CROWN_HEIGHT_M,
        crownRole: 'ordinary-dark-crown',
      };
      const cm1: SkyriverMass = {
        ...data.crownMasses[1]!, height: R36_ORDINARY_CROWN_HEIGHT_M,
        crownRole: 'ordinary-dark-crown',
      };
      const axis = data.crownProfile.axis;
      const { notchObb } = computeSplitCrownNotch(cm0, cm1, axis, cm0.anchorV ?? tower.z);
      if (checkNotchWorldConflict(notchObb, maskedMasses)) return null;
      const boxes = [roofDetailMassObb(cm0, 0), roofDetailMassObb(cm1, 0)];
      if (boxes.some((box) => roofDetailIndexConflicts(wingAirIndex, box, 0))) return null;
      for (const notch of acceptedNotchesIter) {
        if (boxes.some((box) => roofDetailObbsConflict(box, notch, 0))) return null;
      }
      const bounds = {
        ...data.crownBounds,
        y1: cm0.y0 + R36_ORDINARY_CROWN_HEIGHT_M,
        height: R36_ORDINARY_CROWN_HEIGHT_M,
      };
      return {
        axis, masses: [cm0, cm1],
        profile: { ...data.crownProfile, bounds, massIndices: [0, 0] },
        bounds, crownSpan: data.crownSpan, notchObb,
      };
    }
    const origAxis: 'x' | 'z' = data.crownProfile.axis === 'x' ? 'x' : 'z';
    const axes: readonly ('x' | 'z')[] = [origAxis, origAxis === 'z' ? 'x' : 'z'];

    for (const axis of axes) {
      const faceSpan = axis === 'z' ? topFace.depth : topFace.width;
      const faceCross = axis === 'z' ? topFace.width : topFace.depth;
      const faceU = axis === 'z' ? topFace.z : topFace.x;

      const rawSpan = Math.round(faceSpan * 0.85);
      const gap = Math.round(rawSpan * 0.22);
      const blockD = Math.floor((rawSpan - gap) * 0.5);
      const actualSpan = gap + 2 * blockD;
      const crossDim = Math.round(faceCross * 0.7);
      const crownH = resolveOriginal ? 45 : R36_ORDINARY_CROWN_HEIGHT_M;
      const yCrown = topFace.y1;

      if (actualSpan <= 0 || crossDim <= 0 || actualSpan > faceSpan + 1e-4 || crossDim > faceCross + 1e-4) {
        continue;
      }

      const shiftQuarter = 0.25 * actualSpan;
      const shifts = [0, shiftQuarter, -shiftQuarter] as const;

      for (const shift of shifts) {
        const uMin = faceU - actualSpan * 0.5;
        const uMax = faceU + actualSpan * 0.5;
        const gapCenter = faceU + shift;
        const g0 = gapCenter - gap * 0.5;
        const g1 = gapCenter + gap * 0.5;
        const L0 = g0 - uMin;
        const L1 = uMax - g1;
        const measuredGap = g1 - g0;

        if (measuredGap < 0.15 * actualSpan - 1e-4) continue;
        if (L0 <= 0 || L1 <= 0) continue;
        if (uMin < faceU - faceSpan * 0.5 - 1e-4 || uMax > faceU + faceSpan * 0.5 + 1e-4) continue;

        const u0 = (uMin + g0) * 0.5;
        const u1 = (g1 + uMax) * 0.5;

        let cm0: SkyriverMass;
        let cm1: SkyriverMass;
        if (axis === 'z') {
          cm0 = {
            x: topFace.x,
            y0: yCrown,
            z: u0,
            width: crossDim,
            height: crownH,
            depth: L0,
            tint: tower.tint,
            anchorV: tower.z,
            materialOwner: towerSeed,
            building: towerSeed,
            crownRole: 'ordinary-dark-crown',
          };
          cm1 = {
            x: topFace.x,
            y0: yCrown,
            z: u1,
            width: crossDim,
            height: crownH,
            depth: L1,
            tint: tower.tint,
            anchorV: tower.z,
            materialOwner: towerSeed,
            building: towerSeed,
            crownRole: 'ordinary-dark-crown',
          };
        } else {
          cm0 = {
            x: u0,
            y0: yCrown,
            z: topFace.z,
            width: L0,
            height: crownH,
            depth: crossDim,
            tint: tower.tint,
            anchorV: tower.z,
            materialOwner: towerSeed,
            building: towerSeed,
            crownRole: 'ordinary-dark-crown',
          };
          cm1 = {
            x: u1,
            y0: yCrown,
            z: topFace.z,
            width: L1,
            height: crownH,
            depth: crossDim,
            tint: tower.tint,
            anchorV: tower.z,
            materialOwner: towerSeed,
            building: towerSeed,
            crownRole: 'ordinary-dark-crown',
          };
        }

        const { notchObb, gapM } = computeSplitCrownNotch(cm0, cm1, axis, tower.z);

        if (checkNotchWorldConflict(notchObb, maskedMasses)) continue;

        const obb0 = roofDetailMassObb(cm0, 0);
        const obb1 = roofDetailMassObb(cm1, 0);
        let blocksAcceptedNotch = false;
        for (const acceptedNotch of acceptedNotchesIter) {
          if (roofDetailObbsConflict(obb0, acceptedNotch, 0) || roofDetailObbsConflict(obb1, acceptedNotch, 0)) {
            blocksAcceptedNotch = true;
            break;
          }
        }
        if (blocksAcceptedNotch) continue;

        if (roofDetailIndexConflicts(wingAirIndex, obb0, 0) || roofDetailIndexConflicts(wingAirIndex, obb1, 0)) {
          continue;
        }

        const bounds = {
          y0: yCrown,
          y1: yCrown + crownH,
          width: axis === 'x' ? actualSpan : crossDim,
          height: crownH,
          depth: axis === 'z' ? actualSpan : crossDim,
        };

        const profile: SkyriverSplitCrownProfile = {
          kind: 'split',
          axis,
          gapM,
          crownSpanM: actualSpan,
          bounds,
          massIndices: [0, 0],
        };

        return {
          axis,
          masses: [cm0, cm1],
          profile,
          bounds,
          crownSpan: actualSpan,
          notchObb,
        };
      }
    }

    return null;
  };

  const createSeededFin = (
    tower: SkyriverTower,
    data: R36EmittedData,
    resolveOriginal = false,
    preserveFootprint = false,
  ): {
    readonly fin: SkyriverMass;
    readonly profile: SkyriverUnsplitFinProfile;
    readonly bounds: { readonly y0: number; readonly y1: number; readonly width: number; readonly height: number; readonly depth: number };
    readonly crownSpan: number;
  } => {
    const topDraft = data.stageDrafts[data.stageDrafts.length - 1]!;
    const topFace = {
      x: topDraft.footprint.x,
      z: topDraft.footprint.z,
      width: topDraft.footprint.width,
      depth: topDraft.footprint.depth,
      y1: topDraft.verticalBounds.y1,
    };
    const towerSeed = buildingSeedOf(tower.x, tower.z);

    const uCorner = r36Hash01(layout.seed, tower, 7);
    const uCornerX = r36Hash01(layout.seed, tower, 8);
    const uCornerZ = r36Hash01(layout.seed, tower, 9);
    const uFinH = r36Hash01(layout.seed, tower, 10);
    const isCorner = uCorner < 0.40;

    const finW = Math.max(3, Math.round(topFace.width * (isCorner ? 0.18 : 0.15)));
    const finD = Math.round(topFace.depth * (isCorner ? 0.45 : 0.75));
    const finH = resolveOriginal
      ? (isCorner ? Math.round(36 + uFinH * 40) : Math.round(42 + uFinH * 24))
      : R36_ORDINARY_CROWN_HEIGHT_M;
    const yCrown = topFace.y1;

    const shiftX = Math.max(0, (topFace.width - finW) * 0.5 - 2);
    const shiftZ = Math.max(0, (topFace.depth - finD) * 0.5 - 2);
    const cornerX = uCornerX < 0.5 ? -1 : 1;
    const cornerZ = uCornerZ < 0.5 ? -1 : 1;
    const finX = isCorner ? topFace.x + cornerX * shiftX : topFace.x;
    const finZ = isCorner ? topFace.z + cornerZ * shiftZ : topFace.z;

    const fin: SkyriverMass = preserveFootprint ? {
      ...data.crownMasses[0]!,
      height: R36_ORDINARY_CROWN_HEIGHT_M,
      crownRole: 'ordinary-dark-crown',
    } : {
      x: finX,
      y0: yCrown,
      z: finZ,
      width: finW,
      height: finH,
      depth: finD,
      tint: tower.tint,
      anchorV: tower.z,
      materialOwner: towerSeed,
      building: towerSeed,
      crownRole: 'ordinary-dark-crown',
    };

    const finMinX = fin.x - fin.width * 0.5;
    const finMaxX = fin.x + fin.width * 0.5;
    const finMinZ = fin.z - fin.depth * 0.5;
    const finMaxZ = fin.z + fin.depth * 0.5;
    const roofMinX = topFace.x - topFace.width * 0.5;
    const roofMaxX = topFace.x + topFace.width * 0.5;
    const roofMinZ = topFace.z - topFace.depth * 0.5;
    const roofMaxZ = topFace.z + topFace.depth * 0.5;

    if (
      !Number.isFinite(fin.x) || !Number.isFinite(fin.y0) || !Number.isFinite(fin.z) ||
      !Number.isFinite(fin.width) || !Number.isFinite(fin.height) || !Number.isFinite(fin.depth) ||
      fin.width <= 0 || fin.height <= 0 || fin.depth <= 0 ||
      finMinX < roofMinX - 1e-4 || finMaxX > roofMaxX + 1e-4 ||
      finMinZ < roofMinZ - 1e-4 || finMaxZ > roofMaxZ + 1e-4
    ) {
      fail(`SKYRIVER_CROWN_REPAIR_INVALID_FIN: ${towerKey(tower)}`);
    }

    const bounds = {
      y0: fin.y0,
      y1: fin.y0 + fin.height,
      width: fin.width,
      height: fin.height,
      depth: fin.depth,
    };

    const profile: SkyriverUnsplitFinProfile = {
      kind: 'unsplit-fin',
      axis: 'z',
      gapM: 0,
      crownSpanM: fin.depth,
      bounds,
      massIndices: [0],
    };

    return { fin, profile, bounds, crownSpan: fin.depth };
  };

  const applyCrownReplacement = (
    key: string,
    oldCrownMasses: readonly SkyriverMass[],
    newCrownMasses: readonly SkyriverMass[],
    newProfile: SkyriverCrownProfile,
    newBounds: { readonly y0: number; readonly y1: number; readonly width: number; readonly height: number; readonly depth: number },
    newSpan: number,
  ): void => {
    for (const om of oldCrownMasses) {
      let occurrences = 0;
      for (let i = 0; i < masses.length; i += 1) {
        if (masses[i] === om) occurrences += 1;
      }
      if (occurrences !== 1) {
        fail(`SKYRIVER_CROWN_REPAIR_OLD_MASS_NOT_ONCE: ${key}`);
      }
    }

    const newSet = new Set<SkyriverMass>();
    for (const nm of newCrownMasses) {
      if (newSet.has(nm)) {
        fail(`SKYRIVER_CROWN_REPAIR_DUPLICATE_REPLACEMENT: ${key}`);
      }
      newSet.add(nm);
      if (masses.includes(nm)) {
        fail(`SKYRIVER_CROWN_REPAIR_REPLACEMENT_ALREADY_EXISTS: ${key}`);
      }
    }

    for (const om of oldCrownMasses) {
      activeWorldMasses.delete(om);
    }
    for (const nm of newCrownMasses) {
      activeWorldMasses.add(nm);
      if (nm.width > 0 && nm.height > 0 && nm.depth > 0) {
        const obb = roofDetailMassObb(nm, 0);
        roofDetailInsert(crownRepairWorldIndex, obb);
        crownBoxToMass.set(obb, nm);
      }
    }

    const oldSet = new Set(oldCrownMasses);
    const firstIdx = masses.findIndex((m) => oldSet.has(m));
    if (firstIdx === -1) {
      fail(`SKYRIVER_CROWN_REPAIR_MISSING_OLD_MASS: ${key}`);
    }
    const kept = masses.filter((m) => !oldSet.has(m));
    if (masses.length - kept.length !== oldCrownMasses.length) {
      fail(`SKYRIVER_CROWN_REPAIR_OLD_MASS_COUNT_MISMATCH: ${key}`);
    }
    kept.splice(firstIdx, 0, ...newCrownMasses);
    masses.length = 0;
    masses.push(...kept);

    const currentData = r36DataByTower.get(key)!;
    r36DataByTower.set(key, {
      ...currentData,
      crownMasses: Object.freeze([...newCrownMasses]),
      crownProfile: newProfile,
      crownBounds: newBounds,
      crownSpan: newSpan,
    });
  };

  const acceptedNotches = new Map<string, RoofDetailObb>();
  const blockedSplitKeys: string[] = [];

  for (let i = 0; i < layout.towers.length; i += 1) {
    const tower = layout.towers[i]!;
    const key = towerKey(tower);
    const data = r36DataByTower.get(key);
    if (data !== undefined && data.crownProfile.kind === 'split') {
      const cm0 = data.crownMasses[0]!;
      const cm1 = data.crownMasses[1]!;
      const { notchObb } = computeSplitCrownNotch(cm0, cm1, data.crownProfile.axis, cm0.anchorV ?? tower.z);
      const selfMask = new Set(data.crownMasses);
      if (checkNotchWorldConflict(notchObb, selfMask)) {
        blockedSplitKeys.push(key);
      } else {
        acceptedNotches.set(key, notchObb);
      }
    }
  }

  const verifyAllAcceptedNotches = (): boolean => {
    for (const [k, notch] of acceptedNotches) {
      const d = r36DataByTower.get(k)!;
      const selfMask = new Set(d.crownMasses);
      if (checkNotchWorldConflict(notch, selfMask)) return false;
    }
    return true;
  };

  for (const blockedKey of blockedSplitKeys) {
    const towerData = r36DataByTower.get(blockedKey)!;
    const towerInput = r36InputsByTower.get(blockedKey)!;
    const tower = towerInput.tower;
    const oldCrown = towerData.crownMasses;
    const oldMask = new Set(oldCrown);

    const localCand = findSplitCandidate(tower, towerData, oldMask, acceptedNotches.values(), true);

    if (localCand !== null) {
      applyCrownReplacement(
        blockedKey,
        oldCrown,
        localCand.masses,
        localCand.profile,
        localCand.bounds,
        localCand.crownSpan,
      );
      acceptedNotches.set(blockedKey, localCand.notchObb);
      if (!verifyAllAcceptedNotches()) {
        fail(`SKYRIVER_CROWN_REPAIR_NOTCH_INVALIDATED: ${blockedKey}`);
      }
      continue;
    }

    const { fin, profile: finProfile, bounds: finBounds, crownSpan: finSpan } = createSeededFin(tower, towerData, true);
    const finObb = roofDetailMassObb(fin, 0);

    for (const acceptedNotch of acceptedNotches.values()) {
      if (roofDetailObbsConflict(finObb, acceptedNotch, 0)) {
        fail(`SKYRIVER_CROWN_REPAIR_FIN_BLOCKS_NOTCH: ${blockedKey}`);
      }
    }
    if (roofDetailIndexConflicts(wingAirIndex, finObb, 0)) {
      fail(`SKYRIVER_CROWN_REPAIR_FIN_BLOCKS_WING: ${blockedKey}`);
    }

    applyCrownReplacement(blockedKey, oldCrown, [fin], finProfile, finBounds, finSpan);
    acceptedNotches.delete(blockedKey);

    const candidateTransferKeys: string[] = [];
    for (const [key, data] of r36DataByTower) {
      if (key === blockedKey) continue;
      if (data.crownProfile.kind === 'split') continue;
      const inp = r36InputsByTower.get(key)!;
      if (inp.row !== undefined || inp.isReservedHero) continue;
      const side = Math.sign(inp.tower.x);
      const nearMega = side === 1 && apexes.some((a) => Math.abs(inp.tower.z - a.v) < 950);
      if (nearMega) continue;
      candidateTransferKeys.push(key);
    }
    candidateTransferKeys.sort();

    let transferSuccess = false;
    for (const targetKey of candidateTransferKeys) {
      const targetData = r36DataByTower.get(targetKey)!;
      const targetTower = r36InputsByTower.get(targetKey)!.tower;
      const targetOldCrown = targetData.crownMasses;
      const targetOldMask = new Set(targetOldCrown);

      const transferCand = findSplitCandidate(
        targetTower,
        targetData,
        targetOldMask,
        acceptedNotches.values(),
        true,
      );

      if (transferCand !== null) {
        applyCrownReplacement(
          targetKey,
          targetOldCrown,
          transferCand.masses,
          transferCand.profile,
          transferCand.bounds,
          transferCand.crownSpan,
        );
        acceptedNotches.set(targetKey, transferCand.notchObb);
        if (!verifyAllAcceptedNotches()) {
          applyCrownReplacement(
            targetKey,
            transferCand.masses,
            targetOldCrown,
            targetData.crownProfile,
            targetData.crownBounds,
            targetData.crownSpan,
          );
          acceptedNotches.delete(targetKey);
          continue;
        }
        transferSuccess = true;
        break;
      }
    }

    if (!transferSuccess) {
      fail(`SKYRIVER_CROWN_REPAIR_TRANSFER_FAILED: ${blockedKey}`);
    }
  }

  let finalSplitCount = 0;
  for (const data of r36DataByTower.values()) {
    if (data.crownProfile.kind === 'split') finalSplitCount += 1;
  }
  if (finalSplitCount !== targetSplitCount) {
    fail('SKYRIVER_CROWN_REPAIR_SPLIT_COUNT_MISMATCH');
  }
  const ordinarySplitShare = r36DataByTower.size > 0 ? finalSplitCount / r36DataByTower.size : 0;
  if (ordinarySplitShare < 0.15 || ordinarySplitShare > 0.25) {
    fail('SKYRIVER_CROWN_REPAIR_SHARE_OUT_OF_BOUNDS');
  }

  for (let index = 0; index < masses.length; index += 1) {
    const mass = masses[index]!;
    if (!seedIndices.has(mass)) seedIndices.set(mass, index);
  }
  const resolvedHeroes = placeHeroArtwork(
    layout,
    planHeroArtwork(layout, legacyFaceCache.get(layout.seed)!),
    exposedFaces,
    masses,
  );
  const shapeHeroBoxes = roofDetailHeroObbs(layout, resolvedHeroes, exposedFaces);
  const shapeRouteBlocked = createCityRouteBlocker();
  const shapeRoofPlanes = masses.filter((mass) => mass.baseRecord !== undefined).map((mass) => {
    const box = roofDetailMassObb(mass, 0);
    return { ...box, y: mass.y0 + mass.height, halfY: 0.01 };
  });
  const finalNotches = new Map<string, RoofDetailObb>();
  for (const [key, data] of r36DataByTower) {
    if (data.crownProfile.kind !== 'split') continue;
    const cm0 = data.crownMasses[0]!;
    const cm1 = data.crownMasses[1]!;
    finalNotches.set(key, computeSplitCrownNotch(
      cm0, cm1, data.crownProfile.axis, cm0.anchorV ?? cm0.z,
    ).notchObb);
  }

  const addedProfileFragments = (
    mass: SkyriverMass,
    oldProfileMasses: readonly SkyriverMass[],
  ): RoofDetailObb[] => {
    const box = roofDetailMassObb(mass, 0);
    let fragments: RoofDetailObb[] = [box];
    for (const old of oldProfileMasses) {
      if ((old.anchorV ?? old.z) !== (mass.anchorV ?? mass.z)) continue;
      const cut = roofDetailMassObb(old, 0);
      const cutBottom=old.y0,cutTop=old.y0+old.height;
      const next: RoofDetailObb[] = [];
      for (const fragment of fragments) {
        const fragmentBottom=fragment.verticalBounds?.[0] ?? fragment.y-fragment.halfY;
        const fragmentTop=fragment.verticalBounds?.[1] ?? fragment.y+fragment.halfY;
        const bottom = Math.max(fragmentBottom,cutBottom);
        const top = Math.min(fragmentTop,cutTop);
        if (top <= bottom || !roofDetailObbsConflict(fragment, cut, 0)) {
          next.push(fragment);
          continue;
        }
        const footprint = retainedSupportFootprint(fragment);
        if (fragmentBottom < bottom) {
          next.push(roofDetailPolygonBox(footprint, fragmentBottom, bottom));
        }
        if (top < fragmentTop) {
          next.push(roofDetailPolygonBox(footprint, top, fragmentTop));
        }
        for (const piece of subtractFootprint(footprint, retainedSupportFootprint(cut))) {
          if (retainedSupportArea(piece) > 1e-10) next.push(roofDetailPolygonBox(piece, bottom, top));
        }
      }
      fragments = next;
      if (fragments.length === 0) break;
    }
    return fragments;
  };

  const rebuildUpperFaces = (data: R36EmittedData, drafts: readonly R36StageDraft[]): R36EmittedData => {
    const first = data.faces[0]!;
    const buildingId = first.buildingId;
    const side = first.side;
    const upperFaces = drafts.slice(1).map((draft): SkyriverFacadeFace => {
      const mass = draft.masses[0]!;
      return {
        ...first,
        id: `${buildingId}:face-${draft.stageIndex}`,
        plane: side * (Math.abs(mass.x) - mass.width * 0.5),
        u0: mass.z - mass.depth * 0.5,
        u1: mass.z + mass.depth * 0.5,
        y0: mass.y0,
        y1: mass.y0 + mass.height,
        stepBottom: true,
        stepTop: draft.stageIndex < drafts.length - 1,
        projection: 0,
        owner: ownerOf(mass, mass.anchorV ?? mass.z),
      };
    });
    const faces = data.family === 'supported-spine'
      ? [upperFaces[0]!, ...data.faces.filter((face) => face.id.endsWith(':face-w0') || face.id.endsWith(':face-w1')), ...upperFaces.slice(1)]
      : [first, ...upperFaces];
    return {
      ...data,
      stageDrafts: drafts,
      stageMasses: drafts.flatMap((draft) => draft.masses),
      hostFace: data.family === 'supported-spine' ? upperFaces[0]! : data.hostFace,
      faces,
      tiers: faces.map((face) => ({ face })),
    };
  };

  for (const tower of layout.towers) {
    const key = towerKey(tower);
    const resolved = r36DataByTower.get(key);
    if (resolved === undefined) continue;
    if (resolved.leanProfile !== 'none') continue;
    const inp = r36InputsByTower.get(key)!;
    const first = resolved.stageDrafts[1]!;
    const oldTop = resolved.stageDrafts[resolved.stageDrafts.length - 1]!;
    const originalCrownHeight = Math.max(...resolved.crownMasses.map((mass) => mass.height));
    const bodyTopY1 = oldTop.verticalBounds.y1 - Math.max(0, R36_ORDINARY_CROWN_HEIGHT_M - originalCrownHeight);
    const rise = bodyTopY1 - first.verticalBounds.y0;
    const firstFace = resolved.faces.find((face) => face.id.endsWith(':face-1'));
    const profileFaceIds = new Set(resolved.faces.map((face) => face.id));
    const profileHeroes = resolvedHeroes.filter((hero) =>
      hero.buildingId === resolved.faces[0]?.buildingId && profileFaceIds.has(hero.faceId),
    );
    const heroFaceMargin = FACADE_FACE_EDGE_MARGIN_M + 0.25;
    const actualFirstFaceHeroTop = profileHeroes
      .filter((hero) => hero.faceId === firstFace?.id)
      .reduce((top, hero) => Math.max(top, hero.y + hero.height * 0.5 + heroFaceMargin), first.verticalBounds.y0);
    const protectedTop = Math.max(
      inp.row !== undefined ? Math.ceil(inp.row.faceTop + 10) : first.verticalBounds.y0,
      inp.heroReservedTop !== undefined ? Math.ceil(inp.heroReservedTop) : first.verticalBounds.y0,
      Math.ceil(actualFirstFaceHeroTop),
    );
    const divide = resolved.leanProfile === 'none'
      && resolved.stageDrafts.slice(1).some((draft) => draft.verticalBounds.height > 900);
    // A rise above 2700 m still exceeds 900 m per stage after the three-stage cap.
    const upperCount = divide ? Math.min(3, Math.ceil(rise / 900)) : 1;
    const preserveOldUpperBoundary = divide
      && resolved.stageDrafts.length > 2
      && bodyTopY1 > first.verticalBounds.y1
      && protectedTop <= first.verticalBounds.y1
      && upperCount > 1;
    const firstUpperY1 = !divide
      ? bodyTopY1
      : preserveOldUpperBoundary
        ? first.verticalBounds.y1
        : Math.min(
          bodyTopY1,
          Math.max(first.verticalBounds.y0 + rise / upperCount, protectedTop),
        );
    const remainingUpperRise = bodyTopY1 - firstUpperY1;
    const side = Math.sign(tower.x);
    const crownMinX = Math.min(...resolved.crownMasses.map((mass) => mass.x - mass.width * 0.5));
    const crownMaxX = Math.max(...resolved.crownMasses.map((mass) => mass.x + mass.width * 0.5));
    const crownMinZ = Math.min(...resolved.crownMasses.map((mass) => mass.z - mass.depth * 0.5));
    const crownMaxZ = Math.max(...resolved.crownMasses.map((mass) => mass.z + mass.depth * 0.5));
    const oldProfileMasses = [
      ...resolved.stageMasses, ...resolved.crownMasses,
      ...(resolved.spineMass ? [resolved.spineMass] : []),
      ...resolved.deckWingMasses, ...resolved.companionMasses,
    ];
    const oldMask = new Set(oldProfileMasses);
    const otherNotches = [...finalNotches].filter(([otherKey]) => otherKey !== key).map(([, notch]) => notch);
    let accepted: R36EmittedData | undefined;
    const geometryPatterns: { axis: 'x' | 'z'; directionSign: -1 | 1; ratio: number; factor: number }[] = [];
    for (const ratio of [0.085, 0.14, 0.22, 0.30]) {
      for (const axis of ['x', 'z'] as const) {
        for (const directionSign of [-1, 1] as const) {
          for (const factor of [0.55, 0.42, 0.25]) geometryPatterns.push({ axis, directionSign, ratio, factor });
        }
      }
    }
    const seenGeometry = new Set<string>();

    for (let attempt = 0; attempt < (divide ? geometryPatterns.length : 1); attempt += 1) {
      const pattern = geometryPatterns[attempt];
      let candidate = resolved;
      if (divide) {
        const drafts: R36StageDraft[] = [resolved.stageDrafts[0]!];
        for (let stageIndex = 1; stageIndex <= upperCount; stageIndex += 1) {
          const y0 = stageIndex === 1
            ? first.verticalBounds.y0
            : firstUpperY1 + remainingUpperRise * (stageIndex - 2) / (upperCount - 1);
          const y1 = stageIndex === 1
            ? firstUpperY1
            : stageIndex === upperCount
              ? bodyTopY1
              : firstUpperY1 + remainingUpperRise * (stageIndex - 1) / (upperCount - 1);
          let mass: SkyriverMass;
          let offset: SkyriverStageOffset | null;
          if (stageIndex === 1) {
            mass = { ...first.masses[0]!, height: y1 - first.verticalBounds.y0 };
            offset = first.offset;
          } else if (stageIndex === 2 && preserveOldUpperBoundary) {
            const parent = drafts[stageIndex - 1]!;
            const parentMass = parent.masses[0]!;
            const oldMass = oldTop.masses[0]!;
            const oldDx = oldMass.x - parentMass.x;
            const oldDz = oldMass.z - parentMass.z;
            const xRatio = Math.abs(oldDx) / parentMass.width;
            const zRatio = Math.abs(oldDz) / parentMass.depth;
            const oldAxis = Math.abs(oldDz) <= 1e-4 && Math.abs(oldDx) > 1e-4
              ? 'x'
              : Math.abs(oldDx) <= 1e-4 && Math.abs(oldDz) > 1e-4
                ? 'z'
                : null;
            const oldDelta = oldAxis === 'x' ? oldDx : oldAxis === 'z' ? oldDz : 0;
            const oldSpan = oldAxis === 'x' ? parentMass.width : oldAxis === 'z' ? parentMass.depth : 0;
            const oldRatio = oldSpan > 0 ? Math.abs(oldDelta) / oldSpan : 0;
            const keepOldCenter = oldAxis !== null && oldRatio >= 0.08 && oldRatio <= 0.33;
            if (keepOldCenter) {
              mass = { ...oldMass, y0, height: y1 - y0 };
              offset = {
                axis: oldAxis,
                parentKind: 'stage',
                parentStageIndex: parent.stageIndex,
                parentSpanM: oldSpan,
                deltaM: oldDelta,
                ratio: oldRatio,
              };
            } else {
              const axis = pattern!.axis;
              const span = axis === 'x' ? parentMass.width : parentMass.depth;
              const ratio = pattern!.ratio;
              const direction = axis === 'x' ? side * pattern!.directionSign : pattern!.directionSign;
              const delta = direction * ratio * span;
              mass = {
                ...oldMass,
                x: parentMass.x + (axis === 'x' ? delta : 0),
                z: parentMass.z + (axis === 'z' ? delta : 0),
                y0,
                height: y1 - y0,
              };
              offset = {
                axis, parentKind: 'stage', parentStageIndex: parent.stageIndex,
                parentSpanM: span, deltaM: delta, ratio,
              };
            }
          } else {
            const parent = drafts[stageIndex - 1]!;
            const parentMass = parent.masses[0]!;
            const axis = pattern!.axis;
            const span = axis === 'x' ? parentMass.width : parentMass.depth;
            const ratio = pattern!.ratio;
            const direction = axis === 'x' ? side * pattern!.directionSign : pattern!.directionSign;
            const delta = direction * ratio * span;
            const factor = pattern!.factor;
            const x = parentMass.x + (axis === 'x' ? delta : 0);
            const z = parentMass.z + (axis === 'z' ? delta : 0);
            const crownWidth = stageIndex === upperCount
              ? 2 * Math.max(Math.abs(x - crownMinX), Math.abs(crownMaxX - x)) : 0;
            const crownDepth = stageIndex === upperCount
              ? 2 * Math.max(Math.abs(z - crownMinZ), Math.abs(crownMaxZ - z)) : 0;
            mass = {
              ...first.masses[0]!,
              x, z,
              y0, height: y1 - y0,
              width: Math.max(Math.round(parentMass.width * factor), crownWidth),
              depth: Math.max(Math.round(parentMass.depth * factor), crownDepth),
            };
            offset = {
              axis, parentKind: 'stage', parentStageIndex: stageIndex - 1,
              parentSpanM: span, deltaM: delta, ratio,
            };
          }
          drafts.push({
            stageIndex, masses: [mass],
            footprint: { x: mass.x, z: mass.z, width: mass.width, depth: mass.depth },
            verticalBounds: { y0: mass.y0, y1, height: mass.height },
            offset,
          });
        }
        candidate = rebuildUpperFaces(resolved, drafts);
      } else {
        const lastIndex = resolved.stageDrafts.length - 1;
        const drafts = resolved.stageDrafts.map((draft, index) => {
          if (index !== lastIndex) return draft;
          const height = bodyTopY1 - draft.verticalBounds.y0;
          return {
            ...draft,
            masses: draft.masses.map((mass) => ({ ...mass, height })),
            verticalBounds: {
              y0: draft.verticalBounds.y0,
              y1: bodyTopY1,
              height,
            },
          };
        });
        candidate = rebuildUpperFaces(resolved, drafts);
      }

      const top = candidate.stageDrafts[candidate.stageDrafts.length - 1]!.masses[0]!;
      const crownY0 = top.y0 + top.height;
      const crownMasses = resolved.crownMasses.map((mass) => ({
        ...mass, y0: crownY0, height: R36_ORDINARY_CROWN_HEIGHT_M,
        crownRole: 'ordinary-dark-crown' as const,
      }));
      const crownBounds = {
        ...resolved.crownBounds,
        y0: crownY0,
        y1: crownY0 + R36_ORDINARY_CROWN_HEIGHT_M,
        height: R36_ORDINARY_CROWN_HEIGHT_M,
      };
      candidate = {
        ...candidate,
        crownMasses,
        crownBounds,
        crownProfile: { ...resolved.crownProfile, bounds: crownBounds },
        crownSpan: resolved.crownSpan,
      };
      if (candidate.leanProfile !== 'none') {
        const base = candidate.stageDrafts[0]!;
        const baseMass = base.masses[0]!;
        const finalMass = candidate.stageDrafts[candidate.stageDrafts.length - 1]!.masses[0]!;
        const leanRise = finalMass.y0 + finalMass.height - base.verticalBounds.y1;
        const leanOffset = Math.abs(finalMass.z - baseMass.z);
        const angleDeg = leanRise > 0
          ? Number((Math.atan(leanOffset / leanRise) * 180 / Math.PI).toFixed(2))
          : Number.NaN;
        if (!Number.isFinite(angleDeg) || angleDeg < 4.0 || angleDeg > 6.0) continue;
        candidate = {
          ...candidate,
          leanProfile: { axis: 'z', angleDeg, riseM: leanRise, totalOffsetM: leanOffset },
        };
      }
      const geometrySignature = JSON.stringify({
        stages: candidate.stageDrafts.map((draft) => draft.masses.map((mass) => [mass.x, mass.y0, mass.z, mass.width, mass.height, mass.depth])),
        crowns: candidate.crownMasses.map((mass) => [mass.x, mass.y0, mass.z, mass.width, mass.height, mass.depth]),
      });
      if (seenGeometry.has(geometrySignature)) continue;
      seenGeometry.add(geometrySignature);
      const topBox = roofDetailMassObb(top, 0);
      let invalid = false;
      const candidateFacesById = new Map(candidate.faces.map((face) => [face.id, face]));
      const candidateSupportMasses = [
        ...candidate.stageMasses,
        ...candidate.crownMasses,
        ...(candidate.spineMass ? [candidate.spineMass] : []),
        ...candidate.deckWingMasses,
        ...candidate.companionMasses,
      ];
      for (const hero of profileHeroes) {
        const face = candidateFacesById.get(hero.faceId);
        if (face === undefined || face.buildingId !== hero.buildingId || face.planeAxis !== 'x') {
          invalid = true;
          break;
        }
        const reservation = reservationForHero(hero, face);
        const rect = { u0: reservation.u0, u1: reservation.u1, y0: reservation.y0, y1: reservation.y1 };
        const isBlade = hero.kind === 'blade';
        const expectedX = face.plane + face.outward * (hero.kind === 'brand' ? 1.2 : isBlade ? hero.width * 0.5 + 0.8 : 0.8);
        if (!facadeFaceContains(face, rect, heroFaceMargin)
          || !faceBackedByMass(face, candidateSupportMasses, rect.u0, rect.u1, rect.y0, rect.y1)
          || Math.abs(hero.x - expectedX) > 0.5) {
          invalid = true;
          break;
        }
      }
      if (invalid) continue;
      for (let index = 1; index < candidate.stageDrafts.length; index += 1) {
        const draft = candidate.stageDrafts[index]!;
        if (draft.masses.some((mass) => ![mass.x, mass.y0, mass.z, mass.width, mass.height, mass.depth].every(Number.isFinite)
          || mass.width <= 0 || mass.height <= 0 || mass.depth <= 0)) {
          invalid = true;
          break;
        }
        if (index === 1) {
          const supports = candidate.family === 'supported-spine' && candidate.spineMass
            ? [candidate.spineMass] : candidate.stageDrafts[0]!.masses;
          if (!supports.some((mass) => retainedSupportContacts(
            roofDetailMassObb(mass, 0), roofDetailMassObb(draft.masses[0]!, 0),
          ))) invalid = true;
          continue;
        }
        const parent = candidate.stageDrafts[index - 1]!;
        if (Math.abs(draft.verticalBounds.y0 - parent.verticalBounds.y1) > 0.01
          || !parent.masses.some((mass) => retainedSupportContacts(
            roofDetailMassObb(mass, 0), roofDetailMassObb(draft.masses[0]!, 0),
          ))
          || (draft.offset !== null && (
            draft.offset.parentStageIndex !== index - 1
            || draft.offset.ratio < 0.08 || draft.offset.ratio > 0.33
          ))) {
          invalid = true;
          break;
        }
      }
      if (invalid) continue;
      if (candidate.crownMasses.some((mass) =>
        Math.abs(mass.y0 - (top.y0 + top.height)) > 0.01
        || mass.x - mass.width * 0.5 < top.x - top.width * 0.5 - 1e-4
        || mass.x + mass.width * 0.5 > top.x + top.width * 0.5 + 1e-4
        || mass.z - mass.depth * 0.5 < top.z - top.depth * 0.5 - 1e-4
        || mass.z + mass.depth * 0.5 > top.z + top.depth * 0.5 + 1e-4
        || !retainedSupportContacts(roofDetailMassObb(mass, 0), topBox))) continue;

      const firstMass = candidate.stageDrafts[1]!.masses[0]!;
      const addedFirstHeight = firstMass.height - first.masses[0]!.height;
      const changedMasses: SkyriverMass[] = [
        ...(divide ? candidate.stageDrafts.slice(2).flatMap((draft) => draft.masses) : []),
        ...(divide && addedFirstHeight > 0 ? [{
          ...firstMass, y0: first.verticalBounds.y1, height: addedFirstHeight,
        }] : []),
        ...candidate.crownMasses,
      ];
      for (const mass of changedMasses) {
        const box = roofDetailMassObb(mass, 0);
        if (!Number.isFinite(mass.height) || mass.height <= 0
          || addedProfileFragments(mass, oldProfileMasses).some((fragment) =>
            checkNotchWorldConflict(fragment, oldMask),
          )
          || roofDetailIndexConflicts(wingAirIndex, box, 0)
          || roofDetailBlocksHero(box, shapeHeroBoxes)
          || shapeRouteBlocked(box)
          || [...finalNotches].some(([notchKey, notch]) => notchKey !== key && roofDetailObbsConflict(box, notch, 0))
          || shapeRoofPlanes.some((roof) => roof.y > mass.y0 + 0.001
            && roof.y < mass.y0 + mass.height - 0.001 && roofDetailObbsConflict(box, roof, 0))) {
          invalid = true;
          break;
        }
      }
      if (!invalid && candidate.crownProfile.kind === 'split') {
        const [cm0, cm1] = candidate.crownMasses;
        const candidateNotch = computeSplitCrownNotch(
          cm0!, cm1!, candidate.crownProfile.axis, cm0!.anchorV ?? tower.z,
        ).notchObb;
        if (checkNotchWorldConflict(candidateNotch, oldMask)
          || candidate.stageMasses.some((mass) => roofDetailObbsConflict(candidateNotch, roofDetailMassObb(mass, 0), 0))
          || candidate.companionMasses.some((mass) => roofDetailObbsConflict(candidateNotch, roofDetailMassObb(mass, 0), 0))
          || (candidate.spineMass !== null && roofDetailObbsConflict(candidateNotch, roofDetailMassObb(candidate.spineMass, 0), 0))
          || candidate.deckWingMasses.some((mass) => roofDetailObbsConflict(candidateNotch, roofDetailMassObb(mass, 0), 0))) {
          invalid = true;
        }
      }
      if (invalid) continue;
      accepted = candidate;
      break;
    }
    if (accepted === undefined) continue;

    for (let index = 1; index < accepted.stageDrafts.length; index += 1) {
      const original = resolved.stageDrafts[Math.min(index, resolved.stageDrafts.length - 1)]!.masses[0]!;
      seedIndices.set(accepted.stageDrafts[index]!.masses[0]!, seedIndices.get(original)!);
    }
    for (let index = 0; index < accepted.crownMasses.length; index += 1) {
      seedIndices.set(accepted.crownMasses[index]!, seedIndices.get(resolved.crownMasses[index]!)!);
    }
    const newProfileMasses = [
      ...accepted.stageMasses, ...accepted.crownMasses,
      ...(accepted.spineMass ? [accepted.spineMass] : []),
      ...accepted.deckWingMasses, ...accepted.companionMasses,
    ];
    const firstIndex = masses.findIndex((mass) => oldMask.has(mass));
    if (firstIndex < 0) fail(`SKYRIVER_R36_FIXED_SHAPE_MISSING: ${key}`);
    const kept = masses.filter((mass) => !oldMask.has(mass));
    kept.splice(firstIndex, 0, ...newProfileMasses);
    masses.length = 0;
    masses.push(...kept);
    for (const mass of oldProfileMasses) activeWorldMasses.delete(mass);
    for (const mass of newProfileMasses) {
      activeWorldMasses.add(mass);
      const box = roofDetailMassObb(mass, 0);
      roofDetailInsert(crownRepairWorldIndex, box);
      crownBoxToMass.set(box, mass);
    }
    const oldFaces = new Set(resolved.faces);
    const firstFaceIndex = exposedFaces.findIndex((face) => oldFaces.has(face));
    if (firstFaceIndex >= 0) {
      const keptFaces = exposedFaces.filter((face) => !oldFaces.has(face));
      keptFaces.splice(firstFaceIndex, 0, ...accepted.faces);
      exposedFaces.length = 0;
      exposedFaces.push(...keptFaces);
    }
    r36DataByTower.set(key, accepted);
    if (accepted.crownProfile.kind === 'split') {
      const [cm0, cm1] = accepted.crownMasses;
      finalNotches.set(key, computeSplitCrownNotch(
        cm0!, cm1!, accepted.crownProfile.axis, cm0!.anchorV ?? tower.z,
      ).notchObb);
    }
    tierMap.set(key, accepted.tiers);
  }
  acceptedNotches.clear();
  for (const [key, notch] of finalNotches) acceptedNotches.set(key, notch);
  if (!verifyAllAcceptedNotches()) fail('SKYRIVER_R36_FIXED_CROWN_NOTCH_BLOCKED');

  const notchAuditIndex = createSpatialIndex(masses.length + legacyWorld.length);
  for (let massIndex = 0; massIndex < masses.length; massIndex += 1) {
    const mass = masses[massIndex]!;
    if (mass.width <= 0 || mass.height <= 0 || mass.depth <= 0) continue;
    roofDetailInsert(notchAuditIndex, roofDetailMassObb(mass, massIndex));
  }

  for (let i = 0; i < layout.towers.length; i += 1) {
    const tower = layout.towers[i]!;
    const key = towerKey(tower);
    const data = r36DataByTower.get(key);
    if (data !== undefined && data.crownProfile.kind === 'split') {
      const crown = data.crownProfile;
      const cm0 = data.crownMasses[0]!;
      const cm1 = data.crownMasses[1]!;
      const anchorV = cm0.anchorV ?? tower.z;
      const { notchObb } = computeSplitCrownNotch(cm0, cm1, crown.axis, anchorV);
      if (roofDetailIndexConflicts(notchAuditIndex, notchObb, 0)) {
        let blockerIndex = -1;
        for (const box of notchAuditIndex.boxes) {
          if (box.massIndex !== undefined && roofDetailObbsConflict(notchObb, box, 0)) {
            blockerIndex = box.massIndex;
            break;
          }
        }
        fail(`SKYRIVER_SPLIT_NOTCH_BLOCKED: ${key} mass ${blockerIndex}`);
      }
    }
  }

  let heroes: readonly SkyriverHeroBlade[] = resolvedHeroes;
  const fitYawWingParts = (
    original: SkyriverMass, yawRad: number, oldProfile: readonly SkyriverMass[],
  ): readonly SkyriverMass[] => {
    const full = { ...original, yawRad };
    const fragments = addedProfileFragments(full, oldProfile);
    const mask = new Set(oldProfile);
    const candidates: RoofDetailObb[] = [];
    notchAuditIndex.stamp += 1;
    if (notchAuditIndex.stamp >= 0x7ffffffe) {
      notchAuditIndex.stamps.fill(0);
      notchAuditIndex.stamp = 1;
    }
    const stamp = notchAuditIndex.stamp;
    for (const fragment of fragments) {
      const x0 = Math.floor(fragment.minX / notchAuditIndex.cellSize);
      const x1 = Math.floor(fragment.maxX / notchAuditIndex.cellSize);
      const z0 = Math.floor(fragment.minZ / notchAuditIndex.cellSize);
      const z1 = Math.floor(fragment.maxZ / notchAuditIndex.cellSize);
      for (let x = x0; x <= x1; x += 1) {
        for (let z = z0; z <= z1; z += 1) {
          const bucket = notchAuditIndex.cells.get(roofDetailCellKey(x, z));
          if (bucket === undefined) continue;
          for (const index of bucket) {
            if (notchAuditIndex.stamps[index] === stamp) continue;
            notchAuditIndex.stamps[index] = stamp;
            candidates.push(notchAuditIndex.boxes[index]!);
          }
        }
      }
    }
    const blockers = candidates.filter(box => box.massIndex !== undefined
      && !mask.has(masses[box.massIndex]!) && fragments.some(fragment => roofDetailObbsConflict(fragment, box, 0)));
    if (blockers.length === 0) return [full];
    const cutLow = Math.max(original.y0, Math.min(...blockers.map(box => box.verticalBounds?.[0] ?? box.y - box.halfY)));
    const cutHigh = Math.min(original.y0 + original.height,
      Math.max(...blockers.map(box => box.verticalBounds?.[1] ?? box.y + box.halfY)));
    const band = { ...full, y0: cutLow, height: cutHigh - cutLow };
    const candidateAt = (scale: number): SkyriverMass => ({ ...band,
      width: band.width * scale, depth: band.depth * scale });
    const accepted = (candidate: SkyriverMass): boolean => !addedProfileFragments(candidate, oldProfile)
      .some(fragment => checkNotchWorldConflict(fragment, mask));
    let low = 0, high = 1;
    for (let iteration = 0; iteration < 32; iteration += 1) {
      const middle = (low + high) * 0.5;
      if (accepted(candidateAt(middle))) low = middle; else high = middle;
    }
    if (low <= 0) fail(`SKYRIVER_YAW_WING_BAND: ${layout.seed} ${original.x},${original.z}`);
    const roofMassIndex = masses.indexOf(original);
    const parts: SkyriverMass[] = [];
    if (cutHigh < original.y0 + original.height) parts.push({ ...full, y0: cutHigh,
      height: original.y0 + original.height - cutHigh,
      yawWingPart: { roofMassIndex, part: 'roof', cutLow, cutHigh } });
    parts.push({ ...candidateAt(low), yawWingPart: { roofMassIndex, part: 'band', cutLow, cutHigh } });
    if (cutLow > original.y0) parts.push({ ...full, height: cutLow - original.y0,
      yawWingPart: { roofMassIndex, part: 'below', cutLow, cutHigh } });
    return parts;
  };
  const visibleWingVolume = (parts: readonly SkyriverMass[]): number => parts.reduce((volume, part) => volume
    + part.width * part.depth * Math.max(0, part.y0 + part.height - Math.max(0, part.y0)), 0);
  const legalYawWingParts = (
    parts: readonly SkyriverMass[], spine: SkyriverMass, oldProfile: readonly SkyriverMass[],
  ): boolean => {
    const boxes = parts.map(part => roofDetailMassObb(part, 0));
    if (!retainedSupportConnected([...boxes, roofDetailMassObb(spine, 0)])) return false;
    if (boxes.some(shapeRouteBlocked)) return false;
    const roof = parts.find(part => part.yawWingPart === undefined || part.yawWingPart.part === 'roof');
    if (roof === undefined) return false;
    const mask = new Set(oldProfile);
    const roofPieces = subtractFootprint(retainedSupportFootprint(roofDetailMassObb(roof, 0)),
      retainedSupportFootprint(roofDetailMassObb(spine, 0)));
    return !roofPieces.some(piece => retainedSupportArea(piece) > 1e-10
      && checkNotchWorldConflict(roofDetailPolygonBox(piece, roof.y0 + roof.height, roof.y0 + roof.height + 8), mask));
  };
  const yawWingParts = new Map<SkyriverMass, readonly SkyriverMass[]>();
  const yawReplacements = new Map<SkyriverMass, SkyriverMass>();
  for (let towerIndex = 0; towerIndex < layout.towers.length; towerIndex += 1) {
    const tower = layout.towers[towerIndex]!;
    let data = r36DataByTower.get(towerKey(tower));
    if (data === undefined) continue;
    for (const stage of data.stageDrafts) {
      for (const [ordinal, original] of stage.masses.entries()) {
        const grime = data.deckWingMasses.includes(original) || original.y0 + original.height < 600;
        const salt = 170 + stage.stageIndex * 17 + ordinal;
        const magnitude = (grime ? 8 : 2) + (grime ? 4 : 10) * r36Hash01(layout.seed, tower, salt);
        const sign = r36Hash01(layout.seed, tower, salt + 1000) < 0.5 ? -1 : 1;
        const yawRad = sign * magnitude * Math.PI / 180;
        const c = Math.cos(yawRad), sine = Math.abs(Math.sin(yawRad));
        const scale = Math.min(
          original.width / (c * original.width + sine * original.depth),
          original.depth / (sine * original.width + c * original.depth));
        let turned: SkyriverMass = { ...original, width: original.width * scale,
          depth: original.depth * scale, yawRad };
        if (data.spineMass !== null && stage.stageIndex === 0) {
          const oldProfile = [...data.stageMasses, ...data.crownMasses, ...data.deckWingMasses,
            ...data.companionMasses, data.spineMass];
          let parts = fitYawWingParts(original, yawRad, oldProfile);
          if (visibleWingVolume(parts) < visibleWingVolume([original]) * 0.85) {
            for (const fallbackSign of [sign, -sign]) {
              const fallback = fitYawWingParts(original, fallbackSign * 2 * Math.PI / 180, oldProfile);
              if (visibleWingVolume(fallback) > visibleWingVolume(parts)
                && legalYawWingParts(fallback, data.spineMass, oldProfile)) parts = fallback;
            }
          }
          yawWingParts.set(original, parts);
          turned = { ...parts[0]! };
          for (const part of parts.slice(1)) {
            masses.push(part);
            seedIndices.set(part, seedIndices.get(original) ?? masses.length - 1);
          }
        } else if (stage.masses.length === 1 && stage !== data.stageDrafts.at(-1)) {
          interface CentreLimit { readonly base: number; readonly width: number; readonly depth: number }
          const lowerX: CentreLimit[] = [{ base: original.x - original.width * 0.5, width: c * 0.5, depth: sine * 0.5 }];
          const upperX: CentreLimit[] = [{ base: original.x + original.width * 0.5, width: -c * 0.5, depth: -sine * 0.5 }];
          const lowerZ: CentreLimit[] = [{ base: original.z - original.depth * 0.5, width: sine * 0.5, depth: c * 0.5 }];
          const upperZ: CentreLimit[] = [{ base: original.z + original.depth * 0.5, width: -sine * 0.5, depth: -c * 0.5 }];
          let parentWidth = 0, parentDepth = 0;
          if (stage.offset !== null) {
            const parentCorners = stage.offset.parentKind === 'original-footprint'
              ? massSourceFootprint({ ...original, x: tower.x, z: tower.z, width: tower.width, depth: tower.depth, yawRad: 0 })
              : data.stageDrafts[stage.offset.parentStageIndex]!.masses.flatMap(mass => massSourceFootprint(yawReplacements.get(mass) ?? mass));
            const parentX0 = Math.min(...parentCorners.map(point => point[0]));
            const parentX1 = Math.max(...parentCorners.map(point => point[0]));
            const parentZ0 = Math.min(...parentCorners.map(point => point[1]));
            const parentZ1 = Math.max(...parentCorners.map(point => point[1]));
            parentWidth = parentX1 - parentX0; parentDepth = parentZ1 - parentZ0;
            const axisX = stage.offset.axis === 'x';
            const centre = axisX ? (parentX0 + parentX1) * 0.5 : (parentZ0 + parentZ1) * 0.5;
            const span = axisX ? parentWidth : parentDepth;
            const direction = Math.sign(stage.offset.deltaM);
            const first = centre + direction * span * 0.08, last = centre + direction * span * 0.33;
            (axisX ? lowerX : lowerZ).push({ base: Math.min(first, last), width: 0, depth: 0 });
            (axisX ? upperX : upperZ).push({ base: Math.max(first, last), width: 0, depth: 0 });
          }
          const next = data.stageDrafts[stage.stageIndex + 1];
          if (next?.offset?.parentKind === 'stage'
            && next.offset.parentStageIndex === stage.stageIndex) {
            const axisX = next.offset.axis === 'x';
            const nextCentre = next.footprint[next.offset.axis];
            const direction = Math.sign(next.offset.deltaM);
            const spanWidth = axisX ? c : sine, spanDepth = axisX ? sine : c;
            const lowRatio = direction > 0 ? -0.33 : 0.08;
            const highRatio = direction > 0 ? -0.08 : 0.33;
            (axisX ? lowerX : lowerZ).push({ base: nextCentre, width: lowRatio * spanWidth, depth: lowRatio * spanDepth });
            (axisX ? upperX : upperZ).push({ base: nextCentre, width: highRatio * spanWidth, depth: highRatio * spanDepth });
          }
          const limits = [lowerX.flatMap(low => upperX.map(high => ({ width: low.width - high.width, depth: low.depth - high.depth, maximum: high.base - low.base }))),
            lowerZ.flatMap(low => upperZ.map(high => ({ width: low.width - high.width, depth: low.depth - high.depth, maximum: high.base - low.base })))].flat();
          const shelf = data.family === 'broad-shelf' && stage.stageIndex === 1;
          if (shelf && c * turned.width + sine * turned.depth <= parentWidth + 1e-8
            && sine * turned.width + c * turned.depth <= parentDepth + 1e-8) {
            const oldParent = data.stageDrafts[0]!.footprint;
            if (original.width > oldParent.width) limits.push({ width: -c, depth: -sine, maximum: -(parentWidth + 0.001) });
            else limits.push({ width: -sine, depth: -c, maximum: -(parentDepth + 0.001) });
          }
          const fits = limits.every(limit => limit.width * turned.width + limit.depth * turned.depth <= limit.maximum + 1e-9);
          const fit = fits ? turned : fitRectangleDimensions(original.width, original.depth, limits);
          if (fit === undefined) fail(`SKYRIVER_YAW_STAGE_FIT: ${layout.seed} ${towerKey(tower)} stage ${stage.stageIndex}`);
          const evaluate = (limit: CentreLimit): number => limit.base + limit.width * fit.width + limit.depth * fit.depth;
          const x = Math.max(...lowerX.map(evaluate), Math.min(original.x, ...upperX.map(evaluate)));
          const z = Math.max(...lowerZ.map(evaluate), Math.min(original.z, ...upperZ.map(evaluate)));
          turned = { ...turned, width: fit.width, depth: fit.depth, x, z };
        }
        yawReplacements.set(original, turned);
        const parts = yawWingParts.get(original);
        if (parts !== undefined) yawWingParts.set(original, [turned, ...parts.slice(1)]);
        const seedIndex = seedIndices.get(original);
        if (seedIndex !== undefined) seedIndices.set(turned, seedIndex);
      }
    }
    for (const [ordinal, original] of [...data.deckWingMasses, ...data.companionMasses].entries()) {
      if (yawReplacements.has(original)) continue;
      const grime = data.deckWingMasses.includes(original) || original.y0 + original.height < 600;
      const salt = 700 + ordinal * 17;
      const magnitude = (grime ? 8 : 2) + (grime ? 4 : 10) * r36Hash01(layout.seed, tower, salt);
      const sign = r36Hash01(layout.seed, tower, salt + 1000) < 0.5 ? -1 : 1;
      const yawRad = sign * magnitude * Math.PI / 180;
      const c = Math.cos(yawRad), sine = Math.abs(Math.sin(yawRad));
      const scale = Math.min(original.width/(c*original.width+sine*original.depth),
        original.depth/(sine*original.width+c*original.depth));
      const turned = {...original,width:original.width*scale,depth:original.depth*scale,yawRad};
      yawReplacements.set(original,turned);
      const seedIndex = seedIndices.get(original);
      if (seedIndex !== undefined) seedIndices.set(turned,seedIndex);
    }
    const top = data.stageDrafts.at(-1)!.masses[0]!;
    const turnedTop = yawReplacements.get(top)!;
    const crownX0 = Math.min(...data.crownMasses.map(mass => mass.x - mass.width * 0.5));
    const crownX1 = Math.max(...data.crownMasses.map(mass => mass.x + mass.width * 0.5));
    const crownZ0 = Math.min(...data.crownMasses.map(mass => mass.z - mass.depth * 0.5));
    const crownZ1 = Math.max(...data.crownMasses.map(mass => mass.z + mass.depth * 0.5));
    const crownCentreX = (crownX0 + crownX1) * 0.5, crownCentreZ = (crownZ0 + crownZ1) * 0.5;
    const crownHalfX = (crownX1 - crownX0) * 0.5, crownHalfZ = (crownZ1 - crownZ0) * 0.5;
    const cap: SkyriverMass = { ...top, y0: top.y0 + top.height - 4, height: 4,
      crownRole: undefined, supportRole: 'yaw-roof-cap',supportHostMassIndex:masses.indexOf(top) };
    if (!retainedSupportContacts(roofDetailMassObb(cap,0),roofDetailMassObb(turnedTop,0))) {
      fail(`SKYRIVER_YAW_ROOF_CAP_CONTACT: ${layout.seed} ${towerKey(tower)}`);
    }
    masses.push(cap);
    seedIndices.set(cap,seedIndices.get(top) ?? masses.length-1);
    const oldProfile = [...data.stageMasses,...data.crownMasses,...data.deckWingMasses,
      ...data.companionMasses,...(data.spineMass === null ? [] : [data.spineMass])];
    const mask = new Set(oldProfile);
    let selectedCrowns: SkyriverMass[] | undefined;
    let selectedCrownScaleX = 1;
    let selectedCrownScaleZ = 1;
    const initialYaw = turnedTop.yawRad!;
    for (const yaw of [initialYaw,Math.sign(initialYaw)*2*Math.PI/180]) {
      const fit = fitCrownFootprint(crownHalfX*2,crownHalfZ*2,yaw);
      if (fit === undefined) continue;
      const scaleX=fit.width/(crownHalfX*2),scaleZ=fit.depth/(crownHalfZ*2);
      const candidates = data.crownMasses.map(crown => ({ ...crown,
        x:crownCentreX+(crown.x-crownCentreX)*scaleX,
        z:crownCentreZ+(crown.z-crownCentreZ)*scaleZ,
        width:crown.width*scaleX,depth:crown.depth*scaleZ,
        yawRad:yaw,yawAnchor:{x:crownCentreX,z:crownCentreZ} }));
      if (candidates.some(candidate => addedProfileFragments(candidate,oldProfile)
        .some(fragment => checkNotchWorldConflict(fragment,mask)))) continue;
      if (data.crownProfile.kind === 'split') {
        const notch = computeSplitCrownNotch(candidates[0]!,candidates[1]!,data.crownProfile.axis,
          top.anchorV ?? top.z).notchObb;
        if (checkNotchWorldConflict(notch,mask)) continue;
      }
      selectedCrowns = candidates;
      selectedCrownScaleX = scaleX;
      selectedCrownScaleZ = scaleZ;
      break;
    }
    if (selectedCrowns === undefined) fail(`SKYRIVER_YAW_CROWN_NO_SAFE_CAP: ${layout.seed} ${towerKey(tower)} half ${crownHalfX},${crownHalfZ} yaw ${initialYaw}`);
    for (const [index,crown] of data.crownMasses.entries()) {
      const turned = selectedCrowns[index]!;
      yawReplacements.set(crown,turned);
      const seedIndex = seedIndices.get(crown);
      if (seedIndex !== undefined) seedIndices.set(turned,seedIndex);
    }
    const replace = (mass: SkyriverMass): SkyriverMass => yawReplacements.get(mass) ?? mass;
    const replaceParts = (mass: SkyriverMass): readonly SkyriverMass[] => yawWingParts.get(mass) ?? [replace(mass)];
    const finalStages = data.stageDrafts.map(stage => {
        const members = stage === data.stageDrafts.at(-1) ? [...stage.masses.flatMap(replaceParts),cap] : stage.masses.flatMap(replaceParts);
        const corners = members.flatMap(massSourceFootprint);
        const x0 = Math.min(...corners.map(point => point[0]));
        const x1 = Math.max(...corners.map(point => point[0]));
        const z0 = Math.min(...corners.map(point => point[1]));
        const z1 = Math.max(...corners.map(point => point[1]));
        return { ...stage, masses:members, footprint:{x:(x0+x1)*.5,z:(z0+z1)*.5,width:x1-x0,depth:z1-z0} };
      }).map((stage, index, stages) => {
        if (stage.offset === null) return stage;
        const parent = stage.offset.parentKind === 'original-footprint' ? tower : stages[stage.offset.parentStageIndex]!.footprint;
        const axis = stage.offset.axis;
        const span = axis === 'x' ? parent.width : parent.depth;
        const delta = stage.footprint[axis] - parent[axis];
        return { ...stage, offset: { ...stage.offset, parentSpanM: span, deltaM: delta, ratio: Math.abs(delta) / span } };
      });
    r36DataByTower.set(towerKey(tower), {
      ...data,
      stageMasses: [...data.stageMasses.flatMap(replaceParts),cap],
      stageDrafts: finalStages,
      leanProfile: data.leanProfile === 'none' ? 'none' : (() => {
        const totalOffsetM = Math.abs(finalStages.at(-1)!.footprint.z - finalStages[0]!.footprint.z);
        const riseM = finalStages.at(-1)!.verticalBounds.y1 - finalStages[1]!.verticalBounds.y0;
        return { ...data.leanProfile, totalOffsetM, riseM, angleDeg: Math.atan2(totalOffsetM, riseM) * 180 / Math.PI };
      })(),
      crownMasses: data.crownMasses.map(replace),
      deckWingMasses: data.deckWingMasses.flatMap(replaceParts),
      companionMasses: data.companionMasses.map(replace),
      crownProfile: { ...data.crownProfile,
        gapM: data.crownProfile.kind === 'split' ? data.crownProfile.gapM*(data.crownProfile.axis==='x'?selectedCrownScaleX:selectedCrownScaleZ) : 0,
        crownSpanM: data.crownProfile.crownSpanM*(data.crownProfile.axis==='x'?selectedCrownScaleX:selectedCrownScaleZ),
        bounds: {...data.crownProfile.bounds,width:data.crownProfile.bounds.width*selectedCrownScaleX,
          depth:data.crownProfile.bounds.depth*selectedCrownScaleZ},
      } as SkyriverCrownProfile,
    });
  }
  for (let index = 0; index < masses.length; index += 1) {
    masses[index] = yawReplacements.get(masses[index]!) ?? masses[index]!;
  }

  const turnedFaces = new Map<SkyriverFacadeFace, SkyriverFacadeFace>();
  const artFaces: SkyriverFacadeFace[] = [];
  const capFaces: SkyriverFacadeFace[] = [];
  const artFaceByHero = new Map<SkyriverHeroBlade, SkyriverFacadeFace>();
  for (let index = 0; index < exposedFaces.length; index += 1) {
    const face = exposedFaces[index]!;
    const original = [...yawReplacements.keys()].find(mass =>
      faceBackedByMass(face, [mass], face.u0, face.u1, face.y0, face.y1));
    if (original === undefined) continue;
    const turned = yawReplacements.get(original)!;
    const hostMassIndex = masses.indexOf(turned);
    for (const cap of masses.filter(mass => mass.supportRole === 'yaw-roof-cap' && mass.supportHostMassIndex === hostMassIndex)) {
      const y0 = Math.max(face.y0, cap.y0), y1 = Math.min(face.y1, cap.y0 + cap.height);
      const u0 = Math.max(face.u0, face.planeAxis === 'x' ? cap.z - cap.depth * 0.5 : cap.x - cap.width * 0.5);
      const u1 = Math.min(face.u1, face.planeAxis === 'x' ? cap.z + cap.depth * 0.5 : cap.x + cap.width * 0.5);
      if (y1 > y0 && u1 > u0) capFaces.push({ ...face, id: `${face.id}:yaw-roof-cap`, y0, y1, u0, u1,
        plane: face.planeAxis === 'x' ? cap.x + face.outward * cap.width * 0.5
          : cap.z + face.outward * cap.depth * 0.5,
        owner: ownerOf(cap, cap.anchorV ?? cap.z) });
    }
    const turnedFace = { ...face,
      y0: Math.max(face.y0, turned.y0), y1: Math.min(face.y1, turned.y0 + turned.height),
      plane: face.planeAxis === 'x' ? turned.x + face.outward * turned.width * 0.5
        : turned.z + face.outward * turned.depth * 0.5,
      u0: Math.max(face.u0, face.planeAxis === 'x' ? turned.z - turned.depth * 0.5 : turned.x - turned.width * 0.5),
      u1: Math.min(face.u1, face.planeAxis === 'x' ? turned.z + turned.depth * 0.5 : turned.x + turned.width * 0.5),
      owner: ownerOf(turned, turned.anchorV ?? turned.z) };
    turnedFaces.set(face, turnedFace);
    exposedFaces[index] = turnedFace;
    const wingParts = yawWingParts.get(original);
    if (wingParts !== undefined) {
      for (const [partIndex, part] of wingParts.entries()) {
        if (part === turned) continue;
        const y0 = Math.max(face.y0, part.y0), y1 = Math.min(face.y1, part.y0 + part.height);
        const u0 = Math.max(face.u0, face.planeAxis === 'x' ? part.z - part.depth * 0.5 : part.x - part.width * 0.5);
        const u1 = Math.min(face.u1, face.planeAxis === 'x' ? part.z + part.depth * 0.5 : part.x + part.width * 0.5);
        if (y1 <= y0 || u1 <= u0) continue;
        artFaces.push({ ...face, id: `${face.id}:yaw-part:${partIndex}`, y0, y1, u0, u1,
          plane: face.planeAxis === 'x' ? part.x + face.outward * part.width * 0.5
            : part.z + face.outward * part.depth * 0.5,
          owner: ownerOf(part, part.anchorV ?? part.z) });
      }
    }
    const frame = { ...(turned.yawAnchor ?? turned), yawRad: turned.yawRad };
    for (const hero of heroes.filter(hero => hero.faceId === face.id)) {
      const axisX = face.planeAxis === 'x';
      const centre = axisX ? hero.z : hero.x;
      const half = axisX && hero.kind === 'blade' ? hero.rootHalfWidthM : hero.width * 0.5;
      const margin = FACADE_FACE_EDGE_MARGIN_M + 0.25;
      const artFace: SkyriverFacadeFace = {
        ...face, id: `${face.id}:art:${hero.compositionId}:${hero.cell}`,
        u0: centre - half - margin, u1: centre + half + margin,
        y0: hero.y - hero.height * 0.5 - margin, y1: hero.y + hero.height * 0.5 + margin,
      };
      let thickness = 1;
      for (const u of [artFace.u0, artFace.u1]) {
        const local = boxLocalCoordinates(frame, axisX ? face.plane : u, axisX ? u : face.plane);
        const coordinate = axisX ? local.x - turned.x : local.z - turned.z;
        const halfNormal = (axisX ? turned.width : turned.depth) * 0.5;
        thickness = Math.max(thickness,
          (face.outward * coordinate - halfNormal + 1) / Math.cos(turned.yawRad ?? 0));
      }
      const hostFootprint = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([x, z]) => {
        const point = boxLocalPoint(frame, turned.x + x * turned.width * 0.5, turned.z + z * turned.depth * 0.5);
        return [point.x, point.z] as RetainedSupportPoint;
      });
      const cropped = retainedSupportClip(retainedSupportClip(hostFootprint,
        axisX ? 1 : 0, artFace.u0, 1), axisX ? 1 : 0, artFace.u1, -1);
      if (retainedSupportArea(cropped) <= 0.01) fail(`SKYRIVER_FIXED_ART_BACKING_CROP: ${layout.seed} ${hero.compositionId}:${hero.cell}`);
      const targetNormal = cropped.reduce((sum, point) => sum + point[axisX ? 0 : 1] / cropped.length, 0);
      const backingU0 = artFace.u0, backingU1 = artFace.u1;
      const backingCentre = centre;
      thickness = Math.max(thickness, face.outward * (face.plane - targetNormal) + 1);
      const backing: SkyriverMass = {
        x: axisX ? face.plane - face.outward * thickness * 0.5 : backingCentre,
        z: axisX ? backingCentre : face.plane - face.outward * thickness * 0.5,
        y0: artFace.y0, width: axisX ? thickness : backingU1 - backingU0,
        depth: axisX ? backingU1 - backingU0 : thickness, height: artFace.y1 - artFace.y0,
        tint: turned.tint, anchorV: turned.anchorV ?? turned.z,
        materialOwner: turned.materialOwner, building: turned.building,
        artBacking: { hostMassIndex, faceId: artFace.id },
      };
      if (!retainedSupportContacts(roofDetailMassObb(backing, masses.length), roofDetailMassObb(turned, hostMassIndex))) {
        fail(`SKYRIVER_FIXED_ART_BACKING_CONTACT: ${hero.compositionId}:${hero.cell}`);
      }
      masses.push(backing);
      seedIndices.set(backing, seedIndices.get(turned) ?? hostMassIndex);
      artFaces.push(artFace);
      artFaceByHero.set(hero, artFace);
    }
  }
  exposedFaces.push(...artFaces, ...capFaces);
  heroes = heroes.map(hero => {
    const face = artFaceByHero.get(hero);
    return face === undefined ? hero : { ...hero, faceId: face.id, owner: face.owner };
  });
  heroCache.set(layout.seed, heroes);
  for (const [key, data] of r36DataByTower) {
    r36DataByTower.set(key, {...data,
      hostFace:turnedFaces.get(data.hostFace) ?? data.hostFace,
      faces:[...data.faces.map(face => turnedFaces.get(face) ?? face), ...capFaces.filter(face => face.buildingId === data.hostFace.buildingId)],
      tiers:data.tiers.map(tier => ({...tier,face:turnedFaces.get(tier.face) ?? tier.face})),
    });
  }

  wingAirIndex.boxes.length = 0;
  wingAirIndex.cells.clear();
  for (const data of r36DataByTower.values()) {
    if (data.family !== 'supported-spine' || data.spineMass === null) continue;
    const spine = data.spineMass === null ? undefined : retainedSupportFootprint(roofDetailMassObb(data.spineMass, 0));
    for (const wing of data.stageDrafts[0]!.masses.filter(mass => mass.yawWingPart === undefined || mass.yawWingPart.part === 'roof')) {
      const footprint = retainedSupportFootprint(roofDetailMassObb(wing, 0));
      const pieces = spine === undefined ? [footprint] : subtractFootprint(footprint, spine);
      for (const piece of pieces) {
        if (retainedSupportArea(piece) <= 1e-10) continue;
        roofDetailInsert(wingAirIndex, roofDetailPolygonBox(piece, wing.y0 + wing.height, wing.y0 + wing.height + 8));
      }
    }
  }

  notchAuditIndex.boxes.length = 0;
  notchAuditIndex.cells.clear();
  for (let index = 0; index < masses.length; index += 1) {
    roofDetailInsert(notchAuditIndex, roofDetailMassObb(masses[index]!, index));
  }

  acceptedNotches.clear();
  for (const [key, data] of r36DataByTower) {
    if (data.crownProfile.kind !== 'split') continue;
    const [first, second] = data.crownMasses;
    acceptedNotches.set(key, computeSplitCrownNotch(first!, second!, data.crownProfile.axis,
      first!.anchorV ?? first!.z).notchObb);
  }

  const finalBoxes = masses.map((mass, index) => roofDetailMassObb(mass, index));
  for (const [key, data] of r36DataByTower) {
    const originalProfile = [...yawReplacements.keys()].filter(mass =>
      retainedSupportKey(mass) === retainedSupportKey(data.stageMasses[0]!));
    if (data.spineMass !== null) originalProfile.push(data.spineMass);
    const ownIndices = new Set([
      ...data.stageMasses, ...data.crownMasses,
      ...(data.spineMass === null ? [] : [data.spineMass]),
      ...data.deckWingMasses, ...data.companionMasses,
    ].map(mass => masses.indexOf(mass)));
    for (const mass of [...data.stageMasses, ...data.crownMasses, ...data.deckWingMasses, ...data.companionMasses]) {
      const box = finalBoxes[masses.indexOf(mass)]!;
      if (shapeRouteBlocked(box)) fail(`SKYRIVER_YAW_ROUTE: ${layout.seed} ${key} ${masses.indexOf(mass)}`);
      if (roofDetailIndexConflicts(wingAirIndex, box, 0)) fail(`SKYRIVER_YAW_WING_AIR: ${layout.seed} ${key} ${masses.indexOf(mass)}`);
      for (const fragment of addedProfileFragments(mass, originalProfile)) {
        if (finalBoxes.some((other, index) => !ownIndices.has(index) && roofDetailObbsConflict(fragment, other, 0))) {
          fail(`SKYRIVER_YAW_ADDED_VOLUME: ${layout.seed} ${key} ${masses.indexOf(mass)}`);
        }
      }
    }
    if (data.spineMass !== null) {
      const deck = [...data.stageDrafts[0]!.masses, data.spineMass];
      if (!retainedSupportConnected(deck.map(mass => roofDetailMassObb(mass, 0)))) {
        fail(`SKYRIVER_YAW_WING_PATH: ${layout.seed} ${key}`);
      }
    }
    for (let index = 1; index < data.stageDrafts.length; index += 1) {
      const child = data.stageDrafts[index]!;
      const parents = index === 1 && data.spineMass !== null ? [data.spineMass] : data.stageDrafts[index - 1]!.masses;
      if (!child.masses.filter(mass => mass.supportRole !== 'yaw-roof-cap').every(mass => parents.some(parent => retainedSupportContacts(
        roofDetailMassObb(parent, 0), roofDetailMassObb(mass, 0))))) {
        fail(`SKYRIVER_YAW_STAGE_CONTACT: ${layout.seed} ${key} ${index}`);
      }
    }
    const notch = acceptedNotches.get(key);
    if (notch !== undefined && finalBoxes.some(box => roofDetailObbsConflict(notch, box, 0))) {
      fail(`SKYRIVER_YAW_CROWN_AIR: ${layout.seed} ${key}`);
    }
  }
  for (const skirt of skirtRoofs) {
    if (skirt.samples.every(point => finalBoxes.some((box, index) => !isLowBaseMass(masses[index]!) && pointInObb(point, box)))) {
      fail(`SKYRIVER_YAW_ROOF_COVERAGE: ${layout.seed} ${skirt.id}`);
    }
  }

  facadeFaceCache.set(layout.seed, exposedFaces);
  massCache.set(layout.seed, masses);

  // Build R36 tower profile rows backed by the final masses array
  const profileRows: SkyriverTowerProfileRow[] = [];
  for (let i = 0; i < layout.towers.length; i += 1) {
    const tower = layout.towers[i]!;
    const arch = massingArchetype(layout, tower);
    const eligible = isEligibleTower(layout, tower);
    const towerKeyStr = `tower:${towerKey(tower)}`;
    const towerSeed = buildingSeedOf(tower.x, tower.z);

    if (!eligible) {
      profileRows.push(Object.freeze({
        eligibility: Object.freeze({
          kind: 'excluded',
          reason: towerExclusionReason(layout, tower) ?? 'excluded',
        }),
        towerIndex: i,
        towerKey: towerKeyStr,
        building: towerSeed,
        materialOwner: towerSeed,
        archetype: arch,
      }));
    } else {
      const data = r36DataByTower.get(towerKey(tower))!;
      const profileStages: SkyriverStageProfile[] = data.stageDrafts.map((sd) => {
        const massIndices = Object.freeze(sd.masses.map((m) => masses.indexOf(m)));
        return Object.freeze({
          stageIndex: sd.stageIndex,
          massIndices,
          footprint: sd.footprint,
          verticalBounds: sd.verticalBounds,
          offset: sd.offset,
        });
      });
      const supportSpineIndex = data.spineMass ? masses.indexOf(data.spineMass) : null;
      const companionMassIndices = Object.freeze(data.companionMasses.map((m) => masses.indexOf(m)));

      let finalCrown: SkyriverCrownProfile;
      if (data.crownProfile.kind === 'split') {
        const m0 = masses.indexOf(data.crownMasses[0]!);
        const m1 = masses.indexOf(data.crownMasses[1]!);
        finalCrown = Object.freeze({
          kind: 'split',
          axis: data.crownProfile.axis,
          gapM: data.crownProfile.gapM,
          crownSpanM: data.crownProfile.crownSpanM,
          bounds: data.crownProfile.bounds,
          massIndices: Object.freeze([m0, m1]) as readonly [number, number],
        });
      } else {
        const m0 = masses.indexOf(data.crownMasses[0]!);
        finalCrown = Object.freeze({
          kind: 'unsplit-fin',
          axis: data.crownProfile.axis,
          gapM: 0,
          crownSpanM: data.crownProfile.crownSpanM,
          bounds: data.crownProfile.bounds,
          massIndices: Object.freeze([m0]) as readonly [number],
        });
      }

      profileRows.push(Object.freeze({
        eligibility: Object.freeze({
          kind: 'eligible',
          reason: 'ordinary-box-stage',
        }),
        towerIndex: i,
        towerKey: towerKeyStr,
        building: towerSeed,
        materialOwner: towerSeed,
        family: data.family,
        stages: Object.freeze(profileStages),
        crown: finalCrown,
        lean: data.leanProfile === 'none' ? null : Object.freeze(data.leanProfile),
        supportSpineIndex,
        companionMassIndices,
        hostFace: data.hostFace,
      }));
    }
  }

  towerProfileCache.set(layout.seed, Object.freeze(profileRows));

  owner.length = count;
  spanTo.length = count;
  const sourceCount = count;
  const finalOwners = [...owner];
  const legacyTrims: SkyriverCityTrims = {
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
    owner:finalOwners,
    spanTo,
  };
  // Make the complete legacy trim prefix visible while deriving the existing heroes. The R35
  // suffix uses those real hero records for its own geometric exclusion, but it never changes the
  // old filter or calls hero derivation from inside the suffix builder.
  trimCache.set(layout.seed, legacyTrims);
  let detailResult: { readonly totalTrimCount: number; readonly derivation: SkyriverRoofDetailDerivation };
  let reconciliation: SkyriverLegacyTrimReconciliation;
  let supportRecords: readonly SkyriverRetainedMassSupportRecord[];
  try {
    heroCache.set(layout.seed, heroes);
    const repairFaces = new Set<SkyriverFacadeFace>(exposedFaces);
    for (const data of r36DataByTower.values()) {
      for (const face of data.faces) {
        repairFaces.add(face);
      }
    }
    reconciliation = reconcileLegacyTrimsD1(
      layout,
      legacyTrims,
      sourceCount,
      r27StartIndex,
      r27EndIndex,
      Array.from(repairFaces),
      masses,
      heroes,
      finalOwners,
    );
    reconciliation = reconcileLegacyTrimsD2(
      layout,
      legacyTrims,
      sourceCount,
      r27StartIndex,
      r27EndIndex,
      legacyWorld,
      masses,
      heroes,
      wingAirIndex,
      acceptedNotches,
      notchAuditIndex,
      reconciliation,
      finalOwners,
    );
    reconciliation = reconcileLegacyTrimsD3(
      layout,
      legacyTrims,
      sourceCount,
      r27StartIndex,
      r27EndIndex,
      legacyWorld,
      masses,
      heroes,
      wingAirIndex,
      acceptedNotches,
      reconciliation,
      new Map([...yawReplacements].map(([original,turned])=>[turned,original])),
      shapeRouteBlocked,
    );
    notchAuditIndex.boxes.length=0;
    notchAuditIndex.cells.clear();
    for (let index=0;index<masses.length;index+=1) roofDetailInsert(notchAuditIndex,roofDetailMassObb(masses[index]!,index));
    const visibleLegacyTrimIndex = createSpatialIndex(sourceCount);
    for (let i = 0; i < sourceCount; i += 1) {
      if (skyriverTrimBlocksHero(legacyTrims, i, heroes)) continue;
      roofDetailInsert(visibleLegacyTrimIndex, roofDetailTrimObb(legacyTrims, i));
    }
    supportRecords = appendRetainedMassSupports(
      layout,
      legacyWorld,
      masses,
      heroes,
      visibleLegacyTrimIndex,
      wingAirIndex,
      acceptedNotches,
      notchAuditIndex,
      createSpatialIndex,
      shapeRouteBlocked,
      exposedFaces,
    );
    const collisionIndex = buildRoofDetailCollisionIndex(masses, legacyTrims, heroes, layout);
    detailResult = appendRoofDetailSuffix(
      masses,
      legacyTrims,
      { cx, cy, cz, sx, sy, sz, kind, seedValue, owner:finalOwners, spanTo },
      cap,
      collisionIndex,
      new DeterministicRandom(layout.seed).fork('skyriver.city.r35.roof_details'),
    );
    const finalMassBoxes = masses.map((mass, index) => roofDetailMassObb(mass, index));
    reconciliation = Object.freeze({ ...reconciliation,
      dispositions: Object.freeze(reconciliation.dispositions.map(disposition => {
        if (disposition.kind !== 'span-rehosted') return disposition;
        const [first, second] = disposition.newWorld.endpoints;
        const exposedLengthM = chordExposedLength(first, second, disposition.newWorld.worldLengthM, finalMassBoxes);
        return Object.freeze({ ...disposition,
          newWorld: Object.freeze({ ...disposition.newWorld, exposedLengthM }) });
      })) });
  } catch (error) {
    trimCache.delete(layout.seed);
    trimReconciliationCache.delete(layout.seed);
    retainedMassSupportCache.delete(layout.seed);
    throw error;
  }
  count = detailResult.totalTrimCount;
  roofDetailCache.set(layout.seed, detailResult.derivation);

  const trims: SkyriverCityTrims = { ...legacyTrims, count };
  trimCache.set(layout.seed, trims);
  trimReconciliationCache.set(layout.seed, reconciliation);
  massSeedIndexCache.set(layout.seed, seedIndices);
  retainedMassSupportCache.set(layout.seed, supportRecords);
  return trims;
}

/** The cached GL-free R35 derivation. Calling it also completes the existing trim derivation. */
export function deriveRoofDetails(layout: SkyriverCityLayout): SkyriverRoofDetailDerivation {
  const cached = roofDetailCache.get(layout.seed);
  if (cached !== undefined) return cached;
  deriveCityTrims(layout);
  const derivation = roofDetailCache.get(layout.seed);
  if (derivation === undefined) fail('SKYRIVER_ROOF_DETAILS_MISSING');
  return derivation;
}

interface RoofDetailObb {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly halfX: number;
  readonly halfY: number;
  readonly halfZ: number;
  readonly ux: number;
  readonly uz: number;
  readonly vx: number;
  readonly vz: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly coordinateUlpM: number;
  readonly footprint?: readonly RetainedSupportPoint[];
  readonly verticalBounds?: readonly [number,number];
  /** Only a roof-mounted candidate's own support may meet it at zero vertical clearance. */
  readonly massIndex?: number;
}

interface RoofDetailCollisionIndex {
  readonly cellSize: number;
  readonly cells: Map<string, number[]>;
  readonly boxes: RoofDetailObb[];
  readonly stamps: Int32Array;
  stamp: number;
}

const roofDetailHeroBoxCache = new Map<number, readonly RoofDetailObb[]>();

interface RoofDetailComponent {
  readonly role: SkyriverRoofDetailRole;
  readonly dx: number;
  readonly dz: number;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
}

interface RoofDetailSupport {
  readonly mass: SkyriverMass;
  readonly massIndex: number;
  readonly stratum: SkyriverRoofDetailStratum;
  readonly roofY: number;
}

interface RoofDetailClusterTask {
  readonly stratumIndex: 0 | 1 | 2;
  readonly ordinal: number;
  readonly phase: number;
  readonly clusterId: number;
}

const ROOF_DETAIL_STRATA = Object.freeze(['grime', 'mid', 'pristine'] as const);
const ROOF_DETAIL_SPATIAL_CELL_M = 128;
const ROOF_DETAIL_CLEARANCE_M = 0.35;
const ROOF_DETAIL_SUPPORT_INSET_M = 2;
const roofDetailWarp: WarpOut = { x: 0, z: 0, heading: 0 };
const roofDetailPlaced: SkyriverTrimPlacement = { x: 0, z: 0, heading: 0, length: 0 };

function roofDetailStratumIndex(stratum: SkyriverRoofDetailStratum): 0 | 1 | 2 {
  return stratum === 'grime' ? 0 : stratum === 'mid' ? 1 : 2;
}

function roofDetailStratumFor(y: number): SkyriverRoofDetailStratum {
  return y < 600 ? 'grime' : y < 1800 ? 'mid' : 'pristine';
}

function roofDetailRandomFloat(random: DeterministicRandom, min: number, max: number): number {
  return min + (max - min) * random.nextInt(0, 10000) / 10000;
}

function roofDetailScalarUlp(value: number): number {
  const absolute = Math.abs(value);
  if (absolute === 0) return 2 ** -149;
  return 2 ** (Math.floor(Math.log2(absolute)) - 23);
}

function roofDetailBox(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  heading: number,
  massIndex?: number,
): RoofDetailObb {
  const ux = Math.cos(heading);
  const uz = -Math.sin(heading);
  const vx = Math.sin(heading);
  const vz = Math.cos(heading);
  const halfX = sx * 0.5;
  const halfZ = sz * 0.5;
  const radiusX = Math.abs(ux) * halfX + Math.abs(vx) * halfZ;
  const radiusZ = Math.abs(uz) * halfX + Math.abs(vz) * halfZ;
  return {
    x, y, z, halfX, halfY: sy * 0.5, halfZ, ux, uz, vx, vz,
    minX: x - radiusX, maxX: x + radiusX,
    minZ: z - radiusZ, maxZ: z + radiusZ,
    coordinateUlpM: Math.max(
      roofDetailScalarUlp(x),
      roofDetailScalarUlp(y),
      roofDetailScalarUlp(z),
    ),
    ...(massIndex === undefined ? {} : { massIndex }),
  };
}

function roofDetailPolygonBox(
  footprint: readonly RetainedSupportPoint[], bottom: number, top: number,
): RoofDetailObb {
  const minX = Math.min(...footprint.map(point => point[0]));
  const maxX = Math.max(...footprint.map(point => point[0]));
  const minZ = Math.min(...footprint.map(point => point[1]));
  const maxZ = Math.max(...footprint.map(point => point[1]));
  return { ...roofDetailBox((minX + maxX) * 0.5, (bottom + top) * 0.5,
    (minZ + maxZ) * 0.5, maxX - minX, top - bottom, maxZ - minZ, 0), footprint,verticalBounds:[bottom,top] };
}

function roofDetailMassObb(mass: SkyriverMass, massIndex: number): RoofDetailObb {
  warpBoxPoint(mass, mass.x, mass.z, roofDetailWarp);
  return { ...roofDetailBox(
    roofDetailWarp.x,
    mass.y0 + mass.height * 0.5,
    roofDetailWarp.z,
    mass.width,
    mass.height,
    mass.depth,
    roofDetailWarp.heading,
    massIndex,
  ),verticalBounds:[mass.y0,mass.y0+mass.height] };
}

function roofDetailTrimObb(trims: SkyriverCityTrims, index: number): RoofDetailObb {
  placeTrim(trims, index, roofDetailPlaced);
  const sx = trims.sx[index]!;
  const sz = trims.sz[index]!;
  const acrossSpan = roofDetailPlaced.length > 0 && sx > sz;
  const alongSpan = roofDetailPlaced.length > 0 && sz >= sx;
  const worldXSize = acrossSpan ? roofDetailPlaced.length : sx;
  const worldZSize = alongSpan ? roofDetailPlaced.length : sz;
  return roofDetailBox(
    roofDetailPlaced.x,
    trims.cy[index]!,
    roofDetailPlaced.z,
    worldXSize,
    trims.sy[index]!,
    worldZSize,
    roofDetailPlaced.heading,
  );
}

function roofDetailFloatTolerance(a: RoofDetailObb, b: RoofDetailObb): number {
  return Math.max(a.coordinateUlpM, b.coordinateUlpM) * 2;
}

function roofDetailRadiusOn(box: RoofDetailObb, axisX: number, axisZ: number): number {
  return box.halfX * Math.abs(box.ux * axisX + box.uz * axisZ)
    + box.halfZ * Math.abs(box.vx * axisX + box.vz * axisZ);
}

function roofDetailObbsConflict(a: RoofDetailObb, b: RoofDetailObb, gapM: number): boolean {
  const tolerance = roofDetailFloatTolerance(a, b);
  const verticalSeparation = Math.max(
    b.y - b.halfY - (a.y + a.halfY),
    a.y - a.halfY - (b.y + b.halfY),
  );
  if (verticalSeparation >= gapM - tolerance) return false;

  if (a.footprint !== undefined || b.footprint !== undefined) {
    const pa = retainedSupportFootprint(a), pb = retainedSupportFootprint(b);
    for (const polygon of [pa, pb]) {
      for (let index = 0; index < polygon.length; index += 1) {
        const p = polygon[index]!, q = polygon[(index + 1) % polygon.length]!;
        const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (length === 0) continue;
        const ax = -(q[1] - p[1]) / length, az = (q[0] - p[0]) / length;
        const project = (points: readonly RetainedSupportPoint[]): readonly [number, number] => {
          const values = points.map(point => (point[0] - a.x) * ax + (point[1] - a.z) * az);
          return [Math.min(...values), Math.max(...values)];
        };
        const ia = project(pa), ib = project(pb);
        if (Math.max(ib[0] - ia[1], ia[0] - ib[1]) >= gapM - tolerance) return false;
      }
    }
    return true;
  }

  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const axes = [
    [a.ux, a.uz],
    [a.vx, a.vz],
    [b.ux, b.uz],
    [b.vx, b.vz],
  ] as const;
  for (const [axisX, axisZ] of axes) {
    const separation = Math.abs(dx * axisX + dz * axisZ);
    const radii = roofDetailRadiusOn(a, axisX, axisZ) + roofDetailRadiusOn(b, axisX, axisZ);
    if (separation >= radii + gapM - tolerance) return false;
  }
  return true;
}

type RetainedSupportPoint = readonly [number, number];

interface RetainedSupportEntry {
  readonly mass: SkyriverMass;
  readonly massIndex: number;
  readonly box: RoofDetailObb;
}

interface RetainedSupportGroup {
  readonly entries: RetainedSupportEntry[];
  readonly envelope: [number, number, number, number];
}

interface RetainedSupportCandidate {
  readonly mass: SkyriverMass;
  readonly box: RoofDetailObb;
  readonly hostMassIndex: number;
  readonly sourceHostIndex: number;
  readonly volume: number;
}

function retainedSupportOwner(mass: SkyriverMass): number {
  return mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z);
}

function retainedSupportKey(mass: SkyriverMass): string {
  return hostIndexKey(retainedSupportOwner(mass), mass.anchorV ?? mass.z);
}

function retainedSupportFootprint(box: RoofDetailObb): RetainedSupportPoint[] {
  if (box.footprint !== undefined) return [...box.footprint];
  return ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([u, v]) => [
    box.x + u * box.halfX * box.ux + v * box.halfZ * box.vx,
    box.z + u * box.halfX * box.uz + v * box.halfZ * box.vz,
  ]);
}

function massSourceFootprint(mass: SkyriverMass): RetainedSupportPoint[] {
  const frame = {...(mass.yawAnchor ?? mass),yawRad:mass.yawRad};
  return ([[-1,-1],[1,-1],[1,1],[-1,1]] as const).map(([x,z]) => {
    const point=boxLocalPoint(frame,mass.x+x*mass.width*.5,mass.z+z*mass.depth*.5);
    return [point.x,point.z];
  });
}

function footprintCrossSection(
  polygon: readonly RetainedSupportPoint[], axis: 0 | 1, coordinate: number,
): readonly [number,number] | undefined {
  const values:number[]=[];
  const other=axis===0?1:0;
  for (let index=0;index<polygon.length;index+=1) {
    const a=polygon[index]!,b=polygon[(index+1)%polygon.length]!;
    if (a[axis]===coordinate) values.push(a[other]);
    if ((a[axis]<coordinate && b[axis]>coordinate)||(a[axis]>coordinate && b[axis]<coordinate)) {
      const t=(coordinate-a[axis])/(b[axis]-a[axis]);
      values.push(a[other]+t*(b[other]-a[other]));
    }
  }
  return values.length===0?undefined:[Math.min(...values),Math.max(...values)];
}

function retainedSupportClip(
  polygon: readonly RetainedSupportPoint[],
  axis: 0 | 1,
  value: number,
  sign: 1 | -1,
): RetainedSupportPoint[] {
  const result: RetainedSupportPoint[] = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[(i + 1) % polygon.length]!;
    const insideA = sign * (a[axis] - value) >= 0;
    const insideB = sign * (b[axis] - value) >= 0;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return result;
}

function retainedSupportRectClip(
  polygon: readonly RetainedSupportPoint[],
  x0: number, x1: number, z0: number, z1: number,
): RetainedSupportPoint[] {
  return retainedSupportClip(
    retainedSupportClip(
      retainedSupportClip(retainedSupportClip(polygon, 0, x0, 1), 0, x1, -1),
      1, z0, 1,
    ),
    1, z1, -1,
  );
}

function retainedSupportArea(polygon: readonly RetainedSupportPoint[]): number {
  if (polygon.length < 3) return 0;
  const origin = polygon[0]!;
  let twiceArea = 0;
  for (let i = 1; i + 1 < polygon.length; i += 1) {
    const a = polygon[i]!;
    const b = polygon[i + 1]!;
    twiceArea += (a[0] - origin[0]) * (b[1] - origin[1])
      - (a[1] - origin[1]) * (b[0] - origin[0]);
  }
  return Math.abs(twiceArea) * 0.5;
}

function retainedSupportInFrame(
  box: RoofDetailObb,
  host: RoofDetailObb,
  x = 0,
  z = 0,
): RetainedSupportPoint[] {
  return retainedSupportFootprint(box).map(([wx, wz]) => {
    const dx = wx - host.x;
    const dz = wz - host.z;
    return [x + dx * host.ux + dz * host.uz, z + dx * host.vx + dz * host.vz];
  });
}

/** Volume and face contact count. Edge and corner contact do not count. */
function retainedSupportContacts(a: RoofDetailObb, b: RoofDetailObb): boolean {
  if (roofDetailObbsConflict(a, b, 0)) return true;
  const tolerance = roofDetailFloatTolerance(a, b);
  const vertical = Math.min(a.y + a.halfY, b.y + b.halfY)
    - Math.max(a.y - a.halfY, b.y - b.halfY);
  if (vertical < -tolerance) return false;
  const polygon = retainedSupportInFrame(a, b);
  if (Math.abs(vertical) <= tolerance) {
    return retainedSupportArea(retainedSupportRectClip(
      polygon, -b.halfX, b.halfX, -b.halfZ, b.halfZ,
    )) > tolerance * tolerance;
  }
  // A side face needs a parallel edge and a positive vertical interval.
  for (const axis of [0, 1] as const) {
    const cross = axis === 0 ? 1 : 0;
    const half = axis === 0 ? b.halfX : b.halfZ;
    const crossHalf = cross === 0 ? b.halfX : b.halfZ;
    for (const sign of [-1, 1] as const) {
      const face = sign * half;
      if (!polygon.every((p) => sign * (p[axis] - face) >= -tolerance)) continue;
      for (let i = 0; i < polygon.length; i += 1) {
        const p = polygon[i]!;
        const q = polygon[(i + 1) % polygon.length]!;
        if (Math.abs(p[axis] - face) > tolerance || Math.abs(q[axis] - face) > tolerance) continue;
        const overlap = Math.min(crossHalf, Math.max(p[cross], q[cross]))
          - Math.max(-crossHalf, Math.min(p[cross], q[cross]));
        if (overlap > tolerance && vertical > tolerance) return true;
      }
    }
  }
  return false;
}

/** The last box is the root. Every box needs a volume or face contact path. */
function retainedSupportConnected(boxes: readonly RoofDetailObb[]): boolean {
  const connected = new Set([boxes.length - 1]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = 0; index < boxes.length; index += 1) {
      if (connected.has(index)) continue;
      if ([...connected].some(host => retainedSupportContacts(boxes[index]!, boxes[host]!))) {
        connected.add(index);
        changed = true;
      }
    }
  }
  return connected.size === boxes.length;
}

function retainedSupportNearby(
  index: RoofDetailCollisionIndex,
  box: RoofDetailObb,
  margin = 0,
): RoofDetailObb[] {
  const seen = new Set<number>();
  const result: RoofDetailObb[] = [];
  const minX = Math.floor((box.minX - margin) / index.cellSize);
  const maxX = Math.floor((box.maxX + margin) / index.cellSize);
  const minZ = Math.floor((box.minZ - margin) / index.cellSize);
  const maxZ = Math.floor((box.maxZ + margin) / index.cellSize);
  for (let x = minX; x <= maxX; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      for (const i of index.cells.get(roofDetailCellKey(x, z)) ?? []) {
        if (seen.has(i)) continue;
        seen.add(i);
        result.push(index.boxes[i]!);
      }
    }
  }
  return result;
}

/** All boxes use the exact owner frame. Cell boundaries include every box face. */
function retainedSupportContained(
  support: SkyriverMass,
  originals: readonly RetainedSupportEntry[],
): boolean {
  const bounds = (mass: SkyriverMass): readonly [number, number, number, number, number, number] => [
    mass.x - mass.width * 0.5, mass.x + mass.width * 0.5,
    mass.y0, mass.y0 + mass.height,
    mass.z - mass.depth * 0.5, mass.z + mass.depth * 0.5,
  ];
  const polygon = ([-1, 1] as const).flatMap(x => ([-1, 1] as const).map(z => {
    const p = boxLocalPoint(support, support.x + x * support.width * 0.5,
      support.z + z * support.depth * 0.5);
    return [p.x, p.z] as RetainedSupportPoint;
  }));
  const footprint = [polygon[0]!, polygon[2]!, polygon[3]!, polygon[1]!];
  const piece = [Math.min(...polygon.map(p => p[0])), Math.max(...polygon.map(p => p[0])),
    support.y0, support.y0 + support.height,
    Math.min(...polygon.map(p => p[1])), Math.max(...polygon.map(p => p[1]))] as const;
  const boxes = originals.map((entry) => bounds(entry.mass)).filter((b) =>
    b[1] > piece[0] && b[0] < piece[1]
    && b[3] > piece[2] && b[2] < piece[3]
    && b[5] > piece[4] && b[4] < piece[5]);
  const axes = ([0, 2, 4] as const).map((axis) => [...new Set([
    piece[axis], piece[axis + 1]!,
    ...boxes.flatMap((b) => [
      Math.max(piece[axis], b[axis]),
      Math.min(piece[axis + 1]!, b[axis + 1]!),
    ]),
  ])].sort((a, b) => a - b));
  const xs = axes[0]!;
  const ys = axes[1]!;
  const zs = axes[2]!;
  for (let x = 0; x + 1 < xs.length; x += 1) {
    for (let y = 0; y + 1 < ys.length; y += 1) {
      for (let z = 0; z + 1 < zs.length; z += 1) {
        const x0 = xs[x]!, x1 = xs[x + 1]!;
        const y0 = ys[y]!, y1 = ys[y + 1]!;
        const z0 = zs[z]!, z1 = zs[z + 1]!;
        if (x1 <= x0 || y1 <= y0 || z1 <= z0) continue;
        // Membership is constant in each open cell. Check its full bounds.
        if (!boxes.some((b) => b[0] <= x0 && b[1] >= x1
          && b[2] <= y0 && b[3] >= y1 && b[4] <= z0 && b[5] >= z1)
          && retainedSupportArea(retainedSupportRectClip(footprint, x0, x1, z0, z1)) > 0) return false;
      }
    }
  }
  return true;
}

function createCityRouteBlocker(): (box: RoofDetailObb) => boolean {
  const routeCellSize = 200;
  const routeCells = new Map<string, { readonly x: number; readonly y: number; readonly z: number; readonly radius: number }[]>();
  const addRoutePose = (x: number, y: number, z: number, radius: number): void => {
    const key = roofDetailCellKey(Math.floor(x / routeCellSize), Math.floor(z / routeCellSize));
    const bucket = routeCells.get(key) ?? [];
    bucket.push({ x, y, z, radius });
    routeCells.set(key, bucket);
  };
  const pose = { cutFade: 0, v: 0, lateral: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
  const camera = createCameraPoseScratch();
  for (let v = 0; v < CANYON_LOOP_LENGTH_M; v += 2) {
    autopilotTrackPose(v, pose);
    addRoutePose(pose.x, pose.y, pose.z, CLEARANCE_SHUTTLE_RADIUS_M);
    for (const [speed, boostT] of [[40, 0], [260, 0], [260, 1]] as const) {
      writeCameraPose(camera, { ...pose, speed, mode: 0, autopilotT: 0, boostT }, { orbitYaw: 0, orbitPitch: 0 });
      addRoutePose(camera.position.x, camera.position.y, camera.position.z, CLEARANCE_CAMERA_RADIUS_M);
    }
  }
  return (box: RoofDetailObb): boolean => {
    const radius = Math.max(CLEARANCE_SHUTTLE_RADIUS_M, CLEARANCE_CAMERA_RADIUS_M);
    const minX = Math.floor((box.minX - radius) / routeCellSize);
    const maxX = Math.floor((box.maxX + radius) / routeCellSize);
    const minZ = Math.floor((box.minZ - radius) / routeCellSize);
    const maxZ = Math.floor((box.maxZ + radius) / routeCellSize);
    for (let x = minX; x <= maxX; x += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        for (const p of routeCells.get(roofDetailCellKey(x, z)) ?? []) {
          const dx = p.x - box.x;
          const dz = p.z - box.z;
          const distance = Math.hypot(
            Math.max(0, Math.abs(dx * box.ux + dz * box.uz) - box.halfX),
            Math.max(0, Math.abs(p.y - box.y) - box.halfY),
            Math.max(0, Math.abs(dx * box.vx + dz * box.vz) - box.halfZ),
          );
          if (distance < p.radius) return true;
        }
      }
    }
    return false;
  };
}

function appendRetainedMassSupports(
  layout: SkyriverCityLayout,
  legacyWorld: readonly SkyriverMass[],
  masses: SkyriverMass[],
  heroes: readonly SkyriverHeroBlade[],
  visibleLegacyTrimIndex: RoofDetailCollisionIndex,
  wingAirIndex: RoofDetailCollisionIndex,
  acceptedNotches: ReadonlyMap<string, RoofDetailObb>,
  worldIndex: RoofDetailCollisionIndex,
  createIndex: (capacity: number) => RoofDetailCollisionIndex,
  routeBlocked: (box: RoofDetailObb) => boolean,
  sourceFaces?: readonly SkyriverFacadeFace[],
): readonly SkyriverRetainedMassSupportRecord[] {
  const originalGroups = new Map<string, RetainedSupportGroup>();
  const baselineIndex = createIndex(legacyWorld.length);
  const sourceEntries = new Map<number, RetainedSupportEntry>();
  for (let i = 0; i < legacyWorld.length; i += 1) {
    const mass = legacyWorld[i]!;
    if ((mass.layer ?? 0) !== 0 || mass.width <= 0 || mass.height <= 0 || mass.depth <= 0) continue;
    const entry = { mass, massIndex: i, box: roofDetailMassObb(mass, i) };
    sourceEntries.set(i, entry);
    roofDetailInsert(baselineIndex, entry.box);
    const key = retainedSupportKey(mass);
    let group = originalGroups.get(key);
    if (group === undefined) {
      group = { entries: [], envelope: [Infinity, -Infinity, Infinity, -Infinity] };
      originalGroups.set(key, group);
    }
    group.entries.push(entry);
    const e = group.envelope;
    e[0] = Math.min(e[0], mass.x - mass.width * 0.5);
    e[1] = Math.max(e[1], mass.x + mass.width * 0.5);
    e[2] = Math.min(e[2], mass.z - mass.depth * 0.5);
    e[3] = Math.max(e[3], mass.z + mass.depth * 0.5);
  }

  const finalCount = masses.length;
  const finalEntries = new Map<number, RetainedSupportEntry>();
  const finalGroups = new Map<string, RetainedSupportEntry[]>();
  const finalOccurrences = new Map<SkyriverMass, number[]>();
  for (let i = 0; i < finalCount; i += 1) {
    const mass = masses[i]!;
    const occurrences = finalOccurrences.get(mass) ?? [];
    occurrences.push(i);
    finalOccurrences.set(mass, occurrences);
    if ((mass.layer ?? 0) !== 0 || mass.artBacking !== undefined || mass.width <= 0 || mass.height <= 0 || mass.depth <= 0) continue;
    const entry = { mass, massIndex: i, box: roofDetailMassObb(mass, i) };
    finalEntries.set(i, entry);
    const key = retainedSupportKey(mass);
    const group = finalGroups.get(key) ?? [];
    group.push(entry);
    finalGroups.set(key, group);
  }

  let contactMargin = 0;
  for (const box of [...baselineIndex.boxes, ...worldIndex.boxes]) {
    contactMargin = Math.max(contactMargin, box.coordinateUlpM * 2);
  }
  const rooted = new Set<number>();
  const queue: RetainedSupportEntry[] = [];
  for (const entry of finalEntries.values()) {
    if (entry.mass.y0 !== SKYRIVER_CITY_VOID_BASE_Y) continue;
    const originals = originalGroups.get(retainedSupportKey(entry.mass));
    if (!originals?.entries.some((old) => old.mass.y0 === SKYRIVER_CITY_VOID_BASE_Y)) continue;
    rooted.add(entry.massIndex);
    queue.push(entry);
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const entry = queue[cursor]!;
    for (const box of retainedSupportNearby(worldIndex, entry.box, contactMargin)) {
      if (box.massIndex === undefined || rooted.has(box.massIndex)) continue;
      const next = finalEntries.get(box.massIndex);
      if (next === undefined
        || retainedSupportKey(next.mass) !== retainedSupportKey(entry.mass)
        || !retainedSupportContacts(entry.box, next.box)) continue;
      rooted.add(next.massIndex);
      queue.push(next);
    }
  }

  const losses: {
    readonly child: RetainedSupportEntry;
    readonly childFinalIndex: number;
    readonly oldContacts: readonly RetainedSupportEntry[];
  }[] = [];
  const occurrenceCursors = new Map<SkyriverMass, number>();
  for (let sourceIndex = 0; sourceIndex < legacyWorld.length; sourceIndex += 1) {
    const mass = legacyWorld[sourceIndex]!;
    const cursor = occurrenceCursors.get(mass) ?? 0;
    occurrenceCursors.set(mass, cursor + 1);
    const childFinalIndex = finalOccurrences.get(mass)?.[cursor];
    const child = sourceEntries.get(sourceIndex);
    if (child === undefined || childFinalIndex === undefined || mass.y0 === SKYRIVER_CITY_VOID_BASE_Y) continue;
    const current = finalEntries.get(childFinalIndex);
    if (current === undefined) fail('SKYRIVER_RETAINED_SUPPORT_CHILD_MISSING');
    if (retainedSupportNearby(worldIndex, current.box, contactMargin).some((box) =>
      box.massIndex !== childFinalIndex && box.massIndex !== undefined
      && finalEntries.has(box.massIndex) && retainedSupportContacts(current.box, box))) continue;
    const oldContacts = retainedSupportNearby(baselineIndex, child.box, contactMargin)
      .filter((box) => box.massIndex !== sourceIndex && retainedSupportContacts(child.box, box))
      .map((box) => sourceEntries.get(box.massIndex!)!)
      .sort((a, b) => a.massIndex - b.massIndex);
    if (oldContacts.length > 0) losses.push({ child, childFinalIndex, oldContacts });
  }

  if (losses.length === 0) return Object.freeze([]);

  const heroBoxes = roofDetailHeroObbs(layout, heroes, sourceFaces);
  const r27Roofs = [...finalEntries.values()].filter((entry) => entry.mass.baseRecord !== undefined);
  const acceptedBoxes: RoofDetailObb[] = [];
  const records: SkyriverRetainedMassSupportRecord[] = [];
  type ContactCandidate = RetainedSupportCandidate & {
    readonly contactCap: number;
    readonly patchRadius: number;
  };
  const compareCandidates = (a: ContactCandidate, b: ContactCandidate): number =>
    b.contactCap - a.contactCap || b.patchRadius - a.patchRadius
    || a.volume - b.volume || a.hostMassIndex - b.hostMassIndex || a.sourceHostIndex - b.sourceHostIndex;
  for (const { child, childFinalIndex, oldContacts } of losses) {
    const unique = new Map<string, ContactCandidate>();
    for (const old of oldContacts) {
      const key = retainedSupportKey(old.mass);
      for (const host of finalGroups.get(key) ?? []) {
        if (!rooted.has(host.massIndex) || host.massIndex === childFinalIndex) continue;
        const y0 = Math.max(child.mass.y0, host.mass.y0);
        const y1 = Math.min(child.mass.y0 + child.mass.height, host.mass.y0 + host.mass.height);
        if (y1 - y0 < 0.01) continue;
        const sourceFrame = (host.mass.yawRad ?? 0) === 0 ? host.box
          : roofDetailMassObb({ ...host.mass, yawRad: 0 }, host.massIndex);
        const polygon = retainedSupportRectClip(
          retainedSupportInFrame(child.box, sourceFrame, host.mass.x, host.mass.z),
          old.mass.x - old.mass.width * 0.5, old.mass.x + old.mass.width * 0.5,
          old.mass.z - old.mass.depth * 0.5, old.mass.z + old.mass.depth * 0.5,
        );
        if (polygon.length < 3 || retainedSupportArea(polygon) < 0.01) continue;
        const centre: RetainedSupportPoint = polygon.reduce<[number, number]>(
          (sum, p) => [sum[0] + p[0] / polygon.length, sum[1] + p[1] / polygon.length], [0, 0],
        );
        const points: RetainedSupportPoint[] = [
          centre,
          ...polygon.map<RetainedSupportPoint>((p) => [centre[0] * 0.25 + p[0] * 0.75, centre[1] * 0.25 + p[1] * 0.75]),
          ...polygon.map<RetainedSupportPoint>((p, i) => {
            const q = polygon[(i + 1) % polygon.length]!;
            return [centre[0] * 0.25 + (p[0] + q[0]) * 0.375, centre[1] * 0.25 + (p[1] + q[1]) * 0.375];
          }),
        ];
        let freeContactRegions: readonly (readonly RetainedSupportPoint[])[] = [polygon];
        for (const hero of heroBoxes) {
          if (hero.y + hero.halfY <= y0 || hero.y - hero.halfY >= y1) continue;
          const footprint = retainedSupportInFrame(hero, sourceFrame, host.mass.x, host.mass.z);
          freeContactRegions = freeContactRegions.flatMap(region => subtractFootprint(region, footprint));
        }
        for (const region of freeContactRegions) {
          if (retainedSupportArea(region) < 0.01) continue;
          const middle = region.reduce<[number, number]>((sum, p) =>
            [sum[0] + p[0] / region.length, sum[1] + p[1] / region.length], [0, 0]);
          points.push(middle);
          for (const [index, p] of region.entries()) {
            const q = region[(index + 1) % region.length]!;
            points.push([middle[0] * 0.25 + p[0] * 0.75, middle[1] * 0.25 + p[1] * 0.75]);
            points.push([middle[0] * 0.25 + (p[0] + q[0]) * 0.375, middle[1] * 0.25 + (p[1] + q[1]) * 0.375]);
          }
        }
        for (const fraction of [0.95, 0.995] as const) {
          points.push(...polygon.map<RetainedSupportPoint>((p) => [
            centre[0] + (p[0] - centre[0]) * fraction,
            centre[1] + (p[1] - centre[1]) * fraction,
          ]));
          points.push(...polygon.map<RetainedSupportPoint>((p, i) => {
            const q = polygon[(i + 1) % polygon.length]!;
            return [
              centre[0] + ((p[0] + q[0]) * 0.5 - centre[0]) * fraction,
              centre[1] + ((p[1] + q[1]) * 0.5 - centre[1]) * fraction,
            ];
          }));
        }
        const heights: (readonly [number, number])[] = y1 - y0 <= 4
          ? [[y0, y1]]
          : [[(y0 + y1) * 0.5 - 2, (y0 + y1) * 0.5 + 2], [y0, y0 + 4], [y1 - 4, y1]];
        for (const point of points) {
          let distance = Infinity;
          for (let i = 0; i < polygon.length; i += 1) {
            const a = polygon[i]!;
            const b = polygon[(i + 1) % polygon.length]!;
            distance = Math.min(distance, Math.abs(
              (b[0] - a[0]) * (a[1] - point[1]) - (a[0] - point[0]) * (b[1] - a[1]),
            ) / Math.hypot(b[0] - a[0], b[1] - a[1]));
          }
          for (const contactCap of [4, 2, 1] as const) {
            const patchRadius = Math.min(contactCap, distance / Math.SQRT2 * 0.9);
            if (!Number.isFinite(patchRadius) || patchRadius < 0.02) continue;
            const inset = Math.min(contactCap, host.mass.width / 4, host.mass.depth / 4);
            const frame = { ...(host.mass.yawAnchor ?? host.mass), yawRad: host.mass.yawRad };
            const local = boxLocalCoordinates(frame, point[0], point[1]);
            const target = boxLocalPoint(frame,
              Math.max(host.mass.x - host.mass.width * 0.5 + inset,
                Math.min(host.mass.x + host.mass.width * 0.5 - inset, local.x)),
              Math.max(host.mass.z - host.mass.depth * 0.5 + inset,
                Math.min(host.mass.z + host.mass.depth * 0.5 - inset, local.z)));
            const targetX = target.x, targetZ = target.z;
            const x0 = Math.min(point[0] - patchRadius, targetX - inset);
            const x1 = Math.max(point[0] + patchRadius, targetX + inset);
            const z0 = Math.min(point[1] - patchRadius, targetZ - inset);
            const z1 = Math.max(point[1] + patchRadius, targetZ + inset);
            const contactMass: SkyriverMass = {
              x: (x0 + x1) * 0.5, y0, z: (z0 + z1) * 0.5,
              width: x1 - x0, height: y1 - y0, depth: z1 - z0,
              tint: old.mass.tint, anchorV: old.mass.anchorV ?? old.mass.z,
              building: old.mass.building ?? retainedSupportOwner(old.mass),
              materialOwner: retainedSupportOwner(old.mass),
              supportRole: 'retained-child-bridge',
            };
            const segmentX = targetX - point[0], segmentZ = targetZ - point[1];
            const beamRadius = Math.min(patchRadius, inset);
            const beam: SkyriverMass = {
              ...contactMass, x: (point[0] + targetX) * 0.5, z: (point[1] + targetZ) * 0.5,
              width: Math.hypot(segmentX, segmentZ) + 2 * beamRadius, depth: 2 * beamRadius,
              yawRad: Math.atan2(-segmentZ, segmentX),
            };
            for (const candidateGeometry of [beam, contactMass]) {
            const bands = [...heights];
            const contactBox = roofDetailMassObb(candidateGeometry, masses.length);
            for (const blocker of retainedSupportNearby(visibleLegacyTrimIndex, contactBox)) {
              if (!roofDetailObbsConflict(contactBox, blocker, 0)) continue;
              for (const [face, direction] of [
                [blocker.y + blocker.halfY + 0.02, 1],
                [blocker.y - blocker.halfY - 0.02, -1],
              ] as const) {
                for (const bandHeight of [4, 2, 1] as const) {
                  const bottom = Math.max(y0, direction === 1 ? face : face - bandHeight);
                  const top = Math.min(y1, direction === 1 ? face + bandHeight : face);
                  if (top - bottom < 0.01) continue;
                  bands.push([bottom, top]);
                }
              }
            }
            for (const [bottom, top] of bands) {
              const mass: SkyriverMass = { ...candidateGeometry, y0: bottom, height: top - bottom };
              const box = roofDetailMassObb(mass, masses.length);
              if (!roofDetailObbsConflict(box, child.box, 0) || !roofDetailObbsConflict(box, host.box, 0)) continue;
              const candidate: ContactCandidate = {
                mass, box, hostMassIndex: host.massIndex, sourceHostIndex: old.massIndex,
                contactCap, patchRadius, volume: mass.width * mass.height * mass.depth,
              };
              const candidateKey = JSON.stringify(mass);
              const existing = unique.get(candidateKey);
              if (existing === undefined || compareCandidates(candidate, existing) < 0) {
                unique.set(candidateKey, candidate);
              }
            }
            }
          }
        }
      }
    }
    const candidates = [...unique.values()].sort(compareCandidates);
    const containedCandidates: RetainedSupportCandidate[] = [];
    let selected: RetainedSupportCandidate | undefined;
    let geometry: SkyriverRetainedMassSupportRecord['geometry'] = Object.freeze({ kind: 'strict-clear' });
    const rejections = { prefix: 0, wingAir: 0, notch: 0, hero: 0, accepted: 0, route: 0, roof: 0, contained: 0 };
    for (const candidate of candidates) {
      const box = candidate.box;
      if (roofDetailIndexConflicts(visibleLegacyTrimIndex, box, 0)) { rejections.prefix += 1; continue; }
      if (roofDetailIndexConflicts(wingAirIndex, box, 0)) { rejections.wingAir += 1; continue; }
      if ([...acceptedNotches.values()].some((notch) => roofDetailObbsConflict(box, notch, 0))) { rejections.notch += 1; continue; }
      if (roofDetailBlocksHero(box, heroBoxes)) { rejections.hero += 1; continue; }
      if (acceptedBoxes.some((other) => roofDetailObbsConflict(box, other, 0))) { rejections.accepted += 1; continue; }
      if (routeBlocked(box)) { rejections.route += 1; continue; }
      if (r27Roofs.some((entry) => {
        const roofY = entry.mass.y0 + entry.mass.height;
        return roofY > candidate.mass.y0 + 0.001 && roofY < candidate.mass.y0 + candidate.mass.height - 0.001
          && roofDetailObbsConflict(box, { ...entry.box, y: roofY, halfY: 0.01 }, 0);
      })) { rejections.roof += 1; continue; }
      // The two measured endpoints must overlap. Every other solid must be clear.
      const blocked = retainedSupportNearby(worldIndex, box).some((other) =>
        other.massIndex !== childFinalIndex && other.massIndex !== candidate.hostMassIndex
        && roofDetailObbsConflict(box, other, 0));
      if (blocked) containedCandidates.push(candidate);
      else {
        selected = candidate;
        break;
      }
    }
    if (selected === undefined) {
      for (const candidate of containedCandidates) {
        const originals = originalGroups.get(retainedSupportKey(candidate.mass))!.entries;
        if (!retainedSupportContained(candidate.mass, originals)) { rejections.contained += 1; continue; }
        selected = candidate;
        geometry = Object.freeze({
          kind: 'original-owner-contained',
          sourceMassIndices: Object.freeze(originals.map((entry) => entry.massIndex)),
        });
        break;
      }
    }
    if (selected === undefined) {
      fail(`SKYRIVER_RETAINED_SUPPORT_NO_BOUNDED_CANDIDATE: ${layout.seed} source ${child.massIndex} candidates ${candidates.length} ${JSON.stringify(rejections)}`);
    }
    const supportMassIndex = masses.length;
    masses.push(selected.mass);
    acceptedBoxes.push(selected.box);
    roofDetailInsert(worldIndex, selected.box);
    records.push(Object.freeze({
      supportMassIndex, childSourceIndex: child.massIndex, childFinalIndex,
      hostMassIndex: selected.hostMassIndex,
      owner: retainedSupportOwner(selected.mass),
      anchorV: selected.mass.anchorV ?? selected.mass.z,
      geometry,
    }));
  }
  return Object.freeze(records);
}

function roofDetailCellKey(x: number, z: number): string {
  return String(x) + ':' + String(z);
}

function roofDetailInsert(index: RoofDetailCollisionIndex, box: RoofDetailObb): number {
  const boxIndex = index.boxes.length;
  index.boxes.push(box);
  const minX = Math.floor(box.minX / index.cellSize);
  const maxX = Math.floor(box.maxX / index.cellSize);
  const minZ = Math.floor(box.minZ / index.cellSize);
  const maxZ = Math.floor(box.maxZ / index.cellSize);
  for (let gx = minX; gx <= maxX; gx += 1) {
    for (let gz = minZ; gz <= maxZ; gz += 1) {
      const key = roofDetailCellKey(gx, gz);
      const bucket = index.cells.get(key);
      if (bucket === undefined) index.cells.set(key, [boxIndex]);
      else bucket.push(boxIndex);
    }
  }
  return boxIndex;
}

function roofDetailIndexConflicts(
  index: RoofDetailCollisionIndex,
  box: RoofDetailObb,
  gapM: number,
  supportMassIndex?: number,
): boolean {
  index.stamp += 1;
  if (index.stamp >= 0x7ffffffe) {
    index.stamps.fill(0);
    index.stamp = 1;
  }
  const stamp = index.stamp;
  const minX = Math.floor((box.minX - gapM) / index.cellSize);
  const maxX = Math.floor((box.maxX + gapM) / index.cellSize);
  const minZ = Math.floor((box.minZ - gapM) / index.cellSize);
  const maxZ = Math.floor((box.maxZ + gapM) / index.cellSize);
  for (let gx = minX; gx <= maxX; gx += 1) {
    for (let gz = minZ; gz <= maxZ; gz += 1) {
      const bucket = index.cells.get(roofDetailCellKey(gx, gz));
      if (bucket === undefined) continue;
      for (let i = 0; i < bucket.length; i += 1) {
        const candidateIndex = bucket[i]!;
        if (index.stamps[candidateIndex] === stamp) continue;
        index.stamps[candidateIndex] = stamp;
        const other = index.boxes[candidateIndex]!;
        if (supportMassIndex !== undefined && other.massIndex === supportMassIndex) continue;
        if (roofDetailObbsConflict(box, other, gapM)) return true;
      }
    }
  }
  return false;
}

function roofDetailBlocksHero(box: RoofDetailObb, heroes: readonly RoofDetailObb[]): boolean {
  for (const hero of heroes) {
    if (roofDetailObbsConflict(box, hero, 0)) return true;
  }
  return false;
}

function roofDetailHeroObbs(
  layout: SkyriverCityLayout,
  heroes: readonly SkyriverHeroBlade[],
  sourceFaces: readonly SkyriverFacadeFace[] = deriveFacadeFaces(layout),
): readonly RoofDetailObb[] {
  const faces = new Map(sourceFaces.map((face) => [face.id, face]));
  const anchors = megaAnchorCache.get(layout.seed) ?? [];
  const result: RoofDetailObb[] = [];
  const normal = { x: 0, z: 0 };
  for (const hero of heroes) {
    const face = faces.get(hero.faceId);
    if (face === undefined) continue;
    let wx: number;
    let wz: number;
    let heading: number;
    if (hero.kind === 'brand') {
      const anchor = anchors.find((candidate) => Math.abs(candidate.v - hero.z) < 300);
      if (anchor === undefined) {
        warpRigid(hero.x, hero.z, hero.owner.anchorV, roofDetailWarp);
        wx = roofDetailWarp.x;
        wz = roofDetailWarp.z;
        heading = roofDetailWarp.heading;
      } else {
        warpCanyon(anchor.x, anchor.v, roofDetailWarp);
        const dx = hero.x - anchor.x;
        const dz = hero.z - anchor.v;
        const sinH = Math.sin(roofDetailWarp.heading);
        const cosH = Math.cos(roofDetailWarp.heading);
        wx = roofDetailWarp.x + dx * cosH + dz * sinH;
        wz = roofDetailWarp.z - dx * sinH + dz * cosH;
        heading = roofDetailWarp.heading;
      }
      warpDirection(0, -1, heading, normal);
    } else {
      warpRigid(hero.x, hero.z, hero.owner.anchorV, roofDetailWarp);
      wx = roofDetailWarp.x;
      wz = roofDetailWarp.z;
      heading = roofDetailWarp.heading;
      warpDirection(hero.kind === 'panel' ? face.outward : 0, hero.kind === 'blade' ? 1 : 0, heading, normal);
    }
    const tangentX = -normal.z;
    const tangentZ = normal.x;
    const heroHalfWidth = hero.width * 0.5 + 14;
    const heroHalfHeight = hero.height * 0.5 + 18;
    const heroHalfDepth = 14;
    const tangentRadiusX = Math.abs(tangentX) * heroHalfWidth + Math.abs(normal.x) * heroHalfDepth;
    const tangentRadiusZ = Math.abs(tangentZ) * heroHalfWidth + Math.abs(normal.z) * heroHalfDepth;
    result.push({
      x: wx,
      y: hero.y,
      z: wz,
      halfX: heroHalfWidth,
      halfY: heroHalfHeight,
      halfZ: heroHalfDepth,
      ux: tangentX,
      uz: tangentZ,
      vx: normal.x,
      vz: normal.z,
      minX: wx - tangentRadiusX,
      maxX: wx + tangentRadiusX,
      minZ: wz - tangentRadiusZ,
      maxZ: wz + tangentRadiusZ,
      coordinateUlpM: Math.max(
        roofDetailScalarUlp(wx),
        roofDetailScalarUlp(hero.y),
        roofDetailScalarUlp(wz),
      ),
    });
  }
  return result;
}

function buildRoofDetailCollisionIndex(
  masses: readonly SkyriverMass[],
  legacyTrims: SkyriverCityTrims,
  heroes: readonly SkyriverHeroBlade[],
  layout: SkyriverCityLayout,
): RoofDetailCollisionIndex {
  const expected = masses.length + legacyTrims.count + SKYRIVER_ROOF_DETAIL_TOTAL_CAP;
  const index: RoofDetailCollisionIndex = {
    cellSize: ROOF_DETAIL_SPATIAL_CELL_M,
    cells: new Map(),
    boxes: [],
    stamps: new Int32Array(expected),
    stamp: 0,
  };
  for (let massIndex = 0; massIndex < masses.length; massIndex += 1) {
    const mass = masses[massIndex]!;
    if (mass.width <= 0 || mass.height <= 0 || mass.depth <= 0) continue;
    roofDetailInsert(index, roofDetailMassObb(mass, massIndex));
  }
  const heroBoxes = roofDetailHeroObbs(layout, heroes);
  // Preserve the existing legacy filter. Only visible old trims block roof-detail placement.
  for (let i = 0; i < legacyTrims.count; i += 1) {
    if (skyriverTrimBlocksHero(legacyTrims, i, heroes)) continue;
    roofDetailInsert(index, roofDetailTrimObb(legacyTrims, i));
  }
  roofDetailHeroBoxCache.set(layout.seed, heroBoxes);
  return index;
}

interface RoofDetailStorage {
  readonly cx: Float32Array;
  readonly cy: Float32Array;
  readonly cz: Float32Array;
  readonly sx: Float32Array;
  readonly sy: Float32Array;
  readonly sz: Float32Array;
  readonly kind: Uint8Array;
  readonly seedValue: Float32Array;
  readonly owner: SkyriverTrimOwner[];
  readonly spanTo: (SkyriverTrimOwner | null)[];
}

function roofDetailCluster(
  stratumIndex: 0 | 1 | 2,
  ordinal: number,
  random: DeterministicRandom,
): readonly RoofDetailComponent[] {
  const unit = (min: number, max: number): number => roofDetailRandomFloat(random, min, max);
  if (stratumIndex === 0) {
    const pattern = ordinal % 4;
    if (pattern === 0) {
      const width = unit(6, 9);
      const depth = unit(5, 8);
      const height = unit(7, 12);
      return [
        { role: 'tank', dx: 0, dz: 0, sx: width, sy: height, sz: depth },
        { role: 'tank', dx: -width * 0.5 - 0.65, dz: 0, sx: 0.6, sy: height + 0.4, sz: 0.6 },
        { role: 'tank', dx: width * 0.5 + 0.65, dz: 0, sx: 0.6, sy: height + 0.4, sz: 0.6 },
        { role: 'tank', dx: 0, dz: -depth * 0.5 - 0.65, sx: width * 0.65, sy: height + 0.4, sz: 0.6 },
      ];
    }
    if (pattern === 1) {
      const firstWidth = unit(2.5, 4);
      const secondWidth = unit(2.2, 3.7);
      return [
        { role: 'vent', dx: -(firstWidth + secondWidth) * 0.5 - 0.55, dz: 0, sx: firstWidth, sy: unit(2.5, 4.5), sz: unit(2.5, 4) },
        { role: 'vent', dx: (firstWidth + secondWidth) * 0.5 + 0.55, dz: 0, sx: secondWidth, sy: unit(2, 4), sz: unit(2.2, 3.8) },
      ];
    }
    if (pattern === 2) {
      const length = unit(10, 18);
      return [
        { role: 'pipe', dx: 0, dz: -1.05, sx: length, sy: unit(0.9, 1.6), sz: 0.8 },
        { role: 'pipe', dx: 0, dz: 1.05, sx: length * unit(0.7, 0.95), sy: unit(0.9, 1.6), sz: 0.8 },
      ];
    }
    const stepWidth = unit(1.6, 2.1);
    const stepDepth = unit(2.4, 3);
    const heights = [1.2, 1.9, 2.6, 3.3] as const;
    return heights.map((height, index) => ({
      role: 'stairhouse' as const,
      dx: (index - 1.5) * (stepWidth + 0.45),
      dz: 0,
      sx: stepWidth,
      sy: height,
      sz: stepDepth,
    }));
  }
  if (stratumIndex === 1) {
    if (ordinal % 2 === 0) {
      return [
        { role: 'hvac', dx: -3.7, dz: 0, sx: 3, sy: unit(2.2, 3.7), sz: 2.8 },
        { role: 'hvac', dx: 0, dz: 0, sx: 3, sy: unit(2.5, 4.2), sz: 2.8 },
        { role: 'hvac', dx: 3.7, dz: 0, sx: 3, sy: unit(2.2, 3.7), sz: 2.8 },
        { role: 'pad', dx: 0, dz: 4.2, sx: 6.2, sy: 0.8, sz: 2 },
      ];
    }
    return [
      { role: 'pad', dx: -3.6, dz: -2.3, sx: 2.8, sy: 0.8, sz: 2.2 },
      { role: 'pad', dx: 3.6, dz: -2.3, sx: 2.8, sy: 0.8, sz: 2.2 },
      { role: 'pad', dx: -3.6, dz: 2.3, sx: 2.8, sy: 0.8, sz: 2.2 },
      { role: 'pad', dx: 3.6, dz: 2.3, sx: 2.8, sy: 0.8, sz: 2.2 },
    ];
  }
  const heightBase = unit(10, 22);
  return [
    { role: 'mast', dx: -2.4, dz: 0, sx: 0.8, sy: heightBase * 0.75, sz: 0.8 },
    { role: 'mast', dx: 0, dz: 0, sx: 0.9, sy: heightBase, sz: 0.9 },
    { role: 'mast', dx: 2.4, dz: 0, sx: 0.8, sy: heightBase * 0.85, sz: 0.8 },
  ];
}

function roofDetailClusterBounds(components: readonly RoofDetailComponent[]): {
  readonly minDx: number;
  readonly maxDx: number;
  readonly minDz: number;
  readonly maxDz: number;
} {
  let minDx = Infinity;
  let maxDx = -Infinity;
  let minDz = Infinity;
  let maxDz = -Infinity;
  for (const component of components) {
    minDx = Math.min(minDx, component.dx - component.sx * 0.5);
    maxDx = Math.max(maxDx, component.dx + component.sx * 0.5);
    minDz = Math.min(minDz, component.dz - component.sz * 0.5);
    maxDz = Math.max(maxDz, component.dz + component.sz * 0.5);
  }
  return { minDx, maxDx, minDz, maxDz };
}

function roofDetailPlacementRange(
  mass: SkyriverMass,
  bounds: ReturnType<typeof roofDetailClusterBounds>,
): { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number } | null {
  const inset = ROOF_DETAIL_SUPPORT_INSET_M;
  const minX = -mass.width * 0.5 + inset - bounds.minDx;
  const maxX = mass.width * 0.5 - inset - bounds.maxDx;
  const minZ = -mass.depth * 0.5 + inset - bounds.minDz;
  const maxZ = mass.depth * 0.5 - inset - bounds.maxDz;
  return minX <= maxX && minZ <= maxZ ? { minX, maxX, minZ, maxZ } : null;
}

function roofDetailFindSupport(
  pool: readonly RoofDetailSupport[],
  bounds: ReturnType<typeof roofDetailClusterBounds>,
  cursor: number,
): { readonly support: RoofDetailSupport | null; readonly cursor: number; readonly range: ReturnType<typeof roofDetailPlacementRange> | null } {
  if (pool.length === 0) return { support: null, cursor: 0, range: null };
  for (let offset = 0; offset < pool.length; offset += 1) {
    const index = (cursor + offset) % pool.length;
    const support = pool[index]!;
    const range = roofDetailPlacementRange(support.mass, bounds);
    if (range !== null) return { support, cursor: (index + 1) % pool.length, range };
  }
  return { support: null, cursor: (cursor + 1) % pool.length, range: null };
}

function roofDetailMakeCandidateObb(
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  anchorV: number,
  frame?: SkyriverTrimOwner,
): RoofDetailObb {
  const fx = Math.fround(x);
  const fy = Math.fround(y);
  const fz = Math.fround(z);
  const fsx = Math.fround(sx);
  const fsy = Math.fround(sy);
  const fsz = Math.fround(sz);
  if (frame) warpBoxPoint(frame, fx, fz, roofDetailWarp);
  else warpRigid(fx, fz, anchorV, roofDetailWarp);
  return roofDetailBox(roofDetailWarp.x, fy, roofDetailWarp.z, fsx, fsy, fsz, roofDetailWarp.heading);
}

function appendRoofDetailSuffix(
  masses: readonly SkyriverMass[],
  legacyTrims: SkyriverCityTrims,
  storage: RoofDetailStorage,
  capacity: number,
  collisionIndex: RoofDetailCollisionIndex,
  random: DeterministicRandom,
): { readonly totalTrimCount: number; readonly derivation: SkyriverRoofDetailDerivation } {
  const oldTrimCount = legacyTrims.count;
  const globalBudget = Math.min(SKYRIVER_ROOF_DETAIL_TOTAL_CAP, Math.max(0, capacity - oldTrimCount));
  const requested = [0, 0, 0];
  const accepted = [0, 0, 0];
  const rejectedSupport = [0, 0, 0];
  const rejectedCollision = [0, 0, 0];
  const rejectedBudget = [0, 0, 0];
  const records: SkyriverRoofDetailRecord[] = [];
  const pools: RoofDetailSupport[][] = [[], [], []];
  for (let massIndex = 0; massIndex < masses.length; massIndex += 1) {
    const mass = masses[massIndex]!;
    if ((mass.layer ?? 0) !== 0 || mass.artBacking !== undefined || mass.supportRole === 'retained-child-bridge'
      || mass.width <= 0 || mass.depth <= 0 || mass.height <= 0) continue;
    const roofY = mass.y0 + mass.height;
    const stratum = roofDetailStratumFor(roofY);
    pools[roofDetailStratumIndex(stratum)]!.push({ mass, massIndex, stratum, roofY });
  }
  for (const pool of pools) {
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = random.nextInt(0, i);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
  }

  const clusterCounts = [
    SKYRIVER_ROOF_DETAIL_CAPS[0] / 12 * 4,
    SKYRIVER_ROOF_DETAIL_CAPS[1] / 4,
    SKYRIVER_ROOF_DETAIL_CAPS[2] / 3,
  ] as const;
  const tasks: RoofDetailClusterTask[] = [];
  let clusterId = 0;
  for (const stratumIndex of [0, 1, 2] as const) {
    for (let ordinal = 0; ordinal < clusterCounts[stratumIndex]!; ordinal += 1) {
      tasks.push({
        stratumIndex,
        ordinal,
        phase: (ordinal + 0.5) / clusterCounts[stratumIndex]!,
        clusterId: clusterId++,
      });
    }
  }
  tasks.sort((a, b) => a.phase - b.phase || a.stratumIndex - b.stratumIndex);

  let totalTrimCount = oldTrimCount;
  const supportCursor = [0, 0, 0];
  for (const task of tasks) {
    const stratum = ROOF_DETAIL_STRATA[task.stratumIndex]!;
    const components = roofDetailCluster(task.stratumIndex, task.ordinal, random);
    requested[task.stratumIndex]! += components.length;
    const bounds = roofDetailClusterBounds(components);
    const search = roofDetailFindSupport(
      pools[task.stratumIndex]!,
      bounds,
      supportCursor[task.stratumIndex]!,
    );
    supportCursor[task.stratumIndex] = search.cursor;
    if (search.support === null || search.range === null) {
      rejectedSupport[task.stratumIndex]! += components.length;
      continue;
    }
    if (totalTrimCount + components.length > capacity || totalTrimCount - oldTrimCount + components.length > globalBudget) {
      rejectedBudget[task.stratumIndex]! += components.length;
      continue;
    }

    const support = search.support;
    const centerOffsetX = roofDetailRandomFloat(random, search.range.minX, search.range.maxX);
    const centerOffsetZ = roofDetailRandomFloat(random, search.range.minZ, search.range.maxZ);
    const owner: SkyriverTrimOwner = {
      x: support.mass.x,
      z: support.mass.z,
      width: support.mass.width,
      depth: support.mass.depth,
      anchorV: support.mass.anchorV ?? support.mass.z,
      materialOwner: support.mass.materialOwner ?? support.mass.building ?? buildingSeedOf(support.mass.x, support.mass.z),
      ...(support.mass.yawRad === undefined ? {} : { yawRad: support.mass.yawRad }),
      ...(support.mass.yawAnchor === undefined ? {} : { yawAnchor: support.mass.yawAnchor }),
    };
    const proposals = components.map((component) => {
      const x = support.mass.x + centerOffsetX + component.dx;
      const z = support.mass.z + centerOffsetZ + component.dz;
      const y = support.roofY + component.sy * 0.5;
      return {
        component,
        x,
        y,
        z,
        seedValue: random.nextInt(0, 9999) / 9999,
        obb: roofDetailMakeCandidateObb(x, y, z, component.sx, component.sy, component.sz, owner.anchorV, owner),
      };
    });
    let collision = false;
    for (let i = 0; i < proposals.length; i += 1) {
      const proposal = proposals[i]!;
      if (roofDetailIndexConflicts(collisionIndex, proposal.obb, ROOF_DETAIL_CLEARANCE_M, support.massIndex)) {
        collision = true;
        break;
      }
      for (let j = 0; j < i; j += 1) {
        if (roofDetailObbsConflict(proposal.obb, proposals[j]!.obb, ROOF_DETAIL_CLEARANCE_M)) {
          collision = true;
          break;
        }
      }
      if (collision) break;
    }
    if (collision) {
      rejectedCollision[task.stratumIndex]! += components.length;
      continue;
    }

    for (const proposal of proposals) {
      const trimIndex = totalTrimCount;
      storage.cx[trimIndex] = proposal.x;
      storage.cy[trimIndex] = proposal.y;
      storage.cz[trimIndex] = proposal.z;
      storage.sx[trimIndex] = proposal.component.sx;
      storage.sy[trimIndex] = proposal.component.sy;
      storage.sz[trimIndex] = proposal.component.sz;
      storage.kind[trimIndex] = SKYRIVER_TRIM_ROOF_PLANT;
      storage.seedValue[trimIndex] = proposal.seedValue;
      storage.owner[trimIndex] = owner;
      storage.spanTo[trimIndex] = null;
      roofDetailInsert(collisionIndex, proposal.obb);
      records.push(Object.freeze({
        trimIndex,
        supportMassIndex: support.massIndex,
        clusterId: task.clusterId,
        role: proposal.component.role,
        stratum,
      }));
      accepted[task.stratumIndex]! += 1;
      totalTrimCount += 1;
    }
  }

  const toCounts = (values: number[]): readonly [number, number, number] => {
    const tuple: [number, number, number] = [values[0]!, values[1]!, values[2]!];
    return Object.freeze(tuple);
  };
  const derivation: SkyriverRoofDetailDerivation = Object.freeze({
    oldTrimCount,
    totalTrimCount,
    requestedByStratum: toCounts(requested),
    acceptedByStratum: toCounts(accepted),
    rejectedSupportByStratum: toCounts(rejectedSupport),
    rejectedCollisionByStratum: toCounts(rejectedCollision),
    rejectedBudgetByStratum: toCounts(rejectedBudget),
    records: Object.freeze(records),
  });
  return { totalTrimCount, derivation };
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
    const satOverlap = axes.every(([ax, az]) => {
      const aRadius = hx * Math.abs(c * ax - s * az) + hz * Math.abs(s * ax + c * az);
      const bRadius = other.hx * Math.abs(other.c * ax - other.s * az) + other.hz * Math.abs(other.s * ax + other.c * az);
      return Math.abs(dx * ax + dz * az) <= aRadius + bRadius;
    });
    if (satOverlap) return true;

    const ax0 = mass.x - mass.width * 0.5;
    const ax1 = mass.x + mass.width * 0.5;
    const az0 = mass.z - mass.depth * 0.5;
    const az1 = mass.z + mass.depth * 0.5;
    const bx0 = other.mass.x - other.mass.width * 0.5;
    const bx1 = other.mass.x + other.mass.width * 0.5;
    const bz0 = other.mass.z - other.mass.depth * 0.5;
    const bz1 = other.mass.z + other.mass.depth * 0.5;

    const rawOverlap = Math.min(ax1, bx1) > Math.max(ax0, bx0) && Math.min(az1, bz1) > Math.max(az0, bz0);
    if (rawOverlap) return true;

    const roundXOverlap = Math.min(Math.round(ax1 * 100), Math.round(bx1 * 100)) >= Math.max(Math.round(ax0 * 100), Math.round(bx0 * 100));
    const roundZOverlap = Math.min(Math.round(az1 * 100), Math.round(bz1 * 100)) >= Math.max(Math.round(az0 * 100), Math.round(bz0 * 100));
    if (roundXOverlap && roundZOverlap) return true;
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
      const roofOwner: SkyriverTrimOwner = { x: bx, z: bz, width: bw, depth: bd, anchorV: tower.z,
        materialOwner: separatedMass.materialOwner ?? buildingSeedOf(tower.x, tower.z) };
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
          const roofOwner: SkyriverTrimOwner = { x: baseX, z: baseZ, width: w, depth: d, anchorV: parentTower.z,
            materialOwner: separatedMass.materialOwner ?? buildingSeedOf(parentTower.x, parentTower.z) };
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
  recordLegacyBody: (tower: SkyriverTower, mass: SkyriverMass) => void,
): void {
  const rng = new DeterministicRandom(layout.seed).fork('skyriver.city.massing');
  const u = (): number => rng.nextInt(0, 10000) / 10000;
  const between = (a: number, b: number): number => a + (b - a) * u();
  /** A box on the lot, in the lot's frame (rides the slab through the bends). */
  const box = (tower: SkyriverTower, dx: number, dz: number, y0: number, w: number, hgt: number, d: number, building?: number): void => {
    const mass: SkyriverMass = { x: tower.x + dx, y0, z: tower.z + dz, width: w, height: hgt, depth: d, tint: tower.tint, anchorV: tower.z, ...(building === undefined ? {} : { building }), materialOwner: buildingSeedOf(tower.x, tower.z) };
    masses.push(mass);
    recordLegacyBody(tower, mass);
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
    warpBoxPoint(owner, cx, cz, placeEnd0);
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
  warpBoxPoint(ownerAtLow ? owner : to, e0x, e0z, placeEnd0);
  warpBoxPoint(ownerAtLow ? to : owner, e1x, e1z, placeEnd1);
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
  const reconciliation = deriveLegacyTrimReconciliation(layout);
  const masses = deriveCityMasses(layout);
  const dispositionByIndex = new Map(reconciliation.dispositions.map((row) => [row.finalIndex, row] as const));
  const sourceByIndex = new Map(reconciliation.sourceInventory.map((row) => [row.sourceIndex, row] as const));
  const towerIdentity = new Map(layout.towers.map((tower) => [towerKey(tower), {
    owner: buildingSeedOf(tower.x, tower.z), anchorV: tower.z,
  }] as const));
  const massIdentity = (mass: SkyriverMass): { readonly owner: number; readonly anchorV: number } => {
    const base = mass.baseRecord === undefined ? undefined : towerIdentity.get(mass.baseRecord.towerOwner);
    return {
      owner: mass.materialOwner ?? mass.building ?? base?.owner ?? buildingSeedOf(mass.x, mass.z),
      anchorV: mass.anchorV ?? base?.anchorV ?? mass.z,
    };
  };
  const sameOwnerFrameMassIndices = (owner: SkyriverTrimOwner): number[] => {
    const canonicalOwner = owner.materialOwner ?? buildingSeedOf(owner.x, owner.z);
    const result: number[] = [];
    for (let index = 0; index < masses.length; index += 1) {
      const mass = masses[index]!;
      const identity = massIdentity(mass);
      if (identity.owner === canonicalOwner && identity.anchorV === owner.anchorV
        && mass.width > 0 && mass.height > 0 && mass.depth > 0) result.push(index);
    }
    return result;
  };
  const exposedSideHostArea = (trimIndex: number, sourceOwner: SkyriverTrimOwner, hostMassIndex: number): number => {
    const host = masses[hostMassIndex];
    if (host === undefined) return 0;
    const identity = massIdentity(host);
    if (identity.owner !== (sourceOwner.materialOwner ?? buildingSeedOf(sourceOwner.x, sourceOwner.z))
      || identity.anchorV !== sourceOwner.anchorV) return 0;
    const bucket: HostBucket = { faces: [], masses: sameOwnerFrameMassIndices(sourceOwner).map(massIndex => {
      const mass = masses[massIndex]!;
      return { mass, massIndex, x0: mass.x - mass.width * 0.5, x1: mass.x + mass.width * 0.5,
        y0: mass.y0, y1: mass.y0 + mass.height, z0: mass.z - mass.depth * 0.5, z1: mass.z + mass.depth * 0.5 };
    }) };
    return checkTrimSupportWithBucket(trims.cx[trimIndex]!, trims.cy[trimIndex]!, trims.cz[trimIndex]!,
      trims.sx[trimIndex]!, trims.sy[trimIndex]!, trims.sz[trimIndex]!, trims.owner[trimIndex]!, bucket, hostMassIndex).exposedAreaM2;
  };
  const spanEndpointContact = (
    endpoint: { readonly x: number; readonly y: number; readonly z: number },
    crossX: number,
    crossZ: number,
    crossHalf: number,
    halfY: number,
    host: RoofDetailObb,
  ): { readonly contacts: boolean; readonly crossOverlapM: number; readonly verticalOverlapM: number } => {
    const tolerance = Math.max(
      host.coordinateUlpM,
      roofDetailScalarUlp(endpoint.x),
      roofDetailScalarUlp(endpoint.y),
      roofDetailScalarUlp(endpoint.z),
    ) * 2;
    const vertical = Math.min(endpoint.y + halfY, host.y + host.halfY)
      - Math.max(endpoint.y - halfY, host.y - host.halfY);
    const verticalTolerance = Math.max(roofDetailScalarUlp(endpoint.y), roofDetailScalarUlp(host.y)) * 2;
    const dx = endpoint.x - host.x;
    const dz = endpoint.z - host.z;
    const pU = dx * host.ux + dz * host.uz;
    const pV = dx * host.vx + dz * host.vz;
    const dU = crossX * host.ux + crossZ * host.uz;
    const dV = crossX * host.vx + crossZ * host.vz;
    const clip = (padding: number): number => {
      let low = -crossHalf;
      let high = crossHalf;
      for (const [position, direction, extent] of [
        [pU, dU, host.halfX] as const,
        [pV, dV, host.halfZ] as const,
      ]) {
        if (Math.abs(direction) < 1e-12) {
          if (Math.abs(position) > extent + padding) return -1;
          continue;
        }
        const a = (-extent - padding - position) / direction;
        const b = (extent + padding - position) / direction;
        low = Math.max(low, Math.min(a, b));
        high = Math.min(high, Math.max(a, b));
        if (low > high) return -1;
      }
      return high - low;
    };
    const physical = clip(0);
    return {
      contacts: vertical >= -verticalTolerance && clip(tolerance) >= 0,
      crossOverlapM: physical > 0 ? Math.min(crossHalf * 2, physical) : 0,
      verticalOverlapM: Math.min(halfY * 2, Math.max(0, vertical)),
    };
  };
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
    warpBoxPoint({ ...owner, anchorV: frameV }, owner.x, owner.z, auditOwner);
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
    const disposition = dispositionByIndex.get(i);
    // Spans are checked at their ends below; their centre legitimately moves with the span.
    if (trims.spanTo[i] === null) {
      if (disposition?.kind === 'side-rehosted') {
        const source = sourceByIndex.get(disposition.sourceIndex);
        const host = masses[disposition.hostMassIndex];
        const identity = host === undefined ? undefined : massIdentity(host);
        warpBoxPoint(owner, cx, cz, auditOwner);
        const drift = Math.hypot(placed.x - auditOwner.x, placed.z - auditOwner.z);
        maxDrift = Math.max(maxDrift, drift);
        const geometry = disposition.newGeometry;
        const declaredGeometry = [geometry.cx, geometry.cy, geometry.cz, geometry.sx, geometry.sy, geometry.sz];
        const actualGeometry = [trims.cx[i]!, trims.cy[i]!, trims.cz[i]!, trims.sx[i]!, trims.sy[i]!, trims.sz[i]!];
        const geometryMatches = declaredGeometry.every((value, component) =>
          Number.isFinite(value) && Number.isFinite(actualGeometry[component])
          && Math.abs(value - actualGeometry[component]!) <= Math.max(roofDetailScalarUlp(value), roofDetailScalarUlp(actualGeometry[component]!)) * 2,
        );
        const exposedArea = source === undefined ? 0 : exposedSideHostArea(i, source.owner, disposition.hostMassIndex);
        const threshold = Math.max(1e-7, trims.sy[i]! * trims.sz[i]! * 1e-10);
        const valid = source !== undefined
          && disposition.sourceIndex === i && disposition.finalIndex === i
          && Number.isInteger(disposition.hostMassIndex) && disposition.hostMassIndex >= 0
          && host !== undefined && disposition.faceId.length > 0
          && identity?.owner === source.canonicalOwner && identity.anchorV === source.owner.anchorV
          && geometryMatches && Number.isFinite(exposedArea) && exposedArea > threshold
          && Number.isFinite(drift) && drift < 0.05;
        if (!valid) {
          floating += 1;
          drawnFailures.push({ kind: trims.kind[i]!, index: i, x: cx, y: trims.cy[i]!, v: cz, wx: placed.x, wz: placed.z, driftM: Number.isFinite(drift) ? drift : Number.MAX_VALUE, gapM: 1 });
        }
      } else {
        maxDrift = Math.max(maxDrift, drawn.drift);
        if (touches && drawn.gap > 0.5) {
          floating += 1;
          drawnFailures.push({ kind: trims.kind[i]!, index: i, x: cx, y: trims.cy[i]!, v: cz, wx: placed.x, wz: placed.z, driftM: drawn.drift, gapM: drawn.gap });
        }
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
      if (disposition?.kind === 'span-rehosted') {
        const source = sourceByIndex.get(disposition.sourceIndex);
        const alongAxis = ez >= ex;
        const alongX = alongAxis ? Math.sin(placed.heading) : Math.cos(placed.heading);
        const alongZ = alongAxis ? Math.cos(placed.heading) : -Math.sin(placed.heading);
        const crossX = alongAxis ? Math.cos(placed.heading) : Math.sin(placed.heading);
        const crossZ = alongAxis ? -Math.sin(placed.heading) : Math.cos(placed.heading);
        const halfLength = placed.length * 0.5;
        const halfCross = (alongAxis ? ex : ez) * 0.5;
        const endpoints = [
          { x: placed.x - alongX * halfLength, y: trims.cy[i]!, z: placed.z - alongZ * halfLength },
          { x: placed.x + alongX * halfLength, y: trims.cy[i]!, z: placed.z + alongZ * halfLength },
        ] as const;
        const canyonHalf = (alongAxis ? ez : ex) * 0.5;
        const canyonEndpoints = [
          { x: alongAxis ? cx : cx - canyonHalf, z: alongAxis ? cz - canyonHalf : cz },
          { x: alongAxis ? cx : cx + canyonHalf, z: alongAxis ? cz + canyonHalf : cz },
        ] as const;
        const lowOwner = footprintGap(owner, canyonEndpoints[0].x, canyonEndpoints[0].z)
          <= footprintGap(to, canyonEndpoints[0].x, canyonEndpoints[0].z);
        const endpointOwners = lowOwner ? [owner, to] as const : [to, owner] as const;
        const actualOwnerKeys = disposition.hosts.map((host) => `${host.canonicalOwner}:${host.anchorV}`).sort();
        const expectedOwnerKeys = source?.spanTo === null || source === undefined ? [] : [
          `${source.canonicalOwner}:${source.owner.anchorV}`,
          `${source.spanTo.materialOwner ?? buildingSeedOf(source.spanTo.x, source.spanTo.z)}:${source.spanTo.anchorV}`,
        ].sort();
        let rowValid = source !== undefined && source.spanTo !== null
          && disposition.sourceIndex === i && disposition.finalIndex === i
          && JSON.stringify(actualOwnerKeys) === JSON.stringify(expectedOwnerKeys)
          && [disposition.newWorld.sourceLengthM, disposition.newWorld.worldLengthM, disposition.newWorld.exposedLengthM].every(Number.isFinite);
        let rowDrift = 0;
        for (const endIndex of [0, 1] as const) {
          const end = endpoints[endIndex];
          const canyonEnd = canyonEndpoints[endIndex];
          const endpointOwner = endpointOwners[endIndex];
          warpBoxPoint(endpointOwner, canyonEnd.x, canyonEnd.z, auditPoint);
          const drift = Math.hypot(end.x - auditPoint.x, end.z - auditPoint.z);
          rowDrift = Math.max(rowDrift, drift);
          const declaredPoint = disposition.newWorld.endpoints[endIndex];
          const pointValues = [declaredPoint.x, declaredPoint.y, declaredPoint.z];
          const actualValues = [end.x, end.y, end.z];
          const pointFinite = pointValues.every(Number.isFinite) && actualValues.every(Number.isFinite);
          const endpointTolerance = Math.max(
            roofDetailScalarUlp(end.x), roofDetailScalarUlp(end.y), roofDetailScalarUlp(end.z),
            roofDetailScalarUlp(declaredPoint.x), roofDetailScalarUlp(declaredPoint.y), roofDetailScalarUlp(declaredPoint.z),
          ) * 2;
          if (!pointFinite || !Number.isFinite(endpointTolerance)
            || pointValues.some((value, component) => Math.abs(value - actualValues[component]!) > endpointTolerance)) rowValid = false;

          const publishedHost = disposition.hosts[endIndex];
          const host = masses[publishedHost.massIndex];
          if (!host || !Number.isInteger(publishedHost.massIndex) || publishedHost.massIndex < 0) {
            rowValid = false;
            continue;
          }
          const identity = massIdentity(host);
          if (identity.owner !== publishedHost.canonicalOwner || identity.anchorV !== publishedHost.anchorV
            || identity.owner !== (endpointOwner.materialOwner ?? buildingSeedOf(endpointOwner.x, endpointOwner.z))
            || identity.anchorV !== endpointOwner.anchorV) rowValid = false;
          const hostObb = roofDetailMassObb(host, publishedHost.massIndex);
          const measured = spanEndpointContact(end, crossX, crossZ, halfCross, trims.sy[i]! * 0.5, hostObb);
          const claimed = disposition.endpointContacts[endIndex];
          const contactTolerance = Math.max(
            hostObb.coordinateUlpM,
            roofDetailScalarUlp(end.x), roofDetailScalarUlp(end.y), roofDetailScalarUlp(end.z),
          ) * 2;
          if (!measured.contacts
            || !Number.isFinite(measured.crossOverlapM) || !Number.isFinite(measured.verticalOverlapM)
            || !Number.isFinite(contactTolerance)
            || !Number.isFinite(claimed.crossOverlapM) || !Number.isFinite(claimed.verticalOverlapM)
            || Math.abs(claimed.crossOverlapM - measured.crossOverlapM) > contactTolerance
            || Math.abs(claimed.verticalOverlapM - measured.verticalOverlapM) > contactTolerance) rowValid = false;
          maxDrift = Math.max(maxDrift, drift);
        }
        if (!rowValid || !Number.isFinite(rowDrift) || rowDrift >= 0.05) {
          floating += 1;
          drawnFailures.push({ kind: trims.kind[i]!, index: i, x: cx, y: trims.cy[i]!, v: cz, wx: placed.x, wz: placed.z, driftM: Number.isFinite(rowDrift) ? rowDrift : Number.MAX_VALUE, gapM: 1 });
        }
      } else {
        // Both ends of a legacy span must land on their original owner frames.
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
  const mountSolids = new Map(deriveSignMountSolids(layout).map(solid => [`${solid.host.kind}:${solid.host.index}`, solid]));
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
    const attachment = signs.mount[i];
    if (attachment === undefined) {
      signsOff += 1;
      wrongPlaneFailures += 1;
      continue;
    }
    const world = placeNeonSign(mount, cx, signs.cy[i]!, cz, signs.nx[i]!, signs.nz[i]!);
    const normalLength = Math.hypot(world.nx, world.nz);
    const normal = [world.nx / normalLength, world.nz / normalLength] as const;
    const tangent = [-normal[1], normal[0]] as const;
    const worldPoint = (point: SkyriverSignPoint): SkyriverSignPoint => {
      warpBoxPoint(mount, point.x, point.z, auditPoint);
      return { x: auditPoint.x, y: point.y, z: auditPoint.z };
    };
    const edge = attachment.edge.map(worldPoint), root = attachment.root.map(worldPoint);
    const host = mountSolids.get(`${attachment.host.kind}:${attachment.host.index}`);
    let rootValid = host !== undefined;
    if (host !== undefined) {
      const a = host.footprint[attachment.edgeIndex]!, b = host.footprint[(attachment.edgeIndex + 1) % 4]!;
      const dx = b[0] - a[0], dz = b[1] - a[1], lengthSquared = dx * dx + dz * dz;
      for (const point of edge) {
        const along = Math.max(0, Math.min(1, ((point.x - a[0]) * dx + (point.z - a[1]) * dz) / lengthSquared));
        if (Math.hypot(point.x - a[0] - along * dx, point.z - a[1] - along * dz,
          point.y - host.y1) >= .05) rootValid = false;
      }
    }
    const a = edge[0]!, b = edge[1]!, dx = b.x - a.x, dz = b.z - a.z;
    const lengthSquared = dx * dx + dz * dz;
    if (lengthSquared <= 0 || Math.hypot(root[1]!.x - root[0]!.x, root[1]!.z - root[0]!.z) <= 0) rootValid = false;
    for (const point of root) {
      const along = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSquared));
      if (Math.hypot(point.x - a.x - along * dx, point.z - a.z - along * dz, point.y - a.y) > 3) rootValid = false;
      const u = (point.x - world.x) * tangent[0] + (point.z - world.z) * tangent[1];
      const v = (point.x - world.x) * normal[0] + (point.z - world.z) * normal[1];
      const onBoard = Math.abs(point.y - (world.y - signs.sh[i]! * .5)) < .05
        && (attachment.mode === 'panel' ? Math.abs(v + .2) < .05 && Math.abs(u) <= signs.sw[i]! * .5 + .05
          : Math.abs(Math.abs(u) - signs.sw[i]! * .5) < .05 && Math.abs(v) <= .2 + .05);
      if (!onBoard) wrongPlaneFailures += 1;
    }
    if (!rootValid) signsOff += 1;
    warpBoxPoint(mount, cx, cz, auditPoint);
    const drawn = check(mount, mount.anchorV, auditPoint.x, auditPoint.z, cx, cz, 0, 0);
    signMaxDrift = Math.max(signMaxDrift, drawn.drift);
    const halfAlong = face.planeAxis === 'z' || attachment.mode === 'panel' ? signs.sw[i]! * .5 : signs.rootHalfWidthM[i]!;
    // Compare the old point warp with the current owner frame.
    warpCanyon(cx, cz, auditPoint);
    const point = check(mount, mount.z, auditPoint.x, auditPoint.z, cx, cz, 0, 0);
    // Along-face position of the pre-R16 placement in the tower's frame.
    warpRigid(mount.x, mount.z, mount.z, auditOwner);
    const c = Math.cos(auditOwner.heading);
    const sn = Math.sin(auditOwner.heading);
    const lz = (auditPoint.x - auditOwner.x) * sn + (auditPoint.z - auditOwner.z) * c;
    const legacyOverrun = (d: number): boolean => d + halfAlong > mount.depth * 0.5 + 0.5;
    if (point.drift > 0.5 && legacyOverrun(Math.abs(lz))) pointSignsOff += 1;

    const alongHalfForSpacing = face.planeAxis === 'z' ? 4 : (attachment.mode === 'blade' ? signs.rootHalfWidthM[i]! : signs.sw[i]! * .5);
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

const HERO_SPACING_M = 530;

function deriveReservedHeroTowers(layout: SkyriverCityLayout): Map<string, number> {
  const reserved = new Map<string, number>();
  for (const row of deriveHeroRowPlans(layout)) {
    reserved.set(towerKey(row.tower), row.faceTop + 10);
  }
  for (let k = 0; k * HERO_SPACING_M < CANYON_LOOP_LENGTH_M; k += 1) {
    const z = -CANYON_LOOP_LENGTH_M / 2 + (k + 0.5) * HERO_SPACING_M;
    const side = k % 2 === 0 ? -1 : 1;
    const wall = innerWallOf(layout, side);
    if (wall.length === 0) continue;
    const tower = wall.reduce((best, candidate) => Math.abs(candidate.z - z) < Math.abs(best.z - z) ? candidate : best);
    const alt = routeAltitude(z);
    const kind = alt > STRATA_PRISTINE_BASE_M - 50 || k % 3 === 2 ? 'panel' : 'blade';
    const targetY = alt + (kind === 'blade' ? 70 : 170);
    const height = kind === 'blade' ? 330 : 56;
    const top = targetY + height * 0.5 + 20;
    const key = towerKey(tower);
    const prev = reserved.get(key) ?? 0;
    reserved.set(key, Math.max(prev, top));
  }
  return reserved;
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
// R12: weighted toward cyan, amber and green — the hues that stay saturated *and* bright under ACES.
const HERO_COLORS: readonly number[] = Object.freeze([0x2ff2ff, 0xffb13c, 0xff2fb4, 0x55ff7a, 0x2ff2ff, 0xffb13c, 0xff4a8c]);

const heroCache = new Map<number, readonly SkyriverHeroBlade[]>();

/**
 * The hero signs use named exposed faces. Bend sections reserve four-blade rows. Pure; cached per seed.
 */
function reservationForHero(hero: SkyriverHeroBlade, face: SkyriverFacadeFace): FacadeReservation {
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
}

function faceBackedByMass(
  face: SkyriverFacadeFace,
  masses: readonly SkyriverMass[],
  u0: number,
  u1: number,
  y0: number,
  y1: number,
): boolean {
  const axisX = face.planeAxis === 'x';
  const centreU = (u0 + u1) * 0.5;
  const point = warpBoxPoint(face.owner, axisX ? face.plane : centreU,
    axisX ? centreU : face.plane, { x: 0, z: 0, heading: 0 });
  const c = Math.cos(point.heading), s = Math.sin(point.heading);
  const nx = axisX ? c : s, nz = axisX ? -s : c;
  for (const mass of masses) {
    if (mass.y0 > y0 + 0.5 || mass.y0 + mass.height < y1 - 0.5) continue;
    const box = roofDetailMassObb(mass, 0);
    const normalAlignment = axisX ? nx * box.ux + nz * box.uz : nx * box.vx + nz * box.vz;
    if (Math.abs(normalAlignment - 1) > 1e-8) continue;
    const dx = point.x - box.x, dz = point.z - box.z;
    const localX = dx * box.ux + dz * box.uz;
    const localZ = dx * box.vx + dz * box.vz;
    const normalCoordinate = axisX ? localX : localZ;
    const halfNormal = axisX ? box.halfX : box.halfZ;
    if (Math.abs(normalCoordinate - face.outward * halfNormal) > 0.5) continue;
    const tangentCoordinate = axisX ? localZ : localX;
    const halfTangent = axisX ? box.halfZ : box.halfX;
    if (Math.abs(tangentCoordinate) + (u1 - u0) * 0.5 > halfTangent + 0.5) continue;
    return true;
  }
  return false;
}

/**
 * Plans original hero sign artwork intents against provided faces (legacy faces).
 * Pure and self-contained; does not invoke deriveCityTrims or deriveFacadeFaces.
 */
export function planHeroArtwork(
  layout: SkyriverCityLayout,
  faces: readonly SkyriverFacadeFace[],
): readonly SkyriverHeroBlade[] {
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
  return Object.freeze(retained);
}

/**
 * Places the planned hero artwork records on actual final mass-backed R36 faces.
 * Updates host faceId, owner, and position without shrinking artwork or changing tower assignment.
 */
export function placeHeroArtwork(
  layout: SkyriverCityLayout,
  artIntents: readonly SkyriverHeroBlade[],
  finalFaces: readonly SkyriverFacadeFace[],
  finalMasses: readonly SkyriverMass[],
): readonly SkyriverHeroBlade[] {
  const faceById = new Map(finalFaces.map((face) => [face.id, face]));
  const facesByBuilding = new Map<string, SkyriverFacadeFace[]>();
  for (const face of finalFaces) {
    const bucket = facesByBuilding.get(face.buildingId) ?? [];
    bucket.push(face);
    facesByBuilding.set(face.buildingId, bucket);
  }

  // 1. Place brand
  let placedBrand: SkyriverHeroBlade | undefined;
  const brandArt = artIntents.find((hero) => hero.compositionId === 'showcase-brand');
  if (brandArt !== undefined) {
    const brandFace = finalFaces.find((face) => face.id.endsWith(':brand-face'));
    if (brandFace !== undefined) {
      const u0 = brandArt.x - brandArt.width * 0.5;
      const u1 = brandArt.x + brandArt.width * 0.5;
      const y0 = brandArt.y - brandArt.height * 0.5;
      const y1 = brandArt.y + brandArt.height * 0.5;
      if (facadeFaceContains(brandFace, { u0, u1, y0, y1 }) && faceBackedByMass(brandFace, finalMasses, u0, u1, y0, y1)) {
        placedBrand = {
          ...brandArt,
          x: brandArt.x,
          y: brandArt.y,
          z: brandFace.plane + brandFace.outward * 1.2,
          faceId: brandFace.id,
          owner: brandFace.owner,
        };
      }
    }
  }

  // 2. Place four-blade rows
  const placedRowBlades = new Map<SkyriverHeroBlade, SkyriverHeroBlade>();
  const rowCompositions = new Map<string, SkyriverHeroBlade[]>();
  for (const hero of artIntents) {
    if (hero.compositionId.startsWith('hero-row-')) {
      let group = rowCompositions.get(hero.compositionId);
      if (group === undefined) {
        group = [];
        rowCompositions.set(hero.compositionId, group);
      }
      group.push(hero);
    }
  }

  for (const [, rowBlades] of rowCompositions) {
    if (rowBlades.length === 0) continue;
    const buildingId = rowBlades[0]!.buildingId;
    const rowSide = Math.sign(rowBlades[0]!.x) as -1 | 1;
    const candidateFaces = (facesByBuilding.get(buildingId) ?? [])
      .filter((face) => face.side === rowSide && face.planeAxis === 'x');
    let bestRowHost: { readonly face: SkyriverFacadeFace; readonly dist: number } | undefined;
    for (const face of candidateFaces) {
      let allFit = true;
      for (const b of rowBlades) {
        if (Math.abs(face.plane) - b.width < 406.9) { allFit = false; break; }
        const rect = {
          u0: b.z - b.rootHalfWidthM,
          u1: b.z + b.rootHalfWidthM,
          y0: b.y - b.height * 0.5,
          y1: b.y + b.height * 0.5,
        };
        if (!facadeFaceContains(face, rect, FACADE_FACE_EDGE_MARGIN_M + 0.25)) { allFit = false; break; }
        if (!faceBackedByMass(face, finalMasses, rect.u0, rect.u1, rect.y0, rect.y1)) { allFit = false; break; }
      }
      if (!allFit) continue;
      const placedX = face.plane + face.outward * (rowBlades[0]!.width * 0.5 + 0.8);
      const dist = Math.abs(placedX - rowBlades[0]!.x);
      if (bestRowHost === undefined || dist < bestRowHost.dist - 1e-4 || (Math.abs(dist - bestRowHost.dist) <= 1e-4 && face.id.localeCompare(bestRowHost.face.id) < 0)) {
        bestRowHost = { face, dist };
      }
    }
    if (bestRowHost !== undefined) {
      const face = bestRowHost.face;
      for (const b of rowBlades) {
        placedRowBlades.set(b, {
          ...b,
          x: face.plane + face.outward * (b.width * 0.5 + 0.8),
          y: b.y,
          z: b.z,
          faceId: face.id,
          owner: face.owner,
        });
      }
    }
  }

  // 3. Build priority reservations
  const occupied: FacadeReservation[] = [];
  const priorityUnions = new Map<string, FacadeReservation>();
  const placedPriority: SkyriverHeroBlade[] = [];
  if (placedBrand !== undefined) placedPriority.push(placedBrand);
  for (const b of placedRowBlades.values()) placedPriority.push(b);

  for (const hero of placedPriority) {
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

  // 4. Place stations
  const stationPlacements = new Map<string, SkyriverHeroBlade>();
  const rejectedStations = new Set<string>();
  const stationHeroes = artIntents
    .filter((hero) => hero.compositionId.startsWith('hero-') && !hero.compositionId.startsWith('hero-row-'))
    .sort((a, b) => b.height - a.height || a.compositionId.localeCompare(b.compositionId));

  for (const hero of stationHeroes) {
    const originalSide = Math.sign(hero.x) as -1 | 1;
    let best: { readonly hero: SkyriverHeroBlade; readonly face: SkyriverFacadeFace; readonly dist: number } | undefined;
    const hostFaces = (facesByBuilding.get(hero.buildingId) ?? [])
      .filter((face) => face.side === originalSide && face.planeAxis === 'x');
    for (const face of hostFaces) {
      const margin = FACADE_FACE_EDGE_MARGIN_M + 0.25;
      const isBlade = hero.kind === 'blade';
      if (isBlade && Math.abs(face.plane) - hero.width < 409.9) continue;
      if (!isBlade && face.u1 - face.u0 < hero.width + 2 * margin) continue;

      const halfU = isBlade ? hero.rootHalfWidthM : hero.width * 0.5;
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
          if (!faceBackedByMass(face, finalMasses, rect.u0, rect.u1, rect.y0, rect.y1)) continue;
          const candidate: SkyriverHeroBlade = {
            ...hero,
            x: face.plane + face.outward * (isBlade ? hero.width * 0.5 + 0.8 : 0.8),
            y,
            z: u,
            faceId: face.id,
            owner: face.owner,
          };
          const reservation = reservationForHero(candidate, face);
          if (occupied.some((placed) => facadeReservationsConflict(reservation, placed, CANYON_LOOP_LENGTH_M))) continue;
          const dist = Math.hypot(candidate.x - hero.x, candidate.y - hero.y, candidate.z - hero.z);
          if (best === undefined || dist < best.dist - 1e-4 || (Math.abs(dist - best.dist) <= 1e-4 && face.id.localeCompare(best.face.id) < 0)) {
            best = { hero: candidate, face, dist };
          }
        }
      }
    }
    if (best === undefined) {
      rejectedStations.add(hero.compositionId);
      continue;
    }
    stationPlacements.set(hero.compositionId, best.hero);
    occupied.push(reservationForHero(best.hero, best.face));
  }

  // 5. Retain in original intent order
  const retained: SkyriverHeroBlade[] = [];
  for (const hero of artIntents) {
    if (hero.compositionId === 'showcase-brand') {
      if (placedBrand !== undefined) retained.push(placedBrand);
    } else if (hero.compositionId.startsWith('hero-row-')) {
      const placedBlade = placedRowBlades.get(hero);
      if (placedBlade !== undefined) retained.push(placedBlade);
    } else {
      const placedStation = stationPlacements.get(hero.compositionId);
      if (placedStation !== undefined && !rejectedStations.has(hero.compositionId)) {
        retained.push(placedStation);
      }
    }
  }
  return Object.freeze(retained);
}

/**
 * The hero signs use named exposed faces. Bend sections reserve four-blade rows. Pure; cached per seed.
 */
export function deriveHeroBlades(layout: SkyriverCityLayout): readonly SkyriverHeroBlade[] {
  const cached = heroCache.get(layout.seed);
  if (cached !== undefined) return cached;
  if (!legacyFaceCache.has(layout.seed) || !facadeFaceCache.has(layout.seed) || !massCache.has(layout.seed)) {
    deriveCityTrims(layout);
  }
  const cachedAfter = heroCache.get(layout.seed);
  if (cachedAfter !== undefined) return cachedAfter;
  const legacyFaces = legacyFaceCache.get(layout.seed);
  if (legacyFaces === undefined) fail('SKYRIVER_CITY_LEGACY_FACES_MISSING');
  const finalFaces = facadeFaceCache.get(layout.seed);
  if (finalFaces === undefined) fail('SKYRIVER_CITY_FACADE_FACES_MISSING');
  const finalMasses = massCache.get(layout.seed);
  if (finalMasses === undefined) fail('SKYRIVER_CITY_MASSES_MISSING');

  const artIntents = planHeroArtwork(layout, legacyFaces);
  const placed = placeHeroArtwork(layout, artIntents, finalFaces, finalMasses);
  heroCache.set(layout.seed, placed);
  return placed;
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

export interface SkyriverSignSolid {
  readonly host: SkyriverSignMount['host'];
  readonly owner: SkyriverTrimOwner;
  readonly footprint: readonly (readonly [number, number])[];
  readonly y0: number;
  readonly y1: number;
  readonly ledge: boolean;
}

/** Use the renderer's draw exclusions and Float32 instance matrices. */
export function deriveSignMountSolids(layout: SkyriverCityLayout): readonly SkyriverSignSolid[] {
  const masses = deriveCityMasses(layout);
  const trims = deriveCityTrims(layout);
  const details = deriveRoofDetails(layout);
  const detailByIndex = new Map(details.records.map(record => [record.trimIndex, record]));
  const heroes = deriveHeroBlades(layout);
  const heroBoxes = roofDetailHeroBoxCache.get(layout.seed) ?? [];
  const result: SkyriverSignSolid[] = [];
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const centre = new THREE.Vector3();
  const extent = new THREE.Vector3();
  const placed: SkyriverTrimPlacement = { x: 0, z: 0, heading: 0, length: 0 };
  const add = (host: SkyriverSignMount['host'], owner: SkyriverTrimOwner, x: number, y: number, z: number,
    sx: number, sy: number, sz: number, heading: number, ledge: boolean): void => {
    rotation.setFromAxisAngle(UP, heading);
    matrix.compose(centre.set(x, y, z), rotation, extent.set(sx, sy, sz));
    const m = matrix.elements.map(Math.fround);
    const footprint = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]].map(([u, v]) =>
      [m[12]! + u! * m[0]! + v! * m[8]!, m[14]! + u! * m[2]! + v! * m[10]!] as const);
    result.push({ host, owner, footprint, y0: m[13]! - Math.abs(m[5]!) * .5,
      y1: m[13]! + Math.abs(m[5]!) * .5, ledge });
  };
  for (let index = 0; index < masses.length; index += 1) {
    const mass = masses[index]!;
    if ((mass.layer ?? 0) >= IMPOSTOR_MIN_LAYER) continue;
    warpBoxPoint(mass, mass.x, mass.z, roofDetailWarp);
    add({ kind: 'mass', index }, ownerOf({ ...mass, materialOwner: mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z) }, mass.anchorV ?? mass.z),
      roofDetailWarp.x, mass.y0 + mass.height * .5, roofDetailWarp.z,
      mass.width, mass.height, mass.depth, roofDetailWarp.heading,
      (mass.layer ?? 0) === 0 && mass.artBacking === undefined && mass.baseRecord === undefined);
  }
  for (let index = 0; index < trims.count; index += 1) {
    const detail = detailByIndex.get(index);
    if (detail === undefined && skyriverTrimBlocksHero(trims, index, heroes)) continue;
    placeTrim(trims, index, placed);
    const sx = placed.length > 0 && trims.sx[index]! > trims.sz[index]! ? placed.length : trims.sx[index]!;
    const sz = placed.length > 0 && trims.sz[index]! >= trims.sx[index]! ? placed.length : trims.sz[index]!;
    if (detail !== undefined && roofDetailBlocksHero(roofDetailBox(placed.x, trims.cy[index]!, placed.z,
      sx, trims.sy[index]!, sz, placed.heading), heroBoxes)) continue;
    add({ kind: 'trim', index }, trims.owner[index]!, placed.x, trims.cy[index]!, placed.z,
      sx, trims.sy[index]!, sz, placed.heading, detail === undefined
        && ([SKYRIVER_TRIM_BAND, SKYRIVER_TRIM_CANTILEVER, SKYRIVER_TRIM_BALCONY].includes(trims.kind[index]!)
          || trims.kind[index] === SKYRIVER_TRIM_FLOOD && trims.sy[index]! <= Math.min(sx, sz)));
  }
  return result;
}

interface SignMountEdge {
  readonly solid: SkyriverSignSolid;
  readonly edgeIndex: number;
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
  readonly outward: readonly [number, number];
}

function signMountOwnerKey(owner: SkyriverTrimOwner): string {
  return `${owner.anchorV}:${trimMaterialOwnerSeed(owner)}`;
}

function signMountPositiveOverlap(a: SkyriverSignSolid, b: SkyriverSignSolid): boolean {
  if (Math.min(a.y1, b.y1) <= Math.max(a.y0, b.y0)) return false;
  for (const polygon of [a.footprint, b.footprint]) {
    for (let i = 0; i < polygon.length; i += 1) {
      const p = polygon[i]!, q = polygon[(i + 1) % polygon.length]!;
      const ax = p[1] - q[1], az = q[0] - p[0];
      const project = (points: SkyriverSignSolid['footprint']): readonly [number, number] => {
        let lo = Infinity, hi = -Infinity;
        for (const point of points) {
          const value = (point[0] - p[0]) * ax + (point[1] - p[1]) * az;
          lo = Math.min(lo, value); hi = Math.max(hi, value);
        }
        return [lo, hi];
      };
      const pa = project(a.footprint), pb = project(b.footprint);
      if (Math.min(pa[1], pb[1]) <= Math.max(pa[0], pb[0])) return false;
    }
  }
  return true;
}

function signMountCoveredInterval(a: readonly [number, number], b: readonly [number, number],
  polygon: SkyriverSignSolid['footprint']): readonly [number, number] | undefined {
  let lo = 0, hi = 1;
  for (let i = 0; i < polygon.length; i += 1) {
    const p = polygon[i]!, q = polygon[(i + 1) % polygon.length]!;
    const cross = (r: readonly [number, number]): number =>
      (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const da = cross(a), db = cross(b);
    if (da <= 0 && db <= 0) return undefined;
    if (da < 0) lo = Math.max(lo, da / (da - db));
    if (db < 0) hi = Math.min(hi, da / (da - db));
    if (hi <= lo) return undefined;
  }
  return [lo, hi];
}

function signMountCanonicalPoint(owner: SkyriverTrimOwner, x: number, y: number, z: number): SkyriverSignPoint {
  const origin: WarpOut = { x: 0, z: 0, heading: 0 };
  warpBoxPoint(owner, owner.x, owner.z, origin);
  const dx = x - origin.x, dz = z - origin.z;
  const c = Math.cos(origin.heading), sn = Math.sin(origin.heading);
  return { x: owner.x + dx * c - dz * sn, y, z: owner.z + dx * sn + dz * c };
}

export interface SkyriverSignWorldPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly nx: number;
  readonly nz: number;
}

/** Return the Float32 pose written to the sign attributes. */
export function placeNeonSign(owner: SkyriverTrimOwner | null, cx: number, cy: number, cz: number,
  nx: number, nz: number): SkyriverSignWorldPose {
  const frame: WarpOut = { x: 0, z: 0, heading: 0 };
  if (owner !== null) warpBoxPoint(owner, cx, cz, frame);
  else warpRigid(cx, cz, cz, frame);
  const normal = { x: 0, z: 0 };
  warpDirection(nx, nz, frame.heading, normal);
  return { x: Math.fround(frame.x), y: Math.fround(cy), z: Math.fround(frame.z),
    nx: Math.fround(normal.x), nz: Math.fround(normal.z) };
}

function signMountSafeCentre(roofY: number, height: number): number {
  const rounded = Math.fround(roofY + height * .5);
  if (rounded - height * .5 >= roofY) return rounded;
  const value = new Float32Array([rounded]);
  const bits = new Uint32Array(value.buffer);
  bits[0] = bits[0]! + 1;
  return value[0]!;
}

export function mountNeonSigns(layout: SkyriverCityLayout, signs: SkyriverNeonSignArtwork): SkyriverNeonSigns {
  const started = performance.now();
  const solids = deriveSignMountSolids(layout);
  const sourceFaces = deriveFacadeFaces(layout);
  const faceIds = new Set(signs.faceId);
  const wantedOwners = new Set(sourceFaces.filter(face => faceIds.has(face.id)).map(face => signMountOwnerKey(face.owner)));
  for (const owner of signs.owner) if (owner !== null) wantedOwners.add(signMountOwnerKey(owner));
  const cellM = 256;
  const cells = new Map<string, number[]>();
  const bounds = (box: SkyriverSignSolid): readonly [number, number, number, number] => [
    Math.min(...box.footprint.map(p => p[0])), Math.max(...box.footprint.map(p => p[0])),
    Math.min(...box.footprint.map(p => p[1])), Math.max(...box.footprint.map(p => p[1])),
  ];
  const solidBounds = new Map(solids.map(solid => [solid, bounds(solid)]));
  solids.forEach((solid, index) => {
    const [x0, x1, z0, z1] = solidBounds.get(solid)!;
    for (let x = Math.floor(x0 / cellM); x <= Math.floor(x1 / cellM); x += 1)
      for (let z = Math.floor(z0 / cellM); z <= Math.floor(z1 / cellM); z += 1) {
        const key = `${x}:${z}`, list = cells.get(key) ?? [];
        if (!cells.has(key)) cells.set(key, list);
        list.push(index);
      }
  });
  const stamps = new Int32Array(solids.length);
  let stamp = 0;
  const nearby = (box: SkyriverSignSolid): SkyriverSignSolid[] => {
    const [x0, x1, z0, z1] = solidBounds.get(box) ?? bounds(box), result: SkyriverSignSolid[] = [];
    stamp += 1;
    for (let x = Math.floor(x0 / cellM); x <= Math.floor(x1 / cellM); x += 1)
      for (let z = Math.floor(z0 / cellM); z <= Math.floor(z1 / cellM); z += 1)
        for (const index of cells.get(`${x}:${z}`) ?? []) {
          if (stamps[index] === stamp) continue;
          stamps[index] = stamp;
          const solid = solids[index]!;
          if (Math.min(box.y1, solid.y1) >= Math.max(box.y0, solid.y0)) result.push(solid);
        }
    return result;
  };
  const byOwner = new Map<string, SignMountEdge[]>();
  for (const solid of solids) {
    if (!solid.ledge || solid.y1 < 0 || !wantedOwners.has(signMountOwnerKey(solid.owner))) continue;
    const covering = nearby({ ...solid, y0: solid.y1, y1: solid.y1 });
    for (let edgeIndex = 0; edgeIndex < 4; edgeIndex += 1) {
      const a = solid.footprint[edgeIndex]!, b = solid.footprint[(edgeIndex + 1) % 4]!;
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      let intervals: (readonly [number, number])[] = [[0, 1]];
      for (const cover of covering) {
        if (cover === solid || cover.y1 <= solid.y1 || cover.y0 > solid.y1) continue;
        const cut = signMountCoveredInterval(a, b, cover.footprint);
        if (cut === undefined) continue;
        intervals = intervals.flatMap(([lo, hi]) => {
          if (cut[1] <= lo || cut[0] >= hi) return [[lo, hi] as const];
          const pieces: (readonly [number, number])[] = [];
          if (cut[0] > lo) pieces.push([lo, cut[0]]);
          if (cut[1] < hi) pieces.push([cut[1], hi]);
          return pieces;
        });
      }
      const key = signMountOwnerKey(solid.owner), edges = byOwner.get(key) ?? [];
      for (const [lo, hi] of intervals) if ((hi - lo) * length > .402) edges.push({ solid, edgeIndex,
        a: [a[0] + dx * (lo + .001 / length), a[1] + dz * (lo + .001 / length)],
        b: [a[0] + dx * (hi - .001 / length), a[1] + dz * (hi - .001 / length)],
        outward: [dz / length, -dx / length] });
      byOwner.set(key, edges);
    }
  }
  const heroes = deriveHeroBlades(layout);
  const faces = new Map(sourceFaces.map(face => [face.id, face]));
  const merge = (a: FacadeReservation | undefined, b: FacadeReservation): FacadeReservation => a === undefined ? b : {
    ...b, u0: Math.min(a.u0, b.u0), u1: Math.max(a.u1, b.u1), y0: Math.min(a.y0, b.y0),
    y1: Math.max(a.y1, b.y1), heightM: Math.max(a.heightM, b.heightM),
  };
  const groupKey = (index: number): string => index < signs.heroCount ? signs.compositionId[index]! : `ordinary:${index}`;
  const sourceGroups = new Map<string, FacadeReservation>();
  for (let index = 0; index < signs.count; index += 1) {
    const face = faces.get(signs.faceId[index]!)!;
    const blade = index < signs.heroCount ? heroes[index]!.kind === 'blade' : signs.nz[index] !== 0;
    const half = face.planeAxis === 'z' ? 4 : blade ? signs.rootHalfWidthM[index]! : signs.sw[index]! * .5;
    const reservation: FacadeReservation = { side: face.side, buildingId: face.buildingId,
      compositionId: signs.compositionId[index]!, role: index < signs.heroCount ? 'hero' : 'ordinary',
      u0: signs.cz[index]! - half, u1: signs.cz[index]! + half,
      y0: signs.cy[index]! - signs.sh[index]! * .5, y1: signs.cy[index]! + signs.sh[index]! * .5,
      heightM: signs.sh[index]! };
    sourceGroups.set(groupKey(index), merge(sourceGroups.get(groupKey(index)), reservation));
  }
  const reservations = [...sourceGroups.values()];
  interface Candidate {
    readonly score: number;
    readonly pose: readonly [number, number, number, number, number];
    readonly owner: SkyriverTrimOwner;
    readonly mount: SkyriverSignMount;
    readonly reservation: FacadeReservation;
    readonly box: SkyriverSignSolid;
  }
  const domains: Candidate[][] = [];
  const receipts: object[] = [];
  const candidateMaps = Array.from({ length: signs.count }, () => new Map<string, Candidate>());
  const checkedWorldPoses = Array.from({ length: signs.count }, () => new Set<string>());
  const generateCandidates = (index: number, reservations: readonly FacadeReservation[]): void => {
    const originalOwner = signs.owner[index]!;
    if (originalOwner === null) fail('SKYRIVER_SIGN_MOUNT_OWNER');
    const face = sourceFaces.find(candidate => candidate.id === signs.faceId[index]
      && (byOwner.get(signMountOwnerKey(candidate.owner))?.length ?? 0) > 0) ?? faces.get(signs.faceId[index]!)!;
    const mode = index < signs.heroCount ? heroes[index]!.kind === 'blade' ? 'blade' : 'panel'
      : signs.nz[index] !== 0 ? 'blade' : 'panel';
    const original: WarpOut = { x: 0, z: 0, heading: 0 };
    warpBoxPoint(originalOwner, signs.cx[index]!, signs.cz[index]!, original);
    const originalNormal = { x: 0, z: 0 };
    warpDirection(signs.nx[index]!, signs.nz[index]!, original.heading, originalNormal);
    const width = signs.sw[index]!, height = signs.sh[index]!;
    const matchedEdges = byOwner.get(signMountOwnerKey(face.owner)) ?? [];
    const originalEdges = byOwner.get(signMountOwnerKey(originalOwner)) ?? [];
    const edges = matchedEdges.length > 0 ? matchedEdges : originalEdges.length > 0 ? originalEdges
      : [...byOwner.values()].flatMap(group => {
      const owner = group[0]?.solid.owner;
      return owner !== undefined && owner.anchorV === face.owner.anchorV
        && Math.abs(owner.x - face.owner.x) < 1e-6 && Math.abs(owner.z - face.owner.z) < 1e-6
        && owner.width === face.owner.width && owner.depth === face.owner.depth ? group : [];
    });
    const receipt = { index, faceId: signs.faceId[index], compositionId: signs.compositionId[index],
      edgeCount: edges.length, candidates: 0, solid: 0 };
    const candidates = candidateMaps[index]!;
    const checked = checkedWorldPoses[index]!;
    const orderedEdges = [...edges].sort((a, b) => Math.abs(a.solid.y1 + height * .5 - signs.cy[index]!)
      - Math.abs(b.solid.y1 + height * .5 - signs.cy[index]!));
    for (const edge of orderedEdges) {
      const dx = edge.b[0] - edge.a[0], dz = edge.b[1] - edge.a[1], length = Math.hypot(dx, dz);
      const ex = dx / length, ez = dz / length, out = edge.outward;
      const alignment = mode === 'panel' ? out[0] * originalNormal.x + out[1] * originalNormal.z
        : Math.abs(ex * originalNormal.x + ez * originalNormal.z);
      if (alignment < .5) continue;
      const minimumAlong = mode === 'panel' ? .2 - width * .5 : .2;
      const maximumAlong = mode === 'panel' ? length + width * .5 - .2 : length - .2;
      const near = ((original.x - edge.a[0]) * ex + (original.z - edge.a[1]) * ez);
      const clampAlong = (value: number): number => Math.max(minimumAlong, Math.min(maximumAlong, value));
      const parameters = new Set([clampAlong(near), minimumAlong, maximumAlong, length * .5]);
      const ca = signMountCanonicalPoint(edge.solid.owner, edge.a[0], edge.solid.y1, edge.a[1]);
      const cb = signMountCanonicalPoint(edge.solid.owner, edge.b[0], edge.solid.y1, edge.b[1]);
      const alongZ = (cb.z - ca.z) / length;
      if (Math.abs(alongZ) > .01) {
        const halfAlong = face.planeAxis === 'z' ? 4 : mode === 'blade' ? signs.rootHalfWidthM[index]! : width * .5;
        for (const placed of reservations) {
          if (placed.side !== face.side) continue;
          const required = index < signs.heroCount
            ? 1.5 * Math.max(height, placed.heightM)
            : placed.role === 'ordinary' ? 2 * Math.max(height, placed.heightM) : 1.5 * placed.heightM;
          const dy = Math.max(0, edge.solid.y1 - placed.y1, placed.y0 - (edge.solid.y1 + height));
          if (dy >= required) continue;
          const du = Math.sqrt(required * required - dy * dy);
          for (const shift of [-CANYON_LOOP_LENGTH_M, 0, CANYON_LOOP_LENGTH_M]) {
            parameters.add(clampAlong((placed.u0 + shift - halfAlong - du - .01 - ca.z) / alongZ));
            parameters.add(clampAlong((placed.u1 + shift + halfAlong + du + .01 - ca.z) / alongZ));
          }
        }
      }
      for (const along of parameters) {
        const rx = edge.a[0] + ex * along, rz = edge.a[1] + ez * along;
        for (const outwardM of [.001, .25, 1, 2]) {
          receipt.candidates += 1;
          const normalSign = ex * originalNormal.x + ez * originalNormal.z >= 0 ? 1 : -1;
          const nx = mode === 'panel' ? out[0] : ex * normalSign;
          const nz = mode === 'panel' ? out[1] : ez * normalSign;
          const wx = rx + out[0] * (outwardM + (mode === 'panel' ? .2 : width * .5));
          const wz = rz + out[1] * (outwardM + (mode === 'panel' ? .2 : width * .5));
          const wy = signMountSafeCentre(edge.solid.y1, height);
          const owner = edge.solid.owner;
          const canonical = signMountCanonicalPoint(owner, wx, wy, wz);
          const frame: WarpOut = { x: 0, z: 0, heading: 0 };
          warpBoxPoint(owner, owner.x, owner.z, frame);
          const c = Math.cos(frame.heading), sn = Math.sin(frame.heading);
          const cnx = Math.fround(nx * c - nz * sn), cnz = Math.fround(nx * sn + nz * c);
          const pose = [Math.fround(canonical.x), Math.fround(canonical.y), Math.fround(canonical.z), cnx, cnz] as const;
          const world = placeNeonSign(owner, ...pose);
          const nl = Math.hypot(world.nx, world.nz);
          const n = [world.nx / nl, world.nz / nl] as const, t = [-n[1], n[0]] as const;
          const x = world.x, z = world.z;
          const score = Math.hypot(x - original.x, pose[1] - signs.cy[index]!, z - original.z);
          const key = `${world.x}:${world.y}:${world.z}:${world.nx}:${world.nz}`;
          if (checked.has(key)) continue;
          checked.add(key);
          const points = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) =>
            [x + u! * width * .5 * t[0] + v! * .2 * n[0], z + u! * width * .5 * t[1] + v! * .2 * n[1]] as const);
          const box: SkyriverSignSolid = { host: edge.solid.host, owner, footprint: points,
            y0: pose[1] - height * .5, y1: pose[1] + height * .5, ledge: false };
          if (nearby(box).some(solid => signMountPositiveOverlap(box, solid))) { receipt.solid += 1; continue; }
          const halfAlong = face.planeAxis === 'z' ? 4 : mode === 'blade' ? signs.rootHalfWidthM[index]! : width * .5;
          const rowReservation: FacadeReservation = { side: face.side, buildingId: face.buildingId,
            compositionId: signs.compositionId[index]!, role: index < signs.heroCount ? 'hero' : 'ordinary',
            u0: pose[2] - halfAlong, u1: pose[2] + halfAlong,
            y0: pose[1] - height * .5, y1: pose[1] + height * .5, heightM: height };
          const reservation = rowReservation;
          const rootPoints: readonly (readonly [number, number])[] = mode === 'panel'
            ? (() => {
              const bx = x - .2 * n[0], bz = z - .2 * n[1];
              const aa = (edge.a[0] - bx) * t[0] + (edge.a[1] - bz) * t[1];
              const bb = (edge.b[0] - bx) * t[0] + (edge.b[1] - bz) * t[1];
              const lo = Math.max(-width * .5, Math.min(aa, bb));
              const hi = Math.min(width * .5, Math.max(aa, bb));
              return [[bx + lo * t[0], bz + lo * t[1]], [bx + hi * t[0], bz + hi * t[1]]] as const;
            })()
            : (() => { const side = t[0] * out[0] + t[1] * out[1] > 0 ? -1 : 1;
              return [[x + side * width * .5 * t[0] - .2 * n[0], z + side * width * .5 * t[1] - .2 * n[1]],
                [x + side * width * .5 * t[0] + .2 * n[0], z + side * width * .5 * t[1] + .2 * n[1]]] as const; })();
          const edgeDistance = (point: readonly [number, number]): number => {
            const u = Math.max(0, Math.min(length, (point[0] - edge.a[0]) * ex + (point[1] - edge.a[1]) * ez));
            return Math.hypot(point[0] - edge.a[0] - u * ex, point[1] - edge.a[1] - u * ez,
              box.y0 - edge.solid.y1);
          };
          if (rootPoints.some(point => edgeDistance(point) > 3)
            || Math.hypot(rootPoints[1]![0] - rootPoints[0]![0], rootPoints[1]![1] - rootPoints[0]![1]) <= 0) continue;
          const toCanonical = (point: readonly [number, number], y: number): SkyriverSignPoint =>
            signMountCanonicalPoint(owner, point[0], y, point[1]);
          const mount: SkyriverSignMount = { mode, host: edge.solid.host, edgeIndex: edge.edgeIndex,
            edge: [toCanonical(edge.a, edge.solid.y1), toCanonical(edge.b, edge.solid.y1)],
            root: [toCanonical(rootPoints[0]!, box.y0), toCanonical(rootPoints[1]!, box.y0)] };
          const sharedRow = index < signs.heroCount && signs.compositionId[index]!.startsWith('hero-row-');
          const signature = JSON.stringify([reservation.side, reservation.buildingId, reservation.compositionId,
            reservation.role, reservation.u0, reservation.u1, reservation.y0, reservation.y1, reservation.heightM,
            ...(sharedRow ? [world.x, world.z, world.nx, world.nz] : [])]);
          const previous = candidates.get(signature);
          if (previous === undefined || score < previous.score) candidates.set(signature, { score, pose, owner, mount, reservation, box });
        }
      }
    }
    domains[index] = [...candidates.values()].sort((a, b) => a.score - b.score);
    receipts[index] = { ...receipt, clear: domains[index]!.length };
  };
  for (let index = 0; index < signs.count; index += 1) generateCandidates(index, reservations);
  if (domains.some(domain => domain.length === 0)) {
    throw Error(`SKYRIVER_SIGN_MOUNT_NO_CANDIDATES:${JSON.stringify(receipts.filter((_, index) => domains[index]!.length === 0))}`);
  }

  const nearestGroups = new Map<string, FacadeReservation>();
  for (let index = 0; index < signs.count; index += 1) {
    const key = groupKey(index);
    nearestGroups.set(key, merge(nearestGroups.get(key), domains[index]![0]!.reservation));
  }
  const nearestReservations = [...nearestGroups.values()];
  for (let index = 0; index < signs.count; index += 1) generateCandidates(index, nearestReservations);

  const members = new Map<string, number[]>();
  const envelopes = new Map<string, FacadeReservation>();
  for (let index = 0; index < signs.count; index += 1) {
    const key = groupKey(index), rows = members.get(key) ?? [];
    rows.push(index); members.set(key, rows);
    for (const candidate of domains[index]!) envelopes.set(key, merge(envelopes.get(key), candidate.reservation));
  }
  const neighbors = new Map<string, string[]>();
  for (const [a, envelopeA] of envelopes) {
    neighbors.set(a, [...envelopes].filter(([b, envelopeB]) => a !== b
      && facadeReservationsConflict(envelopeA, envelopeB, CANYON_LOOP_LENGTH_M)).map(([b]) => b));
  }
  const chosen: (Candidate | undefined)[] = new Array(signs.count);
  const unions = new Map<string, FacadeReservation>();
  const pairOverlaps = new WeakMap<Candidate, WeakMap<Candidate, boolean>>();
  const boardsOverlap = (a: Candidate, b: Candidate): boolean => {
    let row = pairOverlaps.get(a);
    if (row === undefined) { row = new WeakMap(); pairOverlaps.set(a, row); }
    const cached = row.get(b);
    if (cached !== undefined) return cached;
    const overlap = signMountPositiveOverlap(a.box, b.box);
    row.set(b, overlap);
    return overlap;
  };
  interface Domain {
    readonly candidates: readonly Candidate[];
    readonly causes: ReadonlySet<number>;
  }
  let searchNodes = 0, constraintChecks = 0, lastEmptyIndex = -1;
  let stopped = false;
  const assignedMembers = (key: string): number[] => members.get(key)!.filter(row => chosen[row] !== undefined);
  const search = (remaining: readonly Domain[], assigned: number): ReadonlySet<number> | undefined => {
    if (assigned === signs.count) return undefined;
    if (searchNodes >= 20000 || constraintChecks >= 25000000) { stopped = true; return new Set(); }
    let index = -1;
    for (let row = 0; row < signs.count; row += 1) {
      if (chosen[row] !== undefined) continue;
      if (index < 0 || remaining[row]!.candidates.length < remaining[index]!.candidates.length
        || remaining[row]!.candidates.length === remaining[index]!.candidates.length && signs.sh[row]! > signs.sh[index]!) index = row;
    }
    const key = groupKey(index), previous = unions.get(key);
    const causes = new Set(remaining[index]!.causes);
    for (const candidate of remaining[index]!.candidates) {
      searchNodes += 1;
      if (searchNodes > 20000 || constraintChecks >= 25000000) { stopped = true; return causes; }
      const overlappingRows = assignedMembers(key).filter(row => {
        constraintChecks += 1;
        return boardsOverlap(candidate, chosen[row]!);
      });
      if (overlappingRows.length > 0) {
        for (const row of overlappingRows) causes.add(row);
        continue;
      }
      const aggregate = merge(previous, candidate.reservation);
      const blockers = neighbors.get(key)!.filter(other => {
        const placed = unions.get(other);
        constraintChecks += 1;
        return placed !== undefined && facadeReservationsConflict(aggregate, placed, CANYON_LOOP_LENGTH_M);
      });
      if (blockers.length > 0) {
        for (const other of blockers) for (const row of assignedMembers(other)) causes.add(row);
        for (const row of assignedMembers(key)) causes.add(row);
        continue;
      }
      chosen[index] = candidate;
      unions.set(key, aggregate);
      const next = [...remaining];
      let failure: ReadonlySet<number> | undefined;
      for (const other of [key, ...neighbors.get(key)!]) {
        const otherUnion = unions.get(other);
        for (const row of members.get(other)!) {
          if (chosen[row] !== undefined) continue;
          const options = remaining[row]!.candidates.filter(option => {
            constraintChecks += 1;
            return other === key ? !boardsOverlap(candidate, option)
              : !facadeReservationsConflict(aggregate, merge(otherUnion, option.reservation), CANYON_LOOP_LENGTH_M);
          });
          if (options.length === remaining[row]!.candidates.length) continue;
          const removedBy = new Set(remaining[row]!.causes);
          for (const assignedRow of [...assignedMembers(key), ...assignedMembers(other)]) removedBy.add(assignedRow);
          next[row] = { candidates: options, causes: removedBy };
          if (options.length === 0) { lastEmptyIndex = row; failure = removedBy; break; }
        }
        if (failure !== undefined) break;
      }
      if (failure === undefined) failure = search(next, assigned + 1);
      if (failure === undefined) return undefined;
      chosen[index] = undefined;
      if (previous === undefined) unions.delete(key); else unions.set(key, previous);
      if (stopped || !failure.has(index)) return failure;
      for (const row of failure) if (row !== index) causes.add(row);
    }
    return causes;
  };
  const failed = search(domains.map(candidates => ({ candidates, causes: new Set<number>() })), 0);
  if (failed !== undefined) {
    throw Error(`SKYRIVER_SIGN_MOUNT_SEARCH_EXHAUSTED:${JSON.stringify({ searchNodes, constraintChecks, stopped,
      lastEmptyIndex, conflictIndices: [...failed], receipts })};ms=${performance.now() - started}`);
  }
  const cx = signs.cx.slice(), cy = signs.cy.slice(), cz = signs.cz.slice();
  const nx = signs.nx.slice(), nz = signs.nz.slice(), owners = [...signs.owner];
  const mounts: SkyriverSignMount[] = [];
  for (let index = 0; index < signs.count; index += 1) {
    const candidate = chosen[index]!;
    cx[index] = candidate.pose[0]; cy[index] = candidate.pose[1]; cz[index] = candidate.pose[2];
    nx[index] = candidate.pose[3]; nz[index] = candidate.pose[4];
    owners[index] = candidate.owner; mounts[index] = candidate.mount;
  }
  return { ...signs, cx, cy, cz, nx, nz, owner: owners, mount: mounts };
}


export function deriveNeonSignArtwork(layout: SkyriverCityLayout): SkyriverNeonSignArtwork {
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
  const faces = deriveFacadeFaces(layout).filter(face => face.planeAxis === 'x'
    && [[6, 55], [34, 12], [12, 45], [18, 12]].some(([width, height]) => {
      const margin = FACADE_FACE_EDGE_MARGIN_M + 0.25;
      return face.u1 - face.u0 >= width! + margin * 2
        && Math.max(40, face.y0 + margin + height! * 0.5)
          <= Math.min(STRATA_PRISTINE_BASE_M, 2050, face.y1 - margin - height! * 0.5);
    }));
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

  const signs: SkyriverNeonSignArtwork = {
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
  return signs;
}

export function deriveNeonSigns(layout: SkyriverCityLayout): SkyriverNeonSigns {
  const cached = signCache.get(layout.seed);
  if (cached !== undefined) return cached;
  const mounted = mountNeonSigns(layout, deriveNeonSignArtwork(layout));
  signCache.set(layout.seed, mounted);
  return mounted;
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
attribute float aEmissionAllowed; // R31: equipment has no self-emission

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
flat varying float vWindowPalette;
flat varying float vEmissionAllowed;

#include <fog_pars_vertex>
${WINDOW_PALETTE_GLSL}

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
  vEmissionAllowed = aEmissionAllowed;
  vWindowPalette = windowPaletteCodeFromQ(floor(clamp(aMaterial, 0.0, 1.0 - 1.0 / 65536.0) * 65536.0), aDistrict);

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
flat varying float vWindowPalette;
flat varying float vEmissionAllowed;

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
${SKYRIVER_STRUCTURED_LIGHT_GLSL}
${SKYRIVER_INTERIOR_RESPONSE_GLSL}
${SKYRIVER_STRUCTURE_MATERIAL_GLSL}
${WINDOW_PALETTE_GLSL}
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
    vec3 farWindow = farPane * mix( farAverage, farLit * farGlass, farResolve ) * farStepMask * 1.6 * layerDim * EMISSIVE_GAIN * vEmissionAllowed;
    vec3 farBase0 = vec3( 0.004, 0.005, 0.007 );
    // Crown tips catch a little sky so stacked silhouettes separate against the haze band.
    farBase0 += vec3( 0.012, 0.016, 0.024 ) * layerDim * smoothstep( 0.5, 1.0, vWorldPos.y / 6500.0 ) * ( 1.0 - vIsSide );
    float farQ = quantizeMaterialSeed( vMaterial );
    float farFamily, farB, farW, farF, farEdge;
    vec3 farChroma;
    structureMaterialProfile( farQ, vFaceId, farFamily, farB, farW, farF, farEdge, farChroma );
    vec3 farBase1 = farBase0 * farChroma;
    vec3 farBase = normalizeFamilyMaterial( farBase0, farBase1, farB, farW, farF, farFamily );
    vec3 farUnit = mix(windowPaletteMean(vWindowPalette), windowPaletteUnit(vWindowPalette, farTemp), farResolve);
    vec3 farColor = farBase + recolourWindow(
      skyriverDistrictTint( farWindow, vDistrict, DISTRICT_PANE_SATURATION ), farUnit, uDistrictColour);
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

  float grain = skyValueNoise( vSurf * 0.07 + faceOffset * 0.013 ) * ( 0.5 + 0.5 * ( 1.0 - detail ) );
  if ( detail > 0.0 ) grain += skyValueNoise( vSurf * 0.31 ) * 0.5 * detail;
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
  // These terms have no contribution outside the grime stratum.
  if ( grime * vIsSide > 0.0 ) {
    float stain = skyValueNoise( vec2( vSurf.x * 0.11 + vSeed * 13.0, vSurf.y * 0.008 ) );
    float soot = skyValueNoise( vec2( vSurf.x * 0.4, vSurf.y * 0.05 ) + faceOffset * 0.02 );
    vec3 grimeTone = vec3( 0.62, 0.45, 0.31 ) * uConcreteLevel * 2.4 * ( 0.45 + 0.75 * stain ) * ( 0.7 + 0.5 * soot );
    float ledge = smoothstep( 0.86, 0.94, cellLocal.y ) * ( 1.0 - smoothstep( 0.97, 1.0, cellLocal.y ) );
    float acBox = step( 0.72, skyHash12( cell * vec2( 1.3, 0.7 ) + faceOffset ) )
      * step( 0.2, cellLocal.x ) * step( cellLocal.x, 0.55 ) * step( 0.55, cellLocal.y ) * step( cellLocal.y, 0.86 );
    grimeTone += vec3( 0.5, 0.4, 0.3 ) * uConcreteLevel * ( ledge * 1.6 + acBox * 1.2 ) * detail;
    // R16 ambient III: the grime floor drops (0.4 -> 0.28).
    concrete = mix( concrete, grimeTone * 0.28 + uConcreteAmbient * 0.15, grime * vIsSide );
  }
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
    * mix( 1.0, wetMicrodetail( vWorldPos, vSeed ), fineDetail )
    * ( 0.3 + 0.7 * ( 1.0 - smoothstep( 0.0, 0.45, vUp ) ) );
  // Overcast reflection is neutral. Local signs supply the colored reflection below.
  vec3 sheen = vec3( dot( uWetTint, vec3( 0.2126, 0.7152, 0.0722 ) ) * 0.12 );
  vec3 wetSheen = sheen * fresnel * ( 0.2 + 0.8 * wet ) * vIsSide * paneStepMask * ( 1.0 - 0.6 * smoothstep( 1750.0, 2250.0, vWorldPos.y ) ) * 0.45;

  // Wet arrises: a 1-2 px highlight on every box edge, so each mass separates from the one behind.
  vec2 edgeDistance = vFaceHalf - abs( vSurf );
  vec2 surfPerPixel = max( fwidth( vSurf ), vec2( 1e-4 ) );
  float edgePixels = min( edgeDistance.x / surfPerPixel.x, edgeDistance.y / surfPerPixel.y );
  float arrisLine = 1.0 - smoothstep( 0.5, 2.0, edgePixels );
  vec3 wetArris = mix( sheen, vec3( 0.06 ), 0.5 ) * arrisLine * ( 0.1 + 0.18 * faceShade ) * 0.3;

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
  vec3 color = normalizeFamilyMaterial( matC0, matC1, matB, matW, matF, matFamily );

  // Hero blade light: coloured spill on the concrete around each giant sign, and the windows behind
  // and beside it go dark so the sign owns its patch of wall.
  vec3 heroSpill = vec3( 0.0 );
  float heroShadow = 0.0;
  for ( int i = 0; i < HERO_MAX; i ++ ) {
    if ( i >= uHeroCount ) break;
    vec4 blade = uHeroBlades[ i ];
    vec3 nearest = vec3( blade.x, clamp( vWorldPos.y, blade.y - blade.w, blade.y + blade.w ), blade.z );
    float d = length( vWorldPos - nearest );
    float response = localAreaLight( max( blade.w * 48.0, 1.0 ), d );
    heroSpill += uHeroColors[ i ] * response * lightBreakup( vWorldPos, blade.x * 0.01 + blade.z * 0.007 );
    heroShadow = max( heroShadow, response * uHeroWeight[ i ] );
  }
  color += heroSpill * 0.2 * contactAo;
  // T7 wet sheen: the rain-slick facade mirrors the nearest giant sign's colour at grazing angles.
  vec3 wetSpill = heroSpill / ( 1.0 + length( heroSpill ) )
    * ( 0.3 + 0.7 * wet ) * paneStepMask;
  color += wetSpill * fresnel * 0.65 * vIsSide * contactAo;

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
  float S = clamp( uInteriorStrength * interiorDepthMix * grazingFade * vIsSide * vEmissionAllowed, 0.0, 1.0 );
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
  // One palette owns panes, silhouette rooms, furniture lamps and screens through every fade.
  resolved = recolourWindow(resolved, windowPaletteUnit(vWindowPalette, roomHash), uDistrictColour);
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
  averaged = recolourWindow(averaged, windowPaletteMean(vWindowPalette), uDistrictColour);
  color += mix( averaged * ( 1.0 - heroShadow ) * ${SKYRIVER_INTERIOR_AVERAGE_GAIN.toFixed(2)}, resolved * EMISSIVE_GAIN, detail ) * 1.55 * ( 1.0 - 0.65 * pristine ) * paneStepMask * vEmissionAllowed;

  color = skyriverDistanceGrade( color, viewDepth, 0.0 );
  gl_FragColor = vec4( max( color, vec3( 0.0 ) ), 1.0 );

${SKYRIVER_OUTPUT_APPLY_GLSL}
  #include <fog_fragment>
  // The landmark wash follows the drawn stage rim and closes at 200 m.
  float megaMatch = 1.0 - step( 0.02, distance( vTint, uMegaTint ) );
  if ( megaMatch > 0.5 ) {
    float wash = 0.0;
    for ( int i = 0; i < 4; i ++ ) {
      vec4 m = uMegaWash[ i ];
      float dxz = length( vWorldPos.xz - m.xy );
      wash = max( wash, m.w * step( dxz, m.z * 1.5 ) );
    }
    // The drawn stage rim is 6 m wide. Its center is 2.5 m above the stage top.
    // The rim center is 1.3 m outside the facade. Face bounds are the uploaded stage bounds.
    float ledgeHeight = max( vFaceHalf.y - vSurf.y + 2.5, 0.0 );
    float roofEdge = max( min( vFaceHalf.x - abs(vSurf.x), vFaceHalf.y - abs(vSurf.y) ), 0.0 );
    float ledgeDistance = mix( length(vec2(roofEdge + 1.3, 2.5)), length(vec2(1.3, ledgeHeight)), vIsSide );
    float ledgeArea = max( vFaceHalf.x * 2.0 * 6.0, 1.0 );
    float ledgeResponse = localAreaLight( ledgeArea, ledgeDistance )
      * lightBreakup( vWorldPos, vSeed );
    float face = vIsSide * ledgeResponse * 0.3;
    // Saturated cool cyan-blue: a coloured floodlight, so the landmark is colour as well as light.
    vec3 washColor = vec3( 0.12, 0.55, 1.0 ) * face + vec3( 0.5, 0.8, 1.0 ) * ( 1.0 - vIsSide ) * ledgeResponse * 0.5;
    #ifdef USE_FOG
      float through = pow( max( 1.0 - skyriverFogFactor(), 0.0 ), 0.3 );
    #else
      float through = 1.0;
    #endif
    // Close by, the wash eases off so the face keeps its windows instead of reading as a flat slab.
    float near = 0.35 + 0.65 * smoothstep( 250.0, 900.0, vFogDepth );
    // R22 keeps the face and roof source roles at equal luminance.
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
${WINDOW_PALETTE_GLSL}
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
  // Keep the far silhouette. Only the upper cap's sampled emission is dark.
  card.rgb *= 1.0 - smoothstep( 0.90, 0.92, vCardUv.y );
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
  vec3 cardBase = normalizeFamilyMaterial( cardBase0, cardBase1, cardB, cardW, cardF, cardFamily );
  float cardPalette = windowPaletteCodeFromQ(cardQ, vCardDistrict);
  vec3 color = cardBase
    + recolourWindow(skyriverDistrictTint( card.rgb * 1.1 * dim * uEmissive, vCardDistrict, DISTRICT_FAR_CARD_SATURATION ),
      windowPaletteMean(cardPalette), uDistrictColour);
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
attribute float aMaterial;

varying vec3 vTrimLocal;
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying float vSeed;
varying float vKind;
varying vec3 vSizeM;
varying float vDistrict;
flat varying float vMaterial;

#include <fog_pars_vertex>

void main() {
  vec3 transformed = vec3( position );
  vTrimLocal = transformed;
  vSizeM = aSize;
  vSeed = aSeed;
  vKind = aKind;
  vDistrict = aDistrict;
  vMaterial = aMaterial;

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
flat varying float vMaterial;

#include <fog_pars_fragment>
${SKYRIVER_OUTPUT_PARS_GLSL}
${SKYRIVER_HASH_GLSL}
${SKYRIVER_DISTRICT_COLOUR_GLSL}
${SKYRIVER_STRUCTURE_MATERIAL_GLSL}

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

  float matFamily, matB, matW, matF, matEdge;
  vec3 matChroma;
  structureMaterialProfile(quantizeMaterialSeed(vMaterial), 0.0,
    matFamily, matB, matW, matF, matEdge, matChroma);
  vec3 color = normalizeFamilyMaterial(base, base * matChroma, matB, matW, matF, matFamily);

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
${SKYRIVER_STRUCTURED_LIGHT_GLSL}
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
  float edgeFade = ( 1.0 - smoothstep( 0.65, 0.95, edge.x ) ) * ( 1.0 - smoothstep( 0.65, 0.95, edge.y ) );
  float halo = exp( - dot( q, q ) * 1.4 ) * edgeFade * ( 1.0 - inside * 0.5 )
    * ( 1.0 + 1.25 * ( lightBreakup( vWorldPos, vSignSeed ) - 1.0 ) );
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
  windowPalette: WINDOW_PALETTE_GLSL,
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

/** Computes union area of 2D axis-aligned rectangles in YZ space. */
function computeClippedUnionAreaYZ(rects: readonly { y0: number; y1: number; z0: number; z1: number }[]): number {
  if (rects.length === 0) return 0;
  if (rects.length === 1) return (rects[0]!.y1 - rects[0]!.y0) * (rects[0]!.z1 - rects[0]!.z0);
  const ys: number[] = [];
  for (const r of rects) ys.push(r.y0, r.y1);
  ys.sort((a, b) => a - b);
  let totalArea = 0;
  for (let i = 0; i < ys.length - 1; i += 1) {
    const y0 = ys[i]!;
    const y1 = ys[i + 1]!;
    if (y1 - y0 < 1e-9) continue;
    const midY = (y0 + y1) * 0.5;
    const spans: [number, number][] = [];
    for (const r of rects) {
      if (r.y0 <= midY && midY <= r.y1) spans.push([r.z0, r.z1]);
    }
    if (spans.length === 0) continue;
    spans.sort((a, b) => a[0] - b[0]);
    let zSpan = 0;
    let cz0 = spans[0]![0];
    let cz1 = spans[0]![1];
    for (let j = 1; j < spans.length; j += 1) {
      const nz0 = spans[j]![0];
      const nz1 = spans[j]![1];
      if (nz0 <= cz1) {
        cz1 = Math.max(cz1, nz1);
      } else {
        zSpan += cz1 - cz0;
        cz0 = nz0;
        cz1 = nz1;
      }
    }
    zSpan += cz1 - cz0;
    totalArea += (y1 - y0) * zSpan;
  }
  return totalArea;
}

interface HostMassEntry {
  readonly mass: SkyriverMass;
  readonly massIndex: number;
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
  readonly z0: number;
  readonly z1: number;
}

interface HostBucket {
  readonly faces: SkyriverFacadeFace[];
  readonly masses: HostMassEntry[];
}

function hostIndexKey(canonicalOwner: number, anchorV: number): string {
  return `${canonicalOwner}:${anchorV}`;
}

function massTouchesFacePlane(m: HostMassEntry, f: SkyriverFacadeFace): boolean {
  const plane = f.side === 1 ? m.x0 : m.x1;
  return Math.abs(f.plane - plane) <= 0.5;
}

function isCoveredByNearerFace(
  f: SkyriverFacadeFace,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  sameOwnerFaces: readonly SkyriverFacadeFace[],
): boolean {
  for (const other of sameOwnerFaces) {
    if (other === f || other.side !== f.side || (other.owner.yawRad ?? 0) !== (f.owner.yawRad ?? 0)
      || other.owner.x !== f.owner.x || other.owner.z !== f.owner.z) continue;
    if (Math.abs(other.plane) >= Math.abs(f.plane) - 0.1) continue;
    if (other.y0 <= y0 + 0.1 && other.y1 >= y1 - 0.1 && other.u0 <= z0 + 0.1 && other.u1 >= z1 - 0.1) {
      return true;
    }
  }
  return false;
}

function checkTrimSupportWithBucket(
  cx: number, cy: number, cz: number,
  sx: number, sy: number, sz: number,
  ow: SkyriverTrimOwner,
  bucket: HostBucket,
  targetMassIndex?: number,
): { readonly supported: boolean; readonly bestMassIndex: number; readonly exposedAreaM2: number } {
  const side = cx >= 0 ? 1 : -1;
  const tx0 = cx - sx * 0.5, tx1 = cx + sx * 0.5;
  const ty0 = cy - sy * 0.5, ty1 = cy + sy * 0.5;
  const tz0 = Math.max(cz - sz * 0.5, ow.z - ow.depth * 0.5);
  const tz1 = Math.min(cz + sz * 0.5, ow.z + ow.depth * 0.5);
  const threshold = Math.max(1e-7, sy * sz * 1e-10);
  const frame = { ...(ow.yawAnchor ?? ow), yawRad: ow.yawRad };
  const polygons = bucket.masses.map(entry => massSourceFootprint(entry.mass).map(point => {
    const local = boxLocalCoordinates(frame, point[0], point[1]);
    return [local.x, local.z] as RetainedSupportPoint;
  }));
  let bestMassIndex = -1, bestArea = -1;
  for (let index = 0; index < bucket.masses.length; index += 1) {
    const host = bucket.masses[index]!;
    if (host.mass.artBacking !== undefined || host.mass.supportRole === 'retained-child-bridge') continue;
    if (targetMassIndex !== undefined && host.massIndex !== targetMassIndex) continue;
    const polygon = polygons[index]!;
    const a = polygon[side > 0 ? 3 : 1]!, b = polygon[side > 0 ? 0 : 2]!;
    const dx = b[0] - a[0], dz = b[1] - a[1];
    let low = 0, high = 1;
    const clip = (origin: number, delta: number, minimum: number, maximum: number): void => {
      if (Math.abs(delta) < 1e-12) {
        if (origin <= minimum || origin >= maximum) high = -1;
      } else {
        const first = (minimum - origin) / delta, second = (maximum - origin) / delta;
        low = Math.max(low, Math.min(first, second));
        high = Math.min(high, Math.max(first, second));
      }
    };
    clip(a[0], dx, tx0, tx1);
    clip(a[1], dz, tz0, tz1);
    if (high <= low || Math.abs(dz) < 1e-12) continue;
    const zA = a[1] + low * dz, zB = a[1] + high * dz;
    const y0 = Math.max(ty0, host.y0), y1 = Math.min(ty1, host.y1);
    const z0 = Math.max(tz0, Math.min(zA, zB)), z1 = Math.min(tz1, Math.max(zA, zB));
    if (y1 <= y0 || z1 <= z0) continue;
    const epsilon = roofDetailFloatTolerance(roofDetailMassObb(host.mass, 0), roofDetailMassObb(host.mass, 0));
    const inwardA: RetainedSupportPoint = [a[0] - side * epsilon, a[1]];
    const inwardB: RetainedSupportPoint = [b[0] - side * epsilon, b[1]];
    const blockers: { y0: number; y1: number; z0: number; z1: number }[] = [];
    for (let otherIndex = 0; otherIndex < bucket.masses.length; otherIndex += 1) {
      if (otherIndex === index) continue;
      const other = bucket.masses[otherIndex]!;
      const clipped = clipFootprintEdge(polygons[otherIndex]!, inwardA, inwardB, side * dz > 0);
      if (clipped.length < 3 || retainedSupportArea(clipped) <= 1e-10) continue;
      const by0 = Math.max(y0, other.y0), by1 = Math.min(y1, other.y1);
      const bz0 = Math.max(z0, Math.min(...clipped.map(point => point[1])));
      const bz1 = Math.min(z1, Math.max(...clipped.map(point => point[1])));
      if (by1 > by0 && bz1 > bz0) blockers.push({ y0: by0, y1: by1, z0: bz0, z1: bz1 });
    }
    const area = Math.max(0, (y1 - y0) * (z1 - z0) - computeClippedUnionAreaYZ(blockers))
      * Math.hypot(dx, dz) / Math.abs(dz);
    if (area > threshold && area > bestArea) { bestArea = area; bestMassIndex = host.massIndex; }
  }
  return { supported: bestMassIndex >= 0, bestMassIndex, exposedAreaM2: Math.max(0, bestArea) };
}

function reconcileLegacyTrimsD1(
  layout: SkyriverCityLayout,
  trims: SkyriverCityTrims,
  sourceCount: number,
  r27StartIndex: number,
  r27EndIndex: number,
  faces: readonly SkyriverFacadeFace[],
  masses: readonly SkyriverMass[],
  heroes: readonly SkyriverHeroBlade[],
  finalOwners:SkyriverTrimOwner[],
): SkyriverLegacyTrimReconciliation {
  const seed = layout.seed;
  const { cx, cy, cz, sx, sy, sz, kind, seedValue, spanTo }= trims;
  const owner=finalOwners;

  const sourceInventory: SkyriverLegacyTrimSourceRecord[] = new Array(sourceCount);
  const ownerJson: string[] = new Array(sourceCount);
  const spanToJson: (string | null)[] = new Array(sourceCount);

  for (let i = 0; i < sourceCount; i += 1) {
    const ow = owner[i]!;
    const sp = spanTo[i] ?? null;
    identityScratch.setFloat32(0, seedValue[i]!, true);
    const seedBits = identityScratch.getUint32(0, true);
    const canonicalOwner = ow.materialOwner ?? buildingSeedOf(ow.x, ow.z);

    const ownerSnapshot: SkyriverTrimOwner = Object.freeze({
      x: ow.x,
      z: ow.z,
      width: ow.width,
      depth: ow.depth,
      anchorV: ow.anchorV,
      ...(ow.materialOwner !== undefined ? { materialOwner: ow.materialOwner } : {}),
    });
    const spanToSnapshot: SkyriverTrimOwner | null = sp !== null ? Object.freeze({
      x: sp.x,
      z: sp.z,
      width: sp.width,
      depth: sp.depth,
      anchorV: sp.anchorV,
      ...(sp.materialOwner !== undefined ? { materialOwner: sp.materialOwner } : {}),
    }) : null;

    sourceInventory[i] = Object.freeze({
      sourceIndex: i,
      kind: kind[i]!,
      cx: cx[i]!,
      cy: cy[i]!,
      cz: cz[i]!,
      sx: sx[i]!,
      sy: sy[i]!,
      sz: sz[i]!,
      seedValue: seedValue[i]!,
      seedBits,
      canonicalOwner,
      owner: ownerSnapshot,
      spanTo: spanToSnapshot,
    });
    ownerJson[i] = JSON.stringify(ow);
    spanToJson[i] = sp !== null ? JSON.stringify(sp) : null;
  }
  Object.freeze(sourceInventory);

  let h = 0x811c9dc5;
  h = hashNumbers(h, cx.subarray(0, sourceCount));
  h = hashNumbers(h, cy.subarray(0, sourceCount));
  h = hashNumbers(h, cz.subarray(0, sourceCount));
  h = hashNumbers(h, sx.subarray(0, sourceCount));
  h = hashNumbers(h, sy.subarray(0, sourceCount));
  h = hashNumbers(h, sz.subarray(0, sourceCount));
  h = hashNumbers(h, kind.subarray(0, sourceCount));
  h = hashNumbers(h, seedValue.subarray(0, sourceCount));
  h = hashText(h, ownerJson);
  h = hashText(h, spanToJson);
  const inventoryIdentity = hex32(h);

  const hostIndex = new Map<string, HostBucket>();
  const getHostBucket = (canonicalOwner: number, anchorV: number): HostBucket => {
    const key = hostIndexKey(canonicalOwner, anchorV);
    let bucket = hostIndex.get(key);
    if (bucket === undefined) {
      bucket = { faces: [], masses: [] };
      hostIndex.set(key, bucket);
    }
    return bucket;
  };

  for (let massIndex = 0; massIndex < masses.length; massIndex += 1) {
    const m = masses[massIndex]!;
    if (m.width <= 0 || m.height <= 0 || m.depth <= 0) continue;
    const mOwner = m.materialOwner ?? m.building ?? buildingSeedOf(m.x, m.z);
    const mAnchorV = m.anchorV ?? m.z;
    const bucket = getHostBucket(mOwner, mAnchorV);
    bucket.masses.push({
      mass: m,
      massIndex,
      x0: m.x - m.width * 0.5,
      x1: m.x + m.width * 0.5,
      y0: m.y0,
      y1: m.y0 + m.height,
      z0: m.z - m.depth * 0.5,
      z1: m.z + m.depth * 0.5,
    });
  }

  for (const face of faces) {
    if (face.planeAxis !== 'x') continue;
    const fOwner = face.owner.materialOwner ?? buildingSeedOf(face.owner.x, face.owner.z);
    const fAnchorV = face.owner.anchorV;
    const bucket = getHostBucket(fOwner, fAnchorV);
    bucket.faces.push(face);
  }

  const dispositions: SkyriverTrimDisposition[] = new Array(sourceCount);
  let unchangedCount = 0;
  let rehostedCount = 0;
  let roofRowsDeferred = 0;
  let spanRowsDeferred = 0;
  const towerAnchorBySeed = new Map<number, Set<number>>();
  for (const t of layout.towers) {
    const seed = buildingSeedOf(t.x, t.z);
    let anchors = towerAnchorBySeed.get(seed);
    if (anchors === undefined) {
      anchors = new Set<number>();
      towerAnchorBySeed.set(seed, anchors);
    }
    anchors.add(t.z);
  }

  for (let i = 0; i < sourceCount; i += 1) {
    const k = kind[i]!;
    const ocx = cx[i]!;
    const ocy = cy[i]!;
    const ocz = cz[i]!;
    const osx = sx[i]!;
    const osy = sy[i]!;
    const osz = sz[i]!;
    const ow = owner[i]!;
    const sp = spanTo[i] ?? null;
    const oldGeom = Object.freeze({ cx: ocx, cy: ocy, cz: ocz, sx: osx, sy: osy, sz: osz });

    const isRoof = k === SKYRIVER_TRIM_ANTENNA || k === SKYRIVER_TRIM_ROOF_PLANT;
    const isSpan = sp !== null || k === SKYRIVER_TRIM_GANTRY || k === SKYRIVER_TRIM_SKYBRIDGE;
    if (isRoof) roofRowsDeferred += 1;
    if (isSpan) spanRowsDeferred += 1;

    const isR27 = i >= r27StartIndex && i < r27EndIndex;
    const isSideKind = k === SKYRIVER_TRIM_RIB || k === SKYRIVER_TRIM_BAND || k === SKYRIVER_TRIM_CANTILEVER;
    const canonicalOwner = ow.materialOwner ?? buildingSeedOf(ow.x, ow.z);
    const isOrdinaryTower = towerAnchorBySeed.get(canonicalOwner)?.has(ow.anchorV) === true;

    const isHeroFiltered = skyriverTrimBlocksHero(trims, i, heroes);
    let blockingHeroIds: readonly string[] = Object.freeze([]);
    if (isHeroFiltered) {
      const ids: string[] = [];
      if (isSideKind) {
        for (const hero of heroes) {
          const hx = hero.kind === 'blade' ? hero.width * 0.5 + 14 : 16;
          const hz = hero.kind === 'blade' ? 14 : hero.width * 0.5 + 14;
          if (Math.abs(ocx - hero.x) < hx + osx * 0.5
            && Math.abs(ocy - hero.y) < hero.height * 0.5 + 18 + osy * 0.5
            && Math.abs(ocz - hero.z) < hz + osz * 0.5) {
            ids.push(`${hero.kind}:${hero.cell}:${hero.buildingId}:${hero.faceId}:${hero.compositionId}`);
          }
        }
      }
      blockingHeroIds = Object.freeze(ids);
    }

    if (isRoof || isSpan || isR27 || !isSideKind || !isOrdinaryTower || isHeroFiltered) {
      dispositions[i] = Object.freeze({
        kind: 'unchanged',
        sourceIndex: i,
        finalIndex: i,
        heroFiltered: isHeroFiltered,
        blockingHeroIds,
        oldGeometry: oldGeom,
        newGeometry: oldGeom,
      });
      unchangedCount += 1;
      continue;
    }

    const trimAnchorV = ow.anchorV;
    const bucket = hostIndex.get(hostIndexKey(canonicalOwner, trimAnchorV));

    let alreadySupported = false;
    if (bucket !== undefined) {
      const sup = checkTrimSupportWithBucket(ocx, ocy, ocz, osx, osy, osz, ow, bucket);
      if (sup.supported) {
        alreadySupported = true;
      }
    }

    if (alreadySupported) {
      dispositions[i] = Object.freeze({
        kind: 'unchanged',
        sourceIndex: i,
        finalIndex: i,
        heroFiltered: false,
        blockingHeroIds: Object.freeze([]),
        oldGeometry: oldGeom,
        newGeometry: oldGeom,
      });
      unchangedCount += 1;
      continue;
    }

    if (bucket === undefined || bucket.faces.length === 0) {
      fail(`SKYRIVER_SIDE_TRIM_HOST_MISSING: seed ${seed} trim ${i}`);
    }

    const cands: { readonly face: SkyriverFacadeFace; readonly faceIndex: number; readonly distSq: number }[] = [];
    for (let fIdx = 0; fIdx < bucket.faces.length; fIdx += 1) {
      const f = bucket.faces[fIdx]!;
      if (f.side !== (ocx >= 0 ? 1 : -1)) continue;

      const dx = ocx - f.plane;
      const dy = ocy - Math.max(f.y0, Math.min(f.y1, ocy));
      const dz = ocz - Math.max(f.u0, Math.min(f.u1, ocz));
      cands.push({ face: f, faceIndex: fIdx, distSq: dx * dx + dy * dy + dz * dz });
    }
    cands.sort((a, b) => a.distSq !== b.distSq ? a.distSq - b.distSq : a.faceIndex - b.faceIndex);

    let chosen: {
      readonly fcx: number; readonly fcy: number; readonly fcz: number;
      readonly fsx: number; readonly fsy: number; readonly fsz: number;
      readonly hostMassIndex: number; readonly faceId: string;
    } | null = null;

    for (const cand of cands) {
      const f = cand.face;
      const touchingMasses = bucket.masses.filter((m) => massTouchesFacePlane(m, f));
      if (touchingMasses.length === 0) continue;

      for (const m of touchingMasses) {
        const clipZ0 = Math.max(f.u0, ow.z - ow.depth * 0.5, m.z0);
        const clipZ1 = Math.min(f.u1, ow.z + ow.depth * 0.5, m.z1);
        const clipY0 = Math.max(f.y0, m.y0);
        const clipY1 = Math.min(f.y1, m.y1);
        if (clipZ1 <= clipZ0 + 1.0 || clipY1 <= clipY0 + 1.0) continue;

        const nsx = osx;
        const ncx = f.plane - f.outward * (1.0 - nsx * 0.5);
        let ncy: number;
        let nsy: number;
        let ncz: number;
        let nsz: number;

        if (k === SKYRIVER_TRIM_RIB) {
          const ribZ0 = Math.max(f.u0 + 2.02, m.z0 + 2.02, ow.z - ow.depth * 0.5);
          const ribZ1 = Math.min(f.u1 - 2.02, m.z1 - 2.02, ow.z + ow.depth * 0.5);
          if (ribZ1 - ribZ0 < 1.0) continue;
          nsz = Math.min(osz, ribZ1 - ribZ0);
          ncz = Math.max(ribZ0 + nsz * 0.5, Math.min(ribZ1 - nsz * 0.5, ocz));

          const y0 = Math.max(clipY0, Math.min(clipY1 - 1.0, ocy - osy * 0.5));
          const y1 = Math.min(clipY1, Math.max(clipY0 + 1.0, ocy + osy * 0.5));
          ncy = (y0 + y1) * 0.5;
          nsy = Math.max(1.0, y1 - y0);
        } else if (k === SKYRIVER_TRIM_BAND) {
          nsy = osy;
          ncy = clipY1 - clipY0 >= nsy
            ? Math.max(clipY0 + nsy * 0.5, Math.min(clipY1 - nsy * 0.5, ocy))
            : (clipY0 + clipY1) * 0.5;
          if (clipY1 - clipY0 < nsy) nsy = Math.max(1.0, clipY1 - clipY0);

          const overhangTotal = osy === 8 ? 4 : 3;
          const targetZSpan = (clipZ1 - clipZ0) + overhangTotal;
          nsz = Math.min(osz, targetZSpan);
          ncz = (clipZ0 + clipZ1) * 0.5;
        } else {
          nsy = osy;
          ncy = clipY1 - clipY0 >= nsy
            ? Math.max(clipY0 + nsy * 0.5, Math.min(clipY1 - nsy * 0.5, ocy))
            : (clipY0 + clipY1) * 0.5;
          if (clipY1 - clipY0 < nsy) nsy = Math.max(1.0, clipY1 - clipY0);

          nsz = osz;
          ncz = clipZ1 - clipZ0 >= nsz
            ? Math.max(clipZ0 + nsz * 0.5, Math.min(clipZ1 - nsz * 0.5, ocz))
            : (clipZ0 + clipZ1) * 0.5;
          if (clipZ1 - clipZ0 < nsz) nsz = Math.max(1.0, clipZ1 - clipZ0);
        }

        if (isCoveredByNearerFace(f, ncy - nsy * 0.5, ncy + nsy * 0.5, ncz - nsz * 0.5, ncz + nsz * 0.5, bucket.faces)) continue;

        const fcx = Math.fround(ncx);
        const fcy = Math.fround(ncy);
        const fcz = Math.fround(ncz);
        const fsx = Math.fround(nsx);
        const fsy = Math.fround(nsy);
        const fsz = Math.fround(nsz);

        if (!(fcx - fsx * 0.5 < f.plane - 1e-4 && fcx + fsx * 0.5 > f.plane + 1e-4)) continue;

        cx[i] = fcx;
        cy[i] = fcy;
        cz[i] = fcz;
        sx[i] = fsx;
        sy[i] = fsy;
        sz[i] = fsz;
        owner[i] = f.owner;
        const blocked = skyriverTrimBlocksHero(trims, i, heroes);
        owner[i] = ow;
        cx[i] = ocx;
        cy[i] = ocy;
        cz[i] = ocz;
        sx[i] = osx;
        sy[i] = osy;
        sz[i] = osz;
        if (blocked) continue;

        const sup = checkTrimSupportWithBucket(fcx, fcy, fcz, fsx, fsy, fsz, f.owner, bucket, m.massIndex);
        if (!sup.supported) continue;

        chosen = { fcx, fcy, fcz, fsx, fsy, fsz, hostMassIndex: sup.bestMassIndex, faceId: f.id };
        break;
      }
      if (chosen !== null) break;
    }

    if (chosen === null) {
      fail(`SKYRIVER_SIDE_TRIM_HOST_MISSING: seed ${seed} trim ${i}`);
    }

    cx[i] = chosen.fcx;
    cy[i] = chosen.fcy;
    cz[i] = chosen.fcz;
    sx[i] = chosen.fsx;
    sy[i] = chosen.fsy;
    sz[i] = chosen.fsz;
    if (masses[chosen.hostMassIndex]!.yawRad !== undefined) owner[i] = ownerOf(masses[chosen.hostMassIndex]!,ow.anchorV);

    const newGeom = Object.freeze({
      cx: chosen.fcx, cy: chosen.fcy, cz: chosen.fcz,
      sx: chosen.fsx, sy: chosen.fsy, sz: chosen.fsz,
    });
    dispositions[i] = Object.freeze({
      kind: 'side-rehosted',
      sourceIndex: i,
      finalIndex: i,
      heroFiltered: false,
      blockingHeroIds: Object.freeze([]),
      oldGeometry: oldGeom,
      newGeometry: newGeom,
      hostMassIndex: chosen.hostMassIndex,
      faceId: chosen.faceId,
    });
    rehostedCount += 1;
  }

  return Object.freeze({
    seed,
    sourceCount,
    finalCount: sourceCount,
    inventoryIdentity,
    sourceInventory,
    dispositions: Object.freeze(dispositions),
    unchangedCount,
    rehostedCount,
    roofRowsDeferred,
    spanRowsDeferred,
  });
}

function roofDetailPrefixInsertCell(
  cells: Map<string, number[]>,
  rowId: number,
  box: RoofDetailObb,
  cellSize: number,
): void {
  const minX = Math.floor(box.minX / cellSize);
  const maxX = Math.floor(box.maxX / cellSize);
  const minZ = Math.floor(box.minZ / cellSize);
  const maxZ = Math.floor(box.maxZ / cellSize);
  for (let gx = minX; gx <= maxX; gx += 1) {
    for (let gz = minZ; gz <= maxZ; gz += 1) {
      const key = roofDetailCellKey(gx, gz);
      const bucket = cells.get(key);
      if (bucket === undefined) {
        cells.set(key, [rowId]);
      } else {
        bucket.push(rowId);
      }
    }
  }
}

function reconcileLegacyTrimsD2(
  layout: SkyriverCityLayout,
  trims: SkyriverCityTrims,
  sourceCount: number,
  r27StartIndex: number,
  r27EndIndex: number,
  legacyWorld: readonly SkyriverMass[],
  masses: readonly SkyriverMass[],
  heroes: readonly SkyriverHeroBlade[],
  wingAirIndex: RoofDetailCollisionIndex,
  acceptedNotches: ReadonlyMap<string, RoofDetailObb>,
  notchAuditIndex: RoofDetailCollisionIndex,
  reconciliationD1: SkyriverLegacyTrimReconciliation,
  finalOwners:SkyriverTrimOwner[],
): SkyriverLegacyTrimReconciliation {
  const seed = layout.seed;
  const { cx, cy, cz, sx, sy, sz, kind, owner, spanTo } = trims;
  const sourceInventory = reconciliationD1.sourceInventory;

  const towerAnchorBySeed = new Map<number, Set<number>>();
  const towerByKey = new Map<string, { seed: number; anchorV: number }>();
  for (const t of layout.towers) {
    const s = buildingSeedOf(t.x, t.z);
    let anchors = towerAnchorBySeed.get(s);
    if (anchors === undefined) {
      anchors = new Set<number>();
      towerAnchorBySeed.set(s, anchors);
    }
    anchors.add(t.z);
    towerByKey.set(towerKey(t), { seed: s, anchorV: t.z });
  }

  const getMassOwnerSeed = (m: SkyriverMass): number => {
    if (m.materialOwner !== undefined) return m.materialOwner;
    if (m.building !== undefined) return m.building;
    if (m.baseRecord !== undefined) {
      const t = towerByKey.get(m.baseRecord.towerOwner);
      if (t !== undefined) return t.seed;
    }
    return buildingSeedOf(m.x, m.z);
  };

  const getMassAnchorV = (m: SkyriverMass): number => {
    if (m.anchorV !== undefined) return m.anchorV;
    if (m.baseRecord !== undefined) {
      const t = towerByKey.get(m.baseRecord.towerOwner);
      if (t !== undefined) return t.anchorV;
    }
    return m.z;
  };

  const float32Ulp = (value: number): number => {
    const absolute = Math.abs(value);
    if (absolute === 0) return 2 ** -149;
    return 2 ** (Math.floor(Math.log2(absolute)) - 23);
  };

  const float32Tol = (a: number, b: number): number => {
    return Math.max(float32Ulp(a), float32Ulp(b)) * 2;
  };

  type SupportEntry = { mass: SkyriverMass; massIndex: number };

  const checkRoofSupport = (
    px: number, py: number, pz: number,
    psx: number, psy: number, psz: number,
    hosts: readonly SupportEntry[] | undefined,
  ): boolean => {
    if (hosts === undefined) return false;
    for (let massIndex = 0; massIndex < hosts.length; massIndex += 1) {
      const m = hosts[massIndex]!.mass;
      if (m.width <= 0 || m.height <= 0 || m.depth <= 0) continue;

      const roofY = m.y0 + m.height;
      const bottomY = py - psy * 0.5;
      if (Math.abs(bottomY - roofY) > float32Tol(bottomY, roofY)) continue;

      const px0 = px - psx * 0.5;
      const px1 = px + psx * 0.5;
      const mx0 = m.x - m.width * 0.5;
      const mx1 = m.x + m.width * 0.5;
      if (px0 < mx0 - float32Tol(px0, mx0) || px1 > mx1 + float32Tol(px1, mx1)) continue;

      const pz0 = pz - psz * 0.5;
      const pz1 = pz + psz * 0.5;
      const mz0 = m.z - m.depth * 0.5;
      const mz1 = m.z + m.depth * 0.5;
      if (pz0 < mz0 - float32Tol(pz0, mz0) || pz1 > mz1 + float32Tol(pz1, mz1)) continue;

      return true;
    }
    return false;
  };

  const baselineHostsByKey = new Map<string, SupportEntry[]>();
  for (let massIndex = 0; massIndex < legacyWorld.length; massIndex += 1) {
    const m = legacyWorld[massIndex]!;
    if (m.width <= 0 || m.height <= 0 || m.depth <= 0) continue;
    const mOwner = getMassOwnerSeed(m);
    const mAnchor = getMassAnchorV(m);
    const key = hostIndexKey(mOwner, mAnchor);
    let list = baselineHostsByKey.get(key);
    if (list === undefined) {
      list = [];
      baselineHostsByKey.set(key, list);
    }
    list.push({ mass: m, massIndex });
  }

  const candidateHostsByKey = new Map<string, SupportEntry[]>();
  for (let massIndex = 0; massIndex < masses.length; massIndex += 1) {
    const m = masses[massIndex]!;
    if (m.artBacking !== undefined || m.width <= 0 || m.height <= 0 || m.depth <= 0) continue;
    const mOwner = getMassOwnerSeed(m);
    const mAnchor = getMassAnchorV(m);
    const key = hostIndexKey(mOwner, mAnchor);
    let list = candidateHostsByKey.get(key);
    if (list === undefined) {
      list = [];
      candidateHostsByKey.set(key, list);
    }
    list.push({ mass: m, massIndex });
  }

  const heroBoxes = roofDetailHeroBoxCache.get(layout.seed) ?? roofDetailHeroObbs(layout, heroes);
  const cellSize = ROOF_DETAIL_SPATIAL_CELL_M;
  const currentObbs: (RoofDetailObb | null)[] = new Array(sourceCount);
  const prefixCells = new Map<string, number[]>();

  for (let j = 0; j < sourceCount; j += 1) {
    const disp = reconciliationD1.dispositions[j]!;
    if (disp.heroFiltered) {
      currentObbs[j] = null;
      continue;
    }
    currentObbs[j] = roofDetailTrimObb(trims, j);
    roofDetailPrefixInsertCell(prefixCells, j, currentObbs[j]!, cellSize);
  }

  const stamps = new Int32Array(sourceCount);
  let currentStamp = 0;

  const checkPrefixConflict = (candObb: RoofDetailObb, rowId: number): boolean => {
    currentStamp += 1;
    if (currentStamp >= 0x7ffffffe) {
      stamps.fill(0);
      currentStamp = 1;
    }
    const stamp = currentStamp;

    const minX = Math.floor(candObb.minX / cellSize);
    const maxX = Math.floor(candObb.maxX / cellSize);
    const minZ = Math.floor(candObb.minZ / cellSize);
    const maxZ = Math.floor(candObb.maxZ / cellSize);

    for (let gx = minX; gx <= maxX; gx += 1) {
      for (let gz = minZ; gz <= maxZ; gz += 1) {
        const bucket = prefixCells.get(roofDetailCellKey(gx, gz));
        if (bucket === undefined) continue;
        for (let idx = 0; idx < bucket.length; idx += 1) {
          const otherId = bucket[idx]!;
          if (otherId === rowId) continue;
          if (stamps[otherId] === stamp) continue;
          stamps[otherId] = stamp;

          const otherObb = currentObbs[otherId];
          if (otherObb === null) continue;

          if (roofDetailObbsConflict(candObb, otherObb, 0)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  interface CandidateRecord {
    readonly scale: number;
    readonly distSq: number;
    readonly hostMassIndex: number;
    readonly pointOrder: number;
    readonly cx: number;
    readonly cy: number;
    readonly cz: number;
    readonly sx: number;
    readonly sy: number;
    readonly sz: number;
    readonly obb: RoofDetailObb;
  }

  const testHostAtScale = (
    mEntry: { mass: SkyriverMass; massIndex: number },
    scale: number,
    sourceCx: number,
    sourceCy: number,
    sourceCz: number,
    origSx: number,
    origSy: number,
    origSz: number,
    anchorV: number,
    rowId: number,
    accepted: CandidateRecord[],
    rejections: {
      support: number;
      solid: number;
      hero: number;
      wingAir: number;
      notch: number;
      prefix: number;
    },
  ): void => {
    const m = mEntry.mass;
    const fsx = Math.fround(origSx * scale);
    const fsz = Math.fround(origSz * scale);

    const mx0 = m.x - m.width * 0.5;
    const mx1 = m.x + m.width * 0.5;
    const mz0 = m.z - m.depth * 0.5;
    const mz1 = m.z + m.depth * 0.5;

    let minCx = mx0 + fsx * 0.5;
    let maxCx = mx1 - fsx * 0.5;
    let minCz = mz0 + fsz * 0.5;
    let maxCz = mz1 - fsz * 0.5;

    if (minCx > maxCx + 1e-4 || minCz > maxCz + 1e-4) return;
    if (minCx > maxCx) minCx = maxCx = (minCx + maxCx) * 0.5;
    if (minCz > maxCz) minCz = maxCz = (minCz + maxCz) * 0.5;

    const midCx = (minCx + maxCx) * 0.5;
    const midCz = (minCz + maxCz) * 0.5;
    const clampedX = Math.max(minCx, Math.min(maxCx, sourceCx));
    const clampedZ = Math.max(minCz, Math.min(maxCz, sourceCz));

    const points: [number, number][] = [
      [clampedX, clampedZ],
      [midCx, midCz],
      [minCx, minCz],
      [maxCx, minCz],
      [minCx, maxCz],
      [maxCx, maxCz],
      [midCx, minCz],
      [midCx, maxCz],
      [minCx, midCz],
      [maxCx, midCz],
    ];

    const seenPoints = new Set<string>();
    for (let ptIdx = 0; ptIdx < points.length; ptIdx += 1) {
      const [ptX, ptZ] = points[ptIdx]!;
      const fcx = Math.fround(ptX);
      const fcz = Math.fround(ptZ);
      const ptKey = `${fcx}:${fcz}`;
      if (seenPoints.has(ptKey)) continue;
      seenPoints.add(ptKey);

      const fsy = Math.fround(origSy);
      const roofY = m.y0 + m.height;
      const fcy = Math.fround(roofY + fsy * 0.5);

      const px0 = fcx - fsx * 0.5;
      const px1 = fcx + fsx * 0.5;
      if (px0 < mx0 - float32Tol(px0, mx0) || px1 > mx1 + float32Tol(px1, mx1)) {
        rejections.support += 1;
        continue;
      }

      const pz0 = fcz - fsz * 0.5;
      const pz1 = fcz + fsz * 0.5;
      if (pz0 < mz0 - float32Tol(pz0, mz0) || pz1 > mz1 + float32Tol(pz1, mz1)) {
        rejections.support += 1;
        continue;
      }

      const bottomY = fcy - fsy * 0.5;
      if (Math.abs(bottomY - roofY) > float32Tol(bottomY, roofY)) {
        rejections.support += 1;
        continue;
      }

      const candObb = roofDetailMakeCandidateObb(fcx, fcy, fcz, fsx, fsy, fsz, anchorV,ownerOf(m,anchorV));
      if (roofDetailIndexConflicts(notchAuditIndex, candObb, 0, mEntry.massIndex)) {
        rejections.solid += 1;
        continue;
      }
      if (roofDetailBlocksHero(candObb, heroBoxes)) {
        rejections.hero += 1;
        continue;
      }
      if (roofDetailIndexConflicts(wingAirIndex, candObb, 0)) {
        rejections.wingAir += 1;
        continue;
      }

      let notchBlocked = false;
      for (const notchObb of acceptedNotches.values()) {
        if (roofDetailObbsConflict(candObb, notchObb, 0)) {
          notchBlocked = true;
          break;
        }
      }
      if (notchBlocked) {
        rejections.notch += 1;
        continue;
      }

      if (checkPrefixConflict(candObb, rowId)) {
        rejections.prefix += 1;
        continue;
      }

      const distSq = (fcx - sourceCx) ** 2 + (fcy - sourceCy) ** 2 + (fcz - sourceCz) ** 2;
      accepted.push({
        scale,
        distSq,
        hostMassIndex: mEntry.massIndex,
        pointOrder: ptIdx,
        cx: fcx,
        cy: fcy,
        cz: fcz,
        sx: fsx,
        sy: fsy,
        sz: fsz,
        obb: candObb,
      });
    }
  };

  const dispositions: SkyriverTrimDisposition[] = new Array(sourceCount);
  let unchangedCount = 0;
  let rehostedCount = 0;

  for (let i = 0; i < sourceCount; i += 1) {
    const k = kind[i]!;
    const ow = owner[i]!;
    const sp = spanTo[i] ?? null;
    const isRoof = (k === SKYRIVER_TRIM_ANTENNA || k === SKYRIVER_TRIM_ROOF_PLANT) && sp === null;
    const isR27 = i >= r27StartIndex && i < r27EndIndex;
    const canonicalOwner = ow.materialOwner ?? buildingSeedOf(ow.x, ow.z);
    const isOrdinaryTower = towerAnchorBySeed.get(canonicalOwner)?.has(ow.anchorV) === true;
    const isOrdinaryRoof = isRoof && !isR27 && isOrdinaryTower;

    if (!isOrdinaryRoof) {
      const prevDisp = reconciliationD1.dispositions[i]!;
      dispositions[i] = prevDisp;
      if (prevDisp.kind === 'side-rehosted') {
        rehostedCount += 1;
      } else {
        unchangedCount += 1;
      }
      continue;
    }

    const src = sourceInventory[i]!;
    const ocx = src.cx;
    const ocy = src.cy;
    const ocz = src.cz;
    const osx = src.sx;
    const osy = src.sy;
    const osz = src.sz;
    const oldGeom = Object.freeze({ cx: ocx, cy: ocy, cz: ocz, sx: osx, sy: osy, sz: osz });

    const hostKey = hostIndexKey(canonicalOwner, ow.anchorV);
    const supportedInBaseline = checkRoofSupport(
      ocx, ocy, ocz, osx, osy, osz, baselineHostsByKey.get(hostKey),
    );

    if (!supportedInBaseline) {
      dispositions[i] = Object.freeze({
        kind: 'inherited-roof-unsupported',
        sourceIndex: i,
        finalIndex: i,
        heroFiltered: false,
        blockingHeroIds: Object.freeze([]),
        oldGeometry: oldGeom,
        newGeometry: oldGeom,
      });
      unchangedCount += 1;
      continue;
    }

    const candidateHosts = candidateHostsByKey.get(hostKey) ?? [];
    const supportedInFinal = checkRoofSupport(
      ocx, ocy, ocz, osx, osy, osz, candidateHosts,
    );

    if (supportedInFinal) {
      dispositions[i] = Object.freeze({
        kind: 'unchanged',
        sourceIndex: i,
        finalIndex: i,
        heroFiltered: false,
        blockingHeroIds: Object.freeze([]),
        oldGeometry: oldGeom,
        newGeometry: oldGeom,
      });
      unchangedCount += 1;
      continue;
    }

    let chosen: CandidateRecord | null = null;
    const rejections = {
      support: 0,
      solid: 0,
      hero: 0,
      wingAir: 0,
      notch: 0,
      prefix: 0,
    };

    const fullSizeAccepted: CandidateRecord[] = [];
    for (let hIdx = 0; hIdx < candidateHosts.length; hIdx += 1) {
      testHostAtScale(
        candidateHosts[hIdx]!, 1.0, ocx, ocy, ocz, osx, osy, osz, ow.anchorV, i, fullSizeAccepted, rejections,
      );
    }

    if (fullSizeAccepted.length > 0) {
      fullSizeAccepted.sort((a, b) => {
        if (Math.abs(a.distSq - b.distSq) > 1e-6) return a.distSq - b.distSq;
        if (a.hostMassIndex !== b.hostMassIndex) return a.hostMassIndex - b.hostMassIndex;
        return a.pointOrder - b.pointOrder;
      });
      chosen = fullSizeAccepted[0]!;
    } else {
      const scaleFractions = [1.0, 0.9, 0.75, 0.5, 0.25, 0.1];
      const scaledAccepted: CandidateRecord[] = [];
      for (let hIdx = 0; hIdx < candidateHosts.length; hIdx += 1) {
        const mEntry = candidateHosts[hIdx]!;
        const m = mEntry.mass;
        const fitScale = Math.min(1.0, m.width / osx, m.depth / osz);
        if (fitScale <= 0) continue;
        const fractions = fitScale < 1.0 - 1e-6 ? scaleFractions : [0.9, 0.75, 0.5, 0.25, 0.1];
        for (let fIdx = 0; fIdx < fractions.length; fIdx += 1) {
          const s = fitScale * fractions[fIdx]!;
          testHostAtScale(
            mEntry, s, ocx, ocy, ocz, osx, osy, osz, ow.anchorV, i, scaledAccepted, rejections,
          );
        }
      }

      if (scaledAccepted.length > 0) {
        scaledAccepted.sort((a, b) => {
          if (Math.abs(a.scale - b.scale) > 1e-6) return b.scale - a.scale;
          if (Math.abs(a.distSq - b.distSq) > 1e-6) return a.distSq - b.distSq;
          if (a.hostMassIndex !== b.hostMassIndex) return a.hostMassIndex - b.hostMassIndex;
          return a.pointOrder - b.pointOrder;
        });
        chosen = scaledAccepted[0]!;
      }
    }

    if (chosen === null) {
      fail(
        `SKYRIVER_ROOF_TRIM_HOST_MISSING: seed ${seed} trim ${i}, hosts: ${candidateHosts.length}, ` +
          `support: ${rejections.support}, solid: ${rejections.solid}, hero: ${rejections.hero}, ` +
          `wing air: ${rejections.wingAir}, notch: ${rejections.notch}, prefix: ${rejections.prefix}`,
      );
    }

    cx[i] = chosen.cx;
    cy[i] = chosen.cy;
    cz[i] = chosen.cz;
    sx[i] = chosen.sx;
    sy[i] = chosen.sy;
    sz[i] = chosen.sz;
    if (masses[chosen.hostMassIndex]!.yawRad !== undefined) finalOwners[i] = ownerOf(masses[chosen.hostMassIndex]!,ow.anchorV);

    currentObbs[i] = chosen.obb;
    roofDetailPrefixInsertCell(prefixCells, i, chosen.obb, cellSize);

    const newGeom = Object.freeze({
      cx: chosen.cx,
      cy: chosen.cy,
      cz: chosen.cz,
      sx: chosen.sx,
      sy: chosen.sy,
      sz: chosen.sz,
    });

    dispositions[i] = Object.freeze({
      kind: 'roof-rehosted',
      sourceIndex: i,
      finalIndex: i,
      heroFiltered: false,
      blockingHeroIds: Object.freeze([]),
      oldGeometry: oldGeom,
      newGeometry: newGeom,
      hostMassIndex: chosen.hostMassIndex,
      horizontalScale: chosen.scale,
    });
    rehostedCount += 1;
  }

  return Object.freeze({
    seed,
    sourceCount,
    finalCount: sourceCount,
    inventoryIdentity: reconciliationD1.inventoryIdentity,
    sourceInventory,
    dispositions: Object.freeze(dispositions),
    unchangedCount,
    rehostedCount,
    roofRowsDeferred: 0,
    spanRowsDeferred: reconciliationD1.spanRowsDeferred,
  });
}

function chordExposedLength(
  first: { readonly x: number; readonly y: number; readonly z: number },
  second: { readonly x: number; readonly y: number; readonly z: number },
  chordLength: number,
  boxes: readonly RoofDetailObb[],
): number {
  if (chordLength <= 1e-6) return 0;
  const x0 = first.x, z0 = first.z, y = first.y;
  const dx = second.x - x0, dz = second.z - z0;
  const minX = Math.min(x0, second.x), maxX = Math.max(x0, second.x);
  const minZ = Math.min(z0, second.z), maxZ = Math.max(z0, second.z);
  const intervals: [number, number][] = [];
  for (const b of boxes) {
    if (b.maxX < minX || b.minX > maxX || b.maxZ < minZ || b.minZ > maxZ) continue;
    const roofY = b.y + b.halfY;
    const bottomY = b.y - b.halfY;
    if (y >= roofY || y <= bottomY) continue;

    const p0 = (x0 - b.x) * b.ux + (z0 - b.z) * b.uz;
    const p1 = (x0 - b.x) * b.vx + (z0 - b.z) * b.vz;
    const v0 = dx * b.ux + dz * b.uz;
    const v1 = dx * b.vx + dz * b.vz;
    const h0 = b.halfX;
    const h1 = b.halfZ;

    let lo = 0;
    let hi = 1;
    let missed = false;

    if (Math.abs(v0) < 1e-12) {
      if (Math.abs(p0) >= h0) missed = true;
    } else {
      const t0 = (-h0 - p0) / v0;
      const t1 = (h0 - p0) / v0;
      lo = Math.max(lo, Math.min(t0, t1));
      hi = Math.min(hi, Math.max(t0, t1));
    }

    if (!missed) {
      if (Math.abs(v1) < 1e-12) {
        if (Math.abs(p1) >= h1) missed = true;
      } else {
        const t0 = (-h1 - p1) / v1;
        const t1 = (h1 - p1) / v1;
        lo = Math.max(lo, Math.min(t0, t1));
        hi = Math.min(hi, Math.max(t0, t1));
      }
    }

    if (!missed && hi > lo + 1e-9) {
      intervals.push([lo, hi]);
    }
  }
  if (intervals.length === 0) {
    return chordLength;
  }

  intervals.sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let curLo = intervals[0]![0];
  let curHi = intervals[0]![1];

  for (let i = 1; i < intervals.length; i += 1) {
    const r = intervals[i]!;
    if (r[0] <= curHi) {
      curHi = Math.max(curHi, r[1]);
    } else {
      covered += curHi - curLo;
      curLo = r[0];
      curHi = r[1];
    }
  }
  covered += curHi - curLo;

  const coveredFraction = Math.min(1, Math.max(0, covered));
  return Math.max(0, (1 - coveredFraction) * chordLength);
}

function reconcileLegacyTrimsD3(
  layout: SkyriverCityLayout,
  trims: SkyriverCityTrims,
  sourceCount: number,
  r27StartIndex: number,
  r27EndIndex: number,
  legacyWorld: readonly SkyriverMass[],
  masses: SkyriverMass[],
  heroes: readonly SkyriverHeroBlade[],
  wingAirIndex: RoofDetailCollisionIndex,
  acceptedNotches: ReadonlyMap<string, RoofDetailObb>,
  reconciliationD2: SkyriverLegacyTrimReconciliation,
  approvedMasses:ReadonlyMap<SkyriverMass,SkyriverMass>,
  routeBlocked:(box:RoofDetailObb)=>boolean,
): SkyriverLegacyTrimReconciliation {
  const seed = layout.seed;
  const { cx, cy, cz, sx, sy, sz, kind, seedValue, owner, spanTo } = trims;
  const sourceInventory = reconciliationD2.sourceInventory;

  const spanPlacementEndpoints = (
    placement: SkyriverTrimPlacement,
    sx: number,
    sz: number,
  ): readonly [{ readonly x: number; readonly z: number }, { readonly x: number; readonly z: number }] => {
    const along = sz >= sx;
    const ux = along ? Math.sin(placement.heading) : Math.cos(placement.heading);
    const uz = along ? Math.cos(placement.heading) : -Math.sin(placement.heading);
    const halfLength = placement.length * 0.5;
    return [
      { x: placement.x - halfLength * ux, z: placement.z - halfLength * uz },
      { x: placement.x + halfLength * ux, z: placement.z + halfLength * uz },
    ];
  };

  const towerAnchorBySeed = new Map<number, Set<number>>();
  const towerByKey = new Map<string, { seed: number; anchorV: number }>();
  for (const t of layout.towers) {
    const s = buildingSeedOf(t.x, t.z);
    let anchors = towerAnchorBySeed.get(s);
    if (anchors === undefined) {
      anchors = new Set<number>();
      towerAnchorBySeed.set(s, anchors);
    }
    anchors.add(t.z);
    towerByKey.set(towerKey(t), { seed: s, anchorV: t.z });
  }

  const getMassOwnerSeed = (m: SkyriverMass): number => {
    if (m.materialOwner !== undefined) return m.materialOwner;
    if (m.building !== undefined) return m.building;
    if (m.baseRecord !== undefined) {
      const t = towerByKey.get(m.baseRecord.towerOwner);
      if (t !== undefined) return t.seed;
    }
    return buildingSeedOf(m.x, m.z);
  };

  const getMassAnchorV = (m: SkyriverMass): number => {
    if (m.anchorV !== undefined) return m.anchorV;
    if (m.baseRecord !== undefined) {
      const t = towerByKey.get(m.baseRecord.towerOwner);
      if (t !== undefined) return t.anchorV;
    }
    return m.z;
  };

  const checkSpanEndpointContact = (
    ex: number,
    ey: number,
    ez: number,
    ux: number,
    uz: number,
    crossHalf: number,
    halfY: number,
    hostObb: RoofDetailObb,
  ): { readonly contacts: boolean; readonly crossOverlapM: number; readonly verticalOverlapM: number } => {
    const tol = Math.max(hostObb.coordinateUlpM, roofDetailScalarUlp(ex), roofDetailScalarUlp(ey), roofDetailScalarUlp(ez)) * 2;

    const trimY0 = ey - halfY;
    const trimY1 = ey + halfY;
    const hostY0 = hostObb.y - hostObb.halfY;
    const hostY1 = hostObb.y + hostObb.halfY;
    const vertOverlap = Math.min(trimY1, hostY1) - Math.max(trimY0, hostY0);
    const vertTol = Math.max(roofDetailScalarUlp(ey), roofDetailScalarUlp(hostObb.y)) * 2;
    if (vertOverlap < -vertTol) {
      return { contacts: false, crossOverlapM: 0, verticalOverlapM: 0 };
    }

    const dx = ex - hostObb.x;
    const dz = ez - hostObb.z;
    const pU = dx * hostObb.ux + dz * hostObb.uz;
    const pV = dx * hostObb.vx + dz * hostObb.vz;
    const dU = ux * hostObb.ux + uz * hostObb.uz;
    const dV = ux * hostObb.vx + uz * hostObb.vz;

    let tMin = -crossHalf;
    let tMax = crossHalf;

    if (Math.abs(dU) < 1e-12) {
      if (Math.abs(pU) > hostObb.halfX + tol) {
        return { contacts: false, crossOverlapM: 0, verticalOverlapM: 0 };
      }
    } else {
      const t0 = (-hostObb.halfX - tol - pU) / dU;
      const t1 = (hostObb.halfX + tol - pU) / dU;
      tMin = Math.max(tMin, Math.min(t0, t1));
      tMax = Math.min(tMax, Math.max(t0, t1));
    }

    if (Math.abs(dV) < 1e-12) {
      if (Math.abs(pV) > hostObb.halfZ + tol) {
        return { contacts: false, crossOverlapM: 0, verticalOverlapM: 0 };
      }
    } else {
      const t0 = (-hostObb.halfZ - tol - pV) / dV;
      const t1 = (hostObb.halfZ + tol - pV) / dV;
      tMin = Math.max(tMin, Math.min(t0, t1));
      tMax = Math.min(tMax, Math.max(t0, t1));
    }

    if (tMax < tMin) {
      return { contacts: false, crossOverlapM: 0, verticalOverlapM: 0 };
    }

    let physMin = -crossHalf;
    let physMax = crossHalf;
    let physMissed = false;

    if (Math.abs(dU) < 1e-12) {
      if (Math.abs(pU) > hostObb.halfX) {
        physMissed = true;
      }
    } else {
      const t0 = (-hostObb.halfX - pU) / dU;
      const t1 = (hostObb.halfX - pU) / dU;
      physMin = Math.max(physMin, Math.min(t0, t1));
      physMax = Math.min(physMax, Math.max(t0, t1));
    }

    if (!physMissed) {
      if (Math.abs(dV) < 1e-12) {
        if (Math.abs(pV) > hostObb.halfZ) {
          physMissed = true;
        }
      } else {
        const t0 = (-hostObb.halfZ - pV) / dV;
        const t1 = (hostObb.halfZ - pV) / dV;
        physMin = Math.max(physMin, Math.min(t0, t1));
        physMax = Math.min(physMax, Math.max(t0, t1));
      }
    }

    const crossOverlapM = !physMissed && physMax > physMin
      ? Math.min(crossHalf * 2, physMax - physMin)
      : 0;
    const verticalOverlapM = Math.min(halfY * 2, Math.max(0, vertOverlap));
    return {
      contacts: true,
      crossOverlapM,
      verticalOverlapM,
    };
  };

  type SupportEntry = { mass: SkyriverMass; massIndex: number; approved?:SkyriverMass };

  const baselineHostsByKey = new Map<string, SupportEntry[]>();
  for (let massIndex = 0; massIndex < legacyWorld.length; massIndex += 1) {
    const m = legacyWorld[massIndex]!;
    if (m.width <= 0 || m.height <= 0 || m.depth <= 0) continue;
    const mOwner = getMassOwnerSeed(m);
    const mAnchor = getMassAnchorV(m);
    const key = hostIndexKey(mOwner, mAnchor);
    let list = baselineHostsByKey.get(key);
    if (list === undefined) {
      list = [];
      baselineHostsByKey.set(key, list);
    }
    list.push({ mass: m, massIndex });
  }

  const candidateHostsByKey = new Map<string, SupportEntry[]>();
  for (let massIndex = 0; massIndex < masses.length; massIndex += 1) {
    const m = masses[massIndex]!;
    if (m.artBacking !== undefined || m.width <= 0 || m.height <= 0 || m.depth <= 0) continue;
    const mOwner = getMassOwnerSeed(m);
    const mAnchor = getMassAnchorV(m);
    const key = hostIndexKey(mOwner, mAnchor);
    let list = candidateHostsByKey.get(key);
    if (list === undefined) {
      list = [];
      candidateHostsByKey.set(key, list);
    }
    list.push({ mass: m, massIndex });
    const approved=approvedMasses.get(m);
    if (approved!==undefined) list.push({mass:approved,massIndex,approved});
  }

  const baselineMassObbs: RoofDetailObb[] = new Array(legacyWorld.length);
  const baselineMassGrid = new Map<string, number[]>();
  for (let mIdx = 0; mIdx < legacyWorld.length; mIdx += 1) {
    const obb = roofDetailMassObb(legacyWorld[mIdx]!, mIdx);
    baselineMassObbs[mIdx] = obb;
    const minX = Math.floor(obb.minX / ROOF_DETAIL_SPATIAL_CELL_M);
    const maxX = Math.floor(obb.maxX / ROOF_DETAIL_SPATIAL_CELL_M);
    const minZ = Math.floor(obb.minZ / ROOF_DETAIL_SPATIAL_CELL_M);
    const maxZ = Math.floor(obb.maxZ / ROOF_DETAIL_SPATIAL_CELL_M);
    for (let gx = minX; gx <= maxX; gx += 1) {
      for (let gz = minZ; gz <= maxZ; gz += 1) {
        const cellK = roofDetailCellKey(gx, gz);
        const bucket = baselineMassGrid.get(cellK);
        if (bucket === undefined) baselineMassGrid.set(cellK, [mIdx]);
        else bucket.push(mIdx);
      }
    }
  }
  const baselineMassStamps = new Int32Array(legacyWorld.length);
  let baselineMassStamp = 0;

  const finalMassObbs: RoofDetailObb[] = new Array(masses.length);
  const finalMassGrid = new Map<string, number[]>();
  for (let mIdx = 0; mIdx < masses.length; mIdx += 1) {
    const obb = roofDetailMassObb(masses[mIdx]!, mIdx);
    finalMassObbs[mIdx] = obb;
    const minX = Math.floor(obb.minX / ROOF_DETAIL_SPATIAL_CELL_M);
    const maxX = Math.floor(obb.maxX / ROOF_DETAIL_SPATIAL_CELL_M);
    const minZ = Math.floor(obb.minZ / ROOF_DETAIL_SPATIAL_CELL_M);
    const maxZ = Math.floor(obb.maxZ / ROOF_DETAIL_SPATIAL_CELL_M);
    for (let gx = minX; gx <= maxX; gx += 1) {
      for (let gz = minZ; gz <= maxZ; gz += 1) {
        const cellK = roofDetailCellKey(gx, gz);
        const bucket = finalMassGrid.get(cellK);
        if (bucket === undefined) finalMassGrid.set(cellK, [mIdx]);
        else bucket.push(mIdx);
      }
    }
  }
  const finalMassStamps = new Int32Array(masses.length+sourceCount*2);
  let finalMassStamp = 0;

  const computeChordExposedLength = (
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    y: number,
    chordLength: number,
    activeBoxes: readonly RoofDetailObb[],
    grid: ReadonlyMap<string, number[]>,
    stamps: Int32Array,
    isBaseline: boolean,
  ): number => {
    if (chordLength <= 1e-6) return 0;
    const dx = x1 - x0;
    const dz = z1 - z0;
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minZ = Math.min(z0, z1);
    const maxZ = Math.max(z0, z1);

    const minGX = Math.floor(minX / ROOF_DETAIL_SPATIAL_CELL_M);
    const maxGX = Math.floor(maxX / ROOF_DETAIL_SPATIAL_CELL_M);
    const minGZ = Math.floor(minZ / ROOF_DETAIL_SPATIAL_CELL_M);
    const maxGZ = Math.floor(maxZ / ROOF_DETAIL_SPATIAL_CELL_M);

    if (isBaseline) {
      baselineMassStamp += 1;
      if (baselineMassStamp >= 0x7ffffffe) {
        stamps.fill(0);
        baselineMassStamp = 1;
      }
    } else {
      finalMassStamp += 1;
      if (finalMassStamp >= 0x7ffffffe) {
        stamps.fill(0);
        finalMassStamp = 1;
      }
    }
    const stamp = isBaseline ? baselineMassStamp : finalMassStamp;

    const candidates: RoofDetailObb[] = [];
    for (let gx = minGX; gx <= maxGX; gx += 1) {
      for (let gz = minGZ; gz <= maxGZ; gz += 1) {
        const bucket = grid.get(roofDetailCellKey(gx, gz));
        if (bucket === undefined) continue;
        for (const massIndex of bucket) {
          if (stamps[massIndex] === stamp) continue;
          stamps[massIndex] = stamp;
          candidates.push(activeBoxes[massIndex]!);
        }
      }
    }
    return chordExposedLength({ x: x0, y, z: z0 }, { x: x1, y, z: z1 }, chordLength, candidates);
  };

  const heroBoxes = roofDetailHeroBoxCache.get(layout.seed) ?? roofDetailHeroObbs(layout, heroes);
  const cellSize = ROOF_DETAIL_SPATIAL_CELL_M;
  const currentObbs: (RoofDetailObb | null)[] = new Array(sourceCount);
  const prefixCells = new Map<string, number[]>();

  for (let j = 0; j < sourceCount; j += 1) {
    const disp = reconciliationD2.dispositions[j]!;
    if (disp.heroFiltered) {
      currentObbs[j] = null;
      continue;
    }
    currentObbs[j] = roofDetailTrimObb(trims, j);
    roofDetailPrefixInsertCell(prefixCells, j, currentObbs[j]!, cellSize);
  }

  const stamps = new Int32Array(sourceCount);
  let currentStamp = 0;

  const checkPrefixConflict = (candObb: RoofDetailObb, rowId: number): boolean => {
    currentStamp += 1;
    if (currentStamp >= 0x7ffffffe) {
      stamps.fill(0);
      currentStamp = 1;
    }
    const stamp = currentStamp;

    const minX = Math.floor(candObb.minX / cellSize);
    const maxX = Math.floor(candObb.maxX / cellSize);
    const minZ = Math.floor(candObb.minZ / cellSize);
    const maxZ = Math.floor(candObb.maxZ / cellSize);

    for (let gx = minX; gx <= maxX; gx += 1) {
      for (let gz = minZ; gz <= maxZ; gz += 1) {
        const bucket = prefixCells.get(roofDetailCellKey(gx, gz));
        if (bucket === undefined) continue;
        for (let idx = 0; idx < bucket.length; idx += 1) {
          const otherId = bucket[idx]!;
          if (otherId === rowId) continue;
          if (stamps[otherId] === stamp) continue;
          stamps[otherId] = stamp;

          const otherObb = currentObbs[otherId];
          if (otherObb === null) continue;

          if (roofDetailObbsConflict(candObb, otherObb, 0)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  const trialOwner: SkyriverTrimOwner[] = [owner[0]!];
  const trialSpanTo: (SkyriverTrimOwner | null)[] = [spanTo[0]!];
  const trialTrims: SkyriverCityTrims = {
    seed,
    count: 1,
    cx: new Float32Array(1),
    cy: new Float32Array(1),
    cz: new Float32Array(1),
    sx: new Float32Array(1),
    sy: new Float32Array(1),
    sz: new Float32Array(1),
    kind: new Uint8Array(1),
    seedValue: new Float32Array(1),
    owner: trialOwner,
    spanTo: trialSpanTo,
  };
  const trialPlacement: SkyriverTrimPlacement = { x: 0, z: 0, heading: 0, length: 0 };
  const origPlacement: SkyriverTrimPlacement = { x: 0, z: 0, heading: 0, length: 0 };

  interface BaselineSpanPath {
    readonly supportedInBaseline: boolean;
    readonly contactHosts: readonly number[];
    readonly allowedForeignOwners: ReadonlySet<number>;
    readonly openMeters: number;
    readonly origPlacement: SkyriverTrimPlacement;
    readonly origP0: { readonly x: number; readonly z: number };
    readonly origP1: { readonly x: number; readonly z: number };
  }

  const makeSpanLedge = (entry:SupportEntry,worldX:number,y:number,worldZ:number,crossHalf:number,sourceTrimIndex:number,endpoint:0|1):SkyriverMass | undefined => {
    if (entry.approved===undefined) return undefined;
    const approved=entry.approved,actual=masses[entry.massIndex]!;
    const frame=roofDetailMassObb(approved,entry.massIndex);
    const dx=worldX-frame.x,dz=worldZ-frame.z;
    const point:[number,number]=[approved.x+dx*frame.ux+dz*frame.uz,approved.z+dx*frame.vx+dz*frame.vz];
    const polygon=massSourceFootprint(actual);
    let target:[number,number]=[actual.x,actual.z],distance=Infinity;
    for (let index=0;index<polygon.length;index+=1) {
      const a=polygon[index]!,b=polygon[(index+1)%polygon.length]!;
      const ex=b[0]-a[0],ez=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((point[0]-a[0])*ex+(point[1]-a[1])*ez)/(ex*ex+ez*ez)));
      const candidate:[number,number]=[a[0]+t*ex,a[1]+t*ez];
      const gap=Math.hypot(candidate[0]-point[0],candidate[1]-point[1]);
      if (gap<distance) {target=candidate;distance=gap;}
    }
    const towardCentre=Math.hypot(actual.x-target[0],actual.z-target[1]);
    const inset=Math.min(1,1/Math.max(1,towardCentre));
    target=[target[0]+(actual.x-target[0])*inset,target[1]+(actual.z-target[1])*inset];
    const radius=Math.min(4,crossHalf+0.02);
    const x0=Math.max(approved.x-approved.width*.5,Math.min(point[0]-radius,target[0]-.02));
    const x1=Math.min(approved.x+approved.width*.5,Math.max(point[0]+radius,target[0]+.02));
    const z0=Math.max(approved.z-approved.depth*.5,Math.min(point[1]-radius,target[1]-.02));
    const z1=Math.min(approved.z+approved.depth*.5,Math.max(point[1]+radius,target[1]+.02));
    const bottom=Math.max(approved.y0,y-2),top=Math.min(approved.y0+approved.height,y+2);
    if (x1-x0<=.01 || z1-z0<=.01 || top-bottom<=.01) return undefined;
    const ledge:SkyriverMass={...approved,x:(x0+x1)*.5,z:(z0+z1)*.5,width:x1-x0,depth:z1-z0,
      y0:bottom,height:top-bottom,crownRole:undefined,supportRole:'yaw-span-ledge',supportHostMassIndex:entry.massIndex,
      supportSourceTrimIndex:sourceTrimIndex,supportSpanEndpoint:endpoint};
    const box=roofDetailMassObb(ledge,entry.massIndex);
    if (!retainedSupportContacts(box,finalMassObbs[entry.massIndex]!) || routeBlocked(box)
      || roofDetailIndexConflicts(wingAirIndex,box,0)
      || [...acceptedNotches.values()].some(notch=>roofDetailObbsConflict(box,notch,0))
      || roofDetailBlocksHero(box,heroBoxes)) return undefined;
    return ledge;
  };

  const baselinePathByIndex = new Map<number, BaselineSpanPath>();

  for (let i = 0; i < sourceCount; i += 1) {
    const k = kind[i]!;
    const ow = owner[i]!;
    const sp = spanTo[i] ?? null;
    const isSpan = (k === SKYRIVER_TRIM_GANTRY || k === SKYRIVER_TRIM_SKYBRIDGE) && sp !== null;
    const isR27 = i >= r27StartIndex && i < r27EndIndex;
    const canonicalOwner = ow.materialOwner ?? buildingSeedOf(ow.x, ow.z);
    const spanToCanonical = sp !== null ? (sp.materialOwner ?? buildingSeedOf(sp.x, sp.z)) : 0;
    const isOrdinaryTower =
      sp !== null &&
      towerAnchorBySeed.get(canonicalOwner)?.has(ow.anchorV) === true &&
      towerAnchorBySeed.get(spanToCanonical)?.has(sp.anchorV) === true;
    const isOrdinarySpan = isSpan && !isR27 && isOrdinaryTower;

    if (!isOrdinarySpan) continue;

    const src = sourceInventory[i]!;
    trialTrims.cx[0] = src.cx;
    trialTrims.cy[0] = src.cy;
    trialTrims.cz[0] = src.cz;
    trialTrims.sx[0] = src.sx;
    trialTrims.sy[0] = src.sy;
    trialTrims.sz[0] = src.sz;
    trialTrims.kind[0] = src.kind;
    trialTrims.seedValue[0] = src.seedValue;
    trialOwner[0] = ow;
    trialSpanTo[0] = sp;

    placeTrim(trialTrims, 0, origPlacement);
    const [origP0, origP1] = spanPlacementEndpoints(origPlacement, src.sx, src.sz);
    const savedOrigPlacement = { ...origPlacement };
    const origObb = roofDetailTrimObb(trialTrims, 0);

    const along = src.sz >= src.sx;
    const half = (along ? src.sz : src.sx) * 0.5;
    const e0x = along ? src.cx : src.cx - half;
    const e0z = along ? src.cz - half : src.cz;
    const ownerAtLow = footprintGap(ow, e0x, e0z) <= footprintGap(sp, e0x, e0z);
    const crossHalf = (along ? src.sx : src.sz) * 0.5;
    const halfY = src.sy * 0.5;

    const end0Canonical = ownerAtLow ? canonicalOwner : spanToCanonical;
    const end0AnchorV = ownerAtLow ? ow.anchorV : sp.anchorV;
    const end1Canonical = ownerAtLow ? spanToCanonical : canonicalOwner;
    const end1AnchorV = ownerAtLow ? sp.anchorV : ow.anchorV;

    const baseHosts0 = baselineHostsByKey.get(hostIndexKey(end0Canonical, end0AnchorV)) ?? [];
    const baseHosts1 = baselineHostsByKey.get(hostIndexKey(end1Canonical, end1AnchorV)) ?? [];

    const heading = savedOrigPlacement.heading;
    const crossUnitX = along ? Math.cos(heading) : Math.sin(heading);
    const crossUnitZ = along ? -Math.sin(heading) : Math.cos(heading);

    let baselineFound = false;
    let baseHost0Idx = -1;
    let baseHost1Idx = -1;

    for (let h0Idx = 0; h0Idx < baseHosts0.length && !baselineFound; h0Idx += 1) {
      const h0 = baseHosts0[h0Idx]!;
      const c0 = checkSpanEndpointContact(
        origP0.x, src.cy, origP0.z, crossUnitX, crossUnitZ, crossHalf, halfY, baselineMassObbs[h0.massIndex]!,
      );
      if (!c0.contacts) continue;
      for (let h1Idx = 0; h1Idx < baseHosts1.length && !baselineFound; h1Idx += 1) {
        const h1 = baseHosts1[h1Idx]!;
        const c1 = checkSpanEndpointContact(
          origP1.x, src.cy, origP1.z, crossUnitX, crossUnitZ, crossHalf, halfY, baselineMassObbs[h1.massIndex]!,
        );
        if (!c1.contacts) continue;
        baselineFound = true;
        baseHost0Idx = h0.massIndex;
        baseHost1Idx = h1.massIndex;
      }
    }

    if (!baselineFound) {
      baselinePathByIndex.set(i, {
        supportedInBaseline: false,
        contactHosts: [],
        allowedForeignOwners: new Set(),
        openMeters: 0,
        origPlacement: savedOrigPlacement,
        origP0,
        origP1,
      });
      continue;
    }

    const contactHosts = [baseHost0Idx, baseHost1Idx];
    const allowedForeignOwners = new Set<number>();
    for (let j = 0; j < legacyWorld.length; j += 1) {
      if (j === baseHost0Idx || j === baseHost1Idx) continue;
      if (roofDetailObbsConflict(origObb, baselineMassObbs[j]!, 0)) {
        const o = getMassOwnerSeed(legacyWorld[j]!);
        if (o !== canonicalOwner && o !== spanToCanonical) {
          allowedForeignOwners.add(o);
        }
      }
    }

    const openMeters = computeChordExposedLength(
      origP0.x, origP0.z, origP1.x, origP1.z, src.cy, savedOrigPlacement.length,
      baselineMassObbs, baselineMassGrid, baselineMassStamps, true,
    );

    baselinePathByIndex.set(i, {
      supportedInBaseline: true,
      contactHosts,
      allowedForeignOwners,
      openMeters,
      origPlacement: savedOrigPlacement,
      origP0,
      origP1,
    });
  }

  const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

  const dispositions: SkyriverTrimDisposition[] = new Array(sourceCount);
  let unchangedCount = 0;
  let rehostedCount = 0;

  for (let i = 0; i < sourceCount; i += 1) {
    const k = kind[i]!;
    const ow = owner[i]!;
    const sp = spanTo[i] ?? null;
    const isSpan = (k === SKYRIVER_TRIM_GANTRY || k === SKYRIVER_TRIM_SKYBRIDGE) && sp !== null;
    const isR27 = i >= r27StartIndex && i < r27EndIndex;
    const canonicalOwner = ow.materialOwner ?? buildingSeedOf(ow.x, ow.z);
    const spanToCanonical = sp !== null ? (sp.materialOwner ?? buildingSeedOf(sp.x, sp.z)) : 0;
    const isOrdinaryTower =
      sp !== null &&
      towerAnchorBySeed.get(canonicalOwner)?.has(ow.anchorV) === true &&
      towerAnchorBySeed.get(spanToCanonical)?.has(sp.anchorV) === true;
    const isOrdinarySpan = isSpan && !isR27 && isOrdinaryTower;

    if (!isOrdinarySpan) {
      const prevDisp = reconciliationD2.dispositions[i]!;
      dispositions[i] = prevDisp;
      if (prevDisp.kind === 'side-rehosted' || prevDisp.kind === 'roof-rehosted') {
        rehostedCount += 1;
      } else {
        unchangedCount += 1;
      }
      continue;
    }

    const src = sourceInventory[i]!;
    const ocx = src.cx;
    const ocy = src.cy;
    const ocz = src.cz;
    const osx = src.sx;
    const osy = src.sy;
    const osz = src.sz;
    const oldGeom = Object.freeze({ cx: ocx, cy: ocy, cz: ocz, sx: osx, sy: osy, sz: osz });

    const basePath = baselinePathByIndex.get(i)!;
    if (!basePath.supportedInBaseline) {
      dispositions[i] = Object.freeze({
        kind: 'inherited-span-unsupported',
        sourceIndex: i,
        finalIndex: i,
        heroFiltered: false,
        blockingHeroIds: Object.freeze([]),
        oldGeometry: oldGeom,
        newGeometry: oldGeom,
      });
      unchangedCount += 1;
      continue;
    }

    const along = osz >= osx;
    const originalL = along ? osz : osx;
    const originalWidth = along ? osx : osz;
    const oldCross = along ? ocx : ocz;
    const oldLong = along ? ocz : ocx;
    const half = originalL * 0.5;
    const e0x = along ? ocx : ocx - half;
    const e0z = along ? ocz - half : ocz;
    const ownerAtLow = footprintGap(ow, e0x, e0z) <= footprintGap(sp, e0x, e0z);
    const crossHalf = originalWidth * 0.5;
    const halfY = osy * 0.5;

    const end0Canonical = ownerAtLow ? canonicalOwner : spanToCanonical;
    const end0AnchorV = ownerAtLow ? ow.anchorV : sp.anchorV;
    const end1Canonical = ownerAtLow ? spanToCanonical : canonicalOwner;
    const end1AnchorV = ownerAtLow ? sp.anchorV : ow.anchorV;

    const candHosts0 = candidateHostsByKey.get(hostIndexKey(end0Canonical, end0AnchorV)) ?? [];
    const candHosts1 = candidateHostsByKey.get(hostIndexKey(end1Canonical, end1AnchorV)) ?? [];

    const heading = basePath.origPlacement.heading;
    const crossUnitX = along ? Math.cos(heading) : Math.sin(heading);
    const crossUnitZ = along ? -Math.sin(heading) : Math.cos(heading);

    let supportedInFinal = false;
    let finalHost0Idx = -1;
    let finalHost1Idx = -1;
    for (let h0Idx = 0; h0Idx < candHosts0.length && !supportedInFinal; h0Idx += 1) {
      const h0 = candHosts0[h0Idx]!;
      const c0 = checkSpanEndpointContact(
        basePath.origP0.x, ocy, basePath.origP0.z, crossUnitX, crossUnitZ, crossHalf, halfY, finalMassObbs[h0.massIndex]!,
      );
      if (!c0.contacts) continue;
      for (let h1Idx = 0; h1Idx < candHosts1.length && !supportedInFinal; h1Idx += 1) {
        const h1 = candHosts1[h1Idx]!;
        const c1 = checkSpanEndpointContact(
          basePath.origP1.x, ocy, basePath.origP1.z, crossUnitX, crossUnitZ, crossHalf, halfY, finalMassObbs[h1.massIndex]!,
        );
        if (!c1.contacts) continue;
        supportedInFinal = true;
        finalHost0Idx = h0.massIndex;
        finalHost1Idx = h1.massIndex;
      }
    }

    if (supportedInFinal) {
      trialTrims.cx[0] = ocx;
      trialTrims.cy[0] = ocy;
      trialTrims.cz[0] = ocz;
      trialTrims.sx[0] = osx;
      trialTrims.sy[0] = osy;
      trialTrims.sz[0] = osz;
      trialTrims.kind[0] = k;
      trialTrims.seedValue[0] = src.seedValue;
      trialOwner[0] = ow;
      trialSpanTo[0] = sp;
      const curObb = roofDetailTrimObb(trialTrims, 0);

      let hasNewForeignOwner = false;
      for (let j = 0; j < masses.length; j += 1) {
        if (j === finalHost0Idx || j === finalHost1Idx) continue;
        if (roofDetailObbsConflict(curObb, finalMassObbs[j]!, 0)) {
          const o = getMassOwnerSeed(masses[j]!);
          if (o !== canonicalOwner && o !== spanToCanonical && !basePath.allowedForeignOwners.has(o)) {
            hasNewForeignOwner = true;
            break;
          }
        }
      }

      const curExposedLengthM = computeChordExposedLength(
        basePath.origP0.x, basePath.origP0.z, basePath.origP1.x, basePath.origP1.z, ocy, basePath.origPlacement.length,
        finalMassObbs, finalMassGrid, finalMassStamps, false,
      );
      const tol = roofDetailFloatTolerance(curObb, curObb);
      const lostExposure = basePath.openMeters > tol && curExposedLengthM <= tol;

      if (!hasNewForeignOwner && !lostExposure) {
        dispositions[i] = Object.freeze({
          kind: 'unchanged',
          sourceIndex: i,
          finalIndex: i,
          heroFiltered: false,
          blockingHeroIds: Object.freeze([]),
          oldGeometry: oldGeom,
          newGeometry: oldGeom,
        });
        unchangedCount += 1;
        continue;
      }
    }

    const candHostsA = candidateHostsByKey.get(hostIndexKey(canonicalOwner, ow.anchorV)) ?? [];
    const candHostsB = candidateHostsByKey.get(hostIndexKey(spanToCanonical, sp.anchorV)) ?? [];

    let minimumSkyCrossGapM = Infinity;
    let eligibleSkyPairs = 0;
    const sameSkyFrame = ow.anchorV === sp.anchorV;
    if (k === SKYRIVER_TRIM_SKYBRIDGE && sameSkyFrame) {
      for (let aIdx = 0; aIdx < candHostsA.length; aIdx += 1) {
        const aMass = candHostsA[aIdx]!.mass;
        for (let bIdx = 0; bIdx < candHostsB.length; bIdx += 1) {
          const bMass = candHostsB[bIdx]!.mass;
          const loY = Math.max(aMass.y0, bMass.y0, SKYRIVER_SKYBRIDGE_MIN_Y_M);
          const hiY = Math.min(aMass.y0 + aMass.height, bMass.y0 + bMass.height);
          if (hiY < loY - osy) continue;
          const crossA = along ? aMass.x : aMass.z;
          const crossB = along ? bMass.x : bMass.z;
          const halfA = (along ? aMass.width : aMass.depth) * 0.5;
          const halfB = (along ? bMass.width : bMass.depth) * 0.5;
          const gap = Math.max(
            0,
            Math.max(crossA - halfA, crossB - halfB) - Math.min(crossA + halfA, crossB + halfB),
          );
          eligibleSkyPairs += 1;
          minimumSkyCrossGapM = Math.min(minimumSkyCrossGapM, gap);
        }
      }
    }

    let maxHostTol = 0;
    for (let aIdx = 0; aIdx < candHostsA.length; aIdx += 1) {
      const obb = finalMassObbs[candHostsA[aIdx]!.massIndex]!;
      maxHostTol = Math.max(maxHostTol, roofDetailFloatTolerance(obb, obb));
    }
    for (let bIdx = 0; bIdx < candHostsB.length; bIdx += 1) {
      const obb = finalMassObbs[candHostsB[bIdx]!.massIndex]!;
      maxHostTol = Math.max(maxHostTol, roofDetailFloatTolerance(obb, obb));
    }

    const originalWidthMathematicallyImpossible =
      k === SKYRIVER_TRIM_SKYBRIDGE &&
      sameSkyFrame &&
      eligibleSkyPairs > 0 &&
      minimumSkyCrossGapM > originalWidth + maxHostTol * 2;

    const widthCases = [originalWidth];
    if (originalWidthMathematicallyImpossible && minimumSkyCrossGapM <= 30) {
      widthCases.push(Math.fround(Math.min(30, Math.max(28, minimumSkyCrossGapM + 2))));
    }

    interface BestSpanCandidate {
      readonly cost: number;
      readonly ledge0?:SkyriverMass;
      readonly ledge1?:SkyriverMass;
      readonly cx: number;
      readonly cy: number;
      readonly cz: number;
      readonly sx: number;
      readonly sy: number;
      readonly sz: number;
      readonly sourceLengthM: number;
      readonly placementLength: number;
      readonly obb: RoofDetailObb;
      readonly host0: SkyriverSpanHost;
      readonly host1: SkyriverSpanHost;
      readonly contact0: SkyriverSpanEndpointContact;
      readonly contact1: SkyriverSpanEndpointContact;
      readonly newEnd0: SkyriverSpanEndpoint;
      readonly newEnd1: SkyriverSpanEndpoint;
      readonly exposedLengthM: number;
    }

    const uniqueCandidates = new Set<string>();

    const rejections = {
      support: 0,
      solid: 0,
      hero: 0,
      wingAir: 0,
      notch: 0,
      prefix: 0,
    };

    const findBestSpanCandidate = (useLedges: boolean): BestSpanCandidate | null => {
      uniqueCandidates.clear();
      let best: BestSpanCandidate | null = null;
    for (let wIdx = 0; wIdx < widthCases.length; wIdx += 1) {
      const width = widthCases[wIdx]!;
      for (const changeLength of [false, true]) {
        for (let aIdx = 0; aIdx < candHostsA.length; aIdx += 1) {
          const a = candHostsA[aIdx]!;
          for (let bIdx = 0; bIdx < candHostsB.length; bIdx += 1) {
            const b = candHostsB[bIdx]!;
            if ((a.approved !== undefined || b.approved !== undefined) !== useLedges) continue;
            let low = a;
            let high = b;
            const longA = along ? a.mass.z : a.mass.x;
            const longB = along ? b.mass.z : b.mass.x;
            const polygonA=massSourceFootprint(a.mass),polygonB=massSourceFootprint(b.mass);
            const crossAxis=along?0:1;
            const crossMinA=Math.min(...polygonA.map(point=>point[crossAxis]));
            const crossMaxA=Math.max(...polygonA.map(point=>point[crossAxis]));
            const crossMinB=Math.min(...polygonB.map(point=>point[crossAxis]));
            const crossMaxB=Math.max(...polygonB.map(point=>point[crossAxis]));

            if (longA > longB) {
              low = b;
              high = a;
            }
            const loLong = along ? low.mass.z : low.mass.x;
            const hiLong = along ? high.mass.z : high.mass.x;
            const loHalf = (along ? low.mass.depth : low.mass.width) * 0.5;
            const hiHalf = (along ? high.mass.depth : high.mass.width) * 0.5;

            let crossMin = Math.max(crossMinA,crossMinB);
            let crossMax = Math.min(crossMaxA,crossMaxB);
            if (crossMax < crossMin) {
              crossMin -= width * 0.5;
              crossMax += width * 0.5;
            }
            if (crossMax < crossMin) continue;

            let minY = Math.max(
              a.mass.y0,
              b.mass.y0,
              k === SKYRIVER_TRIM_SKYBRIDGE ? SKYRIVER_SKYBRIDGE_MIN_Y_M : -Infinity,
            );
            let maxY = Math.min(a.mass.y0 + a.mass.height, b.mass.y0 + b.mass.height);
            if (maxY < minY) {
              minY = Math.max(
                Math.max(a.mass.y0, b.mass.y0) - osy * 0.5 + 0.005,
                k === SKYRIVER_TRIM_SKYBRIDGE ? SKYRIVER_SKYBRIDGE_MIN_Y_M : -Infinity,
              );
              maxY = Math.min(a.mass.y0 + a.mass.height, b.mass.y0 + b.mass.height) + osy * 0.5 - 0.005;
            }
            if (maxY < minY) continue;

            const loMin = loLong - loHalf;
            const loMax = loLong + loHalf;
            const hiMin = hiLong - hiHalf;
            const hiMax = hiLong + hiHalf;

            let longCases: { readonly centre: number; readonly length: number; readonly cross?:number }[];
            if (!changeLength) {
              const e0Min = Math.max(loMin, hiMin - originalL);
              const e0Max = Math.min(loMax, hiMax - originalL);
              if (e0Max < e0Min) continue;
              longCases = [
                clamp(oldLong - originalL * 0.5, e0Min, e0Max),
                (e0Min + e0Max) * 0.5,
              ].map((e0) => ({ centre: e0 + originalL * 0.5, length: originalL }));
            } else {
              const e0 = loMax - 0.005;
              const e1 = hiMin + 0.005;
              longCases = [{ centre: (e0 + e1) * 0.5, length: e1 - e0 }];
            }

            const xs = [
              clamp(oldCross, crossMin, crossMax),
              (crossMin + crossMax) * 0.5,
              crossMin + Math.min(0.005, (crossMax - crossMin) * 0.5),
              crossMax - Math.min(0.005, (crossMax - crossMin) * 0.5),
            ];
            for (const cross of xs) {
              const intervalA=footprintCrossSection(polygonA,crossAxis,cross);
              const intervalB=footprintCrossSection(polygonB,crossAxis,cross);
              if (intervalA===undefined || intervalB===undefined) continue;
              const lowInterval=longA<=longB?intervalA:intervalB;
              const highInterval=longA<=longB?intervalB:intervalA;
              if (changeLength) {
                const start=lowInterval[1]-0.005,end=highInterval[0]+0.005;
                longCases.push({centre:(start+end)*.5,length:end-start,cross});
              } else {
                const minStart=Math.max(lowInterval[0],highInterval[0]-originalL);
                const maxStart=Math.min(lowInterval[1],highInterval[1]-originalL);
                if (maxStart<minStart) continue;
                for (const start of [clamp(oldLong-originalL*.5,minStart,maxStart),(minStart+maxStart)*.5]) {
                  longCases.push({centre:start+originalL*.5,length:originalL,cross});
                }
              }
            }
            const ys = [
              clamp(ocy, minY, maxY),
              (minY + maxY) * 0.5,
              minY + Math.min(0.005, (maxY - minY) * 0.5),
              maxY - Math.min(0.005, (maxY - minY) * 0.5),
            ];

            for (let lIdx = 0; lIdx < longCases.length; lIdx += 1) {
              const lc = longCases[lIdx]!;
              if (lc.length <= Math.max(width, 8)) continue;
              if (k === SKYRIVER_TRIM_GANTRY && lc.length > SKYRIVER_GANTRY_MAX_SPAN_M) continue;

              for (let xIdx = 0; xIdx < xs.length; xIdx += 1) {
                const cr = xs[xIdx]!;
                if (lc.cross!==undefined && cr!==lc.cross) continue;
                for (let yIdx = 0; yIdx < ys.length; yIdx += 1) {
                  const y = ys[yIdx]!;
                  const fx = Math.fround(along ? cr : lc.centre);
                  const fy = Math.fround(y);
                  const fz = Math.fround(along ? lc.centre : cr);
                  const fsx = Math.fround(along ? width : lc.length);
                  const fsy = Math.fround(osy);
                  const fsz = Math.fround(along ? lc.length : width);

                  if ((osz >= osx) !== (fsz >= fsx)) continue;

                  const candidateKey = `${a.massIndex}/${b.massIndex}/${fx}/${fy}/${fz}/${fsx}/${fsz}`;
                  if (uniqueCandidates.has(candidateKey)) continue;
                  uniqueCandidates.add(candidateKey);

                  trialTrims.cx[0] = fx;
                  trialTrims.cy[0] = fy;
                  trialTrims.cz[0] = fz;
                  trialTrims.sx[0] = fsx;
                  trialTrims.sy[0] = fsy;
                  trialTrims.sz[0] = fsz;
                  trialTrims.kind[0] = k;
                  trialTrims.seedValue[0] = seedValue[i]!;
                  trialOwner[0] = ow;
                  trialSpanTo[0] = sp;

                  placeTrim(trialTrims, 0, trialPlacement);
                  const [curEnd0, curEnd1] = spanPlacementEndpoints(trialPlacement, fsx, fsz);
                  const curEnd0x = curEnd0.x;
                  const curEnd0z = curEnd0.z;
                  const curEnd1x = curEnd1.x;
                  const curEnd1z = curEnd1.z;

                  const alongAxis = fsz >= fsx;
                  const halfLen = (alongAxis ? fsz : fsx) * 0.5;
                  const e0x = alongAxis ? fx : fx - halfLen;
                  const e0z = alongAxis ? fz - halfLen : fz;
                  const candOwnerAtLow = footprintGap(ow, e0x, e0z) <= footprintGap(sp, e0x, e0z);
                  const hostAtEnd0 = candOwnerAtLow ? a : b;
                  const hostAtEnd1 = candOwnerAtLow ? b : a;

                  const candHeading = trialPlacement.heading;
                  const crossUnitX = alongAxis ? Math.cos(candHeading) : Math.sin(candHeading);
                  const crossUnitZ = alongAxis ? -Math.sin(candHeading) : Math.cos(candHeading);
                  const candCrossHalf = (alongAxis ? fsx : fsz) * 0.5;
                  const candHalfY = fsy * 0.5;

                  const ledge0=makeSpanLedge(hostAtEnd0,curEnd0x,fy,curEnd0z,candCrossHalf,i,0);
                  const ledge1=makeSpanLedge(hostAtEnd1,curEnd1x,fy,curEnd1z,candCrossHalf,i,1);
                  if ((hostAtEnd0.approved!==undefined && ledge0===undefined)
                    || (hostAtEnd1.approved!==undefined && ledge1===undefined)) {rejections.support+=1;continue;}
                  const c0 = checkSpanEndpointContact(
                    curEnd0x, fy, curEnd0z, crossUnitX, crossUnitZ, candCrossHalf, candHalfY, ledge0===undefined?finalMassObbs[hostAtEnd0.massIndex]!:roofDetailMassObb(ledge0,hostAtEnd0.massIndex),
                  );
                  if (!c0.contacts) {
                    rejections.support += 1;
                    continue;
                  }
                  const c1 = checkSpanEndpointContact(
                    curEnd1x, fy, curEnd1z, crossUnitX, crossUnitZ, candCrossHalf, candHalfY, ledge1===undefined?finalMassObbs[hostAtEnd1.massIndex]!:roofDetailMassObb(ledge1,hostAtEnd1.massIndex),
                  );
                  if (!c1.contacts) {
                    rejections.support += 1;
                    continue;
                  }

                  const candObb = roofDetailTrimObb(trialTrims, 0);
                  if (roofDetailBlocksHero(candObb, heroBoxes)) {
                    rejections.hero += 1;
                    continue;
                  }
                  if (roofDetailIndexConflicts(wingAirIndex, candObb, 0)) {
                    rejections.wingAir += 1;
                    continue;
                  }

                  let notchBlocked = false;
                  for (const notchObb of acceptedNotches.values()) {
                    if (roofDetailObbsConflict(candObb, notchObb, 0)) {
                      notchBlocked = true;
                      break;
                    }
                  }
                  if (notchBlocked) {
                    rejections.notch += 1;
                    continue;
                  }

                  finalMassStamp += 1;
                  if (finalMassStamp >= 0x7ffffffe) {
                    finalMassStamps.fill(0);
                    finalMassStamp = 1;
                  }
                  const mStamp = finalMassStamp;
                  const minGX = Math.floor(candObb.minX / ROOF_DETAIL_SPATIAL_CELL_M);
                  const maxGX = Math.floor(candObb.maxX / ROOF_DETAIL_SPATIAL_CELL_M);
                  const minGZ = Math.floor(candObb.minZ / ROOF_DETAIL_SPATIAL_CELL_M);
                  const maxGZ = Math.floor(candObb.maxZ / ROOF_DETAIL_SPATIAL_CELL_M);
                  let foreignBlocked = false;

                  for (let gx = minGX; gx <= maxGX && !foreignBlocked; gx += 1) {
                    for (let gz = minGZ; gz <= maxGZ && !foreignBlocked; gz += 1) {
                      const bucket = finalMassGrid.get(roofDetailCellKey(gx, gz));
                      if (bucket === undefined) continue;
                      for (let mEntryIdx = 0; mEntryIdx < bucket.length; mEntryIdx += 1) {
                        const mIdx = bucket[mEntryIdx]!;
                        if (mIdx === a.massIndex || mIdx === b.massIndex) continue;
                        if (finalMassStamps[mIdx] === mStamp) continue;
                        finalMassStamps[mIdx] = mStamp;
                        if (roofDetailObbsConflict(candObb, finalMassObbs[mIdx]!, 0)) {
                          const o = getMassOwnerSeed(masses[mIdx]!);
                          if (o !== canonicalOwner && o !== spanToCanonical && !basePath.allowedForeignOwners.has(o)) {
                            foreignBlocked = true;
                            break;
                          }
                        }
                      }
                    }
                  }
                  if (foreignBlocked) {
                    rejections.solid += 1;
                    continue;
                  }

                  const exposedLengthM = computeChordExposedLength(
                    curEnd0x, curEnd0z, curEnd1x, curEnd1z, fy, trialPlacement.length,
                    finalMassObbs, finalMassGrid, finalMassStamps, false,
                  );
                  const tol = roofDetailFloatTolerance(candObb, candObb);
                  if (basePath.openMeters > tol && exposedLengthM <= tol) {
                    rejections.solid += 1;
                    continue;
                  }

                  if (checkPrefixConflict(candObb, i)) {
                    rejections.prefix += 1;
                    continue;
                  }

                  const candSourceLengthM = along ? fsz : fsx;
                  const candCrossWidthM = along ? fsx : fsz;
                  const origP = basePath.origPlacement;
                  const dx = trialPlacement.x - origP.x;
                  const dy = fy - ocy;
                  const dz = trialPlacement.z - origP.z;
                  const displacement = Math.hypot(dx, dy, dz);
                  const worldLengthChange = Math.abs(trialPlacement.length - origP.length);
                  const crosswidthChange = Math.abs(candCrossWidthM - originalWidth);
                  const cost = displacement + 0.5 * worldLengthChange + 0.5 * crosswidthChange;

                  if (best === null || cost < best.cost - 1e-6) {
                    best = {
                      cost,ledge0,ledge1,
                      cx: fx,
                      cy: fy,
                      cz: fz,
                      sx: fsx,
                      sy: fsy,
                      sz: fsz,
                      sourceLengthM: candSourceLengthM,
                      placementLength: trialPlacement.length,
                      obb: candObb,
                      host0: Object.freeze({
                        massIndex: hostAtEnd0.massIndex,
                        canonicalOwner: getMassOwnerSeed(hostAtEnd0.mass),
                        anchorV: getMassAnchorV(hostAtEnd0.mass),
                      }),
                      host1: Object.freeze({
                        massIndex: hostAtEnd1.massIndex,
                        canonicalOwner: getMassOwnerSeed(hostAtEnd1.mass),
                        anchorV: getMassAnchorV(hostAtEnd1.mass),
                      }),
                      contact0: Object.freeze({
                        crossOverlapM: c0.crossOverlapM,
                        verticalOverlapM: c0.verticalOverlapM,
                      }),
                      contact1: Object.freeze({
                        crossOverlapM: c1.crossOverlapM,
                        verticalOverlapM: c1.verticalOverlapM,
                      }),
                      newEnd0: Object.freeze({ x: curEnd0x, y: fy, z: curEnd0z }),
                      newEnd1: Object.freeze({ x: curEnd1x, y: fy, z: curEnd1z }),
                      exposedLengthM,
                    };
                  }
                }
              }
            }
          }
        }
      }
      if (best !== null) break;
    }
      return best;
    };

    const best = findBestSpanCandidate(false) ?? findBestSpanCandidate(true);

    if (best === null) {
      fail(
        `SKYRIVER_SPAN_TRIM_HOST_MISSING: seed ${seed} trim ${i}, hosts: ${candHostsA.length + candHostsB.length}, ` +
          `support: ${rejections.support}, solid: ${rejections.solid}, hero: ${rejections.hero}, ` +
          `wing air: ${rejections.wingAir}, notch: ${rejections.notch}, prefix: ${rejections.prefix}`,
      );
    }

    const attachLedge = (ledge:SkyriverMass | undefined,host:SkyriverSpanHost):SkyriverSpanHost => {
      if (ledge===undefined) return host;
      const index=masses.length;
      masses.push(ledge);
      finalMassObbs.push(roofDetailMassObb(ledge,index));
      roofDetailPrefixInsertCell(finalMassGrid,index,finalMassObbs[index]!,ROOF_DETAIL_SPATIAL_CELL_M);
      return {...host,massIndex:index};
    };
    const finalHost0=attachLedge(best.ledge0,best.host0),finalHost1=attachLedge(best.ledge1,best.host1);
    cx[i] = best.cx;
    cy[i] = best.cy;
    cz[i] = best.cz;
    sx[i] = best.sx;
    sy[i] = best.sy;
    sz[i] = best.sz;

    currentObbs[i] = best.obb;
    roofDetailPrefixInsertCell(prefixCells, i, best.obb, cellSize);

    const newGeom = Object.freeze({
      cx: best.cx,
      cy: best.cy,
      cz: best.cz,
      sx: best.sx,
      sy: best.sy,
      sz: best.sz,
    });

    dispositions[i] = Object.freeze({
      kind: 'span-rehosted',
      sourceIndex: i,
      finalIndex: i,
      heroFiltered: false,
      blockingHeroIds: Object.freeze([]),
      oldGeometry: oldGeom,
      newGeometry: newGeom,
      hosts: Object.freeze([finalHost0, finalHost1] as const),
      oldWorld: Object.freeze({
        endpoints: Object.freeze([
          Object.freeze({ x: basePath.origP0.x, y: ocy, z: basePath.origP0.z }),
          Object.freeze({ x: basePath.origP1.x, y: ocy, z: basePath.origP1.z }),
        ] as const),
        sourceLengthM: originalL,
        worldLengthM: basePath.origPlacement.length,
        exposedLengthM: basePath.openMeters,
      }),
      newWorld: Object.freeze({
        endpoints: Object.freeze([best.newEnd0, best.newEnd1] as const),
        sourceLengthM: best.sourceLengthM,
        worldLengthM: best.placementLength,
        exposedLengthM: best.exposedLengthM,
      }),
      endpointContacts: Object.freeze([best.contact0, best.contact1] as const),
    });
    rehostedCount += 1;
  }

  return Object.freeze({
    seed,
    sourceCount,
    finalCount: sourceCount,
    inventoryIdentity: reconciliationD2.inventoryIdentity,
    sourceInventory,
    dispositions: Object.freeze(dispositions),
    unchangedCount,
    rehostedCount,
    roofRowsDeferred: 0,
    spanRowsDeferred: 0,
  });
}


/** Geometry, placement and text identity of one instanced pass. Colour treatment is excluded. */
export interface SkyriverGeometryIdentity {
  readonly towers: string;
  readonly towerAttributes: string;
  /** Source policy has its own hash. Existing geometry hashes remain unchanged. */
  readonly emissionPolicy: string;
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
  private readonly roofDetailDerivation: SkyriverRoofDetailDerivation;
  private readonly signs: SkyriverNeonSigns;
  private readonly towerSourceIndices: number[] = [];
  private readonly trimSourceIndices: number[] = [];
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
  private roofDetailLegacyDrawnCount = 0;
  private roofDetailDrawIndices = new Int32Array(0);
  private roofDetailUploadedByStratum: [number, number, number] = [0, 0, 0];
  private roofDetailHeroExcludedByStratum: [number, number, number] = [0, 0, 0];

  constructor({ layout, colourSwitch }: SkyriverCityOptions) {
    installSkyriverFogChunks();
    this.layout = layout;
    this.colourSwitch = colourSwitch;
    this.trims = deriveCityTrims(layout);
    this.roofDetailDerivation = deriveRoofDetails(layout);
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
    const heroColor = new THREE.Color();
    const heroUniforms = {
      blades: Array.from({ length: this.signs.heroCount }, (_, index) => {
        const owner = this.signs.owner[index]!;
        if (owner === null) fail('SKYRIVER_HERO_SIGN_OWNER');
        const world = placeNeonSign(owner, this.signs.cx[index]!, this.signs.cy[index]!, this.signs.cz[index]!,
          this.signs.nx[index]!, this.signs.nz[index]!);
        return new THREE.Vector4(world.x, world.y, world.z, this.signs.sh[index]! * .5);
      }),
      colors: heroBlades.map((b) => heroColor.setHex(b.color, THREE.SRGBColorSpace).clone()),
      count: heroBlades.length,
    };
    this.heroWorld = heroUniforms.blades.map((b) => b.clone());
    this.heroWorldColors = heroUniforms.colors.map((c) => c.clone());
    // R22: every hero takes its district's primary hue at its own final luminance, so the blade and
    // the spill it throws down the facade keep exactly the brightness they had before.
    for (let i = 0; i < this.heroWorldColors.length; i += 1) {
      const district = skyriverDistrictAt(this.districts, this.signs.anchorV[i]!);
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

  /** Read palette identities from the actual uploaded geometry attributes. No render or update. */
  windowPaletteEvidence(): {
    readonly towers: readonly { slot: number; layer: number; ownerQ: number; district: number; code: number; hash: number; meanUnit: readonly number[] }[];
    readonly cards: readonly { slot: number; layer: number; ownerQ: number; district: number; code: number; hash: number; meanUnit: readonly number[] }[];
  } {
    const towerOwner = this.towerMesh.geometry.getAttribute('aMaterial');
    const towerDistrict = this.towerMesh.geometry.getAttribute('aDistrict');
    const layer = this.towerMesh.geometry.getAttribute('aLayer');
    const card = this.impostorMesh.geometry.getAttribute('aCard');
    const towers = Array.from({ length: this.towerMesh.count }, (_, slot) => {
      const owner = towerOwner.getX(slot), district = towerDistrict.getX(slot);
      const code = windowPaletteCode(owner, district);
      return { slot, layer: layer.getX(slot), ownerQ: quantize(owner), district, code,
        hash: windowPaletteHash(code), meanUnit: windowPaletteMean(code) };
    });
    const cards = Array.from({ length: this.impostorMesh.count }, (_, slot) => {
      const ownerQ = decodeCard(card.getX(slot)).q, district = card.getW(slot);
      const code = windowPaletteCodeFromQ(ownerQ, district);
      return { slot, layer: card.getY(slot), ownerQ, district, code,
        hash: windowPaletteHash(code), meanUnit: windowPaletteMean(code) };
    });
    return { towers, cards };
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
        paneCells: 'Facade window cells on emitting near-city masses, from side area / (7.2 m x 5.4 m). Equipment is excluded. This is procedural source capacity, not a per-instance population.',
        roomCells: 'The same cells: a room is the traced interior of one pane cell inside the R19.7 fade window.',
        farCards: 'R16 impostor card instances in the far-city draw.',
      }),
    };
  }

  /** The derived suffix and the actual instance slots written after hero clearance. */
  getRoofDetailEvidence(): SkyriverRoofDetailEvidence {
    const uploadedSuffixCount = this.roofDetailUploadedByStratum[0]
      + this.roofDetailUploadedByStratum[1]
      + this.roofDetailUploadedByStratum[2];
    const records = this.roofDetailDerivation.records.map((record, recordIndex) => {
      const drawIndex = this.roofDetailDrawIndices[recordIndex] ?? -1;
      if (drawIndex >= 0) {
        return Object.freeze({ ...record, drawIndex, drawState: 'drawn' as const });
      }
      return Object.freeze({ ...record, drawIndex: null, drawState: 'hero-excluded' as const });
    });
    return Object.freeze({
      ...this.roofDetailDerivation,
      legacyDrawnCount: this.roofDetailLegacyDrawnCount,
      uploadedTotalCount: this.trimMesh.count,
      uploadedSuffixCount,
      uploadedByStratum: Object.freeze([...this.roofDetailUploadedByStratum]) as readonly [number, number, number],
      heroExcludedByStratum: Object.freeze([...this.roofDetailHeroExcludedByStratum]) as readonly [number, number, number],
      records: Object.freeze(records),
    });
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
        'R29 applies the building palette after the R22 pane, room and card recolour. These role saturations describe the R22 input. windowPaletteEvidence reports the actual building palette identities and means.',
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
      emissionPolicy: hex32(hashNumbers(0x811c9dc5, attribute(this.towerMesh, 'aEmissionAllowed'))),
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

  /** Raw source records for the uploaded sign audit. */
  signMountEvidence(): {
    readonly signs: SkyriverNeonSigns;
    readonly faces: readonly SkyriverFacadeFace[];
    readonly towers: readonly number[];
    readonly trims: readonly number[];
    readonly towerOwners: readonly SkyriverTrimOwner[];
    readonly trimOwners: readonly SkyriverTrimOwner[];
  } {
    const masses = deriveCityMasses(this.layout);
    return { signs: this.signs, faces: deriveFacadeFaces(this.layout),
      towers: this.towerSourceIndices.slice(), trims: this.trimSourceIndices.slice(),
      towerOwners: this.towerSourceIndices.map(index => {
        const mass = masses[index]!;
        return ownerOf({ ...mass, materialOwner: mass.materialOwner ?? mass.building ?? buildingSeedOf(mass.x, mass.z) }, mass.anchorV ?? mass.z);
      }),
      trimOwners: this.trimSourceIndices.map(index => this.trims.owner[index]!),
    };
  }

  // --- internals ----------------------------------------------------------------------------------

  private writeTowers(): void {
    const masses = deriveCityMasses(this.layout);
    const seedIndexMap = massSeedIndexCache.get(this.layout.seed);
    if (seedIndexMap === undefined) fail('SKYRIVER_CITY_SEED_INDEX_CACHE_MISSING');
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
    const emissionAllowed = new Float32Array(slots);
    this.drawnMassesByDistrict.fill(0);
    this.towerSourceIndices.length = 0;
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
      emissionAllowed[i] = mass.baseRecord?.kind === 'equipment'
        || mass.supportRole !== undefined
        || mass.crownRole === 'ordinary-dark-crown' || mass.artBacking !== undefined ? 0 : 1;
      // R22: the base building's own canyon anchor, so a slab, its tiers, its crowns and its annexes
      // always share one district. Never the warped world z this mass is drawn at.
      districts[i] = skyriverDistrictIdAt(this.districts, mass.anchorV ?? mass.z);
      this.drawnMassesByDistrict[districts[i]!] += 1;
      if ((mass.layer ?? 0) === 0 && emissionAllowed[i] === 1) {
        const sideArea = 2 * (mass.width + mass.depth) * mass.height;
        this.paneCellCapacity += Math.floor(sideArea / cellArea);
      }
      // T7-3: canyon space -> the winding loop. Each box keeps its shape, placed at its warped centre
      // and turned to the local canyon heading. R16: tiers and annexes ride their slab's frame.
      warpBoxPoint(mass, mass.x, mass.z, warp);
      quaternion.setFromAxisAngle(UP, warp.heading);
      position.set(warp.x, mass.y0 + mass.height * 0.5, warp.z);
      scale.set(mass.width, mass.height, mass.depth);
      matrix.compose(position, quaternion, scale);
      this.towerMesh.setMatrixAt(i, matrix);
      this.towerSourceIndices[i] = m;

      tint.setHex(mass.tint, THREE.SRGBColorSpace);
      tints[i * 3] = tint.r;
      tints[i * 3 + 1] = tint.g;
      tints[i * 3 + 2] = tint.b;

      sizes[i * 3] = mass.width;
      sizes[i * 3 + 1] = mass.height;
      sizes[i * 3 + 2] = mass.depth;

      // Seeded off the layout, not off a fresh stream: same seed, same facades, on every peer.
      let seedIndex = m;
      if (seedIndexMap.has(mass)) {
        const mappedIndex = seedIndexMap.get(mass);
        if (mappedIndex === undefined || !Number.isFinite(mappedIndex) || mappedIndex < 0) {
          fail('SKYRIVER_CITY_MASS_SEED_INDEX_MISSING');
        }
        seedIndex = mappedIndex;
      } else if (isLowBaseMass(mass)) {
        fail('SKYRIVER_CITY_MASS_SEED_INDEX_MISSING');
      }
      seeds[i] = hash1(mass.x * 0.173 + mass.z * 0.0411 + mass.height * 0.0017 + seedIndex * 0.37);
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
    this.towerMesh.geometry.setAttribute('aEmissionAllowed', new THREE.InstancedBufferAttribute(emissionAllowed, 1));
    this.towerMesh.geometry.setAttribute('aStepEdges', new THREE.InstancedBufferAttribute(stepEdges, 2));
    this.towerMesh.geometry.setAttribute('aDistrict', new THREE.InstancedBufferAttribute(districts, 1));
    // Culling off keeps the draw-call count fixed, which is what the A3 smoke test asserts.
    this.towerMesh.frustumCulled = false;
  }

  private writeTrims(): void {
    const { count, cy, sx, sy, sz, kind, seedValue } = this.trims;
    const { oldTrimCount, records } = this.roofDetailDerivation;
    const recordsByTrimIndex = new Map(records.map((record) => [record.trimIndex, record] as const));
    const drawIndices = new Int32Array(records.length);
    drawIndices.fill(-1);
    const uploadedByStratum: [number, number, number] = [0, 0, 0];
    const heroExcludedByStratum: [number, number, number] = [0, 0, 0];
    const heroBoxes = roofDetailHeroBoxCache.get(this.layout.seed) ?? [];
    const matrix = new THREE.Matrix4();
    const slots = Math.max(count, 1);
    const seeds = new Float32Array(slots);
    const materials = new Float32Array(slots);
    const kinds = new Float32Array(slots);
    const sizes = new Float32Array(slots * 3);
    const districts = new Float32Array(slots);
    const centres = new Float32Array(slots * 3);
    const axes = new Float32Array(slots * 3);
    this.drawnTrimsByKind.fill(0);
    this.drawnTrimsByDistrict.fill(0);
    this.trimSourceIndices.length = 0;

    // T7-3: clear space around the hero signs (see skyriverTrimBlocksHero).
    const heroes = deriveHeroBlades(this.layout);
    let drawn = 0;
    let legacyDrawnCount = -1;
    const placed: SkyriverTrimPlacement = { x: 0, z: 0, heading: 0, length: 0 };
    for (let i = 0; i < count; i += 1) {
      const detailRecord = recordsByTrimIndex.get(i);
      if (detailRecord === undefined && skyriverTrimBlocksHero(this.trims, i, heroes)) continue;
      // R16: rigid in the owner's frame (spans: each end on its own building). See placeTrim.
      placeTrim(this.trims, i, placed);
      const alongSpan = placed.length > 0 && sz[i]! >= sx[i]!;
      const acrossSpan = placed.length > 0 && sx[i]! > sz[i]!;
      const ex = acrossSpan ? placed.length : sx[i]!;
      const ez = alongSpan ? placed.length : sz[i]!;
      if (detailRecord !== undefined) {
        const drawnBox = roofDetailBox(placed.x, cy[i]!, placed.z, ex, sy[i]!, ez, placed.heading);
        if (roofDetailBlocksHero(drawnBox, heroBoxes)) {
          heroExcludedByStratum[roofDetailStratumIndex(detailRecord.stratum)] += 1;
          continue;
        }
        if (legacyDrawnCount < 0) legacyDrawnCount = drawn;
      } else if (i === oldTrimCount) {
        legacyDrawnCount = drawn;
      }
      quaternion.setFromAxisAngle(UP, placed.heading);
      position.set(placed.x, cy[i]!, placed.z);
      scale.set(ex, sy[i]!, ez);
      matrix.compose(position, quaternion, scale);
      this.trimMesh.setMatrixAt(drawn, matrix);
      this.trimSourceIndices[drawn] = i;
      seeds[drawn] = seedValue[i]!;
      const owner = this.trims.owner[i]!;
      materials[drawn] = trimMaterialOwnerSeed(owner);
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
      if (detailRecord !== undefined) {
        const recordIndex = i - oldTrimCount;
        drawIndices[recordIndex] = drawn;
        uploadedByStratum[roofDetailStratumIndex(detailRecord.stratum)] += 1;
      }
      drawn += 1;
    }
    if (legacyDrawnCount < 0) legacyDrawnCount = drawn;
    this.roofDetailLegacyDrawnCount = legacyDrawnCount;
    this.roofDetailDrawIndices = drawIndices;
    this.roofDetailUploadedByStratum = uploadedByStratum;
    this.roofDetailHeroExcludedByStratum = heroExcludedByStratum;
    this.trimMesh.count = drawn;
    this.trimWorldCentres = centres.slice(0, drawn * 3);
    this.trimDrawnAxis = axes.slice(0, drawn * 3);
    this.trimDrawnKind = kinds.slice(0, drawn);
    this.trimDrawnSize = sizes.slice(0, drawn * 3);
    this.trimDrawnDistrict = districts.slice(0, drawn);
    this.trimDrawnSeed = seeds.slice(0, drawn);

    this.trimMesh.instanceMatrix.needsUpdate = true;
    this.trimMesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    this.trimMesh.geometry.setAttribute('aMaterial', new THREE.InstancedBufferAttribute(materials, 1));
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
      const world = placeNeonSign(this.signs.owner[i]!, cx[i]!, cy[i]!, cz[i]!, nx[i]!, nz[i]!);
      centres[i * 3] = world.x;
      centres[i * 3 + 1] = world.y;
      centres[i * 3 + 2] = world.z;
      normals[i * 2] = world.nx;
      normals[i * 2 + 1] = world.nz;
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

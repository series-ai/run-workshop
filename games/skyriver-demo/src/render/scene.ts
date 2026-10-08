/**
 * @file scene.ts — renderer, camera, quality tiers, and the frame pump the rest of the render layer
 *                  hangs off.
 *
 * Plan anchors (.plans/skyriver-syncplay-demo.html):
 *   R3/R4 — <= 16 draw calls total; city and atmosphere are T3's, traffic is T4's <= 4.
 *   R7    — "Quality tiers: DPR 1.5 -> 1.25 -> 1.0, cars 2,400 -> 1,200 -> 600, god rays on -> off —
 *            presentation-only." Tier values below are exactly those.
 *   R9/A3 — Playwright smoke reads `renderer.info.render.calls` and the instance counts; `debug()`
 *           hands both over in one object.
 *   Design "Sim <-> render split" — `update()` consumes a SkyriverProjection and never writes back.
 *   T3    — "GPU adapter logging"; T5 owns the log line, this module supplies the strings.
 *
 * Ownership. T3 owns city.ts, atmosphere.ts and this file. T4 (traffic) and T5 (runner, camera rig,
 * HUD) do not exist yet, so the types they need are defined here:
 *   - `SkyriverQualityTier` / `SkyriverQualitySettings` / `SKYRIVER_QUALITY` — the tier table.
 *   - `SkyriverFrame` / `SkyriverFrameListener` — the per-frame contract.
 *   - `SKYRIVER_TRAFFIC_DRAW_CALL_BUDGET` — T4's share of the budget.
 * T5 should reconcile these into their final home if the runner wiring wants them elsewhere; see the
 * worker report. Nothing here imports from a T4/T5 file.
 *
 * Camera ownership. This module creates and resizes the PerspectiveCamera but never moves it: the
 * chase-cam is T5's `cameraRig.ts`, and the plan requires that smoothing be a pure function of
 * (previous projection, current projection, alpha) with an explicit reset on restore. T5 writes
 * `scene.camera` before calling `update()`.
 *
 * WebGL is touched only inside the constructor, so importing this module under node (vitest) is
 * safe. The pure helpers (`skyriverQualityFor`, `skyriverDrawCallEstimate`) run anywhere.
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { deriveCityLayout, type SkyriverCityLayout } from '../sim/derive';
import type { SkyriverProjection } from '../sim/runtime';
import { SKYRIVER_TICK_RATE } from '../sim/systems';
import {
  SkyriverAtmosphere,
  SKYRIVER_ATMOSPHERE_DRAW_CALL_BUDGET,
  SKYRIVER_EXPOSURE,
  setSkyriverFogBypass,
  skyriverBeamRecord,
  skyriverFogBypassed,
} from './atmosphere';
import { SkyriverCity, SKYRIVER_CITY_DRAW_CALL_BUDGET, type SkyriverInteriorMode } from './city';
import { SkyriverDistrictColourSwitch } from './districts';
import { SkyriverDepthSnapshot } from './depthFade';
import { presentCityLayout } from './presentationLayout';
import {
  SKYRIVER_LIGHT_ROLE_IMPORTANCE,
  SKYRIVER_SCATTER_SPHERE_SR,
  SkyriverLightSelection,
  skyriverBuildLightPool,
  skyriverLightPoolDuplicates,
  skyriverLightSourceIdCollisions,
  type SkyriverRenderLightSource,
  type SkyriverSelectedLight,
} from './renderLightSet';
import { SkyriverSmog, SKYRIVER_SMOG_HIGH_MAX } from './smog';
import {
  SkyriverDepthProbe,
  SkyriverOpaquePass,
  SkyriverStageRegistry,
  SkyriverTransparentPass,
  type SkyriverStageCoverage,
  type SkyriverStageFlags,
} from './stageRoles';
import {
  SkyriverThreeMipBloomPass,
  SKYRIVER_BLOOM_DRAWS,
  SKYRIVER_BLOOM_MIPS,
  SKYRIVER_LEGACY_BLOOM_DRAWS,
  SKYRIVER_LEGACY_BLOOM_MIPS,
  skyriverLegacyBloomEvidence,
  type SkyriverBloomEvidence,
} from './threeMipBloom';
import {
  SkyriverVolumeFogPass,
  SKYRIVER_NEUTRAL_FOG_PROFILE,
  SKYRIVER_VOLUME_HIGH_STEPS_MAX,
  SKYRIVER_VOLUME_HIGH_STEPS_MIN,
  SKYRIVER_VOLUME_NORMAL_DRAWS,
  SKYRIVER_VOLUME_PROFILES,
  skyriverDistrictFogProfileFrom,
  type SkyriverDistrictFogProfile,
  type SkyriverVolumeFogStats,
  type SkyriverVolumeHistoryReset,
  type SkyriverVolumeInvocationRecord,
  type SkyriverVolumeProfile,
} from './volumeFog';

/** Bloom pickup spans a broad luminance range. */
export const SKYRIVER_BLOOM_PICKUP_WIDTH = 0.2;

/** Plan R3: 16 total. The approved night look spends less — the hard ceiling we hold to is 12. */
/**
 * T6: raised from 12 to 14 — the shuttle now renders through its own module (render/shuttle.ts) as
 * 2 draw calls (hull + additive plume), replacing T5's provisional 1-call marker. The plan's R3
 * hard ceiling stays 16; this leaves headroom while keeping the tiers' estimates honest.
 */
export const SKYRIVER_TOTAL_DRAW_CALL_BUDGET = 18;
/**
 * T7: the operator raised the frame ceiling to 32 calls, counted across every pass. The scene keeps
 * its 14-call budget above; the post chain adds RenderPass (the scene), UnrealBloomPass (1 bright
 * pass + 5 mips x 2 blurs + 1 composite + 1 blend = 13 full-screen draws) and OutputPass (1).
 */
export const SKYRIVER_FRAME_DRAW_CALL_CEILING = 32;
/**
 * R23 frame draw budget. These are the DECLARED per-pass draw counts, summed; the acceptance
 * evidence is `renderer.info.render.calls` from a real browser frame, which is the only thing that
 * counts a draw the GPU actually made.
 *
 * Legacy (R23 off, or Low): one RenderPass over the whole scene (18 draws at high), the five-level
 * bloom (13) and OutputPass (1) = 32 — the ceiling, exactly.
 * Staged (R23 on, high/medium): the same 18 scene draws split across the opaque and transparent
 * stages, plus one smog batch (19), two volume draws, the three-level bloom (9) and OutputPass
 * (1) = 31. Splitting the traversal costs CPU, not draws: each declared mesh still draws once.
 *
 * The one-call reserve is not permission to add an unplanned pass.
 */
export const SKYRIVER_R23_STAGED_POST_DRAWS = SKYRIVER_VOLUME_NORMAL_DRAWS + SKYRIVER_BLOOM_DRAWS + 1;
export const SKYRIVER_R23_LEGACY_POST_DRAWS = SKYRIVER_LEGACY_BLOOM_DRAWS + 1;

/** The R23 presentation composition. `legacy` is the verified R22 chain, unchanged. */
export type SkyriverCompositionMode = 'legacy' | 'staged';

/**
 * The selectable presentation chain. Exactly one is active, and it is presentation only: none of
 * these values touches source state, exposure, tone mapping, the density field or the R22 district
 * colour flag.
 *
 *  - `r23-staged`  — the default. High and medium draw the full R23 chain (staged scene, marched
 *                    volume, drifting smog, three-level bloom); Low keeps its legacy analytic frame.
 *  - `legacy-five` — the verified R22 analytic scene on every tier, with all five original bloom
 *                    samplers. This is the R23 off path.
 *  - `three-only`  — DIAGNOSTIC. The same R22 analytic scene, with the volume fog and the smog off,
 *                    drawn through the actual three-level bloom. It exists so the bloom level count
 *                    can be compared on its own: against `legacy-five` the only variable is the
 *                    bloom implementation, and against `r23-staged` the only variable is the fog.
 */
export type SkyriverPresentationChain = 'r23-staged' | 'legacy-five' | 'three-only';

/** The chain a frame draws by default. `setPresentationChain` restores exactly this. */
export const SKYRIVER_DEFAULT_PRESENTATION_CHAIN: SkyriverPresentationChain = 'r23-staged';

/**
 * Which passes run, which bloom, and how much volume and smog, for one tier and one chain.
 *
 * Pure: data in, data out. The scene applies this plan and reports it, so there is one place that
 * decides the composition and a node check can assert the off and Low guarantees directly —
 * without a GL context and without reading `enabled` flags back off a live composer.
 */
/** Why a frame could not be staged, when the chain and the tier would have allowed it. */
export type SkyriverStagingBlocker = 'no-opaque-depth';

export interface SkyriverCompositionPlan {
  readonly chain: SkyriverPresentationChain;
  readonly mode: SkyriverCompositionMode;
  readonly legacyRenderPass: boolean;
  readonly opaquePass: boolean;
  readonly volumePass: boolean;
  readonly transparentPass: boolean;
  readonly threeMipBloom: boolean;
  readonly legacyBloom: boolean;
  readonly bloomMips: number;
  readonly bloomDraws: number;
  readonly volumeProfile: SkyriverVolumeProfile;
  /**
   * The step count the volume pass is told to run, after the tuning override and the profile's own
   * limits. The plan resolves it, so a tuning measurement cannot record a count that was not drawn.
   */
  readonly volumeSteps: number;
  readonly clouds: number;
  readonly analyticFogInOpaqueStage: boolean;
  readonly postDraws: number;
  /** Whether a valid opaque depth snapshot can exist this frame. An input, reported back. */
  readonly depthAvailable: boolean;
  /**
   * Set when the chain and the tier asked for the staged frame and it could not be drawn. The
   * frame then runs the legacy analytic path — the honest fallback — and this names the cause.
   */
  readonly stagingBlocker: SkyriverStagingBlocker | null;
}

/**
 * Clamps a requested step count the way the pass does, so the plan's number is the drawn number.
 *
 * High accepts 8..12 (R23 may run 12 only if the measured frame still fits the gate); every other
 * staged profile keeps its own count, and the off profile marches nothing at all.
 */
function resolveVolumeSteps(profile: SkyriverVolumeProfile, override: number | null): number {
  if (profile.id === 'off') return 0;
  if (override === null || !Number.isFinite(override)) return profile.steps;
  if (profile.id === 'high') {
    return Math.min(
      SKYRIVER_VOLUME_HIGH_STEPS_MAX,
      Math.max(SKYRIVER_VOLUME_HIGH_STEPS_MIN, Math.round(override)),
    );
  }
  return Math.max(1, Math.round(override));
}

/** Clamps a requested cloud count into the batch's allocated capacity. Zero when nothing is staged. */
function resolveClouds(profile: SkyriverVolumeProfile, override: number | null): number {
  if (profile.id === 'off') return 0;
  if (override === null || !Number.isFinite(override)) return profile.clouds;
  return Math.max(0, Math.min(SKYRIVER_SMOG_HIGH_MAX, Math.round(override)));
}

export function skyriverCompositionPlan(input: {
  readonly tier: SkyriverQualityTier;
  /** The selected presentation chain. `r23-staged` is the default. */
  readonly chain: SkyriverPresentationChain;
  readonly bloomEnabled: boolean;
  /**
   * Whether a valid opaque depth snapshot can exist for this frame.
   *
   * The staged frame REQUIRES one: the marcher reads it to find where each ray ends, the bilateral
   * upsampler reads it to reject taps across a silhouette, and the opaque stage has already
   * bypassed the shared analytic haze on the promise that the marcher will replace it. Without
   * depth, marching the full bounded range through every wall lays a fog and scatter sheet in
   * front of near geometry — so the plan falls back to the legacy analytic path instead, and says
   * why in `stagingBlocker`. Defaults to true so a caller that cannot know keeps the old answer.
   */
  readonly depthAvailable?: boolean;
  /** Tuning override for the step count, or null for the profile's own. Owned by the scene. */
  readonly stepsOverride?: number | null;
  /** Tuning override for the cloud count, or null for the profile's own. Owned by the scene. */
  readonly cloudsOverride?: number | null;
}): SkyriverCompositionPlan {
  // Low is always legacy: its tier keeps the analytic scene, no volume, no clouds, and its own
  // bloom-off behaviour. High and medium are staged only on the default chain — and only with a
  // valid opaque depth snapshot to march against.
  const depthAvailable = input.depthAvailable ?? true;
  const requested = input.chain === 'r23-staged' && input.tier !== SkyriverQualityTier.Low;
  const staged = requested && depthAvailable;
  const stagingBlocker: SkyriverStagingBlocker | null =
    requested && !depthAvailable ? 'no-opaque-depth' : null;
  const volumeProfile = !staged
    ? SKYRIVER_VOLUME_PROFILES.off
    : input.tier === SkyriverQualityTier.High
      ? SKYRIVER_VOLUME_PROFILES.high
      : SKYRIVER_VOLUME_PROFILES.medium;

  // The three-level bloom runs on the staged chain, and on the diagnostic chain that exists to draw
  // it over the legacy analytic scene. Nothing else may claim it.
  const threeMipBloom = (staged || input.chain === 'three-only') && input.bloomEnabled;
  // The off path restores the original five-level pass with all five of its samplers. Its `nMips`
  // is never touched: its composite shader samples five textures unconditionally, so lowering nMips
  // alone would leave three samplers bound to targets it no longer blurs.
  const legacyBloom = !threeMipBloom && input.bloomEnabled;
  const bloomDraws = threeMipBloom
    ? SKYRIVER_BLOOM_DRAWS
    : legacyBloom ? SKYRIVER_LEGACY_BLOOM_DRAWS : 0;

  return {
    chain: input.chain,
    mode: staged ? 'staged' : 'legacy',
    legacyRenderPass: !staged,
    opaquePass: staged,
    volumePass: staged,
    transparentPass: staged,
    threeMipBloom,
    legacyBloom,
    // The mips of the bloom that actually runs. Zero when neither does, so a bloom-off frame cannot
    // report a level count it never drew.
    bloomMips: threeMipBloom
      ? SKYRIVER_BLOOM_MIPS
      : legacyBloom ? SKYRIVER_LEGACY_BLOOM_MIPS : 0,
    bloomDraws,
    volumeProfile,
    volumeSteps: resolveVolumeSteps(volumeProfile, input.stepsOverride ?? null),
    clouds: resolveClouds(volumeProfile, input.cloudsOverride ?? null),
    // The analytic haze is bypassed only inside the staged opaque stage, where the marcher owns
    // absorption. Legacy keeps it everywhere, which is what makes the off path the R22 scene.
    analyticFogInOpaqueStage: !staged,
    // Volume draws + bloom draws + OutputPass.
    postDraws: (staged ? SKYRIVER_VOLUME_NORMAL_DRAWS : 0) + bloomDraws + 1,
    depthAvailable,
    stagingBlocker,
  };
}
/**
 * True when the presented moment `(tick, alpha)` is EARLIER than `(previousTick, previousAlpha)`.
 *
 * Pure, and it compares the pair, not the tick alone: a replay seek inside one tick lowers alpha
 * while the tick stands still, and the presented time `(tick + alpha) / rate` really does move
 * backwards there. A frozen frame — the same tick and the same alpha twice — is NOT a reversal, so
 * the convergence capture's repeated draws never reset anything.
 *
 * A non-finite previous pair is "nothing presented yet", which cannot be a reversal.
 */
export function skyriverSourceTimeReversed(
  previousTick: number,
  previousAlpha: number,
  tick: number,
  alpha: number,
): boolean {
  if (!Number.isFinite(previousTick) || !Number.isFinite(previousAlpha)) return false;
  if (!Number.isFinite(tick) || !Number.isFinite(alpha)) return false;
  if (tick < previousTick) return true;
  return tick === previousTick && alpha < previousAlpha;
}

/**
 * Which bloom implementation a frame enables. Pure, and the only place that decision is made.
 *
 * The frame pump re-applies this on every `update`, from the plan. That is what makes a selected
 * chain survive: a pass flag derived from anything other than the plan would be overwritten on the
 * next frame. Exactly one flag can ever be true, whatever the eased bloom level is doing.
 */
export function skyriverBloomEnableFlags(
  plan: Pick<SkyriverCompositionPlan, 'legacyBloom' | 'threeMipBloom'>,
  bloomLive: boolean,
): { readonly legacy: boolean; readonly threeMip: boolean } {
  return {
    legacy: plan.legacyBloom && bloomLive,
    threeMip: plan.threeMipBloom && bloomLive,
  };
}

/** Bloom strength at full level (R14 tuning). */
const SKYRIVER_BLOOM_STRENGTH = 0.85;
/** T4's share (plan R4: "<= 4 traffic draw calls"). Defined here so T4 can import it on day one. */
/** T7-5: six hull archetypes + one light batch (frame ceiling 32 still holds: 16 scene + 14 post + 1). */
/** R18: + the GPU impostor batch (9); the beams merged into one call to pay for it. */
export const SKYRIVER_TRAFFIC_DRAW_CALL_BUDGET = 9;

/** Presentation-only quality tiers (plan R7). Never reaches simulation. */
export enum SkyriverQualityTier {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export interface SkyriverQualitySettings {
  readonly tier: SkyriverQualityTier;
  /** Traffic instance count for T4. */
  readonly cars: number;
  /** God-ray pass on or off (plan R7). */
  readonly godRays: boolean;
  /** Screen-space rain streaks. Top tier only: it is the one effect that costs a full-screen pass. */
  readonly rainStreaks: boolean;
  /** Device-pixel-ratio clamp. */
  readonly dpr: number;
  /**
   * T7 post bloom: 'full' at the high tier, 'half' renders the bloom chain at half resolution
   * (medium), 'off' skips the bloom pass (low). The composer itself always runs (T7-2), so the low
   * tier keeps the same single ACES tone map as the others for one extra full-screen draw.
   */
  readonly bloom: SkyriverBloomMode;
  /** T7-4 interior mapping: 'full' (high), 'near' fade window (medium), 'off' emissive panes (low). */
  readonly interiors: SkyriverInteriorMode;
}

export type SkyriverBloomMode = 'full' | 'half' | 'off';

export const SKYRIVER_QUALITY: Readonly<Record<SkyriverQualityTier, SkyriverQualitySettings>> =
  Object.freeze({
    [SkyriverQualityTier.High]: Object.freeze({
      tier: SkyriverQualityTier.High,
      cars: 2400,
      godRays: true,
      rainStreaks: true,
      dpr: 1.5,
      bloom: 'full',
      interiors: 'full',
    }),
    [SkyriverQualityTier.Medium]: Object.freeze({
      tier: SkyriverQualityTier.Medium,
      cars: 1200,
      godRays: true,
      rainStreaks: false,
      dpr: 1.25,
      bloom: 'half',
      interiors: 'near',
    }),
    [SkyriverQualityTier.Low]: Object.freeze({
      tier: SkyriverQualityTier.Low,
      cars: 600,
      godRays: false,
      rainStreaks: false,
      dpr: 1.0,
      bloom: 'off',
      interiors: 'off',
    }),
  });

/** Highest first, so T6's degrade loop can walk it. */
export const SKYRIVER_QUALITY_ORDER: readonly SkyriverQualityTier[] = Object.freeze([
  SkyriverQualityTier.High,
  SkyriverQualityTier.Medium,
  SkyriverQualityTier.Low,
]);

export function skyriverQualityFor(tier: SkyriverQualityTier): SkyriverQualitySettings {
  return SKYRIVER_QUALITY[tier];
}

/** The next tier down, or null at the floor. */
export function skyriverNextTierDown(tier: SkyriverQualityTier): SkyriverQualityTier | null {
  const index = SKYRIVER_QUALITY_ORDER.indexOf(tier);
  if (index < 0 || index + 1 >= SKYRIVER_QUALITY_ORDER.length) return null;
  return SKYRIVER_QUALITY_ORDER[index + 1];
}

/**
 * What every render module gets each frame.
 *
 * One instance is reused for the life of the scene, so nothing in the update path allocates (plan
 * R7's CPU-millisecond budget). Treat it as valid only for the duration of the listener call.
 */
export interface SkyriverFrame {
  /** Confirmed sim tick (30 Hz). */
  readonly tick: number;
  /** Interpolation fraction into the next tick, 0 .. 1. T4 evaluates traffic at tick + alpha. */
  readonly alpha: number;
  /** Seconds of simulated time, `(tick + alpha) / SKYRIVER_TICK_RATE`. Drives every shader clock. */
  readonly time: number;
  /** Wall-clock seconds since the previous update, clamped. For cosmetic easing only. */
  readonly dt: number;
  /** Null before the runner produces its first projection. */
  readonly projection: SkyriverProjection | null;
  /**
   * R22: the presented canyon route position, metres, exactly as the flight presenter produced it
   * for this frame. The runner owns it; T5 writes it with `setRoutePosition` before `update`. It is
   * the only coordinate the colour districts are ever queried with — never a warped world z.
   */
  readonly routeV: number;
  readonly camera: THREE.PerspectiveCamera;
  readonly quality: SkyriverQualitySettings;
}

export type SkyriverFrameListener = (frame: SkyriverFrame) => void;

type MutableFrame = {
  -readonly [K in keyof SkyriverFrame]: SkyriverFrame[K];
};

export interface SkyriverSceneOptions {
  readonly canvas: HTMLCanvasElement;
  /** Session seed. Drives `deriveCityLayout`, so every peer builds the same canyon. */
  readonly seed: number;
  readonly tier?: SkyriverQualityTier;
  /** Overrides the tier's DPR clamp. T6 uses this to walk DPR without changing tier. */
  readonly maxPixelRatio?: number;
}

export interface SkyriverDrawCallEstimate {
  readonly city: number;
  readonly atmosphere: number;
  /** T4's budget, not a measurement: traffic does not exist yet. */
  readonly trafficBudget: number;
  /** R23: the one instanced smog batch. One draw at any instance count, zero on Low. */
  readonly smog: number;
  readonly total: number;
  readonly budget: number;
  readonly withinBudget: boolean;
}

/**
 * Reasoned draw-call maths, with no GL context needed.
 *
 * Every pass in T3 is a single instanced mesh with frustum culling off, so the count is fixed and
 * does not move with instance counts. That is deliberate: A3 asserts a draw-call ceiling, and a
 * count that drifts with the camera would make that assertion flaky.
 */
export function skyriverDrawCallEstimate(
  quality: SkyriverQualitySettings,
): SkyriverDrawCallEstimate {
  // towers + trim + neon signs + R16 far-city impostor cards
  const city = 4;
  // skydome + the shared beam field (R18: searchlights and god rays in one call), plus rain streaks
  const atmosphere = 2 + (quality.rainStreaks ? 1 : 0);
  // R23: one instanced batch, so the count does not move with the cloud instance count. Low has
  // no clouds at all, and the R23 off switch hides the batch on every tier.
  const smog = quality.tier === SkyriverQualityTier.Low ? 0 : 1;
  const total = city + atmosphere + SKYRIVER_TRAFFIC_DRAW_CALL_BUDGET + smog;
  return {
    city,
    atmosphere,
    trafficBudget: SKYRIVER_TRAFFIC_DRAW_CALL_BUDGET,
    smog,
    total,
    budget: SKYRIVER_TOTAL_DRAW_CALL_BUDGET,
    withinBudget: total <= SKYRIVER_TOTAL_DRAW_CALL_BUDGET,
  };
}

export interface SkyriverRenderDebug {
  /** Straight from `renderer.info.render` — what A3 asserts against. */
  readonly calls: number;
  readonly triangles: number;
  readonly programs: number;
  readonly geometries: number;
  readonly textures: number;
  readonly instances: {
    readonly towers: number;
    readonly trims: number;
    readonly signs: number;
    readonly godRays: number;
    readonly searchlights: number;
  };
  readonly drawCalls: SkyriverDrawCallEstimate;
  readonly pixelRatio: number;
  readonly tier: SkyriverQualityTier;
}

/**
 * GPU identification for the plan's adapter log.
 *
 * EXT_debug expectation: P1-9 requires the adapter string in the A3/A4 evidence so a SwiftShader
 * run cannot be mistaken for a GPU-backed one, and R7 wants GPU milliseconds from
 * `EXT_disjoint_timer_query_webgl2` "where available". Both extensions are optional and absent in
 * an Android WebView more often than not, so every field here is nullable and `timerQuery` is a
 * capability flag, never an assumption. T5 owns the log line; this method only reports.
 */
export interface SkyriverGlDiagnostics {
  readonly vendor: string | null;
  readonly renderer: string | null;
  readonly version: string | null;
  readonly debugRendererInfo: boolean;
  readonly timerQuery: boolean;
}

/**
 * Every active rendering setting, for the R22 A/B evidence.
 *
 * `districtAllowed` is the only field the colour switch may move: the paired proof hashes this whole
 * record and removes that one name, so the emitted colours live in the city's source evidence and
 * the haze tint in the atmosphere's haze evidence, never here.
 */
export interface SkyriverRenderSettings {
  readonly tier: SkyriverQualityTier;
  readonly bloom: SkyriverBloomMode;
  readonly bloomEnabled: boolean;
  readonly bloomAllowed: boolean;
  readonly bloomStrength: number;
  readonly bloomRadius: number;
  readonly bloomThreshold: number;
  readonly bloomSmoothWidth: number;
  readonly roomMode: SkyriverInteriorMode;
  readonly roomModeAllowed: boolean;
  readonly roomFade: readonly [number, number];
  readonly roomStrength: number;
  readonly farMode: 'impostor' | 'geometry';
  readonly districtAllowed: boolean;
  readonly contactAllowed: boolean;
  readonly murkAllowed: boolean;
  readonly depthFadeAllowed: boolean;
  readonly depthFadeEnabled: boolean;
  readonly godRays: boolean;
  readonly rainStreaks: boolean;
  readonly cars: number;
  readonly pixelRatio: number;
  readonly maxPixelRatio: number;
  readonly cssSize: readonly [number, number];
  readonly drawingBufferSize: readonly [number, number];
  readonly exposure: number;
  readonly toneMapping: number;
  readonly outputColorSpace: string;
  readonly fov: number;
  readonly near: number;
  readonly far: number;
  readonly projectionScale: number;
  readonly uniforms: Readonly<Record<string, number | readonly number[]>>;
  /**
   * R23 presentation state, extended onto the one real settings record rather than reported from a
   * second competing model. `volumeAllowed` is the reversible R23 on/off control; everything below
   * it is read from the live passes, so this record cannot claim a mode the frame did not draw.
   */
  readonly volumeAllowed: boolean;
  /** The selected chain. `volumeAllowed` is the R23 A/B view of this same one value. */
  readonly presentationChain: SkyriverPresentationChain;
  readonly composition: SkyriverCompositionMode;
  /** Set when the staged frame was asked for and refused. See `SkyriverStagingBlocker`. */
  readonly stagingBlocker: SkyriverStagingBlocker | null;
  readonly opaqueDepthAvailable: boolean;
  readonly bloomMips: number;
  readonly bloomDraws: number;
  readonly volumeEnabled: boolean;
  readonly volumeProfile: string;
  readonly volumeSteps: number;
  readonly volumeSpatialScale: number;
  readonly volumeSize: readonly [number, number];
  readonly volumeRangeM: number;
  readonly volumeSelectedLights: number;
  readonly volumeHistoryValid: boolean;
  readonly volumeHistoryResets: number;
  readonly cloudsEnabled: boolean;
  readonly cloudCount: number;
  readonly cloudCapacity: number;
  readonly analyticFogBypassed: boolean;
  readonly stageRoleCount: number;
  readonly sceneDraws: number;
  readonly postDraws: number;
  readonly frameDrawEstimate: number;
}

/**
 * Longest frame we will INTEGRATE. A backgrounded WebView must not produce one giant dt.
 *
 * Exported because it is a boundary other policies have to respect: it is smaller than
 * `SKYRIVER_VOLUME_HISTORY_MAX_DELTA_S`, so a history policy fed this clamped value could never
 * see a pause. The volume history is given the unclamped wall delta instead.
 */
export const SKYRIVER_MAX_FRAME_DT_S = 1 / 15;
const MAX_FRAME_DT_S = SKYRIVER_MAX_FRAME_DT_S;

export class SkyriverScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly layout: SkyriverCityLayout;
  readonly city: SkyriverCity;
  readonly atmosphere: SkyriverAtmosphere;
  readonly depthFade: SkyriverDepthSnapshot;

  /** R23: the drifting smog batch. One mesh, one material, one draw whatever the count. */
  readonly smog: SkyriverSmog;
  /** R23: the one owner of declared opaque/transparent draw roles. */
  readonly stageRoles = new SkyriverStageRegistry();

  private quality: SkyriverQualitySettings;
  private maxPixelRatio: number;
  private readonly composer: EffectComposer;
  private readonly bloomPass: UnrealBloomPass;
  /** R23: the three-level replacement, so the staged frame fits inside 32 draws. */
  private readonly bloom3Pass: SkyriverThreeMipBloomPass;
  private readonly legacyRenderPass: RenderPass;
  private readonly opaquePass: SkyriverOpaquePass;
  private readonly volumePass: SkyriverVolumeFogPass;
  private readonly transparentPass: SkyriverTransparentPass;
  /** Diagnostic depth-content probe. Owns its target; its draws are never normal frame draws. */
  private readonly depthProbe = new SkyriverDepthProbe();
  /** The armed in-frame depth-content probe, or null. See `armStageDepthProbe`. */
  private stageProbe: {
    armed: boolean;
    afterOpaque: ReturnType<SkyriverDepthProbe['pack']> | null;
    afterVolume: ReturnType<SkyriverDepthProbe['pack']> | null;
  } | null = null;
  /**
   * The selected presentation chain. `setPresentationChain` is its one writer and
   * `SKYRIVER_DEFAULT_PRESENTATION_CHAIN` is what it restores.
   */
  private chain: SkyriverPresentationChain = SKYRIVER_DEFAULT_PRESENTATION_CHAIN;
  /**
   * The applied plan. `applyComposition` is its one writer, and it writes on every state change
   * and once per frame, so the passes read the decision the frame was actually built on.
   */
  private livePlan: SkyriverCompositionPlan;
  private lightPool: readonly SkyriverRenderLightSource[] = [];
  private lightSelection: SkyriverLightSelection | null = null;
  private selectedLights: readonly SkyriverSelectedLight[] = [];
  private readonly beamScratch = skyriverBeamRecord();
  private districtProfile: SkyriverDistrictFogProfile = SKYRIVER_NEUTRAL_FOG_PROFILE;
  /** The held-tint version `districtProfile` was built from. -1 means "nothing built yet". */
  private districtProfileVersion = -1;
  /**
   * The presented source moment the last `update` drew, so the next one can see it move backwards.
   * Null until the first frame.
   */
  private presentedTime: { tick: number; alpha: number } | null = null;
  private sourceReversalCount = 0;
  private readonly sourceReversals: {
    readonly fromTick: number;
    readonly fromAlpha: number;
    readonly toTick: number;
    readonly toAlpha: number;
    readonly atMs: number;
  }[] = [];
  /** Debug/A-B override: false forces the bloom chain off regardless of tier. */
  private bloomAllowed = true;
  /**
   * Tuning overrides, held as scene state and read by the plan. Null is "the profile's own value".
   *
   * They are NOT written straight to the pass: two writers of the same step count is how a tuning
   * measurement came to record a step count that was never drawn.
   */
  private volumeStepsOverride: number | null = null;
  private cloudCountOverride: number | null = null;
  /**
   * R22: the one colour-switch flag for the whole scene. The city and the atmosphere receive it and
   * read it; `setDistrictAllowed` is the only write, so a frame can never be half switched.
   */
  private readonly colourSwitch = new SkyriverDistrictColourSwitch();
  private bloomLevel = 0;
  private interiorsAllowed = true;
  private readonly listeners: SkyriverFrameListener[] = [];
  private readonly frame: MutableFrame;
  private lastUpdateMs: number | null = null;
  private readonly scratchSize = new THREE.Vector2();
  private width = 1;
  private height = 1;

  constructor({ canvas, seed, tier = SkyriverQualityTier.High, maxPixelRatio }: SkyriverSceneOptions) {
    this.quality = SKYRIVER_QUALITY[tier];
    this.maxPixelRatio = maxPixelRatio ?? this.quality.dpr;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      // Off on purpose: MSAA is the single most expensive thing we could switch on, and the night
      // look leans on dithering and the haze instead (plan R7, Galaxy S23 gate).
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
      // The smoke test reads back the canvas to prove it is not black.
      preserveDrawingBuffer: false,
    });
    this.renderer.setClearColor(0x04060b, 1);
    // ACES rolls the neon highlights off instead of clipping them to white. With the T7 composer,
    // the scene renders linear HDR into a half-float target (three skips tone mapping and the sRGB
    // transfer for render targets), bloom runs on that HDR, and OutputPass applies ACES + sRGB once.
    // On the 'off' tier the scene renders straight to the canvas and the same chunks apply inline.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // R14 darkness pass: the grey wash came from base tones (concrete, pristine glass sheet, dim
    // rooms) that land at 40-70/255 after ACES + sRGB even at tiny linear values. Those went near
    // black (city.ts); exposure then rises 1.35 -> 2.2 so the emissives, not the walls, carry the mids
    // (measured: p5 2-10, p50 30-48, <=12 share 8-20% across the coordinator's four timestamps).
    // R16 ambient III: exposure back to 1.9 with every emissive raised by 2.2 / 1.9 (atmosphere.ts),
    // so base tones fall while lights hold (measured series in the R16 report).
    this.renderer.toneMappingExposure = SKYRIVER_EXPOSURE;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = true;
    // Count draw calls across every pass of a frame (reset by hand in update()).
    this.renderer.info.autoReset = false;

    this.scene = new THREE.Scene();
    this.scene.name = 'skyriver';

    // No Light objects: every T3 material is unlit or emissive, so lights would only force longer
    // shader permutations. T4 should stay unlit for the same reason.
    this.camera = new THREE.PerspectiveCamera(62, 1, 1, 14000);
    this.camera.name = 'skyriver.camera';

    // T6R: the drawn canyon is the derived layout raised above the flight ceiling and lengthened
    // (presentationLayout.ts). Every T3 pass reads this one layout, so they stay consistent.
    this.layout = presentCityLayout(deriveCityLayout(seed));

    const hdrTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(this.renderer, hdrTarget);
    // Tuned on the GPU against a frozen frame (T7 sweep): the threshold sits well above lit
    // concrete, haze, sky and the dim window field, so only true emissives bloom — sign tubes, the
    // taillight strip, light-trail lamps, the plume core, beacons. A tight radius keeps it a halo,
    // not a wash.
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), SKYRIVER_BLOOM_STRENGTH, 0.45, 1.2);
    this.bloomPass.materialHighPassFilter.uniforms['smoothWidth']!.value = SKYRIVER_BLOOM_PICKUP_WIDTH;
    this.bloomLevel = this.bloomEnabled ? SKYRIVER_BLOOM_STRENGTH : 0;
    // The same controls at three levels. Both passes exist for the life of the scene and exactly
    // one is ever enabled, so an R23 on/off is a flag flip and not a composer rebuild.
    this.bloom3Pass = new SkyriverThreeMipBloomPass(
      new THREE.Vector2(1, 1), SKYRIVER_BLOOM_STRENGTH, 0.45, 1.2,
    );
    this.bloom3Pass.smoothWidth = SKYRIVER_BLOOM_PICKUP_WIDTH;

    this.depthFade = new SkyriverDepthSnapshot(this.renderer, [
      this.composer.renderTarget1,
      this.composer.renderTarget2,
    ]);
    // Reset from the active render target every render. Diagnostic probes also call composer.render
    // directly after moving the camera, so update() is not the correct reset boundary. The R23
    // transparent stage suppresses this reset so it reuses the completed opaque snapshot.
    this.scene.onBeforeRender = (_renderer, _scene, camera) => this.depthFade.beginSceneRender(camera);

    const analyticFog = { set: setSkyriverFogBypass, bypassed: skyriverFogBypassed };
    this.legacyRenderPass = new RenderPass(this.scene, this.camera);
    this.opaquePass = new SkyriverOpaquePass({
      scene: this.scene,
      camera: this.camera,
      registry: this.stageRoles,
      depthFade: this.depthFade,
      analyticFog,
      // Read from the plan, not a constant: the opaque stage may only drop the shared analytic
      // haze when the volume pass is actually going to replace it. With no opaque depth available
      // the plan is legacy, so the haze stays and the frame is the verified R22 arithmetic.
      bypassAnalyticFog: () => this.livePlan.volumePass,
      onDepthCaptured: () => this.runStageDepthProbe('after-opaque'),
    });
    this.volumePass = new SkyriverVolumeFogPass({
      camera: this.camera,
      depthTexture: () => this.depthFade.depthTexture(),
      // The volume's own precondition, NOT the beam-fade A/B switch: `setDepthFadeAllowed(false)`
      // must not change what the marcher does. See `SkyriverDepthSnapshot.opaqueSnapshotValid`.
      depthValid: () => this.depthFade.opaqueSnapshotValid(),
      beamView: () => this.atmosphere.beamView(),
      onComposed: () => this.runStageDepthProbe('after-volume'),
    });
    this.transparentPass = new SkyriverTransparentPass({
      scene: this.scene,
      camera: this.camera,
      registry: this.stageRoles,
      depthFade: this.depthFade,
      analyticFog,
    });

    // One fixed pass order. Mode selection is `enabled` flags, so the chain never reshuffles:
    //   legacy  — RenderPass, five-level bloom, OutputPass.
    //   staged  — OpaquePass, VolumeFogPass, TransparentPass, three-level bloom, OutputPass.
    this.composer.addPass(this.legacyRenderPass);
    this.composer.addPass(this.opaquePass);
    this.composer.addPass(this.volumePass);
    this.composer.addPass(this.transparentPass);
    this.composer.addPass(this.bloom3Pass);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.atmosphere = new SkyriverAtmosphere({
      layout: this.layout,
      quality: this.quality,
      depthFade: this.depthFade,
      colourSwitch: this.colourSwitch,
    });
    // The haze colour and depths density live on scene.fog, so three refreshes them into every
    // fogged material — including anything T4 builds from a built-in material.
    this.scene.fog = this.atmosphere.fog;
    this.scene.add(this.atmosphere.group);

    this.city = new SkyriverCity({
      layout: this.layout,
      quality: this.quality,
      colourSwitch: this.colourSwitch,
    });
    this.scene.add(this.city.group);
    this.city.setInteriorMode(this.quality.interiors);

    // R23 smog: allocated once at the high count, so a tier change only moves `instanceCount`.
    this.smog = new SkyriverSmog({
      seed,
      depthFade: this.depthFade,
      capacity: SKYRIVER_SMOG_HIGH_MAX,
    });
    this.scene.add(this.smog.mesh);

    // Declared draw roles, read from the role each constructor recorded on its own mesh. A drawable
    // without one throws here rather than drawing twice later. Traffic and the shuttle are added by
    // the runner, which calls `registerStageRoles` for them.
    this.stageRoles.registerDeclared(this.scene);

    // The source pool is built on the first update, not here: the beam attributes are written by
    // `atmosphere.update`, so at construction every searchlight record is still zero and a cone
    // built from one would carry zero energy and never be selected. It is still built exactly once.
    this.livePlan = this.applyComposition();

    this.frame = {
      tick: 0,
      alpha: 0,
      time: 0,
      dt: 0,
      projection: null,
      routeV: 0,
      camera: this.camera,
      quality: this.quality,
    };

    this.resize(
      canvas.clientWidth || canvas.width || 1,
      canvas.clientHeight || canvas.height || 1,
    );
  }

  get currentQuality(): SkyriverQualitySettings {
    return this.quality;
  }

  /**
   * The R23 composition this tier and flag select.
   *
   * Low is always legacy: its tier keeps the analytic scene, the volume and clouds off, and its own
   * bloom-off behaviour including the existing ease. High and medium are staged on the default
   * chain, and fall back to the verified R22 chain — one RenderPass and all five original bloom
   * samplers — on `legacy-five`. The diagnostic `three-only` chain is legacy too: see
   * `SkyriverPresentationChain`.
   */
  get composition(): SkyriverCompositionMode {
    return this.livePlan.mode;
  }

  /**
   * The plan for the current tier, chain, depth availability and tuning overrides.
   *
   * One decision, in one pure function, with every input named. Depth availability is an input
   * because the staged frame cannot be drawn correctly without an opaque depth snapshot, and the
   * step and cloud overrides are inputs because `applyComposition` must stay the only writer of
   * the volume profile and the cloud count.
   */
  compositionPlan(): SkyriverCompositionPlan {
    return skyriverCompositionPlan({
      tier: this.quality.tier,
      chain: this.chain,
      bloomEnabled: this.bloomEnabled,
      depthAvailable: this.depthFade.canCaptureOpaqueDepth(),
      stepsOverride: this.volumeStepsOverride,
      cloudsOverride: this.cloudCountOverride,
    });
  }

  /**
   * Applies the composition plan: which passes run, which bloom, how many clouds.
   *
   * Idempotent, so calling it twice converges. It never touches exposure, tone mapping, colour
   * space, the density field, the district colour flag or any source state — an R23 on/off pair
   * differs in exactly the presentation chain.
   */
  private applyComposition(): SkyriverCompositionPlan {
    const plan = this.compositionPlan();
    // The plan this frame was BUILT on, held for the passes to read during the chain. The opaque
    // stage must not re-derive its analytic bypass mid-frame: its own depth capture runs after its
    // draw, so a capture that failed there would answer differently from the decision the stage
    // already drew with.
    this.livePlan = plan;
    this.legacyRenderPass.enabled = plan.legacyRenderPass;
    this.opaquePass.enabled = plan.opaquePass;
    this.volumePass.enabled = plan.volumePass;
    this.transparentPass.enabled = plan.transparentPass;
    this.bloom3Pass.enabled = plan.threeMipBloom;
    this.bloomPass.enabled = plan.legacyBloom;
    // The ONE writer of the step count and the cloud count. Both tuning overrides are plan inputs,
    // so a bloom A/B or a tier change re-derives the same numbers instead of quietly putting the
    // profile defaults back: `setVolumeSteps(12)` followed by `setBloomAllowed(false)` used to
    // draw 8 steps and reset the step history, and a measurement could record the 12 it asked for.
    this.volumePass.setProfile(plan.volumeProfile, plan.volumeSteps);
    this.smog.setCount(plan.clouds);
    // The volume needs the opaque depth copy whether or not the beam-fade A/B wants the fade.
    this.depthFade.setSnapshotRequired(plan.volumePass);
    return plan;
  }

  /**
   * Builds the static source pool from the actual drawn sources.
   *
   * Called once at construction. `city.lightSources()` is the whole drawn sign/hero and large-trim
   * population — signs and heroes share one pool, so a hero is never counted twice — and the
   * searchlight records come from the atmosphere's read-only beam view. Duplicate ids are a broken
   * invariant: a hero's four blades share one `signIdentity`, and the per-instance ordinal is what
   * keeps them four separate sources.
   */
  private buildLightPoolOnce(): void {
    if (this.lightSelection !== null) return;
    const view = this.atmosphere.beamView();
    const beams = [];
    for (let slot = 0; slot < view.searchlightCount; slot += 1) {
      const record = view.read(slot, this.beamScratch);
      beams.push({
        slot: record.slot,
        start: [record.start[0], record.start[1], record.start[2]] as readonly [number, number, number],
        axis: [record.axis[0], record.axis[1], record.axis[2]] as readonly [number, number, number],
        lengthM: record.lengthM,
        widthStartM: record.widthStartM,
        widthEndM: record.widthEndM,
        colorLinear: [record.colorLinear[0], record.colorLinear[1], record.colorLinear[2]] as readonly [number, number, number],
        seed: record.seed,
        intensity: record.intensity,
        softness: record.softness,
        fadeStart: record.fadeStart,
      });
    }
    this.lightPool = skyriverBuildLightPool({ sources: this.city.lightSources(), beams });
    const duplicates = skyriverLightPoolDuplicates(this.lightPool);
    if (duplicates.length > 0) {
      throw new Error(`SKYRIVER_LIGHT_POOL_DUPLICATE_ID:${duplicates.slice(0, 4).join(',')}`);
    }
    this.lightSelection = new SkyriverLightSelection(this.lightPool);
  }

  /**
   * The district air the marcher scatters in, from the HELD R22 haze tint.
   *
   * The tint is not re-sampled here. It is read from `atmosphere.heldHazeTint()` — the exact
   * multiplier bound in the shared fog uniform, which R22 refreshes at most once per second of
   * simulated time on a tick bucket, and which a colour switch, a time reversal or a scene reset
   * invalidates synchronously. So the marcher and the fog shader always scatter in the same air, and
   * the marcher's tint cannot move faster than the haze's declared refresh rate.
   *
   * The profile object is rebuilt only when the held record's `version` moves, so a normal frame
   * allocates nothing. The volume history is dropped on a district change, as before: a tint that
   * drifts inside one district's 400 m boundary blend is a continuous change the history may carry.
   */
  private syncDistrictProfile(): SkyriverDistrictFogProfile {
    const held = this.atmosphere.heldHazeTint();
    if (held.version === this.districtProfileVersion) return this.districtProfile;
    this.districtProfileVersion = held.version;
    const next = skyriverDistrictFogProfileFrom(held);
    if (next.id !== this.districtProfile.id) this.volumePass.resetHistory('district');
    this.districtProfile = next;
    return next;
  }

  /**
   * Vertical pixels per metre at one metre of view depth. The city shader uses it to fade procedural
   * detail out before it is too small to resolve, so it must track the drawing buffer, not the CSS
   * size — a DPR change moves it.
   */
  private projectionScale(): number {
    const target = this.renderer.getDrawingBufferSize(this.scratchSize);
    const fovRadians = (this.camera.fov * Math.PI) / 180;
    return target.y / (2 * Math.tan(fovRadians / 2));
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));

    const devicePixelRatio = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
    const pixelRatio = Math.min(devicePixelRatio, this.maxPixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    const drawingBuffer = this.renderer.getDrawingBufferSize(this.scratchSize);
    // Every target uses the same integer drawing-buffer dimensions.
    this.composer.setPixelRatio(1);
    this.composer.setSize(drawingBuffer.x, drawingBuffer.y);
    this.depthFade.resize(drawingBuffer.x, drawingBuffer.y);
    if (this.quality.bloom === 'half') {
      const halfX = Math.max(1, Math.round(this.width * pixelRatio * 0.5));
      const halfY = Math.max(1, Math.round(this.height * pixelRatio * 0.5));
      this.bloomPass.setSize(halfX, halfY);
      this.bloom3Pass.setSize(halfX, halfY);
    }
    // The volume target is a share of the physical drawing buffer, never of the CSS size, and never
    // smaller than one pixel. A resize drops the history: it is not reprojectable across sizes.
    this.volumePass.setSize(drawingBuffer.x, drawingBuffer.y);
    this.depthProbe.setSize(drawingBuffer.x, drawingBuffer.y);

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.atmosphere.resize(this.width, this.height);
    this.city.setProjectionScale(this.projectionScale());
  }

  /** Presentation-only (plan R7). Re-applies the tier's DPR unless one was pinned explicitly. */
  setTier(tier: SkyriverQualityTier, maxPixelRatio?: number): void {
    this.quality = SKYRIVER_QUALITY[tier];
    this.maxPixelRatio = maxPixelRatio ?? this.quality.dpr;
    this.frame.quality = this.quality;
    this.atmosphere.setQuality(this.quality);
    this.city.setInteriorMode(this.interiorsAllowed ? this.quality.interiors : 'off');
    this.applyComposition();
    this.volumePass.resetHistory('profile');
    this.resize(this.width, this.height);
  }

  /**
   * Selects the presentation chain. See `SkyriverPresentationChain`.
   *
   * Presentation only, synchronous and idempotent: it flips pass `enabled` flags, the bloom
   * implementation and the cloud count, and touches no geometry, no source state, no exposure and
   * not the R22 district colour flag. Passing `SKYRIVER_DEFAULT_PRESENTATION_CHAIN` restores the
   * default settings exactly, because every chain-dependent value is re-derived from the plan.
   */
  setPresentationChain(chain: SkyriverPresentationChain): void {
    if (chain === this.chain) return;
    this.chain = chain;
    this.applyComposition();
    // The chain changes which passes composite the frame, so accumulated history and held light
    // membership belong to the chain that is going away.
    this.volumePass.resetHistory('composition-mode');
    this.lightSelection?.reset();
  }

  /** The selected chain. `renderSettings` and `compositionEvidence` report the same value. */
  get presentationChain(): SkyriverPresentationChain {
    return this.chain;
  }

  /**
   * The reversible R23 A/B switch, in terms of the chain: false is the verified R22 analytic scene
   * on every tier — one legacy RenderPass, all five original bloom samplers, the volume off and the
   * clouds off — and true is the default chain.
   */
  setVolumeAllowed(allowed: boolean): void {
    this.setPresentationChain(allowed ? SKYRIVER_DEFAULT_PRESENTATION_CHAIN : 'legacy-five');
  }

  /** Whether the R23 volume and clouds are allowed on a tier that supports them. */
  get r23Allowed(): boolean {
    return this.chain === 'r23-staged';
  }

  /**
   * Registers draw roles for objects the runner adds (traffic, the shuttle). Each object declares
   * its own role at creation; this only reads that declaration and binds the stage layers.
   */
  registerStageRoles(objects: Iterable<THREE.Object3D>): void {
    for (const object of objects) this.stageRoles.registerDeclared(object);
  }

  /** Drops the volume history. The next frame starts from current scatter. */
  resetVolumeHistory(reason: SkyriverVolumeHistoryReset = 'explicit'): void {
    this.volumePass.resetHistory(reason);
  }

  /** Diagnostic 128-step x 16-phase reference integrator. Its draws are probes, never timed. */
  setVolumeReferenceMode(enabled: boolean): void {
    this.volumePass.setReferenceMode(enabled);
  }

  /**
   * A/B and tuning: high may run 8..12 steps if the measured full frame still fits the gate.
   *
   * Stores the override as scene state and re-applies the plan, so every later `applyComposition`
   * (a tier change, a bloom A/B, a chain change) keeps drawing the requested count. Pass null to
   * go back to the profile's own.
   */
  setVolumeSteps(steps: number | null): void {
    this.volumeStepsOverride = steps;
    this.applyComposition();
  }

  /** A/B and tuning: bounded cloud coverage, within the batch's allocated capacity. */
  setCloudCount(count: number | null): void {
    this.cloudCountOverride = count;
    this.applyComposition();
  }

  /** The tuning overrides in force. Null means the profile's own value is drawn. */
  volumeOverrides(): { readonly steps: number | null; readonly clouds: number | null } {
    return { steps: this.volumeStepsOverride, clouds: this.cloudCountOverride };
  }

  /**
   * Registers a per-frame listener. T4's traffic hooks in here, so it can update its instance
   * buffers before the draw without this module importing a file that does not exist yet.
   */
  addFrameListener(listener: SkyriverFrameListener): void {
    if (!this.listeners.includes(listener)) this.listeners.push(listener);
  }

  removeFrameListener(listener: SkyriverFrameListener): void {
    const index = this.listeners.indexOf(listener);
    if (index >= 0) this.listeners.splice(index, 1);
  }

  /**
   * Advances the presentation and draws one frame.
   *
   * `tick` and `projection` come from the runner's confirmed frame; `alpha` is the fraction into the
   * next tick, so a 30 Hz simulation renders smoothly at 60 Hz. The camera is already positioned by
   * T5 at this point. The projection is frozen sim state and is only ever read.
   */
  update(tick: number, projection: SkyriverProjection | null, alpha = 0): void {
    const nowMs = typeof performance === 'undefined' ? 0 : performance.now();
    // Two deltas, on purpose. `dt` is the INTEGRATION delta, clamped so a backgrounded WebView
    // cannot produce one giant step for the source updates and the bloom ease. `wallDeltaS` is the
    // real elapsed wall time, and it is what the volume history policy must see: handed the
    // clamped value, a four-second tab switch arrived as 0.067 s, so the 'frame-pause' reset and
    // the weight-1 branch could never run and stale history was smeared in instead of dropped.
    const wallDeltaS = this.lastUpdateMs === null ? 0 : (nowMs - this.lastUpdateMs) / 1000;
    const dt = Math.min(wallDeltaS, MAX_FRAME_DT_S);
    this.lastUpdateMs = nowMs;

    // A presented moment that went backwards is a replay seek, a rollback or a restart. It is read
    // off the presented pair alone, so a fixed camera and an unchanged projection cannot hide it:
    // without this, the accumulated volume history and the held light membership would both belong
    // to a LATER moment than the one being drawn. The haze does its own tick-reversal check on its
    // refresh bucket, and a seek inside one tick lands in that same bucket, so its held tint is
    // already the right value for the moment being drawn.
    const presented = this.presentedTime;
    if (presented === null) {
      this.presentedTime = { tick, alpha };
    } else {
      if (skyriverSourceTimeReversed(presented.tick, presented.alpha, tick, alpha)) {
        this.recordSourceReversal(presented.tick, presented.alpha, tick, alpha);
      }
      presented.tick = tick;
      presented.alpha = alpha;
    }

    const frame = this.frame;
    frame.tick = tick;
    frame.alpha = alpha;
    frame.time = (tick + alpha) / SKYRIVER_TICK_RATE;
    frame.dt = dt;
    frame.projection = projection;

    // Every source update runs ONCE, before the composer stages. The staged path draws the scene
    // twice, but it never updates the atmosphere, the city, traffic or the shuttle twice.
    this.atmosphere.update(frame);
    this.city.update(frame);
    for (let i = 0; i < this.listeners.length; i += 1) this.listeners[i](frame);

    // One plan per frame: the pass flags, the bloom choice and the source updates below all read
    // the same decision, so they cannot disagree about which chain this frame drew. It is APPLIED
    // here as well as read: depth availability is a plan input, so a rejected depth copy moves the
    // frame onto the legacy analytic path — with the shared haze back in the opaque stage — rather
    // than leaving a staged frame with nothing to march against.
    const plan = this.applyComposition();

    // R23 presentation sources. Still once per frame, and only while the staged chain runs.
    if (plan.mode === 'staged') {
      // Built on the first staged frame, after the atmosphere has written its beam attributes.
      this.buildLightPoolOnce();
      this.smog.update(frame.time);
      const camera = this.camera;
      const selection = this.lightSelection;
      // Membership refreshes at most once a simulated second; the selected cone axes stay live.
      this.selectedLights = selection === null
        ? []
        : selection.update(frame.time, camera.position.x, camera.position.y, camera.position.z);
      const district = this.syncDistrictProfile();
      this.volumePass.update({
        wallDeltaS,
        selected: this.selectedLights,
        district,
        // Read from the one shared switch at this moment, never from a cached copy.
        districtColourAllowed: this.colourSwitch.allowed,
      });
    } else {
      // Legacy and diagnostic chains: nothing is marched, so the evidence must not report a held
      // membership or a district air this frame never scattered in. Clearing the profile version
      // too makes the next staged frame rebuild from the held tint instead of reusing this.
      if (this.selectedLights.length > 0) {
        this.selectedLights = [];
        this.lightSelection?.reset('explicit');
      }
      // And the PASS is cleared too, not just this list. Without this the bound uniforms keep the
      // last staged values, so `volumeEvidence().selectedCount` and `lightUniforms()` report ten
      // sources for a frame that marched nothing — a captured legacy-five record really did read
      // `volumeEnabled: false` beside `volumeSelectedLights: 10`.
      this.volumePass.clearLights();
      if (this.districtProfile !== SKYRIVER_NEUTRAL_FOG_PROFILE) {
        this.districtProfile = SKYRIVER_NEUTRAL_FOG_PROFILE;
        this.districtProfileVersion = -1;
      }
    }

    this.renderer.info.reset();
    // T7-2: every tier renders through the composer, so tone mapping always runs once, on the
    // blended HDR frame. Rendering straight to the canvas tone-mapped each additive layer before
    // blending, which blew near signs out to white on the low tier (and made the T7 bloom A/B pair
    // differ in two variables). With bloom off only the bloom pass is skipped.
    // R15: bloom eases in/out over ~0.5 s on a tier change instead of switching in one frame.
    const bloomTarget = this.bloomEnabled ? SKYRIVER_BLOOM_STRENGTH : 0;
    this.bloomLevel += (bloomTarget - this.bloomLevel) * Math.min(1, dt * 5);
    if (Math.abs(bloomTarget - this.bloomLevel) < 0.005) this.bloomLevel = bloomTarget;
    // Both implementations carry the eased level; exactly one of them is enabled, and WHICH one is
    // the plan's decision — not `mode` — so the diagnostic three-level chain over the legacy scene
    // survives every `update` instead of being overwritten back to the five-level pass here. Low
    // keeps its existing bloom-off transition unchanged on the legacy chain.
    const bloom = skyriverBloomEnableFlags(plan, this.bloomLevel > 0.005);
    this.bloomPass.strength = this.bloomLevel;
    this.bloom3Pass.strength = this.bloomLevel;
    this.bloomPass.enabled = bloom.legacy;
    this.bloom3Pass.enabled = bloom.threeMip;
    this.composer.render(dt);
  }

  /** True when this frame goes through the bloom composer. */
  get bloomEnabled(): boolean {
    return this.bloomAllowed && this.quality.bloom !== 'off';
  }

  /** A/B evidence and perf: force interior mapping off (false) or back to the tier default (true). */
  setInteriorsAllowed(allowed: boolean): void {
    this.interiorsAllowed = allowed;
    this.city.setInteriorMode(allowed ? this.quality.interiors : 'off');
  }

  /**
   * A/B evidence: fade beams and plume against the current opaque depth buffer.
   *
   * This is the BEAM-FADE switch only. It does not change what the volume marcher does: the opaque
   * depth copy is requested separately from the composition plan, and the marcher reads
   * `opaqueSnapshotValid`, so the depth-fade A/B and the R23 A/B stay independent variables.
   */
  setVisibilityAllowed(allowed: boolean): void {
    this.depthFade.setAllowed(allowed);
  }

  /** A/B evidence: use the legacy foot shadow (false) or the tuned contact shading (true). */
  setContactAllowed(allowed: boolean): void {
    this.city.setContactAllowed(allowed);
  }

  /** A/B evidence: use the legacy haze response (false) or the widened, dithered haze (true). */
  setMurkAllowed(allowed: boolean): void {
    this.atmosphere.setMurkAllowed(allowed);
  }

  /**
   * R22 colour A/B: false restores the pre-R22 source colours, distance grade and haze tint; true is
   * the district colour map. Synchronous and presentation-only — it writes uniforms, selects the
   * hero colour set and invalidates the haze refresh bucket, and touches no geometry, no instance
   * buffer, no random stream and no simulation state. The next `update` at the same tick and the
   * same alpha redraws the identical frame with only the colour treatment changed.
   *
   * This is the one writer of the flag. The city and the atmosphere subscribe to `colourSwitch` and
   * apply it; neither keeps a copy, so the frame and `renderSettings` cannot disagree.
   */
  setDistrictAllowed(allowed: boolean): void {
    this.colourSwitch.set(allowed);
    // The switch changes every source emission the marcher scatters, so the accumulated history
    // belongs to the other colour state and cannot be kept. R23 on/off does not change this flag,
    // and this flag does not change R23 on/off: the two A/Bs stay independent.
    this.volumePass.resetHistory('explicit');
  }

  /**
   * The presented canyon route position for the next frame, metres. T5 writes it from the flight
   * presenter; the city and the haze read it from the frame.
   */
  setRoutePosition(routeV: number): void {
    this.frame.routeV = routeV;
  }

  /** The route position the last rendered frame actually used. */
  routePosition(): number {
    return this.frame.routeV;
  }

  /** A/B evidence and debugging: force bloom off (false) or back to the tier default (true). */
  setBloomAllowed(allowed: boolean): void {
    this.bloomAllowed = allowed;
    // A/B and debug switch: snap, no ease (the A/B pair must differ in exactly this one variable).
    this.bloomLevel = this.bloomEnabled ? SKYRIVER_BLOOM_STRENGTH : 0;
    this.applyComposition();
  }

  /**
   * The one place a presented-time discontinuity is acted on.
   *
   * Both pieces of accumulated presentation state are dropped: the volume history, whose frames
   * were fused at a later moment, and the held light membership, which was ranked at a later
   * moment. Nothing on the source side is touched — this reads the presented pair and writes
   * presentation state only. Idempotent: a second call converges on the same state.
   */
  private recordSourceReversal(
    fromTick: number,
    fromAlpha: number,
    toTick: number,
    toAlpha: number,
  ): void {
    this.volumePass.resetHistory('replay-seek');
    this.lightSelection?.reset();
    this.sourceReversalCount += 1;
    this.sourceReversals.push({
      fromTick,
      fromAlpha,
      toTick,
      toAlpha,
      atMs: typeof performance === 'undefined' ? 0 : performance.now(),
    });
    if (this.sourceReversals.length > 16) this.sourceReversals.shift();
  }

  /**
   * The presented moment the last frame drew, and every reversal that was actually detected.
   *
   * Evidence for the replay/reset path: the reversal log is written by the frame pump itself, so a
   * recorded entry means that frame really did reset the history and the membership.
   */
  sourceTimeEvidence(): {
    readonly presented: { readonly tick: number; readonly alpha: number } | null;
    readonly reversalCount: number;
    readonly reversals: readonly {
      readonly fromTick: number;
      readonly fromAlpha: number;
      readonly toTick: number;
      readonly toAlpha: number;
      readonly atMs: number;
    }[];
    readonly lastHistoryReset: SkyriverVolumeHistoryReset | null;
    readonly historyValid: boolean;
    readonly lightSelectionResets: number;
  } {
    const volume = this.volumePass.stats();
    return {
      presented: this.presentedTime === null
        ? null
        : { tick: this.presentedTime.tick, alpha: this.presentedTime.alpha },
      reversalCount: this.sourceReversalCount,
      reversals: [...this.sourceReversals],
      lastHistoryReset: volume.lastHistoryReset,
      historyValid: volume.historyValid,
      lightSelectionResets: this.lightSelection?.stats().resets ?? 0,
    };
  }

  /** Called after a restore or a long background pause, so the next dt is not a spike. */
  resetFrameClock(): void {
    this.lastUpdateMs = null;
    // A restore is a presentation discontinuity: the accumulated volume history is dropped and the
    // held light membership is re-ranked on the next frame.
    this.volumePass.resetHistory('resume');
    this.lightSelection?.reset();
    // R22: a restore is a scene reset for the haze, so its once-a-second refresh bucket is dropped
    // and the next frame re-samples the district at the tick it actually draws.
    this.atmosphere.resetDistrictHazeTint('scene-reset');
  }

  /** Debug getter for the smoke tests (plan A3). Reads `renderer.info` straight. */
  debug(): SkyriverRenderDebug {
    const info = this.renderer.info;
    const city = this.city.stats();
    const atmosphere = this.atmosphere.stats();
    return {
      calls: info.render.calls,
      triangles: info.render.triangles,
      programs: info.programs?.length ?? 0,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      instances: {
        towers: city.towers,
        trims: city.trims,
        signs: city.signs,
        godRays: atmosphere.godRays,
        searchlights: atmosphere.searchlights,
      },
      drawCalls: skyriverDrawCallEstimate(this.quality),
      pixelRatio: this.renderer.getPixelRatio(),
      tier: this.quality.tier,
    };
  }

  /** Every active rendering setting and bound uniform value. See `SkyriverRenderSettings`. */
  renderSettings(): SkyriverRenderSettings {
    const buffer = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const fade = this.city.interiorFade();
    const depth = this.depthFade.stats();
    const plan = this.livePlan;
    const volume = this.volumePass.stats();
    const smog = this.smog.stats();
    // The scene term is COUNTED from the actual visible drawables; the post term is the enabled
    // passes' DECLARED draw counts, which is why the total is reported as an estimate and the
    // browser's `renderer.info.render.calls` is the acceptance evidence. The scene count is the
    // same in both modes: each declared mesh draws exactly once, in one traversal or two.
    const scene = skyriverVisibleDrawCount(this.scene);
    const post = plan.postDraws;
    return {
      tier: this.quality.tier,
      bloom: this.quality.bloom,
      bloomEnabled: this.bloomEnabled,
      bloomAllowed: this.bloomAllowed,
      bloomStrength: this.bloomPass.strength,
      bloomRadius: this.bloomPass.radius,
      bloomThreshold: this.bloomPass.threshold,
      bloomSmoothWidth: this.bloomPass.materialHighPassFilter.uniforms['smoothWidth']!.value as number,
      roomMode: this.city.currentRoomMode(),
      roomModeAllowed: this.interiorsAllowed,
      roomFade: [fade.start, fade.end],
      roomStrength: fade.strength,
      farMode: this.city.currentFarMode(),
      districtAllowed: this.colourSwitch.allowed,
      contactAllowed: (this.city.renderUniforms().towerContactAllowed as number) > 0.5,
      murkAllowed: this.atmosphere.murkAllowed(),
      depthFadeAllowed: depth.allowed,
      depthFadeEnabled: depth.enabled,
      godRays: this.quality.godRays,
      rainStreaks: this.quality.rainStreaks,
      cars: this.quality.cars,
      pixelRatio: this.renderer.getPixelRatio(),
      maxPixelRatio: this.maxPixelRatio,
      cssSize: [this.width, this.height],
      drawingBufferSize: [buffer.x, buffer.y],
      exposure: this.renderer.toneMappingExposure,
      toneMapping: this.renderer.toneMapping,
      outputColorSpace: this.renderer.outputColorSpace,
      fov: this.camera.fov,
      near: this.camera.near,
      far: this.camera.far,
      projectionScale: this.projectionScale(),
      uniforms: this.city.renderUniforms(),
      volumeAllowed: this.chain === 'r23-staged',
      presentationChain: this.chain,
      composition: plan.mode,
      stagingBlocker: plan.stagingBlocker,
      opaqueDepthAvailable: plan.depthAvailable,
      bloomMips: plan.bloomMips,
      bloomDraws: plan.bloomDraws,
      volumeEnabled: volume.enabled && plan.mode === 'staged',
      volumeProfile: volume.profile,
      volumeSteps: plan.mode === 'staged' ? volume.steps : 0,
      volumeSpatialScale: volume.spatialScale,
      volumeSize: [volume.volumeSize.width, volume.volumeSize.height],
      volumeRangeM: volume.rangeM,
      // Read from the pass, which the legacy branch of `update` clears, AND gated on the plan: a
      // frame that marched nothing reports no sources, from both directions.
      volumeSelectedLights: plan.mode === 'staged' ? volume.selectedCount : 0,
      volumeHistoryValid: volume.historyValid,
      volumeHistoryResets: volume.historyResets,
      cloudsEnabled: smog.visible,
      cloudCount: smog.drawn,
      cloudCapacity: smog.capacity,
      analyticFogBypassed: skyriverFogBypassed(),
      stageRoleCount: this.stageRoles.size(),
      sceneDraws: scene,
      postDraws: post,
      frameDrawEstimate: scene + post,
    };
  }

  /**
   * The composition actually bound: the selected chain, the ordered enabled passes, their swap and
   * blend behaviour, and the target and depth identities the volume invocation itself recorded.
   *
   * UUID equality is reported but is not on its own proof that the depth CONTENT survived — for
   * that, run the in-frame pair: `armStageDepthProbe()`, one rendered frame, then
   * `stageDepthProbe()`, and compare the two hashes.
   */
  compositionEvidence(): {
    readonly chain: SkyriverPresentationChain;
    readonly mode: SkyriverCompositionMode;
    readonly passes: readonly { readonly name: string; readonly enabled: boolean; readonly needsSwap: boolean }[];
    readonly volumeBlend: { readonly src: string; readonly dst: string; readonly equation: string };
    readonly volumeDraws: number;
    readonly volumeSamplers: readonly { readonly name: string; readonly uuid: string | null }[];
    readonly samplesSceneColour: boolean;
    readonly volumeInvocation: SkyriverVolumeInvocationRecord | null;
    readonly opaqueDepthAttachmentUuid: string | null;
    readonly marchedDepthUuid: string | null;
    readonly opaqueStage: SkyriverStageFlags | null;
    readonly transparentStage: SkyriverStageFlags | null;
    readonly depthCapturePhase: string;
    readonly transparentResetSuppressed: boolean;
    readonly coverage: SkyriverStageCoverage;
    /**
     * Why the frame composed the way it did, where depth is concerned.
     *
     * `depthAvailable` is the plan's input: can a capture succeed on this context at all.
     * `snapshotValid` is the live per-frame fact, read from the snapshot and independent of the
     * beam-fade A/B switch. `stagingBlocker` names the cause when the chain and the tier asked for
     * the staged frame and the plan refused it, and `volumeSkips` counts invocations that composed
     * nothing because the capture failed inside the frame.
     */
    readonly depth: {
      readonly available: boolean;
      readonly snapshotValid: boolean;
      readonly fadeAllowed: boolean;
      readonly snapshotRequired: boolean;
      readonly stagingBlocker: SkyriverStagingBlocker | null;
      readonly fallback: string | null;
      readonly volumeSkips: number;
    };
  } {
    const plan = this.livePlan;
    const depth = this.depthFade.stats();
    const volume = this.volumePass.stats();
    return {
      chain: this.chain,
      mode: this.composition,
      passes: this.composer.passes.map((pass) => ({
        name: passName(pass),
        enabled: pass.enabled,
        needsSwap: pass.needsSwap,
      })),
      volumeBlend: { src: 'ONE', dst: 'ONE_MINUS_SRC_ALPHA', equation: 'ADD' },
      volumeDraws: SKYRIVER_VOLUME_NORMAL_DRAWS,
      volumeSamplers: this.volumePass.bilateralSamplers(),
      // Structural, not a claim: the volume blends with fixed-function destination blending and has
      // no scene-colour sampler at all, so there is no path for texture feedback.
      samplesSceneColour: false,
      // Recorded by the volume pass inside its own invocation. The composer's `readBuffer` is NOT
      // read here: by the time this getter runs, the three-level or five-level bloom and OutputPass
      // have swapped the composer's buffers, so that pointer no longer names the target the volume
      // composed into.
      volumeInvocation: this.volumePass.invocationEvidence(),
      // The original attachment the scene drew into, and the copy the marcher sampled. Two
      // different surfaces, named as such.
      opaqueDepthAttachmentUuid: this.depthFade.opaqueDepthAttachment()?.uuid ?? null,
      marchedDepthUuid: this.depthFade.depthTexture()?.uuid ?? null,
      opaqueStage: this.opaquePass.stageFlags(),
      transparentStage: this.transparentPass.stageFlags(),
      depthCapturePhase: 'explicit, after OpaquePass and before VolumeFogPass',
      transparentResetSuppressed: this.transparentPass.stageFlags()?.depthBeginSuppressed ?? false,
      coverage: this.stageRoles.coverage(this.scene),
      depth: {
        available: plan.depthAvailable,
        snapshotValid: depth.snapshotValid,
        fadeAllowed: depth.allowed,
        snapshotRequired: depth.snapshotRequired,
        stagingBlocker: plan.stagingBlocker,
        fallback: plan.stagingBlocker === null
          ? null
          : 'legacy analytic haze: the shared fog factor and the far-card layer haze stay on in a'
            + ' single RenderPass, which is the verified R22 arithmetic',
        volumeSkips: volume.depthSkips,
      },
    };
  }

  /** The live volume state. Every field read from the pass, none copied from a plan. */
  volumeEvidence(): SkyriverVolumeFogStats {
    return this.volumePass.stats();
  }

  /**
   * The actual source records and the uniforms bound from them.
   *
   * `pool` is the full drawn population; `selected` is the bounded membership this frame; `bound` is
   * what the marcher actually received. The `sourceIdCollisions` entry is the evidence that the
   * per-instance ordinal is doing real work: those keys repeat, and the ids built from them do not.
   */
  lightSetEvidence(): {
    readonly poolSize: number;
    readonly limit: number;
    readonly duplicateIds: readonly string[];
    readonly sourceIdCollisions: readonly { readonly sourceId: string; readonly count: number }[];
    readonly selection: ReturnType<SkyriverLightSelection['stats']> | null;
    readonly selected: readonly {
      readonly id: string;
      readonly sourceId: string;
      readonly ordinal: number;
      readonly kind: string;
      readonly role: string;
      readonly districtId: number;
      readonly position: readonly [number, number, number];
      readonly emission: readonly [number, number, number];
      readonly legacyEmission: readonly [number, number, number];
      readonly peakLuminance: number;
      readonly litAreaM2: number;
      readonly scatterRadiusM: number;
      readonly weight: number;
      readonly score: number;
      readonly distanceM: number;
    }[];
    readonly bound: ReturnType<SkyriverVolumeFogPass['lightUniforms']>;
    readonly proxy: {
      readonly response: string;
      readonly units: string;
      readonly sphereSteradian: number;
      readonly roleImportance: Readonly<Record<string, number>>;
      readonly claim: string;
    };
  } {
    return {
      poolSize: this.lightPool.length,
      limit: 10,
      duplicateIds: skyriverLightPoolDuplicates(this.lightPool),
      sourceIdCollisions: skyriverLightSourceIdCollisions(this.lightPool).slice(0, 12),
      selection: this.lightSelection?.stats() ?? null,
      selected: this.selectedLights.map((entry) => ({
        id: entry.source.id,
        sourceId: entry.source.sourceId,
        ordinal: entry.source.ordinal,
        kind: entry.source.kind,
        role: entry.source.role,
        districtId: entry.source.districtId,
        position: entry.source.position,
        emission: entry.source.emission,
        legacyEmission: entry.source.legacyEmission,
        peakLuminance: entry.source.peakLuminance,
        litAreaM2: entry.source.litAreaM2,
        scatterRadiusM: entry.source.scatterRadiusM,
        weight: entry.weight,
        score: entry.score,
        distanceM: entry.distanceM,
      })),
      bound: this.volumePass.lightUniforms(),
      // The units the bound numbers are in, stated with them, so a reader cannot mistake the
      // scatter proxy for a photometric quantity.
      proxy: {
        response: 'litAreaM2 / ( litAreaM2 + 4 * pi * distanceM^2 )',
        units: 'litAreaM2 m^2 of lit emitting surface, distanceM world m, response dimensionless'
          + ' and bounded to 1 at zero distance; score = peakLuminance x roleImportance x response',
        sphereSteradian: SKYRIVER_SCATTER_SPHERE_SR,
        roleImportance: SKYRIVER_LIGHT_ROLE_IMPORTANCE,
        claim: 'bounded geometric proxy with no orientation term, not a photometric measurement',
      },
    };
  }

  /** The drawn clouds and the drift time they were drawn at. Centres, not a smoothness claim. */
  cloudEvidence(): {
    readonly stats: ReturnType<SkyriverSmog['stats']>;
    readonly centres: ReturnType<SkyriverSmog['drawnCentres']>;
  } {
    return { stats: this.smog.stats(), centres: this.smog.drawnCentres() };
  }

  /**
   * Both bloom implementations' complete sampler bindings.
   *
   * The legacy record reads all five of its samplers, so an A/B pair cannot be presented as safe
   * while three of them are unreported.
   */
  bloomEvidence(): {
    readonly active: 'three-mip' | 'legacy-five-mip' | 'off';
    readonly chain: SkyriverPresentationChain;
    readonly threeMipPassEnabled: boolean;
    readonly legacyPassEnabled: boolean;
    readonly threeMip: SkyriverBloomEvidence;
    readonly legacyFiveMip: SkyriverBloomEvidence;
  } {
    // Read from the live passes, not from the mode: the diagnostic three-level chain draws the
    // legacy analytic scene, so a label derived from the scene composition would call its actual
    // three-level bloom a five-level one. Both records are always reported, so a frame cannot be
    // presented as three-level while five samplers are the ones bound.
    const threeMipPassEnabled = this.bloom3Pass.enabled;
    const legacyPassEnabled = this.bloomPass.enabled;
    return {
      active: threeMipPassEnabled
        ? 'three-mip'
        : legacyPassEnabled ? 'legacy-five-mip' : 'off',
      chain: this.chain,
      threeMipPassEnabled,
      legacyPassEnabled,
      threeMip: this.bloom3Pass.evidence(),
      legacyFiveMip: skyriverLegacyBloomEvidence(this.bloomPass),
    };
  }

  /**
   * Every presentation source input bound for this frame, for the frozen-input record.
   *
   * The convergence capture freezes all of these — source tick and alpha, camera and projection,
   * light membership/weights/axes, cloud time and centres, district tint, density and the default
   * composition — and lets only the history delta and the jitter phase advance.
   */
  presentationInputs(): Readonly<Record<string, unknown>> {
    const smog = this.smog.stats();
    return Object.freeze({
      sourceTick: this.frame.tick,
      sourceAlpha: this.frame.alpha,
      sourceTimeS: this.frame.time,
      routeV: this.frame.routeV,
      cameraMatrixWorld: [...this.camera.matrixWorld.elements],
      projectionMatrix: [...this.camera.projectionMatrix.elements],
      exposure: this.renderer.toneMappingExposure,
      toneMapping: this.renderer.toneMapping,
      outputColorSpace: this.renderer.outputColorSpace,
      composition: this.composition,
      presentationChain: this.chain,
      tier: this.quality.tier,
      pixelRatio: this.renderer.getPixelRatio(),
      districtAllowed: this.colourSwitch.allowed,
      districtProfile: this.districtProfile,
      hazeBoundTint: this.atmosphere.hazeEvidence().boundTint,
      cloudDriftTimeS: smog.driftTimeS,
      cloudCount: smog.drawn,
      cityUniforms: this.city.renderUniforms(),
      volume: this.volumePass.presentationInputs(),
    });
  }

  /** The reference integrator's recorded state. A noise-free proxy, not ground truth. */
  referenceEvidence(): ReturnType<SkyriverVolumeFogPass['referenceEvidence']> {
    return this.volumePass.referenceEvidence();
  }

  /** The live pass materials a component GPU timer binds to. A copied name proves nothing. */
  componentBindings(): ReturnType<SkyriverVolumeFogPass['componentBindings']> & {
    readonly cloudMesh: THREE.Mesh;
  } {
    return { ...this.volumePass.componentBindings(), cloudMesh: this.smog.mesh };
  }

  /**
   * Packs and reads back the ORIGINAL opaque depth attachment — the depth texture of the composer
   * target the scene was drawn into — and returns the bytes to hash.
   *
   * ONE hash, taken BETWEEN frames. It cannot answer "did the volume blend leave the depth buffer
   * alone?" on its own: two calls from a diagnostic both land outside the composer chain, so they
   * compare the attachment with itself. The pair that answers that question is taken INSIDE one
   * frame by `armStageDepthProbe` — see that method for the procedure that can actually be run.
   *
   * Returns null when no scene render has claimed an attachment yet, or on a context without depth
   * textures, so the caller sees "no evidence" instead of a hash of the wrong surface.
   *
   * Diagnostic. Its draw is a probe: outside the normal call count and outside every timing result.
   */
  probeOpaqueDepthContent(): ReturnType<SkyriverDepthProbe['pack']> | null {
    const depth = this.depthFade.opaqueDepthAttachment();
    if (depth === null) return null;
    return this.depthProbe.pack(this.renderer, depth);
  }

  /**
   * Arms the IN-FRAME depth-content probe for the next rendered frame, and only that frame.
   *
   * The procedure, which is the one the R23 depth claim rests on:
   *   1. `armStageDepthProbe()`.
   *   2. One `update(...)` (or `renderFrozen`), which runs the composer once.
   *   3. `stageDepthProbe()` returns the two packed readbacks of the SAME attachment, taken at the
   *      two points that matter: inside `SkyriverOpaquePass.render`, right after the opaque depth
   *      capture, and inside `SkyriverVolumeFogPass.render`, right after its last composing draw.
   *   4. Hash both byte arrays. Equal hashes mean the volume blend left the depth content alone.
   *
   * Both packs happen inside the passes' own invocations, through the hooks the passes declare for
   * exactly this (`onDepthCaptured`, `onComposed`), because no between-frames API can reach the
   * moment between the opaque stage and the volume.
   *
   * Diagnostic. Each pack is one probe draw plus a readback: outside the normal call count and
   * outside every timing result. Nothing is armed by default, so a normal frame pays a null check.
   */
  armStageDepthProbe(): void {
    this.stageProbe = { armed: true, afterOpaque: null, afterVolume: null };
  }

  /** The armed probe's result, or null when it was never armed. See `armStageDepthProbe`. */
  stageDepthProbe(): {
    readonly procedure: string;
    readonly afterOpaque: ReturnType<SkyriverDepthProbe['pack']> | null;
    readonly afterVolume: ReturnType<SkyriverDepthProbe['pack']> | null;
    readonly sameSurface: boolean;
  } | null {
    const probe = this.stageProbe;
    if (probe === null) return null;
    return {
      procedure: 'packed inside one frame: after SkyriverOpaquePass captured the opaque depth, and'
        + ' after SkyriverVolumeFogPass made its last composing draw',
      afterOpaque: probe.afterOpaque,
      afterVolume: probe.afterVolume,
      sameSurface: probe.afterOpaque !== null
        && probe.afterVolume !== null
        && probe.afterOpaque.sourceUuid === probe.afterVolume.sourceUuid,
    };
  }

  /**
   * Packs the opaque depth ATTACHMENT at one of the two in-frame points, when armed.
   *
   * Called from inside the opaque and volume pass invocations. Unarmed it returns immediately, so
   * a normal frame does no extra work at all.
   */
  private runStageDepthProbe(phase: 'after-opaque' | 'after-volume'): void {
    const probe = this.stageProbe;
    if (probe === null || !probe.armed) return;
    const depth = this.depthFade.opaqueDepthAttachment();
    if (depth === null) return;
    const packed = this.depthProbe.pack(this.renderer, depth);
    if (phase === 'after-opaque') probe.afterOpaque = packed;
    else {
      probe.afterVolume = packed;
      // One frame per arming: a probe left armed would add two readbacks to every later frame.
      probe.armed = false;
    }
  }

  /**
   * Packs and reads back the owned opaque depth COPY — the snapshot the additive shaders and the
   * marcher sample, not the attachment the scene drew into.
   *
   * Useful on its own (it shows the copy the marcher read), but it cannot answer whether the blend
   * preserved the real depth buffer: that is `probeOpaqueDepthContent`.
   *
   * Diagnostic. Its draw is a probe: outside the normal call count and outside every timing result.
   */
  probeSnapshotDepthContent(): ReturnType<SkyriverDepthProbe['pack']> | null {
    const depth = this.depthFade.depthTexture();
    if (depth === null) return null;
    return this.depthProbe.pack(this.renderer, depth);
  }

  /** See `SkyriverGlDiagnostics`. T5 logs this once at boot. */
  glDiagnostics(): SkyriverGlDiagnostics {
    const gl = this.renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const timerQuery = gl.getExtension('EXT_disjoint_timer_query_webgl2') !== null;

    if (debugInfo === null) {
      return {
        vendor: null,
        renderer: null,
        version: asString(gl.getParameter(gl.VERSION)),
        debugRendererInfo: false,
        timerQuery,
      };
    }

    return {
      vendor: asString(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)),
      renderer: asString(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)),
      version: asString(gl.getParameter(gl.VERSION)),
      debugRendererInfo: true,
      timerQuery,
    };
  }

  dispose(): void {
    this.listeners.length = 0;
    this.city.dispose();
    this.atmosphere.dispose();
    this.smog.dispose();
    this.depthFade.dispose();
    // EffectComposer.dispose() does not dispose the passes added to it, so every owned pass,
    // material, target and texture is released here by hand.
    this.bloomPass.dispose();
    this.bloom3Pass.dispose();
    this.volumePass.dispose();
    this.depthProbe.dispose();
    for (const pass of this.composer.passes) {
      if (pass !== this.bloomPass && pass !== this.bloom3Pass && pass !== this.volumePass) pass.dispose();
    }
    this.composer.dispose();
    this.renderer.dispose();
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/** A pass's own label for the composition record, so the order is readable without guessing. */
function passName(pass: { readonly constructor: { readonly name: string } }): string {
  return pass.constructor.name;
}

/**
 * Visible drawables under `root`, counted the way three's own traversal counts them.
 *
 * `visible = false` prunes a whole subtree, and an instanced batch is one draw whatever its
 * instance count — which is exactly why the draw total does not move with traffic density.
 */
export function skyriverVisibleDrawCount(root: THREE.Object3D): number {
  let count = 0;
  const walk = (object: THREE.Object3D): void => {
    if (object.visible === false) return;
    const candidate = object as THREE.Object3D & {
      isMesh?: boolean;
      isPoints?: boolean;
      isLine?: boolean;
      isSprite?: boolean;
    };
    if (candidate.isMesh === true || candidate.isPoints === true
      || candidate.isLine === true || candidate.isSprite === true) count += 1;
    for (const child of object.children) walk(child);
  };
  walk(root);
  return count;
}

/** Budget constants re-exported so T4/T5 need only one import for the whole render contract. */
export { SKYRIVER_CITY_DRAW_CALL_BUDGET, SKYRIVER_ATMOSPHERE_DRAW_CALL_BUDGET };

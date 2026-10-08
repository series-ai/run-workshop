/**
 * @file renderLightSet.ts — R23's render light sources: the pool, their stable identity, and the
 *                          bounded selection the volume marcher uploads.
 *
 * Pure and GL-free. Every record comes from a real drawn source:
 *   - `city.lightSources()` (city.ts:4397) for the drawn sign/hero faces and the large trim lights.
 *   - The atmosphere's read-only beam view for the five searchlights, slots 0..4.
 * Nothing here invents a light. There are no transit-station entities in the source, so the
 * station-glow proxies are real emissive trims — see `skyriverStationProxies`.
 *
 * Identity. `city.signIdentity` (city.ts:3420) is `building|face|composition` and a four-blade hero
 * wall reuses that key for every blade. Selection, sorting and culling therefore run on
 * `SkyriverRenderLightSource.id`, which appends a per-drawn-instance ordinal taken from the full
 * source pool in getter order. The R22 colour-quota hash key is untouched.
 *
 * Colour. Each record carries both `emission` (district colour on) and `legacyEmission` (off). The
 * flag is read from the scene's one `SkyriverDistrictColourSwitch` at upload time, never cached
 * here, so a colour A/B cannot leave this module reporting the other state.
 *
 * Units. `emission` is reference linear RGB and it is the ONLY radiance in this module. A record
 * carries no second brightness scalar, so neither the marcher nor the rank can multiply a source's
 * own luminance into its colour a second time — which is exactly what made the first R23 build
 * upload RGB up to 1585 and render white. Everything spatial goes through `skyriverScatterResponse`,
 * a bounded dimensionless proxy built from lit area and world distance.
 */
import {
  SKYRIVER_EMISSIVE_GAIN,
  type SkyriverBeamRecord,
  type SkyriverBeamView,
  type SkyriverMutableBeamRecord,
} from './atmosphere';
import type { SkyriverLightSource, SkyriverTrimSourceTermId } from './city';

/** The marcher's uniform array length. Ten actual nearby sources, as the R23 brief requires. */
export const SKYRIVER_RENDER_LIGHT_LIMIT = 10;

/** Linear Rec.709 luminance. The one definition this module ranks energy with. */
export function skyriverLinearLuminance(rgb: readonly [number, number, number]): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/**
 * The live shader coefficients `city.lightSources()` does not carry, read off the trim fragment
 * shader (city.ts:3099-3141) so the proxy energy is the term the GPU actually emits.
 *
 * `gain` is every constant factor outside the source RGB. `faceDuty` is the share of the instance's
 * lit face the term covers — the band only lights its soffit and a thin edge, the skybridge ribbon
 * only a hashed run of panes on its two side faces. `pulseMean` is the time-average of the term's
 * own oscillation, so a frozen frame and a moving one rank the same source the same way.
 *
 * EMISSIVE_GAIN is applied here exactly once. Sign emission already carries its own 2.2/1.9 gain
 * inside `skyriverSignFinalEmission`, so signs are listed with gain 1 and are never re-scaled.
 */
export const SKYRIVER_TRIM_SOURCE_COEFFICIENTS: Readonly<Record<SkyriverTrimSourceTermId, {
  readonly gain: number;
  readonly faceDuty: number;
  readonly pulseMean: number;
  /** Instances taller than this get the flood strip's 1.5x size factor (`step( 50.0, vSizeM.y )`). */
  readonly sizeBoostAboveM: number | null;
}>> = Object.freeze({
  // `floodStrip = rgb * ( 1.0 + 0.5 * step( 50.0, vSizeM.y ) ) * ( 0.85 + 0.15 * sin(..) ) * GAIN`
  'trim-flood': Object.freeze({ gain: SKYRIVER_EMISSIVE_GAIN, faceDuty: 1, pulseMean: 0.85, sizeBoostAboveM: 50 }),
  // `rgb * ( isBridge * sideFace * ribbon * pane * 1.1 * GAIN )`: two side faces, a thin ribbon
  // band, and `step( 0.3, fract( run / 4.0 ) ) * step( 0.3, hash )` panes.
  'trim-skybridge-ribbon': Object.freeze({ gain: 1.1 * SKYRIVER_EMISSIVE_GAIN, faceDuty: 0.5 * 0.24 * 0.49, pulseMean: 1, sizeBoostAboveM: null }),
  // `rgb * runLive * ( soffit * 0.55 + edge * 0.15 ) * GAIN`, `runLive = step( 0.35, hash )`.
  'trim-band-warm': Object.freeze({ gain: SKYRIVER_EMISSIVE_GAIN, faceDuty: 0.65 * 0.55, pulseMean: 1, sizeBoostAboveM: null }),
  'trim-band-cold': Object.freeze({ gain: SKYRIVER_EMISSIVE_GAIN, faceDuty: 0.65 * 0.55, pulseMean: 1, sizeBoostAboveM: null }),
  // Small lamps. `lightSources()` never reports these kinds, so they are listed for completeness of
  // the term map and carry their own actual gain if a later round promotes them.
  'trim-deck-lamp': Object.freeze({ gain: 0.9 * SKYRIVER_EMISSIVE_GAIN, faceDuty: 0.12 * 0.75, pulseMean: 1, sizeBoostAboveM: null }),
  'trim-balcony-underlight': Object.freeze({ gain: 0.5 * SKYRIVER_EMISSIVE_GAIN, faceDuty: 0.28, pulseMean: 1, sizeBoostAboveM: null }),
});

// --- the source-to-scatter unit proxy ----------------------------------------------------------

/**
 * Steradians in a full sphere. The one constant the scatter proxy is normalised by.
 *
 * Exported so the GLSL twin in `volumeFog.ts` is generated from this same value and the two cannot
 * drift apart. See `SKYRIVER_SCATTER_RESPONSE_GLSL`.
 */
export const SKYRIVER_SCATTER_SPHERE_SR = 4 * Math.PI;

/**
 * The spatial scatter response of one source at one world distance.
 *
 * Units. `litAreaM2` is square metres of actually lit emitting surface; `distanceM` is metres of
 * world distance; the quotient is dimensionless. It reads as the share of the sphere around the
 * sample that the lit area subtends. It is a bounded geometric proxy, NOT a photometric
 * measurement: the source carries no SI radiometric unit, nothing here is calibrated against a
 * luminance meter, and the proxy has no orientation term, so a sample behind a one-sided facade
 * still receives its response.
 *
 * The two properties it exists for:
 *   - Bounded. 1 at zero distance, falling monotonically, so a sample beside a source receives the
 *     source's own emission and never a multiple of it.
 *   - Area-driven. Far away it goes as `litArea / (4 pi d^2)`, so a large lit facade reaches
 *     further than a small one on its own geometry, with no range clamp to fake the difference.
 *
 * `litArea / (litArea + 4 pi d^2)` is the same curve as `1 / (1 + (d / r)^2)` with
 * `r = skyriverScatterRadiusM(litArea)`. The area form is the one the shader runs, because it keeps
 * the unit visible where it is used.
 */
export function skyriverScatterResponse(litAreaM2: number, distanceM: number): number {
  const area = Math.max(0, litAreaM2);
  const distance = Math.max(0, distanceM);
  const denominator = area + SKYRIVER_SCATTER_SPHERE_SR * distance * distance;
  return denominator > 0 ? area / denominator : 0;
}

/** Half-response distance of that proxy, metres: `sqrt(litArea / 4 pi)`. Derived, never a knob. */
export function skyriverScatterRadiusM(litAreaM2: number): number {
  return Math.sqrt(Math.max(0, litAreaM2) / SKYRIVER_SCATTER_SPHERE_SR);
}

export type SkyriverRenderLightKind = 'sign' | 'cone' | 'station';

/**
 * The one place a kind may ever be weighted against the others, in the rank and in the uploaded
 * radiance together.
 *
 * Every entry is 1.0: R23 applies no role importance at all. Selection and the marcher run on the
 * bounded proxy alone, so a measured frame is not confounded by a taste factor, and a later round
 * has exactly one place to change. `lightSetEvidence` reports this record as it stands.
 */
export const SKYRIVER_LIGHT_ROLE_IMPORTANCE: Readonly<Record<SkyriverRenderLightKind, number>> =
  Object.freeze({ sign: 1, cone: 1, station: 1 });

interface SkyriverRenderLightCommon {
  /** Unique over the full drawn pool: the getter id plus a stable per-instance ordinal. */
  readonly id: string;
  /** The getter's own id. Not unique on its own — a hero's blades share one `signIdentity`. */
  readonly sourceId: string;
  /** Index in the full pool, in getter order. Stable for a seed; never a selected-list index. */
  readonly ordinal: number;
  readonly role: string;
  readonly districtId: number;
  readonly position: readonly [number, number, number];
  /** Reference linear emission with the district recolour applied and every gain applied once. */
  readonly emission: readonly [number, number, number];
  /** The same reference emission on the colour-off path. */
  readonly legacyEmission: readonly [number, number, number];
  /**
   * The source's own peak scatter radiance as linear luminance: `Y(emission)` for an area source,
   * `Y(colour) * intensity` for a cone, which is what the drawn beam formula peaks at. The rank
   * uses this one amplitude, so the rank cannot disagree with the radiance the marcher applies.
   */
  readonly peakLuminance: number;
  /** Square metres of actually lit emitting surface. The scatter proxy's only geometric input. */
  readonly litAreaM2: number;
  /** `sqrt(litAreaM2 / 4 pi)`, metres. Derived from the area, reported for the record. */
  readonly scatterRadiusM: number;
}

export interface SkyriverRenderSignLight extends SkyriverRenderLightCommon {
  readonly kind: 'sign';
  /** The sign's long axis in world space, from its drawn rigid frame. */
  readonly axis: readonly [number, number, number];
  readonly halfLengthM: number;
}

export interface SkyriverRenderStationLight extends SkyriverRenderLightCommon {
  readonly kind: 'station';
  /** The drawn trim this proxy reads. Recorded so the report names a real instance, not a name. */
  readonly trimId: string;
}

export interface SkyriverRenderConeLight extends SkyriverRenderLightCommon {
  readonly kind: 'cone';
  /** Beam slot 0..4. The axis, origin and widths are re-read live from this slot every frame. */
  readonly beamSlot: number;
  /** Construction-time snapshot, for ranking only. The uploaded geometry is always the live beam. */
  readonly axis: readonly [number, number, number];
  readonly lengthM: number;
  readonly widthStartM: number;
  readonly widthEndM: number;
  readonly intensity: number;
  readonly softness: number;
  readonly fadeStart: number;
}

export type SkyriverRenderLightSource =
  | SkyriverRenderSignLight
  | SkyriverRenderStationLight
  | SkyriverRenderConeLight;

/** One selected source and the smooth weight the cutoff gave it. */
export interface SkyriverSelectedLight {
  readonly source: SkyriverRenderLightSource;
  /** 0..1. Falls smoothly to 0 at the selection cutoff so a source never pops in or out. */
  readonly weight: number;
  /** `peakLuminance x roleImportance x scatterResponse`. The rank key, in the proxy's own units. */
  readonly score: number;
  readonly distanceM: number;
}

function luminanceWithGain(
  rgb: readonly [number, number, number],
  gain: number,
): readonly [number, number, number] {
  return [rgb[0] * gain, rgb[1] * gain, rgb[2] * gain];
}

/**
 * The large emissive trims R23 uses as station-glow proxies, in preference order.
 *
 * The source has no transit-station records at all. Rather than invent invisible point lights under
 * a station name, R23 promotes two or three real drawn trims: the skybridge side ribbon first (trim
 * kind 6, the getter's recoloured ribbon — not the separate, untouched blue underlight), then the
 * landmark flood strip (kind 9). The chosen ids and emission terms are reported in `evidence()`.
 */
export const SKYRIVER_STATION_PROXY_ROLES: readonly SkyriverTrimSourceTermId[] = Object.freeze([
  'trim-skybridge-ribbon',
  'trim-flood',
]);

/** How many station-glow proxies R23 promotes. Two or three real hubs, as the design states. */
export const SKYRIVER_STATION_PROXY_COUNT = 3;

const SIGN_ROLES = new Set(['ordinary-sign', 'hero-sign']);

/**
 * Builds the static pool once from the real drawn sources.
 *
 * Every world position and axis comes straight off `city.lightSources()`, which copies them from
 * the rigid frames the instances were written with — so a sign on a canyon bend lights the air
 * where it is drawn, and a removed sign or a hero-cleared trim is simply absent.
 */
export function skyriverBuildLightPool(options: {
  readonly sources: readonly SkyriverLightSource[];
  readonly beams: readonly SkyriverBeamRecord[];
}): readonly SkyriverRenderLightSource[] {
  const { sources, beams } = options;
  const pool: SkyriverRenderLightSource[] = [];
  const stationBudget = new Map<SkyriverTrimSourceTermId, number>();

  // Pass one: every drawn city source, in getter order, so `ordinal` is stable for a seed.
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]!;
    const ordinal = index;
    const id = `${source.id}#${ordinal}`;
    const [sx, sy, sz] = source.sizeM;

    if (SIGN_ROLES.has(source.role)) {
      // Signs are a flat face: width x height. Their emission already carries its own gain.
      const litAreaM2 = Math.max(1e-3, sx * sy);
      const emission = source.emission as readonly [number, number, number];
      const legacy = source.legacyEmission as readonly [number, number, number];
      pool.push({
        kind: 'sign',
        id,
        sourceId: source.id,
        ordinal,
        role: source.role,
        districtId: source.districtId,
        position: [source.x, source.y, source.z],
        axis: source.axis as readonly [number, number, number],
        halfLengthM: Math.max(sx, sy) * 0.5,
        emission,
        legacyEmission: legacy,
        peakLuminance: skyriverLinearLuminance(emission),
        litAreaM2,
        scatterRadiusM: skyriverScatterRadiusM(litAreaM2),
      });
      continue;
    }

    const termId = source.role as SkyriverTrimSourceTermId;
    const coefficients = SKYRIVER_TRIM_SOURCE_COEFFICIENTS[termId];
    if (coefficients === undefined) throw new Error(`SKYRIVER_LIGHT_TERM_UNKNOWN:${source.role}`);
    const sizeBoost = coefficients.sizeBoostAboveM !== null && sy >= coefficients.sizeBoostAboveM ? 1.5 : 1;
    const gain = coefficients.gain * coefficients.pulseMean * sizeBoost;
    const emission = luminanceWithGain(source.emission as readonly [number, number, number], gain);
    const legacy = luminanceWithGain(source.legacyEmission as readonly [number, number, number], gain);
    // The actually lit area, not the box area: the box surface the term can reach, times the share
    // of that face the term really lights (a band lights its soffit and a thin edge, not the box).
    const surfaceM2 = 2 * (sx * sy + sy * sz + sx * sz);
    const litAreaM2 = Math.max(1e-3, surfaceM2 * coefficients.faceDuty);

    // The first few of the preferred roles become the station-glow proxies; the rest stay signs'
    // peers as bounded area sources.
    const preferenceIndex = SKYRIVER_STATION_PROXY_ROLES.indexOf(termId);
    const spent = stationBudget.get(termId) ?? 0;
    const perRole = preferenceIndex === 0 ? 2 : 1;
    const isStationProxy = preferenceIndex >= 0
      && spent < perRole
      && [...stationBudget.values()].reduce((a, b) => a + b, 0) < SKYRIVER_STATION_PROXY_COUNT;
    if (isStationProxy) {
      stationBudget.set(termId, spent + 1);
      pool.push({
        kind: 'station',
        id,
        sourceId: source.id,
        ordinal,
        role: source.role,
        districtId: source.districtId,
        position: [source.x, source.y, source.z],
        emission,
        legacyEmission: legacy,
        peakLuminance: skyriverLinearLuminance(emission),
        litAreaM2,
        scatterRadiusM: skyriverScatterRadiusM(litAreaM2),
        trimId: source.id,
      });
      continue;
    }

    pool.push({
      kind: 'sign',
      id,
      sourceId: source.id,
      ordinal,
      role: source.role,
      districtId: source.districtId,
      position: [source.x, source.y, source.z],
      axis: source.axis as readonly [number, number, number],
      halfLengthM: Math.max(sx, sy, sz) * 0.5,
      emission,
      legacyEmission: legacy,
      peakLuminance: skyriverLinearLuminance(emission),
      litAreaM2,
      scatterRadiusM: skyriverScatterRadiusM(litAreaM2),
    });
  }

  // Pass two: the five searchlights, slots 0..4, from the actual beam records.
  for (const beam of beams) {
    const ordinal = pool.length;
    const colour = beam.colorLinear as readonly [number, number, number];
    // A beam is not a facade, so its proxy area is the shaft's own drawn side area: mean width over
    // the taper, times length. That is what puts a sweeping searchlight on the same rank scale as a
    // lit facade, instead of the separate intensity scalar that kept every cone out of the set.
    const litAreaM2 = Math.max(1e-3, (beam.widthStartM + beam.widthEndM) * 0.5 * beam.lengthM);
    pool.push({
      kind: 'cone',
      id: `searchlight:${beam.slot}#${ordinal}`,
      sourceId: `searchlight:${beam.slot}`,
      ordinal,
      role: 'searchlight',
      // A searchlight is the atmosphere's own light, not a district accent: it keeps its colour on
      // both sides of the R22 colour A/B, exactly as the drawn beam does.
      districtId: -1,
      position: [beam.start[0], beam.start[1], beam.start[2]],
      axis: [beam.axis[0], beam.axis[1], beam.axis[2]],
      emission: colour,
      legacyEmission: colour,
      // The drawn beam formula peaks at colour x intensity, so that is the cone's peak radiance.
      peakLuminance: skyriverLinearLuminance(colour) * beam.intensity,
      litAreaM2,
      scatterRadiusM: skyriverScatterRadiusM(litAreaM2),
      beamSlot: beam.slot,
      lengthM: beam.lengthM,
      widthStartM: beam.widthStartM,
      widthEndM: beam.widthEndM,
      intensity: beam.intensity,
      softness: beam.softness,
      fadeStart: beam.fadeStart,
    });
  }

  return pool;
}

/** Shortest distance from a point to a segment centred on `position` along `axis`. */
function distanceToSource(
  source: SkyriverRenderLightSource,
  x: number,
  y: number,
  z: number,
): number {
  const dx = x - source.position[0];
  const dy = y - source.position[1];
  const dz = z - source.position[2];
  if (source.kind === 'station') return Math.sqrt(dx * dx + dy * dy + dz * dz);

  const axis = source.axis;
  const half = source.kind === 'sign' ? source.halfLengthM : source.lengthM * 0.5;
  // A cone's record origin is its start, so its segment runs forward, not both ways.
  const along = source.kind === 'cone'
    ? Math.min(source.lengthM, Math.max(0, dx * axis[0] + dy * axis[1] + dz * axis[2]))
    : Math.min(half, Math.max(-half, dx * axis[0] + dy * axis[1] + dz * axis[2]));
  const px = dx - axis[0] * along;
  const py = dy - axis[1] * along;
  const pz = dz - axis[2] * along;
  return Math.sqrt(px * px + py * py + pz * pz);
}

/**
 * The absolute floor, in the score's own units of linear luminance times the bounded proxy.
 *
 * Derivation, so the number is not a guess: a selected source contributes at most
 * `score x scatterGain(0.55) x integratedScatterFraction(<1)` of reference linear radiance, which
 * at this floor is under 1.1e-4 before the renderer's 1.9 exposure — below one 8-bit output code
 * step at the dark end of the transfer curve. A source under it cannot change a pixel.
 *
 * It exists only to keep genuinely negligible sources off the sort. It is NOT what smooths the
 * cutoff — in a canyon this dense, many drawn sources score above it, so the boundary that
 * actually bites is tenth place. See `skyriverLightCutoffWeight`.
 */
export const SKYRIVER_LIGHT_SCORE_FLOOR = 2e-4;

/**
 * Width of the ramp above the selection boundary, as a fraction of the boundary score.
 *
 * A source scoring this far above the first rejected source carries full weight; one sitting on the
 * boundary carries none. That is where popping happens, so that is where the smoothing belongs: a
 * source leaves the selection already faint, and a new one arrives already faint.
 */
export const SKYRIVER_LIGHT_CUTOFF_BAND = 0.5;

function smoothstep01(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

/**
 * The rank key: the source's own peak radiance times the same bounded proxy the marcher scatters.
 *
 * One expression for all three kinds, so the kinds are comparable. Nothing here squares a source's
 * luminance and nothing grows a reach out of a brightness, which is what let ten inflated heroes
 * hold every slot while nearby searchlights and station proxies scored a thousand times lower.
 *
 * A cone's peak radiance is its drawn `colour x intensity` and its proxy area is its shaft side
 * area, so a sweeping searchlight enters the set when the camera is near its shaft and loses to a
 * closer facade when it is not.
 */
export function skyriverLightScore(
  source: SkyriverRenderLightSource,
  cameraX: number,
  cameraY: number,
  cameraZ: number,
): { readonly score: number; readonly distanceM: number } {
  const distanceM = distanceToSource(source, cameraX, cameraY, cameraZ);
  const response = skyriverScatterResponse(source.litAreaM2, distanceM);
  const importance = SKYRIVER_LIGHT_ROLE_IMPORTANCE[source.kind];
  return { score: source.peakLuminance * importance * response, distanceM };
}

/**
 * The smooth cutoff weight for one score against the selection boundary.
 *
 * `boundary` is the score of the best source that did NOT make the selection. With a pool smaller
 * than the limit there is no boundary and every selected source carries full weight.
 */
export function skyriverLightCutoffWeight(score: number, boundary: number): number {
  if (!(boundary > 0)) return 1;
  return smoothstep01((score - boundary) / (boundary * SKYRIVER_LIGHT_CUTOFF_BAND));
}

export interface SkyriverLightSelectionResult {
  readonly selected: readonly SkyriverSelectedLight[];
  /** The score of the best rejected source, or 0 when the pool is smaller than the limit. */
  readonly boundaryScore: number;
}

/**
 * Picks at most ten sources by `skyriverLightScore`.
 *
 * The rank is bounded: finite at zero distance and falling with the square of world distance, so no
 * source dominates the sort by sitting on the camera. Ties break on `id`, which is unique over the
 * drawn pool, so the selection is a stable function of the camera position alone.
 */
export function skyriverSelectLights(
  pool: readonly SkyriverRenderLightSource[],
  cameraX: number,
  cameraY: number,
  cameraZ: number,
  limit = SKYRIVER_RENDER_LIGHT_LIMIT,
): SkyriverLightSelectionResult {
  const scored: { source: SkyriverRenderLightSource; score: number; distanceM: number }[] = [];
  for (const source of pool) {
    const { score, distanceM } = skyriverLightScore(source, cameraX, cameraY, cameraZ);
    if (!(score > SKYRIVER_LIGHT_SCORE_FLOOR)) continue;
    scored.push({ source, score, distanceM });
  }
  scored.sort((a, b) => b.score - a.score || a.source.id.localeCompare(b.source.id));

  const boundaryScore = scored.length > limit ? scored[limit]!.score : 0;
  const selected = scored.slice(0, limit).map((entry) => ({
    source: entry.source,
    weight: skyriverLightCutoffWeight(entry.score, boundaryScore),
    score: entry.score,
    distanceM: entry.distanceM,
  }));
  return { selected, boundaryScore };
}

/**
 * The candidate set the live rank runs over, every frame.
 *
 * Larger than the ten upload slots on purpose: the weight ramp needs a LIVE boundary score, which
 * means the best rejected sources have to be re-scored as the camera moves. Scoring only the ten
 * selected sources against a boundary frozen a second ago is what let a held source keep weight 1
 * while the camera flew toward a better one, and then swap 1 -> 0 against 0 -> 1 at the refresh.
 *
 * The cost is `candidates + slots` scores per frame (at most 42) plus one full pool scan per hold
 * bucket. The pool is 4431 drawn sources, so a per-frame full rank is the thing this avoids.
 */
export const SKYRIVER_LIGHT_CANDIDATE_LIMIT = 32;

/** Seconds a weight takes to travel the whole 0..1 range. Entry and exit both use it. */
export const SKYRIVER_LIGHT_WEIGHT_RAMP_S = 0.25;

/**
 * Longest delta the ramp integrates. A longer frame ramps over more frames, never in a bigger
 * jump, so the per-frame step is bounded at every frame rate: 1/30 / 0.25 = 0.0667... x 2 = 0.1333.
 */
export const SKYRIVER_LIGHT_WEIGHT_MAX_DELTA_S = 1 / 30;

/** The largest weight change one frame may make. Bounded for any delta, by construction. */
export const SKYRIVER_LIGHT_WEIGHT_MAX_STEP =
  SKYRIVER_LIGHT_WEIGHT_MAX_DELTA_S / SKYRIVER_LIGHT_WEIGHT_RAMP_S;

/** How far a weight may move in `deltaS` seconds. Pure, and the one place the rate is applied. */
export function skyriverLightWeightStep(deltaS: number): number {
  if (!(deltaS > 0)) return 0;
  return Math.min(deltaS, SKYRIVER_LIGHT_WEIGHT_MAX_DELTA_S) / SKYRIVER_LIGHT_WEIGHT_RAMP_S;
}

/** Moves `from` toward `to` by at most `step`. Monotone, and it lands exactly on `to`. */
export function skyriverApproach(from: number, to: number, step: number): number {
  if (!(step > 0)) return from;
  if (to > from) return Math.min(to, from + step);
  return Math.max(to, from - step);
}

/** Why a selector reset: a declared presentation discontinuity, where a snap is correct. */
export type SkyriverLightSelectionResetReason = 'seek' | 'explicit';

interface MutableSlot {
  source: SkyriverRenderLightSource;
  /** The uploaded weight. It only ever moves by `skyriverLightWeightStep`. */
  weight: number;
  /** Where the uploaded weight is heading: the live cutoff weight, or 0 while leaving. */
  target: number;
  score: number;
  distanceM: number;
}

/**
 * The ten uploaded sources and their weights, kept CONTINUOUS across membership changes.
 *
 * The GPU limit is ten sources, so membership has to change as the camera flies. The policy that
 * makes it change without a pop has three parts, and all three are needed:
 *
 *  1. A live candidate set (`SKYRIVER_LIGHT_CANDIDATE_LIMIT`), re-scored EVERY frame. The boundary
 *     is the live score of the eleventh candidate, so the smooth cutoff ramp is measured against a
 *     boundary that moves with the camera instead of one frozen at the last refresh.
 *  2. A per-source ramp. The cutoff weight is a TARGET; the uploaded weight walks toward it at
 *     `SKYRIVER_LIGHT_WEIGHT_RAMP_S`, so no source id can change by more than
 *     `SKYRIVER_LIGHT_WEIGHT_MAX_STEP` in one frame, whatever happens to the ranking.
 *  3. Ramp out before slot reuse. A source that loses its place gets target 0 and keeps its slot
 *     until its weight reaches 0; only then is the slot free, and the source taking it starts from
 *     0. So an id is never replaced at a non-zero weight, which is the pop itself.
 *
 * The full pool is re-ranked once per `holdS` to refresh the candidate set. Currently slotted
 * sources are always kept in that set, so a slotted source is scored against the same boundary as
 * the candidates and cannot be dropped by the refresh alone.
 *
 * Cone geometry is NOT held: `SkyriverVolumeFogPass` re-reads the live beam slot every frame, so a
 * held searchlight still sweeps.
 *
 * A declared discontinuity — a replay seek, a resume, a chain change — calls `reset`, which clears
 * the slots and snaps the next frame to its targets. Everything else about that frame is
 * discontinuous too (the volume history is dropped in the same place), so ramping there would only
 * delay the correct answer.
 */
export class SkyriverLightSelection {
  private readonly slots: MutableSlot[] = [];
  private candidates: SkyriverRenderLightSource[] = [];
  private selected: SkyriverSelectedLight[] = [];
  private boundaryScore = 0;
  private bucket = Number.NaN;
  private lastTimeS = Number.NaN;
  private refreshes = 0;
  private resets = 0;
  private admissions = 0;
  private releases = 0;
  private scoredLastFrame = 0;
  private worstWeightStep = 0;
  /** True while the next update must land on its targets rather than ramp toward them. */
  private snapNext = true;

  constructor(
    private readonly pool: readonly SkyriverRenderLightSource[],
    private readonly holdS = 1,
    private readonly limit = SKYRIVER_RENDER_LIGHT_LIMIT,
    private readonly candidateLimit = SKYRIVER_LIGHT_CANDIDATE_LIMIT,
  ) {}

  /**
   * Drops every slot and the candidate set. The next `update` re-ranks and snaps.
   *
   * For a declared discontinuity only. It is NOT the path a moving camera takes.
   */
  reset(_reason: SkyriverLightSelectionResetReason = 'explicit'): void {
    this.slots.length = 0;
    this.candidates = [];
    this.selected = [];
    this.boundaryScore = 0;
    this.bucket = Number.NaN;
    this.lastTimeS = Number.NaN;
    this.snapNext = true;
    this.resets += 1;
  }

  update(
    timeS: number,
    cameraX: number,
    cameraY: number,
    cameraZ: number,
  ): readonly SkyriverSelectedLight[] {
    // A tick that moves backwards is a seek: the held candidate set belongs to a later time.
    if (Number.isFinite(this.lastTimeS) && timeS < this.lastTimeS) this.reset('seek');
    const deltaS = Number.isFinite(this.lastTimeS) ? timeS - this.lastTimeS : 0;
    this.lastTimeS = timeS;

    // The candidate set is refreshed on the hold bucket: one full pool scan per bucket, never per
    // frame. Membership and weights do NOT freeze with it — that is the point of the rest of this.
    const bucket = Math.floor(timeS / this.holdS);
    if (bucket !== this.bucket) {
      this.bucket = bucket;
      this.refreshCandidates(cameraX, cameraY, cameraZ);
      this.refreshes += 1;
    }

    // Every candidate and every slotted source, re-scored against the CURRENT camera.
    const scored: { source: SkyriverRenderLightSource; score: number; distanceM: number }[] = [];
    for (const source of this.candidates) {
      const { score, distanceM } = skyriverLightScore(source, cameraX, cameraY, cameraZ);
      if (!(score > SKYRIVER_LIGHT_SCORE_FLOOR)) continue;
      scored.push({ source, score, distanceM });
    }
    this.scoredLastFrame = scored.length;
    scored.sort((a, b) => b.score - a.score || a.source.id.localeCompare(b.source.id));

    // The live boundary: the score of the best source that did not make the top `limit`.
    this.boundaryScore = scored.length > this.limit ? scored[this.limit]!.score : 0;

    // Targets for the live top `limit`. Everything else targets zero, including a slot holder that
    // has just lost its place — it ramps out, it does not vanish.
    const targets = new Map<string, { target: number; score: number; distanceM: number }>();
    const wanted: SkyriverRenderLightSource[] = [];
    for (let i = 0; i < Math.min(this.limit, scored.length); i += 1) {
      const entry = scored[i]!;
      targets.set(entry.source.id, {
        target: skyriverLightCutoffWeight(entry.score, this.boundaryScore),
        score: entry.score,
        distanceM: entry.distanceM,
      });
      wanted.push(entry.source);
    }

    const step = this.snapNext ? 1 : skyriverLightWeightStep(deltaS);
    for (const slot of this.slots) {
      const live = targets.get(slot.source.id);
      if (live === undefined) {
        // Not in the live top set: keep reporting its real score and walk the weight to zero.
        const rescored = skyriverLightScore(slot.source, cameraX, cameraY, cameraZ);
        slot.score = rescored.score;
        slot.distanceM = rescored.distanceM;
        slot.target = 0;
      } else {
        slot.score = live.score;
        slot.distanceM = live.distanceM;
        slot.target = live.target;
      }
      const next = this.snapNext
        ? slot.target
        : skyriverApproach(slot.weight, slot.target, step);
      // Snaps are excluded: a declared discontinuity is not a ramp, and counting it here would
      // make this number useless as evidence for the ramp bound.
      if (!this.snapNext) {
        this.worstWeightStep = Math.max(this.worstWeightStep, Math.abs(next - slot.weight));
      }
      slot.weight = next;
    }

    // A slot is free only when its source has finished ramping out: weight 0 with target 0. So a
    // replacement never takes a slot from a source that is still contributing light.
    for (let i = this.slots.length - 1; i >= 0; i -= 1) {
      const slot = this.slots[i]!;
      if (slot.weight <= 0 && slot.target <= 0) {
        this.slots.splice(i, 1);
        this.releases += 1;
      }
    }

    // Admit the best wanted sources that are not slotted yet, at weight ZERO. They ramp up from
    // there on the following frames, so an arrival is a fade-in and never a step.
    for (const source of wanted) {
      if (this.slots.length >= this.limit) break;
      if (this.slots.some((slot) => slot.source.id === source.id)) continue;
      const live = targets.get(source.id)!;
      const admitted: MutableSlot = {
        source,
        weight: this.snapNext ? live.target : 0,
        target: live.target,
        score: live.score,
        distanceM: live.distanceM,
      };
      this.slots.push(admitted);
      this.admissions += 1;
      if (!this.snapNext) {
        // An admission is a step from absent (0) to the admitted weight, which is 0 — so this
        // records the zero it really is rather than assuming it.
        this.worstWeightStep = Math.max(this.worstWeightStep, admitted.weight);
      }
    }

    this.snapNext = false;
    // Highest weight first, ties on the stable id, so the uploaded order is a function of state.
    this.slots.sort((a, b) => b.weight - a.weight || a.source.id.localeCompare(b.source.id));
    this.selected = this.slots.map((slot) => ({
      source: slot.source,
      weight: slot.weight,
      score: slot.score,
      distanceM: slot.distanceM,
    }));
    return this.selected;
  }

  /** One full pool rank, at most once per hold bucket. Slotted sources always stay candidates. */
  private refreshCandidates(cameraX: number, cameraY: number, cameraZ: number): void {
    const ranked = skyriverSelectLights(this.pool, cameraX, cameraY, cameraZ, this.candidateLimit);
    const next = ranked.selected.map((entry) => entry.source);
    const present = new Set(next.map((source) => source.id));
    for (const slot of this.slots) {
      if (!present.has(slot.source.id)) next.push(slot.source);
    }
    this.candidates = next;
  }

  current(): readonly SkyriverSelectedLight[] {
    return this.selected;
  }

  /** The policy and its measured cost, so a record states what actually ran. */
  stats(): {
    readonly poolSize: number;
    readonly selected: number;
    readonly refreshes: number;
    readonly resets: number;
    readonly bucket: number;
    readonly boundaryScore: number;
    readonly limit: number;
    readonly candidateLimit: number;
    readonly candidates: number;
    readonly scoredLastFrame: number;
    readonly admissions: number;
    readonly releases: number;
    readonly weightRampS: number;
    readonly maxWeightStep: number;
    readonly worstWeightStep: number;
    readonly policy: string;
  } {
    return {
      poolSize: this.pool.length,
      selected: this.selected.length,
      refreshes: this.refreshes,
      resets: this.resets,
      bucket: this.bucket,
      boundaryScore: this.boundaryScore,
      limit: this.limit,
      candidateLimit: this.candidateLimit,
      candidates: this.candidates.length,
      scoredLastFrame: this.scoredLastFrame,
      admissions: this.admissions,
      releases: this.releases,
      weightRampS: SKYRIVER_LIGHT_WEIGHT_RAMP_S,
      maxWeightStep: SKYRIVER_LIGHT_WEIGHT_MAX_STEP,
      // The largest per-frame weight change this instance has actually made, snaps excluded.
      worstWeightStep: this.worstWeightStep,
      policy: `live candidate rank every frame (<= ${this.candidateLimit} + slots scored),`
        + ` full pool scan once per ${this.holdS}s bucket, per-source weight ramp over`
        + ` ${SKYRIVER_LIGHT_WEIGHT_RAMP_S}s, slot reuse only after the leaving source reaches 0`,
    };
  }
}

/**
 * Re-reads a selected cone's live geometry from the beam view.
 *
 * Membership may be held for up to a second, but a searchlight's axis changes every presentation
 * frame. Freezing the axis with the membership would stop the shafts dead between refreshes.
 */
export type { SkyriverMutableBeamRecord };

export function skyriverConeGeometry(
  source: SkyriverRenderConeLight,
  view: SkyriverBeamView,
  out: SkyriverMutableBeamRecord,
): SkyriverBeamRecord {
  view.read(source.beamSlot, out);
  return out;
}

/** Asserts every pool id is unique. A hero's four blades must stay four sources. */
export function skyriverLightPoolDuplicates(
  pool: readonly SkyriverRenderLightSource[],
): readonly string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const source of pool) {
    if (seen.has(source.id)) duplicates.push(source.id);
    seen.add(source.id);
  }
  return duplicates;
}

/** The `sourceId` keys that repeat across the pool — the collisions the ordinal exists to separate. */
export function skyriverLightSourceIdCollisions(
  pool: readonly SkyriverRenderLightSource[],
): readonly { readonly sourceId: string; readonly count: number }[] {
  const counts = new Map<string, number>();
  for (const source of pool) counts.set(source.sourceId, (counts.get(source.sourceId) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([sourceId, count]) => ({ sourceId, count }))
    .sort((a, b) => b.count - a.count || a.sourceId.localeCompare(b.sourceId));
}

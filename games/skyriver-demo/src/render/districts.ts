/**
 * @file districts.ts — R22 render colour districts: the permanent canyon colour map, its one
 *                      authoritative query, and the equal-luminance recolour maths.
 *
 * Plan anchors (.plans/skyriver-r19-r22.html):
 *   R22 — five permanent districts on the existing 12800 m loop; the source palette is chosen per
 *         district instead of globally, and every colour change preserves the FINAL linear
 *         luminance of the emission it replaces.
 *
 * Ownership. This module owns the district model, the single district query, the sign hue quota and
 * the colour maths. It is pure and GL-free (so a node check can assert all of it), it imports no
 * render module except the loop length, and it never reads a warped world position: a mass, tier,
 * room, sign or trim is classified by its own canyon anchor, never by where the bend warp put it.
 *
 * Luminance rule, used everywhere:
 *
 *   Y(c)   = 0.2126 r + 0.7152 g + 0.0722 b     (linear Rec.709)
 *   unit(h) = h / max(Y(h), 1e-6)               so Y(unit(h)) == 1
 *   recolour(c, h, s) = Y(c) * mix(unit(white), unit(h), s)
 *
 * unit(white) is vec3(1) because Y(1,1,1) == 1, so Y(recolour(c, h, s)) == Y(c) for every hue and
 * every saturation: the recolour moves chroma only. Black stays black, and HDR channels above one
 * are never clamped. It is applied to ONE complete emission contribution, never factor by factor.
 */
import { CANYON_LOOP_LENGTH_M } from './canyonWarp';

/** The three district primaries. Green is a group inside a district, never a district of its own. */
export type SkyriverDistrictHue = 'cyan' | 'magenta' | 'amber';

export interface SkyriverDistrict {
  /** 0 .. 4, in route order. Also the shader's palette index. */
  readonly id: number;
  readonly name: string;
  /** Route positions, metres, on [0, loopM). `endM` wraps for the last district. */
  readonly startM: number;
  readonly endM: number;
  readonly lengthM: number;
  readonly primary: SkyriverDistrictHue;
  /** Share of ordinary signs held for the primary hue. */
  readonly primarySignShare: number;
  /** Route positions, metres, of the small green sign groups inside this district. */
  readonly greenGroups: readonly number[];
}

export interface SkyriverDistrictModel {
  readonly seed: number;
  readonly loopM: number;
  readonly districts: readonly SkyriverDistrict[];
}

/**
 * The approved map. The lengths total the loop exactly; `deriveSkyriverDistrictModel` then moves the
 * four interior boundaries by a seeded amount inside SKYRIVER_DISTRICT_BOUNDARY_JITTER_M.
 */
export const SKYRIVER_DISTRICT_PLAN: readonly {
  readonly name: string;
  readonly lengthM: number;
  readonly primary: SkyriverDistrictHue;
  readonly greenGroups: number;
}[] = Object.freeze([
  Object.freeze({ name: 'ice-towers', lengthM: 3400, primary: 'cyan' as const, greenGroups: 0 }),
  Object.freeze({ name: 'market', lengthM: 2800, primary: 'magenta' as const, greenGroups: 2 }),
  Object.freeze({ name: 'mid-city', lengthM: 2600, primary: 'cyan' as const, greenGroups: 0 }),
  Object.freeze({ name: 'dock', lengthM: 1800, primary: 'amber' as const, greenGroups: 1 }),
  Object.freeze({ name: 'upper-city', lengthM: 2200, primary: 'cyan' as const, greenGroups: 0 }),
]);

export const SKYRIVER_DISTRICT_COUNT = SKYRIVER_DISTRICT_PLAN.length;
/**
 * Green sign groups on the whole lap: two in the market and one on the dock. Three small groups is
 * the approved count — two or three gem moments per lap, not a green district and not a green belt.
 */
export const SKYRIVER_DISTRICT_GREEN_GROUP_COUNT = SKYRIVER_DISTRICT_PLAN
  .reduce((sum, entry) => sum + entry.greenGroups, 0);
/** Largest seeded move of an interior boundary, metres (the brief's 160 m). */
export const SKYRIVER_DISTRICT_BOUNDARY_JITTER_M = 160;
/** No district may be shorter than this. The shortest plan length is 1800 m, so 1400 m always holds. */
export const SKYRIVER_DISTRICT_MIN_LENGTH_M = 1400;
/** Length of one green sign group's route window, metres. The three groups cover 7.5% of the lap. */
export const SKYRIVER_DISTRICT_GREEN_GROUP_LENGTH_M = 320;
/** Total width of the haze blend across a district boundary, metres (the brief's 300–500 m). */
export const SKYRIVER_DISTRICT_HAZE_BLEND_M = 400;

/**
 * Source hues, packed 0xRRGGBB in sRGB exactly as city.ts's NEON_PALETTE carries them. R22 chooses
 * which of these a source uses; it does not invent a new palette.
 */
export const SKYRIVER_DISTRICT_PALETTE = Object.freeze({
  cyan: 0x2ff2ff,
  magenta: 0xff2fb4,
  amber: 0xffb13c,
  green: 0x55ff7a,
  ice: 0xd6ecff,
});

/**
 * How far each source role moves toward its district hue, 0 (neutral at the same luminance) to 1
 * (the district hue at the same luminance). Accents are saturated; rooms, panes and far cards take
 * the weak 0.05–0.10 tint the brief asks for; small background lamps stay neutral.
 */
export const SKYRIVER_DISTRICT_SATURATION = Object.freeze({
  /** Hero blades, panels and the brand sign. */
  hero: 1,
  /** The brightest share of eligible accent signs (see SKYRIVER_DISTRICT_BRIGHT_ACCENT_SHARE). */
  signBright: 1,
  /** Every other district-hue sign. */
  sign: 0.85,
  /** The ice-white background signs: near neutral on purpose. */
  signNeutral: 0.22,
  /** Resolved panes and traced rooms. */
  room: 0.08,
  /** The unresolved far pane average and the R15 far-box window grid. */
  pane: 0.07,
  /** R16 impostor cards. */
  farCard: 0.06,
  /** Floor-band strips, floodlight trim, skybridge ribbons, lit parapets. */
  trimLarge: 0.55,
  /** Deck lamps, balcony underlights and deck skylights: neutral at the same luminance. */
  trimSmall: 0,
  /** The dock keeps its intentional amber service lamps. */
  dockLamp: 0.85,
  /** R13 landmark face and roof wash. */
  wash: 0.6,
  /**
   * Handed to the shared R20 haze tint API. That tint is a per-channel multiplier, not a
   * replacement, and the fog shader applies it at SKYRIVER_FOG_REGION_TINT_WEIGHT (atmosphere.ts),
   * so the effective per-channel deviation from neutral is weight x this saturation x (unitHue - 1).
   * `hazeEvidence` reports the resulting channel factors from that one constant.
   */
  haze: 0.45,
});

/** Share of eligible accent signs that take the full district hue, ranked by actual source energy. */
export const SKYRIVER_DISTRICT_BRIGHT_ACCENT_SHARE = 0.15;
/** Share of a district's ordinary signs held for its primary hue (>= the brief's 0.80). */
export const SKYRIVER_DISTRICT_PRIMARY_SIGN_SHARE = 0.84;
/**
 * Share of a green district's ordinary signs allowed to be green, inside its groups only. With the
 * 0.84 primary share this still leaves every district at or above the brief's 0.80.
 */
export const SKYRIVER_DISTRICT_GREEN_SIGN_SHARE = 0.1;

/** Linear Rec.709 luminance coefficients. One definition for the shaders and for every check. */
export const SKYRIVER_LUMA: readonly [number, number, number] = Object.freeze([0.2126, 0.7152, 0.0722]);

/** R17's distance-grade target. Ysteel and unit(steel) are derived from it, never written by hand. */
export const SKYRIVER_DISTANCE_GRADE_STEEL: readonly [number, number, number] = Object.freeze([0.66, 0.79, 0.98]);

export type SkyriverLinearRgb = readonly [number, number, number];

function fail(code: string): never {
  throw new Error(code);
}

/**
 * A GLSL float literal for a shared constant, with every digit kept. `toFixed(n)` would round a
 * constant a future round changes, which is the whole failure mode a shared constant removes; GLSL
 * only needs the decimal point, so this adds one when the number prints without it.
 */
export function skyriverGlslFloat(value: number): string {
  if (!Number.isFinite(value)) fail('SKYRIVER_GLSL_FLOAT_NOT_FINITE');
  const text = `${value}`;
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
}

// --- colour maths ---------------------------------------------------------------------------------

export function skyriverLinearY(colour: SkyriverLinearRgb): number {
  return SKYRIVER_LUMA[0] * colour[0] + SKYRIVER_LUMA[1] * colour[1] + SKYRIVER_LUMA[2] * colour[2];
}

/** h / max(Y(h), 1e-6): the hue at unit luminance, so a recolour can carry any luminance. */
export function skyriverUnitHue(colour: SkyriverLinearRgb): SkyriverLinearRgb {
  const y = Math.max(skyriverLinearY(colour), 1e-6);
  return [colour[0] / y, colour[1] / y, colour[2] / y];
}

/**
 * Recolours ONE complete emission contribution at equal linear luminance. Never clamps, so an HDR
 * channel stays HDR, and a black source stays exactly black.
 */
export function skyriverRecolorPreservingY(
  colour: SkyriverLinearRgb,
  unitHue: SkyriverLinearRgb,
  saturation: number,
): SkyriverLinearRgb {
  const y = skyriverLinearY(colour);
  return [
    y * (1 - saturation + saturation * unitHue[0]),
    y * (1 - saturation + saturation * unitHue[1]),
    y * (1 - saturation + saturation * unitHue[2]),
  ];
}

/** sRGB 0xRRGGBB to linear Rec.709, matching THREE.Color().setHex(hex, SRGBColorSpace). */
export function skyriverHexToLinear(hex: number): SkyriverLinearRgb {
  return [
    srgbToLinear(((hex >> 16) & 0xff) / 255),
    srgbToLinear(((hex >> 8) & 0xff) / 255),
    srgbToLinear((hex & 0xff) / 255),
  ];
}

function srgbToLinear(channel: number): number {
  return channel < 0.04045 ? channel * 0.0773993808 : Math.pow(channel * 0.9478672986 + 0.0521327014, 2.4);
}

/** Unit-luminance hue per palette entry, in linear Rec.709. The shader uniform carries these. */
export const SKYRIVER_DISTRICT_UNIT_HUE: Readonly<Record<keyof typeof SKYRIVER_DISTRICT_PALETTE, SkyriverLinearRgb>> =
  Object.freeze({
    cyan: Object.freeze(skyriverUnitHue(skyriverHexToLinear(SKYRIVER_DISTRICT_PALETTE.cyan))) as SkyriverLinearRgb,
    magenta: Object.freeze(skyriverUnitHue(skyriverHexToLinear(SKYRIVER_DISTRICT_PALETTE.magenta))) as SkyriverLinearRgb,
    amber: Object.freeze(skyriverUnitHue(skyriverHexToLinear(SKYRIVER_DISTRICT_PALETTE.amber))) as SkyriverLinearRgb,
    green: Object.freeze(skyriverUnitHue(skyriverHexToLinear(SKYRIVER_DISTRICT_PALETTE.green))) as SkyriverLinearRgb,
    ice: Object.freeze(skyriverUnitHue(skyriverHexToLinear(SKYRIVER_DISTRICT_PALETTE.ice))) as SkyriverLinearRgb,
  });

/** Ysteel from the actual vector: 0.2126*0.66 + 0.7152*0.79 + 0.0722*0.98. Never a rounded 0.776. */
export const SKYRIVER_DISTANCE_GRADE_STEEL_Y = skyriverLinearY(SKYRIVER_DISTANCE_GRADE_STEEL);
export const SKYRIVER_DISTANCE_GRADE_UNIT_STEEL = Object.freeze(
  skyriverUnitHue(SKYRIVER_DISTANCE_GRADE_STEEL),
) as SkyriverLinearRgb;

function gradeSmoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** R17's grade strength at a view depth, with the per-layer extra. The CPU twin of the shader. */
export function skyriverDistanceGradeK(depthM: number, extra: number): number {
  return Math.min(0.92, Math.max(0, gradeSmoothstep(900, 5000, depthM) * 0.75 + extra));
}

/**
 * The old grade's total brightness factor, g(k) = (1 - k + Ysteel k)(1 - 0.55 k).
 * The old grade already changed luminance; R22 keeps that change and only frees the desaturation
 * from it, so Y(new grade) == Y(old grade) == Y(c) * g(k).
 */
export function skyriverDistanceGradeBrightness(k: number): number {
  return (1 - k + SKYRIVER_DISTANCE_GRADE_STEEL_Y * k) * (1 - 0.55 * k);
}

/** The grade as R17 wrote it: desaturation toward a target whose luminance is Ysteel, not 1. */
export function skyriverLegacyDistanceGrade(colour: SkyriverLinearRgb, k: number): SkyriverLinearRgb {
  const y = skyriverLinearY(colour);
  const fall = 1 - 0.55 * k;
  return [
    (colour[0] + (y * SKYRIVER_DISTANCE_GRADE_STEEL[0] - colour[0]) * k) * fall,
    (colour[1] + (y * SKYRIVER_DISTANCE_GRADE_STEEL[1] - colour[1]) * k) * fall,
    (colour[2] + (y * SKYRIVER_DISTANCE_GRADE_STEEL[2] - colour[2]) * k) * fall,
  ];
}

/** R22's grade: the same brightness curve, desaturating toward unit-luminance steel. */
export function skyriverDistrictDistanceGrade(colour: SkyriverLinearRgb, k: number): SkyriverLinearRgb {
  const y = skyriverLinearY(colour);
  const grade = skyriverDistanceGradeBrightness(k);
  const steel = SKYRIVER_DISTANCE_GRADE_UNIT_STEEL;
  return [
    (colour[0] + (y * steel[0] - colour[0]) * k) * grade,
    (colour[1] + (y * steel[1] - colour[1]) * k) * grade,
    (colour[2] + (y * steel[2] - colour[2]) * k) * grade,
  ];
}

// --- the model ------------------------------------------------------------------------------------

/** Deterministic scalar hash, the same shape as city.ts's hash1. Its own stream, consuming no draw. */
function districtHash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}

/** FNV-1a over a stable source id, to [0, 1). Independent of every geometry random stream. */
export function skyriverDistrictKey(id: string, salt: number): number {
  let hash = 0x811c9dc5 ^ (salt >>> 0);
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 8) / 0x01000000;
}

/** Positive modulo onto [0, loopM). Negative canyon anchors land in the same place every time. */
export function skyriverRoutePosition(v: number, loopM = CANYON_LOOP_LENGTH_M): number {
  const u = v % loopM;
  return u < 0 ? u + loopM : u;
}

/**
 * The four interior boundary positions for a seed, metres on [0, loopM). Boundary 0 is the loop seam
 * and never moves, so the seam sits at one known place in every seed. Pure and uncached, so a check
 * can assert the same seed always produces the same map.
 */
export function skyriverDistrictBoundaries(seed: number, loopM = CANYON_LOOP_LENGTH_M): readonly number[] {
  const planned = SKYRIVER_DISTRICT_PLAN.reduce((sum, entry) => sum + entry.lengthM, 0);
  if (planned !== loopM) fail('SKYRIVER_DISTRICT_PLAN_LENGTH_MISMATCH');
  const boundaries: number[] = [0];
  let cursor = 0;
  for (let i = 0; i < SKYRIVER_DISTRICT_PLAN.length - 1; i += 1) {
    cursor += SKYRIVER_DISTRICT_PLAN[i]!.lengthM;
    const jitter = (districtHash(seed * 0.7311 + i * 19.73 + 4.21) * 2 - 1) * SKYRIVER_DISTRICT_BOUNDARY_JITTER_M;
    boundaries.push(cursor + jitter);
  }
  return boundaries;
}

const modelCache = new Map<string, SkyriverDistrictModel>();

/**
 * The permanent district map for a seed. Pure and cached: every pass (masses, trims, signs, heroes,
 * far cards, haze) reads this one model, so they can never disagree about a boundary.
 */
export function deriveSkyriverDistrictModel(seed: number, loopM = CANYON_LOOP_LENGTH_M): SkyriverDistrictModel {
  const key = `${seed}:${loopM}`;
  const cached = modelCache.get(key);
  if (cached !== undefined) return cached;

  const boundaries = skyriverDistrictBoundaries(seed, loopM);

  const districts: SkyriverDistrict[] = [];
  for (let i = 0; i < SKYRIVER_DISTRICT_PLAN.length; i += 1) {
    const plan = SKYRIVER_DISTRICT_PLAN[i]!;
    const startM = boundaries[i]!;
    const endRaw = i + 1 < boundaries.length ? boundaries[i + 1]! : loopM;
    const lengthM = endRaw - startM;
    if (!(lengthM >= SKYRIVER_DISTRICT_MIN_LENGTH_M)) fail('SKYRIVER_DISTRICT_MIN_LENGTH');
    const greenGroups: number[] = [];
    for (let g = 0; g < plan.greenGroups; g += 1) {
      // Inside the district, clear of both boundaries by at least one group length.
      const margin = SKYRIVER_DISTRICT_GREEN_GROUP_LENGTH_M;
      const span = lengthM - 2 * margin;
      if (span <= 0) fail('SKYRIVER_DISTRICT_GREEN_GROUP_ROOM');
      const slot = (g + 0.5) / plan.greenGroups;
      const wobble = (districtHash(seed * 0.4133 + i * 7.17 + g * 31.9) - 0.5) * 0.4;
      greenGroups.push(skyriverRoutePosition(startM + margin + span * Math.min(0.95, Math.max(0.05, slot + wobble)), loopM));
    }
    districts.push({
      id: i,
      name: plan.name,
      startM: skyriverRoutePosition(startM, loopM),
      endM: skyriverRoutePosition(endRaw, loopM),
      lengthM,
      primary: plan.primary,
      primarySignShare: SKYRIVER_DISTRICT_PRIMARY_SIGN_SHARE,
      greenGroups: Object.freeze(greenGroups),
    });
  }

  const covered = districts.reduce((sum, district) => sum + district.lengthM, 0);
  if (Math.abs(covered - loopM) > 1e-6) fail('SKYRIVER_DISTRICT_COVERAGE');

  const model: SkyriverDistrictModel = Object.freeze({
    seed,
    loopM,
    districts: Object.freeze(districts.map((district) => Object.freeze(district))),
  });
  modelCache.set(key, model);
  return model;
}

/**
 * The one authoritative district query. `v` is a canyon route position in metres — a building's own
 * anchor, a hero's z, a far tower's v, or the presented canyonV — never a warped world z.
 */
export function skyriverDistrictAt(model: SkyriverDistrictModel, v: number): SkyriverDistrict {
  const u = skyriverRoutePosition(v, model.loopM);
  const districts = model.districts;
  for (let i = districts.length - 1; i >= 0; i -= 1) {
    if (u >= districts[i]!.startM) return districts[i]!;
  }
  // Below the first boundary (the seam sits at 0, so only a negative rounding residue lands here).
  return districts[districts.length - 1]!;
}

/** The district id a shader attribute carries. Same query, one place. */
export function skyriverDistrictIdAt(model: SkyriverDistrictModel, v: number): number {
  return skyriverDistrictAt(model, v).id;
}

export function skyriverDistrictUnitHue(district: SkyriverDistrict): SkyriverLinearRgb {
  return SKYRIVER_DISTRICT_UNIT_HUE[district.primary];
}

/** True inside one of the district's green sign groups. Green exists nowhere else. */
export function skyriverInGreenGroup(model: SkyriverDistrictModel, district: SkyriverDistrict, v: number): boolean {
  if (district.greenGroups.length === 0) return false;
  const u = skyriverRoutePosition(v, model.loopM);
  const half = SKYRIVER_DISTRICT_GREEN_GROUP_LENGTH_M * 0.5;
  for (const centre of district.greenGroups) {
    let delta = Math.abs(u - centre);
    if (delta > model.loopM * 0.5) delta = model.loopM - delta;
    if (delta <= half) return true;
  }
  return false;
}

// --- the one colour switch ---------------------------------------------------------------------

export type SkyriverDistrictColourListener = (allowed: boolean) => void;

/**
 * The R22 colour A/B flag, held exactly once.
 *
 * The flag used to live in two places — a private field in `SkyriverCity` and another in
 * `SkyriverAtmosphere` — each with its own public setter, so a direct call to one of them produced a
 * frame whose haze and whose city disagreed, and a settings record that reported only half of it.
 * Here the flag is one value with one writer: `SkyriverScene` constructs this switch and calls
 * `set`; the city and the atmosphere receive it, read `allowed`, and register the uniform writes
 * that apply a change. Neither of them keeps a copy, so they cannot drift apart.
 *
 * `set` is idempotent: applying the same state twice converges on the same uniforms.
 */
export class SkyriverDistrictColourSwitch {
  private allowedState: boolean;
  private readonly listeners: SkyriverDistrictColourListener[] = [];

  constructor(allowed = true) {
    this.allowedState = allowed;
  }

  /** The bound state. Every reader goes through this, so there is one answer per frame. */
  get allowed(): boolean {
    return this.allowedState;
  }

  /**
   * Registers a listener that applies a change. It is not called now: a subscriber is built in the
   * current state (its uniforms are written from `allowed` at construction), so the first call it
   * receives is the first real change.
   */
  onChange(listener: SkyriverDistrictColourListener): void {
    this.listeners.push(listener);
  }

  /** The single write. Scene-only; the city and the atmosphere never call it. */
  set(allowed: boolean): void {
    this.allowedState = allowed;
    for (const listener of this.listeners) listener(allowed);
  }
}

// --- haze tint ------------------------------------------------------------------------------------

export interface SkyriverDistrictHazeMix {
  readonly districtId: number;
  readonly neighbourId: number;
  /** Share of the neighbour in the blend, 0 .. 0.5. */
  readonly neighbourWeight: number;
  readonly unitHue: SkyriverLinearRgb;
  /** Metres to the nearest district boundary. */
  readonly boundaryDistanceM: number;
}

/**
 * The haze hue at a route position, blended across SKYRIVER_DISTRICT_HAZE_BLEND_M of boundary so the
 * air changes colour over a few hundred metres instead of switching at a line.
 */
export function skyriverDistrictHazeMixAt(model: SkyriverDistrictModel, v: number): SkyriverDistrictHazeMix {
  const u = skyriverRoutePosition(v, model.loopM);
  const district = skyriverDistrictAt(model, u);
  const half = SKYRIVER_DISTRICT_HAZE_BLEND_M * 0.5;
  const toStart = skyriverRoutePosition(u - district.startM, model.loopM);
  const toEnd = district.lengthM - toStart;
  const index = district.id;
  const count = model.districts.length;
  const previous = model.districts[(index - 1 + count) % count]!;
  const next = model.districts[(index + 1) % count]!;
  const neighbour = toStart <= toEnd ? previous : next;
  const boundaryDistanceM = Math.min(toStart, toEnd);
  const neighbourWeight = 0.5 * (1 - Math.min(1, boundaryDistanceM / half));
  const own = skyriverDistrictUnitHue(district);
  const other = skyriverDistrictUnitHue(neighbour);
  const mixed: SkyriverLinearRgb = [
    own[0] + (other[0] - own[0]) * neighbourWeight,
    own[1] + (other[1] - own[1]) * neighbourWeight,
    own[2] + (other[2] - own[2]) * neighbourWeight,
  ];
  // A blend of two unit-luminance hues is not itself unit luminance; renormalise so the haze tint
  // stays a luminance-neutral multiplier across the whole band.
  return {
    districtId: district.id,
    neighbourId: neighbour.id,
    neighbourWeight,
    unitHue: skyriverUnitHue(mixed),
    boundaryDistanceM,
  };
}

/**
 * The multiplier handed to the shared R20 `setSkyriverFogRegionTint` API. Its luminance is 1, so the
 * haze keeps its brightness; the fog shader then applies it at its own fixed 0.12 weight.
 */
export function skyriverDistrictHazeTint(model: SkyriverDistrictModel, v: number): SkyriverLinearRgb {
  const mix = skyriverDistrictHazeMixAt(model, v);
  const s = SKYRIVER_DISTRICT_SATURATION.haze;
  return [
    1 - s + s * mix.unitHue[0],
    1 - s + s * mix.unitHue[1],
    1 - s + s * mix.unitHue[2],
  ];
}

/** What the haze refresh remembers between frames. NaN means "invalidated, re-sample now". */
export interface SkyriverHazeRefreshState {
  readonly bucket: number;
  readonly tick: number;
}

export interface SkyriverHazeRefreshDecision {
  /** The held tint was sampled at a later tick than the one being drawn, so it must be discarded. */
  readonly reset: boolean;
  /** Sample the district and write the shared tint on this frame. */
  readonly refresh: boolean;
  readonly bucket: number;
}

/**
 * Whether the district haze tint refreshes on this frame.
 *
 * Tick buckets, not elapsed wall time: a frozen frame never advances a timer, and a timer-only
 * refresh would leave the previous colour bound after a colour switch. One refresh per bucket is at
 * most once per second of simulated time. A tick that moves backwards (a rollback, a replay seek) is
 * a reset: the tint held in the uniform belongs to a later tick and cannot be kept.
 */
export function skyriverHazeRefresh(
  state: SkyriverHazeRefreshState,
  tick: number,
  tickRate: number,
): SkyriverHazeRefreshDecision {
  const reset = Number.isFinite(state.tick) && tick < state.tick;
  const bucket = Math.floor(tick / tickRate);
  const refresh = reset || !Number.isFinite(state.bucket) || bucket !== state.bucket;
  return { reset, refresh, bucket };
}

// --- sign hue quota -------------------------------------------------------------------------------

export type SkyriverDistrictSignRole = 'hero' | 'primary' | 'green' | 'secondary' | 'neutral';

/** Everything the quota needs about the built signs. city.ts fills it from the real sign buffers. */
export interface SkyriverDistrictSignInput {
  readonly count: number;
  readonly heroCount: number;
  /**
   * The sign's own canyon anchor: its building's anchorV, or a hero's z, in float64.
   *
   * Never narrowed to float32. The mass, trim and sign passes all classify the same building by the
   * same anchor, so they must all compare the same double against the same jittered boundary: an
   * anchor one float32 ulp from a boundary would otherwise put a facade and its signs in two
   * different districts.
   */
  readonly anchorV: Float64Array;
  /** The colour the existing random.weighted draw produced, linear RGB, 3 per sign. */
  readonly colour: Float32Array;
  /** Face area, square metres: part of the actual energy proxy that ranks bright accents. */
  readonly areaM2: Float32Array;
  /** Stable per-sign identity (face plus composition plus slot). Never a draw-order index alone. */
  readonly key: readonly string[];
}

export interface SkyriverDistrictSignCounts {
  readonly districtId: number;
  readonly name: string;
  readonly primary: SkyriverDistrictHue;
  readonly ordinary: number;
  readonly heroes: number;
  readonly primaryOrdinary: number;
  readonly primaryTotal: number;
  readonly green: number;
  readonly secondary: number;
  readonly neutral: number;
  /** primaryOrdinary / ordinary, the share the brief sets at >= 0.80. */
  readonly ordinaryPrimaryShare: number;
  /** primaryTotal / (ordinary + heroes), the share the brief proves at >= 0.70. */
  readonly totalPrimaryShare: number;
}

export interface SkyriverDistrictSignAssignment {
  /** District id per sign. */
  readonly district: Int32Array;
  /** Unit-luminance target hue per sign, 3 per sign. */
  readonly unitHue: Float32Array;
  /** Saturation per sign. */
  readonly saturation: Float32Array;
  readonly role: readonly SkyriverDistrictSignRole[];
  readonly counts: readonly SkyriverDistrictSignCounts[];
  readonly brightAccents: number;
  /** The proxy that ranked bright accents, stated so the report cannot overclaim it. */
  readonly brightAccentProxy: string;
}

/** The second hue a district may show. Never green: green is restricted to its groups. */
function secondaryHueOf(primary: SkyriverDistrictHue): keyof typeof SKYRIVER_DISTRICT_PALETTE {
  return primary === 'magenta' ? 'cyan' : 'magenta';
}

/**
 * Assigns every sign a district and a target hue, with an exact deterministic quota per district.
 *
 * It runs after `deriveNeonSigns`, reads only its finished output, and consumes no draw from any
 * geometry random stream: the order inside a district comes from an FNV-1a hash of the sign's own
 * stable id. Sign placement, size, kind, text seed and the drawn `color` buffer are untouched.
 */
export function assignSkyriverSignDistricts(
  model: SkyriverDistrictModel,
  signs: SkyriverDistrictSignInput,
): SkyriverDistrictSignAssignment {
  const { count, heroCount } = signs;
  if (signs.anchorV.length < count || signs.colour.length < count * 3 || signs.areaM2.length < count
    || signs.key.length < count) fail('SKYRIVER_DISTRICT_SIGN_INPUT_SHORT');

  const district = new Int32Array(count);
  const unitHue = new Float32Array(count * 3);
  const saturation = new Float32Array(count);
  const role: SkyriverDistrictSignRole[] = new Array<SkyriverDistrictSignRole>(count).fill('primary');

  const buckets: number[][] = model.districts.map(() => []);
  for (let i = 0; i < count; i += 1) {
    const id = skyriverDistrictIdAt(model, signs.anchorV[i]!);
    district[i] = id;
    if (i >= heroCount) buckets[id]!.push(i);
  }

  const counts: SkyriverDistrictSignCounts[] = [];
  for (const entry of model.districts) {
    const ordinary = buckets[entry.id]!;
    // Stable order inside the district: the sign's own id, not its draw index.
    ordinary.sort((a, b) => {
      const ka = skyriverDistrictKey(signs.key[a]!, entry.id);
      const kb = skyriverDistrictKey(signs.key[b]!, entry.id);
      return ka - kb || signs.key[a]!.localeCompare(signs.key[b]!);
    });

    const n = ordinary.length;
    const greenEligible = ordinary.filter((i) => skyriverInGreenGroup(model, entry, signs.anchorV[i]!));
    const greenTarget = Math.min(greenEligible.length, Math.floor(SKYRIVER_DISTRICT_GREEN_SIGN_SHARE * n));
    const green = new Set(greenEligible.slice(0, greenTarget));
    const rest = ordinary.filter((i) => !green.has(i));
    const primaryTarget = Math.min(rest.length, Math.ceil(SKYRIVER_DISTRICT_PRIMARY_SIGN_SHARE * n));
    const leftover = rest.length - primaryTarget;
    const neutralTarget = Math.ceil(leftover * 0.6);

    let placed = 0;
    for (const i of rest) {
      if (placed < primaryTarget) role[i] = 'primary';
      else if (placed < primaryTarget + neutralTarget) role[i] = 'neutral';
      else role[i] = 'secondary';
      placed += 1;
    }
    for (const i of green) role[i] = 'green';

    const heroes = (() => {
      let total = 0;
      for (let i = 0; i < heroCount; i += 1) if (district[i] === entry.id) total += 1;
      return total;
    })();
    const primaryOrdinary = primaryTarget;
    counts.push({
      districtId: entry.id,
      name: entry.name,
      primary: entry.primary,
      ordinary: n,
      heroes,
      primaryOrdinary,
      primaryTotal: primaryOrdinary + heroes,
      green: green.size,
      secondary: rest.length - primaryTarget - neutralTarget,
      neutral: neutralTarget,
      ordinaryPrimaryShare: n === 0 ? 1 : primaryOrdinary / n,
      totalPrimaryShare: n + heroes === 0 ? 1 : (primaryOrdinary + heroes) / (n + heroes),
    });
  }

  for (let i = 0; i < heroCount; i += 1) role[i] = 'hero';

  // Bright accents: ranked by the actual source energy proxy Y(source colour) x face area, over the
  // signs eligible for a district hue. This is a source ranking, not a rendered-pixel measurement.
  const eligible: number[] = [];
  for (let i = heroCount; i < count; i += 1) if (role[i] !== 'neutral') eligible.push(i);
  const proxy = (i: number): number => skyriverLinearY([
    signs.colour[i * 3]!, signs.colour[i * 3 + 1]!, signs.colour[i * 3 + 2]!,
  ]) * signs.areaM2[i]!;
  eligible.sort((a, b) => proxy(b) - proxy(a) || signs.key[a]!.localeCompare(signs.key[b]!));
  const brightCount = Math.round(eligible.length * SKYRIVER_DISTRICT_BRIGHT_ACCENT_SHARE);
  const bright = new Set(eligible.slice(0, brightCount));

  for (let i = 0; i < count; i += 1) {
    const entry = model.districts[district[i]!]!;
    let hue: SkyriverLinearRgb;
    let sat: number;
    switch (role[i]) {
      case 'hero':
        hue = SKYRIVER_DISTRICT_UNIT_HUE[entry.primary];
        sat = SKYRIVER_DISTRICT_SATURATION.hero;
        break;
      case 'green':
        hue = SKYRIVER_DISTRICT_UNIT_HUE.green;
        sat = bright.has(i) ? SKYRIVER_DISTRICT_SATURATION.signBright : SKYRIVER_DISTRICT_SATURATION.sign;
        break;
      case 'secondary':
        hue = SKYRIVER_DISTRICT_UNIT_HUE[secondaryHueOf(entry.primary)];
        sat = bright.has(i) ? SKYRIVER_DISTRICT_SATURATION.signBright : SKYRIVER_DISTRICT_SATURATION.sign;
        break;
      case 'neutral':
        hue = SKYRIVER_DISTRICT_UNIT_HUE.ice;
        sat = SKYRIVER_DISTRICT_SATURATION.signNeutral;
        break;
      default:
        hue = SKYRIVER_DISTRICT_UNIT_HUE[entry.primary];
        sat = bright.has(i) ? SKYRIVER_DISTRICT_SATURATION.signBright : SKYRIVER_DISTRICT_SATURATION.sign;
        break;
    }
    unitHue[i * 3] = hue[0];
    unitHue[i * 3 + 1] = hue[1];
    unitHue[i * 3 + 2] = hue[2];
    saturation[i] = sat;
  }

  return {
    district,
    unitHue,
    saturation,
    role,
    counts: Object.freeze(counts),
    brightAccents: bright.size,
    brightAccentProxy: 'Y(source linear colour) x sign face area in square metres, over the signs eligible for a district hue. A source ranking, not a rendered brightest-15% pixel measurement.',
  };
}

// --- CPU twins of the final emission, for the evidence and the checks -----------------------------

/** The sign shader's terms, so a node check can evaluate the complete emission it recolours. */
export interface SkyriverSignEmissionTerms {
  readonly mask: number;
  readonly angle: number;
  readonly intensity: number;
  readonly halo: number;
  readonly haloScale: number;
  readonly plate: number;
  readonly near: number;
  readonly flicker: number;
  readonly gain: number;
}

export const SKYRIVER_SIGN_EMISSION_REFERENCE: SkyriverSignEmissionTerms = Object.freeze({
  mask: 1,
  angle: 1,
  intensity: 1.05,
  halo: 0.75,
  haloScale: 0.85,
  plate: 0.03,
  near: 1,
  flicker: 1,
  gain: 2.2 / 1.9,
});

function smoothstep01(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The complete sign emission the fragment shader produces for one source colour:
 *
 *   hot   = mix(c * c * 1.2, vec3(1), 0.06 * smoothstep(0.8, 1.0, mask))
 *   color = (hot * mask * angle * intensity + c * (plate + halo * uHalo * 0.85)) * near * gain
 *
 * The core squares RGB and the white-hot blend adds a neutral term, so the final luminance is not a
 * scalar multiple of Y(c): this is why R22 recolours the finished sum and not the source colour.
 */
export function skyriverSignFinalEmission(
  colour: SkyriverLinearRgb,
  terms: SkyriverSignEmissionTerms = SKYRIVER_SIGN_EMISSION_REFERENCE,
): SkyriverLinearRgb {
  const white = 0.06 * smoothstep01(0.8, 1, terms.mask);
  const core = terms.mask * terms.angle * terms.intensity;
  const spill = terms.plate + terms.halo * terms.haloScale;
  const out: number[] = [];
  for (let k = 0; k < 3; k += 1) {
    const c = colour[k]!;
    const hot = c * c * 1.2 * (1 - white) + white;
    out.push((hot * core + c * spill) * terms.near * terms.gain * terms.flicker);
  }
  return [out[0]!, out[1]!, out[2]!];
}

/** The same emission after R22's equal-luminance recolour. Y is identical by construction. */
export function skyriverDistrictSignEmission(
  colour: SkyriverLinearRgb,
  unitHue: SkyriverLinearRgb,
  saturation: number,
  terms: SkyriverSignEmissionTerms = SKYRIVER_SIGN_EMISSION_REFERENCE,
): SkyriverLinearRgb {
  return skyriverRecolorPreservingY(skyriverSignFinalEmission(colour, terms), unitHue, saturation);
}

/**
 * The actual source colours the other recoloured paths carry, named exactly as the shaders name
 * them. The evidence reports old and new luminance for each of these, and the checks assert the
 * recolour leaves every one of them at equal Y.
 */
export const SKYRIVER_DISTRICT_SOURCE_TERMS: readonly {
  readonly id: string;
  readonly role: string;
  readonly saturation: number;
  readonly srgb: boolean;
  readonly rgb: SkyriverLinearRgb;
}[] = Object.freeze([
  { id: 'pane-sodium', role: 'resolved pane', saturation: SKYRIVER_DISTRICT_SATURATION.room, srgb: false, rgb: [1, 0.42, 0.1] },
  { id: 'pane-warm', role: 'resolved pane', saturation: SKYRIVER_DISTRICT_SATURATION.room, srgb: false, rgb: [1, 0.6, 0.24] },
  { id: 'pane-pale', role: 'resolved pane', saturation: SKYRIVER_DISTRICT_SATURATION.room, srgb: false, rgb: [0.5, 0.68, 1] },
  { id: 'pane-cold', role: 'resolved pane', saturation: SKYRIVER_DISTRICT_SATURATION.room, srgb: false, rgb: [0.25, 0.5, 1] },
  { id: 'pane-neon-cyan', role: 'resolved pane', saturation: SKYRIVER_DISTRICT_SATURATION.room, srgb: false, rgb: [0.22, 0.95, 1] },
  { id: 'pane-neon-magenta', role: 'resolved pane', saturation: SKYRIVER_DISTRICT_SATURATION.room, srgb: false, rgb: [1, 0.24, 0.72] },
  { id: 'pane-average', role: 'far pane average', saturation: SKYRIVER_DISTRICT_SATURATION.pane, srgb: false, rgb: [0.86, 0.72, 0.56] },
  { id: 'far-box-warm', role: 'far box window', saturation: SKYRIVER_DISTRICT_SATURATION.pane, srgb: false, rgb: [1, 0.55, 0.22] },
  { id: 'far-box-cold', role: 'far box window', saturation: SKYRIVER_DISTRICT_SATURATION.pane, srgb: false, rgb: [0.45, 0.65, 1] },
  { id: 'glass-warm', role: 'room glass tint', saturation: SKYRIVER_DISTRICT_SATURATION.room, srgb: false, rgb: [1, 0.84, 0.66] },
  { id: 'glass-cool', role: 'room glass tint', saturation: SKYRIVER_DISTRICT_SATURATION.room, srgb: false, rgb: [0.7, 0.83, 1] },
  { id: 'glass-teal', role: 'room glass tint', saturation: SKYRIVER_DISTRICT_SATURATION.room, srgb: false, rgb: [0.62, 1, 0.88] },
  { id: 'glass-amber', role: 'room glass tint', saturation: SKYRIVER_DISTRICT_SATURATION.room, srgb: false, rgb: [1, 0.72, 0.4] },
  { id: 'deck-skylight', role: 'small lamp', saturation: SKYRIVER_DISTRICT_SATURATION.trimSmall, srgb: false, rgb: [1, 0.55, 0.2] },
  { id: 'trim-deck-lamp', role: 'small lamp', saturation: SKYRIVER_DISTRICT_SATURATION.trimSmall, srgb: false, rgb: [1, 0.68, 0.33] },
  { id: 'trim-balcony-underlight', role: 'small lamp', saturation: SKYRIVER_DISTRICT_SATURATION.trimSmall, srgb: false, rgb: [1, 0.62, 0.3] },
  { id: 'trim-band-warm', role: 'large accent', saturation: SKYRIVER_DISTRICT_SATURATION.trimLarge, srgb: false, rgb: [1, 0.72, 0.42] },
  { id: 'trim-band-cold', role: 'large accent', saturation: SKYRIVER_DISTRICT_SATURATION.trimLarge, srgb: false, rgb: [0.55, 0.85, 1] },
  { id: 'trim-flood', role: 'large accent', saturation: SKYRIVER_DISTRICT_SATURATION.trimLarge, srgb: false, rgb: [0.75, 0.85, 1.05] },
  { id: 'trim-skybridge-ribbon', role: 'large accent', saturation: SKYRIVER_DISTRICT_SATURATION.trimLarge, srgb: false, rgb: [0.72, 0.86, 1] },
  { id: 'tower-parapet', role: 'large accent', saturation: SKYRIVER_DISTRICT_SATURATION.trimLarge, srgb: false, rgb: [0.75, 0.9, 1] },
  { id: 'landmark-wash-face', role: 'landmark wash', saturation: SKYRIVER_DISTRICT_SATURATION.wash, srgb: false, rgb: [0.12, 0.55, 1] },
  { id: 'landmark-wash-roof', role: 'landmark wash', saturation: SKYRIVER_DISTRICT_SATURATION.wash, srgb: false, rgb: [0.5, 0.8, 1] },
]);

/** Sources R22 leaves alone: red warnings and the intentional blue skybridge underlight. */
export const SKYRIVER_DISTRICT_UNTOUCHED_TERMS: readonly {
  readonly id: string;
  readonly role: string;
  readonly rgb: SkyriverLinearRgb;
}[] = Object.freeze([
  { id: 'trim-antenna-beacon', role: 'red warning', rgb: [1, 0.16, 0.12] },
  { id: 'trim-flood-tip', role: 'red warning', rgb: [3, 0.4, 0.3] },
  { id: 'trim-skybridge-underlight', role: 'intentional blue', rgb: [0.3, 0.6, 1] },
]);

// --- shared GLSL ----------------------------------------------------------------------------------

/**
 * The district colour chunk. Every recoloured pass includes it exactly once, so there is one
 * luminance definition, one recolour, and one A/B switch (`uDistrictColour`) in the whole renderer.
 *
 * `uDistrictColour` is 0 or 1 and nothing else: at 0 every helper returns its argument unchanged, so
 * the colour-off path is the pre-R22 arithmetic bit for bit, with the same geometry and the same
 * instance buffers.
 *
 * The hue lookup is a five-step loop rather than `uDistrictUnitHue[int(d)]`: a varying-derived index
 * is not a constant-index-expression in GLSL ES 1.00, and these materials compile as ES 1.00 on a
 * WebGL2 context.
 */
export const SKYRIVER_DISTRICT_COLOUR_GLSL = /* glsl */ `
uniform float uDistrictColour;                              // 0 = pre-R22 colour, 1 = districts
uniform vec3 uDistrictUnitHue[ ${SKYRIVER_DISTRICT_COUNT} ]; // unit-luminance primary per district
uniform float uDistrictLampSaturation[ ${SKYRIVER_DISTRICT_COUNT} ]; // small lamps: 0, dock amber

#define DISTRICT_ROOM_SATURATION ${SKYRIVER_DISTRICT_SATURATION.room.toFixed(4)}
#define DISTRICT_PANE_SATURATION ${SKYRIVER_DISTRICT_SATURATION.pane.toFixed(4)}
#define DISTRICT_FAR_CARD_SATURATION ${SKYRIVER_DISTRICT_SATURATION.farCard.toFixed(4)}
#define DISTRICT_TRIM_LARGE_SATURATION ${SKYRIVER_DISTRICT_SATURATION.trimLarge.toFixed(4)}
#define DISTRICT_WASH_SATURATION ${SKYRIVER_DISTRICT_SATURATION.wash.toFixed(4)}

float skyriverLinearY( vec3 c ) {
  return dot( c, vec3( ${SKYRIVER_LUMA[0]}, ${SKYRIVER_LUMA[1]}, ${SKYRIVER_LUMA[2]} ) );
}

vec3 skyriverDistrictUnitHue( float district ) {
  vec3 hue = uDistrictUnitHue[ 0 ];
  for ( int i = 1; i < ${SKYRIVER_DISTRICT_COUNT}; i ++ ) {
    hue = mix( hue, uDistrictUnitHue[ i ], step( float( i ) - 0.5, district ) );
  }
  return hue;
}

/**
 * Small background lamps stay neutral, except in an amber district: the dock's service and grime
 * lamps are the brief's intentional amber source, so that one district hands them its own hue.
 */
float skyriverDistrictLampSaturation( float district ) {
  float saturation = uDistrictLampSaturation[ 0 ];
  for ( int i = 1; i < ${SKYRIVER_DISTRICT_COUNT}; i ++ ) {
    saturation = mix( saturation, uDistrictLampSaturation[ i ], step( float( i ) - 0.5, district ) );
  }
  return saturation;
}

/** Recolours ONE complete emission contribution at equal linear luminance. Black stays black. */
vec3 skyriverDistrictEmission( vec3 c, vec3 unitHue, float saturation ) {
  float y = skyriverLinearY( c );
  return mix( c, y * mix( vec3( 1.0 ), unitHue, saturation ), uDistrictColour );
}

/** The same, looking the hue up from a district id attribute. */
vec3 skyriverDistrictTint( vec3 c, float district, float saturation ) {
  return skyriverDistrictEmission( c, skyriverDistrictUnitHue( district ), saturation );
}

/** A small background lamp: neutral at equal luminance, amber where the dock owns the light. */
vec3 skyriverDistrictLamp( vec3 c, float district ) {
  return skyriverDistrictEmission( c, skyriverDistrictUnitHue( district ), skyriverDistrictLampSaturation( district ) );
}
`;

/**
 * R22 distance grade. The old grade desaturated toward `Y(c) * steel`, whose luminance is Ysteel,
 * so it changed brightness and chroma together. The new grade desaturates toward unit-luminance
 * steel and multiplies by g(k) = (1 - k + Ysteel k)(1 - 0.55 k), which is exactly the old grade's
 * total brightness factor — so the depth read is unchanged and only the coupling is gone.
 *
 * Ysteel and unit(steel) are computed from SKYRIVER_DISTANCE_GRADE_STEEL here, never typed as a
 * rounded 0.776.
 */
export const SKYRIVER_DISTRICT_DISTANCE_GRADE_GLSL = /* glsl */ `
#define SKYRIVER_STEEL vec3( ${SKYRIVER_DISTANCE_GRADE_STEEL.map((c) => c.toFixed(4)).join(', ')} )
#define SKYRIVER_STEEL_Y ${SKYRIVER_DISTANCE_GRADE_STEEL_Y.toPrecision(12)}
#define SKYRIVER_UNIT_STEEL vec3( ${SKYRIVER_DISTANCE_GRADE_UNIT_STEEL.map((c) => c.toPrecision(12)).join(', ')} )

vec3 skyriverDistanceGrade( vec3 c, float depth, float extra ) {
  float k = clamp( smoothstep( 900.0, 5000.0, depth ) * 0.75 + extra, 0.0, 0.92 );
  float lum = skyriverLinearY( c );
  // Pre-R22: the steel target carries Ysteel, so the grade dimmed as it desaturated.
  vec3 legacy = mix( c, lum * SKYRIVER_STEEL, k ) * ( 1.0 - 0.55 * k );
  // R22: desaturate toward unit luminance and apply the old grade's own brightness factor.
  float brightness = ( 1.0 - k + SKYRIVER_STEEL_Y * k ) * ( 1.0 - 0.55 * k );
  vec3 graded = mix( c, lum * SKYRIVER_UNIT_STEEL, k ) * brightness;
  return mix( legacy, graded, uDistrictColour );
}
`;

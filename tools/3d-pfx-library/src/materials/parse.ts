// Strict authoring boundary for copied recipe JSON and material tuning.
// Unknown keys, unknown IDs, non-finite numbers, bad tuples, conflicting
// atlas fields, and settings that the actual render path cannot apply all
// fail here with a named field. Internal code trusts the returned types.

import { AUTHORED_EFFECT_RECIPES } from '../constants/02'
import { PFX_SPRITE_SLICES, type PfxSpriteName } from '../particleSprites'
import type { PfxRenderSurfaceKind } from '../types/01'
import type { PfxAuthoredRecipe, PfxParticleMotionKind, PfxRenderSurface, PfxSurfaceTuning } from '../types/02'
import { PFX_DEFAULT_ATLAS_REGISTRY, isPfxAtlasRegistry, type PfxAtlasRegistry } from './atlas'
import { getPfxMaterialCapability, getPfxMaterialViolations, resolvePfxMaterialPath } from './capabilities'
import {
  PFX_MATERIAL_LIMITS,
  type PfxLifeValue,
  type PfxMaterialDissolve,
  type PfxMaterialDistortion,
  type PfxMaterialFrameAnimation,
  type PfxMaterialMask,
  type PfxMaterialRim,
  type PfxMaterialSoftParticles,
  type PfxMaterialTuning,
  type PfxMaterialUv,
  type PfxNumericLimit,
  type PfxVec2,
} from './types'

// ---------------------------------------------------------------------------
// Errors.

export type PfxRecipeParseErrorCode =
  | 'json'
  | 'type'
  | 'unknown-key'
  | 'missing-key'
  | 'non-finite'
  | 'range'
  | 'tuple'
  | 'enum'
  | 'color'
  | 'unknown-map'
  | 'unknown-effect'
  | 'unknown-atlas'
  | 'atlas-conflict'
  | 'duplicate-layer'
  | 'unsupported-path'
  | 'unsupported-feature'
  | 'life-curve-not-allowed'

export interface PfxRecipeParseLocation {
  effectId?: string
  /** Layer edit key: the surface phase, or its kind when the phase is absent. */
  layer?: string
}

export class PfxRecipeParseError extends Error {
  constructor(
    readonly code: PfxRecipeParseErrorCode,
    /** Path of the rejected value, for example `recipe.surfaces[0].tuning.material.uv.scale[1]`. */
    readonly field: string,
    detail: string,
    readonly location: PfxRecipeParseLocation = {},
  ) {
    const where = [location.effectId && `effect ${location.effectId}`, location.layer && `layer ${location.layer}`].filter(Boolean).join(', ')
    super(`${field}: ${detail}${where ? ` [${where}]` : ''}`)
    this.name = 'PfxRecipeParseError'
  }
}

interface Ctx {
  field: string
  location: PfxRecipeParseLocation
  atlasRegistry: PfxAtlasRegistry
}

function at(ctx: Ctx, key: string | number): Ctx {
  return { ...ctx, field: typeof key === 'number' ? `${ctx.field}[${key}]` : `${ctx.field}.${key}` }
}

function fail(ctx: Ctx, code: PfxRecipeParseErrorCode, detail: string): never {
  throw new PfxRecipeParseError(code, ctx.field, detail, ctx.location)
}

function describe(value: unknown): string {
  if (typeof value === 'string') return `'${value}'`
  if (Array.isArray(value)) return 'an array'
  if (value === null) return 'null'
  if (typeof value === 'object') return 'an object'
  return String(value)
}

// ---------------------------------------------------------------------------
// Primitive validators.

function plainObject(value: unknown, ctx: Ctx): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(ctx, 'type', `expected an object, got ${describe(value)}`)
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail(ctx, 'type', 'expected a plain object')
  return value as Record<string, unknown>
}

/** A key whose value is `undefined` counts as absent, as in JSON. */
function record(value: unknown, ctx: Ctx, keys: readonly string[], required: readonly string[]): Record<string, unknown> {
  const object = plainObject(value, ctx)
  for (const key of Object.keys(object)) {
    if (!keys.includes(key)) fail(at(ctx, key), 'unknown-key', `unknown key; expected one of ${keys.join(', ')}`)
  }
  for (const key of required) {
    if (object[key] === undefined) fail(at(ctx, key), 'missing-key', 'required key is missing')
  }
  return object
}

interface NumberRule extends PfxNumericLimit {
  integer?: boolean
}

function finite(value: unknown, ctx: Ctx, rule: NumberRule): number {
  // JSON.stringify writes NaN and Infinity as null.
  if (value === null) fail(ctx, 'non-finite', 'expected a finite number, got null (JSON writes NaN and Infinity as null)')
  if (typeof value !== 'number') fail(ctx, 'type', `expected a number, got ${describe(value)}`)
  if (!Number.isFinite(value)) fail(ctx, 'non-finite', `expected a finite number, got ${value}`)
  const belowMin = rule.minExclusive ? value <= rule.min : value < rule.min
  const aboveMax = rule.maxExclusive ? value >= rule.max : value > rule.max
  if (belowMin || aboveMax) {
    fail(ctx, 'range', `expected ${rule.minExclusive ? '(' : '['}${rule.min}, ${rule.max}${rule.maxExclusive ? ')' : ']'}, got ${value}`)
  }
  if (rule.integer && !Number.isInteger(value)) fail(ctx, 'range', `expected an integer, got ${value}`)
  return value
}

function tuple<T>(value: unknown, ctx: Ctx, length: number, item: (value: unknown, ctx: Ctx) => T): T[] {
  if (!Array.isArray(value)) fail(ctx, 'tuple', `expected a ${length}-item array, got ${describe(value)}`)
  if (value.length !== length) fail(ctx, 'tuple', `expected ${length} items, got ${value.length}`)
  return value.map((entry, index) => item(entry, at(ctx, index)))
}

function vec2(value: unknown, ctx: Ctx, rule: NumberRule): PfxVec2 {
  const items = tuple(value, ctx, 2, (entry, entryCtx) => finite(entry, entryCtx, rule))
  return [items[0]!, items[1]!]
}

function vec3(value: unknown, ctx: Ctx, rule: NumberRule): [number, number, number] {
  const items = tuple(value, ctx, 3, (entry, entryCtx) => finite(entry, entryCtx, rule))
  return [items[0]!, items[1]!, items[2]!]
}

function oneOf<const T extends string | number>(value: unknown, ctx: Ctx, options: readonly T[], code: PfxRecipeParseErrorCode = 'enum'): T {
  if (!(options as readonly unknown[]).includes(value)) {
    const shown = options.length <= 12 ? `; expected one of ${options.map((option) => describe(option)).join(', ')}` : ''
    fail(ctx, code, `unknown value ${describe(value)}${shown}`)
  }
  return value as T
}

function text(value: unknown, ctx: Ctx): string {
  if (typeof value !== 'string' || value.trim().length === 0) fail(ctx, 'type', `expected a non-empty string, got ${describe(value)}`)
  return value
}

function bool(value: unknown, ctx: Ctx): boolean {
  if (typeof value !== 'boolean') fail(ctx, 'type', `expected a boolean, got ${describe(value)}`)
  return value
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

function color(value: unknown, ctx: Ctx): string {
  if (typeof value !== 'string' || !HEX_COLOR.test(value)) fail(ctx, 'color', `expected #rrggbb, got ${describe(value)}`)
  return value
}

function nonZero(vector: number[], ctx: Ctx): void {
  if (vector.every((component) => component === 0)) fail(ctx, 'range', 'expected a nonzero vector')
}

/** Rejects a list that misses a union member, and any non-member value. */
function exhaustive<T extends string | number>() {
  return <const V extends readonly T[]>(
    values: V,
    ...missing: [Exclude<T, V[number]>] extends [never] ? [] : [missing: Exclude<T, V[number]>]
  ): V => {
    void missing
    return values
  }
}

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assert<T extends true> = T

// ---------------------------------------------------------------------------
// Material tuning.

function lifeValue(value: unknown, ctx: Ctx, limit: PfxNumericLimit): PfxLifeValue {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const curve = record(value, ctx, ['kind', 'values'], ['kind', 'values'])
    oneOf(curve.kind, at(ctx, 'kind'), ['life'])
    return { kind: 'life', values: vec3(curve.values, at(ctx, 'values'), limit) }
  }
  return finite(value, ctx, limit)
}

function parseUv(value: unknown, ctx: Ctx): PfxMaterialUv {
  const uv = record(value, ctx, ['scale', 'offset', 'rotation', 'scroll', 'wrap'], ['scale', 'offset', 'rotation', 'scroll', 'wrap'])
  return {
    scale: vec2(uv.scale, at(ctx, 'scale'), PFX_MATERIAL_LIMITS.uvScale),
    offset: vec2(uv.offset, at(ctx, 'offset'), PFX_MATERIAL_LIMITS.uvOffset),
    rotation: finite(uv.rotation, at(ctx, 'rotation'), PFX_MATERIAL_LIMITS.uvRotation),
    scroll: vec2(uv.scroll, at(ctx, 'scroll'), PFX_MATERIAL_LIMITS.scroll),
    wrap: oneOf(uv.wrap, at(ctx, 'wrap'), ['clamp', 'repeat']),
  }
}

function parseDistortion(value: unknown, ctx: Ctx): PfxMaterialDistortion {
  const kind = oneOf(plainObject(value, ctx).kind, at(ctx, 'kind'), ['noise', 'flow'])
  if (kind === 'noise') {
    const noise = record(value, ctx, ['kind', 'map', 'strength', 'direction', 'scroll'], ['kind', 'map', 'strength', 'direction', 'scroll'])
    const direction = vec2(noise.direction, at(ctx, 'direction'), PFX_MATERIAL_LIMITS.distortionDirection)
    nonZero(direction, at(ctx, 'direction'))
    return {
      kind,
      map: oneOf(noise.map, at(ctx, 'map'), ['noise-a'], 'unknown-map'),
      strength: lifeValue(noise.strength, at(ctx, 'strength'), PFX_MATERIAL_LIMITS.distortionStrength),
      direction,
      scroll: vec2(noise.scroll, at(ctx, 'scroll'), PFX_MATERIAL_LIMITS.scroll),
    }
  }
  const flow = record(value, ctx, ['kind', 'map', 'strength', 'scroll'], ['kind', 'map', 'strength', 'scroll'])
  return {
    kind,
    map: oneOf(flow.map, at(ctx, 'map'), ['flow-a'], 'unknown-map'),
    strength: lifeValue(flow.strength, at(ctx, 'strength'), PFX_MATERIAL_LIMITS.distortionStrength),
    scroll: vec2(flow.scroll, at(ctx, 'scroll'), PFX_MATERIAL_LIMITS.scroll),
  }
}

function parseMask(value: unknown, ctx: Ctx): PfxMaterialMask {
  const mask = record(value, ctx, ['map', 'channel', 'strength'], ['map', 'channel', 'strength'])
  return {
    map: oneOf(mask.map, at(ctx, 'map'), ['mask-a'], 'unknown-map'),
    channel: oneOf(mask.channel, at(ctx, 'channel'), ['r', 'g', 'b', 'a']),
    strength: finite(mask.strength, at(ctx, 'strength'), PFX_MATERIAL_LIMITS.maskStrength),
  }
}

function parseDissolve(value: unknown, ctx: Ctx): PfxMaterialDissolve {
  const keys = ['map', 'progress', 'softness', 'edgeWidth', 'edgeColor']
  const dissolve = record(value, ctx, keys, keys)
  return {
    map: oneOf(dissolve.map, at(ctx, 'map'), ['noise-a'], 'unknown-map'),
    progress: lifeValue(dissolve.progress, at(ctx, 'progress'), PFX_MATERIAL_LIMITS.dissolveProgress),
    softness: finite(dissolve.softness, at(ctx, 'softness'), PFX_MATERIAL_LIMITS.dissolveSoftness),
    edgeWidth: finite(dissolve.edgeWidth, at(ctx, 'edgeWidth'), PFX_MATERIAL_LIMITS.dissolveEdgeWidth),
    edgeColor: color(dissolve.edgeColor, at(ctx, 'edgeColor')),
  }
}

function parseRim(value: unknown, ctx: Ctx): PfxMaterialRim {
  const rim = record(value, ctx, ['power', 'strength', 'color'], ['power', 'strength'])
  return {
    power: finite(rim.power, at(ctx, 'power'), PFX_MATERIAL_LIMITS.rimPower),
    strength: lifeValue(rim.strength, at(ctx, 'strength'), PFX_MATERIAL_LIMITS.rimStrength),
    ...(rim.color !== undefined ? { color: color(rim.color, at(ctx, 'color')) } : {}),
  }
}

function parseFrameAnimation(value: unknown, ctx: Ctx): PfxMaterialFrameAnimation {
  const frame = record(value, ctx, ['atlas', 'frameBlend'], ['atlas', 'frameBlend'])
  const atlasId = text(frame.atlas, at(ctx, 'atlas'))
  const atlas = ctx.atlasRegistry.lookup(atlasId)
  if (!atlas) fail(at(ctx, 'atlas'), 'unknown-atlas', `unknown atlas ID '${atlasId}'; registry has ${ctx.atlasRegistry.ids.join(', ')}`)
  return { atlas: atlas.id, frameBlend: bool(frame.frameBlend, at(ctx, 'frameBlend')) }
}

function parseSoftParticles(value: unknown, ctx: Ctx): PfxMaterialSoftParticles {
  const soft = record(value, ctx, ['distance'], ['distance'])
  return { distance: finite(soft.distance, at(ctx, 'distance'), PFX_MATERIAL_LIMITS.softParticleDistance) }
}

type Validators<T> = { [K in keyof T]-?: (value: unknown, ctx: Ctx) => NonNullable<T[K]> }

/** Every key is optional. A missing validator is a compile error. */
function parseOptionalFields<T>(value: unknown, ctx: Ctx, validators: Validators<T>): T {
  const keys = Object.keys(validators) as Array<keyof T & string>
  const object = record(value, ctx, keys, [])
  const parsed: Partial<T> = {}
  for (const key of keys) {
    if (object[key] !== undefined) parsed[key] = validators[key](object[key], at(ctx, key))
  }
  return parsed as T
}

const MATERIAL_VALIDATORS: Validators<PfxMaterialTuning> = {
  uv: parseUv,
  distortion: parseDistortion,
  mask: parseMask,
  dissolve: parseDissolve,
  rim: parseRim,
  frameAnimation: parseFrameAnimation,
  softParticles: parseSoftParticles,
}

function contextFor(options: { atlasRegistry?: PfxAtlasRegistry }, field: string): Ctx {
  const atlasRegistry = options.atlasRegistry ?? PFX_DEFAULT_ATLAS_REGISTRY
  if (!isPfxAtlasRegistry(atlasRegistry)) {
    throw new PfxRecipeParseError('type', 'options.atlasRegistry', 'expected a registry from createPfxAtlasRegistry')
  }
  return { field, location: {}, atlasRegistry }
}

export interface PfxMaterialParseOptions {
  atlasRegistry?: PfxAtlasRegistry
  /** Field prefix for error messages. */
  field?: string
}

/**
 * Structural material boundary: keys, bounds, tuples, map IDs, and atlas IDs.
 * The recipe parser also checks the settings against the actual layer path.
 */
export function parsePfxMaterialTuning(input: unknown, options: PfxMaterialParseOptions = {}): PfxMaterialTuning {
  return parseOptionalFields(input, contextFor(options, options.field ?? 'material'), MATERIAL_VALIDATORS)
}

// ---------------------------------------------------------------------------
// Recipe vocabulary. Each list is checked against its declared union.

const SURFACE_KINDS = exhaustive<PfxRenderSurfaceKind>()([
  'particles', 'core-sphere', 'impact-core', 'impact-shards', 'coin-reward-burst', 'shield-fragments',
  'mesh-fragments', 'trail-ribbon', 'ring-field', 'magic-circle', 'water-cone-sheet', 'shield-shell',
  'beam-column', 'cloud-volume', 'impact-sparks', 'screen-plane', 'shockwave-ring', 'telegraph-disc',
  'portal-throat', 'scuff-wedge', 'healing-glyphs', 'spawn-voxels', 'footprint-decal', 'muzzle-cone',
  'toxic-pool', 'acid-pool', 'bubble-shells', 'dissolve-voxels', 'wind-streaks', 'reward-gem',
  'coin-medallion', 'celebration-chevrons', 'projectile-comet', 'projectile-head', 'smoke-billows',
  'toxic-billows', 'tapered-trail',
])

const SURFACE_ROLES = exhaustive<PfxRenderSurface['role']>()(['body', 'trail', 'aura', 'impact', 'screen', 'volume'])

const MOTION_KINDS = exhaustive<PfxParticleMotionKind>()([
  'radial-burst', 'shockwave-ground-burst', 'cone-fountain', 'orbit-ring', 'ground-ring',
  'telegraph-boundary-drift', 'materialize-release', 'column-rise', 'jump-launch', 'drift-cloud', 'dust-loop',
  'snow-gust', 'screen-fall', 'trail-stream', 'beam-telegraph-flow', 'laser-spray-ricochet', 'impact-burst',
  'meteor-impact', 'ground-scuff', 'healing-spiral', 'healing-cross', 'helix-trail', 'shell-flame',
  'converge-center', 'materialize-gather', 'spherical-converge', 'braided-converge', 'phase-transfer-column',
  'asymmetric-converge', 'warp-vortex', 'shadow-claw', 'portal-flow', 'danger-pulse',
])

const MESH_GEOMETRIES = exhaustive<Tuning<'meshGeometry'>>()([
  'screen-space-analytic-quad', 'target-spawn-acquisition-quad', 'target-spawn-confirmation-pin-quad',
  'curse-binding-seal', 'curse-twisted-spire', 'spawn-screen-reticle', 'spawn-telegraph-volumetric-reticle',
  'spawn-telegraph-arrival-footprint', 'spawn-telegraph-arrival-cage', 'spawn-telegraph-arrival-avatar',
  'jump-pickup-launch-cradle', 'jump-pickup-reward-gem', 'target-break-lock-shell',
  'target-break-honeycomb-fragments', 'target-break-ground-reticle', 'exhaust-hit-mechanical-nozzle',
  'debris-miss-rock-fragments', 'debris-release-rock-fragments', 'spark-cone-streak-prisms',
  'shard-break-crystal-fragments', 'shard-break-ignition-core', 'ice-impact-grounded-splinters',
  'frost-aura-crystal-crown', 'frost-aura-crystal-glint', 'water-column-churning-body',
  'water-column-foam-spray', 'snow-idle-flurry-field', 'snow-idle-depth-granules',
  'wind-beam-pressure-ribbons', 'wind-beam-debris-leaves', 'petal-ambient-drifting-blossoms',
  'sand-burst-sculpted-fan', 'mud-charge-sculpted-clods', 'slime-ring-viscous-annulus',
  'acid-spawn-corrosive-aperture', 'healing-loop-renewal-helix', 'holy-release-radiant-mandorla',
  'curse-cone-twisted-thorn-fan', 'glyph-trail-rune-chain', 'glyph-trail-lead-sigil',
  'beam-telegraph-warning-lane', 'beam-telegraph-source-aperture', 'exhaust-telegraph-warning-lane',
  'exhaust-telegraph-source-vent', 'flame-burst-folded-tongues', 'meteor-burst-impact-diorama',
  'laser-spray-volumetric-nozzle', 'laser-spray-bolt-rack', 'plasma-hit-contact-bloom',
  'plasma-hit-broken-flux-arcs', 'electric-critical-voltage-cage', 'electric-critical-faceted-nexus',
  'electric-critical-impact-starburst', 'electric-critical-diagonal-discharge',
  'plasma-ambient-contained-core', 'plasma-ambient-broken-orbits', 'snow-spawn-frost-cradle',
  'ghost-critical-spectral-talons', 'barrier-low-health-fractured-shell', 'barrier-low-health-breach-ribs',
  'flame-charge-trefoil-crucible', 'flame-charge-convergence-tendrils', 'meteor-ring-impact-crater',
  'meteor-ring-heat-front', 'shockwave-spawn-arrival-flare', 'shockwave-spawn-pressure-front',
  'shield-aura-fractured-shell', 'mud-burst-reference-splash-crown', 'mud-burst-reference-clod-eruption',
  'mud-burst-reference-earth-crown', 'mud-burst-reference-wet-clot-splash', 'healing-burst-reference-helix',
  'healing-burst-reference-bloom', 'holy-burst-reference-sacred-flame', 'holy-burst-reference-sanctity-sun',
  'holy-burst-reference-mandorla', 'shadow-burst-reference-claw', 'shadow-burst-reference-fracture',
  'shield-aura-defensive-envelope',
  'blood-death-pigment-rupture', 'debris-burst-fractured-mass', 'despawn-impact-absence-cage',
  'dust-burst-grounded-crown', 'footstep-ambient-cadence-wake', 'ghost-trail-spectral-procession',
  'hologram-break-figure-quad', 'hologram-break-projector-quad', 'leaf-burst-sculpted-canopy',
  'leaf-burst-vein-seed-curls', 'marker-release-badge-quad', 'marker-release-ground-quad',
  'petal-burst-sculpted-corolla', 'petal-burst-stamen-pollen-calyx', 'portal-telegraph-countdown-aperture',
  'scan-cone-ground-quad', 'scan-cone-volume-sector', 'screen-space-pickup-receipt-quad',
  'shadow-break-rupture-cluster', 'shockwave-burst-broken-pressure-dome', 'snow-burst-crystal-bloom',
  'snow-burst-powder-drift', 'thruster-trail-closed-plume', 'thruster-trail-nozzle-disc',
  'warp-spray-displaced-facets',
])


const LIFECYCLES = exhaustive<Tuning<'lifecycle'>>()([
  'held-projectile-ignition', 'impact-core-flash', 'impact-afterglow', 'impact-shard-burst',
  'debris-release-ballistic', 'spark-cone-burst', 'shard-break-fracture', 'ice-impact-contact',
  'frost-aura-breathing-loop', 'water-column-eruption', 'snow-idle-weather-loop', 'petal-ambient-breeze-loop',
  'sand-burst-ballistic', 'rain-burst-impact', 'rain-burst-particle-impact', 'wind-burst-particle-release',
  'exhaust-hit-particle-backfire', 'teleport-hit-particle-arrival', 'holy-release-particle-cleansing',
  'beam-telegraph-particle-countdown', 'barrier-column-particle-sentinel', 'jump-beam-particle-lift',
  'curse-column-particle-binding', 'laser-spray-particle-salvo', 'water-column-particle-eruption',
  'target-spawn-particle-acquire', 'shard-break-particle-fracture', 'dash-idle-particle-readiness',
  'healing-loop-particle-renewal', 'spark-loop-particle-contact', 'warning-loop-particle-alert',
  'spawn-screen-particle-transition', 'mud-charge-convergence', 'mud-burst-reference-eruption',
  'slime-ring-adhesion', 'acid-spawn-eruption', 'healing-loop-renewal', 'healing-burst-reference-renewal',
  'holy-release-cleansing', 'shadow-break-rupture', 'shadow-burst-detonation',
  'blood-death-ballistic-collapse', 'curse-cone-propagation', 'curse-cone-particle-propagation',
  'curse-burst-particle-malediction', 'critical-hit-burst-particle-confirm',
  'electric-critical-particle-discharge', 'embers-burst-particle-breakup', 'flame-burst-particle-ignite',
  'ice-burst-particle-impact', 'ghost-critical-particle-haunt', 'jump-burst-particle-launch',
  'landing-burst-particle-impact', 'meteor-burst-particle-collision', 'slime-burst-particle-elasticity',
  'spark-cone-particle-release', 'hit-spark-particle-confirm', 'acid-charge-particle-convergence',
  'blood-charge-particle-convergence', 'glyph-trail-inscription', 'beam-telegraph-countdown',
  'exhaust-telegraph-arm-countdown-vent', 'flame-burst-ignite-blossom-peel',
  'meteor-burst-descent-collision-cool', 'laser-spray-salvo', 'plasma-hit-discharge', 'meteor-impact-settle',
  'shockwave-spawn-arrival', 'shockwave-spawn-pressure-release', 'dust-loop-breathing',
  'coin-pickup-reward-burst', 'level-up-surge', 'spark-gap-loop', 'electric-trail-propagation',
  'wind-impact-shear', 'wind-beam-surge', 'acid-idle-boil', 'portal-charge-aperture',
  'reward-telegraph-beacon', 'hologram-aura-loop', 'blast-beam-sustain', 'blast-burst-particle-rupture',
  'glyph-ring-inscription', 'water-cone-surge', 'sand-spray-burst', 'curse-column-binding',
  'spawn-screen-transition', 'spawn-telegraph-assembly', 'jump-pickup-launch',
  'plasma-ambient-breathing-loop', 'snow-spawn-transition', 'barrier-low-health-failure-loop',
  'barrier-burst-particle-ward', 'flame-charge-compress', 'combo-ring-confirm-hold-decay',
  'pickup-burst-particle-receipt', 'ui-pickup-collect-rise-deposit', 'target-spawn-acquire-confirm-release',
  'poison-burst-particle-rupture', 'acid-burst-particle-eruption', 'healing-burst-restoration-release',
  'holy-burst-consecration-release', 'mud-burst-grounded-eruption', 'reward-charge-gather-release',
  'debris-burst-fracture-eject-fall', 'despawn-impact-collapse', 'dust-burst-compress-roll-settle',
  'footstep-ambient-cadence-loop', 'ghost-trail-procession', 'hologram-break-stabilize-fracture-collapse',
  'leaf-burst-botanical-release', 'marker-release-clamp-confirm-lift-settle', 'petal-burst-botanical-bloom',
  'portal-telegraph-countdown', 'scan-cone-acquire-sweep-resolve',
  'shockwave-burst-compress-expand-attenuate', 'snow-burst-impact', 'thruster-trail-ignite-sustain-cutoff',
])


const MESH_SHADERS = exhaustive<Tuning<'meshShader'>>()([
  'fire-body', 'fire-erode', 'fresnel-shell', 'hex-shell', 'barrier-failure-shell', 'hologram-shell',
  'force-field-shell', 'heal-wave', 'vortex-swirl', 'portal-aperture', 'portal-throat', 'arc-sweep', 'energy-column',
  'water-flow', 'trail-flow', 'projectile-wake', 'electric-wake', 'bubble-surface', 'toxic-pool', 'acid-pool',
  'energy-trail', 'energy-chevron', 'plasma-impact-flipbook', 'combo-ring-meter', 'ui-pickup-receipt',
  'target-spawn-reticle', 'target-spawn-pin', 'warning-loop-panel', 'warning-loop-beacon',
  'marker-release-ground', 'marker-release-badge', 'scan-cone-footprint', 'scan-cone-volume',
  'hologram-break-figure', 'hologram-break-projector', 'thruster-trail-plume', 'thruster-trail-nozzle',
  'exhaust-telegraph-lane', 'exhaust-telegraph-vent', 'flame-burst-blossom', 'meteor-burst-collision',
  'debris-burst-ballistic-breakup', 'dust-burst-pigment-roll', 'shockwave-burst-pressure-front',
  'hologram-burst-projection', 'hologram-burst-emitter', 'dissolve-eroding-prop', 'dissolve-front-fragments',
  'ghost-burst-apparition', 'ghost-burst-wisps', 'poison-cloud-gas-bank', 'poison-cloud-spores',
  'warp-burst-fold-sheet', 'warp-burst-shear-traces',
  'frost-burst-crystal-fan', 'frost-burst-freezing-mist',
  'electric-burst-branch-network', 'electric-burst-corona',
  'plasma-burst-magnetic-core', 'plasma-burst-ion-filaments',
  'water-burst-splash-crown', 'water-burst-ballistic-droplets',
  'bubble-burst-thin-film', 'bubble-burst-pop-fragments',
  'rune-burst-inscription', 'rune-burst-glyph-fragments',
  'healing-burst-restoration-weave', 'healing-burst-renewal-motes',
  'holy-burst-consecration-rays', 'holy-burst-sanctity-feathers',
  'acid-burst-corrosive-splash', 'acid-burst-caustic-spray',
  'slime-burst-elastic-splat', 'slime-burst-sticky-drops',
  'teleport-burst-spatial-slices', 'teleport-burst-arrival-traces',
  'spawn-burst-materialize-weave', 'spawn-burst-rising-motes',
  'despawn-burst-unmake-slices', 'despawn-burst-exit-fragments',
  'dash-burst-shear-ribbons', 'dash-burst-speed-traces',
  'reflect-burst-parry-fan', 'reflect-burst-return-streaks',
])


const SPRITE_NAMES = Object.keys(PFX_SPRITE_SLICES) as PfxSpriteName[]

type Tuning<K extends keyof PfxSurfaceTuning> = NonNullable<PfxSurfaceTuning[K]>

const REFERENCE_LICENSES = exhaustive<Tuning<'referenceLicense'>>()([
  'CC0-1.0', 'MIT', 'CC0-1.0-and-MIT', 'repo-original', 'repo-original-and-CC0-1.0', 'repo-original-and-MIT',
])
const FLIPBOOK_ATLASES = exhaustive<Tuning<'flipbookAtlas'>>()(['unity-small-flame-64', 'unity-fireball-64'])
const BLENDS = exhaustive<Tuning<'blend'>>()(['additive', 'alpha'])
const RAMPS = exhaustive<Tuning<'ramp'>>()(['hot', 'held', 'pinned-hot', 'dark', 'pigment'])
const BANDS = exhaustive<Tuning<'bands'>>()([2, 3])
const DEATHS = exhaustive<Tuning<'death'>>()(['erode'])
const EASES = exhaustive<Tuning<'ease'>>()(['snap'])
const SCREEN_SHADERS = exhaustive<Tuning<'screenShader'>>()(['danger-vignette'])
const COLOR_INDEXES = exhaustive<Tuning<'colorIndex'>>()([0, 1, 2])
const COMBO_MULTIPLIERS = exhaustive<Tuning<'comboMultiplier'>>()([2, 3])
const RING_PURPOSES = exhaustive<Tuning<'ringPurpose'>>()(['shockwave', 'boundary', 'reticle', 'glyph'])
const MESH_MOTIONS = exhaustive<Tuning<'meshMotion'>>()([
  'flash', 'shockwave', 'pulse', 'bloom', 'break', 'charge', 'countdown', 'pickup', 'travel', 'glow', 'drift', 'breathe',
])


/** Numeric tuning bounds follow the documented field meaning. */
const SCALE: NumberRule = { min: 0, max: 64 }
const POSITIVE_SCALE: NumberRule = { min: 0, max: 64, minExclusive: true }
const SIGNED: NumberRule = { min: -64, max: 64 }
const RATIO: NumberRule = { min: 0, max: 1 }

const num = (rule: NumberRule) => (value: unknown, ctx: Ctx) => finite(value, ctx, rule)

const TUNING_VALIDATORS: Validators<PfxSurfaceTuning> = {
  sprite: (value, ctx) => oneOf(value, ctx, SPRITE_NAMES),
  reducedMotionSprite: (value, ctx) => oneOf(value, ctx, SPRITE_NAMES),
  referenceSource: text,
  referenceAdaptation: text,
  referenceLicense: (value, ctx) => oneOf(value, ctx, REFERENCE_LICENSES),
  flipbookAtlas: (value, ctx) => oneOf(value, ctx, FLIPBOOK_ATLASES, 'unknown-atlas'),
  motion: (value, ctx) => oneOf(value, ctx, MOTION_KINDS),
  blend: (value, ctx) => oneOf(value, ctx, BLENDS),
  alphaGamma: num({ min: 0, max: 8, minExclusive: true }),
  spriteColorMix: num(RATIO),
  delay: num({ min: 0, max: 1, maxExclusive: true }),
  window: num({ min: 0, max: 1, minExclusive: true }),
  startScale: num(SCALE),
  countScale: num(SCALE),
  reducedMotionCountScale: num(SCALE),
  speedScale: num({ min: 0, max: 256 }),
  gravity: num({ min: -256, max: 256 }),
  drag: num(SCALE),
  size: (value, ctx) => vec3(value, ctx, SCALE),
  sizeJitter: num(RATIO),
  stretch: num(SCALE),
  streamSpread: num(SCALE),
  spawnOffset: (value, ctx) => vec3(value, ctx, SIGNED),
  positionOffset: (value, ctx) => vec3(value, ctx, SIGNED),
  impactVector: (value, ctx) => {
    const vector = vec3(value, ctx, SIGNED)
    nonZero(vector, ctx)
    return vector
  },
  spreadAngle: num({ min: 0, max: Math.PI }),
  randomizeAzimuth: bool,
  speedJitter: num(RATIO),
  colorOverride: color,
  comboMultiplier: (value, ctx) => oneOf(value, ctx, COMBO_MULTIPLIERS),
  ramp: (value, ctx) => oneOf(value, ctx, RAMPS),
  bands: (value, ctx) => oneOf(value, ctx, BANDS),
  death: (value, ctx) => oneOf(value, ctx, DEATHS),
  ease: (value, ctx) => oneOf(value, ctx, EASES),
  turbulenceScale: num(SCALE),
  spawnLift: num(SIGNED),
  flicker: num({ min: 0, max: 16 }),
  spinScale: num(SIGNED),
  lifeScale: num(POSITIVE_SCALE),
  spawnScale: num(SCALE),
  depthScale: num(SCALE),
  widthScale: num(POSITIVE_SCALE),
  meshGeometry: (value, ctx) => oneOf(value, ctx, MESH_GEOMETRIES),
  screenShader: (value, ctx) => oneOf(value, ctx, SCREEN_SHADERS),
  colorIndex: (value, ctx) => oneOf(value, ctx, COLOR_INDEXES),
  ringPurpose: (value, ctx) => oneOf(value, ctx, RING_PURPOSES),
  meshMotion: (value, ctx) => oneOf(value, ctx, MESH_MOTIONS),
  lifecycle: (value, ctx) => oneOf(value, ctx, LIFECYCLES),
  meshShader: (value, ctx) => oneOf(value, ctx, MESH_SHADERS),
  material: (value, ctx) => parseOptionalFields(value, ctx, MATERIAL_VALIDATORS),
}

// ---------------------------------------------------------------------------
// Surfaces and recipes.

function checkMaterialPath(surface: PfxRenderSurface, material: PfxMaterialTuning, ctx: Ctx): void {
  const materialCtx = at(at(ctx, 'tuning'), 'material')
  const legacyAtlas = surface.tuning?.flipbookAtlas
  if (material.frameAnimation && legacyAtlas !== undefined && legacyAtlas !== material.frameAnimation.atlas) {
    fail(at(at(materialCtx, 'frameAnimation'), 'atlas'), 'atlas-conflict', `'${material.frameAnimation.atlas}' conflicts with flipbookAtlas '${legacyAtlas}'`)
  }
  const path = resolvePfxMaterialPath({ surface })
  const [violation] = getPfxMaterialViolations(material, getPfxMaterialCapability(path))
  if (!violation) return
  switch (violation.code) {
    case 'unsupported-path':
      return fail(materialCtx, 'unsupported-path', `this layer's render path does not support material settings (${violation.reason})`)
    case 'unsupported-feature':
      return fail(at(materialCtx, violation.feature), 'unsupported-feature', `not supported on the ${path.kind} path (${violation.reason})`)
    case 'life-curve-not-allowed':
      return fail(at(materialCtx, violation.field), 'life-curve-not-allowed', `the ${path.kind} path has no finite life clock; use a constant`)
    default: {
      const exhausted: never = violation
      throw new Error(`Unhandled material violation ${JSON.stringify(exhausted)}`)
    }
  }
}

export interface PfxLayerMaterialParseOptions {
  atlasRegistry?: PfxAtlasRegistry
  location?: PfxRecipeParseLocation
}

/**
 * Renderer boundary for one layer: the same structural and actual-path checks
 * as the recipe parser. PfxSurface calls it before any material reaches a
 * shader, so a recipeOverride that skipped the JSON parser still fails here.
 */
export function parsePfxLayerMaterial(
  surface: PfxRenderSurface,
  input: unknown,
  options: PfxLayerMaterialParseOptions = {},
): PfxMaterialTuning {
  const ctx: Ctx = { ...contextFor(options, 'surface'), location: options.location ?? {} }
  const material = parseOptionalFields(input, at(at(ctx, 'tuning'), 'material'), MATERIAL_VALIDATORS)
  checkMaterialPath(surface, material, ctx)
  return material
}

function parseSurface(value: unknown, ctx: Ctx): PfxRenderSurface {
  const raw = record(value, ctx, ['kind', 'role', 'opacity', 'scale', 'phase', 'tuning'], ['kind', 'role', 'opacity', 'scale'])
  const kind = oneOf(raw.kind, at(ctx, 'kind'), SURFACE_KINDS)
  const phase = raw.phase !== undefined ? text(raw.phase, at(ctx, 'phase')) : undefined
  const layerCtx: Ctx = { ...ctx, location: { ...ctx.location, layer: phase ?? kind } }
  const surface: PfxRenderSurface = {
    kind,
    role: oneOf(raw.role, at(layerCtx, 'role'), SURFACE_ROLES),
    opacity: finite(raw.opacity, at(layerCtx, 'opacity'), RATIO),
    scale: finite(raw.scale, at(layerCtx, 'scale'), SCALE),
    ...(phase !== undefined ? { phase } : {}),
  }
  if (raw.tuning !== undefined) surface.tuning = parseOptionalFields(raw.tuning, at(layerCtx, 'tuning'), TUNING_VALIDATORS)
  if (surface.tuning?.material) checkMaterialPath(surface, surface.tuning.material, layerCtx)
  return surface
}

const RECIPE_KEYS = ['id', 'effectId', 'label', 'intent', 'surfaces', 'feelVersion', 'tempo'] as const satisfies ReadonlyArray<keyof PfxAuthoredRecipe>
type _RecipeKeysAreExhaustive = Assert<Exact<(typeof RECIPE_KEYS)[number], keyof PfxAuthoredRecipe>>
const SURFACE_KEYS = ['kind', 'role', 'opacity', 'scale', 'phase', 'tuning'] as const satisfies ReadonlyArray<keyof PfxRenderSurface>
type _SurfaceKeysAreExhaustive = Assert<Exact<(typeof SURFACE_KEYS)[number], keyof PfxRenderSurface>>

function parseRecipe(value: unknown, ctx: Ctx): PfxAuthoredRecipe {
  const raw = record(value, ctx, RECIPE_KEYS, ['id', 'effectId', 'label', 'intent', 'surfaces'])
  const effectId = text(raw.effectId, at(ctx, 'effectId'))
  if (!Object.hasOwn(AUTHORED_EFFECT_RECIPES, effectId)) fail(at(ctx, 'effectId'), 'unknown-effect', `unknown effect ID '${effectId}'`)
  const recipeCtx: Ctx = { ...ctx, location: { effectId } }
  if (!Array.isArray(raw.surfaces) || raw.surfaces.length === 0) fail(at(recipeCtx, 'surfaces'), 'type', 'expected a non-empty array of layers')
  const layers = new Set<string>()
  const surfaces = raw.surfaces.map((entry, index) => {
    const surface = parseSurface(entry, at(at(recipeCtx, 'surfaces'), index))
    const layer = surface.phase ?? surface.kind
    if (layers.has(layer)) fail(at(at(recipeCtx, 'surfaces'), index), 'duplicate-layer', `duplicate layer key '${layer}'`)
    layers.add(layer)
    return surface
  })
  return {
    id: text(raw.id, at(recipeCtx, 'id')),
    effectId,
    label: text(raw.label, at(recipeCtx, 'label')),
    intent: text(raw.intent, at(recipeCtx, 'intent')),
    surfaces,
    ...(raw.feelVersion !== undefined ? { feelVersion: finite(raw.feelVersion, at(recipeCtx, 'feelVersion'), { min: 1, max: 3, integer: true }) } : {}),
    ...(raw.tempo !== undefined ? { tempo: finite(raw.tempo, at(recipeCtx, 'tempo'), { min: 0, max: 16, minExclusive: true }) } : {}),
  }
}

export interface PfxAuthoredRecipeParseOptions {
  /** Registry for frameAnimation atlas IDs. Default: the two built-in sheets. */
  atlasRegistry?: PfxAtlasRegistry
}

/** Validates a recipe value, for example a typed source recipe. */
export function parsePfxAuthoredRecipe(input: unknown, options: PfxAuthoredRecipeParseOptions = {}): PfxAuthoredRecipe {
  return parseRecipe(input, contextFor(options, 'recipe'))
}

/** Validates the text that Copy recipe JSON writes. Preset v1 JSON is a different document. */
export function parsePfxAuthoredRecipeJson(input: unknown, options: PfxAuthoredRecipeParseOptions = {}): PfxAuthoredRecipe {
  const ctx = contextFor(options, 'recipe')
  if (typeof input !== 'string') fail(ctx, 'type', `expected recipe JSON text, got ${describe(input)}`)
  let value: unknown
  try {
    value = JSON.parse(input)
  } catch (error) {
    fail(ctx, 'json', `invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
  return parseRecipe(value, ctx)
}

// Pure structural resource keys. React memos key on these strings instead of
// object identity, so a new recipe object with the same values keeps its
// emissions, geometry, and materials. Material scalar values are excluded:
// they reach the GPU through uniforms (bindings.ts). Every existing
// non-material input that a factory bakes in is included by value.

import type { PfxControls } from '../types/01'
import type { PfxImplementationProfile, PfxRenderSurface } from '../types/02'

/** JSON with sorted object keys. Arrays keep their order. */
export function stablePfxSerialize(value: unknown): string {
  return JSON.stringify(value, (_key, entry: unknown) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return entry
    if (ArrayBuffer.isView(entry)) throw new Error('stablePfxSerialize: typed arrays are not resource-key inputs')
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(entry).sort()) sorted[key] = (entry as Record<string, unknown>)[key]
    return sorted
  })
}

/** The surface without its new `tuning.material` subtree. */
export function withoutPfxMaterial(surface: PfxRenderSurface): PfxRenderSurface {
  if (surface.tuning?.material === undefined) return surface
  const { material: _material, ...tuning } = surface.tuning
  return { ...surface, tuning }
}

export interface PfxEmissionKeyInput {
  effectId: string
  profile: PfxImplementationProfile
  reducedMotion: boolean
  controls: PfxControls
  surface: PfxRenderSurface
}

/**
 * Emission and sprite-geometry identity: every motion, geometry, seed, count,
 * and non-material tuning input. All controls and the whole non-material
 * surface are included, which is a superset of what the emitter reads.
 */
export function getPfxEmissionResourceKey(input: PfxEmissionKeyInput): string {
  return `emission:${stablePfxSerialize({
    effectId: input.effectId,
    profile: input.profile,
    reducedMotion: input.reducedMotion,
    controls: input.controls,
    surface: withoutPfxMaterial(input.surface),
  })}`
}

export interface PfxMaterialKeyInput {
  /** Resolved factory path, for example `generic-sprite` or a mesh shader key. */
  factory: string
  /** binding.structureKey, or null for a layer without a material object. */
  structure: string | null
  /** Existing inputs that the factory builds in, by value. */
  baked: unknown
}

/**
 * Material identity: factory path, feature presence, atlas identity,
 * blend/side policy (inside `baked`), quality (inside `structure`), and every
 * baked non-material input. It excludes only material scalar values.
 */
export function getPfxMaterialResourceKey(input: PfxMaterialKeyInput): string {
  return `material:${input.factory}:${stablePfxSerialize({ structure: input.structure, baked: input.baked })}`
}

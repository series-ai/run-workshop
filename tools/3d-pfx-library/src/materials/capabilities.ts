// Closed actual-render-path resolver and the capability table derived from it.
// PfxSurface (render dispatch) and the inspector use the same resolver.

import type { PfxRenderSurface, PfxSurfaceTuning } from '../types/02'
import {
  PFX_MATERIAL_FEATURES,
  PFX_MATERIAL_LIMITS,
  type PfxLifeValue,
  type PfxMaterialFeature,
  type PfxMaterialMeshCycle,
  type PfxMaterialPath,
  type PfxMaterialQuality,
  type PfxMaterialTuning,
  type PfxNumericLimit,
} from './types'

export interface PfxMaterialPathInput {
  surface: Pick<PfxRenderSurface, 'kind'> & { tuning?: PfxSurfaceTuning }
}

/** meshMotion values that run one burst envelope per master cycle. */
const ONE_SHOT_MESH_MOTIONS: ReadonlySet<NonNullable<PfxSurfaceTuning['meshMotion']>> = new Set(['flash', 'shockwave', 'bloom', 'break'])

/**
 * Mirrors the PfxSurface render order: screen shader, meteor chunks, sprite
 * emission, then the mesh-shader branches. Special motion and geometry
 * resolve before the generic kind or shader key.
 */
export function resolvePfxMaterialPath({ surface }: PfxMaterialPathInput): PfxMaterialPath {
  const tuning = surface.tuning
  if (tuning?.screenShader) return { kind: 'unsupported', reason: 'screen-shader' }
  if (surface.kind === 'particles' || surface.kind === 'impact-sparks') {
    // Inferred motion never yields meteor-impact; only the explicit field does.
    if (tuning?.motion === 'meteor-impact') return { kind: 'unsupported', reason: 'meteor-chunk-instances' }
    return { kind: 'generic-sprite', alphaBlend: tuning?.blend === 'alpha' }
  }
  const meshShader = tuning?.meshShader
  if (!meshShader) return { kind: 'unsupported', reason: 'mesh-kind-not-opted-in' }
  if (meshShader === 'plasma-impact-flipbook') return { kind: 'unsupported', reason: 'plasma-impact-flipbook' }
  if (tuning.meshGeometry !== undefined) return { kind: 'unsupported', reason: 'special-mesh-geometry' }
  if (surface.kind === 'bubble-shells') return { kind: 'unsupported', reason: 'bubble-shell-cluster' }
  // Only the explicit shared shell keys opt in. Aliases that reuse the
  // Fresnel fragment (combo-ring-meter, target-spawn-*, ...) stay unsupported.
  if (meshShader === 'fresnel-shell' || meshShader === 'hex-shell') {
    const cycle: PfxMaterialMeshCycle = tuning.meshMotion && ONE_SHOT_MESH_MOTIONS.has(tuning.meshMotion) ? 'one-shot' : 'continuous'
    return { kind: 'fresnel-shell', shader: meshShader, cycle }
  }
  if (meshShader === 'vortex-swirl' || meshShader === 'portal-aperture') return { kind: 'vortex-swirl' }
  if (meshShader === 'portal-throat') return { kind: 'portal-throat' }
  return { kind: 'unsupported', reason: 'shader-not-opted-in' }
}

// ---------------------------------------------------------------------------
// Capability table.

export type PfxMaterialFeatureUnsupportedReason =
  | 'unsupported-path'
  /** A flat camera-facing card has no view-angle rim. */
  | 'flat-billboard-has-no-rim'
  /** The throat and shell fragments have no texture UV input. */
  | 'no-texture-uv'
  | 'not-on-this-path'
  /** Depth fade applies only to sprites with an explicit `blend: 'alpha'`. */
  | 'needs-explicit-alpha-sprite'
  /** Real frame playback exists only on the generic sprite path. */
  | 'no-frame-sheet-path'

export type PfxMaterialFeatureQuality = 'low-safe' | 'high-only'

export type PfxMaterialFeatureSupport =
  | { status: 'supported'; quality: PfxMaterialFeatureQuality }
  | { status: 'unsupported'; reason: PfxMaterialFeatureUnsupportedReason }

export interface PfxMaterialCapability {
  path: PfxMaterialPath
  features: Readonly<Record<PfxMaterialFeature, PfxMaterialFeatureSupport>>
  /** False on continuous paths: they accept constants only. */
  lifeCurves: boolean
  /** Existing rim terms that an explicit rim setting replaces. */
  baselineRim: { power: number; strength: number } | null
}

const HIGH_ONLY_FEATURES: ReadonlySet<PfxMaterialFeature> = new Set(['distortion', 'softParticles'])

function supported(feature: PfxMaterialFeature): PfxMaterialFeatureSupport {
  return { status: 'supported', quality: HIGH_ONLY_FEATURES.has(feature) ? 'high-only' : 'low-safe' }
}

function unsupported(reason: PfxMaterialFeatureUnsupportedReason): PfxMaterialFeatureSupport {
  return { status: 'unsupported', reason }
}

function featureTable(
  build: (feature: PfxMaterialFeature) => PfxMaterialFeatureSupport,
): Readonly<Record<PfxMaterialFeature, PfxMaterialFeatureSupport>> {
  return Object.freeze(Object.fromEntries(PFX_MATERIAL_FEATURES.map((feature) => [feature, build(feature)])) as Record<PfxMaterialFeature, PfxMaterialFeatureSupport>)
}

export function getPfxMaterialCapability(path: PfxMaterialPath): PfxMaterialCapability {
  switch (path.kind) {
    case 'generic-sprite':
      return {
        path,
        lifeCurves: true,
        baselineRim: null,
        features: featureTable((feature) => {
          if (feature === 'rim') return unsupported('flat-billboard-has-no-rim')
          if (feature === 'softParticles' && !path.alphaBlend) return unsupported('needs-explicit-alpha-sprite')
          return supported(feature)
        }),
      }
    case 'fresnel-shell':
      return {
        path,
        lifeCurves: path.cycle === 'one-shot',
        // PFX_FRESNEL_SHELL_FRAGMENT: pow(1.0 - facing, 3.4) at unit strength.
        baselineRim: { power: 3.4, strength: 1 },
        features: featureTable((feature) => {
          if (feature === 'mask' || feature === 'dissolve' || feature === 'rim') return supported(feature)
          if (feature === 'uv' || feature === 'distortion') return unsupported('no-texture-uv')
          if (feature === 'frameAnimation') return unsupported('no-frame-sheet-path')
          return unsupported('needs-explicit-alpha-sprite')
        }),
      }
    case 'vortex-swirl':
      return {
        path,
        lifeCurves: false,
        baselineRim: null,
        features: featureTable((feature) => {
          if (feature === 'uv' || feature === 'distortion') return supported(feature)
          if (feature === 'frameAnimation') return unsupported('no-frame-sheet-path')
          if (feature === 'softParticles') return unsupported('needs-explicit-alpha-sprite')
          return unsupported('not-on-this-path')
        }),
      }
    case 'portal-throat':
      return {
        path,
        lifeCurves: false,
        // PFX_PORTAL_THROAT_FRAGMENT: pow(1.0 - facing, 2.2) at unit strength.
        baselineRim: { power: 2.2, strength: 1 },
        features: featureTable((feature) => {
          if (feature === 'rim') return supported(feature)
          if (feature === 'frameAnimation') return unsupported('no-frame-sheet-path')
          if (feature === 'softParticles') return unsupported('needs-explicit-alpha-sprite')
          return unsupported('no-texture-uv')
        }),
      }
    case 'unsupported':
      return { path, lifeCurves: false, baselineRim: null, features: featureTable(() => unsupported('unsupported-path')) }
    default: {
      const exhausted: never = path
      throw new Error(`Unhandled material path ${JSON.stringify(exhausted)}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Named controls. The inspector shows only supported controls and reads the
// same limits as the parser.

export type PfxMaterialControlGroup = 'texture-motion' | 'mask-dissolve' | 'rim' | 'depth-fade'

export type PfxMaterialControlValue = 'number' | 'vec2' | 'life' | 'enum' | 'color' | 'boolean' | 'atlas'

export interface PfxMaterialControlDefinition {
  feature: PfxMaterialFeature
  group: PfxMaterialControlGroup
  label: string
  value: PfxMaterialControlValue
  /** Native input units. */
  unit?: string
  limit?: PfxNumericLimit
  options?: readonly string[]
  /** Reduced motion sets this control to zero or freezes it. */
  decorativeMotion: boolean
  optional?: boolean
}

export const PFX_MATERIAL_CONTROLS = {
  'uv.scale': { feature: 'uv', group: 'texture-motion', label: 'UV scale', value: 'vec2', unit: '×', limit: PFX_MATERIAL_LIMITS.uvScale, decorativeMotion: false },
  'uv.offset': { feature: 'uv', group: 'texture-motion', label: 'UV offset', value: 'vec2', unit: 'UV', limit: PFX_MATERIAL_LIMITS.uvOffset, decorativeMotion: false },
  'uv.rotation': { feature: 'uv', group: 'texture-motion', label: 'UV rotation', value: 'number', unit: 'rad', limit: PFX_MATERIAL_LIMITS.uvRotation, decorativeMotion: false },
  'uv.scroll': { feature: 'uv', group: 'texture-motion', label: 'UV scroll speed', value: 'vec2', unit: 'UV/s', limit: PFX_MATERIAL_LIMITS.scroll, decorativeMotion: true },
  'uv.wrap': { feature: 'uv', group: 'texture-motion', label: 'UV wrap', value: 'enum', options: ['clamp', 'repeat'], decorativeMotion: false },
  'distortion.kind': { feature: 'distortion', group: 'texture-motion', label: 'Distortion map', value: 'enum', options: ['noise', 'flow'], decorativeMotion: true },
  'distortion.strength': { feature: 'distortion', group: 'texture-motion', label: 'Distortion strength', value: 'life', unit: 'UV', limit: PFX_MATERIAL_LIMITS.distortionStrength, decorativeMotion: true },
  'distortion.direction': { feature: 'distortion', group: 'texture-motion', label: 'Noise direction', value: 'vec2', limit: PFX_MATERIAL_LIMITS.distortionDirection, decorativeMotion: true },
  'distortion.scroll': { feature: 'distortion', group: 'texture-motion', label: 'Distortion scroll speed', value: 'vec2', unit: 'UV/s', limit: PFX_MATERIAL_LIMITS.scroll, decorativeMotion: true },
  'frameAnimation.atlas': { feature: 'frameAnimation', group: 'texture-motion', label: 'Frame animation', value: 'atlas', decorativeMotion: true },
  'frameAnimation.frameBlend': { feature: 'frameAnimation', group: 'texture-motion', label: 'Frame blend', value: 'boolean', decorativeMotion: true },
  'mask.channel': { feature: 'mask', group: 'mask-dissolve', label: 'Mask channel', value: 'enum', options: ['r', 'g', 'b', 'a'], decorativeMotion: false },
  'mask.strength': { feature: 'mask', group: 'mask-dissolve', label: 'Mask strength', value: 'number', limit: PFX_MATERIAL_LIMITS.maskStrength, decorativeMotion: false },
  'dissolve.progress': { feature: 'dissolve', group: 'mask-dissolve', label: 'Dissolve', value: 'life', limit: PFX_MATERIAL_LIMITS.dissolveProgress, decorativeMotion: false },
  'dissolve.softness': { feature: 'dissolve', group: 'mask-dissolve', label: 'Dissolve softness', value: 'number', limit: PFX_MATERIAL_LIMITS.dissolveSoftness, decorativeMotion: false },
  'dissolve.edgeWidth': { feature: 'dissolve', group: 'mask-dissolve', label: 'Edge width', value: 'number', limit: PFX_MATERIAL_LIMITS.dissolveEdgeWidth, decorativeMotion: false },
  'dissolve.edgeColor': { feature: 'dissolve', group: 'mask-dissolve', label: 'Edge colour', value: 'color', decorativeMotion: false },
  'rim.power': { feature: 'rim', group: 'rim', label: 'Rim power', value: 'number', limit: PFX_MATERIAL_LIMITS.rimPower, decorativeMotion: false },
  'rim.strength': { feature: 'rim', group: 'rim', label: 'Rim strength', value: 'life', limit: PFX_MATERIAL_LIMITS.rimStrength, decorativeMotion: false },
  'rim.color': { feature: 'rim', group: 'rim', label: 'Rim colour', value: 'color', decorativeMotion: false, optional: true },
  'softParticles.distance': { feature: 'softParticles', group: 'depth-fade', label: 'Depth fade distance', value: 'number', unit: 'world units', limit: PFX_MATERIAL_LIMITS.softParticleDistance, decorativeMotion: false },
} as const satisfies Record<string, PfxMaterialControlDefinition>

export type PfxMaterialControlId = keyof typeof PFX_MATERIAL_CONTROLS

export interface PfxMaterialControlContext {
  quality: PfxMaterialQuality
  reducedMotion: boolean
}

export type PfxMaterialControlAvailability =
  | { state: 'available' }
  | { state: 'unsupported'; reason: PfxMaterialFeatureUnsupportedReason }
  /** Saved values stay; the control is read-only with this reason. */
  | { state: 'disabled'; reason: 'needs-high-quality' | 'reduced-motion' }

export function getPfxMaterialControlAvailability(
  capability: PfxMaterialCapability,
  control: PfxMaterialControlId,
  context: PfxMaterialControlContext,
): PfxMaterialControlAvailability {
  const definition: PfxMaterialControlDefinition = PFX_MATERIAL_CONTROLS[control]
  const support = capability.features[definition.feature]
  if (support.status === 'unsupported') return { state: 'unsupported', reason: support.reason }
  if (support.quality === 'high-only' && context.quality !== 'high') return { state: 'disabled', reason: 'needs-high-quality' }
  if (definition.decorativeMotion && context.reducedMotion) return { state: 'disabled', reason: 'reduced-motion' }
  return { state: 'available' }
}

// ---------------------------------------------------------------------------
// Path violations. Pure data; the parse boundary turns them into errors.

export type PfxMaterialViolation =
  | { code: 'unsupported-path'; reason: Extract<PfxMaterialPath, { kind: 'unsupported' }>['reason'] }
  | { code: 'unsupported-feature'; feature: PfxMaterialFeature; reason: PfxMaterialFeatureUnsupportedReason }
  | { code: 'life-curve-not-allowed'; field: string }

function isLifeCurve(value: PfxLifeValue): boolean {
  return typeof value === 'object'
}

export function getPfxMaterialViolations(material: PfxMaterialTuning, capability: PfxMaterialCapability): PfxMaterialViolation[] {
  if (capability.path.kind === 'unsupported') return [{ code: 'unsupported-path', reason: capability.path.reason }]
  const violations: PfxMaterialViolation[] = []
  for (const feature of PFX_MATERIAL_FEATURES) {
    if (material[feature] === undefined) continue
    const support = capability.features[feature]
    if (support.status === 'unsupported') violations.push({ code: 'unsupported-feature', feature, reason: support.reason })
  }
  if (!capability.lifeCurves) {
    const curves: Array<[string, PfxLifeValue | undefined]> = [
      ['distortion.strength', material.distortion?.strength],
      ['dissolve.progress', material.dissolve?.progress],
      ['rim.strength', material.rim?.strength],
    ]
    for (const [field, value] of curves) {
      if (value !== undefined && isLifeCurve(value)) violations.push({ code: 'life-curve-not-allowed', field })
    }
  }
  return violations
}

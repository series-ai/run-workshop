// Typed material binding: validated tuning + atlas registry + actual path +
// quality + reduced motion. PfxSurface resolves it once per layer and passes
// it explicitly to the pure material factories. Factories never read React
// context or a mutable registry. Structural parts select shader defines;
// scalar parts are uniforms that syncPfxMaterialUniforms updates in place.

import * as THREE from 'three'
import { parsePfxHexColor } from '../constants/04'
import type { PfxRenderSurface } from '../types/02'
import { resolvePfxLayerAtlas, type PfxAtlasDescriptor, type PfxAtlasRegistry, type PfxLayerAtlas } from './atlas'
import { resolvePfxMaterialPath } from './capabilities'
import { stablePfxSerialize } from './keys'
import { getPfxMaterialMap } from './maps'
import { parsePfxLayerMaterial } from './parse'
import type {
  PfxLifeValue,
  PfxMaterialDissolve,
  PfxMaterialDistortion,
  PfxMaterialMask,
  PfxMaterialPath,
  PfxMaterialQuality,
  PfxMaterialRim,
  PfxMaterialSoftParticles,
  PfxMaterialTuning,
  PfxMaterialUv,
} from './types'

export type PfxSupportedMaterialPath = Exclude<PfxMaterialPath, { kind: 'unsupported' }>

export interface PfxActiveFrameAnimation {
  atlas: PfxAtlasDescriptor
  frameBlend: boolean
  /** Explicit reducedMotion freezes playback at frame zero. */
  frozen: boolean
}

/** A configured value that this policy does not apply. It is never silent. */
export interface PfxMaterialDisabledSetting {
  setting: 'distortion' | 'uv.scroll' | 'frameAnimation' | 'softParticles'
  /** `needs-depth-source`: the provider has no caller depth source ref. */
  reason: 'needs-high-quality' | 'reduced-motion' | 'needs-depth-source'
}

export interface PfxMaterialActiveFeatures {
  uv: PfxMaterialUv | null
  distortion: PfxMaterialDistortion | null
  mask: PfxMaterialMask | null
  dissolve: PfxMaterialDissolve | null
  rim: PfxMaterialRim | null
  frameAnimation: PfxActiveFrameAnimation | null
  /**
   * Depth fade. Active only at high quality with a provider depth source ref.
   * PfxSurface then builds a soft variant from this binding and a hard-depth
   * fallback from getPfxHardDepthBinding, and picks one each frame.
   */
  softParticles: PfxMaterialSoftParticles | null
}

export interface PfxMaterialBinding {
  readonly path: PfxSupportedMaterialPath
  readonly quality: PfxMaterialQuality
  readonly reducedMotion: boolean
  /** Validated settings, including values that this policy disables. */
  readonly tuning: PfxMaterialTuning
  /** One resolver for the old flipbookAtlas field and frameAnimation. */
  readonly layerAtlas: PfxLayerAtlas
  readonly active: Readonly<PfxMaterialActiveFeatures>
  readonly disabled: readonly PfxMaterialDisabledSetting[]
  /** Path, feature presence, atlas identity, quality, and motion policy. No scalar values. */
  readonly structureKey: string
}

export interface PfxMaterialBindingInput {
  effectId: string
  surface: PfxRenderSurface
  atlasRegistry: PfxAtlasRegistry
  quality: PfxMaterialQuality
  reducedMotion: boolean
  /**
   * True when the enclosing provider has a caller depth source ref. Its
   * descriptor may still be null or invalid in a frame; PfxSurface checks
   * that per frame. Default false: no soft variant, the hard depth test.
   */
  depthSourceAvailable?: boolean
}

/**
 * Returns null for a layer without a `material` object: that layer keeps the
 * existing renderer unchanged. Throws a named PfxRecipeParseError for invalid
 * settings or an unsupported path, with the effect and layer names.
 */
export function resolvePfxMaterialBinding(input: PfxMaterialBindingInput): PfxMaterialBinding | null {
  const { surface, atlasRegistry, quality, reducedMotion } = input
  if (surface.tuning?.material === undefined) return null
  const layer = surface.phase ?? surface.kind
  const tuning = parsePfxLayerMaterial(surface, surface.tuning.material, {
    atlasRegistry,
    location: { effectId: input.effectId, layer },
  })
  const path = resolvePfxMaterialPath({ surface })
  if (path.kind === 'unsupported') {
    // parsePfxLayerMaterial rejects this first; reaching it is a contract break.
    throw new Error(`resolvePfxMaterialBinding: ${input.effectId}/${layer} resolved to an unsupported path after validation`)
  }
  const layerAtlas: PfxLayerAtlas = path.kind === 'generic-sprite'
    ? resolvePfxLayerAtlas({ tuning: { flipbookAtlas: surface.tuning.flipbookAtlas, material: tuning } }, atlasRegistry, layer)
    : { kind: 'none' }
  const disabled: PfxMaterialDisabledSetting[] = []
  let distortion: PfxMaterialDistortion | null = tuning.distortion ?? null
  if (distortion && quality !== 'high') {
    disabled.push({ setting: 'distortion', reason: 'needs-high-quality' })
    distortion = null
  } else if (distortion && reducedMotion) {
    disabled.push({ setting: 'distortion', reason: 'reduced-motion' })
    distortion = null
  }
  if (tuning.uv && reducedMotion && (tuning.uv.scroll[0] !== 0 || tuning.uv.scroll[1] !== 0)) {
    disabled.push({ setting: 'uv.scroll', reason: 'reduced-motion' })
  }
  const frameAnimation: PfxActiveFrameAnimation | null = layerAtlas.kind === 'frame-animation'
    ? { atlas: layerAtlas.atlas, frameBlend: layerAtlas.frameBlend && !reducedMotion, frozen: reducedMotion }
    : null
  if (frameAnimation?.frozen) disabled.push({ setting: 'frameAnimation', reason: 'reduced-motion' })
  // Depth fade needs high quality and a caller depth source ref. Otherwise
  // the layer keeps the existing hard depth test and says why.
  let softParticles: PfxMaterialSoftParticles | null = tuning.softParticles ?? null
  if (softParticles && quality !== 'high') {
    disabled.push({ setting: 'softParticles', reason: 'needs-high-quality' })
    softParticles = null
  } else if (softParticles && input.depthSourceAvailable !== true) {
    disabled.push({ setting: 'softParticles', reason: 'needs-depth-source' })
    softParticles = null
  }
  const active: PfxMaterialActiveFeatures = {
    uv: tuning.uv ?? null,
    distortion,
    mask: tuning.mask ?? null,
    dissolve: tuning.dissolve ?? null,
    rim: tuning.rim ?? null,
    frameAnimation,
    softParticles,
  }
  const structureKey = getPfxBindingStructureKey(path, quality, reducedMotion, layerAtlas, active)
  return { path, quality, reducedMotion, tuning, layerAtlas, active, disabled, structureKey }
}

function getPfxBindingStructureKey(
  path: PfxSupportedMaterialPath,
  quality: PfxMaterialQuality,
  reducedMotion: boolean,
  layerAtlas: PfxLayerAtlas,
  active: PfxMaterialActiveFeatures,
): string {
  return stablePfxSerialize({
    path,
    quality,
    reducedMotion,
    uvWrap: active.uv?.wrap ?? null,
    distortion: active.distortion?.kind ?? null,
    mask: active.mask !== null,
    dissolve: active.dissolve !== null,
    rim: active.rim !== null,
    atlas: layerAtlas.kind === 'none' ? null : { kind: layerAtlas.kind, id: layerAtlas.atlas.id },
    frame: active.frameAnimation ? { blend: active.frameAnimation.frameBlend, frozen: active.frameAnimation.frozen } : null,
    soft: active.softParticles !== null,
  })
}

/**
 * The hard-depth fallback of a soft-particle binding: the same binding
 * without the active depth fade. Its material equals the material of the
 * same layer without a depth source. Returns the input when depth fade is
 * not active.
 */
export function getPfxHardDepthBinding(binding: PfxMaterialBinding): PfxMaterialBinding {
  if (binding.active.softParticles === null) return binding
  const active: PfxMaterialActiveFeatures = { ...binding.active, softParticles: null }
  return {
    ...binding,
    active,
    structureKey: getPfxBindingStructureKey(binding.path, binding.quality, binding.reducedMotion, binding.layerAtlas, active),
  }
}

// ---------------------------------------------------------------------------
// Shader defines (structural, fixed at material creation).

export function getPfxMaterialDefines(binding: PfxMaterialBinding): Record<string, boolean> {
  const { active, path } = binding
  const defines: Record<string, boolean> = {}
  if (path.kind !== 'generic-sprite') defines.PFX_MAT_MESH = true
  if (active.uv) defines.PFX_MAT_UV = true
  if (active.uv?.wrap === 'repeat') defines.PFX_MAT_UV_REPEAT = true
  if (active.distortion) defines.PFX_MAT_DISTORTION = true
  if (active.distortion?.kind === 'flow') defines.PFX_MAT_DISTORTION_FLOW = true
  if (active.mask) defines.PFX_MAT_MASK = true
  if (active.dissolve) defines.PFX_MAT_DISSOLVE = true
  if (active.rim) defines.PFX_MAT_RIM = true
  if (active.frameAnimation) defines.PFX_MAT_FRAME_ANIMATION = true
  if (active.frameAnimation?.frameBlend) defines.PFX_MAT_FRAME_BLEND = true
  if (active.frameAnimation?.frozen) defines.PFX_MAT_FRAME_FROZEN = true
  if (active.softParticles) defines.PFX_MAT_SOFT_PARTICLES = true
  return defines
}

// ---------------------------------------------------------------------------
// Uniforms. Created once per material; values change in place.

/** Sprites use direct sRGB 0..1 values like their ramp. Meshes use THREE.Color like their factory. */
export type PfxMaterialColorConvention = 'sprite-direct' | 'mesh-color'

const scratchColor = new THREE.Color()

function writeColor(target: THREE.Vector3, hex: string, convention: PfxMaterialColorConvention): void {
  if (convention === 'sprite-direct') {
    const [r, g, b] = parsePfxHexColor(hex)
    target.set(r, g, b)
    return
  }
  scratchColor.set(hex)
  target.set(scratchColor.r, scratchColor.g, scratchColor.b)
}

function writeLife(target: THREE.Vector3, value: PfxLifeValue): void {
  if (typeof value === 'number') target.set(value, value, value)
  else target.set(value.values[0], value.values[1], value.values[2])
}

const MASK_CHANNEL_INDEX = { r: 0, g: 1, b: 2, a: 3 } as const

export interface PfxMaterialUniformOptions {
  convention: PfxMaterialColorConvention
  /** The factory's existing hot colour. An omitted rim colour uses it. */
  baselineHotColor?: THREE.Vector3
}

/** Uniform objects for the active features. Values come from syncPfxMaterialUniforms. */
export function createPfxMaterialUniforms(
  binding: PfxMaterialBinding,
  options: PfxMaterialUniformOptions,
): Record<string, THREE.IUniform> {
  const { active } = binding
  const uniforms: Record<string, THREE.IUniform> = {}
  if (active.uv) {
    uniforms.uPfxUvScale = { value: new THREE.Vector2() }
    uniforms.uPfxUvOffset = { value: new THREE.Vector2() }
    uniforms.uPfxUvRotation = { value: 0 }
    uniforms.uPfxUvScrollOffset = { value: new THREE.Vector2() }
  }
  if (active.distortion) {
    uniforms.uPfxDistortionMap = { value: getPfxMaterialMap(active.distortion.map) }
    uniforms.uPfxDistortionStrength = { value: new THREE.Vector3() }
    uniforms.uPfxDistortionDirection = { value: new THREE.Vector2() }
    uniforms.uPfxDistortionScrollOffset = { value: new THREE.Vector2() }
  }
  if (active.mask) {
    uniforms.uPfxMaskMap = { value: getPfxMaterialMap(active.mask.map) }
    uniforms.uPfxMaskChannel = { value: new THREE.Vector4() }
    uniforms.uPfxMaskStrength = { value: 0 }
  }
  if (active.dissolve) {
    uniforms.uPfxDissolveMap = { value: getPfxMaterialMap(active.dissolve.map) }
    uniforms.uPfxDissolveProgress = { value: new THREE.Vector3() }
    uniforms.uPfxDissolveSoftness = { value: 0 }
    uniforms.uPfxDissolveEdgeWidth = { value: 0 }
    uniforms.uPfxDissolveEdgeColor = { value: new THREE.Vector3() }
  }
  if (active.rim) {
    if (!options.baselineHotColor) throw new Error('createPfxMaterialUniforms: a rim path must supply its baseline hot colour')
    uniforms.uPfxRimPower = { value: 0 }
    uniforms.uPfxRimStrength = { value: new THREE.Vector3() }
    uniforms.uPfxRimColor = { value: new THREE.Vector3() }
  }
  if (active.softParticles) {
    // Per-frame values come from the validated depth source (PfxSurface).
    // The texture stays null until the first valid frame.
    uniforms.uPfxSceneDepth = { value: null }
    uniforms.uPfxDepthProjection = { value: new THREE.Vector4() }
    uniforms.uPfxDepthBufferSize = { value: new THREE.Vector2(1, 1) }
    uniforms.uPfxDepthFadeGate = { value: 0 }
    uniforms.uPfxSoftDistance = { value: 1 }
  }
  const atlas = binding.layerAtlas.kind === 'none' ? null : binding.layerAtlas.atlas
  if (atlas) Object.assign(uniforms, createPfxAtlasUniforms(atlas))
  const material = { uniforms, userData: { pfxMaterialColorConvention: options.convention, pfxBaselineHotColor: options.baselineHotColor ?? null } }
  syncPfxMaterialUniforms(material, binding)
  return uniforms
}

/** Atlas-identity uniforms (structural: they change only with the atlas ID). */
export function createPfxAtlasUniforms(atlas: PfxAtlasDescriptor): Record<string, THREE.IUniform> {
  const cellPixels = new THREE.Vector2(atlas.width / atlas.columns, atlas.height / atlas.rows)
  return {
    uPfxAtlasGrid: { value: new THREE.Vector2(atlas.columns, atlas.rows) },
    uPfxAtlasCellPixels: { value: cellPixels },
    // Keep at least 8 texels per cell side at the coarsest sampled level.
    uPfxAtlasMaxLod: { value: Math.max(0, Math.log2(Math.min(cellPixels.x, cellPixels.y)) - 3) },
    uPfxAtlasCellInset: { value: atlas.cellInset },
    uPfxAtlasFrameCount: { value: atlas.frameCount },
    uPfxAtlasFrameRate: { value: atlas.frameRate },
  }
}

interface PfxUniformHost {
  uniforms: Record<string, THREE.IUniform>
  userData: Record<string, unknown>
}

/**
 * The material factory writes the host contract into userData:
 * `pfxMaterialColorConvention` always, and `pfxBaselineHotColor` (a
 * THREE.Vector3) on a rim path. A material without it cannot take a binding.
 */
export class PfxMaterialHostContractError extends Error {
  constructor(readonly field: 'pfxMaterialColorConvention' | 'pfxBaselineHotColor', detail: string) {
    super(`syncPfxMaterialUniforms: userData.${field} ${detail}`)
    this.name = 'PfxMaterialHostContractError'
  }
}

function readPfxMaterialColorConvention(material: PfxUniformHost): PfxMaterialColorConvention {
  const convention = material.userData.pfxMaterialColorConvention
  if (convention !== 'sprite-direct' && convention !== 'mesh-color') {
    throw new PfxMaterialHostContractError('pfxMaterialColorConvention', `must be 'sprite-direct' or 'mesh-color', got ${String(convention)}`)
  }
  return convention
}

function readPfxBaselineHotColor(material: PfxUniformHost): THREE.Vector3 {
  const baseline = material.userData.pfxBaselineHotColor
  if (!(baseline instanceof THREE.Vector3)) {
    throw new PfxMaterialHostContractError('pfxBaselineHotColor', `must be the factory's THREE.Vector3 hot colour for a rim binding, got ${String(baseline)}`)
  }
  return baseline
}

/**
 * Writes the binding's scalar values into existing uniforms. A scalar edit
 * calls only this; it never rebuilds the material. It throws when the
 * material lacks a uniform for an active feature (a structural mismatch).
 */
export function syncPfxMaterialUniforms(material: PfxUniformHost, binding: PfxMaterialBinding): void {
  const u = material.uniforms
  const need = (name: string): THREE.IUniform => {
    const uniform = u[name]
    if (!uniform) throw new Error(`syncPfxMaterialUniforms: material has no ${name}; its structure does not match this binding`)
    return uniform
  }
  const { active } = binding
  // Check the host contract before any write, so a mismatch changes nothing.
  const convention = readPfxMaterialColorConvention(material)
  const rim = active.rim ? { ...active.rim, baselineHotColor: readPfxBaselineHotColor(material) } : null
  if (active.uv) {
    ;(need('uPfxUvScale').value as THREE.Vector2).set(active.uv.scale[0], active.uv.scale[1])
    ;(need('uPfxUvOffset').value as THREE.Vector2).set(active.uv.offset[0], active.uv.offset[1])
    need('uPfxUvRotation').value = active.uv.rotation
  }
  if (active.distortion) {
    writeLife(need('uPfxDistortionStrength').value as THREE.Vector3, active.distortion.strength)
    const direction = need('uPfxDistortionDirection').value as THREE.Vector2
    if (active.distortion.kind === 'noise') direction.set(active.distortion.direction[0], active.distortion.direction[1]).normalize()
    else direction.set(0, 0)
  }
  if (active.mask) {
    ;(need('uPfxMaskChannel').value as THREE.Vector4).setScalar(0).setComponent(MASK_CHANNEL_INDEX[active.mask.channel], 1)
    need('uPfxMaskStrength').value = active.mask.strength
  }
  if (active.dissolve) {
    writeLife(need('uPfxDissolveProgress').value as THREE.Vector3, active.dissolve.progress)
    need('uPfxDissolveSoftness').value = active.dissolve.softness
    need('uPfxDissolveEdgeWidth').value = active.dissolve.edgeWidth
    writeColor(need('uPfxDissolveEdgeColor').value as THREE.Vector3, active.dissolve.edgeColor, convention)
  }
  if (rim) {
    need('uPfxRimPower').value = rim.power
    writeLife(need('uPfxRimStrength').value as THREE.Vector3, rim.strength)
    const rimColor = need('uPfxRimColor').value as THREE.Vector3
    if (rim.color !== undefined) writeColor(rimColor, rim.color, convention)
    else rimColor.copy(rim.baselineHotColor)
  }
  if (active.softParticles) need('uPfxSoftDistance').value = active.softParticles.distance
}

function periodic(value: number): number {
  return value - Math.floor(value)
}

/**
 * Per-frame clock update. Scroll offsets are bounded to one period on the
 * host in double precision before they become shader floats. Allocates
 * nothing. Reduced motion holds every decorative offset at zero.
 */
export function updatePfxMaterialClock(
  material: { uniforms: Record<string, THREE.IUniform> },
  binding: PfxMaterialBinding,
  effectSeconds: number,
): void {
  const seconds = binding.reducedMotion ? 0 : effectSeconds
  const { uv, distortion } = binding.active
  if (uv) {
    ;(material.uniforms.uPfxUvScrollOffset!.value as THREE.Vector2).set(
      periodic(uv.scroll[0] * seconds),
      periodic(uv.scroll[1] * seconds),
    )
  }
  if (distortion) {
    ;(material.uniforms.uPfxDistortionScrollOffset!.value as THREE.Vector2).set(
      periodic(distortion.scroll[0] * seconds),
      periodic(distortion.scroll[1] * seconds),
    )
  }
}

/** Diagnostic summary for the proof fixture and the inspector. */
export function describePfxMaterialBinding(binding: PfxMaterialBinding | null): Record<string, unknown> | null {
  if (!binding) return null
  return {
    path: binding.path.kind,
    quality: binding.quality,
    reducedMotion: binding.reducedMotion,
    defines: Object.keys(getPfxMaterialDefines(binding)).sort(),
    atlas: binding.layerAtlas.kind === 'none' ? null : { kind: binding.layerAtlas.kind, id: binding.layerAtlas.atlas.id },
    disabled: binding.disabled,
  }
}

// Shared material contract. A layer without a `material` object keeps the
// existing renderer. An explicit `material` object, even an empty one, opts
// the layer into the shared composition path. Validated values come only from
// parsePfxMaterialTuning (parse.ts); internal code trusts these types.

import type * as THREE from 'three'

declare const pfxAtlasIdBrand: unique symbol

/** Atlas ID issued by a validated atlas registry (atlas.ts). */
export type PfxAtlasId = string & { readonly [pfxAtlasIdBrand]: true }

export type PfxVec2 = [number, number]

/** Linear curve over normalized life with stops at age 0, 0.5, and 1. */
export interface PfxLifeCurve {
  kind: 'life'
  values: [number, number, number]
}

/** A constant, or a life curve on paths that have a finite life clock. */
export type PfxLifeValue = number | PfxLifeCurve

export type PfxMaterialUvWrap = 'clamp' | 'repeat'

export interface PfxMaterialUv {
  /** Local-cell UV multiplier. */
  scale: PfxVec2
  /** Local-cell UV units. */
  offset: PfxVec2
  /** Radians about [0.5, 0.5]. */
  rotation: number
  /** Local-cell UV units per second. */
  scroll: PfxVec2
  wrap: PfxMaterialUvWrap
}

export interface PfxMaterialNoiseDistortion {
  kind: 'noise'
  map: 'noise-a'
  /** Local-cell UV units. */
  strength: PfxLifeValue
  /** Displacement axis. Must have a nonzero length. */
  direction: PfxVec2
  /** Local-cell UV units per second. */
  scroll: PfxVec2
}

export interface PfxMaterialFlowDistortion {
  kind: 'flow'
  map: 'flow-a'
  /** Local-cell UV units. Flow RG decodes to -1..1. */
  strength: PfxLifeValue
  /** Local-cell UV units per second. */
  scroll: PfxVec2
}

export type PfxMaterialDistortion = PfxMaterialNoiseDistortion | PfxMaterialFlowDistortion

export type PfxMaterialMaskChannel = 'r' | 'g' | 'b' | 'a'

export interface PfxMaterialMask {
  map: 'mask-a'
  channel: PfxMaterialMaskChannel
  /** Coverage ratio. */
  strength: number
}

export interface PfxMaterialDissolve {
  map: 'noise-a'
  /** Dissolve threshold. Applies after the existing death erosion. */
  progress: PfxLifeValue
  softness: number
  edgeWidth: number
  /** `#rrggbb`. The edge adds only inside surviving coverage. */
  edgeColor: string
}

export interface PfxMaterialRim {
  /** Replaces the existing rim exponent on the supported path. */
  power: number
  /** Replaces the existing rim strength. The baseline strength is 1. */
  strength: PfxLifeValue
  /** `#rrggbb`. Feeds the existing hot-colour mix. Omitted = factory uColorHot. */
  color?: string
}

export interface PfxMaterialFrameAnimation {
  atlas: PfxAtlasId
  frameBlend: boolean
}

export interface PfxMaterialSoftParticles {
  /** Positive world units. */
  distance: number
}

export interface PfxMaterialTuning {
  uv?: PfxMaterialUv
  distortion?: PfxMaterialDistortion
  mask?: PfxMaterialMask
  dissolve?: PfxMaterialDissolve
  rim?: PfxMaterialRim
  /** Real atlas playback. Only this field replaces the legacy pulse. */
  frameAnimation?: PfxMaterialFrameAnimation
  softParticles?: PfxMaterialSoftParticles
}

export type PfxMaterialFeature = keyof PfxMaterialTuning

export const PFX_MATERIAL_FEATURES = [
  'uv',
  'distortion',
  'mask',
  'dissolve',
  'rim',
  'frameAnimation',
  'softParticles',
] as const satisfies readonly PfxMaterialFeature[]

export type PfxMaterialMapId = 'noise-a' | 'flow-a' | 'mask-a'

export const PFX_MATERIAL_MAP_IDS = ['noise-a', 'flow-a', 'mask-a'] as const satisfies readonly PfxMaterialMapId[]

/** Explicit material-feature gate. Only `high` enables distortion and scene depth. */
export type PfxMaterialQuality = 'low' | 'high'

export const PFX_MATERIAL_QUALITIES = ['low', 'high'] as const satisfies readonly PfxMaterialQuality[]

export const PFX_DEFAULT_MATERIAL_QUALITY: PfxMaterialQuality = 'low'

export interface PfxNumericLimit {
  min: number
  max: number
  /** True when `min` itself is not allowed. */
  minExclusive?: boolean
  /** True when `max` itself is not allowed. */
  maxExclusive?: boolean
}

/** Authoring bounds. The parser and the inspector read the same values. */
export const PFX_MATERIAL_LIMITS = {
  uvScale: { min: 0.01, max: 16 },
  uvOffset: { min: -16, max: 16 },
  uvRotation: { min: -Math.PI, max: Math.PI },
  scroll: { min: -4, max: 4 },
  distortionStrength: { min: 0, max: 0.25 },
  distortionDirection: { min: -1, max: 1 },
  maskStrength: { min: 0, max: 1 },
  dissolveProgress: { min: -0.05, max: 1.05 },
  dissolveSoftness: { min: 0.0001, max: 0.5 },
  dissolveEdgeWidth: { min: 0, max: 0.25 },
  rimPower: { min: 0.1, max: 16 },
  rimStrength: { min: 0, max: 1 },
  softParticleDistance: { min: 0.001, max: 10 },
} as const satisfies Record<string, PfxNumericLimit>

// ---------------------------------------------------------------------------
// Actual render path. capabilities.ts resolves it in the same order as the
// PfxSurface render dispatch.

export type PfxMaterialPathKind = 'generic-sprite' | 'fresnel-shell' | 'vortex-swirl' | 'portal-throat' | 'unsupported'

/** Literal tag that each supported factory writes to `material.userData`. */
export type PfxMaterialPathTag = Exclude<PfxMaterialPathKind, 'unsupported'>

export const PFX_MATERIAL_PATH_USERDATA_KEY = 'pfxMaterialPath'

export type PfxUnsupportedMaterialPathReason =
  /** A screenShader layer renders a clip-space quad before any other branch. */
  | 'screen-shader'
  /** motion `meteor-impact` renders instanced chunk meshes, not sprites. */
  | 'meteor-chunk-instances'
  /** The plasma-impact flipbook has its own factory and atlas. */
  | 'plasma-impact-flipbook'
  /** A special mesh geometry is out of scope for this change. */
  | 'special-mesh-geometry'
  /** A `bubble-shells` kind takes its own branch before the shell branch. */
  | 'bubble-shell-cluster'
  /** Mesh shader key that is not an explicit shared-material opt-in. */
  | 'shader-not-opted-in'
  /** Non-particle kind without a mesh shader. */
  | 'mesh-kind-not-opted-in'

/** `one-shot` = a burst-envelope meshMotion clock; life curves are allowed. */
export type PfxMaterialMeshCycle = 'one-shot' | 'continuous'

export type PfxMaterialPath =
  | { kind: 'generic-sprite'; alphaBlend: boolean }
  | { kind: 'fresnel-shell'; shader: 'fresnel-shell' | 'hex-shell'; cycle: PfxMaterialMeshCycle }
  | { kind: 'vortex-swirl' }
  | { kind: 'portal-throat' }
  | { kind: 'unsupported'; reason: PfxUnsupportedMaterialPathReason }

// ---------------------------------------------------------------------------
// Caller-owned scene depth (T7 validates and uses it).

/** Only `standard` is accepted. The others exist so validation can name them. */
export type PfxMaterialDepthEncoding = 'standard' | 'logarithmic' | 'reversed' | 'packed-rgba'

/**
 * Reusable descriptor. The host allocates it once with
 * createPfxMaterialDepthSource and mutates it in place at each capture.
 * The library never disposes `texture`.
 */
export interface PfxMaterialDepthSource {
  readonly texture: THREE.DepthTexture
  encoding: PfxMaterialDepthEncoding
  /** Camera used for the last successful capture. */
  camera: THREE.Camera | null
  readonly cameraMatrixWorldInverse: THREE.Matrix4
  readonly projectionMatrix: THREE.Matrix4
  /** Drawing-buffer size in pixels at the last successful capture. */
  readonly bufferSize: THREE.Vector2
  /**
   * Capture viewport in drawing-buffer pixels. The render that samples the
   * depth must use the same viewport. A fractional canvas size can give a
   * viewport one pixel larger than the drawing buffer.
   */
  readonly viewport: THREE.Vector4
  /** Provider frame token of the last successful capture. -1 = none. */
  frameToken: number
  /** True when the capture ran in an XR session. XR is unsupported. */
  xr: boolean
}

/** Stable caller-owned ref. Its `current` is null or one reusable descriptor. */
export interface PfxMaterialDepthSourceRef {
  readonly current: PfxMaterialDepthSource | null
}

/**
 * Why a soft-particle layer uses its hard-depth fallback in this frame.
 * Each value selects the existing hard depth test. None is shown to a player.
 */
export type PfxMaterialDepthFallbackReason =
  /** The ref holds no descriptor. */
  | 'no-source'
  /** The last successful capture is not from this provider frame. */
  | 'stale-token'
  /** The capture camera is not the camera that renders this frame. */
  | 'wrong-camera'
  /** The camera moved after the capture (view matrix differs). */
  | 'camera-matrix-mismatch'
  /** The camera projection changed after the capture. */
  | 'projection-matrix-mismatch'
  /** The drawing buffer, depth texture, or draw viewport has a different size. */
  | 'size-mismatch'
  | 'logarithmic-depth'
  | 'reversed-depth'
  | 'packed-depth'
  | 'xr'
  /** Only standard perspective and orthographic projections are accepted. */
  | 'unsupported-projection'
  /** The texture is not a THREE.DepthTexture without a compare function. */
  | 'unsupported-texture'

export const PFX_MATERIAL_DEPTH_FALLBACK_REASONS = [
  'no-source',
  'stale-token',
  'wrong-camera',
  'camera-matrix-mismatch',
  'projection-matrix-mismatch',
  'size-mismatch',
  'logarithmic-depth',
  'reversed-depth',
  'packed-depth',
  'xr',
  'unsupported-projection',
  'unsupported-texture',
] as const satisfies readonly PfxMaterialDepthFallbackReason[]

export type PfxMaterialDepthValidity =
  | { readonly valid: true; readonly reason: null }
  | { readonly valid: false; readonly reason: PfxMaterialDepthFallbackReason }

/** Material variant that a soft-particle layer draws. Written to `material.userData`. */
export type PfxMaterialDepthVariant = 'soft' | 'hard'

export const PFX_MATERIAL_DEPTH_VARIANT_USERDATA_KEY = 'pfxDepthVariant'

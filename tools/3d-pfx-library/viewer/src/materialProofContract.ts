// Values and types that the proof fixture and its Node runner share. This
// module imports no renderer code, so the runner can load it in Node.

import type { PfxMaterialQuality } from '@pfx'
import type { MaterialProofScenario } from './MaterialProofApp'

export const MATERIAL_PROOF_CASES = [
  'baseline-gamepfx',
  'frame-oracle',
  'material-gamepfx',
  'dispatch-tags',
  'cost-edits',
  'compile-error-control',
  'recipe-replay',
  'runtime-status',
  'depth',
] as const
export const MATERIAL_PROOF_EFFECTS = ['flame-burst', 'portal-idle-loop', 'smoke-puff', 'shield-break'] as const
export const MATERIAL_PROOF_CAMERAS = ['front', 'three-quarter', 'side'] as const
export const MATERIAL_PROOF_SEED = 2718
export const MATERIAL_PROOF_MAX_TIME_MS = 10_000

export type MaterialProofCase = (typeof MATERIAL_PROOF_CASES)[number]
export type MaterialProofEffect = (typeof MATERIAL_PROOF_EFFECTS)[number]
export type MaterialProofCamera = (typeof MATERIAL_PROOF_CAMERAS)[number]

/** `no-material` is the frozen source baseline: every tuning.material removed. */
export const MATERIAL_PROOF_RECIPE_SOURCES = ['catalog', 'no-material'] as const
export type MaterialProofRecipeSource = (typeof MATERIAL_PROOF_RECIPE_SOURCES)[number]

/** The three public catalog entry points that replay a recipe. */
export const MATERIAL_PROOF_ENTRY_POINTS = ['game-pfx', 'pfx-by-id', 'drop-in'] as const
export type MaterialProofEntryPoint = (typeof MATERIAL_PROOF_ENTRY_POINTS)[number]

export const PROOF_ATLAS_ID = 'proof-numbered'
export const PROOF_ATLAS = {
  columns: 4,
  rows: 2,
  cellPixels: 128,
  frameCount: 8,
  frameRate: 4,
  /** 0.06 of a cell = 7.7 texels; the sentinel ring is 2 texels wide. */
  cellInset: 0.06,
  sentinelPixels: 2,
  sentinel: '#ff00ff',
  /** Frame colours. Adjacent frames never mix toward the magenta sentinel. */
  frameColors: ['#ff2a1a', '#ff9a1a', '#f2e81a', '#2ad62a', '#1ad6b4', '#1aa8ff', '#3a3aff', '#f0f0f0'],
} as const

export const PROOF_CORRUPT_ATLAS_ID = 'proof-corrupt'

export type MaterialProofOracleUv = 'none' | 'rotate-clamp' | 'repeat-tiles'
/** Particle duration multiplier aLife.y. 1 keeps the T3 oracle unchanged. */
export const MATERIAL_PROOF_ORACLE_DURATIONS = [1, 0.5, 2] as const
export type MaterialProofOracleDuration = (typeof MATERIAL_PROOF_ORACLE_DURATIONS)[number]
export interface MaterialProofOracle {
  /** Particle cycle offset aLife.x; also the shader variant. */
  variant: 0 | 0.5
  frameBlend: boolean
  size: 'large' | 'small'
  uv: MaterialProofOracleUv
  /** Default 1. */
  duration?: MaterialProofOracleDuration
}

// ---------------------------------------------------------------------------
// Depth case (T7): a viewer host adapter captures caller-owned scene depth.

/**
 * `valid`: the host captures and stamps each high-quality frame.
 * `no-provider`: no PfxMaterialProvider (the hard-depth baseline).
 * `no-ref`: a provider without a depthSource ref (the library default).
 * The others are host faults that must select the hard-depth fallback.
 */
export const MATERIAL_PROOF_DEPTH_SOURCES = [
  'valid',
  'no-provider',
  'no-ref',
  'null',
  'stale',
  'wrong-camera',
  'size-hold',
  'reversed',
  'packed',
  'xr',
] as const
export type MaterialProofDepthSource = (typeof MATERIAL_PROOF_DEPTH_SOURCES)[number]
export const MATERIAL_PROOF_DEPTH_PROJECTIONS = ['perspective', 'orthographic'] as const
export type MaterialProofDepthProjection = (typeof MATERIAL_PROOF_DEPTH_PROJECTIONS)[number]
/** Contact box placement. `front` stands between the camera and the smoke. */
export const MATERIAL_PROOF_DEPTH_CONTACTS = ['none', 'center', 'left', 'front'] as const
export type MaterialProofDepthContact = (typeof MATERIAL_PROOF_DEPTH_CONTACTS)[number]
/** Renderer depth buffer. `logarithmic` is a real logarithmicDepthBuffer renderer. */
export const MATERIAL_PROOF_DEPTH_BUFFERS = ['standard', 'logarithmic'] as const
export type MaterialProofDepthBuffer = (typeof MATERIAL_PROOF_DEPTH_BUFFERS)[number]
export const MATERIAL_PROOF_DEPTH_STAGE_SIZES = ['square', 'wide'] as const
export type MaterialProofDepthStageSize = (typeof MATERIAL_PROOF_DEPTH_STAGE_SIZES)[number]
export const MATERIAL_PROOF_DEPTH_SMOKE_LAYERS = ['puff-bloom', 'impact-condensation', 'wisp-breakup'] as const

export interface MaterialProofDepthOptions {
  source: MaterialProofDepthSource
  projection: MaterialProofDepthProjection
  depthBuffer: MaterialProofDepthBuffer
  contact: MaterialProofDepthContact
  stageSize: MaterialProofDepthStageSize
  /** Depth fade distance in world units on every smoke layer. */
  softness: number
  smoke: boolean
  autoRotate: boolean
  /** A priority-0 camera move after the consumers. */
  lateCamera: boolean
  captureError: boolean
  /** False unmounts the provider, host adapter, fixture, and smoke. */
  mounted: boolean
}

export const DEFAULT_DEPTH_OPTIONS: MaterialProofDepthOptions = {
  source: 'valid',
  projection: 'perspective',
  depthBuffer: 'standard',
  contact: 'center',
  stageSize: 'square',
  softness: 0.4,
  smoke: true,
  autoRotate: false,
  lateCamera: false,
  captureError: false,
  mounted: true,
}

export function depthOptionsToken(options: MaterialProofDepthOptions): string {
  return [options.source, options.projection, options.depthBuffer, options.contact, options.stageSize, options.softness,
    options.smoke ? 1 : 0, options.autoRotate ? 1 : 0, options.lateCamera ? 1 : 0, options.captureError ? 1 : 0, options.mounted ? 1 : 0].join(',')
}

/** Diagnostics that the depth stage writes to `canvas.dataset.pfxDepthProof`. */
export interface MaterialProofDepthReport {
  frame: number
  drawingBuffer: [number, number]
  quality: 'low' | 'high'
  source: MaterialProofDepthSource
  /** WebGLRenderer.render calls in the previous animation frame. */
  passesLastFrame: number
  /** Draw calls of the last main render. */
  mainDrawCalls: number
  programs: number | null
  textures: number
  geometries: number
  host: {
    captures: number
    captureErrors: number
    lastCaptureError: string | null
    restoreChecks: number
    restoreFailures: string[]
    targetSize: [number, number] | null
    targetsCreated: number
    targetsDisposed: number
    depthSceneObjects: string[]
    ownedDisposed: { targets: number; materials: number }
  }
  /**
   * `disposeEvents` counts every dispose. `ownerReleases` counts the owner's
   * own GPU-storage releases at a resize. The library adds none.
   */
  callerTexture: { uuid: string; disposeEvents: number; ownerReleases: number; image: [number, number] }
  /** Validity that the consumers saw at priority 0 in the last frame. */
  validity: string
  /** Cumulative per-frame drawn variant counts since the stage mounted. */
  drawnCounts: Record<string, number>
  layers: Array<{
    layer: string
    drawn: 'soft' | 'soft-gated' | 'hard' | 'none'
    soft: string | null
    hard: string | null
    samplers: string[]
  }>
  /** Every variant material seen, with its dispose state. */
  variantMaterials: Record<string, { disposed: boolean }>
  reportedReasons: string[]
  runtimeCheck: { at: number; result: unknown } | null
  depthImage: { at: number; width: number; height: number; dataUri: string } | null
}

export interface MaterialProofSelection {
  proofCase: MaterialProofCase
  effectId: MaterialProofEffect
  timeMs: number
  camera: MaterialProofCamera
  scenario?: MaterialProofScenario
  quality?: PfxMaterialQuality
  reducedMotion?: boolean
  oracle?: MaterialProofOracle
  /** baseline-gamepfx only. Default `catalog`. */
  recipeSource?: MaterialProofRecipeSource
  /** recipe-replay only. Default `game-pfx`. */
  entryPoint?: MaterialProofEntryPoint
  /** depth only. */
  depth?: MaterialProofDepthOptions
}

export const DEFAULT_ORACLE: MaterialProofOracle = { variant: 0, frameBlend: false, size: 'large', uv: 'none' }

/**
 * The canvas carries this token only after it rendered the selection.
 * `detail` adds case state that changes the image: the replay import and
 * entry point, or the measured runtime status and preview source.
 */
export function materialProofFrameToken(selection: MaterialProofSelection, edits = 0, detail = ''): string {
  const base = `proof:${selection.proofCase}:${selection.effectId}:${selection.timeMs}:${selection.camera}`
  if (selection.proofCase === 'baseline-gamepfx') {
    return (selection.recipeSource ?? 'catalog') === 'catalog' ? base : `${base}:r=${selection.recipeSource}`
  }
  const oracle = selection.oracle ?? DEFAULT_ORACLE
  // A duration of 1 keeps the T3 token text.
  const duration = (oracle.duration ?? 1) === 1 ? '' : `,d${oracle.duration}`
  return `${base}:q=${selection.quality ?? 'low'}:rm=${selection.reducedMotion ? 1 : 0}:s=${selection.scenario ?? '-'}` +
    `:o=${oracle.variant},${oracle.frameBlend ? 1 : 0},${oracle.size},${oracle.uv}${duration}:e=${edits}${detail ? `:x=${detail}` : ''}`
}

export interface DispatchRow {
  effectId: string
  layer: string
  kind: string
  resolver: string
  reason: string | null
  tags: string[]
  status: 'match' | 'conservative-exclusion' | 'mismatch' | 'missing-object'
}

/** Unsupported reasons where a tagging factory may draw on a path the resolver withholds. */
export const CONSERVATIVE_EXCLUSIONS = ['special-mesh-geometry', 'bubble-shell-cluster'] as const

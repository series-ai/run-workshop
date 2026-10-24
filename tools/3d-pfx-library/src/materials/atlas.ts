// Validated frame-atlas registry. The generated sheet modules define size,
// grid, and frame count. They do not define frame rate or cell padding, so
// this file keeps the existing renderer values: 22 frames per second and a
// 0.018 local-cell inset (PFX_SPRITE_PARTICLE_FRAGMENT). The old generic
// `controls.flipbook` names are legacy pulse inputs, not atlas descriptors.

import { PFX_FIREBALL_FLIPBOOK_ATLAS } from '../fireballFlipbook'
import { PFX_FLAME_FLIPBOOK_ATLAS } from '../flameFlipbook'
import type { PfxControls } from '../types/01'
import type { PfxSurfaceTuning } from '../types/02'
import type { PfxAtlasId } from './types'

/** Frame 0 is the top-left cell. Frames advance left to right, then down. */
export type PfxAtlasFrameOrder = 'row-major-top-left'

export interface PfxAtlasDescriptorInput {
  id: string
  /** `data:image/(png|jpeg|webp);base64,...`. The runtime loads no remote URL. */
  imageSource: string
  width: number
  height: number
  columns: number
  rows: number
  frameCount: number
  /** Frames per second of particle age. */
  frameRate: number
  frameOrder: PfxAtlasFrameOrder
  /** Fraction of one cell trimmed on each side before sampling. */
  cellInset: number
}

export interface PfxAtlasDescriptor extends Readonly<Omit<PfxAtlasDescriptorInput, 'id'>> {
  readonly id: PfxAtlasId
  readonly builtin: boolean
}

declare const pfxAtlasRegistryBrand: unique symbol

export interface PfxAtlasRegistry {
  readonly [pfxAtlasRegistryBrand]: true
  readonly ids: readonly PfxAtlasId[]
  /** Throws when this registry did not issue `id`. */
  get(id: PfxAtlasId): PfxAtlasDescriptor
  lookup(id: string): PfxAtlasDescriptor | undefined
}

export class PfxAtlasRegistryError extends Error {
  constructor(readonly field: string, detail: string) {
    super(`${field}: ${detail}`)
    this.name = 'PfxAtlasRegistryError'
  }
}

export const PFX_ATLAS_DEFAULT_FRAME_RATE = 22
export const PFX_ATLAS_DEFAULT_CELL_INSET = 0.018

const ATLAS_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const IMAGE_SOURCE_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/
const MAX_ATLAS_PIXELS = 16384
const MAX_FRAME_RATE = 120
const MAX_CELL_INSET = 0.25
const INPUT_KEYS: ReadonlyArray<keyof PfxAtlasDescriptorInput> = [
  'id', 'imageSource', 'width', 'height', 'columns', 'rows', 'frameCount', 'frameRate', 'frameOrder', 'cellInset',
]

const issuedRegistries = new WeakSet<object>()

function expectInteger(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new PfxAtlasRegistryError(field, `expected an integer in ${min}..${max}, got ${String(value)}`)
  }
  return value
}

function expectFinite(value: unknown, field: string, min: number, max: number, minExclusive: boolean): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value > max || (minExclusive ? value <= min : value < min)) {
    throw new PfxAtlasRegistryError(field, `expected a finite number in ${minExclusive ? '(' : '['}${min}, ${max}], got ${String(value)}`)
  }
  return value
}

function validateAtlasInput(input: unknown, field: string): PfxAtlasDescriptorInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new PfxAtlasRegistryError(field, 'expected an atlas descriptor object')
  }
  const record = input as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (!(INPUT_KEYS as readonly string[]).includes(key)) throw new PfxAtlasRegistryError(`${field}.${key}`, 'unknown key')
  }
  const { id, imageSource, frameOrder } = record
  if (typeof id !== 'string' || !ATLAS_ID_PATTERN.test(id)) {
    throw new PfxAtlasRegistryError(`${field}.id`, 'expected a lowercase kebab-case ID')
  }
  if (typeof imageSource !== 'string' || !IMAGE_SOURCE_PATTERN.test(imageSource)) {
    throw new PfxAtlasRegistryError(`${field}.imageSource`, 'expected a base64 PNG, JPEG, or WebP data URI')
  }
  if (frameOrder !== 'row-major-top-left') {
    throw new PfxAtlasRegistryError(`${field}.frameOrder`, `expected 'row-major-top-left', got ${String(frameOrder)}`)
  }
  const width = expectInteger(record.width, `${field}.width`, 1, MAX_ATLAS_PIXELS)
  const height = expectInteger(record.height, `${field}.height`, 1, MAX_ATLAS_PIXELS)
  const columns = expectInteger(record.columns, `${field}.columns`, 1, width)
  const rows = expectInteger(record.rows, `${field}.rows`, 1, height)
  if (width % columns !== 0) throw new PfxAtlasRegistryError(`${field}.columns`, `width ${width} is not a multiple of ${columns}`)
  if (height % rows !== 0) throw new PfxAtlasRegistryError(`${field}.rows`, `height ${height} is not a multiple of ${rows}`)
  // The last row must hold at least one frame, so the grid has no empty row.
  const frameCount = expectInteger(record.frameCount, `${field}.frameCount`, Math.max(2, (rows - 1) * columns + 1), columns * rows)
  const frameRate = expectFinite(record.frameRate, `${field}.frameRate`, 0, MAX_FRAME_RATE, true)
  const cellInset = expectFinite(record.cellInset, `${field}.cellInset`, 0, MAX_CELL_INSET, false)
  return { id, imageSource, width, height, columns, rows, frameCount, frameRate, frameOrder, cellInset }
}

function builtinInput(atlas: typeof PFX_FLAME_FLIPBOOK_ATLAS | typeof PFX_FIREBALL_FLIPBOOK_ATLAS): PfxAtlasDescriptorInput {
  return {
    id: atlas.id,
    imageSource: atlas.dataUri,
    width: atlas.width,
    height: atlas.height,
    columns: atlas.columns,
    rows: atlas.rows,
    frameCount: atlas.frameCount,
    frameRate: PFX_ATLAS_DEFAULT_FRAME_RATE,
    frameOrder: 'row-major-top-left',
    cellInset: PFX_ATLAS_DEFAULT_CELL_INSET,
  }
}

/** The plasma-impact sheet is excluded: its factory is not a material path. */
const BUILTIN_ATLAS_INPUTS: readonly PfxAtlasDescriptorInput[] = [
  builtinInput(PFX_FLAME_FLIPBOOK_ATLAS),
  builtinInput(PFX_FIREBALL_FLIPBOOK_ATLAS),
]

/**
 * Creates a registry with the two built-in sheets plus host or fixture
 * sheets. IDs must be unique, including against the built-in IDs.
 */
export function createPfxAtlasRegistry(hostAtlases: readonly unknown[] = []): PfxAtlasRegistry {
  if (!Array.isArray(hostAtlases)) throw new PfxAtlasRegistryError('atlases', 'expected an array')
  const descriptors = new Map<string, PfxAtlasDescriptor>()
  const entries = [
    ...BUILTIN_ATLAS_INPUTS.map((input, index) => ({ input, field: `builtin[${index}]`, builtin: true })),
    ...hostAtlases.map((input, index) => ({ input, field: `atlases[${index}]`, builtin: false })),
  ]
  for (const entry of entries) {
    const valid = validateAtlasInput(entry.input, entry.field)
    if (descriptors.has(valid.id)) throw new PfxAtlasRegistryError(`${entry.field}.id`, `duplicate atlas ID '${valid.id}'`)
    descriptors.set(valid.id, Object.freeze({ ...valid, id: valid.id as PfxAtlasId, builtin: entry.builtin }))
  }
  const ids = Object.freeze([...descriptors.values()].map((descriptor) => descriptor.id))
  const registry = Object.freeze({
    ids,
    get(id: PfxAtlasId): PfxAtlasDescriptor {
      const descriptor = descriptors.get(id)
      if (!descriptor) throw new PfxAtlasRegistryError('atlas', `atlas ID '${id}' is not in this registry`)
      return descriptor
    },
    lookup(id: string): PfxAtlasDescriptor | undefined {
      return descriptors.get(id)
    },
  }) as PfxAtlasRegistry
  issuedRegistries.add(registry)
  return registry
}

export function isPfxAtlasRegistry(value: unknown): value is PfxAtlasRegistry {
  return typeof value === 'object' && value !== null && issuedRegistries.has(value)
}

export const PFX_DEFAULT_ATLAS_REGISTRY: PfxAtlasRegistry = createPfxAtlasRegistry()

export const PFX_BUILTIN_ATLAS_IDS = {
  smallFlame: PFX_DEFAULT_ATLAS_REGISTRY.get(PFX_FLAME_FLIPBOOK_ATLAS.id as PfxAtlasId).id,
  fireball: PFX_DEFAULT_ATLAS_REGISTRY.get(PFX_FIREBALL_FLIPBOOK_ATLAS.id as PfxAtlasId).id,
} as const

// ---------------------------------------------------------------------------
// Layer atlas and animation mode. One resolver serves the old
// `flipbookAtlas` field and the new `material.frameAnimation` field.

export type PfxLayerAtlas =
  | { kind: 'none' }
  /** Old field without frameAnimation: the existing renderer path and pulse. */
  | { kind: 'legacy-flipbook-atlas'; atlas: PfxAtlasDescriptor }
  | { kind: 'frame-animation'; atlas: PfxAtlasDescriptor; frameBlend: boolean }

export interface PfxLayerAtlasInput {
  tuning?: Pick<PfxSurfaceTuning, 'flipbookAtlas' | 'material'>
}

/** Throws when `flipbookAtlas` and `material.frameAnimation.atlas` disagree. */
export function resolvePfxLayerAtlas(
  surface: PfxLayerAtlasInput,
  registry: PfxAtlasRegistry,
  layer: string,
): PfxLayerAtlas {
  const legacyId = surface.tuning?.flipbookAtlas
  const frameAnimation = surface.tuning?.material?.frameAnimation
  if (frameAnimation) {
    if (legacyId !== undefined && legacyId !== frameAnimation.atlas) {
      throw new PfxAtlasRegistryError(
        `${layer}.tuning.material.frameAnimation.atlas`,
        `'${frameAnimation.atlas}' conflicts with flipbookAtlas '${legacyId}'`,
      )
    }
    return { kind: 'frame-animation', atlas: registry.get(frameAnimation.atlas), frameBlend: frameAnimation.frameBlend }
  }
  if (legacyId !== undefined) {
    const atlas = registry.lookup(legacyId)
    if (!atlas) throw new PfxAtlasRegistryError(`${layer}.tuning.flipbookAtlas`, `unknown atlas ID '${legacyId}'`)
    return { kind: 'legacy-flipbook-atlas', atlas }
  }
  return { kind: 'none' }
}

/**
 * Only an explicit frameAnimation replaces the legacy opacity and size pulse.
 * An empty material object or any other material feature keeps the pulse.
 */
export type PfxLayerAnimationMode = 'legacy-pulse' | 'frame-animation'

export function getPfxLayerAnimationMode(tuning: Pick<PfxSurfaceTuning, 'material'> | undefined): PfxLayerAnimationMode {
  return tuning?.material?.frameAnimation ? 'frame-animation' : 'legacy-pulse'
}

/** The four old public values stay accepted. The UI calls them Legacy pulse. */
export type PfxLegacyPulseName = Exclude<PfxControls['flipbook'], 'none'>

export const PFX_LEGACY_PULSE_NAMES = ['smoke-8', 'flame-8', 'magic-12', 'impact-6'] as const satisfies readonly PfxLegacyPulseName[]

export const PFX_LEGACY_PULSE_LABEL = 'Legacy pulse'

// ---------------------------------------------------------------------------
// Frame oracle. Mirrors the sprite fragment:
// floor(mod(ageSeconds * rate + floor(variant * 11), frameCount)).

function glslMod(x: number, y: number): number {
  return x - y * Math.floor(x / y)
}

export function getPfxAtlasFrameIndex(atlas: PfxAtlasDescriptor, ageSeconds: number, variant: number): number {
  if (!Number.isFinite(ageSeconds)) throw new PfxAtlasRegistryError('ageSeconds', 'expected a finite number')
  if (!Number.isFinite(variant) || variant < 0 || variant >= 1) throw new PfxAtlasRegistryError('variant', 'expected a number in [0, 1)')
  return Math.floor(glslMod(ageSeconds * atlas.frameRate + Math.floor(variant * 11), atlas.frameCount))
}

export interface PfxAtlasFrameCell {
  column: number
  row: number
  /** Texture-space origin of the cell (flipY texture, row 0 at the top). */
  uvOffset: [number, number]
  uvScale: [number, number]
}

export function getPfxAtlasFrameCell(atlas: PfxAtlasDescriptor, frameIndex: number): PfxAtlasFrameCell {
  if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= atlas.frameCount) {
    throw new PfxAtlasRegistryError('frameIndex', `expected an integer in 0..${atlas.frameCount - 1}, got ${frameIndex}`)
  }
  const column = frameIndex % atlas.columns
  const row = Math.floor(frameIndex / atlas.columns)
  return {
    column,
    row,
    uvOffset: [column / atlas.columns, (atlas.rows - 1 - row) / atlas.rows],
    uvScale: [1 / atlas.columns, 1 / atlas.rows],
  }
}

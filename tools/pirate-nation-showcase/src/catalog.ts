/**
 * Typed access to the Pirate Nation pack catalogs.
 *
 * The pack ships three JSON catalogs under `public/assets/pirate-nation/`
 * (`runtime/models.json`, `runtime/audio.json`, `runtime/sprites.json`) plus a
 * top-level `manifest.json`. Every entry carries its provenance (source path
 * in the upstream Unity repo, license, copyright), which the showcase surfaces
 * per asset.
 */

/** URL root of the copied pack, relative to the dev/preview server root. */
export const PACK_BASE_URL = '/assets/pirate-nation'

export interface Vec3Tuple extends Array<number> {
  0: number
  1: number
  2: number
}

export interface ModelBounds {
  min: Vec3Tuple
  max: Vec3Tuple
  size: Vec3Tuple
}

export interface PirateNationModelEntry {
  id: string
  name: string
  category: string
  filename: string
  /** Path inside `runtime/`, e.g. `models/buildings/buildings-….glb`. */
  relativePath: string
  sizeBytes: number
  bounds: ModelBounds
  normalizedShift: number
  sourceRelativePath: string
  license: string
  copyright: string
}

export interface PirateNationAudioEntry {
  id: string
  name: string
  category: 'music' | 'sfx'
  subCategory: string
  filename: string
  relativePath: string
  sizeBytes: number
  format: string
  sourceRelativePath: string
  license: string
  copyright: string
}

export interface PirateNationSpriteEntry {
  id: string
  name: string
  category: 'icons' | 'ui' | 'branding'
  subCategory: string
  filename: string
  relativePath: string
  sizeBytes: number
  sourceRelativePath: string
  license: string
  copyright: string
}

export interface PackCollection {
  id: string
  name: string
  description: string
  count: number
}

export interface PackManifest {
  packId: string
  displayName: string
  version: string
  dimension: string
  license: string
  copyright: string
  provenance: {
    sourceRepo: string
    sourceCommit: string
    sourceAuthor: string
    provenanceDoc: string
    licenseFile: string
    openSourceStatus: string
    downstreamLicenseCompatibility: string[]
  }
  counts: {
    totalModels: number
    totalAudioTracks: number
    totalSprites: number
    modelCategories: string[]
    audioCategories: string[]
    spriteCategories: string[]
  }
  collections: PackCollection[]
}

/** Catalog entries address files under `runtime/`; the avatar catalog uses
 * pack-relative paths that already include `runtime/`. */
export function runtimeAssetUrl(entry: { relativePath: string }): string {
  return `${PACK_BASE_URL}/runtime/${entry.relativePath}`
}

export function packAssetUrl(packRelativePath: string): string {
  return `${PACK_BASE_URL}/${packRelativePath}`
}

export function formatBytes(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
}

/** Extracts the grid footprint (`building-4x8-…` → `4×8`) encoded in ids. */
export function gridFootprint(id: string): string | null {
  const match = id.match(/(\d+)x(\d+)/)
  return match ? `${match[1]}×${match[2]}` : null
}

/** Collision GLBs ship as separate catalog entries with a `-collision` id
 * suffix, next to their visual counterpart (upstream `Collision/` folders). */
export function isCollisionModel(entry: Pick<PirateNationModelEntry, 'id'>): boolean {
  return entry.id.endsWith('-collision')
}

/** Maps each visual model id to its collision counterpart, for models that
 * ship one (`foo` ↔ `foo-collision`). Orphan collision entries are skipped. */
export function buildCollisionIndex(
  models: PirateNationModelEntry[],
): Map<string, PirateNationModelEntry> {
  const ids = new Set(models.map((entry) => entry.id))
  const index = new Map<string, PirateNationModelEntry>()
  for (const entry of models) {
    if (!isCollisionModel(entry)) continue
    const visualId = entry.id.slice(0, -'-collision'.length)
    if (ids.has(visualId)) index.set(visualId, entry)
  }
  return index
}

const cache = new Map<string, Promise<unknown>>()

function fetchJson<T>(path: string): Promise<T> {
  let pending = cache.get(path)
  if (!pending) {
    pending = fetch(`${PACK_BASE_URL}/${path}`).then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load Pirate Nation catalog "${path}": HTTP ${response.status}`)
      }
      return response.json() as Promise<T>
    })
    cache.set(path, pending)
  }
  return pending as Promise<T>
}

export function loadManifest(): Promise<PackManifest> {
  return fetchJson<PackManifest>('manifest.json')
}

export function loadModels(): Promise<PirateNationModelEntry[]> {
  return fetchJson<PirateNationModelEntry[]>('runtime/models.json')
}

export function loadAudio(): Promise<PirateNationAudioEntry[]> {
  return fetchJson<PirateNationAudioEntry[]>('runtime/audio.json')
}

export function loadSprites(): Promise<PirateNationSpriteEntry[]> {
  return fetchJson<PirateNationSpriteEntry[]>('runtime/sprites.json')
}

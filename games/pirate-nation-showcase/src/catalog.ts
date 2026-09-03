/**
 * Typed access to the Pirate Nation pack catalogs.
 *
 * The app keeps four JSON catalogs under `public/catalog/pirate-nation/`.
 * Binary files are resolved from the pinned RUN asset-library packs. Every
 * entry carries its provenance (source path in the upstream Unity repo,
 * license, copyright), which the showcase surfaces per asset.
 */

import type { AssetReference } from './assetLibrary'

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

export function modelAssetReference(
  entry: Pick<PirateNationModelEntry, 'relativePath'>,
): AssetReference {
  return { pack: 'models', path: entry.relativePath.replace(/^models\//, '') }
}

export function avatarAssetReference(packRelativePath: string): AssetReference {
  return { pack: 'models', path: packRelativePath.replace(/^runtime\/models\//, '') }
}

export function thumbnailAssetReference(
  entry: Pick<PirateNationModelEntry, 'id' | 'relativePath'>,
): AssetReference {
  const modelPath = modelAssetReference(entry).path
  const slash = modelPath.lastIndexOf('/')
  if (slash < 1) throw new Error(`${entry.id}: model path has no category directory`)
  return {
    pack: 'models',
    path: `${modelPath.slice(0, slash)}/Previews/${entry.id}.jpg`,
  }
}

export function spriteAssetReference(
  entry: Pick<PirateNationSpriteEntry, 'relativePath' | 'category'>,
): AssetReference {
  if (entry.category === 'icons') {
    return { pack: 'icons', path: entry.relativePath.replace(/^sprites\/icons\//, '') }
  }
  return {
    pack: 'ui',
    path: entry.relativePath.replace(/^sprites\/(?:ui|branding)\//, ''),
  }
}

export function audioAssetReference(
  entry: Pick<PirateNationAudioEntry, 'relativePath'>,
): AssetReference {
  return {
    pack: 'audio',
    path: entry.relativePath.replace(/^audio\//, '').replace(/\.wav$/i, '.mp3'),
  }
}

export function menuBackgroundAssetReference(): AssetReference {
  return { pack: 'ui', path: 'branding-menu-background.png' }
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
    pending = fetch(`catalog/pirate-nation/${path}`)
      .then((response) => {
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
  return fetchJson<PirateNationModelEntry[]>('models.json')
}

export function loadAudio(): Promise<PirateNationAudioEntry[]> {
  return fetchJson<PirateNationAudioEntry[]>('audio.json')
}

export function loadSprites(): Promise<PirateNationSpriteEntry[]> {
  return fetchJson<PirateNationSpriteEntry[]>('sprites.json')
}

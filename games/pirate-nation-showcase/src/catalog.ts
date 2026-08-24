/**
 * Typed access to the Pirate Nation pack catalogs.
 *
 * The pack ships three JSON catalogs under `public/cdn-assets/pirate-nation/`
 * (`runtime/models.json`, `runtime/audio.json`, `runtime/sprites.json`) plus a
 * top-level `manifest.json`. Every entry carries its provenance (source path
 * in the upstream Unity repo, license, copyright), which the showcase surfaces
 * per asset.
 */

import RundotGameAPI from '@series-inc/rundot-game-sdk/api'

/** Folder inside `public/cdn-assets/` that holds the whole pack. */
export const PACK_CDN_PREFIX = 'pirate-nation'

let runSdkReady = false

/**
 * Records whether `initializeAsync()` succeeded. `main.tsx` calls this once,
 * before anything renders, and nothing else does.
 */
export function setRunSdkReady(ready: boolean): void {
  runSdkReady = ready
}

/**
 * Resolves a pack path to a loadable URL.
 *
 * Inside a RUN host the SDK maps the logical path onto the content-hashed CDN
 * copy. With no host — a plain browser, `vite preview`, any static server —
 * the SDK is never initialized, so we use the same relative path its own mock
 * returns, which serves straight from `public/cdn-assets/`. Once the SDK is
 * live, a resolution failure means a real problem (missing asset, missing
 * entitlement) and propagates to the caller.
 */
export async function resolvePackAssetUrl(cdnPath: string): Promise<string> {
  if (!runSdkReady) return `cdn-assets/${cdnPath}`
  return RundotGameAPI.cdn.resolveAssetUrl(cdnPath)
}

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
export function runtimeAssetPath(entry: { relativePath: string }): string {
  return `${PACK_CDN_PREFIX}/runtime/${entry.relativePath}`
}

export function packAssetPath(packRelativePath: string): string {
  return `${PACK_CDN_PREFIX}/${packRelativePath}`
}

/** Pre-rendered grid thumbnail for a model id (see `npm run thumbnails`). */
export function thumbnailPath(modelId: string): string {
  return `${PACK_CDN_PREFIX}/thumbnails/${modelId}.jpg`
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
    pending = resolvePackAssetUrl(packAssetPath(path))
      .then((url) => fetch(url))
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
  return fetchJson<PirateNationModelEntry[]>('runtime/models.json')
}

export function loadAudio(): Promise<PirateNationAudioEntry[]> {
  return fetchJson<PirateNationAudioEntry[]>('runtime/audio.json')
}

export function loadSprites(): Promise<PirateNationSpriteEntry[]> {
  return fetchJson<PirateNationSpriteEntry[]>('runtime/sprites.json')
}

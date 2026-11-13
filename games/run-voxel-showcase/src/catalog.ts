/**
 * Pack catalogs. Each `catalog/<pack>/catalog.json` is parsed with the shared
 * schema at load time (the boundary); everything downstream trusts the types.
 * `catalog/index.json` lists the packs in this build; any failure throws.
 */
import { z } from 'zod'
import { packCatalogSchema, type PackCatalog, type SpriteEntry, type VoxelModelEntry } from '@rvx/contracts/catalog'
import { PACK_KEYS, type PackKey } from '@rvx/contracts/packs'
import type { AssetRef } from './assetSource'
import { leafId } from './leaves'

export class CatalogError extends Error {
  override name = 'CatalogError'
}

export function parseCatalog(pack: PackKey, json: unknown): PackCatalog {
  const result = packCatalogSchema.safeParse(json)
  if (!result.success) {
    const issue = result.error.issues[0]
    throw new CatalogError(`catalog "${pack}" is invalid at ${issue?.path.join('.') ?? '?'}: ${issue?.message ?? 'unknown'}`)
  }
  if (result.data.pack !== pack) throw new CatalogError(`catalog "${pack}" declares pack "${result.data.pack}"`)
  return result.data
}

const catalogIndexSchema = z.object({ packs: z.array(z.enum(PACK_KEYS)).min(1) })

async function fetchJson(path: string): Promise<unknown> {
  const response = await fetch(path)
  if (!response.ok) throw new CatalogError(`${path}: HTTP ${response.status}`)
  return response.json()
}

let pending: Promise<PackCatalog[]> | undefined

/** Loads the packs listed in `catalog/index.json` (written by the exporter). */
export function loadCatalogs(): Promise<PackCatalog[]> {
  pending ??= fetchJson('catalog/index.json').then(async (json) => {
    const index = catalogIndexSchema.safeParse(json)
    if (!index.success) throw new CatalogError(`catalog/index.json is invalid: ${index.error.issues[0]?.message}`)
    return Promise.all(index.data.packs.map(async (pack) => parseCatalog(pack, await fetchJson(`catalog/${pack}/catalog.json`))))
  })
  return pending
}

export function modelRef(entry: Pick<VoxelModelEntry, 'pack' | 'leaf' | 'relativePath'>): AssetRef {
  return { leafId: leafId(entry.pack, entry.leaf), path: entry.relativePath }
}

/** `<category dir>/Previews/<id>.jpg` next to the model, in its leaf. */
export function previewRef(entry: Pick<VoxelModelEntry, 'id' | 'pack' | 'leaf' | 'relativePath'>): AssetRef {
  const slash = entry.relativePath.lastIndexOf('/')
  if (slash < 1) throw new Error(`${entry.id}: model path has no category directory`)
  return { leafId: leafId(entry.pack, entry.leaf), path: `${entry.relativePath.slice(0, slash)}/Previews/${entry.id}.jpg` }
}

export function spriteRef(entry: SpriteEntry): AssetRef {
  return { leafId: leafId(entry.pack, entry.leaf), path: entry.relativePath }
}

export function isCollision(entry: Pick<VoxelModelEntry, 'id'>): boolean {
  return entry.id.endsWith('-collision')
}

export const PACK_COLORS: Record<PackKey, string> = {
  pirate: 'var(--pirate)',
  fantasy: 'var(--fantasy)',
  space: 'var(--space)',
  monster: 'var(--monster)',
  apocalypse: 'var(--apoc)',
}

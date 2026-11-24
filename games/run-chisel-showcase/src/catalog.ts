import { packCatalogSchema, type PackCatalog } from '@chisel/contracts/catalog'
import { POLY_PACK_KEYS, type PolyLeafKind, type PolyPackKey } from '@chisel/contracts/packs'
import type { AssetRef } from './assetSource'
import { leafId } from './leaves'

export interface PolyCatalogBundle {
  packs: Record<PolyPackKey, PackCatalog>
  ordered: PackCatalog[]
}

let cached: Promise<PolyCatalogBundle> | undefined

export async function loadAllCatalogs(): Promise<PolyCatalogBundle> {
  if (!cached) {
    cached = (async () => {
      const entries = await Promise.all(
        POLY_PACK_KEYS.map(async (pack) => {
          const res = await fetch(`catalog/${pack}/catalog.json`)
          if (!res.ok) throw new Error(`Failed to fetch catalog/${pack}/catalog.json (${res.status})`)
          const parsed = packCatalogSchema.parse(await res.json())
          return [pack, parsed] as const
        }),
      )
      const packs = Object.fromEntries(entries) as Record<PolyPackKey, PackCatalog>
      return { packs, ordered: POLY_PACK_KEYS.map((k) => packs[k]) }
    })().catch((err) => {
      cached = undefined
      throw err
    })
  }
  return cached
}

/** `<relDir>/Previews/<id>.jpg` next to the GLB inside its jam-ready-assets leaf. */
export function previewRef(entry: { id: string; pack: PolyPackKey; leaf: PolyLeafKind; relativePath: string }): AssetRef {
  const slash = entry.relativePath.lastIndexOf('/')
  const path = slash > 0 ? `${entry.relativePath.slice(0, slash)}/Previews/${entry.id}.jpg` : `Previews/${entry.id}.jpg`
  return { leafId: leafId(entry.pack, entry.leaf), path }
}

import { packCatalogSchema, type PackCatalog } from '@poly/contracts/catalog'
import { POLY_PACK_KEYS, type PolyPackKey } from '@poly/contracts/packs'

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

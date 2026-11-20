import { z } from 'zod'
import packsJson from './data/packs.json'

export const POLY_PACK_KEYS = ['core', 'medieval', 'ww2', 'sim', 'cyberpunk', 'monsters'] as const
export type PolyPackKey = (typeof POLY_PACK_KEYS)[number]

export const CONTEXT_PACK_KEYS = ['medieval', 'ww2', 'sim', 'cyberpunk', 'monsters'] as const
export type ContextPackKey = (typeof CONTEXT_PACK_KEYS)[number]

export const LICENSES = ['CC0-1.0', 'LicenseRef-RUN-Repository-Supplemental-1.0'] as const
export type LicenseId = (typeof LICENSES)[number]

const packDefSchema = z.object({
  dir: z.string().regex(/^run-chisel-[a-z0-9-]+$/),
  worldTheme: z.string().regex(/^[a-z0-9-]+$/).optional(),
  label: z.string().min(1),
  description: z.string().min(1),
  hasWorldLeaf: z.boolean(),
  license: z.enum(LICENSES),
})

const packsFileSchema = z.object({
  version: z.literal(1),
  packs: z.object({
    core: packDefSchema,
    medieval: packDefSchema,
    ww2: packDefSchema,
    sim: packDefSchema,
    cyberpunk: packDefSchema,
    monsters: packDefSchema,
  }),
})

const parsed = packsFileSchema.parse(packsJson)
export type PolyPackDef = z.infer<typeof packDefSchema>
export const POLY_PACKS: Readonly<Record<PolyPackKey, PolyPackDef>> = parsed.packs

export type PolyLeafKind = 'characters' | 'world'

export interface PolyLeaf {
  kind: PolyLeafKind
  /** Pack-relative path, e.g. `3D/characters` or `3D/medieval`. */
  path: string
  /** Catalog leaf ID in jam-ready-assets, e.g. `run-chisel-medieval/3D/characters`. */
  id: string
  license: LicenseId
}

export function leavesFor(pack: PolyPackKey): PolyLeaf[] {
  const def = POLY_PACKS[pack]
  const out: PolyLeaf[] = [
    {
      kind: 'characters',
      path: '3D/characters',
      id: `${def.dir}/3D/characters`,
      license: def.license,
    },
  ]
  if (def.hasWorldLeaf) {
    if (!def.worldTheme) throw new Error(`${pack}: hasWorldLeaf requires worldTheme`)
    const path = `3D/${def.worldTheme}`
    out.push({
      kind: 'world',
      path,
      id: `${def.dir}/${path}`,
      license: def.license,
    })
  }
  return out
}

export function leafFor(pack: PolyPackKey, kind: PolyLeafKind): PolyLeaf {
  const found = leavesFor(pack).find((l) => l.kind === kind)
  if (!found) throw new Error(`${pack}: no leaf kind "${kind}"`)
  return found
}

/**
 * The four RUN voxel packs plus Pirate Nation, and the jam-ready-assets leaf
 * each asset kind lands in. Pack data lives in `data/packs.json` so the
 * Blender pipeline reads the same source.
 */
import { z } from 'zod'
import packsJson from './data/packs.json'

export const RVX_PACK_KEYS = ['fantasy', 'space', 'monster', 'apocalypse'] as const
export type RvxPackKey = (typeof RVX_PACK_KEYS)[number]

export const PACK_KEYS = ['pirate', ...RVX_PACK_KEYS] as const
export type PackKey = (typeof PACK_KEYS)[number]

export const LEAF_KINDS = ['world', 'characters', 'icons', 'ui'] as const
export type LeafKind = (typeof LEAF_KINDS)[number]

/**
 * `LicenseRef-RUN-Repository-Supplemental-1.0` is the RUN License (the
 * repository's LICENSE.md); every RUN voxel pack leaf uses it. `MIT` is for
 * the Pirate Nation catalogue, which the showcase shows next to the packs.
 */
export const LICENSES = ['LicenseRef-RUN-Repository-Supplemental-1.0', 'MIT'] as const
export type LicenseId = (typeof LICENSES)[number]
export const RVX_LICENSE = LICENSES[0]

const packSchema = z.object({
  dir: z.string().regex(/^run-voxel-[a-z-]+$/),
  worldTheme: z.string().regex(/^[a-z-]+$/),
  label: z.string().min(1),
  clipRange: z.tuple([z.number().int(), z.number().int()]),
})

const leafSchema = z.object({
  bucket: z.enum(['3D', 'icons', 'ui']),
  theme: z.string().optional(),
  license: z.literal(RVX_LICENSE),
})

const packsFileSchema = z.object({
  version: z.literal(1),
  packs: z.object({
    fantasy: packSchema,
    space: packSchema,
    monster: packSchema,
    apocalypse: packSchema,
  }),
  leaves: z.object({ world: leafSchema, characters: leafSchema, icons: leafSchema, ui: leafSchema }),
})

const parsed = packsFileSchema.parse(packsJson)

export type RvxPack = z.infer<typeof packSchema>
export const RVX_PACKS: Readonly<Record<RvxPackKey, RvxPack>> = parsed.packs

export interface Leaf {
  /** Pack-relative leaf dir, e.g. `3D/fantasy` or `icons`. */
  path: string
  /** Catalog pack id in jam-ready-assets, e.g. `run-voxel-fantasy/3D/fantasy`. */
  id: string
  license: LicenseId
}

export function leafFor(pack: RvxPackKey, kind: LeafKind): Leaf {
  const def = parsed.leaves[kind]
  const theme = def.theme === '@worldTheme' ? RVX_PACKS[pack].worldTheme : def.theme
  const path = def.bucket === '3D' ? `3D/${theme}` : def.bucket
  if (def.bucket === '3D' && !theme) throw new Error(`leaf ${kind}: 3D leaf needs a theme`)
  return { path, id: `${RVX_PACKS[pack].dir}/${path}`, license: def.license }
}

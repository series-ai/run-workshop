import { z } from 'zod'
import packsJson from './data/packs.json'

export const VOXCHAR_PACK_KEYS = ['core', 'heist', 'industrial', 'security', 'creatures', 'fantasy'] as const
export type VoxCharPackKey = (typeof VOXCHAR_PACK_KEYS)[number]
export const CONTEXT_PACK_KEYS = ['heist', 'industrial', 'security', 'creatures', 'fantasy'] as const
export type ContextPackKey = (typeof CONTEXT_PACK_KEYS)[number]
export type VoxCharLeafKind = 'characters' | 'world'

export const LICENSES = ['CC0-1.0', 'LicenseRef-RUN-Repository-Supplemental-1.0'] as const
export type PackLicense = (typeof LICENSES)[number]

const packDefSchema = z.object({
  dir: z.string().regex(/^run-cubix-[a-z0-9-]+$/),
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
    heist: packDefSchema,
    industrial: packDefSchema,
    security: packDefSchema,
    creatures: packDefSchema,
    fantasy: packDefSchema,
  }),
})

export const PACK_DEFS = packsFileSchema.parse(packsJson).packs

export interface VoxCharLeaf {
  kind: VoxCharLeafKind
  path: string
  id: string
  license: PackLicense
}

export function leavesFor(pack: VoxCharPackKey): VoxCharLeaf[] {
  const def = PACK_DEFS[pack]
  const out: VoxCharLeaf[] = [
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

export function leafFor(pack: VoxCharPackKey, kind: VoxCharLeafKind): VoxCharLeaf {
  const found = leavesFor(pack).find((l) => l.kind === kind)
  if (!found) throw new Error(`${pack}: no leaf kind "${kind}"`)
  return found
}

import { z } from 'zod'
import type { LevelPropEntry, PackCatalog } from './catalog'
import { VOXCHAR_PACK_KEYS, type VoxCharPackKey } from './packs'

const position = z.tuple([z.number(), z.number(), z.number()])
const viewpoint = z.object({ eye: position, target: position })
const lightFixture = z.object({
  position,
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  intensity: z.number().positive(),
  distance: z.number().positive(),
})

const layout = z.object({
  title: z.string().min(1),
  route: z.string().min(1),
  view: viewpoint.extend({
    center: z.tuple([z.number(), z.number()]),
    size: z.tuple([z.number().positive(), z.number().positive()]),
    stops: z.array(viewpoint.extend({ label: z.string().min(1) })).optional(),
  }),
  fixtures: z.array(lightFixture).optional(),
  placements: z.array(z.object({
    propId: z.string().min(1),
    position,
    turn: z.number().int().min(0).max(3),
  })).min(1),
})

export const levelKitsSchema = z.record(z.enum(VOXCHAR_PACK_KEYS), layout)
export type LevelKits = z.infer<typeof levelKitsSchema>
type LevelKit = LevelKits[VoxCharPackKey]
type Placement = LevelKit['placements'][number]
export type ResolvedLevelKit = Omit<LevelKit, 'placements'> & {
  placements: (Omit<Placement, 'propId'> & { item: LevelPropEntry })[]
}

export function withLevelProps(catalog: PackCatalog, levelKitProps: LevelPropEntry[]): PackCatalog {
  const ids = [...catalog.props, ...levelKitProps].map((prop) => prop.id)
  if (new Set(ids).size !== ids.length) {
    throw new Error(`${catalog.pack}: duplicate prop ID in the build catalog.`)
  }
  return { ...catalog, levelKitProps }
}

export function resolveLevelKits(kits: LevelKits, catalogs: readonly PackCatalog[]): ReadonlyMap<VoxCharPackKey, ResolvedLevelKit> {
  const resolved = new Map<VoxCharPackKey, ResolvedLevelKit>()
  for (const pack of VOXCHAR_PACK_KEYS) {
    const props = catalogs.find((catalog) => catalog.pack === pack)?.levelKitProps ?? []
    const items = new Map(props.map((prop) => [prop.id, prop]))
    if (items.size < 24) throw new Error(`${pack}: expected at least 24 level props.`)
    const locations = new Set<string>()
    const shown = new Set<string>()
    const placements = kits[pack].placements.map(({ propId, position, turn }) => {
      const item = items.get(propId)
      if (!item) throw new Error(`${pack}: missing level prop ${propId}.`)
      const key = [propId, ...position, turn].join(':')
      if (locations.has(key)) throw new Error(`${pack}: repeated placement ${key}.`)
      locations.add(key)
      shown.add(propId)
      return { item, position, turn }
    })
    for (const id of items.keys()) {
      if (!shown.has(id)) throw new Error(`${pack}: prop ${id} is missing from the demo.`)
    }
    resolved.set(pack, { ...kits[pack], placements })
  }
  return resolved
}

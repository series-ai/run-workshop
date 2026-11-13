/** Check the expanded catalogs against the committed release. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { packCatalogSchema, voxelModelEntrySchema } from '../contracts/catalog'
import { RVX_PACK_KEYS } from '../contracts/packs'
import { RELEASE_COUNTS, RELEASE_WORLD_COUNTS } from '../src/validate/pack'
import { TOOL_ROOT } from '../src/paths'

const baselineSchema = z.object({
  baseCommit: z.string().regex(/^[a-f0-9]{40}$/),
  packs: z.object(Object.fromEntries(RVX_PACK_KEYS.map((pack) => [pack, z.object({
    ids: z.array(z.string()), avatarModels: z.array(voxelModelEntrySchema),
  })]))),
})
const baselineData = baselineSchema.parse(JSON.parse(readFileSync(join(TOOL_ROOT, 'contracts/data/expansion-baseline.json'), 'utf8')))

const bindingTargets = { fantasy: 33, space: 15, monster: 31, apocalypse: 22 } as const
const animatedCategories = new Set(['animated-props', 'creatures', 'vehicles'])
const issues: string[] = []
const report = []
for (const pack of RVX_PACK_KEYS) {
  const file = `games/run-voxel-showcase/public/catalog/${pack}/catalog.json`
  const catalog = packCatalogSchema.parse(JSON.parse(readFileSync(join(TOOL_ROOT, '../..', file), 'utf8')))
  const baseline = baselineData.packs[pack]!
  const oldIds = new Set(baseline.ids)
  const newModels = catalog.models.filter((model) => !oldIds.has(model.id))
  if (catalog.models.length !== RELEASE_COUNTS.modelsMin) issues.push(`${pack}: ${catalog.models.length} models, expected ${RELEASE_COUNTS.modelsMin}`)
  if (newModels.length !== 76 || newModels.some((model) => model.space !== 'world')) issues.push(`${pack}: expected 76 new world models`)
  if (new Set(catalog.models.map((model) => model.id)).size !== catalog.models.length) issues.push(`${pack}: duplicate model ids`)
  for (const [category, expected] of Object.entries(RELEASE_WORLD_COUNTS)) {
    const count = catalog.models.filter((model) => model.category === category).length
    if (count !== expected) issues.push(`${pack}: ${category} has ${count}, expected ${expected}`)
  }
  for (const id of baseline.ids) {
    if (!catalog.models.some((model) => model.id === id)) issues.push(`${pack}: missing original model ${id}`)
  }
  for (const model of baseline.avatarModels) {
    const current = catalog.models.find((entry) => entry.id === model.id)
    if (!current) issues.push(`${pack}: missing original model ${model.id}`)
    else if (model.space === 'avatar' && JSON.stringify(current) !== JSON.stringify(model)) issues.push(`${pack}: original avatar model changed: ${model.id}`)
  }
  for (const model of newModels) {
    if (animatedCategories.has(model.category) && !model.clips.some((clip) => clip !== 'idle')) issues.push(`${model.id}: missing function clip`)
  }
  const bound = newModels.filter((model) => model.pfx.length > 0).length
  if (bound < bindingTargets[pack]) issues.push(`${pack}: ${bound} new models have bindings, expected at least ${bindingTargets[pack]}`)
  report.push({ pack, total: catalog.models.length, added: newModels.length, bound, bindingTarget: bindingTargets[pack] })
}
console.log(JSON.stringify({ report, issues }, null, 2))
if (issues.length > 0) process.exitCode = 1

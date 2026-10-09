import { CHARACTER_ROLES } from '../src/runtime/roles'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { EFFECTS } from '../src/runtime/effects'
import { DISTRICT_PLACEMENTS, CHECKPOINTS, DISTRICT_COLLISION } from '../src/runtime/district'
import { EXTRA_LAYOUTS } from '../src/runtime/layouts'
import { animationPreviewEquipment } from '../src/runtime/presentation'
import type { PackManifest } from '../src/types'

const PACK_VERSION = '1.4.5'
const assets = resolve('public/assets')
const characters = JSON.parse(await readFile(resolve(assets, 'characters.json'), 'utf8')) as Pick<PackManifest, 'models' | 'animations'>
const props = JSON.parse(await readFile(resolve(assets, 'props.json'), 'utf8')) as Pick<PackManifest, 'models'>
const manifest: PackManifest = { version: PACK_VERSION, models: [...characters.models, ...props.models], animations: characters.animations }
if (new Set(manifest.models.map(model => model.id)).size !== manifest.models.length) throw new Error('Duplicate model IDs.')
if (manifest.animations.length !== 85) throw new Error('Expected 85 animation clips, including forward recovery.')
for (const clip of manifest.animations) {
  const equipment = animationPreviewEquipment(clip.id)
  if (equipment && !props.models.some(model => model.id === equipment && model.tags.includes('held'))) throw new Error(`Missing preview tool for ${clip.id}: ${equipment}`)
}
for (const role of CHARACTER_ROLES) {
  if (!characters.models.some(model => model.id === role.id)) throw new Error(`Missing role body: ${role.id}`)
  if (!manifest.animations.some(clip => clip.id === role.preview)) throw new Error(`Missing role clip: ${role.preview}`)
  if (role.equipment && !props.models.some(model => model.id === role.equipment && model.tags.includes('held'))) throw new Error(`Invalid role equipment: ${role.equipment}`)
}
await mkdir(assets, { recursive: true })
await writeFile(resolve(assets, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
await writeFile(resolve(assets, 'effects.json'), JSON.stringify({ version: PACK_VERSION, effects: EFFECTS }, null, 2) + '\n')
await writeFile(resolve(assets, 'industrial-district.json'), JSON.stringify({ version: PACK_VERSION, units: 'meters', up: '+Y', placements: DISTRICT_PLACEMENTS, collision: DISTRICT_COLLISION, checkpoints: CHECKPOINTS }, null, 2) + '\n')
console.log(`Catalog: ${characters.models.length} characters, ${props.models.length} props, ${manifest.animations.length} clips, ${EFFECTS.length} effects.`)

await writeFile(resolve(assets, 'character-roles.json'), JSON.stringify({ version: PACK_VERSION, roles: CHARACTER_ROLES }, null, 2) + '\n')

for (const layout of EXTRA_LAYOUTS) await writeFile(resolve(assets, `${layout.id}.json`), JSON.stringify({ version: PACK_VERSION, units: 'meters', up: '+Y', ...layout }, null, 2) + '\n')
await writeFile(resolve(assets, 'environment-layouts.json'), JSON.stringify({ version: PACK_VERSION, layouts: [{ id: 'district', label: 'Industrial District', file: 'scenes/industrial-district.glb', source: 'source/industrial-district.blend', layout: 'industrial-district.json' }, ...EXTRA_LAYOUTS.map(({ id, label, description }) => ({ id, label, description, file: `scenes/${id}.glb`, source: `source/${id}.blend`, layout: `${id}.json` }))] }, null, 2) + '\n')

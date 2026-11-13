/**
 * Writes each pack's themed UI tiles into the jam stage (`<pack dir>/ui/`),
 * PNGs at ×4 nearest-neighbour. Deterministic.
 *
 * Usage: npm run ui -- --pack fantasy | --all
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { leafFor, RVX_PACK_KEYS, type RvxPackKey } from '../contracts/packs'
import { STAGE_DIR } from '../src/paths'
import { UI_SCALE, uiElements } from '../src/ui/elements'

const all = process.argv.includes('--all')
const i = process.argv.indexOf('--pack')
const packs: RvxPackKey[] = all ? [...RVX_PACK_KEYS] : [process.argv[i + 1] as RvxPackKey]
for (const pack of packs) {
  if (!RVX_PACK_KEYS.includes(pack)) throw new Error('pass --pack <key> or --all')
  const dir = join(STAGE_DIR, leafFor(pack, 'ui').id)
  mkdirSync(dir, { recursive: true })
  const elements = uiElements(pack)
  for (const [name, raster] of elements) writeFileSync(join(dir, name), raster.png(UI_SCALE))
  console.log(`${pack}: ${elements.size} UI tiles → ${dir}`)
}

/**
 * Stages built run-cubix-* packs into a jam-ready-assets checkout, writing
 * verified License.txt files per leaf.
 *
 * Usage: npm run stage -- --target ~/dev/jam-ready-assets [--packs core,heist,industrial,security,creatures]
 */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { leavesFor } from '../contracts/packs'
import { isBoardPack, LEVEL_PACK_KEYS, levelLeafId, type LevelPackKey } from '../contracts/levelPacks'
import { licenseTextFor } from '../src/licenses'
import { STAGE_DIR } from '../src/paths'

function main(): void {
  const t = process.argv.indexOf('--target')
  const target = t === -1 ? '' : resolve(process.argv[t + 1] ?? '')
  if (!target || !existsSync(join(target, 'scripts/build-manifest.mjs'))) {
    throw new Error('--target must point to a jam-ready-assets checkout')
  }
  const p = process.argv.indexOf('--packs')
  const packs = (p === -1 ? [...LEVEL_PACK_KEYS] : (process.argv[p + 1] ?? '').split(',')) as LevelPackKey[]

  for (const pack of packs) {
    if (!LEVEL_PACK_KEYS.includes(pack)) throw new Error(`Unknown pack "${pack}"`)
    const ids = isBoardPack(pack) ? [levelLeafId(pack, 'world')] : leavesFor(pack).map((leaf) => leaf.id)
    for (const id of ids) {
      const srcDir = join(STAGE_DIR, id)
      if (!existsSync(srcDir)) throw new Error(`Pack "${pack}" not built at ${srcDir}. Run npm run build first.`)
    }
  }

  for (const pack of packs) {
    if (isBoardPack(pack)) {
      const id = levelLeafId(pack, 'world')
      cpSync(join(STAGE_DIR, id), join(target, id), { recursive: true })
      console.log(`Staged ${id}`)
      continue
    }
    for (const leaf of leavesFor(pack)) {
      const from = join(STAGE_DIR, leaf.id)
      const dest = join(target, leaf.id)
      rmSync(dest, { recursive: true, force: true })
      mkdirSync(dest, { recursive: true })
      cpSync(from, dest, { recursive: true })
      writeFileSync(join(dest, 'License.txt'), licenseTextFor(pack, leaf.kind))
      console.log(`Staged ${leaf.id} -> ${dest}`)
    }
  }

  console.log('Done. In target checkout, run `node scripts/build-manifest.mjs` and `npm test` to register & verify packs.')
}

main()

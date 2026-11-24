import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildManifestSchema } from '../contracts/catalog'
import { boardKitsSchema, resolveLevelKit, resolveLevelKits, levelKitsSchema } from '../contracts/levelKits'
import { BOARD_PACK_KEYS } from '../contracts/levelPacks'
import { META_DIR, SHOWCASE_CATALOG_DIR } from '../src/paths'

function main(): void {
  const manifestPath = join(META_DIR, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing ${manifestPath}; run npm run build first.`)
  }
  const { packs: catalogs } = buildManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')))
  const levels = levelKitsSchema.parse(JSON.parse(readFileSync(join(META_DIR, 'level-scenes.json'), 'utf8')))
  resolveLevelKits(levels, catalogs)
  const boards = boardKitsSchema.parse(JSON.parse(readFileSync(join(META_DIR, 'board-scenes.json'), 'utf8')))
  for (const key of BOARD_PACK_KEYS) resolveLevelKit(key, boards[key].layout, boards[key].props)
  mkdirSync(SHOWCASE_CATALOG_DIR, { recursive: true })
  const packIndex: { pack: string; label: string; path: string }[] = []

  for (const pack of catalogs) {
    const dir = join(SHOWCASE_CATALOG_DIR, pack.pack)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'catalog.json'), JSON.stringify(pack, null, 2) + '\n')
    packIndex.push({ pack: pack.pack, label: pack.label, path: `${pack.pack}/catalog.json` })
  }

  writeFileSync(
    join(SHOWCASE_CATALOG_DIR, 'index.json'),
    JSON.stringify({ version: 1, packs: packIndex }, null, 2) + '\n',
  )
  writeFileSync(join(SHOWCASE_CATALOG_DIR, 'level-scenes.json'), JSON.stringify(levels) + '\n')
  writeFileSync(join(SHOWCASE_CATALOG_DIR, 'board-scenes.json'), JSON.stringify(boards) + '\n')
  console.log(`Exported ${packIndex.length} pack catalogs to ${SHOWCASE_CATALOG_DIR}`)
}

main()

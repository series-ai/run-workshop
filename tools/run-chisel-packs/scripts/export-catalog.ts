import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildManifestSchema } from '../contracts/catalog'
import { withConstructionKit } from '../src/constructionKitCatalog'
import { META_DIR, SHOWCASE_CATALOG_DIR } from '../src/paths'

function main(): void {
  const manifestPath = join(META_DIR, 'manifest.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing ${manifestPath}; run npm run build first.`)
  }
  const packs = buildManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8'))).packs.map(withConstructionKit)
  mkdirSync(SHOWCASE_CATALOG_DIR, { recursive: true })
  const packIndex: { pack: string; label: string; path: string }[] = []

  for (const pack of packs) {
    const dir = join(SHOWCASE_CATALOG_DIR, pack.pack)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'catalog.json'), JSON.stringify(pack, null, 2) + '\n')
    packIndex.push({ pack: pack.pack, label: pack.label, path: `${pack.pack}/catalog.json` })
  }

  writeFileSync(
    join(SHOWCASE_CATALOG_DIR, 'index.json'),
    JSON.stringify({ version: 1, packs: packIndex }, null, 2) + '\n',
  )
  console.log(`Exported ${packIndex.length} pack catalogs to ${SHOWCASE_CATALOG_DIR}`)
}

main()

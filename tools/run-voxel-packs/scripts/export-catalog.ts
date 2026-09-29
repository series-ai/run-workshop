/**
 * Writes `<out>/<pack>/catalog.json` for Pirate Nation and every staged RUN
 * pack, in the shared schema the showcase parses at load time.
 *
 * Usage: npm run catalog -- [--out <dir>] [--packs fantasy,space] (default out: games/run-voxel-showcase/public/catalog)
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { packCatalogSchema } from '../contracts/catalog'
import { RVX_PACK_KEYS, RVX_PACKS } from '../contracts/packs'
import { pirateAvatar, pirateModels, pirateSprites } from '../src/catalog/pirate'
import { rvxCatalog } from '../src/catalog/rvx'
import { OUT_DIR, pirateModelsDir, STAGE_DIR, TOOL_ROOT } from '../src/paths'

async function main(): Promise<void> {
  const outFlag = process.argv.indexOf('--out')
  const out = resolve(outFlag === -1 ? join(TOOL_ROOT, '../../games/run-voxel-showcase/public/catalog') : process.argv[outFlag + 1]!)
  const write = (pack: string, data: unknown) => {
    mkdirSync(join(out, pack), { recursive: true })
    writeFileSync(join(out, pack, 'catalog.json'), JSON.stringify(data, null, 1) + '\n')
  }

  const written: string[] = []
  const models = pirateModels(pirateModelsDir())
  write('pirate', packCatalogSchema.parse({
    pack: 'pirate',
    label: 'Pirate Nation',
    models,
    avatar: pirateAvatar(),
    sprites: pirateSprites(),
    pfx: { pack: 'pirate', effects: [] },
  }))
  written.push('pirate')
  console.log(`pirate: ${models.length} models`)

  const onlyFlag = process.argv.indexOf('--packs')
  const only = onlyFlag === -1 ? null : new Set(process.argv[onlyFlag + 1]!.split(','))
  for (const pack of RVX_PACK_KEYS) {
    if (only && !only.has(pack)) {
      if (existsSync(join(out, pack, 'catalog.json'))) written.push(pack) // keep the last export
      continue
    }
    if (!existsSync(join(STAGE_DIR, RVX_PACKS[pack].dir))) {
      console.log(`${pack}: not staged, skipped`)
      continue
    }
    const catalog = await rvxCatalog(STAGE_DIR, join(OUT_DIR, 'meta'), pack)
    write(pack, catalog)
    written.push(pack)
    console.log(`${pack}: ${catalog.models.length} models, ${catalog.avatar.parts.length} parts, ${catalog.avatar.clips.length} clips, ${catalog.sprites.length} sprites`)
  }
  // The showcase loads exactly these packs; a static host cannot 404 reliably.
  writeFileSync(join(out, 'index.json'), JSON.stringify({ packs: written }, null, 1) + '\n')
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { packCatalogSchema, levelPropEntrySchema } from '../contracts/catalog'
import { resolveLevelKits, levelKitsSchema, withLevelProps } from '../contracts/levelKits'
import { humanoidSculptPose } from '../contracts/humanoidPose'
import { leafFor, leavesFor, VOXCHAR_PACK_KEYS } from '../contracts/packs'
import { licenseTextFor } from '../src/licenses'
import { META_DIR, SOURCE_RIG_GLB, STAGE_DIR, TOOL_ROOT } from '../src/paths'
import { populateManifestRagdoll } from '../src/resolveManifestRagdoll'

function findBlender(): string {
  if (process.env.BLENDER_BIN) return process.env.BLENDER_BIN
  const macApp = '/Applications/Blender.app/Contents/MacOS/Blender'
  if (existsSync(macApp)) return macApp
  return 'blender'
}

function runBlender(script: string, args: string[]): void {
  const blender = findBlender()
  const cmdArgs = ['--background', '--factory-startup', '--python-exit-code', '1', '--python', script, '--', ...args]
  console.log(`> ${blender} ${cmdArgs.join(' ')}`)
  const res = spawnSync(blender, cmdArgs, { stdio: 'inherit', encoding: 'utf8' })
  if (res.error) throw res.error
  if (res.status !== 0) {
    throw new Error(`Blender exited with status ${res.status} on ${script}`)
  }
}

function main(): void {
  if (!existsSync(SOURCE_RIG_GLB)) {
    throw new Error(`Missing source rig GLB: ${SOURCE_RIG_GLB}`)
  }
  mkdirSync(STAGE_DIR, { recursive: true })
  mkdirSync(META_DIR, { recursive: true })

  for (const pack of VOXCHAR_PACK_KEYS) {
    for (const leaf of leavesFor(pack)) {
      const leafDir = join(STAGE_DIR, leaf.id)
      mkdirSync(leafDir, { recursive: true })
      writeFileSync(join(leafDir, 'License.txt'), licenseTextFor(pack, leaf.kind))
    }
  }

  // The Blender builders sculpt the voxel humans in this pose (see contracts/humanoidPose.ts).
  writeFileSync(join(META_DIR, 'humanoid-pose.json'), JSON.stringify(humanoidSculptPose(), null, 2) + '\n')

  const coreCharacters = join(STAGE_DIR, leafFor('core', 'characters').id)
  const coreRigPath = join(coreCharacters, 'core-rig.glb')
  runBlender(join(TOOL_ROOT, 'blender/build_core.py'), [
    '--source', SOURCE_RIG_GLB,
    '--stage', STAGE_DIR,
    '--meta', META_DIR,
  ])

  runBlender(join(TOOL_ROOT, 'blender/build_heist.py'), [
    '--core', coreRigPath,
    '--stage', STAGE_DIR,
    '--meta', META_DIR,
  ])

  runBlender(join(TOOL_ROOT, 'blender/build_industrial_security.py'), [
    '--core', coreRigPath,
    '--stage', STAGE_DIR,
    '--meta', META_DIR,
  ])

  runBlender(join(TOOL_ROOT, 'blender/build_creatures.py'), [
    '--core', coreRigPath,
    '--stage', STAGE_DIR,
    '--meta', META_DIR,
  ])

  runBlender(join(TOOL_ROOT, 'blender/build_fantasy.py'), [
    '--core', coreRigPath,
    '--stage', STAGE_DIR,
    '--meta', META_DIR,
  ])

  runBlender(join(TOOL_ROOT, 'blender/build_level_props.py'), [
    '--stage', STAGE_DIR,
    '--meta', META_DIR,
  ])

  const levelProps = z.record(z.enum(VOXCHAR_PACK_KEYS), z.array(levelPropEntrySchema))
    .parse(JSON.parse(readFileSync(join(META_DIR, 'level-props.json'), 'utf8')))
  const packMetas = VOXCHAR_PACK_KEYS.map((pack) => {
    const p = join(META_DIR, `${pack}.json`)
    if (!existsSync(p)) throw new Error(`Missing pack metadata file: ${p}`)
    const catalog = packCatalogSchema.parse(JSON.parse(readFileSync(p, 'utf8')))
    return withLevelProps(catalog, levelProps[pack])
  })
  const levels = levelKitsSchema.parse(JSON.parse(readFileSync(join(META_DIR, 'level-scenes.json'), 'utf8')))
  resolveLevelKits(levels, packMetas)
  writeFileSync(join(META_DIR, 'manifest.json'), JSON.stringify({ version: 1, packs: packMetas }, null, 2) + '\n')

  const packs = populateManifestRagdoll(META_DIR)
  const presetCount = packs.reduce((s, p) => s + p.presets.length, 0)
  runBlender(join(TOOL_ROOT, 'blender/pack_level_kits.py'), ['--stage', STAGE_DIR, '--meta', META_DIR])
  for (const oldFolder of ['level-kit', 'vehicles']) {
    rmSync(join(coreCharacters, oldFolder), { recursive: true, force: true })
  }
  console.log(`Build finished cleanly (${presetCount} presets with resolved ragdoll metadata).`)
}

main()

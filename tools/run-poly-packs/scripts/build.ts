import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { leavesFor, POLY_PACK_KEYS } from '../contracts/packs'
import { licenseTextFor } from '../src/licenses'
import { META_DIR, SOURCE_KAYKIT_RANGED_GLB, SOURCE_RIG_GLB, SOURCE_UAL2_GLB, STAGE_DIR, TOOL_ROOT } from '../src/paths'
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
  for (const src of [SOURCE_RIG_GLB, SOURCE_UAL2_GLB, SOURCE_KAYKIT_RANGED_GLB]) {
    if (!existsSync(src)) {
      throw new Error(`Missing source rig GLB: ${src}`)
    }
  }
  rmSync(STAGE_DIR, { recursive: true, force: true })
  mkdirSync(STAGE_DIR, { recursive: true })
  mkdirSync(META_DIR, { recursive: true })

  for (const pack of POLY_PACK_KEYS) {
    for (const leaf of leavesFor(pack)) {
      const leafDir = join(STAGE_DIR, leaf.id)
      mkdirSync(leafDir, { recursive: true })
      writeFileSync(join(leafDir, 'License.txt'), licenseTextFor(pack, leaf.kind))
    }
  }

  runBlender(join(TOOL_ROOT, 'blender/build_core.py'), [
    '--source', SOURCE_RIG_GLB,
    '--ual2', SOURCE_UAL2_GLB,
    '--kaykit-ranged', SOURCE_KAYKIT_RANGED_GLB,
    '--stage', STAGE_DIR,
    '--meta', META_DIR,
  ])

  runBlender(join(TOOL_ROOT, 'blender/build_packs.py'), [
    '--core', join(STAGE_DIR, 'run-poly-core/3D/characters/core-rig.glb'),
    '--stage', STAGE_DIR,
    '--meta', META_DIR,
  ])

  runBlender(join(TOOL_ROOT, 'blender/build_monsters.py'), [
    '--core', join(STAGE_DIR, 'run-poly-core/3D/characters/core-rig.glb'),
    '--stage', STAGE_DIR,
    '--meta', META_DIR,
  ])

  const packs = populateManifestRagdoll(META_DIR)
  const presetCount = packs.reduce((s, p) => s + p.presets.length, 0)
  console.log(`Build finished cleanly (${presetCount} presets with resolved ragdoll metadata).`)
}

main()

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { leavesFor, POLY_PACK_KEYS } from '../contracts/packs'
import { licenseTextFor } from '../src/licenses'
import { META_DIR, SOURCE_RIG_GLB, STAGE_DIR, TOOL_ROOT } from '../src/paths'

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

  for (const pack of POLY_PACK_KEYS) {
    for (const leaf of leavesFor(pack)) {
      const leafDir = join(STAGE_DIR, leaf.id)
      mkdirSync(leafDir, { recursive: true })
      writeFileSync(join(leafDir, 'License.txt'), licenseTextFor(pack, leaf.kind))
    }
  }

  runBlender(join(TOOL_ROOT, 'blender/build_core.py'), [
    '--source', SOURCE_RIG_GLB,
    '--stage', STAGE_DIR,
    '--meta', META_DIR,
  ])

  runBlender(join(TOOL_ROOT, 'blender/build_packs.py'), [
    '--core', join(STAGE_DIR, 'run-poly-core/3D/characters/core-rig.glb'),
    '--stage', STAGE_DIR,
    '--meta', META_DIR,
  ])

  console.log('Build finished cleanly.')
}

main()

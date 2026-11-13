/**
 * Voxelizes the PN avatar bodies into `out/cache/pn-body-ref.npz`, the
 * build-time fitting guide for avatar parts and skins. Never shipped.
 *
 * Usage: npm run body-ref
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { BLENDER_BIN, BODY_REF, PIRATE_AVATAR_GLB, pirateModelsDir, TOOL_ROOT } from '../src/paths'

mkdirSync(dirname(BODY_REF), { recursive: true })
const result = spawnSync(
  BLENDER_BIN,
  ['-b', '--factory-startup', '--python', join(TOOL_ROOT, 'blender/extract_body_ref.py'), '--', join(pirateModelsDir(), PIRATE_AVATAR_GLB), BODY_REF],
  { encoding: 'utf8' },
)
const lines = `${result.stdout}\n${result.stderr}`.split('\n').filter((line) => /^(BODY|WROTE)|Error/.test(line))
console.log(lines.join('\n'))
if (result.status !== 0 || !lines.some((line) => line.startsWith('WROTE'))) process.exit(1)

/**
 * Dev: renders GLBs to a contact sheet PNG with headless Blender for art review.
 *
 * Usage: npm run snapshot -- --out sheet.png [--clip open@0.5] [--size 320] a.glb b.glb …
 */
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { BLENDER_BIN, TOOL_ROOT } from '../src/paths'

const result = spawnSync(BLENDER_BIN, ['-b', '--factory-startup', '--python', join(TOOL_ROOT, 'blender/snapshot.py'), '--', ...process.argv.slice(2)], { encoding: 'utf8' })
const out = `${result.stdout}\n${result.stderr}`
const sheet = out.split('\n').find((line) => line.startsWith('SHEET'))
if (!sheet || result.status !== 0) {
  console.error(out.split('\n').filter((line) => /Error|Traceback|File "/.test(line)).join('\n'))
  process.exit(1)
}
console.log(sheet)

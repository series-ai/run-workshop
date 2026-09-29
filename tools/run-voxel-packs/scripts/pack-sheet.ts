/**
 * Dev review: contact sheet of every built model in one category of a pack
 * (Workbench render, 3/4 front view), optionally mid-clip.
 *
 * Usage: npm run pack-sheet -- --pack monster --category props [--clip open@0.5] [--out sheet.png]
 * Prints `ITEM <i> <file>` for captions; 4 per row.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { CATEGORY_SPECS, isCategory } from '../contracts/categories'
import { leafFor, RVX_PACK_KEYS, type RvxPackKey } from '../contracts/packs'
import { BLENDER_BIN, STAGE_DIR, TOOL_ROOT } from '../src/paths'

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const pack = arg('pack') as RvxPackKey
const category = arg('category') ?? ''
if (!RVX_PACK_KEYS.includes(pack) || !isCategory(category)) throw new Error('--pack <pack> --category <category> are required')
const dir = join(STAGE_DIR, leafFor(pack, CATEGORY_SPECS[category].leaf).id, category)
if (!existsSync(dir)) throw new Error(`nothing built at ${dir}`)
const files = readdirSync(dir).filter((f) => f.endsWith('.glb')).sort()
files.forEach((f, i) => console.log(`ITEM ${i} ${f}`))
const clip = arg('clip')
const out = arg('out', `/tmp/rvx-${pack}-${category}.png`)!
const result = spawnSync(BLENDER_BIN, ['-b', '--factory-startup', '--python', join(TOOL_ROOT, 'blender/snapshot.py'), '--', '--out', out, '--size', '260', ...(clip ? ['--clip', clip] : []), ...files.map((f) => join(dir, f))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
const text = `${result.stdout}\n${result.stderr}`
const sheet = text.split('\n').find((l) => l.startsWith('SHEET'))
if (!sheet || result.status !== 0) {
  console.error(text.split('\n').filter((l) => /Error|Traceback|File "/.test(l)).join('\n'))
  process.exit(1)
}
console.log(sheet)

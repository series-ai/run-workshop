/**
 * Dev review: renders a pack's avatar-space assets on the PN base body.
 *
 * Usage: npm run avatar-sheet -- --pack fantasy --mode parts|skins|held [--out sheet.png]
 * Prints the caption of each cell (row-major, 6 per row).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { leafFor, RVX_PACK_KEYS, type RvxPackKey } from '../contracts/packs'
import { BLENDER_BIN, PIRATE_AVATAR_GLB, pirateModelsDir, STAGE_DIR, TOOL_ROOT } from '../src/paths'

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`)
  const v = i === -1 ? fallback : process.argv[i + 1]
  if (!v) throw new Error(`--${name} is required`)
  return v
}

const pack = arg('pack') as RvxPackKey
if (!RVX_PACK_KEYS.includes(pack)) throw new Error(`unknown pack ${pack}`)
const mode = arg('mode')
const dirs: Record<string, [kind: 'world' | 'characters', category: string]> = {
  parts: ['characters', 'avatar'],
  skins: ['characters', 'characters-skins'],
  held: ['world', 'held-items'],
}
const target = dirs[mode]
if (!target) throw new Error('--mode must be parts, skins or held')
const dir = join(STAGE_DIR, leafFor(pack, target[0]).id, target[1])
if (!existsSync(dir)) throw new Error(`nothing built at ${dir}`)
const files = readdirSync(dir).filter((f) => f.endsWith('.glb')).sort().map((f) => join(dir, f))
const out = arg('out', `/tmp/rvx-${pack}-${mode}.png`)
const result = spawnSync(
  BLENDER_BIN,
  ['-b', '--factory-startup', '--python', join(TOOL_ROOT, 'blender/avatar_sheet.py'), '--', '--pn', join(pirateModelsDir(), PIRATE_AVATAR_GLB), '--mode', mode, '--out', out, '--size', arg('size', '300'), ...files],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)
const lines = `${result.stdout}\n${result.stderr}`.split('\n')
for (const line of lines) if (/^(ITEM|SHEET)|Error|Traceback/.test(line)) console.log(line)
if (result.status !== 0 || !lines.some((l) => l.startsWith('SHEET'))) process.exit(1)

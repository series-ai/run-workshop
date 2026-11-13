/**
 * Dev: renders models side by side at native scale, next to a person gauge,
 * to review relative size. Arguments are RVX asset ids, `pn:<file stem>` for
 * Pirate Nation models, or GLB paths.
 *
 * Usage: npm run lineup -- --out lineup.png [--size 1600] fantasy-buildings-tavern pn:buildings-building-6x6-workshop-lv3 …
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { BLENDER_BIN, pirateModelsDir, STAGE_DIR, TOOL_ROOT } from '../src/paths'

function findGlb(root: string, stem: string): string {
  const stack = [root]
  while (stack.length) {
    const dir = stack.pop()!
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) stack.push(path)
      else if (name === `${stem}.glb`) return path
    }
  }
  throw new Error(`no ${stem}.glb under ${root}`)
}

const args: string[] = []
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i]!
  if (a === '--out' || a === '--size') args.push(a, argv[++i]!)
  else if (a.startsWith('pn:')) args.push(findGlb(pirateModelsDir(), a.slice(3)))
  else if (a.endsWith('.glb') && existsSync(a)) args.push(a)
  else args.push(findGlb(STAGE_DIR, a))
}
const result = spawnSync(BLENDER_BIN, ['-b', '--factory-startup', '--python', join(TOOL_ROOT, 'blender/lineup.py'), '--', ...args], { encoding: 'utf8' })
const out = `${result.stdout}\n${result.stderr}`
const line = out.split('\n').find((l) => l.startsWith('LINEUP'))
if (!line || result.status !== 0) {
  console.error(out.split('\n').filter((l) => /Error|Traceback|File "/.test(l)).join('\n'))
  process.exit(1)
}
console.log(line)

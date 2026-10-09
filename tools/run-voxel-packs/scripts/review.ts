/**
 * Review sheet per asset: four rest views, optional clip frames, and a
 * native-scale lineup with Pirate Nation references of the same class and
 * the person gauge. Look at every sheet before an asset counts as done.
 *
 * Usage:
 *   npm run review -- --pack monster --only haunted-manor [--ref pn:<stem>|<rvx id>] [--clips] [--out-dir /tmp/rvx-review]
 * `--only` matches asset ids by substring (several assets → several sheets).
 * `--clips` adds a frame from the middle of every clip in the file.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { RVX_PACK_KEYS, RVX_PACKS, type RvxPackKey } from '../contracts/packs'
import { BLENDER_BIN, pirateModelsDir, STAGE_DIR, TOOL_ROOT } from '../src/paths'
import { inspectGlb } from '../src/validate/inspect'

/** PN models that show the look and size of each scale class (see docs/art-direction.md). */
export const PN_REFS: Record<string, string[]> = {
  building: ['buildings-building-6x6-workshop-lv3', 'buildings-building-6x8-townhall'],
  tower: ['buildings-bldg-3x3-teslacoil', 'buildings-building-6x6-windmillhaunted'],
  wall: ['decorations-deco-2x6x6-piratearchway01'],
  'vehicle-small': ['ships-item-2x2-pirateskiffundead', 'ships-boat'],
  vehicle: ['ships-boat', 'ships-item-2x2-pirateskiffundead'],
  'vehicle-large': ['ships-ship-pirate-small', 'ships-boat'],
  'creature-boss': ['world-bosses-creature-12x12-giantturtle'],
  'creature-large': ['decorations-deco-2x2-piratestatue-gold', 'decorations-deco-2x2-totemgoblin'],
  humanoid: ['decorations-dec-statue-tiki', 'decorations-deco-2x2-totemgoblin'],
  'creature-small': ['animals-animal-pigeon', 'animals-animal-gull'],
  prop: ['harvestables-chest-common', 'decorations-jackolantern01b'],
  'person-size': ['decorations-dec-statue-tiki', 'decorations-mecha-totem'],
  coffin: ['decorations-decoration-1x2-coffin', 'decorations-decoration-1x1-headstone-c'],
  door: ['decorations-deco-2x6x6-piratearchway01'],
  'vehicle-door': ['decorations-deco-2x6x6-piratearchway01'],
  lamp: ['decorations-lamp', 'decorations-deco-lamp-zombie'],
  'tall-prop': ['props-interactive-item-2x2-wishingwell', 'decorations-deco-hangingcage'],
  fence: ['decorations-deco-fence-segment', 'decorations-deco-1x1x1-fencehaunted'],
  kit: ['decorations-deco-fence-stone-segment', 'decorations-deco-4x4-mausoleum'],
  tile: ['decorations-deco-footpath-zombie'],
  wreck: ['ships-deco-2x2-shipwreckpeices1'],
  tree: ['plants-nature-plant-palmtree-static', 'plants-nature-plant-3x3x3-cherryblossomtree-01', 'decorations-environment-3x3-spookytree'],
  terrain: ['decorations-env-6x3x5-coastalrock03', 'islands-terrain-volcano-short-only'],
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

function args(name: string): string[] {
  return process.argv.flatMap((a, i) => (a === `--${name}` ? [process.argv[i + 1]!] : []))
}

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

function glbsOf(pack: RvxPackKey, only: string): string[] {
  const out: string[] = []
  const stack = [join(STAGE_DIR, RVX_PACKS[pack].dir)]
  while (stack.length) {
    const dir = stack.pop()!
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) stack.push(path)
      else if (name.endsWith('.glb') && name.includes(only)) out.push(path)
    }
  }
  return out.sort()
}

async function main(): Promise<void> {
  const pack = arg('pack') as RvxPackKey | undefined
  const only = arg('only')
  if (!pack || !(RVX_PACK_KEYS as readonly string[]).includes(pack) || !only) throw new Error('pass --pack <pack> --only <id substring>')
  const outDir = arg('out-dir') ?? '/tmp/rvx-review'
  mkdirSync(outDir, { recursive: true })
  const glbs = glbsOf(pack, only)
  if (glbs.length === 0) throw new Error(`no ${pack} GLB matches "${only}"; build it first`)
  for (const glb of glbs) {
    const summary = await inspectGlb(new Uint8Array(readFileSync(glb)))
    const refs = args('ref').length > 0 ? args('ref') : (PN_REFS[summary.scaleClass ?? ''] ?? []).map((s) => `pn:${s}`)
    const refPaths = refs.map((r) => (r.startsWith('pn:') ? findGlb(pirateModelsDir(), r.slice(3)) : findGlb(STAGE_DIR, r)))
    const clips = process.argv.includes('--clips') ? summary.animations.map((a) => `${a.name}@${(a.duration / 2).toFixed(2)}`) : []
    const id = glb.split('/').pop()!.replace('.glb', '')
    const out = join(outDir, `${id}.png`)
    const cli = ['-b', '--factory-startup', '--python', join(TOOL_ROOT, 'blender/review.py'), '--', '--out', out, '--asset', glb, ...refPaths.flatMap((r) => ['--ref', r]), ...clips.flatMap((c) => ['--clip', c])]
    const result = spawnSync(BLENDER_BIN, cli, { encoding: 'utf8' })
    const log = `${result.stdout}\n${result.stderr}`
    if (result.status !== 0 || !log.includes('REVIEW')) {
      console.error(log.split('\n').filter((l) => /Error|Traceback|File "/.test(l)).join('\n'))
      process.exit(1)
    }
    console.log(`${id} [${summary.scaleClass}] → ${out}  (views: front, back, side, top${clips.length ? `, clips: ${clips.join(' ')}` : ''}; last tile: native scale with ${refs.join(', ') || 'no refs'} and the red person gauge)`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

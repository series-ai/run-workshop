/**
 * Builds asset sources into the jam stage layout with headless Blender, then
 * finalizes every GLB. No network access.
 *
 * Usage:
 *   npm run build:pack -- --pack fantasy [--only <substring>] [--jobs <n>]
 *   npm run build:pack -- --all
 */
import { spawn } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { join, relative } from 'node:path'
import { leafFor, RVX_PACK_KEYS, type RvxPackKey } from '../contracts/packs'
import { CATEGORY_SPECS, UNITS_PER_VOXEL, type Category } from '../contracts/categories'
import { rmSync } from 'node:fs'
import { finalizeGlb } from '../src/build/finalize'
import { BLENDER_BIN, BODY_REF, OUT_DIR, PIRATE_AVATAR_GLB, pirateModelsDir, STAGE_DIR, TOOL_ROOT } from '../src/paths'
import { existsSync } from 'node:fs'

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

/** Asset sources: `assets/<pack>/**\/*.py`, skipping `_`-prefixed helpers. */
export function listSources(pack: RvxPackKey): string[] {
  const root = join(TOOL_ROOT, 'assets', pack)
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) {
        if (!name.startsWith('_')) walk(path)
      } else if (name.endsWith('.py') && !name.startsWith('_')) {
        out.push(path)
      }
    }
  }
  try {
    walk(root)
  } catch (error) {
    throw new Error(`no sources for pack ${pack} at ${root}: ${(error as Error).message}`)
  }
  return out
}

function runBlender(jobsFile: string): Promise<{ code: number; built: string[]; log: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(BLENDER_BIN, ['-b', '--factory-startup', '--python', join(TOOL_ROOT, 'blender/build_asset.py'), '--', '--jobs', jobsFile])
    let log = ''
    child.stdout.on('data', (chunk: Buffer) => (log += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (log += chunk.toString()))
    child.on('error', reject)
    child.on('close', (code) => {
      const built = [...log.matchAll(/^BUILT (.+)$/gm)].map((m) => m[1] ?? '')
      resolvePromise({ code: code ?? 1, built, log })
    })
  })
}

async function main(): Promise<void> {
  const packs: RvxPackKey[] = process.argv.includes('--all')
    ? [...RVX_PACK_KEYS]
    : (() => {
        const pack = arg('pack')
        if (!pack || !(RVX_PACK_KEYS as readonly string[]).includes(pack)) throw new Error(`pass --pack <${RVX_PACK_KEYS.join('|')}> or --all`)
        return [pack as RvxPackKey]
      })()
  const only = arg('only')
  const workers = Math.max(1, Number(arg('jobs') ?? Math.min(6, cpus().length)))

  const sources = packs.flatMap(listSources).filter((path) => !only || path.includes(only))
  // A full pack build starts clean, so a removed or renamed source cannot leave
  // a stale GLB behind. `--only` rebuilds in place.
  if (!only) {
    for (const pack of packs) {
      for (const kind of ['world', 'characters'] as const) rmSync(join(STAGE_DIR, leafFor(pack, kind).id), { recursive: true, force: true })
      rmSync(join(OUT_DIR, 'meta', pack), { recursive: true, force: true })
    }
  }
  if (sources.length === 0) throw new Error('no asset sources matched')
  if (!existsSync(BODY_REF)) throw new Error(`${BODY_REF} is missing; run \`npm run body-ref\` first`)
  mkdirSync(OUT_DIR, { recursive: true })

  const chunks: string[][] = Array.from({ length: Math.min(workers, sources.length) }, () => [])
  sources.forEach((source, i) => chunks[i % chunks.length]!.push(source))
  const results = await Promise.all(
    chunks.map((chunk, i) => {
      const jobsFile = join(OUT_DIR, `jobs-${process.pid}-${i}.json`)
      writeFileSync(jobsFile, JSON.stringify({ stage: STAGE_DIR, meta: join(OUT_DIR, 'meta'), rig: { pirateAvatar: join(pirateModelsDir(), PIRATE_AVATAR_GLB) }, sources: chunk }))
      return runBlender(jobsFile).finally(() => rmSync(jobsFile, { force: true }))
    }),
  )

  let failed = false
  for (const result of results) {
    if (result.code !== 0) {
      failed = true
      process.stderr.write(result.log.split('\n').filter((line) => /FAILED|Error|Traceback|^\s+File|^\w+Error/.test(line)).join('\n') + '\n')
    }
  }
  const built = results.flatMap((result) => result.built)
  const seen = new Set<string>()
  const duplicates = built.filter((id) => (seen.has(id) ? true : (seen.add(id), false)))
  if (duplicates.length > 0) {
    console.error(`duplicate asset ids (two sources wrote the same file): ${[...new Set(duplicates)].join(', ')}`)
    failed = true
  }
  for (const id of built) {
    const pack = id.split('-')[0] as RvxPackKey
    const glb = findGlb(pack, id)
    const meta = JSON.parse(readFileSync(join(OUT_DIR, 'meta', pack, `${id}.json`), 'utf8')) as { scale?: string | null; category: Category }
    const space = CATEGORY_SPECS[meta.category].space
    // Avatar part and skin files hold many parts that overlap by design; only
    // world assets and held items get their fighting parts inset.
    const insetUnit = space === 'world' ? UNITS_PER_VOXEL.world : meta.category === 'held-items' ? UNITS_PER_VOXEL.avatar : undefined
    await finalizeGlb(glb, { scale: meta.scale ?? undefined, quantize: space === 'world', insetUnit })
  }
  if (!only) {
    // Every scale-classes.json entry must name a built asset, so the table cannot rot.
    for (const pack of packs) {
      const table = JSON.parse(readFileSync(join(TOOL_ROOT, 'assets', pack, 'scale-classes.json'), 'utf8')) as Record<string, string>
      const stale = Object.keys(table).filter((id) => !built.includes(id))
      if (stale.length > 0) {
        console.error(`assets/${pack}/scale-classes.json lists ids no source built: ${stale.join(', ')}`)
        failed = true
      }
    }
  }
  console.log(`built ${built.length} asset(s) from ${sources.length} source(s) into ${relative(process.cwd(), STAGE_DIR)}`)
  if (!only) console.log(`a full build removes the model previews: run \`npm run thumbnails -- --pack <pack>\` in games/run-voxel-showcase before you view or stage it`)
  if (failed) process.exit(1)
}

function findGlb(pack: RvxPackKey, id: string): string {
  const stack = [STAGE_DIR]
  while (stack.length) {
    const dir = stack.pop()!
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) stack.push(path)
      else if (name === `${id}.glb`) return path
    }
  }
  throw new Error(`built asset ${id} (${pack}) has no GLB in ${STAGE_DIR}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

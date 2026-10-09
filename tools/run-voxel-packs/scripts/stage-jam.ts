/**
 * Stages built packs into a jam-ready-assets checkout: replaces
 * `<target>/<pack dir>` with the jam stage copy, writes one licence file per
 * leaf, and for each leaf renders a preview grid into the (gitignored)
 * `.preview-sources/` and upserts its `derived` selection in
 * `preview-sources.json`. Then run, in the target:
 *   npm ci && npm run previews:generate    (writes each leaf's preview.webp)
 *
 * Usage: npm run stage -- --target ~/dev/jam-ready-assets-rvx [--packs fantasy,space]
 *
 * Needs ImageMagick (`magick`) for the preview grids; fails loudly without it.
 * Refuses a target that is not a jam-ready-assets checkout.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { LEAF_KINDS, leafFor, RVX_PACK_KEYS, RVX_PACKS, type RvxPackKey } from '../contracts/packs'
import { STAGE_DIR } from '../src/paths'
import { runText, SOURCE } from '../src/stage/licenses'

function images(dir: string, ext: RegExp): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (ext.test(name) && name !== 'preview.png') out.push(p)
    }
  }
  walk(dir)
  return out
}

/** 4-column grid of up to 16 images (ImageMagick, no fonts needed). */
function montage(files: string[], out: string, background: string): void {
  if (files.length === 0) throw new Error(`no images to preview for ${out}`)
  const pick = files.filter((_, i) => i % Math.max(1, Math.floor(files.length / 16)) === 0).slice(0, 16)
  const rows: string[][] = []
  for (let i = 0; i < pick.length; i += 4) rows.push(pick.slice(i, i + 4))
  const args = ['-background', background]
  for (const row of rows) args.push('(', ...row, '-resize', '256x256', '-gravity', 'center', '-extent', '264x264', '+append', ')')
  args.push('-gravity', 'west', '-append', out)
  const result = spawnSync('magick', args, { encoding: 'utf8' })
  if (result.error || result.status !== 0) throw new Error(`magick failed for ${out}: ${result.error?.message ?? result.stderr}`)
}

function main(): void {
  const t = process.argv.indexOf('--target')
  const target = t === -1 ? '' : resolve(process.argv[t + 1] ?? '')
  if (!target || !existsSync(join(target, 'scripts/build-manifest.mjs'))) throw new Error('--target must be a jam-ready-assets checkout')
  const p = process.argv.indexOf('--packs')
  const packs = (p === -1 ? [...RVX_PACK_KEYS] : process.argv[p + 1]!.split(',')) as RvxPackKey[]
  const selectionsFile = join(target, 'preview-sources.json')
  const selections = JSON.parse(readFileSync(selectionsFile, 'utf8')) as { schemaVersion: number; packs: Record<string, Record<string, unknown>> }
  // Check every pack before touching the target, so a missing step cannot
  // leave a pack half replaced.
  for (const pack of packs) {
    if (!RVX_PACK_KEYS.includes(pack)) throw new Error(`unknown pack ${pack}`)
    const from = join(STAGE_DIR, RVX_PACKS[pack].dir)
    if (!existsSync(from)) throw new Error(`${pack} is not built: ${from}`)
    for (const kind of ['world', 'characters'] as const) {
      const leafDir = join(STAGE_DIR, leafFor(pack, kind).id)
      const glbs = images(leafDir, /\.glb$/).length
      const previews = images(leafDir, /\.jpg$/).length
      // Not every GLB has a preview (the avatar clip file has none), but a
      // full build removes them all.
      if (glbs === 0 || previews === 0) {
        throw new Error(`${pack} ${kind}: ${previews} previews for ${glbs} models; run \`npm run thumbnails -- --pack ${pack}\` in games/run-voxel-showcase first`)
      }
    }
  }
  for (const pack of packs) {
    const dir = RVX_PACKS[pack].dir
    const from = join(STAGE_DIR, dir)
    rmSync(join(target, dir), { recursive: true, force: true })
    cpSync(from, join(target, dir), { recursive: true })
    for (const kind of LEAF_KINDS) {
      const leafDir = join(target, leafFor(pack, kind).id)
      if (!existsSync(leafDir)) throw new Error(`${pack}: leaf ${kind} is missing at ${leafDir}`)
      const leaf = leafFor(pack, kind)
      writeFileSync(join(leafDir, 'License.txt'), runText(RVX_PACKS[pack].label, kind))
      const previews = kind === 'world' || kind === 'characters' ? images(leafDir, /\.jpg$/) : images(leafDir, /\.png$/)
      const sourcePath = `.preview-sources/${leaf.id.replace(/\//g, '--')}.png`
      mkdirSync(join(target, '.preview-sources'), { recursive: true })
      montage(previews, join(target, sourcePath), kind === 'ui' || kind === 'icons' ? '#2a3140' : '#10141c')
      const sha = createHash('sha256').update(readFileSync(join(target, sourcePath))).digest('hex')
      const previous = selections.packs[leaf.id] ?? {}
      selections.packs[leaf.id] = {
        ...previous,
        kind: 'derived',
        licenseEvidence: `${leaf.id}/License.txt`,
        sourceUrl: SOURCE,
        sourcePath,
        sourceSha256: sha,
        description: 'Contact sheet of assets included in this pack, rendered by the pack build tool.',
      }
    }
    console.log(`${pack}: staged ${dir} with licences and preview sources`)
  }
  writeFileSync(selectionsFile, JSON.stringify(selections, null, 2) + '\n')
  console.log('next, in the target: npm ci && npm run previews:generate')
}

main()

/**
 * Stages built run-chisel-* packs into a jam-ready-assets checkout:
 * - Verifies all leaves are built and have Previews/*.jpg rendered
 * - Replaces `<target>/<pack dir>` cleanly and writes verified License.txt per leaf
 * - Renders a square (2x2 / 3x3 / 4x4) `scripts/preview-inputs/<leaf>.png` montage with ImageMagick (`magick`)
 * - Upserts each leaf's `derived` entry + `gallery` list in `<target>/preview-sources.json`
 * - If `sharp` is installed in `<target>`, also writes `<leaf>/preview.webp` and exact
 *   derivative metadata matching `scripts/generate-previews.mjs`
 *
 * Next, inside `<target>`:
 *   SKIP_PUBLISHED_CHECK=1 node scripts/build-manifest.mjs && npm test && npm run previews:check
 * Then in tools/run-chisel-packs:
 *   npm run sync-pins -- --target <target>
 *
 * Usage: npm run stage -- --target ~/dev/jam-ready-assets [--packs core,medieval,ww2,sim,cyberpunk,monsters]
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative, resolve } from 'node:path'
import { buildManifestSchema } from '../contracts/catalog'
import { leavesFor, POLY_PACK_KEYS, POLY_PACKS, type PolyPackKey } from '../contracts/packs'
import { licenseTextFor, SOURCE } from '../src/licenses'
import { META_DIR, STAGE_DIR } from '../src/paths'
import { assertStagedProps } from '../src/propColors'

const PREVIEW_MAX_BYTES = 100 * 1024
const PREVIEW_MAX_DIMENSION = 512
const GALLERY_MAX_BYTES = 1024 * 1024
const GALLERY_MAX_IMAGES = 6

function collectFiles(dir: string, ext: RegExp): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (ext.test(name) && name !== 'preview.png') out.push(p)
    }
  }
  if (existsSync(dir)) walk(dir)
  return out
}

function pickEvenly<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items
  const out: T[] = []
  for (let i = 0; i < count; i++) {
    const item = items[Math.floor((i * items.length) / count)]
    if (item !== undefined) out.push(item)
  }
  return out
}

function checkMagick(): string {
  for (const bin of ['/opt/homebrew/bin/magick', 'magick']) {
    const res = spawnSync(bin, ['-version'], { encoding: 'utf8' })
    if (!res.error && res.status === 0) return bin
  }
  throw new Error('ImageMagick (`magick`) is required to compose scripts/preview-inputs montages. Install via `brew install imagemagick`.')
}

interface SharpInstance {
  rotate: () => SharpInstance
  resize: (w: number, h: number, opts: { fit: string; withoutEnlargement: boolean }) => SharpInstance
  webp: (opts: { quality: number; effort: number }) => SharpInstance
  toBuffer: (opts: { resolveWithObject: true }) => Promise<{ data: Buffer; info: { width: number; height: number } }>
}

interface SharpModule {
  (input: Buffer, opts: { page: number; pages: number; limitInputPixels: number }): SharpInstance
  versions: { sharp: string; webp: string }
}

function tryLoadTargetSharp(target: string): SharpModule | null {
  try {
    const req = createRequire(join(target, 'package.json'))
    return req('sharp') as SharpModule
  } catch {
    return null
  }
}

/** Square grid (1x1, 2x2, 3x3, or 4x4) of rendered JPEG previews using ImageMagick. */
function composeMontage(magickBin: string, files: string[], out: string): void {
  if (files.length === 0) throw new Error(`No preview JPEGs available for ${out}`)
  const side = files.length >= 16 ? 4 : files.length >= 9 ? 3 : files.length >= 4 ? 2 : 1
  const pick = pickEvenly(files, side * side)
  const rows: string[][] = []
  for (let i = 0; i < pick.length; i += side) rows.push(pick.slice(i, i + side))
  const args = ['-background', '#10141c']
  for (const row of rows) {
    args.push('(', ...row, '-resize', '256x256', '-gravity', 'center', '-extent', '264x264', '+append', ')')
  }
  args.push('-gravity', 'west', '-append', out)
  const res = spawnSync(magickBin, args, { encoding: 'utf8' })
  if (res.error || res.status !== 0) {
    throw new Error(`magick montage failed for ${out}: ${res.error?.message ?? res.stderr}`)
  }
}

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')

async function renderLeafWebp(
  sharp: SharpModule,
  montageBytes: Buffer,
  sourceSha256: string,
  outPath: string,
): Promise<{
  outputSha256: string
  outputSourceSha256: string
  width: number
  height: number
  bytes: number
  recipe: string
}> {
  const recipe = `sharp-${sharp.versions.sharp}-webp-${sharp.versions.webp}-512-fit-inside-q85-75-65-v1-frame0`
  let result: { data: Buffer; info: { width: number; height: number } } | undefined
  for (const quality of [85, 75, 65]) {
    result = await sharp(montageBytes, { page: 0, pages: 1, limitInputPixels: 100_000_000 })
      .rotate()
      .resize(PREVIEW_MAX_DIMENSION, PREVIEW_MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toBuffer({ resolveWithObject: true })
    if (result.data.length <= PREVIEW_MAX_BYTES) break
  }
  if (!result || result.data.length > PREVIEW_MAX_BYTES) {
    throw new Error(`${outPath}: generated preview.webp exceeds ${PREVIEW_MAX_BYTES} bytes`)
  }
  writeFileSync(outPath, result.data)
  return {
    outputSha256: sha256(result.data),
    outputSourceSha256: sourceSha256,
    width: result.info.width,
    height: result.info.height,
    bytes: result.data.length,
    recipe,
  }
}

async function main(): Promise<void> {
  const t = process.argv.indexOf('--target')
  const target = t === -1 ? '' : resolve(process.argv[t + 1] ?? '')
  if (!target || !existsSync(join(target, 'scripts/build-manifest.mjs'))) {
    throw new Error('--target must point to a jam-ready-assets checkout')
  }
  const selectionsFile = join(target, 'preview-sources.json')
  if (!existsSync(selectionsFile)) {
    throw new Error(`Missing ${selectionsFile} in target checkout`)
  }
  const selections = JSON.parse(readFileSync(selectionsFile, 'utf8')) as {
    schemaVersion: number
    packs: Record<string, Record<string, unknown>>
  }

  const p = process.argv.indexOf('--packs')
  const packs = (p === -1 ? [...POLY_PACK_KEYS] : (process.argv[p + 1] ?? '').split(',')) as PolyPackKey[]
  const magickBin = checkMagick()
  const sharp = tryLoadTargetSharp(target)
  const manifestPath = join(META_DIR, 'manifest.json')
  if (!existsSync(manifestPath)) throw new Error('Run npm run build before staging packs.')
  const manifest = buildManifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf8')))

  // Pre-flight check before modifying target so nothing is half-staged.
  for (const pack of packs) {
    if (!POLY_PACK_KEYS.includes(pack)) throw new Error(`Unknown pack "${pack}"`)
    const catalog = manifest.packs.find((entry) => entry.pack === pack)
    if (!catalog) throw new Error(`Pack "${pack}" is missing from the build manifest. Run npm run build.`)
    const srcDir = join(STAGE_DIR, POLY_PACKS[pack].dir)
    if (!existsSync(srcDir)) throw new Error(`Pack "${pack}" not built at ${srcDir}; run \`npm run build\` first`)
    for (const leaf of leavesFor(pack)) {
      const leafStage = join(STAGE_DIR, leaf.id)
      const glbs = collectFiles(leafStage, /\.glb$/).length
      const previews = collectFiles(leafStage, /\.jpe?g$/i).length
      if (glbs === 0) throw new Error(`${leaf.id}: no GLBs found under ${leafStage}`)
      if (previews === 0) {
        throw new Error(
          `${leaf.id}: 0 thumbnails for ${glbs} GLBs; run \`npm run thumbnails -- --all\` in games/run-chisel-showcase first`,
        )
      }
    }
    assertStagedProps(catalog, STAGE_DIR)
  }

  mkdirSync(join(target, 'scripts/preview-inputs'), { recursive: true })

  for (const pack of packs) {
    const dir = POLY_PACKS[pack].dir
    const from = join(STAGE_DIR, dir)
    const dest = join(target, dir)
    rmSync(dest, { recursive: true, force: true })
    mkdirSync(dest, { recursive: true })
    cpSync(from, dest, { recursive: true })

    for (const leaf of leavesFor(pack)) {
      const leafDest = join(target, leaf.id)
      writeFileSync(join(leafDest, 'License.txt'), licenseTextFor(pack, leaf.kind))
      const previews = collectFiles(leafDest, /\.jpe?g$/i)
      const sourcePath = `scripts/preview-inputs/${leaf.id.replace(/\//g, '--')}.png`
      const absMontage = join(target, sourcePath)
      composeMontage(magickBin, previews, absMontage)
      const montageBytes = readFileSync(absMontage)
      const sha = sha256(montageBytes)
      const derivative = sharp
        ? await renderLeafWebp(sharp, montageBytes, sha, join(leafDest, 'preview.webp'))
        : {}
      const eligibleGallery = previews
        .filter((p) => statSync(p).size <= GALLERY_MAX_BYTES)
        .map((p) => relative(leafDest, p).replaceAll('\\', '/'))
      const gallery = eligibleGallery.length >= 2 ? pickEvenly(eligibleGallery, GALLERY_MAX_IMAGES) : undefined
      const previous = selections.packs[leaf.id] ?? {}
      selections.packs[leaf.id] = {
        ...previous,
        kind: 'derived',
        licenseEvidence: `${leaf.id}/License.txt`,
        sourceUrl: SOURCE,
        sourcePath,
        sourceSha256: sha,
        description: 'Square preview grid of RUN Chisel assets included in this pack, rendered by the showcase thumbnail pipeline.',
        ...(gallery ? { gallery } : {}),
        ...derivative,
      }
    }
    console.log(
      `Staged ${dir} -> ${dest} (${leavesFor(pack).length} leaf preview source(s)${sharp ? ' + preview.webp' : ''})`,
    )
  }

  writeFileSync(selectionsFile, JSON.stringify(selections, null, 2) + '\n')
  console.log('Done. Next in target checkout:')
  console.log(`  ${sharp ? '' : 'npm run previews:generate && '}SKIP_PUBLISHED_CHECK=1 node scripts/build-manifest.mjs && npm test && npm run previews:check`)
  console.log('Then sync pins:')
  console.log(`  npm run sync-pins -- --target ${target}`)
}

await main()

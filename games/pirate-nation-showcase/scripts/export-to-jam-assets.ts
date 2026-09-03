/**
 * Stages the Pirate Nation pack into the directory shapes `jam-ready-assets`
 * CI accepts, so RUN.studio can list and import it.
 *
 * Four packs, not one: `build-manifest.mjs` decides a pack's category from its
 * bucket dir, and only ships `.glb` for a 3D pack. Models, sprites and audio in
 * one bucket would silently drop the sprites and the audio.
 *
 * Post-reorg layout (jam-ready-assets PR #8, a423ddd4): packs are top-level and
 * buckets sit inside them — `<pack>/2D|3D/<theme>/` for themed content, and
 * `<pack>/ui|icons|fonts|audio/` flat. One pack dir spanning several buckets is
 * one catalog pack per leaf, which is why these four share a `destDir` root.
 *
 * Usage:
 *   node --import tsx scripts/export-to-jam-assets.ts --source <dir> --out <dir>
 *     [--verified-by "Name"] [--verified-on YYYY-MM-DD]
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SHOWCASE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export type JamCategory = '3d' | 'ui' | 'audio'

export interface JamPack {
  slug: string
  destDir: string
  category: JamCategory
  /** Source dirs under the pack root, copied flat-preserving into the pack. */
  sources: string[]
  /**
   * Files the sources must hold, in total. A source tree that exists but has
   * lost a file would otherwise export "successfully" one asset short.
   */
  expectedFiles: number
  /** Number of visual model thumbnails to place in this pack. */
  expectedThumbnailFiles?: number
  /** Exact output counts for a pack whose file layout is part of the contract. */
  expectedRuntimeFiles?: number
  expectedTotalFiles?: number
  /** Thumbnail id promoted to the pack's `preview.png`. Must exist. */
  previewModelId: string
}

/**
 * Slugs are globally unique across the whole library (`slugOwner` in
 * build-manifest.mjs calls `fatal()` on a collision, because studio imports
 * write to `assets/<slug>/`), and each is prefixed with the creator key so
 * `creatorOf()` resolves it to "Proof of Play".
 *
 * These must match what build-manifest.mjs derives, since a pack spanning
 * several buckets is slugged `<packDir>-<bucket>`. That is why the 3D pack is
 * `-3d` and not `-models`.
 */
export const JAM_PACKS: JamPack[] = [
  {
    slug: 'proofofplay-pirate-nation-3d',
    destDir: 'proofofplay-pirate-nation/3D/pirate',
    category: '3d',
    sources: ['runtime/models'],
    expectedFiles: 375,
    expectedThumbnailFiles: 355,
    expectedRuntimeFiles: 730,
    expectedTotalFiles: 733,
    previewModelId: 'ships-ship-pirate-xl',
  },
  {
    slug: 'proofofplay-pirate-nation-icons',
    destDir: 'proofofplay-pirate-nation/icons',
    category: 'ui',
    sources: ['runtime/sprites/icons'],
    expectedFiles: 151,
    previewModelId: 'ships-ship-pirate-xl',
  },
  {
    slug: 'proofofplay-pirate-nation-ui',
    destDir: 'proofofplay-pirate-nation/ui',
    category: 'ui',
    sources: ['runtime/sprites/ui', 'runtime/sprites/branding'],
    expectedFiles: 362,
    previewModelId: 'buildings-building-6x8-townhall-01',
  },
  {
    slug: 'proofofplay-pirate-nation-audio',
    destDir: 'proofofplay-pirate-nation/audio',
    category: 'audio',
    sources: ['runtime/audio'],
    expectedFiles: 30,
    previewModelId: 'world-bosses-creature-16x16-kraken',
  },
]

/** Mirrors `underGlbDir()` in jam-ready-assets/scripts/build-manifest.mjs. */
function underGlbDir(relPath: string, glbDirs: Set<string>): boolean {
  const parts = relPath.split('/')
  parts.pop()
  while (true) {
    if (glbDirs.has(parts.join('/'))) return true
    if (parts.length === 0) return false
    parts.pop()
  }
}

/** Mirrors `isRuntime()` in jam-ready-assets/scripts/build-manifest.mjs. */
function isRuntimeExt(
  category: JamCategory,
  file: string,
  packHasCompressedAudio: boolean,
  glbDirs: Set<string>,
): boolean {
  const ext = extname(file).toLowerCase()
  if (category === '3d') {
    if (ext === '.glb') return true
    return ['.png', '.jpg'].includes(ext) && underGlbDir(file, glbDirs)
  }
  if (category === 'audio') {
    if (ext === '.ogg' || ext === '.mp3') return true
    return ext === '.wav' && !packHasCompressedAudio
  }
  return ['.png', '.svg', '.gif', '.ttf', '.otf', '.woff', '.woff2', '.fnt', '.xml', '.json'].includes(ext)
}

export function runtimeFileCount(
  category: JamCategory,
  files: string[],
): number {
  const exts = files.map((file) => extname(file).toLowerCase())
  const compressed = exts.includes('.ogg') || exts.includes('.mp3')
  const glbDirs = new Set(
    files
      .filter((file) => extname(file).toLowerCase() === '.glb')
      .map((file) => (file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '')),
  )
  return files.filter((file) => isRuntimeExt(category, file, compressed, glbDirs)).length
}

/**
 * `inspectLicenseText()` reads the body as authority and treats the SPDX line
 * as corroboration, so the header must agree with the MIT text below it.
 */
export function licenseText(
  verifiedOn: string,
  verifiedBy: string | undefined,
  mitBody: string,
): string {
  return [
    'SPDX-License-Identifier: MIT',
    'Source: https://github.com/proofofplay/piratenation-game',
    `Verified-by: ${verifiedBy ?? 'run-workshop maintainers'}, ${verifiedOn}`,
    '',
    mitBody,
    '',
  ].join('\n')
}

function listFiles(absDir: string, rel = ''): { rel: string; abs: string }[] {
  const out: { rel: string; abs: string }[] = []
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const abs = join(absDir, entry.name)
    const next = rel ? `${rel}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...listFiles(abs, next))
    else out.push({ rel: next, abs })
  }
  return out
}

interface ModelCatalogEntry {
  id: string
  relativePath: string
}

function readModelCatalog(sourceRoot: string): ModelCatalogEntry[] {
  const value: unknown = JSON.parse(readFileSync(join(sourceRoot, 'runtime/models.json'), 'utf8'))
  if (!Array.isArray(value)) throw new Error('runtime/models.json must contain an array')

  return value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`runtime/models.json entry ${index} is not an object`)
    }
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' || typeof record.relativePath !== 'string') {
      throw new Error(`runtime/models.json entry ${index} has no id and relativePath`)
    }
    return { id: record.id, relativePath: record.relativePath }
  })
}

function copyModelThumbnails(
  sourceRoot: string,
  stageRoot: string,
  expectedThumbnailFiles: number,
  written: string[],
): void {
  const visualEntries = readModelCatalog(sourceRoot).filter((entry) => !entry.id.endsWith('-collision'))
  if (visualEntries.length !== expectedThumbnailFiles) {
    throw new Error(
      `model thumbnails: expected ${expectedThumbnailFiles} visual models, found ${visualEntries.length}`,
    )
  }

  const destinations = new Set<string>()
  for (const entry of visualEntries) {
    const modelPath = entry.relativePath.replace(/^models\//, '')
    const slash = modelPath.lastIndexOf('/')
    if (slash < 1) throw new Error(`${entry.id}: model path has no category directory`)
    if (modelPath.includes('..')) throw new Error(`${entry.id}: model path contains ..`)

    const thumbnail = join(sourceRoot, 'thumbnails', `${entry.id}.jpg`)
    if (!existsSync(thumbnail)) throw new Error(`${entry.id}: missing thumbnail ${thumbnail}`)

    const destinationRel = join(
      modelPath.slice(0, slash),
      'Previews',
      `${entry.id}.jpg`,
    )
    if (destinations.has(destinationRel)) {
      throw new Error(`${entry.id}: duplicate thumbnail destination ${destinationRel}`)
    }
    destinations.add(destinationRel)

    const destination = join(stageRoot, destinationRel)
    mkdirSync(dirname(destination), { recursive: true })
    copyFileSync(thumbnail, destination)
    written.push(destinationRel)
  }
}

/**
 * Audio ships as one format. The pack mixes 8 mp3 with 22 wav, and
 * `isRuntime()` drops `.wav` whenever a pack also holds `.mp3` — as one pack
 * that silently loses every music track. mp3 (not ogg) because this ffmpeg
 * build has libmp3lame but not libvorbis.
 */
function copyAudio(source: { rel: string; abs: string }, destRoot: string): string {
  const ext = extname(source.rel).toLowerCase()
  const rel = ext === '.wav' ? `${source.rel.slice(0, -4)}.mp3` : source.rel
  const dest = join(destRoot, rel)
  mkdirSync(dirname(dest), { recursive: true })
  if (ext === '.wav') {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', source.abs, '-c:a', 'libmp3lame', '-q:a', '2', dest])
    if (!existsSync(dest)) throw new Error(`transcode produced no output: ${source.rel}`)
  } else {
    copyFileSync(source.abs, dest)
  }
  return rel
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function requiredArg(name: string): string {
  const index = process.argv.indexOf(name)
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} <value> is required`)
  return value
}

function optionalArg(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} <value> is required when used`)
  return value
}

function main(): void {
  const sourceRoot = requiredArg('--source')
  const out = requiredArg('--out')
  const verifiedBy = optionalArg('--verified-by')
  const verifiedOn = optionalArg('--verified-on') ?? today()

  const provenance = readFileSync(join(sourceRoot, 'PROVENANCE.md'), 'utf8')
  const mitBody = readFileSync(join(sourceRoot, 'LICENSE'), 'utf8').trimEnd()
  const license = licenseText(verifiedOn, verifiedBy, mitBody)

  // Every pack is built under `.staging/` and only moved into place once all of
  // its checks pass, so a failed transcode cannot leave a half-written pack
  // that a later `cp -R` would happily publish.
  const staging = join(out, '.staging')
  rmSync(staging, { recursive: true, force: true })

  try {
    for (const pack of JAM_PACKS) {
      const stageRoot = join(staging, pack.slug)
      mkdirSync(stageRoot, { recursive: true })

      const written: string[] = []
      let sourceCount = 0
      for (const source of pack.sources) {
        const absSource = join(sourceRoot, source)
        if (!existsSync(absSource)) throw new Error(`${pack.slug}: missing source tree ${source}`)
        for (const file of listFiles(absSource)) {
          sourceCount += 1
          if (pack.category === 'audio') {
            written.push(copyAudio(file, stageRoot))
            continue
          }
          const dest = join(stageRoot, file.rel)
          mkdirSync(dirname(dest), { recursive: true })
          copyFileSync(file.abs, dest)
          written.push(file.rel)
        }
      }

      // An existing-but-incomplete source tree is the failure this catches: without
      // it, one deleted GLB exports "successfully" 374 models deep.
      if (sourceCount !== pack.expectedFiles) {
        throw new Error(
          `${pack.slug}: expected ${pack.expectedFiles} source files, found ${sourceCount}`,
        )
      }

      if (pack.expectedThumbnailFiles !== undefined) {
        copyModelThumbnails(sourceRoot, stageRoot, pack.expectedThumbnailFiles, written)
      }

      const preview = join(sourceRoot, 'thumbnails', `${pack.previewModelId}.jpg`)
      if (!existsSync(preview)) throw new Error(`${pack.slug}: missing preview thumbnail ${preview}`)
      // findPreview() prefers preview.png by name; the bytes stay JPEG, which every
      // consumer sniffs correctly and the mirror serves as image/png only in header.
      copyFileSync(preview, join(stageRoot, 'preview.png'))
      writeFileSync(join(stageRoot, 'License.txt'), license)
      writeFileSync(join(stageRoot, 'PROVENANCE.md'), provenance)
      written.push('preview.png', 'License.txt', 'PROVENANCE.md')

      const runtime = runtimeFileCount(pack.category, written)
      if (pack.expectedRuntimeFiles !== undefined && runtime !== pack.expectedRuntimeFiles) {
        throw new Error(
          `${pack.slug}: expected ${pack.expectedRuntimeFiles} runtime files, found ${runtime}`,
        )
      }
      if (pack.expectedTotalFiles !== undefined && written.length !== pack.expectedTotalFiles) {
        throw new Error(
          `${pack.slug}: expected ${pack.expectedTotalFiles} total files, found ${written.length}`,
        )
      }

      // Replace, never merge: a stale file left from an earlier layout would
      // otherwise survive and ship.
      const destRoot = join(out, pack.destDir)
      rmSync(destRoot, { recursive: true, force: true })
      mkdirSync(dirname(destRoot), { recursive: true })
      renameSync(stageRoot, destRoot)

      console.log(`${pack.destDir}: ${written.length} files, ${runtime} runtime`)
    }
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
  console.log(`\nexported ${JAM_PACKS.length} packs to ${out}`)
}

if (process.argv[1] && process.argv[1].endsWith('export-to-jam-assets.ts')) main()

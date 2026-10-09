// Link the committed jam-ready-assets pack (run-inkline) into public/assets.
//
// The pack is the byte source of truth for every generated asset. This script
// verifies the pack against its inventory checksums, mirrors the mapped files
// into public/assets, and reconstructs the five path-rewritten app catalogs.
// It leaves a marker so repeated dev/test runs are no-ops until the pack or
// this script changes.
//
// Location of the pack, in order:
//   1. INKLINE_PACK_DIR environment variable
//   2. <repo>/../jam-ready-assets/run-inkline  (sibling checkout)
//   3. <repo>/../../jam-ready-assets/run-inkline (from a games/ worktree)
//
// If the pack is missing the script stops with an error explaining how to
// install it. Nothing in public/assets is committed to this repository.

import { readFile, writeFile, mkdir, copyFile, rm, stat, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { CATALOG_RECONSTRUCTIONS, COMMITTED_CATALOG_CHECKS, packPathToApp, reconstructCatalog, forwardCatalog } from './pack-layout'

const here = dirname(fileURLToPath(import.meta.url))
const appRoot = resolve(here, '..')
const assetsDir = resolve(appRoot, 'public/assets')
const markerPath = resolve(assetsDir, '.pack-link.json')

async function sha256(path: string): Promise<string> {
  const bytes = await readFile(path)
  return createHash('sha256').update(bytes).digest('hex')
}

async function findPackDir(): Promise<string> {
  // A run-workshop worktree shares .git with the primary clone, so the
  // sibling jam-ready-assets checkout next to the primary clone is found via
  // the git common dir. Plain clones resolve through the repo root.
  const candidates: string[] = []
  if (process.env.INKLINE_PACK_DIR) candidates.push(process.env.INKLINE_PACK_DIR)
  try {
    const commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: appRoot, encoding: 'utf8' }).trim()
    candidates.push(resolve(appRoot, commonDir, '../../jam-ready-assets/run-inkline'))
  } catch { /* not a git checkout; fall through */ }
  const repoRoot = resolve(appRoot, '../..')
  candidates.push(resolve(repoRoot, '../jam-ready-assets/run-inkline'))
  const unique = [...new Set(candidates)]
  for (const candidate of unique) {
    if (existsSync(resolve(candidate, '3D/characters/Source/inventory-checksums.json'))) return candidate
  }
  const tried = unique.map((value) => `  ${value}`).join('\n')
  throw new Error(
    `INKLINE pack not found. The showcase loads its generated assets from the committed\n` +
    `jam-ready-assets pack; public/assets is not part of this repository.\n\n` +
    `Install it next to the run-workshop checkout (or point INKLINE_PACK_DIR at it):\n\n` +
    `  git clone https://github.com/series-ai/jam-ready-assets.git\n\n` +
    `Searched:\n${tried}\n`
  )
}

async function walk(root: string): Promise<string[]> {
  const out: string[] = []
  const queue = [root]
  while (queue.length) {
    const dir = queue.shift()!
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) queue.push(path)
      else out.push(path)
    }
  }
  return out
}

async function main(): Promise<void> {
  const packDir = await findPackDir()
  const inventoryPath = resolve(packDir, '3D/characters/Source/inventory-checksums.json')
  const inventorySha = await sha256(inventoryPath)

  if (!process.env.INKLINE_FORCE_LINK && existsSync(markerPath)) {
    try {
      const marker = JSON.parse(await readFile(markerPath, 'utf8')) as { inventorySHA256: string }
      if (marker.inventorySHA256 === inventorySha) {
        console.log(`Pack already linked (${packDir}).`)
        return
      }
    } catch { /* relink below */ }
  }

  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8')) as {
    files: Record<string, { bytes: number; sha256: string }>
  }

  // Verify the whole pack against its recorded checksums first. The pack is
  // the verified artifact; any mismatch is a hard stop.
  const packFiles = await walk(packDir)
  const packRel = new Set(packFiles.map((path) => path.slice(packDir.length + 1)))
  const missing = Object.keys(inventory.files).filter((name) => !packRel.has(name))
  if (missing.length) {
    throw new Error(`Pack is missing ${missing.length} inventoried files (for example ${missing[0]}).`)
  }
  const mismatches: string[] = []
  for (const file of packFiles) {
    const rel = file.slice(packDir.length + 1)
    if (rel === '3D/characters/Source/inventory-checksums.json') continue
    const expected = inventory.files[rel]
    if (!expected) continue
    if (await sha256(file) !== expected.sha256) mismatches.push(rel)
  }
  if (mismatches.length) {
    throw new Error(`Pack files differ from the verified inventory (for example ${mismatches[0]}). Re-clone or restore the pack.`)
  }

  // Mirror the mapped bytes into a fresh public/assets. The two committed
  // app catalogs (characters.json, props.json) are preserved: they are the
  // authored metadata the pack copies are derived from.
  const committedBytes = new Map<string, string>()
  for (const check of COMMITTED_CATALOG_CHECKS) {
    committedBytes.set(check.app, await readFile(resolve(assetsDir, check.app), 'utf8'))
  }
  await rm(assetsDir, { recursive: true, force: true })
  await mkdir(assetsDir, { recursive: true })
  for (const [app, text] of committedBytes) {
    await writeFile(resolve(assetsDir, app), text)
  }

  const reconstructSources = new Map(CATALOG_RECONSTRUCTIONS.map((entry) => [entry.pack, entry]))
  let copied = 0
  for (const [rel, entry] of Object.entries(inventory.files)) {
    const app = packPathToApp(rel)
    if (!app) continue
    const recon = reconstructSources.get(rel)
    if (recon) continue // handled after the byte copies
    const target = resolve(assetsDir, app)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(resolve(packDir, rel), target)
    const bytes = (await stat(target)).size
    if (bytes !== entry.bytes) throw new Error(`Linked size mismatch for ${app}.`)
    copied += 1
  }

  // Rebuild the path-rewritten catalogs from the pack sources.
  for (const recon of CATALOG_RECONSTRUCTIONS) {
    const packJson = JSON.parse(await readFile(resolve(packDir, recon.pack), 'utf8'))
    const text = reconstructCatalog(recon.transform, packJson)
    const target = resolve(assetsDir, recon.app)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, text)
  }

  // The committed app catalogs must produce the pack copies exactly through
  // the exporter transform. This proves the app metadata and the verified
  // pack describe the same assets.
  for (const check of COMMITTED_CATALOG_CHECKS) {
    const appJson = JSON.parse(await readFile(resolve(assetsDir, check.app), 'utf8'))
    const rendered = forwardCatalog(check.transform, appJson)
    const packBytes = await readFile(resolve(packDir, check.pack), 'utf8')
    if (rendered !== packBytes) {
      throw new Error(
        `${check.app} does not match the pack copy ${check.pack} through the exporter transform. ` +
        `Regenerate the pack (npm run assets:export) or restore the committed catalog.`
      )
    }
  }

  await writeFile(markerPath, `${JSON.stringify({ packDir, inventorySHA256: inventorySha, linkedAt: new Date().toISOString() }, null, 2)}\n`)
  console.log(`Linked ${copied} pack files and ${CATALOG_RECONSTRUCTIONS.length} catalogs into public/assets (${packDir}).`)
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})

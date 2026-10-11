// Copy regenerated previews, effect sheets, runtime sources, and docs into the
// linked jam-ready-assets pack, then rewrite its checksum inventory.
//
// Use this after `scripts/render-previews.ts` when the full exporter cannot run
// (it needs the raw QA receipts, which are not committed). Only the file groups
// below are written. Everything else in the pack stays byte-identical.
//
//   node --import tsx scripts/sync-pack.ts [--dry-run]
//   INKLINE_FORCE_LINK=1 npm run pack:link   # verifies the updated pack

import { readFile, writeFile, copyFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packPathToApp } from './pack-layout'

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = process.argv.includes('--dry-run')
const INVENTORY = '3D/characters/Source/inventory-checksums.json'

interface Inventory { pack: string; generatedAt: string; totalFiles: number; totalBytes: number; files: Record<string, { bytes: number; sha256: string }> }

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')

/** Map a pack path to the app source that owns it, for the synced groups only. */
async function syncSources(packDir: string, inventory: Inventory): Promise<Map<string, string>> {
  const sources = new Map<string, string>()
  for (const rel of Object.keys(inventory.files)) {
    const app = packPathToApp(rel)
    if (app && (/^previews\/[^/]+\.png$/.test(app) || /^effects\/([^/]+\.png|atlas\.json)$/.test(app))) sources.set(rel, resolve(appRoot, 'public/assets', app))
  }
  const runtimeDir = '3D/characters/Source/runtime'
  const runtimeFiles = new Set((await readdir(resolve(packDir, runtimeDir))).concat('palette.ts'))
  for (const name of runtimeFiles) sources.set(`${runtimeDir}/${name}`, resolve(appRoot, 'src/runtime', name))
  sources.set('3D/characters/Source/types.ts', resolve(appRoot, 'src/types.ts'))
  for (const name of await readdir(resolve(packDir, '3D/characters/Source/docs'))) {
    if (name.endsWith('.md')) sources.set(`3D/characters/Source/docs/${name}`, resolve(appRoot, 'docs', name))
  }
  for (const [rel, source] of sources) if (!existsSync(source)) throw new Error(`Sync source is missing for ${rel}: ${source}`)
  return sources
}

const marker = JSON.parse(await readFile(resolve(appRoot, 'public/assets/.pack-link.json'), 'utf8')) as { packDir: string }
const packDir = process.env.INKLINE_PACK_DIR ?? marker.packDir
const inventory = JSON.parse(await readFile(resolve(packDir, INVENTORY), 'utf8')) as Inventory
const changed: string[] = [], added: string[] = []
for (const [rel, source] of await syncSources(packDir, inventory)) {
  const bytes = await readFile(source), digest = sha256(bytes)
  const previous = inventory.files[rel]
  if (previous?.sha256 === digest) continue
  ;(previous ? changed : added).push(rel)
  inventory.files[rel] = { bytes: bytes.length, sha256: digest }
  if (!dryRun) await copyFile(source, resolve(packDir, rel))
}
inventory.files = Object.fromEntries(Object.entries(inventory.files).sort(([a], [b]) => a.localeCompare(b)))
inventory.totalFiles = Object.keys(inventory.files).length + 1
inventory.totalBytes = Object.values(inventory.files).reduce((sum, file) => sum + file.bytes, 0)
inventory.generatedAt = new Date().toISOString()
if (!dryRun && (changed.length || added.length)) await writeFile(resolve(packDir, INVENTORY), `${JSON.stringify(inventory, null, 2)}\n`)
console.log(`${dryRun ? 'Would update' : 'Updated'} ${changed.length} and ${dryRun ? 'would add' : 'added'} ${added.length} pack files in ${packDir}.`)
for (const rel of added) console.log(`  + ${rel}`)

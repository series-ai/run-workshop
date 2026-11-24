/**
 * Reads `<target>/manifest/v2/index.json` in a jam-ready-assets checkout and updates
 * `games/run-chisel-showcase/src/pins.ts` with the published version hash for every
 * `run-chisel-*` leaf so `npm run build` (pinned production mode) passes.
 *
 * Usage:
 *   npm run sync-pins -- --target ~/dev/jam-ready-assets [--partial]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { leavesFor, POLY_PACK_KEYS } from '../contracts/packs'
import { REPO_ROOT } from '../src/paths'

interface ManifestV2Index {
  schemaVersion: number
  commit?: string
  packs: Array<{ id: string; version: string }>
}

function main(): void {
  const t = process.argv.indexOf('--target')
  const target = t === -1 ? '' : resolve(process.argv[t + 1] ?? '')
  if (!target || !existsSync(join(target, 'manifest/v2/index.json'))) {
    throw new Error('--target must point to a jam-ready-assets checkout with manifest/v2/index.json (run `node scripts/build-manifest.mjs` first)')
  }
  const partial = process.argv.includes('--partial')
  const index = JSON.parse(readFileSync(join(target, 'manifest/v2/index.json'), 'utf8')) as ManifestV2Index
  const byId = new Map(index.packs.map((p) => [p.id, p.version]))

  const expectedLeaves = POLY_PACK_KEYS.flatMap((k) => leavesFor(k).map((l) => l.id))
  const entries: [string, string][] = []
  const missing: string[] = []
  for (const id of expectedLeaves) {
    const version = byId.get(id)
    if (!version) missing.push(id)
    else entries.push([id, version])
  }

  if (missing.length > 0 && !partial) {
    throw new Error(`Missing leaves in ${target}/manifest/v2/index.json: ${missing.join(', ')}. Stage & build manifest first, or pass --partial.`)
  }

  const outPath = join(REPO_ROOT, 'games/run-chisel-showcase/src/pins.ts')
  const lines = [
    '/**',
    ' * Published jam-ready-assets pack versions per leaf ID.',
    ` * Generated via \`npm run sync-pins\` (manifest commit: ${index.commit ?? 'unknown'}).`,
    ' */',
    'export const PINS: Readonly<Record<string, string>> = {',
    ...entries.map(([id, v]) => `  '${id}': '${v}',`),
    '}',
    '',
  ]
  writeFileSync(outPath, lines.join('\n'))
  console.log(`Wrote ${entries.length} leaf pins to ${outPath}`)
}

main()

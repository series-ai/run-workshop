#!/usr/bin/env node
/**
 * Renders a 512x512 JPEG preview (`Previews/<id>.jpg`) for every part, held item,
 * and world prop of staged RUN Chisel packs into tools/run-chisel-packs/out/jam-stage/.
 *
 * Usage:
 *   npm run thumbnails -- --all [--force]
 *   npm run thumbnails -- --pack medieval [--force]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { createServer } from 'vite'
import { packCatalogSchema } from '../../../tools/run-chisel-packs/contracts/catalog'
import { leafFor, POLY_PACK_KEYS, type PolyLeafKind, type PolyPackKey } from '../../../tools/run-chisel-packs/contracts/packs'

const require = createRequire(import.meta.url)

function findPlaywright() {
  for (const candidate of [
    'playwright',
    resolve(dirname(process.execPath), '../lib/node_modules/@playwright/cli/node_modules/playwright'),
    '/Users/pany/.local/share/mise/installs/node/24.19.0/lib/node_modules/@playwright/cli/node_modules/playwright',
  ]) {
    try {
      return require(candidate)
    } catch {
      // try next
    }
  }
  throw new Error('Playwright not found. Install playwright or @playwright/cli.')
}

const ROOT = resolve(import.meta.dirname, '..')
const STAGE = process.env.VITE_POLY_STAGE_DIR ?? resolve(ROOT, '../../tools/run-chisel-packs/out/jam-stage')
const PORT = Number(process.env.CHISEL_THUMB_PORT ?? 5195)

function previewFile(pack: PolyPackKey, leaf: PolyLeafKind, relativePath: string, id: string): string {
  const slash = relativePath.lastIndexOf('/')
  const relDir = slash > 0 ? relativePath.slice(0, slash) : ''
  return join(STAGE, leafFor(pack, leaf).id, relDir, 'Previews', `${id}.jpg`)
}

async function main(): Promise<void> {
  const all = process.argv.includes('--all')
  const packFlag = process.argv.indexOf('--pack')
  const packArg = packFlag >= 0 ? (process.argv[packFlag + 1] as PolyPackKey | undefined) : undefined
  if (!all && (!packArg || !(POLY_PACK_KEYS as readonly string[]).includes(packArg))) {
    throw new Error(`Pass --all or --pack <${POLY_PACK_KEYS.join('|')}>`)
  }
  const force = process.argv.includes('--force')
  const packs = all ? [...POLY_PACK_KEYS] : [packArg!]

  const jobs: { pack: PolyPackKey; kind: 'part' | 'held' | 'prop'; id: string; file: string }[] = []
  for (const pack of packs) {
    const catalog = packCatalogSchema.parse(
      JSON.parse(readFileSync(join(ROOT, 'public/catalog', pack, 'catalog.json'), 'utf8')),
    )
    for (const p of catalog.parts) {
      jobs.push({ pack, kind: 'part', id: p.id, file: previewFile(pack, p.leaf, p.relativePath, p.id) })
    }
    for (const h of catalog.heldItems) {
      jobs.push({ pack, kind: 'held', id: h.id, file: previewFile(pack, h.leaf, h.relativePath, h.id) })
    }
    for (const pr of catalog.props) {
      jobs.push({ pack, kind: 'prop', id: pr.id, file: previewFile(pack, pr.leaf, pr.relativePath, pr.id) })
    }
  }

  const pending = jobs.filter((j) => force || !existsSync(j.file))
  console.log(`Thumbnails (${packs.join(', ')}): ${jobs.length} total, ${pending.length} to render`)
  if (pending.length === 0) return

  const server = await createServer({ root: ROOT, mode: 'development', server: { port: PORT, strictPort: true } })
  await server.listen()
  const { chromium } = findPlaywright()
  const chromeBin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  const browser = await chromium.launch({
    headless: true,
    executablePath: existsSync(chromeBin) ? chromeBin : undefined,
    args: ['--use-gl=angle', existsSync(chromeBin) ? '--use-angle=metal' : '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
  })
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } })
  const failures: string[] = []

  try {
    for (const job of pending) {
      try {
        await page.goto(`http://localhost:${PORT}/thumb.html?kind=${job.kind}&id=${encodeURIComponent(job.id)}`)
        await page.waitForFunction(() => window.__thumbReady === true || typeof window.__thumbError === 'string', undefined, {
          timeout: 30_000,
        })
        await page.waitForTimeout(160)
        const error = await page.evaluate(() => window.__thumbError)
        if (error) throw new Error(error)
        mkdirSync(dirname(job.file), { recursive: true })
        const buf = await page.locator('#thumb-root').screenshot({ type: 'jpeg', quality: 90 })
        writeFileSync(job.file, buf)
      } catch (err) {
        failures.push(`${job.kind}:${job.id}: ${(err as Error).message}`)
      }
    }
  } finally {
    await browser.close()
    await server.close()
  }

  console.log(`Rendered ${pending.length - failures.length} / ${pending.length} thumbnails`)
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAILED ${f}`)
    process.exit(1)
  }
}

await main()

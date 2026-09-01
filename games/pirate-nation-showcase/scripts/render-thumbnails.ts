/**
 * Renders one grid thumbnail per catalogued model.
 *
 * Starts a Vite dev server, drives the `thumb.html` route with headless
 * Chromium, and writes a 320x320 JPEG per model to the caller-selected output
 * directory. Existing thumbnails are skipped unless `--force` is passed.
 * Every failure is reported by model id and the process exits non-zero if any
 * model failed.
 *
 * Usage:
 *   node --import tsx scripts/render-thumbnails.ts --out <dir> [--force] [--limit N]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const SHOWCASE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CATALOG = join(SHOWCASE_ROOT, 'public/catalog/pirate-nation/models.json')
const SIZE = 512
const PORT = 5191
const READY_TIMEOUT_MS = 30_000

interface ModelEntry {
  id: string
  relativePath: string
}

function isCollisionModel(id: string): boolean {
  return id.endsWith('-collision')
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force')
  const outFlag = process.argv.indexOf('--out')
  const outputArg = outFlag === -1 ? undefined : process.argv[outFlag + 1]
  if (!outputArg || outputArg.startsWith('--')) throw new Error('--out <dir> is required')
  const output = resolve(outputArg)
  const limitFlag = process.argv.indexOf('--limit')
  const limit = limitFlag === -1 ? Infinity : Number(process.argv[limitFlag + 1])

  const models = (
    JSON.parse(readFileSync(CATALOG, 'utf8')) as ModelEntry[]
  ).filter((model) => !isCollisionModel(model.id))

  mkdirSync(output, { recursive: true })
  const pending = models
    .filter((model) => force || !existsSync(join(output, `${model.id}.jpg`)))
    .slice(0, limit)

  console.log(`${models.length} visual models, ${pending.length} to render`)
  if (pending.length === 0) return

  const server = await createServer({
    root: SHOWCASE_ROOT,
    server: { port: PORT, strictPort: true },
  })
  await server.listen()
  const base = `http://localhost:${PORT}`

  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } })
  const failures: { id: string; reason: string }[] = []

  try {
    for (const [index, model] of pending.entries()) {
      try {
        await page.goto(`${base}/thumb.html?model=${encodeURIComponent(model.id)}`)
        await page.waitForFunction(
          () => window.__thumbReady === true || typeof window.__thumbError === 'string',
          undefined,
          { timeout: READY_TIMEOUT_MS },
        )
        const renderError = await page.evaluate(() => window.__thumbError)
        if (renderError) throw new Error(renderError)

        const shot = await page.locator('#thumb-root').screenshot({ type: 'jpeg', quality: 92 })
        writeFileSync(join(output, `${model.id}.jpg`), shot)
      } catch (error) {
        failures.push({ id: model.id, reason: (error as Error).message })
      }
      if ((index + 1) % 25 === 0) console.log(`  ${index + 1}/${pending.length}`)
    }
  } finally {
    await browser.close()
    await server.close()
  }

  console.log(`rendered ${pending.length - failures.length} of ${pending.length}`)
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAILED ${failure.id}: ${failure.reason}`)
    throw new Error(`${failures.length} model(s) failed to render`)
  }
}

await main()

/**
 * Renders a 512×512 JPEG preview for every model of a staged RUN pack into
 * the jam stage, next to the model: `<leaf>/<category>/Previews/<id>.jpg`
 * (the Pirate Nation layout). PN ships its own previews and is never rendered.
 *
 * With `--icons`, renders 256×256 transparent, outlined icons of the
 * props, animated props, held items, creatures and vehicles into the pack's
 * `icons/` leaf as `icon-<model id>.png` instead.
 *
 * Usage: npm run thumbnails -- --pack fantasy [--force] [--icons]
 * Set RVX_THUMB_PORT to use a separate local port for concurrent pack renders.
 * Every failure is named; the process exits non-zero if any model failed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { packCatalogSchema } from '../../../tools/run-voxel-packs/contracts/catalog'
import { leafFor, RVX_PACK_KEYS, type RvxPackKey } from '../../../tools/run-voxel-packs/contracts/packs'

const ROOT = resolve(import.meta.dirname, '..')
const STAGE = process.env.VITE_RVX_STAGE_DIR ?? resolve(ROOT, '../../tools/run-voxel-packs/out/jam-stage')
const PORT = Number(process.env.RVX_THUMB_PORT ?? 5193)

async function main(): Promise<void> {
  const packFlag = process.argv.indexOf('--pack')
  const pack = process.argv[packFlag + 1] as RvxPackKey | undefined
  if (packFlag === -1 || !pack || !(RVX_PACK_KEYS as readonly string[]).includes(pack)) throw new Error(`--pack <${RVX_PACK_KEYS.join('|')}> is required`)
  const force = process.argv.includes('--force')
  const catalog = packCatalogSchema.parse(JSON.parse(readFileSync(join(ROOT, 'public/catalog', pack, 'catalog.json'), 'utf8')))
  const icons = process.argv.includes('--icons')
  const ICON_CATEGORIES = new Set(['props', 'animated-props', 'held-items', 'creatures', 'vehicles'])
  const jobs = catalog.models
    .filter((m) => !icons || ICON_CATEGORIES.has(m.category))
    .map((m) => ({
      id: m.id,
      file: icons ? join(STAGE, leafFor(pack, 'icons').id, `icon-${m.id}.png`) : join(STAGE, leafFor(pack, m.leaf).id, dirname(m.relativePath), 'Previews', `${m.id}.jpg`),
    }))
  const pending = jobs.filter((j) => force || !existsSync(j.file))
  console.log(`${pack}: ${jobs.length} models, ${pending.length} to render`)
  if (pending.length === 0) return

  const server = await createServer({ root: ROOT, mode: 'development', server: { port: PORT, strictPort: true } })
  await server.listen()
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } })
  const failures: string[] = []
  try {
    for (const job of pending) {
      try {
        await page.goto(`http://localhost:${PORT}/thumb.html?model=${encodeURIComponent(job.id)}${icons ? '&icon=1' : ''}`)
        await page.waitForFunction(() => window.__thumbReady === true || typeof window.__thumbError === 'string', undefined, { timeout: 30_000 })
        // Contract errors surface a frame after load; check again before saving.
        await page.waitForTimeout(250)
        const error = await page.evaluate(() => window.__thumbError)
        if (error) throw new Error(error)
        mkdirSync(dirname(job.file), { recursive: true })
        const root = page.locator('#thumb-root')
        writeFileSync(job.file, icons ? await iconPng(await root.screenshot({ type: 'png', omitBackground: true })) : await root.screenshot({ type: 'jpeg', quality: 92 }))
      } catch (error) {
        failures.push(`${job.id}: ${(error as Error).message}`)
      }
    }
  } finally {
    await browser.close()
    await server.close()
  }
  console.log(`rendered ${pending.length - failures.length} of ${pending.length}`)
  if (failures.length > 0) {
    for (const f of failures) console.error(`FAILED ${f}`)
    process.exit(1)
  }
}

/** 512 → 256 icon with the same alpha (Chromium screenshot is 512 CSS px at DPR 1). */
async function iconPng(png: Buffer): Promise<Buffer> {
  const { PNG } = await import('pngjs')
  const src = PNG.sync.read(png)
  const out = new PNG({ width: src.width / 2, height: src.height / 2 })
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const acc = [0, 0, 0, 0]
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        const o = ((y * 2 + dy) * src.width + x * 2 + dx) * 4
        const a = src.data[o + 3]!
        acc[0]! += src.data[o]! * a
        acc[1]! += src.data[o + 1]! * a
        acc[2]! += src.data[o + 2]! * a
        acc[3]! += a
      }
      const o = (y * out.width + x) * 4
      const a = acc[3]!
      out.data[o] = a ? Math.round(acc[0]! / a) : 0
      out.data[o + 1] = a ? Math.round(acc[1]! / a) : 0
      out.data[o + 2] = a ? Math.round(acc[2]! / a) : 0
      out.data[o + 3] = Math.round(a / 4)
    }
  }
  return PNG.sync.write(out)
}

await main()

/**
 * Automated Playwright WebGL visual capture & error check for `games/voxel-character-showcase`.
 *
 * Starts Vite dev server on port 5199, clicks through all tabs, presets, stage contexts,
 * and Perf Bench crowd counts, asserts zero console/WebGL/page errors, and saves PNGs to
 * `tools/run-voxel-characters/out/previews/`.
 *
 * Options for the reference comparison (`scripts/compare-references.py`):
 *   VERIFY_OUT   output directory (default `out/previews`)
 *   VERIFY_DPR   device scale factor of the screenshots (default 1)
 *   VERIFY_CLIP  clip to play on each humanoid preset in place of its own clip, e.g. `Idle_Loop`.
 *                One neutral pose for all presets makes the proportions comparable.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL_ROOT = resolve(HERE, '..')
const REPO_ROOT = resolve(TOOL_ROOT, '../..')
const SHOWCASE_DIR = join(REPO_ROOT, 'games/voxel-character-showcase')
const OUT_DIR = process.env.VERIFY_OUT ? resolve(process.env.VERIFY_OUT) : join(TOOL_ROOT, 'out/previews')
const DEVICE_SCALE = Number(process.env.VERIFY_DPR || 1)
const NEUTRAL_CLIP = process.env.VERIFY_CLIP || null

const PW_CANDIDATES = [
  process.env.PLAYWRIGHT_MODULE,
  '/Users/pany/dev/gb-blockwright/node_modules/playwright/index.mjs',
  '/Users/pany/dev/run-tv/node_modules/playwright/index.mjs',
  '/Users/pany/dev/gb-lattice/node_modules/playwright/index.mjs',
].filter(Boolean)

async function loadPlaywright() {
  for (const candidate of PW_CANDIDATES) {
    if (existsSync(candidate)) {
      const mod = await import(pathToFileURL(candidate).href)
      return mod.default ?? mod
    }
  }
  const mod = await import('playwright')
  return mod.default ?? mod
}

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const port = Number(process.env.VERIFY_PORT || 5199)
  const url = `http://127.0.0.1:${port}/`

  const server = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: SHOWCASE_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let serverLogs = ''
  server.stdout.on('data', (d) => { serverLogs += d.toString() })
  server.stderr.on('data', (d) => { serverLogs += d.toString() })

  const errors = []
  let browser = null

  try {
    await waitForServer(url)
    const pw = await loadPlaywright()
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    browser = await pw.chromium.launch({
      ...(existsSync(chromePath) ? { executablePath: chromePath } : {}),
      headless: true,
      args: [
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
      ],
    })

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: DEVICE_SCALE })
    page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.message}`))
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(`CONSOLE_ERROR: ${msg.text()}`)
      }
    })

    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForSelector('canvas', { timeout: 20000 })
    await page.waitForTimeout(1500)

    // 1. Capture every Context Preset in the Parametric Voxel Lab
    const presetButtons = page.locator('.section-card:has-text("Context Presets") .preset-pills button')
    const presetCount = await presetButtons.count()
    console.log(`Found ${presetCount} presets in Avatar Lab`)
    if (presetCount < 29) {
      throw new Error(`Expected at least 29 presets (including Knights, Orcs, and Trolls), found ${presetCount}`)
    }
    for (let i = 0; i < presetCount; i++) {
      const btn = presetButtons.nth(i)
      const label = (await btn.innerText()).trim()
      await btn.click()
      if (NEUTRAL_CLIP) {
        await page.waitForTimeout(400)
        const clipSelect = page.locator('.section-card:has-text("Animation Clip") select').first()
        const hasClip = (await clipSelect.locator(`option[value="${NEUTRAL_CLIP}"]`).count()) > 0
        if (hasClip) await clipSelect.selectOption(NEUTRAL_CLIP)
      }
      await page.waitForTimeout(900)
      const file = join(OUT_DIR, `lab-${String(i + 1).padStart(2, '0')}-${slugify(label)}.png`)
      await page.screenshot({ path: file })
      console.log(`Captured ${file}`)
    }

    // 2. Capture Overview tab
    await page.getByRole('button', { name: /Art Direction & Spec/i }).click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: join(OUT_DIR, 'overview.png') })

    // 3. Capture Context Stage (All + per-context filters)
    await page.locator('.tab-btn', { hasText: /Context Stage/i }).click()
    await page.waitForSelector('canvas', { timeout: 15000 })
    await page.waitForTimeout(1800)
    await page.screenshot({ path: join(OUT_DIR, 'stage-all.png') })

    for (const ctxLabel of ['HEIST', 'INDUSTRIAL', 'SECURITY', 'CREATURES', 'FANTASY']) {
      await page.locator('.hud-card button', { hasText: new RegExp(`^${ctxLabel}$`, 'i') }).click()
      await page.waitForTimeout(900)
      await page.screenshot({ path: join(OUT_DIR, `stage-${ctxLabel.toLowerCase()}.png`) })
    }

    // 4. Capture Animation Reviewer tab (Focus + Skeleton + 3x3 Wall + Quadruped + New Animal Rigs)
    await page.locator('.tab-btn', { hasText: /Animation Reviewer/i }).click()
    await page.waitForSelector('canvas', { timeout: 15000 })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: join(OUT_DIR, 'reviewer-focus.png') })

    await page.getByRole('button', { name: /Side/i }).click()
    await page.getByRole('button', { name: /Skeleton:/i }).click()
    await page.locator('.clip-row', { hasText: 'Pistol_Shoot' }).click()
    await page.waitForTimeout(900)
    await page.screenshot({ path: join(OUT_DIR, 'reviewer-skeleton-pistol.png') })

    await page.getByRole('button', { name: /Clip Wall/i }).click()
    await page.waitForTimeout(1400)
    await page.screenshot({ path: join(OUT_DIR, 'reviewer-wall.png') })

    await page.getByRole('button', { name: /^Quadruped/i }).click()
    await page.waitForTimeout(1000)
    await page.screenshot({ path: join(OUT_DIR, 'reviewer-quadruped-wall.png') })

    for (const animalRig of ['Fox', 'Horse', 'Corgi', 'Wolf', 'Pug', 'GSD', 'Cat']) {
      await page.getByRole('button', { name: new RegExp(`^${animalRig}\\s*\\(`) }).click()
      await page.waitForTimeout(800)
    }
    await page.screenshot({ path: join(OUT_DIR, 'reviewer-cat-wall.png') })

    // 5. Capture Perf Bench (48 avatars)
    await page.locator('.tab-btn', { hasText: /S23 Ultra Perf Bench/i }).click()
    await page.waitForSelector('canvas', { timeout: 15000 })
    await page.locator('.hud-card button', { hasText: /^48$/ }).click()
    await page.waitForTimeout(1600)
    await page.screenshot({ path: join(OUT_DIR, 'perf-48.png') })
    const metricsText = await page.locator('.hud-card').nth(1).innerText()
    console.log(`Perf Bench (48 avatars):\n${metricsText}`)

    if (errors.length > 0) {
      throw new Error(`Visual verification encountered ${errors.length} errors:\n${errors.join('\n')}`)
    }
    console.log('Visual verification passed cleanly with zero console/page/WebGL errors.')
  } finally {
    if (browser) await browser.close().catch(() => {})
    server.kill('SIGTERM')
    if (errors.length > 0 && serverLogs) {
      console.error('Server logs:\n' + serverLogs)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

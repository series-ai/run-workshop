/**
 * Dev scale review CLI: renders one or more presets, parts, held items, or props
 * side by side at native 1.0x world scale next to a 1.80m human gauge (`body_athletic`
 * + 1.80m red reference column).
 *
 * Usage:
 *   npm run lineup -- --out out/review/monsters_scale.png warhorse ember_wyvern tyrant_rex giant_spider
 *   npm run lineup -- --out out/review/medieval_props.png --clip Idle_Loop knight prop_barrel prop_torch_stand
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { chromium, type Browser } from 'playwright'
import { REPO_ROOT } from '../src/paths'

async function waitForServer(url: string, timeoutMs = 20000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`Timed out waiting for Vite server at ${url}`)
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  let out = ''
  let width = 1600
  let height = 900
  let clip: string | null = null
  let phase = 0.2
  const tokens: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--out') out = resolve(argv[++i] ?? '')
    else if (a === '--width') width = Number(argv[++i] ?? 1600)
    else if (a === '--height') height = Number(argv[++i] ?? 900)
    else if (a === '--clip') clip = argv[++i] ?? null
    else if (a === '--phase') phase = Number(argv[++i] ?? 0.2)
    else tokens.push(a)
  }

  if (!out || tokens.length === 0) {
    throw new Error('Usage: npm run lineup -- --out <lineup.png> [--clip ClipName] [--phase 0.2] <id> [...]')
  }

  const showcaseDir = join(REPO_ROOT, 'games/run-chisel-showcase')
  const port = Number(process.env.CHISEL_LINEUP_PORT ?? 5197)
  const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    cwd: showcaseDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let browser: Browser | undefined

  try {
    await waitForServer(`http://localhost:${port}/thumb.html`)
    const chromeBin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    const launched = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromeBin) ? chromeBin : undefined,
      args: ['--use-gl=angle', existsSync(chromeBin) ? '--use-angle=metal' : '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
    })
    browser = launched
    const page = await launched.newPage({ viewport: { width, height } })
    const qs = new URLSearchParams({ lineup: tokens.join(','), phase: String(phase) })
    if (clip) qs.set('clip', clip)

    await page.goto(`http://localhost:${port}/thumb.html?${qs.toString()}`)
    await page.waitForFunction(
      () => {
        const g = globalThis as unknown as { __thumbReady?: boolean; __thumbError?: string }
        return g.__thumbReady === true || typeof g.__thumbError === 'string'
      },
      undefined,
      { timeout: 30_000 },
    )
    await page.waitForTimeout(180)
    const err = await page.evaluate(() => (globalThis as unknown as { __thumbError?: string }).__thumbError)
    if (err) throw new Error(err)

    mkdirSync(dirname(out), { recursive: true })
    const buf = await page.locator('#thumb-root').screenshot({ type: 'png' })
    writeFileSync(out, buf)
    console.log(`LINEUP ${out}`)
  } finally {
    await browser?.close()
    server.kill('SIGTERM')
  }
}

await main()

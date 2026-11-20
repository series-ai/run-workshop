/**
 * Dev visual review CLI: renders multi-angle or multi-phase animation contact
 * sheets in the real showcase Three.js WebGL shader + Playwright + ImageMagick.
 *
 * Usage:
 *   npm run snapshot -- --out out/review/knight.png --views knight
 *   npm run snapshot -- --out out/review/wyvern_walk.png --clip Walk --phases 0,0.25,0.5,0.75 ember_wyvern
 *   npm run snapshot -- --out out/review/props.png prop_anvil prop_lantern held_sword
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { packCatalogSchema } from '../contracts/catalog'
import { POLY_PACK_KEYS } from '../contracts/packs'
import { REPO_ROOT } from '../src/paths'

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

function checkMagick(): string {
  for (const bin of ['/opt/homebrew/bin/magick', 'magick']) {
    const res = spawnSync(bin, ['-version'], { encoding: 'utf8' })
    if (!res.error && res.status === 0) return bin
  }
  throw new Error('ImageMagick (`magick`) is required for contact sheets.')
}

function resolveToken(token: string, catalogs: ReturnType<typeof packCatalogSchema.parse>[]): { kind: string; id: string } {
  const colon = token.indexOf(':')
  if (colon > 0) return { kind: token.slice(0, colon), id: token.slice(colon + 1) }
  for (const cat of catalogs) {
    if (cat.presets.some((p) => p.id === token)) return { kind: 'preset', id: token }
    if (cat.parts.some((p) => p.id === token)) return { kind: 'part', id: token }
    if (cat.heldItems.some((h) => h.id === token)) return { kind: 'held', id: token }
    if (cat.props.some((pr) => pr.id === token)) return { kind: 'prop', id: token }
  }
  throw new Error(`Unknown asset or preset id "${token}". Run \`npm run catalog\` if newly added.`)
}

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
  let clip: string | null = null
  let phases: number[] = [0.18]
  let views = false
  let size = 512
  const tokens: string[] = []

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    if (a === '--out') out = resolve(argv[++i] ?? '')
    else if (a === '--clip') clip = argv[++i] ?? null
    else if (a === '--phases') phases = (argv[++i] ?? '0.18').split(',').map((s) => Number(s.trim()))
    else if (a === '--views') views = true
    else if (a === '--size') size = Number(argv[++i] ?? 512)
    else tokens.push(a)
  }

  if (!out || tokens.length === 0) {
    throw new Error('Usage: npm run snapshot -- --out <sheet.png> [--clip ClipName] [--phases 0,0.25,0.5,0.75] [--views] <id> [...]')
  }

  const magickBin = checkMagick()
  const showcaseDir = join(REPO_ROOT, 'games/run-chisel-showcase')
  const catalogs = POLY_PACK_KEYS.map((k) =>
    packCatalogSchema.parse(JSON.parse(readFileSync(join(showcaseDir, 'public/catalog', k, 'catalog.json'), 'utf8'))),
  )
  const resolved = tokens.map((t) => resolveToken(t, catalogs))

  const angles = views
    ? [
        { label: 'front34', yaw: 36, pitch: 18 },
        { label: 'side', yaw: 90, pitch: 12 },
        { label: 'rear', yaw: 180, pitch: 16 },
        { label: 'high', yaw: -32, pitch: 38 },
      ]
    : [{ label: 'front34', yaw: 36, pitch: 18 }]

  const port = Number(process.env.CHISEL_SNAP_PORT ?? 5196)
  const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    cwd: showcaseDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const tmp = mkdtempSync(join(tmpdir(), 'chisel-snap-'))
  let browser: { close: () => Promise<void> } | undefined

  try {
    await waitForServer(`http://localhost:${port}/thumb.html`)
    const { chromium } = findPlaywright()
    const chromeBin = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    const launched = await chromium.launch({
      headless: true,
      executablePath: existsSync(chromeBin) ? chromeBin : undefined,
      args: ['--use-gl=angle', existsSync(chromeBin) ? '--use-angle=metal' : '--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
    })
    browser = launched
    const page = await launched.newPage({ viewport: { width: size, height: size } })
    const shots: string[] = []
    let idx = 0

    for (const item of resolved) {
      for (const phase of phases) {
        for (const ang of angles) {
          const qs = new URLSearchParams({
            kind: item.kind,
            id: item.id,
            phase: String(phase),
            yaw: String(ang.yaw),
            pitch: String(ang.pitch),
          })
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
          await page.waitForTimeout(140)
          const err = await page.evaluate(() => (globalThis as unknown as { __thumbError?: string }).__thumbError)
          if (err) throw new Error(err)
          const file = join(tmp, `${String(idx++).padStart(3, '0')}.png`)
          await page.locator('#thumb-root').screenshot({ path: file })
          shots.push(file)
        }
      }
    }

    mkdirSync(dirname(out), { recursive: true })
    if (shots.length === 1) {
      const res = spawnSync('cp', [shots[0]!, out], { encoding: 'utf8' })
      if (res.status !== 0) throw new Error(res.stderr)
    } else {
      const cols = views ? angles.length : phases.length > 1 ? phases.length : Math.min(4, shots.length)
      const rows: string[][] = []
      for (let i = 0; i < shots.length; i += cols) rows.push(shots.slice(i, i + cols))
      const args = ['-background', '#0b0f17']
      for (const r of rows) args.push('(', ...r, '+append', ')')
      args.push('-append', out)
      const res = spawnSync(magickBin, args, { encoding: 'utf8' })
      if (res.error || res.status !== 0) throw new Error(`magick failed: ${res.error?.message ?? res.stderr}`)
    }
    console.log(`SHEET ${out} (${shots.length} frame(s))`)
  } finally {
    await browser?.close()
    server.kill('SIGTERM')
    rmSync(tmp, { recursive: true, force: true })
  }
}

await main()

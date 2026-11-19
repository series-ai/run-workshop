#!/usr/bin/env node
/**
 * Headless Chromium (Metal ANGLE) visual and telemetry check for games/run-poly-showcase.
 *
 * The script starts `vite preview --mode local-preview`, drives the real UI and writes one PNG for
 * each shot plus `report.json` to `--out <dir>`. A console error or a page error fails the run.
 *
 *   --out <dir>     output directory (default: out/visual-check)
 *   --port <n>      preview port (default: 4194)
 *   --only <regex>  capture only the shots whose name matches (for fast iteration)
 *
 * Lab shots hold the clip at a fixed phase, so each pose is the same on every run.
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)

function findPlaywright() {
  for (const candidate of [
    'playwright',
    resolve(dirname(process.execPath), '../lib/node_modules/@playwright/cli/node_modules/playwright'),
    '/Users/pany/.local/share/mise/installs/node/24.19.0/lib/node_modules/@playwright/cli/node_modules/playwright',
    '/Users/pany/.npm/_npx/e41f203b7505f1fb/node_modules/playwright',
  ]) {
    try {
      return require(candidate)
    } catch {
      // try next
    }
  }
  throw new Error('Playwright not found. Install playwright or adjust findPlaywright paths.')
}

function parseArgs(argv) {
  const outIdx = argv.indexOf('--out')
  const outDir = outIdx >= 0 && argv[outIdx + 1] ? resolve(argv[outIdx + 1]) : resolve(process.cwd(), 'out/visual-check')
  const portIdx = argv.indexOf('--port')
  const port = portIdx >= 0 && argv[portIdx + 1] ? Number(argv[portIdx + 1]) : 4194
  const onlyIdx = argv.indexOf('--only')
  const only = onlyIdx >= 0 && argv[onlyIdx + 1] ? new RegExp(argv[onlyIdx + 1]) : null
  return { outDir, port, only }
}

async function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Timed out waiting for preview server at ${url}`)
}

async function main() {
  const { outDir, port, only } = parseArgs(process.argv.slice(2))
  mkdirSync(outDir, { recursive: true })

  const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '../../..')
  const showcaseDir = resolve(repoRoot, 'games/run-poly-showcase')
  if (!existsSync(resolve(showcaseDir, 'dist/index.html'))) {
    throw new Error('Missing games/run-poly-showcase/dist. Run `npm run build:local` in games/run-poly-showcase first.')
  }

  const server = spawn('npx', ['vite', 'preview', '--mode', 'local-preview', '--port', String(port), '--strictPort'], {
    cwd: showcaseDir,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  const url = `http://localhost:${port}/`
  const consoleErrors = []
  const pageErrors = []
  let browser

  try {
    await waitForServer(url)
    const { chromium } = findPlaywright()
    browser = await chromium.launch({
      headless: true,
      executablePath: existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
        ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
        : undefined,
      args: ['--use-gl=angle', '--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'],
    })

    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 })
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => pageErrors.push(String(err)))

    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)

    const snap = async (name, waitMs = 500) => {
      await page.waitForTimeout(waitMs)
      const path = resolve(outDir, `${name}.png`)
      await page.screenshot({ path })
      console.log(`CAPTURED ${path}`)
    }
    const tab = (name) => page.locator('.topbar').getByRole('button', { name }).click()

    /** Open a lab preset. `clip` selects a clip, `hold` holds it at a phase (0 to 1). */
    const lab = async (preset, { clip, hold } = {}) => {
      await tab('Parametric Avatar Lab')
      await page.getByRole('button', { name: preset, exact: true }).click()
      if (clip) await page.locator('select').first().selectOption(clip)
      const holdBox = page.getByRole('checkbox', { name: 'Hold pose' })
      if (hold === undefined) {
        await holdBox.uncheck()
      } else {
        await holdBox.check()
        await page.getByRole('slider', { name: 'Pose phase' }).fill(String(hold))
      }
    }
    /** Drag on the lab canvas to orbit the camera. */
    const orbit = async (dx, dy) => {
      const box = await page.locator('canvas').first().boundingBox()
      if (!box) throw new Error('The lab canvas is missing.')
      const x = box.x + box.width / 2
      const y = box.y + box.height * 0.6
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + dx, y + dy, { steps: 12 })
      await page.mouse.up()
    }

    let perfText = null
    const HUMANS = [
      ['knight', 'Knight Captain'], ['squire', 'Torchbearer Squire'], ['guard', 'Town Guard'],
      ['rifleman', 'Rifleman'], ['officer', 'Field Officer'], ['sapper', 'Assault Sapper'],
      ['student', 'Coffee Run Student'], ['executive', 'Executive'], ['varsity', 'Varsity Dancer'],
      ['cyber-edgerunner', 'Street Edgerunner'], ['cyber-netrunner', 'Ghost Netrunner'],
      ['cyber-enforcer', 'Corp Enforcer'], ['cyber-ronin', 'Chrome Ronin'],
    ]
    const shots = [
      ['01-overview', async () => void (await tab('Architecture & Spec'))],
      ...HUMANS.map(([id, label], i) => [`02-lab-human-${i + 1}-${id}`, () => lab(label, { hold: 0.3 })]),
      ['03-lab-officer-rear-lining', async () => {
        await lab('Field Officer', { hold: 0.3 })
        await page.waitForTimeout(600)
        await orbit(330, -20)
      }],
      ['03b-lab-squire-low-boots', async () => {
        await lab('Torchbearer Squire', { hold: 0.3 })
        await page.waitForTimeout(600)
        await orbit(-90, -150)
      }],
      ['04-lab-orc-idle', () => lab('Orc Warlord', { clip: 'Sword_Idle', hold: 0.3 })],
      ['04b-lab-orc-sword-attack-windup', () => lab('Orc Warlord', { clip: 'Sword_Attack', hold: 0.25 })],
      ['04c-lab-orc-sword-attack-strike', () => lab('Orc Warlord', { clip: 'Sword_Attack', hold: 0.5 })],
      ['04d-lab-orc-rear', async () => {
        await lab('Orc Warlord', { clip: 'Sword_Attack', hold: 0.5 })
        await page.waitForTimeout(600)
        await orbit(360, -10)
      }],
      ['05-lab-troll-idle', () => lab('Troll Brute', { hold: 0.3 })],
      ['05b-lab-troll-rear', async () => {
        await lab('Troll Brute', { hold: 0.3 })
        await page.waitForTimeout(600)
        await orbit(380, -10)
      }],
      ['05c-lab-troll-walk', () => lab('Troll Brute', { clip: 'Walk_Loop', hold: 0.4 })],
      ['06-lab-wolf-idle', () => lab('Dire Wolf', { clip: 'Idle', hold: 0.25 })],
      ['06b-lab-wolf-walk', () => lab('Dire Wolf', { clip: 'Walk', hold: 0.3 })],
      ['06c-lab-wolf-run-extend', () => lab('Dire Wolf', { clip: 'Run', hold: 0.0 })],
      ['06d-lab-wolf-run-gather', () => lab('Dire Wolf', { clip: 'Run', hold: 0.5 })],
      ['06e-lab-wolf-attack-lunge', () => lab('Dire Wolf', { clip: 'Attack', hold: 0.5 })],
      ['06f-lab-wolf-attack-recover', () => lab('Dire Wolf', { clip: 'Attack', hold: 0.82 })],
      ['06g-lab-wolf-howl', () => lab('Dire Wolf', { clip: 'Howl', hold: 0.5 })],
      ['06h-lab-wolf-front', async () => {
        await lab('Dire Wolf', { clip: 'Idle', hold: 0.25 })
        await page.waitForTimeout(600)
        await orbit(-150, 10)
      }],
      ['07-lab-spider-idle', () => lab('Giant Spider', { clip: 'Idle', hold: 0.25 })],
      ['07b-lab-spider-walk', () => lab('Giant Spider', { clip: 'Walk', hold: 0.25 })],
      ['07c-lab-spider-run', () => lab('Giant Spider', { clip: 'Run', hold: 0.75 })],
      ['07d-lab-spider-attack-rear', () => lab('Giant Spider', { clip: 'Attack', hold: 0.42 })],
      ['07e-lab-spider-top', async () => {
        await lab('Giant Spider', { clip: 'Idle', hold: 0.25 })
        await page.waitForTimeout(600)
        await orbit(260, 170)
      }],
      ['08-lab-turntable', async () => {
        await lab('Dire Wolf', { clip: 'Run' })
        await page.getByRole('button', { name: /^Turntable/ }).click()
        await page.waitForTimeout(2600)
      }],
      ['08b-lab-reset-view', async () => {
        await page.getByRole('button', { name: /^Turntable/ }).click()
        await page.getByRole('button', { name: 'Reset View', exact: true }).click()
        await page.waitForTimeout(900)
      }],
      ['09-stage-all-contexts', async () => {
        await tab(/Context Stage/)
        await page.getByRole('button', { name: /^All \d+(?: Contexts)?$/ }).click()
        await page.waitForTimeout(900)
      }],
      ...['MEDIEVAL', 'WW2', 'SIM', 'CYBERPUNK', 'MONSTERS'].map((context, i) => [`09${'bcdef'[i]}-stage-${context.toLowerCase()}`, async () => {
        await tab(/Context Stage/)
        await page.getByRole('button', { name: context, exact: true }).click()
        await page.waitForTimeout(700)
      }]),
      ['10-perf-bench-64', async () => {
        await tab('S23 Ultra Perf Bench')
        await page.getByRole('button', { name: '64', exact: true }).click()
        await page.waitForTimeout(3200)
        perfText = await page.locator('.hud-overlay').first().innerText()
      }],
    ]
    for (const [name, run] of shots) {
      if (only && !only.test(name)) continue
      await run()
      await snap(name)
    }

    // Use the real composer with empty clothing slots for the body seam checks.
    const bareShots = ['Athletic', 'Heavy', 'Slim'].flatMap((body) =>
      ['A_TPose', 'Idle_Loop'].map((clip) => ({
        name: `11-bare-${body.toLowerCase()}-${clip}`, body, clip,
      })),
    ).filter(({ name }) => !only || only.test(name))
    if (bareShots.length) {
      await page.route('**/catalog/core/catalog.json', async (route) => {
        const response = await route.fetch()
        const catalog = await response.json()
        for (const preset of catalog.presets) {
          preset.torso = null
          preset.legs = null
        }
        await route.fulfill({ response, json: catalog })
      })
      await page.reload({ waitUntil: 'networkidle' })
      for (const { name, body, clip } of bareShots) {
        await lab(`Core ${body}`, { clip, hold: 0.3 })
        await snap(name)
      }
    }

    const report = {
      capturedAt: new Date().toISOString(),
      consoleErrors,
      pageErrors,
      perfHud: perfText,
    }
    writeFileSync(resolve(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n')
    if (perfText) console.log('PERF HUD:\n' + perfText)

    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      console.error('Errors detected:', { consoleErrors, pageErrors })
      process.exitCode = 1
    }
  } finally {
    if (browser) await browser.close()
    server.kill('SIGTERM')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

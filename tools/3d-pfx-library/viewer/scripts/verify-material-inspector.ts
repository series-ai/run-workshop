// Real-browser check of the normal detail viewer Material inspector (T5 UI).
// Run from tools/3d-pfx-library:
//   node --import tsx viewer/scripts/verify-material-inspector.ts --output .context/material-controls/<run>/inspector-ui
//
// The script owns its Vite process on 127.0.0.1 with --strictPort. If the
// port has a listener, it stops with PortBusy. It never attaches to or stops
// an unknown server. It drives only production controls through their
// accessible names. Material pixels, measured runtime status, the real
// fault/Retry path, and recipe replay are proved by
// `verify-material-controls.ts --case inspector`.
// Exit codes: 0 pass, 1 fail or blocked, 64 usage error.

import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright'
import { PNG } from 'pngjs'
import { AUTHORED_EFFECT_RECIPES, parsePfxAuthoredRecipeJson, type PfxAuthoredRecipe } from '../../src/index'
import { applyPfxMaterialLayerEdit, readPfxMaterialQualityQuery, removePfxMaterialFeature, setPfxMaterialFeature } from '../src/MaterialInspector'

const packageRoot = process.cwd()
const HOST = '127.0.0.1'
const VIEWPORTS = [
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const
const EFFECT = 'portal-idle-loop'
const PREVIEW_QUERY = `profileEffectIds=${EFFECT}&reviewTimeMs=420&reviewCamera=three-quarter&reviewCapture=1`

// The viewer edits the catalog recipe. The T6 pilot gives portal-idle-loop
// its own material settings, so every expected value starts from that base
// material, and an inspector default applies only where the base has none.
const BASE_RECIPE = AUTHORED_EFFECT_RECIPES[EFFECT]!
const baseMaterialOf = (phase: string) => BASE_RECIPE.surfaces.find((surface) => (surface.phase ?? surface.kind) === phase)?.tuning?.material
const BASE_VORTEX = baseMaterialOf('vortex-rim')
const BASE_THROAT = baseMaterialOf('aperture-depth')
const EXPECTED_UV = BASE_VORTEX?.uv ?? { scale: [1, 1] as [number, number], offset: [0, 0] as [number, number], rotation: 0, scroll: [0, 0] as [number, number], wrap: 'clamp' as const }
// Switching the map to noise keeps a base strength and scroll.
const EXPECTED_NOISE_STRENGTH = typeof BASE_VORTEX?.distortion?.strength === 'number' ? BASE_VORTEX.distortion.strength : 0.05
const EXPECTED_NOISE_SCROLL = BASE_VORTEX?.distortion?.scroll ?? [0, 0.25]
const EXPECTED_THROAT_RIM = BASE_THROAT?.rim ?? { power: 2.2, strength: 1 }

interface Check {
  id: string
  viewport?: string
  kind: 'assert' | 'observation'
  expected?: unknown
  observed: unknown
  pass?: boolean
}

interface Options {
  output: string
  port: number
}

class UsageError extends Error {}

function parseOptions(argv: string[]): Options {
  let output: string | undefined
  let port = 48389
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const value = argv[index + 1]
    if (arg === '--output' && value) {
      output = value
      index += 1
    } else if (arg === '--port' && value) {
      port = Number(value)
      index += 1
    } else {
      throw new UsageError(`Unknown or incomplete argument ${arg}`)
    }
  }
  if (!output) throw new UsageError('--output <dir> is required')
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new UsageError(`--port must be an integer in 1024..65535, got ${port}`)
  return { output: path.resolve(packageRoot, output), port }
}

const checks: Check[] = []
const artifacts: string[] = []

function record(check: Check): void {
  checks.push(check)
  const mark = check.kind === 'observation' ? 'obs ' : check.pass ? 'PASS' : 'FAIL'
  console.log(`${mark} ${check.viewport ? `[${check.viewport}] ` : ''}${check.id}: ${JSON.stringify(check.observed)}`)
}

function expectEqual(id: string, viewport: string | undefined, expected: unknown, observed: unknown): void {
  record({ id, viewport, kind: 'assert', expected, observed, pass: JSON.stringify(expected) === JSON.stringify(observed) })
}

function expectTrue(id: string, viewport: string | undefined, observed: unknown, pass: boolean, expected: unknown = true): void {
  record({ id, viewport, kind: 'assert', expected, observed, pass })
}

function observe(id: string, viewport: string | undefined, observed: unknown): void {
  record({ id, viewport, kind: 'observation', observed })
}

// ---------------------------------------------------------------------------
// Owned server. Same rules as verify-material-controls.ts, on its own port so
// it can run beside that runner.

function listenerPids(port: number): number[] {
  try {
    return execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .split('\n')
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0)
  } catch (error) {
    const status = (error as { status?: number }).status
    const stdout = String((error as { stdout?: Buffer }).stdout ?? '')
    if (status === 1 && stdout.trim() === '') return []
    throw new Error(`lsof failed; cannot prove port ownership: ${String(error)}`)
  }
}

function portAcceptsConnections(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: HOST, port })
    socket.setTimeout(500)
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('timeout', () => { socket.destroy(); resolve(false) })
    socket.once('error', () => resolve(false))
  })
}

async function urlResponds(url: string): Promise<boolean> {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(5_000) })).ok
  } catch {
    return false
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function startOwnedViewer(port: number, outputDir: string, runToken: string): Promise<{ child: ChildProcess; pid: number; command: string }> {
  const busy = listenerPids(port)
  if (busy.length > 0 || (await portAcceptsConnections(port))) {
    throw new Error(`PortBusy: ${HOST}:${port} has listeners ${busy.join(', ') || 'unknown'}. This script does not attach to or stop them.`)
  }
  const log = fs.createWriteStream(path.join(outputDir, 'vite-server.log'))
  const viteBin = path.join(packageRoot, 'node_modules/vite/bin/vite.js')
  const args = [viteBin, '--host', HOST, '--port', String(port), '--strictPort']
  const child = spawn(process.execPath, args, {
    cwd: packageRoot,
    env: { ...process.env, VITE_PFX_RUN_TOKEN: runToken },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout?.pipe(log)
  child.stderr?.pipe(log)
  if (child.pid == null) throw new Error('ServerExited: Vite did not start')
  const origin = `http://${HOST}:${port}/`
  try {
    // A loaded machine can delay the first transform; allow 90 s.
    const deadline = Date.now() + 90_000
    while (Date.now() < deadline && !(await urlResponds(origin))) {
      if (child.exitCode != null) throw new Error(`ServerExited: Vite exited with code ${child.exitCode}`)
      await delay(200)
    }
    if (!(await urlResponds(origin))) throw new Error(`ServerTimeout: Vite did not answer at ${origin}`)
    const owners = listenerPids(port)
    if (owners.length !== 1 || owners[0] !== child.pid) throw new Error(`OwnershipMismatch: listeners ${JSON.stringify(owners)} are not child ${child.pid}`)
  } catch (error) {
    // Never leave this script's own child running after a failed start.
    await stopOwnedViewer(child, port)
    throw error
  }
  return { child, pid: child.pid, command: [process.execPath, ...args].join(' ') }
}

async function stopOwnedViewer(child: ChildProcess, port: number): Promise<Record<string, unknown>> {
  if (child.exitCode == null && child.signalCode == null) {
    child.kill('SIGTERM')
    const exited = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 5_000)
      child.once('exit', () => { clearTimeout(timer); resolve(true) })
    })
    if (!exited) child.kill('SIGKILL')
  }
  let listeners = listenerPids(port)
  for (let attempt = 0; attempt < 50 && listeners.length > 0; attempt += 1) {
    await delay(100)
    listeners = listenerPids(port)
  }
  return { exitCode: child.exitCode, exitSignal: child.signalCode, portClearAfter: listeners.length === 0, listenersAfter: listeners }
}

// ---------------------------------------------------------------------------
// Page helpers. Every locator uses a production accessible name or test ID.

interface PageWatch {
  pageErrors: string[]
  consoleErrors: string[]
}

function watch(page: Page): PageWatch {
  const result: PageWatch = { pageErrors: [], consoleErrors: [] }
  page.on('pageerror', (error) => result.pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') result.consoleErrors.push(message.text())
  })
  return result
}

async function openDetail(page: Page, origin: string, extraQuery = ''): Promise<void> {
  await page.goto(`${origin}?${PREVIEW_QUERY}${extraQuery}`)
  await page.getByTestId('pfx-emitter-panel').waitFor({ timeout: 30_000 })
  await page.locator('[data-testid="pfx-3d-stage"] canvas').waitFor({ timeout: 30_000 })
}

function layer(page: Page, phase: string): Locator {
  return page.locator('details.pfx-emitter').filter({ has: page.getByTestId(`pfx-emitter-toggle-${phase}`) })
}

function material(page: Page, phase: string): Locator {
  return page.getByTestId(`pfx-material-${phase}`)
}

async function openLayerMaterial(page: Page, phase: string, viaKeyboard: boolean): Promise<void> {
  const details = layer(page, phase)
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await details.locator('summary .pfx-emitter-name').first().click()
  }
  const summary = material(page, phase).locator('summary')
  if (!(await material(page, phase).evaluate((element) => (element as HTMLDetailsElement).open))) {
    if (viaKeyboard) {
      await summary.focus()
      await page.keyboard.press('Enter')
    } else {
      await summary.click()
    }
  }
}

/** The inspector state after the preview measured the current revision. */
async function settledState(locator: Locator): Promise<string | null> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const state = await locator.getAttribute('data-state')
    if (state !== 'loading') return state
    await delay(50)
  }
  return 'loading'
}

function spin(page: Page, name: string): Locator {
  return page.getByRole('spinbutton', { name, exact: true })
}

async function numeric(locator: Locator): Promise<{ value: string; min: string | null; max: string | null; step: string | null; disabled: boolean }> {
  return locator.evaluate((element) => {
    const input = element as HTMLInputElement
    return { value: input.value, min: input.getAttribute('min'), max: input.getAttribute('max'), step: input.getAttribute('step'), disabled: input.disabled }
  })
}

async function copyRecipe(page: Page): Promise<{ text: string; recipe: PfxAuthoredRecipe }> {
  await page.evaluate(() => navigator.clipboard.writeText(''))
  await page.getByRole('button', { name: 'Copy recipe JSON' }).click()
  await page.getByRole('button', { name: 'Copied ✓' }).waitFor({ timeout: 5_000 })
  const text = await page.evaluate(() => navigator.clipboard.readText())
  return { text, recipe: parsePfxAuthoredRecipeJson(text) }
}

function surfaceOf(recipe: PfxAuthoredRecipe, phase: string) {
  return recipe.surfaces.find((surface) => (surface.phase ?? surface.kind) === phase)
}

async function canvasPng(page: Page): Promise<PNG> {
  await page.waitForTimeout(600)
  return PNG.sync.read(await page.locator('[data-testid="pfx-3d-stage"] canvas').screenshot())
}

function differingPixels(a: PNG, b: PNG): number {
  if (a.width !== b.width || a.height !== b.height) return Number.POSITIVE_INFINITY
  let count = 0
  for (let index = 0; index < a.data.length; index += 4) {
    if (Math.abs(a.data[index]! - b.data[index]!) + Math.abs(a.data[index + 1]! - b.data[index + 1]!) + Math.abs(a.data[index + 2]! - b.data[index + 2]!) > 24) count += 1
  }
  return count
}

async function overflow(page: Page): Promise<{ page: number; materialOverflow: string[] }> {
  return page.evaluate(() => ({
    page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    materialOverflow: [...document.querySelectorAll<HTMLElement>('.pfx-material[open], .pfx-material-quality')]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => element.dataset.testid ?? element.className),
  }))
}

async function shot(page: Page, outputDir: string, name: string, locator?: Locator): Promise<void> {
  const file = path.join(outputDir, `${name}.png`)
  if (locator) await locator.screenshot({ path: file })
  else await page.screenshot({ path: file, fullPage: true })
  artifacts.push(path.relative(packageRoot, file))
}

// ---------------------------------------------------------------------------
// Scenario per viewport.

async function newContext(browser: Browser, origin: string, viewport: (typeof VIEWPORTS)[number], reducedMotion: 'reduce' | 'no-preference'): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1, reducedMotion })
  // Clipboard permission only for the local viewer origin.
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: origin.replace(/\/$/, '') })
  return context
}

async function mainScenario(browser: Browser, origin: string, viewport: (typeof VIEWPORTS)[number], outputDir: string): Promise<PageWatch> {
  const v = viewport.name
  const context = await newContext(browser, origin, viewport, 'no-preference')
  const page = await context.newPage()
  const watched = watch(page)
  try {
    await openDetail(page, origin)

    // Quality: high by default in the detail viewer.
    const qualitySelect = page.getByRole('combobox', { name: 'Material quality', exact: true })
    expectEqual('quality-default-high', v, 'high', await qualitySelect.inputValue())
    expectEqual('stage-quality-attribute', v, 'high', await page.getByTestId('pfx-3d-stage').getAttribute('data-material-quality'))

    // Existing layer toggles and fields stay.
    const layerToggles = await page.locator('[data-testid^="pfx-emitter-toggle-"]').count()
    expectEqual('layer-toggles-present', v, 3, layerToggles)

    // Vortex rim: vortex-swirl path. Keyboard opens the Material group.
    await openLayerMaterial(page, 'vortex-rim', true)
    const vortex = material(page, 'vortex-rim')
    expectEqual('vortex-path', v, 'vortex-swirl', await vortex.getAttribute('data-path'))
    expectEqual('vortex-state-default', v, 'default', await settledState(vortex))
    const groups = await vortex.locator('fieldset > legend').allTextContents()
    expectEqual('vortex-groups-supported-only', v, ['Texture motion'], groups)
    const opacityBefore = await layer(page, 'vortex-rim').locator('.pfx-emitter-fields label:has-text("opacity") input').inputValue()

    await page.getByRole('checkbox', { name: 'UV transform for vortex-rim', exact: true }).check()
    const uvScale = await numeric(spin(page, 'UV scale U (multiplier) for vortex-rim'))
    expectEqual('uv-scale-native-units', v, { value: String(EXPECTED_UV.scale[0]), min: '0.01', max: '16', step: '0.01', disabled: false }, uvScale)
    const uvRotation = await numeric(spin(page, 'UV rotation (radians) for vortex-rim'))
    expectEqual('uv-rotation-radians', v, { value: String(EXPECTED_UV.rotation), min: String(-Math.PI), max: String(Math.PI) }, { value: uvRotation.value, min: uvRotation.min, max: uvRotation.max })
    await spin(page, 'UV scroll speed V (UV units per second) for vortex-rim').fill('0.4')

    await page.getByRole('combobox', { name: 'Distortion map for vortex-rim', exact: true }).selectOption('noise')
    const strengthName = 'Distortion strength (UV units) for vortex-rim'
    expectEqual('distortion-strength-native', v, { value: String(EXPECTED_NOISE_STRENGTH), min: '0', max: '0.25', step: '0.005', disabled: false }, await numeric(spin(page, strengthName)))
    expectEqual('vortex-no-life-curve', v, 0, await page.getByRole('combobox', { name: 'Distortion strength curve type for vortex-rim' }).count())
    await spin(page, strengthName).fill('0.08')
    await spin(page, strengthName).focus()
    await page.keyboard.press('ArrowUp')
    expectEqual('keyboard-arrow-step', v, '0.085', await spin(page, strengthName).inputValue())
    await spin(page, strengthName).blur()

    // Feature edit keeps sibling features and non-material tuning.
    expectEqual('sibling-uv-kept', v, { scale: String(EXPECTED_UV.scale[0]), scrollV: '0.4' }, {
      scale: await spin(page, 'UV scale U (multiplier) for vortex-rim').inputValue(),
      scrollV: await spin(page, 'UV scroll speed V (UV units per second) for vortex-rim').inputValue(),
    })
    expectEqual('nonmaterial-opacity-kept', v, opacityBefore, await layer(page, 'vortex-rim').locator('.pfx-emitter-fields label:has-text("opacity") input').inputValue())

    // Low quality: distortion is disabled with a reason; values stay.
    await qualitySelect.selectOption('low')
    expectEqual('stage-quality-low', v, 'low', await page.getByTestId('pfx-3d-stage').getAttribute('data-material-quality'))
    const lowStrength = await numeric(spin(page, strengthName))
    expectEqual('low-distortion-disabled-value-kept', v, { value: '0.085', disabled: true }, { value: lowStrength.value, disabled: lowStrength.disabled })
    const reason = page.getByTestId('pfx-material-reason-vortex-rim-distortion')
    expectEqual('low-reason-text', v, 'Low quality turns this off. Your values are saved.', (await reason.textContent())?.trim())
    const describedBy = await spin(page, strengthName).getAttribute('aria-describedby')
    expectEqual('low-reason-linked', v, await reason.getAttribute('id'), describedBy)
    expectEqual('low-uv-still-editable', v, false, (await numeric(spin(page, 'UV scale U (multiplier) for vortex-rim'))).disabled)
    await shot(page, outputDir, `${v}-vortex-low-quality`, page.getByTestId('pfx-emitter-panel'))
    await qualitySelect.selectOption('high')

    // Copy recipe JSON: parsed by the public parser; quality is not stored.
    const copied = await copyRecipe(page)
    fs.writeFileSync(path.join(outputDir, `${v}-copied-recipe.json`), copied.text)
    artifacts.push(path.relative(packageRoot, path.join(outputDir, `${v}-copied-recipe.json`)))
    const vortexMaterial = surfaceOf(copied.recipe, 'vortex-rim')?.tuning?.material
    expectEqual('copy-json-material', v, {
      uv: { ...EXPECTED_UV, scroll: [EXPECTED_UV.scroll[0], 0.4] },
      distortion: { kind: 'noise', map: 'noise-a', strength: 0.085, direction: [0, 1], scroll: EXPECTED_NOISE_SCROLL },
    }, vortexMaterial)
    expectEqual('copy-json-no-quality', v, false, /quality/i.test(copied.text))
    expectEqual('copy-json-all-layers', v, ['vortex-rim', 'aperture-depth', 'depth-flow'], copied.recipe.surfaces.map((surface) => surface.phase))

    // Disabled layers are omitted from the copy; the rest is preserved.
    await page.getByTestId('pfx-emitter-toggle-depth-flow').uncheck()
    const withoutLayer = await copyRecipe(page)
    expectEqual('copy-omits-disabled-layer', v, ['vortex-rim', 'aperture-depth'], withoutLayer.recipe.surfaces.map((surface) => surface.phase))
    expectEqual('copy-keeps-material-with-toggle', v, vortexMaterial, surfaceOf(withoutLayer.recipe, 'vortex-rim')?.tuning?.material)
    await page.getByTestId('pfx-emitter-toggle-depth-flow').check()

    // Invalid material edit: named error, copy refused, edits kept.
    await spin(page, strengthName).fill('0.5')
    await spin(page, strengthName).blur()
    expectEqual('invalid-state-error', v, 'error', await vortex.getAttribute('data-state'))
    const errorText = (await page.getByTestId('pfx-material-error').textContent()) ?? ''
    expectTrue('invalid-error-names-field', v, errorText, errorText.includes('tuning.material.distortion.strength') && errorText.includes('vortex-rim'))
    expectEqual('invalid-no-edit-retry', v, 0, await page.getByTestId('pfx-material-retry').count())
    expectEqual('invalid-value-kept', v, '0.5', await spin(page, strengthName).inputValue())
    await page.getByRole('button', { name: 'Copy recipe JSON' }).click()
    const copyError = (await page.getByTestId('pfx-emitter-copy-error').textContent()) ?? ''
    expectTrue('invalid-copy-refused', v, copyError, copyError.includes('distortion.strength'))
    await shot(page, outputDir, `${v}-material-error`, page.getByTestId('pfx-emitter-panel'))
    await spin(page, strengthName).fill('0.1')
    await spin(page, strengthName).blur()
    expectEqual('fixed-state-default', v, 'default', await settledState(vortex))

    // Existing Opacity input changes pixels; an invalid value keeps the last
    // valid preview (not the base, not the invalid value).
    const opacity = layer(page, 'vortex-rim').locator('.pfx-emitter-fields label:has-text("opacity") input')
    const base = await canvasPng(page)
    await opacity.fill('0.05')
    const dimmed = await canvasPng(page)
    const opacityDiff = differingPixels(base, dimmed)
    expectTrue('opacity-changes-pixels', v, opacityDiff, opacityDiff > 200)
    await opacity.fill('1.5')
    const panelError = (await page.getByTestId('pfx-emitter-edit-error').textContent()) ?? ''
    expectTrue('invalid-opacity-named-error', v, panelError, panelError.includes('opacity'))
    const retained = await canvasPng(page)
    const retainedDiff = differingPixels(dimmed, retained)
    const retainedVsBase = differingPixels(base, retained)
    expectTrue('invalid-keeps-last-valid-pixels', v, { vsLastValid: retainedDiff, vsBase: retainedVsBase }, retainedDiff < 50 && retainedVsBase > 200)
    fs.writeFileSync(path.join(outputDir, `${v}-canvas-base.png`), PNG.sync.write(base))
    fs.writeFileSync(path.join(outputDir, `${v}-canvas-opacity-0.05.png`), PNG.sync.write(dimmed))
    fs.writeFileSync(path.join(outputDir, `${v}-canvas-after-invalid.png`), PNG.sync.write(retained))
    artifacts.push(...['canvas-base', 'canvas-opacity-0.05', 'canvas-after-invalid'].map((name) => path.relative(packageRoot, path.join(outputDir, `${v}-${name}.png`))))
    await opacity.fill('0.4')

    // Per-layer material reset: removes the material override only.
    await page.getByRole('button', { name: 'Reset material for vortex-rim', exact: true }).click()
    expectEqual('reset-uv-restores-base', v, BASE_VORTEX?.uv !== undefined, await page.getByRole('checkbox', { name: 'UV transform for vortex-rim', exact: true }).isChecked())
    expectEqual('reset-distortion-restores-base', v, BASE_VORTEX?.distortion?.kind ?? 'off', await page.getByRole('combobox', { name: 'Distortion map for vortex-rim', exact: true }).inputValue())
    expectEqual('reset-keeps-opacity', v, '0.4', await opacity.inputValue())
    expectEqual('reset-all-still-separate', v, 1, await page.getByTestId('pfx-emitter-reset').count())
    const afterReset = await copyRecipe(page)
    expectEqual('reset-restores-base-material', v, BASE_VORTEX, surfaceOf(afterReset.recipe, 'vortex-rim')?.tuning?.material)
    expectEqual('reset-keeps-opacity-json', v, 0.4, surfaceOf(afterReset.recipe, 'vortex-rim')?.opacity)

    // Portal throat: rim only, constants only, baseline defaults.
    await openLayerMaterial(page, 'aperture-depth', false)
    const throat = material(page, 'aperture-depth')
    expectEqual('throat-groups', v, ['Rim'], await throat.locator('fieldset > legend').allTextContents())
    await page.getByRole('checkbox', { name: 'Rim override for aperture-depth', exact: true }).check()
    expectEqual('throat-rim-defaults', v, { power: String(EXPECTED_THROAT_RIM.power), strength: String(EXPECTED_THROAT_RIM.strength) }, {
      power: await spin(page, 'Rim power for aperture-depth').inputValue(),
      strength: await spin(page, 'Rim strength for aperture-depth').inputValue(),
    })
    expectEqual('throat-no-life-curve', v, 0, await page.getByRole('combobox', { name: 'Rim strength curve type for aperture-depth' }).count())

    // Sprite layer: real atlas frame selection from the registry, life curves.
    await openLayerMaterial(page, 'depth-flow', false)
    const sprite = material(page, 'depth-flow')
    expectEqual('sprite-groups', v, ['Texture motion', 'Mask and dissolve'], await sprite.locator('fieldset > legend').allTextContents())
    const legacyNote = (await sprite.getByTestId('pfx-material-legacy-pulse').textContent()) ?? ''
    expectTrue('legacy-pulse-labelled', v, legacyNote, legacyNote.includes('Legacy pulse'))
    const frameSelect = page.getByRole('combobox', { name: 'Frame animation for depth-flow', exact: true })
    const frameOptions = await frameSelect.locator('option').allTextContents()
    expectEqual('frame-options-from-registry', v, [
      'No animation sheet (legacy pulse)',
      'unity-small-flame-64 · 64 frames · 22 fps',
      'unity-fireball-64 · 64 frames · 22 fps',
    ], frameOptions)
    await frameSelect.selectOption({ index: 1 })
    expectEqual('frame-blend-visible', v, 1, await page.getByRole('checkbox', { name: 'Frame blend for depth-flow', exact: true }).count())
    await page.getByRole('checkbox', { name: 'Dissolve for depth-flow', exact: true }).check()
    await page.getByRole('combobox', { name: 'Dissolve curve type for depth-flow', exact: true }).selectOption('life')
    await spin(page, 'Dissolve at age 1 for depth-flow').fill('0.9')
    const unavailable = await sprite.locator('.pfx-material-unavailable li').allTextContents()
    expectTrue('sprite-rim-reason', v, unavailable, unavailable.some((text) => text.includes('Rim override: A flat sprite has no rim.')))
    const spriteCopy = await copyRecipe(page)
    expectEqual('sprite-json-material', v, {
      dissolve: { map: 'noise-a', progress: { kind: 'life', values: [0, 0, 0.9] }, softness: 0.05, edgeWidth: 0.02, edgeColor: '#ffffff' },
      frameAnimation: { atlas: 'unity-small-flame-64', frameBlend: false },
    }, surfaceOf(spriteCopy.recipe, 'depth-flow')?.tuning?.material)
    expectEqual('sibling-layer-material-kept', v, EXPECTED_THROAT_RIM, surfaceOf(spriteCopy.recipe, 'aperture-depth')?.tuning?.material?.rim)

    // Legacy pulse label on the preset control.
    const presetLegacy = await page.locator('.pfx-controls label').filter({ hasText: 'Legacy pulse' }).count()
    const presetFlipbook = await page.locator('.pfx-controls label > span').filter({ hasText: /^Flipbook$/ }).count()
    expectEqual('preset-legacy-pulse-label', v, { legacyPulse: 1, flipbook: 0 }, { legacyPulse: presetLegacy, flipbook: presetFlipbook })

    // Layout: no horizontal overflow with three Material groups open.
    const layout = await overflow(page)
    expectEqual('no-horizontal-overflow', v, { page: 0, materialOverflow: [] }, layout)
    await shot(page, outputDir, `${v}-panel-open`, page.getByTestId('pfx-emitter-panel'))
    await shot(page, outputDir, `${v}-page`)
    const contrasts = await page.evaluate(`(() => {
      const channels = (value) => (value.match(/[0-9.]+/g) ?? []).map(Number)
      const luminance = (rgb) => rgb.slice(0, 3).map((channel) => {
        const value = channel / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0)
      return [...document.querySelectorAll('.pfx-material-path, .pfx-material-field abbr, .pfx-material-unavailable')]
        .filter((element) => element.getClientRects().length > 0)
        .map((element) => {
          let parent = element
          let background = [17, 24, 39]
          while (parent) {
            const rgb = channels(getComputedStyle(parent).backgroundColor)
            if (rgb.length === 3 || (rgb.length === 4 && rgb[3] === 1)) { background = rgb; break }
            parent = parent.parentElement
          }
          const foreground = channels(getComputedStyle(element).color)
          const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b)
          return { text: element.textContent?.trim(), ratio: (values[1] + 0.05) / (values[0] + 0.05) }
        })
    })()`) as Array<{ text: string | null; ratio: number }>
    expectTrue('material-secondary-text-contrast', v, contrasts, contrasts.length > 0 && contrasts.every((entry) => entry.ratio >= 4.5), 'all visible secondary material text has contrast >= 4.5:1')

    // Reset all stays the separate global action.
    await page.getByTestId('pfx-emitter-reset').click()
    const allReset = await copyRecipe(page)
    expectEqual('reset-all-restores-base-material', v, BASE_RECIPE.surfaces.map((surface) => surface.tuning?.material), allReset.recipe.surfaces.map((surface) => surface.tuning?.material))

    // Runtime status is measured by the preview probe.
    expectEqual('runtime-status-measured', v, 'default', await settledState(vortex))
    observe('runtime-status', v, await vortex.locator('[data-testid="pfx-material-default"]').textContent())
    await page.getByLabel('Preview mode', { exact: true }).selectOption('stress')
    expectTrue('stress-explains-layer-edit-scope', v, await page.getByTestId('pfx-material-stress-notice').textContent(), await page.getByTestId('pfx-material-stress-notice').isVisible())
    expectEqual('stress-does-not-show-unmeasured-inspector', v, 0, await page.getByTestId('pfx-emitter-panel').count())
    await page.getByLabel('Preview mode', { exact: true }).selectOption('single')
    expectEqual('single-restores-measured-inspector', v, 'default', await settledState(material(page, 'vortex-rim')))
  } finally {
    await context.close()
  }
  return watched
}

async function variantScenarios(browser: Browser, origin: string, viewport: (typeof VIEWPORTS)[number], outputDir: string): Promise<PageWatch[]> {
  const v = viewport.name
  const results: PageWatch[] = []

  // Reduced motion: decorative motion disabled with a reason; others stay.
  const reduced = await newContext(browser, origin, viewport, 'reduce')
  try {
    const page = await reduced.newPage()
    results.push(watch(page))
    await openDetail(page, origin)
    await openLayerMaterial(page, 'vortex-rim', false)
    await page.getByRole('checkbox', { name: 'UV transform for vortex-rim', exact: true }).check()
    expectEqual('reduced-uv-scroll-disabled', v, true, (await numeric(spin(page, 'UV scroll speed U (UV units per second) for vortex-rim'))).disabled)
    expectEqual('reduced-uv-scale-enabled', v, false, (await numeric(spin(page, 'UV scale U (multiplier) for vortex-rim'))).disabled)
    expectEqual('reduced-reason', v, 'Reduced motion stops this motion. Your values are saved.',
      (await page.getByTestId('pfx-material-reason-vortex-rim-uv').textContent())?.trim())
    await openLayerMaterial(page, 'depth-flow', false)
    expectEqual('reduced-frame-select-disabled', v, true, await page.getByRole('combobox', { name: 'Frame animation for depth-flow', exact: true }).isDisabled())
    expectEqual('reduced-dissolve-enabled', v, false, await page.getByRole('checkbox', { name: 'Dissolve for depth-flow', exact: true }).isDisabled())
    await shot(page, outputDir, `${v}-reduced-motion`, page.getByTestId('pfx-emitter-panel'))
  } finally {
    await reduced.close()
  }

  const context = await newContext(browser, origin, viewport, 'no-preference')
  try {
    const page = await context.newPage()
    results.push(watch(page))
    await openDetail(page, origin, '&materialQuality=low')
    expectEqual('query-low', v, { select: 'low', stage: 'low' }, {
      select: await page.getByRole('combobox', { name: 'Material quality', exact: true }).inputValue(),
      stage: await page.getByTestId('pfx-3d-stage').getAttribute('data-material-quality'),
    })
    await openDetail(page, origin, '&materialQuality=ultra')
    const qualityError = (await page.getByTestId('pfx-material-quality-error').textContent()) ?? ''
    expectTrue('query-invalid-alert', v, qualityError, qualityError.includes('"ultra"'))

    // Empty state: a layer whose path is unsupported.
    await page.goto(`${origin}?profileEffectIds=shield-break&reviewTimeMs=420&reviewCamera=three-quarter`)
    await page.getByTestId('pfx-emitter-panel').waitFor({ timeout: 30_000 })
    await openLayerMaterial(page, 'glass-shards', false)
    expectEqual('empty-state', v, 'empty', await material(page, 'glass-shards').getAttribute('data-state'))
    observe('empty-text', v, await page.getByTestId('pfx-material-empty').first().textContent())
    await openLayerMaterial(page, 'broken-shell', false)
    expectEqual('shell-groups', v, ['Mask and dissolve', 'Rim'], await material(page, 'broken-shell').locator('fieldset > legend').allTextContents())
    await page.getByRole('checkbox', { name: 'Rim override for broken-shell', exact: true }).check()
    expectEqual('shell-life-curve-allowed', v, 1, await page.getByRole('combobox', { name: 'Rim strength curve type for broken-shell', exact: true }).count())
    expectEqual('shell-rim-defaults', v, '3.4', await spin(page, 'Rim power for broken-shell').inputValue())
    await shot(page, outputDir, `${v}-shell-and-empty`, page.getByTestId('pfx-emitter-panel'))
    expectEqual('shell-no-overflow', v, { page: 0, materialOverflow: [] }, await overflow(page))

    // Pack effect: controls unavailable, stated. A pack ID in
    // profileEffectIds crashes the stress scenario in the baseline build too,
    // so this uses the normal feed route: search, then select the tile.
    const packId = 'burger-shop-character-footsteps'
    await page.goto(origin)
    await page.getByRole('textbox', { name: 'Search' }).fill(packId)
    await page.locator(`button[data-effect-id="${packId}"]`).click()
    await page.getByTestId('pfx-material-pack-unavailable').waitFor({ timeout: 30_000 })
    observe('pack-notice', v, { packId, text: await page.getByTestId('pfx-material-pack-unavailable').textContent(), emitterPanels: await page.getByTestId('pfx-emitter-panel').count() })
    expectEqual('pack-no-overflow', v, { page: 0, materialOverflow: [] }, await overflow(page))
  } finally {
    await context.close()
  }
  return results
}

// ---------------------------------------------------------------------------
// Pure edit-model checks for the cases no catalog recipe can show yet: no
// recipe sets `material` before T6, so the browser cannot show a removal of a
// base feature.

function editModelChecks(): void {
  const base = {
    uv: { scale: [1, 1] as [number, number], offset: [0, 0] as [number, number], rotation: 0, scroll: [0, 0.2] as [number, number], wrap: 'clamp' as const },
    dissolve: { map: 'noise-a' as const, progress: 0.2, softness: 0.05, edgeWidth: 0.02, edgeColor: '#ffffff' },
  }
  const removed = removePfxMaterialFeature(undefined, 'uv', base)
  expectEqual('model-remove-is-explicit', undefined, { uv: { op: 'remove' } }, removed)
  expectEqual('model-remove-applies', undefined, { dissolve: base.dissolve }, applyPfxMaterialLayerEdit(base, removed))
  expectEqual('model-absent-keeps-base', undefined, base, applyPfxMaterialLayerEdit(base, {}))
  const set = setPfxMaterialFeature(removed, 'dissolve', { ...base.dissolve, progress: 0.5 })
  expectEqual('model-set-keeps-siblings', undefined, { dissolve: { ...base.dissolve, progress: 0.5 } }, applyPfxMaterialLayerEdit(base, set))
  expectEqual('model-no-base-remove-drops-key', undefined, undefined, removePfxMaterialFeature({ mask: { op: 'set', value: { map: 'mask-a', channel: 'r', strength: 1 } } }, 'mask', undefined))
  expectEqual('model-no-base-empty-stays-absent', undefined, undefined, applyPfxMaterialLayerEdit(undefined, {}))
  expectEqual('model-quality-query', undefined, ['absent:high', 'valid:low', 'invalid:high'],
    ['', '?materialQuality=low', '?materialQuality=x'].map((search) => {
      const query = readPfxMaterialQualityQuery(search)
      return `${query.status}:${query.quality}`
    }))
}

// ---------------------------------------------------------------------------

async function main(): Promise<number> {
  let options: Options
  try {
    options = parseOptions(process.argv.slice(2))
  } catch (error) {
    console.error(String(error))
    return 64
  }
  if (fs.existsSync(options.output)) {
    console.error(`OutputExists: ${options.output}. Use a new folder.`)
    return 1
  }
  fs.mkdirSync(options.output, { recursive: true })
  const runToken = randomUUID()
  const startedAt = new Date().toISOString()
  const run: Record<string, unknown> = {
    schema: 'run-workshop.pfx-material-inspector-ui-run.v1',
    command: ['node', '--import', 'tsx', ...process.argv.slice(1).map((arg) => path.relative(packageRoot, arg) || arg)].join(' '),
    cwd: packageRoot,
    startedAt,
    runToken,
    source: {
      sha: execFileSync('git', ['rev-parse', 'HEAD']).toString().trim(),
      diffSha256: createHash('sha256').update(execFileSync('git', ['diff', 'HEAD', '--binary', '--', '.'], { maxBuffer: 256 * 1024 * 1024 })).digest('hex'),
    },
  }
  let browser: Browser | null = null
  let server: Awaited<ReturnType<typeof startOwnedViewer>> | null = null
  let status: 'pass' | 'fail' | 'blocked' = 'fail'
  const watches: Array<{ viewport: string; watch: PageWatch }> = []
  try {
    editModelChecks()
    server = await startOwnedViewer(options.port, options.output, runToken)
    run.server = { command: server.command, pid: server.pid, port: options.port, url: `http://${HOST}:${options.port}/` }
    const origin = `http://${HOST}:${options.port}/`
    browser = await chromium.launch({ headless: true })
    run.versions = {
      node: process.version,
      chromium: browser.version(),
      playwright: JSON.parse(fs.readFileSync(path.join(packageRoot, 'node_modules/playwright/package.json'), 'utf8')).version,
    }
    for (const viewport of VIEWPORTS) {
      watches.push({ viewport: viewport.name, watch: await mainScenario(browser, origin, viewport, options.output) })
      for (const watched of await variantScenarios(browser, origin, viewport, options.output)) watches.push({ viewport: viewport.name, watch: watched })
    }
    for (const viewport of VIEWPORTS) {
      const pageErrors = watches.filter((entry) => entry.viewport === viewport.name).flatMap((entry) => entry.watch.pageErrors)
      expectEqual('no-page-errors', viewport.name, [], pageErrors)
      observe('console-errors', viewport.name, watches.filter((entry) => entry.viewport === viewport.name).flatMap((entry) => entry.watch.consoleErrors))
    }
    status = checks.every((check) => check.kind === 'observation' || check.pass) ? 'pass' : 'fail'
  } catch (error) {
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
    status = message.startsWith('PortBusy') ? 'blocked' : 'fail'
    run.error = message
    console.error(message)
  } finally {
    if (browser) await browser.close()
    if (server) run.serverCleanup = await stopOwnedViewer(server.child, options.port)
  }
  run.coveredElsewhere = [
    'Material pixels, high/low/reduced output, measured loading/ready/error status, the real decode fault with Retry and stale results, copy, and replay through GamePfx, PfxById, and createGamePfxComponent: verify-material-controls.ts --case inspector.',
    'Depth fade pixels need a host depth source (T7).',
  ]
  run.status = status
  run.finishedAt = new Date().toISOString()
  run.checks = checks
  run.artifacts = artifacts
  fs.writeFileSync(path.join(options.output, 'run.json'), `${JSON.stringify(run, null, 2)}\n`)
  const failed = checks.filter((check) => check.kind === 'assert' && !check.pass)
  console.log(`status=${status} asserts=${checks.filter((check) => check.kind === 'assert').length} failed=${failed.length}`)
  return status === 'pass' ? 0 : 1
}

main().then((code) => process.exit(code), (error) => {
  console.error(error)
  process.exit(1)
})

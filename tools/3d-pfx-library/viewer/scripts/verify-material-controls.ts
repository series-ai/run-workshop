// Material-controls proof runner. See docs/material-controls-verification.md.
//
// The runner owns its Vite process on 127.0.0.1:48373 (strictPort). It never
// attaches to or stops an unknown server: a busy port is a named failure. Each
// run writes run.json with expected and observed results, the command, the
// source identity, and every artifact path. Cleanup runs in finally and keeps
// all evidence.
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { promises as fsp } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { chromium, type Browser, type Page } from 'playwright'
import { PNG } from 'pngjs'
import {
  PFX_FIREBALL_FLIPBOOK_ATLAS,
  PFX_FLAME_FLIPBOOK_ATLAS,
  PFX_PRESETS,
  PFX_SPRITE_ATLAS_DATA_URI,
  AUTHORED_EFFECT_RECIPES,
  createPfxAtlasRegistry,
  createPfxPreset,
  getPfxAtlasFrameIndex,
  getPfxFlipbookFrameProps,
  getPfxRenderPlan,
  parsePfxAuthoredRecipeJson,
  type PfxAtlasDescriptor,
  type PfxControls,
} from '../../src/index'
import { countPfxReviewActivePixels } from '../src/profiling'
import {
  CONSERVATIVE_EXCLUSIONS,
  DEFAULT_DEPTH_OPTIONS,
  MATERIAL_PROOF_EFFECTS,
  MATERIAL_PROOF_SEED,
  PROOF_ATLAS,
  PROOF_ATLAS_ID,
  PROOF_CORRUPT_ATLAS_ID,
  materialProofFrameToken,
  type DispatchRow,
  type MaterialProofCamera,
  type MaterialProofDepthOptions,
  type MaterialProofDepthProjection,
  type MaterialProofDepthReport,
  type MaterialProofEffect,
  type MaterialProofOracle,
  type MaterialProofRecipeSource,
  type MaterialProofSelection,
} from '../src/materialProofContract'
import type { CostEdit, MaterialProofScenario } from '../src/MaterialProofApp'

const packageRoot = process.cwd()
const HOST = '127.0.0.1'
const PORT = 48373
const ORIGIN = `http://${HOST}:${PORT}`
const RUN_SCHEMA = 'run-workshop.pfx-material-controls-run.v1'
const BEFORE_BATCH = 'material-controls-before'
const LEGACY_PULSE_NAMES = ['smoke-8', 'flame-8', 'magic-12', 'impact-6'] as const
const BASELINE_TIMES_MS = [100, 250, 500, 750] as const
const VIEWPORTS = [
  { id: 'mobile-390', width: 390, height: 844 },
  { id: 'desktop-1440', width: 1440, height: 900 },
] as const

// ---------------------------------------------------------------------------
// Cases and run record

const IMPLEMENTED_CASES = ['baseline', 'negative-control', 'capture', 'doctor', 'shader', 'cost', 'inspector', 'depth'] as const
const PLANNED_CASES = {} as const satisfies Record<string, string>
type ImplementedCase = (typeof IMPLEMENTED_CASES)[number]
type PlannedCase = keyof typeof PLANNED_CASES
type ProofCase = ImplementedCase | PlannedCase

type RunStatus = 'pass' | 'fail' | 'blocked' | 'not-implemented'
type CheckKind = 'assertion' | 'observation'
interface RunCheck {
  id: string
  kind: CheckKind
  expected: unknown
  observed: unknown
  status: 'pass' | 'fail' | 'observed'
}

type HarnessErrorCode =
  | 'Usage'
  | 'OutputExists'
  | 'PortBusy'
  | 'BatchExists'
  | 'SourceNotClean'
  | 'ServerExited'
  | 'ServerTimeout'
  | 'OwnershipMismatch'
  | 'PortNotReleased'
  | 'CaptureFailed'
const BLOCKING_CODES: ReadonlySet<HarnessErrorCode> = new Set(['OutputExists', 'PortBusy', 'BatchExists', 'SourceNotClean'])

class HarnessError extends Error {
  constructor(readonly code: HarnessErrorCode, message: string) {
    super(`${code}: ${message}`)
    this.name = `HarnessError(${code})`
  }
}

interface SourceIdentity {
  sha: string
  diffHash: string
  dirtyPaths: string[]
  packageSrcClean: boolean
  lockfileSha256: string
}

interface RunRecord {
  schema: typeof RUN_SCHEMA
  case: ProofCase
  status: RunStatus
  expectedOutcome: 'pass' | 'fail'
  startedAt: string
  finishedAt?: string
  command: string
  cwd: string
  runToken: string
  source: SourceIdentity
  versions: Record<string, string>
  inputs: Record<string, unknown>
  server?: Record<string, unknown>
  checks: RunCheck[]
  artifacts: string[]
  errors: string[]
  notes: string[]
}

interface Options {
  proofCase: ProofCase
  output: string
  batch?: string
  effects: string[]
  attachUrl?: string
  expectRunToken?: string
  expectSourceRevision?: string
  /** capture and doctor: forward `materialQuality` to the normal viewer and verify its selector. */
  quality?: 'low' | 'high'
}

// ---------------------------------------------------------------------------
// Entry

const options = parseOptions(process.argv.slice(2))
void main()

async function main(): Promise<void> {
  const outputDir = resolveEvidencePath(options.output)
  if (fs.existsSync(outputDir)) {
    process.stderr.write(`OutputExists: ${options.output} already exists. Evidence is never overwritten; choose a new --output.\n`)
    process.exitCode = 1
    return
  }
  await fsp.mkdir(outputDir, { recursive: true })
  const record: RunRecord = {
    schema: RUN_SCHEMA,
    case: options.proofCase,
    status: 'pass',
    expectedOutcome: options.proofCase === 'negative-control' ? 'fail' : 'pass',
    startedAt: new Date().toISOString(),
    command: [process.execPath, ...process.execArgv, ...process.argv.slice(1)].join(' '),
    cwd: packageRoot,
    runToken: `mc-${randomUUID()}`,
    source: readSourceIdentity(),
    versions: readVersions(),
    inputs: { ...options, port: PORT, host: HOST, seed: MATERIAL_PROOF_SEED },
    checks: [],
    artifacts: [],
    errors: [],
    notes: [],
  }
  const run = new RunContext(record, outputDir)
  const stopOnSignal = () => {
    run.server?.child.kill('SIGTERM')
    process.exit(130)
  }
  process.once('SIGINT', stopOnSignal)
  process.once('SIGTERM', stopOnSignal)
  try {
    if (options.proofCase in PLANNED_CASES) {
      const owner = PLANNED_CASES[options.proofCase as PlannedCase]
      record.status = 'not-implemented'
      record.notes.push(`Case ${options.proofCase} is planned for ${owner}. T1 does not implement it. No check ran and nothing passed.`)
    } else {
      await runImplementedCase(run, options.proofCase as ImplementedCase)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    record.errors.push(message)
    record.status = error instanceof HarnessError && BLOCKING_CODES.has(error.code) ? 'blocked' : 'fail'
  } finally {
    await run.cleanup()
    if (record.status === 'pass' && record.checks.some((check) => check.status === 'fail')) record.status = 'fail'
    if (record.status === 'pass' && record.errors.length > 0) record.status = 'fail'
    record.finishedAt = new Date().toISOString()
    await writeJsonAtomic(path.join(outputDir, 'run.json'), record)
    process.off('SIGINT', stopOnSignal)
    process.off('SIGTERM', stopOnSignal)
  }
  const failed = record.checks.filter((check) => check.status === 'fail').map((check) => check.id)
  process.stdout.write(
    `${relativeToPackage(path.join(outputDir, 'run.json'))}: case=${record.case} status=${record.status}` +
    `${failed.length > 0 ? ` failed=[${failed.join(', ')}]` : ''}${record.errors.length > 0 ? ` errors=${JSON.stringify(record.errors)}` : ''}\n`,
  )
  process.exitCode = record.status === 'pass' ? 0 : record.status === 'not-implemented' ? 2 : 1
}

async function runImplementedCase(run: RunContext, proofCase: ImplementedCase): Promise<void> {
  switch (proofCase) {
    case 'baseline':
      return baselineCase(run)
    case 'negative-control':
      return negativeControlCase(run)
    case 'capture':
      return captureCase(run)
    case 'doctor':
      return doctorCase(run)
    case 'shader':
      return shaderCase(run)
    case 'inspector':
      return inspectorCase(run)
    case 'cost':
      return costCase(run)
    case 'depth':
      return depthCase(run)
    default: {
      const unreachable: never = proofCase
      throw new HarnessError('Usage', `Unhandled case ${String(unreachable)}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Run context: owns the server, the browser, and evidence writes.

interface OwnedServer {
  child: ChildProcess
  pid: number
  logPath: string
}

class RunContext {
  server?: OwnedServer
  browser?: Browser
  readonly pageErrors: string[] = []

  constructor(readonly record: RunRecord, readonly outputDir: string) {}

  check(id: string, kind: CheckKind, expected: unknown, observed: unknown, passed?: boolean): boolean {
    const status = kind === 'observation' ? 'observed' : passed ? 'pass' : 'fail'
    this.record.checks.push({ id, kind, expected, observed, status })
    return status !== 'fail'
  }

  async writeArtifact(relative: string, contents: Buffer | string): Promise<string> {
    const target = path.join(this.outputDir, relative)
    await fsp.mkdir(path.dirname(target), { recursive: true })
    await fsp.writeFile(target, contents)
    const recorded = relativeToPackage(target)
    this.record.artifacts.push(recorded)
    return recorded
  }

  async startServer(): Promise<OwnedServer> {
    this.server = await startOwnedViewer(this.record, this.outputDir)
    this.record.artifacts.push(relativeToPackage(this.server.logPath))
    return this.server
  }

  async launchBrowser(): Promise<Browser> {
    this.browser = await chromium.launch({ headless: true })
    this.record.versions.chromium = this.browser.version()
    return this.browser
  }

  async newPage(
    viewport: { width: number; height: number },
    extra: { clipboardOrigin?: string; reducedMotion?: 'reduce' | 'no-preference' } = {},
  ): Promise<Page> {
    if (!this.browser) throw new Error('Browser is not running')
    const context = await this.browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      reducedMotion: extra.reducedMotion ?? 'no-preference',
    })
    // Clipboard permission only for the local viewer origin.
    if (extra.clipboardOrigin) await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: extra.clipboardOrigin })
    const page = await context.newPage()
    page.on('console', (message) => {
      if (message.type() === 'error') this.pageErrors.push(`console: ${message.text()}`)
    })
    page.on('pageerror', (error) => this.pageErrors.push(`pageerror: ${error.message}`))
    return page
  }

  async cleanup(): Promise<void> {
    const cleanup: Record<string, unknown> = {}
    try {
      await this.browser?.close()
      cleanup.browserClosed = this.browser ? true : 'not-started'
    } catch (error) {
      this.record.errors.push(`Browser close failed: ${String(error)}`)
    }
    if (this.server) {
      try {
        Object.assign(cleanup, await stopOwnedViewer(this.server))
      } catch (error) {
        this.record.errors.push(error instanceof Error ? error.message : String(error))
      }
    }
    this.record.server = { ...this.record.server, cleanup }
  }
}

// ---------------------------------------------------------------------------
// Owned Vite process

async function startOwnedViewer(record: RunRecord, outputDir: string): Promise<OwnedServer> {
  const listeners = listenerPids()
  if (listeners.length > 0 || await portAcceptsConnections()) {
    throw new HarnessError(
      'PortBusy',
      `${HOST}:${PORT} is busy (listener PIDs: ${listeners.join(', ') || 'unknown'}). ` +
      'The proof launcher does not attach to or stop an unknown server.',
    )
  }
  const logPath = path.join(outputDir, 'vite-server.log')
  const log = fs.createWriteStream(logPath)
  const viteBin = path.join(packageRoot, 'node_modules/vite/bin/vite.js')
  const args = [viteBin, '--host', HOST, '--port', String(PORT), '--strictPort']
  const child = spawn(process.execPath, args, {
    cwd: packageRoot,
    env: {
      ...process.env,
      VITE_PFX_RUN_TOKEN: record.runToken,
      VITE_PFX_SOURCE_REVISION: record.source.sha,
      VITE_PFX_SOURCE_DIFF: record.source.diffHash,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stdout?.pipe(log)
  child.stderr?.pipe(log)
  if (child.pid == null) throw new HarnessError('ServerExited', 'Vite did not start (no PID)')
  const server: OwnedServer = { child, pid: child.pid, logPath }
  record.server = { command: [process.execPath, ...args].join(' '), pid: child.pid, url: `${ORIGIN}/`, startedAt: new Date().toISOString() }
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new HarnessError('ServerExited', `Vite exited with code ${child.exitCode}; see ${relativeToPackage(logPath)}`)
    }
    if (await urlResponds(`${ORIGIN}/`)) break
    await delay(100)
  }
  if (!(await urlResponds(`${ORIGIN}/`))) {
    throw new HarnessError('ServerTimeout', `Vite did not answer at ${ORIGIN}/ within 30 s`)
  }
  const owned = listenerPids()
  record.server.ownership = { expectedPid: child.pid, listenerPids: owned }
  if (owned.length !== 1 || owned[0] !== child.pid) {
    throw new HarnessError('OwnershipMismatch', `Port ${PORT} listeners ${JSON.stringify(owned)} are not the child PID ${child.pid}`)
  }
  return server
}

async function stopOwnedViewer(server: OwnedServer): Promise<Record<string, unknown>> {
  const { child } = server
  let signal: string = 'none (already exited)'
  if (child.exitCode == null && child.signalCode == null) {
    signal = 'SIGTERM'
    child.kill('SIGTERM')
    if (!(await waitForExit(child, 5_000))) {
      signal = 'SIGKILL'
      child.kill('SIGKILL')
      await waitForExit(child, 5_000)
    }
  }
  let listeners = listenerPids()
  for (let attempt = 0; attempt < 50 && listeners.length > 0; attempt += 1) {
    await delay(100)
    listeners = listenerPids()
  }
  const result = {
    stopSignal: signal,
    exitCode: child.exitCode,
    exitSignal: child.signalCode,
    portClearAfter: listeners.length === 0,
    listenersAfter: listeners,
  }
  if (listeners.length > 0) {
    throw new HarnessError('PortNotReleased', `Port ${PORT} still has listeners ${listeners.join(', ')} after stopping PID ${server.pid}`)
  }
  return result
}

function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode != null || child.signalCode != null) return Promise.resolve(true)
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
}

function listenerPids(port = PORT): number[] {
  try {
    return execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .split('\n')
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0)
  } catch (error) {
    // lsof exits 1 with no output when nothing listens. Any other failure is
    // loud: ownership cannot be proved without it.
    const status = (error as { status?: number }).status
    const stdout = String((error as { stdout?: Buffer }).stdout ?? '')
    if (status === 1 && stdout.trim() === '') return []
    throw new Error(`lsof failed; cannot prove port ownership: ${String(error)}`)
  }
}

function portAcceptsConnections(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: HOST, port: PORT })
    socket.setTimeout(500)
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('timeout', () => { socket.destroy(); resolve(false) })
    socket.once('error', () => resolve(false))
  })
}

async function urlResponds(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(800) })
    return response.ok
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Read-only doctor. It only navigates and reads; it never edits the page.

interface DoctorExpectation {
  runToken?: string
  sourceRevision?: string
  sourceDiff?: string
  /** Viewer route: the materialQuality query and the visible selector value. */
  quality?: 'low' | 'high'
}

async function runDoctor(
  run: RunContext,
  page: Page,
  origin: string,
  route: 'proof' | 'viewer',
  expected: DoctorExpectation,
  label?: string,
): Promise<boolean> {
  const prefix = `${label ? `${label}:` : ''}doctor:${route}`
  const handshakeToken = route === 'proof'
    ? materialProofFrameToken({ proofCase: 'baseline-gamepfx', effectId: 'flame-burst', timeMs: 250, camera: 'three-quarter' })
    : `doctor-${run.record.runToken}`
  const url = new URL(`${origin}/`)
  if (route === 'proof') {
    url.searchParams.set('materialProof', '1')
  } else {
    url.searchParams.set('profileEffectIds', 'flame-burst')
    url.searchParams.set('reviewCamera', 'three-quarter')
    url.searchParams.set('reviewTimeMs', '250')
    url.searchParams.set('reviewFraming', 'isolated')
    url.searchParams.set('reviewCapture', '1')
    url.searchParams.set('reviewCaptureToken', handshakeToken)
    if (expected.quality) url.searchParams.set('materialQuality', expected.quality)
  }
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
  const canvasSelector = route === 'proof' ? '[data-testid="material-proof-stage"] canvas' : '[data-testid="pfx-3d-stage"] canvas'
  const datasetKey = route === 'proof' ? 'pfxProofFrame' : 'pfxReviewCaptureToken'
  let handshake: string | null = null
  try {
    await page.locator(canvasSelector).waitFor({ state: 'visible', timeout: 20_000 })
    await page.waitForFunction(
      ([selector, key, token]) => document.querySelector<HTMLCanvasElement>(selector)?.dataset[key] === token,
      [canvasSelector, datasetKey, handshakeToken] as const,
      { timeout: 20_000 },
    )
    handshake = handshakeToken
  } catch {
    handshake = await page.evaluate(
      ([selector, key]) => document.querySelector<HTMLCanvasElement>(selector)?.dataset[key] ?? null,
      [canvasSelector, datasetKey] as const,
    ).catch(() => null)
  }
  const observed = await page.evaluate((selector) => {
    const marker = document.documentElement.dataset
    const canvas = document.querySelector<HTMLCanvasElement>(selector)
    const gl = canvas ? (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) : null
    const debug = gl?.getExtension('WEBGL_debug_renderer_info')
    return {
      runToken: marker.pfxRunToken ?? null,
      sourceRevision: marker.pfxSourceRevision ?? null,
      sourceDiff: marker.pfxSourceDiff ?? null,
      webgl: gl
        ? {
            context: typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext ? 'webgl2' : 'webgl',
            contextLost: gl.isContextLost(),
            renderer: String(debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)),
          }
        : null,
      errorOverlays: document.querySelectorAll('vite-error-overlay').length,
    }
  }, canvasSelector)
  const results = [
    run.check(`${prefix}:run-token`, 'assertion', expected.runToken ?? 'any launcher run token', observed.runToken,
      observed.runToken != null && (expected.runToken == null || observed.runToken === expected.runToken)),
    run.check(`${prefix}:source-revision`, 'assertion', expected.sourceRevision ?? 'any source revision', observed.sourceRevision,
      observed.sourceRevision != null && (expected.sourceRevision == null || observed.sourceRevision === expected.sourceRevision)),
  ]
  if (expected.sourceDiff != null) {
    results.push(run.check(`${prefix}:source-diff`, 'assertion', expected.sourceDiff, observed.sourceDiff, observed.sourceDiff === expected.sourceDiff))
  }
  results.push(
    run.check(`${prefix}:webgl`, 'assertion', 'WebGL context available and not lost', observed.webgl,
      observed.webgl != null && !observed.webgl.contextLost),
    run.check(`${prefix}:rendered-frame-handshake`, 'assertion', handshakeToken, handshake, handshake === handshakeToken),
    run.check(`${prefix}:no-error-overlay`, 'assertion', 0, observed.errorOverlays, observed.errorOverlays === 0),
  )
  if (route === 'viewer' && expected.quality) {
    // The capture tool keeps this query; the doctor proves the page applied it.
    const selector = page.getByRole('combobox', { name: 'Material quality', exact: true })
    const quality = {
      selector: await selector.inputValue({ timeout: 10_000 }).catch(() => null),
      stage: await page.getByTestId('pfx-3d-stage').getAttribute('data-material-quality'),
      queryErrors: await page.getByTestId('pfx-material-quality-error').count(),
    }
    results.push(run.check(`${prefix}:material-quality`, 'assertion', { selector: expected.quality, stage: expected.quality, queryErrors: 0 }, quality,
      quality.selector === expected.quality && quality.stage === expected.quality && quality.queryErrors === 0))
  }
  return results.every(Boolean)
}

function ownedExpectation(record: RunRecord): DoctorExpectation {
  return { runToken: record.runToken, sourceRevision: record.source.sha, sourceDiff: record.source.diffHash, quality: options.quality }
}

// ---------------------------------------------------------------------------
// UI drive through the visible fixture controls.

async function driveSelection(page: Page, selection: MaterialProofSelection): Promise<void> {
  await page.getByLabel('Proof case').selectOption(selection.proofCase)
  await page.getByLabel('Effect').selectOption(selection.effectId)
  await page.getByLabel('Preview time (seconds)').fill(String(selection.timeMs / 1000))
  await page.getByLabel('Camera').selectOption(selection.camera)
  const token = materialProofFrameToken(selection)
  await page.waitForFunction(
    (expected) => document.querySelector<HTMLCanvasElement>('[data-testid="material-proof-stage"] canvas')
      ?.dataset.pfxProofFrame === expected,
    token,
    { timeout: 20_000 },
  )
  await page.evaluate(`new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))`)
}

interface FrameCapture {
  selection: MaterialProofSelection
  file: string
  png: PNG
  activePixels: number
  state: Record<string, unknown>
  renderInfo: unknown
  glErrors: string | null
}

async function captureSelection(
  run: RunContext,
  page: Page,
  folder: string,
  selection: MaterialProofSelection,
  suffix = '',
): Promise<FrameCapture> {
  await driveSelection(page, selection)
  const canvas = page.getByTestId('material-proof-stage').locator('canvas')
  const buffer = await canvas.screenshot({ type: 'png' })
  const png = PNG.sync.read(buffer)
  const file = await run.writeArtifact(
    `${folder}/${selection.effectId}-t${String(selection.timeMs).padStart(4, '0')}-${selection.camera}${suffix}.png`,
    buffer,
  )
  const state = JSON.parse(await page.getByTestId('material-proof-state').textContent() ?? '{}') as Record<string, unknown>
  const dataset = await canvas.evaluate((element: HTMLCanvasElement) => ({
    renderInfo: element.dataset.pfxProofRenderInfo ?? null,
    glErrors: element.dataset.pfxProofGlErrors ?? null,
  }))
  return {
    selection,
    file,
    png,
    activePixels: countPfxReviewActivePixels(png.data, png.width, png.height),
    state,
    renderInfo: dataset.renderInfo ? JSON.parse(dataset.renderInfo) : null,
    glErrors: dataset.glErrors,
  }
}

function differingPixels(a: PNG, b: PNG): number {
  if (a.width !== b.width || a.height !== b.height) return Number.POSITIVE_INFINITY
  let count = 0
  for (let index = 0; index < a.data.length; index += 4) {
    if (
      a.data[index] !== b.data[index] ||
      a.data[index + 1] !== b.data[index + 1] ||
      a.data[index + 2] !== b.data[index + 2] ||
      a.data[index + 3] !== b.data[index + 3]
    ) count += 1
  }
  return count
}

function selectionOf(effectId: MaterialProofEffect, timeMs: number, camera: MaterialProofCamera): MaterialProofSelection {
  return { proofCase: 'baseline-gamepfx', effectId, timeMs, camera }
}

// ---------------------------------------------------------------------------
// Cases

async function baselineCase(run: RunContext): Promise<void> {
  const { record } = run
  record.inputs.viewports = VIEWPORTS
  record.inputs.timesMs = BASELINE_TIMES_MS
  record.inputs.effects = MATERIAL_PROOF_EFFECTS
  record.notes.push(
    'Baseline images are observations of the current renderer, not feature passes.',
    'The legacy pulse table is the observed pulse baseline. It is not a failed frame-sheet test: no generic animation sheet exists.',
  )
  await writeSourceAudit(run)
  await run.startServer()
  await run.launchBrowser()
  for (const [viewportIndex, viewport] of VIEWPORTS.entries()) {
    const page = await run.newPage(viewport)
    if (viewportIndex === 0) await runDoctor(run, page, ORIGIN, 'viewer', ownedExpectation(record), viewport.id)
    await runDoctor(run, page, ORIGIN, 'proof', ownedExpectation(record), viewport.id)
    const plan: MaterialProofSelection[] = []
    for (const effectId of MATERIAL_PROOF_EFFECTS) {
      for (const timeMs of BASELINE_TIMES_MS) plan.push(selectionOf(effectId, timeMs, 'three-quarter'))
    }
    for (const effectId of ['flame-burst', 'portal-idle-loop'] as const) {
      for (const camera of ['front', 'side'] as const) plan.push(selectionOf(effectId, 250, camera))
    }
    const captures: FrameCapture[] = []
    for (const selection of plan) captures.push(await captureSelection(run, page, viewport.id, selection))

    const stateMismatches = captures
      .filter(({ selection, state }) =>
        state.effectId !== selection.effectId || state.timeMs !== selection.timeMs ||
        state.camera !== selection.camera || state.frameToken !== materialProofFrameToken(selection))
      .map(({ file }) => file)
    run.check(`${viewport.id}:ui-drive-state`, 'assertion', 'fixture state equals every driven selection', stateMismatches, stateMismatches.length === 0)

    const find = (effectId: string, timeMs: number, camera: string) =>
      captures.find(({ selection }) => selection.effectId === effectId && selection.timeMs === timeMs && selection.camera === camera)!
    const repeats: Array<{ file: string; repeat: string; differingPixels: number }> = []
    for (const [effectId, timeMs] of [['flame-burst', 250], ['portal-idle-loop', 500]] as const) {
      const first = find(effectId, timeMs, 'three-quarter')
      const repeat = await captureSelection(run, page, viewport.id, first.selection, '-repeat')
      repeats.push({ file: first.file, repeat: repeat.file, differingPixels: differingPixels(first.png, repeat.png) })
    }
    run.check(`${viewport.id}:same-selection-reproduces-image`, 'assertion', 'differingPixels 0 for each repeat', repeats,
      repeats.every((entry) => entry.differingPixels === 0))
    const early = find('flame-burst', 100, 'three-quarter')
    const late = find('flame-burst', 500, 'three-quarter')
    const timeDelta = differingPixels(early.png, late.png)
    run.check(`${viewport.id}:different-time-changes-image`, 'assertion', 'flame-burst 0.10 s and 0.50 s differ', { differingPixels: timeDelta }, timeDelta > 0)

    const glErrors = captures.filter((capture) => capture.glErrors != null).map(({ file, glErrors: count }) => ({ file, count }))
    run.check(`${viewport.id}:no-webgl-errors`, 'assertion', [], glErrors, glErrors.length === 0)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    run.check(`${viewport.id}:no-horizontal-overflow`, 'assertion', 0, overflow, overflow <= 0)
    run.check(`${viewport.id}:frames`, 'observation', null, captures.map((capture) => ({
      file: capture.file,
      activePixels: capture.activePixels,
      renderInfo: capture.renderInfo,
      legacyPulse: capture.state.legacyPulse,
      frameAnimationAtlases: capture.state.frameAnimationAtlases,
    })), undefined)
    await page.context().close()
  }
  run.check('page-errors', 'assertion', [], [...run.pageErrors], run.pageErrors.length === 0)
}

async function negativeControlCase(run: RunContext): Promise<void> {
  const { record } = run
  record.notes.push(
    'Negative control: the checks named negative-control:* are deliberately wrong. They must fail, and this run must exit nonzero.',
    'All other checks in this run must pass, so the failure comes from the detector and not from a broken harness.',
  )
  record.inputs.expectedFailingChecks = ['negative-control:images-equal-across-time', 'negative-control:doctor-wrong-token:run-token']
  await run.startServer()
  await run.launchBrowser()
  const page = await run.newPage(VIEWPORTS[0])
  await runDoctor(run, page, ORIGIN, 'proof', ownedExpectation(record))
  const early = await captureSelection(run, page, 'negative-control', selectionOf('flame-burst', 100, 'three-quarter'))
  const late = await captureSelection(run, page, 'negative-control', selectionOf('flame-burst', 500, 'three-quarter'))
  const delta = differingPixels(early.png, late.png)
  run.check('negative-control:images-equal-across-time', 'assertion', { differingPixels: 0 }, { differingPixels: delta }, delta === 0)
  // Re-run the doctor marker check with a wrong expected token.
  const wrong: DoctorExpectation = { ...ownedExpectation(record), runToken: `not-${record.runToken}` }
  const before = record.checks.length
  await runDoctor(run, page, ORIGIN, 'proof', wrong)
  for (const check of record.checks.slice(before)) check.id = check.id.replace('doctor:proof', 'negative-control:doctor-wrong-token')
  run.check('page-errors', 'assertion', [], [...run.pageErrors], run.pageErrors.length === 0)
}

async function doctorCase(run: RunContext): Promise<void> {
  const { record } = run
  if (options.attachUrl) {
    // Read-only attach: no process start, no stop, no edits.
    record.notes.push(`Read-only attach to ${options.attachUrl}. This run does not own or stop that server.`)
    const origin = new URL(options.attachUrl).origin
    if (!(await urlResponds(`${origin}/`))) {
      throw new HarnessError('ServerTimeout', `${origin}/ did not answer; the doctor does not start a server in attach mode`)
    }
    await run.launchBrowser()
    const page = await run.newPage(VIEWPORTS[0])
    const expected = { runToken: options.expectRunToken, sourceRevision: options.expectSourceRevision, quality: options.quality }
    await runDoctor(run, page, origin, 'viewer', expected)
    await runDoctor(run, page, origin, 'proof', expected)
    return
  }
  await run.startServer()
  await run.launchBrowser()
  const page = await run.newPage(VIEWPORTS[0])
  await runDoctor(run, page, ORIGIN, 'viewer', ownedExpectation(record))
  await runDoctor(run, page, ORIGIN, 'proof', ownedExpectation(record))
  run.check('page-errors', 'assertion', [], [...run.pageErrors], run.pageErrors.length === 0)
}

async function captureCase(run: RunContext): Promise<void> {
  const { record } = run
  const batch = options.batch
  if (!batch || !/^[a-z0-9][a-z0-9-]*$/.test(batch)) throw new HarnessError('Usage', 'capture requires --batch <lowercase-id>')
  if (options.effects.length === 0) throw new HarnessError('Usage', 'capture requires --effect <id[,id]>')
  if (batch === BEFORE_BATCH && options.quality) {
    throw new HarnessError('Usage', `${BEFORE_BATCH} keeps the original viewer URL; do not pass --quality`)
  }
  const batchRelative = `.context/quality/${batch}`
  if (fs.existsSync(path.join(packageRoot, batchRelative))) {
    throw new HarnessError('BatchExists', `${batchRelative} already exists; quality batches are never overwritten`)
  }
  if (batch === BEFORE_BATCH) {
    const cleanCheck = run.check('before-batch:package-src-unchanged', 'assertion', 'git status of src/ is clean against HEAD',
      { packageSrcClean: record.source.packageSrcClean, sha: record.source.sha }, record.source.packageSrcClean)
    if (!cleanCheck) throw new HarnessError('SourceNotClean', `${BEFORE_BATCH} must be captured before any src/ change`)
  }
  await run.startServer()
  const server = run.server!
  await run.launchBrowser()
  let page = await run.newPage(VIEWPORTS[0])
  const preDoctor = await runDoctor(run, page, ORIGIN, 'viewer', ownedExpectation(record), 'pre-capture')
  await page.context().close()
  if (!preDoctor) throw new HarnessError('OwnershipMismatch', 'The pre-capture doctor failed; capture did not run')

  // Sample the port owner during capture. A different listener means the
  // capture tool reached a server this run does not own.
  const ownerSamples: Array<{ at: string; listenerPids: number[] }> = []
  const monitor = setInterval(() => ownerSamples.push({ at: new Date().toISOString(), listenerPids: listenerPids() }), 1_000)
  const captureUrl = options.quality ? `${ORIGIN}/?materialQuality=${options.quality}` : `${ORIGIN}/`
  const captureArgs = ['run', 'quality:capture', '--', '--effect', options.effects.join(','), '--batch', batch, '--url', captureUrl]
  const started = Date.now()
  let captureExit: number | null
  try {
    captureExit = await runLogged('npm', captureArgs, path.join(run.outputDir, 'quality-capture.log'))
  } finally {
    clearInterval(monitor)
  }
  run.record.artifacts.push(relativeToPackage(path.join(run.outputDir, 'quality-capture.log')))
  record.inputs.captureCommand = { command: `npm ${captureArgs.join(' ')}`, cwd: packageRoot, exitCode: captureExit, durationMs: Date.now() - started }
  run.check('capture:exit-code', 'assertion', 0, captureExit, captureExit === 0)
  const foreignSamples = ownerSamples.filter((sample) => sample.listenerPids.length !== 1 || sample.listenerPids[0] !== server.pid)
  run.check('capture:owned-server-throughout', 'assertion', `only PID ${server.pid} listens on ${PORT} during capture`,
    { samples: ownerSamples.length, foreignSamples }, ownerSamples.length > 0 && foreignSamples.length === 0)

  page = await run.newPage(VIEWPORTS[0])
  await runDoctor(run, page, ORIGIN, 'viewer', ownedExpectation(record), 'post-capture')
  await page.context().close()
  if (captureExit !== 0) throw new HarnessError('CaptureFailed', `quality:capture exited ${captureExit}`)

  const manifestPath = path.join(packageRoot, batchRelative, 'manifest.json')
  const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8')) as {
    schema: string
    batchId: string
    effects: Array<{
      effectId: string
      sourceFingerprint: string
      lifecycleCaptures: Array<{ file: string }>
      gameplayContextCaptures: Array<{ file: string }>
      reducedMotionCapture?: { file: string }
    }>
  }
  const files = manifest.effects.flatMap((effect) => [
    ...effect.lifecycleCaptures,
    ...effect.gameplayContextCaptures,
    ...(effect.reducedMotionCapture ? [effect.reducedMotionCapture] : []),
  ].map((capture) => capture.file))
  const missing = files.filter((file) => !fs.existsSync(path.join(packageRoot, file)))
  run.check('capture:manifest-effects', 'assertion', options.effects, manifest.effects.map((effect) => effect.effectId),
    JSON.stringify(manifest.effects.map((effect) => effect.effectId)) === JSON.stringify(options.effects))
  run.check('capture:manifest-files-exist', 'assertion', { files: options.effects.length * 11, missing: [] }, { files: files.length, missing },
    files.length === options.effects.length * 11 && missing.length === 0)
  const provenance = {
    schema: 'run-workshop.pfx-material-controls-capture-provenance.v1',
    batch,
    manifest: relativeToPackage(manifestPath),
    manifestSha256: sha256(await fsp.readFile(manifestPath)),
    manifestSchema: manifest.schema,
    sourceFingerprints: Object.fromEntries(manifest.effects.map((effect) => [effect.effectId, effect.sourceFingerprint])),
    files: Object.fromEntries(await Promise.all(files.map(async (file) => [file, sha256(await fsp.readFile(path.join(packageRoot, file)))]))),
    runToken: record.runToken,
    serverPid: server.pid,
    captureUrl,
    materialQuality: options.quality ?? 'viewer default (no materialQuality query)',
    source: { sha: record.source.sha, diffHash: record.source.diffHash },
  }
  await run.writeArtifact('capture-provenance.json', `${JSON.stringify(provenance, null, 2)}\n`)
  run.check('page-errors', 'assertion', [], [...run.pageErrors], run.pageErrors.length === 0)
}

// ---------------------------------------------------------------------------
// T3/T4 proof drive. Every input goes through the visible fixture controls.

interface ProofDrive {
  proofCase: MaterialProofSelection['proofCase']
  effectId?: MaterialProofEffect
  timeMs: number
  camera: MaterialProofCamera
  scenario?: MaterialProofScenario
  quality?: 'low' | 'high'
  reducedMotion?: boolean
  oracle?: MaterialProofOracle
  /** baseline-gamepfx only. */
  recipeSource?: MaterialProofRecipeSource
}

interface ProofLayers {
  frame: number
  token: string
  layers: Array<{
    layer: string
    tags: string[]
    materials: string[]
    geometries: string[]
    defines: string[]
    samplers: string[]
    opacity: number | null
    binding: { disabled?: Array<{ setting: string; reason: string }> } | null
  }>
  disposedMaterials: string[]
  materialMaps: { maps: number; hostAtlasTextures: number }
}

interface ProofCapture {
  name: string
  file: string
  png: PNG
  state: Record<string, unknown>
  layers: ProofLayers
  renderInfo: { drawCalls: number; programs: number | null; geometries: number; textures: number }
  glErrors: string | null
}

const PROOF_CANVAS = '[data-testid="material-proof-stage"] canvas'

async function readProofState(page: Page): Promise<Record<string, unknown>> {
  return JSON.parse(await page.getByTestId('material-proof-state').textContent() ?? '{}') as Record<string, unknown>
}

/** Waits until the canvas acknowledged the token that the page state shows. */
async function waitForProofFrame(page: Page, previousToken?: string): Promise<string> {
  const token = await page.waitForFunction(
    ([selector, previous]) => {
      const state = JSON.parse(document.querySelector('[data-testid="material-proof-state"]')?.textContent ?? '{}') as { frameToken?: string }
      const canvas = document.querySelector<HTMLCanvasElement>(selector)
      if (!state.frameToken || state.frameToken === previous) return null
      return canvas?.dataset.pfxProofFrame === state.frameToken ? state.frameToken : null
    },
    [PROOF_CANVAS, previousToken ?? null] as const,
    { timeout: 60_000 },
  )
  await page.evaluate(`new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))`)
  return (await token.jsonValue()) as string
}

async function driveProof(page: Page, drive: ProofDrive): Promise<void> {
  await page.getByLabel('Proof case').selectOption(drive.proofCase)
  if (drive.proofCase !== 'material-gamepfx' && drive.effectId) await page.getByLabel('Effect').selectOption(drive.effectId)
  await page.getByLabel('Preview time (seconds)').fill(String(drive.timeMs / 1000))
  await page.getByLabel('Camera').selectOption(drive.camera)
  if (drive.proofCase === 'baseline-gamepfx') await page.getByLabel('Recipe source').selectOption(drive.recipeSource ?? 'catalog')
  if (drive.proofCase !== 'baseline-gamepfx') {
    if (drive.proofCase === 'material-gamepfx' && drive.scenario) await page.getByLabel('Material scenario').selectOption(drive.scenario)
    await page.getByLabel('Material quality').selectOption(drive.quality ?? 'low')
    await page.getByLabel('Reduced motion').setChecked(drive.reducedMotion ?? false)
  }
  if (drive.proofCase === 'frame-oracle') {
    const oracle = drive.oracle!
    await page.getByLabel('Particle variant').selectOption(String(oracle.variant))
    await page.getByLabel('Sprite size').selectOption(oracle.size)
    await page.getByLabel('UV transform').selectOption(oracle.uv)
    await page.getByLabel('Frame blend').setChecked(oracle.frameBlend)
    await page.getByLabel('Particle duration').selectOption(String(oracle.duration ?? 1))
  }
  await waitForProofFrame(page)
}

async function captureProof(run: RunContext, page: Page, folder: string, name: string): Promise<ProofCapture> {
  const canvas = page.locator(PROOF_CANVAS)
  const buffer = await canvas.screenshot({ type: 'png' })
  const file = await run.writeArtifact(`${folder}/${name}.png`, buffer)
  const dataset = await canvas.evaluate((element: HTMLCanvasElement) => ({
    layers: element.dataset.pfxProofLayers ?? null,
    renderInfo: element.dataset.pfxProofRenderInfo ?? null,
    glErrors: element.dataset.pfxProofGlErrors ?? null,
  }))
  return {
    name,
    file,
    png: PNG.sync.read(buffer),
    state: await readProofState(page),
    layers: JSON.parse(dataset.layers ?? '{"layers":[]}') as ProofLayers,
    renderInfo: JSON.parse(dataset.renderInfo ?? '{}') as ProofCapture['renderInfo'],
    glErrors: dataset.glErrors,
  }
}

async function driveAndCapture(run: RunContext, page: Page, folder: string, name: string, drive: ProofDrive): Promise<ProofCapture> {
  await driveProof(page, drive)
  return captureProof(run, page, folder, name)
}

// ---------------------------------------------------------------------------
// Proof-atlas frame classifier. The fixture draws each frame in a unique
// colour with a black numeral and a magenta sentinel ring. The atlas texture
// is sRGB, the sprite shader writes linear values, and blending is additive,
// so (pixel - background) keeps each frame colour's linear chromaticity.

type Vec3 = [number, number, number]

function srgbToLinear(value: number): number {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function linearHex(hex: string): Vec3 {
  const value = Number.parseInt(hex.slice(1), 16)
  return [srgbToLinear((value >> 16) & 0xff), srgbToLinear((value >> 8) & 0xff), srgbToLinear(value & 0xff)]
}

function normalized(vector: Vec3): Vec3 {
  const max = Math.max(...vector)
  return max > 0 ? [vector[0] / max, vector[1] / max, vector[2] / max] : [0, 0, 0]
}

interface FrameClass {
  id: string
  vector: Vec3
}

function proofFrameClasses(extra: FrameClass[] = []): FrameClass[] {
  return [
    ...PROOF_ATLAS.frameColors.map((hex, frame) => ({ id: `frame-${frame}`, vector: normalized(linearHex(hex)) })),
    { id: 'sentinel', vector: normalized(linearHex(PROOF_ATLAS.sentinel)) },
    ...extra,
  ]
}

function blendClass(a: number, b: number, weight: number): FrameClass {
  const ca = linearHex(PROOF_ATLAS.frameColors[a]!)
  const cb = linearHex(PROOF_ATLAS.frameColors[b]!)
  return { id: `blend-${a}-${b}`, vector: normalized([ca[0] + (cb[0] - ca[0]) * weight, ca[1] + (cb[1] - ca[1]) * weight, ca[2] + (cb[2] - ca[2]) * weight]) }
}

const CLASSIFY_SIGNAL = 0.12
const CLASSIFY_DISTANCE = 0.3

function classifyProofPixels(png: PNG, classes: FrameClass[]): Record<string, number> {
  const bg = [png.data[0]!, png.data[1]!, png.data[2]!]
  const counts: Record<string, number> = {}
  for (let index = 0; index < png.data.length; index += 4) {
    const delta: Vec3 = [
      Math.max(0, png.data[index]! - bg[0]!) / 255,
      Math.max(0, png.data[index + 1]! - bg[1]!) / 255,
      Math.max(0, png.data[index + 2]! - bg[2]!) / 255,
    ]
    if (Math.max(...delta) < CLASSIFY_SIGNAL) continue
    const direction = normalized(delta)
    let best = 'unclassified'
    let bestDistance = CLASSIFY_DISTANCE
    for (const entry of classes) {
      const distance = Math.hypot(direction[0] - entry.vector[0], direction[1] - entry.vector[1], direction[2] - entry.vector[2])
      if (distance < bestDistance) {
        best = entry.id
        bestDistance = distance
      }
    }
    counts[best] = (counts[best] ?? 0) + 1
  }
  return counts
}

/** The public oracle needs only the rate and count; this registry mirrors the fixture's. */
function proofOracleDescriptor(): PfxAtlasDescriptor {
  const width = PROOF_ATLAS.columns * PROOF_ATLAS.cellPixels
  const height = PROOF_ATLAS.rows * PROOF_ATLAS.cellPixels
  const png = new PNG({ width, height })
  const registry = createPfxAtlasRegistry([{
    id: PROOF_ATLAS_ID,
    imageSource: `data:image/png;base64,${PNG.sync.write(png).toString('base64')}`,
    width,
    height,
    columns: PROOF_ATLAS.columns,
    rows: PROOF_ATLAS.rows,
    frameCount: PROOF_ATLAS.frameCount,
    frameRate: PROOF_ATLAS.frameRate,
    frameOrder: 'row-major-top-left',
    cellInset: PROOF_ATLAS.cellInset,
  }])
  return registry.lookup(PROOF_ATLAS_ID)!
}

/**
 * One particle, lifetime 1, timing 1, duration multiplier aLife.y: the
 * continuous clock gives duration d = max(0.2, d), progress = fract(t / d +
 * variant), and actual age = progress * d, as the sprite vertex shader does.
 */
function expectedProofFrame(descriptor: PfxAtlasDescriptor, timeSeconds: number, variant: number, duration = 1): number {
  const d = Math.max(0.2, duration)
  const phase = timeSeconds / d + variant
  return getPfxAtlasFrameIndex(descriptor, (phase - Math.floor(phase)) * d, variant)
}

/** The T3 formula: progress * lifetime (1), which ignores the particle duration. */
function progressTimesLifetimeFrame(descriptor: PfxAtlasDescriptor, timeSeconds: number, variant: number, duration: number): number {
  const phase = timeSeconds / Math.max(0.2, duration) + variant
  return getPfxAtlasFrameIndex(descriptor, phase - Math.floor(phase), variant)
}

// ---------------------------------------------------------------------------
// Contact sheets (nearest-neighbour tiles, labels in the file index).

function contactSheet(images: PNG[], columns: number, tile = 192): Buffer {
  const rows = Math.ceil(images.length / columns)
  const sheet = new PNG({ width: columns * tile, height: rows * tile })
  sheet.data.fill(0)
  for (let index = 3; index < sheet.data.length; index += 4) sheet.data[index] = 255
  images.forEach((image, index) => {
    const ox = (index % columns) * tile
    const oy = Math.floor(index / columns) * tile
    for (let y = 0; y < tile; y += 1) {
      for (let x = 0; x < tile; x += 1) {
        const sx = Math.min(image.width - 1, Math.floor((x / tile) * image.width))
        const sy = Math.min(image.height - 1, Math.floor((y / tile) * image.height))
        const from = (sy * image.width + sx) * 4
        const to = ((oy + y) * sheet.width + ox + x) * 4
        sheet.data[to] = image.data[from]!
        sheet.data[to + 1] = image.data[from + 1]!
        sheet.data[to + 2] = image.data[from + 2]!
        sheet.data[to + 3] = 255
      }
    }
  })
  return PNG.sync.write(sheet)
}

async function writeContactSheet(run: RunContext, name: string, captures: ProofCapture[], columns = 4): Promise<void> {
  await run.writeArtifact(`contact-sheets/${name}.png`, contactSheet(captures.map((capture) => capture.png), columns))
  await run.writeArtifact(`contact-sheets/${name}.json`, `${JSON.stringify(captures.map((capture, index) => ({ index, name: capture.name, file: capture.file })), null, 2)}\n`)
}

function layerOf(capture: ProofCapture, layer: string) {
  const entry = capture.layers.layers.find((candidate) => candidate.layer === layer)
  if (!entry) throw new Error(`${capture.name}: no diagnostics for layer ${layer}`)
  return entry
}

// ---------------------------------------------------------------------------
// Case: shader (V3 for T3 and T4).

const T1_BASELINE_DIR = '.context/material-controls/t1/final/baseline'

const ORACLE_BASE: MaterialProofOracle = { variant: 0, frameBlend: false, size: 'large', uv: 'none' }

interface OracleSpec {
  name: string
  timeMs: number
  oracle: MaterialProofOracle
  reducedMotion?: boolean
  /** Expected dominant class. Default: the public oracle frame. */
  expectClass?: string
  extraClasses?: FrameClass[]
  /**
   * Blend partners. A blended frame shows a partner colour where the other
   * frame's black numeral is (0.5 * black + 0.5 * partner keeps its hue).
   */
  partners?: string[]
}

async function shaderCase(run: RunContext): Promise<void> {
  const { record } = run
  const referenceRoot = path.join(packageRoot, T1_BASELINE_DIR)
  if (!fs.existsSync(referenceRoot)) throw new HarnessError('Usage', `T1 baseline reference ${T1_BASELINE_DIR} is missing`)
  record.inputs.viewports = VIEWPORTS
  record.inputs.referenceBaseline = T1_BASELINE_DIR
  record.notes.push(
    'Every image comes from the real production renderer in headless Chromium (SwiftShader). Local results are diagnostic, not physical-device evidence.',
    'The frame oracle mounts the production sprite material and geometry factories with one particle; the proof atlas enters through the public registry and provider.',
    'Material scenarios use GamePfx recipeOverride through the normal PfxSurface dispatch.',
  )
  const descriptor = proofOracleDescriptor()
  await run.startServer()
  await run.launchBrowser()
  const samplerReport: Record<string, unknown> = {}
  for (const [viewportIndex, viewport] of VIEWPORTS.entries()) {
    const page = await run.newPage(viewport)
    await runDoctor(run, page, ORIGIN, 'proof', ownedExpectation(record), viewport.id)
    const errorsBefore = run.pageErrors.length

    // B. No-feature output equals the pre-change T1 images at the same times.
    const baselineDiffs: Array<{ file: string; reference: string; referenceSha256: string; differingPixels: number }> = []
    const baselinePlan: Array<[MaterialProofEffect, number, MaterialProofCamera]> = []
    for (const effectId of MATERIAL_PROOF_EFFECTS) for (const timeMs of BASELINE_TIMES_MS) baselinePlan.push([effectId, timeMs, 'three-quarter'])
    for (const effectId of ['flame-burst', 'portal-idle-loop'] as const) for (const camera of ['front', 'side'] as const) baselinePlan.push([effectId, 250, camera])
    for (const [effectId, timeMs, camera] of baselinePlan) {
      const name = `${effectId}-t${String(timeMs).padStart(4, '0')}-${camera}`
      // T6 gives the pilots material settings. The frozen T1 images show the
      // source without them, so this compare removes every tuning.material.
      const capture = await driveAndCapture(run, page, `${viewport.id}/baseline-compare`, name, { proofCase: 'baseline-gamepfx', effectId, timeMs, camera, recipeSource: 'no-material' })
      const referencePath = path.join(referenceRoot, viewport.id, `${name}.png`)
      const referenceBuffer = await fsp.readFile(referencePath)
      baselineDiffs.push({
        file: capture.file,
        reference: relativeToPackage(referencePath),
        referenceSha256: sha256(referenceBuffer),
        differingPixels: differingPixels(capture.png, PNG.sync.read(referenceBuffer)),
      })
    }
    run.check(`${viewport.id}:no-feature-output-equals-pre-change`, 'assertion', 'differingPixels 0 against every T1 baseline image',
      baselineDiffs, baselineDiffs.length === baselinePlan.length && baselineDiffs.every((entry) => entry.differingPixels === 0))

    // C. Frame oracle through the production factories.
    const specs: OracleSpec[] = [
      ...[100, 250, 500, 750].map((timeMs) => ({ name: `identity-t${timeMs}`, timeMs, oracle: ORACLE_BASE })),
      ...[50, 300, 550].map((timeMs) => ({ name: `variant05-t${timeMs}`, timeMs, oracle: { ...ORACLE_BASE, variant: 0.5 as const } })),
      // t = -0.40: age fract(-0.4) = 0.6, before the additive shrink-out.
      { name: 'negative-time-t-400', timeMs: -400, oracle: ORACLE_BASE },
      ...[500, 750].map((timeMs) => ({ name: `reduced-motion-t${timeMs}`, timeMs, oracle: ORACLE_BASE, reducedMotion: true, expectClass: 'frame-0' })),
      ...[100, 250, 500, 750].map((timeMs) => ({ name: `minified-t${timeMs}`, timeMs, oracle: { ...ORACLE_BASE, size: 'small' as const } })),
      { name: 'rotate-clamp-t250', timeMs: 250, oracle: { ...ORACLE_BASE, uv: 'rotate-clamp' as const } },
      { name: 'repeat-tiles-t500', timeMs: 500, oracle: { ...ORACLE_BASE, uv: 'repeat-tiles' as const } },
      { name: 'minified-repeat-tiles-t500', timeMs: 500, oracle: { ...ORACLE_BASE, size: 'small' as const, uv: 'repeat-tiles' as const } },
      { name: 'no-blend-t375', timeMs: 375, oracle: ORACLE_BASE },
      { name: 'blend-t375', timeMs: 375, oracle: { ...ORACLE_BASE, frameBlend: true }, expectClass: 'blend-1-2', extraClasses: [blendClass(1, 2, 0.5)], partners: ['frame-1', 'frame-2'] },
      { name: 'blend-t250', timeMs: 250, oracle: { ...ORACLE_BASE, frameBlend: true }, extraClasses: [blendClass(1, 2, 0.5)] },
      { name: 'blend-minified-t375', timeMs: 375, oracle: { ...ORACLE_BASE, frameBlend: true, size: 'small' as const }, expectClass: 'blend-1-2', extraClasses: [blendClass(1, 2, 0.5)], partners: ['frame-1', 'frame-2'] },
      // Duration variation (T7 age correction): aLife.y 0.5 and 2. Progress
      // stays <= 0.6, before the additive shrink-out.
      ...[150, 280].map((timeMs) => ({ name: `duration05-t${timeMs}`, timeMs, oracle: { ...ORACLE_BASE, duration: 0.5 as const } })),
      ...[750, 1100].map((timeMs) => ({ name: `duration2-t${timeMs}`, timeMs, oracle: { ...ORACLE_BASE, duration: 2 as const } })),
    ]
    const oracleCaptures: ProofCapture[] = []
    const oracleRows: Array<Record<string, unknown>> = []
    for (const spec of specs) {
      const capture = await driveAndCapture(run, page, `${viewport.id}/frame-oracle`, spec.name, {
        proofCase: 'frame-oracle',
        timeMs: spec.timeMs,
        camera: 'front',
        oracle: spec.oracle,
        reducedMotion: spec.reducedMotion ?? false,
      })
      oracleCaptures.push(capture)
      const oracleFrame = expectedProofFrame(descriptor, spec.timeMs / 1000, spec.oracle.variant, spec.oracle.duration ?? 1)
      const expected = spec.expectClass ?? `frame-${oracleFrame}`
      const counts = classifyProofPixels(capture.png, proofFrameClasses(spec.extraClasses))
      const classified = Object.entries(counts).filter(([id]) => id !== 'unclassified').reduce((sum, [, count]) => sum + count, 0)
      const allowed = new Set([expected, 'unclassified', 'sentinel', ...(spec.partners ?? [])])
      const foreign = Object.entries(counts).filter(([id]) => !allowed.has(id))
      oracleRows.push({
        name: spec.name,
        file: capture.file,
        timeSeconds: spec.timeMs / 1000,
        variant: spec.oracle.variant,
        duration: spec.oracle.duration ?? 1,
        oracleFrame,
        progressTimesLifetimeFrame: progressTimesLifetimeFrame(descriptor, spec.timeMs / 1000, spec.oracle.variant, spec.oracle.duration ?? 1),
        expectedClass: expected,
        partners: spec.partners ?? [],
        counts,
        dominantShare: classified > 0 ? (counts[expected] ?? 0) / classified : 0,
        foreign,
        sentinel: counts.sentinel ?? 0,
        defines: capture.layers.layers[0]?.defines ?? [],
        samplers: capture.layers.layers[0]?.samplers ?? [],
      })
    }
    const oracleFailures = oracleRows.filter((row) =>
      (row.dominantShare as number) < 0.9 || (row.foreign as unknown[]).length > 0 || (row.sentinel as number) > 0)
    run.check(`${viewport.id}:frame-oracle`, 'assertion',
      'each image: expected frame (public oracle floor(mod(age*rate + floor(variant*11), count))) has >= 90% of classified pixels; 0 pixels of any other frame; 0 sentinel pixels',
      { rows: oracleRows.length, failures: oracleFailures }, oracleFailures.length === 0)
    const identityFrames = oracleRows.slice(0, 4).map((row) => row.oracleFrame)
    run.check(`${viewport.id}:frame-oracle-identity-indexes`, 'assertion', [0, 1, 2, 3], identityFrames,
      JSON.stringify(identityFrames) === '[0,1,2,3]')
    const variantFrames = oracleRows.slice(4, 8).map((row) => row.oracleFrame)
    run.check(`${viewport.id}:frame-oracle-last-wrap-negative`, 'assertion', 'variant 0.5: last frame 7, wrap to 0, then 5; t=-0.40: frame 2',
      variantFrames, JSON.stringify(variantFrames) === '[7,0,5,2]')
    // The rendered frames above follow actual age. Each duration row is a
    // case where progress * lifetime would select a different frame.
    const durationRows = oracleRows.filter((row) => row.duration !== 1)
      .map((row) => ({ name: row.name, duration: row.duration, ageFrame: row.oracleFrame, progressTimesLifetimeFrame: row.progressTimesLifetimeFrame, dominantShare: row.dominantShare }))
    run.check(`${viewport.id}:frame-oracle-duration-variation`, 'assertion',
      'durations 0.5 and 2: rendered frame = floor(actual age * fps) (>= 90% share), and differs from progress * lifetime',
      durationRows,
      durationRows.length === 4 && durationRows.every((row) => row.ageFrame !== row.progressTimesLifetimeFrame && (row.dominantShare as number) >= 0.9))
    await run.writeArtifact(`${viewport.id}/frame-oracle/oracle-report.json`, `${JSON.stringify(oracleRows, null, 2)}\n`)
    await writeContactSheet(run, `${viewport.id}-frame-oracle`, oracleCaptures, 6)
    const repeat = await driveAndCapture(run, page, `${viewport.id}/frame-oracle`, 'identity-t250-repeat', { proofCase: 'frame-oracle', timeMs: 250, camera: 'front', oracle: ORACLE_BASE })
    const first250 = oracleCaptures.find((capture) => capture.name === 'identity-t250')!
    const first500 = oracleCaptures.find((capture) => capture.name === 'identity-t500')!
    run.check(`${viewport.id}:frame-oracle-same-time-identical`, 'assertion', 0, differingPixels(first250.png, repeat.png), differingPixels(first250.png, repeat.png) === 0)
    run.check(`${viewport.id}:frame-oracle-different-frames-differ`, 'assertion', '> 0', differingPixels(first250.png, first500.png), differingPixels(first250.png, first500.png) > 0)
    const noBlend = oracleCaptures.find((capture) => capture.name === 'no-blend-t375')!
    const blend = oracleCaptures.find((capture) => capture.name === 'blend-t375')!
    run.check(`${viewport.id}:frame-blend-changes-fractional-frame`, 'assertion', '> 0', differingPixels(noBlend.png, blend.png), differingPixels(noBlend.png, blend.png) > 0)
    run.check(`${viewport.id}:frame-oracle-variant`, 'observation', null, {
      defines: first250.layers.layers[0]?.defines,
      samplers: first250.layers.layers[0]?.samplers,
      proofAtlasState: first250.state.proofAtlas,
    }, undefined)

    // E. Material scenarios through GamePfx.
    const scenario = (name: MaterialProofScenario, timeMs: number, quality: 'low' | 'high' = 'low', reducedMotion = false) =>
      driveAndCapture(run, page, `${viewport.id}/scenarios`, `${name}-t${String(timeMs).padStart(4, '0')}-${quality}${reducedMotion ? '-rm' : ''}`, {
        proofCase: 'material-gamepfx', scenario: name, timeMs, camera: 'front', quality, reducedMotion,
      })
    const scenarioCaptures: ProofCapture[] = []
    const equalRows: Array<Record<string, unknown>> = []
    const differRows: Array<Record<string, unknown>> = []
    const expectEqual = (label: string, a: ProofCapture, b: ProofCapture) => {
      const delta = differingPixels(a.png, b.png)
      equalRows.push({ label, a: a.file, b: b.file, differingPixels: delta })
    }
    const expectDiffer = (label: string, a: ProofCapture, b: ProofCapture) => {
      const delta = differingPixels(a.png, b.png)
      differRows.push({ label, a: a.file, b: b.file, differingPixels: delta })
    }
    const references: Partial<Record<string, ProofCapture>> = {}
    const ref = async (name: MaterialProofScenario, timeMs: number, quality: 'low' | 'high' = 'low', reducedMotion = false) => {
      const key = `${name}:${timeMs}:${quality}:${reducedMotion}`
      references[key] ??= await scenario(name, timeMs, quality, reducedMotion)
      scenarioCaptures.push(references[key]!)
      return references[key]!
    }
    for (const timeMs of [100, 500]) {
      const flame = await ref('flame-catalog', timeMs)
      expectEqual(`flame-empty = catalog @${timeMs}`, await ref('flame-empty', timeMs), flame)
      expectEqual(`flame-dissolve-none = catalog @${timeMs}`, await ref('flame-dissolve-none', timeMs), flame)
      expectEqual(`flame-mask-zero = catalog @${timeMs}`, await ref('flame-mask-zero', timeMs), flame)
      expectEqual(`flame-distortion-noise low = catalog @${timeMs}`, await ref('flame-distortion-noise', timeMs, 'low'), flame)
      expectEqual(`flame-dissolve-full = flame-without-licks @${timeMs}`, await ref('flame-dissolve-full', timeMs), await ref('flame-without-licks', timeMs))
      expectDiffer(`flame-dissolve-mid != catalog @${timeMs}`, await ref('flame-dissolve-mid', timeMs), flame)
      expectDiffer(`flame-dissolve-mid != dissolve-full @${timeMs}`, await ref('flame-dissolve-mid', timeMs), await ref('flame-dissolve-full', timeMs))
      // The life curve starts below every noise value; it must bite only later in life.
      if (timeMs === 500) expectDiffer(`flame-dissolve-life != catalog @${timeMs}`, await ref('flame-dissolve-life', timeMs), flame)
      else expectEqual(`flame-dissolve-life (curve not yet above noise) = catalog @${timeMs}`, await ref('flame-dissolve-life', timeMs), flame)
      expectDiffer(`flame-mask-full != catalog @${timeMs}`, await ref('flame-mask-full', timeMs), flame)
      expectDiffer(`flame-uv-rotate != catalog @${timeMs}`, await ref('flame-uv-rotate', timeMs), flame)
      expectDiffer(`flame-uv-scroll-repeat != catalog @${timeMs}`, await ref('flame-uv-scroll-repeat', timeMs), flame)
      expectDiffer(`flame-distortion-noise high != catalog high @${timeMs}`, await ref('flame-distortion-noise', timeMs, 'high'), await ref('flame-catalog', timeMs, 'high'))
      expectDiffer(`flame-frame-animation != catalog @${timeMs}`, await ref('flame-frame-animation', timeMs), flame)
      const portal = await ref('portal-catalog', timeMs)
      expectEqual(`portal-empty = catalog @${timeMs}`, await ref('portal-empty', timeMs), portal)
      expectEqual(`portal-throat-rim-baseline (2.2, 1, no colour) = catalog @${timeMs}`, await ref('portal-throat-rim-baseline', timeMs), portal)
      expectEqual(`portal-vortex-distortion-flow low = catalog @${timeMs}`, await ref('portal-vortex-distortion-flow', timeMs, 'low'), portal)
      expectDiffer(`portal-throat-rim-off != catalog @${timeMs}`, await ref('portal-throat-rim-off', timeMs), portal)
      expectDiffer(`portal-throat-rim-color != catalog @${timeMs}`, await ref('portal-throat-rim-color', timeMs), portal)
      expectDiffer(`portal-vortex-uv != catalog @${timeMs}`, await ref('portal-vortex-uv', timeMs), portal)
      expectDiffer(`portal-vortex-distortion-flow high != catalog high @${timeMs}`, await ref('portal-vortex-distortion-flow', timeMs, 'high'), await ref('portal-catalog', timeMs, 'high'))
      const shield = await ref('shield-catalog', timeMs)
      expectEqual(`shield-empty = catalog @${timeMs}`, await ref('shield-empty', timeMs), shield)
      expectDiffer(`shield-rim-dissolve != catalog @${timeMs}`, await ref('shield-rim-dissolve', timeMs), shield)
      expectDiffer(`shield-mask != catalog @${timeMs}`, await ref('shield-mask', timeMs), shield)
      expectEqual(`smoke-soft-particles (no depth source yet) = catalog @${timeMs}`, await ref('smoke-soft-particles', timeMs, 'high'), await ref('smoke-catalog', timeMs, 'high'))
    }
    expectEqual('flame-distortion-noise high + reduced motion = catalog + reduced motion @500',
      await ref('flame-distortion-noise', 500, 'high', true), await ref('flame-catalog', 500, 'high', true))
    const repeatMid = await scenario('flame-dissolve-mid', 500)
    expectEqual('flame-dissolve-mid repeat @500', repeatMid, references['flame-dissolve-mid:500:low:false']!)
    run.check(`${viewport.id}:disabled-or-neutral-settings-equal-reference`, 'assertion', 'differingPixels 0 for each pair', equalRows,
      equalRows.every((row) => row.differingPixels === 0))
    run.check(`${viewport.id}:feature-extremes-change-pixels`, 'assertion', 'differingPixels > 0 for each pair', differRows,
      differRows.every((row) => (row.differingPixels as number) > 0))

    // Legacy pulse: only frameAnimation removes it. Read the per-frame opacity uniform PfxSurface wrote.
    const pulseRows: Array<Record<string, unknown>> = []
    const catalog500 = references['flame-catalog:500:low:false']!
    for (const [name, licksExpectedRatio] of [['flame-frame-animation', 1 / 0.72], ['flame-empty', 1], ['flame-dissolve-none', 1], ['flame-mask-zero', 1]] as const) {
      const capture = references[`${name}:500:low:false`]!
      for (const layer of ['flame-burst-particle-upward-licks', 'flame-burst-particle-hot-cinders', 'flame-burst-particle-char-smoke']) {
        const expectedRatio = layer === 'flame-burst-particle-upward-licks' ? licksExpectedRatio : 1
        const ratio = (layerOf(capture, layer).opacity ?? Number.NaN) / (layerOf(catalog500, layer).opacity ?? Number.NaN)
        pulseRows.push({ scenario: name, layer, expectedRatio, ratio, pass: Math.abs(ratio - expectedRatio) < 1e-5 })
      }
    }
    run.check(`${viewport.id}:legacy-pulse-only-frame-animation-removes`, 'assertion',
      'flame-8 pulse at 0.5 s is x0.72: licks opacity ratio 1/0.72 with frameAnimation; 1 for {} and non-frame features; siblings 1',
      pulseRows, pulseRows.every((row) => row.pass === true))

    // Samplers, draws, and program variants per configuration.
    const samplerRows = scenarioCaptures.map((capture) => ({
      name: capture.name,
      drawCalls: capture.renderInfo.drawCalls,
      layers: capture.layers.layers.map((layer) => ({ layer: layer.layer, tags: layer.tags, defines: layer.defines, samplers: layer.samplers, disabled: layer.binding?.disabled ?? [] })),
    }))
    samplerReport[viewport.id] = samplerRows
    const find = (name: string) => samplerRows.find((row) => row.name === name)!
    const samplersOf = (name: string, layer: string) => find(name).layers.find((entry) => entry.layer === layer)!.samplers
    const samplerExpectations: Array<[string, string, string, string[]]> = [
      ['flame-empty-t0100-low', 'flame-catalog-t0100-low', FLAME_LAYER, []],
      ['flame-dissolve-mid-t0100-low', 'flame-catalog-t0100-low', FLAME_LAYER, ['uPfxDissolveMap']],
      ['flame-mask-full-t0100-low', 'flame-catalog-t0100-low', FLAME_LAYER, ['uPfxMaskMap']],
      ['flame-uv-rotate-t0100-low', 'flame-catalog-t0100-low', FLAME_LAYER, []],
      ['flame-distortion-noise-t0100-low', 'flame-catalog-t0100-low', FLAME_LAYER, []],
      ['flame-distortion-noise-t0100-high', 'flame-catalog-t0100-high', FLAME_LAYER, ['uPfxDistortionMap']],
      ['flame-frame-animation-t0100-low', 'flame-catalog-t0100-low', FLAME_LAYER, []],
      ['portal-throat-rim-color-t0100-low', 'portal-catalog-t0100-low', 'aperture-depth', []],
      ['portal-vortex-uv-t0100-low', 'portal-catalog-t0100-low', 'vortex-rim', []],
      ['portal-vortex-distortion-flow-t0100-low', 'portal-catalog-t0100-low', 'vortex-rim', []],
      ['portal-vortex-distortion-flow-t0100-high', 'portal-catalog-t0100-high', 'vortex-rim', ['uPfxDistortionMap']],
      ['shield-rim-dissolve-t0100-low', 'shield-catalog-t0100-low', 'broken-shell', ['uPfxDissolveMap']],
      ['shield-mask-t0100-low', 'shield-catalog-t0100-low', 'broken-shell', ['uPfxMaskMap']],
    ]
    const samplerFailures: Array<Record<string, unknown>> = []
    for (const [name, base, layer, added] of samplerExpectations) {
      const expected = [...new Set([...samplersOf(base, layer), ...added])].sort()
      const observed = samplersOf(name, layer)
      const drawDelta = find(name).drawCalls - find(base).drawCalls
      if (JSON.stringify(expected) !== JSON.stringify(observed) || drawDelta !== 0) samplerFailures.push({ name, layer, expected, observed, drawDelta })
    }
    run.check(`${viewport.id}:samplers-and-draws-match-variant`, 'assertion',
      'each feature adds only its own sampler; disabled or low-quality distortion adds none; draw calls unchanged', samplerFailures, samplerFailures.length === 0)
    const distortionLow = find('flame-distortion-noise-t0100-low').layers.find((entry) => entry.layer === FLAME_LAYER)!
    run.check(`${viewport.id}:low-quality-distortion-reports-reason`, 'assertion', [{ setting: 'distortion', reason: 'needs-high-quality' }], distortionLow.disabled,
      JSON.stringify(distortionLow.disabled) === JSON.stringify([{ setting: 'distortion', reason: 'needs-high-quality' }]))
    const smokeSoft = find('smoke-soft-particles-t0100-high').layers.find((entry) => entry.layer === 'puff-bloom')!
    run.check(`${viewport.id}:depth-fade-reports-missing-source`, 'assertion', [{ setting: 'softParticles', reason: 'needs-depth-source' }], smokeSoft.disabled,
      JSON.stringify(smokeSoft.disabled) === JSON.stringify([{ setting: 'softParticles', reason: 'needs-depth-source' }]))
    const sceneErrors = scenarioCaptures.filter((capture) => capture.state.sceneError != null).map((capture) => ({ name: capture.name, error: capture.state.sceneError }))
    run.check(`${viewport.id}:no-scene-errors`, 'assertion', [], sceneErrors, sceneErrors.length === 0)
    await writeContactSheet(run, `${viewport.id}-scenarios`, scenarioCaptures, 6)

    // H. All 500 recipes: factory tag versus resolver, through production dispatch.
    if (viewportIndex === 0) {
      await page.getByLabel('Proof case').selectOption('dispatch-tags')
      const report = page.getByTestId('material-proof-dispatch')
      await report.waitFor({ timeout: 180_000 })
      const rows = JSON.parse(await report.getAttribute('data-rows') ?? '[]') as DispatchRow[]
      await run.writeArtifact('dispatch/rows.json', `${JSON.stringify(rows, null, 2)}\n`)
      const effects = new Set(rows.map((row) => row.effectId))
      const mismatches = rows.filter((row) => row.status === 'mismatch' || row.status === 'missing-object')
      const exclusions = rows.filter((row) => row.status === 'conservative-exclusion')
      run.check('dispatch:all-500-effects', 'assertion', { effects: 500, presets: PFX_PRESETS.length }, { effects: effects.size }, effects.size === 500 && PFX_PRESETS.length === 500)
      run.check('dispatch:factory-tags-match-resolver', 'assertion',
        'supported resolver path => exactly that factory tag; unsupported => no tag, except a named conservative exclusion', mismatches, mismatches.length === 0)
      run.check('dispatch:supported-paths-observed', 'assertion', 'each supported path kind appears with a matching factory tag',
        Object.fromEntries(['generic-sprite', 'fresnel-shell', 'vortex-swirl', 'portal-throat'].map((kind) => [kind, rows.filter((row) => row.resolver === kind && row.status === 'match').length])),
        ['generic-sprite', 'fresnel-shell', 'vortex-swirl', 'portal-throat'].every((kind) => rows.some((row) => row.resolver === kind && row.status === 'match')))
      run.check('dispatch:conservative-exclusions', 'observation', `reasons limited to ${CONSERVATIVE_EXCLUSIONS.join(', ')}`, exclusions, undefined)
      run.check('dispatch:conservative-exclusion-reasons', 'assertion', CONSERVATIVE_EXCLUSIONS, [...new Set(exclusions.map((row) => row.reason))],
        exclusions.every((row) => (CONSERVATIVE_EXCLUSIONS as readonly (string | null)[]).includes(row.reason)))
    }

    const glErrors = [...oracleCaptures, ...scenarioCaptures].filter((capture) => capture.glErrors != null).map(({ file, glErrors: count }) => ({ file, count }))
    run.check(`${viewport.id}:no-webgl-errors`, 'assertion', [], glErrors, glErrors.length === 0)
    const newErrors = run.pageErrors.slice(errorsBefore)
    run.check(`${viewport.id}:no-browser-errors`, 'assertion', [], newErrors, newErrors.length === 0)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    run.check(`${viewport.id}:no-horizontal-overflow`, 'assertion', 0, overflow, overflow <= 0)
    await page.context().close()
  }
  await run.writeArtifact('sampler-report.json', `${JSON.stringify(samplerReport, null, 2)}\n`)

  // F. Negative control: a GLSL compile error must reach the console record.
  const controlPage = await run.newPage(VIEWPORTS[0])
  const errorsBefore = run.pageErrors.length
  await controlPage.goto(`${ORIGIN}/?materialProof=1`)
  await controlPage.getByLabel('Proof case').selectOption('compile-error-control')
  await waitForProofFrame(controlPage)
  const controlErrors = run.pageErrors.splice(errorsBefore)
  run.check('negative-control:compile-error-detected', 'assertion', 'a console error containing "Shader Error"', controlErrors.map((error) => error.slice(0, 400)),
    controlErrors.some((error) => error.includes('Shader Error')))
  await controlPage.context().close()
  await run.writeArtifact('webgl-error-log.json', `${JSON.stringify({ pageErrors: run.pageErrors, compileControl: controlErrors }, null, 2)}\n`)
  run.check('page-errors', 'assertion', [], [...run.pageErrors], run.pageErrors.length === 0)
}

const FLAME_LAYER = 'flame-burst-particle-upward-licks'

// ---------------------------------------------------------------------------
// Case: cost (V7 parts that need no depth source).

async function clickEdit(page: Page, edit: CostEdit): Promise<string> {
  const before = (await readProofState(page)).frameToken as string
  await page.getByTestId(`material-proof-edit-${edit}`).click()
  return waitForProofFrame(page, before)
}

async function readLayers(page: Page): Promise<ProofLayers> {
  return JSON.parse(await page.locator(PROOF_CANVAS).evaluate((element: HTMLCanvasElement) => element.dataset.pfxProofLayers ?? '{}')) as ProofLayers
}

async function readRenderInfo(page: Page): Promise<ProofCapture['renderInfo']> {
  return JSON.parse(await page.locator(PROOF_CANVAS).evaluate((element: HTMLCanvasElement) => element.dataset.pfxProofRenderInfo ?? '{}')) as ProofCapture['renderInfo']
}

function identities(layers: ProofLayers): Record<string, { materials: string[]; geometries: string[] }> {
  return Object.fromEntries(layers.layers.map((layer) => [layer.layer, { materials: layer.materials, geometries: layer.geometries }]))
}

const COST_LAYERS = {
  'flame-burst': { scalar: FLAME_LAYER, structural: FLAME_LAYER, existing: FLAME_LAYER },
  'portal-idle-loop': { scalar: 'aperture-depth', structural: 'vortex-rim', existing: 'vortex-rim' },
} as const

async function costCase(run: RunContext): Promise<void> {
  const { record } = run
  record.notes.push(
    'Cost case: material scalar edits, structural edits, existing opacity and colour edits, equal recipe objects, quality switches, and 100 edit/reset cycles (T4); depth pass, sampler, and resource cost (T7), reported separately.',
    'Resource counters come from the real WebGLRenderer.info in headless Chromium. They are local diagnostics, not GPU timings or device evidence.',
  )
  await run.startServer()
  await run.launchBrowser()
  const page = await run.newPage(VIEWPORTS[0])
  await runDoctor(run, page, ORIGIN, 'proof', ownedExpectation(record))
  const cycleCount = 100
  for (const effectId of ['flame-burst', 'portal-idle-loop'] as const) {
    const layers = COST_LAYERS[effectId]
    const prefix = `cost:${effectId}`
    await driveProof(page, { proofCase: 'cost-edits', effectId, timeMs: 500, camera: 'front', quality: 'low' })
    // Warm every variant once, then return to the start.
    for (const edit of ['scalar', 'scalar', 'structural', 'structural', 'opacity', 'colour', 'reset'] as const) await clickEdit(page, edit)
    const warm = await readRenderInfo(page)
    const start = await readLayers(page)
    const startShot = await captureProof(run, page, `cost/${effectId}`, 'start')

    // A frame never creates a material.
    await page.waitForFunction(
      ([selector, frame]) => JSON.parse(document.querySelector<HTMLCanvasElement>(selector)?.dataset.pfxProofLayers ?? '{"frame":0}').frame >= frame,
      [PROOF_CANVAS, start.frame + 60] as const,
      { timeout: 60_000 },
    )
    const later = await readLayers(page)
    run.check(`${prefix}:frames-keep-identities`, 'assertion', identities(start), { frames: later.frame - start.frame, identities: identities(later) },
      JSON.stringify(identities(start)) === JSON.stringify(identities(later)))

    // Scalar edit: uniforms only.
    await clickEdit(page, 'scalar')
    const scalar = await captureProof(run, page, `cost/${effectId}`, 'scalar')
    run.check(`${prefix}:scalar-edit-keeps-all-identities`, 'assertion', identities(start), identities(scalar.layers),
      JSON.stringify(identities(start)) === JSON.stringify(identities(scalar.layers)))
    const scalarDelta = differingPixels(startShot.png, scalar.png)
    run.check(`${prefix}:scalar-edit-changes-pixels`, 'assertion', '> 0', scalarDelta, scalarDelta > 0)
    run.check(`${prefix}:scalar-edit-disposes-nothing`, 'assertion', start.disposedMaterials.length, scalar.layers.disposedMaterials.length,
      scalar.layers.disposedMaterials.length === start.disposedMaterials.length)

    // A new recipe object with equal values rebuilds nothing.
    await clickEdit(page, 'equal-recipe')
    const equal = await captureProof(run, page, `cost/${effectId}`, 'equal-recipe')
    run.check(`${prefix}:equal-recipe-keeps-all-identities`, 'assertion', identities(scalar.layers), identities(equal.layers),
      JSON.stringify(identities(scalar.layers)) === JSON.stringify(identities(equal.layers)))
    run.check(`${prefix}:equal-recipe-same-pixels`, 'assertion', 0, differingPixels(scalar.png, equal.png), differingPixels(scalar.png, equal.png) === 0)

    // Structural edit: one material rebuilds; the replaced one is disposed.
    await clickEdit(page, 'structural')
    const structural = await captureProof(run, page, `cost/${effectId}`, 'structural')
    const before = identities(equal.layers)
    const after = identities(structural.layers)
    const replaced = before[layers.structural]!.materials.filter((uuid) => !after[layers.structural]!.materials.includes(uuid))
    const siblingsSame = Object.keys(before).filter((layer) => layer !== layers.structural)
      .every((layer) => JSON.stringify(before[layer]) === JSON.stringify(after[layer]))
    run.check(`${prefix}:structural-edit-rebuilds-one-material`, 'assertion',
      { replacedMaterials: 1, editedGeometrySame: true, siblingsSame: true },
      { replacedMaterials: replaced.length, editedGeometrySame: JSON.stringify(before[layers.structural]!.geometries) === JSON.stringify(after[layers.structural]!.geometries), siblingsSame },
      replaced.length === 1 && siblingsSame && JSON.stringify(before[layers.structural]!.geometries) === JSON.stringify(after[layers.structural]!.geometries))
    run.check(`${prefix}:structural-edit-disposes-replaced`, 'assertion', replaced, structural.layers.disposedMaterials.filter((uuid) => replaced.includes(uuid)),
      replaced.every((uuid) => structural.layers.disposedMaterials.includes(uuid)))
    run.check(`${prefix}:structural-edit-changes-pixels`, 'assertion', '> 0', differingPixels(equal.png, structural.png), differingPixels(equal.png, structural.png) > 0)

    // Existing opacity and colour controls must visibly update.
    await clickEdit(page, 'opacity')
    const opacity = await captureProof(run, page, `cost/${effectId}`, 'opacity')
    run.check(`${prefix}:existing-opacity-edit-changes-pixels`, 'assertion', '> 0', differingPixels(structural.png, opacity.png), differingPixels(structural.png, opacity.png) > 0)
    await clickEdit(page, 'colour')
    const colour = await captureProof(run, page, `cost/${effectId}`, 'colour')
    run.check(`${prefix}:existing-colour-edit-changes-pixels`, 'assertion', '> 0', differingPixels(opacity.png, colour.png), differingPixels(opacity.png, colour.png) > 0)
    const existingSiblings = Object.keys(before).filter((layer) => layer !== layers.existing && layer !== layers.structural)
      .every((layer) => JSON.stringify(identities(colour.layers)[layer]) === JSON.stringify(before[layer]))
    run.check(`${prefix}:existing-edits-keep-sibling-identities`, 'assertion', true, existingSiblings, existingSiblings)
    run.check(`${prefix}:existing-edit-rebuild-behaviour`, 'observation', 'opacity and colour are baked inputs: the edited layer may rebuild', {
      afterOpacity: identities(opacity.layers)[layers.existing],
      afterColour: identities(colour.layers)[layers.existing],
    }, undefined)
    await clickEdit(page, 'reset')

    // 100 edit/reset cycles.
    const cycleStart = Date.now()
    for (let cycle = 0; cycle < cycleCount; cycle += 1) {
      await clickEdit(page, 'scalar')
      await clickEdit(page, 'structural')
      await clickEdit(page, 'reset')
    }
    const cycled = await readRenderInfo(page)
    const cycledLayers = await readLayers(page)
    const cycledShot = await captureProof(run, page, `cost/${effectId}`, 'after-cycles')
    run.check(`${prefix}:cycles-return-to-warm-counters`, 'assertion', { geometries: warm.geometries, textures: warm.textures, programs: warm.programs, drawCalls: warm.drawCalls },
      { cycles: cycleCount, geometries: cycled.geometries, textures: cycled.textures, programs: cycled.programs, drawCalls: cycled.drawCalls, durationMs: Date.now() - cycleStart },
      cycled.geometries === warm.geometries && cycled.textures === warm.textures && cycled.programs === warm.programs && cycled.drawCalls === warm.drawCalls)
    run.check(`${prefix}:cycles-dispose-every-replaced-material`, 'assertion', 'live materials per layer unchanged; every replaced material disposed',
      { start: start.layers.map((layer) => [layer.layer, layer.materials.length]), end: cycledLayers.layers.map((layer) => [layer.layer, layer.materials.length]), disposed: cycledLayers.disposedMaterials.length },
      JSON.stringify(start.layers.map((layer) => [layer.layer, layer.materials.length])) === JSON.stringify(cycledLayers.layers.map((layer) => [layer.layer, layer.materials.length])))
    run.check(`${prefix}:cycles-restore-start-image`, 'assertion', 0, differingPixels(startShot.png, cycledShot.png), differingPixels(startShot.png, cycledShot.png) === 0)

    // Quality switch rebuilds only material layers; a layer without a material keeps its identity.
    const lowLayers = identities(await readLayers(page))
    await page.getByLabel('Material quality').selectOption('high')
    await waitForProofFrame(page)
    const highLayers = identities(await readLayers(page))
    const plainLayers = Object.keys(lowLayers).filter((layer) => !Object.values(layers).includes(layer as never))
    run.check(`${prefix}:quality-switch-keeps-plain-layers`, 'assertion', Object.fromEntries(plainLayers.map((layer) => [layer, lowLayers[layer]])),
      Object.fromEntries(plainLayers.map((layer) => [layer, highLayers[layer]])),
      plainLayers.every((layer) => JSON.stringify(lowLayers[layer]) === JSON.stringify(highLayers[layer])))
    await page.getByLabel('Material quality').selectOption('low')
    await waitForProofFrame(page)
  }
  const cacheStats = await readLayers(page)
  run.check('cost:shared-maps-bounded', 'assertion', 'at most one shared texture per map ID (3)', cacheStats.materialMaps, cacheStats.materialMaps.maps <= 3)

  // Depth cost (T7), reported separately. Without a depth source a provider
  // adds no pass and no sample. The host capture adds one pass, high only.
  const depthCost: Record<string, { passesLastFrame: number; mainDrawCalls: number; programs: number | null; textures: number; geometries: number; samplers: string[][]; rafIntervalsMs: Record<string, number> }> = {}
  const depthDrives = [
    ['no-provider', { source: 'no-provider' }],
    ['no-ref-high', { source: 'no-ref' }],
    ['valid-low', { source: 'valid', quality: 'low' }],
    ['valid-high', { source: 'valid' }],
  ] as const
  for (const [name, drive] of depthDrives) {
    const report = await driveDepth(page, drive)
    depthCost[name] = {
      passesLastFrame: report.passesLastFrame,
      mainDrawCalls: report.mainDrawCalls,
      programs: report.programs,
      textures: report.textures,
      geometries: report.geometries,
      samplers: report.layers.map((layer) => layer.samplers),
      rafIntervalsMs: await sampleRafIntervals(page, 120),
    }
  }
  await run.writeArtifact('depth-cost.json', `${JSON.stringify(depthCost, null, 2)}\n`)
  const plainSamplers = JSON.stringify(depthCost['no-provider']!.samplers)
  run.check('cost:depth-disabled-adds-no-pass-or-sample', 'assertion', { passesLastFrame: 1, samplers: depthCost['no-provider']!.samplers },
    { noRef: { passes: depthCost['no-ref-high']!.passesLastFrame, samplers: depthCost['no-ref-high']!.samplers }, low: { passes: depthCost['valid-low']!.passesLastFrame, samplers: depthCost['valid-low']!.samplers } },
    depthCost['no-ref-high']!.passesLastFrame === 1 && depthCost['valid-low']!.passesLastFrame === 1 && depthCost['no-provider']!.passesLastFrame === 1
      && JSON.stringify(depthCost['no-ref-high']!.samplers) === plainSamplers && JSON.stringify(depthCost['valid-low']!.samplers) === plainSamplers)
  run.check('cost:depth-high-adds-one-pass-and-one-sample', 'assertion', { passesLastFrame: 2, extraSampler: 'uPfxSceneDepth per smoke layer', mainDrawCalls: depthCost['no-provider']!.mainDrawCalls },
    { passesLastFrame: depthCost['valid-high']!.passesLastFrame, samplers: depthCost['valid-high']!.samplers, mainDrawCalls: depthCost['valid-high']!.mainDrawCalls },
    depthCost['valid-high']!.passesLastFrame === 2 && depthCost['valid-high']!.mainDrawCalls === depthCost['no-provider']!.mainDrawCalls
      && depthCost['valid-high']!.samplers.every((samplers) => samplers.includes('uPfxSceneDepth')))
  run.check('cost:depth-resources', 'observation', 'programs, textures, geometries, and rAF intervals per depth state; rAF intervals are not GPU timings',
    Object.fromEntries(Object.entries(depthCost).map(([name, entry]) => [name, { programs: entry.programs, textures: entry.textures, geometries: entry.geometries, rafIntervalsMs: entry.rafIntervalsMs }])), undefined)
  await page.context().close()

  // Existing local profile thresholds. The dev server serves unbundled
  // modules with HMR, which inflates frame times; profile a production build
  // of this same source, served by an owned `vite preview` child.
  const preview = await startOwnedPreview(run)
  const profileOutput = path.join(run.outputDir, 'profile-browser.json')
  const profileArgs = ['--import', 'tsx', 'viewer/scripts/profile-browser.ts', '--url', `${preview.url}/`,
    '--effect-ids', 'flame-burst,portal-idle-loop,smoke-puff,shield-break,portal-burst,shield-burst', '--output', profileOutput]
  let profileExit: number | null
  try {
    profileExit = await runLogged(process.execPath, profileArgs, path.join(run.outputDir, 'profile-browser.log'))
  } finally {
    record.server = { ...record.server, preview: { ...preview.record, cleanup: await stopOwnedPreview(preview) } }
  }
  run.record.artifacts.push(relativeToPackage(path.join(run.outputDir, 'profile-browser.log')))
  if (fs.existsSync(profileOutput)) run.record.artifacts.push(relativeToPackage(profileOutput))
  record.inputs.profileCommand = { command: `node ${profileArgs.join(' ')}`, exitCode: profileExit }
  run.check('cost:existing-profile-thresholds', 'assertion', 0, profileExit, profileExit === 0)
  run.check('page-errors', 'assertion', [], [...run.pageErrors], run.pageErrors.length === 0)
}


// ---------------------------------------------------------------------------
// Case: depth (V6). Host depth fixture: smoke-puff depth fade against an
// opaque box and ground, through the visible depth controls.

const DEPTH_TIME_MS = 400
const DEPTH_CAMERA: MaterialProofCamera = 'front'

interface DepthDrive extends Partial<MaterialProofDepthOptions> {
  quality?: 'low' | 'high'
  camera?: MaterialProofCamera
}

interface DepthShot {
  name: string
  file: string
  png: PNG
  report: MaterialProofDepthReport
}

async function readDepthReport(page: Page): Promise<MaterialProofDepthReport & { unmounted?: boolean }> {
  return JSON.parse(await page.locator(PROOF_CANVAS).evaluate((element: HTMLCanvasElement) => element.dataset.pfxDepthProof ?? '{}')) as MaterialProofDepthReport & { unmounted?: boolean }
}

/** Waits until the stage reports `frames` more frames that satisfy `ready`. */
async function waitDepthReport(
  page: Page,
  ready: (report: MaterialProofDepthReport & { unmounted?: boolean }) => boolean,
  frames = 9,
  label = 'depth report',
): Promise<MaterialProofDepthReport & { unmounted?: boolean }> {
  const deadline = Date.now() + 60_000
  let first: number | null = null
  let last: (MaterialProofDepthReport & { unmounted?: boolean }) | null = null
  while (Date.now() < deadline) {
    last = await readDepthReport(page)
    if (last.frame !== undefined && ready(last)) {
      first ??= last.frame
      if (last.frame - first >= frames) return last
    } else {
      first = null
    }
    await delay(50)
  }
  throw new HarnessError('CaptureFailed', `${label}: the depth stage did not settle; last report ${JSON.stringify(last)?.slice(0, 600)}`)
}

async function driveDepth(page: Page, drive: DepthDrive): Promise<MaterialProofDepthReport> {
  const proofCase = page.getByLabel('Proof case')
  if ((await proofCase.inputValue()) !== 'depth') await proofCase.selectOption('depth')
  await page.getByLabel('Material quality').selectOption(drive.quality ?? 'high')
  await page.getByTestId('material-proof-camera').selectOption(drive.camera ?? DEPTH_CAMERA)
  await page.getByLabel('Preview time (seconds)').fill(String(DEPTH_TIME_MS / 1000))
  const options: MaterialProofDepthOptions = { ...DEFAULT_DEPTH_OPTIONS, ...drive }
  await page.getByTestId('material-proof-depth-source').selectOption(options.source)
  await page.getByTestId('material-proof-depth-projection').selectOption(options.projection)
  await page.getByTestId('material-proof-depth-buffer').selectOption(options.depthBuffer)
  await page.getByTestId('material-proof-depth-contact').selectOption(options.contact)
  await page.getByTestId('material-proof-depth-stage-size').selectOption(options.stageSize)
  await page.getByTestId('material-proof-depth-softness').fill(String(options.softness))
  await page.getByTestId('material-proof-depth-smoke').setChecked(options.smoke)
  await page.getByTestId('material-proof-depth-auto-rotate').setChecked(options.autoRotate)
  await page.getByTestId('material-proof-depth-late-camera').setChecked(options.lateCamera)
  await page.getByTestId('material-proof-depth-capture-error').setChecked(options.captureError)
  await page.getByTestId('material-proof-depth-mounted').setChecked(options.mounted)
  await waitForProofFrame(page)
  if (!options.mounted) return waitDepthReport(page, (report) => report.unmounted === true, 6, 'unmounted stage')
  const quality = drive.quality ?? 'high'
  const stage = await page.getByTestId('material-proof-stage').evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return [rect.width, rect.height]
  })
  // Settled: the report shows this source and quality at the canvas size,
  // and a capturing source has a target of that size.
  return waitDepthReport(page, (report) => {
    if (report.unmounted || report.source !== options.source || report.quality !== quality || !report.drawingBuffer) return false
    // R3F floors the measured container size into the drawing buffer.
    const sized = Math.abs(report.drawingBuffer[0] - stage[0]!) <= 1 && Math.abs(report.drawingBuffer[1] - stage[1]!) <= 1
    const canvasMatches = sized && report.layers.length === (options.smoke ? 3 : 0)
    if (options.source === 'valid' && quality === 'high' && !options.captureError) {
      return canvasMatches && report.host.targetSize?.[0] === report.drawingBuffer[0] && report.host.targetSize?.[1] === report.drawingBuffer[1]
    }
    return canvasMatches
  }, 9, `depth ${JSON.stringify(drive)}`)
}

async function captureDepth(run: RunContext, page: Page, folder: string, name: string, drive: DepthDrive): Promise<DepthShot> {
  await driveDepth(page, drive)
  const buffer = await page.locator(PROOF_CANVAS).screenshot({ type: 'png' })
  const file = await run.writeArtifact(`${folder}/${name}.png`, buffer)
  const report = await readDepthReport(page)
  await run.writeArtifact(`${folder}/${name}.report.json`, `${JSON.stringify({ ...report, depthImage: report.depthImage ? { ...report.depthImage, dataUri: '(written separately)' } : null }, null, 2)}\n`)
  return { name, file, png: PNG.sync.read(buffer), report }
}

function pixelMask(a: PNG, b: PNG): Uint8Array {
  const mask = new Uint8Array(a.width * a.height)
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    const index = pixel * 4
    if (a.data[index] !== b.data[index] || a.data[index + 1] !== b.data[index + 1] || a.data[index + 2] !== b.data[index + 2]) mask[pixel] = 1
  }
  return mask
}

function absoluteDifference(a: PNG, b: PNG): number {
  let sum = 0
  for (let index = 0; index < a.data.length; index += 4) {
    sum += Math.abs(a.data[index]! - b.data[index]!) + Math.abs(a.data[index + 1]! - b.data[index + 1]!) + Math.abs(a.data[index + 2]! - b.data[index + 2]!)
  }
  return sum
}

function countMask(mask: Uint8Array): number {
  let count = 0
  for (const value of mask) count += value
  return count
}

async function exportDepthImage(run: RunContext, page: Page, folder: string, name: string): Promise<{ file: string; png: PNG }> {
  const before = (await readDepthReport(page)).depthImage?.at ?? null
  await page.getByTestId('material-proof-depth-export').click()
  const report = await waitDepthReport(page, (current) => current.depthImage != null && current.depthImage.at !== before, 0, 'depth image export')
  const buffer = Buffer.from(report.depthImage!.dataUri.split(',')[1]!, 'base64')
  const file = await run.writeArtifact(`${folder}/${name}.png`, buffer)
  return { file, png: PNG.sync.read(buffer) }
}

const DEPTH_LAYERS_SOFT = (report: MaterialProofDepthReport, drawn: string) => report.layers.length === 3 && report.layers.every((layer) => layer.drawn === drawn)

async function depthCase(run: RunContext): Promise<void> {
  const { record } = run
  record.notes.push(
    'V6 depth case: viewer/src/MaterialDepthStage.tsx is the host adapter. It captures the opaque ground and box once per canvas at priority -1, high quality only. The smoke-puff override with depth fade exists only in the fixture.',
    'Fallback images are compared pixel for pixel with the no-provider baseline. Local headless Chromium (SwiftShader) results are diagnostic, not device evidence.',
    'Pass counts come from WebGLRenderer.info.render.frame (render calls per animation frame).',
  )
  await run.startServer()
  await run.launchBrowser()
  for (const viewport of VIEWPORTS) {
    const page = await run.newPage(viewport)
    await runDoctor(run, page, ORIGIN, 'proof', ownedExpectation(record), viewport.id)
    const errorsBefore = run.pageErrors.length
    const full = viewport.id === VIEWPORTS[0].id
    let perspectiveSoft: PNG | null = null
    for (const projection of (full ? ['perspective', 'orthographic'] : ['perspective']) as MaterialProofDepthProjection[]) {
      const id = `${viewport.id}:${projection}`
      const folder = `${viewport.id}/${projection}`
      const shot = (name: string, drive: DepthDrive) => captureDepth(run, page, folder, name, { projection, ...drive })
      const baseline = await shot('no-provider', { source: 'no-provider' })
      const soft = await shot('valid-high', { source: 'valid' })
      run.check(`${id}:valid-high-draws-soft`, 'assertion', { drawn: 'soft x3', validity: 'valid', samplers: 'uPfxSceneDepth on every layer' },
        { layers: soft.report.layers, validity: soft.report.validity },
        DEPTH_LAYERS_SOFT(soft.report, 'soft') && soft.report.validity === 'valid' && soft.report.layers.every((layer) => layer.samplers.includes('uPfxSceneDepth')))
      if (projection === 'perspective') perspectiveSoft = soft.png
      const softDiff = differingPixels(baseline.png, soft.png)
      run.check(`${id}:valid-high-changes-contact-pixels`, 'assertion', '> 0 differing pixels against the no-provider baseline', softDiff, softDiff > 0)
      run.check(`${id}:one-capture-pass-high`, 'assertion', { passesLastFrame: 2, noProvider: 1 },
        { passesLastFrame: soft.report.passesLastFrame, noProvider: baseline.report.passesLastFrame },
        soft.report.passesLastFrame === 2 && baseline.report.passesLastFrame === 1)
      run.check(`${id}:baseline-has-no-depth-sampler`, 'assertion', 'no uPfxSceneDepth; drawn none', baseline.report.layers,
        baseline.report.layers.length === 3 && baseline.report.layers.every((layer) => layer.drawn === 'none' && !layer.samplers.includes('uPfxSceneDepth')))

      // Low quality and a provider without a ref: no pass, no sample, baseline pixels.
      for (const [name, drive] of [['valid-low', { source: 'valid', quality: 'low' }], ['no-ref-high', { source: 'no-ref' }]] as const) {
        const fallback = await shot(name, drive)
        const delta = differingPixels(baseline.png, fallback.png)
        run.check(`${id}:${name}-equals-baseline`, 'assertion',
          { differingPixels: 0, passesLastFrame: 1, drawn: 'none x3', samplers: baseline.report.layers.map((layer) => layer.samplers) },
          { differingPixels: delta, passesLastFrame: fallback.report.passesLastFrame, drawn: fallback.report.layers.map((layer) => layer.drawn), samplers: fallback.report.layers.map((layer) => layer.samplers) },
          delta === 0 && fallback.report.passesLastFrame === 1 && fallback.report.layers.every((layer) => layer.drawn === 'none')
            && JSON.stringify(fallback.report.layers.map((layer) => layer.samplers)) === JSON.stringify(baseline.report.layers.map((layer) => layer.samplers)))
      }

      // Every invalid source selects the hard fallback with baseline pixels.
      const faults: Array<{ name: string; drive: DepthDrive; reason: string; passes: number }> = [
        { name: 'source-null', drive: { source: 'null' }, reason: 'no-source', passes: 1 },
        { name: 'stale-token', drive: { source: 'stale' }, reason: 'stale-token', passes: 1 },
        { name: 'wrong-camera', drive: { source: 'wrong-camera' }, reason: 'wrong-camera', passes: 2 },
        { name: 'reversed-declared', drive: { source: 'reversed' }, reason: 'reversed-depth', passes: 2 },
        { name: 'packed-declared', drive: { source: 'packed' }, reason: 'packed-depth', passes: 2 },
        { name: 'xr-declared', drive: { source: 'xr' }, reason: 'xr', passes: 2 },
        { name: 'forced-capture-error', drive: { source: 'valid', captureError: true }, reason: 'stale-token', passes: 1 },
      ]
      for (const fault of faults) {
        const fallback = await shot(fault.name, fault.drive)
        const delta = differingPixels(baseline.png, fallback.png)
        run.check(`${id}:${fault.name}-uses-hard-fallback`, 'assertion',
          { differingPixels: 0, drawn: 'hard x3', validity: fault.reason, reported: fault.reason, passesLastFrame: fault.passes },
          { differingPixels: delta, drawn: fallback.report.layers.map((layer) => layer.drawn), validity: fallback.report.validity, reported: fallback.report.reportedReasons, passesLastFrame: fallback.report.passesLastFrame },
          delta === 0 && DEPTH_LAYERS_SOFT(fallback.report, 'hard') && fallback.report.validity === fault.reason
            && fallback.report.reportedReasons.includes(fault.reason) && fallback.report.passesLastFrame === fault.passes)
        if (fault.name === 'forced-capture-error') {
          run.check(`${id}:forced-capture-error-restores-renderer`, 'assertion',
            { lastCaptureError: 'forced capture error', restoreFailures: [], captureErrors: '> 0' },
            { lastCaptureError: fallback.report.host.lastCaptureError, restoreFailures: fallback.report.host.restoreFailures, captureErrors: fallback.report.host.captureErrors, restoreChecks: fallback.report.host.restoreChecks },
            fallback.report.host.lastCaptureError === 'forced capture error' && fallback.report.host.restoreFailures.length === 0 && fallback.report.host.captureErrors > 0)
        }
      }

      // Logarithmic depth renderer: a real logarithmicDepthBuffer canvas.
      const logBaseline = await shot('log-depth-no-provider', { source: 'no-provider', depthBuffer: 'logarithmic' })
      const logValid = await shot('log-depth-valid-source', { source: 'valid', depthBuffer: 'logarithmic' })
      const logDelta = differingPixels(logBaseline.png, logValid.png)
      run.check(`${id}:log-depth-uses-hard-fallback`, 'assertion',
        { differingPixels: 0, drawn: 'hard x3', validity: 'logarithmic-depth' },
        { differingPixels: logDelta, drawn: logValid.report.layers.map((layer) => layer.drawn), validity: logValid.report.validity },
        logDelta === 0 && DEPTH_LAYERS_SOFT(logValid.report, 'hard') && logValid.report.validity === 'logarithmic-depth')

      // Coverage falls only inside the smoke, and more with a larger distance.
      const noSmoke = await shot('no-provider-no-smoke', { source: 'no-provider', smoke: false })
      const smokeMask = pixelMask(baseline.png, noSmoke.png)
      const softMask = pixelMask(baseline.png, soft.png)
      let outside = 0
      for (let pixel = 0; pixel < softMask.length; pixel += 1) if (softMask[pixel] && !smokeMask[pixel]) outside += 1
      run.check(`${id}:fade-only-inside-smoke`, 'assertion', 'pixels that the fade changes are a subset of the smoke pixels (0 outside)',
        { changed: countMask(softMask), smokePixels: countMask(smokeMask), outside }, outside === 0 && countMask(softMask) > 0)
      const ramp: Array<{ softness: number; absoluteDifference: number; differingPixels: number; file: string; variants: string }> = []
      for (const softness of [0.1, 0.4, 1.2]) {
        const capture = await shot(`valid-softness-${softness}`, { source: 'valid', softness })
        ramp.push({
          softness,
          absoluteDifference: absoluteDifference(baseline.png, capture.png),
          differingPixels: differingPixels(baseline.png, capture.png),
          file: capture.file,
          variants: JSON.stringify(capture.report.layers.map((layer) => [layer.soft, layer.hard])),
        })
      }
      // Compare within the edit sequence: earlier steps remount the provider
      // or the canvas, which builds new materials by design.
      const firstRampVariants = ramp[0]!.variants
      run.check(`${id}:fade-distance-edit-keeps-variants`, 'assertion', 'distance edits 0.1 -> 0.4 -> 1.2 keep the soft and hard material of every layer (uniform-only scalar edit)',
        ramp.map((entry) => ({ softness: entry.softness, variants: entry.variants })),
        ramp.length === 3 && !firstRampVariants.includes('null') && ramp.every((entry) => entry.variants === firstRampVariants))
      run.check(`${id}:fade-grows-with-distance`, 'assertion', 'absolute difference from the hard baseline strictly increases with the fade distance (0.1 < 0.4 < 1.2)',
        ramp, ramp[0]!.absoluteDifference > 0 && ramp[0]!.absoluteDifference < ramp[1]!.absoluteDifference && ramp[1]!.absoluteDifference < ramp[2]!.absoluteDifference)

      // Opaque occlusion: where the hard render shows only the front box,
      // the soft render shows only the box too.
      const frontBaseline = await shot('front-no-provider', { source: 'no-provider', contact: 'front' })
      const frontNoSmoke = await shot('front-no-provider-no-smoke', { source: 'no-provider', contact: 'front', smoke: false })
      const noBoxNoSmoke = await shot('no-box-no-provider-no-smoke', { source: 'no-provider', contact: 'none', smoke: false })
      const frontSoft = await shot('front-valid-high', { source: 'valid', contact: 'front' })
      const boxMask = pixelMask(frontNoSmoke.png, noBoxNoSmoke.png)
      let occluded = 0
      let leaks = 0
      for (let pixel = 0; pixel < boxMask.length; pixel += 1) {
        if (!boxMask[pixel]) continue
        const index = pixel * 4
        const hardIsBox = frontBaseline.png.data[index] === frontNoSmoke.png.data[index] && frontBaseline.png.data[index + 1] === frontNoSmoke.png.data[index + 1] && frontBaseline.png.data[index + 2] === frontNoSmoke.png.data[index + 2]
        if (!hardIsBox) continue
        occluded += 1
        if (frontSoft.png.data[index] !== frontNoSmoke.png.data[index] || frontSoft.png.data[index + 1] !== frontNoSmoke.png.data[index + 1] || frontSoft.png.data[index + 2] !== frontNoSmoke.png.data[index + 2]) leaks += 1
      }
      run.check(`${id}:opaque-occlusion-kept`, 'assertion', { occludedBoxPixels: '> 1000', softLeaks: 0, drawn: 'soft x3' },
        { boxPixels: countMask(boxMask), occludedBoxPixels: occluded, softLeaks: leaks, drawn: frontSoft.report.layers.map((layer) => layer.drawn) },
        occluded > 1000 && leaks === 0 && DEPTH_LAYERS_SOFT(frontSoft.report, 'soft'))

      // Scene depth holds only the opaque fixture: smoke on/off gives the same depth image.
      await driveDepth(page, { projection, source: 'valid' })
      const depthWithSmoke = await exportDepthImage(run, page, folder, 'depth-image-with-smoke')
      await driveDepth(page, { projection, source: 'valid', smoke: false })
      const depthWithoutSmoke = await exportDepthImage(run, page, folder, 'depth-image-without-smoke')
      const depthValues = new Set<number>()
      for (let index = 0; index < depthWithSmoke.png.data.length; index += 4) depthValues.add(depthWithSmoke.png.data[index]!)
      const report = await readDepthReport(page)
      run.check(`${id}:transparent-pfx-not-in-scene-depth`, 'assertion',
        { depthImageDifference: 0, depthSceneObjects: ['ground', 'contact-box'], distinctDepthValues: '> 8' },
        { depthImageDifference: differingPixels(depthWithSmoke.png, depthWithoutSmoke.png), depthSceneObjects: report.host.depthSceneObjects, distinctDepthValues: depthValues.size },
        differingPixels(depthWithSmoke.png, depthWithoutSmoke.png) === 0 && JSON.stringify([...report.host.depthSceneObjects].sort()) === JSON.stringify(['contact-box', 'ground']) && depthValues.size > 8)

      // A priority-0 camera move after the consumers: the draw-time guard.
      const lateBaseline = await shot('late-camera-no-provider', { source: 'no-provider', lateCamera: true })
      const lateValid = await shot('late-camera-valid-high', { source: 'valid', lateCamera: true })
      const lateDelta = differingPixels(lateBaseline.png, lateValid.png)
      run.check(`${id}:late-camera-update-uses-hard-result`, 'assertion',
        { differingPixels: 0, drawn: 'soft-gated or hard on every layer', reported: 'camera-matrix-mismatch' },
        { differingPixels: lateDelta, drawn: lateValid.report.layers.map((layer) => layer.drawn), reported: lateValid.report.reportedReasons },
        lateDelta === 0 && lateValid.report.layers.length === 3 && lateValid.report.layers.every((layer) => layer.drawn === 'soft-gated' || layer.drawn === 'hard')
          && lateValid.report.reportedReasons.includes('camera-matrix-mismatch'))
    }

    if (full) {
      const folder = `${viewport.id}/perspective`
      // Continuous auto-rotate: every frame recaptures, so every frame stays soft.
      await driveDepth(page, { source: 'valid', autoRotate: true })
      const rotateStart = await readDepthReport(page)
      const rotateEnd = await waitDepthReport(page, (current) => current.source === 'valid', 60, 'auto-rotate')
      const counts = (from: MaterialProofDepthReport, to: MaterialProofDepthReport) => Object.fromEntries(['soft', 'soft-gated', 'hard', 'none']
        .map((key) => [key, (to.drawnCounts[key] ?? 0) - (from.drawnCounts[key] ?? 0)]))
      const rotateCounts = counts(rotateStart, rotateEnd)
      run.check(`${viewport.id}:auto-rotate-stays-valid`, 'assertion', 'only soft draws while the camera moves each frame', rotateCounts,
        rotateCounts.soft! > 0 && rotateCounts['soft-gated'] === 0 && rotateCounts.hard === 0 && rotateCounts.none === 0)
      await driveDepth(page, { source: 'valid', autoRotate: true, lateCamera: true })
      const lateStart = await readDepthReport(page)
      const lateEnd = await waitDepthReport(page, (current) => current.source === 'valid', 60, 'auto-rotate with late camera')
      const lateCounts = counts(lateStart, lateEnd)
      run.check(`${viewport.id}:auto-rotate-late-camera-never-soft`, 'assertion', 'no open soft draw while a late camera update runs every frame', lateCounts,
        lateCounts.soft === 0 && (lateCounts['soft-gated']! + lateCounts.hard!) > 0)

      // Resize: the host recreates its target; the source is valid after recapture.
      const square = await captureDepth(run, page, folder, 'resize-square-valid', { source: 'valid', stageSize: 'square' })
      const wide = await captureDepth(run, page, folder, 'resize-wide-valid', { source: 'valid', stageSize: 'wide' })
      const wideBaseline = await captureDepth(run, page, folder, 'resize-wide-no-provider', { source: 'no-provider', stageSize: 'wide' })
      run.check(`${viewport.id}:resize-valid-after-recapture`, 'assertion',
        { targetSize: 'equals the new drawing buffer', drawn: 'soft x3', targetsCreated: '+1', differsFromWideBaseline: true },
        { before: square.report.drawingBuffer, after: wide.report.drawingBuffer, targetSize: wide.report.host.targetSize, drawn: wide.report.layers.map((layer) => layer.drawn), targetsCreated: [square.report.host.targetsCreated, wide.report.host.targetsCreated], differing: differingPixels(wideBaseline.png, wide.png) },
        JSON.stringify(wide.report.host.targetSize) === JSON.stringify(wide.report.drawingBuffer) && JSON.stringify(square.report.drawingBuffer) !== JSON.stringify(wide.report.drawingBuffer)
          && DEPTH_LAYERS_SOFT(wide.report, 'soft') && wide.report.host.targetsCreated > square.report.host.targetsCreated && differingPixels(wideBaseline.png, wide.png) > 0)
      // Size hold: a host that keeps its wide target after a resize to square.
      const squareBaseline = await captureDepth(run, page, folder, 'resize-square-no-provider', { source: 'no-provider', stageSize: 'square' })
      await driveDepth(page, { source: 'valid', stageSize: 'wide' })
      await driveDepth(page, { source: 'size-hold', stageSize: 'wide' })
      const held = await captureDepth(run, page, folder, 'resize-square-size-hold', { source: 'size-hold', stageSize: 'square' })
      run.check(`${viewport.id}:resize-without-recapture-uses-hard-fallback`, 'assertion',
        { validity: 'size-mismatch', drawn: 'hard x3', differingPixels: 0 },
        { validity: held.report.validity, drawn: held.report.layers.map((layer) => layer.drawn), targetSize: held.report.host.targetSize, drawingBuffer: held.report.drawingBuffer, differingPixels: differingPixels(squareBaseline.png, held.png) },
        held.report.validity === 'size-mismatch' && DEPTH_LAYERS_SOFT(held.report, 'hard') && differingPixels(squareBaseline.png, held.png) === 0)
      const recaptured = await captureDepth(run, page, folder, 'resize-square-recaptured', { source: 'valid', stageSize: 'square' })
      run.check(`${viewport.id}:recapture-after-size-hold-is-valid`, 'assertion', { drawn: 'soft x3', targetSize: 'drawing buffer', equalsFirstSquare: 0 },
        { drawn: recaptured.report.layers.map((layer) => layer.drawn), targetSize: recaptured.report.host.targetSize, drawingBuffer: recaptured.report.drawingBuffer, equalsFirstSquare: differingPixels(square.png, recaptured.png) },
        DEPTH_LAYERS_SOFT(recaptured.report, 'soft') && JSON.stringify(recaptured.report.host.targetSize) === JSON.stringify(recaptured.report.drawingBuffer)
          && differingPixels(square.png, recaptured.png) === 0)

      // Repeated valid/stale transitions switch references only.
      const steps: Array<{ source: string; drawn: string[]; variants: Array<[string | null, string | null]>; programs: number | null; textures: number; disposed: string[] }> = []
      for (let cycle = 0; cycle < 10; cycle += 1) {
        for (const source of ['valid', 'stale'] as const) {
          const report = await driveDepth(page, { source })
          steps.push({
            source,
            drawn: report.layers.map((layer) => layer.drawn),
            variants: report.layers.map((layer) => [layer.soft, layer.hard]),
            programs: report.programs,
            textures: report.textures,
            disposed: Object.entries(report.variantMaterials).filter(([, entry]) => entry.disposed).map(([uuid]) => uuid),
          })
        }
      }
      const variantSets = new Set(steps.map((step) => JSON.stringify(step.variants)))
      const programCounts = new Set(steps.map((step) => step.programs))
      const textureCounts = new Set(steps.map((step) => step.textures))
      const liveVariants = new Set(steps[0]!.variants.flat())
      const disposedLive = steps.flatMap((step) => step.disposed).filter((uuid) => liveVariants.has(uuid))
      await run.writeArtifact(`${folder}/transitions.json`, `${JSON.stringify(steps, null, 2)}\n`)
      run.check(`${viewport.id}:transitions-keep-material-identities`, 'assertion',
        { variantPairs: 1, programCounts: 1, textureCounts: 1, disposedLiveVariants: 0, drawn: 'soft on valid, hard on stale' },
        { transitions: steps.length, variantPairs: variantSets.size, programCounts: [...programCounts], textureCounts: [...textureCounts], disposedLiveVariants: disposedLive.length },
        variantSets.size === 1 && programCounts.size === 1 && textureCounts.size === 1 && disposedLive.length === 0
          && steps.every((step) => step.drawn.every((drawn) => drawn === (step.source === 'valid' ? 'soft' : 'hard'))))

      // The material status probe reads the bound depth texture as ready.
      await driveDepth(page, { source: 'valid' })
      const beforeCheck = (await readDepthReport(page)).runtimeCheck?.at ?? null
      await page.getByTestId('material-proof-depth-runtime-check').click()
      const checked = await waitDepthReport(page, (current) => current.runtimeCheck != null && current.runtimeCheck.at !== beforeCheck, 0, 'runtime check')
      run.check(`${viewport.id}:runtime-status-reads-depth-texture`, 'assertion', { state: 'ready', drawn: 'soft x3' },
        { result: checked.runtimeCheck?.result, drawn: checked.layers.map((layer) => layer.drawn) },
        (checked.runtimeCheck?.result as { state?: string } | undefined)?.state === 'ready' && DEPTH_LAYERS_SOFT(checked, 'soft'))

      // Unmount: the caller texture survives; only adapter-owned resources go.
      const mounted = await driveDepth(page, { source: 'valid' })
      const unmounted = await driveDepth(page, { source: 'valid', mounted: false })
      const remounted = await captureDepth(run, page, folder, 'remounted-valid', { source: 'valid', mounted: true })
      run.check(`${viewport.id}:caller-texture-survives-unmount`, 'assertion',
        { disposeEventsNotFromOwner: 0, disposeEventsDuringUnmount: 0, sameTexture: true, adapterTargetsDisposed: '+1', adapterMaterialsDisposed: '+2', remountedDrawn: 'soft x3' },
        {
          callerTexture: [mounted.callerTexture, unmounted.callerTexture, remounted.report.callerTexture],
          targetsDisposed: [mounted.host.targetsDisposed, unmounted.host?.targetsDisposed],
          ownedDisposed: [mounted.host.ownedDisposed, unmounted.host?.ownedDisposed],
          remountedDrawn: remounted.report.layers.map((layer) => layer.drawn),
        },
        unmounted.callerTexture.disposeEvents === mounted.callerTexture.disposeEvents
          && remounted.report.callerTexture.disposeEvents === remounted.report.callerTexture.ownerReleases
          && remounted.report.callerTexture.uuid === mounted.callerTexture.uuid
          && unmounted.host!.targetsDisposed === mounted.host.targetsDisposed + 1
          && unmounted.host!.ownedDisposed.materials === mounted.host.ownedDisposed.materials + 2
          && DEPTH_LAYERS_SOFT(remounted.report, 'soft'))
      const remountDelta = perspectiveSoft ? differingPixels(perspectiveSoft, remounted.png) : null
      run.check(`${viewport.id}:remounted-valid-equals-first-mount`, 'assertion', 0, remountDelta, remountDelta === 0)
    }
    const glErrors = await page.locator(PROOF_CANVAS).evaluate((element: HTMLCanvasElement) => element.dataset.pfxProofGlErrors ?? null)
    run.check(`${viewport.id}:no-webgl-errors`, 'assertion', null, glErrors, glErrors === null)
    run.check(`${viewport.id}:no-page-errors`, 'assertion', [], run.pageErrors.slice(errorsBefore), run.pageErrors.length === errorsBefore)
    await page.context().close()
  }
}

/** Main-thread animation-frame intervals. Diagnostic only: not a GPU duration. */
async function sampleRafIntervals(page: Page, frames: number): Promise<Record<string, number>> {
  const intervals = await page.evaluate(`new Promise((resolve) => {
    const times = []
    const step = (time) => {
      times.push(time)
      if (times.length > ${frames}) resolve(times.slice(1).map((value, index) => value - times[index]))
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })`) as number[]
  const sorted = [...intervals].sort((a, b) => a - b)
  const at = (quantile: number) => Math.round(sorted[Math.min(sorted.length - 1, Math.floor(quantile * sorted.length))]! * 10) / 10
  return { frames: intervals.length, p50: at(0.5), p95: at(0.95), max: at(1) }
}

const PREVIEW_PORT = 48374

interface OwnedPreview {
  child: ChildProcess
  url: string
  record: Record<string, unknown>
}

/** Builds this source into the run folder and serves it on an owned strict port. */
async function startOwnedPreview(run: RunContext): Promise<OwnedPreview> {
  const buildDir = path.join(run.outputDir, 'build')
  const viteBin = path.join(packageRoot, 'node_modules/vite/bin/vite.js')
  const buildExit = await runLogged(process.execPath, [viteBin, 'build', '--outDir', buildDir, '--emptyOutDir'], path.join(run.outputDir, 'build.log'))
  run.record.artifacts.push(relativeToPackage(path.join(run.outputDir, 'build.log')))
  if (buildExit !== 0) throw new HarnessError('ServerExited', `vite build exited ${buildExit}`)
  if (listenerPids(PREVIEW_PORT).length > 0) throw new HarnessError('PortBusy', `${HOST}:${PREVIEW_PORT} is busy; the runner does not attach to it`)
  const args = [viteBin, 'preview', '--outDir', buildDir, '--host', HOST, '--port', String(PREVIEW_PORT), '--strictPort']
  const log = fs.createWriteStream(path.join(run.outputDir, 'vite-preview.log'))
  const child = spawn(process.execPath, args, { cwd: packageRoot, stdio: ['ignore', 'pipe', 'pipe'] })
  child.stdout?.pipe(log)
  child.stderr?.pipe(log)
  run.record.artifacts.push(relativeToPackage(path.join(run.outputDir, 'vite-preview.log')))
  const url = `http://${HOST}:${PREVIEW_PORT}`
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline && !(await urlResponds(`${url}/`))) {
    if (child.exitCode != null) throw new HarnessError('ServerExited', `vite preview exited ${child.exitCode}`)
    await delay(100)
  }
  const owned = listenerPids(PREVIEW_PORT)
  if (owned.length !== 1 || owned[0] !== child.pid) {
    child.kill('SIGTERM')
    throw new HarnessError('OwnershipMismatch', `Port ${PREVIEW_PORT} listeners ${JSON.stringify(owned)} are not the preview child ${child.pid}`)
  }
  return { child, url, record: { command: [process.execPath, ...args].join(' '), pid: child.pid, buildDir: relativeToPackage(buildDir), listenerPids: owned } }
}

async function stopOwnedPreview(preview: OwnedPreview): Promise<Record<string, unknown>> {
  preview.child.kill('SIGTERM')
  if (!(await waitForExit(preview.child, 5_000))) {
    preview.child.kill('SIGKILL')
    await waitForExit(preview.child, 5_000)
  }
  let listeners = listenerPids(PREVIEW_PORT)
  for (let attempt = 0; attempt < 50 && listeners.length > 0; attempt += 1) {
    await delay(100)
    listeners = listenerPids(PREVIEW_PORT)
  }
  if (listeners.length > 0) throw new HarnessError('PortNotReleased', `Port ${PREVIEW_PORT} still has listeners ${listeners.join(', ')}`)
  return { exitCode: preview.child.exitCode, exitSignal: preview.child.signalCode, portClearAfter: true }
}

// ---------------------------------------------------------------------------
// Source audit: the four legacy pulse names against the real atlas sheets.

async function writeSourceAudit(run: RunContext): Promise<void> {
  const sheets = [PFX_FLAME_FLIPBOOK_ATLAS, PFX_FIREBALL_FLIPBOOK_ATLAS].map(({ dataUri, ...descriptor }) => ({
    ...descriptor,
    decoded: pngSize(dataUri),
  }))
  const sheetIds = new Set<string>(sheets.map((sheet) => sheet.id))
  const legacyNames = LEGACY_PULSE_NAMES.map((name) => {
    const controls = { flipbook: name, timing: 1 } as Pick<PfxControls, 'flipbook' | 'timing'>
    const first = getPfxFlipbookFrameProps(controls, 0)
    return {
      name,
      declaredSteps: first.frameCount,
      impliedGrid: [Math.round(1 / first.uvScale[0]), Math.round(1 / first.uvScale[1])],
      catalogPresets: PFX_PRESETS.filter((preset) => preset.controls.flipbook === name).length,
      matchingSheet: sheetIds.has(name) ? name : null,
    }
  })
  const atlasSurfaces = PFX_PRESETS.flatMap((preset) => getPfxRenderPlan(preset).surfaces
    .filter((surface) => surface.tuning?.flipbookAtlas)
    .map((surface) => ({ effectId: preset.effectId, phase: surface.phase, atlas: surface.tuning!.flipbookAtlas })))
  const surfaceSource = await fsp.readFile(path.join(packageRoot, 'src/PfxSurface.tsx'), 'utf8')
  const consumption = Object.fromEntries(['opacityMultiplier', 'sizeMultiplier', 'uvOffset', 'uvScale', 'frameIndex']
    .map((field) => [field, surfaceSource.split(`flipbook.${field}`).length - 1]))
  const staticAtlas = await run.writeArtifact('source-audit/static-sprite-atlas.png', decodeDataUri(PFX_SPRITE_ATLAS_DATA_URI))
  const pulseTable = MATERIAL_PROOF_EFFECTS.map((effectId) => {
    const preset = createPfxPreset(effectId, { seed: MATERIAL_PROOF_SEED })
    return {
      effectId,
      flipbook: preset.controls.flipbook,
      timing: preset.controls.timing,
      samples: BASELINE_TIMES_MS.map((timeMs) => ({ timeMs, ...getPfxFlipbookFrameProps(preset.controls, timeMs / 1000) })),
    }
  })
  const audit = {
    legacyNames,
    realSheets: sheets,
    catalogSurfacesWithRealSheet: atlasSurfaces,
    pfxSurfaceConsumesLegacyFields: consumption,
    staticSpriteAtlas: { file: staticAtlas, ...pngSize(PFX_SPRITE_ATLAS_DATA_URI) },
    observedPulseBaseline: pulseTable,
  }
  await run.writeArtifact('source-audit/atlas-and-pulse-audit.json', `${JSON.stringify(audit, null, 2)}\n`)
  run.check('source-audit:legacy-names-have-no-sheet', 'observation', null,
    legacyNames.map(({ name, matchingSheet }) => ({ name, matchingSheet })), undefined)
  run.check('source-audit:catalog-surfaces-with-real-sheet', 'observation', null, atlasSurfaces.length, undefined)
  run.check('source-audit:pfx-surface-legacy-field-uses', 'observation', null, consumption, undefined)
}

function decodeDataUri(dataUri: string): Buffer {
  const comma = dataUri.indexOf(',')
  if (!dataUri.startsWith('data:image/png;base64,') || comma < 0) throw new Error('Expected a base64 PNG data URI')
  return Buffer.from(dataUri.slice(comma + 1), 'base64')
}

function pngSize(dataUri: string): { width: number; height: number } {
  const png = PNG.sync.read(decodeDataUri(dataUri))
  return { width: png.width, height: png.height }
}

// ---------------------------------------------------------------------------
// T5 inspector case (V4): normal detail viewer, copied recipe replay through
// the three entry points, and measured runtime status with a real fault.

const INSPECTOR_EFFECT = 'flame-burst'
const INSPECTOR_TIME_MS = 250
const INSPECTOR_LAYER = 'flame-burst-particle-hot-cinders'
const INSPECTOR_PILOT_LAYER = 'flame-burst-particle-upward-licks'
const INSPECTOR_DISABLED_LAYER = 'flame-burst-particle-char-smoke'
// Flame layers set colorOverride, so the palette colour control reaches the
// portal pilot only. Its vortex layer reads controls.color[0].
const PALETTE_EFFECT = 'portal-idle-loop'
const PALETTE_LAYER = 'vortex-rim'
const STAGE_CANVAS = '[data-testid="pfx-3d-stage"] canvas'

interface RuntimeLogEntry {
  at: number
  value: string
}

/** Records every value of one attribute from now on, in the page. */
async function recordAttribute(page: Page, selector: string, attribute: string, key: string): Promise<void> {
  await page.evaluate(([target, name, store]) => {
    const element = document.querySelector(target)
    if (!element) throw new Error(`recordAttribute: ${target} is missing`)
    const log: RuntimeLogEntry[] = [{ at: performance.now(), value: element.getAttribute(name) ?? '' }]
    ;(window as unknown as Record<string, unknown>)[store] = log
    new MutationObserver(() => {
      const value = element.getAttribute(name) ?? ''
      if (log[log.length - 1]?.value !== value) log.push({ at: performance.now(), value })
    }).observe(element, { attributes: true, attributeFilter: [name] })
  }, [selector, attribute, key] as const)
}

async function readAttributeLog(page: Page, key: string): Promise<RuntimeLogEntry[]> {
  return page.evaluate((store) => ((window as unknown as Record<string, unknown>)[store] as RuntimeLogEntry[] | undefined) ?? [], key)
}

function parseRuntime(value: string): { state: string; revision: number } {
  const [state, revision] = value.split('@')
  return { state: state ?? '', revision: Number(revision) }
}

/** Each revision that settled must report loading first and settle once. */
function runtimeSequenceFindings(log: RuntimeLogEntry[]): string[] {
  const findings: string[] = []
  const byRevision = new Map<number, string[]>()
  for (const entry of log) {
    const { state, revision } = parseRuntime(entry.value)
    if (!Number.isFinite(revision)) continue
    byRevision.set(revision, [...(byRevision.get(revision) ?? []), state])
  }
  for (const [revision, states] of byRevision) {
    const settled = states.filter((state) => state !== 'loading')
    if (settled.length > 1) findings.push(`revision ${revision} settled more than once: ${states.join(',')}`)
    if (settled.length === 1 && states.indexOf(settled[0]!) < states.indexOf('loading')) findings.push(`revision ${revision} settled before loading`)
  }
  let maxRevision = -1
  for (const entry of log) {
    const { revision } = parseRuntime(entry.value)
    if (revision < maxRevision) findings.push(`revision went back from ${maxRevision} to ${revision}`)
    maxRevision = Math.max(maxRevision, revision)
  }
  return findings
}

async function settleFrames(page: Page): Promise<void> {
  await page.evaluate(`new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))`)
}

/** Waits until the viewer preview reports a settled state for its current revision. */
async function waitViewerSettled(page: Page, after: number, settled: 'ready' | 'error' = 'ready'): Promise<number> {
  const handle = await page.waitForFunction(([minimum, expected]) => {
    const stage = document.querySelector<HTMLElement>('[data-testid="pfx-3d-stage"]')
    const revision = Number(stage?.dataset.materialRevision)
    if (!(revision > minimum)) return null
    return stage?.dataset.materialRuntime === `${expected}@${revision}` ? revision : null
  }, [after, settled] as const, { timeout: 60_000 })
  await settleFrames(page)
  return (await handle.jsonValue()) as number
}

async function viewerRevision(page: Page): Promise<number> {
  return Number(await page.getByTestId('pfx-3d-stage').getAttribute('data-material-revision'))
}

async function stagePng(run: RunContext, page: Page, folder: string, name: string): Promise<{ file: string; png: PNG }> {
  const buffer = await page.locator(STAGE_CANVAS).screenshot({ type: 'png' })
  return { file: await run.writeArtifact(`${folder}/${name}.png`, buffer), png: PNG.sync.read(buffer) }
}

function activePixels(png: PNG): number {
  return countPfxReviewActivePixels(png.data, png.width, png.height)
}

async function openViewerLayer(page: Page, phase: string): Promise<void> {
  const details = page.locator('details.pfx-emitter').filter({ has: page.getByTestId(`pfx-emitter-toggle-${phase}`) })
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) await details.locator('summary .pfx-emitter-name').first().click()
  const material = page.getByTestId(`pfx-material-${phase}`)
  if (!(await material.evaluate((element) => (element as HTMLDetailsElement).open))) await material.locator('summary').click()
}

async function overflowOf(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

async function inspectorCase(run: RunContext): Promise<void> {
  const { record } = run
  record.inputs.viewports = VIEWPORTS
  record.inputs.inspector = { effect: INSPECTOR_EFFECT, timeMs: INSPECTOR_TIME_MS, camera: 'three-quarter', editedLayer: INSPECTOR_LAYER, disabledLayer: INSPECTOR_DISABLED_LAYER }
  record.notes.push(
    'Normal viewer: real detail route, production controls by accessible name, paused review time and camera, high quality by default.',
    'Runtime status comes from PfxMaterialRuntimeProbe: real program link status and texture load state of the mounted preview.',
    'The fault is a real image decode failure: a host atlas whose data URI passes the registry checks but is not a PNG.',
    'Replay uses the catalog preset and its seed for all three entry points, because PfxById takes no seed.',
  )
  await run.startServer()
  await run.launchBrowser()
  for (const viewport of VIEWPORTS) {
    const v = viewport.id
    const page = await run.newPage(viewport, { clipboardOrigin: ORIGIN })
    await runDoctor(run, page, ORIGIN, 'viewer', ownedExpectation(record), v)
    const errorsBefore = run.pageErrors.length

    // A. Normal detail viewer.
    const query = `profileEffectIds=${INSPECTOR_EFFECT}&reviewTimeMs=${INSPECTOR_TIME_MS}&reviewCamera=three-quarter&reviewFraming=isolated&reviewCapture=1`
    await page.goto(`${ORIGIN}/?${query}`)
    await page.getByTestId('pfx-emitter-panel').waitFor({ timeout: 30_000 })
    await page.locator(STAGE_CANVAS).waitFor({ timeout: 30_000 })
    await recordAttribute(page, '[data-testid="pfx-3d-stage"]', 'data-material-runtime', '__pfxViewerRuntime')
    let revision = await waitViewerSettled(page, -1)
    const qualitySelect = page.getByRole('combobox', { name: 'Material quality', exact: true })
    run.check(`${v}:viewer:quality-default-high`, 'assertion', 'high', await qualitySelect.inputValue(), (await qualitySelect.inputValue()) === 'high')

    await openViewerLayer(page, INSPECTOR_LAYER)
    const material = page.getByTestId(`pfx-material-${INSPECTOR_LAYER}`)
    const defaultText = (await page.getByTestId('pfx-material-default').first().textContent()) ?? ''
    run.check(`${v}:viewer:default-state-measured`, 'assertion', { state: 'default', runtime: `ready@${revision}`, text: 'The material is ready.' },
      { state: await material.getAttribute('data-state'), runtime: await material.getAttribute('data-runtime'), text: defaultText },
      (await material.getAttribute('data-state')) === 'default' && (await material.getAttribute('data-runtime')) === `ready@${revision}` && defaultText.includes('The material is ready.'))
    run.check(`${v}:viewer:no-unreported-copy`, 'assertion', 0, await page.getByText('does not report material status').count(),
      (await page.getByText('does not report material status').count()) === 0)
    await run.writeArtifact(`${v}/viewer/default-state.png`, await page.getByTestId('pfx-emitter-panel').screenshot())
    const base = await stagePng(run, page, `${v}/viewer`, '00-base')

    // Material feature pixels: UV rotation, dissolve, then distortion.
    await page.getByRole('checkbox', { name: `UV transform for ${INSPECTOR_LAYER}`, exact: true }).check()
    revision = await waitViewerSettled(page, revision)
    await page.getByRole('spinbutton', { name: `UV rotation (radians) for ${INSPECTOR_LAYER}`, exact: true }).fill('1.2')
    revision = await waitViewerSettled(page, revision)
    const uv = await stagePng(run, page, `${v}/viewer`, '01-uv-rotation')
    await page.getByRole('checkbox', { name: `Dissolve for ${INSPECTOR_LAYER}`, exact: true }).check()
    revision = await waitViewerSettled(page, revision)
    await page.getByRole('spinbutton', { name: `Dissolve for ${INSPECTOR_LAYER}`, exact: true }).fill('0.6')
    revision = await waitViewerSettled(page, revision)
    const dissolve = await stagePng(run, page, `${v}/viewer`, '02-dissolve')
    // Low-quality reference before distortion. The pilot layer has its own
    // high-only distortion, so low differs from high even here.
    await qualitySelect.selectOption('low')
    revision = await waitViewerSettled(page, revision)
    const lowReference = await stagePng(run, page, `${v}/viewer`, '02-low-before-distortion')
    await qualitySelect.selectOption('high')
    revision = await waitViewerSettled(page, revision)
    await page.getByRole('combobox', { name: `Distortion map for ${INSPECTOR_LAYER}`, exact: true }).selectOption('noise')
    revision = await waitViewerSettled(page, revision)
    await page.getByRole('spinbutton', { name: `Distortion strength (UV units) for ${INSPECTOR_LAYER}`, exact: true }).fill('0.25')
    revision = await waitViewerSettled(page, revision)
    const distortionHigh = await stagePng(run, page, `${v}/viewer`, '03-distortion-high')
    const featureDiffs = {
      uvVsBase: differingPixels(uv.png, base.png),
      dissolveVsUv: differingPixels(dissolve.png, uv.png),
      distortionVsDissolve: differingPixels(distortionHigh.png, dissolve.png),
    }
    run.check(`${v}:viewer:material-features-change-pixels`, 'assertion', 'each feature edit changes pixels (> 0)', featureDiffs,
      Object.values(featureDiffs).every((count) => count > 0))

    // Quality: low removes the high-only distortion and keeps its value.
    await qualitySelect.selectOption('low')
    revision = await waitViewerSettled(page, revision)
    const distortionLow = await stagePng(run, page, `${v}/viewer`, '04-distortion-low')
    const strength = page.getByRole('spinbutton', { name: `Distortion strength (UV units) for ${INSPECTOR_LAYER}`, exact: true })
    const lowState = {
      stage: await page.getByTestId('pfx-3d-stage').getAttribute('data-material-quality'),
      strengthValue: await strength.inputValue(),
      strengthDisabled: await strength.isDisabled(),
      reason: await strength.evaluate((element) => {
        const ids = element.getAttribute('aria-describedby')?.split(/\s+/) ?? []
        return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim()
      }),
      lowVsHigh: differingPixels(distortionLow.png, distortionHigh.png),
      lowVsLowWithoutDistortion: differingPixels(distortionLow.png, lowReference.png),
    }
    run.check(`${v}:viewer:low-quality`, 'assertion',
      { stage: 'low', strengthValue: '0.25', strengthDisabled: true, reason: 'non-empty', lowVsHigh: '> 0', lowVsLowWithoutDistortion: 0 }, lowState,
      lowState.stage === 'low' && lowState.strengthValue === '0.25' && lowState.strengthDisabled && lowState.reason.length > 0 &&
      lowState.lowVsHigh > 0 && lowState.lowVsLowWithoutDistortion === 0)
    await qualitySelect.selectOption('high')
    revision = await waitViewerSettled(page, revision)
    const highAgain = await stagePng(run, page, `${v}/viewer`, '05-distortion-high-again')
    run.check(`${v}:viewer:high-again-equals-high`, 'assertion', 0, differingPixels(highAgain.png, distortionHigh.png),
      differingPixels(highAgain.png, distortionHigh.png) === 0)

    // Existing Opacity and palette colour controls on the pilot.
    const pilotFields = page.locator('details.pfx-emitter').filter({ has: page.getByTestId(`pfx-emitter-toggle-${INSPECTOR_PILOT_LAYER}`) })
    await openViewerLayer(page, INSPECTOR_PILOT_LAYER)
    await pilotFields.locator('.pfx-emitter-fields label:has-text("opacity") input').first().fill('0.3')
    revision = await waitViewerSettled(page, revision)
    const opacity = await stagePng(run, page, `${v}/viewer`, '06-pilot-opacity')
    run.check(`${v}:viewer:existing-opacity-changes-pixels`, 'assertion', '> 0', differingPixels(opacity.png, highAgain.png),
      differingPixels(opacity.png, highAgain.png) > 0)

    // Disable one layer, then copy the recipe JSON.
    await page.getByTestId(`pfx-emitter-toggle-${INSPECTOR_DISABLED_LAYER}`).click()
    revision = await waitViewerSettled(page, revision)
    await stagePng(run, page, `${v}/viewer`, '08-before-copy')
    await page.evaluate(() => navigator.clipboard.writeText(''))
    await page.getByRole('button', { name: 'Copy recipe JSON' }).click()
    await page.getByRole('button', { name: 'Copied ✓' }).waitFor({ timeout: 5_000 })
    const copiedText = await page.evaluate(() => navigator.clipboard.readText())
    const copiedFile = await run.writeArtifact(`${v}/copied-recipe.json`, copiedText)
    const copied = parsePfxAuthoredRecipeJson(copiedText)
    const copiedLayer = copied.surfaces.find((surface) => surface.phase === INSPECTOR_LAYER)
    const copiedFacts = {
      file: copiedFile,
      layers: copied.surfaces.map((surface) => surface.phase),
      disabledOmitted: !copied.surfaces.some((surface) => surface.phase === INSPECTOR_DISABLED_LAYER),
      uvRotation: copiedLayer?.tuning?.material?.uv?.rotation ?? null,
      dissolveProgress: copiedLayer?.tuning?.material?.dissolve?.progress ?? null,
      distortionStrength: copiedLayer?.tuning?.material?.distortion?.strength ?? null,
      pilotOpacity: copied.surfaces.find((surface) => surface.phase === INSPECTOR_PILOT_LAYER)?.opacity ?? null,
      containsQuality: /"quality"/.test(copiedText),
    }
    run.check(`${v}:copy:recipe-json`, 'assertion',
      { disabledOmitted: true, uvRotation: 1.2, dissolveProgress: 0.6, distortionStrength: 0.25, pilotOpacity: 0.3, containsQuality: false }, copiedFacts,
      copiedFacts.disabledOmitted && copiedFacts.uvRotation === 1.2 && copiedFacts.dissolveProgress === 0.6 &&
      copiedFacts.distortionStrength === 0.25 && copiedFacts.pilotOpacity === 0.3 && !copiedFacts.containsQuality)

    const viewerLog = await readAttributeLog(page, '__pfxViewerRuntime')
    await run.writeArtifact(`${v}/viewer/runtime-log.json`, `${JSON.stringify(viewerLog, null, 2)}\n`)
    const viewerFindings = runtimeSequenceFindings(viewerLog)
    const viewerStates = new Set(viewerLog.map((entry) => parseRuntime(entry.value).state))
    run.check(`${v}:viewer:runtime-sequence`, 'assertion', 'loading before each settle; one settle per revision; no error',
      { entries: viewerLog.length, states: [...viewerStates], findings: viewerFindings },
      viewerFindings.length === 0 && viewerStates.has('loading') && viewerStates.has('ready') && !viewerStates.has('error'))
    run.check(`${v}:viewer:overflow`, 'assertion', 0, await overflowOf(page), (await overflowOf(page)) <= 0)
    await run.writeArtifact(`${v}/viewer/panel-after-edits.png`, await page.getByTestId('pfx-emitter-panel').screenshot())

    // Existing Opacity and palette colour on the portal pilot.
    const paletteQuery = `profileEffectIds=${PALETTE_EFFECT}&reviewTimeMs=420&reviewCamera=three-quarter&reviewFraming=isolated&reviewCapture=1`
    await page.goto(`${ORIGIN}/?${paletteQuery}`)
    await page.getByTestId('pfx-emitter-panel').waitFor({ timeout: 30_000 })
    let paletteRevision = await waitViewerSettled(page, -1)
    const paletteBase = await stagePng(run, page, `${v}/palette`, '00-base')
    await openViewerLayer(page, PALETTE_LAYER)
    await page.locator('details.pfx-emitter').filter({ has: page.getByTestId(`pfx-emitter-toggle-${PALETTE_LAYER}`) })
      .locator('.pfx-emitter-fields label:has-text("opacity") input').first().fill('0.35')
    paletteRevision = await waitViewerSettled(page, paletteRevision)
    const paletteOpacity = await stagePng(run, page, `${v}/palette`, '01-opacity')
    await page.locator('.pfx-color-list input[type="color"]').first().fill('#18c8ff')
    paletteRevision = await waitViewerSettled(page, paletteRevision)
    const paletteColour = await stagePng(run, page, `${v}/palette`, '02-palette-colour')
    const paletteDiffs = { opacityVsBase: differingPixels(paletteOpacity.png, paletteBase.png), colourVsOpacity: differingPixels(paletteColour.png, paletteOpacity.png) }
    run.check(`${v}:viewer:portal-opacity-and-palette-colour-change-pixels`, 'assertion', '> 0 each', paletteDiffs,
      paletteDiffs.opacityVsBase > 0 && paletteDiffs.colourVsOpacity > 0)

    // Empty state: a layer on an unsupported path.
    await page.goto(`${ORIGIN}/?profileEffectIds=shield-break&reviewTimeMs=420&reviewCamera=three-quarter&reviewCapture=1`)
    await page.getByTestId('pfx-emitter-panel').waitFor({ timeout: 30_000 })
    await openViewerLayer(page, 'glass-shards')
    const empty = page.getByTestId('pfx-material-glass-shards')
    run.check(`${v}:viewer:empty-state`, 'assertion', 'empty', await empty.getAttribute('data-state'), (await empty.getAttribute('data-state')) === 'empty')
    await run.writeArtifact(`${v}/viewer/empty-state.png`, await empty.screenshot())

    // Loading state. The page clock is paused, so no animation frame can
    // measure the new revision; the real pending state stays on screen.
    const loadingPage = await run.newPage(viewport)
    await loadingPage.clock.install()
    await loadingPage.goto(`${ORIGIN}/?${query}`)
    await loadingPage.getByTestId('pfx-emitter-panel').waitFor({ timeout: 30_000 })
    const loadingStart = await waitViewerSettled(loadingPage, -1)
    await openViewerLayer(loadingPage, INSPECTOR_LAYER)
    await loadingPage.clock.pauseAt(Date.now() + 1_000)
    await loadingPage.getByRole('checkbox', { name: `UV transform for ${INSPECTOR_LAYER}`, exact: true }).check()
    const loadingMaterial = loadingPage.getByTestId(`pfx-material-${INSPECTOR_LAYER}`)
    let loadingSeen: { state: string | null; runtime: string | null; text: string | null } = { state: null, runtime: null, text: null }
    for (let attempt = 0; attempt < 50 && loadingSeen.state !== 'loading'; attempt += 1) {
      loadingSeen = {
        state: await loadingMaterial.getAttribute('data-state'),
        runtime: await loadingMaterial.getAttribute('data-runtime'),
        text: await loadingMaterial.getByTestId('pfx-material-loading').textContent({ timeout: 100 }).catch(() => null),
      }
      if (loadingSeen.state !== 'loading') await delay(100)
    }
    await run.writeArtifact(`${v}/viewer/loading-state.png`, await loadingMaterial.screenshot())
    await loadingPage.clock.resume()
    const loadingEnd = await waitViewerSettled(loadingPage, loadingStart)
    run.check(`${v}:viewer:loading-state`, 'assertion',
      { state: 'loading', runtime: `loading@${loadingStart + 1}`, text: 'Loading material resources', thenReady: `ready@${loadingStart + 1}` },
      { ...loadingSeen, thenReady: await loadingPage.getByTestId('pfx-3d-stage').getAttribute('data-material-runtime'), loadingEnd },
      loadingSeen.state === 'loading' && loadingSeen.runtime === `loading@${loadingStart + 1}` &&
      (loadingSeen.text ?? '').includes('Loading material resources') && loadingEnd === loadingStart + 1)
    await loadingPage.context().close()

    // Reduced motion: measured status and decorative controls disabled.
    const reducedPage = await run.newPage(viewport, { reducedMotion: 'reduce' })
    await reducedPage.goto(`${ORIGIN}/?${query}`)
    await reducedPage.getByTestId('pfx-emitter-panel').waitFor({ timeout: 30_000 })
    const reducedRevision = await waitViewerSettled(reducedPage, -1)
    await openViewerLayer(reducedPage, INSPECTOR_PILOT_LAYER)
    const scroll = reducedPage.getByRole('spinbutton', { name: `UV scroll speed V (UV units per second) for ${INSPECTOR_PILOT_LAYER}`, exact: true })
    const reduced = {
      runtime: await reducedPage.getByTestId('pfx-3d-stage').getAttribute('data-material-runtime'),
      scrollDisabled: await scroll.isDisabled(),
      scrollValue: await scroll.inputValue(),
    }
    run.check(`${v}:viewer:reduced-motion`, 'assertion', { runtime: `ready@${reducedRevision}`, scrollDisabled: true }, reduced,
      reduced.runtime === `ready@${reducedRevision}` && reduced.scrollDisabled)
    await reducedPage.context().close()

    // B. Replay of the copied JSON through the three entry points.
    await page.goto(`${ORIGIN}/?materialProof=1`)
    await page.locator(PROOF_CANVAS).waitFor({ timeout: 30_000 })
    await page.getByLabel('Proof case').selectOption('recipe-replay')
    await page.getByLabel('Preview time (seconds)').fill(String(INSPECTOR_TIME_MS / 1000))
    await page.getByLabel('Camera').selectOption('three-quarter')
    const replays: Record<string, Record<string, { file: string; png: PNG; state: Record<string, unknown> }>> = {}
    const importJson = async (text: string) => {
      await page.getByLabel('Recipe JSON').fill(text)
      await page.getByRole('button', { name: 'Import recipe' }).click()
    }
    const invalidText = copiedText.replace('"rotation": 1.2', '"rotation": 9')
    if (invalidText === copiedText) throw new Error('The copied recipe has no "rotation": 1.2 entry to corrupt')
    await importJson(invalidText)
    const importError = (await page.getByTestId('material-proof-replay-error').textContent({ timeout: 10_000 })) ?? ''
    run.check(`${v}:replay:invalid-json-named-error`, 'assertion', 'names the uv.rotation field', importError,
      importError.includes('tuning.material.uv.rotation'))
    await importJson(copiedText)
    for (const quality of ['high', 'low'] as const) {
      await page.getByLabel('Material quality').selectOption(quality)
      replays[quality] = {}
      for (const entryPoint of ['game-pfx', 'pfx-by-id', 'drop-in'] as const) {
        await page.getByLabel('Entry point').selectOption(entryPoint)
        await waitForProofFrame(page)
        const capture = await captureProof(run, page, `${v}/replay-${quality}`, entryPoint)
        replays[quality]![entryPoint] = { file: capture.file, png: capture.png, state: capture.state }
      }
    }
    const replayState = replays.high!['game-pfx']!.state.replay as { layers: string[]; seed: number; effectId: string }
    for (const quality of ['high', 'low'] as const) {
      const set = replays[quality]!
      const diffs = { pfxById: differingPixels(set['pfx-by-id']!.png, set['game-pfx']!.png), dropIn: differingPixels(set['drop-in']!.png, set['game-pfx']!.png) }
      const active = activePixels(set['game-pfx']!.png)
      run.check(`${v}:replay:${quality}:three-entry-points-identical`, 'assertion', { pfxById: 0, dropIn: 0, activePixels: '> 100' }, { ...diffs, activePixels: active },
        diffs.pfxById === 0 && diffs.dropIn === 0 && active > 100)
    }
    run.check(`${v}:replay:high-differs-from-low`, 'assertion', '> 0 (distortion is high-only)',
      differingPixels(replays.high!['game-pfx']!.png, replays.low!['game-pfx']!.png), differingPixels(replays.high!['game-pfx']!.png, replays.low!['game-pfx']!.png) > 0)
    run.check(`${v}:replay:disabled-layer-omitted`, 'assertion', copied.surfaces.map((surface) => surface.phase), replayState,
      JSON.stringify(replayState.layers) === JSON.stringify(copied.surfaces.map((surface) => surface.phase)) && !replayState.layers.includes(INSPECTOR_DISABLED_LAYER))
    // The source recipe without the edits must look different.
    await importJson(JSON.stringify(AUTHORED_EFFECT_RECIPES[INSPECTOR_EFFECT]))
    await page.getByLabel('Material quality').selectOption('high')
    await page.getByLabel('Entry point').selectOption('game-pfx')
    await waitForProofFrame(page)
    const sourceReplay = await captureProof(run, page, `${v}/replay-high`, 'source-recipe-game-pfx')
    run.check(`${v}:replay:edits-in-effect`, 'assertion', '> 0', differingPixels(sourceReplay.png, replays.high!['game-pfx']!.png),
      differingPixels(sourceReplay.png, replays.high!['game-pfx']!.png) > 0)
    run.check(`${v}:replay:seed-and-time`, 'observation', null, { seed: replayState.seed, effectId: replayState.effectId, timeMs: INSPECTOR_TIME_MS, camera: 'three-quarter' })

    // C. Runtime status with a real decode fault.
    await page.getByLabel('Proof case').selectOption('runtime-status')
    await page.getByLabel('Material quality').selectOption('high')
    const statusInspector = page.getByTestId(`pfx-material-${INSPECTOR_PILOT_LAYER}`)
    await statusInspector.waitFor()
    await recordAttribute(page, `[data-testid="pfx-material-${INSPECTOR_PILOT_LAYER}"]`, 'data-runtime', '__pfxStatusRuntime')
    const statusOf = async () => (await readProofState(page)).runtimeStatus as { revision: number; runtime: { state: string; revision: number; message?: string }; display: string }
    const waitStatus = async (predicate: string) => {
      await page.waitForFunction((source) => {
        const state = JSON.parse(document.querySelector('[data-testid="material-proof-state"]')?.textContent ?? '{}') as { runtimeStatus?: unknown }
        return (new Function('status', `return ${source}`) as (status: unknown) => boolean)(state.runtimeStatus)
      }, predicate, { timeout: 60_000 })
      await waitForProofFrame(page)
    }
    await waitStatus(`status.runtime.state === 'ready' && status.runtime.revision === status.revision`)
    const ready = await captureProof(run, page, `${v}/status`, '00-ready')
    await statusInspector.locator('summary').click()
    const frameSelect = page.getByRole('combobox', { name: `Frame animation for ${INSPECTOR_PILOT_LAYER}`, exact: true })
    const registryOptions = await frameSelect.locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))
    run.check(`${v}:status:fixture-registry-options`, 'observation', null, registryOptions)

    await frameSelect.selectOption(PROOF_CORRUPT_ATLAS_ID)
    await waitStatus(`status.runtime.state === 'error' && status.runtime.revision === status.revision && status.display === 'fallback'`)
    const faulted = await captureProof(run, page, `${v}/status`, '01-error-fallback')
    const errorStatus = await statusOf()
    const errorUi = {
      state: await statusInspector.getAttribute('data-state'),
      message: (await page.getByTestId('pfx-material-error').textContent()) ?? '',
      retry: await page.getByTestId('pfx-material-retry').count(),
      selected: await frameSelect.inputValue(),
      vsReady: differingPixels(faulted.png, ready.png),
    }
    run.check(`${v}:status:error-keeps-last-valid-image`, 'assertion',
      { state: 'error', message: `names ${PROOF_CORRUPT_ATLAS_ID}`, retry: 1, selected: PROOF_CORRUPT_ATLAS_ID, vsReady: 0 }, errorUi,
      errorUi.state === 'error' && errorUi.message.includes(PROOF_CORRUPT_ATLAS_ID) && errorUi.retry === 1 && errorUi.selected === PROOF_CORRUPT_ATLAS_ID && errorUi.vsReady === 0)
    await run.writeArtifact(`${v}/status/error-state.png`, await statusInspector.screenshot())
    await run.writeArtifact(`${v}/status/error-page.png`, await page.screenshot({ fullPage: true }))

    await page.getByTestId('pfx-material-retry').focus()
    await page.keyboard.press('Enter')
    await waitStatus(`status.runtime.state === 'error' && status.runtime.revision === status.revision && status.revision > ${errorStatus.revision}`)
    const retried = await captureProof(run, page, `${v}/status`, '02-retry-error-fallback')
    const retryStatus = await statusOf()
    const retryLog = (await readAttributeLog(page, '__pfxStatusRuntime')).map((entry) => entry.value)
    const retryFacts = {
      revision: retryStatus.revision,
      log: retryLog,
      measuredAgain: retryLog.includes(`loading@${retryStatus.revision}`) && retryLog.includes(`error@${retryStatus.revision}`),
      selected: await frameSelect.inputValue(),
      vsReady: differingPixels(retried.png, ready.png),
    }
    run.check(`${v}:status:retry-measures-retained-values`, 'assertion',
      { measuredAgain: true, selected: PROOF_CORRUPT_ATLAS_ID, vsReady: 0 }, retryFacts,
      retryFacts.measuredAgain && retryFacts.selected === PROOF_CORRUPT_ATLAS_ID && retryFacts.vsReady === 0)
    const retryFocus = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
    run.check(`${v}:status:retry-keeps-keyboard-focus`, 'assertion', 'pfx-material-error', retryFocus,
      retryFocus === 'pfx-material-error')

    // Stale result: a pending fault measurement must not replace a newer edit.
    let stale: Record<string, unknown> | null = null
    for (let attempt = 1; attempt <= 5 && !stale?.exercised; attempt += 1) {
      await page.getByRole('button', { name: `Reset material for ${INSPECTOR_PILOT_LAYER}` }).click()
      await waitStatus(`status.runtime.state === 'ready' && status.runtime.revision === status.revision`)
      const before = (await statusOf()).revision
      // Two real change events on the visible select, in separate tasks.
      // A string body: the Node transform adds helpers that the page lacks.
      await page.evaluate(`new Promise((resolve) => {
        const select = document.querySelector(${JSON.stringify(`select[aria-label="Frame animation for ${INSPECTOR_PILOT_LAYER}"]`)})
        if (!select) throw new Error('frame animation select is missing')
        select.value = ${JSON.stringify(PROOF_CORRUPT_ATLAS_ID)}
        select.dispatchEvent(new Event('change', { bubbles: true }))
        setTimeout(() => {
          select.value = ${JSON.stringify(PROOF_ATLAS_ID)}
          select.dispatchEvent(new Event('change', { bubbles: true }))
          resolve(true)
        }, 0)
      })`)
      await waitStatus(`status.runtime.state === 'ready' && status.runtime.revision === status.revision && status.revision > ${before}`)
      const after = await statusOf()
      const log = (await readAttributeLog(page, '__pfxStatusRuntime')).map((entry) => entry.value)
      const tail = log.slice(log.lastIndexOf(`ready@${before}`) + 1)
      const faultRevisions = [...new Set(tail.map((value) => parseRuntime(value).revision))].filter((value) => value < after.revision)
      stale = {
        attempt,
        before,
        final: after.runtime,
        display: after.display,
        tail,
        // Exercised when the fault revision was still loading when the newer edit started.
        exercised: faultRevisions.length > 0 && faultRevisions.every((value) => !tail.includes(`error@${value}`)),
        errorAfterNewer: tail.slice(tail.findIndex((value) => parseRuntime(value).revision === after.revision)).some((value) => value.startsWith('error')),
        selected: await frameSelect.inputValue(),
      }
    }
    run.check(`${v}:status:stale-result-ignored`, 'assertion',
      { final: 'ready for the newest revision', display: 'candidate', errorAfterNewer: false, selected: PROOF_ATLAS_ID, exercised: true }, stale,
      stale != null && (stale.final as { state: string }).state === 'ready' && stale.display === 'candidate' && stale.errorAfterNewer === false &&
      stale.selected === PROOF_ATLAS_ID && stale.exercised === true)
    const recovered = await captureProof(run, page, `${v}/status`, '03-recovered-frame-animation')
    run.check(`${v}:status:recovered-shows-new-material`, 'assertion', '> 0', differingPixels(recovered.png, ready.png), differingPixels(recovered.png, ready.png) > 0)
    await run.writeArtifact(`${v}/status/default-state.png`, await statusInspector.screenshot())

    const statusLog = await readAttributeLog(page, '__pfxStatusRuntime')
    await run.writeArtifact(`${v}/status/runtime-log.json`, `${JSON.stringify(statusLog, null, 2)}\n`)
    const statusFindings = runtimeSequenceFindings(statusLog)
    run.check(`${v}:status:runtime-sequence`, 'assertion', [], statusFindings, statusFindings.length === 0)
    run.check(`${v}:status:overflow`, 'assertion', 0, await overflowOf(page), (await overflowOf(page)) <= 0)

    // Errors: the decode fault reports through the status, not the console.
    const newErrors = run.pageErrors.slice(errorsBefore)
    run.check(`${v}:no-page-or-console-errors`, 'assertion', [], newErrors, newErrors.length === 0)
    await page.context().close()
  }
}

// ---------------------------------------------------------------------------
// Source identity, versions, and process helpers

function readSourceIdentity(): SourceIdentity {
  const git = (args: string[]) => execFileSync('git', args, { cwd: packageRoot, maxBuffer: 256 * 1024 * 1024 })
  const repoRoot = git(['rev-parse', '--show-toplevel']).toString().trim()
  const sha = git(['rev-parse', 'HEAD']).toString().trim()
  const hash = createHash('sha256')
  hash.update(git(['diff', 'HEAD', '--binary']))
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z', '--full-name', '--', repoRoot])
    .toString().split('\0').filter(Boolean).sort()
  for (const file of untracked) {
    hash.update(`\0untracked:${file}\0`)
    hash.update(sha256(fs.readFileSync(path.join(repoRoot, file))))
  }
  const dirtyPaths = git(['status', '--porcelain=v1', '-z', '--untracked-files=all'])
    .toString().split('\0').filter(Boolean).map((line) => line.slice(3))
  const packageSrcClean = git(['status', '--porcelain=v1', '--untracked-files=all', '--', 'src']).toString().trim() === ''
  return {
    sha,
    diffHash: hash.digest('hex'),
    dirtyPaths,
    packageSrcClean,
    lockfileSha256: sha256(fs.readFileSync(path.join(packageRoot, 'package-lock.json'))),
  }
}

function readVersions(): Record<string, string> {
  const packageVersion = (name: string) =>
    (JSON.parse(fs.readFileSync(path.join(packageRoot, 'node_modules', name, 'package.json'), 'utf8')) as { version: string }).version
  return {
    node: process.version,
    npm: execFileSync('npm', ['--version']).toString().trim(),
    playwright: packageVersion('playwright'),
    vite: packageVersion('vite'),
    three: packageVersion('three'),
    platform: `${process.platform}-${process.arch}`,
  }
}

function runLogged(command: string, args: string[], logPath: string): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const log = fs.createWriteStream(logPath)
    log.write(`$ ${command} ${args.join(' ')}\n`)
    const child = spawn(command, args, { cwd: packageRoot, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout?.on('data', (chunk) => { log.write(chunk); process.stdout.write(chunk) })
    child.stderr?.on('data', (chunk) => { log.write(chunk); process.stderr.write(chunk) })
    child.once('error', (error) => { log.end(); reject(error) })
    child.once('exit', (code) => { log.end(() => resolve(code)) })
  })
}

function parseOptions(argv: string[]): Options {
  const read = (name: string): string | undefined => {
    for (let index = 0; index < argv.length; index += 1) {
      if (argv[index] === name) return argv[index + 1]
      if (argv[index]!.startsWith(`${name}=`)) return argv[index]!.slice(name.length + 1)
    }
    return undefined
  }
  const usage = 'Usage: verify-material-controls.ts --case <baseline|negative-control|capture|doctor|shader|cost|inspector|depth> --output <.context/...> ' +
    '[--batch <id> --effect <a,b>] [--quality <low|high>] [--attach-url <url> --expect-run-token <t> --expect-source-revision <sha>]'
  const proofCase = read('--case')
  const output = read('--output')
  const allCases: readonly string[] = [...IMPLEMENTED_CASES, ...Object.keys(PLANNED_CASES)]
  if (!proofCase || !allCases.includes(proofCase) || !output) {
    process.stderr.write(`${usage}\n`)
    process.exit(64)
  }
  return {
    proofCase: proofCase as ProofCase,
    output,
    batch: read('--batch'),
    effects: (read('--effect') ?? '').split(',').map((value) => value.trim()).filter(Boolean),
    attachUrl: read('--attach-url'),
    expectRunToken: read('--expect-run-token'),
    expectSourceRevision: read('--expect-source-revision'),
    quality: readQuality(read('--quality'), proofCase, usage),
  }
}

function readQuality(raw: string | undefined, proofCase: string, usage: string): 'low' | 'high' | undefined {
  if (raw === undefined) return undefined
  if ((raw !== 'low' && raw !== 'high') || (proofCase !== 'capture' && proofCase !== 'doctor')) {
    process.stderr.write(`--quality must be low or high, and only with --case capture or doctor (got ${raw} for ${proofCase})\n${usage}\n`)
    process.exit(64)
  }
  return raw
}

/** Evidence goes only to ignored package folders. */
function resolveEvidencePath(output: string): string {
  const resolved = path.resolve(packageRoot, output)
  const allowed = ['.context', '.profiles'].map((folder) => path.join(packageRoot, folder) + path.sep)
  if (!allowed.some((prefix) => resolved.startsWith(prefix))) {
    process.stderr.write(`Usage: --output must be inside .context/ or .profiles/ (got ${output})\n`)
    process.exit(64)
  }
  return resolved
}

function relativeToPackage(file: string): string {
  return path.relative(packageRoot, file).split(path.sep).join('/')
}

function sha256(contents: Buffer | string): string {
  return createHash('sha256').update(contents).digest('hex')
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  const temporary = `${file}.tmp-${process.pid}`
  await fsp.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`)
  await fsp.rename(temporary, file)
}

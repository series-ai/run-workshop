import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { chromium, type Page } from 'playwright'
import { PNG } from 'pngjs'
import {
  PFX_PRESETS,
  PFX_TAXONOMY,
  createReducedMotionPfxPreset,
  getPfxBurstCycleSeconds,
} from '../../src/index'
import {
  assemblePfxQualityMatrixPerformanceReviews,
  collectPfxCaptureDomDefects,
  collectPfxReviewFramingDefects,
  countPfxReviewActivePixels,
  createPfxQualityImprovementLedgerFromMatrix,
  createPfxQualityMatrixBaseline,
  createPfxQualityMatrixEffectRows,
  createPfxReducedMotionReviewSampleMs,
  createPfxTelegraphMinimumDecaySampleMs,
  createPfxTelegraphMinimumOnsetSampleMs,
  createPfxVisualReviewFramingTimes,
  createPfxRenderSourceFingerprint,
  createPfxReviewCameraDistance,
  createPfxVisualLifecycleSchedule,
  createPfxVisualReviewCycleMs,
  selectPfxVisualLifecycleRefinementTime,
  sumPfxReviewVisualEnergy,
  type BrowserProfileReport,
  type PfxMatrixDeviceRegistry,
  type PfxMatrixPerformanceReportSource,
  type PfxPeerVisualReviewReport,
  type PfxVisualCaptureManifest,
  type PfxVisualLifecycleSample,
} from '../src/profiling'
import {
  assemblePfxQualityIteration,
  collectPfxCapturePixelDefects,
  createPfxFingerprintAuditEffectIds,
  createPfxQualityStatus,
  createPfxVisualCaptureManifest,
  isPfxRenderSourceForEffect,
  parsePfxPeerVisualReviewReport,
  shouldAcceptPfxEmptyProbe,
  type CreatePfxVisualCaptureManifestInput,
  type PfxQualityDecisionRecord,
} from '../src/qualityWorkflow'

const packageRoot = process.cwd()
const command = process.argv[2]
const args = process.argv.slice(3)
const defaultUrl = 'http://127.0.0.1:48373/'
const canonicalMatrixPath = '.context/r3f-pfx-quality-matrix.json'
const canonicalLedgerPath = '.context/r3f-pfx-quality-ledger.json'
const trackedStatusPath = 'quality/current-status.md'
const trackedDecisionsPath = 'quality/decisions.jsonl'
let reviewCaptureSerial = 0

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})

async function main(): Promise<void> {
  if (command === 'capture') return captureCommand()
  if (command === 'assemble') return assembleCommand()
  if (command === 'status') return statusCommand()
  throw new Error('Usage: quality-review.ts <capture|assemble|status> [options]')
}

async function captureCommand(): Promise<void> {
  const effectIds = readArgs(args, '--effect').flatMap(splitList)
  const batchId = readArg(args, '--batch')
  const baseUrl = readArg(args, '--url') ?? defaultUrl
  if (effectIds.length === 0) throw new Error('quality:capture requires at least one explicit --effect')
  if (!batchId) throw new Error('quality:capture requires --batch <batch-id>')
  const knownEffects = new Set(PFX_TAXONOMY.map((effect) => effect.id))
  const uniqueEffectIds = [...new Set(effectIds)]
  for (const effectId of uniqueEffectIds) {
    if (!knownEffects.has(effectId)) throw new Error(`Unknown PFX effect: ${effectId}`)
  }

  const outputRelative = `.context/quality/${batchId}`
  const outputDirectory = resolvePackagePath(outputRelative)
  if (fs.existsSync(outputDirectory)) {
    throw new Error(`Quality capture batch already exists: ${outputRelative}`)
  }
  const parentDirectory = path.dirname(outputDirectory)
  await fsp.mkdir(parentDirectory, { recursive: true })
  const temporaryDirectory = path.join(parentDirectory, `.${batchId}.tmp-${process.pid}`)
  await fsp.rm(temporaryDirectory, { recursive: true, force: true })
  await fsp.mkdir(temporaryDirectory, { recursive: true })

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  let server: ChildProcess | undefined
  try {
    server = await ensureViewerServer(baseUrl)
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({
      viewport: { width: 960, height: 960 },
      deviceScaleFactor: 1,
    })
    const manifestEffects: CreatePfxVisualCaptureManifestInput['effects'] = []
    for (const [effectIndex, effectId] of uniqueEffectIds.entries()) {
      const sourceFingerprint = await currentRenderSourceFingerprint(effectId)
      const capture = await captureEffectEvidence(page, {
        baseUrl,
        effectId,
        effectIndex,
        outputRelative,
        temporaryDirectory,
      })
      manifestEffects.push({ effectId, sourceFingerprint, ...capture })
      process.stdout.write(`${effectId}: captured 11 deterministic review frames\n`)
    }
    const manifest = createPfxVisualCaptureManifest({ batchId, effects: manifestEffects })
    const manifestTemporaryPath = path.join(temporaryDirectory, '.manifest.json.tmp')
    await fsp.writeFile(manifestTemporaryPath, `${JSON.stringify(manifest, null, 2)}\n`)
    await fsp.rename(manifestTemporaryPath, path.join(temporaryDirectory, 'manifest.json'))
    await fsp.rename(temporaryDirectory, outputDirectory)
    process.stdout.write(`${outputRelative}/manifest.json: wrote ${manifest.effects.length} effect row(s)\n`)
  } catch (error) {
    await fsp.rm(temporaryDirectory, { recursive: true, force: true })
    throw error
  } finally {
    await browser?.close()
    if (server && server.exitCode == null) server.kill('SIGTERM')
  }
}

async function captureEffectEvidence(
  page: Page,
  options: {
    baseUrl: string
    effectId: string
    effectIndex: number
    outputRelative: string
    temporaryDirectory: string
  },
): Promise<Omit<CreatePfxVisualCaptureManifestInput['effects'][number], 'effectId' | 'sourceFingerprint'>> {
  const preset = PFX_PRESETS.find((candidate) => candidate.effectId === options.effectId)
  const taxonomy = PFX_TAXONOMY.find((candidate) => candidate.id === options.effectId)
  if (!preset || !taxonomy) throw new Error(`Missing PFX catalog data for ${options.effectId}`)
  const cycleMs = createPfxVisualReviewCycleMs(
    preset.preview.clip.durationMs,
    getPfxBurstCycleSeconds(preset),
    taxonomy.loopMode,
  )
  const candidateTimes = lifecycleCandidateTimes(cycleMs)
  const samples: Array<{
    sampleMs: number
    aggregateActivePixels: number
    aggregateVisualEnergy: number
  }> = []
  for (const sampleMs of candidateTimes) {
    let aggregateActivePixels = 0
    let aggregateVisualEnergy = 0
    for (const angle of ['front', 'three-quarter', 'side'] as const) {
      const buffer = await captureReviewFrame(page, {
        baseUrl: options.baseUrl,
        effectId: options.effectId,
        angle,
        sampleMs,
        distance: 5.2,
        framing: 'isolated',
        allowEmptyProbe: true,
      })
      const png = PNG.sync.read(buffer)
      aggregateActivePixels += countPfxReviewActivePixels(png.data, png.width, png.height)
      aggregateVisualEnergy += sumPfxReviewVisualEnergy(png.data, png.width, png.height)
    }
    samples.push({ sampleMs, aggregateActivePixels, aggregateVisualEnergy })
  }
  const minimumDecaySampleMs = taxonomy.role === 'telegraph'
    ? createPfxTelegraphMinimumDecaySampleMs(cycleMs)
    : 0
  for (let refinement = 0; refinement < 4; refinement += 1) {
    const sampleMs = selectPfxVisualLifecycleRefinementTime(
      samples,
      16,
      minimumDecaySampleMs,
    )
    if (sampleMs == null || samples.some((sample) => sample.sampleMs === sampleMs)) break
    let aggregateActivePixels = 0
    let aggregateVisualEnergy = 0
    for (const angle of ['front', 'three-quarter', 'side'] as const) {
      const buffer = await captureReviewFrame(page, {
        baseUrl: options.baseUrl,
        effectId: options.effectId,
        angle,
        sampleMs,
        distance: 5.2,
        framing: 'isolated',
        allowEmptyProbe: true,
      })
      const png = PNG.sync.read(buffer)
      aggregateActivePixels += countPfxReviewActivePixels(png.data, png.width, png.height)
      aggregateVisualEnergy += sumPfxReviewVisualEnergy(png.data, png.width, png.height)
    }
    samples.push({ sampleMs, aggregateActivePixels, aggregateVisualEnergy })
  }
  const lifecycle = createPfxVisualLifecycleSchedule(samples, {
    persistentLoop: taxonomy.loopMode === 'loop',
    burstCycleMs: taxonomy.loopMode === 'burst' ? cycleMs : undefined,
    preferEarlyImpulse: taxonomy.effectType === 'impact' || taxonomy.effectType === 'weapon',
    preferDestructiveTransition: taxonomy.effectType === 'dissolve',
    minimumOnsetSampleMs: taxonomy.role === 'telegraph'
      ? createPfxTelegraphMinimumOnsetSampleMs(cycleMs)
      : undefined,
    minimumDecaySampleMs: minimumDecaySampleMs || undefined,
  })
  let unionPng: PNG | undefined
  for (const sampleMs of createPfxVisualReviewFramingTimes(lifecycle)) {
    for (const angle of ['front', 'three-quarter', 'side'] as const) {
      const buffer = await captureReviewFrame(page, {
        baseUrl: options.baseUrl,
        effectId: options.effectId,
        angle,
        sampleMs,
        distance: 5.2,
        framing: 'isolated',
      })
      const png = PNG.sync.read(buffer)
      unionPng = mergePfxReviewUnion(unionPng, png)
    }
  }
  if (!unionPng) throw new Error(`Could not frame visual lifecycle for ${options.effectId}`)
  const cameraDistance = createPfxReviewCameraDistance(
    unionPng.data,
    unionPng.width,
    unionPng.height,
    5.2,
    0.62,
  )
  const prefix = `${String(options.effectIndex + 1).padStart(3, '0')}-${options.effectId}`
  const lifecycleCaptures: CreatePfxVisualCaptureManifestInput['effects'][number]['lifecycleCaptures'] = []
  for (const sample of lifecycle) {
    for (const angle of ['front', 'three-quarter', 'side'] as const) {
      const fileName = `${prefix}-${sample.phase}-${angle}.png`
      const buffer = await captureReviewFrame(page, {
        baseUrl: options.baseUrl,
        effectId: options.effectId,
        angle,
        sampleMs: sample.sampleMs,
        distance: cameraDistance,
        framing: 'isolated',
      })
      await fsp.writeFile(path.join(options.temporaryDirectory, fileName), buffer)
      lifecycleCaptures.push({
        angle,
        phase: sample.phase,
        file: `${options.outputRelative}/${fileName}`,
      })
    }
  }
  const peak = lifecycle.find((sample) => sample.phase === 'peak')
  if (!peak) throw new Error(`PFX lifecycle schedule has no peak for ${options.effectId}`)
  const gameplayFileName = `${prefix}-gameplay-context-peak-three-quarter.png`
  await fsp.writeFile(
    path.join(options.temporaryDirectory, gameplayFileName),
    await captureReviewFrame(page, {
      baseUrl: options.baseUrl,
      effectId: options.effectId,
      angle: 'three-quarter',
      sampleMs: peak.sampleMs,
      distance: cameraDistance,
      framing: 'gameplay-context',
    }),
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reducedMotionPreset = createReducedMotionPfxPreset(preset)
  const reducedMotionPeakSampleMs = createPfxReducedMotionReviewSampleMs(
    peak.sampleMs,
    preset.controls.timing,
    reducedMotionPreset.controls.timing,
    cycleMs,
  )
  const reducedFileName = `${prefix}-reduced-motion-peak-three-quarter.png`
  await fsp.writeFile(
    path.join(options.temporaryDirectory, reducedFileName),
    await captureReviewFrame(page, {
      baseUrl: options.baseUrl,
      effectId: options.effectId,
      angle: 'three-quarter',
      sampleMs: reducedMotionPeakSampleMs,
      distance: cameraDistance,
      framing: 'gameplay-context',
    }),
  )
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  return {
    cameraDistance,
    lifecycleSamples: lifecycle.map(({ phase, sampleMs }) => ({ phase, sampleMs })),
    lifecycleCaptures,
    gameplayContextCaptures: [{
      angle: 'three-quarter',
      phase: 'peak',
      file: `${options.outputRelative}/${gameplayFileName}`,
    }],
    reducedMotionCapture: {
      angle: 'three-quarter',
      phase: 'peak',
      file: `${options.outputRelative}/${reducedFileName}`,
    },
  }
}

async function captureReviewFrame(
  page: Page,
  options: {
    baseUrl: string
    effectId: string
    angle: 'front' | 'three-quarter' | 'side'
    sampleMs: number
    distance: number
    framing: 'isolated' | 'gameplay-context'
    allowEmptyProbe?: boolean
  },
): Promise<Buffer> {
  reviewCaptureSerial += 1
  const captureToken = [
    options.effectId,
    options.angle,
    options.sampleMs,
    options.framing,
    reviewCaptureSerial,
  ].join(':')
  const url = new URL(options.baseUrl)
  url.searchParams.set('profileEffectIds', options.effectId)
  url.searchParams.set('reviewCamera', options.angle)
  url.searchParams.set('reviewCameraDistance', options.distance.toFixed(4))
  url.searchParams.set('reviewTimeMs', String(options.sampleMs))
  url.searchParams.set('reviewFraming', options.framing)
  url.searchParams.set('reviewCapture', '1')
  url.searchParams.set('reviewCaptureToken', captureToken)
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
  const stage = page.getByTestId('pfx-3d-stage')
  await stage.waitFor({ state: 'visible', timeout: 15_000 })
  const canvas = stage.locator('canvas')
  await canvas.waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForFunction(
    (expectedToken) =>
      document.querySelector<HTMLCanvasElement>('[data-testid="pfx-3d-stage"] canvas')
        ?.dataset.pfxReviewCaptureToken === expectedToken,
    captureToken,
    { timeout: 15_000 },
  )
  await page.evaluate(`(async () => {
    await document.fonts.ready;
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  })()`)
  const snapshot = await page.evaluate(`(() => ({
    images: [...document.images].map((image) => ({
      src: image.currentSrc || image.src,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
    })),
    errorOverlayCount: document.querySelectorAll('vite-error-overlay').length,
  }))()`) as {
    images: Array<{ src: string; complete: boolean; naturalWidth: number }>
    errorOverlayCount: number
  }
  const defects = collectPfxCaptureDomDefects(snapshot)
  if (defects.length > 0) {
    throw new Error(`Invalid capture frame for ${options.effectId}: ${defects.join('; ')}`)
  }
  const maximumAttempts = 60
  let finalPixelDefects = ['capture contains no review-active pixels']
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const screenshot = await canvas.screenshot({ type: 'png' })
    const png = PNG.sync.read(screenshot)
    const activePixels = countPfxReviewActivePixels(png.data, png.width, png.height)
    const pixelDefects = collectPfxCapturePixelDefects(activePixels)
    const framingDefects = collectPfxReviewFramingDefects(png.data, png.width, png.height)
    finalPixelDefects = [...pixelDefects, ...framingDefects]
    if (finalPixelDefects.length === 0) return screenshot
    if (framingDefects.length === 0 && shouldAcceptPfxEmptyProbe(
      activePixels,
      attempt,
      maximumAttempts,
      options.allowEmptyProbe === true,
    )) return screenshot
    await page.evaluate(`new Promise((resolve) => requestAnimationFrame(resolve))`)
  }
  throw new Error(
    `Invalid capture frame for ${options.effectId} at ${options.sampleMs}ms ` +
    `(${options.angle}, ${options.framing}): ${finalPixelDefects.join('; ')}`,
  )
}

async function assembleCommand(): Promise<void> {
  const iteration = Number.parseInt(readArg(args, '--iteration') ?? '', 10)
  const reviewPaths = splitList(readArg(args, '--reviews') ?? '')
  if (!Number.isInteger(iteration) || iteration < 1) {
    throw new Error('quality:assemble requires --iteration <positive integer>')
  }
  if (reviewPaths.length < 3) {
    throw new Error('quality:assemble requires three independent reviews')
  }
  const reviews = await Promise.all(reviewPaths.map(loadReviewSource))
  const reviewedEffectIds = [...new Set(reviews.flatMap((source) =>
    source.review.effects.map((effect) => effect.effectId)))]
  const previousMatrix = await readJsonIfPresent(canonicalMatrixPath)
  const fingerprintAuditEffectIds = createPfxFingerprintAuditEffectIds(
    reviewedEffectIds,
    previousMatrix as {
      effects?: Array<{ effectId: string; sourceFingerprint: string | null }>
    } | undefined,
  )
  const currentSourceFingerprints = Object.fromEntries(
    await Promise.all(fingerprintAuditEffectIds.map(async (effectId) =>
      [effectId, await currentRenderSourceFingerprint(effectId)] as const)),
  )
  const reducedMotionReadableEffectIds: string[] = []
  for (const source of reviews) {
    await validateManifestEvidencePaths(source.manifest)
    for (const effect of source.manifest.effects) {
      if (effect.reducedMotionCapture) {
        await requireFile(effect.reducedMotionCapture.file, `reduced-motion proof for ${effect.effectId}`)
        reducedMotionReadableEffectIds.push(effect.effectId)
      }
    }
  }
  const performanceReviews = await loadPerformanceReviews(reviewedEffectIds)
  const previous = await readJsonIfPresent(canonicalLedgerPath)
  const adjudicationEffectIds = splitList(readArg(args, '--adjudicate') ?? '')
  if (adjudicationEffectIds.length > 0) {
    const previousRows = new Map(
      ((previousMatrix as { effects?: Array<{ effectId?: string; sourceFingerprint?: string | null }> } | undefined)
        ?.effects ?? [])
        .filter((effect): effect is { effectId: string; sourceFingerprint?: string | null } =>
          typeof effect.effectId === 'string')
        .map((effect) => [effect.effectId, effect]),
    )
    for (const effectId of adjudicationEffectIds) {
      const previousFingerprint = previousRows.get(effectId)?.sourceFingerprint
      if (!previousFingerprint || previousFingerprint !== currentSourceFingerprints[effectId]) {
        throw new Error(`PFX quality adjudication requires an unchanged source fingerprint for ${effectId}`)
      }
    }
  }
  const decision = createCliDecisionInput(previousMatrix, currentSourceFingerprints)
  const result = assemblePfxQualityIteration({
    iteration,
    effects: createPfxQualityMatrixEffectRows(),
    reviews,
    currentSourceFingerprints,
    reducedMotionReadableEffectIds: [...new Set(reducedMotionReadableEffectIds)],
    performanceReviews,
    previous: previous as never,
    previousMatrix: previousMatrix as never,
    adjudicationEffectIds,
    decision,
  })
  const status = createPfxQualityStatus(result.matrix, result.ledger, currentSourceFingerprints)
  const iterationPath = `.context/quality/iterations/iteration-${String(iteration).padStart(4, '0')}.json`
  if (fs.existsSync(resolvePackagePath(iterationPath))) {
    throw new Error(`PFX quality iteration record already exists: ${iterationPath}`)
  }
  await writeJsonAtomic(iterationPath, {
    ...result,
    inputs: {
      reviews: reviewPaths,
      currentSourceFingerprints,
    },
  })
  await writeJsonAtomic(canonicalLedgerPath, result.ledger)
  await writeTextAtomic(trackedStatusPath, status.markdown)
  // The matrix is the approval-bearing artifact, so publish it only after all
  // non-approving iteration, ledger, and handoff artifacts succeed.
  await writeJsonAtomic(canonicalMatrixPath, result.matrix)
  if (result.decisionRecord) await appendDecisionRecord(result.decisionRecord)
  process.stdout.write(status.markdown)
}

function createCliDecisionInput(
  previousMatrix: unknown,
  currentSourceFingerprints: Readonly<Record<string, string>>,
): Omit<
  PfxQualityDecisionRecord,
  'schema' | 'iteration' | 'afterFingerprints' | 'convergenceVerdict'
> | undefined {
  const hypothesis = readArg(args, '--hypothesis')
  if (!hypothesis) return undefined
  const defectKey = readArg(args, '--defect-key')
  const affectedEffects = splitList(readArg(args, '--affected-effects') ?? '')
  const changedPaths = splitList(readArg(args, '--changed-paths') ?? '')
  const result = readArg(args, '--result')
  const validator = readArg(args, '--validator')
  const craftGuideAnchor = readArg(args, '--craft-guide-anchor')
  if (!defectKey || !result || !validator || !craftGuideAnchor || affectedEffects.length === 0 || changedPaths.length === 0) {
    throw new Error(
      'Decision metadata requires --defect-key, --affected-effects, --changed-paths, --result, --validator, and --craft-guide-anchor',
    )
  }
  const rows = (
    previousMatrix as { effects?: Array<{ effectId?: string; sourceFingerprint?: string | null }> } | undefined
  )?.effects ?? []
  const beforeFingerprints = Object.fromEntries(affectedEffects.map((effectId) => {
    const fingerprint = rows.find((row) => row.effectId === effectId)?.sourceFingerprint
    if (!fingerprint) throw new Error(`Previous quality matrix has no source fingerprint for ${effectId}`)
    if (!currentSourceFingerprints[effectId]) {
      throw new Error(`Current review inputs have no source fingerprint for ${effectId}`)
    }
    return [effectId, fingerprint]
  }))
  return {
    hypothesis,
    defectKey,
    affectedEffects,
    changedPaths,
    beforeFingerprints,
    result,
    validator,
    craftGuideAnchor,
  }
}

async function statusCommand(): Promise<void> {
  const matrix = await readJsonIfPresent(canonicalMatrixPath) ?? createPfxQualityMatrixBaseline()
  const ledger = await readJsonIfPresent(canonicalLedgerPath) ??
    createPfxQualityImprovementLedgerFromMatrix(matrix as never, 1)
  const fingerprints: Record<string, string> = {}
  for (const effect of (matrix as ReturnType<typeof createPfxQualityMatrixBaseline>).effects) {
    if (effect.sourceFingerprint) fingerprints[effect.effectId] = await currentRenderSourceFingerprint(effect.effectId)
  }
  const status = createPfxQualityStatus(matrix as never, ledger as never, fingerprints)
  const output = readArg(args, '--write')
  if (output) await writeTextAtomic(output, status.markdown)
  process.stdout.write(status.markdown)
}

async function loadReviewSource(reviewPath: string): Promise<{
  review: PfxPeerVisualReviewReport
  manifest: PfxVisualCaptureManifest
}> {
  const parsed = await readJsonRequired(reviewPath, 'peer-review input') as
    PfxPeerVisualReviewReport | {
      review: PfxPeerVisualReviewReport
      manifest?: PfxVisualCaptureManifest
      manifestPath?: string
    }
  const review = parsePfxPeerVisualReviewReport('review' in parsed ? parsed.review : parsed)
  const manifest = 'review' in parsed && parsed.manifest
    ? parsed.manifest
    : await readJsonRequired(
        'review' in parsed && parsed.manifestPath
          ? parsed.manifestPath
          : `.context/quality/${review.batchId}/manifest.json`,
        `capture manifest for ${review.batchId}`,
      ) as PfxVisualCaptureManifest
  return { review, manifest }
}

async function validateManifestEvidencePaths(manifest: PfxVisualCaptureManifest): Promise<void> {
  for (const effect of manifest.effects) {
    for (const capture of [...effect.lifecycleCaptures, ...effect.gameplayContextCaptures]) {
      await requireFile(capture.file, `visual evidence for ${effect.effectId}`)
    }
  }
}

async function loadPerformanceReviews(effectIds: readonly string[]) {
  const sources: PfxMatrixPerformanceReportSource[] = []
  for (const effectId of effectIds) {
    for (const platform of ['mobile-safari', 'chrome-android'] as const) {
      const evidence = `.context/${platform}/${effectId}.json`
      if (!fs.existsSync(resolvePackagePath(evidence))) continue
      sources.push({
        report: await readBrowserProfileReport(evidence),
        evidence,
      })
    }
  }
  if (sources.length === 0) return []
  const registry = await readJsonRequired(
    '.context/r3f-pfx-quality-device-registry.json',
    'quality device registry',
  ) as PfxMatrixDeviceRegistry
  return assemblePfxQualityMatrixPerformanceReviews(sources, registry)
}

async function readBrowserProfileReport(file: string): Promise<BrowserProfileReport> {
  const parsed = await readJsonRequired(file, 'real-device profile') as
    BrowserProfileReport | { schema?: string; reports?: BrowserProfileReport[] }
  if (parsed.schema === 'game-bot.r3f-pfx-browser-profile.v1') return parsed as BrowserProfileReport
  if (
    parsed.schema === 'game-bot.r3f-pfx-browser-profile-run.v1' &&
    parsed.reports?.length === 1
  ) return parsed.reports[0]!
  throw new Error(`Real-device profile ${file} must contain exactly one canonical report`)
}

async function currentRenderSourceFingerprint(effectId: string): Promise<string> {
  const recipe = `src/recipes/${effectId}.ts`
  if (!fs.existsSync(resolvePackagePath(recipe))) throw new Error(`Missing render recipe: ${recipe}`)
  const roots = [recipe, 'src/tooling/07.tsx']
  const visited = new Set<string>()
  const pending = [...roots]
  const sources: Array<{ path: string; contents: string }> = []
  while (pending.length > 0) {
    const relativePath = pending.pop()!
    if (visited.has(relativePath)) continue
    visited.add(relativePath)
    const contents = await fsp.readFile(resolvePackagePath(relativePath), 'utf8')
    sources.push({ path: relativePath, contents })
    for (const specifier of extractRelativeImports(contents)) {
      const imported = resolveSourceImport(relativePath, specifier)
      if (
        imported &&
        isPfxRenderSourceForEffect(effectId, imported) &&
        !visited.has(imported)
      ) pending.push(imported)
    }
  }
  return createPfxRenderSourceFingerprint(sources)
}

function extractRelativeImports(contents: string): string[] {
  const imports = new Set<string>()
  const pattern = /(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g
  for (const match of contents.matchAll(pattern)) imports.add(match[1]!)
  return [...imports]
}

function resolveSourceImport(importer: string, specifier: string): string | null {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier))
  const candidates = path.posix.extname(base)
    ? [base]
    : [`${base}.ts`, `${base}.tsx`, `${base}.json`, `${base}/index.ts`, `${base}/index.tsx`]
  return candidates.find((candidate) =>
    candidate.startsWith('src/') && fs.existsSync(resolvePackagePath(candidate))) ?? null
}

function lifecycleCandidateTimes(cycleMs: number): number[] {
  const duration = Number.isFinite(cycleMs) && cycleMs >= 240 ? cycleMs : 960
  return [...new Set([0.04, 0.1, 0.18, 0.28, 0.42, 0.58, 0.74, 0.9]
    .map((fraction) => Math.max(0, Math.round(duration * fraction))))]
}

function mergePfxReviewUnion(union: PNG | undefined, candidate: PNG): PNG {
  if (!union) return PNG.sync.read(PNG.sync.write(candidate))
  const width = Math.max(union.width, candidate.width)
  const height = Math.max(union.height, candidate.height)
  if (union.width !== width || union.height !== height) {
    const expanded = createReviewBackgroundPng(width, height)
    compositeReviewPixels(expanded, union)
    union = expanded
  }
  compositeReviewPixels(union, candidate)
  return union
}

function createReviewBackgroundPng(width: number, height: number): PNG {
  const png = new PNG({ width, height })
  for (let index = 0; index < png.data.length; index += 4) {
    png.data[index] = 17
    png.data[index + 1] = 24
    png.data[index + 2] = 39
    png.data[index + 3] = 255
  }
  return png
}

function compositeReviewPixels(target: PNG, source: PNG): void {
  const offsetX = Math.floor((target.width - source.width) / 2)
  const offsetY = Math.floor((target.height - source.height) / 2)
  for (let sourceY = 0; sourceY < source.height; sourceY += 1) {
    for (let sourceX = 0; sourceX < source.width; sourceX += 1) {
      const sourceIndex = (sourceY * source.width + sourceX) * 4
      const targetIndex = ((sourceY + offsetY) * target.width + sourceX + offsetX) * 4
    const currentDelta = Math.max(
        Math.abs((target.data[targetIndex] ?? 17) - 17),
        Math.abs((target.data[targetIndex + 1] ?? 24) - 24),
        Math.abs((target.data[targetIndex + 2] ?? 39) - 39),
    )
    const candidateDelta = Math.max(
        Math.abs((source.data[sourceIndex] ?? 17) - 17),
        Math.abs((source.data[sourceIndex + 1] ?? 24) - 24),
        Math.abs((source.data[sourceIndex + 2] ?? 39) - 39),
    )
    if (candidateDelta > currentDelta) {
        target.data[targetIndex] = source.data[sourceIndex]!
        target.data[targetIndex + 1] = source.data[sourceIndex + 1]!
        target.data[targetIndex + 2] = source.data[sourceIndex + 2]!
        target.data[targetIndex + 3] = source.data[sourceIndex + 3]!
      }
    }
  }
}

async function ensureViewerServer(baseUrl: string): Promise<ChildProcess | undefined> {
  if (await urlResponds(baseUrl)) return undefined
  const url = new URL(baseUrl)
  const viteBin = resolvePackagePath('node_modules/vite/bin/vite.js')
  const child = spawn(process.execPath, [
    viteBin,
    '--host',
    url.hostname,
    '--port',
    url.port || '48373',
    '--strictPort',
  ], {
    cwd: packageRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let diagnostics = ''
  child.stdout?.on('data', (chunk) => { diagnostics += String(chunk) })
  child.stderr?.on('data', (chunk) => { diagnostics += String(chunk) })
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (await urlResponds(baseUrl)) return child
    if (child.exitCode != null) {
      throw new Error(`PFX viewer server exited before capture:\n${diagnostics.trim()}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  child.kill('SIGTERM')
  throw new Error(`PFX viewer did not become ready at ${baseUrl}`)
}

async function urlResponds(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(800) })
    return response.ok
  } catch {
    return false
  }
}

function readArg(input: readonly string[], name: string): string | undefined {
  for (let index = 0; index < input.length; index += 1) {
    const value = input[index]!
    if (value === name) return input[index + 1]
    if (value.startsWith(`${name}=`)) return value.slice(name.length + 1)
  }
  return undefined
}

function readArgs(input: readonly string[], name: string): string[] {
  const values: string[] = []
  for (let index = 0; index < input.length; index += 1) {
    const value = input[index]!
    if (value === name && input[index + 1]) values.push(input[index + 1]!)
    else if (value.startsWith(`${name}=`)) values.push(value.slice(name.length + 1))
  }
  return values
}

function splitList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function resolvePackagePath(file: string): string {
  const resolved = path.resolve(packageRoot, file)
  if (resolved !== packageRoot && !resolved.startsWith(`${packageRoot}${path.sep}`)) {
    throw new Error(`Path escapes the PFX package: ${file}`)
  }
  return resolved
}

async function requireFile(file: string, label: string): Promise<void> {
  try {
    const stat = await fsp.stat(resolvePackagePath(file))
    if (!stat.isFile()) throw new Error()
  } catch {
    throw new Error(`Missing ${label}: ${file}`)
  }
}

async function readJsonRequired(file: string, label: string): Promise<unknown> {
  try {
    return JSON.parse(await fsp.readFile(resolvePackagePath(file), 'utf8'))
  } catch (error) {
    throw new Error(`Could not read ${label} ${file}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function readJsonIfPresent(file: string): Promise<unknown | undefined> {
  if (!fs.existsSync(resolvePackagePath(file))) return undefined
  return readJsonRequired(file, 'quality artifact')
}

async function writeJsonAtomic(file: string, value: unknown): Promise<void> {
  return writeTextAtomic(file, `${JSON.stringify(value, null, 2)}\n`)
}

async function writeTextAtomic(file: string, contents: string): Promise<void> {
  const target = resolvePackagePath(file)
  await fsp.mkdir(path.dirname(target), { recursive: true })
  const temporary = `${target}.tmp-${process.pid}`
  try {
    await fsp.writeFile(temporary, contents)
    await fsp.rename(temporary, target)
  } catch (error) {
    await fsp.rm(temporary, { force: true })
    throw error
  }
}

async function appendDecisionRecord(record: unknown): Promise<void> {
  const target = resolvePackagePath(trackedDecisionsPath)
  await fsp.mkdir(path.dirname(target), { recursive: true })
  const existing = fs.existsSync(target) ? await fsp.readFile(target, 'utf8') : ''
  const next = `${existing.replace(/\s*$/, '')}${existing.trim() ? '\n' : ''}${JSON.stringify(record)}\n`
  await writeTextAtomic(trackedDecisionsPath, next)
}

import fs from 'fs'
import path from 'path'
import { chromium, type Page } from 'playwright'
import { PNG } from 'pngjs'
import {
  createBrowserProfileReport,
  createPfxUncappedSimulationLaunchArgs,
  createPfxSimulationWarmupFrameCount,
  createPfxSimulationScenarioWarmupPasses,
  createExplicitEffectProfileScenarios,
  countPfxDeltaPixels,
  profileArtifactFileNameForScenario,
  profileCanvasFromScreenshot,
  resolveProfileScenarios,
  type BrowserProfileReport,
  type BrowserProfileInput,
  type ProfileScenarioSuite,
  type ProfileScenarioDefinition,
  type WebglProfile,
} from '../src/profiling'

interface ProfileRunOptions {
  url: string
  output: string
  suite: ProfileScenarioSuite
  perScenarioOutputDir?: string
  effectIds?: string[]
  stressCount?: number
  uncappedSimulation: boolean
}

const options = parseArgs()
const FRAME_WARMUP_COUNT = 30
const FRAME_SAMPLE_COUNT = 90

async function main(): Promise<void> {
  const scenarios = options.effectIds?.length
    ? createExplicitEffectProfileScenarios(options.effectIds, options.stressCount)
    : resolveProfileScenarios(options.suite)
  const browser = await chromium.launch({
    headless: true,
    args: createPfxUncappedSimulationLaunchArgs(options.uncappedSimulation),
  })
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 2,
  })

  const reports: BrowserProfileReport[] = []
  try {
    for (const scenario of scenarios) {
      for (let warmupPass = 0; warmupPass < createPfxSimulationScenarioWarmupPasses(options.uncappedSimulation); warmupPass += 1) {
        await profileScenario(
          page,
          options.url,
          scenario,
          createPfxSimulationWarmupFrameCount(true),
        )
      }
      const report = await profileScenario(
        page,
        options.url,
        scenario,
        createPfxSimulationWarmupFrameCount(options.uncappedSimulation),
      )
      if (options.uncappedSimulation) {
        report.capture.notes.push(
          'Uncapped scheduling simulation: browser frame limiting and GPU vsync disabled; diagnostic throughput evidence, not physical-device FPS.',
          'Warm steady-state simulation: 120 requestAnimationFrame callbacks completed before sampling; cold startup is excluded.',
          'One complete scenario pass (navigation, shader creation, render, and readback) completed before the recorded pass.',
        )
      }
      reports.push(report)
    }
  } finally {
    await browser.close()
  }

  const outputPath = resolveOutputPath(options.output)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify({ schema: 'game-bot.r3f-pfx-browser-profile-run.v1', reports }, null, 2)}\n`,
  )
  process.stdout.write(`${outputPath}: wrote ${reports.length} browser profile report(s)\n`)

  if (options.perScenarioOutputDir) {
    const scenarioOutputDir = resolveOutputPath(options.perScenarioOutputDir)
    const scenariosById = new Map(scenarios.map((scenario) => [scenario.id, scenario]))
    fs.mkdirSync(scenarioOutputDir, { recursive: true })
    for (const report of reports) {
      const scenario = scenariosById.get(report.scenario.id)
      const fileName = scenario
        ? profileArtifactFileNameForScenario(scenario)
        : `${report.scenario.id.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.json`
      fs.writeFileSync(path.join(scenarioOutputDir, fileName), `${JSON.stringify(report, null, 2)}\n`)
    }
    process.stdout.write(`${scenarioOutputDir}: wrote ${reports.length} per-scenario profile artifact(s)\n`)
  }

  const failedReports = collectThresholdFailures(reports)
  if (failedReports.length > 0) {
    process.stderr.write(
      `Profile thresholds failed for ${failedReports.length} scenario(s): ${failedReports
        .map((failure) => `${failure.id} (${failure.failures.join(', ')})`)
        .join('; ')}\n`,
    )
    process.exitCode = 1
  }
}

async function profileScenario(page: Page, url: string, scenario: ProfileScenarioDefinition, warmupFrameCount = FRAME_WARMUP_COUNT) {
  const scenarioUrl = scenario.effectIds?.length ? withProfileEffectIds(url, scenario.effectIds) : url
  await page.goto(scenarioUrl, { waitUntil: 'networkidle' })
  const filters = page.locator('.pfx-toolbar')
  const isFeedView = (await page.locator('[data-testid="pfx-feed"]').count()) > 0
  if (isFeedView) {
    await filters.locator('.pfx-filters-toggle').click()
    const mobileSafe = filters.getByLabel('Mobile safe')
    if (scenario.mobileSafeOnly === false) {
      await mobileSafe.uncheck()
    } else {
      await mobileSafe.check()
    }
    await filters.locator('.pfx-filters-toggle').click()
    await filters.getByRole('textbox', { name: 'Search', exact: true }).fill(scenario.search)
    await page.locator('.pfx-row').first().click()
    await page.locator('.pfx-detail').waitFor({ timeout: 5000 })
  }
  await page.getByLabel('Preview mode').selectOption(scenario.mode)
  if (scenario.mode === 'stress' && scenario.stressCount != null) {
    await page.getByRole('slider', { name: /Stress count/i }).fill(String(scenario.stressCount))
  }

  const frameSamplesMs = await collectFrameSamples(page, warmupFrameCount)

  const profileJson = await page.locator('[data-profile-json="r3f-pfx-browser"]').textContent()
  if (!profileJson) throw new Error(`Missing profile JSON for ${scenario.id}`)
  const appReport = JSON.parse(profileJson)
  const canvas = page.locator('canvas').first()
  await canvas.scrollIntoViewIfNeeded()
  const box = await canvas.boundingBox()
  if (!box) throw new Error(`Missing canvas for ${scenario.id}`)

  const effectPng = PNG.sync.read(await captureCanvasRegion(page, box))
  const emitterToggles = page.locator('[data-testid^="pfx-emitter-toggle-"]:checked')
  while ((await emitterToggles.count()) > 0) {
    await emitterToggles.first().uncheck()
  }
  await page.waitForTimeout(50)
  await canvas.scrollIntoViewIfNeeded()
  const baselineBox = await canvas.boundingBox()
  if (!baselineBox) throw new Error(`Missing baseline canvas for ${scenario.id}`)
  const baselinePng = PNG.sync.read(await captureCanvasRegion(page, baselineBox))
  const nonBackgroundPixels = countPfxDeltaPixels(
    effectPng.data,
    baselinePng.data,
    effectPng.width,
    effectPng.height,
  )
  const webgl = await collectWebglProfile(page)
  const input: BrowserProfileInput = {
    capturedAt: new Date().toISOString(),
    url: scenarioUrl,
    userAgent: await page.evaluate('navigator.userAgent'),
    viewport: {
      width: page.viewportSize()?.width ?? 0,
      height: page.viewportSize()?.height ?? 0,
      deviceScaleFactor: 2,
      isMobile: true,
    },
    scenario: {
      id: scenario.id,
      mode: scenario.mode,
      effectCount: appReport.scenario.effectCount,
      totalParticles: appReport.scenario.totalParticles,
      totalDrawCalls: appReport.scenario.totalDrawCalls,
      textureMemoryKb: appReport.scenario.textureMemoryKb,
    },
    frameSamplesMs,
    webgl,
    canvas: profileCanvasFromScreenshot({
      screenshotWidth: effectPng.width,
      screenshotHeight: effectPng.height,
      nonBackgroundPixels,
    }),
  }

  return createBrowserProfileReport(input)
}

async function captureCanvasRegion(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
): Promise<Buffer> {
  const cdp = await page.context().newCDPSession(page)
  try {
    const capture = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
      clip: { ...box, scale: 1 },
    })
    return Buffer.from(capture.data, 'base64')
  } finally {
    await cdp.detach()
  }
}

async function collectFrameSamples(page: Page, warmupFrameCount: number): Promise<number[]> {
  return page.evaluate(`
      new Promise((resolve) => {
        const sampleCount = ${FRAME_SAMPLE_COUNT}
        const warmupCount = ${warmupFrameCount}
        const samples = []
        let frame = 0
        let last = performance.now()
        const tick = (now) => {
          if (frame >= warmupCount) samples.push(Math.round((now - last) * 10) / 10)
          last = now
          frame += 1
          if (samples.length >= sampleCount) resolve(samples)
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
  `)
}

function collectThresholdFailures(reports: BrowserProfileReport[]): Array<{ id: string; failures: string[] }> {
  return reports
    .map((report) => ({
      id: report.scenario.id,
      failures: Object.values(report.thresholds).flatMap((threshold) => threshold.failures),
    }))
    .filter((report) => report.failures.length > 0)
}

async function collectWebglProfile(page: Page): Promise<WebglProfile> {
  return page.evaluate(`(async () => {
    const unavailable = (note) => ({
      context: 'unavailable',
      vendor: 'unavailable',
      renderer: 'unavailable',
      version: 'unavailable',
      shadingLanguageVersion: 'unavailable',
      timerQueryExtension: 'unavailable',
      gpuTimerStatus: 'unsupported',
      gpuTimerMs: null,
      notes: [note],
    });
    const canvas = document.querySelector('canvas');
    if (!canvas) return unavailable('canvas missing');
    const webgl2 = canvas.getContext('webgl2');
    const webgl = webgl2 || canvas.getContext('webgl');
    if (!webgl) return unavailable('webgl context unavailable');
    const debugInfo = webgl.getExtension('WEBGL_debug_renderer_info');
    const profile = {
      context: webgl2 ? 'webgl2' : 'webgl',
      vendor: String(debugInfo ? webgl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : webgl.getParameter(webgl.VENDOR)),
      renderer: String(debugInfo ? webgl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : webgl.getParameter(webgl.RENDERER)),
      version: String(webgl.getParameter(webgl.VERSION)),
      shadingLanguageVersion: String(webgl.getParameter(webgl.SHADING_LANGUAGE_VERSION)),
      timerQueryExtension: 'unavailable',
      gpuTimerStatus: 'unsupported',
      gpuTimerMs: null,
      notes: [],
    };
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const waitForWebgl2Timer = async (gl, ext, query, target) => {
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const available = Boolean(gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE));
        const disjoint = Boolean(gl.getParameter(ext.GPU_DISJOINT_EXT));
        if (available) {
          if (disjoint) {
            target.gpuTimerStatus = 'disjoint';
            target.notes.push('GPU timer query was disjoint');
            return target;
          }
          target.gpuTimerStatus = 'measured';
          target.gpuTimerMs = Math.round((Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1000000) * 1000) / 1000;
          return target;
        }
        await sleep(16);
      }
      target.gpuTimerStatus = 'timeout';
      target.notes.push('GPU timer query did not resolve before timeout');
      return target;
    };
    const waitForWebgl1Timer = async (gl, ext, query, target) => {
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const available = Boolean(ext.getQueryObjectEXT(query, ext.QUERY_RESULT_AVAILABLE_EXT));
        const disjoint = Boolean(gl.getParameter(ext.GPU_DISJOINT_EXT));
        if (available) {
          if (disjoint) {
            target.gpuTimerStatus = 'disjoint';
            target.notes.push('GPU timer query was disjoint');
            return target;
          }
          target.gpuTimerStatus = 'measured';
          target.gpuTimerMs = Math.round((Number(ext.getQueryObjectEXT(query, ext.QUERY_RESULT_EXT)) / 1000000) * 1000) / 1000;
          return target;
        }
        await sleep(16);
      }
      target.gpuTimerStatus = 'timeout';
      target.notes.push('GPU timer query did not resolve before timeout');
      return target;
    };
    try {
      if (webgl2) {
        const ext = webgl2.getExtension('EXT_disjoint_timer_query_webgl2');
        if (!ext) {
          profile.notes.push('EXT_disjoint_timer_query_webgl2 unavailable');
          return profile;
        }
        profile.timerQueryExtension = 'EXT_disjoint_timer_query_webgl2';
        const query = webgl2.createQuery();
        if (!query) {
          profile.gpuTimerStatus = 'error';
          profile.notes.push('failed to create WebGL2 timer query');
          return profile;
        }
        webgl2.beginQuery(ext.TIME_ELAPSED_EXT, query);
        webgl2.finish();
        webgl2.endQuery(ext.TIME_ELAPSED_EXT);
        return await waitForWebgl2Timer(webgl2, ext, query, profile);
      }
      const ext = webgl.getExtension('EXT_disjoint_timer_query');
      if (!ext) {
        profile.notes.push('EXT_disjoint_timer_query unavailable');
        return profile;
      }
      profile.timerQueryExtension = 'EXT_disjoint_timer_query';
      const query = ext.createQueryEXT();
      ext.beginQueryEXT(ext.TIME_ELAPSED_EXT, query);
      webgl.finish();
      ext.endQueryEXT(ext.TIME_ELAPSED_EXT);
      return await waitForWebgl1Timer(webgl, ext, query, profile);
    } catch (error) {
      profile.gpuTimerStatus = 'error';
      profile.notes.push(error instanceof Error ? error.message : String(error));
      return profile;
    }
  })()`) as Promise<WebglProfile>
}

function withProfileEffectIds(url: string, effectIds: readonly string[]): string {
  const target = new URL(url)
  target.searchParams.set('profileEffectIds', effectIds.join(','))
  return target.toString()
}

function parseArgs(): ProfileRunOptions {
  const args = process.argv.slice(2)
  const url = readArg(args, '--url') ?? 'http://127.0.0.1:4765/'
  const output = readArg(args, '--output') ?? '.profiles/r3f-pfx-browser-profile.json'
  const suite = (readArg(args, '--suite') ?? 'representative') as ProfileScenarioSuite
  const perScenarioOutputDir = readArg(args, '--per-scenario-output-dir')
  const effectIds = readArg(args, '--effect-ids')
    ?.split(',')
    .map((effectId) => effectId.trim())
    .filter(Boolean)
  const stressCountArg = readArg(args, '--stress-count')
  const stressCount = stressCountArg == null ? undefined : Number(stressCountArg)
  const uncappedSimulation = args.includes('--uncapped-simulation')
  return { url, output, suite, perScenarioOutputDir, effectIds, stressCount, uncappedSimulation }
}

function resolveOutputPath(output: string): string {
  if (path.isAbsolute(output)) return output
  return path.join(process.env.INIT_CWD ?? process.cwd(), output)
}

function readArg(args: string[], name: string): string | undefined {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    if (args[index] === name) return args[index + 1]
    if (args[index].startsWith(`${name}=`)) return args[index].slice(name.length + 1)
  }
  return undefined
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

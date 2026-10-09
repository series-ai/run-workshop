import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { cpus, platform, arch } from 'node:os'
import type { StageStats } from '../src/types'

const reportPath = process.env.INKLINE_BENCH_REPORT ?? 'docs/verification/browser-benchmark.json'
const duration = Number(process.env.INKLINE_BENCH_SECONDS ?? 900)
if (!Number.isFinite(duration) || duration < 10 || duration > 3600) throw new Error('Benchmark duration must be 10–3600 seconds.')
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const report: Record<string, unknown> = { harnessURL: process.env.INKLINE_BENCH_URL ?? 'http://localhost:5197/audit.html', browserChannel: 'chromium', startedAt: new Date().toISOString(), physicalAndroid: 'UNVERIFIED', host: { platform: platform(), arch: arch(), cpu: cpus()[0].model }, browser: browser.version(), sourceSHA256: {} }
for (const file of ['src/runtime/renderer.ts', 'src/runtime/assets.ts', 'src/runtime/firearms.json', 'src/runtime/effects.ts', 'src/runtime/physics.ts', 'src/runtime/district.ts', 'src/runtime/presentation.ts', 'src/runtime/kinetics.ts', 'src/runtime/trails.ts', 'src/catalog.ts', 'src/runtime/roles.ts', 'src/runtime/camera.ts', 'src/runtime/cutaway.ts', 'src/runtime/layouts.ts', 'src/types.ts', 'public/assets/manifest.json']) (report.sourceSHA256 as Record<string, string>)[file] = createHash('sha256').update(await readFile(file)).digest('hex')
const publicRoot = process.env.INKLINE_BENCH_PUBLIC_ROOT ?? 'public'
const catalog = JSON.parse(await readFile(`${publicRoot}/assets/manifest.json`, 'utf8')) as { models: { id: string; file: string }[] }
const assetSHA256: Record<string, string> = {}
for (const model of catalog.models) assetSHA256[model.id] = createHash('sha256').update(await readFile(`${publicRoot}/${model.file}`)).digest('hex')
report.assetSHA256 = assetSHA256
report.assetRoot = publicRoot
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  let navigations = 0; page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++ })
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.INKLINE_BENCH_URL ?? 'http://localhost:5197/audit.html')
  await page.waitForFunction(() => window.inklineAudit?.state().stats?.loading === false)
  const avatars = await page.evaluate(() => window.inklineAudit.verifyAvatars())
  if (avatars.some(result => !result.finite || !result.repeatedPositionsMatch || !result.paleRepeatedPositionsMatch || result.paleContours !== 1 || result.blackContours !== 0 || result.handError > .07)) throw new Error(`Avatar runtime check failed: ${JSON.stringify(avatars)}`)
  report.avatars = avatars
  const runs: unknown[] = []
  for (const load of [{ figures: 20, effects: 10, seconds: duration }, { figures: 100, effects: 40, seconds: Math.min(60, duration) }, { figures: 20, effects: 10, seconds: Math.min(15, duration) }]) {
    await page.evaluate(({ figures, effects }) => window.inklineAudit.set({ figureCount: figures, effectCount: effects }), load)
    await page.waitForFunction(count => { const s = window.inklineAudit.state().stats; return s && !s.loading && s.figures === count }, load.figures)
    await page.waitForTimeout(3000)
    const initial = await page.evaluate(() => window.inklineAudit.state())
    console.log(`Starting ${load.figures} figures / ${load.effects} effects: ${initial.gpu}, ${initial.buffer.width}x${initial.buffer.height}`)
    await page.evaluate(() => window.inklineAudit.start())
    const samples: StageStats[] = [], started = Date.now()
    while (Date.now() - started < load.seconds * 1000) {
      await page.waitForTimeout(1000)
      const state = await page.evaluate(() => window.inklineAudit.state())
      if (navigations !== 1) throw new Error('Benchmark page reloaded during measurement.')
      if (state.stats?.error) throw new Error(state.stats.error)
      if (state.stats) samples.push(state.stats)
      if (samples.length % 60 === 0) console.log(`Sample ${samples.length}: ${state.stats?.fps} FPS, ${state.stats?.figures} figures, ${state.stats?.effects} effects`)
    }
    const final = await page.evaluate(() => window.inklineAudit.finish())
    const sorted = [...final.frames].sort((a, b) => a - b)
    const percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
    runs.push({ load, elapsedSeconds: (Date.now() - started) / 1000, frameCount: sorted.length, meanFPS: 1000 * sorted.length / sorted.reduce((sum, value) => sum + value, 0), medianFrameMs: percentile(.5), p95FrameMs: percentile(.95), p99FrameMs: percentile(.99), slowFramesOver33ms: sorted.filter(value => value > 33).length, initial, final: { ...final, frames: undefined }, samples })
    console.log(`Measured ${load.figures} figures / ${load.effects} effects for ${load.seconds}s.`)
  }
  report.runs = runs; report.pageErrors = errors
  if (errors.length) throw new Error(errors.join('\n'))
} finally {
  report.finishedAt = new Date().toISOString()
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
console.log('Browser benchmark complete. Physical Android performance remains unverified.')

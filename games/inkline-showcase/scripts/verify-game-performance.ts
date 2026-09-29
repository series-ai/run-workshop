import { chromium } from '@playwright/test'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { StageSettings } from '../src/types'

const url = process.env.INKLINE_BENCH_URL ?? 'http://localhost:5197/audit.html'
const cpuRate = Number(process.env.INKLINE_CPU_RATE ?? 1)
if (!Number.isFinite(cpuRate) || cpuRate < 1 || cpuRate > 20) throw new Error('CPU rate must be from 1 to 20.')
const reportPath = process.env.INKLINE_GAME_REPORT ?? 'docs/verification/expansion/game-performance.json'
const files = ['src/runtime/renderer.ts', 'src/runtime/camera.ts', 'src/runtime/cutaway.ts', 'src/runtime/district.ts', 'src/runtime/layouts.ts', 'src/runtime/effects.ts', 'src/runtime/presentation.ts', 'src/runtime/kinetics.ts', 'src/runtime/trails.ts', 'src/catalog.ts', 'public/assets/manifest.json']
const sourceSHA256: Record<string, string> = {}
for (const file of files) sourceSHA256[file] = createHash('sha256').update(await readFile(file)).digest('hex')
const cases: { label: string; settings: Partial<StageSettings>; seconds: number; move: boolean }[] = [
  { label: 'combat-third-person', settings: { mode: 'combat', camera: 'third-person' }, seconds: 60, move: true },
  { label: 'parkour-side', settings: { mode: 'parkour', camera: 'side' }, seconds: 60, move: true },
  { label: 'service-yard-effects', settings: { mode: 'district', districtLayout: 'service-yard', camera: 'perspective', ambientEffects: true }, seconds: 30, move: false },
  { label: 'roof-works-effects', settings: { mode: 'district', districtLayout: 'roof-works', camera: 'perspective', ambientEffects: true }, seconds: 30, move: false },
]
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const errors: string[] = [], runs: unknown[] = []
const startedAt = new Date().toISOString()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', error => errors.push(error.message))
  if (cpuRate > 1) { const session = await page.context().newCDPSession(page); await session.send('Emulation.setCPUThrottlingRate', { rate: cpuRate }) }
  await page.goto(url)
  await page.waitForFunction(() => window.inklineAudit?.state().stats?.loading === false)
  for (const entry of cases) {
    await page.evaluate(settings => window.inklineAudit.set({ ...settings, playing: true }), entry.settings)
    await page.waitForFunction(() => window.inklineAudit.state().stats?.loading === false)
    await page.waitForTimeout(2000)
    await page.evaluate(() => window.inklineAudit.start())
    const samples: ReturnType<Window['inklineAudit']['state']>[] = []
    const start = Date.now()
    let lastAction = ''
    let step = 0
    while (Date.now() - start < entry.seconds * 1000) {
      if (entry.move) {
        const action = ['forward', 'left', 'back', 'right'][Math.floor(step / 5) % 4]
        await page.evaluate(({ previous, action, step }) => {
          const events: { action: string; pressed: boolean }[] = []
          if (previous) events.push({ action: previous, pressed: false })
          if (step % 28 === 0) events.push({ action: 'reset', pressed: true }, { action: 'reset', pressed: false })
          events.push({ action, pressed: true })
          if (step % 4 === 0) events.push({ action: 'attack', pressed: true }, { action: 'attack', pressed: false })
          if (step % 9 === 0) events.push({ action: 'jump', pressed: true }, { action: 'jump', pressed: false })
          for (const detail of events) window.dispatchEvent(new CustomEvent('inkline-input', { detail }))
        }, { previous: lastAction, action, step })
        lastAction = action
      }
      await page.waitForTimeout(500)
      const sample = await page.evaluate(() => window.inklineAudit.state())
      if (sample.stats?.error) throw new Error(sample.stats.error)
      samples.push(sample); step++
    }
    if (lastAction) await page.evaluate(action => window.dispatchEvent(new CustomEvent('inkline-input', { detail: { action, pressed: false } })), lastAction)
    const final = await page.evaluate(() => window.inklineAudit.finish())
    const frames = [...final.frames].sort((a, b) => a - b)
    if (frames.length < 100 || frames.some(frame => !Number.isFinite(frame))) throw new Error(`${entry.label}: invalid frame samples`)
    const run = { label: entry.label, elapsedSeconds: (Date.now() - start) / 1000, frameCount: frames.length,
      meanFPS: frames.length * 1000 / frames.reduce((sum, value) => sum + value, 0),
      p95FrameMs: frames[Math.floor(frames.length * .95)], p99FrameMs: frames[Math.floor(frames.length * .99)],
      slowFramesOver33ms: frames.filter(frame => frame > 33).length, final: { ...final, frames: undefined }, samples }
    runs.push(run)
    console.log(`${entry.label}: ${run.meanFPS.toFixed(1)} FPS; P95 ${run.p95FrameMs.toFixed(1)} ms`)
  }
  if (errors.length) throw new Error(errors.join('\n'))
} finally {
  await browser.close()
  await mkdir(dirname(reportPath), { recursive: true })
  await writeFile(reportPath, JSON.stringify({ startedAt, finishedAt: new Date().toISOString(), url, cpuRate, sourceSHA256, physicalAndroid: 'UNVERIFIED', runs, pageErrors: errors }, null, 2) + '\n')
}

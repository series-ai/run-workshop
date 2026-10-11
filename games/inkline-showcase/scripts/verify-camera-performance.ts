import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { cameraEvidenceDirectory, cameraPoseEvidence, cameraSourceHashes, captureCameraPixels, walkCameraRoute } from './verify-camera-motion'

const url = process.env.INKLINE_AUDIT_URL ?? 'http://localhost:5297/audit.html'
const sourceSHA256 = await cameraSourceHashes()
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const runs: unknown[] = [], errors: string[] = []
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(url)
  await page.waitForFunction(() => window.inklineAudit?.state().stats?.loading === false)
  await page.evaluate(() => { const api = window.inklineAudit; api.set({ mode: 'parkour', camera: 'third-person', playing: true, motion: 'full', ambientEffects: false, avatar: { ...api.state().settings.avatar, color: '#151716', equipment: null, headwear: 'none' } }) })
  await page.waitForFunction(() => window.inklineAudit.state().stats?.loading === false)
  await walkCameraRoute(page)
  await page.evaluate(() => window.inklineAudit.set({ camera: 'top' }))
  const session = await page.context().newCDPSession(page)
  for (const cpuRate of [1, 4]) {
    await session.send('Emulation.setCPUThrottlingRate', { rate: cpuRate })
    await page.waitForTimeout(2200)
    const before = await captureCameraPixels(page, `performance-cpu${cpuRate}-before`)
    await page.waitForTimeout(500)
    await page.evaluate(() => window.inklineAudit.start())
    const start = Date.now(), samples = []
    while (Date.now() - start < 30000) {
      await page.waitForTimeout(500)
      const state = await page.evaluate(() => ({ art: window.inklineAudit.artState(), state: window.inklineAudit.state() }))
      const pose = cameraPoseEvidence(state.art)
      samples.push({ ...pose, body: state.art.body.position, stats: state.state.stats })
    }
    const final = await page.evaluate(() => window.inklineAudit.finish())
    const durationSeconds = (Date.now() - start) / 1000
    const after = await captureCameraPixels(page, `performance-cpu${cpuRate}-after`)
    const frames = final.frames.sort((a, b) => a - b)
    const referenceCamera = samples[0].camera.position
    const cameraDrift = Math.max(...samples.map(sample => Math.hypot(...sample.camera.position.map((value, index) => value - referenceCamera[index]))))
    const failures = samples.filter(sample => sample.outside.length || sample.stats?.error || !sample.camera.position.every(Number.isFinite))
    const run = { cpuRate, pass: before.pass && after.pass && !failures.length && cameraDrift < .02 && frames.length >= 100, cameraDrift, durationSeconds, frameCount: frames.length, meanFPS: frames.length * 1000 / frames.reduce((a, b) => a + b, 0), p95FrameMs: frames[Math.floor(frames.length * .95)], p99FrameMs: frames[Math.floor(frames.length * .99)], slowFramesOver33ms: frames.filter(t => t > 33).length, before, after, samples, failures }
    runs.push(run)
    if (!run.pass) errors.push(`CPU rate ${cpuRate}: screenshot visibility, framing, or sample-count check failed.`)
    console.log(`Low ceiling, CPU rate ${cpuRate}: ${run.meanFPS.toFixed(1)} FPS; P95 ${run.p95FrameMs.toFixed(1)} ms.`)
  }
} catch (error) { errors.push(String(error)) }
finally { await browser.close() }
await mkdir(cameraEvidenceDirectory, { recursive: true })
const pass = runs.length === 2 && errors.length === 0
await writeFile(`${cameraEvidenceDirectory}/camera-performance.json`, JSON.stringify({ checkedAt: new Date().toISOString(), url, sourceSHA256, physicalAndroid: 'UNVERIFIED', visibilityScope: 'Rendered pixel checks run before and after each timed interval. Timed samples retain exact raw blocked joints and aperture state.', pass, runs, errors }, null, 2) + '\n')
if (!pass) process.exitCode = 1
console.log(JSON.stringify({ pass, errors }))

import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const errors: string[] = []
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://localhost:5197/audit.html')
  await page.waitForFunction(() => window.inklineAudit?.state().stats?.loading === false)
  await page.evaluate(() => window.inklineAudit.set({ mode: 'parkour', camera: 'side', playing: true }))
  await page.waitForFunction(() => window.inklineAudit.state().stats?.loading === false)
  await page.waitForTimeout(300)
  const samples = await page.evaluate(async () => {
    const samples = [], start = performance.now()
    window.dispatchEvent(new CustomEvent('inkline-input', { detail: { action: 'jump', pressed: true } }))
    window.dispatchEvent(new CustomEvent('inkline-input', { detail: { action: 'jump', pressed: false } }))
    while (performance.now() - start < 300) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      const actor = window.inklineAudit.artState().actors[0]
      samples.push({ time: performance.now() - start, clip: actor.clip, rootY: actor.position[1], headY: actor.worldJoints.Head![1] })
    }
    return samples
  })
  const ascent = samples.every((sample, index) => !index || sample.headY >= samples[index - 1].headY - .025)
  if (!ascent || !samples.some(sample => sample.clip === 'jump-start') || samples.at(-1)!.rootY < .4) throw new Error(`Jump launch failed: ${JSON.stringify(samples)}`)
  await page.screenshot({ path: 'docs/verification/polish/phone-jump.png' })
  await page.evaluate(() => window.inklineAudit.set({ mode: 'overview', camera: 'side' }))
  await page.waitForFunction(() => window.inklineAudit.state().stats?.loading === false)
  await page.waitForTimeout(1400)
  await page.screenshot({ path: 'docs/verification/polish/phone-scene.png' })
  const pass = !errors.length
  await writeFile('docs/verification/polish/game-visual.json', JSON.stringify({ checkedAt: new Date().toISOString(), pass, samples, errors }, null, 2) + '\n')
  console.log(JSON.stringify({ pass, jumpSamples: samples.length, errors }))
  if (!pass) process.exitCode = 1
} finally { await browser.close() }

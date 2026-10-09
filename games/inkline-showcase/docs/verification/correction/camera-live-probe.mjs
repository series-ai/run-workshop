import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { captureCameraPixels, cameraModes, walkCameraRoute, cameraSourceHashes } from '../../../scripts/verify-camera-motion.ts'
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const results = [], errors = []
const sourceSHA256 = await cameraSourceHashes()
try {
  const page = await browser.newPage()
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto('http://localhost:5197/audit.html')
  await page.waitForFunction(() => window.inklineAudit?.state().stats?.loading === false)
  for (const view of [{ id: 'desktop', width: 1440, height: 900 }, { id: 'phone', width: 390, height: 844 }]) {
    await page.setViewportSize(view)
    await page.evaluate(() => { const api = window.inklineAudit; api.set({ mode: 'parkour', camera: 'third-person', playing: true, motion: 'full', ambientEffects: false, avatar: { ...api.state().settings.avatar, color: '#151716', equipment: null, headwear: 'none' }, reset: api.state().settings.reset + 1 }) })
    await page.waitForFunction(() => !window.inklineAudit.state().stats?.loading)
    await walkCameraRoute(page, async checkpoint => {
      if (checkpoint !== 4 && checkpoint !== 5) return
      await page.waitForTimeout(1200)
      await page.evaluate(() => window.inklineAudit.set({ playing: false }))
      for (const camera of cameraModes) {
        await page.evaluate(camera => window.inklineAudit.set({ camera }), camera)
        await page.waitForTimeout(2200)
        const result = await captureCameraPixels(page, `live-probe-${view.id}-${camera}-checkpoint${checkpoint}`)
        results.push({ view: view.id, cameraMode: camera, checkpoint, location: checkpoint === 4 ? 'clear-platform-reference' : 'low-ceiling', ...result })
      }
      await page.evaluate(() => window.inklineAudit.set({ camera: 'third-person', playing: true }))
    })
  }
} catch (error) { errors.push(String(error)) }
finally { await browser.close() }
const pass = results.length === 16 && results.every(result => result.pass) && !errors.length
await writeFile('docs/verification/correction/camera-live-probe.json', JSON.stringify({ checkedAt: new Date().toISOString(), sourceSHA256, pass, results, errors }, null, 2) + '\n')
console.log(JSON.stringify({ pass, results: results.map(result => ({ view: result.view, camera: result.cameraMode, checkpoint: result.checkpoint, pass: result.pass, missing: result.pixels.missing, geometricBlocked: result.geometricBlocked })), errors }, null, 2))
if (!pass) process.exitCode = 1

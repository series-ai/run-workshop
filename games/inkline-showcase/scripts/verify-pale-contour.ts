import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const directory = 'docs/verification/correction/outline'
await mkdir(directory, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const errors: string[] = [], samples: unknown[] = [], checks: { name: string; pass: boolean; value: unknown }[] = []
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(process.env.INKLINE_AUDIT_URL ?? 'http://localhost:5197/audit.html')
  await page.waitForFunction(() => Boolean(window.inklineAudit))
  for (const viewport of [{ width: 1100, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    for (const camera of ['perspective', 'side', 'top', 'third-person'] as const) {
      for (const variant of [
        { name: 'white', color: '#faf9f5', thickness: 1, height: 1, headScale: 1 },
        { name: 'paper-thin', color: '#eeece5', thickness: .7, height: 1.15, headScale: .8 },
        { name: 'white-wide', color: '#faf9f5', thickness: 1.3, height: .85, headScale: 1.2 },
        { name: 'black', color: '#151716', thickness: 1, height: 1, headScale: 1 },
      ]) {
        await page.evaluate(({ camera, variant }) => {
          const audit = window.inklineAudit
          audit.set({ mode: 'animations', camera, animationId: 'punch-heavy', playing: true,
            avatar: { ...audit.state().settings.avatar, ...variant, headwear: 'none', equipment: null } })
        }, { camera, variant })
        await page.waitForFunction(() => { const stats = window.inklineAudit.state().stats; return stats && !stats.loading })
        await page.waitForTimeout(400)
        const state = await page.evaluate(() => ({ art: window.inklineAudit.artState(), state: window.inklineAudit.state() }))
        if (state.state.stats?.error) throw new Error(state.state.stats.error)
        const file = `${directory}/${viewport.width}-${camera}-${variant.name}.png`
        await page.screenshot({ path: file })
        samples.push({ file, state })
      }
    }
  }
  const avatars = await page.evaluate(() => window.inklineAudit.verifyAvatars())
  for (const avatar of avatars) checks.push({ name: `${avatar.id}: one stable pale contour and no visible black contour`, pass: avatar.paleContours === 1 && avatar.blackContours === 0 && avatar.paleRepeatedPositionsMatch, value: avatar })
  const memory: { calls: number; geometries: number; textures: number }[] = []
  for (let cycle = 0; cycle < 12; cycle++) {
    await page.evaluate(cycle => {
      const audit = window.inklineAudit
      audit.set({ mode: 'avatars', playing: true, wireframe: false, motion: 'reduced', avatar: { ...audit.state().settings.avatar, color: cycle % 2 ? '#151716' : '#faf9f5' } })
    }, cycle)
    await page.waitForFunction(() => { const stats = window.inklineAudit.state().stats; return stats && !stats.loading })
    await page.waitForTimeout(650)
    const stats = await page.evaluate(() => window.inklineAudit.state().stats!)
    memory.push({ calls: stats.calls, geometries: stats.geometries, textures: stats.textures })
  }
  const white = memory.filter((_, i) => i % 2 === 0), black = memory.filter((_, i) => i % 2 === 1)
  checks.push({ name: 'White contour adds one draw call', pass: white.every((value, i) => value.calls === black[i].calls + 1), value: memory })
  checks.push({ name: 'Repeated color changes keep geometry and texture counts stable', pass: memory.every(value => value.geometries === memory[0].geometries && value.textures === memory[0].textures), value: memory })
} finally { await browser.close() }
const pass = errors.length === 0 && checks.every(check => check.pass)
await writeFile(`${directory}/report.json`, JSON.stringify({ checkedAt: new Date().toISOString(), pass, errors, checks, samples }, null, 2) + '\n')
console.log(JSON.stringify({ pass, frames: samples.length, errors, failures: checks.filter(check => !check.pass) }, null, 2))
if (!pass) process.exitCode = 1

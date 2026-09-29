import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const base = process.env.INKLINE_REVIEW_URL ?? 'http://localhost:5197/review/'
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const checks: { name: string; pass: boolean; value: unknown }[] = [], errors: string[] = []
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.on('pageerror', error => errors.push(error.message))
  for (const [file, videos, figures, version] of [['index.html', 5, 16, '1.4.5'], ['motion-library.html', 3, 0, '1.4.5'], ['effects-library.html', 1, 64, '1.4.0'], ['stance-review.html', 0, 18, '1.4.1']] as const) {
    await page.goto(base + file)
    await page.waitForFunction(() => [...document.querySelectorAll('video')].every(video => video.readyState >= 1), null, { timeout: 30000 })
    const state = await page.evaluate(version => ({ videos: document.querySelectorAll('video').length, figures: document.querySelectorAll('figure').length, version: document.body.textContent?.includes(version), durations: [...document.querySelectorAll('video')].map(video => video.duration) }), version)
    checks.push({ name: `${file}: current media and catalog`, pass: state.videos === videos && state.figures >= figures && Boolean(state.version) && state.durations.every(duration => Number.isFinite(duration) && duration > 1), value: state })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 844 })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
      checks.push({ name: `${file}: ${width}px layout`, pass: overflow <= 1, value: overflow })
    }
    const missing = await page.evaluate(async () => {
      const links = [...document.querySelectorAll<HTMLImageElement>('img')].map(image => image.src)
      const results = await Promise.all(links.map(async url => ({ url, status: (await fetch(url)).status })))
      return results.filter(result => result.status !== 200)
    })
    checks.push({ name: `${file}: image files load`, pass: missing.length === 0, value: missing })
    for (let index = 0; index < await page.locator('video').count(); index++) {
      const result = await page.locator('video').nth(index).evaluate(async video => {
        const player = video as HTMLVideoElement; player.muted = true; player.currentTime = Math.min(.2, player.duration / 4)
        await player.play(); const first = player.currentTime
        await new Promise(resolve => setTimeout(resolve, 250)); player.pause()
        return { advanced: player.currentTime > first + .1, error: player.error?.message ?? null }
      })
      checks.push({ name: `${file}: video ${index + 1} plays`, pass: result.advanced && !result.error, value: result })
    }
  }
} finally { await browser.close() }
const pass = checks.every(check => check.pass) && errors.length === 0
await writeFile(process.env.INKLINE_REVIEW_REPORT ?? 'docs/verification/stance/review-page.json', JSON.stringify({ checkedAt: new Date().toISOString(), pass, checks, errors }, null, 2) + '\n')
console.log(JSON.stringify({ pass, checks: checks.length, failures: checks.filter(check => !check.pass), errors }))
if (!pass) process.exitCode = 1

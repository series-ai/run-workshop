import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { BURGER_SHOP_RECIPE_IDS } from '../../src/burger-shop/recipes.ts'

const root = process.cwd()
const outDir = path.join(root, '.previews/burger-shop-faithful')
const baseUrl = process.env.PFX_PREVIEW_URL ?? 'http://localhost:48373'
const durationMs = 4000

await fs.promises.rm(outDir, { recursive: true, force: true })
await fs.promises.mkdir(outDir, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})

try {
  for (const id of BURGER_SHOP_RECIPE_IDS) {
    const videoDir = path.join(outDir, `${id}-raw`)
    await fs.promises.mkdir(videoDir, { recursive: true })
    const context = await browser.newContext({
      viewport: { width: 960, height: 540 },
      recordVideo: { dir: videoDir, size: { width: 960, height: 540 } },
    })
    const page = await context.newPage()
    await page.goto(`${baseUrl}/burger-shop.html?id=${id}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('canvas', { timeout: 20000 })
    await page.waitForTimeout(120)
    await page.screenshot({ path: path.join(outDir, `${id}-onset.png`) })
    await page.waitForTimeout(480)
    await page.screenshot({ path: path.join(outDir, `${id}-peak.png`) })
    await page.waitForTimeout(durationMs - 600)
    await context.close()
    const rawFiles = (await fs.promises.readdir(videoDir)).filter((name) => name.endsWith('.webm'))
    if (rawFiles.length === 0) throw new Error(`No webm recorded for ${id}`)
    const stagedWebm = path.join(outDir, `${id}.webm`)
    await fs.promises.rename(path.join(videoDir, rawFiles[0]), stagedWebm)
    await fs.promises.rm(videoDir, { recursive: true, force: true })
    const mp4Path = path.join(outDir, `${id}.mp4`)
    const ffmpeg = spawnSync(
      'ffmpeg',
      ['-y', '-i', stagedWebm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4Path],
      { stdio: 'pipe' },
    )
    if (ffmpeg.status !== 0) {
      process.stderr.write(ffmpeg.stderr?.toString() ?? 'ffmpeg failed\n')
      throw new Error(`ffmpeg failed for ${id}`)
    }
    process.stdout.write(`recorded ${id}\n`)
  }
} finally {
  await browser.close()
}

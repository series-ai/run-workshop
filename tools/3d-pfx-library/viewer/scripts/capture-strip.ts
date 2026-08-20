import fs from 'node:fs'
import { promises as fsp } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { chromium, type Page } from 'playwright'
import { PNG } from 'pngjs'
import { PFX_PRESETS, PFX_TAXONOMY, getPfxBurstCycleSeconds } from '../../src/index'
import { createPfxVisualReviewCycleMs } from '../src/profiling'

const packageRoot = process.cwd()
const args = process.argv.slice(2)
const effectId = readArg(args, '--effect')
const label = readArg(args, '--label') ?? 'before'
const frameCount = Number.parseInt(readArg(args, '--frames') ?? '20', 10)
const baseUrl = readArg(args, '--url') ?? 'http://localhost:48373/'

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})

async function main(): Promise<void> {
  if (!effectId) throw new Error('Usage: capture-strip.ts --effect <id> [--label before|after] [--frames 20]')
  if (!Number.isInteger(frameCount) || frameCount < 4 || frameCount > 40) {
    throw new Error('--frames must be an integer from 4 to 40')
  }
  const preset = PFX_PRESETS.find((candidate) => candidate.effectId === effectId)
  const taxonomy = PFX_TAXONOMY.find((candidate) => candidate.id === effectId)
  if (!preset || !taxonomy) throw new Error(`Unknown PFX effect: ${effectId}`)

  const cycleMs = createPfxVisualReviewCycleMs(
    preset.preview.clip.durationMs,
    getPfxBurstCycleSeconds(preset),
    taxonomy.loopMode,
  )
  const outputRelative = `.context/mesh-stunted/${effectId}/${label}`
  const outputDirectory = path.resolve(packageRoot, outputRelative)
  await fsp.rm(outputDirectory, { recursive: true, force: true })
  await fsp.mkdir(outputDirectory, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({
      viewport: { width: 960, height: 960 },
      deviceScaleFactor: 1,
    })
    const files: string[] = []
    const frames: PNG[] = []
    for (let index = 0; index < frameCount; index += 1) {
      const sampleMs = Math.round((cycleMs * index) / Math.max(1, frameCount - 1))
      const buffer = await captureFrame(page, sampleMs)
      const fileName = `${String(index + 1).padStart(2, '0')}-${sampleMs}ms.png`
      await fsp.writeFile(path.join(outputDirectory, fileName), buffer)
      files.push(`${outputRelative}/${fileName}`)
      frames.push(PNG.sync.read(buffer))
      process.stdout.write(`${effectId} ${label} ${fileName}\n`)
    }
    const sheet = buildContactSheet(frames)
    await fsp.writeFile(path.join(outputDirectory, 'contact-sheet.png'), PNG.sync.write(sheet))
    await fsp.writeFile(
      path.join(outputDirectory, 'manifest.json'),
      `${JSON.stringify({ effectId, label, cycleMs, loopMode: taxonomy.loopMode, files }, null, 2)}\n`,
    )
    process.stdout.write(`${outputRelative}/contact-sheet.png: ${frameCount} frames, cycle ${cycleMs}ms\n`)
  } finally {
    await browser.close()
  }
}

async function captureFrame(page: Page, sampleMs: number): Promise<Buffer> {
  const token = `${effectId}:three-quarter:${sampleMs}:isolated:${Date.now()}`
  const url = new URL(baseUrl)
  url.searchParams.set('profileEffectIds', effectId!)
  url.searchParams.set('reviewCamera', 'three-quarter')
  url.searchParams.set('reviewCameraDistance', '5.2000')
  url.searchParams.set('reviewTimeMs', String(sampleMs))
  url.searchParams.set('reviewFraming', 'isolated')
  url.searchParams.set('reviewCapture', '1')
  url.searchParams.set('reviewCaptureToken', token)
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' })
  const stage = page.getByTestId('pfx-3d-stage')
  await stage.waitFor({ state: 'visible', timeout: 15_000 })
  const canvas = stage.locator('canvas')
  await canvas.waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForFunction(
    (expectedToken) =>
      document.querySelector<HTMLCanvasElement>('[data-testid="pfx-3d-stage"] canvas')
        ?.dataset.pfxReviewCaptureToken === expectedToken,
    token,
    { timeout: 15_000 },
  )
  await page.evaluate(`(async () => {
    await document.fonts.ready
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  })()`)
  return canvas.screenshot({ type: 'png' })
}

function buildContactSheet(frames: PNG[]): PNG {
  const columns = 5
  const rows = Math.ceil(frames.length / columns)
  const cellWidth = frames[0]?.width ?? 960
  const cellHeight = frames[0]?.height ?? 960
  const sheet = new PNG({ width: cellWidth * columns, height: cellHeight * rows })
  for (let index = 0; index < sheet.data.length; index += 4) {
    sheet.data[index] = 17
    sheet.data[index + 1] = 24
    sheet.data[index + 2] = 39
    sheet.data[index + 3] = 255
  }
  frames.forEach((frame, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    for (let y = 0; y < frame.height; y += 1) {
      for (let x = 0; x < frame.width; x += 1) {
        const source = (y * frame.width + x) * 4
        const target = ((row * cellHeight + y) * sheet.width + column * cellWidth + x) * 4
        sheet.data[target] = frame.data[source] ?? 17
        sheet.data[target + 1] = frame.data[source + 1] ?? 24
        sheet.data[target + 2] = frame.data[source + 2] ?? 39
        sheet.data[target + 3] = frame.data[source + 3] ?? 255
      }
    }
  })
  return sheet
}

function readArg(input: readonly string[], name: string): string | undefined {
  for (let index = 0; index < input.length; index += 1) {
    const value = input[index]!
    if (value === name) return input[index + 1]
    if (value.startsWith(`${name}=`)) return value.slice(name.length + 1)
  }
  return undefined
}

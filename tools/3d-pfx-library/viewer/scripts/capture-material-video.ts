import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { PFX_PRESETS } from '../../src/index'

const args = process.argv.slice(2)
const readArg = (name: string): string | undefined => {
  const index = args.indexOf(name)
  return index < 0 ? undefined : args[index + 1]
}
const effectId = readArg('--effect')
const label = readArg('--label')
const buildDirectory = path.resolve(readArg('--build-dir') ?? 'dist')
const output = readArg('--output')
const cameraDistance = Number(readArg('--camera-distance') ?? '5.2')
const fps = 30

async function encode(frames: string, destination: string): Promise<void> {
  const command = ['-hide_banner', '-loglevel', 'error', '-framerate', String(fps),
    '-i', path.join(frames, '%05d.png'), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', destination]
  await new Promise<void>((resolve, reject) => {
    const child = spawn('ffmpeg', command, { stdio: ['ignore', 'ignore', 'pipe'] })
    let error = ''
    child.stderr.on('data', (chunk: Buffer) => { error += chunk.toString() })
    child.on('error', reject)
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${error}`)))
  })
}

async function main(): Promise<void> {
  if (!effectId || !PFX_PRESETS.some((preset) => preset.effectId === effectId)) {
    throw new Error('--effect must be a catalog effect ID')
  }
  if (!label || !['before', 'after'].includes(label) || !output) {
    throw new Error('Use --label before|after --output <new-directory> --build-dir <frozen-build>')
  }
  if (!Number.isFinite(cameraDistance) || cameraDistance < 1 || cameraDistance > 20) {
    throw new Error('--camera-distance must be from 1 to 20')
  }
  const directory = path.resolve(output)
  await fs.mkdir(path.dirname(directory), { recursive: true })
  await fs.mkdir(directory)
  const frames = path.join(directory, 'frames')
  await fs.mkdir(frames)
  const index = await fs.readFile(path.join(buildDirectory, 'index.html'))
  const buildHash = createHash('sha256').update(index).digest('hex')
  const mime: Record<string, string> = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  }
  const errors: string[] = []
  const server = createServer((request, response) => {
    void (async () => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1')
      const name = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)
      const file = path.resolve(buildDirectory, `.${name}`)
      if (!file.startsWith(`${buildDirectory}${path.sep}`)) {
        response.writeHead(403).end()
        return
      }
      const data = await fs.readFile(file)
      response.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream' })
      response.end(data)
    })().catch((error: unknown) => {
      const missing = error instanceof Error && 'code' in error && error.code === 'ENOENT'
      if (!missing) errors.push(`Capture server: ${error instanceof Error ? error.message : String(error)}`)
      if (!response.headersSent) response.writeHead(missing ? 404 : 500)
      response.end()
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Missing owned server address')
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined
  const samples: Array<{ index: number; timeSeconds: number; file: string }> = []
  const manifest: Record<string, unknown> = {
    effectId, label, buildDirectory, buildHash, fps, camera: 'three-quarter',
    cameraDistance, quality: 'high', viewport: { width: 1200, height: 960 },
    node: process.version, status: 'running',
    method: 'Real viewer. Paused public Timeline. Two 1/60-second keyboard steps per frame.',
    command: process.argv, samples, errors,
  }
  try {
    browser = await chromium.launch({ headless: true })
    manifest.browser = browser.version()
    const page = await browser.newPage({ viewport: { width: 1200, height: 960 }, deviceScaleFactor: 1 })
    page.on('pageerror', (error) => { errors.push(error.message) })
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    const url = new URL(`http://127.0.0.1:${address.port}/`)
    url.searchParams.set('profileEffectIds', effectId)
    url.searchParams.set('reviewCamera', 'three-quarter')
    url.searchParams.set('reviewCameraDistance', String(cameraDistance))
    url.searchParams.set('reviewFraming', 'isolated')
    url.searchParams.set('reviewCapture', '1')
    url.searchParams.set('materialQuality', 'high')
    await page.goto(url.href, { waitUntil: 'networkidle' })
    const canvas = page.getByTestId('pfx-3d-stage').locator('canvas')
    await canvas.waitFor({ state: 'visible' })
    if (label === 'after') {
      const quality = await page.getByRole('combobox', { name: 'Material quality', exact: true }).inputValue()
      if (quality !== 'high') throw new Error(`Expected high material quality, got ${quality}`)
      manifest.observedQuality = quality
    }
    const transport = page.getByRole('group', { name: 'Preview transport' })
    await transport.getByRole('button', { name: 'Stop', exact: true }).click()
    const timeline = transport.getByRole('slider', { name: 'Timeline', exact: true })
    await timeline.press('Home')
    const duration = Number(await timeline.getAttribute('max'))
    if (!Number.isFinite(duration) || duration <= 0 || duration > 20) {
      throw new Error(`Invalid timeline duration: ${duration}`)
    }
    manifest.cycleSeconds = duration
    const frameCount = Math.ceil(duration * fps)
    for (let frame = 0; frame < frameCount; frame += 1) {
      if (frame > 0) {
        await timeline.press('ArrowRight')
        await timeline.press('ArrowRight')
      }
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      }))
      const time = Number(await timeline.inputValue())
      if (Math.abs(time - frame / fps) > 0.01) {
        throw new Error(`Timeline mismatch at ${frame}: ${time}`)
      }
      if (errors.length) throw new Error(errors.join('\n'))
      const file = `${String(frame).padStart(5, '0')}.png`
      await canvas.screenshot({ path: path.join(frames, file), type: 'png' })
      samples.push({ index: frame, timeSeconds: time, file: `frames/${file}` })
    }
    const video = path.join(directory, `${effectId}-${label}.mp4`)
    await encode(frames, video)
    manifest.video = video
    manifest.status = 'pass'
    process.stdout.write(`${video}: ${samples.length} deterministic frames\n`)
  } catch (error) {
    manifest.status = 'fail'
    manifest.error = error instanceof Error ? error.message : String(error)
    throw error
  } finally {
    await browser?.close()
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await fs.writeFile(path.join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})

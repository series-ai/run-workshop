import { chromium } from '@playwright/test'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { DEFAULT_AVATAR, type AnimationEntry, type PackManifest } from '../src/types'
import { EFFECTS, effectAtlasDuration } from '../src/runtime/effects'
import { animationPreviewEquipment } from '../src/runtime/presentation'

const manifest = JSON.parse(await readFile('public/assets/manifest.json', 'utf8')) as PackManifest
const motionCatalog = JSON.parse(await readFile('public/assets/characters.json', 'utf8')) as {
  animations: (AnimationEntry & { motion?: { phases: { name: string; frame: number }[] } })[]
}
function thumbnailTime(animation: AnimationEntry): number {
  const phases = motionCatalog.animations.find(clip => clip.id === animation.id)?.motion?.phases ?? []
  const phase = phases.find(phase => phase.name === 'contact') ?? phases.find(phase => phase.name === 'grasp')
  const time = animation.contactTime ?? (phase ? phase.frame / 30 : animation.duration * .38)
  if (!Number.isFinite(time) || time < 0 || time > animation.duration) throw new Error(`Invalid preview time: ${animation.id}`)
  return time
}
const out = resolve('public/assets/previews')
await mkdir(out, { recursive: true })
await mkdir('.cache/effect-frames', { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
try {
  const page = await browser.newPage({ viewport: { width: 384, height: 384 } })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(process.env.INKLINE_URL ?? 'http://localhost:5197/capture.html')
  await page.waitForFunction(() => Boolean(window.inklineCapture))
  const decode = (png: string) => Buffer.from(png.slice(png.indexOf(',') + 1), 'base64')
  const only = process.argv.find(argument => argument.startsWith('--only='))?.slice(7)
  const models = only === 'characters' ? manifest.models.filter(model => model.kind === 'character') : manifest.models
  if (!only || only === 'models' || only === 'characters') for (const [index, model] of models.entries()) {
    const capture = await page.evaluate(async id => window.inklineCapture.model(id), model.id)
    await writeFile(resolve('public', model.thumbnail), decode(capture.png))
    if ((index + 1) % 25 === 0) console.log(`Model previews: ${index + 1}/${manifest.models.length}`)
  }
  if (!only || only === 'animations') for (const animation of manifest.animations) {
    const bodyByPrefix: Record<string, string> = {
      staff: 'stick-tall', sword: 'stick-fighter', dagger: 'stick-scout',
      hammer: 'stick-heavy', shield: 'stick-sentinel',
      rifle: 'stick-agent', shotgun: 'stick-agent', pistol: 'stick-agent', bow: 'stick-scout',
    }
    const body = bodyByPrefix[animation.id.split('-')[0]] ?? 'stick-standard'
    const equipment = animationPreviewEquipment(animation.id)
    const avatar = equipment ? { ...DEFAULT_AVATAR, preset: body, equipment } : undefined
    const capture = await page.evaluate(async ({ id, time, avatar }) => window.inklineCapture.model(avatar?.preset ?? 'stick-standard', id, time, false, undefined, avatar), { id: animation.id, time: thumbnailTime(animation), avatar })
    await writeFile(resolve(out, `animation-${animation.id}.png`), decode(capture.png))
  }
  if (!only || only === 'effects') for (const effect of EFFECTS) {
    for (let frame = 0; frame < 8; frame++) {
      const png = await page.evaluate(({ id, time }) => window.inklineCapture.effect(id, time), { id: effect.id, time: effectAtlasDuration(effect) * (frame + .5) / 8 })
      await writeFile(resolve('.cache/effect-frames', `${effect.id}-${frame}.png`), decode(png))
      if (frame === 2) await writeFile(resolve(out, `effect-${effect.id}.png`), decode(png))
    }
  }
  if (errors.length) throw new Error(errors.join('\n'))
} finally { await browser.close() }
if (!process.argv.some(argument => argument === '--only=models' || argument === '--only=characters' || argument === '--only=animations')) {
  execFileSync('python3', ['scripts/pack-effect-sheets.py'], { stdio: 'inherit' })
}
console.log('Preview capture completed from the actual exported assets.')

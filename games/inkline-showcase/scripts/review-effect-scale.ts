import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { EFFECTS, effectPreviewBounds, type EffectPreset } from '../src/runtime/effects'
declare global { interface Window { effectReview: { effects: EffectPreset[]; capture(id: string, time: number): string } } }
const label = process.argv[2] ?? 'after'
if (!/^[a-z-]+$/.test(label)) throw new Error('Invalid report label.')
const recipes: EffectPreset[] = label === 'before' ? JSON.parse(await readFile('docs/verification/polish/effects-before.json', 'utf8')).effects : EFFECTS
const output = `docs/verification/polish/effects-${label}`
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const errors: string[] = []
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 840 } })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('http://localhost:5197/docs/verification/polish/effect-review.html' + (label === 'before' ? '?baseline=true' : ''))
  await page.waitForFunction(() => Boolean(window.effectReview))
  for (const effect of recipes) {
    for (const [frame, fraction] of [.12, .38, .72].entries()) {
      const png = await page.evaluate(({ id, time }) => window.effectReview.capture(id, time), { id: effect.id, time: effect.duration * fraction }) as string
      await writeFile(`${output}/${effect.id}-${frame}.png`, Buffer.from(png.split(',')[1], 'base64'))
    }
  }
} finally { await browser.close() }
if (errors.length) throw new Error(errors.join('\n'))
const report = { checkedAt: new Date().toISOString(), pass: true, count: EFFECTS.length, frames: EFFECTS.length * 3, cameraWidth: 5.6, characterHeight: 1.8, sourceSHA256: createHash('sha256').update(await readFile(label === 'before' ? '.cache/polish-baseline/effects.ts' : 'src/runtime/effects.ts')).digest('hex'), effects: recipes.map(effect => label === 'before' ? effect : ({ ...effect, boundRadius: effectPreviewBounds(effect).radius })) }
await writeFile(`${output}.json`, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ label, count: report.count, frames: report.frames, errors }))

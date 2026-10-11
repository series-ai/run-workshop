import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type { AnimationEntry } from '../src/types'

declare global { interface Window { figureReview: {
  equip(id: string | null): Promise<void>; choose(id: string, time?: number): void
  capture(time: number, view?: number): string
} } }
const output = 'docs/verification/stance'
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const errors: string[] = []
const clips = ['punch-left', 'punch-right', 'punch-heavy', 'uppercut', 'kick-front', 'kick-roundhouse', 'kick-air', 'rifle-fire', 'shotgun-fire']
try {
  const page = await browser.newPage({ viewport: { width: 1260, height: 800 } })
  page.on('pageerror', error => errors.push(error.message))
  for (const label of ['before', 'after']) {
    const base = label === 'before' ? '.cache/stance-baseline' : 'public/assets'
    const catalog = JSON.parse(await readFile(`${base}/characters.json`, 'utf8')) as { animations: AnimationEntry[] }
    await page.goto('http://localhost:5197/docs/verification/correction/line-review.html?assets=' + (label === 'before' ? '/.cache/stance-baseline&baseline=1' : '/assets'))
    await page.waitForFunction(() => Boolean(window.figureReview))
    for (const id of clips) {
      const meta = catalog.animations.find(clip => clip.id === id)!
      await page.evaluate(async ({ id }) => { await window.figureReview.equip(id.startsWith('rifle') ? 'rifle' : id.startsWith('shotgun') ? 'shotgun' : null); window.figureReview.choose(id) }, { id })
      for (const view of [1, 2]) {
        const png = await page.evaluate(({ time, view }) => window.figureReview.capture(time, view), { time: meta.contactTime!, view })
        await writeFile(`${output}/${label}-${id}-${view}.png`, Buffer.from(png.split(',')[1], 'base64'))
      }
    }
  }
} finally { await browser.close() }
if (errors.length) throw new Error(errors.join('\n'))
await writeFile(`${output}/capture.json`, JSON.stringify({ checkedAt: new Date().toISOString(), pass: true, clips, views: ['side', 'three-quarter'], images: clips.length * 4, errors }, null, 2) + '\n')
console.log(`Captured ${clips.length * 4} combat views.`)

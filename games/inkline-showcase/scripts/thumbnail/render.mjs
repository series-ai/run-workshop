// Render public/thumbnail.jpg from the real runtime figures.
// Needs the dev server: INKLINE_URL defaults to http://localhost:5197/capture.html.
//   node scripts/thumbnail/render.mjs
import { chromium } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

const here = new URL('./', import.meta.url)
const shot = JSON.parse(await readFile(new URL('shot.json', here), 'utf8'))
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
try {
  const errors = []
  const capture = await browser.newPage({ viewport: { width: 400, height: 400 } })
  capture.on('pageerror', error => errors.push(error.message))
  await capture.goto(process.env.INKLINE_URL ?? 'http://localhost:5197/capture.html')
  await capture.waitForFunction(() => Boolean(window.inklineCapture?.keyArt))
  const art = await capture.evaluate(value => window.inklineCapture.keyArt(value), shot)
  if (errors.length) throw new Error(errors.join('\n'))
  const overlay = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 2 })
  await overlay.setContent((await readFile(new URL('overlay.html', here), 'utf8')).replace('ART', art), { waitUntil: 'load' })
  await writeFile('.cache/thumbnail@2x.png', await overlay.screenshot())
} finally { await browser.close() }
// Downscale the 2x frame with Lanczos for clean edges at 512 px.
execFileSync('python3', ['-c', "from PIL import Image; Image.open('.cache/thumbnail@2x.png').convert('RGB').resize((512, 512), Image.LANCZOS).save('public/thumbnail.jpg', quality=92)"], { stdio: 'inherit' })
console.log('Wrote public/thumbnail.jpg')

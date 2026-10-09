import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const project = process.cwd()
const out = resolve(project, 'docs/verification/kinetic/animation-review')
const url = process.env.INKLINE_URL ?? 'http://localhost:5199/capture.html'
const bodies = [
  'stick-standard', 'stick-runner', 'stick-fighter', 'stick-tall',
  'stick-compact', 'stick-heavy', 'stick-scout', 'stick-acrobat',
  'stick-worker', 'stick-agent', 'stick-striker', 'stick-sentinel',
]

const avatarFor = preset => ({ preset, color: '#151716', accent: '#d45538', height: 1, thickness: 1, headScale: 1, headwear: 'none', equipment: null })
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const page = await browser.newPage({ viewport: { width: 384, height: 384 }, deviceScaleFactor: 1 })
const errors = []
page.on('pageerror', error => errors.push(error.message))
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('favicon')) errors.push(message.text()) })

try {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.inklineCapture))
  const cells = []
  for (const preset of bodies) {
    for (const [view, side] of [['front', false], ['side', true]]) {
      const avatar = avatarFor(preset)
      const result = await page.evaluate(({ preset, avatar, side }) => window.inklineCapture.model(preset, 'idle', 0, side, undefined, avatar), { preset, avatar, side })
      const file = `idle-${view}-${preset}.png`
      await writeFile(resolve(out, file), Buffer.from(result.png.split(',')[1], 'base64'))
      cells.push({ preset, view, file, triangles: result.triangles, calls: result.calls, png: result.png })
    }
  }
  const board = await browser.newPage({ viewport: { width: 1440, height: 1800 } })
  const html = `<!doctype html><meta charset=utf-8><style>*{box-sizing:border-box}body{margin:0;background:#eeece5;color:#151716;font:14px system-ui,sans-serif}main{padding:24px}h1{margin:0 0 8px;font-size:28px}p{margin:0 0 18px;color:#656863}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}figure{margin:0;padding:8px;background:#f7f5ee;border:1px solid #d0d0c6}img{display:block;width:100%;background:#eeece5}figcaption{padding-top:7px;font-size:12px;display:flex;justify-content:space-between;text-transform:uppercase;letter-spacing:.06em}</style><main><h1>INKLINE idle silhouette · all body variants</h1><p>Actual exported GLB captures at frame 1. Each body shows front and +X side views.</p><div class=grid>${cells.map(c => `<figure><img src=${c.png} alt=${c.preset} ${c.view}><figcaption><b>${c.preset}</b><small>${c.view}</small></figcaption></figure>`).join('')}</div></main>`
  await board.setContent(html, { waitUntil: 'load' })
  await board.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))
  await board.screenshot({ path: resolve(out, 'idle-all-bodies.png'), fullPage: true })
  await board.close()
  if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`)
  await writeFile(resolve(out, 'idle-all-bodies.json'), JSON.stringify({ generatedAt: new Date().toISOString(), source: url, clip: 'idle', time: 0, assetFps: 120, views: ['front', 'side'], bodies: cells.map(({ png, ...entry }) => entry), errors }, null, 2) + '\n')
  console.log(JSON.stringify({ bodies, errors }, null, 2))
} finally {
  await browser.close()
}

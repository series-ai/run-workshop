import { chromium } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'
const contactReport = JSON.parse(await readFile('public/assets/sample-pose-metrics.json', 'utf8')) as { groundContact: Record<string, { clip: string; grounded: boolean }[]> }
const grounded = new Set<string>()
for (const [body, clips] of Object.entries(contactReport.groundContact)) for (const clip of clips) {
  if (typeof clip.grounded !== 'boolean') throw new Error(`Missing ground contract: ${body}/${clip.clip}`)
  if (clip.grounded) grounded.add(`${body}/${clip.clip}`)
}
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
try {
  const page = await browser.newPage()
  await page.goto(process.env.INKLINE_URL ?? 'http://localhost:5197/capture.html')
  await page.waitForFunction(() => Boolean(window.inklineCapture))
  const results = await page.evaluate(() => window.inklineCapture.verifyMotion())
  await writeFile('docs/verification/motion-bounds.json', JSON.stringify({ checkedAt: new Date().toISOString(), groundedPairs: [...grounded], maximumGroundedFloorY: .015, results }, null, 2) + '\n')
  if (results.some(result => !result.finite || result.maxExtent > 6 || result.minY < -.001 || (grounded.has(`${result.character}/${result.clip}`) && result.maxFloorY > .015))) throw new Error('Invalid animation pose bounds. Read the motion report.')
  console.log(`Checked ${results.length} character/clip pairs over each complete animation at 60 samples per second.`)
  console.log(JSON.stringify([...results].sort((a, b) => a.minY - b.minY).slice(0, 12), null, 2))
} finally { await browser.close() }

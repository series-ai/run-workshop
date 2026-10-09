import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type AnimationEntry = {
  id: string
  label: string
  category: string
  duration: number
  loop: boolean
  contactFrame?: number
  contactTime?: number
}

type CharacterEntry = {
  id: string
  label: string
  kind: string
}

type Catalog = {
  animations: AnimationEntry[]
  models: CharacterEntry[]
}

type AvatarConfig = {
  preset: string
  color: string
  accent: string
  height: number
  thickness: number
  headScale: number
  headwear: 'none' | 'cap' | 'headband' | 'beanie' | 'visor' | 'helmet'
  equipment: string | null
}

type CaptureResult = { png: string; triangles: number; calls: number }

type CaptureCell = {
  phase: 'preparation' | 'contact' | 'recovery'
  time: number
  capture: CaptureResult
}

type ClipReview = {
  id: string
  label: string
  category: string
  body: string
  equipment: string | null
  duration: number
  contactTime: number | null
  cells: CaptureCell[]
  sideContact: CaptureResult
}

const NEW_CLIP_IDS = [
  'walk-left', 'walk-right', 'run-backward', 'crouch-idle',
  'crouch-walk', 'turn-left', 'turn-right', 'ledge-climb',
  'elbow-strike', 'backfist', 'knee-strike', 'shoulder-check',
  'staff-thrust', 'staff-sweep', 'staff-overhead', 'staff-parry',
  'sword-diagonal', 'dagger-stab', 'sword-lunge', 'hammer-overhead',
  'shield-bash', 'shield-block', 'shield-slam', 'shield-push',
] as const

const EQUIPMENT_SETUP: Record<string, { body: string; equipment: string }> = {
  'staff-thrust': { body: 'stick-tall', equipment: 'staff' },
  'staff-sweep': { body: 'stick-tall', equipment: 'staff' },
  'staff-overhead': { body: 'stick-tall', equipment: 'staff' },
  'staff-parry': { body: 'stick-tall', equipment: 'staff' },
  'sword-diagonal': { body: 'stick-fighter', equipment: 'sword' },
  'sword-lunge': { body: 'stick-fighter', equipment: 'sword' },
  'dagger-stab': { body: 'stick-scout', equipment: 'dagger' },
  'hammer-overhead': { body: 'stick-heavy', equipment: 'hammer-war' },
  'shield-bash': { body: 'stick-sentinel', equipment: 'shield-riot' },
  'shield-block': { body: 'stick-sentinel', equipment: 'shield-riot' },
  'shield-slam': { body: 'stick-sentinel', equipment: 'shield-riot' },
  'shield-push': { body: 'stick-sentinel', equipment: 'shield-riot' },
}

const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

const avatarFor = (id: string): AvatarConfig => {
  const setup = EQUIPMENT_SETUP[id]
  return {
    preset: setup?.body ?? (id.startsWith('crouch') ? 'stick-compact' : 'stick-standard'),
    color: '#151716',
    accent: '#d45538',
    height: 1,
    thickness: 1,
    headScale: 1,
    headwear: 'none',
    equipment: setup?.equipment ?? null,
  }
}

const bodyFor = (id: string): string => {
  const setup = EQUIPMENT_SETUP[id]
  return setup?.body ?? (id.startsWith('crouch') ? 'stick-compact' : 'stick-standard')
}

const phaseTimes = (clip: AnimationEntry): [number, number, number] => {
  const contact = clip.contactTime ?? clip.duration * 0.5
  const preparation = Math.max(0.033, Math.min(clip.duration * 0.3, contact * 0.55))
  const recovery = Math.min(clip.duration * 0.94, contact + Math.max(0.067, (clip.duration - contact) * 0.62))
  return [Number(preparation.toFixed(4)), Number(contact.toFixed(4)), Number(recovery.toFixed(4))]
}

const pageHtml = (reviews: ClipReview[], sheetNumber: number, sheetCount: number): string => {
  const rows = reviews.map(review => {
    const cells = review.cells.map(cell => `<figure><img src="${cell.capture.png}" alt="${escapeHtml(review.label)} ${cell.phase}"><figcaption><b>${cell.phase}</b><small>${cell.time.toFixed(3)} s</small></figcaption></figure>`).join('')
    const equipment = review.equipment ? ` · equipment: ${escapeHtml(review.equipment)}` : ' · neutral body'
    return `<section class="clip"><header><h2>${escapeHtml(review.label)}</h2><p><code>${escapeHtml(review.id)}</code> · ${escapeHtml(review.category)} · body: ${escapeHtml(review.body)}${equipment}</p></header><div class="poses">${cells}</div></section>`
  }).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#eeece5;color:#151716;font:14px/1.35 system-ui,sans-serif}main{padding:28px;max-width:1440px;margin:auto}h1{margin:0 0 4px;font-size:34px;letter-spacing:-.03em}main>p{margin:0 0 24px;color:#656863}section.clip{border-top:1px solid #c9ccc3;padding:18px 0 22px;break-inside:avoid}section header{display:flex;align-items:baseline;gap:18px}h2{margin:0;font-size:22px}section header p{margin:0;color:#656863}code{color:#d45538}small{display:block;color:#656863}.poses{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:12px}figure{margin:0;background:#f7f5ee;border:1px solid #d0d0c6;padding:8px}figure img{display:block;width:100%;background:#eeece5}figcaption{display:flex;justify-content:space-between;padding:7px 2px 0;text-transform:uppercase;letter-spacing:.08em;font-size:11px}
  </style></head><body><main><h1>INKLINE animation expansion</h1><p>Actual GLB captures · sheet ${sheetNumber} of ${sheetCount} · preparation / contact / recovery</p>${rows}</main></body></html>`
}

const overviewHtml = (reviews: ClipReview[], title: string, side: boolean): string => {
  const cells = reviews.map(review => {
    const capture = side ? review.sideContact : review.cells.find(cell => cell.phase === 'contact')!.capture
    const view = side ? 'side contact' : 'contact'
    return `<figure><img src="${capture.png}" alt="${escapeHtml(review.label)} ${view}"><figcaption><b>${escapeHtml(review.id)}</b><small>${view}</small></figcaption></figure>`
  }).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}body{margin:0;background:#eeece5;color:#151716;font:14px/1.35 system-ui,sans-serif}main{padding:28px;max-width:1440px;margin:auto}h1{margin:0 0 18px;font-size:34px;letter-spacing:-.03em}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}figure{margin:0;background:#f7f5ee;border:1px solid #d0d0c6;padding:8px}figure img{display:block;width:100%;background:#eeece5}figcaption{display:flex;justify-content:space-between;padding:7px 2px 0;text-transform:uppercase;letter-spacing:.08em;font-size:11px}small{color:#656863}
  </style></head><body><main><h1>${escapeHtml(title)}</h1><div class="grid">${cells}</div></main></body></html>`
}

const catalog = JSON.parse(await readFile(resolve('public/assets/characters.json'), 'utf8')) as Catalog
const catalogById = new Map(catalog.animations.map(animation => [animation.id, animation]))
const clips = NEW_CLIP_IDS.map(id => catalogById.get(id))
if (clips.some(clip => !clip)) throw new Error('The generated catalog is missing one or more new clips')
if (new Set(catalog.animations.map(animation => animation.id)).size !== catalog.animations.length) throw new Error('Catalog animation IDs are not unique')

const outputDir = resolve('docs/verification/expansion')
await mkdir(outputDir, { recursive: true })
const url = process.env.INKLINE_URL ?? 'http://localhost:5197/capture.html'
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const pageErrors: string[] = []
const consoleErrors: string[] = []
const reviews: ClipReview[] = []

try {
  const page = await browser.newPage({ viewport: { width: 384, height: 384 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('console', message => {
    const text = message.text()
    // The capture page has no favicon. Ignore that browser-only 404.
    if (message.type() === 'error' && !text.includes('favicon.ico') && !text.includes('status of 404')) consoleErrors.push(text)
  })
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => Boolean(window.inklineCapture))

  for (const clip of clips as AnimationEntry[]) {
    const [preparation, contact, recovery] = phaseTimes(clip)
    const times: Array<['preparation' | 'contact' | 'recovery', number]> = [
      ['preparation', preparation], ['contact', contact], ['recovery', recovery],
    ]
    const body = bodyFor(clip.id)
    const avatar = avatarFor(clip.id)
    const cells: CaptureCell[] = []
    for (const [phase, time] of times) {
      const capture = await page.evaluate(({ body, animation, time, avatar }) => window.inklineCapture.model(body, animation, time, false, undefined, avatar), {
        body,
        animation: clip.id,
        time,
        avatar,
      }) as CaptureResult
      if (!capture.png.startsWith('data:image/png')) throw new Error(`${clip.id}/${phase} did not return a PNG`)
      if (capture.triangles <= 0 || capture.calls <= 0) throw new Error(`${clip.id}/${phase} returned empty render metrics`)
      cells.push({ phase, time, capture })
    }
    const sideContact = await page.evaluate(({ body, animation, time, avatar }) => window.inklineCapture.model(body, animation, time, true, undefined, avatar), {
      body,
      animation: clip.id,
      time: contact,
      avatar,
    }) as CaptureResult
    if (!sideContact.png.startsWith('data:image/png')) throw new Error(`${clip.id}/side-contact did not return a PNG`)
    if (sideContact.triangles <= 0 || sideContact.calls <= 0) throw new Error(`${clip.id}/side-contact returned empty render metrics`)
    reviews.push({
      id: clip.id,
      label: clip.label,
      category: clip.category,
      body,
      equipment: avatar.equipment,
      duration: clip.duration,
      contactTime: clip.contactTime ?? null,
      cells,
      sideContact,
    })
  }

  const sheetSize = 4
  const sheets: string[] = []
  for (let index = 0; index < reviews.length; index += sheetSize) {
    const pageReviews = reviews.slice(index, index + sheetSize)
    const sheetNumber = index / sheetSize + 1
    const name = `animation-expansion-${String(sheetNumber).padStart(2, '0')}.png`
    const sheet = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await sheet.setContent(pageHtml(pageReviews, sheetNumber, Math.ceil(reviews.length / sheetSize)), { waitUntil: 'load' })
    await sheet.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))
    await sheet.screenshot({ path: resolve(outputDir, name), fullPage: true })
    await sheet.close()
    sheets.push(name)
  }
  const contactOverview = 'animation-expansion-contact-overview.png'
  const sideContactOverview = 'animation-expansion-side-contact-overview.png'
  for (const [name, title, side] of [
    [contactOverview, 'INKLINE animation expansion · contact overview', false],
    [sideContactOverview, 'INKLINE animation expansion · side contact overview', true],
  ] as const) {
    const overview = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await overview.setContent(overviewHtml(reviews, title, side), { waitUntil: 'load' })
    await overview.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))
    await overview.screenshot({ path: resolve(outputDir, name), fullPage: true })
    await overview.close()
  }

  const report = {
    generatedAt: new Date().toISOString(),
    source: url,
    catalogClipCount: catalog.animations.length,
    reviewedClipCount: reviews.length,
    phases: ['preparation', 'contact', 'recovery'],
    sheets,
    contactOverview,
    sideContactOverview,
    animationMetadata: catalog.animations.map(animation => ({
      id: animation.id,
      category: animation.category,
      duration: animation.duration,
      loop: animation.loop,
      contactFrame: animation.contactFrame ?? null,
      contactTime: animation.contactTime ?? null,
    })),
    pageErrors,
    consoleErrors,
    visualReview: {
      status: 'manual-review-required',
      method: 'This script generates actual GLB phase captures. It does not judge art quality.',
      reviewRecord: '../kinetic/final-review.md',
    },
    clips: reviews.map(review => ({
      id: review.id,
      label: review.label,
      category: review.category,
      body: review.body,
      equipment: review.equipment,
      duration: review.duration,
      contactTime: review.contactTime,
      sideContact: { triangles: review.sideContact.triangles, calls: review.sideContact.calls },
      samples: review.cells.map(cell => ({ phase: cell.phase, time: cell.time, triangles: cell.capture.triangles, calls: cell.capture.calls })),
    })),
  }
  await writeFile(resolve(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
  if (pageErrors.length > 0 || consoleErrors.length > 0) throw new Error(`Capture page errors: ${[...pageErrors, ...consoleErrors].join(' | ')}`)
  console.log(JSON.stringify({ source: url, clips: reviews.length, sheets, pageErrors, consoleErrors }, null, 2))
} finally {
  await browser.close()
}

import { chromium, type Page } from '@playwright/test'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

type Action = 'forward' | 'attack'
type LayoutId = 'district' | 'service-yard' | 'roof-works'
type View = { id: 'desktop' | 'phone'; width: number; height: number }
type Avatar = {
  preset: string
  color: string
  accent: string
  height: number
  thickness: number
  headScale: number
  headwear: 'none' | 'cap' | 'headband' | 'beanie' | 'visor' | 'helmet'
  equipment: string | null
}
type StageSettings = {
  mode: string
  districtLayout: LayoutId
  ambientEffects: boolean
  avatar: Avatar
  camera: string
  playing: boolean
  speed: number
  reset: number
}
type Stats = { loading: boolean; error: string | null; figures: number; effects: number; score: number }
type AuditState = { stats: Stats | null; settings: StageSettings }
type Contact = { clip: string; clipTime: number; expectedTime: number; hits: number }
type ArtState = {
  viewport: { width: number; height: number }
  sceneFrame: { x: number; y: number; depth: number }[]
  body: { position: { x: number; y: number; z: number } }
  attack: { clip: string; elapsed: number; contact: number; contacted: boolean } | null
  contacts: Contact[]
  actors: { clip: string; position: [number, number, number] }[]
}
type AuditApi = {
  set(patch: Partial<StageSettings>): void
  state(): AuditState
  artState(): ArtState
}
type Check = { name: string; pass: boolean; details?: unknown }
type Manifest = { animations: { id: string; contactTime?: number }[] }

const baseUrl = process.env.INKLINE_AUDIT_URL ?? 'http://localhost:5197/audit.html'
const outputFile = resolve('docs/verification/expansion/runtime.json')
const screenshotDir = resolve('docs/verification/expansion/screenshots')
const views: View[] = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'phone', width: 390, height: 844 },
]
const layouts: { id: LayoutId; expectedFigures: number }[] = [
  { id: 'district', expectedFigures: 2 },
  { id: 'service-yard', expectedFigures: 3 },
  { id: 'roof-works', expectedFigures: 3 },
]
const avatarBase: Avatar = {
  preset: 'stick-standard', color: '#151716', accent: '#d45538', height: 1,
  thickness: 1, headScale: 1, headwear: 'none', equipment: null,
}
const equipmentCases: {
  id: string; preset: string; equipment: string; expectedClips: string[]
}[] = [
  { id: 'staff', preset: 'stick-tall', equipment: 'staff', expectedClips: ['staff-thrust', 'staff-sweep', 'staff-overhead'] },
  { id: 'shield-riot', preset: 'stick-sentinel', equipment: 'shield-riot', expectedClips: ['shield-bash', 'shield-push', 'shield-slam'] },
  { id: 'dagger', preset: 'stick-scout', equipment: 'dagger', expectedClips: ['dagger-stab', 'backfist', 'elbow-strike'] },
  { id: 'hammer-war', preset: 'stick-heavy', equipment: 'hammer-war', expectedClips: ['hammer-overhead', 'shoulder-check'] },
  { id: 'sword', preset: 'stick-fighter', equipment: 'sword', expectedClips: ['sword-slash', 'sword-diagonal', 'sword-lunge', 'sword-overhead'] },
  { id: 'bow', preset: 'stick-scout', equipment: 'bow', expectedClips: ['bow-release'] },
  { id: 'rifle', preset: 'stick-agent', equipment: 'rifle', expectedClips: ['rifle-fire'] },
]
const unarmedCases: { id: string; preset: string; expectedClips: string[] }[] = [
  { id: 'scrapper-unarmed', preset: 'stick-compact', expectedClips: ['elbow-strike', 'knee-strike', 'backfist', 'shoulder-check'] },
  { id: 'heavy-unarmed', preset: 'stick-heavy', expectedClips: ['punch-heavy', 'shoulder-check', 'elbow-strike'] },
  { id: 'striker-unarmed', preset: 'stick-striker', expectedClips: ['kick-front', 'knee-strike', 'kick-roundhouse', 'backfist'] },
]

const checks: Check[] = []
const browserErrors: string[] = []
const equipmentResults: unknown[] = []
const layoutResults: unknown[] = []
const addCheck = (name: string, pass: boolean, details?: unknown): void => {
  checks.push({ name, pass, ...(details === undefined ? {} : { details }) })
  if (!pass) console.error(`FAIL ${name}`, details ?? '')
}
const sleep = (milliseconds: number): Promise<void> => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))
const auditState = (page: Page): Promise<AuditState> => page.evaluate(() => (window as unknown as { inklineAudit: AuditApi }).inklineAudit.state())
const artState = (page: Page): Promise<ArtState> => page.evaluate(() => (window as unknown as { inklineAudit: AuditApi }).inklineAudit.artState())
const setStage = (page: Page, patch: Partial<StageSettings>): Promise<void> => page.evaluate(value => {
  (window as unknown as { inklineAudit: AuditApi }).inklineAudit.set(value)
}, patch)
const dispatch = (page: Page, action: Action, pressed: boolean): Promise<void> => page.evaluate(({ action: name, pressed: value }) => {
  window.dispatchEvent(new CustomEvent('inkline-input', { detail: { action: name, pressed: value } }))
}, { action, pressed })

async function waitReady(page: Page, timeout = 35000): Promise<void> {
  await page.waitForFunction(() => Boolean((window as unknown as { inklineAudit?: AuditApi }).inklineAudit), undefined, { timeout })
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const current = await auditState(page)
    if (current.stats && !current.stats.loading) {
      if (current.stats.error) throw new Error(`Runtime error: ${current.stats.error}`)
      return
    }
    await sleep(100)
  }
  throw new Error(`Audit stage did not become ready within ${timeout} ms.`)
}

async function resetStage(page: Page): Promise<void> {
  const current = await auditState(page)
  await setStage(page, { reset: current.settings.reset + 1 })
  await waitReady(page)
  await sleep(120)
}

async function checkPixels(page: Page): Promise<{ width: number; height: number; finite: boolean; nonBlank: number; glError: number | null }> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
    const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl')
    if (!gl) return { width: 0, height: 0, finite: false, nonBlank: 0, glError: null }
    const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight
    const pixels = new Uint8Array(width * height * 4)
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    let nonBlank = 0
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] !== 238 || pixels[i + 1] !== 236 || pixels[i + 2] !== 229 || pixels[i + 3] !== 255) nonBlank++
    }
    return { width, height, finite: [...pixels].every(Number.isFinite), nonBlank, glError: gl.getError() }
  })
}

async function verifyAttack(page: Page, item: { id: string; preset: string; equipment: string | null; expectedClips: string[] }): Promise<Record<string, unknown>> {
  const avatar = { ...avatarBase, preset: item.preset, equipment: item.equipment }
  await setStage(page, { mode: 'combat', districtLayout: 'district', ambientEffects: false, camera: 'third-person', playing: true, speed: 1, avatar })
  await waitReady(page)
  await resetStage(page)
  const initial = await auditState(page)
  const figuresPass = initial.stats?.figures === 5
  addCheck(`${item.id}: combat has five figures`, figuresPass, { figures: initial.stats?.figures ?? null })

  await dispatch(page, 'forward', true)
  await sleep(700)
  await dispatch(page, 'forward', false)
  const before = await artState(page)
  const beforeContacts = before.contacts.length
  await dispatch(page, 'attack', true)
  await dispatch(page, 'attack', false)
  await sleep(25)
  const selected = await artState(page)
  const selectedClip = selected.attack?.clip ?? null
  const selectedPass = selectedClip !== null && item.expectedClips.includes(selectedClip)
  addCheck(`${item.id}: attack selects expected clip family`, selectedPass, { selectedClip, expectedClips: item.expectedClips })

  const started = Date.now()
  let current = await artState(page)
  while (current.contacts.length <= beforeContacts && Date.now() - started < 2400) {
    await sleep(35)
    current = await artState(page)
  }
  await sleep(420)
  current = await artState(page)
  const newContacts = current.contacts.slice(beforeContacts)
  const contact = newContacts[0]
  const expectedTime = contact ? (JSON.parse(await readFile(resolve('public/assets/manifest.json'), 'utf8')) as Manifest).animations.find(animation => animation.id === contact.clip)?.contactTime : undefined
  const contactPass = newContacts.length === 1 && contact !== undefined && expectedTime !== undefined && contact.expectedTime === expectedTime && Math.abs(contact.clipTime - expectedTime) <= 1 / 60 + 1e-6
  addCheck(`${item.id}: one contact at authored time`, contactPass, { contact, expectedTime, contacts: newContacts.length, body: current.body.position })
  const state = await auditState(page)
  const errorPass = !state.stats?.error && browserErrors.length === 0
  addCheck(`${item.id}: no runtime error`, errorPass, { error: state.stats?.error ?? null, browserErrors })
  return { ...item, selectedClip, contacts: newContacts, figures: state.stats?.figures ?? null, score: state.stats?.score ?? null }
}

async function verifyLayout(page: Page, layout: LayoutId, ambientEffects: boolean, view: View, expectedFigures: number): Promise<Record<string, unknown>> {
  const previous = await auditState(page)
  const newLayout = previous.settings.mode !== 'district' || previous.settings.districtLayout !== layout
  await page.setViewportSize({ width: view.width, height: view.height })
  await setStage(page, { mode: 'district', districtLayout: layout, ambientEffects, camera: 'perspective', playing: true, speed: 1 })
  await waitReady(page)
  await sleep(450)
  const state = await auditState(page)
  const frame = await artState(page)
  const fits = frame.sceneFrame.length === 8 && frame.sceneFrame.every(point =>
    Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= frame.viewport.width &&
    point.y >= 0 && point.y <= frame.viewport.height && point.depth >= -1 && point.depth <= 1)
  addCheck(`${layout} ${view.id}: full scene fits after resize`, fits, frame.sceneFrame)
  if (newLayout) {
    const width = Math.max(...frame.sceneFrame.map(point => point.x)) - Math.min(...frame.sceneFrame.map(point => point.x))
    const height = Math.max(...frame.sceneFrame.map(point => point.y)) - Math.min(...frame.sceneFrame.map(point => point.y))
    const span = Math.max(width / frame.viewport.width, height / frame.viewport.height)
    addCheck(`${layout}: new layout uses the view`, span >= .7, { span })
  }
  const pixels = await checkPixels(page)
  const filename = `layout-${layout}-ambient-${ambientEffects ? 'on' : 'off'}-${view.id}.png`
  const path = resolve(screenshotDir, filename)
  await page.screenshot({ path })
  const file = await stat(path)
  const runtimePass = !state.stats?.error && !state.stats?.loading
  const figuresPass = state.stats?.figures === expectedFigures
  const pixelsPass = pixels.finite && pixels.width > 0 && pixels.height > 0 && pixels.nonBlank > 0 && pixels.glError === 0
  addCheck(`${filename}: no load error`, runtimePass, { error: state.stats?.error ?? null, loading: state.stats?.loading ?? null })
  addCheck(`${filename}: expected figure count`, figuresPass, { figures: state.stats?.figures ?? null, expectedFigures })
  addCheck(`${filename}: finite rendered pixels`, pixelsPass, pixels)
  addCheck(`${filename}: screenshot written`, file.size > 1000, { bytes: file.size })
  return { layout, ambientEffects, view, file: filename, bytes: file.size, stats: state.stats, pixels }
}

const manifest = JSON.parse(await readFile(resolve('public/assets/manifest.json'), 'utf8')) as Manifest
const manifestIds = new Set(manifest.animations.map(animation => animation.id))
addCheck('final manifest contains 85 animation clips', manifest.animations.length === 85, { count: manifest.animations.length })
addCheck('manifest animation IDs are unique', manifestIds.size === manifest.animations.length, { count: manifestIds.size })
const requiredClipIds = [...new Set([...equipmentCases, ...unarmedCases].flatMap(item => item.expectedClips))]
addCheck('manifest contains all expansion attack clips', requiredClipIds.every(id => manifestIds.has(id)), { missing: requiredClipIds.filter(id => !manifestIds.has(id)) })

await mkdir(screenshotDir, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const result: Record<string, unknown> = { url: baseUrl, checks, browserErrors, manifestAnimationCount: manifest.animations.length }
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`))
  page.on('response', response => {
    const url = new URL(response.url())
    if (response.status() >= 400 && !url.pathname.endsWith('/favicon.ico')) browserErrors.push(`HTTP ${response.status()} ${response.url()}`)
  })
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) browserErrors.push(`console: ${message.text()}`)
  })
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await waitReady(page)
  const initial = await auditState(page)
  addCheck('audit page ready with no runtime error', Boolean(initial.stats && !initial.stats.loading && !initial.stats.error), initial.stats)
  for (const item of equipmentCases) equipmentResults.push(await verifyAttack(page, { ...item, equipment: item.equipment }))
  for (const item of unarmedCases) equipmentResults.push(await verifyAttack(page, { ...item, equipment: null }))
  for (const layout of layouts) for (const ambientEffects of [false, true]) for (const view of views) {
    layoutResults.push(await verifyLayout(page, layout.id, ambientEffects, view, layout.expectedFigures))
  }
} catch (error) {
  browserErrors.push(error instanceof Error ? error.stack ?? error.message : String(error))
} finally {
  await browser.close()
}

const errorFree = browserErrors.length === 0
addCheck('browser reports no page or console errors', errorFree, browserErrors)
result.equipment = equipmentResults
result.layouts = layoutResults
result.checks = checks
result.browserErrors = browserErrors
result.pass = checks.every(check => check.pass) && errorFree
result.generatedAt = new Date().toISOString()
await writeFile(outputFile, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify({ pass: result.pass, checks: checks.length, failed: checks.filter(check => !check.pass).map(check => check.name), browserErrors }, null, 2))
if (!result.pass) process.exitCode = 1

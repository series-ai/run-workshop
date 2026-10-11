import { chromium, type Page } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DEFAULT_AVATAR, type StageSettings } from '../src/types'

type Action = 'left' | 'right' | 'forward' | 'back' | 'attack' | 'reset'
type Projected = { x: number; y: number; depth: number }
type JointMap = Record<string, Projected>
type ActorArt = { clip?: string; health?: number; joints?: JointMap; position?: [number, number, number] }
type Contact = { clip: string; clipTime: number; expectedTime: number; hits: number }
type ArtState = {
  viewport: { width: number; height: number }
  attack: { clip: string; elapsed: number; contact: number; contacted: boolean } | null
  equipmentContact?: Projected | null
  contacts: Contact[]
  actors: ActorArt[]
  [key: string]: unknown
}
type Stats = { loading: boolean; error: string | null; score: number }
type AuditState = { stats: Stats | null; settings: StageSettings }
type AuditApi = { set(patch: Partial<StageSettings>): void; state(): AuditState; artState(): ArtState }
type AnimationEntry = { id: string; duration: number; contactTime?: number }
type Manifest = { animations: AnimationEntry[] }
type Check = { name: string; pass: boolean; details?: unknown }
type AnchorEvidence = {
  equipmentContact: Projected | null
  actorHips: Projected | null
  hand: Projected | null
  targetHips: Projected | null
  contactToHand: number | null
  contactToTargetHips: number | null
  bodySpan: number | null
  insideContact: boolean
}

const baseUrl = process.env.INKLINE_AUDIT_URL ?? 'http://localhost:5197/audit.html'
const outputFile = resolve('docs/verification/kinetic/contact-poses.json')
const avatarBase = { ...DEFAULT_AVATAR }
const contactCases: { id: string; preset: string; equipment: string | null; clip: string }[] = [
  { id: 'punch-heavy', preset: 'stick-heavy', equipment: null, clip: 'punch-heavy' },
  { id: 'staff-thrust', preset: 'stick-tall', equipment: 'staff', clip: 'staff-thrust' },
  { id: 'shield-bash', preset: 'stick-sentinel', equipment: 'shield-riot', clip: 'shield-bash' },
  { id: 'sword-lunge', preset: 'stick-fighter', equipment: 'sword', clip: 'sword-lunge' },
]
const checks: Check[] = []
const browserErrors: string[] = []
const sleep = (milliseconds: number): Promise<void> => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))
const addCheck = (name: string, pass: boolean, details?: unknown): void => {
  checks.push({ name, pass, ...(details === undefined ? {} : { details }) })
  if (!pass) console.error(`FAIL ${name}`, details ?? '')
}
const auditState = (page: Page): Promise<AuditState> => page.evaluate(() => (window as unknown as { inklineAudit: AuditApi }).inklineAudit.state())
const artState = (page: Page): Promise<ArtState> => page.evaluate(() => (window as unknown as { inklineAudit: AuditApi }).inklineAudit.artState())
const setStage = (page: Page, patch: Partial<StageSettings>): Promise<void> => page.evaluate(value => {
  (window as unknown as { inklineAudit: AuditApi }).inklineAudit.set(value)
}, patch)
const dispatch = (page: Page, action: Action, pressed: boolean): Promise<void> => page.evaluate(({ action: name, pressed: value }) => {
  window.dispatchEvent(new CustomEvent('inkline-input', { detail: { action: name, pressed: value } }))
}, { action, pressed })

async function waitReady(page: Page, timeout = 35000): Promise<void> {
  await page.waitForFunction(() => Boolean((window as unknown as { inklineAudit?: AuditApi }).inklineAudit), null, { timeout: 20000 })
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const current = await auditState(page)
    if (current.stats && !current.stats.loading) {
      if (current.stats.error) throw new Error(`Runtime error: ${current.stats.error}`)
      return
    }
    await sleep(80)
  }
  throw new Error(`Audit stage did not become ready within ${timeout} ms.`)
}

async function waitForArt(page: Page, predicate: (state: ArtState) => boolean, timeout: number, label: string): Promise<ArtState> {
  const started = Date.now()
  let last = await artState(page)
  while (Date.now() - started < timeout) {
    if (predicate(last)) return last
    await sleep(25)
    last = await artState(page)
  }
  throw new Error(`${label} did not complete within ${timeout} ms: ${JSON.stringify(last)}`)
}

async function resetStage(page: Page): Promise<void> {
  await dispatch(page, 'reset', true)
  await dispatch(page, 'reset', false)
  await sleep(140)
}

async function moveToTarget(page: Page): Promise<ArtState> {
  await dispatch(page, 'forward', true)
  const started = Date.now()
  let state = await artState(page)
  while (Date.now() - started < 1200 && (state.actors[0]?.position?.[2] ?? Number.POSITIVE_INFINITY) > 5.8) {
    await sleep(25)
    state = await artState(page)
  }
  await dispatch(page, 'forward', false)
  await sleep(90)
  return artState(page)
}

function finitePoint(value: unknown): value is Projected {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const point = value as Record<string, unknown>
  return ['x', 'y', 'depth'].every(key => typeof point[key] === 'number' && Number.isFinite(point[key]))
}

function inside(point: Projected | null, viewport: { width: number; height: number }): boolean {
  return point !== null && point.x >= 0 && point.x <= viewport.width && point.y >= 0 && point.y <= viewport.height && point.depth >= -1 && point.depth <= 1
}

function distance(a: Projected | null, b: Projected | null): number | null {
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null
}

function point(state: ArtState, actor: number, joint: string): Projected | null {
  const value = state.actors[actor]?.joints?.[joint]
  return finitePoint(value) ? value : null
}

function anchorEvidence(state: ArtState): AnchorEvidence {
  const contact = finitePoint(state.equipmentContact) ? state.equipmentContact : null
  const hips = point(state, 0, 'Hips')
  const hand = point(state, 0, 'Hand_R') ?? point(state, 0, 'Hand_L')
  const targetHips = point(state, 1, 'Hips')
  const head = point(state, 0, 'Head')
  const feet = point(state, 0, 'Foot_L') ?? point(state, 0, 'Foot_R')
  const bodySpan = distance(head, feet)
  return {
    equipmentContact: contact,
    actorHips: hips,
    hand,
    targetHips,
    contactToHand: distance(contact, hand),
    contactToTargetHips: distance(contact, targetHips),
    bodySpan,
    insideContact: inside(contact, state.viewport),
  }
}

async function verifySwordOverhead(page: Page, manifest: Manifest): Promise<Record<string, unknown>> {
  const clip = manifest.animations.find(animation => animation.id === 'sword-overhead')
  if (!clip || clip.contactTime === undefined) throw new Error('sword-overhead contact metadata is missing.')
  const avatar = { ...avatarBase, preset: 'stick-fighter', equipment: 'sword' }
  await setStage(page, { mode: 'animations', animationId: clip.id, camera: 'side', playing: true, speed: 1, seek: null, motion: 'full', avatar })
  await waitReady(page)
  await setStage(page, { playing: false, seek: 0 })
  await sleep(100)
  const preparation = await artState(page)
  await setStage(page, { seek: clip.contactTime })
  await sleep(120)
  const contact = await artState(page)
  const evidence = anchorEvidence(contact)
  const preparationContact = finitePoint(preparation.equipmentContact) ? preparation.equipmentContact : null
  const current = evidence.equipmentContact
  const head = point(contact, 0, 'Head')
  const feet = point(contact, 0, 'Foot_L') ?? point(contact, 0, 'Foot_R')
  const bodySpan = evidence.bodySpan ?? 0
  const forwardOffset = evidence.actorHips && current ? Math.abs(current.x - evidence.actorHips.x) : null
  const heightInBodyBand = current !== null && head !== null && feet !== null && bodySpan !== null && current.y >= head.y - bodySpan * .22 && current.y <= feet.y + bodySpan * .22
  const forwardPass = forwardOffset !== null && bodySpan !== null && forwardOffset >= Math.max(6, bodySpan * .08)
  const mountedPass = evidence.contactToHand !== null && bodySpan !== null && evidence.contactToHand <= Math.max(24, bodySpan * 1.8)
  const motionPass = preparationContact !== null && current !== null && bodySpan !== null && distance(preparationContact, current) !== null && distance(preparationContact, current)! >= Math.max(5, bodySpan * .04)
  const pass = evidence.insideContact && heightInBodyBand && forwardPass && mountedPass && motionPass
  addCheck('sword-overhead contact tip is mounted, forward, and height-bounded', pass, { contactTime: clip.contactTime, preparation: anchorEvidence(preparation), contact: evidence, forwardOffset, heightInBodyBand, forwardPass, mountedPass, motionPass })
  return { clip: clip.id, contactTime: clip.contactTime, preparation: anchorEvidence(preparation), contact: evidence, forwardOffset, heightInBodyBand, forwardPass, mountedPass, motionPass }
}

async function verifyKineticCase(page: Page, item: typeof contactCases[number]): Promise<Record<string, unknown>> {
  const avatar = { ...avatarBase, preset: item.preset, equipment: item.equipment }
  await setStage(page, { mode: 'combat', districtLayout: 'district', ambientEffects: false, camera: 'third-person', playing: true, speed: 1, seek: null, motion: 'full', avatar })
  await waitReady(page)
  await resetStage(page)
  const primed: Contact[] = []
  if (item.id === 'sword-lunge') {
    for (const expectedClip of ['sword-slash', 'sword-diagonal']) {
      const before = (await artState(page)).contacts.length
      await dispatch(page, 'attack', true)
      await dispatch(page, 'attack', false)
      await waitForArt(page, state => state.attack?.clip === expectedClip, 800, `${expectedClip} selection`)
      const contactState = await waitForArt(page, state => state.contacts.length > before, 2200, `${expectedClip} contact`)
      primed.push(contactState.contacts[before])
      await waitForArt(page, state => state.attack === null, 1200, `${expectedClip} completion`)
    }
  }
  const start = await moveToTarget(page)
  const beforeContactCount = start.contacts.length
  const beforeScore = (await auditState(page)).stats?.score ?? 0
  await dispatch(page, 'attack', true)
  await dispatch(page, 'attack', false)
  const started = await waitForArt(page, state => state.attack?.clip === item.clip, 800, `${item.id} attack selection`)
  const contacted = await waitForArt(page, state => state.contacts.length > beforeContactCount, 2200, `${item.id} contact`)
  await sleep(70)
  const final = await artState(page)
  const score = (await auditState(page)).stats?.score ?? null
  const contact = contacted.contacts[beforeContactCount]
  const evidence = anchorEvidence(final)
  const targetHealth = final.actors[1]?.health ?? null
  const anchorPass = item.equipment === null
    ? evidence.targetHips !== null
    : evidence.insideContact && evidence.contactToTargetHips !== null && evidence.bodySpan !== null && evidence.contactToTargetHips <= evidence.bodySpan * 3.2
  const pass = started.attack?.clip === item.clip && contact?.hits === 1 && targetHealth === 2 && score === beforeScore + 10 && anchorPass
  addCheck(`${item.id} real-input contact uses readable anchors`, pass, { start: start.body, selected: started.attack, contact, targetHealth, scoreBefore: beforeScore, scoreAfter: score, anchors: evidence, anchorPass })
  return { item, primed, start: start.body, selected: started.attack, contact, targetHealth, scoreBefore: beforeScore, scoreAfter: score, anchors: evidence, anchorPass }
}

const manifest = JSON.parse(await readFile(resolve('public/assets/manifest.json'), 'utf8')) as Manifest
await mkdir(resolve('docs/verification/kinetic'), { recursive: true })
const result: Record<string, unknown> = { url: baseUrl, checks, browserErrors }
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`))
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('favicon.ico')) browserErrors.push(`console: ${message.text()}`) })
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) browserErrors.push(`HTTP ${response.status()} ${response.url()}`) })
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await waitReady(page)
  result.swordOverhead = await verifySwordOverhead(page, manifest)
  result.kinetics = []
  for (const item of contactCases) (result.kinetics as unknown[]).push(await verifyKineticCase(page, item))
} catch (error) {
  browserErrors.push(error instanceof Error ? error.stack ?? error.message : String(error))
} finally {
  await browser.close()
}
const errorFree = browserErrors.length === 0
addCheck('browser reports no page, console, or HTTP errors', errorFree, browserErrors)
result.checks = checks
result.browserErrors = browserErrors
result.pass = checks.every(check => check.pass) && errorFree
result.generatedAt = new Date().toISOString()
await writeFile(outputFile, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify({ pass: result.pass, checks: checks.length, failed: checks.filter(check => !check.pass).map(check => check.name), browserErrors }, null, 2))
if (!result.pass) process.exitCode = 1

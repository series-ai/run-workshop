import { chromium, type Page } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { CHECKPOINTS } from '../src/runtime/district'
import { DEFAULT_AVATAR, type StageSettings } from '../src/types'
import { captureCameraPixels } from './verify-camera-motion'

type Action = 'left' | 'right' | 'forward' | 'back' | 'jump' | 'attack' | 'dash' | 'reset'
type Camera = StageSettings['camera']
type ViewSize = { id: 'desktop' | 'phone'; width: number; height: number }

interface AuditStats { loading: boolean; error: string | null; score: number; message: string }
interface AuditState { stats: AuditStats | null; settings: StageSettings }
interface ProjectedPoint { x: number; y: number; depth: number }
interface ArtActor { blocked: Record<string, boolean>; clip: string; position: [number, number, number]; joints: Record<string, ProjectedPoint> }
interface ArtContact { clip: string; clipTime: number; expectedTime: number; hits: number }
interface ArtState {
  body: { position: { x: number; y: number; z: number }; grounded: boolean; velocityY: number; facing: number }
  checkpoint: number
  attack: { clip: string; elapsed: number; contact: number; contacted: boolean } | null
  impactHold: number
  contacts: ArtContact[]
  actors: ArtActor[]
}
interface AuditApi {
  set(patch: Partial<StageSettings>): void
  state(): AuditState
  artState(): ArtState
}
interface Check { name: string; pass: boolean; details?: unknown }

const baseUrl = process.env.INKLINE_AUDIT_URL ?? 'http://localhost:5197/audit.html'
const outputDir = resolve('docs/verification/art-pass')
const views: ViewSize[] = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'phone', width: 390, height: 844 },
]
const cameras: Camera[] = ['third-person', 'side', 'top', 'perspective']
const routeWaypoints: [number, number][][] = [
  [[0, 9]], [[4, 9], [4, 4.5]], [[4, -.5]], [[4, -4.5]], [[0, -7]], [[-3, -3]], [[-3, 4]],
]
const checks: Check[] = []
const browserErrors: string[] = []
const movementSamples: { x: number; y: number; z: number; checkpoint: number; time: number }[] = []

const sleep = (milliseconds: number) => new Promise<void>(resolvePromise => setTimeout(resolvePromise, milliseconds))
const auditState = (page: Page): Promise<AuditState> => page.evaluate(() => (window as unknown as { inklineAudit: AuditApi }).inklineAudit.state())
const artState = (page: Page): Promise<ArtState> => page.evaluate(() => (window as unknown as { inklineAudit: AuditApi }).inklineAudit.artState())
const setStage = (page: Page, patch: Partial<StageSettings>): Promise<void> => page.evaluate(value => {
  (window as unknown as { inklineAudit: AuditApi }).inklineAudit.set(value)
}, patch)
const dispatch = (page: Page, action: Action, pressed: boolean): Promise<void> => page.evaluate(({ action: name, pressed: value }) => {
  window.dispatchEvent(new CustomEvent('inkline-input', { detail: { action: name, pressed: value } }))
}, { action, pressed })

function addCheck(name: string, pass: boolean, details?: unknown): void {
  checks.push({ name, pass, ...(details === undefined ? {} : { details }) })
  if (!pass) console.error(`FAIL ${name}`, details ?? '')
}

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

async function sample(page: Page): Promise<ArtState> {
  const state = await artState(page)
  const previous = movementSamples[movementSamples.length - 1]
  if (!previous || previous.x !== state.body.position.x || previous.y !== state.body.position.y || previous.z !== state.body.position.z) {
    movementSamples.push({ ...state.body.position, checkpoint: state.checkpoint, time: Date.now() })
  }
  return state
}

async function resetStage(page: Page): Promise<void> {
  const current = await auditState(page)
  await setStage(page, { reset: current.settings.reset + 1 })
  await waitReady(page)
  await sleep(120)
}

async function setActions(page: Page, active: Set<Action>, next: Set<Action>): Promise<void> {
  for (const action of active) if (!next.has(action)) await dispatch(page, action, false)
  for (const action of next) if (!active.has(action)) await dispatch(page, action, true)
  active.clear(); next.forEach(action => active.add(action))
}

function projectedJointsCheck(state: ArtState, width: number, height: number) {
  const joints = Object.values(state.actors[0]?.joints ?? {})
  const visible = joints.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y) && point.depth > -1 && point.depth < 1 && point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height)
  const xValues = visible.map(point => point.x), yValues = visible.map(point => point.y)
  const xSpan = xValues.length ? Math.max(...xValues) - Math.min(...xValues) : 0
  const ySpan = yValues.length ? Math.max(...yValues) - Math.min(...yValues) : 0
  return { visibleCount: visible.length, xSpan, ySpan, pass: joints.length >= 11 && visible.length === joints.length && xSpan > 8 && ySpan > 8 }
}

async function captureCheckpoint(page: Page, checkpoint: number): Promise<unknown[]> {
  const captures: unknown[] = []
  for (const view of views) {
    await page.setViewportSize({ width: view.width, height: view.height })
    await sleep(120)
    for (const camera of cameras) {
      await setStage(page, { camera })
      await sleep(450)
      const state = await sample(page)
      const joints = projectedJointsCheck(state, view.width, view.height)
      const filename = `route-checkpoint-${String(checkpoint + 1).padStart(2, '0')}-${view.id}-${camera}.png`
      await page.screenshot({ path: resolve(outputDir, filename) })
      captures.push({ checkpoint: checkpoint + 1, view: view.id, camera, file: filename, joints })
      addCheck(`${filename}: projected joints readable`, joints.pass, joints)
      const blocked = state.actors[0]?.blocked ?? {}
      const clear = Object.values(blocked).filter(value => !value).length
      const rendered = await captureCameraPixels(page, `full-route-${checkpoint + 1}-${view.id}-${camera}`)
      addCheck(`${filename}: sampled body pixels remain visible`, rendered.pass, { blocked, clear, rendered })
      const current = await auditState(page)
      addCheck(`${filename}: no runtime error`, !current.stats?.error, { error: current.stats?.error ?? null })
    }
  }
  return captures
}

async function driveToCheckpoint(page: Page, index: number, active: Set<Action>, waypoints: [number, number][]): Promise<{ durationMs: number; samples: number; end: ArtState }> {
  const started = Date.now()
  const segmentStart = movementSamples.length
  let waypoint = 0
  let last: ArtState | null = null
  while (Date.now() - started < 12000) {
    const state = await sample(page)
    last = state
    if (state.checkpoint > index) {
      await setActions(page, active, new Set())
      return { durationMs: Date.now() - started, samples: movementSamples.length - segmentStart, end: state }
    }
    const target = waypoints[Math.min(waypoint, waypoints.length - 1)]
    const dx = target[0] - state.body.position.x
    const dz = target[1] - state.body.position.z
    if (Math.max(Math.abs(dx), Math.abs(dz)) <= .14 && waypoint < waypoints.length - 1) {
      waypoint++
      await setActions(page, active, new Set())
      await sleep(25)
      continue
    }
    const next = new Set<Action>()
    if (Math.abs(dx) > .14) next.add(dx > 0 ? 'right' : 'left')
    if (Math.abs(dz) > .14) next.add(dz > 0 ? 'back' : 'forward')
    await setActions(page, active, next)
    await sleep(Math.hypot(dx, dz) < .5 ? 20 : 80)
  }
  await setActions(page, active, new Set())
  throw new Error(`Checkpoint ${index + 1} was not reached from a real input route. Last body: ${JSON.stringify(last?.body.position ?? null)}.`)
}

async function verifyContactTiming(page: Page): Promise<Record<string, unknown>> {
  await setStage(page, { mode: 'combat', camera: 'third-person', playing: true, speed: 1, avatar: { ...DEFAULT_AVATAR, equipment: null } })
  await waitReady(page)
  await resetStage(page)

  // Queue an attack and reset in the same task. resetGame must cancel it before contact.
  await page.evaluate(() => {
    const api = (window as unknown as { inklineAudit: AuditApi }).inklineAudit
    window.dispatchEvent(new CustomEvent('inkline-input', { detail: { action: 'attack', pressed: true } }))
    window.dispatchEvent(new CustomEvent('inkline-input', { detail: { action: 'attack', pressed: false } }))
    api.set({ reset: api.state().settings.reset + 1 })
  })
  await waitReady(page)
  await sleep(850)
  const cancelled = await artState(page)
  const cancellationPass = cancelled.contacts.length === 0 && cancelled.attack === null && (await auditState(page)).stats?.score === 0
  addCheck('reset cancels pending attack contact', cancellationPass, { contacts: cancelled.contacts, attack: cancelled.attack, score: (await auditState(page)).stats?.score ?? null })

  // Move from the authored combat spawn through real input until the first target is in range.
  const active = new Set<Action>()
  await setActions(page, active, new Set(['forward']))
  const moveStarted = Date.now()
  while (Date.now() - moveStarted < 650) { await sample(page); await sleep(80) }
  await setActions(page, active, new Set())
  const before = (await artState(page)).contacts.length
  await dispatch(page, 'attack', true); await dispatch(page, 'attack', false)
  const contactStarted = Date.now()
  let contactState = await artState(page)
  while (contactState.contacts.length <= before && Date.now() - contactStarted < 1800) { await sleep(35); contactState = await sample(page) }
  const newContacts = contactState.contacts.slice(before)
  const contact = newContacts[0]
  const manifest = JSON.parse(await readFile(resolve('public/assets/manifest.json'), 'utf8')) as { animations: { id: string; contactTime?: number }[] }
  const authoredTime = contact ? manifest.animations.find(animation => animation.id === contact.clip)?.contactTime : undefined
  const timingPass = newContacts.length === 1 && contact !== undefined && authoredTime !== undefined && contact.expectedTime === authoredTime && Math.abs(contact.clipTime - authoredTime) <= 1 / 60 + 1e-6
  addCheck('contact fires once at authored point', timingPass, { contact, authoredTime, newContacts: newContacts.length })
  return { cancelled: { contacts: cancelled.contacts.length, attack: cancelled.attack }, contact, authoredTime, newContacts: newContacts.length }
}

async function verifyRoute(page: Page): Promise<{ captures: unknown[]; segments: unknown[] }> {
  await setStage(page, { mode: 'parkour', camera: 'third-person', playing: true, speed: 1 })
  await waitReady(page)
  await resetStage(page)
  movementSamples.length = 0
  const active = new Set<Action>()
  const captures: unknown[] = []
  const segments: unknown[] = []
  for (let index = 0; index < CHECKPOINTS.length; index++) {
    const segment = await driveToCheckpoint(page, index, active, routeWaypoints[index])
    const capture = await captureCheckpoint(page, index)
    segments.push({ checkpoint: index + 1, durationMs: segment.durationMs, samples: segment.samples, body: segment.end.body.position })
    captures.push(...capture)
    addCheck(`route checkpoint ${index + 1} reached`, segment.end.checkpoint === index + 1, { checkpoint: segment.end.checkpoint, body: segment.end.body.position })
  }
  const deltas: number[] = []
  for (let index = 1; index < movementSamples.length; index++) {
    const before = movementSamples[index - 1], after = movementSamples[index]
    deltas.push(Math.hypot(after.x - before.x, after.y - before.y, after.z - before.z))
  }
  const maxStep = deltas.length ? Math.max(...deltas) : Infinity
  const totalDistance = deltas.reduce((sum, value) => sum + value, 0)
  const noTeleport = maxStep < 1.1 && totalDistance > 20
  addCheck('parkour route uses real movement without teleport', noTeleport, { samples: movementSamples.length, maxStep, totalDistance, segments })
  return { captures, segments }
}

async function captureCombinedImpact(page: Page): Promise<unknown[]> {
  const captures: unknown[] = []
  for (const view of views) {
    await page.setViewportSize({ width: view.width, height: view.height })
    await setStage(page, { mode: 'combat', camera: 'third-person', playing: true, speed: 1 })
    await waitReady(page)
    await resetStage(page)
    const active = new Set<Action>()
    await setActions(page, active, new Set(['forward']))
    await sleep(560)
    await setActions(page, active, new Set())
    const before = (await artState(page)).contacts.length
    await dispatch(page, 'attack', true); await dispatch(page, 'attack', false)
    await page.waitForFunction(count => (window as unknown as { inklineAudit: AuditApi }).inklineAudit.artState().contacts.length > count, before, { timeout: 1800 })
    await sleep(10)
    const filename = `combined-impact-${view.id}.png`
    await page.screenshot({ path: resolve(outputDir, filename) })
    const state = await sample(page), current = await auditState(page)
    captures.push({ view: view.id, file: filename, contacts: state.contacts, score: current.stats?.score ?? null })
    addCheck(`${filename}: combined gameplay impact present`, state.contacts.some(contact => contact.hits > 0) && state.actors.length >= 2 && (current.stats?.score ?? 0) > 0, { contacts: state.contacts, actors: state.actors.length })
    addCheck(`${filename}: no runtime error`, !current.stats?.error, { error: current.stats?.error ?? null })
  }
  return captures
}

const result: Record<string, unknown> = { url: baseUrl, checks, browserErrors }
await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`))
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`) })
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await waitReady(page)
  const initial = await auditState(page)
  addCheck('audit page ready with no runtime error', Boolean(initial.stats && !initial.stats.loading && !initial.stats.error), initial.stats)
  result.contact = await verifyContactTiming(page)
  result.route = await verifyRoute(page)
  result.impact = await captureCombinedImpact(page)
} catch (error) {
  browserErrors.push(error instanceof Error ? error.stack ?? error.message : String(error))
} finally {
  await browser.close()
}

const errorFree = browserErrors.length === 0
addCheck('browser and runtime report no errors', errorFree, browserErrors)
result.checks = checks
result.browserErrors = browserErrors
result.pass = checks.every(check => check.pass) && errorFree
result.generatedAt = new Date().toISOString()
await writeFile(resolve(outputDir, 'art-pass.json'), `${JSON.stringify(result, null, 2)}\n`)
if (!result.pass) process.exitCode = 1
console.log(JSON.stringify({ pass: result.pass, checks: checks.length, failed: checks.filter(check => !check.pass).map(check => check.name), browserErrors }, null, 2))

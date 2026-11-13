import { chromium, type Page } from '@playwright/test'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DEFAULT_AVATAR, type StageSettings } from '../src/types'

type Action = 'left' | 'right' | 'forward' | 'back' | 'jump' | 'attack' | 'dash' | 'reset'
type Camera = StageSettings['camera']
type View = { id: 'desktop' | 'phone'; width: 1440 | 390; height: 900 | 844 }
type Avatar = StageSettings['avatar']
type Projected = { x: number; y: number; depth: number }
type Stats = { loading: boolean; error: string | null; figures: number; effects: number; score: number }
type Contact = { clip: string; clipTime: number; expectedTime: number; hits: number }
type ActorArt = {
  clip?: string
  health?: number
  position?: [number, number, number]
  joints?: Record<string, Projected>
  reaction?: unknown
  equipmentContact?: Projected | null
  [key: string]: unknown
}
type ArtState = {
  viewport: { width: number; height: number }
  body: { position: { x: number; y: number; z: number }; grounded?: boolean; facing?: number }
  attack: { clip: string; elapsed: number; contact: number; contacted: boolean } | null
  impactHold: number
  trails?: { active: number; triangles: number }
  motionReduced?: boolean
  bufferRemaining?: number | null
  equipmentContact?: Projected | null
  contacts: Contact[]
  actors: ActorArt[]
  [key: string]: unknown
}
type AuditState = { stats: Stats | null; settings: StageSettings }
type AuditApi = {
  set(patch: Partial<StageSettings>): void
  state(): AuditState
  artState(): ArtState
}
type Check = { name: string; pass: boolean; details?: unknown }
type Manifest = { animations: { id: string; contactTime?: number }[] }

const baseUrl = process.env.INKLINE_AUDIT_URL ?? 'http://localhost:5197/audit.html'
const outputFile = resolve('docs/verification/kinetic/runtime.json')
const screenshotDir = resolve('docs/verification/kinetic/screenshots')
const views: View[] = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'phone', width: 390, height: 844 },
]
const cameras: Camera[] = ['perspective', 'side', 'top', 'third-person']
const avatarBase: Avatar = { ...DEFAULT_AVATAR }
const cameraCases: { id: string; preset: string; equipment: string | null; clipHint: string }[] = [
  { id: 'staff', preset: 'stick-tall', equipment: 'staff', clipHint: 'staff-thrust' },
  { id: 'punch', preset: 'stick-standard', equipment: null, clipHint: 'punch-right' },
  { id: 'shield', preset: 'stick-sentinel', equipment: 'shield-riot', clipHint: 'shield-bash' },
]
const contactCases: { id: string; preset: string; equipment: string; clip: string; targetZ: number }[] = [
  { id: 'staff', preset: 'stick-tall', equipment: 'staff', clip: 'staff-thrust', targetZ: 6.5 },
  { id: 'shield', preset: 'stick-sentinel', equipment: 'shield-riot', clip: 'shield-bash', targetZ: 5.9 },
  { id: 'sword', preset: 'stick-fighter', equipment: 'sword', clip: 'sword-lunge', targetZ: 5.35 },
]

const checks: Check[] = []
const browserErrors: string[] = []
const captures: Record<string, unknown>[] = []
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
const dispatchBlur = async (page: Page): Promise<void> => { await page.evaluate(() => { window.dispatchEvent(new Event('blur')) }) }

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

async function resetWithInput(page: Page): Promise<void> {
  await dispatch(page, 'reset', true)
  await dispatch(page, 'reset', false)
  await waitReady(page)
  await sleep(120)
}

async function prepareCombat(page: Page, avatar: Avatar = avatarBase, camera: Camera = 'third-person'): Promise<void> {
  await setStage(page, {
    mode: 'combat', districtLayout: 'district', ambientEffects: false, camera, playing: true, speed: 1, motion: 'full', avatar,
  })
  await waitReady(page)
  await resetWithInput(page)
}

async function startAttack(page: Page): Promise<ArtState> {
  await dispatch(page, 'attack', true)
  await dispatch(page, 'attack', false)
  return waitForArt(page, state => state.attack !== null, 700, 'attack start')
}

async function waitForNewContact(page: Page, before: number, timeout = 2200): Promise<ArtState> {
  return waitForArt(page, state => state.contacts.length > before, timeout, 'attack contact')
}

function bufferValue(state: ArtState): number | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(state, 'bufferRemaining')) return undefined
  const value = state.bufferRemaining
  if (value === null || value === undefined) return null
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.NaN
}

function bufferDetail(value: number | null | undefined): number | null | string {
  return value === undefined ? 'missing' : value
}

function vectorMagnitude(value: unknown): number | null {
  if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(item => typeof item === 'number' && Number.isFinite(item))) {
    const [x, y, z] = value as number[]
    return Math.hypot(x, y, z)
  }
  if (!value || typeof value !== 'object') return null
  const object = value as Record<string, unknown>
  const vectorKeys = ['offset', 'displacement', 'travel', 'translation', 'position']
  for (const key of vectorKeys) {
    const result = vectorMagnitude(object[key])
    if (result !== null) return result
  }
  if (['x', 'y', 'z'].every(key => typeof object[key] === 'number' && Number.isFinite(object[key]))) {
    return Math.hypot(object.x as number, object.y as number, object.z as number)
  }
  for (const key of ['magnitude', 'distance', 'length']) if (typeof object[key] === 'number' && Number.isFinite(object[key])) return Math.abs(object[key] as number)
  return null
}

function reactionEvidence(actor: ActorArt | undefined): { magnitude: number | null; settled: boolean | null; raw: unknown } {
  const raw = actor?.reaction
  if (raw === undefined) return { magnitude: null, settled: null, raw: undefined }
  let settled: boolean | null = null
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const object = raw as Record<string, unknown>
    for (const key of ['settled', 'complete', 'done']) if (typeof object[key] === 'boolean') settled = object[key] as boolean
    if (settled === null && typeof object.active === 'boolean') settled = !(object.active as boolean)
    if (settled === null && typeof object.remaining === 'number' && Number.isFinite(object.remaining)) settled = object.remaining <= .01
  }
  return { magnitude: vectorMagnitude(raw), settled, raw }
}

function projectedPoint(value: unknown): Projected | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const object = value as Record<string, unknown>
  if (typeof object.x !== 'number' || typeof object.y !== 'number' || typeof object.depth !== 'number') return null
  if (![object.x, object.y, object.depth].every(Number.isFinite)) return null
  return { x: object.x, y: object.y, depth: object.depth }
}

function equipmentProjection(state: ArtState): Projected | null {
  return projectedPoint(state.equipmentContact) ?? projectedPoint(state.actors[0]?.equipmentContact)
}

function inside(point: Projected | null, width: number, height: number): boolean {
  return point !== null && point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= height && point.depth >= -1 && point.depth <= 1
}

function frameEvidence(state: ArtState, view: View, requiresEquipment: boolean): Record<string, unknown> {
  const joints = Object.values(state.actors[0]?.joints ?? {}).map(projectedPoint).filter((point): point is Projected => point !== null)
  const visible = joints.filter(point => inside(point, view.width, view.height))
  const xValues = visible.map(point => point.x), yValues = visible.map(point => point.y)
  const xSpan = xValues.length ? Math.max(...xValues) - Math.min(...xValues) : 0
  const ySpan = yValues.length ? Math.max(...yValues) - Math.min(...yValues) : 0
  const equipment = equipmentProjection(state)
  const bodyReadable = visible.length >= 4 && Math.max(xSpan, ySpan) > 4
  const equipmentReadable = !requiresEquipment || inside(equipment, view.width, view.height)
  return { viewport: state.viewport, visibleJoints: visible.length, xSpan, ySpan, equipment, bodyReadable, equipmentReadable, pass: state.viewport.width === view.width && state.viewport.height === view.height && bodyReadable && equipmentReadable }
}

async function verifyHeldAttack(page: Page): Promise<Record<string, unknown>> {
  await prepareCombat(page)
  const before = (await artState(page)).contacts.length
  await dispatch(page, 'attack', true)
  await sleep(1100)
  await dispatch(page, 'attack', false)
  await sleep(550)
  const state = await artState(page)
  const contacts = state.contacts.slice(before)
  const pass = contacts.length === 1 && state.attack === null
  addCheck('held attack queues one action only', pass, { contacts, attack: state.attack })
  return { contacts, attack: state.attack }
}

async function verifyBufferExpiry(page: Page): Promise<Record<string, unknown>> {
  await prepareCombat(page)
  const before = (await artState(page)).contacts.length
  await startAttack(page)
  await sleep(35)
  await dispatch(page, 'attack', true)
  await dispatch(page, 'attack', false)
  const queued = await artState(page)
  await sleep(80)
  const mid = await artState(page)
  await sleep(150)
  const expired = await artState(page)
  await sleep(850)
  const final = await artState(page)
  const queuedBuffer = bufferValue(queued), midBuffer = bufferValue(mid), expiredBuffer = bufferValue(expired)
  const bufferPass = queuedBuffer !== undefined && queuedBuffer !== null && Number.isFinite(queuedBuffer) && queuedBuffer > 0 && queuedBuffer <= .18 && midBuffer !== undefined && midBuffer !== null && Number.isFinite(midBuffer) && midBuffer >= 0 && midBuffer <= queuedBuffer && (expiredBuffer === null || (expiredBuffer !== undefined && Number.isFinite(expiredBuffer) && expiredBuffer <= .005))
  const contactPass = final.contacts.length - before === 1
  addCheck('attack buffer starts at 160 ms and expires', bufferPass, { queued: bufferDetail(queuedBuffer), mid: bufferDetail(midBuffer), expired: bufferDetail(expiredBuffer) })
  addCheck('expired attack buffer does not start another action', contactPass, { contacts: final.contacts.slice(before), attack: final.attack })
  return { queuedBuffer: bufferDetail(queuedBuffer), midBuffer: bufferDetail(midBuffer), expiredBuffer: bufferDetail(expiredBuffer), contacts: final.contacts.slice(before), attack: final.attack }
}

async function verifyResetAndBlur(page: Page): Promise<Record<string, unknown>> {
  await prepareCombat(page)
  await startAttack(page)
  await sleep(30)
  await dispatch(page, 'attack', true)
  await dispatch(page, 'attack', false)
  await dispatch(page, 'reset', true)
  await dispatch(page, 'reset', false)
  await sleep(850)
  const resetState = await artState(page)
  const resetBuffer = bufferValue(resetState)
  const resetPass = resetState.contacts.length === 0 && resetState.attack === null && (resetBuffer === null || resetBuffer === undefined || resetBuffer <= .005)
  addCheck('reset cancels active and pending attack state', resetPass, { contacts: resetState.contacts, attack: resetState.attack, buffer: resetBuffer })

  await prepareCombat(page)
  await startAttack(page)
  await sleep(30)
  await dispatch(page, 'attack', true)
  await dispatch(page, 'attack', false)
  await dispatchBlur(page)
  await sleep(1100)
  const blurState = await artState(page)
  const blurBuffer = bufferValue(blurState)
  const blurPass = blurState.contacts.length === 1 && blurState.attack === null && (blurBuffer === null || blurBuffer === undefined || blurBuffer <= .005)
  addCheck('blur cancels pending attack without repeating it', blurPass, { contacts: blurState.contacts, attack: blurState.attack, buffer: blurBuffer })
  return { reset: { contacts: resetState.contacts, attack: resetState.attack, buffer: resetBuffer }, blur: { contacts: blurState.contacts, attack: blurState.attack, buffer: blurBuffer } }
}

async function verifyMissAndContact(page: Page, manifest: Manifest): Promise<Record<string, unknown>> {
  await prepareCombat(page)
  const before = (await artState(page)).contacts.length
  await startAttack(page)
  const state = await waitForNewContact(page, before)
  const contact = state.contacts[before]
  const expected = contact ? manifest.animations.find(animation => animation.id === contact.clip)?.contactTime : undefined
  const timingPass = state.contacts.length - before === 1 && contact !== undefined && expected !== undefined && contact.expectedTime === expected && Math.abs(contact.clipTime - expected) <= 1 / 60 + 1e-6
  const missPass = contact !== undefined && contact.hits === 0 && Number.isFinite(state.impactHold) && state.impactHold <= .005
  addCheck('contact fires once at authored time', timingPass, { contact, expected, contacts: state.contacts.slice(before) })
  addCheck('miss has no hit stop', missPass, { contact, impactHold: state.impactHold })
  return { contact, expected, impactHold: state.impactHold, contacts: state.contacts.slice(before) }
}

async function moveToFirstTarget(page: Page): Promise<ArtState> {
  await dispatch(page, 'forward', true)
  const started = Date.now()
  let state = await artState(page)
  while (Date.now() - started < 1200 && state.body.position.z > 5.8) {
    await sleep(25)
    state = await artState(page)
  }
  await dispatch(page, 'forward', false)
  await sleep(90)
  return artState(page)
}

async function moveToPoint(page: Page, x: number, z: number, timeout = 5000): Promise<ArtState> {
  let active: Action | null = null
  const started = Date.now()
  let state = await artState(page)
  try {
    while (Date.now() - started < timeout) {
      const dx = x - state.body.position.x
      const dz = z - state.body.position.z
      if (Math.hypot(dx, dz) <= .06) break
      const next = Math.abs(dx) > .04 ? (dx > 0 ? 'right' : 'left') : Math.abs(dz) > .04 ? (dz > 0 ? 'back' : 'forward') : null
      if (next !== active) {
        if (active) await dispatch(page, active, false)
        if (next) await dispatch(page, next, true)
        active = next
      }
      await sleep(Math.hypot(dx, dz) < .25 ? 16 : 30)
      state = await artState(page)
    }
  } finally {
    if (active) await dispatch(page, active, false)
  }
  state = await artState(page)
  const distance = Math.hypot(x - state.body.position.x, z - state.body.position.z)
  if (distance > .1) throw new Error(`Movement waypoint was not reached: ${JSON.stringify({ target: { x, z }, position: state.body.position, distance })}`)
  return state
}

async function verifyNearestTargetRanged(page: Page): Promise<Record<string, unknown>> {
  await prepareCombat(page, { ...avatarBase, preset: 'stick-agent', equipment: 'rifle' })
  const before = await artState(page)
  const beforeContactCount = before.contacts.length
  const beforeStats = await auditState(page)
  await startAttack(page)
  const contactState = await waitForNewContact(page, beforeContactCount)
  await sleep(70)
  const state = await artState(page)
  const stats = await auditState(page)
  const contact = contactState.contacts[beforeContactCount]
  const health = state.actors.slice(1).map(actor => typeof actor.health === 'number' && Number.isFinite(actor.health) ? actor.health : null)
  const healthPass = health.length >= 2 && health[0] === 2 && health.slice(1).every(value => value === 3)
  const scorePass = stats.stats?.score === (beforeStats.stats?.score ?? 0) + 10
  const contactPass = contact?.hits === 1
  addCheck('ranged contact damages only the nearest visible target', healthPass && contactPass && scorePass, {
    contact,
    health,
    scoreBefore: beforeStats.stats?.score ?? null,
    scoreAfter: stats.stats?.score ?? null,
  })
  return { contact, health, scoreBefore: beforeStats.stats?.score ?? null, scoreAfter: stats.stats?.score ?? null }
}

async function verifyRangedWallLos(page: Page): Promise<Record<string, unknown>> {
  await prepareCombat(page, { ...avatarBase, preset: 'stick-agent', equipment: 'rifle' })
  // Move around the north edge of the warehouse before descending to its west face.
  await moveToPoint(page, -14.82, 8)
  const waypoint = await moveToPoint(page, -14.82, 2)
  await dispatch(page, 'right', true)
  await sleep(25)
  await dispatch(page, 'right', false)
  await sleep(500)
  const beforeStats = await auditState(page)
  const before = await artState(page)
  const beforeContactCount = before.contacts.length
  await startAttack(page)
  const contactState = await waitForNewContact(page, beforeContactCount)
  const effectSamples: number[] = []
  for (let i = 0; i < 32; i++) {
    await sleep(18)
    effectSamples.push((await auditState(page)).stats?.effects ?? -1)
  }
  const after = await artState(page)
  const afterStats = await auditState(page)
  const contact = contactState.contacts[beforeContactCount]
  const effectsPeak = Math.max(...effectSamples)
  const noHitStop = Number.isFinite(after.impactHold) && after.impactHold <= .005
  const noDamage = contact?.hits === 0 && afterStats.stats?.score === (beforeStats.stats?.score ?? 0)
  // The muzzle burst has expired when the stats callback samples. One active burst then identifies the wall impact.
  const wallStrike = effectsPeak >= 1
  const pass = wallStrike && noHitStop && noDamage
  addCheck('ranged line of sight stops at the warehouse wall', pass, {
    waypoint: waypoint.body.position,
    contact,
    impactHold: after.impactHold,
    scoreBefore: beforeStats.stats?.score ?? null,
    scoreAfter: afterStats.stats?.score ?? null,
    effects: effectSamples,
    effectsPeak,
    trails: after.trails ?? null,
  })
  return { waypoint: waypoint.body.position, contact, impactHold: after.impactHold, scoreBefore: beforeStats.stats?.score ?? null, scoreAfter: afterStats.stats?.score ?? null, effects: effectSamples, effectsPeak, trails: after.trails ?? null }
}

async function verifyHeldContact(page: Page, item: typeof contactCases[number]): Promise<Record<string, unknown>> {
  await prepareCombat(page, { ...avatarBase, preset: item.preset, equipment: item.equipment })
  const primed: Contact[] = []
  if (item.id === 'sword') {
    // Advance the authored sword sequence while out of range, then test lunge with real input.
    for (const expectedClip of ['sword-slash', 'sword-diagonal']) {
      const before = (await artState(page)).contacts.length
      await startAttack(page)
      await waitForArt(page, state => state.attack?.clip === expectedClip, 800, `${expectedClip} selection`)
      const contactState = await waitForNewContact(page, before)
      primed.push(contactState.contacts[before])
      await waitForArt(page, state => state.attack === null, 1200, `${expectedClip} completion`)
    }
  }
  // Keep the staff 1.5 m from the first target. This exceeds unarmed reach.
  const waypoint = await moveToPoint(page, 0, item.targetZ)
  const before = await artState(page)
  const beforeStats = await auditState(page)
  await startAttack(page)
  const contactState = await waitForNewContact(page, before.contacts.length)
  await sleep(70)
  const state = await artState(page)
  const stats = await auditState(page)
  const contact = contactState.contacts[before.contacts.length]
  const targetHealth = typeof state.actors[1]?.health === 'number' ? state.actors[1].health : null
  const pass = contact?.clip === item.clip && contact.hits === 1 && targetHealth === 2 && stats.stats?.score === (beforeStats.stats?.score ?? 0) + 10
  addCheck(`${item.id} held contact damages the target at weapon range`, pass, { waypoint: waypoint.body.position, contact, targetHealth, scoreBefore: beforeStats.stats?.score ?? null, scoreAfter: stats.stats?.score ?? null })
  return { item, waypoint: waypoint.body.position, primed, contact, targetHealth, scoreBefore: beforeStats.stats?.score ?? null, scoreAfter: stats.stats?.score ?? null }
}

async function verifyRecoil(page: Page): Promise<Record<string, unknown>> {
  await prepareCombat(page)
  const moved = await moveToFirstTarget(page)
  const before = moved.contacts.length
  await startAttack(page)
  const samples: { time: number; magnitude: number | null; settled: boolean | null }[] = []
  let contactState = await artState(page)
  const contactStarted = Date.now()
  while (contactState.contacts.length <= before && Date.now() - contactStarted < 2200) {
    await sleep(20)
    contactState = await artState(page)
    const evidence = reactionEvidence(contactState.actors[1])
    samples.push({ time: Date.now() - contactStarted, magnitude: evidence.magnitude, settled: evidence.settled })
  }
  const hit = contactState.contacts.slice(before).find(contact => contact.hits > 0)
  for (let i = 0; i < 48; i++) {
    await sleep(20)
    const state = await artState(page), evidence = reactionEvidence(state.actors[1])
    samples.push({ time: Date.now() - contactStarted, magnitude: evidence.magnitude, settled: evidence.settled })
  }
  const finiteSamples = samples.filter(sample => sample.magnitude !== null && Number.isFinite(sample.magnitude))
  const maximum = finiteSamples.length ? Math.max(...finiteSamples.map(sample => sample.magnitude as number)) : null
  const last = finiteSamples.at(-1)?.magnitude ?? null
  const hasSettled = samples.some(sample => sample.settled === true)
  const pass = hit !== undefined && finiteSamples.length > 0 && maximum !== null && maximum > .05 && maximum <= 1.25 && ((last !== null && last <= .04) || hasSettled)
  addCheck('confirmed hit recoil is bounded and returns', pass, { hit, maximum, last, hasSettled, samples: samples.slice(-8) })
  return { moved: moved.body.position, hit, maximum, last, hasSettled, samples: samples.slice(-12) }
}

async function verifyReducedMotion(page: Page): Promise<Record<string, unknown>> {
  await setStage(page, { mode: 'combat', districtLayout: 'district', ambientEffects: false, camera: 'third-person', playing: true, speed: 1, motion: 'reduced', avatar: avatarBase })
  await waitReady(page)
  await resetWithInput(page)
  await startAttack(page)
  await sleep(650)
  const state = await artState(page)
  const trails = state.trails ?? { active: -1, triangles: -1 }
  const pass = state.motionReduced === true && trails.active === 0 && trails.triangles === 0
  addCheck('reduced motion disables trails', pass, { motionReduced: state.motionReduced, trails })
  return { motionReduced: state.motionReduced, trails }
}

async function verifyOsReducedMotion(page: Page): Promise<Record<string, unknown>> {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  try {
    await setStage(page, { mode: 'combat', districtLayout: 'district', ambientEffects: false, camera: 'third-person', playing: true, speed: 1, motion: 'full', avatar: avatarBase })
    await waitReady(page)
    await resetWithInput(page)
    const before = await artState(page)
    await startAttack(page)
    const contactState = await waitForNewContact(page, before.contacts.length)
    await sleep(420)
    const state = await artState(page)
    const trails = state.trails ?? { active: -1, triangles: -1 }
    const contact = contactState.contacts[before.contacts.length]
    const pass = state.motionReduced === true && trails.active === 0 && trails.triangles === 0 && contact?.hits === 0
    addCheck('OS reduced motion disables trails while preserving contact timing', pass, { motionReduced: state.motionReduced, trails, contact })
    return { motionReduced: state.motionReduced, trails, contact }
  } finally {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
  }
}

async function captureCameraCase(page: Page, item: typeof cameraCases[number], view: View, camera: Camera): Promise<Record<string, unknown>> {
  await page.setViewportSize({ width: view.width, height: view.height })
  await setStage(page, {
    mode: 'combat', districtLayout: 'district', ambientEffects: false, camera, playing: true, speed: 1, motion: 'full',
    avatar: { ...avatarBase, preset: item.preset, equipment: item.equipment },
  })
  await waitReady(page)
  await resetWithInput(page)
  await sleep(100)
  await dispatch(page, 'attack', true)
  await dispatch(page, 'attack', false)
  await sleep(100)
  const state = await artState(page)
  const frame = frameEvidence(state, view, item.equipment !== null)
  const filename = `${item.id}-${view.id}-${camera}.png`
  const path = resolve(screenshotDir, filename)
  await page.screenshot({ path })
  const bytes = (await stat(path)).size
  const runtime = await auditState(page)
  const pass = frame.pass === true && !runtime.stats?.loading && !runtime.stats?.error && bytes > 1000
  addCheck(`${filename}: mounted action is framed`, pass, { frame, bytes, error: runtime.stats?.error ?? null })
  const result = { item: item.id, clipHint: item.clipHint, view, camera, file: filename, bytes, frame, attack: state.attack, trails: state.trails ?? null }
  captures.push(result)
  return result
}

const manifest = JSON.parse(await readFile(resolve('public/assets/manifest.json'), 'utf8')) as Manifest
await mkdir(screenshotDir, { recursive: true })
const result: Record<string, unknown> = { url: baseUrl, checks, browserErrors, captures }
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`))
  page.on('console', message => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) browserErrors.push(`console: ${message.text()}`) })
  page.on('response', response => {
    const url = new URL(response.url())
    if (response.status() >= 400 && !url.pathname.endsWith('/favicon.ico')) browserErrors.push(`HTTP ${response.status()} ${response.url()}`)
  })
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await waitReady(page)
  const initial = await auditState(page)
  addCheck('audit page is ready', Boolean(initial.stats && !initial.stats.loading && !initial.stats.error), initial.stats)
  result.heldAttack = await verifyHeldAttack(page)
  result.buffer = await verifyBufferExpiry(page)
  result.resetBlur = await verifyResetAndBlur(page)
  result.contactMiss = await verifyMissAndContact(page, manifest)
  result.rangedNearest = await verifyNearestTargetRanged(page)
  result.heldContacts = []
  for (const item of contactCases) (result.heldContacts as unknown[]).push(await verifyHeldContact(page, item))
  result.rangedWallLos = await verifyRangedWallLos(page)
  result.recoil = await verifyRecoil(page)
  result.reducedMotion = await verifyReducedMotion(page)
  result.osReducedMotion = await verifyOsReducedMotion(page)
  for (const item of cameraCases) for (const view of views) for (const camera of cameras) await captureCameraCase(page, item, view, camera)
} catch (error) {
  browserErrors.push(error instanceof Error ? error.stack ?? error.message : String(error))
} finally {
  await browser.close()
}

const errorFree = browserErrors.length === 0
addCheck('browser reports no page, console, or HTTP errors', errorFree, browserErrors)
result.checks = checks
result.browserErrors = browserErrors
result.captures = captures
result.pass = checks.every(check => check.pass) && errorFree
result.generatedAt = new Date().toISOString()
await writeFile(outputFile, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify({ pass: result.pass, checks: checks.length, failed: checks.filter(check => !check.pass).map(check => check.name), browserErrors }, null, 2))
if (!result.pass) process.exitCode = 1

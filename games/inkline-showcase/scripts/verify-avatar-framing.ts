import { chromium, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DEFAULT_AVATAR, type AvatarConfig, type StageSettings } from '../src/types'

type Projected = { x: number; y: number; depth: number }
type JointMap = Record<string, Projected>
type ActorArt = { clip?: string; joints?: JointMap; position?: [number, number, number] }
type ArtState = {
  viewport: { width: number; height: number }
  equipmentContact?: Projected | null
  actors: ActorArt[]
  [key: string]: unknown
}
type AuditStats = { loading: boolean; error: string | null; elapsed: number }
type AuditState = { stats: AuditStats | null; settings: StageSettings }
type AuditApi = { set(patch: Partial<StageSettings>): void; state(): AuditState; artState(): ArtState }
type Check = { name: string; pass: boolean; details?: unknown }
type View = { id: 'desktop' | 'phone'; width: number; height: number }
type BodyProfile = { id: string; preset: string; equipment: string; height: number; thickness: number; headScale: number }
type AnimationCase = { id: string; body: string; equipment: string; height: number; thickness: number; headScale: number }
type PreviewCamera = StageSettings['camera']

const baseUrl = process.env.INKLINE_AUDIT_URL ?? 'http://localhost:5197/audit.html'
const outputFile = resolve('docs/verification/kinetic/avatar-framing.json')
const imageDir = resolve('docs/verification/kinetic/avatar-framing')
const views: View[] = [
  { id: 'desktop', width: 1440, height: 900 },
  { id: 'phone', width: 390, height: 844 },
]
const extremes: Array<Pick<BodyProfile, 'height' | 'thickness' | 'headScale'>> = [
  { height: .85, thickness: .7, headScale: .8 },
  { height: 1.15, thickness: 1.3, headScale: 1.2 },
]
const bodyProfiles: BodyProfile[] = extremes.flatMap((size, index) => [
  { id: `standard-${index === 0 ? 'small' : 'large'}-shield`, preset: 'stick-standard', equipment: 'shield-riot', ...size },
  { id: `tall-${index === 0 ? 'small' : 'large'}-staff`, preset: 'stick-tall', equipment: 'staff', ...size },
  { id: `heavy-${index === 0 ? 'small' : 'large'}-sword`, preset: 'stick-heavy', equipment: 'sword', ...size },
])
const animations: AnimationCase[] = [
  { id: 'sword-overhead', body: 'stick-heavy', equipment: 'sword', ...extremes[1] },
  { id: 'staff-spin', body: 'stick-tall', equipment: 'staff', ...extremes[0] },
  { id: 'rifle-fire', body: 'stick-standard', equipment: 'rifle', ...extremes[1] },
]
const previewCameras: PreviewCamera[] = ['perspective', 'side', 'top', 'third-person']
const checks: Check[] = []
const browserErrors: string[] = []
const captures: Array<Record<string, unknown>> = []
const sleep = (milliseconds: number): Promise<void> => new Promise(resolvePromise => setTimeout(resolvePromise, milliseconds))
const auditState = (page: Page): Promise<AuditState> => page.evaluate(() => (window as unknown as { inklineAudit: AuditApi }).inklineAudit.state())
const artState = (page: Page): Promise<ArtState> => page.evaluate(() => (window as unknown as { inklineAudit: AuditApi }).inklineAudit.artState())
const setStage = (page: Page, patch: Partial<StageSettings>): Promise<void> => page.evaluate(value => {
  (window as unknown as { inklineAudit: AuditApi }).inklineAudit.set(value)
}, patch)

function addCheck(name: string, pass: boolean, details?: unknown): void {
  checks.push({ name, pass, ...(details === undefined ? {} : { details }) })
  if (!pass) console.error(`FAIL ${name}`, details ?? '')
}

async function waitReady(page: Page, timeout = 35000): Promise<void> {
  await page.waitForFunction(() => Boolean((window as unknown as { inklineAudit?: AuditApi }).inklineAudit), undefined, { timeout: 20000 })
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

async function waitForArt(page: Page, equipment: string | null, timeout = 5000): Promise<ArtState> {
  const started = Date.now()
  let last = await artState(page)
  while (Date.now() - started < timeout) {
    const actor = last.actors[0]
    const ready = actor && Object.keys(actor.joints ?? {}).length >= 11 && (!equipment || last.equipmentContact !== null && last.equipmentContact !== undefined)
    if (ready) return last
    await sleep(40)
    last = await artState(page)
  }
  throw new Error(`Avatar art did not become ready: ${JSON.stringify(last)}`)
}

function finitePoint(point: unknown): point is Projected {
  if (!point || typeof point !== 'object' || Array.isArray(point)) return false
  const value = point as Record<string, unknown>
  return ['x', 'y', 'depth'].every(key => typeof value[key] === 'number' && Number.isFinite(value[key]))
}

function pointInside(point: Projected, viewport: { width: number; height: number }, margin = 2): boolean {
  return point.x >= margin && point.x <= viewport.width - margin && point.y >= margin && point.y <= viewport.height - margin && point.depth > -1 && point.depth < 1
}

function frameEvidence(state: ArtState, equipment: string | null): Record<string, unknown> {
  const viewport = state.viewport
  const actor = state.actors[0]
  const joints = Object.values(actor?.joints ?? {})
  const finiteJoints = joints.filter(finitePoint)
  const insideJoints = finiteJoints.filter(point => pointInside(point, viewport))
  const xValues = finiteJoints.map(point => point.x)
  const yValues = finiteJoints.map(point => point.y)
  const xSpan = xValues.length ? Math.max(...xValues) - Math.min(...xValues) : 0
  const ySpan = yValues.length ? Math.max(...yValues) - Math.min(...yValues) : 0
  const contact = finitePoint(state.equipmentContact) ? state.equipmentContact : null
  const contactInside = equipment === null || (contact !== null && pointInside(contact, viewport, 3))
  const bodyInside = finiteJoints.length >= 11 && insideJoints.length === finiteJoints.length
  const recognizable = xSpan > 8 && ySpan > 20
  return {
    viewport,
    clip: actor?.clip ?? null,
    jointCount: finiteJoints.length,
    visibleJointCount: insideJoints.length,
    xSpan,
    ySpan,
    bodyInside,
    equipment,
    equipmentContact: contact,
    equipmentContactInside: contactInside,
    recognizable,
  }
}

function framePass(evidence: Record<string, unknown>): boolean {
  return evidence.bodyInside === true && evidence.equipmentContactInside === true && evidence.recognizable === true
}

async function capture(page: Page, filename: string): Promise<string> {
  const path = resolve(imageDir, filename)
  await page.screenshot({ path })
  return filename
}

async function verifyAvatarProfile(page: Page, profile: BodyProfile, view: View): Promise<void> {
  await page.setViewportSize({ width: view.width, height: view.height })
  await setStage(page, {
    mode: 'avatars', camera: 'perspective', playing: true, speed: 1, seek: null, motion: 'full',
    avatar: { ...DEFAULT_AVATAR, preset: profile.preset, equipment: profile.equipment, height: profile.height, thickness: profile.thickness, headScale: profile.headScale },
  })
  await waitReady(page)
  const state = await waitForArt(page, profile.equipment)
  await sleep(160)
  const final = await artState(page)
  const evidence = frameEvidence(final, profile.equipment)
  const pass = framePass(evidence)
  const filename = `avatar-${profile.id}-${view.id}.png`
  const file = await capture(page, filename)
  addCheck(`${profile.id}/${view.id}: avatar and held equipment remain framed`, pass, evidence)
  captures.push({ kind: 'avatar', profile, view, file, evidence })
  void state
}

async function verifyAnimation(page: Page, item: AnimationCase, view: View): Promise<void> {
  await page.setViewportSize({ width: view.width, height: view.height })
  await setStage(page, {
    mode: 'animations', animationId: item.id, camera: 'perspective', playing: true, speed: 1, seek: null, motion: 'full',
    avatar: { ...DEFAULT_AVATAR, preset: item.body, equipment: item.equipment, height: item.height, thickness: item.thickness, headScale: item.headScale },
  })
  await waitReady(page)
  await waitForArt(page, item.equipment)
  const samples: Array<Record<string, unknown>> = []
  const started = Date.now()
  let previousElapsed = -1
  let elapsedIncreased = false
  let framePasses = true
  let screenshotFile = ''
  let failureFile = ''
  while (Date.now() - started < 750) {
    const state = await artState(page)
    const current = await auditState(page)
    const evidence = frameEvidence(state, item.equipment)
    const elapsed = current.stats?.elapsed ?? 0
    framePasses &&= framePass(evidence)
    if (!framePass(evidence) && !failureFile) failureFile = await capture(page, `animation-${item.id}-${view.id}-failure-${Math.round(elapsed * 1000)}ms.png`)
    if (elapsed > previousElapsed + .01) elapsedIncreased = true
    previousElapsed = elapsed
    samples.push({ elapsed, evidence })
    if (!screenshotFile && elapsed >= .25) screenshotFile = await capture(page, `animation-${item.id}-${view.id}.png`)
    await sleep(45)
  }
  if (!screenshotFile) screenshotFile = await capture(page, `animation-${item.id}-${view.id}.png`)
  const final = samples[samples.length - 1]?.evidence ?? null
  const activeClip = samples.some(sample => (sample.evidence as Record<string, unknown>).clip === item.id)
  const pass = framePasses && elapsedIncreased && activeClip && !((await auditState(page)).stats?.error)
  addCheck(`${item.id}/${view.id}: normal-speed animation stays framed`, pass, { item, screenshotFile, failureFile: failureFile || null, elapsedIncreased, activeClip, samples: samples.length, final })
  captures.push({ kind: 'animation', item, view, file: screenshotFile, failureFile: failureFile || null, elapsedIncreased, activeClip, samples })
}

async function verifySwordPreviewCamera(page: Page, camera: PreviewCamera, view: View): Promise<void> {
  const item = animations[0]
  await page.setViewportSize({ width: view.width, height: view.height })
  await setStage(page, {
    mode: 'animations', animationId: item.id, camera, playing: true, speed: 1, seek: null, motion: 'full',
    avatar: { ...DEFAULT_AVATAR, preset: item.body, equipment: item.equipment, height: item.height, thickness: item.thickness, headScale: item.headScale },
  })
  await waitReady(page)
  await waitForArt(page, item.equipment)
  const samples: Array<Record<string, unknown>> = []
  const started = Date.now()
  let previousElapsed = -1
  let elapsedIncreased = false
  let framePasses = true
  let screenshotFile = ''
  let failureFile = ''
  while (Date.now() - started < 900) {
    const state = await artState(page)
    const current = await auditState(page)
    const evidence = frameEvidence(state, item.equipment)
    const elapsed = current.stats?.elapsed ?? 0
    framePasses &&= framePass(evidence)
    if (!framePass(evidence) && !failureFile) failureFile = await capture(page, `preview-${camera}-${view.id}-failure-${Math.round(elapsed * 1000)}ms.png`)
    if (elapsed > previousElapsed + .01) elapsedIncreased = true
    previousElapsed = elapsed
    samples.push({ elapsed, evidence })
    if (!screenshotFile && elapsed >= .25) screenshotFile = await capture(page, `preview-${camera}-${view.id}.png`)
    await sleep(45)
  }
  if (!screenshotFile) screenshotFile = await capture(page, `preview-${camera}-${view.id}.png`)
  const activeClip = samples.some(sample => (sample.evidence as Record<string, unknown>).clip === item.id)
  const pass = framePasses && elapsedIncreased && activeClip && !((await auditState(page)).stats?.error)
  addCheck(`sword-overhead/${camera}/${view.id}: full preview cycle stays framed`, pass, { camera, view, screenshotFile, failureFile: failureFile || null, elapsedIncreased, activeClip, samples: samples.length, final: samples[samples.length - 1]?.evidence ?? null })
  captures.push({ kind: 'preview-camera-cycle', item, camera, view, file: screenshotFile, failureFile: failureFile || null, elapsedIncreased, activeClip, samples })
}

async function verifyWheelThenRefit(page: Page, view: View): Promise<void> {
  const sword: AvatarConfig = { ...DEFAULT_AVATAR, preset: 'stick-heavy', equipment: 'sword', ...extremes[1] }
  await page.setViewportSize({ width: view.width, height: view.height })
  await setStage(page, { mode: 'animations', animationId: 'sword-overhead', camera: 'side', playing: true, speed: 1, seek: null, motion: 'full', avatar: sword })
  await waitReady(page)
  await waitForArt(page, sword.equipment)
  const before = frameEvidence(await artState(page), sword.equipment)
  const canvas = page.locator('#stage canvas')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('The audit canvas is missing.')
  await page.mouse.move(box.x + box.width * .5, box.y + box.height * .5)
  await page.mouse.wheel(0, -650)
  await sleep(140)
  const zoomed = frameEvidence(await artState(page), sword.equipment)
  const zoomChanged = Number(zoomed.ySpan) > Number(before.ySpan) * 1.05 || Number(zoomed.xSpan) > Number(before.xSpan) * 1.05
  const zoomFile = await capture(page, `zoom-${view.id}-sword.png`)

  await setStage(page, { animationId: 'sword-lunge' })
  await waitReady(page)
  await waitForArt(page, sword.equipment)
  const afterClip = frameEvidence(await artState(page), sword.equipment)
  const clipFile = await capture(page, `zoom-reset-${view.id}-sword-lunge.png`)
  const clipPass = framePass(afterClip)

  const staff: AvatarConfig = { ...sword, equipment: 'staff' }
  await setStage(page, { animationId: 'staff-spin', avatar: staff })
  await waitReady(page)
  await waitForArt(page, staff.equipment)
  const afterGear = frameEvidence(await artState(page), staff.equipment)
  const gearFile = await capture(page, `zoom-reset-${view.id}-staff-spin.png`)
  const gearPass = framePass(afterGear)

  addCheck(`side/${view.id}: wheel zoom changes scale and clip change refits all points`, zoomChanged && clipPass, { before, zoomed, zoomChanged, afterClip, clipFile, zoomFile })
  addCheck(`side/${view.id}: wheel zoom also refits after equipment change`, zoomChanged && gearPass, { before, zoomed, zoomChanged, afterGear, gearFile, zoomFile })
  captures.push({ kind: 'wheel-refit', view, zoomFile, clipFile, gearFile, before, zoomed, zoomChanged, afterClip, afterGear })
}

await mkdir(imageDir, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`))
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('favicon.ico')) browserErrors.push(`console: ${message.text()}`) })
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) browserErrors.push(`HTTP ${response.status()} ${response.url()}`) })
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await waitReady(page)
  for (const view of views) for (const profile of bodyProfiles) await verifyAvatarProfile(page, profile, view)
  for (const view of views) for (const item of animations) await verifyAnimation(page, item, view)
  for (const view of views) for (const camera of previewCameras) await verifySwordPreviewCamera(page, camera, view)
  for (const view of views) await verifyWheelThenRefit(page, view)
} catch (error) {
  browserErrors.push(error instanceof Error ? error.stack ?? error.message : String(error))
} finally {
  await browser.close()
}

addCheck('browser reports no page, console, or HTTP errors', browserErrors.length === 0, browserErrors)
const result = {
  url: baseUrl,
  validRanges: { height: [.85, 1.15], thickness: [.7, 1.3], headScale: [.8, 1.2] },
  checks,
  captures,
  browserErrors,
  pass: checks.every(check => check.pass) && browserErrors.length === 0,
  generatedAt: new Date().toISOString(),
}
await writeFile(outputFile, `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify({ pass: result.pass, checks: checks.length, failed: checks.filter(check => !check.pass).map(check => check.name), browserErrors }, null, 2))
if (!result.pass) process.exitCode = 1

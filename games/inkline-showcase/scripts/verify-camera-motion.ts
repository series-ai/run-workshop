import { chromium, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { StageSettings } from '../src/types'

export type CameraArt = ReturnType<Window['inklineAudit']['artState']>
export const cameraEvidenceDirectory = 'docs/verification/correction'
export const cameraModes: StageSettings['camera'][] = ['side', 'top', 'third-person', 'perspective']
export function cameraPoseEvidence(art: CameraArt) {
  const actor = art.actors[0]
  const geometricBlocked = Object.entries(actor.blocked).filter(([, value]) => value).map(([key]) => key)
  const outside = Object.entries(actor.joints).filter(([, p]) => ![p.x, p.y, p.depth].every(Number.isFinite) || p.x < 0 || p.x > art.viewport.width || p.y < 0 || p.y > art.viewport.height || p.depth <= -1 || p.depth >= 1).map(([key]) => key)
  return { geometricBlocked, blocked: actor.blocked, outside, joints: actor.joints, camera: art.camera }
}
export async function cameraSourceHashes() {
  const hashes: Record<string, string> = {}
  const snapshot = process.env.INKLINE_AUDIT_SNAPSHOT_DIR
  const files = snapshot
    ? (await readdir(snapshot, { recursive: true })).filter(file => file === 'audit.html' || file === 'assets/manifest.json' || file.endsWith('.js') || file.endsWith('.glb')).sort().map(file => `${snapshot}/${file}`)
    : ['src/runtime/camera.ts', 'src/runtime/cutaway.ts', 'src/runtime/renderer.ts', 'src/runtime/assets.ts', 'src/runtime/presentation.ts', 'src/components/UIInspector.tsx', 'src/components/UIAnimationPlayer.tsx', 'public/assets/manifest.json', ...(await readdir('public/assets', { recursive: true })).filter(file => file.endsWith('.glb')).sort().map(file => `public/assets/${file}`)]
  for (const file of files) hashes[file] = createHash('sha256').update(await readFile(file)).digest('hex')
  return hashes
}

interface PixelProbe { name: string; x: number; y: number; pixels: number }
interface PixelResult { pass: boolean; radius: number; probes: PixelProbe[]; bounds: number[] | null; missing: string[] }
/** The screenshot is the visibility evidence. Geometric obstruction remains a separate measurement. */
export async function captureCameraPixels(page: Page, name: string) {
  await mkdir(cameraEvidenceDirectory, { recursive: true })
  const playing = await page.evaluate(() => window.inklineAudit.state().settings.playing)
  await page.evaluate(() => window.inklineAudit.set({ playing: false }))
  await page.waitForTimeout(100)
  try {
    const art = await page.evaluate(() => window.inklineAudit.artState())
    const path = `${cameraEvidenceDirectory}/camera-${name}.png`
    await page.locator('#stage canvas').screenshot({ path, scale: 'css' })
    const pixels = JSON.parse(execFileSync('python3', ['-c', `
import json, math, sys
from PIL import Image
request = json.load(sys.stdin)
im = Image.open(request['path']).convert('RGB')
joints = request['joints']
points = dict(joints)
for a, b in [('Chest', 'Hips'), ('Forearm_L', 'Hand_L'), ('Forearm_R', 'Hand_R'), ('Shin_L', 'Foot_L'), ('Shin_R', 'Foot_R')]:
    points[a + '/' + b] = {k: (joints[a][k] + joints[b][k]) / 2 for k in ['x', 'y']}
height = max(p['y'] for p in joints.values()) - min(p['y'] for p in joints.values())
radius = max(2, min(6, height * .025))
def black(x, y):
    rgb = im.getpixel((x, y))
    return max(rgb) <= 55 and max(rgb) - min(rgb) <= 15
probes = []
for name, p in points.items():
    count = sum(black(x,y) for y in range(max(0, math.floor(p['y']-radius)), min(im.height, math.ceil(p['y']+radius)+1)) for x in range(max(0, math.floor(p['x']-radius)), min(im.width, math.ceil(p['x']+radius)+1)) if (x-p['x'])**2+(y-p['y'])**2 <= radius**2)
    probes.append({'name': name, 'x': p['x'], 'y': p['y'], 'pixels': count})
pad = max(8, height * .2)
left = max(0, math.floor(min(p['x'] for p in joints.values())-pad))
right = min(im.width, math.ceil(max(p['x'] for p in joints.values())+pad))
top = max(0, math.floor(min(p['y'] for p in joints.values())-pad))
bottom = min(im.height, math.ceil(max(p['y'] for p in joints.values())+pad))
ink = [(x,y) for y in range(top,bottom) for x in range(left,right) if black(x,y)]
bounds = [min(p[0] for p in ink), min(p[1] for p in ink), max(p[0] for p in ink), max(p[1] for p in ink)] if ink else None
missing = [p['name'] for p in probes if p['pixels'] < 3]
inside = bounds is not None and bounds[0] > 0 and bounds[1] > 0 and bounds[2] < im.width-1 and bounds[3] < im.height-1
print(json.dumps({'pass': not missing and inside, 'radius': radius, 'probes': probes, 'bounds': bounds, 'missing': missing}))
`], { input: JSON.stringify({ path, joints: art.actors[0].joints }), encoding: 'utf8' })) as PixelResult
    const pose = cameraPoseEvidence(art)
    return { pass: pixels.pass && !pose.outside.length, screenshot: path, ...pose, pixels }
  } finally { await page.evaluate(playing => window.inklineAudit.set({ playing }), playing) }
}

export async function walkCameraRoute(page: Page, checkpoint: (index: number) => Promise<void> = async () => {}) {
  const active = new Set<string>()
  const input = (action: string, pressed: boolean) => page.evaluate(detail => window.dispatchEvent(new CustomEvent('inkline-input', { detail })), { action, pressed })
  const waypoints = [[[0, 9]], [[4, 9], [4, 4.5]], [[4, -.5]], [[4, -4.5]], [[0, -7]]]
  try {
    for (const [index, points] of waypoints.entries()) {
      let waypoint = 0
      const start = Date.now()
      while (true) {
        const state = await page.evaluate(() => window.inklineAudit.artState())
        if (state.checkpoint > index) break
        if (Date.now() - start > 12000) throw new Error(`Route checkpoint ${index + 1} timed out at ${JSON.stringify(state.body.position)}.`)
        const [x, z] = points[waypoint], dx = x - state.body.position.x, dz = z - state.body.position.z
        if (Math.max(Math.abs(dx), Math.abs(dz)) <= .14 && waypoint < points.length - 1) {
          for (const action of active) await input(action, false)
          active.clear(); waypoint++; continue
        }
        const next = new Set<string>()
        if (Math.abs(dx) > .14) next.add(dx > 0 ? 'right' : 'left')
        if (Math.abs(dz) > .14) next.add(dz > 0 ? 'back' : 'forward')
        for (const action of active) if (!next.has(action)) await input(action, false)
        for (const action of next) if (!active.has(action)) await input(action, true)
        active.clear(); next.forEach(action => active.add(action))
        await page.waitForTimeout(Math.hypot(dx, dz) < .5 ? 20 : 80)
      }
      for (const action of active) await input(action, false)
      active.clear()
      await checkpoint(index + 1)
    }
  } finally { for (const action of active) await input(action, false) }
}

async function main() {
  const url = process.env.INKLINE_AUDIT_URL ?? 'http://localhost:5197/audit.html'
  const sourceSHA256 = await cameraSourceHashes()
  const browser = await chromium.launch({ headless: true, channel: 'chromium' })
  const checks: { name: string; pass: boolean; details: unknown }[] = [], errors: string[] = []
  try {
    const page = await browser.newPage()
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.goto(url)
    await page.waitForFunction(() => window.inklineAudit?.state().stats?.loading === false)
    const input = (action: string, pressed: boolean) => page.evaluate(detail => window.dispatchEvent(new CustomEvent('inkline-input', { detail })), { action, pressed })
    for (const view of [{ id: 'desktop', width: 1440, height: 900 }, { id: 'phone', width: 390, height: 844 }]) {
      await page.setViewportSize(view)
      for (const motion of ['full', 'reduced'] as const) for (const camera of cameraModes) {
        const name = `${view.id}/${motion}/${camera}`
        await page.evaluate(({ camera, motion }) => { const api = window.inklineAudit; api.set({ mode: 'combat', camera, playing: true, speed: 1, motion, ambientEffects: false, avatar: { ...api.state().settings.avatar, color: '#151716', headwear: 'none', equipment: null }, reset: api.state().settings.reset + 1 }) }, { camera, motion })
        await page.waitForFunction(() => !window.inklineAudit.state().stats?.loading)
        await input('forward', true); await page.waitForTimeout(300); await input('forward', false)
        await page.waitForTimeout(500)
        await page.evaluate(() => window.inklineAudit.set({ playing: false }))
        await page.waitForTimeout(2200)
        const first = await page.evaluate(() => window.inklineAudit.artState())
        await page.waitForTimeout(500)
        const last = await page.evaluate(() => window.inklineAudit.artState())
        const drift = Math.hypot(...last.camera.position.map((value, index) => value - first.camera.position[index]))
        checks.push({ name: `${name}: paused camera settles`, pass: drift < .002, details: { drift, first: first.camera, last: last.camera } })
        const pixels = await captureCameraPixels(page, `motion-${view.id}-${motion}-${camera}-standing`)
        checks.push({ name: `${name}: standing pixels`, pass: pixels.pass, details: pixels })
        await page.evaluate(() => window.inklineAudit.set({ playing: true }))
        const samples = await page.evaluate(async () => {
          const rows: { time: number; art: ReturnType<Window['inklineAudit']['artState']> }[] = []
          const start = performance.now()
          window.dispatchEvent(new CustomEvent('inkline-input', { detail: { action: 'jump', pressed: true } }))
          window.dispatchEvent(new CustomEvent('inkline-input', { detail: { action: 'jump', pressed: false } }))
          while (performance.now() - start < 1500) {
            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
            rows.push({ time: performance.now(), art: window.inklineAudit.artState() })
          }
          return rows
        })
        const trace = samples.map((sample, index) => {
          const prior = samples[Math.max(0, index - 1)]
          const dt = (sample.time - prior.time) / 1000
          const step = Math.hypot(...sample.art.camera.position.map((v, i) => v - prior.art.camera.position[i]))
          const yaw = (art: CameraArt) => Math.atan2(art.camera.position[0] - art.camera.target[0], art.camera.position[2] - art.camera.target[2])
          const turn = yaw(sample.art) - yaw(prior.art)
          return { time: sample.time, height: sample.art.body.position.y, step, speed: dt > 0 ? step / dt : 0, headingChange: Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))), ...cameraPoseEvidence(sample.art) }
        })
        const failures = trace.filter(sample => sample.outside.length || !Number.isFinite(sample.speed) || sample.speed > 22 || sample.headingChange > .02)
        checks.push({ name: `${name}: jump framing and continuity`, pass: trace.length >= 10 && Math.max(...trace.map(sample => sample.height)) - Math.min(...trace.map(sample => sample.height)) > .1 && !failures.length, details: { samples: trace, failures } })
      }
      await page.evaluate(() => { const api = window.inklineAudit; api.set({ mode: 'combat', camera: 'third-person', playing: true, motion: 'full', reset: api.state().settings.reset + 1 }) })
      await page.waitForFunction(() => !window.inklineAudit.state().stats?.loading)
      const captureObstruction = async (location: string) => {
        const obstructedViews: string[] = []
        await page.waitForTimeout(1200)
        await page.evaluate(() => window.inklineAudit.set({ playing: false }))
        for (const camera of cameraModes) {
          await page.evaluate(camera => window.inklineAudit.set({ camera }), camera)
          await page.waitForTimeout(2200)
          const pixels = await captureCameraPixels(page, `motion-${view.id}-${camera}-${location}`)
          checks.push({ name: `${view.id}/${camera}: ${location} pixels`, pass: pixels.pass, details: pixels })
          if (pixels.geometricBlocked.length) obstructedViews.push(camera)
        }
        checks.push({ name: `${view.id}: ${location} exercises geometry obstruction`, pass: obstructedViews.length > 0, details: { obstructedViews } })
        await page.evaluate(() => window.inklineAudit.set({ camera: 'third-person', playing: true }))
      }
      await captureObstruction('rail')
      await page.evaluate(() => { const api = window.inklineAudit; api.set({ mode: 'parkour', camera: 'third-person', playing: true, motion: 'full', reset: api.state().settings.reset + 1 }) })
      await page.waitForFunction(() => !window.inklineAudit.state().stats?.loading)
      await walkCameraRoute(page, async checkpoint => {
        if (checkpoint === 5) await captureObstruction('low-ceiling')
      })
    }
  } catch (error) { errors.push(String(error)) }
  finally { await browser.close() }
  await mkdir(cameraEvidenceDirectory, { recursive: true })
  const pass = checks.every(check => check.pass) && checks.length === 68 && !errors.length
  await writeFile(`${cameraEvidenceDirectory}/camera-motion.json`, JSON.stringify({ checkedAt: new Date().toISOString(), url, sourceSHA256, visibilityScope: 'Rendered pixels at named checkpoints. Continuous samples check framing and camera motion. Raw geometry obstruction does not include the cutaway shader.', pass, checks, errors }, null, 2) + '\n')
  console.log(JSON.stringify({ pass, checks: checks.length, failures: checks.filter(check => !check.pass).map(check => check.name), errors }, null, 2))
  if (!pass) process.exitCode = 1
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main()

import { execFileSync } from 'node:child_process'
import { chromium, type Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { DEFAULT_AVATAR } from '../../../src/types'
const folder = 'docs/verification/correction/camera-reactions'
await mkdir(folder, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const errors: string[] = [], checks: { name: string; pass: boolean; details: unknown }[] = []
const input = (page: Page, action: string, pressed: boolean) => page.evaluate(detail => window.dispatchEvent(new CustomEvent('inkline-input', { detail })), { action, pressed })
const art = (page: Page) => page.evaluate(() => window.inklineAudit.artState())
async function moveTo(page: Page, x: number, z: number) {
  for (const [axis, value, negative, positive] of [['x', x, 'left', 'right'], ['z', z, 'forward', 'back']] as const) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const error = value - (await art(page)).body.position[axis]
      if (Math.abs(error) < .05) break
      const action = error < 0 ? negative : positive
      await input(page, action, true); await page.waitForTimeout(Math.min(60, Math.max(14, Math.abs(error) * 180))); await input(page, action, false)
    }
  }
  const position = (await art(page)).body.position
  if (Math.hypot(position.x - x, position.z - z) > .12) throw new Error(`Movement failed: ${JSON.stringify(position)}`)
}
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(process.env.INKLINE_AUDIT_URL ?? 'http://localhost:5197/audit.html')
  await page.waitForFunction(() => window.inklineAudit?.state().stats?.loading === false)
  const cases = [
    { name: 'rear', x: 0, z: 5.82, face: ['forward'], hit: ['hit-back'], death: 'death', force: [0, -1] },
    { name: 'front', x: 0, z: 4.18, face: ['back'], hit: ['hit-front'], death: 'knockdown', force: [0, 1] },
    { name: 'left', x: .82, z: 5, face: ['left'], hit: ['hit-left'], death: 'death', force: [-1, 0] },
    { name: 'right', x: -.82, z: 5, face: ['right'], hit: ['hit-right'], death: 'death', force: [1, 0] },
    { name: 'rear-left', x: .58, z: 5.58, face: ['left', 'forward'], hit: ['hit-back', 'hit-left'], death: 'death', force: [-Math.SQRT1_2, -Math.SQRT1_2] },
    { name: 'front-right', x: -.58, z: 4.42, face: ['right', 'back'], hit: ['hit-front', 'hit-right'], death: 'knockdown', force: [Math.SQRT1_2, Math.SQRT1_2] },
  ]
  for (const item of cases.filter(item => ['front', 'rear'].includes(item.name))) {
    await page.evaluate(avatar => { const api = window.inklineAudit; api.set({ mode: 'combat', camera: 'perspective', playing: true, motion: 'reduced', avatar, reset: api.state().settings.reset + 1 }) }, { ...DEFAULT_AVATAR, equipment: null, headwear: 'none' as const })
    await page.waitForFunction(() => window.inklineAudit.state().stats?.loading === false)
    await moveTo(page, item.x, item.z)
    for (const action of item.face) await input(page, action, true)
    await page.waitForTimeout(20)
    for (const action of item.face) await input(page, action, false)
    let sample: Awaited<ReturnType<typeof art>> | undefined
    for (let strike = 0; strike < 3; strike++) {
      const health = (await art(page)).actors[1].health
      await input(page, 'attack', true); await page.waitForTimeout(20); await input(page, 'attack', false)
      await page.waitForFunction(health => window.inklineAudit.artState().actors[1].health < health, health, { timeout: 2500 })
      sample = await art(page)
      if (strike === 0) checks.push({ name: `${item.name}: nonlethal direction`, pass: item.hit.includes(sample.actors[1].clip), details: sample.actors[1] })
      if (strike < 2) { await page.waitForFunction(() => !window.inklineAudit.artState().attack); await page.waitForTimeout(550) }
    }
    const rows = [sample!]
    for (let frame = 0; frame < 32; frame++) { await page.waitForTimeout(45); rows.push(await art(page)) }
    const last = rows.at(-1)!.actors[1]
    const head = last.worldJoints.Head!, hips = last.worldJoints.Hips!
    const fallenDirection = (head[0] - hips[0]) * item.force[0] + (head[2] - hips[2]) * item.force[1]
    checks.push({ name: `${item.name}: head falls with impact`, pass: fallenDirection > .12 && head[1] < .65, details: { fallenDirection, head, hips, rows } })
    const travel = rows.map(row => row.actors[1].reaction.magnitude)
    checks.push({ name: `${item.name}: landing displacement persists`, pass: last.reaction.kind === 'fall' && Math.min(...travel.slice(-10)) > .4, details: travel })
    await page.evaluate(() => window.inklineAudit.set({ playing: false }))
    await page.screenshot({ path: `${folder}/${item.name}-landed.png` })
    if (item.name === 'front' || item.name === 'rear') {
      await page.evaluate(() => window.inklineAudit.set({ camera: 'side' }))
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${folder}/${item.name}-side.png` })
      const state = await art(page)
      const pixels = JSON.parse(execFileSync('python3', ['-c', `
import json,sys,math
from PIL import Image
r=json.load(sys.stdin); im=Image.open(r['file']).convert('RGB'); probes=[]
for name,p in r['joints'].items():
 count=0
 for y in range(max(0,math.floor(p['y']-4)),min(im.height,math.ceil(p['y']+4))):
  for x in range(max(0,math.floor(p['x']-4)),min(im.width,math.ceil(p['x']+4))):
   red,g,b=im.getpixel((x,y))
   if (x-p['x'])**2+(y-p['y'])**2<=16 and red>140 and red>g*1.6 and g>b: count+=1
 probes.append({'name':name,'pixels':count})
print(json.dumps({'probes':probes,'pass':all(p['pixels']>=3 for p in probes)}))
`], {input:JSON.stringify({file:`${folder}/${item.name}-side.png`,joints:state.actors[1].joints}),encoding:'utf8'}))
      checks.push({name:`${item.name}: side target pixels`,pass:pixels.pass,details:{pixels,state}})
    }
    await page.evaluate(() => window.inklineAudit.set({ playing: true }))
    const recovery = item.death === 'death' ? 'get-up-forward' : 'get-up'
    await page.waitForFunction(recovery => window.inklineAudit.artState().actors[1].clip === recovery, recovery, { timeout: 3500 })
    const recovering = (await art(page)).actors[1]
    checks.push({ name: `${item.name}: recovery matches the landing pose`, pass: recovering.clip === recovery, details: recovering })
    await page.waitForFunction(() => window.inklineAudit.artState().actors[1].clip === 'block', undefined, { timeout: 2500 })
    checks.push({ name: `${item.name}: recovers`, pass: (await art(page)).actors[1].health === 3, details: (await art(page)).actors[1] })
  }
} finally { await browser.close() }
const pass = checks.every(check => check.pass) && !errors.length
await writeFile(`${folder}/report.json`, JSON.stringify({ checkedAt: new Date().toISOString(), pass, checks, errors }, null, 2) + '\n')
console.log(JSON.stringify({ pass, checks: checks.length, failures: checks.filter(check => !check.pass).map(check => check.name), errors }, null, 2))
if (!pass) process.exitCode = 1

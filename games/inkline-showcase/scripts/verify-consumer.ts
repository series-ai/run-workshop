import { chromium } from '@playwright/test'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const output = 'docs/verification/kinetic/consumer.json'
const source = 'dist-pack/run-inkline/3D/characters/Source'
const sourceSHA256: Record<string, string> = {}
const runtimeFiles = (await readdir(`${source}/runtime`)).filter(file => file.endsWith('.ts') || file === 'firearms.json').sort().map(file => `runtime/${file}`)
for (const file of [...runtimeFiles, 'types.ts', 'manifest.json']) sourceSHA256[file] = createHash('sha256').update(await readFile(`${source}/${file}`)).digest('hex')
execFileSync(resolve('node_modules/.bin/tsc'), ['--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'ESNext', '--moduleResolution', 'Bundler', '--resolveJsonModule', '--allowSyntheticDefaultImports', '--lib', 'ES2022,DOM', `${source}/runtime/index.ts`], { stdio: 'inherit' })
await mkdir('.cache/consumer-check', { recursive: true })
await writeFile('.cache/consumer-check/index.html', '<!doctype html><html lang="en"><meta charset="utf-8"><link rel="icon" href="data:,"><title>INKLINE exported runtime check</title><style>body{margin:0;background:#eeece5}canvas{display:block}</style><body><script type="module" src="./check.js"></script></body></html>')
await writeFile('.cache/consumer-check/check.js', `
import * as THREE from 'three'
import { AssetLibrary, applyAvatar, animationBounds, mountEquipment, supportEquipment, disposeInstance, createDistrict, InkEffects, InkTrails, getImpactProfile, sampleRecoil, stepActionBuffer } from '/${source}/runtime/index.ts'
import { DEFAULT_AVATAR } from '/${source}/types.ts'
const checks = []
const check = (name, pass, details) => { checks.push({name,pass,details}); if (!pass) throw new Error(name) }
const renderer = new THREE.WebGLRenderer({antialias:true})
renderer.setSize(960,600); document.body.appendChild(renderer.domElement)
const scene = new THREE.Scene(); scene.background = new THREE.Color('#eeece5')
const camera = new THREE.PerspectiveCamera(38,960/600,.05,180)
camera.position.set(4,3,7); camera.lookAt(0,1,0)
const packURL = new URL('/dist-pack/run-inkline/', location.href)
let library, effects, trails
try {
 const response = await fetch(new URL('3D/characters/Source/manifest.json', packURL))
 if (!response.ok) throw new Error('Exported catalog did not load')
 const manifest = await response.json()
 library = new AssetLibrary(manifest, packURL)
 for (const entry of manifest.models.filter(model=>model.kind==='character')) {
  const actor = await library.create(entry.id), rifle = await library.create('rifle')
  applyAvatar(actor.root,{...DEFAULT_AVATAR,preset:entry.id,height:.85,thickness:1.3,headScale:1.2,headwear:'cap',equipment:'rifle'})
  mountEquipment(actor.root,rifle,actor.clips,manifest.animations); scene.add(actor.root)
  const mixer = new THREE.AnimationMixer(actor.root)
  mixer.clipAction(actor.clips.find(clip=>clip.name==='rifle-fire')).play()
  let finite = true, handError = 0
  for(let frame=0;frame<24;frame++) {
   mixer.update(1/60); supportEquipment(actor.root,rifle.root,'rifle-fire'); actor.root.updateMatrixWorld(true)
   actor.root.traverse(object=>{finite &&= object.matrixWorld.elements.every(Number.isFinite)})
   const grip = new THREE.Vector3(0,-.015,.19).applyMatrix4(rifle.root.matrixWorld)
   const palm = new THREE.Vector3(0,.04,0).applyMatrix4(actor.root.getObjectByName('Hand_L').matrixWorld)
   handError = Math.max(handError,grip.distanceTo(palm)); renderer.render(scene,camera)
  }
  check(entry.id+': copied loader, avatar, animation, and support grip',finite && handError<.07 && actor.clips.length===manifest.animations.length,{finite,handError,clips:actor.clips.length})
  mixer.stopAllAction(); mixer.uncacheRoot(actor.root); disposeInstance(actor.root)
 }
 for (const body of ['stick-standard','stick-tall','stick-heavy']) {
  const actor = await library.create(body), staff = await library.create('staff')
  mountEquipment(actor.root,staff,actor.clips,manifest.animations)
  const clip = actor.clips.find(clip=>clip.name==='staff-thrust')
  const entry = manifest.animations.find(clip=>clip.id==='staff-thrust')
  const mixer = new THREE.AnimationMixer(actor.root)
  mixer.clipAction(clip).play(); mixer.setTime(entry.contactTime); actor.root.updateMatrixWorld(true)
  const axis = new THREE.Vector3(0,1,0).transformDirection(staff.root.matrixWorld)
  const before = actor.root.getObjectByName('Hand_R').matrixWorld.clone()
  const bounds = animationBounds(actor.root,clip,entry.contactTime)
  const unchanged = before.elements.every((value,index)=>value===actor.root.getObjectByName('Hand_R').matrixWorld.elements[index])
  check(body+': copied staff calibration and full-clip bounds',axis.z>.999 && !bounds.isEmpty() && unchanged,{axis:axis.toArray(),bounds:[bounds.min.toArray(),bounds.max.toArray()],livePoseUnchanged:unchanged})
  mixer.stopAllAction();mixer.uncacheRoot(actor.root);disposeInstance(actor.root)
 }
 for(const layout of ['district','service-yard','roof-works']) {
  const district = await createDistrict(library,false,layout); scene.add(district.root)
  const bounds = new THREE.Box3().setFromObject(district.root)
  renderer.render(scene,camera)
  check(layout+': copied scene assembly',!bounds.isEmpty() && [...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite),{bounds:[bounds.min.toArray(),bounds.max.toArray()]})
  district.clearance.dispose(); disposeInstance(district.root)
 }
 effects = new InkEffects(128); scene.add(effects.group)
 effects.trigger('landing-dust',new THREE.Vector3(0,0,0))
 effects.update(.1,camera); renderer.render(scene,camera)
 check('copied dust shader renders',effects.activeCount>0 && renderer.info.render.calls>0,{particles:effects.activeCount,calls:renderer.info.render.calls})
 trails = new InkTrails(); scene.add(trails.group)
 trails.line(0,new THREE.Vector3(-9,1,0),new THREE.Vector3(9,1,0),new THREE.Vector3(0,.018,0),0,'#151716',.075)
 trails.update(.02); renderer.render(scene,camera)
 check('copied long shot trace keeps both endpoints',trails.triangleCount===4,{triangles:trails.triangleCount})
 trails.update(.08); effects.update(2,camera)
 check('copied effects and trails expire',trails.activeCount===0 && effects.activeCount===0,{trails:trails.activeCount,particles:effects.activeCount})
 const profile = getImpactProfile('punch-heavy','unarmed')
 check('copied action helpers work',sampleRecoil(profile,profile.recoilDuration).done && stepActionBuffer(.16,.01,true).consume,{duration:profile.recoilDuration})
 window.inklineConsumer={pass:true,checks,packVersion:manifest.version}
} catch(error) { window.inklineConsumer={pass:false,checks,error:String(error)} }
finally { effects?.dispose(); trails?.dispose(); library?.dispose(); renderer.dispose() }
`)
const browser = await chromium.launch({ headless: true, channel: 'chromium' })
const errors: string[] = []
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(`${process.env.INKLINE_CONSUMER_URL ?? 'http://localhost:5197'}/.cache/consumer-check/index.html`)
  await page.waitForFunction(() => Boolean((window as unknown as { inklineConsumer?: unknown }).inklineConsumer), undefined, { timeout: 60000 })
  const result = await page.evaluate(() => (window as unknown as { inklineConsumer: { pass: boolean; checks: unknown[]; error?: string; packVersion: string } }).inklineConsumer)
  const report = { checkedAt: new Date().toISOString(), sourceSHA256, exportedRuntimeTypecheck: true, ...result, errors, pass: result.pass && errors.length === 0 }
  await mkdir('docs/verification/kinetic', { recursive: true })
  await writeFile(output, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
  if (!report.pass) process.exitCode = 1
} finally { await browser.close() }

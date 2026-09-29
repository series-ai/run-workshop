import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { mountEquipment, supportEquipment, disposeInstance } from '../src/runtime/assets'
import firearms from '../src/runtime/firearms.json'
import type { AnimationEntry, ModelEntry } from '../src/types'

const base = process.argv[2] ?? 'public/assets'
const output = process.argv[3] ?? 'docs/verification/gun-height/gun-height.json'
const baseline = process.argv[4] ?? '.cache/gun-height-baseline'
const hashes: Record<string, string> = {}
async function bytes(path: string) {
  const data = await readFile(path)
  hashes[path] = createHash('sha256').update(data).digest('hex')
  return data
}
async function load(path: string) {
  const data = await bytes(path)
  return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')
}
const catalog = JSON.parse((await bytes(`${base}/characters.json`)).toString()) as { models: ModelEntry[]; animations: AnimationEntry[] }
const props = JSON.parse((await bytes('public/assets/props.json')).toString()) as { models: ModelEntry[] }
for (const path of ['scripts/blender/characters.py', 'scripts/verify-gun-height.ts', 'src/runtime/assets.ts', 'src/runtime/firearms.json', `${baseline}/characters.json`]) await bytes(path)
const checks: { body: string; weapon: string; clip: string; name: string; pass: boolean; value: unknown }[] = []
const preservation: { body: string; clip: string; maximumValueChange: number; maximumTimeChange: number; layoutMatches: boolean; pass: boolean }[] = []
const protectedClips = ['block', 'punch-left', 'punch-right', 'punch-heavy', 'uppercut', 'kick-front', 'kick-roundhouse', 'kick-air']

for (const body of catalog.models.filter(model => !process.argv[5] || model.id === process.argv[5])) {
  const actor = await load(`${base}/characters/${body.id}.glb`)
  const prior = await load(`${baseline}/characters/${body.id}.glb`)
  for (const id of protectedClips) {
    const before = prior.animations.find(clip => clip.name === id)!, after = actor.animations.find(clip => clip.name === id)!
    let layoutMatches = before.tracks.length === after.tracks.length
    let maximumValueChange = 0, maximumTimeChange = Math.abs(before.duration - after.duration)
    for (const track of before.tracks) {
      const next = after.tracks.find(value => value.name === track.name)
      if (!next || next.times.length !== track.times.length || next.values.length !== track.values.length) { layoutMatches = false; continue }
      for (let index = 0; index < track.times.length; index++) maximumTimeChange = Math.max(maximumTimeChange, Math.abs(track.times[index] - next.times[index]))
      for (let index = 0; index < track.values.length; index++) maximumValueChange = Math.max(maximumValueChange, Math.abs(track.values[index] - next.values[index]))
    }
    preservation.push({ body: body.id, clip: id, maximumValueChange, maximumTimeChange, layoutMatches,
      pass: layoutMatches && maximumValueChange < .00001 && maximumTimeChange < .000001 })
  }
  disposeInstance(prior.scene)
  const mixer = new THREE.AnimationMixer(actor.scene)
  const bone = (name: string) => actor.scene.getObjectByName(name)!
  const point = (name: string) => bone(name).getWorldPosition(new THREE.Vector3())
  const bend = (side: string) => THREE.MathUtils.radToDeg(point(`Forearm_${side}`).sub(point(`UpperArm_${side}`))
    .angleTo(point(`Hand_${side}`).sub(point(`Forearm_${side}`))))
  for (const weapon of ['rifle', 'shotgun'] as const) {
    const gun = await load(`public/assets/props/${weapon}.glb`)
    mountEquipment(actor.scene, { root: gun.scene, clips: gun.animations, entry: props.models.find(model => model.id === weapon)! }, actor.animations, catalog.animations)
    const armRatio = gun.scene.scale.x / firearms.weapons[weapon].scale
    for (const id of weapon === 'rifle' ? ['rifle-idle', 'rifle-fire', 'rifle-reload'] : ['rifle-idle', 'shotgun-fire']) {
      mixer.stopAllAction()
      const clip = actor.animations.find(value => value.name === id)!
      const action = mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = true; action.play()
      let minimumHeightFraction = Infinity, maximumHeightFraction = -Infinity, maximumStockGap = 0
      let minimumRightBend = Infinity, minimumLeftBend = Infinity, maximumSupportGap = 0, samples = 0
      for (let tick = 0; tick <= Math.ceil(clip.duration * 120); tick++) {
        const time = Math.min(tick / 120, clip.duration)
        action.paused = false; action.time = time; mixer.update(0); actor.scene.updateMatrixWorld(true)
        supportEquipment(actor.scene, gun.scene, id, time); actor.scene.updateMatrixWorld(true)
        const hips = point('Hips'), shoulder = point('UpperArm_R')
        const stock = new THREE.Vector3().fromArray(firearms.weapons[weapon].stock).applyMatrix4(gun.scene.matrixWorld)
        const height = (stock.y - hips.y) / (shoulder.y - hips.y)
        minimumHeightFraction = Math.min(minimumHeightFraction, height); maximumHeightFraction = Math.max(maximumHeightFraction, height)
        const anchor = hips.clone().lerp(shoulder, firearms.stockTorsoFraction)
        anchor.x += firearms.stockLateralOffset * armRatio
        maximumStockGap = Math.max(maximumStockGap, stock.distanceTo(anchor))
        minimumRightBend = Math.min(minimumRightBend, bend('R'))
        if (id !== 'rifle-reload') {
          minimumLeftBend = Math.min(minimumLeftBend, bend('L'))
          const grip = new THREE.Vector3().fromArray(firearms.weapons[weapon].support)
          const pump = gun.scene.getObjectByName('shotgun-pump')
          if (pump) grip.z += pump.position.z - (pump.userData.firearmPumpRest as number[])[2]
          grip.applyMatrix4(gun.scene.matrixWorld)
          const palm = new THREE.Vector3(0, firearms.palmOffset, 0).applyMatrix4(bone('Hand_L').matrixWorld)
          maximumSupportGap = Math.max(maximumSupportGap, grip.distanceTo(palm))
        }
        samples++
      }
      const check = (name: string, pass: boolean, value: unknown) => checks.push({ body: body.id, weapon, clip: id, name, pass, value })
      // The height band is independent of the shared mount target.
      check('stock stays at lower chest height', minimumHeightFraction > .5 && maximumHeightFraction < .7,
        { minimumHeightFraction, maximumHeightFraction, samples })
      check('stock stays near its body contact', maximumStockGap < .045 * armRatio, { maximumStockGap, armRatio, samples })
      check('trigger arm retains elbow bend', minimumRightBend >= 15, { minimumBendDegrees: minimumRightBend, samples })
      if (id !== 'rifle-reload') {
        check('support arm retains elbow bend', minimumLeftBend >= 15, { minimumBendDegrees: minimumLeftBend, samples })
        check('support palm stays on the grip', maximumSupportGap < .01 * armRatio, { maximumSupportGap, samples })
      }
    }
    mixer.stopAllAction(); disposeInstance(gun.scene)
  }
  mixer.uncacheRoot(actor.scene); disposeInstance(actor.scene)
}
const failures = [...checks.filter(check => !check.pass), ...preservation.filter(check => !check.pass)]
const pass = checks.length > 0 && failures.length === 0
await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(), pass, sampleRate: 120, hashes,
  scope: 'Mounted gun height, elbow bend, and support contact through complete clips. The reload support hand is free. Block, punches, and kicks retain their exported tracks.',
  checks, preservation, failures }, null, 2) + '\n')
console.log(JSON.stringify({ pass, bodies: new Set(checks.map(check => check.body)).size, checks: checks.length, preservedClips: preservation.length, failures }))
if (!pass) process.exitCode = 1

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { mountEquipment, supportEquipment, disposeInstance } from '../src/runtime/assets'
import firearms from '../src/runtime/firearms.json'
import { parseManifest } from '../src/catalog'

const assets = process.argv[2] ?? 'public/assets'
const output = process.argv[3] ?? 'docs/verification/polish/firearm-quality.json'
const propAssets = process.argv[4] ?? 'public/assets'
const characters = JSON.parse(await readFile(`${assets}/characters.json`, 'utf8'))
const props = JSON.parse(await readFile(`${propAssets}/props.json`, 'utf8'))
const published = parseManifest(JSON.parse(await readFile('public/assets/manifest.json', 'utf8')))
const bodyIds = new Set<string>(characters.models.map((model: { id: string }) => model.id))
const otherBodies = published.models.filter(model => model.kind === 'character' && !bodyIds.has(model.id))
const catalog = parseManifest({ version: 'firearm-check', animations: characters.animations, models: [...characters.models, ...otherBodies, ...props.models] })
const checks: { body: string; weapon: string; clip: string; time: number; test: string; pass: boolean; values: Record<string, number | string> }[] = []
const hashes: Record<string, string> = {}
async function bytes(path: string) {
  const buffer = await readFile(path)
  hashes[path] = createHash('sha256').update(buffer).digest('hex')
  return buffer
}
async function load(path: string) {
  const buffer = await bytes(path)
  return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '')
}
for (const path of ['src/runtime/assets.ts', 'src/runtime/firearms.json', `${assets}/characters.json`, `${propAssets}/props.json`]) await bytes(path)
for (const body of catalog.models.filter(model => bodyIds.has(model.id) && (!process.argv[5] || model.id === process.argv[5]))) {
  for (const weapon of ['rifle', 'shotgun'] as const) {
    const actor = await load(`${assets}/characters/${body.id}.glb`)
    const gun = await load(`${propAssets}/props/${weapon}.glb`)
    const record = (clip: string, time: number, test: string, pass: boolean, values: Record<string, number | string>) => checks.push({ body: body.id, weapon, clip, time, test, pass, values })
    try {
      mountEquipment(actor.scene, { root: gun.scene, clips: gun.animations, entry: catalog.models.find(model => model.id === weapon)! }, actor.animations, catalog.animations)
    } catch (error) {
      record('mount', 0, 'required firearm parts', false, { error: String(error) })
      disposeInstance(actor.scene); disposeInstance(gun.scene)
      continue
    }
    const mixer = new THREE.AnimationMixer(actor.scene)
    const bone = (name: string) => actor.scene.getObjectByName(name)!
    const world = (name: string) => bone(name).getWorldPosition(new THREE.Vector3())
    const localPoint = (point: number[]) => new THREE.Vector3().fromArray(point).applyMatrix4(gun.scene.matrixWorld)
    const pose = (clip: string, time: number) => {
      mixer.stopAllAction()
      const action = mixer.clipAction(actor.animations.find(value => value.name === clip)!).setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = true; action.play(); action.time = time; mixer.update(0)
      actor.scene.updateMatrixWorld(true)
    }
    const arm = ['UpperArm_L', 'Forearm_L', 'Hand_L'].map(bone)
    const armRatio = gun.scene.scale.x / firearms.weapons[weapon].scale
    for (const clip of weapon === 'rifle' ? ['rifle-idle', 'rifle-fire', 'rifle-reload'] : ['rifle-idle', 'shotgun-fire']) {
      const entry = catalog.animations.find(value => value.id === clip)!
      const samples = new Set([0, entry.duration, entry.duration / 2, ...(entry.contactTime === undefined ? [] : [entry.contactTime])])
      const recoilTime = clip === 'rifle-fire' ? 4 / 30 : clip === 'shotgun-fire' ? 5 / 30 : undefined
      if (recoilTime !== undefined) samples.add(recoilTime)
      if (clip === 'rifle-reload') for (const frame of [firearms.reload.reachFrame, firearms.reload.withdrawFrame, firearms.reload.insertFrame]) samples.add(frame / 30)
      if (clip === 'shotgun-fire') for (const frame of [10, 15, 19]) samples.add(frame / firearms.pump.fps)
      for (const time of [...samples].sort((a, b) => a - b)) {
        pose(clip, time)
        const authored = arm.map(value => value.quaternion.clone())
        supportEquipment(actor.scene, gun.scene, clip, time)
        actor.scene.updateMatrixWorld(true)
        const axis = new THREE.Vector3(0, 0, 1).transformDirection(gun.scene.matrixWorld)
        const stock = localPoint(firearms.weapons[weapon].stock)
        const shoulder = world('UpperArm_R')
        const hips = world('Hips')
        const anchor = hips.clone().lerp(shoulder, firearms.stockTorsoFraction)
        anchor.x += firearms.stockLateralOffset * armRatio
        const stockDistance = stock.distanceTo(anchor)
        const torsoHeight = (stock.y - hips.y) / (shoulder.y - hips.y)
        const pump = gun.scene.getObjectByName('shotgun-pump')
        const pumpOffset = pump ? pump.position.z - pump.userData.firearmPumpRest[2] : 0
        const target = [...firearms.weapons[weapon].support]; target[2] += pumpOffset
        const palm = new THREE.Vector3(0, firearms.palmOffset, 0).applyMatrix4(arm[2].matrixWorld)
        const gap = palm.distanceTo(localPoint(target))
        const middleReload = clip === 'rifle-reload' && time > entry.duration * firearms.reload.releaseEnd && time < entry.duration * firearms.reload.returnStart
        if (middleReload) {
          const change = Math.max(...arm.flatMap((value, index) => value.quaternion.toArray().map((component, axis) => Math.abs(component - authored[index].toArray()[axis]))))
          record(clip, time, 'free reload hand', change < 1e-10 && gap > .06 * armRatio, { quaternionChange: change, palmGap: gap })
        } else {
          record(clip, time, 'support palm contact', gap < .01 * armRatio, { palmGap: gap })
        }
        record(clip, time, 'lower chest stock position', stockDistance < .045 * armRatio && torsoHeight > .5 && torsoHeight < .7, { stockDistance, torsoHeight, armRatio })
        if (time === 0 || time === entry.contactTime) record(clip, time, 'forward aim', axis.z > .99 && Math.abs(axis.y) < Math.sin(5 * Math.PI / 180) && Math.abs(axis.x) < Math.sin(5 * Math.PI / 180), { pitchDegrees: Math.asin(axis.y) * 180 / Math.PI, yawDegrees: Math.atan2(axis.x, axis.z) * 180 / Math.PI })
        if (time === recoilTime) {
          const pitch = Math.asin(axis.y) * 180 / Math.PI, yaw = Math.atan2(axis.x, axis.z) * 180 / Math.PI
          record(clip, time, 'bounded recoil after contact', time > (entry.contactTime ?? Infinity) && pitch > 1 && pitch < (weapon === 'rifle' ? 8 : 15) && Math.abs(yaw) < 3, { pitchDegrees: pitch, yawDegrees: yaw })
        }
        if (pump) {
          const bounds = new THREE.Box3().setFromObject(pump)
          record(clip, time, 'palm touches pump mesh', bounds.distanceToPoint(palm) < .01 * armRatio, { meshGap: bounds.distanceToPoint(palm) })
          const expected = clip === 'shotgun-fire' && Math.abs(time - firearms.pump.rearFrame / firearms.pump.fps) < 1e-6 ? firearms.pump.travel : clip === 'shotgun-fire' && time > firearms.pump.startFrame / firearms.pump.fps && time < firearms.pump.returnFrame / firearms.pump.fps ? undefined : 0
          if (expected !== undefined) record(clip, time, 'pump travel', Math.abs(pumpOffset - expected) < 1e-6, { pumpOffset, expected })
          const before = pump.position.clone()
          supportEquipment(actor.scene, gun.scene, clip, time)
          record(clip, time, 'pump has no drift', before.distanceTo(pump.position) < 1e-10, { repeatMovement: before.distanceTo(pump.position) })
        }
        const magazine = gun.scene.getObjectByName('rifle-magazine')
        if (magazine) {
          const reload = firearms.reload, frame = time * 30
          const rest = new THREE.Vector3().fromArray(magazine.userData.firearmMagazineRest)
          const held = clip === 'rifle-reload' && frame >= reload.reachFrame && frame <= reload.insertFrame
          if (held) {
            const center = new THREE.Box3().setFromObject(magazine).getCenter(new THREE.Vector3())
            record(clip, time, 'hand holds magazine mesh', center.distanceTo(palm) < .01 * armRatio, { magazinePalmGap: center.distanceTo(palm) })
          }
          if (held && Math.abs(frame - reload.withdrawFrame) < 1e-6) {
            const expected = rest.clone().add(new THREE.Vector3().fromArray(reload.withdrawal))
            record(clip, time, 'magazine withdraws with hand', magazine.position.distanceTo(expected) < .01, { withdrawalError: magazine.position.distanceTo(expected) })
          } else if (!held || Math.abs(frame - reload.reachFrame) < 1e-6 || Math.abs(frame - reload.insertFrame) < 1e-6) {
            record(clip, time, 'magazine seats without a jump', magazine.position.distanceTo(rest) < .001, { restError: magazine.position.distanceTo(rest) })
          }
          const before = magazine.position.clone()
          supportEquipment(actor.scene, gun.scene, clip, time)
          record(clip, time, 'magazine has no drift', before.distanceTo(magazine.position) < 1e-10, { repeatMovement: before.distanceTo(magazine.position) })
        }
      }
    }
    if (weapon === 'shotgun') {
      pose('shotgun-fire', .5); supportEquipment(actor.scene, gun.scene, 'shotgun-fire', .5)
      pose('rifle-idle', 0); supportEquipment(actor.scene, gun.scene, 'rifle-idle', 0)
      const pump = gun.scene.getObjectByName('shotgun-pump')!
      record('rifle-idle', 0, 'pump resets on clip change', Math.abs(pump.position.z - pump.userData.firearmPumpRest[2]) < 1e-10, { pumpOffset: pump.position.z - pump.userData.firearmPumpRest[2] })
    } else {
      const time = firearms.reload.withdrawFrame / 30
      pose('rifle-reload', time); supportEquipment(actor.scene, gun.scene, 'rifle-reload', time)
      pose('rifle-idle', 0); supportEquipment(actor.scene, gun.scene, 'rifle-idle', 0)
      const magazine = gun.scene.getObjectByName('rifle-magazine')!
      const restError = magazine.position.distanceTo(new THREE.Vector3().fromArray(magazine.userData.firearmMagazineRest))
      record('rifle-idle', 0, 'magazine resets on clip change', restError < 1e-10, { restError })
    }
    mixer.stopAllAction(); mixer.uncacheRoot(actor.scene); disposeInstance(actor.scene)
  }
}
const pass = checks.length > 0 && checks.every(check => check.pass)
await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(), pass, hashes, checks }, null, 2) + '\n')
console.log(JSON.stringify({ pass, checks: checks.length, failures: checks.filter(check => !check.pass) }))
if (!pass) process.exitCode = 1

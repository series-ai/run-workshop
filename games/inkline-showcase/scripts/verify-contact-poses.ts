import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile } from 'node:fs/promises'
import { equipmentContactPoint, mountEquipment } from '../src/runtime/assets'
import type { PackManifest } from '../src/types'

const manifest = JSON.parse(await readFile('public/assets/manifest.json', 'utf8')) as PackManifest
const checks: { name: string; pass: boolean; value: unknown }[] = []
const check = (name: string, pass: boolean, value: unknown) => checks.push({ name, pass, value })
async function load(id: string) {
  const entry = manifest.models.find(model => model.id === id)!
  const bytes = await readFile(`public/${entry.file}`)
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  return { root: gltf.scene, clips: gltf.animations, entry }
}
const cases = [
  ['stick-tall', 'staff', 'staff-thrust'],
  ['stick-scout', 'dagger', 'dagger-stab'],
  ['stick-fighter', 'sword', 'sword-lunge'],
  ['stick-sentinel', 'shield-riot', 'shield-bash'],
  ['stick-sentinel', 'shield-riot', 'shield-block'],
  ['stick-sentinel', 'shield-riot', 'shield-slam'],
  ['stick-sentinel', 'shield-riot', 'shield-push'],
  ['stick-standard', null, 'knee-strike'],
] as const
for (const [body, gear, id] of cases) {
  const actor = await load(body)
  const weapon = gear ? await load(gear) : null
  if (weapon) mountEquipment(actor.root, weapon, actor.clips, manifest.animations)
  const entry = manifest.animations.find(clip => clip.id === id)!
  if (entry.contactTime === undefined) throw new Error(`${id}: no contact time`)
  const mixer = new THREE.AnimationMixer(actor.root)
  mixer.clipAction(actor.clips.find(clip => clip.name === id)!).play()
  mixer.setTime(entry.contactTime)
  actor.root.updateMatrixWorld(true)
  if (weapon) {
    const up = new THREE.Vector3(0, 1, 0).transformDirection(weapon.root.matrixWorld)
    const front = new THREE.Vector3(0, 0, 1).transformDirection(weapon.root.matrixWorld)
    if (gear === 'shield-riot') {
      check(`${id}: shield stays upright`, up.y > .8, up.toArray())
      check(`${id}: shield faces forward`, front.z > .8, front.toArray())
    } else check(`${id}: weapon points forward`, up.z > .9 && Math.abs(up.y) < .3, up.toArray())
  }
  if (id === 'knee-strike') {
    const knee = actor.root.getObjectByName('Shin_R')!.getWorldPosition(new THREE.Vector3())
    const ankle = actor.root.getObjectByName('Foot_R')!.getWorldPosition(new THREE.Vector3())
    check(`${id}: knee leads the folded lower leg`, knee.y > ankle.y && knee.z > ankle.z + .1, { knee: knee.toArray(), ankle: ankle.toArray() })
  }
  mixer.stopAllAction(); mixer.uncacheRoot(actor.root)
}
for (const body of manifest.models.filter(model => model.kind === 'character')) {
  const actor = await load(body.id), sword = await load('sword')
  mountEquipment(actor.root, sword, actor.clips, manifest.animations)
  const clip = manifest.animations.find(clip => clip.id === 'sword-overhead')!
  const mixer = new THREE.AnimationMixer(actor.root)
  mixer.clipAction(actor.clips.find(action => action.name === clip.id)!).play()
  mixer.setTime(clip.contactTime!)
  actor.root.updateMatrixWorld(true)
  const tip = equipmentContactPoint(sword.root)
  const base = sword.root.localToWorld(new THREE.Vector3(...sword.root.userData.contactBase as [number, number, number]))
  const hips = actor.root.getObjectByName('Hips')!.getWorldPosition(new THREE.Vector3())
  check(`${body.id}: overhead cut reaches forward at body height`,
    tip.z - hips.z > .65 && tip.z - base.z > .7 && tip.y / body.dimensions[1] > .2 && tip.y / body.dimensions[1] < .8,
    { tip: tip.toArray(), base: base.toArray(), hips: hips.toArray() })
  mixer.setTime(Math.max(0, clip.contactTime! - .2)); actor.root.updateMatrixWorld(true)
  const raised = equipmentContactPoint(sword.root)
  check(`${body.id}: overhead cut descends from preparation`, raised.y > tip.y + .35, { raised: raised.toArray(), contact: tip.toArray() })
  mixer.stopAllAction(); mixer.uncacheRoot(actor.root)
}
for (const body of manifest.models.filter(model => model.kind === 'character')) {
  for (const mountTime of [0, .15, .333]) {
    const actor = await load(body.id), staff = await load('staff')
    const mixer = new THREE.AnimationMixer(actor.root)
    const clip = manifest.animations.find(clip => clip.id === 'staff-thrust')!
    mixer.clipAction(actor.clips.find(action => action.name === clip.id)!).play()
    mixer.setTime(mountTime)
    mountEquipment(actor.root, staff, actor.clips, manifest.animations)
    mixer.setTime(clip.contactTime!); actor.root.updateMatrixWorld(true)
    const axis = new THREE.Vector3(0, 1, 0).transformDirection(staff.root.matrixWorld)
    check(`${body.id}: staff points forward after attachment at ${mountTime}s`, axis.z > .999 && Math.abs(axis.y) < .01 && Math.abs(axis.x) < .01, axis.toArray())
    mixer.stopAllAction(); mixer.uncacheRoot(actor.root)
  }
}
const pass = checks.every(check => check.pass)
await writeFile('docs/verification/expansion/contact-poses.json', JSON.stringify({ checkedAt: new Date().toISOString(), pass, checks }, null, 2) + '\n')
console.log(JSON.stringify({ pass, checks: checks.length, failures: checks.filter(check => !check.pass) }, null, 2))
if (!pass) process.exitCode = 1

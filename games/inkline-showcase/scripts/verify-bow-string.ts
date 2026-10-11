import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { animationBounds, applyAvatar, disposeInstance, mountEquipment, supportEquipment } from '../src/runtime/assets'
import { DEFAULT_AVATAR, type AnimationEntry, type ModelEntry } from '../src/types'

const assets = resolve(process.argv[2] ?? 'public/assets')
const output = process.argv[3] ?? 'docs/verification/correction/bow-string.json'
const catalog = JSON.parse(await readFile(resolve(assets, 'characters.json'), 'utf8')) as { models: ModelEntry[]; animations: AnimationEntry[] }
const props = JSON.parse(await readFile('public/assets/props.json', 'utf8')) as { models: ModelEntry[] }
const entry = props.models.find(model => model.id === 'bow')!
const release = catalog.animations.find(clip => clip.id === 'bow-release')!.contactTime!
const checks: { name: string; pass: boolean; value: unknown }[] = []
async function load(path: string) {
  const bytes = await readFile(path)
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
}
for (const body of catalog.models) {
  const actor = await load(resolve(assets, 'characters', `${body.id}.glb`)), bow = await load('public/assets/props/bow.glb')
  applyAvatar(actor.scene, { ...DEFAULT_AVATAR, preset: body.id, height: 1.15, thickness: 1.3, headScale: 1.2 })
  mountEquipment(actor.scene, { root: bow.scene, clips: bow.animations, entry }, actor.animations, catalog.animations)
  const string = bow.scene.getObjectByName('bow-string') as THREE.Mesh
  if (!string) throw new Error('Missing named bow string mesh')
  const original = string.geometry
  const rest = [...original.getAttribute('position').array]
  const mixer = new THREE.AnimationMixer(actor.scene)
  for (const id of ['bow-draw', 'bow-release']) {
    mixer.stopAllAction()
    const clip = actor.animations.find(clip => clip.name === id)!
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play()
    const times = id === 'bow-draw' ? [0, clip.duration * .5, clip.duration] : [release - .01, release, release + .01, clip.duration]
    for (const time of times) {
      action.paused = false; action.time = time; mixer.update(0)
      supportEquipment(actor.scene, bow.scene, id, time); actor.scene.updateMatrixWorld(true)
      const positions = string.geometry.getAttribute('position')
      const drawn = id === 'bow-draw' || time < release
      let endError = 0, restError = 0
      const middle = new THREE.Vector3(); let count = 0
      for (let index = 0; index < positions.count; index++) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, index)
        const expected = new THREE.Vector3().fromArray(rest, index * 3)
        if (Math.abs(expected.y) > .64) endError = Math.max(endError, point.distanceTo(expected))
        if (Math.abs(expected.y) < .01) { middle.add(point); count++ }
        restError = Math.max(restError, point.distanceTo(expected))
      }
      middle.divideScalar(count).applyMatrix4(string.matrixWorld)
      const hand = new THREE.Vector3(0, .04, 0).applyMatrix4(actor.scene.getObjectByName('Hand_R')!.matrixWorld)
      const handError = middle.distanceTo(hand)
      checks.push({ name: `${body.id}/${id}/${time.toFixed(3)}: string follows draw and releases at contact`, pass: endError < 1e-6 && (drawn ? handError < .015 : restError === 0), value: { drawn, handError, endError, restError } })
    }
    const live = [...string.geometry.getAttribute('position').array]
    let liveDisposals = 0
    string.geometry.addEventListener('dispose', () => liveDisposals++)
    const bounds = animationBounds(actor.scene, clip, id === 'bow-release' ? release : undefined)
    checks.push({ name: `${body.id}/${id}: bounds sampling preserves the live string`, pass: !bounds.isEmpty() && liveDisposals === 0 && live.every((value, i) => value === string.geometry.getAttribute('position').array[i]), value: { liveDisposals, bounds: [bounds.min.toArray(), bounds.max.toArray()] } })
  }
  checks.push({ name: `${body.id}: source string geometry remains unchanged`, pass: rest.every((value, index) => value === original.getAttribute('position').array[index]), value: { vertices: rest.length / 3 } })
  mixer.stopAllAction(); mixer.uncacheRoot(actor.scene); disposeInstance(actor.scene)
}
const pass = checks.every(check => check.pass)
await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(), pass, checks }, null, 2) + '\n')
console.log(JSON.stringify({ pass, checks: checks.length, failures: checks.filter(check => !check.pass) }, null, 2))
if (!pass) process.exitCode = 1

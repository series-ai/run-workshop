import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { mountEquipment, supportEquipment, disposeInstance } from '../src/runtime/assets'
import type { PackManifest } from '../src/types'
import firearms from '../src/runtime/firearms.json'
const assets = process.argv[2] ?? 'public/assets'
const output = process.argv[3] ?? 'docs/verification/polish/reload-support.json'
const catalog = JSON.parse(await readFile(`${assets}/characters.json`, 'utf8')) as PackManifest
const props = JSON.parse(await readFile('public/assets/props.json', 'utf8')) as PackManifest
async function load(path: string) {
  const bytes = await readFile(path)
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
}
const checks: { body: string; clip: string; pass: boolean; maximumQuaternionComponentChange: number; maximumGripError: number; maximumHandSeparation: number; endpointGripError: number }[] = []
for (const body of catalog.models.filter(model => !process.argv[4] || model.id === process.argv[4])) {
  const actor = await load(`${assets}/characters/${body.id}.glb`), rifle = await load('public/assets/props/rifle.glb')
  mountEquipment(actor.scene, { root: rifle.scene, clips: rifle.animations, entry: props.models.find(model => model.id === 'rifle')! }, actor.animations, catalog.animations)
  const mixer = new THREE.AnimationMixer(actor.scene)
  for (const id of ['rifle-reload', 'rifle-fire']) {
    mixer.stopAllAction()
    const clip = actor.animations.find(clip => clip.name === id)!
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play()
    const arm = ['UpperArm_L', 'Forearm_L', 'Hand_L'].map(name => actor.scene.getObjectByName(name)!)
    let maximumQuaternionComponentChange = 0, maximumGripError = 0, maximumHandSeparation = 0, endpointGripError = 0
    for (let frame = 0; frame <= 30; frame++) {
      action.paused = false; action.time = clip.duration * frame / 30; mixer.update(0); actor.scene.updateMatrixWorld(true)
      const before = arm.map(bone => bone.quaternion.clone())
      supportEquipment(actor.scene, rifle.scene, id, action.time); actor.scene.updateMatrixWorld(true)
      const middle = frame / 30 >= firearms.reload.releaseEnd && frame / 30 <= firearms.reload.returnStart
      if (middle) maximumQuaternionComponentChange = Math.max(maximumQuaternionComponentChange, ...arm.map((bone, i) => Math.max(...bone.quaternion.toArray().map((value, axis) => Math.abs(value - before[i].toArray()[axis])))))
      const palm = new THREE.Vector3(0, .04, 0).applyMatrix4(arm[2].matrixWorld)
      const grip = new THREE.Vector3().fromArray(rifle.scene.userData.supportGrip).applyMatrix4(rifle.scene.matrixWorld)
      const gap = palm.distanceTo(grip)
      maximumGripError = Math.max(maximumGripError, gap)
      if (middle) maximumHandSeparation = Math.max(maximumHandSeparation, gap)
      if (frame === 0 || frame === 30) endpointGripError = Math.max(endpointGripError, gap)
    }
    const armRatio = rifle.scene.scale.x / firearms.weapons.rifle.scale
    checks.push({ body: body.id, clip: id, pass: id === 'rifle-reload' ? maximumQuaternionComponentChange < 1e-6 && maximumHandSeparation > .06 * armRatio && endpointGripError < .01 * armRatio : maximumGripError < .01 * armRatio, maximumQuaternionComponentChange, maximumGripError, maximumHandSeparation, endpointGripError })
  }
  mixer.stopAllAction(); mixer.uncacheRoot(actor.scene); disposeInstance(actor.scene)
}
const pass = checks.every(check => check.pass)
await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(), pass, sourceSHA256: createHash('sha256').update(await readFile('src/runtime/assets.ts')).digest('hex'), checks }, null, 2) + '\n')
console.log(JSON.stringify({ pass, checks: checks.length, failures: checks.filter(check => !check.pass) }))
if (!pass) process.exitCode = 1

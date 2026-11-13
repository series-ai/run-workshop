import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import type { AnimationEntry, ModelEntry } from '../src/types'

const base = process.argv[2] ?? 'public/assets'
const output = process.argv[3] ?? 'docs/verification/stance/combat-stance.json'
const catalog = JSON.parse(await readFile(`${base}/characters.json`, 'utf8')) as { models: ModelEntry[]; animations: AnimationEntry[] }
const checks: { body: string; clip: string; pass: boolean; maximumLean: number; contactLean: number; extension: number; supportOffset?: number }[] = []
const hashes: Record<string, string> = {}
for (const model of catalog.models) {
  const path = `${base}/characters/${model.id}.glb`, bytes = await readFile(path)
  hashes[path] = createHash('sha256').update(bytes).digest('hex')
  const actor = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const mixer = new THREE.AnimationMixer(actor.scene)
  const point = (name: string) => actor.scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3())
  for (const id of ['punch-left', 'punch-right', 'punch-heavy', 'uppercut', 'kick-front', 'kick-roundhouse', 'kick-air']) {
    const meta = catalog.animations.find(clip => clip.id === id)!
    mixer.stopAllAction()
    const clip = actor.animations.find(clip => clip.name === id)!
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true; action.play()
    const pose = (time: number) => { action.paused = false; action.time = time; mixer.update(0); actor.scene.updateMatrixWorld(true) }
    const lean = () => { const axis = point('Neck').sub(point('Hips')); return THREE.MathUtils.radToDeg(Math.atan2(axis.z, axis.y)) }
    let maximumLean = 0
    for (let time = 0; time <= clip.duration; time += 1 / 120) { pose(time); maximumLean = Math.max(maximumLean, Math.abs(lean())) }
    pose(meta.contactTime!)
    const contactLean = lean(), kick = id.startsWith('kick-'), side = id === 'punch-left' ? 'L' : 'R'
    const origin = point(kick ? 'Thigh_R' : `UpperArm_${side}`)
    const middle = point(kick ? 'Shin_R' : `Forearm_${side}`), tip = point(kick ? 'Foot_R' : `Hand_${side}`)
    const extension = origin.distanceTo(tip) / (origin.distanceTo(middle) + middle.distanceTo(tip))
    const supportOffset = kick && id !== 'kick-air' ? Math.abs(point('Thigh_L').z - point('Foot_L').z) / model.dimensions[1] : undefined
    const pass = maximumLean < 17 && Math.abs(contactLean) < 15 && (id === 'uppercut' || extension > .97) && (supportOffset === undefined || supportOffset < .12)
    checks.push({ body: model.id, clip: id, pass, maximumLean, contactLean, extension, supportOffset })
  }
  mixer.stopAllAction(); mixer.uncacheRoot(actor.scene)
}
const pass = checks.every(check => check.pass)
await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(), pass, hashes, checks }, null, 2) + '\n')
console.log(JSON.stringify({ pass, checks: checks.length, failures: checks.filter(check => !check.pass) }))
if (!pass) process.exitCode = 1

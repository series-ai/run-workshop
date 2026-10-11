import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import type { AnimationEntry, ModelEntry } from '../src/types'

const base = process.argv[2] ?? 'public/assets'
const output = process.argv[3] ?? 'docs/verification/polish/motion-style.json'
const catalog = JSON.parse(await readFile(`${base}/characters.json`, 'utf8')) as { models: ModelEntry[]; animations: AnimationEntry[] }
const checks: { body: string; name: string; pass: boolean; value: unknown }[] = []
const hashes: Record<string, string> = {}
for (const model of catalog.models) {
  const path = `${base}/characters/${model.id}.glb`, bytes = await readFile(path)
  hashes[path] = createHash('sha256').update(bytes).digest('hex')
  const actor = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const mixer = new THREE.AnimationMixer(actor.scene)
  function pose(id: string, phase: string | number): void {
    const meta = catalog.animations.find(clip => clip.id === id)!
    const time = typeof phase === 'number' ? phase : meta.motion!.phases.find(item => item.name === phase)!.frame / 30
    mixer.stopAllAction()
    const action = mixer.clipAction(actor.animations.find(clip => clip.name === id)!)
    action.reset().setLoop(THREE.LoopOnce, 1).play(); action.clampWhenFinished = true
    action.time = time; mixer.update(0); actor.scene.updateMatrixWorld(true)
  }
  const point = (name: string) => actor.scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3())
  const check = (name: string, pass: boolean, value: unknown) => checks.push({ body: model.id, name, pass, value })
  for (const phase of ['contact', 'hold']) {
    pose('kick-roundhouse', phase)
    const bend = THREE.MathUtils.radToDeg(point('Shin_R').sub(point('Thigh_R')).angleTo(point('Foot_R').sub(point('Shin_R'))))
    check(`roundhouse ${phase} extends at the hit`, bend < 20, bend)
    pose('elbow-strike', phase)
    const lead = point('Forearm_R').z - point('Hand_R').z
    check(`elbow ${phase} leads the fist`, lead > .05, lead)
  }
  for (const [id, sign] of [['dodge-left', -1], ['dodge-right', 1]] as const) {
    pose(id, 'ready'); const start = point('Head').x
    pose(id, 'peak'); const travel = (point('Head').x - start) * sign
    check(`${id} moves the head out of the strike line`, travel > model.dimensions[1] * .1, travel)
  }
  pose('idle', .2); const standing = point('Head').y
  pose('crouch-idle', .2); const crouch = point('Head').y
  pose('crouch-walk', .2); const walking = point('Head').y
  check('crouch stance remains low during travel', standing - Math.max(crouch, walking) > model.dimensions[1] * .10 && Math.abs(crouch - walking) < .1, { standing, crouch, walking })
  const jump = catalog.animations.find(clip => clip.id === 'jump-start')!
  const takeoff = jump.motion!.phases.find(phase => phase.name === 'takeoff')!.frame / 30
  let previous = -Infinity, minimumRise = Infinity
  for (let time = takeoff; time <= jump.duration + .0001; time += 1 / 120) {
    pose('jump-start', time); const height = point('Head').y
    minimumRise = Math.min(minimumRise, height - previous); previous = height
  }
  check('jump extends after the live takeoff', minimumRise >= -.002, minimumRise)
}
const pass = checks.every(check => check.pass)
await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(), pass, hashes, checks }, null, 2) + '\n')
console.log(JSON.stringify({ pass, checks: checks.length, failures: checks.filter(check => !check.pass) }))
if (!pass) process.exitCode = 1

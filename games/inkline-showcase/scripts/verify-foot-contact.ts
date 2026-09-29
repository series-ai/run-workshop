import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import type { AnimationEntry, ModelEntry } from '../src/types'

const base = process.argv[2] ?? 'public/assets'
const output = process.argv[3] ?? 'docs/verification/feet/foot-contact.json'
type ContactClip = AnimationEntry & { motion?: { plants: { side: 'L' | 'R'; startFrame: number; endFrame: number; velocity: number[] }[] } }
const catalog = JSON.parse(await readFile(`${base}/characters.json`, 'utf8')) as { models: ModelEntry[]; animations: ContactClip[] }
// These expectations are independent of the exported support declarations.
const standing = [
  'idle', 'punch-left', 'punch-right', 'punch-heavy', 'uppercut', 'block', 'parry',
  'elbow-strike', 'backfist', 'shoulder-check', 'sword-slash', 'sword-overhead',
  'sword-thrust', 'sword-diagonal', 'sword-lunge', 'dagger-stab', 'staff-spin',
  'staff-thrust', 'staff-sweep', 'staff-overhead', 'staff-parry', 'hammer-overhead',
  'shield-bash', 'shield-block', 'shield-slam', 'shield-push',
  'pistol-idle', 'pistol-fire', 'pistol-reload', 'rifle-idle', 'rifle-fire',
  'rifle-reload', 'shotgun-fire', 'bow-draw', 'bow-release', 'throw',
  'hit-front', 'hit-back', 'hit-left', 'hit-right', 'stun', 'wave', 'point',
  'interact', 'pickup', 'cheer', 'celebrate', 'bat-swing', 'crouch-idle',
]
const supports: [string, ('L' | 'R')[]][] = [
  ...standing.map(id => [id, ['L', 'R']] as [string, ('L' | 'R')[]]),
  ...['kick-front', 'kick-roundhouse', 'sweep', 'knee-strike', 'ball-kick'].map(id => [id, ['L']] as [string, ('L' | 'R')[]]),
]
const checks: { body: string; clip: string; side: string; drift: number; heightError: number; declared: boolean; pass: boolean }[] = []
const hashes: Record<string, string> = {}
const jabChecks: { body: string; headTravel: number; pass: boolean }[] = []
for (const model of catalog.models) {
  const path = `${base}/characters/${model.id}.glb`, bytes = await readFile(path)
  hashes[path] = createHash('sha256').update(bytes).digest('hex')
  const actor = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const mixer = new THREE.AnimationMixer(actor.scene)
  const point = (side: string) => actor.scene.getObjectByName(`Foot_${side}`)!.getWorldPosition(new THREE.Vector3())
  mixer.clipAction(actor.animations.find(clip => clip.name === 'idle')!).play()
  mixer.update(0); actor.scene.updateMatrixWorld(true)
  const floor = { L: point('L').y, R: point('R').y }
  for (const [id, sides] of supports) {
    const clip = actor.animations.find(clip => clip.name === id)!
    const meta = catalog.animations.find(clip => clip.id === id)!
    mixer.stopAllAction()
    const action = mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true; action.play()
    const pose = (time: number) => { action.paused = false; action.time = time; mixer.update(0); actor.scene.updateMatrixWorld(true) }
    pose(0)
    const starts = { L: point('L'), R: point('R') }
    if (id === 'punch-left') {
      const heights: number[] = []
      for (let sample = 0; sample <= Math.ceil(clip.duration * 120); sample++) {
        pose(Math.min(sample / 120, clip.duration))
        heights.push(actor.scene.getObjectByName('Head')!.getWorldPosition(new THREE.Vector3()).y)
      }
      const headTravel = Math.max(...heights) - Math.min(...heights)
      jabChecks.push({ body: model.id, headTravel, pass: headTravel < .10 * model.dimensions[1] / 1.8 })
    }
    for (const side of sides) {
      let drift = 0, heightError = 0
      for (let sample = 0; sample <= Math.ceil(clip.duration * 120); sample++) {
        pose(Math.min(sample / 120, clip.duration))
        const foot = point(side)
        drift = Math.max(drift, Math.hypot(foot.x - starts[side].x, foot.z - starts[side].z))
        heightError = Math.max(heightError, Math.abs(foot.y - floor[side]))
      }
      const declared = meta.motion?.plants.some(plant => plant.side === side && plant.startFrame === 1 && plant.endFrame >= Math.round(clip.duration * 30) && plant.velocity.every(value => value === 0)) ?? false
      checks.push({ body: model.id, clip: id, side, drift, heightError, declared, pass: drift < .003 && heightError < .003 && declared })
    }
  }
  mixer.stopAllAction(); mixer.uncacheRoot(actor.scene)
}
const pass = checks.every(check => check.pass) && jabChecks.every(check => check.pass)
await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(), pass, hashes, checks, jabChecks }, null, 2) + '\n')
console.log(JSON.stringify({ pass, checks: checks.length, maximumDrift: Math.max(...checks.map(check => check.drift)), failures: checks.filter(check => !check.pass), jabChecks }))
if (!pass) process.exitCode = 1

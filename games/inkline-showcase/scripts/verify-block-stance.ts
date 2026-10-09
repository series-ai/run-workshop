import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import type { ModelEntry } from '../src/types'

const base = process.argv[2] ?? 'public/assets'
const output = process.argv[3] ?? 'docs/verification/block/block-stance.json'
const baseline = process.argv[4] ?? '.cache/block-baseline'
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
const catalog = JSON.parse((await bytes(`${base}/characters.json`)).toString()) as { models: ModelEntry[] }
await bytes(`${baseline}/characters.json`)
await bytes('scripts/blender/characters.py')
await bytes('scripts/verify-block-stance.ts')
const checks: { body: string; name: string; pass: boolean; value: unknown }[] = []
const preservation: { body: string; clip: string; changed: boolean; protectedClip: boolean; maximumValueChange: number; maximumTimeChange: number; layoutMatches: boolean; maximumWorldPositionChange?: number; maximumWorldAngleDegrees?: number; pass: boolean }[] = []

function compareWorldPose(before: Awaited<ReturnType<typeof load>>, current: Awaited<ReturnType<typeof load>>, id: string) {
  const pair = [before, current].map(actor => {
    const mixer = new THREE.AnimationMixer(actor.scene)
    const action = mixer.clipAction(actor.animations.find(clip => clip.name === id)!).reset().setLoop(THREE.LoopOnce, 1).play()
    action.clampWhenFinished = true
    const bones = new Map<string, THREE.Bone>()
    actor.scene.traverse(object => { if (object instanceof THREE.Bone) bones.set(object.name, object) })
    return { actor, mixer, action, bones }
  })
  let maximumWorldPositionChange = 0, maximumWorldAngleDegrees = 0
  for (let tick = 0; tick <= Math.ceil(pair[0].action.getClip().duration * 120); tick++) {
    for (const item of pair) {
      item.action.paused = false; item.action.time = Math.min(tick / 120, item.action.getClip().duration)
      item.mixer.update(0); item.actor.scene.updateMatrixWorld(true)
    }
    for (const [name, bone] of pair[0].bones) {
      const next = pair[1].bones.get(name)!
      maximumWorldPositionChange = Math.max(maximumWorldPositionChange, bone.getWorldPosition(new THREE.Vector3()).distanceTo(next.getWorldPosition(new THREE.Vector3())))
      const oldRotation = bone.getWorldQuaternion(new THREE.Quaternion()).normalize()
      const newRotation = next.getWorldQuaternion(new THREE.Quaternion()).normalize()
      maximumWorldAngleDegrees = Math.max(maximumWorldAngleDegrees, THREE.MathUtils.radToDeg(oldRotation.angleTo(newRotation)))
    }
  }
  for (const item of pair) { item.mixer.stopAllAction(); item.mixer.uncacheRoot(item.actor.scene) }
  return { maximumWorldPositionChange, maximumWorldAngleDegrees }
}

function measure(actor: Awaited<ReturnType<typeof load>>) {
  const root = actor.scene, mixer = new THREE.AnimationMixer(root)
  const bone = (name: string) => {
    const value = root.getObjectByName(name)
    if (!value) throw new Error(`Missing bone: ${name}`)
    return value
  }
  const point = (name: string) => bone(name).getWorldPosition(new THREE.Vector3())
  const start = (id: string) => {
    mixer.stopAllAction()
    const clip = actor.animations.find(value => value.name === id)
    if (!clip) throw new Error(`Missing clip: ${id}`)
    const action = mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true; action.play()
    return action
  }
  const pose = (action: THREE.AnimationAction, time: number) => {
    action.paused = false; action.time = time; mixer.update(0); root.updateMatrixWorld(true)
  }
  pose(start('idle'), .5)
  const idleHips = point('Hips').y
  const floor = { L: point('Foot_L').y, R: point('Foot_R').y }
  const action = start('block')
  pose(action, 0)
  const initial = { L: point('Foot_L'), R: point('Foot_R') }
  const result = {
    foreAftMinimum: Infinity, foreAftMaximum: 0, lateralMaximum: 0,
    torsoTiltDegrees: 0, headTiltDegrees: 0, headForwardOffset: 0,
    hipsMinimum: Infinity, hipsMaximum: -Infinity, headMinimum: Infinity, headMaximum: -Infinity,
    maximumKneeBendDegrees: 0, footDrift: 0, footHeightError: 0, idleHips,
    initialFootL: initial.L.toArray(), initialFootR: initial.R.toArray(),
  }
  const up = new THREE.Vector3(0, 1, 0)
  for (let tick = 0; tick <= Math.ceil(action.getClip().duration * 120); tick++) {
    pose(action, Math.min(tick / 120, action.getClip().duration))
    const left = point('Foot_L'), right = point('Foot_R'), hips = point('Hips'), head = point('Head')
    const span = Math.abs(left.z - right.z)
    result.foreAftMinimum = Math.min(result.foreAftMinimum, span)
    result.foreAftMaximum = Math.max(result.foreAftMaximum, span)
    result.lateralMaximum = Math.max(result.lateralMaximum, Math.abs(left.x - right.x))
    result.torsoTiltDegrees = Math.max(result.torsoTiltDegrees, THREE.MathUtils.radToDeg(point('Neck').sub(hips).angleTo(up)))
    const headAxis = up.clone().applyQuaternion(bone('Head').getWorldQuaternion(new THREE.Quaternion()))
    result.headTiltDegrees = Math.max(result.headTiltDegrees, THREE.MathUtils.radToDeg(headAxis.angleTo(up)))
    result.headForwardOffset = Math.max(result.headForwardOffset, Math.abs(head.z - hips.z))
    result.hipsMinimum = Math.min(result.hipsMinimum, hips.y); result.hipsMaximum = Math.max(result.hipsMaximum, hips.y)
    result.headMinimum = Math.min(result.headMinimum, head.y); result.headMaximum = Math.max(result.headMaximum, head.y)
    for (const side of ['L', 'R'] as const) {
      const foot = point(`Foot_${side}`), thigh = point(`Thigh_${side}`), shin = point(`Shin_${side}`)
      result.maximumKneeBendDegrees = Math.max(result.maximumKneeBendDegrees, THREE.MathUtils.radToDeg(shin.clone().sub(thigh).angleTo(foot.clone().sub(shin))))
      result.footDrift = Math.max(result.footDrift, Math.hypot(foot.x - initial[side].x, foot.z - initial[side].z))
      result.footHeightError = Math.max(result.footHeightError, Math.abs(foot.y - floor[side]))
    }
  }
  mixer.stopAllAction(); mixer.uncacheRoot(root)
  return result
}

const metrics: { body: string; height: number; before: ReturnType<typeof measure>; current: ReturnType<typeof measure> }[] = []
for (const model of catalog.models.filter(model => !process.argv[5] || model.id === process.argv[5])) {
  const currentActor = await load(`${base}/characters/${model.id}.glb`)
  const oldActor = await load(`${baseline}/characters/${model.id}.glb`)
  const before = measure(oldActor), current = measure(currentActor), height = model.dimensions[1]
  metrics.push({ body: model.id, height, before, current })
  const check = (name: string, pass: boolean, value: unknown) => checks.push({ body: model.id, name, pass, value })
  // Limits describe a standing guard, independent of the authored bone angles.
  check('compact staggered stance', current.foreAftMinimum >= height * .12 && current.foreAftMaximum <= height * .25,
    { minimum: current.foreAftMinimum, maximum: current.foreAftMaximum, limits: [height * .12, height * .25] })
  check('stance is shorter than baseline', current.foreAftMaximum < before.foreAftMinimum * .8,
    { before: before.foreAftMinimum, after: current.foreAftMaximum })
  check('stance width narrows within body proportions', current.lateralMaximum < height * .4 && current.lateralMaximum < before.lateralMaximum * .9,
    { before: before.lateralMaximum, after: current.lateralMaximum, heightRatio: current.lateralMaximum / height })
  check('upright torso and head', current.torsoTiltDegrees < 12 && current.headTiltDegrees < 12 && current.headForwardOffset < height * .08,
    { torsoDegrees: current.torsoTiltDegrees, headDegrees: current.headTiltDegrees, headOffset: current.headForwardOffset / height })
  check('guard does not become a crouch', before.idleHips - current.hipsMinimum < height * .06 && current.maximumKneeBendDegrees < 55,
    { hipDrop: before.idleHips - current.hipsMinimum, maximumKneeBendDegrees: current.maximumKneeBendDegrees })
  check('body height stays stable', current.hipsMaximum - current.hipsMinimum < height * .015 && current.headMaximum - current.headMinimum < height * .015,
    { hipRange: current.hipsMaximum - current.hipsMinimum, headRange: current.headMaximum - current.headMinimum })
  check('both feet stay fixed and grounded', current.footDrift < .003 && current.footHeightError < .003,
    { horizontalDrift: current.footDrift, heightError: current.footHeightError })

  for (const prior of oldActor.animations) {
    const clip = currentActor.animations.find(value => value.name === prior.name)
    let layoutMatches = Boolean(clip && clip.tracks.length === prior.tracks.length)
    let maximumValueChange = 0, maximumTimeChange = Math.abs((clip?.duration ?? -1) - prior.duration)
    for (const track of prior.tracks) {
      const next = clip?.tracks.find(value => value.name === track.name)
      if (!next || next.times.length !== track.times.length || next.values.length !== track.values.length) { layoutMatches = false; continue }
      for (let index = 0; index < track.times.length; index++) maximumTimeChange = Math.max(maximumTimeChange, Math.abs(track.times[index] - next.times[index]))
      for (let index = 0; index < track.values.length; index++) maximumValueChange = Math.max(maximumValueChange, Math.abs(track.values[index] - next.values[index]))
    }
    const changed = !layoutMatches || maximumValueChange > .00001 || maximumTimeChange > .000001
    const allowed = prior.name === 'block' || prior.name.startsWith('shield-')
    const protectedClip = /^(punch-|kick-|uppercut$)/.test(prior.name)
    const world = changed && !allowed && !protectedClip && clip ? compareWorldPose(oldActor, currentActor, prior.name) : undefined
    const stable = !changed || !protectedClip && world !== undefined && world.maximumWorldPositionChange < height * .0002 && world.maximumWorldAngleDegrees < .5
    const pass = maximumTimeChange <= .000001 && (allowed || stable && (!protectedClip || layoutMatches))
    preservation.push({ body: model.id, clip: prior.name, changed, protectedClip, maximumValueChange, maximumTimeChange, layoutMatches, ...world, pass })
  }
  check('clip count stays unchanged', currentActor.animations.length === oldActor.animations.length, currentActor.animations.length)
}
const failures = [...checks.filter(check => !check.pass), ...preservation.filter(check => !check.pass)]
const pass = metrics.length > 0 && failures.length === 0
await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(), pass, hashes, sampleRate: 120,
  scope: 'Block posture and support feet. Punch, uppercut, and kick tracks remain unchanged. Other changed tracks must preserve world joint positions within 0.02% of body height and rotations within 0.5 degrees. All clip times remain unchanged. Shield grip orientation has a separate check.',
  checks, preservation, metrics, failures }, null, 2) + '\n')
console.log(JSON.stringify({ pass, bodies: metrics.length, checks: checks.length,
  protectedClips: preservation.filter(check => check.protectedClip).length,
  foreAftSpans: metrics.map(value => ({ body: value.body, before: value.before.foreAftMaximum, after: value.current.foreAftMaximum })), failures }))
if (!pass) process.exitCode = 1

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

interface Plant { side: 'L' | 'R'; startFrame: number; endFrame: number; velocity: [number, number, number] }
interface Motion { plants: Plant[]; phases: { name: string; frame: number }[]; continuesFrom?: string }
interface ClipEntry { id: string; duration: number; loop: boolean; contactTime?: number; travelSpeed?: number; motion?: Motion }
interface Catalog { models: { id: string }[]; animations: ClipEntry[] }

const assetDirectory = resolve(process.argv[2] ?? '.cache/correction-character-prototype')
const output = resolve(process.argv[3] ?? 'docs/verification/correction/figure-motion-quality.json')
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a metadata object.')
  return value as Record<string, unknown>
}
function finite(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('Expected a finite metadata number.')
  return value
}
function id(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9-]*$/.test(value)) throw new Error('Invalid metadata ID.')
  return value
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected a metadata list.')
  return value
}
function parseCatalog(value: unknown): Catalog {
  const data = record(value)
  const models = list(data.models).map(value => ({ id: id(record(value).id) }))
  const animations = list(data.animations).map(value => {
    const entry = record(value), clipId = id(entry.id), duration = finite(entry.duration)
    if (duration <= 0 || typeof entry.loop !== 'boolean') throw new Error(`${clipId}: invalid duration or loop flag`)
    const contactTime = entry.contactTime === undefined ? undefined : finite(entry.contactTime)
    const travelSpeed = entry.travelSpeed === undefined ? undefined : finite(entry.travelSpeed)
    if (contactTime !== undefined && (contactTime <= 0 || contactTime >= duration)) throw new Error(`${clipId}: contact is outside the clip`)
    if (travelSpeed !== undefined && (travelSpeed <= 0 || !entry.loop)) throw new Error(`${clipId}: invalid travel speed`)
    let motion: Motion | undefined
    if (entry.motion !== undefined) {
      const source = record(entry.motion)
      const plants: Plant[] = list(source.plants).map(value => {
        const plant = record(value), side = plant.side
        if (side !== 'L' && side !== 'R') throw new Error(`${clipId}: invalid support side`)
        const startFrame = finite(plant.startFrame), endFrame = finite(plant.endFrame)
        const vector = list(plant.velocity).map(finite)
        if (vector.length !== 3 || startFrame < 1 || endFrame < startFrame || endFrame / 30 > duration + .001) throw new Error(`${clipId}: invalid support interval`)
        return { side, startFrame, endFrame, velocity: [vector[0], vector[1], vector[2]] }
      })
      const phases = list(source.phases).map(value => {
        const phase = record(value), name = id(phase.name), frame = finite(phase.frame)
        if (frame < 1 || frame / 30 > duration + .001) throw new Error(`${clipId}: phase is outside the clip`)
        if (name === 'contact' && contactTime !== undefined && Math.abs(frame / 30 - contactTime) > .001) throw new Error(`${clipId}: contact phase and event differ`)
        return { name, frame }
      })
      motion = { plants, phases, ...(source.continuesFrom === undefined ? {} : { continuesFrom: id(source.continuesFrom) }) }
    }
    return { id: clipId, duration, loop: entry.loop, contactTime, travelSpeed, motion }
  })
  if (new Set(models.map(model => model.id)).size !== models.length || new Set(animations.map(clip => clip.id)).size !== animations.length) throw new Error('Metadata has duplicate IDs.')
  return { models, animations }
}
const catalogBytes = await readFile(resolve(assetDirectory, 'characters.json'))
const catalog = parseCatalog(JSON.parse(catalogBytes.toString('utf8')))
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const sourceSha256 = sha256(await readFile('scripts/blender/characters.py'))
const assets: { body: string; sha256: string; bytes: number }[] = []
const checkGrounded = process.argv.includes('--grounded')
const groundContact = checkGrounded ? record(record(JSON.parse(await readFile(resolve(assetDirectory, 'sample-pose-metrics.json'), 'utf8'))).groundContact) : {}
const results: Record<string, unknown>[] = []
const failures: string[] = []
for (const model of catalog.models) {
  const bytes = await readFile(resolve(assetDirectory, 'characters', `${model.id}.glb`))
  assets.push({ body: model.id, sha256: sha256(bytes), bytes: bytes.byteLength })
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const root = gltf.scene
  const bones = new Map<string, THREE.Bone>()
  const meshes: THREE.SkinnedMesh[] = []
  root.traverse(object => { if (object instanceof THREE.SkinnedMesh) meshes.push(object) })
  const grounded = new Set(checkGrounded ? list(groundContact[model.id]).map(record).filter(clip => clip.grounded === true).map(clip => id(clip.clip)) : [])
  root.traverse(object => { if (object instanceof THREE.Bone) bones.set(object.name, object) })
  if (bones.size !== 18 || gltf.animations.length !== 85) failures.push(`${model.id}: expected 18 bones and 85 clips`)
  const position = (name: string) => bones.get(name)!.getWorldPosition(new THREE.Vector3())
  for (const entry of catalog.animations) {
    const motion = entry.motion ?? { plants: [], phases: [] }
    const clip = gltf.animations.find(value => value.name === entry.id)!
    const mixer = new THREE.AnimationMixer(root)
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    action.play()
    const sample = (time: number) => {
      action.paused = false; action.time = Math.min(clip.duration, time); mixer.update(0)
      root.updateMatrixWorld(true)
    }
    const plants = motion.plants.map(plant => {
      sample(plant.startFrame / 30)
      const initial = position(`Foot_${plant.side}`)
      const velocity = new THREE.Vector3(plant.velocity[0], plant.velocity[2], -plant.velocity[1])
      let maximumError = 0
      for (let frame = plant.startFrame; frame <= plant.endFrame; frame += .125) {
        sample(frame / 30)
        const expected = initial.clone().addScaledVector(velocity, (frame - plant.startFrame) / 30)
        maximumError = Math.max(maximumError, position(`Foot_${plant.side}`).distanceTo(expected))
      }
      if (maximumError > .015) failures.push(`${model.id}/${entry.id}: ${plant.side} support moved ${maximumError.toFixed(4)} m`)
      return { ...plant, maximumError, pass: maximumError <= .015 }
    })
    let shoulderGap = 0, hipGap = 0
    for (let time = 1 / 30; time <= clip.duration; time += 1 / 60) {
      sample(time)
      shoulderGap = Math.max(shoulderGap, position('UpperArm_L').distanceTo(position('UpperArm_R')))
      hipGap = Math.max(hipGap, position('Thigh_L').distanceTo(position('Thigh_R')))
    }
    if (shoulderGap > .0001 || hipGap > .0001) failures.push(`${model.id}/${entry.id}: paired branch origins differ`)
    let loopError = 0, loopAngleError = 0
    if (entry.loop) {
      sample(1 / 30)
      const start = new Map([...bones].map(([name, bone]) => [name, { position: position(name), rotation: bone.getWorldQuaternion(new THREE.Quaternion()).normalize() }]))
      sample(clip.duration)
      for (const [name, initial] of start) {
        loopError = Math.max(loopError, position(name).distanceTo(initial.position))
        loopAngleError = Math.max(loopAngleError, bones.get(name)!.getWorldQuaternion(new THREE.Quaternion()).normalize().angleTo(initial.rotation))
      }
      if (loopAngleError > .002) failures.push(`${model.id}/${entry.id}: loop rotation changed ${loopAngleError.toFixed(4)} rad`)
      if (loopError > .001) failures.push(`${model.id}/${entry.id}: loop moved ${loopError.toFixed(4)} m`)
    }
    let floor: { minimum: number; maximum: number; sampleRate: number } | undefined
    if (grounded.has(entry.id)) {
      const bounds = new THREE.Box3()
      let minimum = Infinity, maximum = -Infinity
      for (let tick = 0; tick <= Math.ceil(clip.duration * 240); tick++) {
        sample(tick / 240)
        for (const mesh of meshes) mesh.computeBoundingBox()
        const height = bounds.setFromObject(root).min.y
        minimum = Math.min(minimum, height); maximum = Math.max(maximum, height)
      }
      floor = { minimum, maximum, sampleRate: 240 }
      if (minimum < -.001 || maximum > .015) failures.push(`${model.id}/${entry.id}: floor band ${minimum.toFixed(4)} to ${maximum.toFixed(4)} m`)
    }
    const phases = motion.phases.map(phase => {
      sample(phase.frame / 30)
      const side = entry.id === 'punch-left' ? 'L' : 'R'
      const arm = position(`UpperArm_${side}`), elbow = position(`Forearm_${side}`), hand = position(`Hand_${side}`)
      const extension = arm.distanceTo(hand) / (arm.distanceTo(elbow) + elbow.distanceTo(hand))
      if (phase.name === 'contact' && /^punch-/.test(entry.id) && extension < .94) failures.push(`${model.id}/${entry.id}: contact arm extension ${extension.toFixed(3)}`)
      return { ...phase, extension, head: position('Head').toArray(), hips: position('Hips').toArray(), hand: hand.toArray() }
    })
    sample(clip.duration)
    const finalHead = position('Head'), finalHips = position('Hips')
    if (entry.id === 'knockdown' || entry.id === 'death') {
      const expectedDirection = entry.id === 'knockdown' ? -1 : 1
      if ((finalHead.z - finalHips.z) * expectedDirection < .3) failures.push(`${model.id}/${entry.id}: fall direction is wrong`)
      if (finalHead.y > .4 || finalHips.y > .35) failures.push(`${model.id}/${entry.id}: final body stays too high`)
    }
    results.push({ body: model.id, clip: entry.id, shoulderGap, hipGap, loopError, loopAngleError, plants, phases, floor, finalHead: finalHead.toArray(), finalHips: finalHips.toArray() })
    mixer.stopAllAction(); mixer.uncacheRoot(root)
  }
  const boundaryPose = (clipId: string, atEnd: boolean) => {
    const clip = gltf.animations.find(value => value.name === clipId)!
    const mixer = new THREE.AnimationMixer(root)
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true; action.play(); action.time = atEnd ? clip.duration : 1 / 30; mixer.update(0)
    root.updateMatrixWorld(true)
    const pose = new Map([...bones].map(([name, bone]) => [name, { position: position(name), rotation: bone.getWorldQuaternion(new THREE.Quaternion()) }]))
    mixer.stopAllAction(); mixer.uncacheRoot(root)
    return pose
  }
  for (const entry of catalog.animations.filter(entry => entry.motion?.continuesFrom)) {
    const from = entry.motion!.continuesFrom!
    const previous = boundaryPose(from, true), next = boundaryPose(entry.id, false)
    let positionError = 0, angleError = 0
    for (const [name, pose] of previous) {
      positionError = Math.max(positionError, pose.position.distanceTo(next.get(name)!.position))
      angleError = Math.max(angleError, pose.rotation.normalize().angleTo(next.get(name)!.rotation.normalize()))
    }
    if (positionError > .002 || angleError > .002) failures.push(`${model.id}/${from}→${entry.id}: boundary differs (${positionError.toFixed(4)} m, ${angleError.toFixed(4)} rad)`)
    results.push({ body: model.id, boundary: `${from}→${entry.id}`, positionError, angleError })
  }
}
const report = { checkedAt: new Date().toISOString(), assetDirectory, sourceSha256, catalogSha256: sha256(catalogBytes), assets, pass: failures.length === 0, failures, results }
await writeFile(output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ pass: report.pass, clips: results.filter(result => result.clip).length, boundaries: results.filter(result => result.boundary).length, grounded: results.filter(result => result.floor).length, failures }, null, 2))
if (!report.pass) process.exitCode = 1

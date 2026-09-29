import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { InklineRenderer } from '../../../src/runtime/renderer'
import { parseManifest } from '../../../src/catalog'
import type { AnimationEntry, PackManifest } from '../../../src/types'

/**
 * Exercise the renderer's travel-loop correction against exported character GLBs.
 *
 * Run from the showcase root:
 *   npx tsx docs/verification/correction/verify-runtime-travel-loop.ts
 *
 * An optional first argument selects the showcase root. An optional second
 * argument selects the JSON report path.
 */

type RuntimeFixture = { clips: Map<string, AnimationEntry> }
type ActorFixture = { mixer: THREE.AnimationMixer; actions: Map<string, THREE.AnimationAction>; active: string }
type UpdateActorAnimation = (this: RuntimeFixture, actor: ActorFixture, delta: number) => void
type TravelScenario = {
  body: string
  clip: string
  fps: number
  rate: number
  frames: number
  wraps: number
  firstKey: number
  duration: number
  period: number
  minimumActionTime: number
  maximumPhaseError: number
  nonFiniteFrame: number | null
  pass: boolean
  failures: string[]
}
type ContactCheck = {
  body: string
  clip: string
  contactFrame: number
  expectedExportTime: number
  authoredContactTime: number
  observedContactTime: number
  previousFrameTime: number
  maximumTimingError: number
  pass: boolean
  failures: string[]
}

const projectRoot = resolve(process.argv[2] ?? '.')
const assetRoot = resolve(projectRoot, 'public/assets')
const reportPath = resolve(projectRoot, process.argv[3] ?? 'docs/verification/correction/runtime-travel-loop.json')
const framesPerSecond = [30, 60, 120] as const
const playbackRates = [.5, 1, 2] as const
const requiredWraps = 6
const phaseTolerance = 1e-5
const contactTolerance = .00051

function asArrayBuffer(bytes: Buffer): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

function sha256(value: Uint8Array | string): string {
  return createHash('sha256').update(value).digest('hex')
}

function finitePose(root: THREE.Object3D): string | null {
  let failure: string | null = null
  root.traverse(object => {
    if (failure) return
    const values = [
      ...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray(),
      ...object.matrixWorld.elements,
    ]
    if (values.some(value => !Number.isFinite(value))) failure = object.name || object.type
  })
  return failure
}

function updateMethod(): UpdateActorAnimation {
  return (InklineRenderer.prototype as unknown as { updateActorAnimation: UpdateActorAnimation }).updateActorAnimation
}

function createFixture(clip: THREE.AnimationClip, entry: AnimationEntry, root: THREE.Object3D, loop: THREE.AnimationActionLoopStyles, rate: number): { fixture: RuntimeFixture; actor: ActorFixture; action: THREE.AnimationAction } {
  const mixer = new THREE.AnimationMixer(root)
  const action = mixer.clipAction(clip).setLoop(loop, loop === THREE.LoopRepeat ? Infinity : 1).setEffectiveTimeScale(rate).play()
  const actor: ActorFixture = { mixer, actions: new Map([[entry.id, action]]), active: entry.id }
  const fixture: RuntimeFixture = { clips: new Map([[entry.id, entry]]) }
  return { fixture, actor, action }
}

function releaseFixture(root: THREE.Object3D, actor: ActorFixture): void {
  actor.mixer.stopAllAction()
  actor.mixer.uncacheRoot(root)
}

function runTravelScenario(body: string, sourceRoot: THREE.Object3D, clip: THREE.AnimationClip, entry: AnimationEntry, fps: number, rate: number, update: UpdateActorAnimation): TravelScenario {
  const failures: string[] = []
  const root = cloneSkeleton(sourceRoot) as THREE.Group
  const { fixture, actor, action } = createFixture(clip, entry, root, THREE.LoopRepeat, rate)
  const firstKey = clip.tracks[0]?.times[0]
  const minimumTrackKey = Math.min(...clip.tracks.map(track => track.times[0]))
  const duration = clip.duration
  const period = duration - firstKey
  if (!Number.isFinite(firstKey) || !Number.isFinite(period) || period <= 0) failures.push('clip has no positive first-key period')
  if (Math.abs(firstKey - minimumTrackKey) > phaseTolerance) failures.push(`tracks start before runtime key ${firstKey} (${minimumTrackKey})`)
  action.time = firstKey
  actor.mixer.update(0)
  const frameDelta = 1 / fps
  const frames = Math.ceil(period * requiredWraps * fps / rate) + 2
  let phase = 0
  let wraps = 0
  let minimumActionTime = Infinity
  let maximumPhaseError = 0
  let nonFiniteFrame: number | null = null
  for (let frame = 1; frame <= frames; frame++) {
    update.call(fixture, actor, frameDelta)
    phase += frameDelta * rate
    const completed = Math.floor(phase / period)
    if (completed > 0) {
      wraps += completed
      phase -= completed * period
    }
    const expected = firstKey + phase
    const actual = action.time
    minimumActionTime = Math.min(minimumActionTime, actual)
    maximumPhaseError = Math.max(maximumPhaseError, Math.abs(actual - expected))
    if (actual < firstKey - phaseTolerance) failures.push(`frame ${frame}: action time ${actual} is below first key ${firstKey}`)
    if (Math.abs(actual - expected) > phaseTolerance) failures.push(`frame ${frame}: phase ${actual} differs from ${expected}`)
    root.updateMatrixWorld(true)
    if (nonFiniteFrame === null) {
      const badObject = finitePose(root)
      if (badObject) { nonFiniteFrame = frame; failures.push(`frame ${frame}: non-finite pose on ${badObject}`) }
    }
  }
  if (wraps < requiredWraps) failures.push(`only ${wraps} wraps completed; expected ${requiredWraps}`)
  releaseFixture(root, actor)
  return { body, clip: entry.id, fps, rate, frames, wraps, firstKey, duration, period,
    minimumActionTime, maximumPhaseError, nonFiniteFrame, pass: failures.length === 0, failures }
}

function runContactCheck(body: string, sourceRoot: THREE.Object3D, clip: THREE.AnimationClip, entry: AnimationEntry, update: UpdateActorAnimation): ContactCheck {
  const failures: string[] = []
  const root = cloneSkeleton(sourceRoot) as THREE.Group
  const { fixture, actor, action } = createFixture(clip, entry, root, THREE.LoopOnce, 1)
  const contactFrame = entry.contactFrame ?? Math.round((entry.contactTime ?? 0) * 30)
  const expectedExportTime = clip.tracks[0].times[0] + (contactFrame - 1) / 30
  const authoredContactTime = entry.contactTime ?? expectedExportTime
  const frameDelta = 1 / 30
  let observedContactTime = 0
  let previousFrameTime = 0
  let maximumTimingError = 0
  action.time = 0
  actor.mixer.update(0)
  for (let frame = 1; frame <= contactFrame; frame++) {
    update.call(fixture, actor, frameDelta)
    root.updateMatrixWorld(true)
    if (frame === contactFrame - 1) previousFrameTime = action.time
    if (frame === contactFrame) observedContactTime = action.time
    const expected = Math.min(frame * frameDelta, clip.duration)
    maximumTimingError = Math.max(maximumTimingError, Math.abs(action.time - expected))
  }
  if (Math.abs(observedContactTime - expectedExportTime) > contactTolerance) failures.push(`contact frame ${contactFrame} observed at ${observedContactTime}; expected ${expectedExportTime}`)
  if (Math.abs(observedContactTime - authoredContactTime) > contactTolerance) failures.push(`authored contact ${authoredContactTime} observed at ${observedContactTime}`)
  if (previousFrameTime >= expectedExportTime - contactTolerance) failures.push(`contact reached one frame early at ${previousFrameTime}`)
  releaseFixture(root, actor)
  return { body, clip: entry.id, contactFrame, expectedExportTime, authoredContactTime, observedContactTime,
    previousFrameTime, maximumTimingError, pass: failures.length === 0, failures }
}

const manifestBytes = await readFile(resolve(assetRoot, 'manifest.json'))
const manifest = parseManifest(JSON.parse(manifestBytes.toString('utf8'))) as PackManifest
const rendererBytes = await readFile(resolve(projectRoot, 'src/runtime/renderer.ts'))
const characters = manifest.models.filter(model => model.kind === 'character')
const travelEntries = manifest.animations.filter(entry => entry.travelSpeed !== undefined)
const contactEntries = manifest.animations.filter(entry => entry.contactTime !== undefined && entry.travelSpeed === undefined)
const update = updateMethod()
const loader = new GLTFLoader()
const travel: TravelScenario[] = []
const contacts: ContactCheck[] = []
const failures: string[] = []
const assetHashes: Record<string, string> = {}

for (const model of characters) {
  const file = resolve(projectRoot, 'public', model.file)
  const bytes = await readFile(file)
  assetHashes[model.id] = sha256(bytes)
  const gltf = await loader.parseAsync(asArrayBuffer(bytes), file)
  const clips = new Map(gltf.animations.map(clip => [clip.name, clip]))
  for (const entry of travelEntries) {
    const clip = clips.get(entry.id)
    if (!clip) { failures.push(`${model.id}/${entry.id}: exported clip is missing`); continue }
    for (const fps of framesPerSecond) for (const rate of playbackRates) {
      const result = runTravelScenario(model.id, gltf.scene, clip, entry, fps, rate, update)
      travel.push(result)
      result.failures.forEach(reason => failures.push(`${model.id}/${entry.id} ${fps}Hz x${rate}: ${reason}`))
    }
  }
  for (const entry of contactEntries) {
    const clip = clips.get(entry.id)
    if (!clip) { failures.push(`${model.id}/${entry.id}: exported contact clip is missing`); continue }
    const result = runContactCheck(model.id, gltf.scene, clip, entry, update)
    contacts.push(result)
    result.failures.forEach(reason => failures.push(`${model.id}/${entry.id}: ${reason}`))
  }
}

const report = {
  checkedAt: new Date().toISOString(),
  assetRoot,
  manifestVersion: manifest.version,
  manifestSha256: sha256(manifestBytes),
  rendererSha256: sha256(rendererBytes),
  characterCount: characters.length,
  travelClipCount: travelEntries.length,
  travelScenarioCount: travel.length,
  contactClipCount: contactEntries.length,
  contactCheckCount: contacts.length,
  framesPerSecond,
  playbackRates,
  requiredWraps,
  phaseTolerance,
  contactTolerance,
  assetHashes,
  travel,
  contacts,
  pass: failures.length === 0,
  failures,
}
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({
  pass: report.pass,
  manifestVersion: report.manifestVersion,
  characters: report.characterCount,
  travelClips: report.travelClipCount,
  travelScenarios: report.travelScenarioCount,
  contactClips: report.contactClipCount,
  contactChecks: report.contactCheckCount,
  requiredWraps: report.requiredWraps,
  failures: report.failures,
  report: reportPath,
}, null, 2))
if (!report.pass) process.exitCode = 1

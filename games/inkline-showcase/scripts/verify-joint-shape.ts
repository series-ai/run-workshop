import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { applyAvatar, disposeInstance } from '../src/runtime/assets'
import { DEFAULT_AVATAR, type AnimationEntry, type ModelEntry } from '../src/types'

const root = process.argv[2] ?? 'public/assets'
const output = process.argv[3] ?? 'docs/verification/joints/joint-shape.json'
const baseline = process.argv[4] ?? '.cache/joint-baseline'
const hashes: Record<string, string> = {}
async function bytes(path: string) {
  const data = await readFile(path)
  hashes[path] = createHash('sha256').update(data).digest('hex')
  return data
}
async function load(path: string): Promise<GLTF> {
  const data = await bytes(path)
  return new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '')
}
const catalog = JSON.parse((await bytes(`${root}/characters.json`)).toString()) as { models: ModelEntry[]; animations: AnimationEntry[] }
for (const path of ['scripts/verify-joint-shape.ts', 'scripts/blender/characters.py', 'src/runtime/assets.ts', `${baseline}/characters.json`]) await bytes(path)
const checks: { body: string; name: string; pass: boolean; value: unknown }[] = []
const bodies: { id: string; sha256: string; parts: number; triangles: number; bones: number }[] = []
const groundRebakes: { body: string; clip: string; time: number; strokeRadius: number; rootDelta: number[]; minimumSurfaceHeight: number; heightWithoutRootCorrection: number }[] = []
const jointPairs = [['UpperArm_L', 'Forearm_L'], ['UpperArm_R', 'Forearm_R'], ['Thigh_L', 'Shin_L'], ['Thigh_R', 'Shin_R']]
function authoredSource(source: string): string {
  const start = source.indexOf('CATEGORY_BASE_POSES =')
  if (start < 0) throw new Error('The character source has no animation authoring marker.')
  return source.slice(start)
}
const currentSource = (await bytes('scripts/blender/characters.py')).toString()
const priorSource = (await bytes(`${baseline}/characters.py`)).toString()
const authoringUnchanged = authoredSource(currentSource) === authoredSource(priorSource)

function poseTimes(clip: THREE.AnimationClip, sampleRate = 12): number[] {
  const entry = catalog.animations.find(value => value.id === clip.name)
  const times = new Set([0, clip.duration, ...Array.from({ length: Math.ceil(clip.duration * sampleRate) }, (_, index) => Math.min(index / sampleRate, clip.duration))])
  for (const phase of entry?.motion?.phases ?? []) times.add(Math.min(clip.duration, Math.max(0, (phase.frame - 1) / 30)))
  if (entry?.contactTime !== undefined) times.add(Math.min(clip.duration, Math.max(0, entry.contactTime)))
  return [...times].sort((a, b) => a - b)
}

function topology(mesh: THREE.SkinnedMesh) {
  const count = mesh.geometry.getAttribute('position').count
  const parents = Array.from({ length: count }, (_, index) => index)
  const find = (index: number): number => {
    while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index] }
    return index
  }
  const indices = mesh.geometry.index
  const at = (index: number) => indices ? indices.getX(index) : index
  const edges = new Set<string>()
  const triangles = (indices?.count ?? count) / 3
  for (let index = 0; index < triangles * 3; index += 3) {
    const vertices = [at(index), at(index + 1), at(index + 2)]
    for (let edge = 0; edge < 3; edge++) {
      const a = vertices[edge], b = vertices[(edge + 1) % 3]
      parents[find(b)] = find(a)
      edges.add(a < b ? `${a}:${b}` : `${b}:${a}`)
    }
  }
  return { parts: new Set(parents.map((_, index) => find(index))).size, triangles,
    edges: [...edges].map(value => value.split(':').map(Number) as [number, number]) }
}

function selectJoint(mesh: THREE.SkinnedMesh, upper: string, lower: string, edges: [number, number][]) {
  const position = mesh.geometry.getAttribute('position')
  const skin = mesh.geometry.getAttribute('skinIndex'), weight = mesh.geometry.getAttribute('skinWeight')
  const lowerIndex = mesh.skeleton.bones.findIndex(bone => bone.name === lower)
  const upperIndex = mesh.skeleton.bones.findIndex(bone => bone.name === upper)
  if (lowerIndex < 0 || upperIndex < 0) throw new Error(`Missing joint ${upper}/${lower}`)
  const pivot = new THREE.Vector3().setFromMatrixPosition(mesh.skeleton.boneInverses[lowerIndex].clone().invert()).applyMatrix4(mesh.bindMatrix.clone().invert())
  const candidates: { vertex: number; radius: number }[] = []
  const point = new THREE.Vector3()
  for (let vertex = 0; vertex < position.count; vertex++) {
    const indices = [skin.getX(vertex), skin.getY(vertex), skin.getZ(vertex), skin.getW(vertex)]
    const weights = [weight.getX(vertex), weight.getY(vertex), weight.getZ(vertex), weight.getW(vertex)]
    if (indices.some((bone, influence) => weights[influence] > 1e-6 && bone !== upperIndex && bone !== lowerIndex)) continue
    const radius = point.fromBufferAttribute(position, vertex).distanceTo(pivot)
    if (radius > 1e-5) candidates.push({ vertex, radius })
  }
  const radius = Math.min(...candidates.map(value => value.radius))
  const vertices = candidates.filter(value => value.radius <= radius * 1.025).map(value => value.vertex)
  const selected = new Set(vertices)
  return { name: lower, bone: mesh.skeleton.bones[lowerIndex], pivot, radius, vertices,
    edges: edges.filter(([a, b]) => selected.has(a) && selected.has(b)) }
}

for (const body of catalog.models.filter(model => !process.argv[5] || model.id === process.argv[5])) {
  const actor = await load(`${root}/characters/${body.id}.glb`)
  const prior = await load(`${baseline}/characters/${body.id}.glb`)
  const check = (name: string, pass: boolean, value: unknown) => checks.push({ body: body.id, name, pass, value })
  check('animation authoring and bake source remain', authoringUnchanged, { unchanged: authoringUnchanged })
  check('all 85 animation clips remain', actor.animations.length === 85 && prior.animations.length === 85,
    { current: actor.animations.length, baseline: prior.animations.length })
  const meshes: THREE.SkinnedMesh[] = []
  actor.scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) meshes.push(object) })
  if (meshes.length !== 1) throw new Error(`${body.id}: expected one skinned mesh`)
  const mesh = meshes[0], shape = topology(mesh)
  const joints = jointPairs.map(([upper, lower]) => selectJoint(mesh, upper, lower, shape.edges))
  const kneeRadius = Math.min(...joints.filter(joint => joint.name.startsWith('Shin')).map(joint => joint.radius))
  const currentMixer = new THREE.AnimationMixer(actor.scene), priorMixer = new THREE.AnimationMixer(prior.scene)
  const bonePairs: [THREE.Bone, THREE.Bone][] = []
  actor.scene.traverse(object => {
    if (object instanceof THREE.Bone) {
      const previous = prior.scene.getObjectByName(object.name)
      if (!(previous instanceof THREE.Bone)) throw new Error(`Missing baseline bone ${object.name}`)
      bonePairs.push([object, previous])
    }
  })
  for (const clip of prior.animations) {
    const isKneeRise = clip.name === 'get-up-forward'
    const translationLimit = isKneeRise ? Math.max(.02, kneeRadius) : .02
    const after = actor.animations.find(value => value.name === clip.name)
    let layoutMatches = !!after && after.tracks.length === clip.tracks.length
    let maximumTimeChange = after ? Math.abs(after.duration - clip.duration) : Infinity
    let maximumValueChange = 0
    let maximumQuaternionAngleDegrees = 0
    let maximumUnchangedTrackDifference = 0, maximumHipsTranslationChange = 0
    for (const track of clip.tracks) {
      const next = after?.tracks.find(value => value.name === track.name)
      if (!next || next.times.length !== track.times.length || next.values.length !== track.values.length || next.getInterpolation() !== track.getInterpolation()) {
        layoutMatches = false; continue
      }
      for (let i = 0; i < track.times.length; i++) maximumTimeChange = Math.max(maximumTimeChange, Math.abs(track.times[i] - next.times[i]))
      if (track.name.endsWith('.quaternion')) {
        for (let i = 0; i < track.values.length; i += 4) {
          const beforeRotation = new THREE.Quaternion().fromArray(track.values, i).normalize()
          const afterRotation = new THREE.Quaternion().fromArray(next.values, i).normalize()
          maximumQuaternionAngleDegrees = Math.max(maximumQuaternionAngleDegrees, THREE.MathUtils.radToDeg(beforeRotation.angleTo(afterRotation)))
          const sign = beforeRotation.dot(afterRotation) < 0 ? -1 : 1
          for (let component = 0; component < 4; component++) {
            const delta = Math.abs(track.values[i + component] - sign * next.values[i + component])
            maximumValueChange = Math.max(maximumValueChange, delta)
            if (!/^(Thigh|Shin|Foot)_[LR]\.quaternion$/.test(track.name)) maximumUnchangedTrackDifference = Math.max(maximumUnchangedTrackDifference, delta)
          }
        }
      } else {
        for (let i = 0; i < track.values.length; i++) {
          const delta = Math.abs(track.values[i] - next.values[i])
          maximumValueChange = Math.max(maximumValueChange, delta)
          if (track.name === 'Hips.position') maximumHipsTranslationChange = Math.max(maximumHipsTranslationChange, delta)
          else maximumUnchangedTrackDifference = Math.max(maximumUnchangedTrackDifference, delta)
        }
      }
    }
    check(`${clip.name}: track layout and timing remain; only bounded ground corrections change`,
      layoutMatches && maximumTimeChange < 1e-6 && maximumUnchangedTrackDifference < 1e-5 && maximumHipsTranslationChange <= translationLimit && maximumQuaternionAngleDegrees <= 2,
      { layoutMatches, maximumTimeChange, maximumValueChange, maximumQuaternionAngleDegrees, maximumUnchangedTrackDifference, maximumHipsTranslationChange, translationLimit })
    if (after) {
      currentMixer.stopAllAction(); priorMixer.stopAllAction()
      const actions = [currentMixer.clipAction(after), priorMixer.clipAction(clip)]
      actions.forEach(action => { action.reset().setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play() })
      let maximumWorldPositionChange = 0, maximumRootPositionChange = 0, maximumWorldRotationDegrees = 0
      let maximumHorizontalChange = 0, exceptionalFloorPass = true, exceptionSamples = 0
      let worstPositionBone = '', worstRotationBone = ''
      const a = new THREE.Vector3(), b = new THREE.Vector3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion()
      for (const time of poseTimes(clip, 120)) {
        actions.forEach(action => { action.paused = false; action.time = time })
        currentMixer.update(0); priorMixer.update(0); actor.scene.updateMatrixWorld(true); prior.scene.updateMatrixWorld(true)
        let sampleMaximumChange = 0
        for (const [current, previous] of bonePairs) {
          const delta = current.getWorldPosition(a).distanceTo(previous.getWorldPosition(b))
          maximumHorizontalChange = Math.max(maximumHorizontalChange, Math.hypot(a.x - b.x, a.z - b.z))
          sampleMaximumChange = Math.max(sampleMaximumChange, delta)
          const angle = THREE.MathUtils.radToDeg(current.getWorldQuaternion(qa).normalize().angleTo(previous.getWorldQuaternion(qb).normalize()))
          if (delta > maximumWorldPositionChange) { maximumWorldPositionChange = delta; worstPositionBone = current.name }
          if (angle > maximumWorldRotationDegrees) { maximumWorldRotationDegrees = angle; worstRotationBone = current.name }
          if (current.name === 'Root' || current.name === 'Hips') maximumRootPositionChange = Math.max(maximumRootPositionChange, delta)
        }
        if (isKneeRise && sampleMaximumChange > .02) {
          exceptionSamples++
          mesh.skeleton.update()
          let floor = Infinity
          const positions = mesh.geometry.getAttribute('position')
          for (let vertex = 0; vertex < positions.count; vertex++) {
            a.fromBufferAttribute(positions, vertex)
            mesh.applyBoneTransform(vertex, a).applyMatrix4(mesh.matrixWorld)
            floor = Math.min(floor, a.y)
          }
          const hips = bonePairs.find(([bone]) => bone.name === 'Hips')!
          const delta = hips[0].getWorldPosition(a).sub(hips[1].getWorldPosition(b)).clone()
          exceptionalFloorPass &&= floor >= -.001 && floor <= .02 && Math.hypot(delta.x, delta.z) <= 1e-5 && delta.y >= 0
          groundRebakes.push({ body: body.id, clip: clip.name, time, strokeRadius: kneeRadius, rootDelta: delta.toArray(), minimumSurfaceHeight: floor, heightWithoutRootCorrection: floor - delta.y })
        }
      }
      check(`${clip.name}: ground rebake stays within its measured limit and 2 degrees`,
        maximumWorldPositionChange <= translationLimit && maximumRootPositionChange <= translationLimit && maximumWorldRotationDegrees <= 2 &&
        maximumHorizontalChange <= (exceptionSamples ? 1e-5 : .02) && exceptionalFloorPass,
        { maximumWorldPositionChange, maximumRootPositionChange, maximumWorldRotationDegrees, maximumHorizontalChange, worstPositionBone, worstRotationBone, samples: poseTimes(clip, 120).length,
          translationLimit, exceptionSamples, exceptionalFloorPass, exceptionReason: isKneeRise ? 'The restored round knee needs vertical floor clearance. This recovery is not a grounded clip. Correction cannot exceed the measured knee stroke radius. Samples above 20 mm must retain a surface height from -1 to 20 mm and no horizontal shift. The 20 mm surface guard applies only to these recovery samples.' : null })
    }
  }
  currentMixer.stopAllAction(); priorMixer.stopAllAction(); currentMixer.uncacheRoot(actor.scene); priorMixer.uncacheRoot(prior.scene)
  disposeInstance(prior.scene)
  check('one skinned mesh and one material', meshes.length === 1 && meshes.every(mesh => !Array.isArray(mesh.material) || mesh.material.length === 1),
    { meshes: meshes.length })
  bodies.push({ id: body.id, sha256: hashes[`${root}/characters/${body.id}.glb`], parts: shape.parts, triangles: shape.triangles, bones: mesh.skeleton.bones.length })
  check('ten surface parts and 18 bones', shape.parts === 10 && mesh.skeleton.bones.length === 18,
    { parts: shape.parts, bones: mesh.skeleton.bones.length, triangles: shape.triangles })
  for (const joint of joints) check(`${joint.name}: joint surface is measurable`, joint.vertices.length >= 8 && joint.edges.length >= 8,
    { vertices: joint.vertices.length, edges: joint.edges.length, radius: joint.radius })
  const mixer = new THREE.AnimationMixer(actor.scene)
  const point = new THREE.Vector3(), pivot = new THREE.Vector3()
  for (const thickness of [.7, 1, 1.3]) {
    mixer.stopAllAction(); actor.scene.updateMatrixWorld(true)
    applyAvatar(actor.scene, { ...DEFAULT_AVATAR, preset: body.id, thickness, headwear: 'none' })
    const position = mesh.geometry.getAttribute('position')
    const rests = joints.map(joint => ({
      radii: joint.vertices.map(vertex => point.fromBufferAttribute(position, vertex).distanceTo(joint.pivot)),
      lengths: joint.edges.map(([a, b]) => new THREE.Vector3().fromBufferAttribute(position, a).distanceTo(point.fromBufferAttribute(position, b))),
    }))
    for (let index = 0; index < joints.length; index++) {
      const ratios = rests[index].radii.map(radius => radius / (joints[index].radius * thickness))
      check(`${joints[index].name}: thickness ${thickness} retains the round surface`, Math.min(...ratios) > .995 && Math.max(...ratios) < 1.03,
        { minimumRadiusRatio: Math.min(...ratios), maximumRadiusRatio: Math.max(...ratios) })
    }
    for (const clip of actor.animations) {
      mixer.stopAllAction()
      const action = mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = true; action.play()
      const times = poseTimes(clip)
      const results = joints.map(() => ({ minimumRadiusRatio: Infinity, maximumRadiusRatio: 0, minimumEdgeRatio: Infinity, maximumEdgeRatio: 0 }))
      for (const time of times) {
        action.paused = false; action.time = time; mixer.update(0); actor.scene.updateMatrixWorld(true); mesh.skeleton.update()
        joints.forEach((joint, index) => {
          joint.bone.getWorldPosition(pivot); mesh.worldToLocal(pivot)
          const posed = new Map(joint.vertices.map(vertex => {
            const value = new THREE.Vector3().fromBufferAttribute(position, vertex)
            mesh.applyBoneTransform(vertex, value)
            return [vertex, value] as const
          }))
          const result = results[index], rest = rests[index]
          joint.vertices.forEach((vertex, i) => {
            const ratio = posed.get(vertex)!.distanceTo(pivot) / rest.radii[i]
            result.minimumRadiusRatio = Math.min(result.minimumRadiusRatio, ratio)
            result.maximumRadiusRatio = Math.max(result.maximumRadiusRatio, ratio)
          })
          joint.edges.forEach(([a, b], i) => {
            const ratio = posed.get(a)!.distanceTo(posed.get(b)!) / rest.lengths[i]
            result.minimumEdgeRatio = Math.min(result.minimumEdgeRatio, ratio)
            result.maximumEdgeRatio = Math.max(result.maximumEdgeRatio, ratio)
          })
        })
      }
      results.forEach((result, index) => check(`${clip.name}/${joints[index].name}: thickness ${thickness} does not compress`,
        Object.values(result).every(Number.isFinite) && result.minimumRadiusRatio > .995 && result.maximumRadiusRatio < 1.005 && result.minimumEdgeRatio > .995 && result.maximumEdgeRatio < 1.005,
        { ...result, samples: times.length, thickness, clip: clip.name, joint: joints[index].name }))
    }
  }
  mixer.stopAllAction(); mixer.uncacheRoot(actor.scene); disposeInstance(actor.scene)
}
const failures = checks.filter(check => !check.pass)
const pass = bodies.length > 0 && failures.length === 0
await mkdir(dirname(output), { recursive: true })
await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(), pass, hashes, bodies, checks, failures, groundRebakes,
  sampleRate: 12, preservationSampleRate: 120, thicknesses: [.7, 1, 1.3],
  scope: 'Exported elbow and knee surface radii and local edge lengths at 12 Hz and authored poses. Runtime avatar thickness is applied. All 85 animation layouts and times remain. Unchanged authoring is checked. Ground rebakes may change Hips translation and leg rotations within 20 mm and 2 degrees; other track values retain a 1e-5 tolerance. World bone comparison uses 120 Hz. Only get-up-forward may exceed 20 mm: its vertical correction is limited to one measured knee radius, with no horizontal shift and a strict surface floor band. This test does not assess outline pixels.',
}, null, 2) + '\n')
console.log(JSON.stringify({ pass, bodies: bodies.length, checks: checks.length, failures }, null, 2))
if (!pass) process.exitCode = 1

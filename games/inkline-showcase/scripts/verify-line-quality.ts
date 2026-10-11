import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

const directory = resolve(process.argv[2] ?? 'public/assets')
const output = process.argv[3] ?? 'docs/verification/correction/line-quality.json'
const baseline = process.argv[4]
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

function connectedParts(geometry: THREE.BufferGeometry): number {
  const positions = geometry.getAttribute('position')
  const parents = Array.from({ length: positions.count }, (_, index) => index)
  const find = (index: number): number => {
    while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index] }
    return index
  }
  const indices = geometry.index
  const vertex = (index: number) => indices ? indices.getX(index) : index
  for (let index = 0; index < (indices?.count ?? positions.count); index += 3) {
    const root = find(vertex(index))
    parents[find(vertex(index + 1))] = root
    parents[find(vertex(index + 2))] = root
  }
  return new Set(parents.map((_, index) => find(index))).size
}

async function inspect(root: string) {
  const catalog = JSON.parse(await readFile(resolve(root, 'characters.json'), 'utf8')) as {models: {id: string}[]}
  const bodies = []
  let maximumBend = 0, squaredBend = 0, samples = 0
  for (const {id} of catalog.models) {
    const bytes = await readFile(resolve(root, 'characters', `${id}.glb`))
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
    const bones = new Map<string, THREE.Bone>()
    let parts = 0, triangles = 0
    gltf.scene.traverse(object => {
      if (object instanceof THREE.Bone) bones.set(object.name, object)
      if (object instanceof THREE.SkinnedMesh) {
        parts += connectedParts(object.geometry)
        triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3
      }
    })
    const chain = ['Hips', 'Spine', 'Chest', 'Neck'].map(name => {
      const bone = bones.get(name)
      if (!bone) throw new Error(`Missing ${name} in ${id}`)
      return bone
    })
    const mixer = new THREE.AnimationMixer(gltf.scene)
    const points = chain.map(() => new THREE.Vector3())
    const segments = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
    const clips = []
    for (const clip of gltf.animations) {
      mixer.stopAllAction()
      const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = true; action.play()
      const steps = Math.ceil(clip.duration * 60)
      let peak = 0
      for (let frame = 0; frame <= steps; frame++) {
        action.paused = false; action.time = clip.duration * frame / steps
        mixer.update(0); gltf.scene.updateMatrixWorld(true)
        chain.forEach((bone, index) => bone.getWorldPosition(points[index]))
        segments.forEach((segment, index) => segment.subVectors(points[index + 1], points[index]).normalize())
        const bend = THREE.MathUtils.radToDeg(segments[0].angleTo(segments[1]) + segments[1].angleTo(segments[2]))
        if (!Number.isFinite(bend)) throw new Error(`${id}/${clip.name}: invalid spine`)
        peak = Math.max(peak, bend); maximumBend = Math.max(maximumBend, bend)
        squaredBend += bend * bend; samples++
      }
      clips.push({id: clip.name, maximumBendDegrees: peak})
    }
    bodies.push({id, sha256: hash(bytes), parts, triangles, clips})
  }
  return {bodies, samples, maximumBendDegrees: maximumBend, rmsBendDegrees: Math.sqrt(squaredBend / samples)}
}

const current = await inspect(directory)
const before = baseline ? await inspect(resolve(baseline)) : undefined
const failures = current.bodies.flatMap(body => [
  ...(body.parts === 10 ? [] : [`${body.id}: expected head, torso, and eight rounded limb sections; found ${body.parts} parts`]),
  ...body.clips.filter(clip => clip.maximumBendDegrees > 13).map(clip => `${body.id}/${clip.id}: excessive torso bend ${clip.maximumBendDegrees}`),
])
if (before && current.rmsBendDegrees > before.rmsBendDegrees * .4) failures.push('The mean torso bend did not fall by at least 60%.')
const report = {checkedAt: new Date().toISOString(), pass: failures.length === 0, sourceSHA256: hash(await readFile('scripts/blender/characters.py')), sampleRate: 60, ...current, before: before && {samples: before.samples, maximumBendDegrees: before.maximumBendDegrees, rmsBendDegrees: before.rmsBendDegrees, connectedParts: before.bodies.map(body => ({id: body.id, parts: body.parts}))}, failures}
await writeFile(output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({pass: report.pass, bodies: current.bodies.length, samples: current.samples, maximumBendDegrees: current.maximumBendDegrees, rmsBendDegrees: current.rmsBendDegrees, previousRmsBendDegrees: before?.rmsBendDegrees, failures}, null, 2))
if (failures.length) process.exitCode = 1

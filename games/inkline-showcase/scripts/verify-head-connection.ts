import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile } from 'node:fs/promises'
import { applyAvatar } from '../src/runtime/assets'
import { DEFAULT_AVATAR, type ModelEntry } from '../src/types'

const catalog = JSON.parse(await readFile('public/assets/characters.json', 'utf8')) as { models: ModelEntry[] }
const results: { body: string; headScale: number; clip: string; minimumOverlap: number; pass: boolean }[] = []
for (const body of catalog.models) for (const headScale of [.8, 1, 1.2]) {
  const bytes = await readFile(`public/${body.file}`)
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  applyAvatar(gltf.scene, { ...DEFAULT_AVATAR, preset: body.id, height: 1.15, thickness: 1.3, headScale })
  let mesh: THREE.SkinnedMesh | undefined
  gltf.scene.traverse(object => { if (object instanceof THREE.SkinnedMesh && !object.userData.inkContour) mesh = object })
  if (!mesh) throw new Error(`${body.id}: no skin`)
  const skin = mesh.geometry.getAttribute('skinIndex'), weights = mesh.geometry.getAttribute('skinWeight'), positions = mesh.geometry.getAttribute('position')
  const headIndex = mesh.skeleton.bones.findIndex(bone => bone.name === 'Head')
  const head: number[] = [], neck: number[] = []
  for (let vertex = 0; vertex < positions.count; vertex++) {
    const ids = [skin.getX(vertex), skin.getY(vertex), skin.getZ(vertex), skin.getW(vertex)]
    const values = [weights.getX(vertex), weights.getY(vertex), weights.getZ(vertex), weights.getW(vertex)]
    const amount = values[ids.indexOf(headIndex)] ?? 0
    if (amount > .99) head.push(vertex)
    else if (amount > .29 && amount < .31) neck.push(vertex)
  }
  if (!head.length || !neck.length) throw new Error(`${body.id}: missing head or neck rim vertices`)
  const center = new THREE.Vector3()
  for (const vertex of head) center.add(new THREE.Vector3().fromBufferAttribute(positions, vertex))
  center.divideScalar(head.length)
  const radius = Math.max(...head.map(vertex => new THREE.Vector3().fromBufferAttribute(positions, vertex).distanceTo(center))) * 1.15
  const mixer = new THREE.AnimationMixer(gltf.scene)
  for (const name of ['idle', 'block', 'punch-heavy', 'hit-back', 'get-up-forward', 'stun']) {
    mixer.stopAllAction()
    const clip = gltf.animations.find(clip => clip.name === name)!
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true; action.play()
    let minimumOverlap = Infinity
    const count = Math.ceil(clip.duration * 60)
    for (let frame = 0; frame <= count; frame++) {
      action.paused = false; action.time = clip.duration * frame / count; mixer.update(0)
      gltf.scene.updateMatrixWorld(true)
      const headCenter = mesh.applyBoneTransform(head[0], center.clone()).applyMatrix4(mesh.matrixWorld)
      const neckCenter = new THREE.Vector3(), point = new THREE.Vector3()
      for (const vertex of neck) neckCenter.add(mesh.getVertexPosition(vertex, point).applyMatrix4(mesh.matrixWorld))
      neckCenter.divideScalar(neck.length)
      minimumOverlap = Math.min(minimumOverlap, radius - headCenter.distanceTo(neckCenter))
    }
    results.push({ body: body.id, headScale, clip: name, minimumOverlap, pass: minimumOverlap > .002 })
  }
  mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene)
}
const pass = results.every(result => result.pass)
await writeFile('docs/verification/correction/head-connection.json', JSON.stringify({ checkedAt: new Date().toISOString(), pass, scope: 'Neck rim centre remains inside the scaled head sphere through six motion clips at 60 Hz. Render review checks the visible outline.', results }, null, 2) + '\n')
console.log(JSON.stringify({ pass, pairs: results.length, minimumOverlap: Math.min(...results.map(result => result.minimumOverlap)), failures: results.filter(result => !result.pass) }))
if (!pass) process.exitCode = 1

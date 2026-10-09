import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { EXTRA_LAYOUTS } from '../src/runtime/layouts'
import { DISTRICT_PLACEMENTS } from '../src/runtime/district'
import type { Vec3 } from '../src/types'

const loader = new GLTFLoader()
const ray = new THREE.Raycaster()
const records: unknown[] = []
for (const layout of [{ id: 'industrial-district', placements: DISTRICT_PLACEMENTS, actors: [], inspectionRoute: [] as Vec3[] }, ...EXTRA_LAYOUTS]) {
  const file = `public/assets/scenes/${layout.id}.glb`
  const bytes = await readFile(file)
  const data = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString()) as { nodes: { name: string }[] }
  if (data.nodes.length !== layout.placements.length) throw new Error(`${layout.id}: ${data.nodes.length} nodes for ${layout.placements.length} placements`)
  if (new Set(data.nodes.map(node => node.name)).size !== data.nodes.length) throw new Error(`${layout.id}: duplicate node names`)
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const root = gltf.scene
  root.updateMatrixWorld(true)
  let meshes = 0, triangles = 0
  root.traverse(object => {
    if (object instanceof THREE.Mesh) { meshes++; triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3 }
  })
  const point = new THREE.Vector3()
  const support: { point: number[]; surfaceY: number | null; error: number | null; pass: boolean }[] = []
  const check = (position: THREE.Vector3) => {
    ray.set(position.clone().add(new THREE.Vector3(0, .13, 0)), new THREE.Vector3(0, -1, 0))
    ray.near = 0; ray.far = .27
    const hits = ray.intersectObject(root, true)
    const surfaceY = hits[0]?.point.y ?? null
    const error = surfaceY === null ? null : Math.abs(surfaceY - position.y)
    support.push({ point: position.toArray(), surfaceY, error, pass: error !== null && error < .131 })
  }
  for (const actor of layout.actors) check(point.fromArray(actor.at))
  const route = layout.inspectionRoute ?? []
  for (let index = 1; index < route.length; index++) {
    const from = new THREE.Vector3(...route[index - 1]), to = new THREE.Vector3(...route[index])
    const steps = Math.max(1, Math.ceil(from.distanceTo(to) / .1))
    for (let step = 0; step <= steps; step++) check(point.copy(from).lerp(to, step / steps))
  }
  const failed = support.filter(sample => !sample.pass)
  records.push({ id: layout.id, file, sha256: createHash('sha256').update(bytes).digest('hex'), placements: data.nodes.length, primitiveMeshes: meshes, triangles, routePoints: route.length, supportSamples: support.length, failed })
  console.log(`${layout.id}: ${data.nodes.length} placements, ${triangles} triangles, ${support.length} support checks, ${failed.length} failures`)
  root.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose() } })
}
await writeFile('docs/verification/expansion/level-support.json', JSON.stringify({ checkedAt: new Date().toISOString(), scenes: records }, null, 2) + '\n')
if (records.some(record => (record as { failed: unknown[] }).failed.length)) throw new Error('A scene has an unsupported actor or route point. Read level-support.json.')

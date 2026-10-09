import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile } from 'node:fs/promises'
import type { PackManifest } from '../src/types'

const manifest = JSON.parse(await readFile('public/assets/manifest.json', 'utf8')) as PackManifest
const assetRoot = process.env.INKLINE_ASSET_ROOT ?? 'public'
const body = process.argv.find(value => value.startsWith('--body='))?.slice(7)
const clipId = process.argv.find(value => value.startsWith('--clip='))?.slice(7)
const hz = 240
const results: { body: string; clip: string; samples: number; duration: number; minimum: number; maximum: number; pass: boolean }[] = []
let expectedPairs = 0
const contract = clipId ? null : JSON.parse(await readFile(`${assetRoot}/assets/sample-pose-metrics.json`, 'utf8')) as { groundContact: Record<string, { clip: string; grounded: boolean }[]> }
for (const entry of manifest.models.filter(entry => entry.kind === 'character' && (!body || entry.id === body))) {
  const bytes = await readFile(`${assetRoot}/${entry.file}`)
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  if (gltf.animations.length !== manifest.animations.length) throw new Error(`${entry.id}: clip count differs from the catalog`)
  const meshes: THREE.SkinnedMesh[] = []
  gltf.scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) meshes.push(object) })
  const grounded = new Set(contract?.groundContact[entry.id].filter(clip => clip.grounded).map(clip => clip.clip) ?? [clipId])
  if (!grounded.size) throw new Error(`${entry.id}: no grounded clip contract`)
  expectedPairs += grounded.size
  for (const clip of gltf.animations.filter(clip => grounded.has(clip.name))) {
    const expected = manifest.animations.find(entry => entry.id === clip.name)!
    if (Math.abs(clip.duration - expected.duration) > .001) throw new Error(`${entry.id}/${clip.name}: duration changed`)
    if (expected.contactTime !== undefined && !clip.tracks.some(track => [...track.times].some(time => Math.abs(time - expected.contactTime!) < .00051))) throw new Error(`${entry.id}/${clip.name}: contact key missing`)
    const mixer = new THREE.AnimationMixer(gltf.scene)
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true; action.play()
    let minimum = Infinity, maximum = -Infinity, samples = 0
    for (let sample = 0; sample <= Math.ceil(clip.duration * hz); sample++) {
      action.paused = false; action.time = Math.min(clip.duration, sample / hz); mixer.update(0)
      gltf.scene.updateMatrixWorld(true)
      for (const mesh of meshes) mesh.computeBoundingBox()
      const floor = new THREE.Box3().setFromObject(gltf.scene).min.y
      minimum = Math.min(minimum, floor); maximum = Math.max(maximum, floor); samples++
    }
    results.push({ body: entry.id, clip: clip.name, samples, duration: clip.duration, minimum, maximum, pass: Number.isFinite(minimum) && Number.isFinite(maximum) && minimum >= -.001 && maximum <= .015 })
    mixer.stopAllAction(); mixer.uncacheRoot(gltf.scene)
  }
}
if (!results.length || results.length !== expectedPairs) throw new Error(`Grounded coverage differs: ${results.length}/${expectedPairs}`)
const report = { checkedAt: new Date().toISOString(), sampleRate: hz, expectedPairs, floorBand: [-.001, .015], pass: results.every(result => result.pass), results }
const output = body || clipId ? '.cache/grounded-export-probe.json' : 'docs/verification/kinetic/grounded-export.json'
await writeFile(output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ pass: report.pass, pairs: results.length, minimum: Math.min(...results.map(result => result.minimum)), maximum: Math.max(...results.map(result => result.maximum)), failures: results.filter(result => !result.pass) }, null, 2))
if (!report.pass) process.exitCode = 1

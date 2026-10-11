import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { applyAvatar } from '../src/runtime/assets'
import { DEFAULT_AVATAR, type ModelEntry } from '../src/types'

const assets = resolve(process.argv[2] ?? 'public/assets')
const output = process.argv[3] ?? 'docs/verification/correction/avatar-contact.json'
const catalog = JSON.parse(await readFile(resolve(assets, 'characters.json'), 'utf8')) as { models: ModelEntry[] }
const clips = ['idle', 'block', 'punch-left', 'punch-right', 'punch-heavy', 'kick-front', 'sword-slash',
  'kick-roundhouse', 'elbow-strike', 'uppercut', 'hammer-overhead', 'shield-slam', 'crouch-idle', 'crouch-walk']
const results: { body: string; clip: string; thickness: number; minimum: number; maximum: number; pass: boolean }[] = []
for (const body of catalog.models) {
  const bytes = await readFile(resolve(assets, 'characters', `${body.id}.glb`))
  for (const thickness of [.7, 1, 1.3]) {
    const { scene, animations } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
    applyAvatar(scene, { ...DEFAULT_AVATAR, preset: body.id, thickness, headwear: 'none' })
    const meshes: THREE.SkinnedMesh[] = []
    scene.traverse(object => { if (object instanceof THREE.SkinnedMesh && !object.userData.inkContour) meshes.push(object) })
    const mixer = new THREE.AnimationMixer(scene)
    for (const name of clips) {
      mixer.stopAllAction()
      const clip = animations.find(clip => clip.name === name)
      if (!clip) throw new Error(`${body.id}: missing ${name}`)
      const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = true; action.play()
      let minimum = Infinity, maximum = -Infinity
      const count = Math.ceil(clip.duration * 120)
      for (let frame = 0; frame <= count; frame++) {
        action.paused = false; action.time = clip.duration * frame / count; mixer.update(0)
        scene.updateMatrixWorld(true)
        for (const mesh of meshes) mesh.computeBoundingBox()
        const floor = new THREE.Box3().setFromObject(scene).min.y
        minimum = Math.min(minimum, floor); maximum = Math.max(maximum, floor)
      }
      results.push({ body: body.id, clip: name, thickness, minimum, maximum, pass: minimum >= -.001 && maximum <= .015 })
    }
    mixer.stopAllAction(); mixer.uncacheRoot(scene)
  }
}
const pass = results.length === catalog.models.length * clips.length * 3 && results.every(row => row.pass)
await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(), assets, sampleRate: 120, floorBand: [-.001, .015], pass, results }, null, 2) + '\n')
console.log(JSON.stringify({ pass, pairs: results.length, minimum: Math.min(...results.map(row => row.minimum)), maximum: Math.max(...results.map(row => row.maximum)), failures: results.filter(row => !row.pass) }, null, 2))
if (!pass) process.exitCode = 1

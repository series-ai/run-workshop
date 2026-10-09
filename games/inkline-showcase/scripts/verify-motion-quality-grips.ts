import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { parseManifest } from '../src/catalog'
import { equipmentContactPoint, mountEquipment } from '../src/runtime/assets'

const directory = process.argv[2] ?? '.cache/correction-character-family'
const output = process.argv[3] ?? 'docs/verification/correction/figure-grip-quality.json'
const manifest = parseManifest(JSON.parse(await readFile('public/assets/manifest.json', 'utf8')))
function phases(value: unknown): Map<string, Map<string, number>> {
  if (!value || typeof value !== 'object' || !('animations' in value) || !Array.isArray(value.animations)) throw new Error('Missing animation metadata')
  const result = new Map<string, Map<string, number>>()
  for (const entry of value.animations) {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string') throw new Error('Invalid clip metadata')
    if (!entry.motion) continue
    if (typeof entry.motion !== 'object' || !Array.isArray(entry.motion.phases)) throw new Error('Invalid phase metadata')
    const times = new Map<string, number>()
    for (const phase of entry.motion.phases) {
      if (!phase || typeof phase.name !== 'string' || typeof phase.frame !== 'number' || !Number.isFinite(phase.frame)) throw new Error('Invalid phase')
      times.set(phase.name, phase.frame / 30)
    }
    result.set(entry.id, times)
  }
  return result
}
const clipPhases = phases(JSON.parse(await readFile(`${directory}/characters.json`, 'utf8')))
const entries = manifest.models.filter(entry => entry.kind === 'character' && (!process.argv[4] || entry.id === process.argv[4]))
const cases = [
  ['sword', 'sword-slash'], ['sword', 'sword-overhead'], ['sword', 'sword-thrust'],
  ['sword', 'sword-lunge'], ['sword', 'sword-diagonal'], ['dagger', 'dagger-stab'],
  ['hammer-war', 'hammer-overhead'], ['bat', 'bat-swing'],
  ['shield-riot', 'shield-bash'], ['shield-riot', 'shield-block'],
  ['shield-riot', 'shield-slam'], ['shield-riot', 'shield-push'],
] as const
async function load(id: string) {
  const entry = manifest.models.find(entry => entry.id === id)
  if (!entry) throw new Error(`Missing model ${id}`)
  const bytes = await readFile(entry.kind === 'character' ? `${directory}/characters/${id}.glb` : `public/${entry.file}`)
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  return { entry, root: gltf.scene, clips: gltf.animations }
}
const checks = []
for (const body of entries) {
  const actor = await load(body.id)
  for (const [gear, id] of cases) {
    const weapon = await load(gear)
    mountEquipment(actor.root, weapon, actor.clips, manifest.animations)
    const entry = manifest.animations.find(entry => entry.id === id)
    const action = actor.clips.find(clip => clip.name === id)
    if (!entry || !action) throw new Error(`Missing action ${id}`)
    const mixer = new THREE.AnimationMixer(actor.root)
    mixer.clipAction(action).play()
    for (const phase of ['contact', 'hold'] as const) {
      const time = clipPhases.get(id)?.get(phase)
      if (time === undefined) throw new Error(`${id}: missing ${phase} phase`)
      mixer.setTime(time); actor.root.updateMatrixWorld(true)
      const axis = new THREE.Vector3(0, 1, 0).transformDirection(weapon.root.matrixWorld)
      const front = new THREE.Vector3(0, 0, 1).transformDirection(weapon.root.matrixWorld)
      const tip = equipmentContactPoint(weapon.root)
      const wrist = weapon.root.parent!.getWorldPosition(new THREE.Vector3())
      const pass = id === 'shield-slam' ? axis.z > .8 && front.y < -.8 && tip.y < body.dimensions[1] * .5
        : gear === 'shield-riot' ? axis.y > .8 && front.z > .8
        : id === 'bat-swing' ? Math.abs(axis.x) > .8 && Math.abs(axis.y) < .3 && tip.y > .15
        : ['sword-lunge', 'sword-thrust', 'dagger-stab'].includes(id) ? axis.z > .9 && Math.abs(axis.y) < .3
        : id === 'sword-diagonal' ? axis.x < -.4 && axis.y < -.2 && axis.z > .5 && tip.y > .15
        : id === 'sword-overhead' ? Math.abs(axis.x) < .03 && axis.y < -.2 && axis.z > .9 && tip.y > .15
        : tip.z > wrist.z + .2 && tip.y > .15 && tip.y < body.dimensions[1] * 1.2
      checks.push({ body: body.id, clip: id, phase, pass, axis: axis.toArray(), front: front.toArray(), tip: tip.toArray(), wrist: wrist.toArray() })
    }
    mixer.stopAllAction(); mixer.uncacheRoot(actor.root); weapon.root.removeFromParent()
  }
}
const hashes = await Promise.all(['scripts/blender/characters.py', 'src/runtime/assets.ts', `${directory}/characters.json`].map(async path => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') })))
await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(), hashes, pass: checks.every(check => check.pass), checks }, null, 2) + '\n')
console.log(JSON.stringify({ checks: checks.length, failures: checks.filter(check => !check.pass) }, null, 2))
if (checks.some(check => !check.pass)) process.exitCode = 1

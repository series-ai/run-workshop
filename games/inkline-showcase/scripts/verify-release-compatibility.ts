import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Bone } from 'three'
import type { PackManifest } from '../src/types'

const beforeRoot = '.cache/correction-baseline/inkline-showcase/public'
const afterRoot = 'public'
const before = JSON.parse(await readFile(`${beforeRoot}/assets/manifest.json`, 'utf8')) as PackManifest
const after = JSON.parse(await readFile(`${afterRoot}/assets/manifest.json`, 'utf8')) as PackManifest
const checks: { name: string; pass: boolean; details: unknown }[] = []
for (const oldClip of before.animations) {
  const newClip = after.animations.find(clip => clip.id === oldClip.id)
  checks.push({ name: `${oldClip.id}: catalog contract`, pass: Boolean(newClip && Math.abs(newClip.duration - oldClip.duration) < .001 && newClip.loop === oldClip.loop && (oldClip.contactTime === undefined || newClip.contactTime === oldClip.contactTime)), details: { before: oldClip, after: newClip } })
}
const added = after.animations.filter(clip => !before.animations.some(old => old.id === clip.id)).map(clip => clip.id)
checks.push({ name: 'one new forward recovery clip', pass: added.length === 1 && added[0] === 'get-up-forward', details: added })
const hashes: Record<string, string> = {}
for (const oldModel of before.models.filter(model => model.kind === 'character')) {
  const newModel = after.models.find(model => model.id === oldModel.id)
  if (!newModel) throw new Error(`Missing body: ${oldModel.id}`)
  const loaded = []
  for (const [root, model] of [[beforeRoot, oldModel], [afterRoot, newModel]] as const) {
    const bytes = await readFile(`${root}/${model.file}`)
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
    const bones: string[] = []
    gltf.scene.traverse(object => { if (object instanceof Bone) bones.push(object.name) })
    loaded.push({ bones: bones.sort(), clips: gltf.animations.map(clip => ({ name: clip.name, duration: clip.duration })) })
    hashes[`${root}/${model.file}`] = createHash('sha256').update(bytes).digest('hex')
  }
  const [oldBody, newBody] = loaded
  checks.push({ name: `${oldModel.id}: rig names`, pass: oldBody.bones.length === 18 && JSON.stringify(oldBody.bones) === JSON.stringify(newBody.bones), details: newBody.bones })
  const changed = oldBody.clips.filter(clip => { const current = newBody.clips.find(item => item.name === clip.name); return !current || Math.abs(current.duration - clip.duration) >= .001 })
  checks.push({ name: `${oldModel.id}: exported clip IDs and durations`, pass: newBody.clips.length === 85 && changed.length === 0, details: { beforeCount: oldBody.clips.length, afterCount: newBody.clips.length, changed } })
}
const pass = checks.every(check => check.pass)
await writeFile('docs/verification/correction/release-compatibility.json', JSON.stringify({ checkedAt: new Date().toISOString(), before: before.version, after: after.version, pass, scope: 'Rig names, clip IDs, durations, loop flags, and existing contact times. Motion samples intentionally change.', hashes, checks }, null, 2) + '\n')
console.log(JSON.stringify({ pass, checks: checks.length, failed: checks.filter(check => !check.pass).map(check => check.name) }))
if (!pass) process.exitCode = 1

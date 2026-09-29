import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Bone } from 'three'
import { startAttack, advanceAttack } from '../src/runtime/presentation'
import type { AnimationEntry, PackManifest } from '../src/types'
const before = JSON.parse(await readFile(process.env.INKLINE_TIMING_BASELINE ?? 'docs/verification/polish/timing-baseline.json', 'utf8')) as PackManifest
const after = JSON.parse(await readFile('public/assets/manifest.json', 'utf8')) as PackManifest
const checks: { name: string; pass: boolean; value: unknown }[] = []
const changes: { id: string; beforeDuration: number; duration: number; beforeContact?: number; contact?: number }[] = []
for (const old of before.animations) {
  const current = after.animations.find(clip => clip.id === old.id)
  checks.push({ name: `${old.id}: ID and loop mode remain available`, pass: Boolean(current && current.loop === old.loop), value: { before: old.loop, after: current?.loop } })
  if (!current) continue
  const contact = current.contactTime
  if (current.duration !== old.duration || contact !== old.contactTime) changes.push({ id: old.id, beforeDuration: old.duration, duration: current.duration, beforeContact: old.contactTime, contact })
  if (contact !== undefined) {
    checks.push({ name: `${old.id}: event follows its authored frame`, pass: Number.isInteger(current.contactFrame) && Math.abs(contact - current.contactFrame! / 30) <= .00051 && contact > 0 && contact < current.duration, value: { contact, frame: current.contactFrame, duration: current.duration } })
    for (const dt of [1 / 120, 1 / 60, 1 / 30, .1]) {
      let beat = startAttack(current, 'unarmed', 0), count = 0, premature = false
      for (let elapsed = 0; elapsed <= current.duration + dt; elapsed += dt) {
        const step = advanceAttack(beat, dt); beat = step.beat
        if (step.contact) { count++; premature ||= beat.elapsed < contact }
      }
      checks.push({ name: `${old.id}: one event at ${dt}s steps`, pass: count === 1 && !premature, value: { count, premature } })
    }
  }
}
const hashes: Record<string, string> = {}
for (const model of after.models.filter(model => model.kind === 'character')) {
  const path = `public/${model.file}`, bytes = await readFile(path)
  hashes[path] = createHash('sha256').update(bytes).digest('hex')
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const bones: string[] = []; gltf.scene.traverse(object => { if (object instanceof Bone) bones.push(object.name) })
  const expectedBones = ['Root', 'Hips', 'Spine', 'Chest', 'Neck', 'Head', ...['UpperArm', 'Forearm', 'Hand', 'Thigh', 'Shin', 'Foot'].flatMap(name => [`${name}_L`, `${name}_R`])].sort()
  checks.push({ name: `${model.id}: rig and clip IDs`, pass: JSON.stringify(bones.sort()) === JSON.stringify(expectedBones) && gltf.animations.length === before.animations.length && before.animations.every(clip => gltf.animations.some(current => current.name === clip.id)), value: { bones, clips: gltf.animations.length } })
  for (const entry of after.animations) {
    const clip = gltf.animations.find(clip => clip.name === entry.id)!
    checks.push({ name: `${model.id}/${entry.id}: exported time`, pass: Math.abs(clip.duration - entry.duration) <= .00051 && (entry.motion?.phases ?? []).every(phase => phase.frame >= 1 && phase.frame / 30 <= clip.duration + .001), value: { exported: clip.duration, catalog: entry.duration } })
  }
}
if (process.env.INKLINE_REQUIRE_SAME_TIMING === '1') checks.push({ name: 'Clip durations and contact times stay unchanged', pass: changes.length === 0, value: changes })
const pass = checks.every(check => check.pass)
await writeFile(process.env.INKLINE_TIMING_REPORT ?? 'docs/verification/polish/timing-contract.json', JSON.stringify({ checkedAt: new Date().toISOString(), pass, before: before.version, after: after.version, scope: 'Timing changes are recorded. Rig names, clip IDs, loop flags, catalog events, and exported times are checked.', sourceSHA256: createHash('sha256').update(await readFile('scripts/blender/characters.py')).digest('hex'), hashes, changes, checks }, null, 2) + '\n')
console.log(JSON.stringify({ pass, checks: checks.length, changedTimings: changes.length, failures: checks.filter(check => !check.pass) }))
if (!pass) process.exitCode = 1

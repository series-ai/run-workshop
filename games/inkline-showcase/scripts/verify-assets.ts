import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import type { PackManifest } from '../src/types'

interface Accessor { bufferView?: number; byteOffset?: number; componentType: number; count: number; type: string; min?: number[]; max?: number[] }
interface Primitive { attributes: Record<string, number>; indices?: number; material?: number }
interface Animation { name: string; samplers: { input: number; output: number }[]; channels: { sampler: number; target: { node: number; path: string } }[] }
interface GLTFData {
  asset: { version: string }; accessors: Accessor[]; bufferViews: { byteOffset?: number; byteLength: number; byteStride?: number }[]
  meshes: { primitives: Primitive[] }[]; skins?: { joints: number[]; inverseBindMatrices?: number }[]
  nodes: { name?: string; translation?: number[]; rotation?: number[]; scale?: number[] }[]
  animations?: Animation[]; materials?: { extensions?: Record<string, unknown> }[]
}
function parseGLB(buffer: Buffer): { json: GLTFData; binary: Buffer } {
  assert.equal(buffer.readUInt32LE(0), 0x46546c67, 'GLB magic')
  assert.equal(buffer.readUInt32LE(4), 2, 'GLB version')
  assert.equal(buffer.readUInt32LE(8), buffer.length, 'GLB length')
  const jsonLength = buffer.readUInt32LE(12)
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a)
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8')) as GLTFData
  const binaryOffset = 20 + jsonLength
  assert.equal(buffer.readUInt32LE(binaryOffset + 4), 0x004e4942)
  return { json, binary: buffer.subarray(binaryOffset + 8) }
}
const widthByType: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }
function accessorValues(data: ReturnType<typeof parseGLB>, id: number): number[] {
  const accessor = data.json.accessors[id]
  assert(accessor && accessor.bufferView !== undefined, `Accessor ${id} exists`)
  const view = data.json.bufferViews[accessor.bufferView]
  const width = widthByType[accessor.type]
  assert(width)
  const bytes = accessor.componentType === 5126 || accessor.componentType === 5125 ? 4 : accessor.componentType === 5123 ? 2 : 1
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  const stride = view.byteStride ?? width * bytes
  const values: number[] = []
  for (let i = 0; i < accessor.count; i++) for (let j = 0; j < width; j++) {
    const offset = start + i * stride + j * bytes
    assert(offset + bytes <= data.binary.length, 'Accessor stays inside binary data')
    const value = accessor.componentType === 5126 ? data.binary.readFloatLE(offset) : bytes === 4 ? data.binary.readUInt32LE(offset) : bytes === 2 ? data.binary.readUInt16LE(offset) : data.binary.readUInt8(offset)
    assert(Number.isFinite(value), 'Finite accessor values'); values.push(value)
  }
  return values
}
const root = resolve('public')
const manifest = JSON.parse(await readFile(resolve(root, 'assets/manifest.json'), 'utf8')) as PackManifest
const ids = new Set<string>(), hashes = new Map<string, string>(), clips = new Set(manifest.animations.map(clip => clip.id))
assert.equal(clips.size, 85)
assert(clips.has('get-up-forward'), 'Forward fall has a separate recovery clip')
const characters = manifest.models.filter(model => model.kind === 'character')
const props = manifest.models.filter(model => model.kind === 'prop')
assert.equal(characters.length, 12); assert.equal(props.length, 291)
assert.equal(props.filter(model => model.category === 'industrial').length, 185)
let bytes = 0, triangles = 0, contactEventsChecked = 0
const warnings: string[] = []
const boneNames = ['Root', 'Hips', 'Spine', 'Chest', 'Neck', 'Head', 'UpperArm_L', 'Forearm_L', 'Hand_L', 'UpperArm_R', 'Forearm_R', 'Hand_R', 'Thigh_L', 'Shin_L', 'Foot_L', 'Thigh_R', 'Shin_R', 'Foot_R']
for (const model of manifest.models) {
  assert(!ids.has(model.id), `Unique id ${model.id}`); ids.add(model.id)
  assert(model.file.startsWith('assets/') && !model.file.includes('..'))
  assert(model.dimensions.every(value => Number.isFinite(value) && value > 0))
  const buffer = await readFile(resolve(root, model.file)), data = parseGLB(buffer)
  const hash = createHash('sha256').update(buffer).digest('hex')
  assert(!hashes.has(hash), `${model.id} is not a byte copy of ${hashes.get(hash)}`); hashes.set(hash, model.id)
  let fileTriangles = 0
  for (const mesh of data.json.meshes) for (const primitive of mesh.primitives) {
    const positions = accessorValues(data, primitive.attributes.POSITION)
    assert(positions.length >= 9, `${model.id} has real geometry`)
    const indices = primitive.indices === undefined ? null : accessorValues(data, primitive.indices)
    if (indices) assert(indices.every(index => index < positions.length / 3), `${model.id} indices stay in range`)
    fileTriangles += (indices?.length ?? positions.length / 3) / 3
    if (model.kind === 'character') {
      assert(primitive.attributes.JOINTS_0 !== undefined && primitive.attributes.WEIGHTS_0 !== undefined)
      const weights = accessorValues(data, primitive.attributes.WEIGHTS_0)
      for (let i = 0; i < weights.length; i += 4) assert(Math.abs(weights.slice(i, i + 4).reduce((sum, value) => sum + value, 0) - 1) < .002, `${model.id} normalized skin weights`)
    }
  }
  assert.equal(fileTriangles, model.triangles, `${model.id} catalog triangle count`)
  assert(fileTriangles <= (model.kind === 'character' ? 2500 : 3000), `${model.id} triangle budget`)
  assert(data.json.materials?.every(material => material.extensions?.KHR_materials_unlit !== undefined), `${model.id} flat unlit materials`)
  if (model.kind === 'character') {
    assert(data.json.skins?.length)
    const actualNames = new Set(data.json.nodes.map(node => node.name))
    boneNames.forEach(name => assert(actualNames.has(name), `${model.id} bone ${name}`))
    assert.equal(data.json.animations?.length, clips.size)
    const motionHashes = new Set<string>()
    for (const animation of data.json.animations ?? []) {
      assert(clips.has(animation.name), `${model.id} expected clip ${animation.name}`)
      const digest = createHash('sha256')
      const entry = manifest.animations.find(clip => clip.id === animation.name)!
      if (entry.contactTime !== undefined) {
        assert(Number.isInteger(entry.contactFrame) && entry.contactFrame! > 0, `${model.id}/${animation.name} has an authored frame`)
        const firstKey = Math.min(...animation.samplers.map(sampler => accessorValues(data, sampler.input)[0]))
        const exportedContact = firstKey + (entry.contactFrame! - 1) / 30
        assert(Math.abs(entry.contactTime - exportedContact) <= .00051, `${model.id}/${animation.name} contact matches exported frame time`)
        contactEventsChecked++
      }
      for (const channel of animation.channels) {
        const sampler = animation.samplers[channel.sampler]
        const times = accessorValues(data, sampler.input), values = accessorValues(data, sampler.output)
        assert(times.length > 1 && times.at(-1)! > times[0], `${model.id}/${animation.name} has a duration`)
        assert(times.every((time, index) => !index || time > times[index - 1]), 'Animation times increase')
        digest.update(JSON.stringify([channel.target, times, values]))
        if (manifest.animations.find(clip => clip.id === animation.name)?.loop) {
          const width = widthByType[data.json.accessors[sampler.output].type]
          for (let i = 0; i < width; i++) assert(Math.abs(values[i] - values[values.length - width + i]) < .002, `${model.id}/${animation.name} loop closes`)
        }
      }
      const signature = digest.digest('hex')
      assert(!motionHashes.has(signature), `${model.id}/${animation.name} distinct animation data`); motionHashes.add(signature)
    }
  }
  try { assert((await stat(resolve(root, model.thumbnail))).size > 100) } catch { warnings.push(`Preview missing: ${model.id}`) }
  bytes += buffer.length; triangles += fileTriangles
}
const report = { checkedAt: new Date().toISOString(), characters: characters.length, props: props.length,
  industrial: props.filter(model => model.category === 'industrial').length, animationsPerCharacter: clips.size,
  contactEventsChecked, totalTriangles: triangles, totalGLBBytes: bytes, maxTriangles: Math.max(...manifest.models.map(model => model.triangles)), warnings }
await mkdir('docs/verification', { recursive: true })
await writeFile('docs/verification/asset-report.json', JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
if (process.argv.includes('--require-previews')) assert.equal(warnings.length, 0, 'All previews exist')

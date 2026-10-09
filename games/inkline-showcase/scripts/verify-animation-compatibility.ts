// Historical expansion check. The kinetic pass intentionally changes existing motion samples.
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

type GLTF = {
  nodes: { name?: string }[]
  accessors: { bufferView: number; byteOffset?: number; componentType: number; count: number; type: string }[]
  bufferViews: { byteOffset?: number; byteStride?: number }[]
  animations: { name: string; samplers: { input: number; output: number; interpolation?: string }[]; channels: { sampler: number; target: { node: number; path: string } }[] }[]
}
function parse(bytes: Buffer) {
  const length = bytes.readUInt32LE(12)
  return { json: JSON.parse(bytes.subarray(20, 20 + length).toString()) as GLTF, binary: bytes.subarray(28 + length) }
}
function signatures(file: ReturnType<typeof parse>) {
  const data = file.json
  const accessor = (id: number) => {
    const a = data.accessors[id], view = data.bufferViews[a.bufferView]
    const width = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 } as Record<string, number>)[a.type]
    const componentBytes = ({ 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 } as Record<number, number>)[a.componentType]
    const rowBytes = width * componentBytes, start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0)
    const hash = createHash('sha256')
    for (let row = 0; row < a.count; row++) {
      const offset = start + row * (view.byteStride ?? rowBytes)
      hash.update(file.binary.subarray(offset, offset + rowBytes))
    }
    return hash.digest('hex')
  }
  return new Map(data.animations.map(animation => [animation.name, createHash('sha256').update(JSON.stringify(animation.channels.map(channel => {
    const sampler = animation.samplers[channel.sampler]
    return { bone: data.nodes[channel.target.node].name, path: channel.target.path, interpolation: sampler.interpolation ?? 'LINEAR', input: accessor(sampler.input), output: accessor(sampler.output) }
  }).sort((a, b) => `${a.bone}/${a.path}`.localeCompare(`${b.bone}/${b.path}`)))).digest('hex')]))
}
const previousPack = process.env.INKLINE_PREVIOUS_PACK ?? join(homedir(), 'dev/jam-ready-assets/run-inkline')
const manifest = JSON.parse(await readFile('public/assets/characters.json', 'utf8')) as { models: { id: string; file: string }[] }
const results = []
for (const model of manifest.models) {
  const before = signatures(parse(await readFile(join(previousPack, '3D/characters', `${model.id}.glb`))))
  const after = signatures(parse(await readFile(join('public', model.file))))
  const changed = [...before].filter(([id, signature]) => after.get(id) !== signature).map(([id]) => id)
  results.push({ id: model.id, previousClips: before.size, currentClips: after.size, added: [...after.keys()].filter(id => !before.has(id)), changed })
}
await writeFile('docs/verification/expansion/animation-compatibility.json', JSON.stringify({ checkedAt: new Date().toISOString(), previousPack, results }, null, 2) + '\n')
if (results.some(result => result.changed.length)) throw new Error('Existing animation samples changed. Read animation-compatibility.json.')
console.log(`Preserved ${results.reduce((sum, result) => sum + result.previousClips, 0)} previous animation tracks across ${results.length} characters.`)

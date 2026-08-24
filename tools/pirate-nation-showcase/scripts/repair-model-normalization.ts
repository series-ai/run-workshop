/**
 * Repairs the vertex-baked Y-normalization in the Pirate Nation pack GLBs.
 * The extractor added `normalizedShift` to the mesh vertex data. It must add
 * the shift to the root transform. As a result, each rotated part of a
 * composite model moved away from its pivot. Subtract the shift to restore
 * the upstream pose. Use --verify to compare the result with upstream.
 *
 * Usage:
 *   node --import tsx scripts/repair-model-normalization.ts [--dry-run|--verify]
 */
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Box3, Matrix4, Quaternion, Vector3 } from 'three'

const SHOWCASE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PACK_RUNTIME = join(SHOWCASE_ROOT, 'public/assets/pirate-nation/runtime')
const MODELS_JSON = join(PACK_RUNTIME, 'models.json')

const UPSTREAM_BASE =
  'https://media.githubusercontent.com/media/proofofplay/piratenation-game/' +
  'dc921b650c8a1d7c449b2a3553949d3e7c8266e9/'

/** Models spot-checked against upstream during diagnosis: placeholder and
 * real art, skinned and non-skinned, single- and multi-part. */
const VERIFY_SAMPLE = [
  'buildings-bldg-5x5-bank',
  'world-bosses-creature-16x16-kraken',
  'ships-building-4x7-shipwright-lv1',
  'ships-item-4x8-pirateshipsmallundead',
  'ships-pn-galleon-optimized-x1',
] as const

export interface ModelEntry {
  id: string
  relativePath: string
  sourceRelativePath: string
  sizeBytes: number
  normalizedShift: number
  bounds: { min: number[]; max: number[]; size: number[] }
}

export interface GltfAccessor {
  bufferView: number
  byteOffset?: number
  componentType: number
  count: number
  type: string
  min?: number[]
  max?: number[]
  sparse?: unknown
}

export interface Gltf {
  scene?: number
  scenes: { nodes: number[] }[]
  nodes: {
    name?: string
    mesh?: number
    skin?: number
    children?: number[]
    translation?: number[]
    rotation?: number[]
    scale?: number[]
  }[]
  meshes: { primitives: { attributes: Record<string, number> }[] }[]
  accessors: GltfAccessor[]
  bufferViews: { buffer?: number; byteOffset?: number; byteStride?: number }[]
}

const GLB_MAGIC = 0x46546c67
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942
const FLOAT32 = 5126

export function parseGlb(buf: Buffer): { gltf: Gltf; binStart: number } {
  if (buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error('not a GLB (bad magic)')
  if (buf.readUInt32LE(4) !== 2) throw new Error('expected GLB version 2')
  const jsonLen = buf.readUInt32LE(12)
  if (buf.readUInt32LE(16) !== CHUNK_JSON) throw new Error('chunk 0 is not JSON')
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as Gltf
  const binStart = 20 + jsonLen + 8
  if (binStart > buf.length || buf.readUInt32LE(binStart - 4) !== CHUNK_BIN) {
    throw new Error('chunk 1 is not BIN')
  }
  return { gltf, binStart }
}

export function writeGlb(gltf: Gltf, bin: Buffer): Buffer {
  let json = Buffer.from(JSON.stringify(gltf), 'utf8')
  const pad = (4 - (json.length % 4)) % 4
  if (pad) json = Buffer.concat([json, Buffer.from(' '.repeat(pad))])
  const out = Buffer.alloc(12 + 8 + json.length + 8 + bin.length)
  out.writeUInt32LE(GLB_MAGIC, 0)
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(out.length, 8)
  out.writeUInt32LE(json.length, 12)
  out.writeUInt32LE(CHUNK_JSON, 16)
  json.copy(out, 20)
  out.writeUInt32LE(bin.length, 20 + json.length)
  out.writeUInt32LE(CHUNK_BIN, 20 + json.length + 4)
  bin.copy(out, 20 + json.length + 8)
  return out
}

/** POSITION accessor indices, deduped — primitives share accessors. */
export function positionAccessorIndices(gltf: Gltf): number[] {
  const indices = new Set<number>()
  for (const mesh of gltf.meshes) {
    for (const prim of mesh.primitives) indices.add(prim.attributes.POSITION)
  }
  return [...indices]
}

/** Throws if any POSITION accessor cannot be patched in place. The preflight
 * calls this on every model before the first write, and the patch path calls
 * it again. A bad model then aborts the run instead of half-patching the pack.
 * Pass `binLength` to also check that each accessor stays inside the BIN
 * chunk. Every check covers a case the current pack does not contain. */
export function validatePositionAccessors(gltf: Gltf, binLength?: number): void {
  for (const ai of positionAccessorIndices(gltf)) {
    const acc = gltf.accessors[ai]!
    if (acc.sparse) throw new Error(`accessor ${ai}: sparse POSITION not supported`)
    if (acc.componentType !== FLOAT32 || acc.type !== 'VEC3') {
      throw new Error(`accessor ${ai}: expected float32 VEC3 POSITION`)
    }
    if (acc.min?.length !== 3 || acc.max?.length !== 3) {
      throw new Error(`accessor ${ai}: POSITION needs 3-component min and max`)
    }
    const view = gltf.bufferViews[acc.bufferView]
    if (!view) throw new Error(`accessor ${ai}: missing bufferView ${acc.bufferView}`)
    if (binLength !== undefined) {
      const stride = view.byteStride ?? 12
      const start = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0)
      const end = start + (acc.count - 1) * stride + 12
      if (start < 0 || end > binLength) {
        throw new Error(`accessor ${ai}: reaches byte ${end} of a ${binLength}-byte BIN chunk`)
      }
    }
  }
}

/** Adds `deltaY` to every POSITION Y float in `buf` and to accessor min/max. */
export function applyShiftToPositions(
  buf: Buffer,
  binStart: number,
  gltf: Gltf,
  deltaY: number,
): void {
  validatePositionAccessors(gltf, buf.length - binStart)
  for (const ai of positionAccessorIndices(gltf)) {
    const acc = gltf.accessors[ai]!
    const view = gltf.bufferViews[acc.bufferView]!
    const stride = view.byteStride ?? 12
    const start = binStart + (view.byteOffset ?? 0) + (acc.byteOffset ?? 0)
    for (let i = 0; i < acc.count; i++) {
      const off = start + i * stride + 4
      buf.writeFloatLE(buf.readFloatLE(off) + deltaY, off)
    }
    acc.min![1]! += deltaY // min/max presence is guaranteed by the validator
    acc.max![1]! += deltaY
  }
}

// --- Assembled-pose bounds ---

function nodeLocalMatrix(node: Gltf['nodes'][number]): Matrix4 {
  return new Matrix4().compose(
    new Vector3().fromArray(node.translation ?? [0, 0, 0]),
    new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
    new Vector3().fromArray(node.scale ?? [1, 1, 1]),
  )
}

/** World-space AABB over the assembled pose. Skinned nodes are posed by
 * their joints, so per the glTF spec their node transform is ignored. */
export function computeAssembledBounds(gltf: Gltf): ModelEntry['bounds'] {
  const identity = new Matrix4()
  const world: (Matrix4 | null)[] = new Array(gltf.nodes.length).fill(null)
  const walk = (ni: number, parent: Matrix4): void => {
    const m = new Matrix4().multiplyMatrices(parent, nodeLocalMatrix(gltf.nodes[ni]!))
    world[ni] = m
    for (const c of gltf.nodes[ni]!.children ?? []) walk(c, m)
  }
  for (const ni of gltf.scenes[gltf.scene ?? 0]!.nodes) walk(ni, identity)

  const bounds = new Box3() // starts empty: min +Inf, max -Inf
  gltf.nodes.forEach((node, i) => {
    if (node.mesh === undefined) return
    const m = node.skin !== undefined ? identity : world[i]!
    for (const prim of gltf.meshes[node.mesh]!.primitives) {
      const acc = gltf.accessors[prim.attributes.POSITION]!
      const box = new Box3(
        new Vector3().fromArray(acc.min!),
        new Vector3().fromArray(acc.max!),
      )
      bounds.union(box.applyMatrix4(m))
    }
  })
  const round = (v: Vector3): number[] => v.toArray().map((x) => Math.round(x * 1000) / 1000)
  const min = round(bounds.min)
  const max = round(bounds.max)
  return {
    min,
    max,
    size: max.map((x, i) => Math.round((x - min[i]!) * 1000) / 1000),
  }
}

// --- CLI ---

/** Reads and parses one model's GLB. Every failure names the model id. */
function loadGlb(entry: ModelEntry): { buf: Buffer; gltf: Gltf; binStart: number } {
  const path = join(PACK_RUNTIME, entry.relativePath)
  let buf: Buffer
  try {
    buf = readFileSync(path)
  } catch {
    throw new Error(`${entry.id}: cannot read ${entry.relativePath}`)
  }
  try {
    return { buf, ...parseGlb(buf) }
  } catch (err) {
    throw new Error(`${entry.id}: ${(err as Error).message}`)
  }
}

/** Parses and validates one model without writing. The buffer is released
 * on return, so a preflight of the whole pack costs a second read, not RAM. */
function preflight(entry: ModelEntry): void {
  const { buf, gltf, binStart } = loadGlb(entry)
  try {
    validatePositionAccessors(gltf, buf.length - binStart)
  } catch (err) {
    throw new Error(`${entry.id}: ${(err as Error).message}`)
  }
}

/** Patches one model and replaces its GLB atomically. Every error names the
 * model id. The caller writes the catalog immediately after each model, so a
 * crash cannot leave a patched GLB paired with a nonzero shift in the
 * catalog — which a retry would subtract a second time. */
function repairOne(entry: ModelEntry): void {
  try {
    const { buf, gltf, binStart } = loadGlb(entry)
    applyShiftToPositions(buf, binStart, gltf, -entry.normalizedShift)
    entry.bounds = computeAssembledBounds(gltf)
    const out = writeGlb(gltf, buf.subarray(binStart))
    const path = join(PACK_RUNTIME, entry.relativePath)
    writeFileSync(`${path}.tmp`, out)
    renameSync(`${path}.tmp`, path)
    entry.sizeBytes = out.length
    entry.normalizedShift = 0
  } catch (err) {
    const message = (err as Error).message
    throw new Error(message.startsWith(`${entry.id}: `) ? message : `${entry.id}: ${message}`)
  }
}

function writeCatalog(models: ModelEntry[]): void {
  writeFileSync(`${MODELS_JSON}.tmp`, JSON.stringify(models, null, 2))
  renameSync(`${MODELS_JSON}.tmp`, MODELS_JSON)
}

/** Downloads the upstream sources of the sample models and compares every
 * POSITION float against the repaired GLBs. Post-repair the data must match
 * upstream to within float32 round-trip noise. */
async function verifySample(models: ModelEntry[]): Promise<void> {
  for (const id of VERIFY_SAMPLE) {
    const entry = models.find((m) => m.id === id)
    if (!entry) throw new Error(`sample model ${id} not in catalog`)
    const response = await fetch(UPSTREAM_BASE + entry.sourceRelativePath)
    if (!response.ok) throw new Error(`${id}: upstream HTTP ${response.status}`)
    const src = JSON.parse(await response.text()) as Gltf & { buffers: { uri: string }[] }
    // An upstream .gltf holds many buffers — the bank has 240, one per
    // bufferView. Decode the buffer that each bufferView names, and keep it.
    const decoded = new Map<number, Buffer>()
    const srcBuffer = (bi: number): Buffer => {
      let bin = decoded.get(bi)
      if (!bin) {
        const uri = src.buffers[bi]?.uri
        if (!uri?.startsWith('data:')) {
          throw new Error(`${id}: upstream buffer ${bi} is not embedded`)
        }
        bin = Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64')
        decoded.set(bi, bin)
      }
      return bin
    }
    const outBin = readFileSync(join(PACK_RUNTIME, entry.relativePath))
    const { gltf, binStart } = parseGlb(outBin)

    // Nodes are matched by name. Some models repeat a name (the galleon has
    // two nodes called "galleon"), so reject a name that two mesh nodes share
    // instead of letting the map keep only the last one.
    const srcByName = new Map<string, Gltf['nodes'][number]>()
    for (const node of src.nodes) {
      if (node.mesh === undefined || !node.name) continue
      if (srcByName.has(node.name)) throw new Error(`${id}: two mesh nodes named ${node.name}`)
      srcByName.set(node.name, node)
    }
    let maxDev = 0
    for (const node of gltf.nodes) {
      if (node.mesh === undefined) continue
      const srcNode = srcByName.get(node.name ?? '')
      if (!srcNode) throw new Error(`${id}: no upstream mesh node named ${node.name}`)
      const outPrims = gltf.meshes[node.mesh]!.primitives
      const srcPrims = src.meshes[srcNode.mesh!]!.primitives
      if (outPrims.length !== srcPrims.length) {
        throw new Error(`${id}: primitive count differs on ${node.name}`)
      }
      outPrims.forEach((prim, pi) => {
        const outAcc = gltf.accessors[prim.attributes.POSITION]!
        const srcAcc = src.accessors[srcPrims[pi]!.attributes.POSITION]!
        if (outAcc.count !== srcAcc.count) {
          throw new Error(`${id}: vertex count differs on ${node.name}`)
        }
        const outView = gltf.bufferViews[outAcc.bufferView]!
        const srcView = src.bufferViews[srcAcc.bufferView]!
        const outStart = binStart + (outView.byteOffset ?? 0) + (outAcc.byteOffset ?? 0)
        const srcStart = (srcView.byteOffset ?? 0) + (srcAcc.byteOffset ?? 0)
        const outStride = outView.byteStride ?? 12
        const srcStride = srcView.byteStride ?? 12
        const srcBin = srcBuffer(srcView.buffer ?? 0)
        const srcEnd = srcStart + (srcAcc.count - 1) * srcStride + 12
        if (srcEnd > srcBin.length) {
          throw new Error(`${id}: upstream accessor on ${node.name} overruns its buffer`)
        }
        for (let v = 0; v < outAcc.count; v++) {
          for (let c = 0; c < 3; c++) {
            const a = outBin.readFloatLE(outStart + v * outStride + c * 4)
            const b = srcBin.readFloatLE(srcStart + v * srcStride + c * 4)
            maxDev = Math.max(maxDev, Math.abs(a - b))
          }
        }
      })
    }
    console.log(`${id}: max vertex deviation vs upstream = ${maxDev.toExponential(2)}`)
    if (maxDev > 1e-3) throw new Error(`${id}: deviation ${maxDev} exceeds 1e-3`)
  }
  console.log('verify: all 5 sample models match upstream within 1e-3')
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? '--apply'
  const models = JSON.parse(readFileSync(MODELS_JSON, 'utf8')) as ModelEntry[]

  if (mode === '--verify') {
    await verifySample(models)
    return
  }

  const pending = models.filter((m) => m.normalizedShift !== 0)
  console.log(`${pending.length} models with normalizedShift ≠ 0`)
  for (const entry of pending) console.log(`  ${entry.id} (shift ${entry.normalizedShift})`)
  if (mode === '--dry-run') return
  if (mode !== '--apply') throw new Error(`unknown mode "${mode}" (want --apply, --dry-run, --verify)`)

  // Preflight every model first. A refusal halfway through the write loop
  // would leave patched GLBs beside a models.json that still lists their
  // shifts, and the retry would subtract the shift a second time.
  for (const entry of pending) preflight(entry)
  console.log(`preflight passed for ${pending.length} models; writing`)

  // The catalog is rewritten after every model. It is 265 kB, so 279 rewrites
  // cost little, and each one keeps the catalog in step with the files.
  for (const entry of pending) {
    repairOne(entry)
    writeCatalog(models)
  }
  console.log(`repaired ${pending.length} GLBs and updated models.json`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main()
}
